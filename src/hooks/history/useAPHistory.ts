/**
 * Access Point history hooks
 */

import { escapeInfluxString } from "@/lib/influx";
import { AP_QUERIES } from "@/lib/queries/aps";
import { isValidSignal, SIGNAL_FILTER_SQL } from "@/lib/format";
import { useTimeSeries } from "../useTimeSeries";
import {
  aggregateMultiEntityTimeSeries,
  filterZeroPoints,
  type RateHistoryPoint,
  type APClientsPoint,
  type APSignalHistoryPoint,
  type MultiAPClientsPoint,
  type MultiAPSignalPoint,
  type MultiAPBandwidthPoint,
} from "./types";

/**
 * Fetch AP bandwidth history (using derivative of counters)
 */
export function useAPBandwidthHistory(
  name: string,
  duration: string = "1h",
  interval: string = "1m"
) {
  return useTimeSeries<RateHistoryPoint>({
    key: ["apBandwidthHistory", name, duration, interval],
    query: () => AP_QUERIES.bandwidthHistory(escapeInfluxString(name), duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      rxRate: Math.max(0, (values[columns.indexOf("rx_rate")] as number) || 0),
      txRate: Math.max(0, (values[columns.indexOf("tx_rate")] as number) || 0),
    }),
    filter: (p) => p.rxRate > 0 || p.txRate > 0,
    enabled: !!name,
  });
}

/**
 * Fetch AP channel utilization history (grouped by radio)
 */
export function useAPChannelUtilization(
  name: string,
  duration: string = "1h",
  interval: string = "5m"
) {
  return useTimeSeries({
    key: ["apChannelUtilization", name, duration, interval],
    query: () => AP_QUERIES.channelUtilization(escapeInfluxString(name), duration, interval),
    processor: (response) => {
      const series = response.results[0]?.series || [];
      return series.map((s) => ({
        radio: s.tags?.radio || "",
        data: s.values.map((row) => ({
          time: row[0] as string,
          cuTotal: (row[s.columns.indexOf("cu_total")] as number) || 0,
          cuSelfRx: (row[s.columns.indexOf("cu_self_rx")] as number) || 0,
          cuSelfTx: (row[s.columns.indexOf("cu_self_tx")] as number) || 0,
        })),
      }));
    },
    enabled: !!name,
  });
}

/**
 * Fetch AP clients history (users and guests over time)
 */
export function useAPClientsHistory(
  apName: string,
  duration: string = "3h",
  interval: string = "5m"
) {
  return useTimeSeries<APClientsPoint>({
    key: ["apClientsHistory", apName, duration, interval],
    query: () => AP_QUERIES.clientsHistory(escapeInfluxString(apName), duration, interval),
    mapper: (columns, values) => {
      const userSta = (values[columns.indexOf("num_sta")] as number) || 0;
      const guestSta = (values[columns.indexOf("guest_num_sta")] as number) || 0;
      return {
        time: values[0] as string,
        userSta,
        guestSta,
        total: userSta + guestSta,
      };
    },
    filter: (p) => p.total > 0,
    enabled: !!apName,
  });
}

/**
 * Fetch clients history for all APs (for overview chart)
 */
export function useAllAPClientsHistory(duration: string = "3h", interval: string = "5m") {
  return useTimeSeries({
    key: ["allAPClientsHistory", duration, interval],
    query: () => AP_QUERIES.allClientsHistory(duration, interval),
    processor: (response) => {
      const { data, entities } = aggregateMultiEntityTimeSeries<MultiAPClientsPoint>({
        response,
        entityTag: "name",
        rowMapper: (row, columns, apName) => ({
          [apName]: (row[columns.indexOf("num_sta")] as number) || 0,
        }),
        filter: filterZeroPoints,
      });
      return { data, apNames: entities };
    },
  });
}

/**
 * Fetch average client signal per AP over time
 */
export function useAPSignalHistory(
  apName: string,
  duration: string = "3h",
  interval: string = "5m"
) {
  return useTimeSeries<APSignalHistoryPoint>({
    key: ["apSignalHistory", apName, duration, interval],
    query: () =>
      AP_QUERIES.signalHistory(escapeInfluxString(apName), duration, interval, SIGNAL_FILTER_SQL),
    mapper: (columns, values) => ({
      time: values[0] as string,
      avgSignal: (values[columns.indexOf("avg_signal")] as number) || 0,
    }),
    filter: (p) => isValidSignal(p.avgSignal),
    enabled: !!apName,
  });
}

/**
 * Fetch average signal history for all APs (for overview chart)
 */
