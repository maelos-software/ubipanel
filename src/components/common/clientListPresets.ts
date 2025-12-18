/**
 * Column presets for ClientList component
 */
export type ClientColumnKey =
  | "name" // Name + subtitle (MAC or IP)
  | "ip" // IP address
  | "mac" // MAC address
  | "connection" // Wired badge OR Radio + Signal
  | "bandwidth" // Current rates (simple)
  | "bandwidthBar" // Current rates with visual bar (Overview style)
  | "usage" // Total bytes transferred
  | "signal" // RSSI with color coding
  | "satisfaction" // Percentage with visual bar
  | "uptime" // Formatted uptime
  | "connectedTo" // AP name or Switch name
  | "channel" // WiFi channel
  | "ssid" // Network name
  | "vlan"; // VLAN ID

/**
 * Default columns for different contexts
 */
export const CLIENT_COLUMN_PRESETS = {
  /** Full client list page */
  full: [
    "name",
    "ip",
    "connection",
    "bandwidth",
    "usage",
    "uptime",
    "connectedTo",
  ] as ClientColumnKey[],
  /** Overview/dashboard with bandwidth bar */
  overview: ["name", "bandwidthBar", "connection"] as ClientColumnKey[],
  /** AP detail page */
  apDetail: ["name", "ip", "signal", "bandwidth", "channel"] as ClientColumnKey[],
  /** SSID detail page */
  ssidDetail: ["name", "ip", "signal", "bandwidth", "connectedTo"] as ClientColumnKey[],
  /** Switch port detail */
  portDetail: ["name", "ip", "bandwidth", "usage", "vlan"] as ClientColumnKey[],
  /** Minimal for embedded views */
  minimal: ["name", "bandwidth"] as ClientColumnKey[],

  // User preference presets (mapped from settings)
  /** Preference: Minimal - just the essentials */
  prefMinimal: ["name", "bandwidth"] as ClientColumnKey[],
  /** Preference: Standard - balanced view */
  prefStandard: ["name", "ip", "connection", "bandwidth"] as ClientColumnKey[],
  /** Preference: Detailed - all info at a glance */
  prefDetailed: [
    "name",
    "ip",
    "connection",
    "bandwidth",
    "usage",
    "satisfaction",
    "uptime",
    "connectedTo",
  ] as ClientColumnKey[],
};
