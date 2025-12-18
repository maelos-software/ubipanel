import { useQuery } from "@tanstack/react-query";
import { queryInflux, getNumberValue, getStringValue } from "@/lib/influx";
import { TRAFFIC_TOTAL_RANGE } from "@/lib/config";
import { buildTrafficMap, buildTrafficMapComposite } from "@/lib/bandwidth";
import { parseGroupedResults } from "./utils/parseInfluxResults";
import { useRefreshInterval } from "./useRefreshInterval";
import type { Switch, SwitchPort } from "@/types/influx";

export function useSwitches() {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey: ["switches"],
    queryFn: async () => {
      // Query 1: Get current switch state
      const currentResponse = await queryInflux(`
        SELECT last(cpu) as cpu, last(mem) as mem, last(mem_total) as mem_total,
               last(general_temperature) as temperature, last(fan_level) as fan_level,
               last("guest-num_sta") as num_sta,
               last(ip) as ip, last(system_uptime) as uptime
        FROM usw
        WHERE time > now() - 5m
        GROUP BY "mac", "name", "model", "version"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM usw
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE}
        GROUP BY "mac"
      `);

      // Build a map of traffic by MAC
      const trafficByMac = buildTrafficMap(trafficResponse, "mac");

      return parseGroupedResults<Switch>(currentResponse, (tags, columns, values) => {
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
          temperature: getNumberValue(columns, values, "temperature"),
          fanLevel: getNumberValue(columns, values, "fan_level"),
          numSta: getNumberValue(columns, values, "num_sta"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          uptime: getNumberValue(columns, values, "uptime"),
        };
      });
    },
    refetchInterval,
  });
}

// Get all switch ports across all switches
export function useAllSwitchPorts() {
  const refetchInterval = useRefreshInterval();
  return useQuery({
    queryKey: ["allSwitchPorts"],
    queryFn: async () => {
      // Query 1: Get current port state (including rates which are already correct)
      const currentResponse = await queryInflux(`
        SELECT last(speed) as speed,
               last("rx_bytes-r") as rx_bytes_r, last("tx_bytes-r") as tx_bytes_r,
               last(rx_errors) as rx_errors, last(tx_errors) as tx_errors,
               last(rx_dropped) as rx_dropped, last(tx_dropped) as tx_dropped,
               last(poe_power) as poe_power, last(poe_voltage) as poe_voltage, last(poe_current) as poe_current
        FROM usw_ports
        WHERE time > now() - 5m
        GROUP BY "device_name", "port_idx", "name", "poe_mode", "poe_enable"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM usw_ports
        WHERE time > now() - ${TRAFFIC_TOTAL_RANGE}
        GROUP BY "device_name", "port_idx"
      `);

      // Build a map of traffic by port key
      const trafficByPort = buildTrafficMapComposite(trafficResponse, ["device_name", "port_idx"]);

      return parseGroupedResults<SwitchPort>(currentResponse, (tags, columns, values) => {
        const portKey = `${tags.device_name}|${tags.port_idx}`;
        const traffic = trafficByPort.get(portKey);

        return {
          swName: tags.device_name || "",
          portIdx: parseInt(tags.port_idx || "0"),
          name: tags.name || "",
          speed: getNumberValue(columns, values, "speed"),
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          rxBytesR: getNumberValue(columns, values, "rx_bytes_r"),
          txBytesR: getNumberValue(columns, values, "tx_bytes_r"),
          rxErrors: getNumberValue(columns, values, "rx_errors"),
          txErrors: getNumberValue(columns, values, "tx_errors"),
          rxDropped: getNumberValue(columns, values, "rx_dropped"),
          txDropped: getNumberValue(columns, values, "tx_dropped"),
          poePower: getNumberValue(columns, values, "poe_power"),
          poeVoltage: getNumberValue(columns, values, "poe_voltage"),
          poeCurrent: getNumberValue(columns, values, "poe_current"),
        };
      });
    },
    refetchInterval,
  });
}
