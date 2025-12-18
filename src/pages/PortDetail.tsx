import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Network,
  Zap,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Activity,
  Package,
  Radio,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { StatCard } from "@/components/common/StatCard";
import { BandwidthChart } from "@/components/charts/BandwidthChart";
import { getTooltipStyle } from "@/lib/chartConfig";
import { ClientList } from "@/components/common/ClientList";
import { CLIENT_COLUMN_PRESETS } from "@/components/common/clientListPresets";
import { useClients } from "@/hooks/useNetworkData";
import {
  useSwitchPortHistory,
  useSwitchPortPoeHistory,
  useSwitchPortPacketsHistory,
} from "@/hooks/useHistoricalData";
import { useTimeRangeState } from "@/hooks/useTimeRangeState";
import { queryInflux, escapeInfluxString } from "@/lib/influx";
import { REFETCH_INTERVAL, CHART_HEIGHT } from "@/lib/config";
import { TIME_RANGES_DETAIL } from "@/lib/timeRanges";
import { formatBytes, formatBytesRate, formatChartTime } from "@/lib/format";
import { useChartColors } from "@/hooks/useChartColors";

interface PortData {
  portIdx: number;
  name: string;
  speed: number;
  media: string;
  portId: string;
  poeMode: string;
  poeEnable: boolean;
  portPoe: boolean;
  rxBytes: number;
  txBytes: number;
  rxBytesR: number;
  txBytesR: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  rxBroadcast: number;
  txBroadcast: number;
  rxMulticast: number;
  txMulticast: number;
  rxPackets: number;
  txPackets: number;
  poePower: number;
  poeVoltage: number;
  poeCurrent: number;
  stpPathcost: number;
  // SFP data
  hasSfp: boolean;
  sfpVendor: string;
  sfpPart: string;
  sfpSerial: string;
  sfpCompliance: string;
  sfpTemperature: number;
  sfpVoltage: number;
  sfpCurrent: number;
  sfpTxPower: number;
  sfpRxPower: number;
}

