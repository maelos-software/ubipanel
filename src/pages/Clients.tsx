import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, X, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ClientList } from "@/components/common/ClientList";
import { CLIENT_COLUMN_PRESETS, type ClientColumnKey } from "@/components/common/clientListPresets";
import { useClients } from "@/hooks/useNetworkData";
import { usePreferences } from "@/hooks/usePreferences";
import { useFilteredClients, type ClientFilterType } from "@/hooks/useFilteredClients";

/**
 * Clients page - All network clients listing
 */
export function Clients() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: clients = [], isLoading } = useClients();
  const { clientListView } = usePreferences();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilterType>("all");

  // Additional filter states
  const [selectedAP, setSelectedAP] = useState<string>("all");
  const [selectedSwitch, setSelectedSwitch] = useState<string>("all");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");

  // Get VLAN filter from URL
  const vlanFilter = searchParams.get("vlan");

  const filteredClients = useFilteredClients({
    clients,
    search,
    filter,
    vlanFilter,
    selectedAP,
    selectedSwitch,
    selectedChannel,
  });

  // Get columns based on user preference
  const columns = useMemo((): ClientColumnKey[] => {
    switch (clientListView) {
      case "minimal":
        return CLIENT_COLUMN_PRESETS.prefMinimal;
      case "detailed":
        return CLIENT_COLUMN_PRESETS.prefDetailed;
      case "standard":
      default:
        return CLIENT_COLUMN_PRESETS.prefStandard;
    }
  }, [clientListView]);

  // Clear VLAN filter
  const clearVlanFilter = () => {
    searchParams.delete("vlan");
    setSearchParams(searchParams);
  };

  // Build filter options from the client data
  const apOptions = useMemo(() => {
    const aps = new Set<string>();
    clients.forEach((c) => {
      if (c.apName) aps.add(c.apName);
    });
    return Array.from(aps).sort();
  }, [clients]);

  const switchOptions = useMemo(() => {
    const switches = new Set<string>();
    clients.forEach((c) => {
      if (c.swName) switches.add(c.swName);
    });
    return Array.from(switches).sort();
  }, [clients]);

  const channelOptions = useMemo(() => {
    const channels = new Set<number>();
    clients.forEach((c) => {
      if (c.channel) channels.add(c.channel);
    });
    return Array.from(channels).sort((a, b) => a - b);
  }, [clients]);

  // Check if any advanced filters are active
  const hasAdvancedFilters =
    selectedAP !== "all" || selectedSwitch !== "all" || selectedChannel !== "all";

  const clearAdvancedFilters = () => {
    setSelectedAP("all");
    setSelectedSwitch("all");
    setSelectedChannel("all");
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        description={
          vlanFilter
            ? `${filteredClients.length} of ${clients.length} devices on VLAN ${vlanFilter}`
            : `${clients.length} devices connected to your network`
        }
        breadcrumb="Network"
      />

      {/* VLAN Filter Banner */}
      {vlanFilter && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl dark:bg-purple-500/20 dark:border-purple-500/30">
          <span className="text-sm text-purple-700 dark:text-purple-300">
            Showing clients on <span className="font-semibold">VLAN {vlanFilter}</span>
          </span>
          <button
            onClick={clearVlanFilter}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 hover:text-purple-900 hover:bg-purple-500/20 dark:text-purple-300 dark:hover:text-purple-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear filter
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search by name, IP, or MAC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-2 bg-[var(--bg-tertiary)] rounded-xl p-1">
          {(["all", "wireless", "wired", "guest", "problem"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? "bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* AP Filter */}
        <div className="relative">
          <select
            value={selectedAP}
            onChange={(e) => setSelectedAP(e.target.value)}
            className="appearance-none bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 pr-8 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          >
            <option value="all">All Access Points</option>
            {apOptions.map((ap) => (
              <option key={ap} value={ap}>
                {ap}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
        </div>

        {/* Switch Filter */}
        <div className="relative">
          <select
            value={selectedSwitch}
            onChange={(e) => setSelectedSwitch(e.target.value)}
            className="appearance-none bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 pr-8 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          >
            <option value="all">All Switches</option>
            {switchOptions.map((sw) => (
              <option key={sw} value={sw}>
                {sw}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
        </div>

        {/* Channel Filter */}
        <div className="relative">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="appearance-none bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg px-3 py-2 pr-8 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          >
            <option value="all">All Channels</option>
            {channelOptions.map((ch) => (
              <option key={ch} value={ch.toString()}>
                Channel {ch}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
        </div>

        {/* Clear Advanced Filters */}
        {hasAdvancedFilters && (
          <button
            onClick={clearAdvancedFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-500/10 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <ClientList
        clients={filteredClients}
        onClientClick={(c) => navigate(`/clients/${encodeURIComponent(c.mac)}`)}
        columns={columns}
        emptyMessage={isLoading ? "Loading clients..." : "No clients found"}
        defaultSortKey="bandwidth"
        defaultSortDir="desc"
      />
    </div>
  );
}
