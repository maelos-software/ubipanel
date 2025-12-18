import { useState } from "react";
import { Radio, Wifi, Gauge, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { formatBytes } from "@/lib/format";
import { TIME_RANGES_REPORT } from "@/lib/timeRanges";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { CHART_COLORS } from "@/config/theme";
import {
  useRadioStats,
  useVapStats,
  useRadioTrafficHistory,
  useRadioClientsHistory,
  useRadioSatisfactionHistory,
  type RadioData,
} from "@/hooks/history/useRadioReport";
import { THRESHOLDS } from "@/lib/config";

const COLORS = CHART_COLORS.radio;

export function RadioReport() {
  const [timeRange, setTimeRange] = useState(TIME_RANGES_REPORT[1]); // Default to 3h
  const rangeConfig = timeRange;

  // Current radio stats
  const { data: radios = [], isLoading: radiosLoading } = useRadioStats();

  // VAP (Virtual AP) data per SSID
  const { data: vaps = [] } = useVapStats();

  // Traffic by band history
  const { data: trafficHistory = [] } = useRadioTrafficHistory(timeRange.value, rangeConfig.group);

  // Clients per band history
  const { data: clientsHistory = [] } = useRadioClientsHistory(timeRange.value, rangeConfig.group);

  // Satisfaction history by band
  const { data: satisfactionHistory = [] } = useRadioSatisfactionHistory(
    timeRange.value,
    rangeConfig.group
  );

  // Summary calculations
  const radios6GHz = radios.filter((r) => r.band === "6GHz");
  const radios5GHz = radios.filter((r) => r.band === "5GHz");
  const radios24GHz = radios.filter((r) => r.band === "2.4GHz");

  const avg6GHzUtil =
    radios6GHz.length > 0
      ? radios6GHz.reduce((sum, r) => sum + r.cuTotal, 0) / radios6GHz.length
      : 0;
  const avg5GHzUtil =
    radios5GHz.length > 0
      ? radios5GHz.reduce((sum, r) => sum + r.cuTotal, 0) / radios5GHz.length
      : 0;
  const avg24GHzUtil =
    radios24GHz.length > 0
      ? radios24GHz.reduce((sum, r) => sum + r.cuTotal, 0) / radios24GHz.length
      : 0;

  const clients6GHz = radios6GHz.reduce((sum, r) => sum + r.numSta, 0);
  const clients5GHz = radios5GHz.reduce((sum, r) => sum + r.numSta, 0);
  const clients24GHz = radios24GHz.reduce((sum, r) => sum + r.numSta, 0);
  const totalClients = clients6GHz + clients5GHz + clients24GHz;
  const has6GHz = radios6GHz.length > 0;

  // Channel distribution
  const channelDist = radios.reduce(
    (acc, r) => {
      const key = `Ch ${r.channel}`;
      if (!acc[key]) {
        acc[key] = { channel: key, clients: 0, band: r.band };
      }
      acc[key].clients += r.numSta;
      return acc;
    },
    {} as Record<string, { channel: string; clients: number; band: string }>
  );
  const channelData = Object.values(channelDist).sort((a, b) => b.clients - a.clients);

  // High utilization radios
  const highUtilRadios = radios.filter((r) => r.cuTotal > THRESHOLDS.utilization.moderate);

  return (
    <div>
      <PageHeader
        title="WiFi Radio Analysis"
        description="Comprehensive wireless radio performance and health metrics"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Time Range Selector */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1">
          {TIME_RANGES_REPORT.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange.value === range.value
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Radio className="w-4 h-4" />
            Active Radios
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{radios.length}</div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {has6GHz && `${radios6GHz.length} × 6GHz, `}
            {radios5GHz.length} × 5GHz, {radios24GHz.length} × 2.4GHz
          </div>
        </div>

        {has6GHz && (
          <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Wifi className="w-4 h-4 text-cyan-500" />
              6GHz Clients
            </div>
            <div className="text-2xl font-bold text-cyan-600 mt-1">{clients6GHz}</div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {totalClients > 0 ? ((clients6GHz / totalClients) * 100).toFixed(0) : 0}% of total
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Wifi className="w-4 h-4 text-purple-500" />
            5GHz Clients
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-1">{clients5GHz}</div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {totalClients > 0 ? ((clients5GHz / totalClients) * 100).toFixed(0) : 0}% of total
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Wifi className="w-4 h-4 text-green-500" />
            2.4GHz Clients
          </div>
          <div className="text-2xl font-bold text-green-600 mt-1">{clients24GHz}</div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {totalClients > 0 ? ((clients24GHz / totalClients) * 100).toFixed(0) : 0}% of total
          </div>
        </div>

        {has6GHz && (
          <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Gauge className="w-4 h-4 text-cyan-500" />
              6GHz Avg Util
            </div>
            <div
              className={`text-2xl font-bold mt-1 ${avg6GHzUtil > THRESHOLDS.utilization.high ? "text-red-600" : avg6GHzUtil > THRESHOLDS.utilization.moderate ? "text-amber-600" : "text-green-600"}`}
            >
              {avg6GHzUtil.toFixed(0)}%
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Gauge className="w-4 h-4 text-purple-500" />
            5GHz Avg Util
          </div>
          <div
            className={`text-2xl font-bold mt-1 ${avg5GHzUtil > THRESHOLDS.utilization.high ? "text-red-600" : avg5GHzUtil > THRESHOLDS.utilization.moderate ? "text-amber-600" : "text-green-600"}`}
          >
            {avg5GHzUtil.toFixed(0)}%
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Gauge className="w-4 h-4 text-green-500" />
            2.4GHz Avg Util
          </div>
          <div
            className={`text-2xl font-bold mt-1 ${avg24GHzUtil > THRESHOLDS.utilization.high ? "text-red-600" : avg24GHzUtil > THRESHOLDS.utilization.moderate ? "text-amber-600" : "text-green-600"}`}
          >
            {avg24GHzUtil.toFixed(0)}%
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            High Utilization
          </div>
          <div
            className={`text-2xl font-bold mt-1 ${highUtilRadios.length > 0 ? "text-amber-600" : "text-green-600"}`}
          >
            {highUtilRadios.length}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            Radios &gt;{THRESHOLDS.utilization.moderate}%
          </div>
        </div>
      </div>

      {/* Charts Row 1: Traffic and Clients by Band */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Traffic by Band */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Traffic by Band</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatBytes(v) + "/s"}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                        <div className="text-gray-400 mb-1">
                          {label ? new Date(label).toLocaleString() : ""}
                        </div>
                        {payload.map((p) => (
                          <div key={p.dataKey} className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <span>
                              {p.dataKey}: {formatBytes(p.value as number)}/s
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="6GHz"
                  stackId="1"
                  stroke={COLORS["6GHz"]}
                  fill={COLORS["6GHz"]}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="5GHz"
                  stackId="1"
                  stroke={COLORS["5GHz"]}
                  fill={COLORS["5GHz"]}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="2.4GHz"
                  stackId="1"
                  stroke={COLORS["2.4GHz"]}
                  fill={COLORS["2.4GHz"]}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Clients by Band */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Clients by Band</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={clientsHistory}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                        <div className="text-gray-400 mb-1">
                          {label ? new Date(label).toLocaleString() : ""}
                        </div>
                        {payload.map((p) => (
                          <div key={p.dataKey} className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <span>
                              {p.dataKey}: {p.value} clients
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="6GHz"
                  stackId="1"
                  stroke={COLORS["6GHz"]}
                  fill={COLORS["6GHz"]}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="5GHz"
                  stackId="1"
                  stroke={COLORS["5GHz"]}
                  fill={COLORS["5GHz"]}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="2.4GHz"
                  stackId="1"
                  stroke={COLORS["2.4GHz"]}
                  fill={COLORS["2.4GHz"]}
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Channel Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 5GHz Channel Utilization */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            5GHz Channel Utilization
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={radios5GHz} layout="vertical">
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as RadioData;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                        <div className="font-medium">{data.name}</div>
                        <div className="text-gray-400 mt-1">Channel {data.channel}</div>
                        <div className="text-gray-400">Total: {data.cuTotal}%</div>
                        <div className="text-gray-400">
                          Self Rx: {data.cuSelfRx}% | Tx: {data.cuSelfTx}%
                        </div>
                        <div className="text-gray-400">{data.numSta} clients</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="cuTotal" radius={[0, 4, 4, 0]}>
                  {radios5GHz.map((r, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        r.cuTotal > THRESHOLDS.utilization.high
                          ? COLORS.red
                          : r.cuTotal > THRESHOLDS.utilization.moderate
                            ? COLORS.amber
                            : COLORS.purple
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2.4GHz Channel Utilization */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            2.4GHz Channel Utilization
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={radios24GHz} layout="vertical">
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as RadioData;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                        <div className="font-medium">{data.name}</div>
                        <div className="text-gray-400 mt-1">Channel {data.channel}</div>
                        <div className="text-gray-400">Total: {data.cuTotal}%</div>
                        <div className="text-gray-400">
                          Self Rx: {data.cuSelfRx}% | Tx: {data.cuSelfTx}%
                        </div>
                        <div className="text-gray-400">{data.numSta} clients</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="cuTotal" radius={[0, 4, 4, 0]}>
                  {radios24GHz.map((r, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        r.cuTotal > THRESHOLDS.utilization.high
                          ? COLORS.red
                          : r.cuTotal > THRESHOLDS.utilization.moderate
                            ? COLORS.amber
                            : COLORS.green
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3: CCQ and Channel Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Satisfaction History */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Client Satisfaction
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={satisfactionHistory}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) =>
                    new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                        <div className="text-gray-400 mb-1">
                          {label ? new Date(label).toLocaleString() : ""}
                        </div>
                        {payload.map((p) => (
                          <div key={p.dataKey} className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <span>
                              {p.dataKey}: {(p.value as number)?.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="6GHz"
                  stroke={COLORS["6GHz"]}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="5GHz"
                  stroke={COLORS["5GHz"]}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="2.4GHz"
                  stroke={COLORS["2.4GHz"]}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Client Distribution by Channel */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Clients by Channel
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData.slice(0, 10)}>
                <XAxis
                  dataKey="channel"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                        <div className="font-medium">{data.channel}</div>
                        <div className="text-gray-400">{data.band}</div>
                        <div className="text-gray-400 mt-1">{data.clients} clients</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="clients" radius={[4, 4, 0, 0]}>
                  {channelData.slice(0, 10).map((d, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        d.band === "6GHz"
                          ? COLORS["6GHz"]
                          : d.band === "5GHz"
                            ? COLORS["5GHz"]
                            : COLORS["2.4GHz"]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            {has6GHz && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS["6GHz"] }} />
                <span className="text-xs text-[var(--text-tertiary)]">6GHz</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS["5GHz"] }} />
              <span className="text-xs text-[var(--text-tertiary)]">5GHz</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS["2.4GHz"] }} />
              <span className="text-xs text-[var(--text-tertiary)]">2.4GHz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Radio Details Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Radio Details</h2>
        {radiosLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                  <th className="pb-3 pr-4">Access Point</th>
                  <th className="pb-3 pr-4">Band</th>
                  <th className="pb-3 pr-4">Channel</th>
                  <th className="pb-3 pr-4">Clients</th>
                  <th className="pb-3 pr-4">Utilization</th>
                  <th className="pb-3 pr-4">TX Power</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {radios.map((radio) => (
                  <tr
                    key={`${radio.name}-${radio.radio}`}
                    className="hover:bg-[var(--bg-tertiary)]"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Radio
                          className={`w-4 h-4 ${radio.band === "6GHz" ? "text-cyan-500" : radio.band === "5GHz" ? "text-purple-500" : "text-green-500"}`}
                        />
                        <span className="font-medium text-[var(--text-primary)]">{radio.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          radio.band === "6GHz" || radio.band === "5GHz" ? "info" : "success"
                        }
                      >
                        {radio.band}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-tertiary)]">{radio.channel}</td>
                    <td className="py-3 pr-4 font-semibold text-[var(--text-primary)]">
                      {radio.numSta}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full max-w-[100px]">
                          <div
                            className={`h-full rounded-full ${
                              radio.cuTotal > THRESHOLDS.utilization.high
                                ? "bg-red-500/10 dark:bg-red-500/200"
                                : radio.cuTotal > THRESHOLDS.utilization.moderate
                                  ? "bg-amber-500/10 dark:bg-amber-500/200"
                                  : "bg-green-500/10 dark:bg-green-500/200"
                            }`}
                            style={{ width: `${Math.min(radio.cuTotal, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-[var(--text-tertiary)]">
                          {radio.cuTotal}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-tertiary)]">{radio.txPower} dBm</td>
                    <td className="py-3">
                      <Badge
                        variant={
                          radio.cuTotal > THRESHOLDS.utilization.high
                            ? "error"
                            : radio.cuTotal > THRESHOLDS.utilization.moderate
                              ? "warning"
                              : "success"
                        }
                      >
                        {radio.cuTotal > THRESHOLDS.utilization.high
                          ? "High Load"
                          : radio.cuTotal > THRESHOLDS.utilization.moderate
                            ? "Moderate"
                            : "Good"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SSID Performance Table */}
      {vaps.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 mt-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            SSID Performance (Active Networks)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                  <th className="pb-3 pr-4">SSID</th>
                  <th className="pb-3 pr-4">AP</th>
                  <th className="pb-3 pr-4">Band</th>
                  <th className="pb-3 pr-4">Clients</th>
                  <th className="pb-3 pr-4">Avg Signal</th>
                  <th className="pb-3 pr-4">Satisfaction</th>
                  <th className="pb-3 pr-4">Traffic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {vaps.slice(0, 20).map((vap) => (
                  <tr
                    key={`${vap.apName}-${vap.essid}-${vap.radio}`}
                    className="hover:bg-[var(--bg-tertiary)]"
                  >
                    <td className="py-3 pr-4">
                      <span className="font-medium text-[var(--text-primary)]">{vap.essid}</span>
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-tertiary)]">{vap.apName}</td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={vap.band === "6GHz" || vap.band === "5GHz" ? "info" : "success"}
                      >
                        {vap.band}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-[var(--text-primary)]">
                      {vap.numSta}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          vap.avgSignal > THRESHOLDS.signal.excellent
                            ? "text-green-600"
                            : vap.avgSignal > THRESHOLDS.signal.fair
                              ? "text-amber-600"
                              : "text-red-600"
                        }
                      >
                        {vap.avgSignal > 0 ? "—" : `${vap.avgSignal} dBm`}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {vap.satisfaction > 0 ? (
                        <span
                          className={
                            vap.satisfaction >= THRESHOLDS.satisfaction.good
                              ? "text-green-600"
                              : vap.satisfaction >= THRESHOLDS.satisfaction.warning
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          {vap.satisfaction}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-tertiary)]">
                      <div className="text-xs">
                        <span className="text-blue-600">↓{formatBytes(vap.rxBytes)}</span>
                        {" / "}
                        <span className="text-green-600">↑{formatBytes(vap.txBytes)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
