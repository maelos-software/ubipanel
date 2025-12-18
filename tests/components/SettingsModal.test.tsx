import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../test-utils";
import { SettingsModal } from "../../src/components/common/SettingsModal";

// Mock usePreferences hook
const mockSetTheme = vi.fn();
const mockSetDensity = vi.fn();
const mockCloseSettings = vi.fn();

vi.mock("../../src/hooks/usePreferences", () => ({
  usePreferences: () => ({
    isSettingsOpen: true,
    closeSettings: mockCloseSettings,
    theme: "light",
    setTheme: mockSetTheme,
    refreshInterval: 30000,
    setRefreshInterval: vi.fn(),
    defaultTimeRange: "1h",
    setDefaultTimeRange: vi.fn(),
    density: "comfortable",
    setDensity: mockSetDensity,
    clientListView: "standard",
    setClientListView: vi.fn(),
  }),
}));

describe("SettingsModal", () => {
  it("renders when open", () => {
    render(<SettingsModal />);
    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("Theme")).toBeDefined();
    expect(screen.getByText("Display Density")).toBeDefined();
  });

  it("calls closeSettings when the close button is clicked", () => {
    render(<SettingsModal />);
    const closeButton = screen.getByLabelText("Close settings");
    fireEvent.click(closeButton);
    expect(mockCloseSettings).toHaveBeenCalled();
  });

  it("calls setTheme when a theme option is clicked", () => {
    render(<SettingsModal />);
    const darkThemeButton = screen.getByText("Dark");
    fireEvent.click(darkThemeButton);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setDensity when a density option is clicked", () => {
    render(<SettingsModal />);
    const compactButton = screen.getByText("Compact");
    fireEvent.click(compactButton);
    expect(mockSetDensity).toHaveBeenCalledWith("compact");
  });

  it("closes on escape key", () => {
    render(<SettingsModal />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(mockCloseSettings).toHaveBeenCalled();
  });
});
