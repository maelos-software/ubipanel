/**
 * SSID history hooks
 */

import { escapeInfluxString } from "@/lib/influx";
import { SSID_QUERIES } from "@/lib/queries/ssids";
import { isValidSignal, SIGNAL_FILTER_SQL } from "@/lib/format";
import { useTimeSeries } from "../useTimeSeries";
import { type RateHistoryPoint, type SSIDClientsPoint, type SSIDQualityPoint } from "./types";

/**
 * Fetch SSID clients history
 */
export function useSSIDClientsHistory(
  essid: string,
  duration: string = "3h",
  interval: string = "5m"
) {
  return useTimeSeries<SSIDClientsPoint>({
    key: ["ssidClientsHistory", essid, duration, interval],
    query: () => SSID_QUERIES.clientsHistory(escapeInfluxString(essid), duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      clients: (values[columns.indexOf("clients")] as number) || 0,
    }),
    filter: (p) => p.clients > 0,
    enabled: !!essid,
  });
}

/**
 * Fetch SSID bandwidth history
 */
export function useSSIDBandwidthHistory(
  essid: string,
  duration: string = "3h",
  interval: string = "5m"
) {
  return useTimeSeries<RateHistoryPoint>({
    key: ["ssidBandwidthHistory", essid, duration, interval],
    query: () => SSID_QUERIES.bandwidthHistory(escapeInfluxString(essid), duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      rxRate: Math.max(0, (values[columns.indexOf("rx_rate")] as number) || 0),
      txRate: Math.max(0, (values[columns.indexOf("tx_rate")] as number) || 0),
    }),
    filter: (p) => p.rxRate > 0 || p.txRate > 0,
    enabled: !!essid,
  });
}

/**
 * Fetch SSID signal/satisfaction history
 */
export function useSSIDQualityHistory(
  essid: string,
  duration: string = "3h",
  interval: string = "5m"
) {
  return useTimeSeries<SSIDQualityPoint>({
    key: ["ssidQualityHistory", essid, duration, interval],
    query: () =>
      SSID_QUERIES.qualityHistory(escapeInfluxString(essid), duration, interval, SIGNAL_FILTER_SQL),
    mapper: (columns, values) => ({
      time: values[0] as string,
      avgSignal: (values[columns.indexOf("avg_signal")] as number) || 0,
      satisfaction: (values[columns.indexOf("satisfaction")] as number) || 0,
    }),
    filter: (p) => isValidSignal(p.avgSignal),
    enabled: !!essid,
  });
}
