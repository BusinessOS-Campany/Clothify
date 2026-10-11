import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtMoney, fmtInt } from "@/lib/format";

export type Column = {
  key: string;
  label: string;
  align?: "start" | "end";
  kind?: "text" | "money" | "int";
};

export type Row = Record<string, string | number>;

export function ReportTable({
  columns,
  rows,
  emptyLabel,
}: {
  columns: Column[];
  rows: Row[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={c.align === "end" ? "text-end" : undefined}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => {
                const value = row[c.key];
                return (
                  <TableCell
                    key={c.key}
                    className={c.align === "end" ? "text-end" : undefined}
                    dir={c.kind && c.kind !== "text" ? "ltr" : undefined}
                  >
                    {c.kind === "money"
                      ? fmtMoney(typeof value === "number" ? value : Number(value ?? 0))
                      : c.kind === "int"
                        ? fmtInt(typeof value === "number" ? value : Number(value ?? 0))
                        : String(value ?? "—")}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
