import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/common/Badge";
import { DataTable } from "@/components/common/DataTable";
import { useTotalTrafficByApp, useTrafficByCountry } from "@/hooks/useTrafficData";
import { formatBytes } from "@/lib/format";
import { getApplicationName, getCategoryName } from "@/lib/dpiMappings";
import { TIME_RANGES_LONG } from "@/lib/timeRanges";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Globe, Server, Laptop, AlertTriangle } from "lucide-react";
import { useChartColors } from "@/hooks/useChartColors";

interface AppAggregated {
  application: number;
  appName: string;
  category: number;
  categoryName: string;
  bytesRx: number;
  bytesTx: number;
  bytesTotal: number;
  clientCount: number;
}

interface CategoryAggregated {
  category: number;
  categoryName: string;
  bytesTotal: number;
}

export function Applications() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState(TIME_RANGES_LONG[1]); // Default to 24h
  const chartColors = useChartColors();

  // Use pre-aggregated data for efficiency (no client-side aggregation needed)
  const {
    data: appTraffic = [],
    isLoading: appLoading,
    error: appError,
  } = useTotalTrafficByApp(timeRange.value);
  const {
    data: countryTraffic = [],
    isLoading: countryLoading,
    error: countryError,
  } = useTrafficByCountry(timeRange.value);

  // Check if traffic data is available
  const hasTrafficData = appTraffic.length > 0 || countryTraffic.length > 0;
  const isLoading = appLoading || countryLoading;
  const error = appError || countryError;

  // Data is already aggregated by app - just map and sort
  const topApps: AppAggregated[] = appTraffic
    .map((app) => ({
      application: app.application,
      appName: app.appName || getApplicationName(app.application, app.category),
      category: app.category,
      categoryName: app.categoryName || getCategoryName(app.category),
      bytesRx: app.bytesRx,
      bytesTx: app.bytesTx,
      bytesTotal: app.bytesTotal,
      clientCount: app.clientCount,
    }))
    .sort((a, b) => b.bytesTotal - a.bytesTotal)
    .slice(0, 20);

  // Aggregate traffic by category (still need to do this client-side)
  const categoryAggregatedMap = appTraffic.reduce(
    (acc, item) => {
      const key = item.category;
      if (!acc[key]) {
        acc[key] = {
          category: key,
          categoryName: item.categoryName || getCategoryName(item.category),
          bytesTotal: 0,
        };
      }
      acc[key].bytesTotal += item.bytesTotal;
      return acc;
    },
    {} as Record<number, CategoryAggregated>
  );

  const categoryData: CategoryAggregated[] = Object.values(categoryAggregatedMap)
    .sort((a, b) => b.bytesTotal - a.bytesTotal)
    .slice(0, 10);

  // Top countries
  const countryAggregated = countryTraffic.reduce(
    (acc, item) => {
      const key = item.country;
      if (!acc[key]) {
        acc[key] = {
          country: key,
          bytesRx: 0,
          bytesTx: 0,
          bytesTotal: 0,
        };
      }
      acc[key].bytesRx += item.bytesRx;
      acc[key].bytesTx += item.bytesTx;
      acc[key].bytesTotal += item.bytesTotal;
      return acc;
    },
    {} as Record<string, { country: string; bytesRx: number; bytesTx: number; bytesTotal: number }>
  );

  const topCountries = Object.values(countryAggregated)
    .sort((a, b) => b.bytesTotal - a.bytesTotal)
    .slice(0, 15);

  // Colors for charts
  const colors = [
    "#8b5cf6",
    "#a78bfa",
    "#c4b5fd",
    "#7c3aed",
    "#6d28d9",
    "#5b21b6",
    "#4c1d95",
    "#a855f7",
    "#9333ea",
    "#7e22ce",
  ];

  // If no traffic data available, show a message
  if (!isLoading && !hasTrafficData && !error) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Application Traffic"
          description="Traffic analysis by application and geographic distribution"
        />
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No Traffic Data Available
          </h3>
          <p className="text-sm text-[var(--text-tertiary)] max-w-md mx-auto">
            Traffic data collection requires the optional traffic collector service to be running.
            See the{" "}
            <code className="text-purple-600 bg-purple-500/10 dark:bg-purple-500/20 px-1 rounded">
              collector/
            </code>{" "}
            directory for setup instructions.
          </p>
        </div>
      </div>
    );
  }

  const timeRangeButtons = (
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
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Application Traffic"
        description="Traffic analysis by application and geographic distribution"
        actions={timeRangeButtons}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 dark:bg-purple-900/30">
              <Server className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">{topApps.length}</div>
              <div className="text-sm text-[var(--text-tertiary)]">Applications</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 dark:bg-blue-900/30">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {topCountries.length}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Countries</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10 dark:bg-green-900/30">
              <Laptop className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {Math.max(...appTraffic.map((a) => a.clientCount), 0)}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Peak Clients</div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 dark:bg-amber-900/30">
              <Server className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[var(--text-primary)]">
                {formatBytes(topApps.reduce((sum, a) => sum + a.bytesTotal, 0))}
              </div>
              <div className="text-sm text-[var(--text-tertiary)]">Total Traffic</div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Traffic by Category */}
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Traffic by Category
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical">
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatBytes(v)}
                  tick={{ fill: chartColors.tickText, fontSize: 11 }}
                  stroke={chartColors.axisLine}
                />
                <YAxis
                  type="category"
                  dataKey="categoryName"
                  width={120}
                  tick={{ fill: chartColors.tickText, fontSize: 11 }}
                  stroke={chartColors.axisLine}
                />
                <Tooltip
                  cursor={{ fill: chartColors.grid, opacity: 0.2 }}
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: chartColors.tooltipText }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  formatter={(value: number) => formatBytes(value)}
                />
                <Bar dataKey="bytesTotal" radius={[0, 4, 4, 0]}>
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Traffic by Country */}
        <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Traffic by Country
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCountries.slice(0, 10)} layout="vertical">
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatBytes(v)}
                  tick={{ fill: chartColors.tickText, fontSize: 11 }}
                  stroke={chartColors.axisLine}
                />
                <YAxis
                  type="category"
                  dataKey="country"
                  width={40}
                  tick={{ fill: chartColors.tickText, fontSize: 11 }}
                  stroke={chartColors.axisLine}
                />
                <Tooltip
                  cursor={{ fill: chartColors.grid, opacity: 0.2 }}
                  contentStyle={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: "8px",
                  }}
                  itemStyle={{ color: chartColors.tooltipText }}
                  labelStyle={{ color: chartColors.tooltipText }}
                  formatter={(value: number) => formatBytes(value)}
                />
                <Bar dataKey="bytesTotal" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Applications Table */}
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Top Applications</h3>
        <DataTable<AppAggregated>
          data={topApps}
          keyExtractor={(app) => String(app.application)}
          onRowClick={(app) => navigate(`/applications/${app.application}`)}
          columns={[
            {
              key: "appName",
              header: "Application",
              render: (app) => (
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{app.appName}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">ID: {app.application}</div>
                </div>
              ),
            },
            {
              key: "categoryName",
              header: "Category",
              render: (app) => <Badge variant="info">{app.categoryName}</Badge>,
            },
            {
              key: "clientCount",
              header: "Clients",
              render: (app) => (
                <span className="text-[var(--text-tertiary)]">{app.clientCount}</span>
              ),
            },
            {
              key: "bytesRx",
              header: "Download",
              render: (app) => <span className="text-emerald-600">{formatBytes(app.bytesRx)}</span>,
            },
            {
              key: "bytesTx",
              header: "Upload",
              render: (app) => <span className="text-blue-600">{formatBytes(app.bytesTx)}</span>,
            },
            {
              key: "bytesTotal",
              header: "Total",
              sortValue: (app) => app.bytesTotal,
              render: (app) => (
                <span className="font-medium text-[var(--text-primary)]">
                  {formatBytes(app.bytesTotal)}
                </span>
              ),
            },
          ]}
          defaultSortKey="bytesTotal"
          defaultSortDir="desc"
        />
      </div>

      {/* Country Traffic Table */}
      <div className="bg-[var(--bg-secondary)] rounded-xl shadow-sm border border-[var(--border-primary)] p-6">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Traffic by Country
        </h3>
        <DataTable<(typeof topCountries)[number]>
          data={topCountries}
          keyExtractor={(c) => c.country}
          columns={[
            {
              key: "country",
              header: "Country",
              render: (c) => (
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getCountryFlag(c.country)}</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {getCountryName(c.country)}
                  </span>
                  <span className="text-[var(--text-tertiary)]">({c.country})</span>
                </div>
              ),
            },
            {
              key: "bytesRx",
              header: "Download",
              render: (c) => <span className="text-emerald-600">{formatBytes(c.bytesRx)}</span>,
            },
            {
              key: "bytesTx",
              header: "Upload",
              render: (c) => <span className="text-blue-600">{formatBytes(c.bytesTx)}</span>,
            },
            {
              key: "bytesTotal",
              header: "Total",
              sortValue: (c) => c.bytesTotal,
              render: (c) => (
                <span className="font-medium text-[var(--text-primary)]">
                  {formatBytes(c.bytesTotal)}
                </span>
              ),
            },
          ]}
          defaultSortKey="bytesTotal"
          defaultSortDir="desc"
        />
      </div>
    </div>
  );
}

