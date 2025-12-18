import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useSwitchPortHistory,
  useSwitchPortErrorsHistory,
  useSwitchPortPoeHistory,
  useSwitchPortPacketsHistory,
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

describe("useSwitchPortHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches switch port bandwidth history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 1000000, 500000],
                ["2024-01-01T10:01:00Z", 1200000, 600000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortHistory("Switch-1", 5, "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rxRate: 1000000,
      txRate: 500000,
    });
  });

  it("filters out zero-rate data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 1000000, 500000],
                ["2024-01-01T10:01:00Z", 0, 0], // Should be filtered
                ["2024-01-01T10:02:00Z", 1200000, 600000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortHistory("Switch-1", 5, "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("does not fetch when swName is empty", async () => {
    const { result } = renderHook(() => useSwitchPortHistory("", 5, "1h", "1m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });

  it("includes port index in query", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0, series: [] }],
    });

    renderHook(() => useSwitchPortHistory("Switch-1", 12, "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("\"port_idx\" = '12'");
  });

  it("escapes special characters in switch name", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0, series: [] }],
    });

    renderHook(() => useSwitchPortHistory("O'Brien's Switch", 1, "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("O''Brien''s Switch");
  });
});

describe("useSwitchPortErrorsHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches switch port errors history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "rx_errors", "tx_errors", "rx_dropped", "tx_dropped"],
              values: [
                ["2024-01-01T10:00:00Z", 10, 5, 2, 1],
                ["2024-01-01T10:15:00Z", 12, 6, 3, 2],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortErrorsHistory("Switch-1", 5, "24h", "15m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rxErrors: 10,
      txErrors: 5,
      rxDropped: 2,
      txDropped: 1,
    });
  });

  it("handles missing values with defaults", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "rx_errors", "tx_errors", "rx_dropped", "tx_dropped"],
              values: [["2024-01-01T10:00:00Z", null, null, null, null]],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortErrorsHistory("Switch-1", 5, "24h", "15m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rxErrors: 0,
      txErrors: 0,
      rxDropped: 0,
      txDropped: 0,
    });
  });

  it("does not fetch when swName is empty", async () => {
    const { result } = renderHook(() => useSwitchPortErrorsHistory("", 5, "24h", "15m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });
});

describe("useSwitchPortPoeHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches switch port PoE history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "power", "voltage", "current"],
              values: [
                ["2024-01-01T10:00:00Z", 15.5, 48.2, 0.32],
                ["2024-01-01T10:15:00Z", 16.0, 48.1, 0.33],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortPoeHistory("Switch-1", 5, "24h", "15m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      power: 15.5,
      voltage: 48.2,
      current: 0.32,
    });
  });

  it("filters out zero-power data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "power", "voltage", "current"],
              values: [
                ["2024-01-01T10:00:00Z", 15.5, 48.2, 0.32],
                ["2024-01-01T10:15:00Z", 0, 0, 0], // Should be filtered
                ["2024-01-01T10:30:00Z", 16.0, 48.1, 0.33],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortPoeHistory("Switch-1", 5, "24h", "15m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("does not fetch when swName is empty", async () => {
    const { result } = renderHook(() => useSwitchPortPoeHistory("", 5, "24h", "15m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });
});

describe("useSwitchPortPacketsHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches switch port packets history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "rx_pps", "tx_pps", "rx_bcast", "tx_bcast", "rx_mcast", "tx_mcast"],
              values: [
                ["2024-01-01T10:00:00Z", 1000, 800, 10, 5, 20, 15],
                ["2024-01-01T10:05:00Z", 1200, 900, 12, 6, 22, 18],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortPacketsHistory("Switch-1", 5, "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rxPackets: 1000,
      txPackets: 800,
      rxBroadcast: 10,
      txBroadcast: 5,
      rxMulticast: 20,
      txMulticast: 15,
    });
  });

  it("clamps negative values to zero", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "rx_pps", "tx_pps", "rx_bcast", "tx_bcast", "rx_mcast", "tx_mcast"],
              values: [["2024-01-01T10:00:00Z", -100, 800, -10, 5, -20, 15]],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortPacketsHistory("Switch-1", 5, "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data![0].rxPackets).toBe(0);
    expect(result.current.data![0].txPackets).toBe(800);
    expect(result.current.data![0].rxBroadcast).toBe(0);
    expect(result.current.data![0].rxMulticast).toBe(0);
  });

  it("filters out zero-packet data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "usw_ports",
              columns: ["time", "rx_pps", "tx_pps", "rx_bcast", "tx_bcast", "rx_mcast", "tx_mcast"],
              values: [
                ["2024-01-01T10:00:00Z", 1000, 800, 10, 5, 20, 15],
                ["2024-01-01T10:05:00Z", 0, 0, 0, 0, 0, 0], // Should be filtered
                ["2024-01-01T10:10:00Z", 1200, 900, 12, 6, 22, 18],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useSwitchPortPacketsHistory("Switch-1", 5, "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("does not fetch when swName is empty", async () => {
    const { result } = renderHook(() => useSwitchPortPacketsHistory("", 5, "3h", "5m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });

  it("returns empty array when no data", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0 }],
    });

    const { result } = renderHook(() => useSwitchPortPacketsHistory("Switch-1", 5, "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});
