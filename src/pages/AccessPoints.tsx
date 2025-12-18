import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Wifi, Radio, Activity, Signal } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/common/Badge";
import { DataTable } from "@/components/common/DataTable";
import { InfoTooltip } from "@/components/common/InfoTooltip";
import { ClientDistributionChart } from "@/components/charts/ClientDistributionChart";
import { SignalTooltip, BandwidthTooltip } from "@/components/charts/ChartTooltip";
import { useAccessPoints, useClients, useAPVAPs, useAPRadios } from "@/hooks/useNetworkData";
import { useAllAPBandwidthHistory, useAllAPSignalHistory } from "@/hooks/useHistoricalData";
import { METRIC_DEFINITIONS } from "@/lib/metrics";
import {
  formatBytes,
  formatBytesRateAxis,
  formatPercent,
  formatUptime,
  getSignalDomain,
} from "@/lib/format";
import { normalizeSSIDs } from "@/lib/ssid";
import {
  getBandShortFromRadioTag,
  calculateChannelDistribution,
  calculateAPBandDistribution,
  calculateClientsPerAP,
} from "@/lib/wifi";
import { CHART_HEIGHT, THRESHOLDS } from "@/lib/config";
import { CHART_COLORS } from "@/config/theme";
import { getIntervalForRange } from "@/lib/bandwidth";
import { TIME_RANGES_EXTENDED } from "@/lib/timeRanges";
import { useChartColors } from "@/hooks/useChartColors";

import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Color palette for charts - use accent for consistency across dashboard
const COLORS = CHART_COLORS.accent;

// Time range options
const TIME_RANGES = TIME_RANGES_EXTENDED;

