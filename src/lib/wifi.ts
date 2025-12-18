import type { Client, APVAP } from "@/types/influx";
import { CHART_COLORS } from "@/config/theme";

/**
 * WiFi band and channel utilities
 *
 * Centralizes all WiFi-related helper functions to avoid duplication
 * across the codebase.
 */

export type WiFiBand = "2.4GHz" | "5GHz" | "6GHz";
export type RadioType = "b" | "g" | "n" | "ng" | "na" | "ac" | "ax" | "be";

/**
 * Channel ranges by band:
 * - 2.4GHz: Channels 1-14
 * - 5GHz: Channels 36-177 (varies by region)
 * - 6GHz: Channels 1-233 (UNII-5 through UNII-8)
 *
 * Note: 6GHz channels overlap numerically with 2.4GHz but are distinct.
 * UniFi typically reports 6GHz with explicit band indicators.
 */

/**
 * Get the WiFi band for a given channel number.
 * Assumes standard channel numbering (not 6GHz unless explicitly indicated).
 */
export function getWiFiBand(channel: number): WiFiBand {
  if (channel >= 1 && channel <= 14) {
    return "2.4GHz";
  }
  if (channel >= 36 && channel <= 177) {
    return "5GHz";
  }
  // 6GHz channels can overlap with 2.4GHz numerically (1, 5, 9, etc.)
  // but typically UniFi reports these with explicit band info
  // For now, default high channels to 6GHz
  if (channel > 177) {
    return "6GHz";
  }
  // Fallback for edge cases
  return "5GHz";
}

/**
 * Check if a channel is in the 2.4GHz band.
 */
export function isChannel2G(channel: number): boolean {
  return channel >= 1 && channel <= 14;
}

/**
 * Check if a channel is in the 5GHz band.
 */
export function isChannel5G(channel: number): boolean {
  return channel >= 36 && channel <= 177;
}

/**
 * Check if a channel is in the 6GHz band.
 */
export function isChannel6G(channel: number): boolean {
  return channel > 177;
}

/**
 * Get the radio type based on channel and optional protocol string.
 *
 * UniFi protocol strings: "b", "g", "n", "ng", "na", "ac", "ax", "be"
 * - ng = 802.11n on 2.4GHz
 * - na = 802.11n on 5GHz
 * - ac = 802.11ac (WiFi 5)
 * - ax = 802.11ax (WiFi 6/6E)
 * - be = 802.11be (WiFi 7)
 */
export function getRadioType(channel: number, proto?: string): RadioType {
  // If protocol is explicitly provided, use it
  if (proto) {
    const normalized = proto.toLowerCase();
    if (
      normalized === "be" ||
      normalized === "ax" ||
      normalized === "ac" ||
      normalized === "na" ||
      normalized === "ng" ||
      normalized === "n" ||
      normalized === "g" ||
      normalized === "b"
    ) {
      return normalized as RadioType;
    }
  }

  // Infer from channel
  if (isChannel2G(channel)) {
    return "ng"; // Assume 802.11n on 2.4GHz
  }
  if (isChannel5G(channel)) {
    return "ac"; // Assume 802.11ac on 5GHz
  }
  return "ax"; // Assume 802.11ax for 6GHz
}

/**
 * Get a human-readable band label with optional channel.
 */
export function getBandLabel(channel: number, includeChannel = false): string {
  const band = getWiFiBand(channel);
  if (includeChannel) {
    return `${band} Ch${channel}`;
  }
  return band;
}

/**
 * Get a short band identifier for grouping.
 * Returns "2.4G", "5G", or "6G".
 */
export function getBandShort(channel: number): "2.4G" | "5G" | "6G" {
  const band = getWiFiBand(channel);
  switch (band) {
    case "2.4GHz":
      return "2.4G";
    case "5GHz":
      return "5G";
    case "6GHz":
      return "6G";
  }
}

/**
 * Sort channels by band (2.4GHz first, then 5GHz, then 6GHz) and then by number.
 */
export function sortChannels(channels: number[]): number[] {
  return [...channels].sort((a, b) => {
    const bandA = getWiFiBand(a);
    const bandB = getWiFiBand(b);

    // Sort by band first
    const bandOrder = { "2.4GHz": 0, "5GHz": 1, "6GHz": 2 };
    if (bandOrder[bandA] !== bandOrder[bandB]) {
      return bandOrder[bandA] - bandOrder[bandB];
    }

    // Then by channel number
    return a - b;
  });
}

/**
 * Group channels by band.
 */
export function groupChannelsByBand(channels: number[]): {
  "2.4GHz": number[];
  "5GHz": number[];
  "6GHz": number[];
} {
  const result: { "2.4GHz": number[]; "5GHz": number[]; "6GHz": number[] } = {
    "2.4GHz": [],
    "5GHz": [],
    "6GHz": [],
  };

  for (const channel of channels) {
    const band = getWiFiBand(channel);
    result[band].push(channel);
  }

  // Sort each band's channels
  result["2.4GHz"].sort((a, b) => a - b);
  result["5GHz"].sort((a, b) => a - b);
  result["6GHz"].sort((a, b) => a - b);

  return result;
}

/**
 * Get common 5GHz channel groups (for DFS identification).
 */
