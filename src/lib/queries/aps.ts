/**
 * InfluxQL queries for Access Point (AP) data
 */

export const AP_QUERIES = {
  /**
   * Bandwidth history for a specific AP
   */
  bandwidthHistory: (name: string, duration: string, interval: string) => `
    SELECT non_negative_derivative(max(rx_bytes), 1s) as rx_rate, non_negative_derivative(max(tx_bytes), 1s) as tx_rate
    FROM uap
    WHERE time > now() - ${duration} AND "name" = '${name}'
    GROUP BY time(${interval}) fill(none)
  `,

  /**
   * Channel utilization history for a specific AP (grouped by radio)
   */
  channelUtilization: (name: string, duration: string, interval: string) => `
    SELECT mean(cu_total) as cu_total, mean(cu_self_rx) as cu_self_rx, mean(cu_self_tx) as cu_self_tx
    FROM uap_radios
    WHERE time > now() - ${duration} AND "ap_name" = '${name}'
    GROUP BY time(${interval}), "radio" fill(previous)
  `,

  /**
   * Active client counts for a specific AP
   */
  clientsHistory: (name: string, duration: string, interval: string) => `
    SELECT mean(num_sta) as num_sta, mean("guest-num_sta") as guest_num_sta
    FROM uap
    WHERE time > now() - ${duration} AND "name" = '${name}'
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Bandwidth history for ALL APs (grouped by name)
   */
  allBandwidthHistory: (duration: string, interval: string) => `
    SELECT non_negative_derivative(max(rx_bytes), 1s) as rx_rate, non_negative_derivative(max(tx_bytes), 1s) as tx_rate
    FROM uap
    WHERE time > now() - ${duration}
    GROUP BY time(${interval}), "name" fill(none)
  `,

  /**
   * Active client counts for ALL APs (grouped by name)
   */
  allClientsHistory: (duration: string, interval: string) => `
    SELECT mean(num_sta) as num_sta
    FROM uap
    WHERE time > now() - ${duration}
    GROUP BY time(${interval}), "name" fill(previous)
  `,

  /**
   * Average client signal per AP
   */
  signalHistory: (name: string, duration: string, interval: string, signalFilter: string) => `
    SELECT mean(avg_client_signal) as avg_signal
    FROM uap_vaps
    WHERE time > now() - ${duration} AND "device_name" = '${name}' AND ${signalFilter}
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Average client signal for ALL APs
   */
  allSignalHistory: (duration: string, interval: string, signalFilter: string) => `
    SELECT mean(avg_client_signal) as avg_signal
    FROM uap_vaps
    WHERE time > now() - ${duration} AND ${signalFilter}
    GROUP BY time(${interval}), "device_name" fill(previous)
  `,

  /**
   * VAP traffic history (using max/derivative)
   */
  vapBandwidthHistory: (
    name: string,
    duration: string,
    interval: string,
    channelFilter: string
  ) => `
    SELECT non_negative_derivative(max(rx_bytes), 1s) as rx_rate, non_negative_derivative(max(tx_bytes), 1s) as tx_rate
    FROM uap_vaps
    WHERE time > now() - ${duration} AND "device_name" = '${name}' ${channelFilter}
    GROUP BY time(${interval}) fill(none)
  `,

  /**
   * Channel utilization for ALL APs
   */
  allChannelUtilHistory: (duration: string, interval: string, channelFilter: string = "") => `
    SELECT mean(cu_total) as cu_total, mean(cu_self_rx) as cu_self_rx, mean(cu_self_tx) as cu_self_tx
    FROM uap_radios
    WHERE time > now() - ${duration} ${channelFilter}
    GROUP BY time(${interval}), "device_name" fill(previous)
  `,

  /**
   * CCQ (Connection Quality) history per radio
   */
  ccqHistory: (name: string, duration: string, interval: string) => `
    SELECT mean(ccq) as ccq
    FROM uap_vaps
    WHERE time > now() - ${duration} AND "device_name" = '${name}'
    GROUP BY time(${interval}), "radio" fill(previous)
  `,
};
