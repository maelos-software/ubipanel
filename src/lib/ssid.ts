/**
 * SSID normalization and aggregation utilities
 *
 * Centralizes SSID-related logic used across AccessPoints and AccessPointDetail pages.
 */

import { getBandFromRadioTag } from "./wifi";
import type { APVAP, Client } from "@/types/influx";

/**
 * Normalized SSID data with aggregated stats from multiple VAPs.
 */
export interface NormalizedSSID {
  essid: string;
  isGuest: boolean;
  aps: string[];
  clientCount: number;
  rxBytes: number;
  txBytes: number;
  channels: {
    "2.4GHz": number[];
    "5GHz": number[];
    "6GHz": number[];
  };
  // Additional stats
  satisfaction: number | null; // Average satisfaction across VAPs, null if no data
  avgSignal: number | null; // Average client signal (dBm), null if no data
}

/**
 * Options for SSID normalization.
 */
export interface NormalizeSSIDsOptions {
  /** Include SSIDs with no clients (default: false) */
  includeEmpty?: boolean;
  /** Filter to specific AP name */
  apName?: string;
  /** Sort by (default: 'clients') */
  sortBy?: "clients" | "name" | "traffic";
}

/**
 * Normalize VAPs into aggregated SSIDs.
 *
 * Groups VAPs by SSID name and aggregates:
 * - Client count across all APs/radios
 * - Total RX/TX bytes
 * - Channels by band
 * - List of APs broadcasting the SSID
 * - Average satisfaction and signal strength
 *
 * @param vaps - Array of VAPs from useAPVAPs hook
 * @param options - Normalization options
 * @returns Array of normalized SSIDs sorted by client count (descending)
 */
export function normalizeSSIDs(
  vaps: APVAP[],
  options: NormalizeSSIDsOptions = {}
): NormalizedSSID[] {
  const { includeEmpty = false, apName, sortBy = "clients" } = options;

  const ssidMap = new Map<
    string,
    {
      essid: string;
      isGuest: boolean;
      aps: Set<string>;
      clientCount: number;
      rxBytes: number;
      txBytes: number;
      channels: {
        "2.4GHz": Set<number>;
        "5GHz": Set<number>;
        "6GHz": Set<number>;
      };
      satisfactionSum: number;
      satisfactionCount: number;
      signalSum: number;
      signalCount: number;
    }
  >();

  for (const vap of vaps) {
    // Skip if filtering by AP name and this doesn't match
    if (apName && vap.apName !== apName) continue;

    // Skip empty SSIDs
    if (!vap.essid) continue;
    // Note: We always include VAPs to aggregate AP list and channels correctly.
    // The includeEmpty option controls whether we return SSIDs with 0 total clients.

    const existing = ssidMap.get(vap.essid);

    if (existing) {
      existing.clientCount += vap.numSta;
      existing.rxBytes += vap.rxBytes;
      existing.txBytes += vap.txBytes;
      existing.aps.add(vap.apName);

      if (vap.channel) {
        const band = getBandFromRadioTag(vap.radio);
        existing.channels[band].add(vap.channel);
      }

      // Only include satisfaction/signal if there are clients
      if (vap.numSta > 0) {
        if (vap.satisfaction > 0) {
          existing.satisfactionSum += vap.satisfaction;
          existing.satisfactionCount++;
        }
        if (vap.avgClientSignal < -1) {
          // Valid signal value
          existing.signalSum += vap.avgClientSignal;
          existing.signalCount++;
        }
      }
    } else {
      const entry = {
        essid: vap.essid,
        isGuest: vap.isGuest,
        aps: new Set([vap.apName]),
        clientCount: vap.numSta,
        rxBytes: vap.rxBytes,
        txBytes: vap.txBytes,
        channels: {
          "2.4GHz": new Set<number>(),
          "5GHz": new Set<number>(),
          "6GHz": new Set<number>(),
        },
        satisfactionSum: 0,
        satisfactionCount: 0,
        signalSum: 0,
        signalCount: 0,
      };

      if (vap.channel) {
        const band = getBandFromRadioTag(vap.radio);
        entry.channels[band].add(vap.channel);
      }

      if (vap.numSta > 0) {
        if (vap.satisfaction > 0) {
          entry.satisfactionSum = vap.satisfaction;
          entry.satisfactionCount = 1;
        }
        if (vap.avgClientSignal < -1) {
          entry.signalSum = vap.avgClientSignal;
          entry.signalCount = 1;
        }
      }

      ssidMap.set(vap.essid, entry);
    }
  }

  // Convert to array and compute final values
  const result: NormalizedSSID[] = Array.from(ssidMap.values()).map((entry) => ({
    essid: entry.essid,
    isGuest: entry.isGuest,
    aps: Array.from(entry.aps).sort(),
    clientCount: entry.clientCount,
    rxBytes: entry.rxBytes,
    txBytes: entry.txBytes,
    channels: {
      "2.4GHz": Array.from(entry.channels["2.4GHz"]).sort((a, b) => a - b),
      "5GHz": Array.from(entry.channels["5GHz"]).sort((a, b) => a - b),
      "6GHz": Array.from(entry.channels["6GHz"]).sort((a, b) => a - b),
    },
    satisfaction:
      entry.satisfactionCount > 0 ? entry.satisfactionSum / entry.satisfactionCount : null,
    avgSignal: entry.signalCount > 0 ? entry.signalSum / entry.signalCount : null,
  }));

  // Filter out empty SSIDs if not requested
  const filtered = includeEmpty ? result : result.filter((s) => s.clientCount > 0);

  // Sort based on option
  switch (sortBy) {
    case "name":
      filtered.sort((a, b) => a.essid.localeCompare(b.essid));
      break;
    case "traffic":
      filtered.sort((a, b) => b.rxBytes + b.txBytes - (a.rxBytes + a.txBytes));
      break;
    case "clients":
    default:
      filtered.sort((a, b) => b.clientCount - a.clientCount);
      break;
  }

  return filtered;
}

