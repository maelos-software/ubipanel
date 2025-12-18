/**
 * Client history hooks
 */

import { useQuery } from "@tanstack/react-query";
import { queryInflux, escapeInfluxString, createValueGetter } from "@/lib/influx";
import { CLIENT_QUERIES } from "@/lib/queries/clients";
import { REFETCH_INTERVAL } from "@/lib/config";
import { useTimeSeries } from "../useTimeSeries";
import {
  parseTimeSeriesResults,
  type RateHistoryPoint,
  type SignalPoint,
  type SatisfactionPoint,
  type RatePoint,
  type RoamEvent,
  type ExtendedClientInfo,
  type HistoricalClientInfo,
} from "./types";

/**
 * Fetch client bandwidth history
 * Handles both wired and wireless clients with different field names
 */
export function useClientBandwidthHistory(
  mac: string,
  duration: string = "1h",
  interval: string = "1m",
  isWired?: boolean
) {
  return useQuery({
    queryKey: ["clientBandwidthHistory", mac, duration, interval, isWired],
    queryFn: async () => {
      const escapedMac = escapeInfluxString(mac);

      if (isWired === true) {
        const response = await queryInflux(
          CLIENT_QUERIES.bandwidthWired(escapedMac, duration, interval)
        );
        return parseTimeSeriesResults<RateHistoryPoint>(response, (columns, values) => ({
          time: values[0] as string,
          rxRate: (values[columns.indexOf("rx_rate")] as number) || 0,
          txRate: (values[columns.indexOf("tx_rate")] as number) || 0,
        })).filter((p) => p.rxRate > 0 || p.txRate > 0);
      } else if (isWired === false) {
        const response = await queryInflux(
          CLIENT_QUERIES.bandwidthWireless(escapedMac, duration, interval)
        );
        return parseTimeSeriesResults<RateHistoryPoint>(response, (columns, values) => ({
          time: values[0] as string,
          rxRate: (values[columns.indexOf("rx_rate")] as number) || 0,
          txRate: (values[columns.indexOf("tx_rate")] as number) || 0,
        })).filter((p) => p.rxRate > 0 || p.txRate > 0);
      } else {
        const wirelessResponse = await queryInflux(
          CLIENT_QUERIES.bandwidthWireless(escapedMac, duration, interval)
        );
        const wirelessData = parseTimeSeriesResults<RateHistoryPoint>(
          wirelessResponse,
          (columns, values) => ({
            time: values[0] as string,
            rxRate: (values[columns.indexOf("rx_rate")] as number) || 0,
            txRate: (values[columns.indexOf("tx_rate")] as number) || 0,
          })
        ).filter((p) => p.rxRate > 0 || p.txRate > 0);

        if (wirelessData.length > 0) {
          return wirelessData;
        }

        const wiredResponse = await queryInflux(
          CLIENT_QUERIES.bandwidthWired(escapedMac, duration, interval)
        );
        return parseTimeSeriesResults<RateHistoryPoint>(wiredResponse, (columns, values) => ({
          time: values[0] as string,
          rxRate: (values[columns.indexOf("rx_rate")] as number) || 0,
          txRate: (values[columns.indexOf("tx_rate")] as number) || 0,
        })).filter((p) => p.rxRate > 0 || p.txRate > 0);
      }
    },
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!mac,
  });
}

/**
 * Fetch client signal/RSSI history
 */
export function useClientSignalHistory(
  mac: string,
  duration: string = "1h",
  interval: string = "1m"
) {
  return useTimeSeries<SignalPoint>({
    key: ["clientSignalHistory", mac, duration, interval],
    query: () => CLIENT_QUERIES.signalHistory(escapeInfluxString(mac), duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      rssi: (values[columns.indexOf("signal")] as number) || 0, // UnPoller "signal" = dBm
      signal: (values[columns.indexOf("rssi")] as number) || 0, // UnPoller "rssi" = percentage
    }),
    filter: (p) => p.rssi !== 0,
    enabled: !!mac,
  });
}

/**
 * Fetch client satisfaction history
 */
export function useClientSatisfactionHistory(
  mac: string,
  duration: string = "1h",
  interval: string = "1m"
) {
  return useTimeSeries<SatisfactionPoint>({
    key: ["clientSatisfactionHistory", mac, duration, interval],
    query: () => CLIENT_QUERIES.satisfactionHistory(escapeInfluxString(mac), duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      satisfaction: (values[columns.indexOf("satisfaction")] as number) || 0,
    }),
    filter: (p) => p.satisfaction > 0,
    enabled: !!mac,
  });
}

/**
 * Fetch client roaming events from UniFi events table
 */
