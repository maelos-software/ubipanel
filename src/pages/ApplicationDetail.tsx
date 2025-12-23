import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { DataTable } from "@/components/common/DataTable";
import { useApplicationTraffic, useApplicationTrafficHistory } from "@/hooks/useTrafficData";
import { formatBytes, formatDuration } from "@/lib/format";
import { getApplicationName, getCategoryName } from "@/lib/dpiMappings";
import { useChartColors } from "@/hooks/useChartColors";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ArrowDown, ArrowUp, Clock, Laptop, Wifi, Cable, Server, Activity } from "lucide-react";

type TimeRange = "1h" | "24h" | "7d";

interface ClientUsage {
  clientMac: string;
  clientName: string;
  isWired: boolean;
  bytesRx: number;
  bytesTx: number;
  bytesTotal: number;
  activitySeconds: number;
  sessionCount: number;
}

export function ApplicationDetail() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const chartColors = useChartColors();

  const applicationId = parseInt(appId || "0", 10);

  const { data: trafficData = [], isLoading: trafficLoading } = useApplicationTraffic(
    applicationId,
    timeRange
  );
  const { data: historyData = [], isLoading: historyLoading } = useApplicationTrafficHistory(
    applicationId,
    timeRange
  );

  const isLoading = trafficLoading || historyLoading;

  // Get name and category from first record or mapping
  const appName =
    trafficData?.[0]?.appName || getApplicationName(applicationId, trafficData?.[0]?.category);
  const category = trafficData.length > 0 ? trafficData[0].category : 0;
  const categoryName = trafficData?.[0]?.categoryName || getCategoryName(category);

  // Aggregate by client
  const clientUsageMap = trafficData.reduce(
    (acc, item) => {
      const key = item.clientMac;
      if (!acc[key]) {
        acc[key] = {
          clientMac: item.clientMac,
          clientName: item.clientName,
          isWired: item.isWired,
          bytesRx: 0,
          bytesTx: 0,
          bytesTotal: 0,
          activitySeconds: 0,
          sessionCount: 0,
        };
      }
      acc[key].bytesRx += item.bytesRx;
      acc[key].bytesTx += item.bytesTx;
      acc[key].bytesTotal += item.bytesTotal;
      acc[key].activitySeconds += item.activitySeconds;
      acc[key].sessionCount += 1;
      return acc;
    },
    {} as Record<string, ClientUsage>
  );

  const clientUsage: ClientUsage[] = Object.values(clientUsageMap).sort(
    (a, b) => b.bytesTotal - a.bytesTotal
  );

  // Calculate totals
  const totals = clientUsage.reduce(
    (acc, client) => ({
      bytesRx: acc.bytesRx + client.bytesRx,
      bytesTx: acc.bytesTx + client.bytesTx,
      bytesTotal: acc.bytesTotal + client.bytesTotal,
      activitySeconds: acc.activitySeconds + client.activitySeconds,
    }),
    { bytesRx: 0, bytesTx: 0, bytesTotal: 0, activitySeconds: 0 }
  );

  // Wired vs Wireless breakdown
  const wiredClients = clientUsage.filter((c) => c.isWired);
  const wirelessClients = clientUsage.filter((c) => !c.isWired);
  const wiredBytes = wiredClients.reduce((sum, c) => sum + c.bytesTotal, 0);
  const wirelessBytes = wirelessClients.reduce((sum, c) => sum + c.bytesTotal, 0);

  const connectionTypeData = [
    { name: "Wired", value: wiredBytes, count: wiredClients.length, color: "#3b82f6" },
    { name: "Wireless", value: wirelessBytes, count: wirelessClients.length, color: "#8b5cf6" },
  ].filter((d) => d.value > 0);

  // Format history data for chart
  const chartData = historyData
    .filter((d) => d.bytesTotal > 0)
    .map((d) => ({
      time: new Date(d.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      fullTime: new Date(d.time).toLocaleString(),
      download: d.bytesRx,
      upload: d.bytesTx,
      total: d.bytesTotal,
    }));

  // Top 5 clients for pie chart
  const topClientsForChart = clientUsage.slice(0, 5).map((client, index) => ({
    name: client.clientName,
    value: client.bytesTotal,
    color: ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"][index],
  }));

  const timeRangeButtons = (
    <div className="flex gap-2">
      {(["1h", "24h", "7d"] as TimeRange[]).map((range) => (
        <button
          key={range}
          onClick={() => setTimeRange(range)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            timeRange === range
              ? "bg-purple-500/10 dark:bg-purple-500/20 text-white shadow-sm"
              : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
          }`}
        >
          {range === "1h" ? "1 Hour" : range === "24h" ? "24 Hours" : "7 Days"}
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={appName}
        description={`Application ID: ${applicationId}`}
        breadcrumb="Applications"
        breadcrumbHref="/applications"
        actions={timeRangeButtons}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-900/30">
              <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {formatBytes(totals.bytesTotal)}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Total Traffic</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10 dark:bg-green-900/30">
              <ArrowDown className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {formatBytes(totals.bytesRx)}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Downloaded</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-900/30">
              <ArrowUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {formatBytes(totals.bytesTx)}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Uploaded</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-900/30">
              <Laptop className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {clientUsage.length}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Clients</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 dark:bg-cyan-900/30">
              <Clock className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {formatDuration(totals.activitySeconds)}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Total Activity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--text-tertiary)]">Category:</span>
        <Badge variant="info">{categoryName}</Badge>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Over Time */}
        <div className="lg:col-span-2 bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Traffic Over Time
          </h3>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorDownload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorUpload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: chartColors.tickText, fontSize: 11 }}
                    stroke={chartColors.axisLine}
                  />
                  <YAxis
                    tickFormatter={(v) => formatBytes(v)}
                    tick={{ fill: chartColors.tickText, fontSize: 11 }}
                    stroke={chartColors.axisLine}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      border: `1px solid ${chartColors.tooltipBorder}`,
                      borderRadius: "8px",
                    }}
                    itemStyle={{ color: chartColors.tooltipText }}
                    labelStyle={{ color: chartColors.tooltipText }}
                    formatter={(value: number, name: string) => [
                      formatBytes(value),
                      name === "download" ? "Download" : "Upload",
                    ]}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullTime || label}
                  />
                  <Area
                    type="monotone"
                    dataKey="download"
                    stroke="#10b981"
                    fill="url(#colorDownload)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    stroke="#3b82f6"
                    fill="url(#colorUpload)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
                No historical data available
              </div>
            )}
          </div>
        </div>

        {/* Connection Type Breakdown */}
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Connection Type</h3>
          <div className="h-48">
            {connectionTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={connectionTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                  >
                    {connectionTypeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={chartColors.tooltipBg}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [formatBytes(value), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-muted)]">
                No data
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {connectionTypeData.map((item) => {
              const total = connectionTypeData.reduce((sum, d) => sum + d.value, 0);
              const percent = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name === "Wired" ? (
                      <Cable className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Wifi className="w-4 h-4 text-purple-500" />
                    )}
                    <span className="text-[var(--text-tertiary)]">{item.name}</span>
                    <span className="text-[var(--text-tertiary)]">({percent}%)</span>
                  </div>
                  <span className="text-[var(--text-primary)] font-medium">
                    {item.count} clients
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Clients Chart */}
      {topClientsForChart.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Top Clients by Usage
          </h3>
          <div className="flex items-start gap-6">
            <div className="w-40 h-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topClientsForChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={60}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {topClientsForChart.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={chartColors.tooltipBg}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatBytes(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 pt-2">
              {topClientsForChart.map((client) => {
                const total = topClientsForChart.reduce((sum, c) => sum + c.value, 0);
                const percent = total > 0 ? ((client.value / total) * 100).toFixed(0) : 0;
                return (
                  <div key={client.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: client.color }}
                      />
                      <span className="text-[var(--text-secondary)] truncate">{client.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                      <span className="text-[var(--text-tertiary)]">{percent}%</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {formatBytes(client.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Client Usage Table */}
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Client Usage Details
        </h3>
        <DataTable<ClientUsage>
          data={clientUsage}
          keyExtractor={(client) => client.clientMac}
          onRowClick={(client) => navigate(`/clients/${encodeURIComponent(client.clientMac)}`)}
          columns={[
            {
              key: "clientName",
              header: "Client",
              render: (client) => (
                <div className="flex items-center gap-2">
                  {client.isWired ? (
                    <Cable className="w-4 h-4 text-blue-500" />
                  ) : (
                    <Wifi className="w-4 h-4 text-purple-500" />
                  )}
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">
                      {client.clientName}
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">{client.clientMac}</div>
                  </div>
                </div>
              ),
            },
            {
              key: "bytesRx",
              header: "Download",
              sortValue: (client) => client.bytesRx,
              render: (client) => (
                <span className="text-emerald-600">{formatBytes(client.bytesRx)}</span>
              ),
            },
            {
              key: "bytesTx",
              header: "Upload",
              sortValue: (client) => client.bytesTx,
              render: (client) => (
                <span className="text-blue-600">{formatBytes(client.bytesTx)}</span>
              ),
            },
            {
              key: "bytesTotal",
              header: "Total",
              sortValue: (client) => client.bytesTotal,
              render: (client) => (
                <span className="font-medium text-[var(--text-primary)]">
                  {formatBytes(client.bytesTotal)}
                </span>
              ),
            },
            {
              key: "activitySeconds",
              header: "Activity Time",
              sortValue: (client) => client.activitySeconds,
              render: (client) => (
                <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <Clock className="w-3 h-3" />
                  {formatDuration(client.activitySeconds)}
                </div>
              ),
            },
            {
              key: "sessionCount",
              header: "Sessions",
              sortValue: (client) => client.sessionCount,
              render: (client) => (
                <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                  <Activity className="w-3 h-3" />
                  {client.sessionCount}
                </div>
              ),
            },
          ]}
          defaultSortKey="bytesTotal"
          defaultSortDir="desc"
          emptyMessage="No client data available for this application"
        />
      </div>
    </div>
  );
}
