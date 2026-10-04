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
    <aside className="w-64 bg-[#0d0e15] border-r border-white/10 h-screen sticky top-0 flex flex-col p-4 shadow-2xl text-zinc-300">
      <div className="mb-8 px-4 mt-3">
        <Link href="/" className="inline-block group">
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight flex items-center gap-2 group-hover:text-rose-400 transition-colors">
            August
          </h1>
          <p className="text-[11px] font-sans text-zinc-500 uppercase tracking-widest mt-0.5">
            Life Ledger & Mirror
          </p>
        </Link>
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
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-sm font-medium",
                isActive 
                  ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-950/50 font-semibold" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={18} className={cn("transition-colors", isActive ? "text-white" : "text-rose-400/80")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Google Calendar Integration Card */}
      <div className="mt-auto px-2 py-3">
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3.5 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-rose-400" />
              <span className="text-xs font-bold text-zinc-200">Google Calendar</span>
            </div>
            {calendarConnected ? (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-zinc-400 leading-snug mb-2.5">
            {calendarConnected
              ? "Auto-syncing reminders directly to your calendar."
              : "Connect to auto-sync reminders in background."}
          </p>

          {calendarConnected ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
              <CheckCircle2 size={12} />
              <span>Auto-Sync Active</span>
            </div>
          ) : (
            <a
              href="/api/auth/google"
              className="inline-flex items-center justify-center gap-1.5 w-full bg-white/10 hover:bg-white/15 text-zinc-200 border border-white/15 text-xs font-semibold py-1.5 px-2.5 rounded-xl transition-all shadow-xs active:scale-[0.98]"
            >
              <span>Connect Google</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
        <p className="text-[10px] font-mono text-zinc-500 text-center">August • Private Life Ledger</p>
      </div>
    </aside>
  );
}

