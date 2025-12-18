import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Monitor,
  Clock,
  Signal,
  ArrowDown,
  ArrowUp,
  Wifi,
  Radio,
  Activity,
  Zap,
  RotateCcw,
  Gauge,
  Network,
  Cable,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { BandwidthChart } from "@/components/charts/BandwidthChart";
import { SignalChart } from "@/components/charts/SignalChart";
import { getTooltipStyle } from "@/lib/chartConfig";
import { useClients } from "@/hooks/useNetworkData";
import {
  useClientBandwidthHistory,
  useClientSignalHistory,
  useClientSatisfactionHistory,
  useClientRoamingEvents,
  useExtendedClientInfo,
  useClientRateHistory,
  useHistoricalClientInfo,
} from "@/hooks/useHistoricalData";
import { useTimeRangeState } from "@/hooks/useTimeRangeState";
import {
  formatBytes,
  formatBytesRate,
  formatUptime,
  getSignalQuality,
  formatRadioProto,
  formatChartTime,
} from "@/lib/format";
import { CHART_HEIGHT, THRESHOLDS } from "@/lib/config";
import { TIME_RANGES_EXTENDED } from "@/lib/timeRanges";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import { useChartColors } from "@/hooks/useChartColors";

/**
 * Client Detail page - Individual client information
 *
 * Displays:
 * - Client info (name, IP, MAC, connection type)
 * - Bandwidth history chart
 * - Signal strength history (wireless only)
 * - Client satisfaction history (wireless only)
 * - Link rate history (wireless only)
 * - Roaming event history
 *
 * @route /clients/:mac
 * @param mac - Client MAC address
 */

// Satisfaction chart component
function SatisfactionChart({
  data,
  height = 200,
}: {
  data: { time: string; satisfaction: number }[];
  height?: number;
}) {
  const colors = useChartColors();
  const chartData = data.map((d) => ({
    ...d,
    time: formatChartTime(d.time),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="satisfactionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: colors.tickText }}
          stroke={colors.axisLine}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: colors.tickText }}
          stroke={colors.axisLine}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, "Satisfaction"]}
          {...getTooltipStyle(colors)}
        />
        <ReferenceLine
          y={THRESHOLDS.satisfaction.good}
          stroke="#10b981"
          strokeDasharray="3 3"
          label={{ value: "Good", fill: "#10b981", fontSize: 10 }}
        />
        <ReferenceLine
          y={THRESHOLDS.satisfaction.poor}
          stroke="#f59e0b"
          strokeDasharray="3 3"
          label={{ value: "Fair", fill: "#f59e0b", fontSize: 10 }}
        />
        <Area
          type="monotone"
          dataKey="satisfaction"
          stroke="#8b5cf6"
          fill="url(#satisfactionGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Link rate chart component
