/**
 * WAN bandwidth history hooks
 */

import { WAN_QUERIES } from "@/lib/queries/wan";
import { useTimeSeries } from "../useTimeSeries";
import {
  aggregateMultiEntityTimeSeries,
  filterZeroPoints,
  type RateHistoryPoint,
  type MultiWANBandwidthPoint,
} from "./types";

/**
 * Fetch aggregated WAN bandwidth history (uplink only)
 */
export function useWANBandwidthHistory(duration: string = "1h", interval: string = "1m") {
  return useTimeSeries<RateHistoryPoint>({
    key: ["wanBandwidthHistory", duration, interval],
    query: () => WAN_QUERIES.bandwidthHistory(duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      rxRate: (values[columns.indexOf("rx_rate")] as number) || 0,
      txRate: (values[columns.indexOf("tx_rate")] as number) || 0,
    }),
    filter: (p) => p.rxRate > 0 || p.txRate > 0,
  });
}

/**
 * Fetch bandwidth history for all WAN interfaces (grouped by ifname)
 */
export function useMultiWANBandwidthHistory(duration: string = "1h", interval: string = "1m") {
  return useTimeSeries({
    key: ["multiWanBandwidthHistory", duration, interval],
    query: () => WAN_QUERIES.multiBandwidthHistory(duration, interval),
    processor: (response) => {
      const { data, entities } = aggregateMultiEntityTimeSeries<MultiWANBandwidthPoint>({
        response,
        entityTag: "ifname",
        rowMapper: (row, columns, ifname) => {
          const rxIdx = columns.indexOf("rx_rate");
          const txIdx = columns.indexOf("tx_rate");
          return {
            [`${ifname}_rx`]: (row[rxIdx] as number) || 0,
            [`${ifname}_tx`]: (row[txIdx] as number) || 0,
          };
        },
        filter: filterZeroPoints,
      });
      return { data, ifnames: entities };
    },
  });
}
