import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Server, Cpu, HardDrive, Thermometer, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { queryInflux } from "@/lib/influx";
import { REFETCH_INTERVAL, THRESHOLDS } from "@/lib/config";
import { formatUptime } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Device {
  name: string;
  mac: string;
  type: "ap" | "switch" | "gateway";
  uptime: number;
  cpu: number;
  mem: number;
  temp?: number;
}

export function InfrastructureReport() {
  const navigate = useNavigate();

  // Get all devices
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["report-infrastructure"],
    queryFn: async () => {
      const allDevices: Device[] = [];

      // APs
      const apResult = await queryInflux(`
        SELECT LAST(uptime) AS uptime, LAST(cpu) AS cpu, LAST(mem) AS mem
        FROM uap WHERE time > now() - 5m GROUP BY "name", mac
      `);
      (apResult.results[0]?.series || []).forEach((s) => {
        allDevices.push({
          name: s.tags?.name || "Unknown AP",
          mac: s.tags?.mac || "",
          type: "ap",
          uptime: (s.values[0][1] as number) || 0,
          cpu: (s.values[0][2] as number) || 0,
          mem: (s.values[0][3] as number) || 0,
        });
      });

      // Switches
      const swResult = await queryInflux(`
        SELECT LAST(uptime) AS uptime, LAST(cpu) AS cpu, LAST(mem) AS mem, LAST(general_temperature) AS temp
        FROM usw WHERE time > now() - 5m GROUP BY "name", mac
      `);
      (swResult.results[0]?.series || []).forEach((s) => {
        allDevices.push({
          name: s.tags?.name || "Unknown Switch",
          mac: s.tags?.mac || "",
          type: "switch",
          uptime: (s.values[0][1] as number) || 0,
          cpu: (s.values[0][2] as number) || 0,
          mem: (s.values[0][3] as number) || 0,
          temp: (s.values[0][4] as number) || undefined,
        });
      });

      // Gateway
      const gwResult = await queryInflux(`
        SELECT LAST(uptime) AS uptime, LAST(cpu) AS cpu, LAST(mem) AS mem, LAST(temp_cpu) AS temp
        FROM usg WHERE time > now() - 5m GROUP BY "name", mac
      `);
      (gwResult.results[0]?.series || []).forEach((s) => {
        allDevices.push({
          name: s.tags?.name || "Gateway",
          mac: s.tags?.mac || "",
          type: "gateway",
          uptime: (s.values[0][1] as number) || 0,
          cpu: (s.values[0][2] as number) || 0,
          mem: (s.values[0][3] as number) || 0,
          temp: (s.values[0][4] as number) || undefined,
        });
      });

      return allDevices;
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  // CPU/Memory trend
  const { data: resourceTrend = [] } = useQuery({
    queryKey: ["report-infrastructure-trend"],
    queryFn: async () => {
      const result = await queryInflux(`
        SELECT MEAN(cpu) AS cpu, MEAN(mem) AS mem
        FROM uap, usw, usg
        WHERE time > now() - 24h
        GROUP BY time(30m)
      `);
      const series = result.results[0]?.series?.[0];
      if (!series) return [];
      return series.values
        .filter((v) => v[1] !== null)
        .map((v) => ({
          time: new Date(v[0] as string).getTime(),
          cpu: (v[1] as number) || 0,
          mem: (v[2] as number) || 0,
        }));
    },
    refetchInterval: REFETCH_INTERVAL,
  });

  const recentlyRestarted = devices.filter((d) => d.uptime < THRESHOLDS.uptime.recent);
  const highCpu = devices.filter((d) => d.cpu > THRESHOLDS.resource.high);
  const highMem = devices.filter((d) => d.mem > THRESHOLDS.resource.high);
  const avgCpu =
    devices.length > 0 ? devices.reduce((sum, d) => sum + d.cpu, 0) / devices.length : 0;
  const avgMem =
    devices.length > 0 ? devices.reduce((sum, d) => sum + d.mem, 0) / devices.length : 0;

  const getDeviceLink = (device: Device) => {
    switch (device.type) {
      case "ap":
        return `/access-points/${encodeURIComponent(device.mac)}`;
      case "switch":
        return `/switches/${encodeURIComponent(device.mac)}`;
      case "gateway":
        return "/gateway";
    }
  };

  return (
    <div>
      <PageHeader
        title="Infrastructure Uptime"
        description="Track device uptime, restarts, and system resource utilization"
        breadcrumb="Reports"
        breadcrumbHref="/reports"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Server className="w-4 h-4" />
            Total Devices
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{devices.length}</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <RefreshCw className="w-4 h-4 text-amber-500" />
            Recently Restarted
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{recentlyRestarted.length}</div>
          <div className="text-xs text-[var(--text-tertiary)]">Last 24 hours</div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <Cpu className="w-4 h-4" />
            Avg CPU
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {avgCpu.toFixed(0)}%
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
            <HardDrive className="w-4 h-4" />
            Avg Memory
          </div>
          <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">
            {avgMem.toFixed(0)}%
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] p-4">
          <div className="text-sm text-[var(--text-tertiary)]">High Resource</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {highCpu.length + highMem.length}
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">
            &gt;{THRESHOLDS.resource.high}% CPU or Memory
          </div>
        </div>
      </div>

      {/* Resource Trend */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Resource Utilization (24h)
        </h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={resourceTrend}>
              <XAxis
                dataKey="time"
                tickFormatter={(t) =>
                  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                      <div className="text-gray-400 mb-1">
                        {label ? new Date(label).toLocaleString() : ""}
                      </div>
                      <div>CPU: {(payload[0]?.value as number)?.toFixed(1)}%</div>
                      <div>Memory: {(payload[1]?.value as number)?.toFixed(1)}%</div>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="cpu" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mem" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500/10 dark:bg-purple-500/200" />
            <span className="text-sm text-[var(--text-tertiary)]">CPU</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500/10 dark:bg-blue-500/200" />
            <span className="text-sm text-[var(--text-tertiary)]">Memory</span>
          </div>
        </div>
      </div>

      {/* Devices Table */}
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">All Devices</h2>
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                  <th className="pb-3 pr-4">Device</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Uptime</th>
                  <th className="pb-3 pr-4">CPU</th>
                  <th className="pb-3 pr-4">Memory</th>
                  <th className="pb-3 pr-4">Temp</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {devices
                  .sort((a, b) => a.uptime - b.uptime) // Show recently restarted first
                  .map((device) => (
                    <tr
                      key={`${device.mac}-${device.type}`}
                      onClick={() => navigate(getDeviceLink(device))}
                      className="hover:bg-[var(--bg-tertiary)] cursor-pointer"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-[var(--text-primary)]">{device.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)] font-mono">
                          {device.mac}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="neutral">
                          {device.type === "ap"
                            ? "Access Point"
                            : device.type === "switch"
                              ? "Switch"
                              : "Gateway"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          {device.uptime < 86400 && (
                            <RefreshCw className="w-4 h-4 text-amber-500" />
                          )}
                          <span
                            className={
                              device.uptime < 86400
                                ? "text-amber-600 font-medium"
                                : "text-[var(--text-tertiary)]"
                            }
                          >
                            {formatUptime(device.uptime)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                device.cpu > THRESHOLDS.resource.high
                                  ? "bg-red-500/10 dark:bg-red-500/200"
                                  : device.cpu > THRESHOLDS.resource.moderate
                                    ? "bg-amber-500/10 dark:bg-amber-500/200"
                                    : "bg-green-500/10 dark:bg-green-500/200"
                              }`}
                              style={{ width: `${device.cpu}%` }}
                            />
                          </div>
                          <span className="text-sm text-[var(--text-tertiary)]">
                            {device.cpu.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                device.mem > THRESHOLDS.resource.high
                                  ? "bg-red-500/10 dark:bg-red-500/200"
                                  : device.mem > THRESHOLDS.resource.moderate
                                    ? "bg-amber-500/10 dark:bg-amber-500/200"
                                    : "bg-green-500/10 dark:bg-green-500/200"
                              }`}
                              style={{ width: `${device.mem}%` }}
                            />
                          </div>
                          <span className="text-sm text-[var(--text-tertiary)]">
                            {device.mem.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {device.temp !== undefined ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Thermometer className="w-4 h-4 text-[var(--text-tertiary)]" />
                            <span
                              className={
                                device.temp > THRESHOLDS.utilization.high
                                  ? "text-red-600"
                                  : "text-[var(--text-tertiary)]"
                              }
                            >
                              {device.temp.toFixed(0)}°C
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            device.uptime < THRESHOLDS.uptime.justRestarted
                              ? "error"
                              : device.uptime < THRESHOLDS.uptime.recent
                                ? "warning"
                                : device.cpu > THRESHOLDS.resource.high ||
                                    device.mem > THRESHOLDS.resource.high
                                  ? "warning"
                                  : "success"
                          }
                        >
                          {device.uptime < THRESHOLDS.uptime.justRestarted
                            ? "Just Restarted"
                            : device.uptime < THRESHOLDS.uptime.recent
                              ? "Recent Restart"
                              : device.cpu > THRESHOLDS.resource.high ||
                                  device.mem > THRESHOLDS.resource.high
                                ? "High Load"
                                : "Healthy"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