function LinkRateChart({
  data,
  height = 200,
}: {
  data: { time: string; txRate: number; rxRate: number }[];
  height?: number;
}) {
  const colors = useChartColors();
  const chartData = data.map((d) => ({
    time: formatChartTime(d.time),
    tx: d.txRate / 1000, // Convert to Mbps
    rx: d.rxRate / 1000,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis
          dataKey="time"
          tick={{ fontSize: 11, fill: colors.tickText }}
          stroke={colors.axisLine}
        />
        <YAxis
          tick={{ fontSize: 11, fill: colors.tickText }}
          stroke={colors.axisLine}
          tickFormatter={(v) => `${v} Mbps`}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(0)} Mbps`]}
          {...getTooltipStyle(colors)}
        />
        <Line
          type="monotone"
          dataKey="tx"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="TX Rate"
        />
        <Line
          type="monotone"
          dataKey="rx"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="RX Rate"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ClientDetail() {
  const { mac } = useParams<{ mac: string }>();
  const navigate = useNavigate();
  const { timeRange, setTimeRange, interval } = useTimeRangeState(TIME_RANGES_EXTENDED);

  const decodedMac = decodeURIComponent(mac || "");

  const { data: clients = [] } = useClients();
  const liveClient = clients.find((c) => c.mac === decodedMac);

  // Fetch historical data if client is not currently connected
  const { data: historicalClient, isLoading: historicalLoading } = useHistoricalClientInfo(
    !liveClient ? decodedMac : ""
  );

  // Use live client data if available, otherwise fall back to historical
  const client =
    liveClient ||
    (historicalClient
      ? {
          ...historicalClient,
          rxBytesR: 0,
          txBytesR: 0,
          isGuest: false,
          oui: "",
          swName: "",
          swPort: 0,
          vlan: 0,
        }
      : null);

  const isOffline = !liveClient && !!historicalClient;

  // Core historical data - use decoded MAC directly since client might be offline
  // Pass isWired flag so the hook uses correct fields (wired-rx_bytes-r vs rx_bytes_r)
  const { data: bandwidthHistory = [] } = useClientBandwidthHistory(
    decodedMac,
    timeRange.value,
    interval,
    client?.isWired
  );
  const { data: signalHistory = [] } = useClientSignalHistory(
    decodedMac,
    timeRange.value,
    interval
  );

  // Extended data
  const { data: satisfactionHistory = [] } = useClientSatisfactionHistory(
    decodedMac,
    timeRange.value,
    interval
  );
  const { data: rateHistory = [] } = useClientRateHistory(decodedMac, timeRange.value, interval);
  const { data: extendedInfo } = useExtendedClientInfo(decodedMac);
  const { data: roamingEvents = [] } = useClientRoamingEvents(client?.name || "", "24h");

  if (!client && !historicalLoading) {
    return (
      <div>
        <PageHeader title="Client Not Found" breadcrumb="Clients" />
        <div className="text-center py-12">
          <p className="text-[var(--text-tertiary)] mb-4">
            The requested client could not be found.
          </p>
          <button
            onClick={() => navigate("/clients")}
            className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
          >
            Back to Clients
          </button>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const signalQuality = getSignalQuality(client.rssi);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/clients")}
        className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Clients</span>
      </button>

      <PageHeader
        title={client.name || client.hostname || "Unknown Device"}
        description={client.mac}
        breadcrumb="Clients"
        actions={
          <div className="flex items-center gap-2">
            {isOffline && <Badge variant="error">Offline</Badge>}
            <Badge variant={client.isWired ? "neutral" : "info"}>
              {client.isWired ? "Wired" : formatRadioProto(client.radioProto).label}
            </Badge>
            {client.isGuest && <Badge variant="warning">Guest</Badge>}
          </div>
        }
      />

      {/* Time Range Selector - Prominent position */}
      <TimeRangeSelector
        ranges={TIME_RANGES_EXTENDED}
        selected={timeRange}
        onChange={setTimeRange}
      />

      {/* Stats Cards - Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[var(--text-tertiary)]">IP Address</div>
              <div className="font-mono text-sm font-medium text-[var(--text-primary)] truncate">
                {client.ip || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
              {client.isWired ? (
                <Cable className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ) : (
                <Wifi className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[var(--text-tertiary)]">Connected To</div>
              <div className="font-medium text-sm text-[var(--text-primary)] truncate">
                {client.isWired ? client.swName || "—" : client.apName || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-[var(--text-tertiary)]">Uptime</div>
              <div className="font-medium text-sm text-[var(--text-primary)]">
                {formatUptime(client.uptime)}
              </div>
            </div>
          </div>
        </div>

        {!client.isWired && (
          <>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                  <Signal className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--text-tertiary)]">Signal (RSSI)</div>
                  <div className={`font-medium text-sm ${signalQuality.color}`}>
                    {client.rssi} dBm
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--text-tertiary)]">Channel</div>
                  <div className="font-medium text-sm text-[var(--text-primary)]">
                    {client.channel || "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center">
                  <Gauge className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--text-tertiary)]">Satisfaction</div>
                  <div
                    className={`font-medium text-sm ${
                      client.satisfaction >= THRESHOLDS.satisfaction.good
                        ? "text-emerald-600"
                        : client.satisfaction >= THRESHOLDS.satisfaction.poor
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {client.satisfaction > 0 ? `${client.satisfaction}%` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Current Bandwidth - Large Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <ArrowDown className="w-6 h-6" />
            <span className="text-emerald-100 text-sm font-medium">Download</span>
          </div>
          <div className="text-4xl font-bold font-[var(--font-display)] mb-2">
            {formatBytesRate(client.txBytesR)}
          </div>
          <div className="text-emerald-200 text-sm">Total: {formatBytes(client.txBytes)}</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <ArrowUp className="w-6 h-6" />
            <span className="text-blue-100 text-sm font-medium">Upload</span>
          </div>
          <div className="text-4xl font-bold font-[var(--font-display)] mb-2">
            {formatBytesRate(client.rxBytesR)}
          </div>
          <div className="text-blue-200 text-sm">Total: {formatBytes(client.rxBytes)}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bandwidth History Chart */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[var(--text-tertiary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Bandwidth History</h3>
          </div>
          {bandwidthHistory.length > 0 ? (
            <BandwidthChart data={bandwidthHistory} height={CHART_HEIGHT.ml} />
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
              No bandwidth data available
            </div>
          )}
        </div>

        {/* Signal History Chart (wireless only) */}
        {!client.isWired && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <Signal className="w-5 h-5 text-[var(--text-tertiary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Signal Strength (RSSI)
              </h3>
            </div>
            {signalHistory.length > 0 ? (
              <SignalChart data={signalHistory} height={CHART_HEIGHT.ml} />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
                No signal data available
              </div>
            )}
          </div>
        )}

        {/* Satisfaction History (wireless only) */}
        {!client.isWired && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <Gauge className="w-5 h-5 text-[var(--text-tertiary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Client Satisfaction
              </h3>
            </div>
            {satisfactionHistory.length > 0 ? (
              <SatisfactionChart data={satisfactionHistory} height={CHART_HEIGHT.ml} />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
                No satisfaction data available
              </div>
            )}
          </div>
        )}

        {/* Link Rate History (wireless only) */}
        {!client.isWired && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-[var(--text-tertiary)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Link Rate (TX/RX)
              </h3>
            </div>
            {rateHistory.length > 0 ? (
              <LinkRateChart data={rateHistory} height={CHART_HEIGHT.ml} />
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
                No link rate data available
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-tertiary)]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                <span>TX Rate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                <span>RX Rate</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extended Connection Details */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
        <div className="flex items-center gap-2 mb-4">
          <Network className="w-5 h-5 text-[var(--text-tertiary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Connection Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              MAC Address
            </div>
            <div className="font-mono text-sm text-[var(--text-primary)]">{client.mac}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              VLAN
            </div>
            <div className="font-medium text-[var(--text-primary)]">{client.vlan || "—"}</div>
          </div>
          {!client.isWired && (
            <>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  SSID
                </div>
                <div className="font-medium text-[var(--text-primary)] truncate">
                  {extendedInfo?.essid || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Manufacturer
                </div>
                <div className="font-medium text-[var(--text-primary)] truncate">
                  {extendedInfo?.oui || "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  TX Power
                </div>
                <div className="font-medium text-[var(--text-primary)]">
                  {extendedInfo?.txPower ? `${extendedInfo.txPower} dBm` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Noise Floor
                </div>
                <div className="font-medium text-[var(--text-primary)]">
                  {extendedInfo?.noise ? `${extendedInfo.noise} dBm` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  TX Rate
                </div>
                <div className="font-medium text-[var(--text-primary)]">
                  {extendedInfo?.txRate ? `${(extendedInfo.txRate / 1000).toFixed(0)} Mbps` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  RX Rate
                </div>
                <div className="font-medium text-[var(--text-primary)]">
                  {extendedInfo?.rxRate ? `${(extendedInfo.rxRate / 1000).toFixed(0)} Mbps` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  TX Retries
                </div>
                <div className="font-medium text-[var(--text-primary)]">
                  {extendedInfo?.txRetries ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  CCQ
                </div>
                <div className="font-medium text-[var(--text-primary)]">
                  {extendedInfo?.ccq ? `${extendedInfo.ccq}%` : "—"}
                </div>
              </div>
            </>
          )}
          {client.isWired && client.swPort && (
            <>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Switch Port
                </div>
                <div className="font-medium text-[var(--text-primary)]">Port {client.swPort}</div>
              </div>
            </>
          )}
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Guest Network
            </div>
            <div className="font-medium text-[var(--text-primary)]">
              {client.isGuest ? "Yes" : "No"}
            </div>
          </div>
        </div>
      </div>

      {/* Roaming Events (wireless only) */}
      {!client.isWired && roamingEvents.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw className="w-5 h-5 text-[var(--text-tertiary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Roaming Events (Last 24h)
            </h3>
            <Badge variant="neutral">{roamingEvents.length}</Badge>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {roamingEvents.map((event, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-3 bg-[var(--bg-tertiary)] rounded-lg"
              >
                <div className="text-xs text-[var(--text-tertiary)] font-mono whitespace-nowrap">
                  {new Date(event.time).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-tertiary)]">{event.fromAp || "Unknown"}</span>
                  <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <span className="font-medium text-[var(--text-primary)]">
                    {event.toAp || "Unknown"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Missing import
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}
