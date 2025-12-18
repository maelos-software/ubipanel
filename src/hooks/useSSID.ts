import { useQuery } from "@tanstack/react-query";
import { queryInflux, escapeInfluxString, getNumberValue, getStringValue } from "@/lib/influx";
import { TRAFFIC_TOTAL_RANGE } from "@/lib/config";
import { buildTrafficMap, buildTrafficMapComposite } from "@/lib/bandwidth";
import { parseGroupedResults } from "./utils/parseInfluxResults";
import { useRefreshInterval } from "./useRefreshInterval";
import type { Client, SSIDVAPDetail } from "@/types/influx";

// Get VAPs for a specific SSID
export function useSSIDVAPs(essid: string) {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey: ["ssidVaps", essid],
    queryFn: async () => {
      // Query 1: Get current VAP state
      const currentResponse = await queryInflux(`
        SELECT last(channel) as channel, last(num_sta) as num_sta,
               last(avg_client_signal) as avg_client_signal, last(satisfaction) as satisfaction,
               last(ccq) as ccq, last(tx_power) as tx_power,
               last(tx_retries) as tx_retries, last(tx_dropped) as tx_dropped,
               last(rx_errors) as rx_errors, last(tx_errors) as tx_errors,
               last(tx_tcp_lat_avg) as tx_tcp_lat_avg
        FROM uap_vaps
        WHERE time > now() - 5m AND "essid" = '${escapeInfluxString(essid)}'
        GROUP BY "device_name", "radio", "bssid"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM uap_vaps
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE} AND "essid" = '${escapeInfluxString(essid)}'
        GROUP BY "device_name", "radio", "bssid"
      `);

      // Build a map of traffic by VAP key
      const trafficByVap = buildTrafficMapComposite(trafficResponse, [
        "device_name",
        "radio",
        "bssid",
      ]);

      return parseGroupedResults<SSIDVAPDetail>(currentResponse, (tags, columns, values) => {
        const vapKey = `${tags.device_name}|${tags.radio}|${tags.bssid}`;
        const traffic = trafficByVap.get(vapKey);

        return {
          apName: tags.device_name || "",
          radio: tags.radio || "",
          bssid: tags.bssid || "",
          channel: getNumberValue(columns, values, "channel"),
          numSta: getNumberValue(columns, values, "num_sta"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          satisfaction: getNumberValue(columns, values, "satisfaction"),
          avgClientSignal: getNumberValue(columns, values, "avg_client_signal"),
          ccq: getNumberValue(columns, values, "ccq"),
          txPower: getNumberValue(columns, values, "tx_power"),
          txRetries: getNumberValue(columns, values, "tx_retries"),
          txDropped: getNumberValue(columns, values, "tx_dropped"),
          rxErrors: getNumberValue(columns, values, "rx_errors"),
          txErrors: getNumberValue(columns, values, "tx_errors"),
          tcpLatencyAvg: getNumberValue(columns, values, "tx_tcp_lat_avg"),
        };
      });
    },
    refetchInterval,
    enabled: !!essid,
  });
}

// Get clients connected to a specific SSID
export function useSSIDClients(essid: string) {
  const refetchInterval = useRefreshInterval();
  return useQuery({
    queryKey: ["ssidClients", essid],
    queryFn: async () => {
      // Query 1: Get current client state
      const currentResponse = await queryInflux(`
        SELECT last("rx_bytes_r") as rx_bytes_r, last("tx_bytes_r") as tx_bytes_r,
               last(signal) as signal, last(rssi) as rssi,
               last(satisfaction) as satisfaction, last(channel) as channel,
               last(uptime) as uptime, last(hostname) as hostname, last(ip) as ip
        FROM clients
        WHERE time > now() - 5m AND essid = '${escapeInfluxString(essid)}'
        GROUP BY "mac", "name", "ap_name", "is_guest", "radio_proto", "oui"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      // SSID clients are always wireless, so use rx_bytes/tx_bytes (not wired-*)
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM clients
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE} AND essid = '${escapeInfluxString(essid)}'
        GROUP BY "mac"
      `);

      // Build a map of traffic by MAC
      const trafficByMac = buildTrafficMap(trafficResponse, "mac");

      return parseGroupedResults<Client>(currentResponse, (tags, columns, values) => {
        const mac = tags.mac || "";
        const traffic = trafficByMac.get(mac);
        const hostname = getStringValue(columns, values, "hostname");

        // UnPoller field mapping (see config.ts for details):
        // - UnPoller "signal" = dBm value -> our "rssi"
        // - UnPoller "rssi" = percentage -> our "signal"
        return {
          mac,
          name: tags.name || hostname || "Unknown",
          hostname,
          ip: getStringValue(columns, values, "ip"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          rxBytesR: getNumberValue(columns, values, "rx_bytes_r"),
          txBytesR: getNumberValue(columns, values, "tx_bytes_r"),
          signal: getNumberValue(columns, values, "rssi"), // UnPoller "rssi" = percentage
          rssi: getNumberValue(columns, values, "signal"), // UnPoller "signal" = dBm
          satisfaction: getNumberValue(columns, values, "satisfaction"),
          channel: getNumberValue(columns, values, "channel"),
          apName: tags.ap_name || "",
          swName: undefined,
          swPort: undefined,
          isWired: false,
          isGuest: tags.is_guest === "true",
          vlan: "",
          uptime: getNumberValue(columns, values, "uptime"),
          radioProto: tags.radio_proto || "",
        };
      });
    },
    refetchInterval,
    enabled: !!essid,
  });
}
