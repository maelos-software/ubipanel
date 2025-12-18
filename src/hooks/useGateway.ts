import { useQuery } from "@tanstack/react-query";
import { queryInflux, getNumberValue, getStringValue, getBooleanValue } from "@/lib/influx";
import { TRAFFIC_TOTAL_RANGE } from "@/lib/config";
import { buildTrafficMap } from "@/lib/bandwidth";
import { parseGroupedResults } from "./utils/parseInfluxResults";
import { useRefreshInterval } from "./useRefreshInterval";
import type { Gateway, WANPort, USGNetwork } from "@/types/influx";

export function useGateway() {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey: ["gateway"],
    queryFn: async () => {
      const response = await queryInflux(`
        SELECT last(cpu) as cpu, last(mem) as mem, last(mem_total) as mem_total,
               last(mem_used) as mem_used, last(mem_buffer) as mem_buffer,
               last(loadavg_1) as loadavg_1, last(loadavg_5) as loadavg_5, last(loadavg_15) as loadavg_15,
               last(num_desktop) as num_desktop, last(num_mobile) as num_mobile, last(num_handheld) as num_handheld,
               last("user-num_sta") as user_num_sta, last("guest-num_sta") as guest_num_sta,
               last("speedtest-status_latency") as speedtest_latency,
               last("speedtest-status_xput_download") as speedtest_download,
               last("speedtest-status_xput_upload") as speedtest_upload,
               last(temp_cpu) as temp_cpu, last(temp_local) as temp_local, last(temp_phy) as temp_phy,
               last("lan-rx_bytes") as lan_rx_bytes, last("lan-tx_bytes") as lan_tx_bytes,
               last("lan-rx_packets") as lan_rx_packets, last("lan-tx_packets") as lan_tx_packets,
               last(uplink_latency) as uplink_latency, last(uplink_speed) as uplink_speed,
               last(uplink_max_speed) as uplink_max_speed, last(uplink_name) as uplink_name,
               last(uplink_type) as uplink_type, last(uplink_uptime) as uplink_uptime,
               last(storage_backup_pct) as storage_backup_pct, last(storage_backup_size) as storage_backup_size,
               last(storage_temporary_pct) as storage_temp_pct, last(storage_temporary_size) as storage_temp_size,
               last(system_uptime) as system_uptime, last(state) as state, last(ip) as ip
        FROM usg
        WHERE time > now() - 5m
        GROUP BY "mac", "name", "model", "version"
      `);

      const gateways = parseGroupedResults<Gateway>(response, (tags, columns, values) => {
        return {
          mac: tags.mac || "",
          name: tags.name || "",
          model: tags.model || "",
          version: tags.version || "",
          ip: getStringValue(columns, values, "ip"),
          cpu: getNumberValue(columns, values, "cpu"),
          mem: getNumberValue(columns, values, "mem"),
          memTotal: getNumberValue(columns, values, "mem_total"),
          memUsed: getNumberValue(columns, values, "mem_used"),
          memBuffer: getNumberValue(columns, values, "mem_buffer"),
          loadavg1: getNumberValue(columns, values, "loadavg_1"),
          loadavg5: getNumberValue(columns, values, "loadavg_5"),
          loadavg15: getNumberValue(columns, values, "loadavg_15"),
          numDesktop: getNumberValue(columns, values, "num_desktop"),
          numMobile: getNumberValue(columns, values, "num_mobile"),
          numHandheld: getNumberValue(columns, values, "num_handheld"),
          numUserSta: getNumberValue(columns, values, "user_num_sta"),
          numGuestSta: getNumberValue(columns, values, "guest_num_sta"),
          speedtestLatency: getNumberValue(columns, values, "speedtest_latency"),
          speedtestDownload: getNumberValue(columns, values, "speedtest_download"),
          speedtestUpload: getNumberValue(columns, values, "speedtest_upload"),
          tempCpu: getNumberValue(columns, values, "temp_cpu"),
          tempLocal: getNumberValue(columns, values, "temp_local"),
          tempPhy: getNumberValue(columns, values, "temp_phy"),
          lanRxBytes: getNumberValue(columns, values, "lan_rx_bytes"),
          lanTxBytes: getNumberValue(columns, values, "lan_tx_bytes"),
          lanRxPackets: getNumberValue(columns, values, "lan_rx_packets"),
          lanTxPackets: getNumberValue(columns, values, "lan_tx_packets"),
          uplinkLatency: getNumberValue(columns, values, "uplink_latency"),
          uplinkSpeed: getNumberValue(columns, values, "uplink_speed"),
          uplinkMaxSpeed: getNumberValue(columns, values, "uplink_max_speed"),
          uplinkName: getStringValue(columns, values, "uplink_name"),
          uplinkType: getStringValue(columns, values, "uplink_type"),
          uplinkUptime: getNumberValue(columns, values, "uplink_uptime"),
          storageBackupPct: getNumberValue(columns, values, "storage_backup_pct"),
          storageBackupSize: getNumberValue(columns, values, "storage_backup_size"),
          storageTempPct: getNumberValue(columns, values, "storage_temp_pct"),
          storageTempSize: getNumberValue(columns, values, "storage_temp_size"),
          systemUptime: getNumberValue(columns, values, "system_uptime"),
          state: getNumberValue(columns, values, "state"),
        };
      });

      return gateways[0] || null;
    },
    refetchInterval,
  });
}

