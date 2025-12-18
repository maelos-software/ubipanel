// InfluxDB response types
export interface InfluxSeries {
  name: string;
  tags?: Record<string, string>;
  columns: string[];
  values: unknown[][];
}

export interface InfluxResponse {
  results: {
    statement_id: number;
    series?: InfluxSeries[];
  }[];
}

// Domain types
export interface Client {
  mac: string;
  name: string;
  hostname: string;
  ip: string;
  rxBytes: number;
  txBytes: number;
  rxBytesR: number;
  txBytesR: number;
  signal: number;
  rssi: number;
  satisfaction: number;
  channel: number;
  apName: string;
  swName?: string;
  swPort?: number;
  isWired: boolean;
  isGuest: boolean;
  vlan: string;
  uptime: number;
  radioProto: string;
}

export interface AccessPoint {
  mac: string;
  name: string;
  model: string;
  ip: string;
  version: string;
  cpu: number;
  mem: number;
  memTotal: number;
  numSta: number;
  guestNumSta: number;
  rxBytes: number;
  txBytes: number;
  loadavg1: number;
  loadavg5: number;
  loadavg15: number;
  uptime: number;
}

export interface APRadio {
  apName: string;
  radio: string;
  channel: number;
  txPower: number;
  numSta: number;
  guestNumSta: number;
  cuTotal: number;
  cuSelfRx: number;
  cuSelfTx: number;
}

export interface Switch {
  mac: string;
  name: string;
  model: string;
  ip: string;
  version: string;
  cpu: number;
  mem: number;
  memTotal: number;
  temperature: number;
  fanLevel: number;
  numSta: number;
  rxBytes: number;
  txBytes: number;
  uptime: number;
}

export interface SwitchPort {
  swName: string;
  portIdx: number;
  name: string;
  speed: number;
  rxBytes: number;
  txBytes: number;
  rxBytesR: number;
  txBytesR: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  poeVoltage: number;
  poeCurrent: number;
  poePower: number;
}

export interface Gateway {
  mac: string;
  name: string;
  model: string;
  version: string;
  ip: string;
  cpu: number;
  mem: number;
  memTotal: number;
  memUsed: number;
  memBuffer: number;
  loadavg1: number;
  loadavg5: number;
  loadavg15: number;
  numDesktop: number;
  numMobile: number;
  numHandheld: number;
  numUserSta: number;
  numGuestSta: number;
  speedtestLatency: number;
  speedtestDownload: number;
  speedtestUpload: number;
  // Temperatures
  tempCpu: number;
  tempLocal: number;
  tempPhy: number;
  // LAN stats
  lanRxBytes: number;
  lanTxBytes: number;
  lanRxPackets: number;
  lanTxPackets: number;
  // Uplink info
  uplinkLatency: number;
  uplinkSpeed: number;
  uplinkMaxSpeed: number;
  uplinkName: string;
  uplinkType: string;
  uplinkUptime: number;
  // Storage
  storageBackupPct: number;
  storageBackupSize: number;
  storageTempPct: number;
  storageTempSize: number;
  // System
  systemUptime: number;
  state: number;
}

export interface USGNetwork {
  name: string;
  ip: string;
  mac: string;
  purpose: string;
  domainName: string;
  enabled: boolean;
  isGuest: boolean;
  numSta: number;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
}

export interface WANPort {
  name: string;
  ifname: string;
  ip: string;
  mac: string;
  gateway: string;
  type: string;
  up: boolean;
  enabled: boolean;
  isUplink: boolean;
  speed: number;
  maxSpeed: number;
  fullDuplex: boolean;
  rxBytes: number;
  txBytes: number;
  rxBytesR: number;
  txBytesR: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  rxPackets: number;
  txPackets: number;
  rxBroadcast: number;
  txBroadcast: number;
  rxMulticast: number;
  txMulticast: number;
}

export interface NetworkOverview {
  gateway: Gateway | null;
  wanPorts: WANPort[];
  totalClients: number;
  wiredClients: number;
  wirelessClients: number;
  guestClients: number;
  aps: AccessPoint[];
  switches: Switch[];
}

// UAP VAP (Virtual Access Point / SSID per radio)
export interface APVAP {
  apMac: string;
  apName: string;
  radio: string;
  radioName: string;
  essid: string;
  bssid: string;
  channel: number;
  isGuest: boolean;
  usage: string;
  numSta: number;
  rxBytes: number;
  txBytes: number;
  satisfaction: number;
  avgClientSignal: number;
  ccq: number;
  txPower: number;
}

// Extended AP Radio with more fields
export interface APRadioExtended extends APRadio {
  ht: string;
  gain: number;
  maxTxPower: number;
  minTxPower: number;
  nss: number;
  txPackets: number;
  txRetries: number;
}

// SSID VAP details (for SSID detail page)
export interface SSIDVAPDetail {
  apName: string;
  radio: string;
  bssid: string;
  channel: number;
  numSta: number;
  rxBytes: number;
  txBytes: number;
  satisfaction: number;
  avgClientSignal: number;
  ccq: number;
  txPower: number;
  txRetries: number;
  txDropped: number;
  rxErrors: number;
  txErrors: number;
  tcpLatencyAvg: number;
}

// Client distribution by various dimensions
export interface ClientDistribution {
  label: string;
  value: number;
  color?: string;
}

// AP Signal/RSSI data point
export interface APSignalPoint {
  time: string;
  apName: string;
  avgSignal: number;
  avgRssi: number;
}

// AP Traffic by band
export interface APBandTraffic {
  time: string;
  apName: string;
  band: string;
  rxRate: number;
  txRate: number;
}

// Channel utilization history point
export interface ChannelUtilPoint {
  time: string;
  apName: string;
  radio: string;
  cuTotal: number;
  cuSelfRx: number;
  cuSelfTx: number;
}
