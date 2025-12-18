import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "../test-utils";
import { ClientList } from "../../src/components/common/ClientList";
import type { Client } from "../../src/types/influx";

const mockClients: Client[] = [
  {
    mac: "00:11:22:33:44:55",
    name: "Work Laptop",
    hostname: "work-laptop",
    ip: "192.168.1.10",
    rxBytes: 1000000,
    txBytes: 500000,
    rxBytesR: 50000,
    txBytesR: 25000,
    signal: 80,
    rssi: -55,
    satisfaction: 95,
    channel: 36,
    apName: "Living Room AP",
    isWired: false,
    isGuest: false,
    vlan: "10",
    uptime: 3600,
    radioProto: "ax",
  },
  {
    mac: "AA:BB:CC:DD:EE:FF",
    name: "Home Server",
    hostname: "home-server",
    ip: "192.168.1.5",
    rxBytes: 5000000,
    txBytes: 2500000,
    rxBytesR: 100000,
    txBytesR: 50000,
    signal: 0,
    rssi: 0,
    satisfaction: 0,
    channel: 0,
    apName: "",
    swName: "Core Switch",
    isWired: true,
    isGuest: false,
    vlan: "1",
    uptime: 86400,
    radioProto: "",
  },
];

describe("ClientList", () => {
  it("renders a list of clients", () => {
    render(<ClientList clients={mockClients} />);

    expect(screen.getByText("Work Laptop")).toBeDefined();
    expect(screen.getByText("Home Server")).toBeDefined();
    expect(screen.getByText("192.168.1.10")).toBeDefined();
    expect(screen.getByText("192.168.1.5")).toBeDefined();
  });

  it("renders empty message when no clients", () => {
    render(<ClientList clients={[]} emptyMessage="No clients here" />);
    expect(screen.getByText("No clients here")).toBeDefined();
  });

  it("calls onClientClick when a row is clicked", () => {
    const onClientClick = vi.fn();
    render(<ClientList clients={mockClients} onClientClick={onClientClick} />);

    fireEvent.click(screen.getByText("Work Laptop"));
    expect(onClientClick).toHaveBeenCalledWith(mockClients[0]);
  });

  it("renders correct columns based on the columns prop", () => {
    // Only name and IP
    const { container } = render(<ClientList clients={mockClients} columns={["name", "ip"]} />);

    // Header should have Client and IP Address
    expect(screen.getByText("Client")).toBeDefined();
    expect(screen.getByText("IP Address")).toBeDefined();

    // Signal column header should NOT be there
    expect(screen.queryByText("Signal")).toBeNull();

    // Check table headers count (2 columns)
    const headers = container.querySelectorAll("th");
    expect(headers.length).toBe(2);
  });

  it("renders connection details correctly for wireless clients", () => {
    render(<ClientList clients={[mockClients[0]]} columns={["connection"]} />);

    expect(screen.getByText("WiFi 6")).toBeDefined();
    expect(screen.getByText("-55 dBm")).toBeDefined();
    expect(screen.getByText("Living Room AP")).toBeDefined();
  });

  it("renders connection details correctly for wired clients", () => {
    render(<ClientList clients={[mockClients[1]]} columns={["connection"]} />);

    expect(screen.getByText("Wired")).toBeDefined();
    expect(screen.getByText("Core Switch")).toBeDefined();
  });

  it("renders bandwidth bars when bandwidthBar column is used", () => {
    const { container } = render(
      <ClientList
        clients={mockClients}
        columns={["name", "bandwidthBar"]}
        totalBandwidth={225000}
        maxBandwidth={150000}
      />
    );

    // Check for "of total" text which is in the bandwidthBar column
    expect(screen.getAllByText(/% of total/)).toHaveLength(2);

    // Check for presence of progress bars
    const progressBars = container.querySelectorAll(".h-2.bg-\\[var\\(--bg-tertiary\\)\\]");
    expect(progressBars.length).toBe(2);
  });
});