export function useAllAPSignalHistory(duration: string = "3h", interval: string = "5m") {
  return useTimeSeries({
    key: ["allAPSignalHistory", duration, interval],
    query: () => AP_QUERIES.allSignalHistory(duration, interval, SIGNAL_FILTER_SQL),
    processor: (response) => {
      const { data, entities } = aggregateMultiEntityTimeSeries<MultiAPSignalPoint>({
        response,
        entityTag: "device_name",
        rowMapper: (row, columns, apName) => ({
          [apName]: (row[columns.indexOf("avg_signal")] as number) || 0,
        }),
        valueFilter: (value) => isValidSignal(value),
      });
      return { data, apNames: entities };
    },
  });
}

/**
 * Fetch channel utilization history for all APs
 */
export function useAllChannelUtilHistory(
  duration: string = "3h",
  interval: string = "5m",
  band?: "5GHz" | "2.4GHz"
) {
  return useTimeSeries({
    key: ["allChannelUtilHistory", duration, interval, band],
    query: () => {
      let channelFilter = "";
      if (band === "2.4GHz") {
        channelFilter = "AND channel <= '14'";
      } else if (band === "5GHz") {
        channelFilter = "AND channel >= '36'";
      }
      return AP_QUERIES.allChannelUtilHistory(duration, interval, channelFilter);
    },
    processor: (response) => {
      const { data, entities } = aggregateMultiEntityTimeSeries<{
        time: string;
        [key: string]: string | number;
      }>({
        response,
        entityTag: "device_name",
        rowMapper: (row, columns, apName) => ({
          [`${apName} Rx`]: (row[columns.indexOf("cu_self_rx")] as number) || 0,
          [`${apName} Tx`]: (row[columns.indexOf("cu_self_tx")] as number) || 0,
          [`${apName} Total`]: (row[columns.indexOf("cu_total")] as number) || 0,
        }),
        filter: filterZeroPoints,
      });
      return { data, apNames: entities };
    },
  });
}

/**
 * Fetch VAP traffic history by band for a specific AP
 */
export function useAPBandTrafficHistory(
  apName: string,
  band: "5GHz" | "2.4GHz",
  duration: string = "3h",
  interval: string = "5m"
) {
  return useTimeSeries<RateHistoryPoint>({
    key: ["apBandTrafficHistory", apName, band, duration, interval],
    query: () => {
      const channelFilter = band === "2.4GHz" ? "AND channel <= 14" : "AND channel >= 36";
      return AP_QUERIES.vapBandwidthHistory(
        escapeInfluxString(apName),
        duration,
        interval,
        channelFilter
      );
    },
    mapper: (columns, values) => ({
      time: values[0] as string,
      rxRate: Math.max(0, (values[columns.indexOf("rx_rate")] as number) || 0),
      txRate: Math.max(0, (values[columns.indexOf("tx_rate")] as number) || 0),
    }),
    filter: (p) => p.rxRate > 0 || p.txRate > 0,
    enabled: !!apName,
  });
}

/**
 * Fetch bandwidth history for all APs (for overview chart)
 */
export function useAllAPBandwidthHistory(duration: string = "3h", interval: string = "5m") {
  return useTimeSeries({
    key: ["allAPBandwidthHistory", duration, interval],
    query: () => AP_QUERIES.allBandwidthHistory(duration, interval),
    processor: (response) => {
      const { data, entities } = aggregateMultiEntityTimeSeries<MultiAPBandwidthPoint>({
        response,
        entityTag: "name",
        rowMapper: (row, columns, apName) => ({
          [`${apName}_rx`]: Math.max(0, (row[columns.indexOf("rx_rate")] as number) || 0),
          [`${apName}_tx`]: Math.max(0, (row[columns.indexOf("tx_rate")] as number) || 0),
        }),
        filter: filterZeroPoints,
      });
      return { data, apNames: entities };
    },
  });
}

/**
 * Fetch AP CCQ (Client Connection Quality) history
 */
export function useAPCCQHistory(apName: string, duration: string = "3h", interval: string = "5m") {
  return useTimeSeries({
    key: ["apCCQHistory", apName, duration, interval],
    query: () => AP_QUERIES.ccqHistory(escapeInfluxString(apName), duration, interval),
    processor: (response) => {
      const { data, entities } = aggregateMultiEntityTimeSeries<{
        time: string;
        [key: string]: string | number;
      }>({
        response,
        entityTag: "radio",
        rowMapper: (row, columns, radio) => ({
          [radio]: (row[columns.indexOf("ccq")] as number) || 0,
        }),
        filter: filterZeroPoints,
      });
      return { data, radios: entities };
    },
    enabled: !!apName,
  });
}
