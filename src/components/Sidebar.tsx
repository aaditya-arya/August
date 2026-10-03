"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  PenLine, 
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
    <aside className="w-64 bg-white/70 backdrop-blur-xl border-r border-pink-100/80 h-screen sticky top-0 flex flex-col p-4 shadow-[4px_0_24px_rgba(244,114,182,0.05)]">
      <div className="mb-8 px-4 mt-4">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-pink-600 via-rose-500 to-pink-400 bg-clip-text text-transparent tracking-tight">
          Write
        </h1>
      </div>
      
      <nav className="flex-1 space-y-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                isActive 
                  ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_4px_14px_rgba(244,63,94,0.3)] font-semibold" 
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-pink-50/80"
              )}
            >
              <Icon size={18} className={cn("transition-colors", isActive ? "text-white" : "text-pink-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Google Calendar Integration Card */}
      <div className="mt-auto px-2 py-3">
        <div className="bg-pink-50/60 border border-pink-100 rounded-2xl p-3.5 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-pink-600" />
              <span className="text-xs font-bold text-zinc-800">Google Calendar</span>
            </div>
            {calendarConnected ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-zinc-500 leading-snug mb-2.5">
            {calendarConnected
              ? "Auto-syncing reminders directly to your calendar."
              : "Connect once to auto-add date reminders in the background."}
          </p>

          {calendarConnected ? (
            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
              <CheckCircle2 size={12} />
              <span>Auto-Sync Active</span>
            </div>
          ) : (
            <a
              href="/api/auth/google"
              className="inline-flex items-center justify-center gap-1.5 w-full bg-white hover:bg-pink-100/60 text-pink-700 border border-pink-200 text-xs font-semibold py-1.5 px-2.5 rounded-xl transition-all shadow-xs active:scale-[0.98]"
            >
              <span>Connect Google</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-pink-200 to-transparent mb-3" />
        <p className="text-[11px] text-zinc-400 text-center font-medium">v1.0 • NLP & Temporal Engine Active</p>
      </div>
    </aside>
  );
}
