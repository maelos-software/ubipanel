import { useParams, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, Network, Thermometer, Zap, Monitor, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { SortableHeader } from "@/components/common/SortableHeader";
import { PortTooltip } from "@/components/common/PortTooltip";
import { GaugeChart } from "@/components/charts/GaugeChart";
import { BandwidthChart } from "@/components/charts/BandwidthChart";
import { useSwitches, useClients } from "@/hooks/useNetworkData";
import { useSwitchPortHistory } from "@/hooks/useHistoricalData";
import { useSortableData } from "@/hooks/useSortableData";
import { formatBytes, formatBytesRate, formatTemp } from "@/lib/format";
import { queryInflux, escapeInfluxString } from "@/lib/influx";
import { REFETCH_INTERVAL, CHART_HEIGHT } from "@/lib/config";
import type { Client } from "@/types/influx";

interface SwitchPort {
  portIdx: number;
  name: string;
  speed: number;
  media: string;
  poeMode: string;
  poeEnable: boolean;
  rxBytes: number;
  txBytes: number;
  rxBytesR: number;
  txBytesR: number;
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  rxBroadcast: number;
  rxMulticast: number;
  poePower: number;
  poeVoltage: number;
  poeCurrent: number;
  stpPathcost: number;
  isUp: boolean;
}

interface TooltipState {
  port: SwitchPort;
  clients: Client[];
  x: number;
  y: number;
}

export function SwitchDetail() {
  const { mac } = useParams<{ mac: string }>();
  const navigate = useNavigate();
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  const { data: switches = [] } = useSwitches();
  const { data: clients = [] } = useClients();
  const sw = switches.find((s) => s.mac === decodeURIComponent(mac || ""));

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        window.clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Build a map of port -> clients for this switch
  const clientsByPort = useMemo(
    () =>
      clients.reduce(
        (acc, client) => {
          if (client.swName === sw?.name && client.swPort) {
            const key = client.swPort.toString();
            if (!acc[key]) acc[key] = [];
            acc[key].push(client);
          }
          return acc;
        },
        {} as Record<string, Client[]>
      ),
    [clients, sw?.name]
  );

  // Get ports for this switch
  // Uses LAST-FIRST pattern to calculate actual 24h traffic, not cumulative counters
  const { data: ports = [] } = useQuery({
    queryKey: ["switchPorts", sw?.name],
    queryFn: async () => {
      if (!sw?.name) return [];

      // Query 1: Get current port state
      const currentResponse = await queryInflux(`
        SELECT last(speed) as speed,
               last("rx_bytes-r") as rx_bytes_r, last("tx_bytes-r") as tx_bytes_r,
               last(rx_errors) as rx_errors, last(tx_errors) as tx_errors,
               last(rx_dropped) as rx_dropped, last(tx_dropped) as tx_dropped,
               last(rx_broadcast) as rx_broadcast, last(rx_multicast) as rx_multicast,
               last(poe_power) as poe_power, last(poe_voltage) as poe_voltage, last(poe_current) as poe_current,
               last(stp_pathcost) as stp_pathcost
        FROM usw_ports
        WHERE time > now() - 5m AND "device_name" = '${escapeInfluxString(sw.name)}'
        GROUP BY "port_idx", "name", "media", "poe_mode", "poe_enable"
      `);

      // Query 2: Calculate actual traffic transferred using LAST-FIRST (24h)
      const trafficResponse = await queryInflux(`
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
               LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
        FROM usw_ports
        WHERE time > now() - 24h AND "device_name" = '${escapeInfluxString(sw.name)}'
        GROUP BY "port_idx"
      `);

      // Build a map of traffic by port index
      const trafficByPort = new Map<string, { rx: number; tx: number }>();
      const trafficSeries = trafficResponse.results?.[0]?.series || [];
      for (const s of trafficSeries) {
        const portIdx = s.tags?.port_idx || "";
        const cols = s.columns;
        const vals = s.values?.[0] || [];
        const getVal = (k: string) => {
          const idx = cols.indexOf(k);
          return idx >= 0 ? (vals[idx] as number) || 0 : 0;
        };
        trafficByPort.set(portIdx, {
          rx: Math.max(0, getVal("rx_bytes")),
          tx: Math.max(0, getVal("tx_bytes")),
        });
      }

      const series = currentResponse.results[0]?.series || [];
      return series
        .map((s) => {
          const portIdx = s.tags?.port_idx || "0";
          const traffic = trafficByPort.get(portIdx);
          return {
            portIdx: parseInt(portIdx),
            name: s.tags?.name || "",
            media: s.tags?.media || "",
            poeMode: s.tags?.poe_mode || "",
            poeEnable: s.tags?.poe_enable === "true",
            speed: (s.values[0]?.[s.columns.indexOf("speed")] as number) || 0,
            rxBytes: traffic?.rx || 0,
            txBytes: traffic?.tx || 0,
            rxBytesR: (s.values[0]?.[s.columns.indexOf("rx_bytes_r")] as number) || 0,
            txBytesR: (s.values[0]?.[s.columns.indexOf("tx_bytes_r")] as number) || 0,
            rxErrors: (s.values[0]?.[s.columns.indexOf("rx_errors")] as number) || 0,
            txErrors: (s.values[0]?.[s.columns.indexOf("tx_errors")] as number) || 0,
            rxDropped: (s.values[0]?.[s.columns.indexOf("rx_dropped")] as number) || 0,
            txDropped: (s.values[0]?.[s.columns.indexOf("tx_dropped")] as number) || 0,
            rxBroadcast: (s.values[0]?.[s.columns.indexOf("rx_broadcast")] as number) || 0,
            rxMulticast: (s.values[0]?.[s.columns.indexOf("rx_multicast")] as number) || 0,
            poePower: (s.values[0]?.[s.columns.indexOf("poe_power")] as number) || 0,
            poeVoltage: (s.values[0]?.[s.columns.indexOf("poe_voltage")] as number) || 0,
            poeCurrent: (s.values[0]?.[s.columns.indexOf("poe_current")] as number) || 0,
            stpPathcost: (s.values[0]?.[s.columns.indexOf("stp_pathcost")] as number) || 0,
            isUp: ((s.values[0]?.[s.columns.indexOf("speed")] as number) || 0) > 0,
          };
        })
        .sort((a, b) => a.portIdx - b.portIdx) as SwitchPort[];
    },
    enabled: !!sw?.name,
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: portHistory = [] } = useSwitchPortHistory(
    sw?.name || "",
    selectedPort || 0,
    "1h",
    "1m"
  );

  // Sortable ports data
  const portColumns = [
    { key: "portIdx", sortValue: (p: SwitchPort) => p.portIdx },
    { key: "name", sortValue: (p: SwitchPort) => p.name || "" },
    {
      key: "connected",
      sortValue: (p: SwitchPort) => clientsByPort[p.portIdx.toString()]?.length || 0,
    },
    { key: "media", sortValue: (p: SwitchPort) => p.media || "" },
    { key: "speed", sortValue: (p: SwitchPort) => p.speed },
    { key: "rxBytesR", sortValue: (p: SwitchPort) => p.rxBytesR },
    { key: "txBytesR", sortValue: (p: SwitchPort) => p.txBytesR },
    { key: "errors", sortValue: (p: SwitchPort) => p.rxErrors + p.txErrors },
    { key: "dropped", sortValue: (p: SwitchPort) => p.rxDropped + p.txDropped },
    { key: "poePower", sortValue: (p: SwitchPort) => p.poePower },
  ];

  const {
    sortedData: sortedPorts,
    sortKey: portSortKey,
    sortDir: portSortDir,
    handleSort: handlePortSort,
  } = useSortableData(ports, portColumns, "portIdx");

  // Tooltip handlers
  const handlePortMouseEnter = (port: SwitchPort, event: React.MouseEvent<HTMLButtonElement>) => {
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const portClients = clientsByPort[port.portIdx.toString()] || [];

    setTooltip({
      port,
      clients: portClients,
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    });
  };

  const handlePortMouseLeave = () => {
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltip(null);
    }, 150);
  };

  const handleTooltipMouseEnter = () => {
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    setTooltip(null);
  };

  if (!sw) {
    return (
      <div>
        <PageHeader title="Switch Not Found" breadcrumb="Switches" />
        <div className="text-center py-12">
          <p className="text-[var(--text-tertiary)] mb-4">
            The requested switch could not be found.
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

  const getPortColor = (port: SwitchPort) => {
    if (!port.isUp) return "bg-[var(--bg-tertiary)]";
    if (port.rxErrors > 0 || port.txErrors > 0) return "bg-red-400";
    if (port.rxBytesR + port.txBytesR > 100000000) return "bg-purple-500/10 dark:bg-purple-500/20";
    if (port.rxBytesR + port.txBytesR > 10000000) return "bg-emerald-500/10 dark:bg-emerald-500/20";
    if (port.rxBytesR + port.txBytesR > 1000000) return "bg-emerald-400";
    return "bg-emerald-300";
  };

  const totalPoePower = ports.reduce((sum, p) => sum + (p.poePower || 0), 0);

  return (
    <div>
      <button
        onClick={() => navigate("/switches")}
        className="flex items-center gap-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Switches</span>
      </button>

      <PageHeader
        title={sw.name}
        description={`${sw.model} · ${sw.ip}`}
        breadcrumb="Switches"
        actions={<Badge variant="success">Online</Badge>}
      />

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 shadow-sm ring-1 ring-[var(--border-primary)] flex flex-col items-center">
          <GaugeChart value={sw.cpu} label="CPU" size="sm" />
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 shadow-sm ring-1 ring-[var(--border-primary)] flex flex-col items-center">
          <GaugeChart value={sw.mem} label="Memory" size="sm" color="#3B82F6" />
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-[var(--text-tertiary)]">Temp</span>
          </div>
          <div className="text-xl font-bold font-[var(--font-display)]">
            {sw.temperature > 0 ? formatTemp(sw.temperature) : "—"}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-[var(--text-tertiary)]">PoE</span>
          </div>
          <div className="text-xl font-bold font-[var(--font-display)]">
            {totalPoePower > 0 ? `${totalPoePower.toFixed(1)}W` : "—"}
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 shadow-sm ring-1 ring-[var(--border-primary)]">
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-[var(--text-tertiary)]">Active Ports</span>
          </div>
          <div className="text-xl font-bold font-[var(--font-display)]">
            {ports.filter((p) => p.isUp).length}
          </div>
        </div>
      </div>

      {/* Port Visualization */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)] mb-8">
        <h2 className="text-lg font-semibold font-[var(--font-display)] mb-4">Port Status</h2>

        {/* Port Grid */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ports.map((port) => (
            <button
              key={port.portIdx}
              onClick={() => setSelectedPort(selectedPort === port.portIdx ? null : port.portIdx)}
              onMouseEnter={(e) => handlePortMouseEnter(port, e)}
              onMouseLeave={handlePortMouseLeave}
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium
                transition-all ${getPortColor(port)}
                ${port.isUp ? "text-white" : "text-[var(--text-tertiary)]"}
                ${selectedPort === port.portIdx ? "ring-2 ring-purple-500 ring-offset-2" : ""}
                hover:scale-110
              `}
            >
              {port.portIdx}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-tertiary)] mb-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[var(--bg-tertiary)]" />
            <span>Down</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-300" />
            <span>&lt;1 MB/s</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-500/10 dark:bg-emerald-500/20" />
            <span>&gt;10 MB/s</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-purple-500/10 dark:bg-purple-500/20" />
            <span>&gt;100 MB/s</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-400" />
            <span>Errors</span>
          </div>
        </div>

        {/* Selected Port Details */}
        {selectedPort && (
          <div className="border-t border-[var(--border-primary)] pt-6">
            {(() => {
              const port = ports.find((p) => p.portIdx === selectedPort);
              if (!port) return null;
              const portClients = clientsByPort[port.portIdx.toString()] || [];
              return (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium">
                        Port {port.portIdx}
                        {port.name && (
                          <span className="text-[var(--text-tertiary)] ml-2">({port.name})</span>
                        )}
                      </h3>
                      {port.media && <Badge variant="neutral">{port.media}</Badge>}
                      {port.poeEnable && port.poeMode !== "off" && (
                        <Badge variant="info">PoE {port.poeMode}</Badge>
                      )}
                    </div>
                    <Badge variant={port.isUp ? "success" : "neutral"}>
                      {port.isUp ? `${port.speed} Mbps` : "Down"}
                    </Badge>
                  </div>

                  {/* Connected Devices */}
                  {portClients.length > 0 && (
                    <div className="bg-purple-500/10 dark:bg-purple-500/20 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Monitor className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">
                          Connected Devices ({portClients.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {portClients.map((client) => (
                          <button
                            key={client.mac}
                            onClick={() => navigate(`/clients/${client.mac}`)}
                            className="flex items-center gap-2 p-2 bg-[var(--bg-secondary)] rounded-lg hover:bg-purple-100 transition-colors text-left"
                          >
                            <Monitor className="w-4 h-4 text-[var(--text-tertiary)]" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                                {client.name || client.hostname || "Unknown"}
                              </div>
                              <div className="text-xs text-[var(--text-tertiary)]">
                                {client.ip || client.mac}
                              </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-[var(--text-tertiary)]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bandwidth Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] uppercase">TX Rate</div>
                      <div className="font-medium text-emerald-600">
                        {formatBytesRate(port.txBytesR)}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {formatBytes(port.txBytes)} total
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] uppercase">RX Rate</div>
                      <div className="font-medium text-blue-600">
                        {formatBytesRate(port.rxBytesR)}
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {formatBytes(port.rxBytes)} total
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] uppercase">Errors</div>
                      <div
                        className={`font-medium ${port.rxErrors + port.txErrors > 0 ? "text-red-600" : ""}`}
                      >
                        RX: {port.rxErrors} / TX: {port.txErrors}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] uppercase">Dropped</div>
                      <div
                        className={`font-medium ${port.rxDropped + port.txDropped > 0 ? "text-amber-600" : ""}`}
                      >
                        RX: {port.rxDropped} / TX: {port.txDropped}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] uppercase">
                        Broadcast/Multicast
                      </div>
                      <div className="font-medium text-sm">
                        {(port.rxBroadcast / 1000).toFixed(1)}K /{" "}
                        {(port.rxMulticast / 1000).toFixed(1)}K
                      </div>
                    </div>
                    {port.stpPathcost > 0 && (
                      <div>
                        <div className="text-xs text-[var(--text-tertiary)] uppercase">
                          STP Path Cost
                        </div>
                        <div className="font-medium">{port.stpPathcost}</div>
                      </div>
                    )}
                  </div>

                  {/* PoE Details */}
                  {(port.poePower > 0 || port.poeEnable) && (
                    <div className="bg-yellow-500/10 dark:bg-yellow-500/20 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">
                          Power over Ethernet
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-yellow-600">Power</div>
                          <div className="font-bold text-yellow-800">
                            {port.poePower > 0 ? `${port.poePower.toFixed(2)} W` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-yellow-600">Voltage</div>
                          <div className="font-bold text-yellow-800">
                            {port.poeVoltage > 0 ? `${port.poeVoltage.toFixed(1)} V` : "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-yellow-600">Current</div>
                          <div className="font-bold text-yellow-800">
                            {port.poeCurrent > 0
                              ? `${(port.poeCurrent * 1000).toFixed(0)} mA`
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Port Bandwidth History */}
                  {portHistory.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                        Bandwidth (1h)
                      </h4>
                      <BandwidthChart
                        data={portHistory}
                        height={CHART_HEIGHT.sm}
                        showLegend={false}
                        labels={{ tx: "TX", rx: "RX" }}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Port Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 shadow-sm ring-1 ring-[var(--border-primary)]">
        <h2 className="text-lg font-semibold font-[var(--font-display)] mb-4">All Ports</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg-tertiary)]">
                <SortableHeader
                  label="Port"
                  sortKey="portIdx"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="Connected"
                  sortKey="connected"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="Media"
                  sortKey="media"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="Speed"
                  sortKey="speed"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="TX"
                  sortKey="txBytesR"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="RX"
                  sortKey="rxBytesR"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="Errors"
                  sortKey="errors"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="Dropped"
                  sortKey="dropped"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
                <SortableHeader
                  label="PoE"
                  sortKey="poePower"
                  currentSortKey={portSortKey}
                  currentSortDir={portSortDir}
                  onSort={handlePortSort}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {sortedPorts.map((port) => {
                const portClients = clientsByPort[port.portIdx.toString()] || [];
                return (
                  <tr
                    key={port.portIdx}
                    onClick={() => setSelectedPort(port.portIdx)}
                    className={`hover:bg-[var(--bg-tertiary)]/50 cursor-pointer ${selectedPort === port.portIdx ? "bg-purple-500/10 dark:bg-purple-500/20" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium">{port.portIdx}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-tertiary)]">
                      {port.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {portClients.length > 0 ? (
                        portClients.length === 1 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/clients/${portClients[0].mac}`);
                            }}
                            className="text-purple-600 hover:text-purple-800 hover:underline text-left truncate max-w-[150px] block"
                          >
                            {portClients[0].name || portClients[0].hostname || portClients[0].ip}
                          </button>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">
                            {portClients.length} devices
                          </span>
                        )
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {port.media ? <Badge variant="neutral">{port.media}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={port.isUp ? "success" : "neutral"}>
                        {port.isUp ? `${port.speed}` : "Down"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {formatBytesRate(port.txBytesR)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {formatBytesRate(port.rxBytesR)}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${port.rxErrors + port.txErrors > 0 ? "text-red-600 font-medium" : "text-[var(--text-muted)]"}`}
                    >
                      {port.rxErrors + port.txErrors}
                    </td>
                    <td
                      className={`px-4 py-3 text-sm ${port.rxDropped + port.txDropped > 0 ? "text-amber-600 font-medium" : "text-[var(--text-muted)]"}`}
                    >
                      {port.rxDropped + port.txDropped}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {port.poePower > 0 ? (
                        <span className="text-yellow-600 font-medium">
                          {port.poePower.toFixed(1)}W
                        </span>
                      ) : port.poeEnable && port.poeMode !== "off" ? (
                        <Badge variant="info">{port.poeMode}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tooltip Portal */}
      {tooltip && (
        <div onMouseEnter={handleTooltipMouseEnter} onMouseLeave={handleTooltipMouseLeave}>
          <PortTooltip
            port={tooltip.port}
            clients={tooltip.clients}
            position={{ x: tooltip.x, y: tooltip.y }}
            onNavigateToClient={(mac) => {
              setTooltip(null);
              navigate(`/clients/${mac}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
