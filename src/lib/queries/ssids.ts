/**
 * InfluxQL queries for SSID/VAP data
 */

export const SSID_QUERIES = {
  /**
   * Client count history for a specific SSID
   */
  clientsHistory: (essid: string, duration: string, interval: string) => `
    SELECT sum(num_sta) as clients
    FROM uap_vaps
    WHERE time > now() - ${duration} AND "essid" = '${essid}'
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Bandwidth history for a specific SSID
   */
  bandwidthHistory: (essid: string, duration: string, interval: string) => `
    SELECT non_negative_derivative(max(rx_bytes), 1s) as rx_rate, non_negative_derivative(max(tx_bytes), 1s) as tx_rate
    FROM uap_vaps
    WHERE time > now() - ${duration} AND "essid" = '${essid}'
    GROUP BY time(${interval}) fill(none)
  `,

  /**
   * Signal/Experience history for a specific SSID
   */
  qualityHistory: (essid: string, duration: string, interval: string, signalFilter: string) => `
    SELECT mean(avg_client_signal) as avg_signal, mean(satisfaction) as satisfaction
    FROM uap_vaps
    WHERE time > now() - ${duration} AND "essid" = '${essid}' AND ${signalFilter}
    GROUP BY time(${interval}) fill(previous)
  `,
};
