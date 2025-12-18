/**
 * ClientList - Unified client list component
 */

import { ReactNode, useMemo } from "react";
import { DataTable } from "./DataTable";
import { Badge } from "./Badge";
import { InfoTooltip } from "./InfoTooltip";
import { METRIC_DEFINITIONS } from "@/lib/metrics";
import type { Client } from "@/types/influx";
import {
  formatBytes,
  formatBytesRate,
  formatUptime,
  getSignalQuality,
  formatRadioProto,
} from "@/lib/format";
import { CLIENT_COLUMN_PRESETS, type ClientColumnKey } from "./clientListPresets";

/**
 * Visual variants for the ClientList component.
 */
export type ClientListVariant = "full" | "compact";

export interface ClientListProps {
  /** Array of clients to display */
  clients: Client[];
  /** Callback when a client row is clicked */
  onClientClick?: (client: Client) => void;
  /** Which columns to display (order matters) */
  columns?: ClientColumnKey[];
  /** Visual density variant */
  variant?: ClientListVariant;
  /** Message to show when no clients */
  emptyMessage?: string;
  /** Default sort column key */
  defaultSortKey?: string;
  /** Default sort direction */
  defaultSortDir?: "asc" | "desc";
  /** For bandwidth bar: total bandwidth to calculate percentages */
  totalBandwidth?: number;
  /** For bandwidth bar: max bandwidth to scale the bar */
  maxBandwidth?: number;
  /** Show connection type indicator bar on left */
  showConnectionIndicator?: boolean;
}

interface ColumnContext {
  variant: ClientListVariant;
  totalBandwidth: number;
  maxBandwidth: number;
  showConnectionIndicator: boolean;
}

/**
 * Column definition factory functions
 */
const columnDefinitions: Record<
  ClientColumnKey,
  (ctx: ColumnContext) => {
    key: string;
    header: ReactNode;
    sortValue: (c: Client) => string | number;
    render: (c: Client) => ReactNode;
    align?: "left" | "center" | "right";
  }
