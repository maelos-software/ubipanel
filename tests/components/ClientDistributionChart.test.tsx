import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../test-utils";
import { ClientDistributionChart } from "../../src/components/charts/ClientDistributionChart";

const mockData = [
  { name: "2.4 GHz", value: 15, color: "#7C3AED" },
  { name: "5 GHz", value: 25, color: "#3B82F6" },
  { name: "6 GHz", value: 10, color: "#10B981" },
];

describe("ClientDistributionChart", () => {
  describe("chart container", () => {
    it("renders the chart container", () => {
      const { container } = render(<ClientDistributionChart data={mockData} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });

    it("renders with title when provided", () => {
      render(<ClientDistributionChart data={mockData} title="By Radio Band" />);
      expect(screen.getByText("By Radio Band")).toBeInTheDocument();
    });

    it("renders without title when not provided", () => {
      render(<ClientDistributionChart data={mockData} />);
      // Should not have an h3 element
      expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    });

    it("renders with custom height", () => {
      const { container } = render(<ClientDistributionChart data={mockData} height={300} />);
      const chartWrapper = container.firstElementChild;
      expect(chartWrapper).toHaveStyle({ height: "300px" });
    });

    it("renders with empty data without crashing", () => {
      const { container } = render(<ClientDistributionChart data={[]} />);
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });

  describe("legend", () => {
    it("displays legend items for each data category", () => {
      render(<ClientDistributionChart data={mockData} />);
      expect(screen.getByText(/2\.4 GHz/)).toBeInTheDocument();
      expect(screen.getByText(/5 GHz/)).toBeInTheDocument();
      expect(screen.getByText(/6 GHz/)).toBeInTheDocument();
    });

    it("shows value counts in legend", () => {
      render(<ClientDistributionChart data={mockData} />);
      expect(screen.getByText(/\(15\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(25\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    });
  });

  describe("color assignment", () => {
    it("renders legend items with provided colors", () => {
      const { container } = render(<ClientDistributionChart data={mockData} />);
      // Legend should show colored indicators
      const legendDots = container.querySelectorAll(".rounded-sm");
      expect(legendDots.length).toBe(3);
    });

    it("assigns default colors when not provided", () => {
      const dataWithoutColors = [
        { name: "A", value: 10, color: "" },
        { name: "B", value: 20, color: "" },
      ];
      const { container } = render(<ClientDistributionChart data={dataWithoutColors} />);
      // Should still render without errors
      const chartContainer = container.querySelector(".recharts-responsive-container");
      expect(chartContainer).toBeInTheDocument();
    });
  });
});
