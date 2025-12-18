import { useQuery } from "@tanstack/react-query";
import { queryInflux, getNumberValue, getStringValue } from "@/lib/influx";
import { TRAFFIC_TOTAL_RANGE } from "@/lib/config";
import { parseGroupedResults } from "./utils/parseInfluxResults";
import { useRefreshInterval } from "./useRefreshInterval";
import type { Client } from "@/types/influx";

export function useClients() {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      // Query 1: Get current client state (rates, signal, etc.) - last 5 minutes
      // Note: Wired clients use "wired-*" fields, wireless use standard fields
      const currentResponse = await queryInflux(`
        SELECT last("rx_bytes_r") as rx_bytes_r, last("tx_bytes_r") as tx_bytes_r,
               last("wired-rx_bytes-r") as wired_rx_bytes_r, last("wired-tx_bytes-r") as wired_tx_bytes_r,
               last(signal) as signal, last(rssi) as rssi,
               last(satisfaction) as satisfaction, last(channel) as channel,
               last(uptime) as uptime, last(hostname) as hostname, last(ip) as ip
        FROM clients
        WHERE time > now() - 5m
        GROUP BY "mac", "name", "ap_name", "sw_name", "sw_port", "is_wired", "is_guest", "vlan", "radio_proto"
      `);

      // Query 2: Calculate actual traffic transferred in the time range using LAST-FIRST
      // This gives us real bytes transferred, not cumulative counters
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes,
               LAST("wired-rx_bytes") - FIRST("wired-rx_bytes") as wired_rx_bytes,
               LAST("wired-tx_bytes") - FIRST("wired-tx_bytes") as wired_tx_bytes
        FROM clients
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE}
        GROUP BY "mac"
      `);

      // Build a map of traffic by MAC
      const trafficByMac = new Map<
        string,
        { rx: number; tx: number; wiredRx: number; wiredTx: number }
      >();
      const trafficSeries = trafficResponse.results?.[0]?.series || [];
      for (const s of trafficSeries) {
        const mac = s.tags?.mac || "";
        const cols = s.columns;
        const vals = s.values?.[0] || [];
        const getVal = (key: string) => {
          const idx = cols.indexOf(key);
          return idx >= 0 ? (vals[idx] as number) || 0 : 0;
        };
        trafficByMac.set(mac, {
          rx: Math.max(0, getVal("rx_bytes")), // Ensure non-negative (counter resets can cause negative)
          tx: Math.max(0, getVal("tx_bytes")),
          wiredRx: Math.max(0, getVal("wired_rx_bytes")),
          wiredTx: Math.max(0, getVal("wired_tx_bytes")),
        });
      }

      const allClients = parseGroupedResults<Client>(currentResponse, (tags, columns, values) => {
        const isWired = tags.is_wired === "true";
        const mac = tags.mac || "";

        // Get traffic totals from the traffic query
        const traffic = trafficByMac.get(mac);
        const rxBytes = isWired ? traffic?.wiredRx || 0 : traffic?.rx || 0;
        const txBytes = isWired ? traffic?.wiredTx || 0 : traffic?.tx || 0;

        // Get current rates using typed helpers
        const rxBytesR = isWired
          ? getNumberValue(columns, values, "wired_rx_bytes_r")
          : getNumberValue(columns, values, "rx_bytes_r");
        const txBytesR = isWired
          ? getNumberValue(columns, values, "wired_tx_bytes_r")
          : getNumberValue(columns, values, "tx_bytes_r");

        // UnPoller field mapping (see config.ts for details):
        // - UnPoller "signal" = dBm value -> our "rssi"
        // - UnPoller "rssi" = percentage -> our "signal"
        return {
          mac,
          name: tags.name || getStringValue(columns, values, "hostname", "Unknown"),
          hostname: getStringValue(columns, values, "hostname"),
          ip: getStringValue(columns, values, "ip"),
          rxBytes,
          txBytes,
          rxBytesR,
          txBytesR,
          signal: getNumberValue(columns, values, "rssi"), // UnPoller "rssi" = percentage
          rssi: getNumberValue(columns, values, "signal"), // UnPoller "signal" = dBm
          satisfaction: getNumberValue(columns, values, "satisfaction"),
          channel: getNumberValue(columns, values, "channel"),
          apName: tags.ap_name || "",
          swName: tags.sw_name || undefined,
          swPort: tags.sw_port ? parseInt(tags.sw_port) : undefined,
          isWired,
          isGuest: tags.is_guest === "true",
          vlan: tags.vlan || "",
          uptime: getNumberValue(columns, values, "uptime"),
          radioProto: tags.radio_proto || "",
        };
      });

      // Deduplicate by MAC - keep the entry with highest uptime (most recent connection)
      const byMac = new Map<string, Client>();
      for (const client of allClients) {
        const existing = byMac.get(client.mac);
        if (!existing || client.uptime > existing.uptime) {
          byMac.set(client.mac, client);
        }
      }
      return Array.from(byMac.values());
    },
    refetchInterval,
  });
}