export function useWANPorts() {
  const refetchInterval = useRefreshInterval();
  return useQuery({
    queryKey: ["wanPorts"],
    queryFn: async () => {
      // Query 1: Get current WAN port state (including rates which are correct)
      const currentResponse = await queryInflux(`
        SELECT last("rx_bytes-r") as rx_bytes_r, last("tx_bytes-r") as tx_bytes_r,
               last(rx_errors) as rx_errors, last(tx_errors) as tx_errors,
               last(rx_dropped) as rx_dropped, last(tx_dropped) as tx_dropped,
               last(rx_packets) as rx_packets, last(tx_packets) as tx_packets,
               last(rx_broadcast) as rx_broadcast, last(tx_broadcast) as tx_broadcast,
               last(rx_multicast) as rx_multicast, last(tx_multicast) as tx_multicast,
               last(speed) as speed, last(max_speed) as max_speed,
               last(full_duplex) as full_duplex, last(is_uplink) as is_uplink,
               last(gateway) as gateway
        FROM usg_wan_ports
        WHERE time > now() - 5m
        GROUP BY "ifname", "ip", "mac", "type", "up", "enabled", "purpose"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM usg_wan_ports
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE}
        GROUP BY "ifname"
      `);

      // Build a map of traffic by interface name
      const trafficByIf = buildTrafficMap(trafficResponse, "ifname");

      const ports = parseGroupedResults<WANPort>(currentResponse, (tags, columns, values) => {
        const ifname = tags.ifname || "";
        const traffic = trafficByIf.get(ifname);

        return {
          name: tags.purpose || tags.ifname || "",
          ifname,
          ip: tags.ip || "",
          mac: tags.mac || "",
          gateway: getStringValue(columns, values, "gateway"),
          type: tags.type || "",
          up: tags.up === "true",
          enabled: tags.enabled === "true",
          isUplink: getBooleanValue(columns, values, "is_uplink"),
          speed: getNumberValue(columns, values, "speed"),
          maxSpeed: getNumberValue(columns, values, "max_speed"),
          fullDuplex: getBooleanValue(columns, values, "full_duplex"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          rxBytesR: getNumberValue(columns, values, "rx_bytes_r"),
          txBytesR: getNumberValue(columns, values, "tx_bytes_r"),
          rxErrors: getNumberValue(columns, values, "rx_errors"),
          txErrors: getNumberValue(columns, values, "tx_errors"),
          rxDropped: getNumberValue(columns, values, "rx_dropped"),
          txDropped: getNumberValue(columns, values, "tx_dropped"),
          rxPackets: getNumberValue(columns, values, "rx_packets"),
          txPackets: getNumberValue(columns, values, "tx_packets"),
          rxBroadcast: getNumberValue(columns, values, "rx_broadcast"),
          txBroadcast: getNumberValue(columns, values, "tx_broadcast"),
          rxMulticast: getNumberValue(columns, values, "rx_multicast"),
          txMulticast: getNumberValue(columns, values, "tx_multicast"),
        };
      });

      // Sort: active uplink first, then by interface name
      return ports.sort((a, b) => {
        if (a.isUplink !== b.isUplink) return a.isUplink ? -1 : 1;
        return a.ifname.localeCompare(b.ifname);
      });
    },
    refetchInterval,
  });
}

export function useUSGNetworks() {
  const refetchInterval = useRefreshInterval();
  return useQuery({
    queryKey: ["usgNetworks"],
    queryFn: async () => {
      // Query 1: Get current network state
      const currentResponse = await queryInflux(`
        SELECT last(num_sta) as num_sta,
               last(rx_packets) as rx_packets, last(tx_packets) as tx_packets
        FROM usg_networks
        WHERE time > now() - 5m
        GROUP BY "name", "ip", "mac", "purpose", "domain_name", "enabled", "is_guest"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM usg_networks
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE}
        GROUP BY "name"
      `);

      // Build a map of traffic by network name
      const trafficByName = buildTrafficMap(trafficResponse, "name");

      return parseGroupedResults<USGNetwork>(currentResponse, (tags, columns, values) => {
        const name = tags.name || "";
        const traffic = trafficByName.get(name);

        return {
          name,
          ip: tags.ip || "",
          mac: tags.mac || "",
          purpose: tags.purpose || "",
          domainName: tags.domain_name || "",
          enabled: tags.enabled === "true",
          isGuest: tags.is_guest === "true",
          numSta: getNumberValue(columns, values, "num_sta"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          rxPackets: getNumberValue(columns, values, "rx_packets"),
          txPackets: getNumberValue(columns, values, "tx_packets"),
        };
      });
    },
    refetchInterval,
  });
}
