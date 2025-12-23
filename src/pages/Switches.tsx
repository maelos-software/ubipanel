import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Network, Activity, Zap, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/common/Badge";
import { DataTable } from "@/components/common/DataTable";
import { PortTooltip } from "@/components/common/PortTooltip";
import { SwitchCard } from "@/components/common/SwitchCard";
import { useSwitches, useAllSwitchPorts, useClients } from "@/hooks/useNetworkData";
import { formatBytesRate } from "@/lib/format";
import { PORT_COLORS } from "@/lib/chartConfig";
import type { SwitchPort, Client } from "@/types/influx";

/**
 * Switches page - Network switch overview
 */

// Tooltip state type
interface TooltipState {
  port: SwitchPort;
  clients: Client[];
  x: number;
  y: number;
}

export function Switches() {
  const navigate = useNavigate();
  const { data: switches = [], isLoading } = useSwitches();
  const { data: allPorts = [] } = useAllSwitchPorts();
  const { data: clients = [] } = useClients();

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        window.clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Build a map of switch:port -> clients
  const clientsByPort = useMemo(
    () =>
      clients.reduce(
        (acc, client) => {
          if (client.swName && client.swPort) {
            const key = `${client.swName}:${client.swPort}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(client);
          }
          return acc;
        },
        {} as Record<string, Client[]>
      ),
    [clients]
  );

  // Calculate summary stats
  const activePorts = useMemo(() => allPorts.filter((p) => p.speed > 0).length, [allPorts]);
  const totalPoePower = useMemo(
    () => allPorts.reduce((sum, p) => sum + (p.poePower || 0), 0),
    [allPorts]
  );
  const totalBandwidth = useMemo(
    () => allPorts.reduce((sum, p) => sum + p.rxBytesR + p.txBytesR, 0),
    [allPorts]
  );
  const portsWithErrors = useMemo(
    () => allPorts.filter((p) => p.rxErrors + p.txErrors > 0).length,
    [allPorts]
  );

  // Get ports by switch for mini visualization
  const portsBySwitch = useMemo(
    () =>
      allPorts.reduce(
        (acc, port) => {
          if (!acc[port.swName]) acc[port.swName] = [];
          acc[port.swName].push(port);
          return acc;
        },
        {} as Record<string, typeof allPorts>
      ),
    [allPorts]
  );

  // Top 10 ports by bandwidth
  const topPorts = useMemo(
    () =>
      [...allPorts]
        .filter((p) => p.speed > 0)
        .sort((a, b) => b.rxBytesR + b.txBytesR - (a.rxBytesR + a.txBytesR))
        .slice(0, 10),
    [allPorts]
  );

  // Ports with issues (only actual errors, not dropped frames)
  const problemPorts = useMemo(
    () => allPorts.filter((p) => p.rxErrors + p.txErrors > 0),
    [allPorts]
  );

  const getPortColor = (port: (typeof allPorts)[0]) => {
    if (port.speed === 0) return PORT_COLORS.down;
    if (port.rxErrors + port.txErrors > 0) return PORT_COLORS.error;
    if (port.rxBytesR + port.txBytesR > 100000000) return PORT_COLORS.bandwidthHigh;
    if (port.rxBytesR + port.txBytesR > 10000000) return PORT_COLORS.bandwidthMedium;
    if (port.rxBytesR + port.txBytesR > 1000000) return PORT_COLORS.bandwidthNormal;
    return PORT_COLORS.bandwidthLow;
  };

  const handlePortMouseEnter = (port: SwitchPort, event: React.MouseEvent<HTMLDivElement>) => {
    // Clear any pending hide timeout
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const portClients = clientsByPort[`${port.swName}:${port.portIdx}`] || [];

    setTooltip({
      port,
      clients: portClients,
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    });
  };

  const handlePortMouseLeave = () => {
    // Small delay before hiding to allow moving to tooltip
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltip(null);
    }, 150);
  };

  const handleTooltipMouseEnter = () => {
    // Keep tooltip open when hovering over it
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    setTooltip(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Switches"
        description={`${switches.length} switches in your network`}
        breadcrumb="Network"
      />

      {/* Summary Stats - Compact layout */}
      <section
        aria-label="Switch stats summary"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3"
      >
        <StatCard
          title="Switches"
          value={switches.length}
          icon={Network}
          iconBg="bg-purple-500/10 dark:bg-purple-500/20"
          compact
        />
        <StatCard
          title="Active Ports"
          value={activePorts}
          icon={Activity}
          iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
          compact
        />
        <StatCard
          title="PoE Power"
          value={`${totalPoePower.toFixed(1)}W`}
          icon={Zap}
          iconBg="bg-yellow-500/10 dark:bg-yellow-500/20"
          compact
        />
        <StatCard
          title="Throughput"
          value={formatBytesRate(totalBandwidth)}
          icon={Activity}
          iconBg="bg-blue-500/10 dark:bg-blue-500/20"
          compact
        />
        {portsWithErrors > 0 ? (
          <StatCard
            title="Port Issues"
            value={portsWithErrors}
            icon={AlertTriangle}
            iconBg="bg-red-500/10 dark:bg-red-500/20"
            compact
          />
        ) : (
          <StatCard
            title="Health"
            value="Good"
            icon={Activity}
            iconBg="bg-green-500/10 dark:bg-green-500/20"
            compact
          />
        )}
      </section>

      {isLoading ? (
        <div className="text-center py-12 text-[var(--text-tertiary)]">Loading switches...</div>
      ) : (
        <>
          {/* Switch Cards */}
          <section aria-label="Network switches" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {switches.map((sw) => {
              const swPorts = portsBySwitch[sw.name] || [];
              const swActivePorts = swPorts.filter((p) => p.speed > 0).length;
              const swPoePower = swPorts.reduce((sum, p) => sum + (p.poePower || 0), 0);
              const swBandwidth = swPorts.reduce((sum, p) => sum + p.rxBytesR + p.txBytesR, 0);
              const swErrors = swPorts.filter((p) => p.rxErrors + p.txErrors > 0).length;

              return (
                <SwitchCard
                  key={sw.mac}
                  sw={sw}
                  ports={swPorts}
                  activePorts={swActivePorts}
                  poePower={swPoePower}
                  bandwidth={swBandwidth}
                  errors={swErrors}
                  onPortMouseEnter={handlePortMouseEnter}
                  onPortMouseLeave={handlePortMouseLeave}
                  getPortColor={getPortColor}
                />
              );
            })}
          </section>

          {/* Top Ports by Bandwidth */}
          {topPorts.length > 0 && (
            <section
              aria-labelledby="top-ports-title"
              className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6"
            >
              <h2
                id="top-ports-title"
                className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4"
              >
                Top Ports by Bandwidth
              </h2>
              <DataTable
                data={topPorts}
                keyExtractor={(p) => `${p.swName}-${p.portIdx}`}
                onRowClick={(p) => {
                  const sw = switches.find((s) => s.name === p.swName);
                  if (sw) navigate(`/switches/${encodeURIComponent(sw.mac)}`);
                }}
                columns={[
                  {
                    key: "switch",
                    header: "Switch",
                    render: (p) => (
                      <span className="font-medium text-[var(--text-primary)]">{p.swName}</span>
                    ),
                  },
                  {
                    key: "port",
                    header: "Port",
                    render: (p) => (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--text-primary)]">{p.portIdx}</span>
                        {p.name && (
                          <span className="text-[var(--text-tertiary)] text-xs">({p.name})</span>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "connected",
                    header: "Connected",
                    render: (p) => {
                      const portClients = clientsByPort[`${p.swName}:${p.portIdx}`] || [];
                      if (portClients.length === 0)
                        return <span className="text-[var(--text-muted)]">—</span>;
                      if (portClients.length === 1) {
                        const client = portClients[0];
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/clients/${client.mac}`);
                            }}
                            className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 hover:underline text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded px-1"
                          >
                            {client.name || client.hostname || client.ip}
                          </button>
                        );
                      }
                      return (
                        <span className="text-[var(--text-tertiary)]">
                          {portClients.length} devices
                        </span>
                      );
                    },
                  },
                  {
                    key: "speed",
                    header: "Speed",
                    render: (p) => <Badge variant="neutral">{p.speed} Mbps</Badge>,
                  },
                  {
                    key: "tx",
                    header: "TX",
                    sortValue: (p) => p.txBytesR,
                    render: (p) => (
                      <span className="font-mono text-emerald-600">
                        {formatBytesRate(p.txBytesR)}
                      </span>
                    ),
                  },
                  {
                    key: "rx",
                    header: "RX",
                    sortValue: (p) => p.rxBytesR,
                    render: (p) => (
                      <span className="font-mono text-blue-600">{formatBytesRate(p.rxBytesR)}</span>
                    ),
                  },
                  {
                    key: "poe",
                    header: "PoE",
                    render: (p) =>
                      p.poePower > 0 ? (
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                          {p.poePower.toFixed(1)}W
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      ),
                  },
                ]}
              />
            </section>
          )}

          {/* Ports with Issues */}
          {problemPorts.length > 0 && (
            <section
              aria-labelledby="problem-ports-title"
              className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-red-500/20 dark:ring-red-500/30 p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" aria-hidden="true" />
                <h2
                  id="problem-ports-title"
                  className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]"
                >
                  Ports with Issues
                </h2>
              </div>
              <DataTable
                data={problemPorts}
                keyExtractor={(p) => `${p.swName}-${p.portIdx}`}
                onRowClick={(p) => {
                  const sw = switches.find((s) => s.name === p.swName);
                  if (sw) navigate(`/switches/${encodeURIComponent(sw.mac)}`);
                }}
                columns={[
                  {
                    key: "switch",
                    header: "Switch",
                    render: (p) => (
                      <span className="font-medium text-[var(--text-primary)]">{p.swName}</span>
                    ),
                  },
                  {
                    key: "port",
                    header: "Port",
                    render: (p) => (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[var(--text-primary)]">{p.portIdx}</span>
                        {p.name && (
                          <span className="text-[var(--text-tertiary)] text-xs">({p.name})</span>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "rxErrors",
                    header: "RX Errors",
                    render: (p) => (
                      <span className="text-red-600 font-medium">
                        {p.rxErrors.toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: "txErrors",
                    header: "TX Errors",
                    render: (p) => (
                      <span className="text-red-600 font-medium">
                        {p.txErrors.toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    key: "speed",
                    header: "Speed",
                    render: (p) => (
                      <Badge variant={p.speed > 0 ? "success" : "neutral"}>
                        {p.speed > 0 ? `${p.speed} Mbps` : "Down"}
                      </Badge>
                    ),
                  },
                ]}
              />
            </section>
          )}

          {/* Port Legend */}
          <section
            aria-label="Port status color legend"
            className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-tertiary)]"
          >
            <span className="font-medium">Port colors:</span>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${PORT_COLORS.down}`} />
              <span>Down</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${PORT_COLORS.bandwidthLow}`} />
              <span>&lt;1 MB/s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${PORT_COLORS.bandwidthNormal}`} />
              <span>&gt;1 MB/s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${PORT_COLORS.bandwidthMedium}`} />
              <span>&gt;10 MB/s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${PORT_COLORS.bandwidthHigh}`} />
              <span>&gt;100 MB/s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${PORT_COLORS.error}`} />
              <span>Errors</span>
            </div>
          </section>
        </>
      )}

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
