import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, CheckCircle, XCircle, RefreshCw, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { formatBytes, formatBytesRate } from "@/lib/format";
import { useWANBandwidthTrend } from "@/hooks/useBandwidth";
import { formatDistanceToNow } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface WANEvent {
  time: string;
  msg: string;
  iface: string;
  state: string;
}

export function WANHealthReport() {
  const [timeRange, setTimeRange] = useState("7d");

  // WAN ports status
  const { data: wanPorts = [] } = useQuery({
    queryKey: ["report-wan-ports"],
    queryFn: async () => {
      // Query 1: Get current WAN port state
      const currentResult = await queryInflux(`
        SELECT LAST("rx_bytes-r"), LAST("tx_bytes-r"),
               LAST(rx_errors), LAST(tx_errors)
        FROM usg_wan_ports
        WHERE time > now() - 5m
        GROUP BY ifname
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST (24h)
      const trafficResult = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM usg_wan_ports
        WHERE time > now() - 24h
        GROUP BY ifname
      `);

      // Build traffic map
      const trafficByIf = new Map<string, { rx: number; tx: number }>();
      for (const s of trafficResult.results?.[0]?.series || []) {
        const ifname = s.tags?.ifname || "";
        const cols = s.columns;
        const vals = s.values?.[0] || [];
        const getVal = (k: string) => {
          const idx = cols.indexOf(k);
          return idx >= 0 ? Math.max(0, (vals[idx] as number) || 0) : 0;
        };
        trafficByIf.set(ifname, { rx: getVal("rx_bytes"), tx: getVal("tx_bytes") });
      }

      const series = currentResult.results[0]?.series || [];
      return series.map((s) => {
        const ifname = s.tags?.ifname || "Unknown";
        const traffic = trafficByIf.get(ifname);
        return {
          name: ifname,
          rxBytes: traffic?.rx || 0,
          txBytes: traffic?.tx || 0,
          rxRate: (s.values[0][1] as number) || 0,
          txRate: (s.values[0][2] as number) || 0,
          rxErrors: (s.values[0][3] as number) || 0,
          txErrors: (s.values[0][4] as number) || 0,
        };
      });
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // WAN events
  const { data: events = [] } = useQuery({
    queryKey: ["report-wan-events", timeRange],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT time, msg FROM unifi_events 
        WHERE "key" = 'EVT_GW_WANTransition' AND time > now() - ${timeRange}
        ORDER BY time DESC
        LIMIT 100
      `);
      const series = result.results[0]?.series?.[0];
      if (!series) return [];
      return series.values.map((v) => {
        const msg = v[1] as string;
        const ifaceMatch = msg.match(/iface (\w+)/);
        const stateMatch = msg.match(/state (\w+)/);
        return {
          time: v[0] as string,
          msg,
          iface: ifaceMatch?.[1] || "Unknown",
          state: stateMatch?.[1] || "Unknown",
        };
      }) as WANEvent[];
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // WAN bandwidth history - uses MEAN per interface then aggregates for accurate rates
  const { data: bandwidthHistory = [] } = useWANBandwidthTrend(timeRange);

  const failovers = events.filter((e) => e.state === "failover").length;
  const inactive = events.filter((e) => e.state === "inactive").length;
  const active = events.filter((e) => e.state === "active").length;

  const getStateIcon = (state: string) => {
    switch (state) {
      case "active":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failover":
        return <RefreshCw className="w-4 h-4 text-amber-500" />;
      case "inactive":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-[var(--text-tertiary)]" />;
    }
  };

  return (
    <div>
      <PageHeader
        title="WAN Health"
        description="Monitor WAN uptime, failover events, and bandwidth utilization"
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
                ? "bg-amber-100 text-amber-700"
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
            <Globe className="w-4 h-4" />
            WAN Interfaces
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {wanPorts.length}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Failovers
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{failovers}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <XCircle className="w-4 h-4 text-red-500" />
            Outages
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">{inactive}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <CheckCircle className="w-4 h-4 text-green-500" />
            Recoveries
          </div>
          <div className="text-2xl font-bold text-green-600 mt-1">{active}</div>
        </div>
      </div>

      {/* WAN Bandwidth */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">WAN Bandwidth</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bandwidthHistory}>
              <defs>
                <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                      <div>Download: {formatBytesRate(payload[0]?.value as number)}</div>
                      <div>Upload: {formatBytesRate(payload[1]?.value as number)}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="rx"
                stroke="#f59e0b"
                fill="url(#rxGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="tx"
                stroke="#3b82f6"
                fill="url(#txGrad)"
                strokeWidth={2}
              />
              {/* Event markers - grouped by time bucket to avoid overlap */}
              {(() => {
                const chartStart = bandwidthHistory[0]?.time;
                const chartEnd = bandwidthHistory[bandwidthHistory.length - 1]?.time;
                if (!chartStart || !chartEnd) return null;

                // Group events by their closest chart time bucket
                const eventGroups = new Map<number, WANEvent[]>();
                for (const event of events) {
                  const eventTime = new Date(event.time).getTime();
                  if (eventTime < chartStart || eventTime > chartEnd) continue;

                  // Find closest data point
                  let closestTime = chartStart;
                  let minDiff = Math.abs(eventTime - chartStart);
                  for (const point of bandwidthHistory) {
                    const diff = Math.abs(eventTime - point.time);
                    if (diff < minDiff) {
                      minDiff = diff;
                      closestTime = point.time;
                    }
                  }

                  if (!eventGroups.has(closestTime)) {
                    eventGroups.set(closestTime, []);
                  }
                  eventGroups.get(closestTime)!.push(event);
                }

                return Array.from(eventGroups.entries()).map(([time, groupEvents]) => {
                  // Determine dominant event type for color
                  const hasOutage = groupEvents.some((e) => e.state === "inactive");
                  const hasFailover = groupEvents.some((e) => e.state === "failover");
                  const color = hasOutage ? "#ef4444" : hasFailover ? "#f59e0b" : "#22c55e";

                  // Build tooltip content
                  const tooltipLines = groupEvents
                    .map((e) => `${e.iface}: ${e.state} @ ${new Date(e.time).toLocaleTimeString()}`)
                    .join("\n");

                  return (
                    <ReferenceLine
                      key={time}
                      x={time}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      label={({ viewBox }) => {
                        const x = viewBox?.x ?? 0;
                        const count = groupEvents.length;
                        return (
                          <g style={{ cursor: "pointer" }}>
                            <title>{tooltipLines}</title>
                            <circle
                              cx={x}
                              cy={14}
                              r={count > 1 ? 12 : 10}
                              fill={color}
                              opacity={0.15}
                            />
                            <circle
                              cx={x}
                              cy={14}
                              r={count > 1 ? 12 : 10}
                              fill="none"
                              stroke={color}
                              strokeWidth={1.5}
                            />
                            {count > 1 ? (
                              <text
                                x={x}
                                y={18}
                                textAnchor="middle"
                                fill={color}
                                fontSize={11}
                                fontWeight="bold"
                              >
                                {count}
                              </text>
                            ) : (
                              <text
                                x={x}
                                y={18}
                                textAnchor="middle"
                                fill={color}
                                fontSize={12}
                                fontWeight="bold"
                              >
                                {groupEvents[0].state === "failover"
                                  ? "⚡"
                                  : groupEvents[0].state === "inactive"
                                    ? "✕"
                                    : "✓"}
                              </text>
                            )}
                          </g>
                        );
                      }}
                    />
                  );
                });
              })()}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {/* Chart Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-amber-500/10 dark:bg-amber-500/200" />
            <span className="text-xs text-[var(--text-tertiary)]">Download</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500/10 dark:bg-blue-500/200" />
            <span className="text-xs text-[var(--text-tertiary)]">Upload</span>
          </div>
          {events.length > 0 && (
            <>
              <div className="w-px h-4 bg-[var(--bg-tertiary)]" />
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                <span className="text-xs text-[var(--text-tertiary)]">Failover</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-red-500" />
                <span className="text-xs text-[var(--text-tertiary)]">Outage</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-green-500" />
                <span className="text-xs text-[var(--text-tertiary)]">Recovery</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WAN Ports Status */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">WAN Interfaces</h2>
          <div className="space-y-4">
            {wanPorts.map((port) => (
              <div key={port.name} className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[var(--text-primary)]">{port.name}</span>
                  <Badge variant="success">Active</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-tertiary)]">Current Rate</span>
                    <div className="font-medium">
                      ↓ {formatBytesRate(port.rxRate)} / ↑ {formatBytesRate(port.txRate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Total Transfer</span>
                    <div className="font-medium">{formatBytes(port.rxBytes + port.txBytes)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">RX Errors</span>
                    <div className={port.rxErrors > 0 ? "font-medium text-red-600" : "font-medium"}>
                      {port.rxErrors.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">TX Errors</span>
                    <div className={port.txErrors > 0 ? "font-medium text-red-600" : "font-medium"}>
                      {port.txErrors.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Recent WAN Events
            <span className="text-sm font-normal text-[var(--text-tertiary)] ml-2">
              ({events.length})
            </span>
          </h2>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)]">
              <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
              <p>No WAN events in this period</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.slice(0, 30).map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--bg-tertiary)]"
                >
                  {getStateIcon(event.state)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{event.iface}</span>
                      <Badge
                        variant={
                          event.state === "active"
                            ? "success"
                            : event.state === "failover"
                              ? "warning"
                              : "error"
                        }
                      >
                        {event.state}
                      </Badge>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)] mt-1">
                      {formatDistanceToNow(new Date(event.time), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
