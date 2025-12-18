/**
 * Re-export all network data hooks for backward compatibility
 *
 * Individual hooks are now split into separate files:
 * - useClients.ts
 * - useAccessPoints.ts
 * - useSwitches.ts
 * - useGateway.ts
 * - useSSID.ts
 */

export { useClients } from "./useClients";
export { useAccessPoints, useAPVAPs, useAPRadios } from "./useAccessPoints";
export { useSwitches, useAllSwitchPorts } from "./useSwitches";
export { useGateway, useWANPorts, useUSGNetworks } from "./useGateway";
export { useSSIDVAPs, useSSIDClients } from "./useSSID";
