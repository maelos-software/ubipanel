import { useInfluxQuery, useInfluxGroupByQuery } from "./useInfluxQuery";
import { REFETCH_INTERVAL } from "@/lib/config";

export interface TrafficByApp {
  time: string;
  clientMac: string;
  clientName: string;
  isWired: boolean;
  application: number;
  appName?: string;
  category: number;
  categoryName?: string;
  bytesRx: number;
  bytesTx: number;
  bytesTotal: number;
  activitySeconds: number;
}

export interface TrafficTotalByApp {
  time: string;
  application: number;
  appName?: string;
  category: number;
  categoryName?: string;
  bytesRx: number;
  bytesTx: number;
  bytesTotal: number;
  clientCount: number;
}

export interface TrafficByCountry {
  time: string;
  country: string;
  bytesRx: number;
  bytesTx: number;
  bytesTotal: number;
}

export interface TrafficTotalByApp {
  time: string;
  application: number;
  category: number;
  bytesRx: number;
  bytesTx: number;
  bytesTotal: number;
  clientCount: number;
}

/**
 * Accepts InfluxDB duration strings like "1h", "24h", "7d", "30d"
 */
function getTimeFilter(range: string): string {
  return `time > now() - ${range}`;
}

/**
 * Fetch traffic by application data from InfluxDB
 * This data is collected by the optional traffic collector service
 */
export function useTrafficByApp(range: string = "24h") {
  const timeFilter = getTimeFilter(range);

  return useInfluxQuery<TrafficByApp>(
    ["traffic_by_app", range],
    `SELECT * FROM traffic_by_app WHERE ${timeFilter} ORDER BY time DESC`,
    (columns, values) => {
      const getCol = (name: string) => columns.indexOf(name);
      return {
        time: values[getCol("time")] as string,
        clientMac: values[getCol("client_mac")] as string,
        clientName: values[getCol("client_name")] as string,
        isWired: values[getCol("is_wired")] === "true",
        application: parseInt(values[getCol("application")] as string, 10),
        appName: values[getCol("application_name")] as string,
        category: parseInt(values[getCol("category")] as string, 10),
        categoryName: values[getCol("category_name")] as string,
        bytesRx: (values[getCol("bytes_rx")] as number) || 0,
        bytesTx: (values[getCol("bytes_tx")] as number) || 0,
        bytesTotal: (values[getCol("bytes_total")] as number) || 0,
        activitySeconds: (values[getCol("activity_seconds")] as number) || 0,
      };
    },
    {
      // Traffic data is optional - don't fail if not available
      retry: false,
      refetchInterval: REFETCH_INTERVAL, // Refresh to match UnPoller polling
    }
  );
}

/**
 * Fetch aggregate traffic by application (pre-aggregated, more efficient)
 * Use this for the main Applications page instead of useTrafficByApp
 */
export function useTotalTrafficByApp(range: string = "24h") {
  const timeFilter = getTimeFilter(range);

  return useInfluxGroupByQuery<TrafficTotalByApp>(
    ["traffic_total_by_app", range],
    `SELECT SUM(bytes_rx) as bytes_rx, SUM(bytes_tx) as bytes_tx, SUM(bytes_total) as bytes_total, MAX(client_count) as client_count FROM traffic_total_by_app WHERE ${timeFilter} GROUP BY application, category, application_name, category_name`,
    (columns: string[], values: unknown[], tags?: Record<string, string>) => {
      const getCol = (name: string) => columns.indexOf(name);
      return {
        time: values[getCol("time")] as string,
        application: parseInt(tags?.application || "0", 10),
        appName: tags?.application_name,
        category: parseInt(tags?.category || "0", 10),
        categoryName: tags?.category_name,
        bytesRx: (values[getCol("bytes_rx")] as number) || 0,
        bytesTx: (values[getCol("bytes_tx")] as number) || 0,
        bytesTotal: (values[getCol("bytes_total")] as number) || 0,
        clientCount: (values[getCol("client_count")] as number) || 0,
      };
    },
    {
      retry: false,
      refetchInterval: REFETCH_INTERVAL,
    }
  );
}

