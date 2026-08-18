import { cn } from "@/lib/utils";

/**
 * Minimal styled table shell — TailAdmin's dashboard tables share this
 * shape (sticky header row, zebra-free hover rows, muted header
 * labels) restyled to KOBA tokens. Callers own their own <thead>/
 * <tbody> markup; this only provides the scroll container + base
 * classes so every dashboard table looks consistent without a heavy
 * generic-table abstraction fighting each page's actual columns.
 */
export function DataTable({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-white/[0.06]", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function DataTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-2 text-xs tracking-wide text-muted uppercase">
      <tr>{children}</tr>
    </thead>
  );
}

export function DataTableTh({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

export function DataTableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-white/[0.06]">{children}</tbody>;
}

export function DataTableRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn("transition-colors hover:bg-white/[0.03]", className)}>{children}</tr>;
}

export function DataTableTd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

export function DataTableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}
