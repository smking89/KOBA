import { cn } from "@/lib/utils";

/**
 * Row-list primitive for queue/moderation panels (pending listings,
 * shops, servers, reports, …) — TailAdmin-reskin follow-up
 * (2026-08-18): these panels are free-form item cards (title + wrapped
 * meta text + trailing actions), not uniform tabular data, so forcing
 * them into DataTable would be a worse fit than the dashboard's
 * top-level metric/audit surfaces got. This gives them the same
 * consistent hover state, spacing, and border language as everything
 * else instead, without cramming variable-height content into <td>s.
 */
export function ListPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ul className={cn("divide-y divide-white/[0.06] rounded-lg border border-white/[0.06]", className)}>
      {children}
    </ul>
  );
}

export function ListRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </li>
  );
}

export function ListRowMain({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 space-y-1", className)}>{children}</div>;
}

export function ListRowTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("truncate font-medium text-foreground", className)}>{children}</p>;
}

export function ListRowMeta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs text-muted", className)}>{children}</p>;
}

export function ListRowActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex shrink-0 flex-wrap gap-2", className)}>{children}</div>;
}

export function ListPanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
