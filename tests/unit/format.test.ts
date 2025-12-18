import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatBytesRate,
  formatBitsRate,
  formatUptime,
  formatDuration,
  formatPercent,
  getSignalQuality,
  formatTemp,
  formatRadioProto,
  isValidSignal,
  getSignalDomain,
  SIGNAL_INVALID_PLACEHOLDER,
  SIGNAL_FILTER_SQL,
} from "../../src/lib/format";

describe("formatBytes", () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes correctly", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  // Edge cases - these document current behavior
  it("returns NaN for negative values (Math.log limitation)", () => {
    // Note: Could be improved to handle negative values gracefully
    expect(formatBytes(-100)).toBe("NaN undefined");
  });

  it("handles very large values (TB range)", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024 * 2)).toBe("2 TB");
  });

  it("handles small fractional values (rounds up due to log)", () => {
    // Math.log(0.5) is negative, causing issues - documents current behavior
    expect(formatBytes(0.5)).toBe("512 undefined");
  });

  it("formats kilobytes correctly", () => {
    expect(formatBytes(1024 * 100)).toBe("100 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(1024 * 1024 * 500)).toBe("500 MB");
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("formats gigabytes correctly", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 2.5)).toBe("2.5 GB");
  });

  it("formats terabytes correctly", () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1 TB");
  });

  it("respects decimal places parameter", () => {
    expect(formatBytes(1536, 2)).toBe("1.5 KB");
    expect(formatBytes(1536, 0)).toBe("2 KB");
  });
});

describe("formatBytesRate", () => {
  it('returns "0 B/s" for zero', () => {
    expect(formatBytesRate(0)).toBe("0 B/s");
  });

  it("formats bytes per second", () => {
    expect(formatBytesRate(500)).toBe("500 B/s");
    expect(formatBytesRate(1024)).toBe("1 KB/s");
  });

  it("formats megabytes per second", () => {
    expect(formatBytesRate(1024 * 1024 * 10)).toBe("10 MB/s");
  });

  it("formats gigabytes per second", () => {
    expect(formatBytesRate(1024 * 1024 * 1024)).toBe("1 GB/s");
  });
});

describe("formatBitsRate", () => {
  it('returns "0 bps" for zero', () => {
    expect(formatBitsRate(0)).toBe("0 bps");
  });

  it("formats bits per second (uses 1000 not 1024)", () => {
    expect(formatBitsRate(500)).toBe("500 bps");
    expect(formatBitsRate(1000)).toBe("1 Kbps");
    expect(formatBitsRate(1500)).toBe("1.5 Kbps");
  });

  it("formats megabits per second", () => {
    expect(formatBitsRate(1000 * 1000)).toBe("1 Mbps");
    expect(formatBitsRate(1000 * 1000 * 100)).toBe("100 Mbps");
  });

  it("formats gigabits per second", () => {
    expect(formatBitsRate(1000 * 1000 * 1000)).toBe("1 Gbps");
  });
});

describe("formatUptime", () => {
  it("formats seconds", () => {
    expect(formatUptime(30)).toBe("30s");
    expect(formatUptime(59)).toBe("59s");
  });

  it("formats minutes", () => {
    expect(formatUptime(60)).toBe("1m");
    expect(formatUptime(90)).toBe("1m");
    expect(formatUptime(3599)).toBe("59m");
  });

  it("formats hours and minutes", () => {
    expect(formatUptime(3600)).toBe("1h 0m");
    expect(formatUptime(3660)).toBe("1h 1m");
    expect(formatUptime(7200)).toBe("2h 0m");
    expect(formatUptime(7320)).toBe("2h 2m");
  });

  it("formats days and hours", () => {
    expect(formatUptime(86400)).toBe("1d 0h");
    expect(formatUptime(90000)).toBe("1d 1h");
    expect(formatUptime(172800)).toBe("2d 0h");
    expect(formatUptime(180000)).toBe("2d 2h");
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(90)).toBe("1m 30s");
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(7320)).toBe("2h 2m");
  });
});

describe("formatPercent", () => {
  it("formats without decimals by default", () => {
    expect(formatPercent(50)).toBe("50%");
    expect(formatPercent(99.9)).toBe("100%");
  });

  it("respects decimal places", () => {
    expect(formatPercent(50.5, 1)).toBe("50.5%");
    expect(formatPercent(33.333, 2)).toBe("33.33%");
  });
});

describe("getSignalQuality", () => {
  it("returns Excellent for strong signals (-50 or better)", () => {
    const result = getSignalQuality(-45);
    expect(result.label).toBe("Excellent");
    expect(result.color).toBe("text-emerald-600");
  });

  it("returns Excellent at exactly -50", () => {
    const result = getSignalQuality(-50);
    expect(result.label).toBe("Excellent");
  });

  it("returns Good for -51 to -60", () => {
    expect(getSignalQuality(-51).label).toBe("Good");
    expect(getSignalQuality(-60).label).toBe("Good");
    expect(getSignalQuality(-55).color).toBe("text-emerald-500");
  });

  it("returns Fair for -61 to -70", () => {
    expect(getSignalQuality(-61).label).toBe("Fair");
    expect(getSignalQuality(-70).label).toBe("Fair");
    expect(getSignalQuality(-65).color).toBe("text-amber-500");
  });

  it("returns Poor for -71 or worse", () => {
    expect(getSignalQuality(-71).label).toBe("Poor");
    expect(getSignalQuality(-85).label).toBe("Poor");
    expect(getSignalQuality(-80).color).toBe("text-red-500");
  });
});

