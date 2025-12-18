import { describe, it, expect } from "vitest";
import { render, screen } from "../test-utils";
import {
  ChartTooltip,
  BandwidthTooltip,
  PercentTooltip,
} from "../../src/components/charts/ChartTooltip";

const mockColors = {
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
  tooltipText: "#1e293b",
};

const mockPayload = [
  { name: "Series A", value: 100, color: "#ff0000", dataKey: "a" },
  { name: "Series B", value: 200, color: "#00ff00", dataKey: "b" },
  { name: "Series C", value: 0, color: "#0000ff", dataKey: "c" },
];

describe("ChartTooltip", () => {
  it("renders nothing when inactive", () => {
    const { container } = render(
      <ChartTooltip active={false} payload={mockPayload} label="Test" chartColors={mockColors} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when payload is empty", () => {
    const { container } = render(
      <ChartTooltip active={true} payload={[]} label="Test" chartColors={mockColors} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders label and values in descending order", () => {
    render(
      <ChartTooltip
        active={true}
        payload={mockPayload}
        label="2024-01-01"
        chartColors={mockColors}
      />
    );

    expect(screen.getByText("2024-01-01")).toBeDefined();
    expect(screen.getByText(/Series B: 200/)).toBeDefined();
    expect(screen.getByText(/Series A: 100/)).toBeDefined();

    // By default, zeros are filtered
    expect(screen.queryByText(/Series C/)).toBeNull();

    // Series B (200) should come before Series A (100)
    const texts = screen.getAllByText(/Series [AB]/).map((el) => el.textContent || "");
    expect(texts[0]).toContain("Series B");
    expect(texts[1]).toContain("Series A");
  });

  it("shows zeros when showZeros is true", () => {
    render(
      <ChartTooltip
        active={true}
        payload={mockPayload}
        label="Test"
        chartColors={mockColors}
        showZeros={true}
      />
    );
    expect(screen.getByText(/Series C: 0/)).toBeDefined();
  });

  it("applies custom value formatter and unit", () => {
    render(
      <ChartTooltip
        active={true}
        payload={[{ name: "Value", value: 50, color: "red" }]}
        label="Test"
        chartColors={mockColors}
        formatValue={(v) => `VAL-${v}`}
        unit=" UNITS"
      />
    );
    expect(screen.getByText("Value: VAL-50 UNITS")).toBeDefined();
  });
});

describe("BandwidthTooltip", () => {
  it("formats values as bytes per second", () => {
    render(
      <BandwidthTooltip
        active={true}
        payload={[{ name: "Download", value: 1024 * 1024, color: "green" }]}
        label="Test"
        chartColors={mockColors}
      />
    );
    expect(screen.getByText("Download: 1 MB/s")).toBeDefined();
  });
});

describe("PercentTooltip", () => {
  it("formats values as percentages", () => {
    render(
      <PercentTooltip
        active={true}
        payload={[{ name: "Usage", value: 45.6, color: "blue" }]}
        label="Test"
        chartColors={mockColors}
      />
    );
    expect(screen.getByText("Usage: 46%")).toBeDefined();
  });
});
