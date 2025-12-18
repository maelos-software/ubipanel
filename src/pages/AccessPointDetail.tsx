import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { ArrowLeft, Users, Radio, Activity, Signal, Wifi, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { BandwidthChart } from "@/components/charts/BandwidthChart";
import { PercentTooltip } from "@/components/charts/ChartTooltip";
import { getTooltipStyle } from "@/lib/chartConfig";
import { DataTable } from "@/components/common/DataTable";
import { ClientList } from "@/components/common/ClientList";
import { CLIENT_COLUMN_PRESETS } from "@/components/common/clientListPresets";
import { useAccessPoints, useClients, useAPVAPs, useAPRadios } from "@/hooks/useNetworkData";
import {
  useAPBandwidthHistory,
  useAPClientsHistory,
  useAPSignalHistory,
  useAPChannelUtilization,
  useAPBandTrafficHistory,
  useAPCCQHistory,
} from "@/hooks/useHistoricalData";
import { useTimeRangeState } from "@/hooks/useTimeRangeState";
import {
  formatBytes,
  formatPercent,
  formatUptime,
  getSignalQuality,
  formatRadioProto,
  getSignalDomain,
  formatChartTime,
} from "@/lib/format";
import { getWiFiBand } from "@/lib/wifi";
import { normalizeSSIDs } from "@/lib/ssid";
import { CHART_HEIGHT, THRESHOLDS } from "@/lib/config";
import { TIME_RANGES_DETAIL } from "@/lib/timeRanges";
import { useChartColors } from "@/hooks/useChartColors";
import { CHART_COLORS } from "@/config/theme";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const RADIO_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#F59E0B"];

export function AccessPointDetail() {
  const { mac } = useParams<{ mac: string }>();
  const navigate = useNavigate();
  const { timeRange, setTimeRange, interval } = useTimeRangeState(TIME_RANGES_DETAIL);
  const chartColors = useChartColors();

  const { data: aps = [] } = useAccessPoints();
  const { data: allClients = [] } = useClients();
  const ap = aps.find((a) => a.mac === decodeURIComponent(mac || ""));

  // Data hooks
  const { data: bandwidthHistory = [] } = useAPBandwidthHistory(
    ap?.name || "",
    timeRange.value,
    interval
  );

  const { data: clientsHistory = [] } = useAPClientsHistory(
    ap?.name || "",
    timeRange.value,
    interval
  );

  const { data: signalHistory = [] } = useAPSignalHistory(
    ap?.name || "",
    timeRange.value,
    interval
  );

  const { data: channelUtilHistory = [] } = useAPChannelUtilization(
    ap?.name || "",
    timeRange.value,
    interval
  );

  const { data: traffic5GHz = [] } = useAPBandTrafficHistory(
    ap?.name || "",
    "5GHz",
    timeRange.value,
    interval
  );

  const { data: traffic24GHz = [] } = useAPBandTrafficHistory(
    ap?.name || "",
    "2.4GHz",
    timeRange.value,
    interval
  );

  const { data: ccqHistory } = useAPCCQHistory(ap?.name || "", timeRange.value, interval);

  // Get VAPs for this AP
  const { data: vaps = [] } = useAPVAPs(ap?.name);

  // Get radios for this AP (using shared hook instead of inline query)
  const { data: radios = [] } = useAPRadios(ap?.name);

  // Get clients connected to this AP
  const connectedClients = allClients.filter((c) => !c.isWired && c.apName === ap?.name);

  // Calculate average signal
  const avgSignal =
    connectedClients.length > 0
      ? connectedClients.reduce((sum, c) => sum + (c.rssi || 0), 0) / connectedClients.length
      : 0;

  // Normalize SSIDs for this AP - aggregates VAP data per SSID
  const ssidData = useMemo(() => normalizeSSIDs(vaps), [vaps]);

  if (!ap) {
    return (
      <div>
        <PageHeader title="Access Point Not Found" breadcrumb="Access Points" />
        <div className="text-center py-12">
          <p className="text-[var(--text-tertiary)] mb-4">
            The requested access point could not be found.
          </p>
          <button
            onClick={() => navigate("/access-points")}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            Back to Access Points
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate("/access-points")}
        className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Access Points</span>
      </button>

      <PageHeader
        title={ap.name}
        description={`${ap.model} · ${ap.ip} · v${ap.version}`}
        breadcrumb="Access Points"
        actions={<Badge variant="success">Online</Badge>}
      />

      {/* Time Range Selector */}
      <div className="flex justify-end mb-6">
        <TimeRangeSelector
          ranges={TIME_RANGES_DETAIL}
          selected={timeRange}
          onChange={setTimeRange}
        />
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold font-[var(--font-display)]">
                {connectedClients.length}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Clients</div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
              <Signal className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div
                className={`text-2xl font-bold font-[var(--font-display)] ${avgSignal ? getSignalQuality(avgSignal).color : "text-[var(--text-muted)]"}`}
              >
                {avgSignal ? `${avgSignal.toFixed(0)} dBm` : "—"}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Avg Signal</div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold font-[var(--font-display)]">
                {formatBytes(ap.rxBytes + ap.txBytes)}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Total Traffic</div>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold font-[var(--font-display)]">
                {formatUptime(ap.uptime)}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Uptime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Radios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {radios.map((radio, idx) => {
          const band = getWiFiBand(radio.channel).replace("GHz", " GHz"); // "2.4GHz" -> "2.4 GHz"
          const wifiLabel = formatRadioProto(radio.radio).label;
          const utilColor =
            radio.cuTotal > THRESHOLDS.utilization.high
              ? "text-red-600"
              : radio.cuTotal > THRESHOLDS.utilization.moderate
                ? "text-amber-600"
                : "text-emerald-600";
          return (
            <div
              key={radio.radio}
              className="bg-[var(--bg-secondary)] rounded-2xl p-5 shadow-sm ring-1 ring-[var(--border-primary)]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: `${RADIO_COLORS[idx % RADIO_COLORS.length]}15`,
                    }}
                  >
                    <Radio
                      className="w-5 h-5"
                      style={{ color: RADIO_COLORS[idx % RADIO_COLORS.length] }}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium">{wifiLabel}</h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      {band} · Ch {radio.channel}
                    </p>
                  </div>
                </div>
                <Badge variant="neutral">{radio.numSta} clients</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-[var(--text-tertiary)]">TX Power</div>
                  <div className="font-medium">{radio.txPower} dBm</div>
                </div>
                <div>
                  <div className="text-[var(--text-tertiary)]">Chan Util</div>
                  <div className={`font-medium ${utilColor}`}>{formatPercent(radio.cuTotal)}</div>
                </div>
                <div>
                  <div className="text-[var(--text-tertiary)]">Self TX/RX</div>
                  <div className="font-medium">
                    {formatPercent(radio.cuSelfTx + radio.cuSelfRx)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Bandwidth History */}
      {bandwidthHistory.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)] mb-8">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
            Total Bandwidth
          </h3>
          <BandwidthChart data={bandwidthHistory} height={CHART_HEIGHT.md} />
        </div>
      )}

      {/* Traffic by Band */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 5GHz Traffic */}
        {traffic5GHz.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
              5 GHz Traffic
            </h3>
            <BandwidthChart data={traffic5GHz} height={CHART_HEIGHT.md} />
          </div>
        )}

        {/* 2.4GHz Traffic */}
        {traffic24GHz.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
              2.4 GHz Traffic
            </h3>
            <BandwidthChart data={traffic24GHz} height={CHART_HEIGHT.md} />
          </div>
        )}
      </div>

      {/* Clients Over Time & Average Signal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Clients Over Time */}
        {clientsHistory.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
              Clients Over Time
            </h3>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
              <AreaChart data={clientsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatChartTime}
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                />
                <YAxis
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                />
                <Tooltip
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                  {...getTooltipStyle(chartColors)}
                />
                <Area
                  type="monotone"
                  dataKey="userSta"
                  stackId="1"
                  stroke="#7C3AED"
                  fill="#7C3AED"
                  fillOpacity={0.6}
                  name="Users"
                />
                <Area
                  type="monotone"
                  dataKey="guestSta"
                  stackId="1"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.6}
                  name="Guests"
                />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Average Signal */}
        {signalHistory.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
              Average Client Signal
            </h3>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
              <LineChart data={signalHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatChartTime}
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                />
                <YAxis
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                  domain={([dataMin, dataMax]) => getSignalDomain(dataMin, dataMax)}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                  formatter={(value: number) => [`${value.toFixed(1)} dBm`]}
                  {...getTooltipStyle(chartColors)}
                />
                <Line
                  type="monotone"
                  dataKey="avgSignal"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  name="Signal"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Channel Utilization & CCQ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Channel Utilization */}
        {channelUtilHistory.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
              Channel Utilization
            </h3>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
              <LineChart data={channelUtilHistory.flatMap((r) => r.data)}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatChartTime}
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                />
                <YAxis
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<PercentTooltip chartColors={chartColors} />} />
                <Legend />
                {channelUtilHistory.map((radio, idx) => (
                  <Line
                    key={radio.radio}
                    type="monotone"
                    dataKey="cuTotal"
                    data={radio.data}
                    stroke={RADIO_COLORS[idx % RADIO_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={radio.radio}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* CCQ History */}
        {ccqHistory && ccqHistory.data.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
              Client Connection Quality (CCQ)
            </h3>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
              <LineChart data={ccqHistory.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatChartTime}
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                />
                <YAxis
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={12}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<PercentTooltip chartColors={chartColors} />} />
                <Legend />
                {ccqHistory.radios.map((radio, idx) => (
                  <Line
                    key={radio}
                    type="monotone"
                    dataKey={radio}
                    stroke={RADIO_COLORS[idx % RADIO_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={radio}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* SSID Summary - Aggregated view matching AccessPoints page */}
      {ssidData.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)] mb-8">
          <h3 className="text-lg font-semibold font-[var(--font-display)] mb-4">
            Networks / SSIDs
          </h3>
          <DataTable
            data={ssidData}
            keyExtractor={(s) => s.essid}
            onRowClick={(s) => navigate(`/ssid/${encodeURIComponent(s.essid)}`)}
            columns={[
              {
                key: "essid",
                header: "SSID",
                sortValue: (s) => s.essid.toLowerCase(),
                render: (s) => (
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-purple-500" />
                    <span className="font-medium">{s.essid}</span>
                    {s.isGuest && <Badge variant="warning">Guest</Badge>}
                  </div>
                ),
              },
              {
                key: "channels",
                header: "Bands / Channels",
                sortable: false,
                render: (s) => (
                  <div className="flex flex-col gap-1">
                    {s.channels["2.4GHz"].length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-amber-600 w-12">2.4G:</span>
                        {s.channels["2.4GHz"].map((ch) => (
                          <span
                            key={ch}
                            className="inline-block px-1.5 py-0.5 bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 rounded text-xs"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.channels["5GHz"].length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-purple-600 w-12">5G:</span>
                        {s.channels["5GHz"].map((ch) => (
                          <span
                            key={ch}
                            className="inline-block px-1.5 py-0.5 bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 rounded text-xs"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.channels["6GHz"].length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-cyan-600 w-12">6G:</span>
                        {s.channels["6GHz"].map((ch) => (
                          <span
                            key={ch}
                            className="inline-block px-1.5 py-0.5 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 rounded text-xs"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "clients",
                header: "Clients",
                sortValue: (s) => s.clientCount,
                render: (s) => (
                  <div className="text-center">
                    <span className="text-lg font-semibold">{s.clientCount}</span>
                  </div>
                ),
              },
              {
                key: "traffic",
                header: "Traffic",
                sortValue: (s) => s.rxBytes + s.txBytes,
                render: (s) => (
                  <div className="text-sm">
                    <span className="text-emerald-600">{formatBytes(s.rxBytes)}</span>
                    {" / "}
                    <span className="text-blue-600">{formatBytes(s.txBytes)}</span>
                  </div>
                ),
              },
              {
                key: "signal",
                header: "Avg Signal",
                sortValue: (s) => s.avgSignal || -100,
                render: (s) => {
                  if (!s.avgSignal) return "—";
                  const quality = getSignalQuality(s.avgSignal);
                  return <span className={quality.color}>{s.avgSignal.toFixed(0)} dBm</span>;
                },
              },
              {
                key: "satisfaction",
                header: "Satisfaction",
                sortValue: (s) => s.satisfaction || 0,
                render: (s) => (s.satisfaction ? `${s.satisfaction.toFixed(0)}%` : "—"),
              },
            ]}
          />
        </div>
      )}

      {/* Connected Clients */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)] mb-8">
        <h3 className="text-lg font-semibold font-[var(--font-display)] mb-4">
          Connected Clients ({connectedClients.length})
        </h3>
        <ClientList
          clients={connectedClients}
          onClientClick={(c) => navigate(`/clients/${encodeURIComponent(c.mac)}`)}
          columns={CLIENT_COLUMN_PRESETS.apDetail}
          emptyMessage="No clients connected"
          defaultSortKey="bandwidth"
          defaultSortDir="desc"
        />
      </div>

      {/* System Stats (CPU/Memory/Load) - Less important, at bottom */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
        <h3 className="text-lg font-semibold font-[var(--font-display)] mb-6">System Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex flex-col items-center">
            <GaugeChart value={ap.cpu} label="CPU" size="md" />
          </div>
          <div className="flex flex-col items-center">
            <GaugeChart
              value={ap.mem}
              label="Memory"
              size="md"
              color={CHART_COLORS.semantic.info}
            />
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
            <div className="text-sm text-[var(--text-tertiary)] mb-2">Load Average</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">1 min</span>
                <span className="font-medium">{ap.loadavg1.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">5 min</span>
                <span className="font-medium">{ap.loadavg5.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">15 min</span>
                <span className="font-medium">{ap.loadavg15.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div className="bg-[var(--bg-tertiary)] rounded-xl p-4">
            <div className="text-sm text-[var(--text-tertiary)] mb-2">Device Info</div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Model</span>
                <span className="font-medium">{ap.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Version</span>
                <span className="font-medium">{ap.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">MAC</span>
                <span className="font-mono text-xs">{ap.mac}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
