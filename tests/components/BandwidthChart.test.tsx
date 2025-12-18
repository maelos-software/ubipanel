import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../test-utils";
import { BandwidthChart } from "../../src/components/charts/BandwidthChart";

const mockData = [
  { time: "2024-01-01T10:00:00Z", rxRate: 1000000, txRate: 2000000 },
  { time: "2024-01-01T10:01:00Z", rxRate: 1500000, txRate: 2500000 },
  { time: "2024-01-01T10:02:00Z", rxRate: 1200000, txRate: 2200000 },
];

describe("BandwidthChart", () => {
  describe("legend", () => {
    it("shows Download/Upload labels by default", () => {
      render(<BandwidthChart data={mockData} />);
      expect(screen.getByText("Download")).toBeInTheDocument();
      expect(screen.getByText("Upload")).toBeInTheDocument();
    });

    it("shows custom labels when provided", () => {
      render(<BandwidthChart data={mockData} labels={{ tx: "TX", rx: "RX" }} />);
      expect(screen.getByText("TX")).toBeInTheDocument();
      expect(screen.getByText("RX")).toBeInTheDocument();
    });

    it("hides legend when showLegend is false", () => {
      render(<BandwidthChart data={mockData} showLegend={false} />);
      expect(screen.queryByText("Download")).not.toBeInTheDocument();
      expect(screen.queryByText("Upload")).not.toBeInTheDocument();
    });
  });

  describe("chart container", () => {
    it("renders the chart container", () => {
      const { container } = render(<BandwidthChart data={mockData} />);
      // ResponsiveContainer renders with the recharts-responsive-container class
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with empty data without crashing", () => {
      const { container } = render(<BandwidthChart data={[]} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("legend indicators", () => {
    it("shows colored dot indicators in legend", () => {
      const { container } = render(<BandwidthChart data={mockData} />);
      // Find the legend dots by their rounded-full class
      const dots = container.querySelectorAll(".rounded-full");
      expect(dots.length).toBeGreaterThanOrEqual(2);
    });
  });
});
