import { useParams, useNavigate } from "react-router-dom";
import { Wifi, Users, Radio, Signal, Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/common/Badge";
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { DataTable } from "@/components/common/DataTable";
import { ClientList } from "@/components/common/ClientList";
import { CLIENT_COLUMN_PRESETS } from "@/components/common/clientListPresets";
import { BandwidthChart } from "@/components/charts/BandwidthChart";
import { getTooltipStyle } from "@/lib/chartConfig";
import { useSSIDVAPs, useSSIDClients } from "@/hooks/useNetworkData";
import {
  useSSIDClientsHistory,
  useSSIDBandwidthHistory,
  useSSIDQualityHistory,
} from "@/hooks/useHistoricalData";
import { useTimeRangeState } from "@/hooks/useTimeRangeState";
import { formatBytes, getSignalQuality, getSignalDomain, formatChartTime } from "@/lib/format";
import { CHART_HEIGHT } from "@/lib/config";
import { TIME_RANGES_DETAIL } from "@/lib/timeRanges";
import { getBandFromRadioTag, getSSIDWiFiCapability } from "@/lib/wifi";
import { useChartColors } from "@/hooks/useChartColors";
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

export function SSIDDetail() {
  const { essid } = useParams<{ essid: string }>();
  const navigate = useNavigate();
  const { timeRange, setTimeRange, interval } = useTimeRangeState(TIME_RANGES_DETAIL);
  const chartColors = useChartColors();
  const decodedEssid = decodeURIComponent(essid || "");

  // Data hooks
  const { data: vaps = [], isLoading: vapsLoading } = useSSIDVAPs(decodedEssid);
  const { data: clients = [], isLoading: clientsLoading } = useSSIDClients(decodedEssid);
  const { data: clientsHistory = [] } = useSSIDClientsHistory(
    decodedEssid,
    timeRange.value,
    interval
  );
  const { data: bandwidthHistory = [] } = useSSIDBandwidthHistory(
    decodedEssid,
    timeRange.value,
    interval
  );
  const { data: qualityHistory = [] } = useSSIDQualityHistory(
    decodedEssid,
    timeRange.value,
    interval
  );

  // Aggregate stats
  const totalClients = vaps.reduce((sum, v) => sum + v.numSta, 0);
  const totalRx = vaps.reduce((sum, v) => sum + v.rxBytes, 0);
  const totalTx = vaps.reduce((sum, v) => sum + v.txBytes, 0);
  const avgSignal =
    vaps.length > 0 ? vaps.reduce((sum, v) => sum + (v.avgClientSignal || 0), 0) / vaps.length : 0;
  const avgSatisfaction =
    vaps.length > 0 ? vaps.reduce((sum, v) => sum + (v.satisfaction || 0), 0) / vaps.length : 0;
  const avgCcq = vaps.length > 0 ? vaps.reduce((sum, v) => sum + (v.ccq || 0), 0) / vaps.length : 0;

  // Group VAPs by band using radio tag (more accurate than channel)
  const vaps2g = vaps.filter((v) => getBandFromRadioTag(v.radio) === "2.4GHz");
  const vaps5g = vaps.filter((v) => getBandFromRadioTag(v.radio) === "5GHz");
  const vaps6e = vaps.filter((v) => getBandFromRadioTag(v.radio) === "6GHz");

  // Determine WiFi capability based on radio tags and connected client protocols
  const radioTags = vaps.map((v) => v.radio);
  const clientProtos = clients.map((c) => c.radioProto);
  const wifiCapability = getSSIDWiFiCapability(radioTags, clientProtos);

  const isLoading = vapsLoading || clientsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Build band summary for description
  const bandParts: string[] = [];
  if (vaps2g.length > 0) bandParts.push("2.4GHz");
  if (vaps5g.length > 0) bandParts.push("5GHz");
  if (vaps6e.length > 0) bandParts.push("6GHz");
  const bandSummary = bandParts.join(", ");

  // Get badge variant for WiFi capability
  const getWifiVariant = (
    cap: string | null
  ): "success" | "info" | "neutral" | "warning" | undefined => {
    if (!cap) return undefined;
    if (cap === "WiFi 7") return "success";
    if (cap === "WiFi 6E" || cap === "WiFi 6") return "info";
    if (cap === "WiFi 5") return "neutral";
    return "warning";
  };

  return (
    <div>
      <PageHeader
        title={decodedEssid}
        description={`Broadcasting on ${bandSummary} across ${new Set(vaps.map((v) => v.apName)).size} access points`}
        breadcrumb="Networks"
        actions={
          wifiCapability ? (
            <Badge variant={getWifiVariant(wifiCapability)}>{wifiCapability}</Badge>
          ) : undefined
        }
      />

      {/* Time Range Selector */}
      <div className="flex justify-end mb-6">
        <TimeRangeSelector
          ranges={TIME_RANGES_DETAIL}
          selected={timeRange}
          onChange={setTimeRange}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="Connected Clients"
          value={totalClients}
          icon={Users}
          iconBg="bg-purple-500/10 dark:bg-purple-500/20"
        />
        <StatCard
          title="Access Points"
          value={new Set(vaps.map((v) => v.apName)).size}
          icon={Wifi}
          iconBg="bg-blue-500/10 dark:bg-blue-500/20"
        />
        <StatCard
          title="Avg Signal"
          value={avgSignal ? `${avgSignal.toFixed(0)} dBm` : "—"}
          icon={Signal}
          iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
        />
        <StatCard
          title="Satisfaction"
          value={avgSatisfaction ? `${avgSatisfaction.toFixed(0)}%` : "—"}
          icon={Activity}
          iconBg="bg-amber-500/10 dark:bg-amber-500/20"
        />
        <StatCard
          title="Avg CCQ"
          value={avgCcq ? `${avgCcq.toFixed(0)}%` : "—"}
          icon={Radio}
          iconBg="bg-pink-500/10 dark:bg-pink-500/20"
        />
        <StatCard
          title="Total Traffic"
          value={formatBytes(totalRx + totalTx)}
          icon={Activity}
          iconBg="bg-teal-500/10 dark:bg-teal-500/20"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Clients Over Time */}
        {clientsHistory.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
              Connected Clients
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
                  dataKey="clients"
                  stroke="#A78BFA"
                  fill="#A78BFA"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  name="Clients"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bandwidth */}
        {bandwidthHistory.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Bandwidth</h3>
            <BandwidthChart data={bandwidthHistory} height={CHART_HEIGHT.md} />
          </div>
        )}
      </div>

      {/* Signal & Satisfaction Chart */}
      {qualityHistory.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)] mb-8">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">
            Signal & Satisfaction
          </h3>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
            <LineChart data={qualityHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis
                dataKey="time"
                tickFormatter={formatChartTime}
                stroke={chartColors.axisLine}
                tick={{ fill: chartColors.tickText }}
                fontSize={12}
              />
              <YAxis
                yAxisId="signal"
                stroke={chartColors.axisLine}
                tick={{ fill: chartColors.tickText }}
                fontSize={12}
                domain={([dataMin, dataMax]) => getSignalDomain(dataMin, dataMax)}
                tickFormatter={(v) => `${v}`}
              />
              <YAxis
                yAxisId="satisfaction"
                orientation="right"
                stroke={chartColors.axisLine}
                tick={{ fill: chartColors.tickText }}
                fontSize={12}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                labelFormatter={(label) => new Date(label).toLocaleString()}
                formatter={(value: number, name: string) => {
                  if (name === "Avg Signal") return [`${value.toFixed(1)} dBm`];
                  return [`${value.toFixed(1)}%`];
                }}
                {...getTooltipStyle(chartColors)}
              />
              <Legend />
              <Line
                yAxisId="signal"
                type="monotone"
                dataKey="avgSignal"
                stroke="#A78BFA"
                strokeWidth={2}
                dot={false}
                name="Avg Signal"
              />
              <Line
                yAxisId="satisfaction"
                type="monotone"
                dataKey="satisfaction"
                stroke="#34D399"
                strokeWidth={2}
                dot={false}
                name="Satisfaction"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* VAPs by Band */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {/* 2.4GHz VAPs */}
        {vaps2g.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                <Radio className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold">2.4 GHz</h3>
              <Badge variant="warning">{vaps2g.length} radios</Badge>
            </div>
            <DataTable
              data={vaps2g}
              keyExtractor={(v) => `${v.apName}-${v.radio}`}
              onRowClick={(v) => navigate(`/access-points/${encodeURIComponent(v.apName)}`)}
              columns={[
                {
                  key: "ap",
                  header: "Access Point",
                  sortValue: (v) => v.apName.toLowerCase(),
                  render: (v) => (
                    <div>
                      <div className="font-medium">{v.apName}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Ch {v.channel}</div>
                    </div>
                  ),
                },
                {
                  key: "clients",
                  header: "Clients",
                  sortValue: (v) => v.numSta,
                  render: (v) => v.numSta,
                },
                {
                  key: "signal",
                  header: "Signal",
                  sortValue: (v) => v.avgClientSignal || -100,
                  render: (v) => {
                    if (!v.avgClientSignal) return "—";
                    const quality = getSignalQuality(v.avgClientSignal);
                    return (
                      <span className={quality.color}>{v.avgClientSignal.toFixed(0)} dBm</span>
                    );
                  },
                },
                {
                  key: "txPower",
                  header: "TX",
                  sortValue: (v) => v.txPower,
                  render: (v) => `${v.txPower}`,
                },
              ]}
            />
          </div>
        )}

        {/* 5GHz VAPs */}
        {vaps5g.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                <Radio className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold">5 GHz</h3>
              <Badge variant="info">{vaps5g.length} radios</Badge>
            </div>
            <DataTable
              data={vaps5g}
              keyExtractor={(v) => `${v.apName}-${v.radio}`}
              onRowClick={(v) => navigate(`/access-points/${encodeURIComponent(v.apName)}`)}
              columns={[
                {
                  key: "ap",
                  header: "Access Point",
                  sortValue: (v) => v.apName.toLowerCase(),
                  render: (v) => (
                    <div>
                      <div className="font-medium">{v.apName}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Ch {v.channel}</div>
                    </div>
                  ),
                },
                {
                  key: "clients",
                  header: "Clients",
                  sortValue: (v) => v.numSta,
                  render: (v) => v.numSta,
                },
                {
                  key: "signal",
                  header: "Signal",
                  sortValue: (v) => v.avgClientSignal || -100,
                  render: (v) => {
                    if (!v.avgClientSignal) return "—";
                    const quality = getSignalQuality(v.avgClientSignal);
                    return (
                      <span className={quality.color}>{v.avgClientSignal.toFixed(0)} dBm</span>
                    );
                  },
                },
                {
                  key: "txPower",
                  header: "TX",
                  sortValue: (v) => v.txPower,
                  render: (v) => `${v.txPower}`,
                },
              ]}
            />
          </div>
        )}

        {/* 6GHz VAPs (WiFi 6E) */}
        {vaps6e.length > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                <Radio className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold">6 GHz</h3>
              <Badge variant="success">{vaps6e.length} radios</Badge>
              <Badge variant="info">WiFi 6E</Badge>
            </div>
            <DataTable
              data={vaps6e}
              keyExtractor={(v) => `${v.apName}-${v.radio}`}
              onRowClick={(v) => navigate(`/access-points/${encodeURIComponent(v.apName)}`)}
              columns={[
                {
                  key: "ap",
                  header: "Access Point",
                  sortValue: (v) => v.apName.toLowerCase(),
                  render: (v) => (
                    <div>
                      <div className="font-medium">{v.apName}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Ch {v.channel}</div>
                    </div>
                  ),
                },
                {
                  key: "clients",
                  header: "Clients",
                  sortValue: (v) => v.numSta,
                  render: (v) => v.numSta,
                },
                {
                  key: "signal",
                  header: "Signal",
                  sortValue: (v) => v.avgClientSignal || -100,
                  render: (v) => {
                    if (!v.avgClientSignal) return "—";
                    const quality = getSignalQuality(v.avgClientSignal);
                    return (
                      <span className={quality.color}>{v.avgClientSignal.toFixed(0)} dBm</span>
                    );
                  },
                },
                {
                  key: "txPower",
                  header: "TX",
                  sortValue: (v) => v.txPower,
                  render: (v) => `${v.txPower}`,
                },
              ]}
            />
          </div>
        )}
      </div>

      {/* Connected Clients */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
        <h3 className="text-lg font-semibold font-[var(--font-display)] mb-4">Connected Clients</h3>
        {clients.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-tertiary)]">
            No clients currently connected to this SSID
          </div>
        ) : (
          <ClientList
            clients={clients}
            onClientClick={(c) => navigate(`/clients/${encodeURIComponent(c.mac)}`)}
            columns={CLIENT_COLUMN_PRESETS.ssidDetail}
            defaultSortKey="usage"
            defaultSortDir="desc"
          />
        )}
      </div>
    </div>
  );
}
