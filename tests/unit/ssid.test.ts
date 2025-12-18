import { describe, it, expect } from "vitest";
import {
  normalizeSSIDs,
  getSSIDStats,
  getSSIDClientCount,
  getUniqueSSIDs,
  filterVAPsBySSID,
  filterVAPsByAP,
  groupVAPsByAP,
  getWirelessClientCount,
} from "../../src/lib/ssid";
import type { APVAP, Client } from "../../src/types/influx";

// Helper to create mock VAP data
function createVAP(overrides: Partial<APVAP> = {}): APVAP {
  return {
    apMac: "00:11:22:33:44:55",
    apName: "AP-Office",
    radio: "ng", // 2.4GHz (UnPoller uses "ng", "na", "6e")
    radioName: "ra0",
    essid: "TestNetwork",
    bssid: "00:11:22:33:44:56",
    channel: 6,
    isGuest: false,
    usage: "user",
    numSta: 5,
    rxBytes: 1000000,
    txBytes: 500000,
    satisfaction: 85,
    avgClientSignal: -55,
    ccq: 90,
    txPower: 20,
    ...overrides,
  };
}

// Helper to create mock Client data
function createClient(overrides: Partial<Client> = {}): Client {
  return {
    mac: "00:11:22:33:44:55",
    name: "Test Device",
    hostname: "test-device",
    ip: "192.168.1.100",
    isWired: false,
    apName: "AP-Office",
    swName: "",
    swPort: 0,
    channel: 6,
    radioProto: "ac",
    rssi: -55,
    signal: 80,
    satisfaction: 85,
    uptime: 3600,
    rxBytes: 100000,
    txBytes: 50000,
    rxBytesR: 1000,
    txBytesR: 500,
    vlan: "1",
    isGuest: false,
    ...overrides,
  };
}

