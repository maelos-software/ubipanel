import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Wifi, AlertTriangle, Signal, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { getSignalQuality } from "@/lib/format";
import { useChartColors } from "@/hooks/useChartColors";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
} from "recharts";

export function ExperienceReport() {
  const navigate = useNavigate();
  const chartColors = useChartColors();
  const [filter, setFilter] = useState<"all" | "poor" | "weak" | "retries">("all");

  // Client experience data
  // NOTE: UnPoller field naming is counterintuitive:
  //   - "signal" field contains actual dBm values (negative, e.g., -65)
  //   - "rssi" field contains SNR/percentage values (positive, e.g., 35)
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["report-experience"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT LAST(satisfaction), LAST(signal), LAST(tx_retries)
        FROM clients
        WHERE time > now() - 1h AND is_wired = 'false'
        GROUP BY mac, "name", ap_name, channel
      `);
      const series = result.results[0]?.series || [];
      return series
        .map((s) => ({
          mac: s.tags?.mac || "",
          name: s.tags?.name || s.tags?.mac || "Unknown",
          satisfaction: (s.values[0][1] as number) || 0,
          rssi: (s.values[0][2] as number) || 0, // Actually dBm from "signal" field
          txRetries: (s.values[0][3] as number) || 0,
          apName: s.tags?.ap_name || "Unknown",
          channel: parseInt(s.tags?.channel || "0"),
        }))
        .filter((c) => c.rssi !== 0);
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const poorSatisfaction = clients.filter((c) => c.satisfaction > 0 && c.satisfaction < 70);
  const weakSignal = clients.filter((c) => c.rssi < -70);
  const highRetries = clients.filter((c) => c.txRetries > 100);

  const filteredClients = (() => {
    switch (filter) {
      case "poor":
        return poorSatisfaction;
      case "weak":
        return weakSignal;
      case "retries":
        return highRetries;
      default:
        return clients;
    }
  })();

  // Signal distribution
  const signalDistribution = [
    {
      range: "Excellent (> -50)",
      count: clients.filter((c) => c.rssi > -50).length,
      color: "#22c55e",
    },
    {
      range: "Good (-50 to -60)",
      count: clients.filter((c) => c.rssi <= -50 && c.rssi > -60).length,
      color: "#84cc16",
    },
    {
      range: "Fair (-60 to -70)",
      count: clients.filter((c) => c.rssi <= -60 && c.rssi > -70).length,
      color: "#eab308",
    },
    {
      range: "Poor (-70 to -80)",
      count: clients.filter((c) => c.rssi <= -70 && c.rssi > -80).length,
      color: "#f97316",
    },
    { range: "Bad (< -80)", count: clients.filter((c) => c.rssi <= -80).length, color: "#ef4444" },
  ];

  // Satisfaction distribution
  const satisfactionDistribution = [
    {
      range: "Excellent (90-100)",
      count: clients.filter((c) => c.satisfaction >= 90).length,
      color: "#22c55e",
    },
    {
      range: "Good (70-89)",
      count: clients.filter((c) => c.satisfaction >= 70 && c.satisfaction < 90).length,
      color: "#84cc16",
    },
    {
      range: "Fair (50-69)",
      count: clients.filter((c) => c.satisfaction >= 50 && c.satisfaction < 70).length,
      color: "#eab308",
    },
    {
      range: "Poor (< 50)",
      count: clients.filter((c) => c.satisfaction > 0 && c.satisfaction < 50).length,
      color: "#ef4444",
    },
    {
      range: "Unknown",
      count: clients.filter((c) => c.satisfaction === 0).length,
      color: "#9ca3af",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Wireless Experience"
        description="Analyze client signal quality, satisfaction, and connection issues"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "all"
              ? "bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Wifi className="w-4 h-4" />
            Total Wireless
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{clients.length}</div>
        </button>
        <button
          onClick={() => setFilter("poor")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "poor"
              ? "bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <AlertTriangle className="w-4 h-4" />
            Poor Satisfaction
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {poorSatisfaction.length}
          </div>
        </button>
        <button
          onClick={() => setFilter("weak")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "weak"
              ? "bg-red-100 dark:bg-red-900/40 ring-2 ring-red-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Signal className="w-4 h-4" />
            Weak Signal
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {weakSignal.length}
          </div>
        </button>
        <button
          onClick={() => setFilter("retries")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "retries"
              ? "bg-orange-100 dark:bg-orange-900/40 ring-2 ring-orange-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <RefreshCw className="w-4 h-4" />
            High Retries
          </div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {highRetries.length}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Signal vs Satisfaction Scatter */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Signal vs Satisfaction
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <XAxis
                  type="number"
                  dataKey="rssi"
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 12, fill: chartColors.tickText }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Signal (dBm)",
                    position: "bottom",
                    fontSize: 12,
                    fill: chartColors.tickText,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="satisfaction"
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: chartColors.tickText }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Satisfaction",
                    angle: -90,
                    position: "left",
                    fontSize: 12,
                    fill: chartColors.tickText,
                  }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as {
                      name: string;
                      rssi: number;
                      satisfaction: number;
                      apName: string;
                    };
                    return (
                      <div
                        className="rounded-lg shadow-lg px-3 py-2 text-sm"
                        style={{
                          backgroundColor: chartColors.tooltipBg,
                          border: `1px solid ${chartColors.tooltipBorder}`,
                          color: chartColors.tooltipText,
                        }}
                      >
                        <div className="font-medium">{data.name}</div>
                        <div style={{ color: chartColors.tooltipTextMuted }} className="mt-1">
                          Signal: {data.rssi} dBm
                        </div>
                        <div style={{ color: chartColors.tooltipTextMuted }}>
                          Satisfaction: {data.satisfaction}%
                        </div>
                        <div style={{ color: chartColors.tooltipTextMuted }}>AP: {data.apName}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={filteredClients.filter((c) => c.satisfaction > 0)}>
                  {filteredClients
                    .filter((c) => c.satisfaction > 0)
                    .map((client, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          client.satisfaction >= 70
                            ? "#22c55e"
                            : client.satisfaction >= 50
                              ? "#eab308"
                              : "#ef4444"
                        }
                        opacity={0.7}
                      />
                    ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Charts */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Signal Distribution
          </h2>
          <div className="h-32 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signalDistribution} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="range"
                  tick={{ fontSize: 11, fill: chartColors.tickText }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {signalDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Satisfaction Distribution
          </h2>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={satisfactionDistribution} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="range"
                  tick={{ fontSize: 11, fill: chartColors.tickText }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {satisfactionDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          {filter === "all"
            ? "All Wireless Clients"
            : filter === "poor"
              ? "Clients with Poor Satisfaction"
              : filter === "weak"
                ? "Clients with Weak Signal"
                : "Clients with High Retries"}
          <span className="text-sm font-normal text-[var(--text-tertiary)] ml-2">
            ({filteredClients.length})
          </span>
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
            Loading...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
            No clients match this filter
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                  <th className="pb-3 pr-4">Client</th>
                  <th className="pb-3 pr-4">Signal</th>
                  <th className="pb-3 pr-4">Satisfaction</th>
                  <th className="pb-3 pr-4">TX Retries</th>
                  <th className="pb-3 pr-4">Access Point</th>
                  <th className="pb-3">Channel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {filteredClients
                  .sort((a, b) => a.satisfaction - b.satisfaction)
                  .slice(0, 50)
                  .map((client, idx) => {
                    const signal = getSignalQuality(client.rssi);
                    return (
                      <tr
                        key={`${client.mac}-${client.apName}-${client.channel}-${idx}`}
                        onClick={() => navigate(`/clients/${encodeURIComponent(client.mac)}`)}
                        className="hover:bg-[var(--bg-tertiary)] cursor-pointer"
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium text-[var(--text-primary)]">
                            {client.name}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)] font-mono">
                            {client.mac}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`font-medium ${signal.color}`}>{client.rssi} dBm</span>
                        </td>
                        <td className="py-3 pr-4">
                          {client.satisfaction > 0 ? (
                            <Badge
                              variant={
                                client.satisfaction >= 70
                                  ? "success"
                                  : client.satisfaction >= 50
                                    ? "warning"
                                    : "error"
                              }
                            >
                              {client.satisfaction}%
                            </Badge>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={
                              client.txRetries > 100
                                ? "text-orange-600 font-medium"
                                : "text-[var(--text-tertiary)]"
                            }
                          >
                            {client.txRetries.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-sm text-[var(--text-tertiary)]">
                          {client.apName}
                        </td>
                        <td className="py-3 text-sm text-[var(--text-tertiary)]">
                          {client.channel}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
