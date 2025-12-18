/**
 * InfluxQL queries for Switch and Port data
 */

export const SWITCH_QUERIES = {
  /**
   * Port bandwidth history
   */
  portBandwidthHistory: (swName: string, portIdx: number, duration: string, interval: string) => `
    SELECT mean("rx_bytes-r") as rx_rate, mean("tx_bytes-r") as tx_rate
    FROM usw_ports
    WHERE time > now() - ${duration} AND "device_name" = '${swName}' AND "port_idx" = '${String(portIdx)}'
    GROUP BY time(${interval}) fill(0)
  `,

  /**
   * Port error/dropped packets history
   */
  portErrorsHistory: (swName: string, portIdx: number, duration: string, interval: string) => `
    SELECT max(rx_errors) as rx_errors, max(tx_errors) as tx_errors,
           max(rx_dropped) as rx_dropped, max(tx_dropped) as tx_dropped
    FROM usw_ports
    WHERE time > now() - ${duration} AND "device_name" = '${swName}' AND "port_idx" = '${String(portIdx)}'
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Port PoE power history
   */
  portPoeHistory: (swName: string, portIdx: number, duration: string, interval: string) => `
    SELECT mean(poe_power) as power, mean(poe_voltage) as voltage, mean(poe_current) as current
    FROM usw_ports
    WHERE time > now() - ${duration} AND "device_name" = '${swName}' AND "port_idx" = '${String(portIdx)}'
    GROUP BY time(${interval}) fill(previous)
  `,

  /**
   * Port packet rate history
   */
  portPacketsHistory: (swName: string, portIdx: number, duration: string, interval: string) => `
    SELECT non_negative_derivative(max(rx_packets), 1s) as rx_pps, non_negative_derivative(max(tx_packets), 1s) as tx_pps,
           non_negative_derivative(max(rx_broadcast), 1s) as rx_bcast, non_negative_derivative(max(tx_broadcast), 1s) as tx_bcast,
           non_negative_derivative(max(rx_multicast), 1s) as rx_mcast, non_negative_derivative(max(tx_multicast), 1s) as tx_mcast
    FROM usw_ports
    WHERE time > now() - ${duration} AND "device_name" = '${swName}' AND "port_idx" = '${String(portIdx)}'
    GROUP BY time(${interval}) fill(none)
  `,
};
