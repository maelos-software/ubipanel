import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { BandwidthTooltip, PercentTooltip, SignalTooltip } from "@/components/charts/ChartTooltip";
import { CorrelationChart } from "@/components/charts/CorrelationChart";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { formatBytesRateAxis, getSignalDomain, formatClientName } from "@/lib/format";
import { getIntervalForRange } from "@/lib/bandwidth";
import { useChartColors } from "@/hooks/useChartColors";
import { useTimeRangeState } from "@/hooks/useTimeRangeState";
import { TIME_RANGES_EXTENDED } from "@/lib/timeRanges";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { CHART_COLORS } from "@/config/theme";

// Color palette for charts - use accent for consistency across dashboard
const COLORS = CHART_COLORS.accent;

// Custom compact legend for pie charts
const CompactLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 max-h-20 overflow-y-auto">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1 text-xs">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--text-tertiary)] truncate max-w-[80px]" title={entry.value}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Custom label for pie slices - show value if slice is big enough
const renderCustomLabel = (props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
}) => {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    percent = 0,
    value = 0,
  } = props;
  if (percent < 0.08) return null; // Don't label small slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {value}
    </text>
  );
};

interface ClientData {
  mac: string;
  name: string;
  hostname: string;
  ip: string;
  isWired: boolean;
  apName: string;
  swName: string;
  swPort: number;
  channel: number;
  radioProto: string;
  essid: string;
  oui: string;
  rxBytes: number;
  txBytes: number;
  rssi: number;
  signal: number;
  satisfaction: number;
  uptime: number;
}

