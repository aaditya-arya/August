"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, Sparkles, Calendar, CheckCircle2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type CalendarEventInfo = {
  title?: string;
  start_time?: string;
  htmlLink?: string;
  eventId?: string;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
  status: "sending" | "success" | "error";
  calendarEvents?: CalendarEventInfo[];
};

export default function QuickDumpPage() {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [calendarConnectedBanner, setCalendarConnectedBanner] = useState(false);

  useEffect(() => {
    // Check if redirected after Google Calendar OAuth connection
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("calendar") === "connected") {
        setCalendarConnectedBanner(true);
        window.history.replaceState({}, "", "/");
      }
    }

    async function loadNotes() {
      try {
        const res = await fetch("/api/notes");
        if (res.ok) {
          const data = await res.json();
          if (data.notes) {
            setNotes(
              data.notes.map((n: any) => ({
                id: n.id,
                content: n.content,
                created_at: n.created_at,
                status: "success",
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load notes:", err);
      }
    }
    loadNotes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    const newNote: Note = {
      id: Date.now().toString(),
      content: content.trim(),
      created_at: new Date().toISOString(),
      status: "sending",
    };

    setNotes((prev) => [newNote, ...prev]);
    setContent("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newNote.content,
          currentTime: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      if (!res.ok) throw new Error("Failed to process note");
      
      const data = await res.json();
      
      setNotes((prev) =>
        prev.map((n) =>
          n.id === newNote.id
            ? {
                ...n,
                id: data.noteId,
                status: "success",
                calendarEvents: data.calendarEventsSynced || [],
              }
            : n
        )
      );
    } catch (error) {
      setNotes((prev) =>
        prev.map((n) => (n.id === newNote.id ? { ...n, status: "error" } : n))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 pt-16">
      {/* Google Calendar Connected Banner */}
      {calendarConnectedBanner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">Google Calendar Connected!</p>
              <p className="text-xs text-emerald-700">
                Any future tasks or calls you write will now automatically add to your calendar in the background.
              </p>
            </div>
          </div>
          <button
            onClick={() => setCalendarConnectedBanner(false)}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold px-2 py-1"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      <header className="mb-10">
        <h1 className="text-4xl font-extrabold text-zinc-900 mb-2 flex items-center gap-3 tracking-tight">
          Quick Dump <Sparkles className="text-pink-500" size={30} />
        </h1>
        <p className="text-zinc-500 text-lg">
          Empty your mind. The AI will organize, categorize, and auto-sync reminders for you.
        </p>
      </header>

      {/* The Input Box */}
      <form onSubmit={handleSubmit} className="mb-14 relative">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-pink-400 via-rose-300 to-pink-300 rounded-3xl blur-md opacity-30 group-hover:opacity-50 transition duration-500"></div>
          <div className="relative bg-white/90 backdrop-blur-xl border border-pink-100 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(244,114,182,0.12)] focus-within:border-pink-300 focus-within:ring-4 focus-within:ring-pink-100/60 transition-all">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? (e.g. I have to call Rohan two days later, finished the report, buy milk...)"
              className="w-full bg-transparent text-zinc-800 p-6 min-h-[160px] resize-none focus:outline-none text-lg placeholder:text-zinc-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex justify-between items-center px-6 py-4 bg-pink-50/50 border-t border-pink-100/60">
              <span className="text-xs text-zinc-400">
                Press <kbd className="font-mono bg-white border border-pink-200 px-1.5 py-0.5 rounded text-zinc-600 shadow-xs">Cmd</kbd> + <kbd className="font-mono bg-white border border-pink-200 px-1.5 py-0.5 rounded text-zinc-600 shadow-xs">Enter</kbd> to submit
              </span>
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:opacity-95 hover:shadow-[0_4px_16px_rgba(244,63,94,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                Process
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* The Daily Feed */}
      <div>
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-zinc-800">
          Today's Feed <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2.5 py-0.5 rounded-full">{notes.length}</span>
        </h2>
        
        <div className="space-y-4">
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 backdrop-blur-md border border-pink-100/80 p-5 rounded-2xl flex gap-4 items-start shadow-[0_4px_16px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgba(244,114,182,0.1)] transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-pink-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(244,114,182,0.8)]" />
                <div className="flex-1">
                  <p className="text-zinc-700 leading-relaxed text-[15px]">{note.content}</p>

                  {/* Calendar Event Badges */}
                  {note.calendarEvents && note.calendarEvents.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {note.calendarEvents.map((evt, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xs"
                        >
                          <Calendar size={13} className="text-emerald-600" />
                          <span>Added to Google Calendar: {evt.title || "Reminder"}</span>
                          {evt.start_time && (
                            <span className="text-emerald-600 font-normal">
                              ({format(new Date(evt.start_time), "MMM d, h:mm a")})
                            </span>
                          )}
                          {evt.htmlLink && (
                            <a
                              href={evt.htmlLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-900 ml-1"
                              title="Open in Google Calendar"
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">
                      {format(new Date(note.created_at), "h:mm a")}
                    </span>
                    {note.status === "sending" && (
                      <span className="text-pink-500 font-medium flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Routing & Syncing...</span>
                    )}
                    {note.status === "success" && (
                      <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Routed ✓</span>
                    )}
                    {note.status === "error" && (
                      <span className="text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">Failed ✗</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {notes.length === 0 && (
            <div className="text-center py-14 border-2 border-dashed border-pink-200/80 rounded-2xl bg-white/40">
              <p className="text-zinc-400 font-medium">Your feed is empty. Start typing above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
