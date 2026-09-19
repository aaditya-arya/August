"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  PenLine, 
  Network, 
  CalendarDays, 
  Folders 
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: "Quick Dump", href: "/", icon: PenLine },
  { name: "Brain Graph", href: "/graph", icon: Network },
  { name: "Weekly Digest", href: "/digest", icon: CalendarDays },
  { name: "Clusters", href: "/clusters", icon: Folders },
];

export function Sidebar() {
  const pathname = usePathname();

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
      
      <div className="mt-auto px-4 py-4">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-pink-200 to-transparent mb-4" />
        <p className="text-xs text-zinc-400 text-center font-medium">v1.0 • NLP Engine Active</p>
      </div>
    </aside>
  );
}
