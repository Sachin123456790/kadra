import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  selectedId?: string;
  getRowId?: (row: T) => string;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, onRowClick, selectedId, getRowId, emptyMessage = "No data available",
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th key={col.key} className={cn("px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground", col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => {
              const rowId = getRowId ? getRowId(row) : (row.id as string);
              return (
                <tr
                  key={rowId ?? i}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "border-b border-border transition-colors duration-150 motion-reduce:transition-none",
                    onRowClick && "cursor-pointer hover:bg-muted/50",
                    selectedId && rowId === selectedId && "bg-sidebar-accent"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn("px-4 py-3 text-card-foreground", col.className)}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
