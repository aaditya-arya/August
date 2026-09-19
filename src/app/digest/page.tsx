"use client";

import { CalendarDays, CheckCircle2, BookOpen } from "lucide-react";
import { format, subDays } from "date-fns";

export default function WeeklyDigestPage() {
  const today = new Date();
  const lastWeek = subDays(today, 7);

  // Mock data representing Supabase query:
  // "Show me all items in Done and Learning where date is within the last 7 days."
  const digestItems = [
    {
      id: "1",
      category: "Done",
      content: "Finished the Django assignment and submitted it via portal.",
      date: subDays(today, 1),
    },
    {
      id: "2",
      category: "Learning",
      content: "Read chapter 5 of Atomic Habits - focus on identity change, not outcome change.",
      date: subDays(today, 2),
    },
    {
      id: "3",
      category: "Done",
      content: "Cleared my inbox and booked the dentist appointment.",
      date: subDays(today, 4),
    }
  ];

  const doneItems = digestItems.filter(i => i.category === "Done");
  const learningItems = digestItems.filter(i => i.category === "Learning");

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      <header className="mb-12">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          Weekly Digest <CalendarDays className="text-emerald-400" size={28} />
        </h1>
        <p className="text-zinc-400 text-lg">
          {format(lastWeek, "MMM d")} - {format(today, "MMM d, yyyy")}
        </p>
      </header>

      <div className="space-y-12">
        {/* The "Done" Wall Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2 text-white">
            <CheckCircle2 className="text-emerald-400" /> What you accomplished
          </h2>
          <div className="grid gap-4">
            {doneItems.map(item => (
              <div key={item.id} className="bg-emerald-900/10 border border-emerald-500/20 p-5 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl"></div>
                <p className="text-zinc-200 leading-relaxed ml-2">{item.content}</p>
                <span className="text-xs text-zinc-500 ml-2">{format(item.date, "EEEE, h:mm a")}</span>
              </div>
            ))}
          </div>
        </section>

        {/* The Learning Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2 text-white">
            <BookOpen className="text-purple-400" /> What you learned
          </h2>
          <div className="grid gap-4">
            {learningItems.map(item => (
              <div key={item.id} className="bg-purple-900/10 border border-purple-500/20 p-5 rounded-xl flex flex-col gap-2 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 rounded-l-xl"></div>
                <p className="text-zinc-200 leading-relaxed ml-2">{item.content}</p>
                <span className="text-xs text-zinc-500 ml-2">{format(item.date, "EEEE, h:mm a")}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
