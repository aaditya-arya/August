"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme, setTheme } from "@/lib/use-theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`theme-toggle group flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border bg-surface text-foreground shadow-xs transition-colors hover:border-rose-400/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-500 ${compact ? "p-3" : "w-full px-3.5 py-3"}`}
    >
      <span className="flex items-center gap-2.5 text-xs font-semibold">
        <Sun size={16} aria-hidden="true" className="theme-icon-light text-rose-500" />
        <Moon size={16} aria-hidden="true" className="theme-icon-dark text-rose-300" />
        <span className={`theme-icon-light ${compact ? "sr-only" : ""}`}>Light mode</span>
        <span className={`theme-icon-dark ${compact ? "sr-only" : ""}`}>Dark mode</span>
      </span>
      <span aria-hidden="true" className={`${compact ? "hidden" : ""} theme-toggle-track relative h-6 w-11 shrink-0 rounded-full border border-rose-200 bg-rose-100 p-0.5 dark:border-rose-500/30 dark:bg-rose-500/20`}>
        <span className="theme-toggle-thumb flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-rose-500 shadow-sm dark:bg-rose-400 dark:text-zinc-950">
          <span className="h-1 w-1 rounded-full bg-current" />
        </span>
      </span>
    </button>
  );
}
