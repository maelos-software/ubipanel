/**
 * InfluxQL queries for client-related data
 */

export const CLIENT_QUERIES = {
  /**
   * Bandwidth history for a specific client (wired)
   */
  bandwidthWired: (mac: string, duration: string, interval: string) => `
    SELECT mean("wired-rx_bytes-r") as rx_rate, mean("wired-tx_bytes-r") as tx_rate
    FROM clients
    WHERE time > now() - ${duration} AND "mac" = '${mac}'
    GROUP BY time(${interval}) fill(0)
  `,

  /**
   * Bandwidth history for a specific client (wireless)
   */
  bandwidthWireless: (mac: string, duration: string, interval: string) => `
    SELECT mean("rx_bytes_r") as rx_rate, mean("tx_bytes_r") as tx_rate
    FROM clients
    WHERE time > now() - ${duration} AND "mac" = '${mac}'
    GROUP BY time(${interval}) fill(0)
  `,

  /**
   * Signal and RSSI history for a wireless client
   */
  signalHistory: (mac: string, duration: string, interval: string) => `
    SELECT mean(rssi) as rssi, mean(signal) as signal
    FROM clients
    WHERE time > now() - ${duration} AND "mac" = '${mac}'
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Satisfaction (experience score) history
   */
  satisfactionHistory: (mac: string, duration: string, interval: string) => `
    SELECT mean(satisfaction) as satisfaction
    FROM clients
    WHERE time > now() - ${duration} AND "mac" = '${mac}'
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Link rate (connection speed) history
   */
  rateHistory: (mac: string, duration: string, interval: string) => `
    SELECT mean(tx_rate) as tx_rate, mean(rx_rate) as rx_rate
    FROM clients
    WHERE time > now() - ${duration} AND "mac" = '${mac}'
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Roaming events from unifi_events
   */
  roamingEvents: (clientName: string, duration: string) => `
    SELECT "msg", "ap_from", "ap_to", "ap_name"
    FROM unifi_events
    WHERE time > now() - ${duration} AND "user" = '${clientName}' AND "key" =~ /EVT_WU_Roam/
    ORDER BY time DESC
    LIMIT 50
  `,

  /**
   * Latest extended info for a client
   */
  extendedInfo: (mac: string) => `
    SELECT last(essid) as essid, last(oui) as oui, last(noise) as noise,
           last(tx_rate) as tx_rate, last(rx_rate) as rx_rate,
           last(tx_retries) as tx_retries, last(tx_power) as tx_power, last(ccq) as ccq
    FROM clients
    WHERE time > now() - 5m AND "mac" = '${mac}'
  `,

  /**
   * Last known state for a client (historical)
   */
  historicalState: (mac: string, lookback: string = "7d") => `
    SELECT last(ip) as ip, last(essid) as essid, last(rssi) as rssi,
           last(signal) as signal, last(satisfaction) as satisfaction,
           last(uptime) as uptime, last(hostname) as hostname
    FROM clients
    WHERE time > now() - ${lookback} AND "mac" = '${mac}'
    GROUP BY "name", "is_wired", "ap_name", "channel", "radio_proto"
  `,

  /**
   * Total transferred bytes over a period (historical)
   */
  historicalTraffic: (mac: string, lookback: string = "7d") => `
    SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
           LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes,
           LAST("wired-rx_bytes") - FIRST("wired-rx_bytes") as wired_rx,
           LAST("wired-tx_bytes") - FIRST("wired-tx_bytes") as wired_tx
    FROM clients
    WHERE time > now() - ${lookback} AND "mac" = '${mac}'
  `,
};
