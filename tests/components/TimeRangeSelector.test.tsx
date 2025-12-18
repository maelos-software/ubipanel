import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeRangeSelector } from "../../src/components/common/TimeRangeSelector";
import { TIME_RANGES_SHORT } from "../../src/lib/timeRanges";

describe("TimeRangeSelector", () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    ranges: TIME_RANGES_SHORT,
    selected: TIME_RANGES_SHORT[0],
    onChange: mockOnChange,
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("renders all time range options", () => {
    render(<TimeRangeSelector {...defaultProps} />);

    TIME_RANGES_SHORT.forEach((range) => {
      expect(screen.getByText(range.label)).toBeInTheDocument();
    });
  });

  it("highlights the selected range", () => {
    render(<TimeRangeSelector {...defaultProps} />);

    const selectedButton = screen.getByText(TIME_RANGES_SHORT[0].label);
    expect(selectedButton).toHaveClass("bg-purple-100");
    expect(selectedButton).toHaveClass("text-purple-700");
  });

  it("calls onChange when a different range is clicked", () => {
    render(<TimeRangeSelector {...defaultProps} />);

    const otherButton = screen.getByText(TIME_RANGES_SHORT[1].label);
    fireEvent.click(otherButton);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(TIME_RANGES_SHORT[1]);
  });

  it("applies different color themes", () => {
    render(<TimeRangeSelector {...defaultProps} color="amber" />);

    const selectedButton = screen.getByText(TIME_RANGES_SHORT[0].label);
    expect(selectedButton).toHaveClass("bg-amber-100");
    expect(selectedButton).toHaveClass("text-amber-700");
  });

  it("applies small size variant", () => {
    render(<TimeRangeSelector {...defaultProps} size="sm" />);

    const button = screen.getByText(TIME_RANGES_SHORT[0].label);
    expect(button).toHaveClass("text-xs");
  });
});