/**
 * Get stats for a specific SSID.
 *
 * @param vaps - Array of VAPs
 * @param essid - SSID name to get stats for
 * @returns Normalized SSID data or null if not found
 */
export function getSSIDStats(vaps: APVAP[], essid: string): NormalizedSSID | null {
  const normalized = normalizeSSIDs(vaps, { includeEmpty: true });
  return normalized.find((s) => s.essid === essid) || null;
}

/**
 * Get client count for an SSID from VAPs.
 * Useful when you don't need the full normalized data.
 */
export function getSSIDClientCount(vaps: APVAP[], essid: string): number {
  return vaps.filter((v) => v.essid === essid).reduce((sum, v) => sum + v.numSta, 0);
}

/**
 * Get list of unique SSIDs from VAPs.
 */
export function getUniqueSSIDs(vaps: APVAP[]): string[] {
  const ssids = new Set<string>();
  for (const vap of vaps) {
    if (vap.essid) {
      ssids.add(vap.essid);
    }
  }
  return Array.from(ssids).sort();
}

/**
 * Filter VAPs to specific SSID.
 */
export function filterVAPsBySSID(vaps: APVAP[], essid: string): APVAP[] {
  return vaps.filter((v) => v.essid === essid);
}

/**
 * Filter VAPs to specific AP.
 */
export function filterVAPsByAP(vaps: APVAP[], apName: string): APVAP[] {
  return vaps.filter((v) => v.apName === apName);
}

/**
 * Group VAPs by AP name.
 */
export function groupVAPsByAP(vaps: APVAP[]): Map<string, APVAP[]> {
  const map = new Map<string, APVAP[]>();
  for (const vap of vaps) {
    const existing = map.get(vap.apName);
    if (existing) {
      existing.push(vap);
    } else {
      map.set(vap.apName, [vap]);
    }
  }
  return map;
}

/**
 * Get total client count from clients for a specific SSID.
 * This uses actual client data rather than VAP stats.
 *
 * Note: The base Client type doesn't have essid field.
 * For accurate SSID client counts, use VAP data or extend the client query.
 */
export function getWirelessClientCount(clients: Client[]): number {
  return clients.filter((c) => !c.isWired).length;
}
