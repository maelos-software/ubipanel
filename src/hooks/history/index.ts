/**
 * Historical data hooks - barrel export
 *
 * Split from the original monolithic useHistoricalData.ts into domain-specific files:
 * - useWANHistory.ts - WAN bandwidth history
 * - useClientHistory.ts - Client bandwidth, signal, satisfaction, roaming
 * - useAPHistory.ts - AP bandwidth, channel util, clients, signal
 * - useSwitchHistory.ts - Switch port bandwidth, errors, PoE, packets
 * - useSSIDHistory.ts - SSID clients, bandwidth, quality
 */

// Types
export * from "./types";

// WAN hooks
export { useWANBandwidthHistory, useMultiWANBandwidthHistory } from "./useWANHistory";

// Client hooks
export {
  useClientBandwidthHistory,
  useClientSignalHistory,
  useClientSatisfactionHistory,
  useClientRoamingEvents,
  useExtendedClientInfo,
  useClientRateHistory,
  useHistoricalClientInfo,
} from "./useClientHistory";

// AP hooks
export {
  useAPBandwidthHistory,
  useAPChannelUtilization,
  useAPClientsHistory,
  useAllAPClientsHistory,
  useAPSignalHistory,
  useAllAPSignalHistory,
  useAllChannelUtilHistory,
  useAPBandTrafficHistory,
  useAllAPBandwidthHistory,
  useAPCCQHistory,
} from "./useAPHistory";

// Switch hooks
export {
  useSwitchPortHistory,
  useSwitchPortErrorsHistory,
  useSwitchPortPoeHistory,
  useSwitchPortPacketsHistory,
} from "./useSwitchHistory";

// SSID hooks
export {
  useSSIDClientsHistory,
  useSSIDBandwidthHistory,
  useSSIDQualityHistory,
} from "./useSSIDHistory";