export function AccessPoints() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState("3h");
  const chartColors = useChartColors();
  const { data: aps = [], isLoading } = useAccessPoints();
  const { data: clients = [] } = useClients();
  const { data: vaps = [] } = useAPVAPs();
  const { data: radios = [] } = useAPRadios();

  // Get appropriate interval for the selected time range
  const interval = getIntervalForRange(timeRange);
  const { data: bandwidthHistory } = useAllAPBandwidthHistory(timeRange, interval);
  const { data: signalHistory } = useAllAPSignalHistory(timeRange, interval);

  // Calculate totals - memoize to ensure stable reference
  const wirelessClients = useMemo(() => clients.filter((c) => !c.isWired), [clients]);

  // Aggregate stats
  const uniqueSSIDs = useMemo(() => new Set(vaps.map((v) => v.essid).filter(Boolean)), [vaps]);
  const avgChannelUtil =
    radios.length > 0 ? radios.reduce((sum, r) => sum + r.cuTotal, 0) / radios.length : 0;

  // Calculate average signal across all wireless clients
  const avgSignal = useMemo(() => {
    const clientsWithSignal = wirelessClients.filter((c) => c.rssi && c.rssi < 0);
    if (clientsWithSignal.length === 0) return null;
    return clientsWithSignal.reduce((sum, c) => sum + c.rssi, 0) / clientsWithSignal.length;
  }, [wirelessClients]);

  // Use centralized logic for distributions
  const channelDistribution = useMemo(
    () => calculateChannelDistribution(wirelessClients),
    [wirelessClients]
  );
  const apBandDistribution = useMemo(() => calculateAPBandDistribution(vaps, COLORS), [vaps]);
  const clientsPerAP = useMemo(
    () => calculateClientsPerAP(wirelessClients, COLORS),
    [wirelessClients]
  );

  // Format time for charts
  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Normalize SSIDs table - group by SSID and show aggregated data
  const ssidData = useMemo(() => normalizeSSIDs(vaps), [vaps]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access Points"
        description={`${aps.length} access points serving ${wirelessClients.length} wireless clients`}
        breadcrumb="Network"
      />

      {/* Summary Stats - Compact layout */}
      <section
        aria-label="Access point summary"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <StatCard
          title="Access Points"
          value={aps.length}
          icon={Wifi}
          iconBg="bg-purple-50"
          compact
        />
        <StatCard title="Radios" value={radios.length} icon={Radio} iconBg="bg-blue-50" compact />
        <StatCard
          title="SSIDs"
          value={uniqueSSIDs.size}
          icon={Signal}
          iconBg="bg-emerald-50"
          compact
        />
        <StatCard
          title="Clients"
          value={wirelessClients.length}
          icon={Activity}
          iconBg="bg-amber-50"
          compact
        />
        <StatCard
          title={
            <div className="flex items-center gap-1.5">
              Ch. Utilization
              <InfoTooltip metric={METRIC_DEFINITIONS.channelUtilization} />
            </div>
          }
          value={avgChannelUtil > 0 ? formatPercent(avgChannelUtil) : "—"}
          icon={Activity}
          iconBg="bg-red-50"
          compact
        />
        <StatCard
          title={
            <div className="flex items-center gap-1.5">
              Avg Signal
              <InfoTooltip metric={METRIC_DEFINITIONS.rssi} />
            </div>
          }
          value={avgSignal ? `${avgSignal.toFixed(0)} dBm` : "—"}
          icon={Signal}
          iconBg="bg-indigo-50"
          compact
        />
      </section>

      {/* Access Points Table */}
      <section
        aria-labelledby="aps-table-title"
        className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]"
      >
        <h3
          id="aps-table-title"
          className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4"
        >
          Access Points
        </h3>
        {isLoading ? (
          <div className="text-center py-12 text-[var(--text-tertiary)]">
            Loading access points...
          </div>
        ) : (
          <DataTable
            data={aps}
            keyExtractor={(ap) => ap.mac}
            onRowClick={(ap) => navigate(`/access-points/${encodeURIComponent(ap.mac)}`)}
            columns={[
              {
                key: "name",
                header: "Access Point",
                sortValue: (ap) => ap.name.toLowerCase(),
                render: (ap) => (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                      <Wifi
                        className="w-5 h-5 text-green-600 dark:text-green-400"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">{ap.name}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {ap.model} · {ap.ip}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "clients",
                header: "Clients",
                sortValue: (ap) => wirelessClients.filter((c) => c.apName === ap.name).length,
                render: (ap) => {
                  const apClients = wirelessClients.filter((c) => c.apName === ap.name);
                  return (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-[var(--text-primary)]">
                        {apClients.length}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {ap.guestNumSta > 0 && `${ap.guestNumSta} guests`}
                      </div>
                    </div>
                  );
                },
              },
              {
                key: "radios",
                header: (
                  <div className="flex items-center gap-1.5">
                    Radios
                    <InfoTooltip metric={METRIC_DEFINITIONS.ccq} />
                  </div>
                ),
                sortable: false,
                render: (ap) => {
                  const apRadios = radios.filter((r) => r.apName === ap.name);
                  return (
                    <div className="flex flex-wrap gap-1">
                      {apRadios.map((radio) => {
                        const band = getBandShortFromRadioTag(radio.radio);
                        const utilColor =
                          radio.cuTotal > THRESHOLDS.utilization.high
                            ? "text-red-600"
                            : radio.cuTotal > THRESHOLDS.utilization.moderate
                              ? "text-amber-600"
                              : "text-green-600";
                        return (
                          <Badge key={radio.radio} variant="neutral">
                            <Radio className="w-3 h-3 mr-1" aria-hidden="true" />
                            {band} Ch{radio.channel}
                            <span className={`ml-1 ${utilColor}`}>
                              {formatPercent(radio.cuTotal)}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  );
                },
              },
              {
                key: "traffic",
                header: "Traffic",
                sortValue: (ap) => ap.rxBytes + ap.txBytes,
                render: (ap) => (
                  <div className="text-sm text-[var(--text-primary)]">
                    <div>
                      <span className="text-[var(--text-tertiary)]">RX:</span>{" "}
                      {formatBytes(ap.rxBytes)}
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)]">TX:</span>{" "}
                      {formatBytes(ap.txBytes)}
                    </div>
                  </div>
                ),
              },
              {
                key: "uptime",
                header: "Uptime",
                sortValue: (ap) => ap.uptime,
                render: (ap) => (
                  <span className="text-[var(--text-tertiary)]">{formatUptime(ap.uptime)}</span>
                ),
              },
              {
                key: "status",
                header: "Status",
                sortable: false,
                render: () => <Badge variant="success">Online</Badge>,
              },
            ]}
          />
        )}
      </section>

      {/* Distribution Charts */}
      <section
        aria-label="Wireless distribution charts"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
          <h3 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-2">
            Clients by Channel
          </h3>
          {channelDistribution.length > 0 ? (
            <div role="img" aria-label="Client distribution by WiFi channel chart">
              <ClientDistributionChart data={channelDistribution} height={CHART_HEIGHT.ml} />
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
              No client data
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
          <h3 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-2">
            Clients by AP Band
          </h3>
          {apBandDistribution.length > 0 ? (
            <div role="img" aria-label="Client distribution by access point and band chart">
              <ClientDistributionChart data={apBandDistribution} height={CHART_HEIGHT.ml} />
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
              No client data
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
          <h3 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-2">
            Clients per AP
          </h3>
          {clientsPerAP.length > 0 ? (
            <div role="img" aria-label="Clients per access point chart">
              <ClientDistributionChart data={clientsPerAP} height={CHART_HEIGHT.ml} />
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
              No client data
            </div>
          )}
        </div>
      </section>

      {/* Time Range Controls for Charts */}
      <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 w-fit">
        {TIME_RANGES.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setTimeRange(value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
              timeRange === value
                ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bandwidth per AP and Average Signal - Side by Side */}
      <section
        aria-label="Access point history charts"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Bandwidth per AP Chart */}
        {bandwidthHistory && bandwidthHistory.data.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]">
                Bandwidth per AP
              </h3>
              <InfoTooltip metric={METRIC_DEFINITIONS.txRetries} />
            </div>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.lg}>
              <AreaChart data={bandwidthHistory.data} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  stroke={chartColors.axisLine}
                  fontSize={12}
                  tick={{ fill: chartColors.tickText }}
                />
                <YAxis
                  stroke={chartColors.axisLine}
                  fontSize={12}
                  tickFormatter={(v) => formatBytesRateAxis(v)}
                  tick={{ fill: chartColors.tickText }}
                  width={70}
                />
                <Tooltip
                  content={
                    <BandwidthTooltip
                      chartColors={chartColors}
                      nameFormatter={(name) => {
                        const apName = name.replace(/_rx|_tx$/, "");
                        const direction = name.endsWith("_rx") ? "RX" : "TX";
                        return `${apName} ${direction}`;
                      }}
                    />
                  }
                />
                <Legend wrapperStyle={{ color: chartColors.tickText }} />
                {bandwidthHistory.apNames.flatMap((apName, idx) => [
                  <Area
                    key={`${apName}_rx`}
                    type="monotone"
                    dataKey={`${apName}_rx`}
                    stroke={COLORS[idx % COLORS.length]}
                    fill={COLORS[idx % COLORS.length]}
                    fillOpacity={0.3}
                    strokeWidth={2}
                    name={`${apName}_rx`}
                  />,
                  <Area
                    key={`${apName}_tx`}
                    type="monotone"
                    dataKey={`${apName}_tx`}
                    stroke={COLORS[(idx + 5) % COLORS.length]}
                    fill={COLORS[(idx + 5) % COLORS.length]}
                    fillOpacity={0.2}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name={`${apName}_tx`}
                  />,
                ])}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Average Signal Strength Chart */}
        {signalHistory && signalHistory.data.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]">
                Average Client Signal (dBm)
              </h3>
              <InfoTooltip metric={METRIC_DEFINITIONS.rssi} />
            </div>
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.lg}>
              <LineChart data={signalHistory.data} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatTime}
                  stroke={chartColors.axisLine}
                  fontSize={12}
                  tick={{ fill: chartColors.tickText }}
                />
                <YAxis
                  stroke={chartColors.axisLine}
                  fontSize={12}
                  domain={([dataMin, dataMax]) => getSignalDomain(dataMin, dataMax)}
                  tickFormatter={(v) => `${v}`}
                  tick={{ fill: chartColors.tickText }}
                />
                <Tooltip content={<SignalTooltip chartColors={chartColors} />} />
                <Legend wrapperStyle={{ color: chartColors.tickText }} />
                {signalHistory.apNames.map((apName, idx) => (
                  <Line
                    key={apName}
                    type="monotone"
                    dataKey={apName}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    name={apName}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Networks / SSIDs Table - Normalized */}
      {ssidData.length > 0 && (
        <section
          aria-labelledby="ssids-table-title"
          className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]"
        >
          <h3
            id="ssids-table-title"
            className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4"
          >
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
                    <Wifi
                      className="w-4 h-4 text-purple-500 dark:text-purple-400"
                      aria-hidden="true"
                    />
                    <span className="font-medium text-[var(--text-primary)]">{s.essid}</span>
                    {s.isGuest && <Badge variant="warning">Guest</Badge>}
                  </div>
                ),
              },
              {
                key: "aps",
                header: "Access Points",
                sortValue: (s) => s.aps.length,
                render: (s) => (
                  <div className="flex flex-wrap gap-1">
                    {s.aps.map((ap) => (
                      <Badge key={ap} variant="neutral">
                        {ap}
                      </Badge>
                    ))}
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
                            className="inline-block px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-xs"
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
                            className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.channels["6GHz"].length > 0 && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-cyan-600 w-12">6E:</span>
                        {s.channels["6GHz"].map((ch) => (
                          <span
                            key={ch}
                            className="inline-block px-1.5 py-0.5 bg-cyan-50 text-cyan-700 rounded text-xs"
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
                    <span className="text-lg font-semibold text-[var(--text-primary)]">
                      {s.clientCount}
                    </span>
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
            ]}
          />
        </section>
      )}
    </div>
  );
}
