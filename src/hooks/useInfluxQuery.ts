import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { queryInflux, parseInfluxResults, parseInfluxGroupByResults } from "@/lib/influx";
import { useRefreshInterval } from "./useRefreshInterval";
import type { InfluxResponse } from "@/types/influx";

export function useInfluxQuery<T>(
  queryKey: string[],
  query: string,
  mapper: (columns: string[], values: unknown[]) => T,
  options?: Omit<UseQueryOptions<T[], Error>, "queryKey" | "queryFn">
) {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await queryInflux(query);
      return parseInfluxResults(response, mapper);
    },
    refetchInterval,
    ...options,
  });
}

// Query hook for GROUP BY queries that return multiple series with tags
export function useInfluxGroupByQuery<T>(
  queryKey: string[],
  query: string,
  mapper: (columns: string[], values: unknown[], tags?: Record<string, string>) => T,
  options?: Omit<UseQueryOptions<T[], Error>, "queryKey" | "queryFn">
) {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await queryInflux(query);
      return parseInfluxGroupByResults(response, mapper);
    },
    refetchInterval,
    ...options,
  });
}

// Raw query hook for custom parsing
export function useRawInfluxQuery<T>(
  queryKey: string[],
  query: string,
  parser: (response: InfluxResponse) => T,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">
) {
  const refetchInterval = useRefreshInterval();

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await queryInflux(query);
      return parser(response);
    },
    refetchInterval,
    ...options,
  });
}