> = {
  name: (ctx) => ({
    key: "name",
    header: "Client",
    sortValue: (c) => (c.name || c.hostname || c.mac).toLowerCase(),
    render: (c) => (
      <div className="flex items-center gap-3">
        {ctx.showConnectionIndicator && (
          <div
            className={`w-2 h-8 rounded-full flex-shrink-0 ${
              c.isGuest ? "bg-amber-400" : c.isWired ? "bg-purple-400" : "bg-emerald-400"
            }`}
          />
        )}
        <div>
          <div className="font-medium text-[var(--text-primary)]">
            {c.name || c.hostname || "Unknown"}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] font-mono">
            {ctx.variant === "compact" ? c.ip || c.mac : c.mac}
          </div>
        </div>
      </div>
    ),
  }),

  ip: () => ({
    key: "ip",
    header: "IP Address",
    sortValue: (c) => {
      const parts = (c.ip || "0.0.0.0").split(".");
      return parts.reduce((acc, part) => acc * 256 + parseInt(part, 10), 0);
    },
    render: (c) => (
      <span className="font-mono text-sm text-[var(--text-secondary)]">{c.ip || "—"}</span>
    ),
  }),

  mac: () => ({
    key: "mac",
    header: "MAC Address",
    sortValue: (c) => c.mac.toLowerCase(),
    render: (c) => <span className="font-mono text-sm text-[var(--text-secondary)]">{c.mac}</span>,
  }),

  connection: () => ({
    key: "connection",
    header: (
      <div className="flex items-center gap-1.5">
        Connection
        <InfoTooltip metric={METRIC_DEFINITIONS.rssi} />
      </div>
    ),
    sortValue: (c) => (c.isWired ? 0 : c.rssi),
    render: (c) => (
      <div>
        <div className="flex items-center gap-2">
          {c.isWired ? (
            <Badge variant="neutral">Wired</Badge>
          ) : (
            <>
              <Badge variant="info">{formatRadioProto(c.radioProto).label}</Badge>
              <span className={`text-xs font-medium ${getSignalQuality(c.rssi).color}`}>
                {c.rssi} dBm
              </span>
            </>
          )}
          {c.isGuest && <Badge variant="warning">Guest</Badge>}
        </div>
        <div className="text-xs text-[var(--text-tertiary)] mt-1">
          {c.isWired ? c.swName : c.apName}
        </div>
      </div>
    ),
  }),

  bandwidth: () => ({
    key: "bandwidth",
    header: "Bandwidth",
    sortValue: (c) => c.rxBytesR + c.txBytesR,
    render: (c) => (
      <div className="text-sm">
        <div className="text-[var(--text-primary)]">↓ {formatBytesRate(c.rxBytesR)}</div>
        <div className="text-[var(--text-tertiary)]">↑ {formatBytesRate(c.txBytesR)}</div>
      </div>
    ),
  }),

  bandwidthBar: (ctx) => ({
    key: "bandwidthBar",
    header: "Bandwidth",
    sortValue: (c) => c.rxBytesR + c.txBytesR,
    render: (c) => {
      const clientBandwidth = c.rxBytesR + c.txBytesR;
      const bandwidthPercent =
        ctx.maxBandwidth > 0 ? (clientBandwidth / ctx.maxBandwidth) * 100 : 0;
      const networkPercent =
        ctx.totalBandwidth > 0 ? (clientBandwidth / ctx.totalBandwidth) * 100 : 0;
      const rxPercent = clientBandwidth > 0 ? (c.rxBytesR / clientBandwidth) * 100 : 50;

      return (
        <div className="min-w-[180px]">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-sm font-medium text-[var(--text-primary)]">
              {formatBytesRate(clientBandwidth)}
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {networkPercent.toFixed(0)}% of total
            </span>
          </div>
          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div className="h-full rounded-full flex" style={{ width: `${bandwidthPercent}%` }}>
              <div className="bg-emerald-500 h-full" style={{ width: `${rxPercent}%` }} />
              <div className="bg-blue-500 h-full" style={{ width: `${100 - rxPercent}%` }} />
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-1">
            <span>↓ {formatBytesRate(c.rxBytesR)}</span>
            <span>↑ {formatBytesRate(c.txBytesR)}</span>
          </div>
        </div>
      );
    },
  }),

  usage: () => ({
    key: "usage",
    header: "Total Usage",
    sortValue: (c) => c.rxBytes + c.txBytes,
    align: "right" as const,
    render: (c) => (
      <div className="text-right">
        <div className="text-sm font-mono text-[var(--text-secondary)]">
          {formatBytes(c.rxBytes + c.txBytes)}
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">
          ↓{formatBytes(c.rxBytes)} ↑{formatBytes(c.txBytes)}
        </div>
      </div>
    ),
  }),

  signal: () => ({
    key: "signal",
    header: (
      <div className="flex items-center gap-1.5">
        Signal
        <InfoTooltip metric={METRIC_DEFINITIONS.rssi} />
      </div>
    ),
    sortValue: (c) => c.rssi || -100,
    render: (c) => {
      if (c.isWired || !c.rssi) return <span className="text-[var(--text-muted)]">—</span>;
      const quality = getSignalQuality(c.rssi);
      return <span className={quality.color}>{c.rssi} dBm</span>;
    },
  }),

  satisfaction: () => ({
    key: "satisfaction",
    header: (
      <div className="flex items-center gap-1.5">
        Experience
        <InfoTooltip metric={METRIC_DEFINITIONS.satisfaction} />
      </div>
    ),
    sortValue: (c) => c.satisfaction || 0,
    align: "center" as const,
    render: (c) => {
      if (c.isWired) return <span className="text-[var(--text-muted)]">—</span>;
      if (!c.satisfaction || c.satisfaction <= 0) {
        return <span className="text-[var(--text-muted)]">—</span>;
      }
      return (
        <div className="inline-flex items-center gap-1.5">
          <div className="w-12 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                c.satisfaction >= 80
                  ? "bg-emerald-500"
                  : c.satisfaction >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${c.satisfaction}%` }}
            />
          </div>
          <span
            className={`text-xs font-medium ${
              c.satisfaction >= 80
                ? "text-emerald-600 dark:text-emerald-400"
                : c.satisfaction >= 60
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {c.satisfaction}%
          </span>
        </div>
      );
    },
  }),

  uptime: () => ({
    key: "uptime",
    header: "Uptime",
    sortValue: (c) => c.uptime,
    render: (c) => (
      <span className="text-sm text-[var(--text-tertiary)]">{formatUptime(c.uptime)}</span>
    ),
  }),

  connectedTo: () => ({
    key: "connectedTo",
    header: "Connected To",
    sortValue: (c) => (c.isWired ? c.swName || "" : c.apName || "").toLowerCase(),
    render: (c) => {
      if (c.isWired) {
        return <span className="text-sm text-[var(--text-tertiary)]">{c.swName || "—"}</span>;
      }
      return (
        <div>
          <div className="text-sm text-[var(--text-secondary)]">{c.apName || "—"}</div>
          {c.channel > 0 && (
            <div className="text-xs text-[var(--text-tertiary)]">Ch {c.channel}</div>
          )}
        </div>
      );
    },
  }),

  channel: () => ({
    key: "channel",
    header: "Channel",
    sortValue: (c) => c.channel || 0,
    render: (c) => {
      if (c.isWired || !c.channel) return <span className="text-[var(--text-muted)]">—</span>;
      return <span className="text-sm text-[var(--text-secondary)]">{c.channel}</span>;
    },
  }),

  ssid: () => ({
    key: "ssid",
    header: "SSID",
    sortValue: (c) => c.apName?.toLowerCase() || "",
    render: (c) => {
      if (c.isWired) return <span className="text-[var(--text-muted)]">—</span>;
      return <span className="text-sm text-[var(--text-secondary)]">{c.apName || "—"}</span>;
    },
  }),

  vlan: () => ({
    key: "vlan",
    header: "VLAN",
    sortValue: (c) => c.vlan || "",
    render: (c) => <span className="text-sm text-[var(--text-secondary)]">{c.vlan || "—"}</span>,
  }),
};

