/**
 * InfluxQL queries for WAN and Gateway data
 */

export const WAN_QUERIES = {
  /**
   * Aggregated WAN bandwidth history (uplink only)
   */
  bandwidthHistory: (duration: string, interval: string) => `
    SELECT mean("rx_bytes-r") as rx_rate, mean("tx_bytes-r") as tx_rate
    FROM usg_wan_ports
    WHERE time > now() - ${duration} AND is_uplink = true
    GROUP BY time(${interval}) fill(0)
  `,

  /**
   * Multi-WAN bandwidth history (per-interface)
   */
  multiBandwidthHistory: (duration: string, interval: string) => `
    SELECT mean("rx_bytes-r") as rx_rate, mean("tx_bytes-r") as tx_rate
    FROM usg_wan_ports
    WHERE time > now() - ${duration}
    GROUP BY time(${interval}), "ifname" fill(0)
  `,
};
