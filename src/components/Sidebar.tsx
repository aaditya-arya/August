"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Network,
  CalendarDays,
  Folders,
  Calendar,
  CheckCircle2,
  ExternalLink,
  BookOpen
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ThemeToggle } from "@/components/ThemeToggle";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Life Ledger", href: "/", icon: CalendarDays },
  { name: "Sunday Review", href: "/digest", icon: BookOpen },
  { name: "Brain Graph", href: "/graph", icon: Network },
  { name: "Clusters & Search", href: "/clusters", icon: Folders },
];

export function Sidebar() {
  const pathname = usePathname();
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkCalendarStatus() {
      try {
        const res = await fetch("/api/auth/google/status");
        if (res.ok) {
          const data = await res.json();
          setCalendarConnected(data.connected);
        }
      } catch {
        setCalendarConnected(false);
      }
    }
    checkCalendarStatus();
  }, [pathname]);

  return (
    <aside id="app-sidebar" className="z-20 w-full shrink-0 bg-sidebar border-b md:border-b-0 md:border-r border-border md:w-64 md:h-dvh md:sticky md:top-0 flex flex-col p-3 md:p-4 text-foreground md:overflow-y-auto">
      <div className="mb-4 flex items-center justify-between gap-4 px-3 mt-1 md:mb-10 md:mt-5">
        <Link href="/" className="inline-block group">
          <h1 className="text-[28px] font-serif font-medium italic text-foreground tracking-tight flex items-center gap-2 group-hover:text-accent transition-colors">
            August
          </h1>
          <p className="text-[9px] font-sans text-muted uppercase tracking-[.16em] mt-1">
            Life Ledger & Mirror
          </p>
        </Link>
        <div className="flex items-center gap-2 md:hidden">
          <a href="/api/auth/google" aria-label={calendarConnected ? "Google Calendar connected" : "Connect Google Calendar"} className="rounded-xl border border-border p-3 text-accent"><Calendar size={17} /></a>
          <ThemeToggle compact />
        </div>
      </div>

      <nav className="grid grid-cols-4 gap-1 md:flex-1 md:block md:space-y-1.5" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col md:flex-row items-center justify-center md:justify-start gap-1.5 md:gap-3 px-1 md:px-4 py-3 rounded-xl transition-all duration-200 text-[10px] md:text-sm font-medium text-center md:text-left",
                isActive
                  ? "bg-accent/10 text-accent font-semibold"
                  : "text-muted hover:text-foreground hover:bg-rose-500/5"
              )}
            >
              <Icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-accent" : "text-muted")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Google Calendar Integration Card */}
      <div className="mt-auto hidden px-2 py-3 md:block">
        <div className="mb-4">
          <ThemeToggle />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-3.5 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-rose-500 dark:text-rose-400" />
              <span className="text-xs font-bold text-foreground">Google Calendar</span>
            </div>
            {calendarConnected ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-muted leading-snug mb-2.5">
            {calendarConnected
              ? "Auto-syncing reminders directly to your calendar."
              : "Connect to auto-sync reminders in background."}
          </p>

          {calendarConnected ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
              <CheckCircle2 size={12} />
              <span>Auto-Sync Active</span>
            </div>
          ) : (
            <a
              href="/api/auth/google"
              className="inline-flex items-center justify-center gap-1.5 w-full bg-rose-500/5 hover:bg-rose-500/10 text-foreground border border-border text-xs font-semibold py-1.5 px-2.5 rounded-xl transition-all shadow-xs active:scale-[0.98]"
            >
              <span>Connect Google</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="h-px w-full bg-border mb-3" />
        <p className="text-[10px] text-muted text-center">August • A little more present</p>
      </div>
    </aside>
  );
}

