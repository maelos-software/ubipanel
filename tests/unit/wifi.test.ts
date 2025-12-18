import { describe, it, expect } from "vitest";
import {
  getWiFiBand,
  isChannel2G,
  isChannel5G,
  isChannel6G,
  getRadioType,
  getBandLabel,
  getBandShort,
  sortChannels,
  groupChannelsByBand,
  is5GHzDFSChannel,
  getWiFiGeneration,
  getBandFromRadioTag,
  getBandShortFromRadioTag,
  isRadio6E,
  getWiFiGenerationFromProto,
  getSSIDWiFiCapability,
} from "../../src/lib/wifi";

describe("getWiFiBand", () => {
  it("returns 2.4GHz for channels 1-14", () => {
    expect(getWiFiBand(1)).toBe("2.4GHz");
    expect(getWiFiBand(6)).toBe("2.4GHz");
    expect(getWiFiBand(11)).toBe("2.4GHz");
    expect(getWiFiBand(14)).toBe("2.4GHz");
  });

  it("returns 5GHz for channels 36-177", () => {
    expect(getWiFiBand(36)).toBe("5GHz");
    expect(getWiFiBand(44)).toBe("5GHz");
    expect(getWiFiBand(100)).toBe("5GHz");
    expect(getWiFiBand(149)).toBe("5GHz");
    expect(getWiFiBand(165)).toBe("5GHz");
    expect(getWiFiBand(177)).toBe("5GHz");
  });

  it("returns 6GHz for channels above 177", () => {
    expect(getWiFiBand(178)).toBe("6GHz");
    expect(getWiFiBand(200)).toBe("6GHz");
  });
});

describe("isChannel2G", () => {
  it("returns true for 2.4GHz channels", () => {
    expect(isChannel2G(1)).toBe(true);
    expect(isChannel2G(6)).toBe(true);
    expect(isChannel2G(14)).toBe(true);
  });

  it("returns false for non-2.4GHz channels", () => {
    expect(isChannel2G(0)).toBe(false);
    expect(isChannel2G(15)).toBe(false);
    expect(isChannel2G(36)).toBe(false);
  });
});

describe("isChannel5G", () => {
  it("returns true for 5GHz channels", () => {
    expect(isChannel5G(36)).toBe(true);
    expect(isChannel5G(100)).toBe(true);
    expect(isChannel5G(149)).toBe(true);
    expect(isChannel5G(177)).toBe(true);
  });

  it("returns false for non-5GHz channels", () => {
    expect(isChannel5G(1)).toBe(false);
    expect(isChannel5G(14)).toBe(false);
    expect(isChannel5G(35)).toBe(false);
    expect(isChannel5G(178)).toBe(false);
  });
});

describe("isChannel6G", () => {
  it("returns true for 6GHz channels", () => {
    expect(isChannel6G(178)).toBe(true);
    expect(isChannel6G(200)).toBe(true);
  });

  it("returns false for non-6GHz channels", () => {
    expect(isChannel6G(1)).toBe(false);
    expect(isChannel6G(177)).toBe(false);
  });
});

describe("getRadioType", () => {
  it("returns the protocol when explicitly provided", () => {
    expect(getRadioType(36, "ac")).toBe("ac");
    expect(getRadioType(6, "ng")).toBe("ng");
    expect(getRadioType(36, "ax")).toBe("ax");
    expect(getRadioType(1, "be")).toBe("be");
  });

  it("handles case-insensitive protocol strings", () => {
    expect(getRadioType(36, "AC")).toBe("ac");
    expect(getRadioType(6, "NG")).toBe("ng");
  });

  it("infers radio type from channel when no protocol", () => {
    expect(getRadioType(6)).toBe("ng");
    expect(getRadioType(11)).toBe("ng");
    expect(getRadioType(36)).toBe("ac");
    expect(getRadioType(149)).toBe("ac");
  });

  it("returns ax for 6GHz channels", () => {
    expect(getRadioType(200)).toBe("ax");
  });
});

describe("getBandLabel", () => {
  it("returns band without channel by default", () => {
    expect(getBandLabel(6)).toBe("2.4GHz");
    expect(getBandLabel(36)).toBe("5GHz");
  });

  it("includes channel when requested", () => {
    expect(getBandLabel(6, true)).toBe("2.4GHz Ch6");
    expect(getBandLabel(149, true)).toBe("5GHz Ch149");
  });
});

describe("getBandShort", () => {
  it("returns short band identifiers", () => {
    expect(getBandShort(6)).toBe("2.4G");
    expect(getBandShort(36)).toBe("5G");
    expect(getBandShort(200)).toBe("6G");
  });
});

