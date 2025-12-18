import { useQuery, type QueryKey, type UseQueryResult } from "@tanstack/react-query";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import type { InfluxResponse } from "@/types/influx";
import { parseTimeSeriesResults } from "@/hooks/utils/parseInfluxResults";

// Base options shared by all variants
interface BaseTimeSeriesOptions {
  key: QueryKey;
  query: string | (() => string | Promise<string>);
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}

// Option A: Custom processor (for aggregated/complex data)
export interface ProcessorOptions<TData> extends BaseTimeSeriesOptions {
  processor: (response: InfluxResponse) => TData;
  mapper?: never;
  filter?: never;
}

// Option B: Row mapper (for simple time series lists)
export interface MapperOptions<TPoint> extends BaseTimeSeriesOptions {
  mapper: (columns: string[], values: unknown[]) => TPoint;
  filter?: (point: TPoint) => boolean;
  processor?: never;
}

/**
 * Generic hook for fetching and processing time-series data from InfluxDB.
 * Reduces boilerplate for common history hooks.
 */
export function useTimeSeries<TData>(
  options: ProcessorOptions<TData>
): UseQueryResult<TData, Error>;

export function useTimeSeries<TPoint>(
  options: MapperOptions<TPoint>
): UseQueryResult<TPoint[], Error>;

export function useTimeSeries<TData, TPoint>(
  options: ProcessorOptions<TData> | MapperOptions<TPoint>
): UseQueryResult<TData | TPoint[], Error> {
  const { key, query, enabled = true, refetchInterval = REFETCH_INTERVAL, staleTime } = options;

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      // 1. Resolve query string
      const queryString = typeof query === "function" ? await query() : query;
      if (!queryString) {
        // Return empty structure based on usage mode
        return ("mapper" in options ? [] : null) as unknown as TData | TPoint[];
      }

      // 2. Fetch data
      const response = await queryInflux(queryString);

      // 3. Process data
      if ("processor" in options && options.processor) {
        return options.processor(response) as unknown as TData | TPoint[];
      }

      if ("mapper" in options && options.mapper) {
        const results = parseTimeSeriesResults(response, options.mapper);
        if ("filter" in options && options.filter) {
          return results.filter(options.filter) as unknown as TData | TPoint[];
        }
        return results as unknown as TData | TPoint[];
      }

      return response as unknown as TData | TPoint[];
    },
    enabled,
    refetchInterval,
    staleTime,
  });
}
