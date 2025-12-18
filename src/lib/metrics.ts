/**
 * Definitions and explanations for network metrics used across the dashboard.
 * Powers Info Tooltips to make the data more accessible to users.
 */

export interface MetricDefinition {
  name: string;
  shortDef: string;
  longDef: string;
  unit?: string;
  thresholds?: {
    good: string;
    fair: string;
    poor: string;
  };
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  satisfaction: {
    name: "Satisfaction",
    shortDef: "Overall connection quality score (0-100%).",
    longDef:
      "A proprietary UniFi metric that combines signal strength, interference, and packet retries to estimate the user experience.",
    unit: "%",
    thresholds: {
      good: "> 80%",
      fair: "60-80%",
      poor: "< 60%",
    },
  },
  rssi: {
    name: "Signal Strength (RSSI)",
    shortDef: "Received Signal Strength Indicator in dBm.",
    longDef:
      "Measures how strongly a device hears the Access Point. Values closer to 0 are stronger (e.g., -50 dBm is better than -80 dBm).",
    unit: "dBm",
    thresholds: {
      good: ">= -60 dBm",
      fair: "-60 to -75 dBm",
      poor: "< -75 dBm",
    },
  },
  ccq: {
    name: "Client Connection Quality",
    shortDef: "Percentage of successful packet transmissions.",
    longDef:
      "CCQ measures the efficiency of the wireless link. 100% means every packet is sent successfully on the first try without retries.",
    unit: "%",
    thresholds: {
      good: "> 90%",
      fair: "70-90%",
      poor: "< 70%",
    },
  },
  channelUtilization: {
    name: "Channel Utilization",
    shortDef: "How 'busy' the current WiFi channel is.",
    longDef:
      "Percentage of time the frequency is occupied by any radio activity. High utilization (>60%) leads to latency and slow speeds.",
    unit: "%",
    thresholds: {
      good: "< 30%",
      fair: "30-60%",
      poor: "> 60%",
    },
  },
  txRetries: {
    name: "TX Retries",
    shortDef: "Packets that had to be resent.",
    longDef:
      "The percentage of transmitted packets that failed to receive an acknowledgement and had to be retransmitted due to interference or weak signal.",
    unit: "%",
  },
};
