import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { useChartColors } from "@/hooks/useChartColors";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface RoamingClient {
  mac: string;
  name: string;
  roamCount: number;
  apName: string;
}

export function RoamingReport() {
  const navigate = useNavigate();
  const chartColors = useChartColors();

  // All wireless clients with roam data
  const { data: allClients = [], isLoading } = useQuery({
    queryKey: ["report-roaming"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT MAX(roam_count)
        FROM clients
        WHERE time > now() - 24h AND is_wired = 'false'
        GROUP BY mac, "name", ap_name
      `);
      const series = result.results[0]?.series || [];
      return series
        .map((s) => ({
          mac: s.tags?.mac || "",
          name: s.tags?.name || s.tags?.mac || "Unknown",
          roamCount: (s.values[0][1] as number) || 0,
          apName: s.tags?.ap_name || "Unknown",
        }))
        .sort((a, b) => b.roamCount - a.roamCount);
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Clients that actually roamed (for display purposes)
  const clients = allClients.filter((c) => c.roamCount > 0);

  // Roaming by AP (which APs do clients roam to/from most)
  const { data: apRoaming = [] } = useQuery({
    queryKey: ["report-roaming-by-ap"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT SUM(roam_count) AS roams
        FROM clients
        WHERE time > now() - 24h AND is_wired = 'false'
        GROUP BY ap_name
      `);
      const series = result.results[0]?.series || [];
      return series
        .map((s) => ({
          apName: s.tags?.ap_name || "Unknown",
          roams: (s.values[0][1] as number) || 0,
        }))
        .filter((a) => a.roams > 0)
        .sort((a, b) => b.roams - a.roams);
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const highRoamers = clients.filter((c) => c.roamCount > 10);
  const totalRoams = allClients.reduce((sum, c) => sum + c.roamCount, 0);
  const totalWirelessClients = allClients.length;

  const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6"];

  return (
    <div>
      <PageHeader
        title="Roaming Analysis"
        description="Identify clients that roam frequently between access points"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <ArrowRightLeft className="w-4 h-4" />
            Total Roams
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {totalRoams.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">Last 24 hours</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Wireless Clients</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {totalWirelessClients}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            {clients.length} roamed at least once
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">High Roamers</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{highRoamers.length}</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">&gt; 10 roams/day</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Avg Roams/Client</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {totalWirelessClients > 0 ? (totalRoams / totalWirelessClients).toFixed(1) : "0"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">All wireless clients</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Roaming by AP */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Roaming by AP</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={apRoaming.slice(0, 8)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="apName"
                  tick={{ fontSize: 11, fill: chartColors.tickText }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  cursor={{ fill: chartColors.grid, opacity: 0.2 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div
                        className="rounded-lg shadow-lg px-3 py-2 text-sm"
                        style={{
                          backgroundColor: chartColors.tooltipBg,
                          border: `1px solid ${chartColors.tooltipBorder}`,
                          color: chartColors.tooltipText,
                        }}
                      >
                        <div className="font-medium">{data.apName}</div>
                        <div style={{ color: chartColors.tooltipTextMuted }} className="mt-1">
                          {data.roams} roams
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="roams" radius={[0, 4, 4, 0]}>
                  {apRoaming.slice(0, 8).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-4">
            High roam counts on specific APs may indicate coverage overlap or interference issues.
          </p>
        </div>

        {/* Roaming Distribution */}
        <div className="lg:col-span-2 bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Roaming Distribution
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clients.slice(0, 20)}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: chartColors.tickText }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: chartColors.tickText }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: chartColors.grid, opacity: 0.2 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload as RoamingClient;
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
                          {data.roamCount} roams
                        </div>
                        <div style={{ color: chartColors.tooltipTextMuted }}>
                          Current AP: {data.apName}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="roamCount" radius={[4, 4, 0, 0]}>
                  {clients.slice(0, 20).map((client, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        client.roamCount > 10
                          ? "#f59e0b"
                          : client.roamCount > 5
                            ? "#8b5cf6"
                            : "#3b82f6"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500/10 dark:bg-amber-500/20" />
              <span className="text-xs text-[var(--text-tertiary)]">High (&gt;10)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500/10 dark:bg-purple-500/20" />
              <span className="text-xs text-[var(--text-tertiary)]">Moderate (5-10)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500/10 dark:bg-blue-500/20" />
              <span className="text-xs text-[var(--text-tertiary)]">Normal (&lt;5)</span>
            </div>
          </div>
        </div>
      </div>

      {/* High Roaming Clients Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          High Roaming Clients
          <span className="text-sm font-normal text-[var(--text-tertiary)] ml-2">
            ({highRoamers.length} clients with &gt;10 roams)
          </span>
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
            Loading...
          </div>
        ) : highRoamers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
            <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
            <p>No high-roaming clients detected</p>
            <p className="text-xs mt-1">This is a good sign - your coverage is stable</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                  <th className="pb-3 pr-4">Client</th>
                  <th className="pb-3 pr-4">Roam Count</th>
                  <th className="pb-3 pr-4">Current AP</th>
                  <th className="pb-3">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {highRoamers.map((client, idx) => (
                  <tr
                    key={`${client.mac}-${client.apName}-${idx}`}
                    onClick={() => navigate(`/clients/${encodeURIComponent(client.mac)}`)}
                    className="hover:bg-[var(--bg-tertiary)] cursor-pointer"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-[var(--text-primary)]">{client.name}</div>
                      <div className="text-xs text-[var(--text-tertiary)] font-mono">
                        {client.mac}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
                        <ArrowRightLeft className="w-3 h-3" />
                        {client.roamCount}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-sm text-[var(--text-tertiary)]">
                      {client.apName}
                    </td>
                    <td className="py-3 text-sm text-[var(--text-tertiary)]">
                      {client.roamCount > 50
                        ? "Check for coverage gaps or interference"
                        : client.roamCount > 20
                          ? "May be mobile device moving frequently"
                          : "Monitor for pattern changes"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
