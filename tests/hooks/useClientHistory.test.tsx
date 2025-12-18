import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useClientBandwidthHistory,
  useClientSignalHistory,
  useClientSatisfactionHistory,
  useExtendedClientInfo,
} from "../../src/hooks/history";

// Mock the influx module
vi.mock("../../src/lib/influx", () => ({
  queryInflux: vi.fn(),
  escapeInfluxString: (s: string) => s.replace(/'/g, "''"),
  createValueGetter: (cols: string[], vals: unknown[]) => {
    const getRaw = (key: string) => {
      const idx = cols.indexOf(key);
      return idx >= 0 ? vals[idx] : null;
    };
    const getter = (key: string) => getRaw(key);
    getter.number = (key: string, def = 0) => {
      const v = getRaw(key);
      return typeof v === "number" ? v : def;
    };
    getter.string = (key: string, def = "") => {
      const v = getRaw(key);
      return typeof v === "string" ? v : def;
    };
    getter.boolean = (key: string, def = false) => {
      const v = getRaw(key);
      return typeof v === "boolean" ? v : def;
    };
    return getter;
  },
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

describe("useClientBandwidthHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches wireless client bandwidth history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 500000, 250000],
                ["2024-01-01T10:01:00Z", 600000, 300000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(
      () => useClientBandwidthHistory("aa:bb:cc:dd:ee:ff", "1h", "1m", false),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rxRate: 500000,
      txRate: 250000,
    });
  });

  it("fetches wired client bandwidth history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
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

    const { result } = renderHook(
      () => useClientBandwidthHistory("aa:bb:cc:dd:ee:ff", "1h", "1m", true),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify it queries with wired fields
    const query = mockQueryInflux.mock.calls[0][0];
    expect(query).toContain("wired-rx_bytes-r");
    expect(query).toContain("wired-tx_bytes-r");
  });

  it("auto-detects wireless client when isWired is undefined", async () => {
    // First call returns wireless data
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [["2024-01-01T10:00:00Z", 500000, 250000]],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(
      () => useClientBandwidthHistory("aa:bb:cc:dd:ee:ff", "1h", "1m"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
  });

  it("filters out zero-value data points", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: ["time", "rx_rate", "tx_rate"],
              values: [
                ["2024-01-01T10:00:00Z", 500000, 250000],
                ["2024-01-01T10:01:00Z", 0, 0], // Should be filtered
                ["2024-01-01T10:02:00Z", 600000, 300000],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(
      () => useClientBandwidthHistory("aa:bb:cc:dd:ee:ff", "1h", "1m", false),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });

  it("does not fetch when mac is empty", async () => {
    const { result } = renderHook(() => useClientBandwidthHistory("", "1h", "1m"), {
      wrapper: createWrapper(),
    });

    // Query should not be enabled
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockQueryInflux).not.toHaveBeenCalled();
  });
});

describe("useClientSignalHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and maps signal history with UnPoller field swap", async () => {
    // UnPoller uses "signal" for dBm and "rssi" for percentage (backwards)
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: ["time", "rssi", "signal"],
              values: [
                ["2024-01-01T10:00:00Z", 75, -55], // rssi=percentage, signal=dBm
                ["2024-01-01T10:01:00Z", 70, -60],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useClientSignalHistory("aa:bb:cc:dd:ee:ff", "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The hook swaps the fields: signal (dBm) -> rssi, rssi (%) -> signal
    expect(result.current.data![0]).toEqual({
      time: "2024-01-01T10:00:00Z",
      rssi: -55, // From UnPoller's "signal" field
      signal: 75, // From UnPoller's "rssi" field
    });
  });

  it("filters out zero rssi values", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: ["time", "rssi", "signal"],
              values: [
                ["2024-01-01T10:00:00Z", 75, -55],
                ["2024-01-01T10:01:00Z", 0, 0], // rssi=0 after swap means signal=0
                ["2024-01-01T10:02:00Z", 70, -60],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useClientSignalHistory("aa:bb:cc:dd:ee:ff", "1h", "1m"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });
});

describe("useClientSatisfactionHistory", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches satisfaction history", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: ["time", "satisfaction"],
              values: [
                ["2024-01-01T10:00:00Z", 95],
                ["2024-01-01T10:01:00Z", 92],
                ["2024-01-01T10:02:00Z", 88],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(
      () => useClientSatisfactionHistory("aa:bb:cc:dd:ee:ff", "1h", "1m"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0].satisfaction).toBe(95);
  });

  it("filters out zero satisfaction values", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: ["time", "satisfaction"],
              values: [
                ["2024-01-01T10:00:00Z", 95],
                ["2024-01-01T10:01:00Z", 0], // Should be filtered
                ["2024-01-01T10:02:00Z", 88],
              ],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(
      () => useClientSatisfactionHistory("aa:bb:cc:dd:ee:ff", "1h", "1m"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
  });
});

describe("useExtendedClientInfo", () => {
  beforeEach(() => {
    mockQueryInflux.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("fetches extended client info", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [
        {
          series: [
            {
              name: "clients",
              columns: [
                "time",
                "essid",
                "oui",
                "noise",
                "tx_rate",
                "rx_rate",
                "tx_retries",
                "tx_power",
                "ccq",
              ],
              values: [["2024-01-01T10:00:00Z", "HomeNetwork", "Apple", -90, 866, 866, 5, 20, 95]],
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() => useExtendedClientInfo("aa:bb:cc:dd:ee:ff"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      essid: "HomeNetwork",
      oui: "Apple",
      noise: -90,
      txRate: 866,
      rxRate: 866,
      txRetries: 5,
      txPower: 20,
      ccq: 95,
    });
  });

  it("returns null when no data", async () => {
    mockQueryInflux.mockResolvedValue({
      results: [{}],
    });

    const { result } = renderHook(() => useExtendedClientInfo("aa:bb:cc:dd:ee:ff"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });
});