describe("formatTemp", () => {
  it("formats temperature in Celsius", () => {
    expect(formatTemp(25)).toBe("25°C");
    expect(formatTemp(45.6)).toBe("46°C");
    expect(formatTemp(0)).toBe("0°C");
  });
});

describe("formatRadioProto", () => {
  it("formats WiFi 7 (be)", () => {
    expect(formatRadioProto("be")).toEqual({ label: "WiFi 7", generation: "7" });
    expect(formatRadioProto("BE")).toEqual({ label: "WiFi 7", generation: "7" });
  });

  it("formats WiFi 6E", () => {
    expect(formatRadioProto("6e")).toEqual({ label: "WiFi 6E", generation: "6E" });
    expect(formatRadioProto("ax-6e")).toEqual({ label: "WiFi 6E", generation: "6E" });
  });

  it("formats WiFi 6 (ax)", () => {
    expect(formatRadioProto("ax")).toEqual({ label: "WiFi 6", generation: "6" });
  });

  it("formats WiFi 5 (ac)", () => {
    expect(formatRadioProto("ac")).toEqual({ label: "WiFi 5", generation: "5" });
  });

  it("formats WiFi 4 variants", () => {
    expect(formatRadioProto("na")).toEqual({ label: "WiFi 4 (5G)", generation: "4" });
    expect(formatRadioProto("ng")).toEqual({ label: "WiFi 4 (2.4G)", generation: "4" });
    expect(formatRadioProto("n")).toEqual({ label: "WiFi 4", generation: "4" });
  });

  it("formats legacy protocols", () => {
    expect(formatRadioProto("a")).toEqual({ label: "802.11a", generation: "legacy" });
    expect(formatRadioProto("g")).toEqual({ label: "802.11g", generation: "legacy" });
    expect(formatRadioProto("b")).toEqual({ label: "802.11b", generation: "legacy" });
  });

  it("handles unknown protocols", () => {
    expect(formatRadioProto("xyz")).toEqual({ label: "xyz", generation: "unknown" });
    expect(formatRadioProto("")).toEqual({ label: "WiFi", generation: "unknown" });
  });

  it("handles null/undefined", () => {
    expect(formatRadioProto(undefined as unknown as string)).toEqual({
      label: "WiFi",
      generation: "unknown",
    });
  });
});

describe("signal utilities", () => {
  describe("SIGNAL_INVALID_PLACEHOLDER", () => {
    it("is -1 (UniFi placeholder for VAPs with no clients)", () => {
      expect(SIGNAL_INVALID_PLACEHOLDER).toBe(-1);
    });
  });

  describe("SIGNAL_FILTER_SQL", () => {
    it("provides SQL fragment to filter invalid signals", () => {
      expect(SIGNAL_FILTER_SQL).toBe("avg_client_signal < -1");
    });
  });

  describe("isValidSignal", () => {
    it("returns false for 0 (no data)", () => {
      expect(isValidSignal(0)).toBe(false);
    });

    it("returns false for -1 (UniFi placeholder)", () => {
      expect(isValidSignal(-1)).toBe(false);
    });

    it("returns false for positive values (invalid)", () => {
      expect(isValidSignal(1)).toBe(false);
      expect(isValidSignal(10)).toBe(false);
    });

    it("returns true for realistic signal values", () => {
      expect(isValidSignal(-30)).toBe(true);
      expect(isValidSignal(-50)).toBe(true);
      expect(isValidSignal(-70)).toBe(true);
      expect(isValidSignal(-85)).toBe(true);
    });

    it("returns true for weak but valid signals", () => {
      expect(isValidSignal(-90)).toBe(true);
      expect(isValidSignal(-100)).toBe(true);
    });

    it("returns true for edge case just below -1", () => {
      expect(isValidSignal(-2)).toBe(true);
    });
  });

  describe("getSignalDomain", () => {
    it("adds 5 dBm padding and rounds to nearest 5", () => {
      const [min, max] = getSignalDomain(-60, -50);
      expect(min).toBe(-65);
      expect(max).toBe(-45);
    });

    it("clamps minimum to -90", () => {
      const [min] = getSignalDomain(-95, -80);
      expect(min).toBe(-90);
    });

    it("clamps maximum to -20", () => {
      const [, max] = getSignalDomain(-50, -15);
      expect(max).toBe(-20);
    });

    it("handles typical signal range", () => {
      const [min, max] = getSignalDomain(-70, -45);
      expect(min).toBe(-75);
      expect(max).toBe(-40);
    });

    it("handles narrow range", () => {
      const [min, max] = getSignalDomain(-55, -52);
      expect(min).toBe(-60);
      expect(max).toBe(-45);
    });
  });
});