describe("ssid.ts", () => {
  describe("normalizeSSIDs", () => {
    it("aggregates VAPs by SSID", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Home", apName: "AP-1", numSta: 3, radio: "ra0", channel: 1 }),
        createVAP({ essid: "Home", apName: "AP-1", numSta: 5, radio: "rai0", channel: 36 }),
        createVAP({ essid: "Home", apName: "AP-2", numSta: 2, radio: "ra0", channel: 6 }),
        createVAP({ essid: "Guest", apName: "AP-1", numSta: 1, isGuest: true }),
      ];

      const result = normalizeSSIDs(vaps);

      expect(result).toHaveLength(2);

      // Home SSID should aggregate all Home VAPs
      const home = result.find((s) => s.essid === "Home");
      expect(home).toBeDefined();
      expect(home!.clientCount).toBe(10); // 3 + 5 + 2
      expect(home!.aps).toEqual(["AP-1", "AP-2"]);
      expect(home!.isGuest).toBe(false);

      // Guest SSID
      const guest = result.find((s) => s.essid === "Guest");
      expect(guest).toBeDefined();
      expect(guest!.clientCount).toBe(1);
      expect(guest!.isGuest).toBe(true);
    });

    it("groups channels by band correctly", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Test", radio: "ng", channel: 1 }), // 2.4GHz
        createVAP({ essid: "Test", radio: "ng", channel: 6 }), // 2.4GHz
        createVAP({ essid: "Test", radio: "na", channel: 36 }), // 5GHz
        createVAP({ essid: "Test", radio: "na", channel: 149 }), // 5GHz
        createVAP({ essid: "Test", radio: "6e", channel: 1 }), // 6GHz
      ];

      const result = normalizeSSIDs(vaps);

      expect(result).toHaveLength(1);
      expect(result[0].channels["2.4GHz"]).toEqual([1, 6]);
      expect(result[0].channels["5GHz"]).toEqual([36, 149]);
      expect(result[0].channels["6GHz"]).toEqual([1]);
    });

    it("excludes empty SSIDs by default", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "WithClients", numSta: 5 }),
        createVAP({ essid: "Empty", numSta: 0 }),
      ];

      const result = normalizeSSIDs(vaps);

      expect(result).toHaveLength(1);
      expect(result[0].essid).toBe("WithClients");
    });

    it("includes empty SSIDs when option is set", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "WithClients", numSta: 5 }),
        createVAP({ essid: "Empty", numSta: 0 }),
      ];

      const result = normalizeSSIDs(vaps, { includeEmpty: true });

      expect(result).toHaveLength(2);
    });

    it("filters by AP name", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Home", apName: "AP-1", numSta: 3 }),
        createVAP({ essid: "Home", apName: "AP-2", numSta: 5 }),
        createVAP({ essid: "Guest", apName: "AP-1", numSta: 2 }),
      ];

      const result = normalizeSSIDs(vaps, { apName: "AP-1" });

      expect(result).toHaveLength(2);
      const home = result.find((s) => s.essid === "Home");
      expect(home!.clientCount).toBe(3); // Only from AP-1
      expect(home!.aps).toEqual(["AP-1"]);
    });

    it("sorts by clients by default", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Small", numSta: 2 }),
        createVAP({ essid: "Large", numSta: 10 }),
        createVAP({ essid: "Medium", numSta: 5 }),
      ];

      const result = normalizeSSIDs(vaps);

      expect(result[0].essid).toBe("Large");
      expect(result[1].essid).toBe("Medium");
      expect(result[2].essid).toBe("Small");
    });

    it("sorts by name when specified", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Zebra", numSta: 10 }),
        createVAP({ essid: "Alpha", numSta: 1 }),
        createVAP({ essid: "Beta", numSta: 5 }),
      ];

      const result = normalizeSSIDs(vaps, { sortBy: "name" });

      expect(result[0].essid).toBe("Alpha");
      expect(result[1].essid).toBe("Beta");
      expect(result[2].essid).toBe("Zebra");
    });

    it("sorts by traffic when specified", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Low", rxBytes: 1000, txBytes: 1000 }),
        createVAP({ essid: "High", rxBytes: 100000, txBytes: 100000 }),
        createVAP({ essid: "Medium", rxBytes: 10000, txBytes: 10000 }),
      ];

      const result = normalizeSSIDs(vaps, { sortBy: "traffic" });

      expect(result[0].essid).toBe("High");
      expect(result[1].essid).toBe("Medium");
      expect(result[2].essid).toBe("Low");
    });

    it("calculates average satisfaction correctly", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Test", numSta: 5, satisfaction: 80 }),
        createVAP({ essid: "Test", numSta: 3, satisfaction: 90 }),
        createVAP({ essid: "Test", numSta: 0, satisfaction: 0 }), // No clients, shouldn't count
      ];

      const result = normalizeSSIDs(vaps);

      expect(result[0].satisfaction).toBe(85); // (80 + 90) / 2
    });

    it("calculates average signal correctly", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Test", numSta: 5, avgClientSignal: -50 }),
        createVAP({ essid: "Test", numSta: 3, avgClientSignal: -60 }),
      ];

      const result = normalizeSSIDs(vaps);

      expect(result[0].avgSignal).toBe(-55); // (-50 + -60) / 2
    });

    it("returns null satisfaction when no valid data", () => {
      const vaps: APVAP[] = [createVAP({ essid: "Test", numSta: 5, satisfaction: 0 })];

      const result = normalizeSSIDs(vaps);

      expect(result[0].satisfaction).toBeNull();
    });

    it("returns null signal when no valid data", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Test", numSta: 5, avgClientSignal: 0 }), // 0 is not valid signal
      ];

      const result = normalizeSSIDs(vaps);

      expect(result[0].avgSignal).toBeNull();
    });

    it("handles empty VAPs array", () => {
      const result = normalizeSSIDs([]);
      expect(result).toEqual([]);
    });

    it("skips VAPs with empty essid", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "", numSta: 5 }),
        createVAP({ essid: "Valid", numSta: 3 }),
      ];

      const result = normalizeSSIDs(vaps);

      expect(result).toHaveLength(1);
      expect(result[0].essid).toBe("Valid");
    });

    it("aggregates RX/TX bytes correctly", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Test", rxBytes: 1000, txBytes: 500 }),
        createVAP({ essid: "Test", rxBytes: 2000, txBytes: 1000 }),
      ];

      const result = normalizeSSIDs(vaps);

      expect(result[0].rxBytes).toBe(3000);
      expect(result[0].txBytes).toBe(1500);
    });
  });

  describe("getSSIDStats", () => {
    it("returns stats for specific SSID", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Home", numSta: 5 }),
        createVAP({ essid: "Guest", numSta: 2 }),
      ];

      const result = getSSIDStats(vaps, "Home");

      expect(result).not.toBeNull();
      expect(result!.essid).toBe("Home");
      expect(result!.clientCount).toBe(5);
    });

    it("returns null for non-existent SSID", () => {
      const vaps: APVAP[] = [createVAP({ essid: "Home" })];

      const result = getSSIDStats(vaps, "NonExistent");

      expect(result).toBeNull();
    });

    it("includes empty SSIDs", () => {
      const vaps: APVAP[] = [createVAP({ essid: "Empty", numSta: 0 })];

      const result = getSSIDStats(vaps, "Empty");

      expect(result).not.toBeNull();
      expect(result!.clientCount).toBe(0);
    });
  });

  describe("getSSIDClientCount", () => {
    it("returns total client count for SSID", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Home", numSta: 5 }),
        createVAP({ essid: "Home", numSta: 3 }),
        createVAP({ essid: "Guest", numSta: 2 }),
      ];

      expect(getSSIDClientCount(vaps, "Home")).toBe(8);
      expect(getSSIDClientCount(vaps, "Guest")).toBe(2);
    });

    it("returns 0 for non-existent SSID", () => {
      const vaps: APVAP[] = [createVAP({ essid: "Home", numSta: 5 })];

      expect(getSSIDClientCount(vaps, "NonExistent")).toBe(0);
    });
  });

  describe("getUniqueSSIDs", () => {
    it("returns unique SSID names sorted", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Zebra" }),
        createVAP({ essid: "Alpha" }),
        createVAP({ essid: "Alpha" }), // Duplicate
        createVAP({ essid: "Beta" }),
      ];

      const result = getUniqueSSIDs(vaps);

      expect(result).toEqual(["Alpha", "Beta", "Zebra"]);
    });

    it("excludes empty SSIDs", () => {
      const vaps: APVAP[] = [createVAP({ essid: "Valid" }), createVAP({ essid: "" })];

      const result = getUniqueSSIDs(vaps);

      expect(result).toEqual(["Valid"]);
    });

    it("returns empty array for empty input", () => {
      expect(getUniqueSSIDs([])).toEqual([]);
    });
  });

  describe("filterVAPsBySSID", () => {
    it("filters VAPs to specific SSID", () => {
      const vaps: APVAP[] = [
        createVAP({ essid: "Home", apName: "AP-1" }),
        createVAP({ essid: "Home", apName: "AP-2" }),
        createVAP({ essid: "Guest", apName: "AP-1" }),
      ];

      const result = filterVAPsBySSID(vaps, "Home");

      expect(result).toHaveLength(2);
      expect(result.every((v) => v.essid === "Home")).toBe(true);
    });

    it("returns empty array for non-existent SSID", () => {
      const vaps: APVAP[] = [createVAP({ essid: "Home" })];

      expect(filterVAPsBySSID(vaps, "NonExistent")).toEqual([]);
    });
  });

  describe("filterVAPsByAP", () => {
    it("filters VAPs to specific AP", () => {
      const vaps: APVAP[] = [
        createVAP({ apName: "AP-1", essid: "Home" }),
        createVAP({ apName: "AP-1", essid: "Guest" }),
        createVAP({ apName: "AP-2", essid: "Home" }),
      ];

      const result = filterVAPsByAP(vaps, "AP-1");

      expect(result).toHaveLength(2);
      expect(result.every((v) => v.apName === "AP-1")).toBe(true);
    });

    it("returns empty array for non-existent AP", () => {
      const vaps: APVAP[] = [createVAP({ apName: "AP-1" })];

      expect(filterVAPsByAP(vaps, "AP-999")).toEqual([]);
    });
  });

  describe("groupVAPsByAP", () => {
    it("groups VAPs by AP name", () => {
      const vaps: APVAP[] = [
        createVAP({ apName: "AP-1", essid: "Home" }),
        createVAP({ apName: "AP-1", essid: "Guest" }),
        createVAP({ apName: "AP-2", essid: "Home" }),
      ];

      const result = groupVAPsByAP(vaps);

      expect(result.size).toBe(2);
      expect(result.get("AP-1")).toHaveLength(2);
      expect(result.get("AP-2")).toHaveLength(1);
    });

    it("returns empty map for empty input", () => {
      const result = groupVAPsByAP([]);
      expect(result.size).toBe(0);
    });
  });

  describe("getWirelessClientCount", () => {
    it("counts only wireless clients", () => {
      const clients: Client[] = [
        createClient({ isWired: false }),
        createClient({ isWired: false }),
        createClient({ isWired: true }),
        createClient({ isWired: true }),
        createClient({ isWired: false }),
      ];

      expect(getWirelessClientCount(clients)).toBe(3);
    });

    it("returns 0 for empty array", () => {
      expect(getWirelessClientCount([])).toBe(0);
    });

    it("returns 0 when all clients are wired", () => {
      const clients: Client[] = [createClient({ isWired: true }), createClient({ isWired: true })];

      expect(getWirelessClientCount(clients)).toBe(0);
    });
  });
});
