import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Wifi, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { formatBytes, formatBytesRate, formatUptime } from "@/lib/format";
import { useGuestBandwidthTrend } from "@/hooks/useBandwidth";
import { useChartColors } from "@/hooks/useChartColors";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function GuestReport() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("24h");
  const chartColors = useChartColors();

  // Current guest clients
  const { data: guests = [], isLoading } = useQuery({
    queryKey: ["report-guests-current"],
    queryFn: async () => {
      // Query 1: Get current guest state
      const currentResult = await queryInflux(`
        SELECT LAST(uptime), LAST(ip)
        FROM clients
        WHERE time > now() - 5m AND is_guest = 'true'
        GROUP BY mac, "name", ap_name, essid
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST (24h)
      // Guests are always wireless, so use rx_bytes/tx_bytes
      const trafficResult = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM clients
        WHERE time > now() - 24h AND is_guest = 'true'
        GROUP BY mac
      `);

      // Build traffic map
      const trafficByMac = new Map<string, { rx: number; tx: number }>();
      for (const s of trafficResult.results?.[0]?.series || []) {
        const mac = s.tags?.mac || "";
        const cols = s.columns;
        const vals = s.values?.[0] || [];
        const getVal = (k: string) => {
          const idx = cols.indexOf(k);
          return idx >= 0 ? Math.max(0, (vals[idx] as number) || 0) : 0;
        };
        trafficByMac.set(mac, { rx: getVal("rx_bytes"), tx: getVal("tx_bytes") });
      }

      const series = currentResult.results[0]?.series || [];
      return series.map((s) => {
        const mac = s.tags?.mac || "";
        const traffic = trafficByMac.get(mac);
        return {
          mac,
          name: s.tags?.name || s.tags?.mac || "Unknown",
          ip: (s.values[0][2] as string) || "",
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          uptime: (s.values[0][1] as number) || 0,
          apName: s.tags?.ap_name || "Unknown",
          ssid: s.tags?.essid || "Unknown",
        };
      });
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Guest count over time
  const { data: guestTrend = [] } = useQuery({
    queryKey: ["report-guests-trend", timeRange],
    queryFn: async () => {
      const groupBy =
        timeRange === "1h" ? "2m" : timeRange === "24h" ? "30m" : timeRange === "7d" ? "2h" : "6h";
      const result = await queryInflux(`
        SELECT COUNT(DISTINCT(mac)) AS count
        FROM clients
        WHERE time > now() - ${timeRange} AND is_guest = 'true'
        GROUP BY time(${groupBy})
      `);
      const series = result.results[0]?.series?.[0];
      if (!series) return [];
      return series.values
        .filter((v) => v[1] !== null)
        .map((v) => ({
          time: new Date(v[0] as string).getTime(),
          count: (v[1] as number) || 0,
        }));
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Guest bandwidth over time - uses MEAN per client then aggregates for accurate rates
  const { data: bandwidthTrend = [] } = useGuestBandwidthTrend(timeRange);

  const totalBandwidth = guests.reduce((sum, g) => sum + g.rxBytes + g.txBytes, 0);
  const avgSessionTime =
    guests.length > 0 ? guests.reduce((sum, g) => sum + g.uptime, 0) / guests.length : 0;
  const peakGuests = Math.max(...guestTrend.map((t) => t.count), 0);

  return (
    <div>
      <PageHeader
        title="Guest Network"
        description="Analyze guest network usage, client counts, and bandwidth consumption"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Time Range */}
      <div className="flex items-center gap-2 mb-6">
        {["1h", "24h", "7d", "30d"].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              timeRange === range
                ? "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300"
                : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)]"
            }`}
          >
            {range === "1h"
              ? "1 Hour"
              : range === "24h"
                ? "24 Hours"
                : range === "7d"
                  ? "7 Days"
                  : "30 Days"}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Users className="w-4 h-4" />
            Current Guests
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{guests.length}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Peak Guests</div>
          <div className="text-2xl font-bold text-pink-600 mt-1">{peakGuests}</div>
          <div className="text-xs text-[var(--text-tertiary)]">Last {timeRange}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Total Bandwidth</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {formatBytes(totalBandwidth)}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">Current guests</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Avg Session Time</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {formatUptime(avgSessionTime)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Guest Count Trend */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Guest Count</h2>
          <div className="h-48">
            {guestTrend.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <Users className="w-8 h-8 mb-2 opacity-50" />
                <p>No guest data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={guestTrend}>
                  <XAxis
                    dataKey="time"
                    tickFormatter={(t) => {
                      const d = new Date(t);
                      return timeRange === "1h" || timeRange === "24h"
                        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : d.toLocaleDateString([], { month: "short", day: "numeric" });
                    }}
                    tick={{ fontSize: 11, fill: chartColors.tickText }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: chartColors.tickText }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: chartColors.axisLine, strokeWidth: 1 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div
                          className="rounded-lg shadow-lg px-3 py-2 text-sm"
                          style={{
                            backgroundColor: chartColors.tooltipBg,
                            border: `1px solid ${chartColors.tooltipBorder}`,
                            color: chartColors.tooltipText,
                          }}
                        >
                          <div style={{ color: chartColors.tooltipTextMuted }} className="mb-1">
                            {label ? new Date(label).toLocaleString() : ""}
                          </div>
                          <div className="font-medium">{payload[0]?.value} guests</div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#ec4899"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bandwidth Trend */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Guest Bandwidth</h2>
          <div className="h-48">
            {bandwidthTrend.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
                <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
                <p>No bandwidth data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bandwidthTrend}>
                  <defs>
                    <linearGradient id="guestRxGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    tickFormatter={(t) => {
                      const d = new Date(t);
                      return timeRange === "1h" || timeRange === "24h"
                        ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : d.toLocaleDateString([], { month: "short", day: "numeric" });
                    }}
                    tick={{ fontSize: 11, fill: chartColors.tickText }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatBytesRate(v)}
                    tick={{ fontSize: 11, fill: chartColors.tickText }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    cursor={{ stroke: chartColors.axisLine, strokeWidth: 1 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div
                          className="rounded-lg shadow-lg px-3 py-2 text-sm"
                          style={{
                            backgroundColor: chartColors.tooltipBg,
                            border: `1px solid ${chartColors.tooltipBorder}`,
                            color: chartColors.tooltipText,
                          }}
                        >
                          <div style={{ color: chartColors.tooltipTextMuted }} className="mb-1">
                            {label ? new Date(label).toLocaleString() : ""}
                          </div>
                          <div>Upload: {formatBytesRate(payload[0]?.value as number)}</div>
                          <div>Download: {formatBytesRate(payload[1]?.value as number)}</div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rx"
                    stroke="#ec4899"
                    fill="url(#guestRxGrad)"
                    strokeWidth={2}
                  />
                  <Area type="monotone" dataKey="tx" stroke="#8b5cf6" fill="none" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Current Guests Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Current Guest Clients
          <span className="text-sm font-normal text-[var(--text-tertiary)] ml-2">
            ({guests.length})
          </span>
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
            Loading...
          </div>
        ) : guests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)]">
            <Wifi className="w-8 h-8 mb-2 opacity-50" />
            <p>No guests currently connected</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                  <th className="pb-3 pr-4">Client</th>
                  <th className="pb-3 pr-4">IP Address</th>
                  <th className="pb-3 pr-4">SSID</th>
                  <th className="pb-3 pr-4">Access Point</th>
                  <th className="pb-3 pr-4">Session Time</th>
                  <th className="pb-3">Bandwidth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {guests
                  .sort((a, b) => b.rxBytes + b.txBytes - (a.rxBytes + a.txBytes))
                  .map((guest, idx) => (
                    <tr
                      key={`${guest.mac}-${guest.apName}-${guest.ssid}-${idx}`}
                      onClick={() => navigate(`/clients/${encodeURIComponent(guest.mac)}`)}
                      className="hover:bg-[var(--bg-tertiary)] cursor-pointer"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[var(--text-primary)]">{guest.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)] font-mono">
                          {guest.mac}
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-sm text-[var(--text-tertiary)]">
                        {guest.ip || "—"}
                      </td>
                      <td className="py-3 pr-4 text-sm text-[var(--text-tertiary)]">
                        {guest.ssid}
                      </td>
                      <td className="py-3 pr-4 text-sm text-[var(--text-tertiary)]">
                        {guest.apName}
                      </td>
                      <td className="py-3 pr-4 text-sm text-[var(--text-tertiary)]">
                        {formatUptime(guest.uptime)}
                      </td>
                      <td className="py-3 text-sm text-[var(--text-primary)] font-medium">
                        {formatBytes(guest.rxBytes + guest.txBytes)}
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
