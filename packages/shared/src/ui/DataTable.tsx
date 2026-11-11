import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "./primitives";
import { cn } from "../lib/cn";

export interface Column<R> { key: string; header: string; cell: (r: R) => ReactNode; className?: string; sortValue?: (r: R) => string | number }
export function DataTable<R>({ rows, columns, rowKey, searchable, searchText, empty, onRowClick, toolbar }: {
  rows: R[]; columns: Column<R>[]; rowKey: (r: R) => string | number; searchable?: boolean; searchText?: (r: R) => string;
  empty?: ReactNode; onRowClick?: (r: R) => void; toolbar?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const shown = useMemo(() => {
    let out = q && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(q.toLowerCase())) : rows;
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) out = [...out].sort((a, b) => (col.sortValue!(a) > col.sortValue!(b) ? 1 : -1) * sort!.dir);
    return out;
  }, [rows, q, sort, columns, searchText]);
  return (
    <div>
      {(searchable || toolbar) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {searchable && <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <Input aria-label="Search" placeholder="Search…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs text-ink-soft">
            <tr>{columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-2.5 font-medium", c.className)}>
                {c.sortValue ? <button className="hover:text-ink" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                  {c.header}{sort?.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</button> : c.header}
              </th>))}</tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn("border-t border-line", onRowClick && "cursor-pointer hover:bg-paper/70")}>
                {columns.map((c) => <td key={c.key} className={cn("px-4 py-3 align-middle text-ink", c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <div className="border-t border-line">{empty ?? <p className="py-10 text-center text-sm text-ink-mute">{q ? `Nothing matches "${q}".` : "Nothing here yet."}</p>}</div>}
      </div>
    </div>
  );
}