export function ClientInsights() {
  const {
    timeRange,
    setTimeRange,
    value: timeRangeValue,
  } = useTimeRangeState(TIME_RANGES_EXTENDED);
  const chartColors = useChartColors();

  // Fetch all clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["clientInsights", timeRangeValue],
    queryFn: async () => {
      // Query 1: Get current client state
      const currentResponse = await queryInflux(`
        SELECT last(ip) as ip, last(essid) as essid, last(oui) as oui,
               last(rssi) as rssi, last(signal) as signal, last(satisfaction) as satisfaction,
               last(uptime) as uptime, last(hostname) as hostname
        FROM clients
        WHERE time > now() - 5m
        GROUP BY "mac", "name", "is_wired", "ap_name", "sw_name", "sw_port", "channel", "radio_proto", "oui"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes,
               LAST("wired-rx_bytes") - FIRST("wired-rx_bytes") as wired_rx,
               LAST("wired-tx_bytes") - FIRST("wired-tx_bytes") as wired_tx
        FROM clients
        WHERE time > now() - ${timeRangeValue}
        GROUP BY "mac"
      `);

      // Build a map of traffic by MAC
      const trafficByMac = new Map<
        string,
        { rx: number; tx: number; wiredRx: number; wiredTx: number }
      >();
      const trafficSeries = trafficResponse.results?.[0]?.series || [];
      for (const s of trafficSeries) {
        const mac = s.tags?.mac || "";
        const cols = s.columns;
        const vals = s.values?.[0] || [];
        const getVal = (k: string) => {
          const idx = cols.indexOf(k);
          return idx >= 0 ? Math.max(0, (vals[idx] as number) || 0) : 0;
        };
        trafficByMac.set(mac, {
          rx: getVal("rx_bytes"),
          tx: getVal("tx_bytes"),
          wiredRx: getVal("wired_rx"),
          wiredTx: getVal("wired_tx"),
        });
      }

      const series = currentResponse.results[0]?.series || [];
      const allClients = series.map(
        (s: { tags?: Record<string, string>; columns: string[]; values: unknown[][] }) => {
          const tags = s.tags || {};
          const cols = s.columns;
          const vals = s.values[0] || [];
          const getValue = (key: string) => {
            const idx = cols.indexOf(key);
            return idx >= 0 ? vals[idx] : null;
          };

          const mac = tags.mac || "";
          const traffic = trafficByMac.get(mac);
          const isWired = tags.is_wired === "true";

          const rxBytes = isWired ? traffic?.wiredRx || 0 : traffic?.rx || 0;
          const txBytes = isWired ? traffic?.wiredTx || 0 : traffic?.tx || 0;

          return {
            mac,
            name: tags.name || "Unknown",
            hostname: (getValue("hostname") as string) || "",
            ip: (getValue("ip") as string) || "",
            isWired,
            apName: tags.ap_name || "",
            swName: tags.sw_name || "",
            swPort: parseInt(tags.sw_port) || 0,
            channel: parseInt(tags.channel) || 0,
            radioProto: tags.radio_proto || "",
            essid: (getValue("essid") as string) || "",
            oui: tags.oui || "",
            rxBytes,
            txBytes,
            rssi: (getValue("signal") as number) || 0,
            signal: (getValue("rssi") as number) || 0,
            satisfaction: (getValue("satisfaction") as number) || 0,
            uptime: (getValue("uptime") as number) || 0,
          } as ClientData;
        }
      );

      const byMac = new Map<string, ClientData>();
      for (const client of allClients) {
        const existing = byMac.get(client.mac);
        if (!existing || client.uptime > existing.uptime) {
          byMac.set(client.mac, client);
        }
      }
      return Array.from(byMac.values());
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const interval = getIntervalForRange(timeRangeValue);

  // Fetch bandwidth history per client (wireless)
  const { data: wirelessBandwidth } = useQuery({
    queryKey: ["wirelessBandwidth", timeRangeValue, interval],
    queryFn: async () => {
      const response = await queryInflux(`
        SELECT non_negative_derivative(max("rx_bytes"), 1s) as rx, non_negative_derivative(max("tx_bytes"), 1s) as tx
        FROM clients
        WHERE time > now() - ${timeRangeValue} AND is_wired = 'false'
        GROUP BY time(${interval}), "name", "mac", "hostname", "oui" fill(none)
      `);
      return response.results[0]?.series || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Fetch bandwidth history per client (wired)
  const { data: wiredBandwidth } = useQuery({
    queryKey: ["wiredBandwidth", timeRangeValue, interval],
    queryFn: async () => {
      const response = await queryInflux(`
        SELECT non_negative_derivative(max("wired-rx_bytes"), 1s) as rx, non_negative_derivative(max("wired-tx_bytes"), 1s) as tx
        FROM clients
        WHERE time > now() - ${timeRangeValue} AND is_wired = 'true'
        GROUP BY time(${interval}), "name", "mac", "hostname", "oui" fill(none)
      `);
      return response.results[0]?.series || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Fetch RSSI history (dBm values)
  const { data: rssiHistory } = useQuery({
    queryKey: ["rssiHistory", timeRangeValue, interval],
    queryFn: async () => {
      const response = await queryInflux(`
        SELECT mean(signal) as rssi
        FROM clients
        WHERE time > now() - ${timeRangeValue} AND is_wired = 'false'
        GROUP BY time(${interval}), "name", "mac", "hostname", "oui" fill(none)
      `);
      return response.results[0]?.series || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Fetch signal percentage history (0-100%)
  const { data: signalHistory } = useQuery({
    queryKey: ["signalHistory", timeRangeValue, interval],
    queryFn: async () => {
      const response = await queryInflux(`
        SELECT mean(rssi) as signal
        FROM clients
        WHERE time > now() - ${timeRangeValue} AND is_wired = 'false'
        GROUP BY time(${interval}), "name", "mac", "hostname", "oui" fill(none)
      `);
      return response.results[0]?.series || [];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Computed data
  const wirelessClients = useMemo(() => (clients || []).filter((c) => !c.isWired), [clients]);
  const wiredClients = useMemo(() => (clients || []).filter((c) => c.isWired), [clients]);

  // Use centralized formatClientName for all display names
  const getDisplayName = useCallback((tags: Record<string, string>): string => {
    return formatClientName({
      mac: tags.mac || "",
      name: tags.name || "",
      hostname: tags.hostname || "",
      oui: tags.oui || "",
    });
  }, []);

  // Clients by channel pie data
  const channelData = useMemo(() => {
    const counts: Record<string, number> = {};
    if (wiredClients.length > 0) {
      counts["Wired"] = wiredClients.length;
    }
    wirelessClients.forEach((c) => {
      if (c.channel) {
        const key = `Ch ${c.channel}`;
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [wirelessClients, wiredClients]);

  // Clients by AP pie data
  const apRadioData = useMemo(() => {
    const counts: Record<string, number> = {};
    wirelessClients.forEach((c) => {
      if (c.apName) {
        counts[c.apName] = (counts[c.apName] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [wirelessClients]);

  // OUI breakdown pie data
  const ouiData = useMemo(() => {
    const counts: Record<string, number> = {};
    (clients || []).forEach((c) => {
      const key = c.oui || "Unknown";
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [clients]);

  // Process bandwidth data for charts
  const processBandwidthData = useCallback(
    (
      series: Array<{
        tags?: Record<string, string>;
        columns: string[];
        values: unknown[][];
      }>
    ) => {
      const timeMap: Record<string, Record<string, number>> = {};
      const clientTotals: Record<string, number> = {};

      series.forEach((s) => {
        const name = getDisplayName(s.tags || {});
        const cols = s.columns;
        const rxIdx = cols.indexOf("rx");
        const txIdx = cols.indexOf("tx");

        let clientTotal = 0;
        const values = s.values || [];
        values.forEach((row) => {
          const time = row[0] as string;
          if (!timeMap[time]) timeMap[time] = {};

          const rx = (row[rxIdx] as number) || 0;
          const tx = (row[txIdx] as number) || 0;

          timeMap[time][`${name}_rx`] = (timeMap[time][`${name}_rx`] || 0) + rx;
          timeMap[time][`${name}_tx`] = (timeMap[time][`${name}_tx`] || 0) + tx;
          timeMap[time][`${name}_total`] = (timeMap[time][`${name}_total`] || 0) + rx + tx;

          clientTotal += rx + tx;
        });

        clientTotals[name] = (clientTotals[name] || 0) + clientTotal;
      });

      const topClients = Object.entries(clientTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name);

      return {
        data: Object.entries(timeMap)
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([time, values]) => ({
            time: new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            ...values,
          })),
        clients: topClients,
      };
    },
    [getDisplayName]
  );

  // Process time series for single metric
  const processTimeSeriesData = useCallback(
    (
      series: Array<{
        tags?: Record<string, string>;
        columns: string[];
        values: unknown[][];
      }>,
      metric: string
    ) => {
      const timeMap: Record<string, Record<string, number>> = {};
      const clientNames = new Set<string>();

      series.forEach((s) => {
        const name = getDisplayName(s.tags || {});
        clientNames.add(name);
        const cols = s.columns;
        const metricIdx = cols.indexOf(metric);

        (s.values || []).forEach((row) => {
          const time = row[0] as string;
          if (!timeMap[time]) timeMap[time] = {};
          timeMap[time][name] = (row[metricIdx] as number) || 0;
        });
      });

      return {
        data: Object.entries(timeMap)
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([time, values]) => ({
            time: new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            ...values,
          })),
        clients: Array.from(clientNames).slice(0, 10),
      };
    },
    [getDisplayName]
  );

  const wirelessBwData = useMemo(
    () => processBandwidthData(wirelessBandwidth || []),
    [wirelessBandwidth, processBandwidthData]
  );

  const wiredBwData = useMemo(
    () => processBandwidthData(wiredBandwidth || []),
    [wiredBandwidth, processBandwidthData]
  );

  const rssiData = useMemo(
    () => processTimeSeriesData(rssiHistory || [], "rssi"),
    [rssiHistory, processTimeSeriesData]
  );

  const signalData = useMemo(
    () => processTimeSeriesData(signalHistory || [], "signal"),
    [signalHistory, processTimeSeriesData]
  );

  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Insights"
        description="Detailed client analytics and bandwidth metrics"
      />

      {/* Time Range Controls */}
      <TimeRangeSelector
        ranges={TIME_RANGES_EXTENDED}
        selected={timeRange}
        onChange={setTimeRange}
      />

      {/* Pie Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            Clients / Channel
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {channelData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke={chartColors.tooltipBg}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: chartColors.tooltipText }}
                  formatter={(value: number, name: string) => [`${value} clients`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <CompactLegend
            payload={channelData.map((d, i) => ({
              value: d.name,
              color: COLORS[i % COLORS.length],
            }))}
          />
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            Clients / Access Point
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={apRadioData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {apRadioData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke={chartColors.tooltipBg}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: chartColors.tooltipText }}
                  formatter={(value: number, name: string) => [`${value} clients`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <CompactLegend
            payload={apRadioData.map((d, i) => ({
              value: d.name,
              color: COLORS[i % COLORS.length],
            }))}
          />
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
            Client MAC OUI Breakdown
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ouiData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={renderCustomLabel}
                  labelLine={false}
                >
                  {ouiData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      stroke={chartColors.tooltipBg}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: chartColors.tooltipText }}
                  formatter={(value: number, name: string) => [`${value} devices`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <CompactLegend
            payload={ouiData.map((d, i) => ({
              value: d.name,
              color: COLORS[i % COLORS.length],
            }))}
          />
        </div>
      </div>

      {/* Bandwidth Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            UAP Bandwidth / Wireless Devices
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={wirelessBwData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                />
                <YAxis
                  tickFormatter={(v) => formatBytesRateAxis(v)}
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                  width={70}
                />
                <Tooltip
                  content={
                    <BandwidthTooltip
                      chartColors={chartColors}
                      nameFormatter={(name) => name.replace(/_total$/, "")}
                    />
                  }
                />
                {wirelessBwData.clients.map((client, i) => (
                  <Area
                    key={`${client}_total`}
                    type="monotone"
                    dataKey={`${client}_total`}
                    stackId="total"
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.6}
                    name={client}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Switch Bandwidth / Wired Devices
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={wiredBwData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                />
                <YAxis
                  tickFormatter={(v) => formatBytesRateAxis(v)}
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                  width={70}
                />
                <Tooltip
                  content={
                    <BandwidthTooltip
                      chartColors={chartColors}
                      nameFormatter={(name) => name.replace(/_total$/, "")}
                    />
                  }
                />
                {wiredBwData.clients.map((client, i) => (
                  <Area
                    key={`${client}_total`}
                    type="monotone"
                    dataKey={`${client}_total`}
                    stackId="total"
                    stroke={COLORS[i % COLORS.length]}
                    fill={COLORS[i % COLORS.length]}
                    fillOpacity={0.6}
                    name={client}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Signal Quality Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Received Signal Strength (RSSI)
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rssiData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                />
                <YAxis
                  domain={([dataMin, dataMax]) => getSignalDomain(dataMin, dataMax)}
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                />
                <Tooltip content={<SignalTooltip chartColors={chartColors} />} />
                {rssiData.clients.map((client, i) => (
                  <Line
                    key={client}
                    type="monotone"
                    dataKey={client}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={client}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Signal Quality (%)
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signalData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  stroke={chartColors.axisLine}
                />
                <Tooltip content={<PercentTooltip chartColors={chartColors} />} />
                {signalData.clients.map((client, i) => (
                  <Line
                    key={client}
                    type="monotone"
                    dataKey={client}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={client}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Correlation Chart Row */}
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
          Signal vs. Satisfaction Correlation
        </h3>
        <div className="h-80">
          <CorrelationChart clients={clients || []} />
        </div>
      </div>
    </div>
  );
}
