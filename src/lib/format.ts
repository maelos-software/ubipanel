// Format bytes to human readable
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// Format bytes per second to human readable rate
export function formatBytesRate(bytesPerSec: number): string {
  if (bytesPerSec === 0) return "0 B/s";

  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));

  return `${parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Compact format for chart Y-axis labels (e.g., "781 KB/s" instead of "781.3 KB/s")
export function formatBytesRateAxis(bytesPerSec: number): string {
  if (bytesPerSec === 0) return "0 B/s";

  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  const value = bytesPerSec / Math.pow(k, i);

  // Use no decimal for cleaner axis labels
  return `${Math.round(value)} ${sizes[i]}`;
}

// Format bits per second (for network speeds)
export function formatBitsRate(bitsPerSec: number): string {
  if (bitsPerSec === 0) return "0 bps";

  const k = 1000;
  const sizes = ["bps", "Kbps", "Mbps", "Gbps"];
  const i = Math.floor(Math.log(bitsPerSec) / Math.log(k));

  return `${parseFloat((bitsPerSec / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Format uptime to human readable
export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

// Format duration in seconds to human readable (e.g., "2h 15m" or "45m 30s")
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Format percentage
export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

// Format signal strength with quality indicator
export function getSignalQuality(rssi: number): { label: string; color: string } {
  if (rssi >= -50) return { label: "Excellent", color: "text-emerald-600" };
  if (rssi >= -60) return { label: "Good", color: "text-emerald-500" };
  if (rssi >= -70) return { label: "Fair", color: "text-amber-500" };
  return { label: "Poor", color: "text-red-500" };
}

// =============================================================================
// Signal/RSSI Utilities
// =============================================================================

/**
 * UnPoller Field Mapping
 *
 * UnPoller stores client signal data with confusing field names:
 * - "signal" field = actual RSSI in dBm (negative values like -65)
 * - "rssi" field = signal quality percentage (0-100)
 *
 * This is counterintuitive because "RSSI" traditionally means the dBm value.
 * Our internal data model normalizes this:
 * - rssi = dBm value (from UnPoller's "signal" field)
 * - signalPct = percentage (from UnPoller's "rssi" field)
 */

/**
 * Raw signal fields as stored in UnPoller/InfluxDB.
 */
export interface RawUnPollerSignal {
  signal: number; // Actually dBm (e.g., -65)
  rssi: number; // Actually percentage (e.g., 35)
}

/**
 * Normalized signal values with clear semantic meaning.
 */
export interface NormalizedSignal {
  rssi: number; // dBm value (e.g., -65)
  signalPct: number; // Percentage (e.g., 35)
}

/**
 * Map UnPoller's confusingly-named fields to our normalized structure.
 * Use this when parsing client data from InfluxDB.
 */
export function normalizeUnPollerSignal(raw: RawUnPollerSignal): NormalizedSignal {
  return {
    rssi: raw.signal, // UnPoller "signal" = dBm
    signalPct: raw.rssi, // UnPoller "rssi" = percentage
  };
}

/**
 * Helper to get rssi (dBm) from UnPoller's raw fields.
 * UnPoller stores dBm in the "signal" field.
 */
export function getRssiFromUnPoller(rawSignal: number): number {
  return rawSignal;
}

/**
 * Helper to get signal percentage from UnPoller's raw fields.
 * UnPoller stores percentage in the "rssi" field.
 */
export function getSignalPctFromUnPoller(rawRssi: number): number {
  return rawRssi;
}

// Signal constants and utilities
// UniFi uses -1 as a placeholder when a VAP has no connected clients
export const SIGNAL_INVALID_PLACEHOLDER = -1;

// Check if a signal value is valid (not a placeholder or unrealistically good)
export function isValidSignal(signal: number): boolean {
  return signal < SIGNAL_INVALID_PLACEHOLDER && signal !== 0;
}

// Calculate dynamic Y-axis domain for signal charts based on actual data
// Adds padding and rounds to nearest 5 dBm for clean tick marks
export function getSignalDomain(dataMin: number, dataMax: number): readonly [number, number] {
  const min = Math.floor((dataMin - 5) / 5) * 5;
  const max = Math.ceil((dataMax + 5) / 5) * 5;
  return [Math.max(min, -90), Math.min(max, -20)] as const;
}

// SQL WHERE clause fragment to filter out invalid signal values
// Use in InfluxDB queries: WHERE ... AND ${SIGNAL_FILTER_SQL}
export const SIGNAL_FILTER_SQL = "avg_client_signal < -1";

// Format WiFi radio protocol to friendly name
export function formatRadioProto(proto: string): { label: string; generation: string } {
  switch (proto?.toLowerCase()) {
    case "be":
      return { label: "WiFi 7", generation: "7" };
    case "6e":
    case "ax-6e":
      return { label: "WiFi 6E", generation: "6E" };
    case "ax":
      return { label: "WiFi 6", generation: "6" };
    case "ac":
      return { label: "WiFi 5", generation: "5" };
    case "na":
      return { label: "WiFi 4 (5G)", generation: "4" };
    case "ng":
      return { label: "WiFi 4 (2.4G)", generation: "4" };
    case "n":
      return { label: "WiFi 4", generation: "4" };
    case "a":
      return { label: "802.11a", generation: "legacy" };
    case "g":
      return { label: "802.11g", generation: "legacy" };
    case "b":
      return { label: "802.11b", generation: "legacy" };
    default:
      return { label: proto || "WiFi", generation: "unknown" };
  }
}

// Format temperature
export function formatTemp(celsius: number): string {
  return `${celsius.toFixed(0)}°C`;
}

// Format time for chart X-axis labels
export function formatChartTime(time: string | number): string {
  const date = typeof time === "string" ? new Date(time) : new Date(time);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Format date for chart X-axis labels (longer time ranges)
export function formatChartDate(time: string | number): string {
  const date = typeof time === "string" ? new Date(time) : new Date(time);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Formats a client's display name based on available information.
 * Priority: hostname (if not MAC-like) > name (if not MAC-like) > OUI + short MAC > MAC address
 */
export function formatClientName(client: {
  mac: string;
  name?: string;
  hostname?: string;
  oui?: string;
}): string {
  const { mac, name, hostname, oui } = client;
  const isMacLike = (s: string) => /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(s);

  // Determine the best display name
  if (hostname && hostname !== "Unknown" && !isMacLike(hostname)) {
    return hostname;
  }

  if (name && name !== "Unknown" && !isMacLike(name)) {
    return name;
  }

  if (oui && oui !== "Unknown") {
    const shortMac = mac.slice(-8).replace(/:/g, "");
    const shortOui = oui
      .replace(/, Inc\.|, LLC|Corporation|Electronics|Technologies/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")[0]; // Take first word
    return `${shortOui}-${shortMac}`;
  }

  return mac;
}
