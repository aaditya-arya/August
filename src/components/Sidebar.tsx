"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Network,
  CalendarDays,
  Folders,
  Calendar,
  CheckCircle2,
  ExternalLink,
  BookOpen,
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

const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 180;
const COLLAPSE_THRESHOLD = 110;

function subscribePreferences(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function readOpen() { try { return localStorage.getItem("august-sidebar-open") !== "false"; } catch { return true; } }
function readWidth() {
  try { const value = Number(localStorage.getItem("august-sidebar-width")); return value >= MIN_WIDTH && value <= 600 ? value : DEFAULT_WIDTH; } catch { return DEFAULT_WIDTH; }
}

export function Sidebar() {
  const pathname = usePathname();
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);

  // Sidebar Open / Width States
  const storedOpen = useSyncExternalStore(subscribePreferences, readOpen, () => true);
  const storedWidth = useSyncExternalStore(subscribePreferences, readWidth, () => DEFAULT_WIDTH);
  const [openOverride, setIsOpen] = useState<boolean | null>(null);
  const isOpen = openOverride ?? storedOpen;
  const [widthOverride, setWidth] = useState<number | null>(null);
  const width = widthOverride ?? storedWidth;
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const lastValidWidthRef = useRef(DEFAULT_WIDTH);

  // Google Calendar Status check
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

  // Toggle function with persistence
  const toggleSidebar = useCallback(() => {
    setIsOpen((prev) => {
      const next = !(prev ?? readOpen());
      try {
        localStorage.setItem("august-sidebar-open", next ? "true" : "false");
      } catch {}
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl + B / Cmd + B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // Mouse drag handler for resizing and collapsing/expanding
  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    e.preventDefault();

    const startX = e.clientX;
    let hasMoved = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 3) {
        hasMoved = true;
        setIsDragging(true);
      }

      if (!hasMoved) return;

      const currentX = moveEvent.clientX;
      if (currentX < COLLAPSE_THRESHOLD) {
        // Dragged close to left edge: show collapsed
        setIsOpen(false);
      } else {
        const maxW = Math.min(560, Math.floor(window.innerWidth * 0.55));
        const clamped = Math.max(MIN_WIDTH, Math.min(maxW, currentX));
        setIsOpen(true);
        setWidth(clamped);
        lastValidWidthRef.current = clamped;
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      setIsDragging(false);
      document.body.style.removeProperty("cursor");
      document.body.classList.remove("select-none");

      if (!hasMoved) {
        // Clicked without dragging: toggle sidebar
        toggleSidebar();
        return;
      }

      const finalX = upEvent.clientX;
      if (finalX < COLLAPSE_THRESHOLD) {
        setIsOpen(false);
        try {
          localStorage.setItem("august-sidebar-open", "false");
        } catch {}
      } else {
        const maxW = Math.min(560, Math.floor(window.innerWidth * 0.55));
        const clamped = Math.max(MIN_WIDTH, Math.min(maxW, finalX));
        setIsOpen(true);
        setWidth(clamped);
        try {
          localStorage.setItem("august-sidebar-open", "true");
          localStorage.setItem("august-sidebar-width", clamped.toString());
        } catch {}
      }
    };

    document.body.style.cursor = "col-resize";
    document.body.classList.add("select-none");
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Double click resets width to default or toggles
  const handleDoubleClick = () => {
    if (!isOpen) {
      setIsOpen(true);
      setWidth(DEFAULT_WIDTH);
    } else if (Math.abs(width - DEFAULT_WIDTH) > 10) {
      setWidth(DEFAULT_WIDTH);
      lastValidWidthRef.current = DEFAULT_WIDTH;
      try {
        localStorage.setItem("august-sidebar-width", DEFAULT_WIDTH.toString());
      } catch {}
    } else {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* MOBILE TOP/BOTTOM NAVIGATION BAR (< md) */}
      <div className="z-20 w-full shrink-0 bg-sidebar border-b border-border p-3 text-foreground md:hidden flex flex-col">
        <div className="flex items-center justify-between gap-4 px-3 mb-3">
          <Link href="/" className="inline-block group">
            <h1 className="text-[24px] font-serif font-medium italic text-foreground tracking-tight flex items-center gap-2 group-hover:text-accent transition-colors">
              August
            </h1>
            <p className="text-[9px] font-sans text-muted uppercase tracking-[.16em]">
              Life Ledger & Mirror
            </p>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="/api/auth/google"
              aria-label={calendarConnected ? "Google Calendar connected" : "Connect Google Calendar"}
              className="rounded-xl border border-border p-2.5 text-accent"
            >
              <Calendar size={16} />
            </a>
            <ThemeToggle compact />
          </div>
        </div>

        <nav className="grid grid-cols-4 gap-1" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-1 py-2 rounded-xl transition-all duration-200 text-[10px] font-medium text-center",
                  isActive
                    ? "bg-accent/10 text-accent font-semibold"
                    : "text-muted hover:text-foreground hover:bg-rose-500/5"
                )}
              >
                <Icon size={16} className={cn("shrink-0", isActive ? "text-accent" : "text-muted")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* DESKTOP RESIZABLE SIDEBAR CONTAINER (md and above) */}
      <div
        className={cn(
          "relative shrink-0 hidden md:flex md:h-dvh md:sticky md:top-0 z-30",
          isDragging ? "select-none transition-none" : "transition-[width] duration-200 ease-out"
        )}
        style={{ width: isOpen ? `${width}px` : 0 }}
      >
        {/* Inner Sidebar Content */}
        <div
          className="h-full overflow-hidden flex flex-col"
          style={{
            width: `${width}px`,
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
            visibility: isOpen ? "visible" : "hidden",
            transition: isDragging ? "none" : "opacity 160ms ease-out",
          }}
        >
          <aside
            id="app-sidebar"
            aria-hidden={!isOpen}
            className="w-full h-full bg-sidebar border-r border-border flex flex-col p-4 text-foreground overflow-y-auto overflow-x-hidden"
          >
            {/* Brand Header */}
            <div className="mb-8 flex items-center justify-between gap-4 px-3 mt-3">
              <Link href="/" className="inline-block group">
                <h1 className="text-[28px] font-serif font-medium italic text-foreground tracking-tight flex items-center gap-2 group-hover:text-accent transition-colors">
                  August
                </h1>
                <p className="text-[9px] font-sans text-muted uppercase tracking-[.16em] mt-1">
                  Life Ledger & Mirror
                </p>
              </Link>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 space-y-1.5" aria-label="Main navigation">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                      isActive
                        ? "bg-accent/10 text-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-rose-500/5"
                    )}
                  >
                    <Icon size={18} className={cn("shrink-0 transition-colors", isActive ? "text-accent" : "text-muted")} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Google Calendar Integration & Footer */}
            <div className="mt-auto px-1 py-3">
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
              <div className="flex items-center justify-between text-[10px] text-muted px-1">
                <span>August · Life Ledger</span>
                <span className="font-mono text-[9px] bg-border/40 px-1.5 py-0.5 rounded text-muted">Ctrl+B</span>
              </div>
            </div>
          </aside>
        </div>

        {/* RESIZER SLIDER BAR & TOGGLE HANDLE BUTTON */}
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onMouseDown={handleDragStart}
          onDoubleClick={handleDoubleClick}
          className={cn(
            "absolute top-0 bottom-0 z-40 flex items-start select-none cursor-col-resize",
            isOpen ? "right-0 translate-x-1/2 w-4 justify-center" : "left-0 w-8 justify-start"
          )}
          title="Drag to resize or collapse · Double-click to reset"
        >
          {/* Blue Vertical Line Indicator (from user screenshot) */}
          <div
            className={cn(
              "absolute top-0 bottom-0 transition-all duration-150 pointer-events-none",
              isOpen ? "left-1/2 -translate-x-1/2" : "left-0",
              isDragging || isHovered
                ? "w-[2.5px] bg-blue-600 dark:bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.45)] opacity-100"
                : isOpen
                ? "w-[2.5px] bg-transparent opacity-0"
                : "w-[2.5px] bg-border opacity-70"
            )}
          />

          {/* Toggle Button Handle (matches user screenshot pill with vertical bar icon) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebar();
            }}
            title={isOpen ? "Collapse Sidebar (Ctrl + B)" : "Expand Sidebar (Ctrl + B)"}
            aria-label={isOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            aria-expanded={isOpen}
            className={cn(
              "mt-7 relative z-50 flex items-center justify-center rounded-md border-2 border-black dark:border-zinc-200 bg-white dark:bg-[#1d1e20] text-zinc-900 dark:text-zinc-100 shadow-sm transition-all duration-150 cursor-pointer hover:scale-105 active:scale-95 hover:shadow-md",
              "w-6 h-7",
              isOpen ? "translate-x-0" : "ml-2.5"
            )}
          >
            {/* The vertical bar glyph inside the rounded rectangle */}
            <span className="w-[2px] h-3.5 bg-zinc-900 dark:bg-zinc-100 rounded-full" />
          </button>
        </div>
      </div>
    </>
  );
}
