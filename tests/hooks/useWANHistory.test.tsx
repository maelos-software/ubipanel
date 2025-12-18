import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useWANBandwidthHistory, useMultiWANBandwidthHistory } from "../../src/hooks/history";

// Mock the influx module
vi.mock("../../src/lib/influx", () => ({
  queryInflux: vi.fn(),
  escapeInfluxString: (s: string) => s.replace(/'/g, "''"),
}));

// Import the mocked function for manipulation
import { queryInflux } from "../../src/lib/influx";
const mockQueryInflux = vi.mocked(queryInflux);

// Create a wrapper with QueryClient
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

describe("useWANBandwidthHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches WAN bandwidth history and parses results", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "usg_wan_ports",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 1000000, 500000],
                ["2024-01-01T10:01:00Z", 1200000, 600000],
                ["2024-01-01T10:02:00Z", 1100000, 550000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useWANBandwidthHistory("1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rxRate: 1000000,
      txRate: 500000,
    });
  });

  it("filters out zero-value data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "usg_wan_ports",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 1000000, 500000],
                ["2024-01-01T10:01:00Z", 0, 0], // Should be filtered
                ["2024-01-01T10:02:00Z", 1100000, 550000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useWANBandwidthHistory("1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.every((p) => p.rxRate > 0 || p.txRate > 0)).toBe(true);
  });

  it("returns empty array when no data", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{}],
    });

    const { result } = renderHook(() => useWANBandwidthHistory("1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });

  it("uses correct query parameters", async () => {
    mockQueryInflux.mockResolvedValue({ results: [{}] });

    renderHook(() => useWANBandwidthHistory("6h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("now() - 6h");
    expect(query).toContain("time(5m)");
    expect(query).toContain("is_uplink = true");
  });
});

describe("useMultiWANBandwidthHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("aggregates multi-WAN data by interface name", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "usg_wan_ports",
              tags: { ifname: "eth0" },
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 1000000, 500000],
                ["2024-01-01T10:01:00Z", 1200000, 600000],
              ],
            },
            {
              name: "usg_wan_ports",
              tags: { ifname: "eth1" },
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 800000, 400000],
                ["2024-01-01T10:01:00Z", 900000, 450000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useMultiWANBandwidthHistory("1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.ifnames).toContain("eth0");
    expect(result.current.data?.ifnames).toContain("eth1");
    expect(result.current.data?.data).toHaveLength(2);

    // Check first time point has data from both interfaces
    const firstPoint = result.current.data?.data[0];
    expect(firstPoint?.eth0_rx).toBe(1000000);
    expect(firstPoint?.eth0_tx).toBe(500000);
    expect(firstPoint?.eth1_rx).toBe(800000);
    expect(firstPoint?.eth1_tx).toBe(400000);
  });

  it("returns empty data when no series", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{}],
    });

    const { result } = renderHook(() => useMultiWANBandwidthHistory("1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toEqual([]);
    expect(result.current.data?.ifnames).toEqual([]);
  });
});