/**
 * Fetch traffic by country data from InfluxDB
 * This data is collected by the optional traffic collector service
 */
export function useTrafficByCountry(range: string = "24h") {
  const timeFilter = getTimeFilter(range);

  return useInfluxQuery<TrafficByCountry>(
    ["traffic_by_country", range],
    `SELECT * FROM traffic_by_country WHERE ${timeFilter} ORDER BY time DESC`,
    (columns, values) => {
      const getCol = (name: string) => columns.indexOf(name);
      return {
        time: values[getCol("time")] as string,
        country: values[getCol("country")] as string,
        bytesRx: (values[getCol("bytes_rx")] as number) || 0,
        bytesTx: (values[getCol("bytes_tx")] as number) || 0,
        bytesTotal: (values[getCol("bytes_total")] as number) || 0,
      };
    },
    {
      retry: false,
      refetchInterval: REFETCH_INTERVAL,
    }
  );
}

/**
 * Fetch traffic data for a specific application
 */
export function useApplicationTraffic(appId: number, range: string = "24h") {
  const timeFilter = getTimeFilter(range);

  return useInfluxQuery<TrafficByApp>(
    ["traffic_by_app", "application", String(appId), range],
    `SELECT * FROM traffic_by_app WHERE application = '${String(appId)}' AND ${timeFilter} ORDER BY time DESC`,
    (columns, values) => {
      const getCol = (name: string) => columns.indexOf(name);
      return {
        time: values[getCol("time")] as string,
        clientMac: values[getCol("client_mac")] as string,
        clientName: values[getCol("client_name")] as string,
        isWired: values[getCol("is_wired")] === "true",
        application: parseInt(values[getCol("application")] as string, 10),
        appName: values[getCol("application_name")] as string,
        category: parseInt(values[getCol("category")] as string, 10),
        categoryName: values[getCol("category_name")] as string,
        bytesRx: (values[getCol("bytes_rx")] as number) || 0,
        bytesTx: (values[getCol("bytes_tx")] as number) || 0,
        bytesTotal: (values[getCol("bytes_total")] as number) || 0,
        activitySeconds: (values[getCol("activity_seconds")] as number) || 0,
      };
    },
    {
      retry: false,
      refetchInterval: REFETCH_INTERVAL,
      enabled: appId > 0,
    }
  );
}

export interface TrafficHistoryPoint {
  time: string;
  bytesRx: number;
  bytesTx: number;
  bytesTotal: number;
}

/**
 * Fetch traffic history for a specific application (aggregated over time)
 */
export function useApplicationTrafficHistory(appId: number, range: string = "24h") {
  const timeFilter = getTimeFilter(range);
  const groupBy = range === "1h" ? "5m" : range === "24h" ? "1h" : "6h";

  return useInfluxQuery<TrafficHistoryPoint>(
    ["traffic_by_app", "history", String(appId), range],
    `SELECT SUM(bytes_rx) as bytes_rx, SUM(bytes_tx) as bytes_tx, SUM(bytes_total) as bytes_total FROM traffic_by_app WHERE application = '${String(appId)}' AND ${timeFilter} GROUP BY time(${groupBy}) ORDER BY time ASC`,
    (columns, values) => {
      const getCol = (name: string) => columns.indexOf(name);
      return {
        time: values[getCol("time")] as string,
        bytesRx: (values[getCol("bytes_rx")] as number) || 0,
        bytesTx: (values[getCol("bytes_tx")] as number) || 0,
        bytesTotal: (values[getCol("bytes_total")] as number) || 0,
      };
    },
    {
      retry: false,
      refetchInterval: REFETCH_INTERVAL,
      enabled: appId > 0,
    }
  );
}

/**
 * Check if DPI/traffic data is available (collector is running)
 * This is a lightweight check that can be used to show/hide UI elements
 */
export function useHasTrafficData() {
  const { data, isLoading } = useTotalTrafficByApp("24h");
  return {
    hasData: (data?.length ?? 0) > 0,
    isLoading,
  };
}
