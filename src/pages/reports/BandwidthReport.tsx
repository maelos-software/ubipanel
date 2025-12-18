import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatBytes, formatBytesRate } from "@/lib/format";
import { TIME_RANGES_REPORT_FULL } from "@/lib/timeRanges";
import {
  useTopBandwidthConsumers,
  useBandwidthByVlan,
  useClientBandwidthTrend,
} from "@/hooks/useBandwidth";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { CHART_COLORS } from "@/config/theme";

const COLORS = CHART_COLORS.accent;

export function BandwidthReport() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState(TIME_RANGES_REPORT_FULL[0]);

  // Use centralized hooks for correct bandwidth calculations
  const { data: topClients = [], isLoading } = useTopBandwidthConsumers(timeRange.value, {
    limit: 20,
  });
  const { data: vlanData = [] } = useBandwidthByVlan(timeRange.value);
  const { data: trendData = [] } = useClientBandwidthTrend(timeRange.value);

  const totalBandwidth = topClients.reduce((sum, c) => sum + c.total, 0);
  const maxClientBandwidth = topClients[0]?.total || 1;

  return (
    <div>
      <PageHeader
        title="Top Bandwidth Consumers"
        description="Identify which clients are using the most bandwidth"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Time Range Selector */}
      <div className="flex items-center gap-2 mb-6">
        {TIME_RANGES_REPORT_FULL.map((range) => (
          <button
            key={range.value}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange.value === range.value
                ? "bg-purple-100 text-purple-700"
                : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Total Bandwidth</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {topClients.length > 0 ? formatBytes(totalBandwidth) : "—"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            Last {timeRange.label.toLowerCase()}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Top Consumer</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1 truncate">
            {topClients[0]?.name || "—"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            {topClients[0] ? formatBytes(topClients[0].total) : "—"}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Active VLANs</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {vlanData.length}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">With traffic</div>
        </div>
      </div>

      {/* Bandwidth Trend Chart */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Network Throughput
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="rxGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tickFormatter={(t) => {
                  const d = new Date(t);
                  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                }}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatBytesRate(v)}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                      <div className="text-gray-400 mb-1">
                        {label ? new Date(label).toLocaleString() : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="w-3 h-3 text-purple-400" />
                        <span>Download: {formatBytesRate(payload[0]?.value as number)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-3 h-3 text-blue-400" />
                        <span>Upload: {formatBytesRate(payload[1]?.value as number)}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="rx"
                stroke="#8b5cf6"
                fill="url(#rxGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="tx"
                stroke="#3b82f6"
                fill="url(#txGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500/10 dark:bg-purple-500/200" />
            <span className="text-sm text-[var(--text-tertiary)]">Download</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500/10 dark:bg-blue-500/200" />
            <span className="text-sm text-[var(--text-tertiary)]">Upload</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Clients Table */}
        <div className="lg:col-span-2 bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Top 20 Clients</h2>
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
              Loading...
            </div>
          ) : (
            <div className="space-y-3">
              {topClients.map((client, idx) => (
                <button
                  key={client.id}
                  onClick={() => navigate(`/clients/${encodeURIComponent(client.id)}`)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-600">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[var(--text-primary)] truncate group-hover:text-purple-600">
                        {client.name}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-secondary)]">
                        {formatBytes(client.total)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                          style={{ width: `${(client.total / maxClientBandwidth) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)] w-16 text-right">
                        VLAN {client.meta?.vlan || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-tertiary)]">
                      <span className="flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3 text-blue-500" />
                        {formatBytes(client.tx)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3 text-purple-500" />
                        {formatBytes(client.rx)}
                      </span>
                      <span className="text-[var(--text-tertiary)]">
                        {totalBandwidth > 0
                          ? `${((client.total / totalBandwidth) * 100).toFixed(1)}% of total`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bandwidth by VLAN */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">By VLAN</h2>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vlanData.slice(0, 10)} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => formatBytes(v)} hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  tickFormatter={(v) => `VLAN ${v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                        <div className="font-medium">VLAN {data.name}</div>
                        <div className="text-gray-400 mt-1">Total: {formatBytes(data.total)}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {vlanData.slice(0, 10).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {vlanData.slice(0, 5).map((v, idx) => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                  <span className="text-[var(--text-tertiary)]">VLAN {v.name}</span>
                </div>
                <span className="font-medium text-[var(--text-primary)]">
                  {formatBytes(v.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
