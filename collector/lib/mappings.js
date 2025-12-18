/**
 * UniFi DPI Application and Category Mappings (Modern UniFi OS 3.x/4.x)
 *
 * Verified against UnPoller and libunifi signature databases.
 */

export const CATEGORIES = {
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
export const CATEGORIZED_APPLICATIONS = {
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
    10: "HTTPS",
    112: "Apple Services",
    130: "Amazon",
    193: "Cloudflare",
    248: "iCloud",
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
    84: "SSL/TLS",
    110: "Netflix",
    120: "WhatsApp",
    126: "Steam",
    190: "Amazon IVS / Twitch",
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
    158: "Microsoft Gaming",
  },
};

export function getCategoryName(id) {
  return CATEGORIES[id] || `Category ${id}`;
}

export function getApplicationName(id, categoryId) {
  if (categoryId !== undefined && CATEGORIZED_APPLICATIONS[categoryId]) {
    const name = CATEGORIZED_APPLICATIONS[categoryId][id];
    if (name) return name;
  }
  return `App ${id}`;
}

export function getTrafficLabel(appId, categoryId) {
  return {
    application: getApplicationName(appId, categoryId),
    category: getCategoryName(categoryId),
  };
}