describe("sortChannels", () => {
  it("sorts channels by band then number", () => {
    const channels = [149, 6, 36, 1, 11, 100];
    const sorted = sortChannels(channels);
    expect(sorted).toEqual([1, 6, 11, 36, 100, 149]);
  });

  it("does not mutate the original array", () => {
    const channels = [149, 6, 36];
    sortChannels(channels);
    expect(channels).toEqual([149, 6, 36]);
  });

  it("handles empty array", () => {
    expect(sortChannels([])).toEqual([]);
  });
});

describe("groupChannelsByBand", () => {
  it("groups channels by band", () => {
    const channels = [149, 6, 36, 1, 11, 100];
    const grouped = groupChannelsByBand(channels);

    expect(grouped["2.4GHz"]).toEqual([1, 6, 11]);
    expect(grouped["5GHz"]).toEqual([36, 100, 149]);
    expect(grouped["6GHz"]).toEqual([]);
  });

  it("handles empty array", () => {
    const grouped = groupChannelsByBand([]);
    expect(grouped["2.4GHz"]).toEqual([]);
    expect(grouped["5GHz"]).toEqual([]);
    expect(grouped["6GHz"]).toEqual([]);
  });

  it("handles 6GHz channels", () => {
    const channels = [6, 200];
    const grouped = groupChannelsByBand(channels);

    expect(grouped["2.4GHz"]).toEqual([6]);
    expect(grouped["6GHz"]).toEqual([200]);
  });
});

describe("is5GHzDFSChannel", () => {
  it("returns true for DFS channels", () => {
    // UNII-2A: 52-64
    expect(is5GHzDFSChannel(52)).toBe(true);
    expect(is5GHzDFSChannel(56)).toBe(true);
    expect(is5GHzDFSChannel(64)).toBe(true);

    // UNII-2C: 100-144
    expect(is5GHzDFSChannel(100)).toBe(true);
    expect(is5GHzDFSChannel(116)).toBe(true);
    expect(is5GHzDFSChannel(144)).toBe(true);
  });

  it("returns false for non-DFS channels", () => {
    expect(is5GHzDFSChannel(36)).toBe(false);
    expect(is5GHzDFSChannel(44)).toBe(false);
    expect(is5GHzDFSChannel(48)).toBe(false);
    expect(is5GHzDFSChannel(149)).toBe(false);
    expect(is5GHzDFSChannel(165)).toBe(false);
  });
});

describe("getWiFiGeneration", () => {
  it("returns correct WiFi generation", () => {
    expect(getWiFiGeneration("be")).toBe("WiFi 7");
    expect(getWiFiGeneration("ax-6e")).toBe("WiFi 6E");
    expect(getWiFiGeneration("6e")).toBe("WiFi 6E");
    expect(getWiFiGeneration("ax")).toBe("WiFi 6");
    expect(getWiFiGeneration("ac")).toBe("WiFi 5");
    expect(getWiFiGeneration("n")).toBe("WiFi 4");
    expect(getWiFiGeneration("na")).toBe("WiFi 4");
    expect(getWiFiGeneration("ng")).toBe("WiFi 4");
  });

  it("returns Legacy for unknown protocols", () => {
    expect(getWiFiGeneration("")).toBe("Legacy");
    expect(getWiFiGeneration("a")).toBe("Legacy");
    expect(getWiFiGeneration("g")).toBe("Legacy");
    expect(getWiFiGeneration("unknown")).toBe("Legacy");
  });

  it("handles undefined/null", () => {
    expect(getWiFiGeneration(undefined as unknown as string)).toBe("Legacy");
  });
});

describe("getBandFromRadioTag", () => {
  it("returns correct band for UnPoller radio tags", () => {
    expect(getBandFromRadioTag("ng")).toBe("2.4GHz");
    expect(getBandFromRadioTag("na")).toBe("5GHz");
    expect(getBandFromRadioTag("6e")).toBe("6GHz");
  });

  it("handles case-insensitive input", () => {
    expect(getBandFromRadioTag("NG")).toBe("2.4GHz");
    expect(getBandFromRadioTag("NA")).toBe("5GHz");
    expect(getBandFromRadioTag("6E")).toBe("6GHz");
  });

  it("defaults to 5GHz for unknown radio tags", () => {
    expect(getBandFromRadioTag("unknown")).toBe("5GHz");
    expect(getBandFromRadioTag("")).toBe("5GHz");
  });
});