/**
 * ClientList component - unified client table display
 */
export function ClientList({
  clients,
  onClientClick,
  columns = CLIENT_COLUMN_PRESETS.full,
  variant = "full",
  emptyMessage = "No clients found",
  defaultSortKey = "bandwidth",
  defaultSortDir = "desc",
  totalBandwidth = 0,
  maxBandwidth = 0,
  showConnectionIndicator = false,
}: ClientListProps) {
  // Calculate bandwidth stats if not provided (for bandwidthBar column)
  const calculatedStats = useMemo(() => {
    if (totalBandwidth > 0 && maxBandwidth > 0) {
      return { totalBandwidth, maxBandwidth };
    }
    let total = 0;
    let max = 0;
    for (const c of clients) {
      const bw = c.rxBytesR + c.txBytesR;
      total += bw;
      if (bw > max) max = bw;
    }
    return { totalBandwidth: total, maxBandwidth: max };
  }, [clients, totalBandwidth, maxBandwidth]);

  // Build columns from the requested keys
  const tableColumns = useMemo(() => {
    const ctx: ColumnContext = {
      variant,
      totalBandwidth: calculatedStats.totalBandwidth,
      maxBandwidth: calculatedStats.maxBandwidth,
      showConnectionIndicator,
    };

    return columns.map((key) => {
      const factory = columnDefinitions[key];
      if (!factory) {
        return {
          key,
          header: key,
          sortValue: () => 0,
          render: () => <span>—</span>,
        };
      }
      return factory(ctx);
    });
  }, [columns, variant, calculatedStats, showConnectionIndicator]);

  const mappedSortKey = useMemo(() => {
    if (defaultSortKey === "bandwidth" && columns.includes("bandwidthBar")) {
      return "bandwidthBar";
    }
    return defaultSortKey;
  }, [defaultSortKey, columns]);

  return (
    <DataTable
      data={clients}
      columns={tableColumns}
      keyExtractor={(c) => c.mac}
      onRowClick={onClientClick}
      emptyMessage={emptyMessage}
      defaultSortKey={mappedSortKey}
      defaultSortDir={defaultSortDir}
    />
  );
}
