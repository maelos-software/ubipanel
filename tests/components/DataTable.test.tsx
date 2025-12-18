import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "../../src/components/common/DataTable";

interface TestItem {
  id: string;
  name: string;
  value: number;
}

const testData: TestItem[] = [
  { id: "1", name: "Alice", value: 100 },
  { id: "2", name: "Bob", value: 200 },
  { id: "3", name: "Charlie", value: 150 },
];

const columns = [
  { key: "name", header: "Name" },
  { key: "value", header: "Value", sortValue: (item: TestItem) => item.value },
];

describe("DataTable", () => {
  it("renders table with data", () => {
    render(<DataTable data={testData} columns={columns} keyExtractor={(item) => item.id} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<DataTable data={testData} columns={columns} keyExtractor={(item) => item.id} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
  });

  it("shows empty message when data is empty", () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        keyExtractor={(item: TestItem) => item.id}
        emptyMessage="No items found"
      />
    );

    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("shows default empty message when not provided", () => {
    render(<DataTable data={[]} columns={columns} keyExtractor={(item: TestItem) => item.id} />);

    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("calls onRowClick when row is clicked", () => {
    const handleClick = vi.fn();
    render(
      <DataTable
        data={testData}
        columns={columns}
        keyExtractor={(item) => item.id}
        onRowClick={handleClick}
      />
    );

    fireEvent.click(screen.getByText("Alice"));
    expect(handleClick).toHaveBeenCalledWith(testData[0]);
  });

  it("sorts data when column header is clicked", () => {
    render(<DataTable data={testData} columns={columns} keyExtractor={(item) => item.id} />);

    // Click Value header to sort ascending
    fireEvent.click(screen.getByText("Value"));

    const rows = screen.getAllByRole("row");
    // First row is header, data rows start at index 1
    expect(rows[1]).toHaveTextContent("Alice"); // 100
    expect(rows[2]).toHaveTextContent("Charlie"); // 150
    expect(rows[3]).toHaveTextContent("Bob"); // 200
  });

  it("sorts descending on second click", () => {
    render(<DataTable data={testData} columns={columns} keyExtractor={(item) => item.id} />);

    // Click twice for descending
    fireEvent.click(screen.getByText("Value"));
    fireEvent.click(screen.getByText("Value"));

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Bob"); // 200
    expect(rows[2]).toHaveTextContent("Charlie"); // 150
    expect(rows[3]).toHaveTextContent("Alice"); // 100
  });

  it("respects defaultSortKey and defaultSortDir", () => {
    render(
      <DataTable
        data={testData}
        columns={columns}
        keyExtractor={(item) => item.id}
        defaultSortKey="value"
        defaultSortDir="desc"
      />
    );

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Bob"); // 200
    expect(rows[2]).toHaveTextContent("Charlie"); // 150
    expect(rows[3]).toHaveTextContent("Alice"); // 100
  });

  it("supports custom render functions", () => {
    const columnsWithRender = [
      {
        key: "name",
        header: "Name",
        render: (item: TestItem) => <strong data-testid="bold-name">{item.name}</strong>,
      },
    ];

    render(
      <DataTable data={testData} columns={columnsWithRender} keyExtractor={(item) => item.id} />
    );

    const boldNames = screen.getAllByTestId("bold-name");
    expect(boldNames).toHaveLength(3);
    expect(boldNames[0]).toHaveTextContent("Alice");
  });

  it("does not sort when column has sortable=false", () => {
    const unsortableColumns = [
      { key: "name", header: "Name", sortable: false },
      { key: "value", header: "Value" },
    ];

    render(
      <DataTable data={testData} columns={unsortableColumns} keyExtractor={(item) => item.id} />
    );

    // Click Name header (should not sort)
    fireEvent.click(screen.getByText("Name"));

    // Order should be unchanged (original order)
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Alice");
    expect(rows[2]).toHaveTextContent("Bob");
    expect(rows[3]).toHaveTextContent("Charlie");
  });

  it("supports text alignment", () => {
    const alignedColumns = [
      { key: "name", header: "Name", align: "left" as const },
      { key: "value", header: "Value", align: "right" as const },
    ];

    render(<DataTable data={testData} columns={alignedColumns} keyExtractor={(item) => item.id} />);

    // The component should render - alignment is applied via CSS classes
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});
