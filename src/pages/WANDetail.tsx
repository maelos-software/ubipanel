import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowDown, ArrowUp, Activity, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { BandwidthChart } from "@/components/charts/BandwidthChart";
import { useWANPorts } from "@/hooks/useNetworkData";
import { useQuery } from "@tanstack/react-query";
import { queryInflux, escapeInfluxString } from "@/lib/influx";
import { REFETCH_INTERVAL, CHART_HEIGHT } from "@/lib/config";
import { formatBytes, formatBytesRate } from "@/lib/format";

type TimeRange = "1h" | "3h" | "6h" | "12h" | "24h" | "7d";

const timeRanges: { value: TimeRange; label: string; interval: string }[] = [
  { value: "1h", label: "1h", interval: "1m" },
  { value: "3h", label: "3h", interval: "2m" },
  { value: "6h", label: "6h", interval: "5m" },
  { value: "12h", label: "12h", interval: "10m" },
  { value: "24h", label: "24h", interval: "15m" },
  { value: "7d", label: "7d", interval: "1h" },
];

export function WANDetail() {
  const { ifname } = useParams<{ ifname: string }>();
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>("3h");
  const decodedIfname = decodeURIComponent(ifname || "");

  const { data: wanPorts = [] } = useWANPorts();
  const port = wanPorts.find((p) => p.ifname === decodedIfname);

  const rangeConfig = timeRanges.find((r) => r.value === timeRange)!;

  // Fetch bandwidth history for this specific interface
  const { data: bandwidthHistory = [] } = useQuery({
    queryKey: ["wanPortBandwidthHistory", decodedIfname, timeRange],
    queryFn: async () => {
      const response = await queryInflux(`
        SELECT mean("rx_bytes-r") as rx_rate, mean("tx_bytes-r") as tx_rate
        FROM usg_wan_ports
        WHERE time > now() - ${timeRange} AND "ifname" = '${escapeInfluxString(decodedIfname)}'
        GROUP BY time(${rangeConfig.interval}) fill(0)
      `);

      const series = response.results[0]?.series?.[0];
      if (!series) return [];

      return series.values
        .map((row: unknown[]) => ({
          time: row[0] as string,
          rxRate: (row[series.columns.indexOf("rx_rate")] as number) || 0,
          txRate: (row[series.columns.indexOf("tx_rate")] as number) || 0,
        }))
        .filter((p: { rxRate: number; txRate: number }) => p.rxRate > 0 || p.txRate > 0);
    },
    enabled: !!decodedIfname,
    refetchInterval: REFETCH_INTERVAL,
  });

  if (!port) {
    return (
      <div>
        <PageHeader title="WAN Port Not Found" breadcrumb="Gateway" />
        <div className="text-center py-12">
          <p className="text-[var(--text-tertiary)] mb-4">
            The requested WAN port could not be found.
          </p>
          <button
            onClick={() => navigate("/gateway")}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            ← Back to Gateway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/gateway")}
        className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Gateway</span>
      </button>

      <PageHeader
        title={port.ifname}
        description={port.ip || "No IP assigned"}
        breadcrumb="Gateway"
        actions={
          <div className="flex items-center gap-2">
            {port.isUplink && <Badge variant="success">Active Uplink</Badge>}
            {!port.isUplink && port.up && <Badge variant="neutral">Standby</Badge>}
            {!port.up && <Badge variant="warning">Down</Badge>}
          </div>
        }
      />

      {/* Current Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDown className="w-5 h-5" />
            <span className="text-emerald-100 text-sm">Download</span>
          </div>
          <div className="text-3xl font-bold font-[var(--font-display)]">
            {formatBytesRate(port.rxBytesR)}
          </div>
          <div className="text-emerald-200 text-sm mt-1">{formatBytes(port.rxBytes)} total</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUp className="w-5 h-5" />
            <span className="text-blue-100 text-sm">Upload</span>
          </div>
          <div className="text-3xl font-bold font-[var(--font-display)]">
            {formatBytesRate(port.txBytesR)}
          </div>
          <div className="text-blue-200 text-sm mt-1">{formatBytes(port.txBytes)} total</div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span className="text-sm text-[var(--text-tertiary)]">Errors</span>
          </div>
          <div
            className={`text-3xl font-bold font-[var(--font-display)] ${port.rxErrors + port.txErrors > 0 ? "text-red-600" : ""}`}
          >
            {port.rxErrors + port.txErrors}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            RX: {port.rxErrors} / TX: {port.txErrors}
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-[var(--text-tertiary)]">Dropped</span>
          </div>
          <div
            className={`text-3xl font-bold font-[var(--font-display)] ${port.rxDropped + port.txDropped > 0 ? "text-amber-600" : ""}`}
          >
            {port.rxDropped + port.txDropped}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mt-1">
            RX: {port.rxDropped} / TX: {port.txDropped}
          </div>
        </div>
      </div>

      {/* Bandwidth History */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]">
            Bandwidth History
          </h2>
          <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] rounded-lg p-1">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeRange === range.value
                    ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        {bandwidthHistory.length > 0 ? (
          <BandwidthChart data={bandwidthHistory} height={CHART_HEIGHT.xxl} />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-[var(--text-muted)]">
            No bandwidth history available
          </div>
        )}
      </div>

      {/* Connection Details */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
          Connection Details
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Interface
            </div>
            <div className="font-medium font-mono">{port.ifname}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              IP Address
            </div>
            <div className="font-medium font-mono">{port.ip || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              MAC Address
            </div>
            <div className="font-medium font-mono text-sm">{port.mac}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Gateway
            </div>
            <div className="font-medium font-mono">{port.gateway || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Speed
            </div>
            <div className="font-medium">{port.speed > 0 ? `${port.speed} Mbps` : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Max Speed
            </div>
            <div className="font-medium">{port.maxSpeed > 0 ? `${port.maxSpeed} Mbps` : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Duplex
            </div>
            <div className="font-medium">{port.fullDuplex ? "Full Duplex" : "Half Duplex"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Type
            </div>
            <div className="font-medium capitalize">{port.type || "—"}</div>
          </div>
        </div>
      </div>

      {/* Packet Statistics */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
          Packet Statistics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl">
            <div className="text-xs text-emerald-600 uppercase tracking-wider mb-1">RX Packets</div>
            <div className="text-2xl font-bold font-[var(--font-display)]">
              {(port.rxPackets / 1000000).toFixed(2)}M
            </div>
          </div>
          <div className="p-4 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl">
            <div className="text-xs text-blue-600 uppercase tracking-wider mb-1">TX Packets</div>
            <div className="text-2xl font-bold font-[var(--font-display)]">
              {(port.txPackets / 1000000).toFixed(2)}M
            </div>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              RX Broadcast
            </div>
            <div className="text-2xl font-bold font-[var(--font-display)]">
              {port.rxBroadcast.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              TX Broadcast
            </div>
            <div className="text-2xl font-bold font-[var(--font-display)]">
              {port.txBroadcast.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              RX Multicast
            </div>
            <div className="text-2xl font-bold font-[var(--font-display)]">
              {port.rxMulticast.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-[var(--bg-tertiary)] rounded-xl">
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              TX Multicast
            </div>
            <div className="text-2xl font-bold font-[var(--font-display)]">
              {port.txMulticast.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-red-500/10 dark:bg-red-500/20 rounded-xl">
            <div className="text-xs text-red-600 uppercase tracking-wider mb-1">RX Errors</div>
            <div
              className={`text-2xl font-bold font-[var(--font-display)] ${port.rxErrors > 0 ? "text-red-600" : ""}`}
            >
              {port.rxErrors.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-red-500/10 dark:bg-red-500/20 rounded-xl">
            <div className="text-xs text-red-600 uppercase tracking-wider mb-1">TX Errors</div>
            <div
              className={`text-2xl font-bold font-[var(--font-display)] ${port.txErrors > 0 ? "text-red-600" : ""}`}
            >
              {port.txErrors.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Port Status */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
          Port Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div
              className={`w-3 h-3 rounded-full ${port.up ? "bg-emerald-500/10 dark:bg-emerald-500/200" : "bg-[var(--bg-tertiary)]"}`}
            />
            <div>
              <div className="text-sm font-medium">Link Status</div>
              <div className="text-xs text-[var(--text-tertiary)]">{port.up ? "Up" : "Down"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div
              className={`w-3 h-3 rounded-full ${port.enabled ? "bg-emerald-500/10 dark:bg-emerald-500/200" : "bg-[var(--bg-tertiary)]"}`}
            />
            <div>
              <div className="text-sm font-medium">Admin Status</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                {port.enabled ? "Enabled" : "Disabled"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div
              className={`w-3 h-3 rounded-full ${port.isUplink ? "bg-emerald-500/10 dark:bg-emerald-500/200" : "bg-[var(--bg-tertiary)]"}`}
            />
            <div>
              <div className="text-sm font-medium">Uplink Role</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                {port.isUplink ? "Primary" : "Standby"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <div
              className={`w-3 h-3 rounded-full ${port.fullDuplex ? "bg-emerald-500/10 dark:bg-emerald-500/200" : "bg-amber-500/10 dark:bg-amber-500/200"}`}
            />
            <div>
              <div className="text-sm font-medium">Duplex Mode</div>
              <div className="text-xs text-[var(--text-tertiary)]">
                {port.fullDuplex ? "Full" : "Half"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
