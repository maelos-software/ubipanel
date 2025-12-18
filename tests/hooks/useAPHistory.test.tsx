import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useAPBandwidthHistory,
  useAPClientsHistory,
  useAPSignalHistory,
  useAllAPClientsHistory,
  useAPChannelUtilization,
  useAllAPSignalHistory,
  useAllChannelUtilHistory,
  useAPBandTrafficHistory,
  useAllAPBandwidthHistory,
  useAPCCQHistory,
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

describe("useAPBandwidthHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches AP bandwidth history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap",
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

    const { result } = renderHook(() => useAPBandwidthHistory("Office-AP", "1h", "1m"), {
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

  it("filters out zero-value data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap",
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

    const { result } = renderHook(() => useAPBandwidthHistory("Office-AP", "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("does not fetch when name is empty", async () => {
    const { result } = renderHook(() => useAPBandwidthHistory("", "1h", "1m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });

  it("escapes special characters in AP name", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0, series: [] }],
    });

    renderHook(() => useAPBandwidthHistory("O'Brien's AP", "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("O''Brien''s AP");
  });
});

describe("useAPClientsHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches AP clients history with user and guest counts", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap",
              columns: ["time", "num_sta", "guest_num_sta"],
              values: [
                ["2024-01-01T10:00:00Z", 20, 5],
                ["2024-01-01T10:01:00Z", 22, 6],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAPClientsHistory("Office-AP", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      userSta: 20,
      guestSta: 5,
      total: 25,
    });
  });

  it("filters out points with zero total clients", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap",
              columns: ["time", "num_sta", "guest_num_sta"],
              values: [
                ["2024-01-01T10:00:00Z", 20, 5],
                ["2024-01-01T10:01:00Z", 0, 0], // Should be filtered
                ["2024-01-01T10:02:00Z", 18, 4],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAPClientsHistory("Office-AP", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });
});

describe("useAPSignalHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches AP average signal history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "avg_signal"],
              values: [
                ["2024-01-01T10:00:00Z", -55],
                ["2024-01-01T10:01:00Z", -58],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAPSignalHistory("Office-AP", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].avgSignal).toBe(-55);
  });

  it("filters out invalid signal values", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "avg_signal"],
              values: [
                ["2024-01-01T10:00:00Z", -55],
                ["2024-01-01T10:01:00Z", 0], // Invalid signal, should be filtered
                ["2024-01-01T10:02:00Z", -60],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAPSignalHistory("Office-AP", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });
});

describe("useAllAPClientsHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches clients history for all APs", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap",
              tags: { name: "AP-1" },
              columns: ["time", "num_sta"],
              values: [
                ["2024-01-01T10:00:00Z", 10],
                ["2024-01-01T10:05:00Z", 12],
              ],
            },
            {
              name: "uap",
              tags: { name: "AP-2" },
              columns: ["time", "num_sta"],
              values: [
                ["2024-01-01T10:00:00Z", 8],
                ["2024-01-01T10:05:00Z", 9],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAllAPClientsHistory("3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.apNames).toContain("AP-1");
    expect(result.current.data?.apNames).toContain("AP-2");
    expect(result.current.data?.data.length).toBeGreaterThan(0);
  });

  it("returns empty data when no series", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0 }],
    });

    const { result } = renderHook(() => useAllAPClientsHistory("3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data).toEqual([]);
    expect(result.current.data?.apNames).toEqual([]);
  });
});

describe("useAPChannelUtilization", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches channel utilization grouped by radio", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_radios",
              tags: { radio: "ng" },
              columns: ["time", "cu_total", "cu_self_rx", "cu_self_tx"],
              values: [
                ["2024-01-01T10:00:00Z", 25, 10, 8],
                ["2024-01-01T10:05:00Z", 30, 12, 10],
              ],
            },
            {
              name: "uap_radios",
              tags: { radio: "na" },
              columns: ["time", "cu_total", "cu_self_rx", "cu_self_tx"],
              values: [
                ["2024-01-01T10:00:00Z", 15, 5, 4],
                ["2024-01-01T10:05:00Z", 18, 6, 5],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAPChannelUtilization("Office-AP", "1h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].radio).toBe("ng");
    expect(result.current.data![0].data[0].cuTotal).toBe(25);
    expect(result.current.data![1].radio).toBe("na");
  });

  it("does not fetch when name is empty", async () => {
    const { result } = renderHook(() => useAPChannelUtilization("", "1h", "5m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });

  it("returns empty array when no series", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0 }],
    });

    const { result } = renderHook(() => useAPChannelUtilization("Office-AP", "1h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([]);
  });
});

