import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-border text-muted",
  success: "border-electric-green/40 text-electric-green",
  warning: "border-warning/40 text-warning",
  danger: "border-destructive/40 text-destructive",
  accent: "border-neon-lime/40 text-neon-lime",
} as const;

export function StatusPill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
