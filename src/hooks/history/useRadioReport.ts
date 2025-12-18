/**
 * Radio Report hooks
 */

import { useQuery } from "@tanstack/react-query";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { isValidSignal } from "@/lib/format";
import { useTimeSeries } from "../useTimeSeries";

// ============================================================================
// Types
// ============================================================================

export interface RadioData {
  name: string;
  radio: string;
  band: string;
  channel: number;
  cuTotal: number;
  cuSelfRx: number;
  cuSelfTx: number;
  numSta: number;
  txPower: number;
  txRetries: number;
}

export interface VapData {
  apName: string;
  essid: string;
  radio: string;
  band: string;
  channel: number;
  numSta: number;
  ccq: number;
  satisfaction: number;
  avgSignal: number;
  rxBytes: number;
  txBytes: number;
  txRetries: number;
  rxErrors: number;
  txErrors: number;
}

// Helper to map radio tag to band name
const radioToBand = (radio: string): string => {
  if (radio === "ng") return "2.4GHz";
  if (radio === "6e") return "6GHz";
  return "5GHz"; // "na" and others
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch current radio stats (utilization, clients, etc)
 */
export function useRadioStats() {
  return useTimeSeries({
    key: ["radio-report-radios"],
    query: `
      SELECT LAST(cu_total), LAST(cu_self_rx), LAST(cu_self_tx), LAST(channel), 
             LAST(num_sta), LAST(tx_power), LAST(tx_retries), LAST(radio)
      FROM uap_radios
      WHERE time > now() - 5m
      GROUP BY device_name, radio
    `,
    processor: (result) => {
      const series = result.results[0]?.series || [];
      return series
        .map((s): RadioData => {
          const radioTag = s.tags?.radio || (s.values[0][8] as string) || "";
          const channel = (s.values[0][4] as number) || 0;
          return {
            name: s.tags?.device_name || "Unknown",
            radio: radioTag,
            band: radioToBand(radioTag),
            channel,
            cuTotal: (s.values[0][1] as number) || 0,
            cuSelfRx: (s.values[0][2] as number) || 0,
            cuSelfTx: (s.values[0][3] as number) || 0,
            numSta: (s.values[0][5] as number) || 0,
            txPower: (s.values[0][6] as number) || 0,
            txRetries: (s.values[0][7] as number) || 0,
          };
        })
        .sort((a, b) => b.cuTotal - a.cuTotal);
    },
  });
}

/**
 * Fetch VAP data (combines current state with traffic deltas)
 */
export function useVapStats() {
  return useQuery({
    queryKey: ["radio-report-vaps"],
    queryFn: async () => {
      // Query 1: Current VAP state (last 5 minutes)
      const currentResult = await queryInflux(`
        SELECT LAST(num_sta), LAST(ccq), LAST(satisfaction), LAST(avg_client_signal),
               LAST(tx_retries), LAST(rx_errors), LAST(tx_errors), LAST(channel)
        FROM uap_vaps
        WHERE time > now() - 5m
        GROUP BY device_name, essid, radio
      `);

      // Query 2: Traffic deltas (24h) using LAST - FIRST pattern
      const trafficResult = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM uap_vaps
        WHERE time > now() - 24h
        GROUP BY device_name, essid, radio
      `);

      // Build traffic lookup map by composite key
      const trafficByKey = new Map<string, { rx: number; tx: number }>();
      for (const s of trafficResult.results?.[0]?.series || []) {
        const key = `${s.tags?.device_name}|${s.tags?.essid}|${s.tags?.radio}`;
        const rxIdx = s.columns.indexOf("rx_bytes");
        const txIdx = s.columns.indexOf("tx_bytes");
        trafficByKey.set(key, {
          rx: Math.max(0, (s.values[0]?.[rxIdx] as number) || 0),
          tx: Math.max(0, (s.values[0]?.[txIdx] as number) || 0),
        });
      }

      const series = currentResult.results[0]?.series || [];
      return series
        .map((s): VapData => {
          const radioTag = s.tags?.radio || "";
          const channel = (s.values[0][8] as number) || 0;
          const avgSignal = (s.values[0][4] as number) || 0;
          const key = `${s.tags?.device_name}|${s.tags?.essid}|${s.tags?.radio}`;
          const traffic = trafficByKey.get(key) || { rx: 0, tx: 0 };
          return {
            apName: s.tags?.device_name || "Unknown",
            essid: s.tags?.essid || "Unknown",
            radio: radioTag,
            band: radioToBand(radioTag),
            channel,
            numSta: (s.values[0][1] as number) || 0,
            ccq: (s.values[0][2] as number) || 0,
            satisfaction: (s.values[0][3] as number) || 0,
            avgSignal: isValidSignal(avgSignal) ? avgSignal : 0,
            rxBytes: traffic.rx,
            txBytes: traffic.tx,
            txRetries: (s.values[0][5] as number) || 0,
            rxErrors: (s.values[0][6] as number) || 0,
            txErrors: (s.values[0][7] as number) || 0,
          };
        })
        .filter((v) => v.numSta > 0);
    },
    refetchInterval: REFETCH_INTERVAL,
  });
}

/**
 * Fetch traffic history by band
 */
export function useRadioTrafficHistory(timeRange: string, interval: string) {
  return useTimeSeries({
    key: ["radio-report-traffic-history", timeRange, interval],
    query: `
      SELECT NON_NEGATIVE_DERIVATIVE(MEAN(rx_bytes), 1s) AS rx, 
             NON_NEGATIVE_DERIVATIVE(MEAN(tx_bytes), 1s) AS tx
      FROM uap_vaps
      WHERE time > now() - ${timeRange}
      GROUP BY time(${interval}), radio, device_name, essid
    `,
    processor: (result) => {
      const series = result.results[0]?.series || [];
      const timeMap = new Map<number, Record<string, number>>();
      for (const s of series) {
        const radio = s.tags?.radio || "";
        const band = radio === "ng" ? "2.4GHz" : radio === "6e" ? "6GHz" : "5GHz";
        for (const v of s.values) {
          if (v[1] === null && v[2] === null) continue;
          const time = new Date(v[0] as string).getTime();
          if (!timeMap.has(time)) {
            timeMap.set(time, { time, "5GHz": 0, "2.4GHz": 0, "6GHz": 0 });
          }
          const rx = (v[1] as number) || 0;
          const tx = (v[2] as number) || 0;
          timeMap.get(time)![band] += rx + tx;
        }
      }
      return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
    },
  });
}

/**
 * Fetch clients history by band
 */
export function useRadioClientsHistory(timeRange: string, interval: string) {
  return useTimeSeries({
    key: ["radio-report-clients-history", timeRange, interval],
    query: `
      SELECT MEAN(num_sta) AS clients
      FROM uap_radios
      WHERE time > now() - ${timeRange}
      GROUP BY time(${interval}), radio, device_name
    `,
    processor: (result) => {
      const series = result.results[0]?.series || [];
      const timeMap = new Map<number, Record<string, number>>();
      for (const s of series) {
        const radio = s.tags?.radio || "";
        const band = radio === "ng" ? "2.4GHz" : radio === "6e" ? "6GHz" : "5GHz";
        for (const v of s.values) {
          if (v[1] === null) continue;
          const time = new Date(v[0] as string).getTime();
          if (!timeMap.has(time)) {
            timeMap.set(time, { time, "5GHz": 0, "2.4GHz": 0, "6GHz": 0 });
          }
          timeMap.get(time)![band] += Math.round((v[1] as number) || 0);
        }
      }
      return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
    },
  });
}

/**
 * Fetch satisfaction history by band
 */
export function useRadioSatisfactionHistory(timeRange: string, interval: string) {
  return useTimeSeries({
    key: ["radio-report-satisfaction-history", timeRange, interval],
    query: `
      SELECT MEAN(satisfaction) AS satisfaction
      FROM uap_vaps
      WHERE time > now() - ${timeRange} AND satisfaction >= 0
      GROUP BY time(${interval}), radio
    `,
    processor: (result) => {
      const series = result.results[0]?.series || [];
      const timeMap = new Map<number, Record<string, { sum: number; count: number }>>();
      for (const s of series) {
        const radio = s.tags?.radio || "";
        const band = radioToBand(radio);
        for (const v of s.values) {
          if (v[1] === null) continue;
          const time = new Date(v[0] as string).getTime();
          if (!timeMap.has(time)) {
            timeMap.set(time, {});
          }
          const entry = timeMap.get(time)!;
          if (!entry[band]) {
            entry[band] = { sum: 0, count: 0 };
          }
          entry[band].sum += v[1] as number;
          entry[band].count += 1;
        }
      }
      return Array.from(timeMap.entries())
        .map(([time, bands]) => {
          const result: Record<string, number> = { time };
          for (const [band, { sum, count }] of Object.entries(bands)) {
            result[band] = sum / count;
          }
          return result;
        })
        .sort((a, b) => a.time - b.time);
    },
  });
}
