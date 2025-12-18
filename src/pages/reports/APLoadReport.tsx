import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Wifi } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export function APLoadReport() {
  const navigate = useNavigate();

  // AP Load data
  const { data: aps = [], isLoading } = useQuery({
    queryKey: ["report-ap-load"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT LAST(num_sta), LAST("guest-num_sta"), LAST("user-num_sta")
        FROM uap
        WHERE time > now() - 5m
        GROUP BY "name", mac
      `);
      const series = result.results[0]?.series || [];
      return series
        .map((s) => ({
          name: s.tags?.name || "Unknown",
          mac: s.tags?.mac || "",
          numSta: (s.values[0][1] as number) || 0,
          guestSta: (s.values[0][2] as number) || 0,
          userSta: (s.values[0][3] as number) || 0,
          cuTotal: 0,
        }))
        .sort((a, b) => b.numSta - a.numSta);
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Channel utilization over time - per band (aggregated across all APs)
  const { data: channelUtilData } = useQuery({
    queryKey: ["report-ap-channel-util-history"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT MEAN(cu_total) AS cu
        FROM uap_radios
        WHERE time > now() - 24h
        GROUP BY time(1h), radio
      `);
      const allSeries = result.results[0]?.series || [];

      // Map radio tags to friendly band names
      const radioToBand: Record<string, string> = {
        ng: "2.4 GHz",
        na: "5 GHz",
        "6e": "6 GHz",
      };

      // Build time series data with each band as a separate key
      const timeMap = new Map<number, Record<string, number>>();
      const bands = new Set<string>();

      for (const series of allSeries) {
        const radioTag = series.tags?.radio || "";
        const bandName = radioToBand[radioTag] || radioTag;
        if (!bandName) continue;
        bands.add(bandName);

        for (const [timestamp, cu] of series.values) {
          if (cu === null) continue;
          const time = new Date(timestamp as string).getTime();
          const existing = timeMap.get(time) || { time };
          existing[bandName] = Math.round(cu as number);
          timeMap.set(time, existing);
        }
      }

      const data = Array.from(timeMap.values()).sort(
        (a, b) => (a.time as number) - (b.time as number)
      );
      // Sort bands in logical order: 2.4, 5, 6 GHz
      const bandOrder = ["2.4 GHz", "5 GHz", "6 GHz"];
      const names = Array.from(bands).sort((a, b) => bandOrder.indexOf(a) - bandOrder.indexOf(b));

      return { data, bands: names };
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const channelUtilChartData = channelUtilData?.data || [];
  const channelUtilBands = channelUtilData?.bands || [];

  // Client trend over time - per AP
  const { data: trendData } = useQuery({
    queryKey: ["report-ap-trend"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT MEAN(num_sta) AS clients
        FROM uap
        WHERE time > now() - 24h
        GROUP BY time(1h), "name"
      `);
      const allSeries = result.results[0]?.series || [];

      // Build time series data with each AP as a separate key
      const timeMap = new Map<number, Record<string, number>>();
      const apNames = new Set<string>();

      for (const series of allSeries) {
        const apName = series.tags?.name || "Unknown";
        apNames.add(apName);

        for (const [timestamp, clients] of series.values) {
          if (clients === null) continue;
          const time = new Date(timestamp as string).getTime();
          const existing = timeMap.get(time) || { time };
          existing[apName] = Math.round(clients as number);
          // Also compute total
          existing.total = (existing.total || 0) + Math.round(clients as number);
          timeMap.set(time, existing);
        }
      }

      const data = Array.from(timeMap.values()).sort(
        (a, b) => (a.time as number) - (b.time as number)
      );
      const names = Array.from(apNames).sort();

      return { data, apNames: names };
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const chartData = trendData?.data || [];
  const apNames = trendData?.apNames || [];

  const totalClients = aps.reduce((sum, ap) => sum + ap.numSta, 0);
  const avgPerAP = aps.length > 0 ? totalClients / aps.length : 0;
  const maxAP = aps[0];

  const COLORS = ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6", "#22c55e"];

  return (
    <div>
      <PageHeader
        title="AP Load Distribution"
        description="Analyze client distribution and channel utilization across access points"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Users className="w-4 h-4" />
            Total Clients
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{totalClients}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Access Points</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{aps.length}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Avg Clients/AP</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {avgPerAP.toFixed(1)}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Busiest AP</div>
          <div className="text-xl font-bold text-[var(--text-primary)] mt-1 truncate">
            {maxAP?.name || "—"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">{maxAP?.numSta || 0} clients</div>
        </div>
      </div>

      {/* Client Trend */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Client Count by AP (24h)
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="time"
                tickFormatter={(t) =>
                  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                      <div className="text-gray-400 mb-2">
                        {label ? new Date(label).toLocaleString() : ""}
                      </div>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-gray-300">{entry.name}:</span>
                          <span className="font-medium">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {/* Total line - dashed */}
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
              {/* Individual AP lines */}
              {apNames.map((name, idx) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-gray-400" style={{ borderStyle: "dashed" }} />
            <span className="text-xs text-[var(--text-tertiary)]">Total</span>
          </div>
          {apNames.map((name, idx) => (
            <div key={name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-xs text-[var(--text-tertiary)]">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Channel Utilization Trend */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Channel Utilization by Band (24h)
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={channelUtilChartData}>
              <XAxis
                dataKey="time"
                tickFormatter={(t) =>
                  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                      <div className="text-gray-400 mb-2">
                        {label ? new Date(label).toLocaleString() : ""}
                      </div>
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-gray-300">{entry.name}:</span>
                          <span className="font-medium">{entry.value}%</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {/* Per-band lines */}
              {channelUtilBands.map((band, idx) => (
                <Line
                  key={band}
                  type="monotone"
                  dataKey={band}
                  name={band}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
          {channelUtilBands.map((band, idx) => (
            <div key={band} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-xs text-[var(--text-tertiary)]">{band}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AP Details Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Access Point Details
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                  <th className="pb-3 pr-4">Access Point</th>
                  <th className="pb-3 pr-4">Total Clients</th>
                  <th className="pb-3 pr-4">Users</th>
                  <th className="pb-3 pr-4">Guests</th>
                  <th className="pb-3">Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {aps.map((ap) => (
                  <tr
                    key={ap.mac}
                    onClick={() => navigate(`/access-points/${encodeURIComponent(ap.mac)}`)}
                    className="hover:bg-[var(--bg-tertiary)] cursor-pointer"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-[var(--text-primary)]">{ap.name}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-[var(--text-primary)]">
                      {ap.numSta}
                    </td>
                    <td className="py-3 pr-4 text-[var(--text-tertiary)]">{ap.userSta}</td>
                    <td className="py-3 pr-4 text-[var(--text-tertiary)]">{ap.guestSta}</td>
                    <td className="py-3">
                      <Badge
                        variant={ap.numSta > 30 ? "warning" : ap.numSta > 20 ? "info" : "success"}
                      >
                        {ap.numSta > 30 ? "High" : ap.numSta > 20 ? "Moderate" : "Normal"}
                      </Badge>
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
