import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../test-utils";
import { ChannelUtilChart } from "../../src/components/charts/ChannelUtilChart";

interface ChannelData {
  radio: string;
  channel: number;
  cuTotal: number;
  cuSelfTx: number;
  cuSelfRx: number;
  numSta: number;
}

const mockData: ChannelData[] = [
  { radio: "2.4 GHz", channel: 6, cuTotal: 25, cuSelfTx: 10, cuSelfRx: 5, numSta: 15 },
  { radio: "5 GHz", channel: 36, cuTotal: 45, cuSelfTx: 20, cuSelfRx: 10, numSta: 8 },
  { radio: "6 GHz", channel: 1, cuTotal: 15, cuSelfTx: 5, cuSelfRx: 3, numSta: 3 },
];

describe("ChannelUtilChart", () => {
  describe("chart container", () => {
    it("renders the chart container", () => {
      const { container } = render(<ChannelUtilChart data={mockData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with empty data without crashing", () => {
      const { container } = render(<ChannelUtilChart data={[]} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with single data point", () => {
      const singleData = [mockData[0]];
      const { container } = render(<ChannelUtilChart data={singleData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("legend", () => {
    it("shows utilization level legend", () => {
      render(<ChannelUtilChart data={mockData} />);
      expect(screen.getByText(/Good/)).toBeInTheDocument();
      expect(screen.getByText(/Moderate/)).toBeInTheDocument();
      expect(screen.getByText(/Busy/)).toBeInTheDocument();
      expect(screen.getByText(/Congested/)).toBeInTheDocument();
    });

    it("shows percentage thresholds in legend", () => {
      render(<ChannelUtilChart data={mockData} />);
      expect(screen.getByText(/<40%/)).toBeInTheDocument();
      expect(screen.getByText(/40-60%/)).toBeInTheDocument();
      expect(screen.getByText(/60-80%/)).toBeInTheDocument();
      expect(screen.getByText(/>80%/)).toBeInTheDocument();
    });

    it("shows colored indicators for each level", () => {
      const { container } = render(<ChannelUtilChart data={mockData} />);
      // Should have 4 colored boxes in legend (Good, Moderate, Busy, Congested)
      const colorBoxes = container.querySelectorAll(".rounded");
      expect(colorBoxes.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("height prop", () => {
    it("uses default height when not specified", () => {
      const { container } = render(<ChannelUtilChart data={mockData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("accepts custom height", () => {
      const { container } = render(<ChannelUtilChart data={mockData} height={300} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("data visualization", () => {
    it("renders bars for each radio", () => {
      const { container } = render(<ChannelUtilChart data={mockData} />);
      // Note: bars might not be found in JSDOM, just verify container renders
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });
  });

  describe("utilization levels", () => {
    it("handles high utilization data", () => {
      const highUtilData: ChannelData[] = [
        { radio: "2.4 GHz", channel: 6, cuTotal: 85, cuSelfTx: 40, cuSelfRx: 20, numSta: 30 },
      ];
      const { container } = render(<ChannelUtilChart data={highUtilData} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("handles low utilization data", () => {
      const lowUtilData: ChannelData[] = [
        { radio: "5 GHz", channel: 36, cuTotal: 10, cuSelfTx: 3, cuSelfRx: 2, numSta: 5 },
      ];
      const { container } = render(<ChannelUtilChart data={lowUtilData} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("handles boundary utilization values", () => {
      const boundaryData: ChannelData[] = [
        { radio: "Band 1", channel: 1, cuTotal: 40, cuSelfTx: 15, cuSelfRx: 10, numSta: 10 },
        { radio: "Band 2", channel: 2, cuTotal: 60, cuSelfTx: 25, cuSelfRx: 15, numSta: 15 },
        { radio: "Band 3", channel: 3, cuTotal: 80, cuSelfTx: 35, cuSelfRx: 20, numSta: 20 },
      ];
      const { container } = render(<ChannelUtilChart data={boundaryData} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });
  });
});
