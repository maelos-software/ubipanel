/**
 * Switch/Port history hooks
 */

import { escapeInfluxString } from "@/lib/influx";
import { SWITCH_QUERIES } from "@/lib/queries/switches";
import { useTimeSeries } from "../useTimeSeries";
import {
  type RateHistoryPoint,
  type PortErrorsPoint,
  type PortPoePoint,
  type PortPacketsPoint,
} from "./types";

/**
 * Fetch switch port bandwidth history
 */
export function useSwitchPortHistory(
  swName: string,
  portIdx: number,
  duration: string = "1h",
  interval: string = "1m"
) {
  return useTimeSeries<RateHistoryPoint>({
    key: ["switchPortHistory", swName, portIdx, duration, interval],
    query: () =>
      SWITCH_QUERIES.portBandwidthHistory(escapeInfluxString(swName), portIdx, duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      rxRate: (values[columns.indexOf("rx_rate")] as number) || 0,
      txRate: (values[columns.indexOf("tx_rate")] as number) || 0,
    }),
    filter: (p) => p.rxRate > 0 || p.txRate > 0,
    enabled: !!swName,
  });
}

/**
 * Fetch switch port errors/dropped history
 */
export function useSwitchPortErrorsHistory(
  swName: string,
  portIdx: number,
  duration: string = "24h",
  interval: string = "15m"
) {
  return useTimeSeries<PortErrorsPoint>({
    key: ["switchPortErrorsHistory", swName, portIdx, duration, interval],
    query: () =>
      SWITCH_QUERIES.portErrorsHistory(escapeInfluxString(swName), portIdx, duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      rxErrors: (values[columns.indexOf("rx_errors")] as number) || 0,
      txErrors: (values[columns.indexOf("tx_errors")] as number) || 0,
      rxDropped: (values[columns.indexOf("rx_dropped")] as number) || 0,
      txDropped: (values[columns.indexOf("tx_dropped")] as number) || 0,
    }),
    enabled: !!swName,
  });
}

/**
 * Fetch switch port PoE history
 */
export function useSwitchPortPoeHistory(
  swName: string,
  portIdx: number,
  duration: string = "24h",
  interval: string = "15m"
) {
  return useTimeSeries<PortPoePoint>({
    key: ["switchPortPoeHistory", swName, portIdx, duration, interval],
    query: () =>
      SWITCH_QUERIES.portPoeHistory(escapeInfluxString(swName), portIdx, duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      power: (values[columns.indexOf("power")] as number) || 0,
      voltage: (values[columns.indexOf("voltage")] as number) || 0,
      current: (values[columns.indexOf("current")] as number) || 0,
    }),
    filter: (p) => p.power > 0,
    enabled: !!swName,
  });
}

/**
 * Fetch switch port packets history (for packet rate chart)
 */
export function useSwitchPortPacketsHistory(
  swName: string,
  portIdx: number,
  duration: string = "3h",
  interval: string = "5m"
) {
  return useTimeSeries<PortPacketsPoint>({
    key: ["switchPortPacketsHistory", swName, portIdx, duration, interval],
    query: () =>
      SWITCH_QUERIES.portPacketsHistory(escapeInfluxString(swName), portIdx, duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      rxPackets: Math.max(0, (values[columns.indexOf("rx_pps")] as number) || 0),
      txPackets: Math.max(0, (values[columns.indexOf("tx_pps")] as number) || 0),
      rxBroadcast: Math.max(0, (values[columns.indexOf("rx_bcast")] as number) || 0),
      txBroadcast: Math.max(0, (values[columns.indexOf("tx_bcast")] as number) || 0),
      rxMulticast: Math.max(0, (values[columns.indexOf("rx_mcast")] as number) || 0),
      txMulticast: Math.max(0, (values[columns.indexOf("tx_mcast")] as number) || 0),
    }),
    filter: (p) => p.rxPackets > 0 || p.txPackets > 0,
    enabled: !!swName,
  });
}
