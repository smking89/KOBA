"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Global light/dark toggle (client, 2026-08-17: "we need the toggle for
 * dark mode and light mode"), shared across the whole site and every
 * subdomain — one preference, not a per-surface toggle. Persists to
 * localStorage + a cookie (read by theme-script.tsx's inline anti-FOUC
 * script) so the choice survives reloads and applies before first paint.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("koba-theme", next);
    document.cookie = `koba-theme=${next};path=/;max-age=31536000;samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-surface-2 hover:text-foreground",
        className,
      )}
    >
      {theme === null ? (
        <span className="h-[18px] w-[18px]" aria-hidden />
      ) : theme === "light" ? (
        <Moon className="h-[18px] w-[18px]" aria-hidden />
      ) : (
        <Sun className="h-[18px] w-[18px]" aria-hidden />
      )}
    </button>
  );
}