export function useClientRoamingEvents(clientName: string, duration: string = "24h") {
  return useTimeSeries<RoamEvent[]>({
    key: ["clientRoamingEvents", clientName, duration],
    query: () => CLIENT_QUERIES.roamingEvents(escapeInfluxString(clientName), duration),
    processor: (response) => {
      const series = response.results[0]?.series?.[0];
      if (!series) return [];

      return series.values.map((row) => ({
        time: row[0] as string,
        fromAp: (row[series.columns.indexOf("ap_from")] as string) || "",
        toAp:
          (row[series.columns.indexOf("ap_to")] as string) ||
          (row[series.columns.indexOf("ap_name")] as string) ||
          "",
        message: (row[series.columns.indexOf("msg")] as string) || "",
      })) as RoamEvent[];
    },
    enabled: !!clientName,
  });
}

/**
 * Fetch extended client info (ESSID, OUI, link rates, etc.)
 */
export function useExtendedClientInfo(mac: string) {
  return useQuery({
    queryKey: ["extendedClientInfo", mac],
    queryFn: async () => {
      const response = await queryInflux(CLIENT_QUERIES.extendedInfo(escapeInfluxString(mac)));

      const series = response.results[0]?.series?.[0];
      if (!series || !series.values[0]) return null;

      const cols = series.columns;
      const vals = series.values[0];
      const getValue = createValueGetter(cols, vals);

      return {
        essid: getValue.string("essid"),
        oui: getValue.string("oui"),
        noise: getValue.number("noise"),
        txRate: getValue.number("tx_rate"),
        rxRate: getValue.number("rx_rate"),
        txRetries: getValue.number("tx_retries"),
        txPower: getValue.number("tx_power"),
        ccq: getValue.number("ccq"),
      } as ExtendedClientInfo;
    },
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!mac,
  });
}

/**
 * Fetch client TX/RX rate history (link speed, not bandwidth)
 */
export function useClientRateHistory(
  mac: string,
  duration: string = "1h",
  interval: string = "1m"
) {
  return useTimeSeries<RatePoint>({
    key: ["clientRateHistory", mac, duration, interval],
    query: () => CLIENT_QUERIES.rateHistory(escapeInfluxString(mac), duration, interval),
    mapper: (columns, values) => ({
      time: values[0] as string,
      txRate: (values[columns.indexOf("tx_rate")] as number) || 0,
      rxRate: (values[columns.indexOf("rx_rate")] as number) || 0,
    }),
    filter: (p) => p.txRate > 0 || p.rxRate > 0,
    enabled: !!mac,
  });
}

/**
 * Fetch historical client info (for clients that may have disconnected)
 * Looks back up to 7 days
 */
export function useHistoricalClientInfo(mac: string) {
  return useQuery({
    queryKey: ["historicalClientInfo", mac],
    queryFn: async () => {
      const escapedMac = escapeInfluxString(mac);

      // Query 1: Look for the last known data for this client (within last 7 days)
      const currentResponse = await queryInflux(CLIENT_QUERIES.historicalState(escapedMac));

      // Query 2: Calculate actual traffic transferred using LAST-FIRST (7d for historical)
      const trafficResponse = await queryInflux(CLIENT_QUERIES.historicalTraffic(escapedMac));

      const series = currentResponse.results[0]?.series?.[0];
      if (!series || !series.values[0]) return null;

      const trafficSeries = trafficResponse.results?.[0]?.series?.[0];
      const trafficCols = trafficSeries?.columns || [];
      const trafficVals = trafficSeries?.values?.[0] || [];
      const getTrafficVal = (k: string) => {
        const idx = trafficCols.indexOf(k);
        return idx >= 0 ? Math.max(0, (trafficVals[idx] as number) || 0) : 0;
      };

      const tags = series.tags || {};
      const cols = series.columns;
      const vals = series.values[0];
      const getValue = createValueGetter(cols, vals);

      const isWired = tags.is_wired === "true";
      const rxBytes = isWired ? getTrafficVal("wired_rx") : getTrafficVal("rx_bytes");
      const txBytes = isWired ? getTrafficVal("wired_tx") : getTrafficVal("tx_bytes");

      // UnPoller field mapping (see config.ts for details):
      // - UnPoller "signal" = dBm value -> our "rssi"
      // - UnPoller "rssi" = percentage -> our "signal"
      return {
        mac,
        name: tags.name || "Unknown",
        hostname: getValue.string("hostname"),
        ip: getValue.string("ip"),
        isWired,
        apName: tags.ap_name || "",
        essid: getValue.string("essid"),
        channel: parseInt(tags.channel) || 0,
        radioProto: tags.radio_proto || "",
        rssi: getValue.number("signal"), // UnPoller "signal" = dBm
        signal: getValue.number("rssi"), // UnPoller "rssi" = percentage
        satisfaction: getValue.number("satisfaction"),
        rxBytes,
        txBytes,
        uptime: getValue.number("uptime"),
        lastSeen: vals[0] as string,
        isOnline: false,
      } as HistoricalClientInfo;
    },
    enabled: !!mac,
    staleTime: 60000,
  });
}
