import { cn } from "@/lib/utils";

type AuthAlertProps = {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
};

export function AuthAlert({ variant = "info", children }: AuthAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        variant === "error" && "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "success" && "border-success/40 bg-success/10 text-success",
        variant === "info" && "border-border bg-surface-2 text-muted",
      )}
    >
      {children}
    </div>
  );
}
