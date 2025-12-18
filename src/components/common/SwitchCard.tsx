import { useNavigate } from "react-router-dom";
import {
  Network,
  Cpu,
  HardDrive,
  Thermometer,
  Zap,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "./Badge";
import { formatBytesRate, formatPercent, formatTemp } from "@/lib/format";
import type { Switch, SwitchPort } from "@/types/influx";

interface SwitchCardProps {
  sw: Switch;
  ports: SwitchPort[];
  activePorts: number;
  poePower: number;
  bandwidth: number;
  errors: number;
  onPortMouseEnter: (port: SwitchPort, event: React.MouseEvent<HTMLDivElement>) => void;
  onPortMouseLeave: () => void;
  getPortColor: (port: SwitchPort) => string;
}

export function SwitchCard({
  sw,
  ports,
  activePorts,
  poePower,
  bandwidth,
  errors,
  onPortMouseEnter,
  onPortMouseLeave,
  getPortColor,
}: SwitchCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/switches/${encodeURIComponent(sw.mac)}`)}
      className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 card-hover cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
            <Network className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{sw.name}</h3>
            <p className="text-sm text-[var(--text-tertiary)]">{sw.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {errors > 0 && <Badge variant="warning">{errors} errors</Badge>}
          <Badge variant="success">Online</Badge>
          <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
        </div>
      </div>

      {/* Port Mini Visualization */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-tertiary)]">
            {activePorts} active port{activePorts !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">{formatBytesRate(bandwidth)}</span>
        </div>
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {ports
            .sort((a, b) => a.portIdx - b.portIdx)
            .map((port) => (
              <div
                key={port.portIdx}
                onMouseEnter={(e) => onPortMouseEnter(port, e)}
                onMouseLeave={onPortMouseLeave}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/switches/${encodeURIComponent(sw.name)}/port/${port.portIdx}`);
                }}
                className={`w-6 h-6 rounded text-[10px] font-medium flex items-center justify-center cursor-pointer transition-transform hover:scale-125 hover:z-10 ${getPortColor(port)} ${port.speed > 0 ? "text-white" : "text-[var(--text-muted)]"}`}
              >
                {port.portIdx}
              </div>
            ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        <StatItem icon={Cpu} value={formatPercent(sw.cpu)} label="CPU" />
        <StatItem icon={HardDrive} value={formatPercent(sw.mem)} label="Memory" />
        <StatItem
          icon={Thermometer}
          value={sw.temperature > 0 ? formatTemp(sw.temperature) : "—"}
          label="Temp"
        />
        <StatItem
          icon={Zap}
          value={poePower > 0 ? `${poePower.toFixed(0)}W` : "—"}
          label="PoE"
          iconColor="text-yellow-500"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] pt-4 mt-4 border-t border-[var(--border-primary)]">
        <span>{sw.ip}</span>
        <span>v{sw.version}</span>
      </div>
    </div>
  );
}

function StatItem({
  icon: Icon,
  value,
  label,
  iconColor = "text-[var(--text-tertiary)]",
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  iconColor?: string;
}) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1 ${iconColor} mb-1`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="text-lg font-bold font-[var(--font-display)] text-[var(--text-primary)]">
        {value}
      </div>
      <div className="text-[10px] text-[var(--text-tertiary)]">{label}</div>
    </div>
  );
}
