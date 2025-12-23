import { useQuery } from "@tanstack/react-query";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL } from "@/lib/config";
import { AlertTriangle, CheckCircle, Wifi, Network, Router } from "lucide-react";
import { Link } from "react-router-dom";

interface DeviceHealth {
  type: "ap" | "switch" | "gateway";
  name: string;
  mac: string;
  online: boolean;
}

export function NetworkHealth() {
  const { data: health } = useQuery({
    queryKey: ["networkHealth"],
    queryFn: async () => {
      // Check APs
      const apResponse = await queryInflux(`
        SELECT last(cpu) as cpu FROM uap WHERE time > now() - 5m GROUP BY "mac", "name"
      `);

      // Check Switches
      const swResponse = await queryInflux(`
        SELECT last(cpu) as cpu FROM usw WHERE time > now() - 5m GROUP BY "mac", "name"
      `);

      // Check Gateway
      const gwResponse = await queryInflux(`
        SELECT last(cpu) as cpu FROM usg WHERE time > now() - 5m GROUP BY "mac", "name"
      `);

      const devices: DeviceHealth[] = [];

      // Parse APs
      const apSeries = apResponse.results[0]?.series || [];
      apSeries.forEach((s: { tags?: { mac?: string; name?: string } }) => {
        devices.push({
          type: "ap",
          name: s.tags?.name || "Unknown AP",
          mac: s.tags?.mac || "",
          online: true,
        });
      });

      // Parse Switches
      const swSeries = swResponse.results[0]?.series || [];
      swSeries.forEach((s: { tags?: { mac?: string; name?: string } }) => {
        devices.push({
          type: "switch",
          name: s.tags?.name || "Unknown Switch",
          mac: s.tags?.mac || "",
          online: true,
        });
      });

      // Parse Gateway
      const gwSeries = gwResponse.results[0]?.series || [];
      gwSeries.forEach((s: { tags?: { mac?: string; name?: string } }) => {
        devices.push({
          type: "gateway",
          name: s.tags?.name || "Gateway",
          mac: s.tags?.mac || "",
          online: true,
        });
      });

      return {
        devices,
        offlineCount: devices.filter((d) => !d.online).length,
        totalDevices: devices.length,
      };
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  if (!health) return null;

  const { devices, totalDevices } = health;
  const offlineDevices = devices.filter((d) => !d.online);
  const apCount = devices.filter((d) => d.type === "ap").length;
  const swCount = devices.filter((d) => d.type === "switch").length;
  const gwCount = devices.filter((d) => d.type === "gateway").length;

  if (offlineDevices.length > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-700 dark:text-red-400">
          {offlineDevices.length} device{offlineDevices.length > 1 ? "s" : ""} offline
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
      <div className="flex items-center gap-1.5">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span>{totalDevices} devices</span>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <Link
          to="/access-points"
          className="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <Wifi className="w-3.5 h-3.5" />
          <span>{apCount}</span>
        </Link>
        <Link
          to="/switches"
          className="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <Network className="w-3.5 h-3.5" />
          <span>{swCount}</span>
        </Link>
        <Link
          to="/gateway"
          className="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <Router className="w-3.5 h-3.5" />
          <span>{gwCount}</span>
        </Link>
      </div>
    </div>
  );
}
