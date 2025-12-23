import { useLayoutEffect, useRef } from "react";
import { Zap, AlertTriangle, Monitor, ExternalLink } from "lucide-react";
import { formatBytes, formatBytesRate } from "@/lib/format";
import type { Client } from "@/types/influx";

export interface PortTooltipPort {
  portIdx: number;
  name?: string;
  speed: number;
  rxBytes: number;
  txBytes: number;
  rxBytesR: number;
  txBytesR: number;
  rxErrors: number;
  txErrors: number;
  poePower: number;
  poeVoltage: number;
}

interface PortTooltipProps {
  port: PortTooltipPort;
  clients: Client[];
  position: { x: number; y: number };
  onNavigateToClient: (mac: string) => void;
}

export function PortTooltip({ port, clients, position, onNavigateToClient }: PortTooltipProps) {
  const isUp = port.speed > 0;
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Use useLayoutEffect to adjust position synchronously before paint
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      let newX = position.x;
      let newY = position.y + 10;

      // Keep within viewport horizontally
      if (rect.right > window.innerWidth - 10) {
        newX = window.innerWidth - rect.width / 2 - 10;
      }
      if (rect.left < 10) {
        newX = rect.width / 2 + 10;
      }

      // If tooltip would go below viewport, show above
      if (newY + rect.height > window.innerHeight - 10) {
        newY = position.y - rect.height - 10;
      }

      tooltipRef.current.style.left = `${newX}px`;
      tooltipRef.current.style.top = `${newY}px`;
    }
  }, [position]);

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-[var(--bg-secondary)] text-[var(--text-primary)] text-xs rounded-lg shadow-xl p-3 min-w-[220px] max-w-[300px] border border-[var(--border-primary)]"
      style={{
        left: position.x,
        top: position.y + 10,
        transform: "translateX(-50%)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[var(--border-primary)]">
        <span className="font-semibold text-[var(--text-primary)]">Port {port.portIdx}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            isUp
              ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
          }`}
        >
          {isUp ? `${port.speed} Mbps` : "Down"}
        </span>
      </div>

      {port.name && (
        <div className="text-[var(--text-secondary)] mb-2 text-[11px]">{port.name}</div>
      )}

      {isUp && (
        <>
          {/* Traffic */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div>
              <div className="text-[var(--text-tertiary)] text-[10px]">TX</div>
              <div className="text-emerald-500 dark:text-emerald-400 font-medium">
                {formatBytesRate(port.txBytesR)}
              </div>
            </div>
            <div>
              <div className="text-[var(--text-tertiary)] text-[10px]">RX</div>
              <div className="text-blue-500 dark:text-blue-400 font-medium">
                {formatBytesRate(port.rxBytesR)}
              </div>
            </div>
          </div>

          {/* Total traffic */}
          <div className="text-[var(--text-tertiary)] text-[10px] mb-2">
            Total transferred: {formatBytes(port.rxBytes + port.txBytes)}
          </div>

          {/* PoE */}
          {port.poePower > 0 && (
            <div className="flex items-center gap-1.5 mb-2 py-1.5 px-2 bg-yellow-500/10 dark:bg-yellow-500/20 rounded text-yellow-600 dark:text-yellow-400">
              <Zap className="w-3 h-3" />
              <span>
                {port.poePower.toFixed(2)}W @ {port.poeVoltage.toFixed(1)}V
              </span>
            </div>
          )}

          {/* Errors */}
          {(port.rxErrors > 0 || port.txErrors > 0) && (
            <div className="flex items-center gap-1.5 mb-2 py-1.5 px-2 bg-red-500/10 dark:bg-red-500/20 rounded text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3 h-3" />
              <span>
                Errors: RX {port.rxErrors.toLocaleString()} / TX {port.txErrors.toLocaleString()}
              </span>
            </div>
          )}
        </>
      )}

      {/* Connected devices */}
      {clients.length > 0 && (
        <div className="pt-2 mt-2 border-t border-[var(--border-primary)]">
          <div className="text-[var(--text-tertiary)] text-[10px] mb-1.5">
            Connected Device{clients.length > 1 ? "s" : ""} ({clients.length})
          </div>
          <div className="space-y-1.5">
            {clients.slice(0, 5).map((client) => (
              <button
                key={client.mac}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToClient(client.mac);
                }}
                className="w-full flex items-center gap-2 p-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-primary)] transition-colors text-left group"
              >
                <Monitor className="w-3.5 h-3.5 text-[var(--text-tertiary)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-[var(--text-primary)]">
                    {client.name || client.hostname || "Unknown"}
                  </div>
                  {client.ip && (
                    <div className="text-[10px] text-[var(--text-tertiary)]">{client.ip}</div>
                  )}
                </div>
                <ExternalLink className="w-3 h-3 text-[var(--text-tertiary)] group-hover:text-purple-400 flex-shrink-0" />
              </button>
            ))}
            {clients.length > 5 && (
              <div className="text-[var(--text-tertiary)] text-[10px] text-center pt-1">
                +{clients.length - 5} more device
                {clients.length - 5 > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}

      {/* No devices connected hint */}
      {clients.length === 0 && isUp && (
        <div className="pt-2 mt-2 border-t border-[var(--border-primary)] text-[var(--text-muted)] text-[10px]">
          No clients directly connected (may be uplink or infrastructure)
        </div>
      )}

      {/* Arrow */}
      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--bg-secondary)] border-l border-t border-[var(--border-primary)] rotate-45" />
    </div>
  );
}