// Helper functions for country display
function getCountryFlag(code: string): string {
  if (code === "ZZ" || code.length !== 2) return "🌍";
  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function getCountryName(code: string): string {
  const countries: Record<string, string> = {
    US: "United States",
    GB: "United Kingdom",
    DE: "Germany",
    FR: "France",
    JP: "Japan",
    CA: "Canada",
    AU: "Australia",
    NL: "Netherlands",
    IE: "Ireland",
    SG: "Singapore",
    SE: "Sweden",
    FI: "Finland",
    NO: "Norway",
    DK: "Denmark",
    CH: "Switzerland",
    AT: "Austria",
    BE: "Belgium",
    IT: "Italy",
    ES: "Spain",
    PT: "Portugal",
    BR: "Brazil",
    MX: "Mexico",
    AR: "Argentina",
    CL: "Chile",
    CO: "Colombia",
    IN: "India",
    CN: "China",
    KR: "South Korea",
    TW: "Taiwan",
    HK: "Hong Kong",
    ID: "Indonesia",
    MY: "Malaysia",
    TH: "Thailand",
    VN: "Vietnam",
    PH: "Philippines",
    NZ: "New Zealand",
    ZA: "South Africa",
    AE: "UAE",
    IL: "Israel",
    RU: "Russia",
    UA: "Ukraine",
    PL: "Poland",
    CZ: "Czech Republic",
    RO: "Romania",
    HU: "Hungary",
    GR: "Greece",
    TR: "Turkey",
    ZZ: "Unknown",
  };
  return countries[code] || code;
}
