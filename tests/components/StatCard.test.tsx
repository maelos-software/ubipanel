import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatCard } from "../../src/components/common/StatCard";
import { Users, Wifi } from "lucide-react";

describe("StatCard", () => {
  it("renders title and value", () => {
    render(<StatCard title="Total Clients" value={42} icon={Users} />);
    expect(screen.getByText("Total Clients")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<StatCard title="Clients" value={42} icon={Users} subtitle="Connected devices" />);
    expect(screen.getByText("Connected devices")).toBeInTheDocument();
  });

  it("renders trend indicator when provided", () => {
    render(
      <StatCard
        title="Clients"
        value={42}
        icon={Users}
        trend={{ value: 12, label: "vs last hour" }}
      />
    );
    expect(screen.getByText(/12%/)).toBeInTheDocument();
    expect(screen.getByText(/vs last hour/)).toBeInTheDocument();
  });

  it("shows upward arrow for positive trend", () => {
    render(<StatCard title="Clients" value={42} icon={Users} trend={{ value: 5, label: "" }} />);
    expect(screen.getByText(/↑/)).toBeInTheDocument();
  });

  it("shows downward arrow for negative trend", () => {
    render(<StatCard title="Clients" value={42} icon={Users} trend={{ value: -5, label: "" }} />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<StatCard title="Clients" value={42} icon={Users} onClick={handleClick} />);

    const card = screen.getByRole("button");
    fireEvent.click(card);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders as div when no onClick provided", () => {
    render(<StatCard title="Clients" value={42} icon={Users} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders compact variant", () => {
    render(<StatCard title="CPU" value="45%" icon={Wifi} compact />);
    expect(screen.getByText("CPU")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();
  });
});
