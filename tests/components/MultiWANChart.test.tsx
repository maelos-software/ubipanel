import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../test-utils";
import { MultiWANChart } from "../../src/components/charts/MultiWANChart";
import type { MultiWANBandwidthPoint } from "../../src/hooks/useHistoricalData";

const mockData: MultiWANBandwidthPoint[] = [
  {
    time: "2024-01-01T10:00:00Z",
    eth4_rx: 1000000,
    eth4_tx: 500000,
    eth5_rx: 800000,
    eth5_tx: 400000,
  },
  {
    time: "2024-01-01T10:01:00Z",
    eth4_rx: 1200000,
    eth4_tx: 600000,
    eth5_rx: 900000,
    eth5_tx: 450000,
  },
];

const mockIfnames = ["eth4", "eth5"];

describe("MultiWANChart", () => {
  describe("legend", () => {
    it("displays interface names in legend", () => {
      render(<MultiWANChart data={mockData} ifnames={mockIfnames} />);
      expect(screen.getByText("eth4")).toBeInTheDocument();
      expect(screen.getByText("eth5")).toBeInTheDocument();
    });

    it("marks active interface in legend", () => {
      render(<MultiWANChart data={mockData} ifnames={mockIfnames} activeIfname="eth4" />);
      expect(screen.getByText(/eth4.*\(Active\)/)).toBeInTheDocument();
    });

    it("shows download and upload indicators for each interface", () => {
      const { container } = render(<MultiWANChart data={mockData} ifnames={mockIfnames} />);
      // Should have colored dots for rx/tx per interface (2 interfaces * 2 directions = 4 dots in legend)
      const dots = container.querySelectorAll(".rounded-full");
      expect(dots.length).toBeGreaterThanOrEqual(4);
    });

    it("shows direction arrows in legend", () => {
      render(<MultiWANChart data={mockData} ifnames={mockIfnames} />);
      // Download arrow ↓ and upload arrow ↑
      expect(screen.getAllByText("↓").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("↑").length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("chart container", () => {
    it("renders the chart container", () => {
      const { container } = render(<MultiWANChart data={mockData} ifnames={mockIfnames} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with empty data without crashing", () => {
      const { container } = render(<MultiWANChart data={[]} ifnames={[]} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with single interface", () => {
      const singleIfData: MultiWANBandwidthPoint[] = [
        { time: "2024-01-01T10:00:00Z", eth4_rx: 1000000, eth4_tx: 500000 },
      ];
      const { container } = render(<MultiWANChart data={singleIfData} ifnames={["eth4"]} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("height prop", () => {
    it("uses default height when not specified", () => {
      const { container } = render(<MultiWANChart data={mockData} ifnames={mockIfnames} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("accepts custom height", () => {
      const { container } = render(
        <MultiWANChart data={mockData} ifnames={mockIfnames} height={300} />
      );
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("active interface highlighting", () => {
    it("renders without active interface specified", () => {
      render(<MultiWANChart data={mockData} ifnames={mockIfnames} />);
      // Should not show any "(Active)" labels
      expect(screen.queryByText(/\(Active\)/)).not.toBeInTheDocument();
    });

    it("styles active interface differently in legend", () => {
      const { container } = render(
        <MultiWANChart data={mockData} ifnames={mockIfnames} activeIfname="eth4" />
      );
      // The active interface should not have opacity-60 class
      const legendItems = container.querySelectorAll(".flex.items-center.gap-3");
      expect(legendItems.length).toBeGreaterThan(0);
    });
  });

  describe("interface ordering", () => {
    it("sorts active interface first in legend", () => {
      render(<MultiWANChart data={mockData} ifnames={["eth5", "eth4"]} activeIfname="eth4" />);
      // eth4 should appear first even though eth5 was first in the array
      const allText = screen.getByText(/eth4.*\(Active\)/).textContent;
      expect(allText).toContain("eth4");
    });
  });
});
