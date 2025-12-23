import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Zap, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { formatBytesRate } from "@/lib/format";
import { useChartColors } from "@/hooks/useChartColors";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function PortHealthReport() {
  const navigate = useNavigate();
  const chartColors = useChartColors();
  const [filter, setFilter] = useState<"all" | "errors" | "drops" | "poe">("all");

  // Port health data - use rate fields for current throughput
  // Get both current values and calculate new errors in last 24h
  const { data: ports = [], isLoading } = useQuery({
    queryKey: ["report-port-health"],
    queryFn: async () => {
      // Get current stats
      const currentResult = await queryInflux(`
        SELECT LAST(rx_errors), LAST(tx_errors),
               LAST(rx_dropped), LAST(tx_dropped),
               LAST("rx_bytes-r"), LAST("tx_bytes-r"),
               LAST(poe_power), LAST(speed)
        FROM usw_ports
        WHERE time > now() - 5m
        GROUP BY device_name, port_idx, port_name
      `);

      // Get first/last errors and drops to calculate new values in 24h
      const deltaResult = await queryInflux(`
        SELECT FIRST(rx_errors), LAST(rx_errors), FIRST(tx_errors), LAST(tx_errors),
               FIRST(rx_dropped), LAST(rx_dropped), FIRST(tx_dropped), LAST(tx_dropped)
        FROM usw_ports
        WHERE time > now() - 24h
        GROUP BY device_name, port_idx
      `);

      // Build maps of new errors and drops per port
      const errorDeltas: Record<string, number> = {};
      const dropDeltas: Record<string, number> = {};
      for (const s of deltaResult.results[0]?.series || []) {
        const key = `${s.tags?.device_name}-${s.tags?.port_idx}`;
        const rxErrDelta = Math.max(
          0,
          ((s.values[0][2] as number) || 0) - ((s.values[0][1] as number) || 0)
        );
        const txErrDelta = Math.max(
          0,
          ((s.values[0][4] as number) || 0) - ((s.values[0][3] as number) || 0)
        );
        errorDeltas[key] = rxErrDelta + txErrDelta;

        const rxDropDelta = Math.max(
          0,
          ((s.values[0][6] as number) || 0) - ((s.values[0][5] as number) || 0)
        );
        const txDropDelta = Math.max(
          0,
          ((s.values[0][8] as number) || 0) - ((s.values[0][7] as number) || 0)
        );
        dropDeltas[key] = rxDropDelta + txDropDelta;
      }

      const series = currentResult.results[0]?.series || [];
      return series
        .map((s) => {
          const key = `${s.tags?.device_name}-${s.tags?.port_idx}`;
          return {
            swName: s.tags?.device_name || "Unknown",
            portIdx: parseInt(s.tags?.port_idx || "0"),
            portName: s.tags?.port_name || `Port ${s.tags?.port_idx}`,
            rxErrors: (s.values[0][1] as number) || 0,
            txErrors: (s.values[0][2] as number) || 0,
            newErrors: errorDeltas[key] || 0, // New errors in last 24h
            rxDropped: (s.values[0][3] as number) || 0,
            txDropped: (s.values[0][4] as number) || 0,
            newDrops: dropDeltas[key] || 0, // New drops in last 24h
            rxRate: (s.values[0][5] as number) || 0,
            txRate: (s.values[0][6] as number) || 0,
            poeWatts: (s.values[0][7] as number) || 0,
            speed: (s.values[0][8] as number) || 0,
          };
        })
        .filter((p) => p.speed > 0); // Only active ports
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // New errors in last 24h (using DIFFERENCE to get delta, not cumulative)
  const { data: errorTrend = [] } = useQuery({
    queryKey: ["report-port-error-trend"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT DIFFERENCE(LAST(rx_errors)) + DIFFERENCE(LAST(tx_errors))
        FROM usw_ports
        WHERE time > now() - 24h
        GROUP BY time(1h)
      `);
      const series = result.results[0]?.series?.[0];
      if (!series) return [];
      return series.values
        .filter((v) => v[1] !== null)
        .map((v) => ({
          time: new Date(v[0] as string).getTime(),
          // Ignore negative values (counter resets)
          errors: Math.max(0, (v[1] as number) || 0),
        }));
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const portsWithErrors = ports.filter((p) => p.newErrors > 0);
  const portsWithDrops = ports.filter((p) => p.newDrops > 0);
  const poePorts = ports.filter((p) => p.poeWatts > 0);
  const totalNewErrors = ports.reduce((sum, p) => sum + p.newErrors, 0);
  const totalNewDrops = ports.reduce((sum, p) => sum + p.newDrops, 0);
  const totalPoe = poePorts.reduce((sum, p) => sum + p.poeWatts, 0);

  const filteredPorts = (() => {
    switch (filter) {
      case "errors":
        return portsWithErrors.sort((a, b) => b.newErrors - a.newErrors);
      case "drops":
        return portsWithDrops.sort((a, b) => b.newDrops - a.newDrops);
      case "poe":
        return poePorts.sort((a, b) => b.poeWatts - a.poeWatts);
      default:
        return ports.sort((a, b) => b.rxRate + b.txRate - (a.rxRate + a.txRate));
    }
  })();

  // Group NEW errors (last 24h) by switch
  const errorsBySwitch = ports.reduce(
    (acc, port) => {
      if (port.newErrors > 0) {
        acc[port.swName] = (acc[port.swName] || 0) + port.newErrors;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  // Group NEW drops (last 24h) by switch
  const dropsBySwitch = ports.reduce(
    (acc, port) => {
      if (port.newDrops > 0) {
        acc[port.swName] = (acc[port.swName] || 0) + port.newDrops;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  const switchErrorData = Object.entries(errorsBySwitch)
    .map(([name, errors]) => ({ name, errors }))
    .sort((a, b) => b.errors - a.errors);

  const switchDropData = Object.entries(dropsBySwitch)
    .map(([name, drops]) => ({ name, drops }))
    .sort((a, b) => b.drops - a.drops);

  return (
    <div>
      <PageHeader
        title="Switch Port Health"
        description="Find ports with errors, drops, or unusual traffic patterns"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "all"
              ? "bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="text-sm text-[var(--text-tertiary)]">Active Ports</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{ports.length}</div>
        </button>
        <button
          onClick={() => setFilter("errors")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "errors"
              ? "bg-red-100 dark:bg-red-900/40 ring-2 ring-red-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <AlertTriangle className="w-4 h-4" />
            Errors (24h)
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {portsWithErrors.length}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {totalNewErrors.toLocaleString()} total
          </div>
        </button>
        <button
          onClick={() => setFilter("drops")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "drops"
              ? "bg-orange-100 dark:bg-orange-900/40 ring-2 ring-orange-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <AlertTriangle className="w-4 h-4" />
            Drops (24h)
          </div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {portsWithDrops.length}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {totalNewDrops.toLocaleString()} total
          </div>
        </button>
        <button
          onClick={() => setFilter("poe")}
          className={`text-left p-4 rounded-xl transition-all ${
            filter === "poe"
              ? "bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-500"
              : "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-gray-200 dark:hover:ring-slate-700"
          }`}
        >
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Zap className="w-4 h-4" />
            PoE Ports
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {poePorts.length}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">{totalPoe.toFixed(1)}W total</div>
        </button>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">Throughput</div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {formatBytesRate(ports.reduce((sum, p) => sum + p.rxRate + p.txRate, 0))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Error Trend */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Error Trend (24h)
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorTrend}>
                <XAxis
                  dataKey="time"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit" })}
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
                  cursor={{ fill: chartColors.grid, opacity: 0.2 }}
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
                        <div style={{ color: chartColors.tooltipTextMuted }}>
                          {label ? new Date(label).toLocaleString() : ""}
                        </div>
                        <div className="font-medium">
                          {payload[0]?.value?.toLocaleString()} errors
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Errors & Drops by Switch */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Issues by Switch (24h)
          </h2>
          {switchErrorData.length === 0 && switchDropData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)]">
              <TrendingUp className="w-8 h-8 mb-2 opacity-50" />
              <p>No errors or drops detected</p>
            </div>
          ) : (
            <div className="space-y-4">
              {switchErrorData.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">
                    Errors
                  </div>
                  {switchErrorData.map((sw) => (
                    <div key={sw.name} className="flex items-center justify-between py-1">
                      <span className="text-sm text-[var(--text-tertiary)] truncate">
                        {sw.name}
                      </span>
                      <span className="text-sm font-medium text-red-600">
                        {sw.errors.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {switchDropData.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2">
                    Drops
                  </div>
                  {switchDropData.slice(0, 5).map((sw) => (
                    <div key={sw.name} className="flex items-center justify-between py-1">
                      <span className="text-sm text-[var(--text-tertiary)] truncate">
                        {sw.name}
                      </span>
                      <span className="text-sm font-medium text-orange-600">
                        {sw.drops.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ports Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          {filter === "all"
            ? "All Active Ports"
            : filter === "errors"
              ? "Ports with Errors (24h)"
              : filter === "drops"
                ? "Ports with Drops (24h)"
                : "PoE Ports"}
          <span className="text-sm font-normal text-[var(--text-tertiary)] ml-2">
            ({filteredPorts.length})
          </span>
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
                  <th className="pb-3 pr-4">Switch / Port</th>
                  <th className="pb-3 pr-4">Speed</th>
                  <th className="pb-3 pr-4">Traffic</th>
                  <th className="pb-3 pr-4">Errors (24h)</th>
                  <th className="pb-3 pr-4">Drops (24h)</th>
                  {filter === "poe" && <th className="pb-3 pr-4">PoE Power</th>}
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {filteredPorts.slice(0, 50).map((port) => (
                  <tr
                    key={`${port.swName}-${port.portIdx}`}
                    onClick={() =>
                      navigate(`/switches/${encodeURIComponent(port.swName)}/port/${port.portIdx}`)
                    }
                    className="hover:bg-[var(--bg-tertiary)] cursor-pointer"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-[var(--text-primary)]">{port.swName}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">{port.portName}</div>
                    </td>
                    <td className="py-3 pr-4 text-sm text-[var(--text-tertiary)]">
                      {port.speed >= 1000 ? `${port.speed / 1000}G` : `${port.speed}M`}
                    </td>
                    <td className="py-3 pr-4 text-sm text-[var(--text-tertiary)]">
                      {formatBytesRate(port.rxRate + port.txRate)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          port.newErrors > 0
                            ? "text-red-600 font-medium"
                            : "text-[var(--text-muted)]"
                        }
                      >
                        {port.newErrors.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          port.newDrops > 0
                            ? "text-orange-600 font-medium"
                            : "text-[var(--text-muted)]"
                        }
                      >
                        {port.newDrops.toLocaleString()}
                      </span>
                    </td>
                    {filter === "poe" && (
                      <td className="py-3 pr-4 text-sm font-medium text-amber-600">
                        {port.poeWatts.toFixed(1)}W
                      </td>
                    )}
                    <td className="py-3">
                      <Badge
                        variant={
                          port.newErrors > 100 || port.newDrops > 1000
                            ? "error"
                            : port.newErrors > 0 || port.newDrops > 0
                              ? "warning"
                              : "success"
                        }
                      >
                        {port.newErrors > 100 || port.newDrops > 1000
                          ? "Issues"
                          : port.newErrors > 0 || port.newDrops > 0
                            ? "Warnings"
                            : "Healthy"}
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
