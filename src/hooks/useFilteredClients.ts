/**
 * Hook for filtering and searching a list of clients
 */

import { useMemo } from "react";
import type { Client } from "@/types/influx";
import { THRESHOLDS } from "@/lib/config";

export type ClientFilterType = "all" | "wired" | "wireless" | "guest" | "problem";

interface UseFilteredClientsOptions {
  clients: Client[];
  search: string;
  filter: ClientFilterType;
  vlanFilter?: string | null;
  selectedAP?: string;
  selectedSwitch?: string;
  selectedChannel?: string;
}

/**
 * Filter and search a list of clients based on various criteria
 */
export function useFilteredClients({
  clients,
  search,
  filter,
  vlanFilter,
  selectedAP = "all",
  selectedSwitch = "all",
  selectedChannel = "all",
}: UseFilteredClientsOptions) {
  return useMemo(() => {
    return clients.filter((c) => {
      // VLAN filter
      if (vlanFilter && c.vlan !== vlanFilter) return false;

      // Type filter
      if (filter === "wired" && !c.isWired) return false;
      if (filter === "wireless" && c.isWired) return false;
      if (filter === "guest" && !c.isGuest) return false;

      // Problem filter: Low satisfaction or Poor Signal
      if (filter === "problem") {
        const isLowSat = c.satisfaction < THRESHOLDS.satisfaction.poor;
        const isPoorSignal = !c.isWired && c.signal < THRESHOLDS.signal.poor;
        if (!isLowSat && !isPoorSignal) return false;
      }

      // AP filter
      if (selectedAP !== "all" && c.apName !== selectedAP) return false;

      // Switch filter
      if (selectedSwitch !== "all" && c.swName !== selectedSwitch) return false;

      // Channel filter
      if (selectedChannel !== "all" && c.channel?.toString() !== selectedChannel) return false;

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          c.name?.toLowerCase().includes(searchLower) ||
          c.hostname?.toLowerCase().includes(searchLower) ||
          c.ip?.toLowerCase().includes(searchLower) ||
          c.mac?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [clients, search, filter, vlanFilter, selectedAP, selectedSwitch, selectedChannel]);
}
