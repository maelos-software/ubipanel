import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useSSIDClientsHistory,
  useSSIDBandwidthHistory,
  useSSIDQualityHistory,
} from "../../src/hooks/history";

// Mock the influx module
vi.mock("../../src/lib/influx", () => ({
  queryInflux: vi.fn(),
  escapeInfluxString: (s: string) => s.replace(/'/g, "''"),
}));

import { queryInflux } from "../../src/lib/influx";
const mockQueryInflux = vi.mocked(queryInflux);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useSSIDClientsHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches SSID clients history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "clients"],
              values: [
                ["2024-01-01T10:00:00Z", 15],
                ["2024-01-01T10:05:00Z", 18],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSSIDClientsHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      clients: 15,
    });
  });

  it("filters out zero-client data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "clients"],
              values: [
                ["2024-01-01T10:00:00Z", 15],
                ["2024-01-01T10:05:00Z", 0], // Should be filtered
                ["2024-01-01T10:10:00Z", 12],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSSIDClientsHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("does not fetch when essid is empty", async () => {
    const { result } = renderHook(() => useSSIDClientsHistory("", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });

  it("escapes special characters in SSID name", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0, series: [] }],
    });

    renderHook(() => useSSIDClientsHistory("Guest's Network", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("Guest''s Network");
  });
});

describe("useSSIDBandwidthHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches SSID bandwidth history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 5000000, 2500000],
                ["2024-01-01T10:05:00Z", 6000000, 3000000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSSIDBandwidthHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rxRate: 5000000,
      txRate: 2500000,
    });
  });

  it("filters out zero-rate data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 5000000, 2500000],
                ["2024-01-01T10:05:00Z", 0, 0], // Should be filtered
                ["2024-01-01T10:10:00Z", 6000000, 3000000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSSIDBandwidthHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("clamps negative values to zero", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [["2024-01-01T10:00:00Z", -100, 500000]],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSSIDBandwidthHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The hook uses Math.max(0, ...) so negative values become 0
    // But then filtered out because both would need to be > 0
    // Let's check with one positive value
    expect(result.current.data![0].rxRate).toBe(0);
    expect(result.current.data![0].txRate).toBe(500000);
  });
});

describe("useSSIDQualityHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches SSID quality history with signal and satisfaction", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "avg_signal", "satisfaction"],
              values: [
                ["2024-01-01T10:00:00Z", -55, 95],
                ["2024-01-01T10:05:00Z", -58, 92],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSSIDQualityHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      avgSignal: -55,
      satisfaction: 95,
    });
  });

  it("filters out invalid signal values", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "avg_signal", "satisfaction"],
              values: [
                ["2024-01-01T10:00:00Z", -55, 95],
                ["2024-01-01T10:05:00Z", 0, 90], // Invalid signal (0), should be filtered
                ["2024-01-01T10:10:00Z", -60, 88],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSSIDQualityHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("returns empty array when no data", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0 }],
    });

    const { result } = renderHook(() => useSSIDQualityHistory("HomeNetwork", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});
