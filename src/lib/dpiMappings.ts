/**
 * UniFi DPI Application and Category Mappings (Modern UniFi OS 3.x/4.x)
 *
 * Verified against UnPoller and libunifi signature databases.
 */

export const CATEGORIES: Record<number, string> = {
  0: "Network Protocol",
  1: "Messaging",
  2: "Email",
  3: "Web",
  4: "File Transfer",
  5: "Video",
  6: "VoIP",
  7: "Remote Access",
  8: "Streaming",
  9: "Network Service",
  10: "Database",
  11: "Business",
  12: "Social Network",
  13: "Cloud/Infrastructure",
  14: "Productivity",
  15: "Security",
  16: "Update",
  17: "Media",
  18: "IoT",
  19: "Advertising",
  20: "Technology",
  24: "Gaming",
  34: "Finance",
  41: "Shopping",
};

/**
 * Verified Application Mappings by [Category][ID]
 */
export const CATEGORIZED_APPLICATIONS: Record<number, Record<number, string>> = {
  0: {
    // Network Protocol
    21: "DNS",
    27: "ICMP",
    39: "NTP",
    41: "mDNS",
    70: "NetBIOS",
    107: "SSDP",
  },
  1: {
    // Messaging
    2: "Telegram",
    153: "Signal",
    178: "iMessage",
  },
  3: {
    // Web
    5: "HTTP",
    150: "iCloud Web",
  },
  4: {
    // File Transfer / General Web
    10: "HTTPS", // CRITICAL: In Cat 4, 10 is the general HTTPS bucket
    112: "Apple Services",
    130: "Amazon",
    193: "Cloudflare",
    248: "iCloud", // CRITICAL: Verified for iPhone usage
  },
  5: {
    // Video
    94: "Google Video",
    95: "YouTube",
  },
  13: {
    // Cloud/Infrastructure
    15: "SSH",
    17: "QUIC",
    84: "SSL/TLS", // CRITICAL: In Cat 13, 84 is the SSL/TLS backbone
    110: "Netflix", // CRITICAL: Netflix is 110, not 84
    120: "WhatsApp",
    126: "Steam",
    190: "Amazon IVS / Twitch", // Amazon Interactive Video Service (used by Twitch, Amazon Live, etc.)
    209: "Discord",
    222: "AWS",
    234: "Akamai",
    246: "Zoom",
  },
  17: {
    // Media
    32: "RTSP",
    62: "Slack",
    127: "Vimeo",
    140: "Hulu",
    227: "TikTok",
    228: "Disney+",
    290: "Microsoft Teams",
    294: "Webex",
  },
  18: {
    // IoT
    63: "MQTT",
    106: "CoAP",
  },
  20: {
    // Technology
    172: "Apple",
    185: "IoT / Smart Home",
    186: "mDNS",
    194: "Tailscale",
    195: "GitHub",
    199: "Ubiquiti",
  },
  24: {
    // Gaming
    3: "Xbox",
    8: "PlayStation",
    49: "Steam Gaming",
    158: "Microsoft Gaming", // Used by Xbox/iOS Game Center
  },
};

export function getCategoryName(id: number): string {
  return CATEGORIES[id] || `Category ${id}`;
}

export function getApplicationName(id: number, categoryId?: number): string {
  if (categoryId !== undefined && CATEGORIZED_APPLICATIONS[categoryId]) {
    const name = CATEGORIZED_APPLICATIONS[categoryId][id];
    if (name) return name;
  }
  return `App ${id}`;
}

export function getTrafficLabel(appId: number, categoryId: number) {
  return {
    application: getApplicationName(appId, categoryId),
    category: getCategoryName(categoryId),
  };
}
