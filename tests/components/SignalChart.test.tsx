import { describe, it, expect } from "vitest";
import { render } from "../test-utils";
import { SignalChart } from "../../src/components/charts/SignalChart";

const mockData = [
  { time: "2024-01-01T10:00:00Z", rssi: -55, signal: 80 },
  { time: "2024-01-01T10:01:00Z", rssi: -60, signal: 70 },
  { time: "2024-01-01T10:02:00Z", rssi: -58, signal: 75 },
];

describe("SignalChart", () => {
  describe("chart container", () => {
    it("renders the chart container", () => {
      const { container } = render(<SignalChart data={mockData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with empty data without crashing", () => {
      const { container } = render(<SignalChart data={[]} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with excellent signal data", () => {
      const excellentData = [
        { time: "2024-01-01T10:00:00Z", rssi: -40, signal: 95 },
        { time: "2024-01-01T10:01:00Z", rssi: -45, signal: 90 },
      ];
      const { container } = render(<SignalChart data={excellentData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with poor signal data", () => {
      const poorData = [
        { time: "2024-01-01T10:00:00Z", rssi: -75, signal: 40 },
        { time: "2024-01-01T10:01:00Z", rssi: -80, signal: 30 },
      ];
      const { container } = render(<SignalChart data={poorData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("height prop", () => {
    it("uses default height when not specified", () => {
      const { container } = render(<SignalChart data={mockData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("accepts custom height", () => {
      const { container } = render(<SignalChart data={mockData} height={300} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("signal strength ranges", () => {
    it("handles excellent signal range (-30 to -50 dBm)", () => {
      const excellentSignal = [
        { time: "2024-01-01T10:00:00Z", rssi: -35, signal: 98 },
        { time: "2024-01-01T10:01:00Z", rssi: -48, signal: 92 },
      ];
      const { container } = render(<SignalChart data={excellentSignal} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("handles good signal range (-50 to -60 dBm)", () => {
      const goodSignal = [
        { time: "2024-01-01T10:00:00Z", rssi: -52, signal: 85 },
        { time: "2024-01-01T10:01:00Z", rssi: -58, signal: 78 },
      ];
      const { container } = render(<SignalChart data={goodSignal} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("handles fair signal range (-60 to -70 dBm)", () => {
      const fairSignal = [
        { time: "2024-01-01T10:00:00Z", rssi: -62, signal: 65 },
        { time: "2024-01-01T10:01:00Z", rssi: -68, signal: 55 },
      ];
      const { container } = render(<SignalChart data={fairSignal} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("handles poor signal range (below -70 dBm)", () => {
      const poorSignal = [
        { time: "2024-01-01T10:00:00Z", rssi: -72, signal: 45 },
        { time: "2024-01-01T10:01:00Z", rssi: -85, signal: 25 },
      ];
      const { container } = render(<SignalChart data={poorSignal} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });
  });

  describe("data handling", () => {
    it("handles single data point", () => {
      const singlePoint = [{ time: "2024-01-01T10:00:00Z", rssi: -55, signal: 80 }];
      const { container } = render(<SignalChart data={singlePoint} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("handles large dataset", () => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        time: `2024-01-01T${String(10 + Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`,
        rssi: -50 - Math.random() * 30,
        signal: 80 - Math.random() * 40,
      }));
      const { container } = render(<SignalChart data={largeData} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("handles varying signal quality", () => {
      const varyingData = [
        { time: "2024-01-01T10:00:00Z", rssi: -45, signal: 90 },
        { time: "2024-01-01T10:01:00Z", rssi: -75, signal: 40 },
        { time: "2024-01-01T10:02:00Z", rssi: -55, signal: 75 },
        { time: "2024-01-01T10:03:00Z", rssi: -85, signal: 25 },
      ];
      const { container } = render(<SignalChart data={varyingData} />);
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });
  });
});
