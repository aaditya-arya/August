"use client";

import { useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

type Note = {
  id: string;
  content: string;
  created_at: string;
  status: "sending" | "success" | "error";
};

export default function QuickDumpPage() {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);

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
        body: JSON.stringify({ content: newNote.content }),
      });

      if (!res.ok) throw new Error("Failed to process note");
      
      const data = await res.json();
      
      setNotes((prev) =>
        prev.map((n) =>
          n.id === newNote.id ? { ...n, id: data.noteId, status: "success" } : n
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
      <header className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
          Quick Dump <Sparkles className="text-blue-400" size={28} />
        </h1>
        <p className="text-zinc-400 text-lg">
          Empty your mind. The AI will organize it for you.
        </p>
      </header>

      {/* The Input Box */}
      <form onSubmit={handleSubmit} className="mb-16 relative">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative bg-[#121214] border border-white/10 rounded-2xl overflow-hidden focus-within:border-blue-500/50 transition-colors">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? (e.g. Heard Starboy today, need to buy milk, finished the report...)"
              className="w-full bg-transparent text-white p-6 min-h-[150px] resize-none focus:outline-none text-lg placeholder:text-zinc-600"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSubmit(e);
                }
              }}
            />
            <div className="flex justify-between items-center px-6 py-4 bg-white/5 border-t border-white/5">
              <span className="text-xs text-zinc-500">
                Press <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">Cmd</kbd> + <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-zinc-300">Enter</kbd> to submit
              </span>
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="bg-white text-black px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          Today's Feed <span className="text-sm font-normal text-zinc-500 bg-white/10 px-2 py-0.5 rounded-full">{notes.length}</span>
        </h2>
        
        <div className="space-y-4">
          <AnimatePresence>
            {notes.map((note) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#121214] border border-white/5 p-5 rounded-xl flex gap-4 items-start"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                <div className="flex-1">
                  <p className="text-zinc-300 leading-relaxed">{note.content}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-zinc-500">
                      {format(new Date(note.created_at), "h:mm a")}
                    </span>
                    {note.status === "sending" && (
                      <span className="text-blue-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Routing...</span>
                    )}
                    {note.status === "success" && (
                      <span className="text-green-400">Routed ✓</span>
                    )}
                    {note.status === "error" && (
                      <span className="text-red-400">Failed ✗</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {notes.length === 0 && (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
              <p className="text-zinc-500">Your feed is empty. Start typing above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
