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
    <aside className="w-64 bg-black/40 backdrop-blur-xl border-r border-white/5 h-screen sticky top-0 flex flex-col p-4">
      <div className="mb-8 px-4 mt-4">
        <h1 className="text-xl font-bold bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
          BrainDump
        </h1>
      </div>
      
      <nav className="flex-1 space-y-1">
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
                  ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={18} className={cn("transition-colors", isActive ? "text-blue-400" : "text-zinc-500")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      <div className="mt-auto px-4 py-4">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />
        <p className="text-xs text-zinc-600 text-center">v1.0 • NLP Engine Active</p>
      </div>
    </aside>
  );
}