export function PortDetail() {
  const { swName, portIdx } = useParams<{ swName: string; portIdx: string }>();
  const navigate = useNavigate();
  const { timeRange, setTimeRange, interval } = useTimeRangeState(TIME_RANGES_DETAIL);
  const chartColors = useChartColors();

  const decodedSwName = decodeURIComponent(swName || "");
  const portNum = parseInt(portIdx || "0");

  // Get current port data
  // Uses LAST-FIRST pattern to calculate actual 24h traffic, not cumulative counters
  const { data: port, isLoading } = useQuery({
    queryKey: ["portDetail", decodedSwName, portNum],
    queryFn: async () => {
      // Query 1: Get current port state
      const currentResponse = await queryInflux(`
        SELECT last(speed) as speed,
               last("rx_bytes-r") as rx_bytes_r, last("tx_bytes-r") as tx_bytes_r,
               last(rx_errors) as rx_errors, last(tx_errors) as tx_errors,
               last(rx_dropped) as rx_dropped, last(tx_dropped) as tx_dropped,
               last(rx_broadcast) as rx_broadcast, last(tx_broadcast) as tx_broadcast,
               last(rx_multicast) as rx_multicast, last(tx_multicast) as tx_multicast,
               last(rx_packets) as rx_packets, last(tx_packets) as tx_packets,
               last(poe_power) as poe_power, last(poe_voltage) as poe_voltage, last(poe_current) as poe_current,
               last(stp_pathcost) as stp_pathcost,
               last(sfp_temperature) as sfp_temp, last(sfp_voltage) as sfp_voltage,
               last(sfp_current) as sfp_current, last(sfp_txpower) as sfp_txpower, last(sfp_rxpower) as sfp_rxpower
        FROM usw_ports
        WHERE time > now() - 5m AND "device_name" = '${escapeInfluxString(decodedSwName)}' AND "port_idx" = '${portNum}'
        GROUP BY "name", "media", "port_id", "poe_mode", "poe_enable", "port_poe", "has_sfp", "sfp_vendor", "sfp_part", "sfp_serial", "sfp_compliance"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST (24h)
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM usw_ports
        WHERE time > now() - 24h AND "device_name" = '${escapeInfluxString(decodedSwName)}' AND "port_idx" = '${portNum}'
      `);

      const series = currentResponse.results[0]?.series?.[0];
      if (!series) return null;

      const trafficSeries = trafficResponse.results?.[0]?.series?.[0];
      const trafficCols = trafficSeries?.columns || [];
      const trafficVals = trafficSeries?.values?.[0] || [];
      const getTrafficVal = (k: string) => {
        const idx = trafficCols.indexOf(k);
        return idx >= 0 ? Math.max(0, (trafficVals[idx] as number) || 0) : 0;
      };

      const tags = series.tags || {};
      const cols = series.columns;
      const vals = series.values[0] || [];
      const getValue = (key: string) => {
        const idx = cols.indexOf(key);
        return idx >= 0 ? vals[idx] : null;
      };

      return {
        portIdx: portNum,
        name: tags.name || "",
        media: tags.media || "",
        portId: tags.port_id || "",
        poeMode: tags.poe_mode || "",
        poeEnable: tags.poe_enable === "true",
        portPoe: tags.port_poe === "true",
        speed: (getValue("speed") as number) || 0,
        rxBytes: getTrafficVal("rx_bytes"),
        txBytes: getTrafficVal("tx_bytes"),
        rxBytesR: (getValue("rx_bytes_r") as number) || 0,
        txBytesR: (getValue("tx_bytes_r") as number) || 0,
        rxErrors: (getValue("rx_errors") as number) || 0,
        txErrors: (getValue("tx_errors") as number) || 0,
        rxDropped: (getValue("rx_dropped") as number) || 0,
        txDropped: (getValue("tx_dropped") as number) || 0,
        rxBroadcast: (getValue("rx_broadcast") as number) || 0,
        txBroadcast: (getValue("tx_broadcast") as number) || 0,
        rxMulticast: (getValue("rx_multicast") as number) || 0,
        txMulticast: (getValue("tx_multicast") as number) || 0,
        rxPackets: (getValue("rx_packets") as number) || 0,
        txPackets: (getValue("tx_packets") as number) || 0,
        poePower: (getValue("poe_power") as number) || 0,
        poeVoltage: (getValue("poe_voltage") as number) || 0,
        poeCurrent: (getValue("poe_current") as number) || 0,
        stpPathcost: (getValue("stp_pathcost") as number) || 0,
        hasSfp: tags.has_sfp === "true",
        sfpVendor: tags.sfp_vendor || "",
        sfpPart: tags.sfp_part || "",
        sfpSerial: tags.sfp_serial || "",
        sfpCompliance: tags.sfp_compliance || "",
        sfpTemperature: (getValue("sfp_temp") as number) || 0,
        sfpVoltage: (getValue("sfp_voltage") as number) || 0,
        sfpCurrent: (getValue("sfp_current") as number) || 0,
        sfpTxPower: (getValue("sfp_txpower") as number) || 0,
        sfpRxPower: (getValue("sfp_rxpower") as number) || 0,
      } as PortData;
    },
    refetchInterval: REFETCH_INTERVAL,
    enabled: !!decodedSwName && portNum > 0,
  });

  // Get connected clients
  const { data: allClients = [] } = useClients();
  const connectedClients = allClients.filter(
    (c) => c.swName === decodedSwName && c.swPort === portNum
  );

  // Historical data
  const { data: bandwidthHistory = [] } = useSwitchPortHistory(
    decodedSwName,
    portNum,
    timeRange.value,
    interval
  );

  const { data: poeHistory = [] } = useSwitchPortPoeHistory(
    decodedSwName,
    portNum,
    timeRange.value,
    interval
  );

  const { data: packetsHistory = [] } = useSwitchPortPacketsHistory(
    decodedSwName,
    portNum,
    timeRange.value,
    interval
  );

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Loading..." breadcrumb="Switches" />
        <div className="text-center py-12 text-[var(--text-tertiary)]">Loading port data...</div>
      </div>
    );
  }

  if (!port) {
    return (
      <div>
        <PageHeader title="Port Not Found" breadcrumb="Switches" />
        <div className="text-center py-12">
          <p className="text-[var(--text-tertiary)] mb-4">
            Port {portNum} on {decodedSwName} could not be found.
          </p>
          <button
            onClick={() => navigate("/switches")}
            className="text-purple-600 hover:text-purple-700 font-medium"
          >
            ← Back to Switches
          </button>
        </div>
      </div>
    );
  }

  const isUp = port.speed > 0;
  const hasErrors = port.rxErrors + port.txErrors > 0;

  // Only show name if it's different from "Port X"
  const displayName = port.name && port.name !== `Port ${port.portIdx}` ? port.name : null;

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <PageHeader
        title={`Port ${port.portIdx}${displayName ? ` - ${displayName}` : ""}`}
        description={`${decodedSwName} · ${port.media || "Ethernet"}`}
        breadcrumb="Switches"
        actions={
          <div className="flex items-center gap-2">
            {hasErrors && <Badge variant="warning">Errors</Badge>}
            <Badge variant={isUp ? "success" : "neutral"}>
              {isUp ? `${port.speed} Mbps` : "Down"}
            </Badge>
          </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          title="TX Rate"
          value={formatBytesRate(port.txBytesR)}
          subtitle={`${formatBytes(port.txBytes)} total`}
          icon={ArrowUp}
          iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
        />
        <StatCard
          title="RX Rate"
          value={formatBytesRate(port.rxBytesR)}
          subtitle={`${formatBytes(port.rxBytes)} total`}
          icon={ArrowDown}
          iconBg="bg-blue-500/10 dark:bg-blue-500/20"
        />
        <StatCard
          title="Packets"
          value={`${(port.rxPackets / 1000000).toFixed(1)}M`}
          subtitle={`TX: ${(port.txPackets / 1000000).toFixed(1)}M`}
          icon={Package}
          iconBg="bg-purple-500/10 dark:bg-purple-500/20"
        />
        <StatCard
          title="Errors"
          value={port.rxErrors + port.txErrors}
          subtitle={`RX: ${port.rxErrors} / TX: ${port.txErrors}`}
          icon={AlertTriangle}
          iconBg={hasErrors ? "bg-red-500/10 dark:bg-red-500/20" : "bg-[var(--bg-tertiary)]"}
        />
        <StatCard
          title="Dropped"
          value={port.rxDropped + port.txDropped}
          subtitle={`RX: ${port.rxDropped} / TX: ${port.txDropped}`}
          icon={Activity}
          iconBg="bg-[var(--bg-tertiary)]"
        />
        {port.poePower > 0 ? (
          <StatCard
            title="PoE Power"
            value={`${port.poePower.toFixed(1)}W`}
            subtitle={`${port.poeVoltage.toFixed(1)}V`}
            icon={Zap}
            iconBg="bg-yellow-500/10 dark:bg-yellow-500/20"
          />
        ) : (
          <StatCard
            title="Connected"
            value={connectedClients.length}
            subtitle="Clients"
            icon={Network}
            iconBg="bg-[var(--bg-tertiary)]"
          />
        )}
      </div>

      {/* Bandwidth Chart */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 mb-6">
        <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
          Bandwidth History
        </h2>
        {bandwidthHistory.length > 0 ? (
          <BandwidthChart
            data={bandwidthHistory}
            height={CHART_HEIGHT.lg}
            labels={{ tx: "TX", rx: "RX" }}
          />
        ) : (
          <div className="h-[250px] flex items-center justify-center text-[var(--text-muted)]">
            No bandwidth data available
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Packets Chart */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Packet Rate
          </h2>
          {packetsHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
              <AreaChart data={packetsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatChartTime}
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={11}
                />
                <YAxis
                  stroke={chartColors.axisLine}
                  tick={{ fill: chartColors.tickText }}
                  fontSize={11}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0))}
                />
                <Tooltip
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(0)} pps`,
                    name === "rxPackets" ? "RX" : "TX",
                  ]}
                  {...getTooltipStyle(chartColors)}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="rxPackets"
                  name="RX"
                  stroke="#10B981"
                  fill="#10B98133"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="txPackets"
                  name="TX"
                  stroke="#3B82F6"
                  fill="#3B82F633"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[var(--text-muted)]">
              No packet data available
            </div>
          )}
        </div>

        {/* PoE Chart (if applicable) */}
        {port.poePower > 0 && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
            <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
              PoE Power History
            </h2>
            {poeHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
                <LineChart data={poeHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={formatChartTime}
                    stroke={chartColors.axisLine}
                    tick={{ fill: chartColors.tickText }}
                    fontSize={11}
                  />
                  <YAxis
                    stroke={chartColors.axisLine}
                    tick={{ fill: chartColors.tickText }}
                    fontSize={11}
                    domain={[0, "auto"]}
                    tickFormatter={(v) => `${v.toFixed(1)}W`}
                  />
                  <Tooltip
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    formatter={(value: number) => [`${value.toFixed(2)}W`, "Power"]}
                    {...getTooltipStyle(chartColors)}
                  />
                  <Line
                    type="monotone"
                    dataKey="power"
                    name="Power"
                    stroke="#EAB308"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[var(--text-muted)]">
                No PoE data available
              </div>
            )}
          </div>
        )}

        {/* Broadcast/Multicast Chart */}
        {!port.poePower && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
            <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
              Broadcast & Multicast
            </h2>
            {packetsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={CHART_HEIGHT.md}>
                <AreaChart data={packetsHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="time"
                    tickFormatter={formatChartTime}
                    stroke={chartColors.axisLine}
                    tick={{ fill: chartColors.tickText }}
                    fontSize={11}
                  />
                  <YAxis
                    stroke={chartColors.axisLine}
                    tick={{ fill: chartColors.tickText }}
                    fontSize={11}
                    tickFormatter={(v) => v.toFixed(0)}
                  />
                  <Tooltip
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    formatter={(value: number, name: string) => [`${value.toFixed(0)} pps`, name]}
                    {...getTooltipStyle(chartColors)}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="rxBroadcast"
                    name="RX Broadcast"
                    stroke="#F59E0B"
                    fill="#F59E0B33"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="rxMulticast"
                    name="RX Multicast"
                    stroke="#8B5CF6"
                    fill="#8B5CF633"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[var(--text-muted)]">
                No packet data available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connected Clients */}
      {connectedClients.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Connected Clients ({connectedClients.length})
          </h2>
          <ClientList
            clients={connectedClients}
            onClientClick={(c) => navigate(`/clients/${c.mac}`)}
            columns={CLIENT_COLUMN_PRESETS.portDetail}
            defaultSortKey="bandwidth"
            defaultSortDir="desc"
          />
        </div>
      )}

      {/* Port Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic Statistics */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Traffic Statistics
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl p-4">
                <div className="text-xs text-emerald-600 uppercase tracking-wider mb-1">
                  TX (Transmit)
                </div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {formatBytes(port.txBytes)}
                </div>
                <div className="text-sm text-[var(--text-tertiary)] mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Packets:</span>
                    <span className="font-mono">{port.txPackets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Broadcast:</span>
                    <span className="font-mono">{port.txBroadcast.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Multicast:</span>
                    <span className="font-mono">{port.txMulticast.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Errors:</span>
                    <span className={`font-mono ${port.txErrors > 0 ? "text-red-600" : ""}`}>
                      {port.txErrors.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dropped:</span>
                    <span className="font-mono">{port.txDropped.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-xl p-4">
                <div className="text-xs text-blue-600 uppercase tracking-wider mb-1">
                  RX (Receive)
                </div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {formatBytes(port.rxBytes)}
                </div>
                <div className="text-sm text-[var(--text-tertiary)] mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Packets:</span>
                    <span className="font-mono">{port.rxPackets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Broadcast:</span>
                    <span className="font-mono">{port.rxBroadcast.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Multicast:</span>
                    <span className="font-mono">{port.rxMulticast.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Errors:</span>
                    <span className={`font-mono ${port.rxErrors > 0 ? "text-red-600" : ""}`}>
                      {port.rxErrors.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dropped:</span>
                    <span className="font-mono">{port.rxDropped.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Port Information */}
        <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Port Information
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-[var(--text-tertiary)]">Port ID</span>
              <span className="font-medium">{port.portId || `Port ${port.portIdx}`}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-[var(--text-tertiary)]">Media Type</span>
              <span className="font-medium">{port.media || "Ethernet"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
              <span className="text-[var(--text-tertiary)]">Link Speed</span>
              <span className="font-medium">{isUp ? `${port.speed} Mbps` : "No Link"}</span>
            </div>
            {port.stpPathcost > 0 && (
              <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                <span className="text-[var(--text-tertiary)]">STP Path Cost</span>
                <span className="font-medium">{port.stpPathcost}</span>
              </div>
            )}
            {port.poeEnable && (
              <>
                <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                  <span className="text-[var(--text-tertiary)]">PoE Mode</span>
                  <Badge variant="info">{port.poeMode}</Badge>
                </div>
                {port.poePower > 0 && (
                  <>
                    <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                      <span className="text-[var(--text-tertiary)]">PoE Power</span>
                      <span className="font-medium text-yellow-600">
                        {port.poePower.toFixed(2)} W
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                      <span className="text-[var(--text-tertiary)]">PoE Voltage</span>
                      <span className="font-medium">{port.poeVoltage.toFixed(1)} V</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[var(--border-primary)]">
                      <span className="text-[var(--text-tertiary)]">PoE Current</span>
                      <span className="font-medium">{(port.poeCurrent * 1000).toFixed(0)} mA</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* SFP Information (if applicable) */}
        {port.hasSfp && port.sfpVendor && (
          <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]">
                SFP Module
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Vendor
                </div>
                <div className="font-medium">{port.sfpVendor}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Part Number
                </div>
                <div className="font-medium font-mono text-sm">{port.sfpPart}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Serial
                </div>
                <div className="font-medium font-mono text-sm">{port.sfpSerial}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                  Type
                </div>
                <div className="font-medium">{port.sfpCompliance}</div>
              </div>
              {port.sfpTemperature > 0 && (
                <>
                  <div>
                    <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                      Temperature
                    </div>
                    <div className="font-medium">{port.sfpTemperature.toFixed(1)}°C</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                      Voltage
                    </div>
                    <div className="font-medium">{port.sfpVoltage.toFixed(2)} V</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                      TX Power
                    </div>
                    <div className="font-medium">{port.sfpTxPower.toFixed(2)} dBm</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                      RX Power
                    </div>
                    <div className="font-medium">{port.sfpRxPower.toFixed(2)} dBm</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