describe("useAllAPSignalHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches signal history for all APs", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              tags: { device_name: "AP-1" },
              columns: ["time", "avg_signal"],
              values: [
                ["2024-01-01T10:00:00Z", -55],
                ["2024-01-01T10:05:00Z", -58],
              ],
            },
            {
              name: "uap_vaps",
              tags: { device_name: "AP-2" },
              columns: ["time", "avg_signal"],
              values: [
                ["2024-01-01T10:00:00Z", -60],
                ["2024-01-01T10:05:00Z", -62],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAllAPSignalHistory("3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.apNames).toContain("AP-1");
    expect(result.current.data?.apNames).toContain("AP-2");
    expect(result.current.data?.data.length).toBeGreaterThan(0);
  });
});

describe("useAllChannelUtilHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches channel utilization for all APs", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_radios",
              tags: { device_name: "AP-1" },
              columns: ["time", "cu_total", "cu_self_rx", "cu_self_tx"],
              values: [["2024-01-01T10:00:00Z", 25, 10, 8]],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAllChannelUtilHistory("3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.apNames).toContain("AP-1");
  });

  it("filters by 5GHz band", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0, series: [] }],
    });

    renderHook(() => useAllChannelUtilHistory("3h", "5m", "5GHz"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("channel >= '36'");
  });

  it("filters by 2.4GHz band", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{ statement_id: 0, series: [] }],
    });

    renderHook(() => useAllChannelUtilHistory("3h", "5m", "2.4GHz"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("channel <= '14'");
  });
});

describe("useAPBandTrafficHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches AP band traffic history for 5GHz", async () => {
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

    const { result } = renderHook(() => useAPBandTrafficHistory("Office-AP", "5GHz", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].rxRate).toBe(5000000);

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("channel >= 36");
  });

  it("fetches AP band traffic history for 2.4GHz", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [["2024-01-01T10:00:00Z", 1000000, 500000]],
            },
          ],
        },
      ],
    });

    renderHook(() => useAPBandTrafficHistory("Office-AP", "2.4GHz", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockQueryInflux).toHaveBeenCalled());

    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("channel <= 14");
  });

  it("does not fetch when apName is empty", async () => {
    const { result } = renderHook(() => useAPBandTrafficHistory("", "5GHz", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });
});

describe("useAllAPBandwidthHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches bandwidth history for all APs", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap",
              tags: { name: "AP-1" },
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 1000000, 500000],
                ["2024-01-01T10:05:00Z", 1200000, 600000],
              ],
            },
            {
              name: "uap",
              tags: { name: "AP-2" },
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 800000, 400000],
                ["2024-01-01T10:05:00Z", 900000, 450000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAllAPBandwidthHistory("3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.apNames).toContain("AP-1");
    expect(result.current.data?.apNames).toContain("AP-2");
    expect(result.current.data?.data.length).toBeGreaterThan(0);
  });
});

describe("useAPCCQHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches CCQ history grouped by radio", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "uap_vaps",
              tags: { radio: "ng" },
              columns: ["time", "ccq"],
              values: [
                ["2024-01-01T10:00:00Z", 95],
                ["2024-01-01T10:05:00Z", 92],
              ],
            },
            {
              name: "uap_vaps",
              tags: { radio: "na" },
              columns: ["time", "ccq"],
              values: [
                ["2024-01-01T10:00:00Z", 98],
                ["2024-01-01T10:05:00Z", 96],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useAPCCQHistory("Office-AP", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.radios).toContain("ng");
    expect(result.current.data?.radios).toContain("na");
    expect(result.current.data?.data.length).toBeGreaterThan(0);
  });

  it("does not fetch when apName is empty", async () => {
    const { result } = renderHook(() => useAPCCQHistory("", "3h", "5m"), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });
});
