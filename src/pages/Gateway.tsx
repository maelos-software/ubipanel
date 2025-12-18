import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Thermometer,
  Clock,
  Network,
  Globe,
  Users,
  Gauge,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { SortableHeader } from "@/components/common/SortableHeader";
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { MultiWANChart } from "@/components/charts/MultiWANChart";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { getTooltipStyle } from "@/lib/chartConfig";
import { useGateway, useWANPorts, useUSGNetworks } from "@/hooks/useNetworkData";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { useMultiWANBandwidthHistory } from "@/hooks/useHistoricalData";
import { useTimeRangeState } from "@/hooks/useTimeRangeState";
import { useQuery } from "@tanstack/react-query";
import { useSortableData } from "@/hooks/useSortableData";
import { formatBytes, formatBytesRate, formatUptime, formatTemp } from "@/lib/format";
import { useChartColors } from "@/hooks/useChartColors";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { USGNetwork } from "@/types/influx";
import { CHART_COLORS } from "@/config/theme";
import { CHART_HEIGHT } from "@/lib/config";
import { TIME_RANGES_EXTENDED } from "@/lib/timeRanges";

/**
 * Gateway page - UniFi Security Gateway details
 *
 * Displays:
 * - WAN port status (active, standby, failover)
 * - Multi-WAN bandwidth history chart
 * - System stats (CPU, memory, temperature, load)
 * - Network/VLAN configuration and client counts
 * - Recent WAN failover events
 *
 * @route /gateway
 */

const COLORS = CHART_COLORS.vivid;

// Extract VLAN from IP (e.g., 192.168.8.1 -> 8)
const getVlanFromIp = (ip: string): number => {
  const parts = ip.split(".");
  return parts.length >= 3 ? parseInt(parts[2]) : 0;
};

// Column definitions for networks table sorting
const networkColumns = [
  { key: "name", sortValue: (n: USGNetwork) => n.name },
  { key: "vlan", sortValue: (n: USGNetwork) => getVlanFromIp(n.ip) },
  { key: "ip", sortValue: (n: USGNetwork) => n.ip },
  { key: "numSta", sortValue: (n: USGNetwork) => n.numSta },
  { key: "traffic", sortValue: (n: USGNetwork) => n.rxBytes + n.txBytes },
];

