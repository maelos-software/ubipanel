import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { TIME_RANGES_LONG } from "@/lib/timeRanges";
import { formatDistanceToNow } from "date-fns";
import { parseSeriesToObjects } from "@/hooks/utils/parseInfluxResults";
import {
  Wifi,
  RefreshCw,
  AlertTriangle,
  Shield,
  Router,
  Network,
  ArrowRightLeft,
  LogIn,
  LogOut,
  Activity,
} from "lucide-react";

interface NetworkEvent {
  time: string;
  key: string;
  msg: string;
  subsystem: string;
  ap_name?: string;
  sw_name?: string;
  gw?: string;
  user?: string;
  ssid?: string;
  hostname?: string;
}

const EVENT_CATEGORIES = {
  all: { label: "All Events", icon: Activity, filter: null },
  wlan: { label: "Wireless", icon: Wifi, filter: { type: "subsystem", value: "wlan" } },
  lan: { label: "LAN", icon: Network, filter: { type: "lan_exclude_wan" } },
  wan: { label: "WAN", icon: Router, filter: { type: "key", pattern: "WAN" } },
} as const;

function getEventIcon(key: string, msg?: string) {
  if (key.includes("WANTransition")) {
    if (msg?.includes("state active")) return LogIn;
    if (msg?.includes("state failover")) return RefreshCw;
    if (msg?.includes("state inactive")) return LogOut;
    return Router;
  }
  if (key.includes("Roam")) return ArrowRightLeft;
  if (key.includes("Connected")) return LogIn;
  if (key.includes("Disconnected")) return LogOut;
  if (key.includes("Alert") || key.includes("Alarm")) return AlertTriangle;
  if (key.includes("IPS") || key.includes("Threat")) return Shield;
  return Activity;
}

function getEventVariant(key: string, msg?: string): "neutral" | "success" | "warning" | "error" {
  if (key.includes("WANTransition")) {
    if (msg?.includes("state active")) return "success";
    if (msg?.includes("state failover")) return "warning";
    if (msg?.includes("state inactive")) return "error";
  }
  if (key.includes("Connected")) return "success";
  if (key.includes("Disconnected")) return "warning";
  if (key.includes("Alert") || key.includes("Alarm") || key.includes("Threat")) return "error";
  return "neutral";
}

export function Events() {
  const [category, setCategory] = useState<keyof typeof EVENT_CATEGORIES>("all");
  const [timeRange, setTimeRange] = useState(TIME_RANGES_LONG[1]); // Default to 24h

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", category, timeRange],
    queryFn: async () => {
      const categoryConfig = EVENT_CATEGORIES[category];
      let categoryFilter = "";

      if (categoryConfig.filter) {
        if ("type" in categoryConfig.filter && categoryConfig.filter.type === "subsystem") {
          categoryFilter = ` AND subsystem = '${categoryConfig.filter.value}'`;
        } else if ("type" in categoryConfig.filter && categoryConfig.filter.type === "key") {
          categoryFilter = ` AND "key" =~ /${categoryConfig.filter.pattern}/`;
        } else if (
          "type" in categoryConfig.filter &&
          categoryConfig.filter.type === "lan_exclude_wan"
        ) {
          // LAN subsystem but exclude WAN transition events
          categoryFilter = ` AND subsystem = 'lan' AND "key" !~ /WAN/`;
        }
      }

      const query = `
        SELECT time, "key", msg, subsystem, ap_name, sw_name, "user", ssid, hostname, gw
        FROM unifi_events
        WHERE time > now() - ${timeRange.value}${categoryFilter}
        ORDER BY time DESC
        LIMIT 100
      `;

      const result = await queryInflux(query);
      if (!result?.results?.[0]?.series?.[0]) return [];

      return parseSeriesToObjects<NetworkEvent>(result.results[0].series[0]);
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  return (
    <div>
      <PageHeader title="Events" description="Network events and activity log" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Category tabs */}
        <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1">
          {Object.entries(EVENT_CATEGORIES).map(([key, { label, icon: Icon }]) => (
            <button
              key={key}
              onClick={() => setCategory(key as keyof typeof EVENT_CATEGORIES)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                category === key
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Time range */}
        <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1">
          {TIME_RANGES_LONG.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                timeRange.value === range.value
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
          </div>
        ) : !events?.length ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--text-tertiary)]">
            <Activity className="w-12 h-12 mb-2 opacity-50" />
            <p>No events found</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {events.map((event, idx) => {
              const EventIcon = getEventIcon(event.key, event.msg);
              const variant = getEventVariant(event.key, event.msg);

              return (
                <div
                  key={`${event.time}-${idx}`}
                  className="px-6 py-4 hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`
                      p-2 rounded-lg 
                      ${variant === "success" ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400" : ""}
                      ${variant === "warning" ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" : ""}
                      ${variant === "error" ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400" : ""}
                      ${variant === "neutral" ? "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]" : ""}
                    `}
                    >
                      <EventIcon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={variant}>
                          {event.key.replace("EVT_", "").replace(/_/g, " ")}
                        </Badge>
                        {event.subsystem && <Badge variant="neutral">{event.subsystem}</Badge>}
                      </div>
                      <p className="text-sm text-[var(--text-primary)] break-words">{event.msg}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-tertiary)]">
                        <span>
                          {formatDistanceToNow(new Date(event.time), {
                            addSuffix: true,
                          })}
                        </span>
                        {event.ap_name && <span>AP: {event.ap_name}</span>}
                        {event.sw_name && <span>Switch: {event.sw_name}</span>}
                        {event.gw && <span>Gateway: {event.gw}</span>}
                        {event.ssid && <span>SSID: {event.ssid}</span>}
                        {event.hostname && <span>Host: {event.hostname}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
