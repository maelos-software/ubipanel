import { useQuery } from "@tanstack/react-query";
import { queryInflux, escapeInfluxString, getNumberValue, getStringValue } from "@/lib/influx";
import { TRAFFIC_TOTAL_RANGE } from "@/lib/config";
import { buildTrafficMap, buildTrafficMapComposite } from "@/lib/bandwidth";
import { parseGroupedResults } from "./utils/parseInfluxResults";
import { useRefreshInterval } from "./useRefreshInterval";
import type { AccessPoint, APVAP, APRadioExtended } from "@/types/influx";

export function useAccessPoints() {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey: ["accessPoints"],
    queryFn: async () => {
      // Query 1: Get current AP state (CPU, clients, etc.)
      const currentResponse = await queryInflux(`
        SELECT last(cpu) as cpu, last(mem) as mem, last(mem_total) as mem_total,
               last(num_sta) as num_sta, last("guest-num_sta") as guest_num_sta,
               last(loadavg_1) as loadavg_1, last(loadavg_5) as loadavg_5, last(loadavg_15) as loadavg_15,
               last(ip) as ip, last(system_uptime) as uptime
        FROM uap
        WHERE time > now() - 5m
        GROUP BY "mac", "name", "model", "version"
      `);

      // Query 2: Calculate actual traffic transferred in the time range using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM uap
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE}
        GROUP BY "mac"
      `);

      // Build a map of traffic by MAC
      const trafficByMac = buildTrafficMap(trafficResponse, "mac");

      return parseGroupedResults<AccessPoint>(currentResponse, (tags, columns, values) => {
        const mac = tags.mac || "";
        const traffic = trafficByMac.get(mac);

        return {
          mac,
          name: tags.name || "",
          model: tags.model || "",
          version: tags.version || "",
          ip: getStringValue(columns, values, "ip"),
          cpu: getNumberValue(columns, values, "cpu"),
          mem: getNumberValue(columns, values, "mem"),
          memTotal: getNumberValue(columns, values, "mem_total"),
          numSta: getNumberValue(columns, values, "num_sta"),
          guestNumSta: getNumberValue(columns, values, "guest_num_sta"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          loadavg1: getNumberValue(columns, values, "loadavg_1"),
          loadavg5: getNumberValue(columns, values, "loadavg_5"),
          loadavg15: getNumberValue(columns, values, "loadavg_15"),
          uptime: getNumberValue(columns, values, "uptime"),
        };
      });
    },
    refetchInterval,
  });
}

// Get all VAPs (Virtual Access Points / SSIDs) across all APs
export function useAPVAPs(apName?: string) {
  const refetchInterval = useRefreshInterval();
  return useQuery({
    queryKey: ["apVaps", apName],
    queryFn: async () => {
      const apFilter = apName ? ` AND "device_name" = '${escapeInfluxString(apName)}'` : "";

      // Query 1: Get current VAP state
      const currentResponse = await queryInflux(`
        SELECT last(num_sta) as num_sta,
               last(channel) as channel, last(satisfaction) as satisfaction,
               last(avg_client_signal) as avg_client_signal, last(ccq) as ccq, last(tx_power) as tx_power
        FROM uap_vaps
        WHERE time > now() - 5m${apFilter}
        GROUP BY "device_name", "radio", "radio_name", "essid", "bssid", "is_guest", "usage", "ap_mac"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM uap_vaps
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE}${apFilter}
        GROUP BY "device_name", "essid", "radio"
      `);

      // Build a map of traffic by VAP key (device_name + essid + radio)
      const trafficByVap = buildTrafficMapComposite(trafficResponse, [
        "device_name",
        "essid",
        "radio",
      ]);

      return parseGroupedResults<APVAP>(currentResponse, (tags, columns, values) => {
        const vapKey = `${tags.device_name}|${tags.essid}|${tags.radio}`;
        const traffic = trafficByVap.get(vapKey);

        return {
          apMac: tags.ap_mac || "",
          apName: tags.device_name || "",
          radio: tags.radio || "",
          radioName: tags.radio_name || "",
          essid: tags.essid || "",
          bssid: tags.bssid || "",
          channel: getNumberValue(columns, values, "channel"),
          isGuest: tags.is_guest === "true",
          usage: tags.usage || "user",
          numSta: getNumberValue(columns, values, "num_sta"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          satisfaction: getNumberValue(columns, values, "satisfaction"),
          avgClientSignal: getNumberValue(columns, values, "avg_client_signal"),
          ccq: getNumberValue(columns, values, "ccq"),
          txPower: getNumberValue(columns, values, "tx_power"),
        };
      });
    },
    refetchInterval,
  });
}

// Get all radios across all APs with extended data
export function useAPRadios(apName?: string) {
  const refetchInterval = useRefreshInterval();
  return useQuery({
    queryKey: ["apRadios", apName],
    queryFn: async () => {
      const whereClause = apName
        ? `WHERE time > now() - 5m AND "device_name" = '${escapeInfluxString(apName)}'`
        : "WHERE time > now() - 5m";

      const response = await queryInflux(`
        SELECT last(channel) as channel, last(tx_power) as tx_power,
               last(num_sta) as num_sta, last("guest-num_sta") as guest_num_sta,
               last(cu_total) as cu_total, last(cu_self_rx) as cu_self_rx, last(cu_self_tx) as cu_self_tx,
               last(gain) as gain, last(max_txpower) as max_txpower, last(min_txpower) as min_txpower,
               last(nss) as nss, last(tx_packets) as tx_packets, last(tx_retries) as tx_retries,
               last(ht) as ht
        FROM uap_radios
        ${whereClause}
        GROUP BY "device_name", "radio"
      `);

      return parseGroupedResults<APRadioExtended>(response, (tags, columns, values) => {
        return {
          apName: tags.device_name || "",
          radio: tags.radio || "",
          channel: getNumberValue(columns, values, "channel"),
          txPower: getNumberValue(columns, values, "tx_power"),
          numSta: getNumberValue(columns, values, "num_sta"),
          guestNumSta: getNumberValue(columns, values, "guest_num_sta"),
          cuTotal: getNumberValue(columns, values, "cu_total"),
          cuSelfRx: getNumberValue(columns, values, "cu_self_rx"),
          cuSelfTx: getNumberValue(columns, values, "cu_self_tx"),
          ht: getStringValue(columns, values, "ht"),
          gain: getNumberValue(columns, values, "gain"),
          maxTxPower: getNumberValue(columns, values, "max_txpower"),
          minTxPower: getNumberValue(columns, values, "min_txpower"),
          nss: getNumberValue(columns, values, "nss"),
          txPackets: getNumberValue(columns, values, "tx_packets"),
          txRetries: getNumberValue(columns, values, "tx_retries"),
        };
      });
    },
    refetchInterval,
  });
}