export function is5GHzDFSChannel(channel: number): boolean {
  // DFS channels in 5GHz: 52-64 (UNII-2A), 100-144 (UNII-2C/UNII-2C Extended)
  return (channel >= 52 && channel <= 64) || (channel >= 100 && channel <= 144);
}

/**
 * Get WiFi generation from protocol string.
 */
export function getWiFiGeneration(
  proto: string
): "WiFi 7" | "WiFi 6E" | "WiFi 6" | "WiFi 5" | "WiFi 4" | "Legacy" {
  const normalized = proto?.toLowerCase() || "";

  switch (normalized) {
    case "be":
      return "WiFi 7";
    case "ax-6e":
    case "6e":
      return "WiFi 6E";
    case "ax":
      return "WiFi 6";
    case "ac":
      return "WiFi 5";
    case "n":
    case "na":
    case "ng":
      return "WiFi 4";
    default:
      return "Legacy";
  }
}

/**
 * UnPoller radio tag values:
 * - "ng" = 2.4GHz (802.11n/g)
 * - "na" = 5GHz (802.11n/a/ac/ax)
 * - "6e" = 6GHz (WiFi 6E)
 */
export type RadioTag = "ng" | "na" | "6e";

/**
 * Get WiFi band from UnPoller radio tag.
 */
export function getBandFromRadioTag(radio: string): WiFiBand {
  switch (radio?.toLowerCase()) {
    case "ng":
      return "2.4GHz";
    case "na":
      return "5GHz";
    case "6e":
      return "6GHz";
    default:
      return "5GHz"; // Default fallback
  }
}

/**
 * Get short band label from UnPoller radio tag.
 */
export function getBandShortFromRadioTag(radio: string): "2.4G" | "5G" | "6E" {
  switch (radio?.toLowerCase()) {
    case "ng":
      return "2.4G";
    case "na":
      return "5G";
    case "6e":
      return "6E";
    default:
      return "5G";
  }
}

/**
 * Check if radio tag indicates 6GHz band.
 */
export function isRadio6E(radio: string): boolean {
  return radio?.toLowerCase() === "6e";
}

/**
 * Get WiFi generation from client radio_proto tag.
 * UnPoller radio_proto values: "g", "ng", "na", "ac", "ax", "be"
 */
export function getWiFiGenerationFromProto(
  radioProto: string
): "WiFi 7" | "WiFi 6" | "WiFi 5" | "WiFi 4" | "Legacy" | null {
  const normalized = radioProto?.toLowerCase() || "";

  switch (normalized) {
    case "be":
      return "WiFi 7";
    case "ax":
      return "WiFi 6";
    case "ac":
      return "WiFi 5";
    case "n":
    case "na":
    case "ng":
      return "WiFi 4";
    case "g":
    case "b":
      return "Legacy";
    default:
      return null;
  }
}

/**
 * Determine the best WiFi capability for an SSID based on its radio tags and connected clients.
 * Returns the highest WiFi generation supported.
 */
export function getSSIDWiFiCapability(
  radioTags: string[],
  clientProtos: string[]
): "WiFi 7" | "WiFi 6E" | "WiFi 6" | "WiFi 5" | "WiFi 4" | null {
  // If SSID is on 6E band, it's WiFi 6E capable
  if (radioTags.some((r) => isRadio6E(r))) {
    // Check if any client is using WiFi 7 on this SSID
    if (clientProtos.some((p) => p?.toLowerCase() === "be")) {
      return "WiFi 7";
    }
    return "WiFi 6E";
  }

  // Check client protocols for highest capability
  const protoSet = new Set(clientProtos.map((p) => p?.toLowerCase()));

  if (protoSet.has("be")) return "WiFi 7";
  if (protoSet.has("ax")) return "WiFi 6";
  if (protoSet.has("ac")) return "WiFi 5";
  if (protoSet.has("na") || protoSet.has("ng") || protoSet.has("n")) return "WiFi 4";

  return null;
}

/**
 * Calculate client distribution by channel
 */
export function calculateChannelDistribution(clients: Client[]) {
  const counts: Record<string, number> = {};

  clients.forEach((c) => {
    if (!c.isWired && c.channel) {
      const key = `Ch ${c.channel}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([name, value]) => ({
      name,
      value,
      color: CHART_COLORS.channels[name as keyof typeof CHART_COLORS.channels] || "#94A3B8",
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Calculate client distribution by AP and Band
 */
export function calculateAPBandDistribution(vaps: APVAP[], colors: string[]) {
  const counts: Record<string, number> = {};

  vaps.forEach((vap) => {
    if (vap.numSta > 0) {
      const band = vap.channel <= 14 ? "ng" : vap.channel <= 64 ? "na" : "ac";
      const key = `${vap.apName} ${band}`;
      counts[key] = (counts[key] || 0) + vap.numSta;
    }
  });

  return Object.entries(counts)
    .map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Calculate client distribution per Access Point
 */
export function calculateClientsPerAP(clients: Client[], colors: string[]) {
  const counts: Record<string, number> = {};

  clients.forEach((c) => {
    if (!c.isWired) {
      const apName = c.apName || "Unknown";
      counts[apName] = (counts[apName] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % CHART_COLORS.accent.length],
    }))
    .sort((a, b) => b.value - a.value);
}