describe("getBandShortFromRadioTag", () => {
  it("returns short band labels for UnPoller radio tags", () => {
    expect(getBandShortFromRadioTag("ng")).toBe("2.4G");
    expect(getBandShortFromRadioTag("na")).toBe("5G");
    expect(getBandShortFromRadioTag("6e")).toBe("6E");
  });

  it("handles case-insensitive input", () => {
    expect(getBandShortFromRadioTag("NG")).toBe("2.4G");
    expect(getBandShortFromRadioTag("NA")).toBe("5G");
    expect(getBandShortFromRadioTag("6E")).toBe("6E");
  });

  it("defaults to 5G for unknown radio tags", () => {
    expect(getBandShortFromRadioTag("unknown")).toBe("5G");
    expect(getBandShortFromRadioTag("")).toBe("5G");
  });
});

describe("isRadio6E", () => {
  it("returns true for 6E radio tag", () => {
    expect(isRadio6E("6e")).toBe(true);
    expect(isRadio6E("6E")).toBe(true);
  });

  it("returns false for non-6E radio tags", () => {
    expect(isRadio6E("ng")).toBe(false);
    expect(isRadio6E("na")).toBe(false);
    expect(isRadio6E("")).toBe(false);
    expect(isRadio6E("unknown")).toBe(false);
  });
});

describe("getWiFiGenerationFromProto", () => {
  it("returns WiFi 7 for BE protocol", () => {
    expect(getWiFiGenerationFromProto("be")).toBe("WiFi 7");
    expect(getWiFiGenerationFromProto("BE")).toBe("WiFi 7");
  });

  it("returns WiFi 6 for AX protocol", () => {
    expect(getWiFiGenerationFromProto("ax")).toBe("WiFi 6");
    expect(getWiFiGenerationFromProto("AX")).toBe("WiFi 6");
  });

  it("returns WiFi 5 for AC protocol", () => {
    expect(getWiFiGenerationFromProto("ac")).toBe("WiFi 5");
    expect(getWiFiGenerationFromProto("AC")).toBe("WiFi 5");
  });

  it("returns WiFi 4 for N protocols", () => {
    expect(getWiFiGenerationFromProto("n")).toBe("WiFi 4");
    expect(getWiFiGenerationFromProto("na")).toBe("WiFi 4");
    expect(getWiFiGenerationFromProto("ng")).toBe("WiFi 4");
  });

  it("returns Legacy for old protocols", () => {
    expect(getWiFiGenerationFromProto("g")).toBe("Legacy");
    expect(getWiFiGenerationFromProto("b")).toBe("Legacy");
  });

  it("returns null for unknown protocols", () => {
    expect(getWiFiGenerationFromProto("")).toBeNull();
    expect(getWiFiGenerationFromProto("unknown")).toBeNull();
  });

  it("handles undefined/null safely", () => {
    expect(getWiFiGenerationFromProto(undefined as unknown as string)).toBeNull();
    expect(getWiFiGenerationFromProto(null as unknown as string)).toBeNull();
  });
});

describe("getSSIDWiFiCapability", () => {
  it("returns WiFi 7 when 6E radio has BE client", () => {
    expect(getSSIDWiFiCapability(["6e"], ["be"])).toBe("WiFi 7");
  });

  it("returns WiFi 6E when SSID is on 6E band without BE clients", () => {
    expect(getSSIDWiFiCapability(["6e"], ["ax", "ac"])).toBe("WiFi 6E");
    expect(getSSIDWiFiCapability(["6e"], [])).toBe("WiFi 6E");
  });

  it("returns highest capability from clients when not on 6E", () => {
    expect(getSSIDWiFiCapability(["na"], ["be", "ax", "ac"])).toBe("WiFi 7");
    expect(getSSIDWiFiCapability(["na"], ["ax", "ac"])).toBe("WiFi 6");
    expect(getSSIDWiFiCapability(["na"], ["ac", "ng"])).toBe("WiFi 5");
    expect(getSSIDWiFiCapability(["ng"], ["na", "ng"])).toBe("WiFi 4");
  });

  it("returns null when no client protocols available", () => {
    expect(getSSIDWiFiCapability(["na"], [])).toBeNull();
    expect(getSSIDWiFiCapability(["ng"], [])).toBeNull();
  });

  it("handles mixed radio tags", () => {
    // If any radio is 6E, treat as 6E capable
    expect(getSSIDWiFiCapability(["ng", "na", "6e"], ["ax"])).toBe("WiFi 6E");
    expect(getSSIDWiFiCapability(["ng", "na"], ["ax"])).toBe("WiFi 6");
  });

  it("handles legacy client protocols", () => {
    expect(getSSIDWiFiCapability(["ng"], ["g", "b"])).toBeNull();
  });

  it("handles case-insensitive protocols", () => {
    expect(getSSIDWiFiCapability(["NA"], ["AX"])).toBe("WiFi 6");
    expect(getSSIDWiFiCapability(["6E"], ["BE"])).toBe("WiFi 7");
  });
});