export function Gateway() {
  const navigate = useNavigate();
  const { timeRange, setTimeRange, interval } = useTimeRangeState(TIME_RANGES_EXTENDED);
  const chartColors = useChartColors();
  const { data: gateway, isLoading } = useGateway();
  const { data: wanPorts = [] } = useWANPorts();
  const { data: networks = [] } = useUSGNetworks();

  const { data: wanHistoryData } = useMultiWANBandwidthHistory(timeRange.value, interval);

  // Fetch WAN transition events
  const { data: wanEvents = [] } = useQuery({
    queryKey: ["wanEvents"],
    queryFn: async () => {
      const response = await queryInflux(`
        SELECT time, msg FROM unifi_events 
        WHERE "key" = 'EVT_GW_WANTransition' AND time > now() - 7d
        ORDER BY time DESC
        LIMIT 20
      `);
      const series = response.results[0]?.series?.[0];
      if (!series) return [];
      return series.values.map((v: unknown[]) => ({
        time: v[0] as string,
        msg: v[1] as string,
      }));
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Sortable networks data
  const {
    sortedData: sortedNetworks,
    sortKey: networkSortKey,
    sortDir: networkSortDir,
    handleSort: handleNetworkSort,
  } = useSortableData(networks, networkColumns, "name");

  // Calculate network pie chart data
  const networkPieData = networks
    .filter((n) => n.numSta > 0)
    .map((n) => ({ name: n.name, value: n.numSta }))
    .sort((a, b) => b.value - a.value);

  const totalClients = networks.reduce((sum, n) => sum + n.numSta, 0);
  const activePort = wanPorts.find((p) => p.isUplink);

  if (isLoading || !gateway) {
    return (
      <div>
        <PageHeader title="Gateway" breadcrumb="Network" />
        <div className="text-center py-12 text-[var(--text-tertiary)]">Loading gateway data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gateway"
        description={`${gateway.name} · ${gateway.model}`}
        breadcrumb="Network"
        actions={
          <Badge variant={gateway.state === 1 ? "success" : "warning"}>
            {gateway.state === 1 ? "Online" : "Offline"}
          </Badge>
        }
      />

      {/* WAN Ports - Primary Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {wanPorts.map((port) => (
          <div
            key={port.ifname}
            onClick={() => navigate(`/gateway/wan/${encodeURIComponent(port.ifname)}`)}
            className={`rounded-2xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md ${
              port.isUplink
                ? "bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-emerald-900/50 ring-2 ring-emerald-500"
                : port.up
                  ? "bg-[var(--bg-secondary)] ring-1 ring-[var(--border-primary)] hover:ring-[var(--text-muted)]"
                  : "bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-primary)] opacity-60"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    port.isUplink
                      ? "bg-emerald-500"
                      : port.up
                        ? "bg-[var(--bg-tertiary)]"
                        : "bg-[var(--bg-tertiary)]"
                  }`}
                >
                  <Globe
                    className={`w-6 h-6 ${port.isUplink ? "text-white" : "text-[var(--text-tertiary)]"}`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className={`font-semibold text-lg ${port.isUplink ? "text-gray-900 dark:text-white" : "text-[var(--text-primary)]"}`}
                    >
                      {port.ifname}
                    </h3>
                    {port.isUplink && <Badge variant="success">Active</Badge>}
                    {!port.isUplink && port.up && <Badge variant="neutral">Standby</Badge>}
                    {!port.up && <Badge variant="warning">Down</Badge>}
                  </div>
                  <p
                    className={`text-sm font-mono ${port.isUplink ? "text-gray-600 dark:text-emerald-200" : "text-[var(--text-tertiary)]"}`}
                  >
                    {port.ip || "No IP assigned"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div
                    className={`text-sm font-medium ${port.isUplink ? "text-gray-600 dark:text-emerald-200" : "text-[var(--text-tertiary)]"}`}
                  >
                    {port.speed > 0 ? `${port.speed} Mbps` : "—"}
                  </div>
                  <div
                    className={`text-xs ${port.isUplink ? "text-gray-500 dark:text-emerald-300/70" : "text-[var(--text-tertiary)]"}`}
                  >
                    {port.fullDuplex ? "Full Duplex" : "Half Duplex"}
                  </div>
                </div>
                <ChevronRight
                  className={`w-5 h-5 ${port.isUplink ? "text-gray-400 dark:text-emerald-300" : "text-[var(--text-tertiary)]"}`}
                />
              </div>
            </div>

            {/* Bandwidth Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-xl p-3 bg-emerald-500/10 dark:bg-emerald-900/40 border border-emerald-500/20 dark:border-emerald-500/30">
                <div className="flex items-center gap-1 text-xs mb-1 text-emerald-600 dark:text-emerald-300">
                  <ArrowDown className="w-3 h-3" />
                  Download
                </div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-100">
                  {formatBytesRate(port.rxBytesR)}
                </div>
                <div className="text-xs text-emerald-600/70 dark:text-emerald-300/70">
                  {formatBytes(port.rxBytes)} total
                </div>
              </div>
              <div className="rounded-xl p-3 bg-blue-500/10 dark:bg-blue-900/40 border border-blue-500/20 dark:border-blue-500/30">
                <div className="flex items-center gap-1 text-xs mb-1 text-blue-600 dark:text-blue-300">
                  <ArrowUp className="w-3 h-3" />
                  Upload
                </div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-100">
                  {formatBytesRate(port.txBytesR)}
                </div>
                <div className="text-xs text-blue-600/70 dark:text-blue-300/70">
                  {formatBytes(port.txBytes)} total
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div
              className={`flex flex-wrap gap-x-4 gap-y-1 text-xs pt-3 border-t ${port.isUplink ? "border-emerald-500/30 text-gray-600 dark:text-emerald-200/80" : "border-[var(--border-primary)] text-[var(--text-secondary)]"}`}
            >
              <span>
                Errors:{" "}
                <span
                  className={port.rxErrors + port.txErrors > 0 ? "text-red-400 font-medium" : ""}
                >
                  {port.rxErrors + port.txErrors}
                </span>
              </span>
              <span>
                Dropped:{" "}
                <span
                  className={
                    port.rxDropped + port.txDropped > 0 ? "text-amber-400 font-medium" : ""
                  }
                >
                  {port.rxDropped + port.txDropped}
                </span>
              </span>
              <span>
                Packets: {(port.rxPackets / 1000000).toFixed(1)}M /{" "}
                {(port.txPackets / 1000000).toFixed(1)}M
              </span>
              <span className="hidden sm:inline font-mono">MAC: {port.mac}</span>
            </div>
          </div>
        ))}
      </div>

      {/* WAN Bandwidth History Chart */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]">
            WAN Bandwidth History
          </h2>
          <TimeRangeSelector
            ranges={TIME_RANGES_EXTENDED}
            selected={timeRange}
            onChange={setTimeRange}
            size="sm"
          />
        </div>
        {wanHistoryData && wanHistoryData.data.length > 0 ? (
          <MultiWANChart
            data={wanHistoryData.data}
            ifnames={wanHistoryData.ifnames}
            activeIfname={activePort?.ifname}
            height={CHART_HEIGHT.xl}
          />
        ) : (
          <div className="h-[280px] flex items-center justify-center text-[var(--text-muted)]">
            No bandwidth history available
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-[var(--text-tertiary)]">Uptime</span>
          </div>
          <div className="text-xl font-bold font-[var(--font-display)]">
            {formatUptime(gateway.systemUptime)}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-[var(--text-tertiary)]">Clients</span>
          </div>
          <div className="text-xl font-bold font-[var(--font-display)]">
            {gateway.numUserSta + gateway.numGuestSta}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">{gateway.numGuestSta} guests</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <Network className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-[var(--text-tertiary)]">Networks</span>
          </div>
          <div className="text-xl font-bold font-[var(--font-display)]">{networks.length}</div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {networks.filter((n) => n.isGuest).length} guest
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span className="text-xs text-[var(--text-tertiary)]">WAN Ports</span>
          </div>
          <div className="text-xl font-bold font-[var(--font-display)]">{wanPorts.length}</div>
          <div className="text-xs text-[var(--text-tertiary)]">
            {wanPorts.filter((p) => p.up).length} up
          </div>
        </div>
      </div>

      {/* Clients by Network & WAN Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clients by Network */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Clients by Network
          </h2>
          {networkPieData.length > 0 ? (
            <div className="flex items-center">
              <div className="w-44 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={networkPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {networkPieData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke={chartColors.tooltipBg}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} clients`, name]}
                      {...getTooltipStyle(chartColors)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 ml-4 space-y-2">
                {networkPieData.map((network, index) => (
                  <div key={network.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <span className="text-sm text-[var(--text-tertiary)]">{network.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{network.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-[var(--border-primary)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-tertiary)]">Total</span>
                    <span className="text-sm font-bold">{totalClients}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-[var(--text-muted)]">
              No network data available
            </div>
          )}
        </div>

        {/* WAN Events */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Recent WAN Events
          </h2>
          {wanEvents.length > 0 ? (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {wanEvents.map((event, idx) => {
                const isActive = event.msg.includes("state active");
                const isFailover = event.msg.includes("state failover");
                const isInactive = event.msg.includes("state inactive");

                // Extract interface name (e.g., "eth10" from the message)
                const ifaceMatch = event.msg.match(/iface (\w+)/);
                const iface = ifaceMatch ? ifaceMatch[1] : "WAN";

                // Use the interface name directly (no hardcoded mapping)
                const wanName = iface;

                return (
                  <div
                    key={`${event.time}-${idx}`}
                    className={`flex items-center gap-3 p-2 rounded-lg text-sm ${
                      isActive
                        ? "bg-emerald-500/10 dark:bg-emerald-500/20"
                        : isFailover
                          ? "bg-amber-500/10 dark:bg-amber-500/20"
                          : isInactive
                            ? "bg-[var(--bg-tertiary)]"
                            : "bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    {isActive ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : isFailover ? (
                      <RefreshCw className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    ) : isInactive ? (
                      <XCircle className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{wanName}</span>
                      <span className="text-[var(--text-tertiary)] ml-1">
                        →{" "}
                        {isActive
                          ? "active"
                          : isFailover
                            ? "failover"
                            : isInactive
                              ? "inactive"
                              : "unknown"}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0">
                      {new Date(event.time).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-[var(--text-muted)]">
              <div className="text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-300" />
                <p>No WAN events in the last 7 days</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Network Details Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
          Networks
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-tertiary)]">
                <SortableHeader
                  label="Network"
                  sortKey="name"
                  currentSortKey={networkSortKey}
                  currentSortDir={networkSortDir}
                  onSort={handleNetworkSort}
                />
                <SortableHeader
                  label="VLAN"
                  sortKey="vlan"
                  currentSortKey={networkSortKey}
                  currentSortDir={networkSortDir}
                  onSort={handleNetworkSort}
                  align="center"
                />
                <SortableHeader
                  label="Subnet"
                  sortKey="ip"
                  currentSortKey={networkSortKey}
                  currentSortDir={networkSortDir}
                  onSort={handleNetworkSort}
                />
                <SortableHeader
                  label="Clients"
                  sortKey="numSta"
                  currentSortKey={networkSortKey}
                  currentSortDir={networkSortDir}
                  onSort={handleNetworkSort}
                  align="center"
                />
                <SortableHeader
                  label="Total Traffic"
                  sortKey="traffic"
                  currentSortKey={networkSortKey}
                  currentSortDir={networkSortDir}
                  onSort={handleNetworkSort}
                  align="right"
                />
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {sortedNetworks.map((network) => {
                const vlan = getVlanFromIp(network.ip);
                const totalTraffic = network.rxBytes + network.txBytes;
                const maxTraffic = Math.max(...networks.map((n) => n.rxBytes + n.txBytes));
                const trafficPercent = maxTraffic > 0 ? (totalTraffic / maxTraffic) * 100 : 0;

                return (
                  <tr
                    key={network.name}
                    onClick={() => navigate(`/clients?vlan=${vlan}`)}
                    className="hover:bg-purple-500/10 dark:hover:bg-purple-500/20 cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            network.isGuest
                              ? "bg-amber-400"
                              : network.numSta > 0
                                ? "bg-emerald-400"
                                : "bg-[var(--bg-tertiary)]"
                          }`}
                        />
                        <span className="font-medium">{network.name}</span>
                        {network.isGuest && <Badge variant="warning">Guest</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-xs font-mono font-medium text-slate-700 dark:text-slate-200">
                        {vlan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-[var(--text-tertiary)]">
                      {network.ip.replace(/\.\d+$/, ".0/24")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {network.numSta > 0 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-medium">
                          {network.numSta}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <div className="w-24 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-400 rounded-full"
                            style={{ width: `${trafficPercent}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono text-[var(--text-tertiary)] w-20 text-right">
                          {formatBytes(totalTraffic)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-purple-500" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Information - Moved to bottom */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
          System Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {/* CPU & Memory Gauges */}
          <div className="flex flex-col items-center">
            <GaugeChart value={gateway.cpu} label="CPU" size="sm" />
          </div>
          <div className="flex flex-col items-center">
            <GaugeChart
              value={gateway.mem}
              label="Memory"
              size="sm"
              color={CHART_COLORS.semantic.info}
            />
          </div>

          {/* Temp */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-[var(--text-tertiary)]">CPU Temp</span>
            </div>
            <div className="text-xl font-bold font-[var(--font-display)]">
              {gateway.tempCpu > 0 ? formatTemp(gateway.tempCpu) : "—"}
            </div>
            {gateway.tempLocal > 0 && (
              <div className="text-xs text-[var(--text-tertiary)]">
                Board: {formatTemp(gateway.tempLocal)}
              </div>
            )}
          </div>

          {/* Load */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-[var(--text-tertiary)]">Load Avg</span>
            </div>
            <div className="text-xl font-bold font-[var(--font-display)]">
              {gateway.loadavg1.toFixed(2)}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              {gateway.loadavg5.toFixed(2)} / {gateway.loadavg15.toFixed(2)}
            </div>
          </div>

          {/* Model/Version */}
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Model
            </div>
            <div className="font-medium text-sm">{gateway.model}</div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">{gateway.version}</div>
          </div>

          {/* Memory Details */}
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Memory Used
            </div>
            <div className="font-medium text-sm">
              {gateway.memUsed > 0 ? formatBytes(gateway.memUsed) : "—"}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">
              of {formatBytes(gateway.memTotal)}
            </div>
          </div>
        </div>

        {/* Additional System Info */}
        <div className="mt-6 pt-4 border-t border-[var(--border-primary)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-[var(--text-tertiary)]">IP:</span>{" "}
            <span className="font-mono">{gateway.ip || "—"}</span>
          </div>
          <div>
            <span className="text-[var(--text-tertiary)]">MAC:</span>{" "}
            <span className="font-mono text-xs">{gateway.mac}</span>
          </div>
          {gateway.storageBackupSize > 0 && (
            <>
              <div>
                <span className="text-[var(--text-tertiary)]">Backup:</span>{" "}
                {gateway.storageBackupPct.toFixed(1)}% of {formatBytes(gateway.storageBackupSize)}
              </div>
              <div>
                <span className="text-[var(--text-tertiary)]">Temp Storage:</span>{" "}
                {gateway.storageTempPct.toFixed(1)}% of {formatBytes(gateway.storageTempSize)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
