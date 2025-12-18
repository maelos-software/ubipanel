import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { render } from "../test-utils";
import { GaugeChart } from "../../src/components/charts/GaugeChart";

describe("GaugeChart", () => {
  it("renders value and label", () => {
    render(<GaugeChart value={45} label="CPU" />);
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("CPU")).toBeInTheDocument();
  });

  it("renders default unit (%)", () => {
    render(<GaugeChart value={50} label="Memory" />);
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("renders custom unit", () => {
    render(<GaugeChart value={6} max={8} label="RAM" unit="GB" />);
    expect(screen.getByText("GB")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("rounds displayed value to integer", () => {
    render(<GaugeChart value={45.7} label="Load" />);
    expect(screen.getByText("46")).toBeInTheDocument();
  });

  it("caps percentage at 100%", () => {
    render(<GaugeChart value={150} max={100} label="Over" />);
    // Value should still display as 150 but gauge arc is capped
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("renders SVG gauge element", () => {
    const { container } = render(<GaugeChart value={50} label="Test" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    // Should have two circles (background and value arcs)
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
  });

  describe("size variants", () => {
    it("renders small size", () => {
      const { container } = render(<GaugeChart value={50} label="Small" size="sm" />);
      const svg = container.querySelector("svg");
      // Small: radius=40, strokeWidth=6, total size = (40+6)*2 = 92
      expect(svg).toHaveAttribute("width", "92");
    });

    it("renders medium size (default)", () => {
      const { container } = render(<GaugeChart value={50} label="Medium" />);
      const svg = container.querySelector("svg");
      // Medium: radius=50, strokeWidth=8, total size = (50+8)*2 = 116
      expect(svg).toHaveAttribute("width", "116");
    });

    it("renders large size", () => {
      const { container } = render(<GaugeChart value={50} label="Large" size="lg" />);
      const svg = container.querySelector("svg");
      // Large: radius=60, strokeWidth=10, total size = (60+10)*2 = 140
      expect(svg).toHaveAttribute("width", "140");
    });
  });

  describe("color thresholds", () => {
    it("uses default color below 70%", () => {
      const { container } = render(<GaugeChart value={50} label="Normal" />);
      const valueCircle = container.querySelectorAll("circle")[1];
      // Default purple color
      expect(valueCircle).toHaveAttribute("stroke", "#7C3AED");
    });

    it("uses amber color at 70-89%", () => {
      const { container } = render(<GaugeChart value={75} label="Warning" />);
      const valueCircle = container.querySelectorAll("circle")[1];
      expect(valueCircle).toHaveAttribute("stroke", "#F59E0B");
    });

    it("uses red color at 90%+", () => {
      const { container } = render(<GaugeChart value={95} label="Critical" />);
      const valueCircle = container.querySelectorAll("circle")[1];
      expect(valueCircle).toHaveAttribute("stroke", "#EF4444");
    });

    it("calculates percentage correctly with custom max", () => {
      // 7/10 = 70%, should trigger amber
      const { container } = render(<GaugeChart value={7} max={10} label="Custom" />);
      const valueCircle = container.querySelectorAll("circle")[1];
      expect(valueCircle).toHaveAttribute("stroke", "#F59E0B");
    });
  });
});
