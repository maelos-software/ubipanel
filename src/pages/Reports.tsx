import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Wifi,
  ArrowRightLeft,
  Radio,
  Globe,
  AlertTriangle,
  Server,
  Users,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL, THRESHOLDS } from "@/lib/config";
import { formatBytes } from "@/lib/format";
import { useTopBandwidthConsumers } from "@/hooks/useBandwidth";

/**
 * Reports page - Network analytics and insights
 *
 * Available reports:
 * - Bandwidth: Top consumers, traffic patterns
 * - Client Experience: Signal quality, satisfaction trends
 * - Roaming: Client roaming frequency and patterns
 * - Radio: Channel utilization, interference analysis
 * - WAN Health: Uplink performance, failover events
 * - Port Health: Switch port errors, PoE usage
 * - Infrastructure: Device health, resource utilization
 * - Guest Network: Guest usage statistics
 * - AP Load: Access point capacity planning
 *
 * @route /reports
 */

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  path: string;
  stat?: string;
  statLabel?: string;
  loading?: boolean;
}

export function Reports() {
  const navigate = useNavigate();

  // Fetch summary stats for each report card
  // Use centralized hook for correct bandwidth calculation (LAST-FIRST, not SUM)
  const { data: topConsumers = [] } = useTopBandwidthConsumers("24h", { limit: 1 });
  const topConsumer = topConsumers[0]
    ? { name: topConsumers[0].name, total: topConsumers[0].total }
    : null;

  const { data: poorExperience } = useQuery({
    queryKey: ["report-poor-experience"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT COUNT(DISTINCT(mac)) AS count
        FROM clients
        WHERE time > now() - 1h AND satisfaction < ${THRESHOLDS.satisfaction.warning} AND satisfaction > 0
      `);
      const count = result.results[0]?.series?.[0]?.values?.[0]?.[1] || 0;
      return count as number;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: highRoamers } = useQuery({
    queryKey: ["report-high-roamers"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT MAX(roam_count) AS roams, mac
        FROM clients
        WHERE time > now() - 24h AND roam_count > 10
        GROUP BY mac
      `);
      const count = result.results[0]?.series?.length || 0;
      return count;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: busiestAP } = useQuery({
    queryKey: ["report-busiest-ap"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT LAST(num_sta)
        FROM uap
        WHERE time > now() - 5m
        GROUP BY "name"
      `);
      const series = result.results[0]?.series || [];
      if (!series.length) return null;
      // Find the AP with most clients
      let top = { name: "Unknown", clients: 0 };
      for (const s of series) {
        const clients = (s.values[0][1] as number) || 0;
        if (clients > top.clients) {
          top = { name: s.tags?.name || "Unknown", clients };
        }
      }
      return top;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: wanFailovers } = useQuery({
    queryKey: ["report-wan-failovers"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT COUNT(msg) AS count
        FROM unifi_events
        WHERE "key" = 'EVT_GW_WANTransition' AND msg =~ /failover/ AND time > now() - 7d
      `);
      const count = result.results[0]?.series?.[0]?.values?.[0]?.[1] || 0;
      return count as number;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: portErrors } = useQuery({
    queryKey: ["report-port-errors"],
    queryFn: async () => {
      // Get current error counts (not cumulative over time)
      const result = await queryInflux(`
        SELECT LAST(rx_errors), LAST(tx_errors)
        FROM usw_ports
        WHERE time > now() - 5m
        GROUP BY device_name, port_idx
      `);
      const series = result.results[0]?.series || [];
      let total = 0;
      for (const s of series) {
        total += ((s.values[0][1] as number) || 0) + ((s.values[0][2] as number) || 0);
      }
      return total;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: deviceRestarts } = useQuery({
    queryKey: ["report-device-restarts"],
    queryFn: async () => {
      // Find devices with uptime < 24h (recently restarted)
      const result = await queryInflux(`
        SELECT LAST(uptime)
        FROM uap
        WHERE time > now() - 1h
        GROUP BY "name"
      `);
      const series = result.results[0]?.series || [];
      const restarted = series.filter((s) => {
        const uptime = (s.values[0][1] as number) || 0;
        return uptime < 86400; // Less than 24 hours
      });
      return restarted.length;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: guestClients } = useQuery({
    queryKey: ["report-guest-clients"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT COUNT(DISTINCT(mac)) AS count
        FROM clients
        WHERE time > now() - 1h AND is_guest = 'true'
      `);
      const count = result.results[0]?.series?.[0]?.values?.[0]?.[1] || 0;
      return count as number;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const { data: radioStats } = useQuery({
    queryKey: ["report-radio-stats"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT LAST(cu_total), LAST(radio)
        FROM uap_radios
        WHERE time > now() - 5m
        GROUP BY device_name, radio
      `);
      const series = result.results[0]?.series || [];
      const radios = series.map((s) => ({
        cu: (s.values[0][1] as number) || 0,
        radio: (s.values[0][2] as string) || "",
      }));
      const highUtil = radios.filter((r) => r.cu > THRESHOLDS.utilization.moderate).length;
      const avg5GHz =
        radios.filter((r) => r.radio !== "ng").reduce((sum, r) => sum + r.cu, 0) /
        (radios.filter((r) => r.radio !== "ng").length || 1);
      return { highUtil, avg5GHz: Math.round(avg5GHz), total: radios.length };
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // Organized by category
  const wirelessReports: ReportCard[] = [
    {
      id: "radio",
      title: "WiFi Radio Analysis",
      description: "Channel utilization, CCQ, traffic by band, and detailed radio performance",
      icon: Radio,
      color: "indigo",
      path: "/reports/radio",
      stat: radioStats ? `${radioStats.highUtil} high utilization` : undefined,
      statLabel: `${radioStats?.total || 0} radios monitored`,
      loading: !radioStats,
    },
    {
      id: "experience",
      title: "Wireless Experience",
      description: "Find clients with poor signal, low satisfaction, or high retry rates",
      icon: Wifi,
      color: "blue",
      path: "/reports/experience",
      stat: poorExperience !== undefined ? `${poorExperience} clients` : undefined,
      statLabel: "With poor experience",
      loading: poorExperience === undefined,
    },
    {
      id: "roaming",
      title: "Roaming Analysis",
      description: "Discover clients that roam frequently, which may indicate coverage gaps",
      icon: ArrowRightLeft,
      color: "cyan",
      path: "/reports/roaming",
      stat: highRoamers !== undefined ? `${highRoamers} clients` : undefined,
      statLabel: "High roamers (24h)",
      loading: highRoamers === undefined,
    },
    {
      id: "ap-load",
      title: "AP Load Distribution",
      description: "Analyze client distribution and channel utilization across access points",
      icon: Radio,
      color: "green",
      path: "/reports/ap-load",
      stat: busiestAP ? `${busiestAP.name}: ${busiestAP.clients} clients` : undefined,
      statLabel: "Busiest AP",
      loading: !busiestAP,
    },
  ];

  const clientReports: ReportCard[] = [
    {
      id: "bandwidth",
      title: "Top Bandwidth Consumers",
      description: "Identify which clients are using the most bandwidth across your network",
      icon: TrendingUp,
      color: "purple",
      path: "/reports/bandwidth",
      stat: topConsumer ? `${topConsumer.name}: ${formatBytes(topConsumer.total)}` : undefined,
      statLabel: "Top consumer (24h)",
      loading: !topConsumer,
    },
    {
      id: "guest",
      title: "Guest Network",
      description: "Analyze guest network usage, client counts, and bandwidth consumption",
      icon: Users,
      color: "pink",
      path: "/reports/guest",
      stat: guestClients !== undefined ? `${guestClients} guests` : undefined,
      statLabel: "Currently connected",
      loading: guestClients === undefined,
    },
  ];

  const infrastructureReports: ReportCard[] = [
    {
      id: "wan-health",
      title: "WAN Health",
      description: "Monitor WAN uptime, failover events, and bandwidth utilization",
      icon: Globe,
      color: "amber",
      path: "/reports/wan-health",
      stat: wanFailovers !== undefined ? `${wanFailovers} failovers` : undefined,
      statLabel: "Last 7 days",
      loading: wanFailovers === undefined,
    },
    {
      id: "port-health",
      title: "Switch Port Health",
      description: "Find ports with errors, drops, or unusual traffic patterns",
      icon: AlertTriangle,
      color: "red",
      path: "/reports/port-health",
      stat: portErrors !== undefined ? `${portErrors.toLocaleString()} errors` : undefined,
      statLabel: "Current total",
      loading: portErrors === undefined,
    },
    {
      id: "infrastructure",
      title: "Infrastructure Uptime",
      description: "Track device uptime, restarts, and system resource utilization",
      icon: Server,
      color: "slate",
      path: "/reports/infrastructure",
      stat: deviceRestarts !== undefined ? `${deviceRestarts} devices` : undefined,
      statLabel: "Restarted recently",
      loading: deviceRestarts === undefined,
    },
  ];

  const reportGroups = [
    { title: "Wireless", reports: wirelessReports },
    { title: "Clients", reports: clientReports },
    { title: "Infrastructure", reports: infrastructureReports },
  ];

  const colorClasses: Record<string, { bg: string; icon: string; border: string }> = {
    purple: {
      bg: "bg-purple-500/10 dark:bg-purple-500/20",
      icon: "text-purple-600 dark:text-purple-400",
      border: "border-purple-200 dark:border-purple-800",
    },
    blue: {
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
      icon: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200 dark:border-blue-800",
    },
    cyan: {
      bg: "bg-cyan-500/10 dark:bg-cyan-500/20",
      icon: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-200 dark:border-cyan-800",
    },
    green: {
      bg: "bg-green-500/10 dark:bg-green-500/20",
      icon: "text-green-600 dark:text-green-400",
      border: "border-green-200 dark:border-green-800",
    },
    amber: {
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      icon: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
    },
    red: {
      bg: "bg-red-500/10 dark:bg-red-500/20",
      icon: "text-red-600 dark:text-red-400",
      border: "border-red-200 dark:border-red-800",
    },
    slate: {
      bg: "bg-slate-500/10 dark:bg-slate-500/20",
      icon: "text-slate-600 dark:text-slate-400",
      border: "border-slate-200 dark:border-slate-800",
    },
    pink: {
      bg: "bg-pink-500/10 dark:bg-pink-500/20",
      icon: "text-pink-600 dark:text-pink-400",
      border: "border-pink-200 dark:border-pink-800",
    },
    indigo: {
      bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      icon: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-200 dark:border-indigo-800",
    },
  };

  const renderReportCard = (report: ReportCard) => {
    const colors = colorClasses[report.color];
    const Icon = report.icon;

    return (
      <button
        key={report.id}
        onClick={() => navigate(report.path)}
        className="text-left p-5 bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] hover:shadow-md hover:ring-gray-200 dark:hover:ring-slate-700 transition-all group"
      >
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${colors.bg}`}>
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-purple-600 transition-colors">
                {report.title}
              </h3>
              <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">{report.description}</p>

            {/* Summary stat */}
            <div className={`mt-4 pt-4 border-t ${colors.border}`}>
              {report.loading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <>
                  <div className={`text-lg font-semibold ${colors.icon}`}>{report.stat || "—"}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {report.statLabel}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Detailed analytics and insights from your network data"
      />

      <div className="space-y-8">
        {reportGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
              {group.title}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.reports.map(renderReportCard)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
