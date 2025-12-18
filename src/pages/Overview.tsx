import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Laptop, Wifi, Network, ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Badge } from "@/components/common/Badge";
import { ClientList } from "@/components/common/ClientList";
import { CLIENT_COLUMN_PRESETS } from "@/components/common/clientListPresets";
import { TimeRangeSelector } from "@/components/common/TimeRangeSelector";
import { MultiWANChart } from "@/components/charts/MultiWANChart";
import { ClientDistributionChart } from "@/components/charts/ClientDistributionChart";
import {
  useClients,
  useAccessPoints,
  useSwitches,
  useWANPorts,
  useUSGNetworks,
} from "@/hooks/useNetworkData";
import { useMultiWANBandwidthHistory } from "@/hooks/useHistoricalData";
import { useTimeRangeState } from "@/hooks/useTimeRangeState";
import { formatBytes, formatBytesRate } from "@/lib/format";
import { TIME_RANGES_SHORT } from "@/lib/timeRanges";
import { CHART_HEIGHT } from "@/lib/config";

/**
 * Overview page - Network dashboard summary
 *
 * Displays:
 * - Network health stats (clients, APs, switches)
 * - WAN status and bandwidth history
 * - Client distribution by AP, network, and VLAN
 * - Top bandwidth consumers
 *
 * @route /
 */
