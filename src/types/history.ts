/**
 * Shared types for historical time-series data
 */

// Common point types
/**
 * Bandwidth rate history point for time series charts.
 * Uses rxRate/txRate for rates (bytes per second).
 */
export interface RateHistoryPoint {
  time: string;
  rxRate: number;
  txRate: number;
}

export interface SignalPoint {
  time: string;
  rssi: number;
  signal: number;
}

// Multi-entity point types (for charts with multiple series)
export interface MultiWANBandwidthPoint {
  time: string;
  [key: string]: string | number; // Dynamic keys like "eth9_rx", "eth9_tx"
}

export interface MultiAPClientsPoint {
  time: string;
  [key: string]: string | number; // Dynamic keys like "ap-name"
}

export interface MultiAPSignalPoint {
  time: string;
  [key: string]: string | number;
}

export interface MultiAPBandwidthPoint {
  time: string;
  [key: string]: string | number; // Dynamic keys like "ap-name_rx"
}

export interface ChannelUtilHistoryPoint {
  time: string;
  [key: string]: string | number; // Keys like "ap-name Rx", "_Tx", "_Total"
}

// Switch port point types
export interface PortErrorsPoint {
  time: string;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
}

export interface PortPoePoint {
  time: string;
  power: number;
  voltage: number;
  current: number;
}

export interface PortPacketsPoint {
  time: string;
  rxPackets: number;
  txPackets: number;
  rxBroadcast: number;
  txBroadcast: number;
  rxMulticast: number;
  txMulticast: number;
}

// SSID point types
export interface SSIDClientsPoint {
  time: string;
  clients: number;
}

export interface SSIDQualityPoint {
  time: string;
  avgSignal: number;
  satisfaction: number;
}

// Client-specific types
export interface SatisfactionPoint {
  time: string;
  satisfaction: number;
}

export interface RatePoint {
  time: string;
  txRate: number;
  rxRate: number;
}

export interface RoamEvent {
  time: string;
  fromAp: string;
  toAp: string;
  message: string;
}

export interface ExtendedClientInfo {
  essid: string;
  oui: string;
  noise: number;
  txRate: number;
  rxRate: number;
  txRetries: number;
  txPower: number;
  ccq: number;
}

export interface HistoricalClientInfo {
  mac: string;
  name: string;
  hostname: string;
  ip: string;
  isWired: boolean;
  apName: string;
  essid: string;
  channel: number;
  radioProto: string;
  rssi: number;
  signal: number;
  satisfaction: number;
  rxBytes: number;
  txBytes: number;
  uptime: number;
  lastSeen: string;
  isOnline: boolean;
}

// AP-specific types
export interface APClientsPoint {
  time: string;
  userSta: number;
  guestSta: number;
  total: number;
}

export interface APSignalHistoryPoint {
  time: string;
  avgSignal: number;
}