export function Overview() {
  const navigate = useNavigate();
  const { timeRange, setTimeRange } = useTimeRangeState(TIME_RANGES_SHORT);

  const { data: clients = [] } = useClients();
  const { data: aps = [] } = useAccessPoints();
  const { data: switches = [] } = useSwitches();

  const { data: wanPorts = [] } = useWANPorts();
  const { data: networks = [] } = useUSGNetworks();
  const { data: wanHistoryData } = useMultiWANBandwidthHistory(timeRange.value, timeRange.group);

  const wirelessClients = useMemo(() => clients.filter((c) => !c.isWired), [clients]);
  const wiredClients = useMemo(() => clients.filter((c) => c.isWired), [clients]);

  // Get primary WAN port (uplink) - used for status indication
  const primaryWan = useMemo(() => wanPorts.find((p) => p.isUplink) || wanPorts[0], [wanPorts]);

  // Calculate total WAN throughput across ALL interfaces (not just primary)
  const totalWanThroughput = useMemo(() => {
    return wanPorts.reduce(
      (acc, port) => ({
        rxBytesR: acc.rxBytesR + port.rxBytesR,
        txBytesR: acc.txBytesR + port.txBytesR,
        rxBytes: acc.rxBytes + port.rxBytes,
        txBytes: acc.txBytes + port.txBytes,
      }),
      { rxBytesR: 0, txBytesR: 0, rxBytes: 0, txBytes: 0 }
    );
  }, [wanPorts]);

  // Get top 15 clients by bandwidth (download + upload)
  const topClients = useMemo(
    () =>
      [...clients].sort((a, b) => b.rxBytesR + b.txBytesR - (a.rxBytesR + a.txBytesR)).slice(0, 15),
    [clients]
  );

  // Calculate max bandwidth for relative bar sizing
  const maxBandwidth = useMemo(
    () => (topClients.length > 0 ? Math.max(...topClients.map((c) => c.rxBytesR + c.txBytesR)) : 1),
    [topClients]
  );

  // Calculate total network bandwidth
  const totalBandwidth = useMemo(
    () => clients.reduce((sum, c) => sum + c.rxBytesR + c.txBytesR, 0),
    [clients]
  );

  // Client distribution by AP
  const apDistributionData = useMemo(() => {
    const clientsByAP = wirelessClients.reduce(
      (acc, client) => {
        const ap = client.apName || "Unknown";
        acc[ap] = (acc[ap] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return Object.entries(clientsByAP)
      .map(([name, value]) => ({ name, value, color: "" }))
      .sort((a, b) => b.value - a.value);
  }, [wirelessClients]);

  // Client distribution by VLAN
  const vlanDistributionData = useMemo(() => {
    const clientsByVLAN = clients.reduce(
      (acc, client) => {
        const vlan = client.vlan || "Default";
        acc[vlan] = (acc[vlan] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return Object.entries(clientsByVLAN)
      .map(([name, value]) => ({ name: `VLAN ${name}`, value, color: "" }))
      .sort((a, b) => b.value - a.value);
  }, [clients]);

  // Client distribution by Network
  const networkDistributionData = useMemo(
    () =>
      networks
        .filter((n) => n.numSta > 0)
        .map((n) => ({ name: n.name, value: n.numSta, color: "" }))
        .sort((a, b) => b.value - a.value),
    [networks]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Network Overview" description="Real-time status of your UniFi network" />

      {/* Stats Grid - Compact layout */}
      <section
        aria-label="Network stats summary"
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3"
      >
        <StatCard
          title="Clients"
          value={clients.length}
          subtitle={`${wirelessClients.length} wireless · ${wiredClients.length} wired`}
          icon={Laptop}
          iconBg="bg-blue-50"
          onClick={() => navigate("/clients")}
          compact
        />
        <StatCard
          title="Access Points"
          value={aps.length}
          icon={Wifi}
          iconBg="bg-green-50"
          onClick={() => navigate("/access-points")}
          compact
        />
        <StatCard
          title="Switches"
          value={switches.length}
          icon={Network}
          iconBg="bg-purple-50"
          onClick={() => navigate("/switches")}
          compact
        />
        <StatCard
          title="WAN Links"
          value={`${wanPorts.filter((p) => p.up).length}/${wanPorts.length}`}
          icon={Globe}
          iconBg="bg-amber-50"
          onClick={() => navigate("/gateway")}
          compact
        />
      </section>

      {/* WAN Throughput */}
      {primaryWan && (
        <section
          aria-label="Internet throughput"
          className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-6">
              <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]">
                WAN Throughput
              </h2>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <ArrowDown className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  <span className="text-2xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                    {formatBytesRate(totalWanThroughput.rxBytesR)}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    ({formatBytes(totalWanThroughput.rxBytes)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUp className="w-4 h-4 text-blue-500" aria-hidden="true" />
                  <span className="text-2xl font-bold font-[var(--font-display)] text-[var(--text-primary)]">
                    {formatBytesRate(totalWanThroughput.txBytesR)}
                  </span>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    ({formatBytes(totalWanThroughput.txBytes)})
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TimeRangeSelector
                ranges={TIME_RANGES_SHORT}
                selected={timeRange}
                onChange={setTimeRange}
                size="sm"
              />
              <Badge variant="success">Online</Badge>
            </div>
          </div>

          {/* WAN Bandwidth History Chart */}
          {wanHistoryData && wanHistoryData.data.length > 0 && (
            <div role="img" aria-label="WAN bandwidth history chart">
              <MultiWANChart
                data={wanHistoryData.data}
                ifnames={wanHistoryData.ifnames}
                activeIfname={primaryWan?.ifname}
                height={CHART_HEIGHT.ms}
              />
            </div>
          )}
        </section>
      )}

      {/* Distribution Charts - under WAN throughput */}
      <section aria-label="Client distribution" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => navigate("/access-points")}
          className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 card-hover cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/access-points");
          }}
        >
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Clients by AP
          </h2>
          {apDistributionData.length > 0 ? (
            <div role="img" aria-label="Client distribution by access point chart">
              <ClientDistributionChart data={apDistributionData} height={CHART_HEIGHT.ml} />
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
              No wireless clients
            </div>
          )}
        </div>
        <div
          onClick={() => navigate("/gateway")}
          className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 card-hover cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/gateway");
          }}
        >
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Clients by Network
          </h2>
          {networkDistributionData.length > 0 ? (
            <div role="img" aria-label="Client distribution by network chart">
              <ClientDistributionChart data={networkDistributionData} height={CHART_HEIGHT.ml} />
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
              No network data
            </div>
          )}
        </div>
        <div
          onClick={() => navigate("/clients")}
          className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 card-hover cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/clients");
          }}
        >
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)] mb-4">
            Clients by VLAN
          </h2>
          {vlanDistributionData.length > 0 ? (
            <div role="img" aria-label="Client distribution by VLAN chart">
              <ClientDistributionChart data={vlanDistributionData} height={CHART_HEIGHT.ml} />
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-[var(--text-muted)]">
              No clients connected
            </div>
          )}
        </div>
      </section>

      {/* Top Clients Table */}
      <section aria-label="Top clients list">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-[var(--font-display)] text-[var(--text-primary)]">
            Top Clients by Bandwidth
          </h2>
          <button
            onClick={() => navigate("/clients")}
            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded px-1"
          >
            View all →
          </button>
        </div>
        <ClientList
          clients={topClients}
          onClientClick={(c) => navigate(`/clients/${c.mac}`)}
          columns={CLIENT_COLUMN_PRESETS.overview}
          showConnectionIndicator={true}
          totalBandwidth={totalBandwidth}
          maxBandwidth={maxBandwidth}
          defaultSortKey="bandwidthBar"
          defaultSortDir="desc"
        />
      </section>
    </div>
  );
}
