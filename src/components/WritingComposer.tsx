"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, Feather, Loader2, Maximize2, Minimize2 } from "lucide-react";

const DRAFT_KEY = "august-writing-draft";
const DRAFT_EVENT = "august-draft-change";
let currentDraft: string | undefined;

function getDraft() {
  if (currentDraft === undefined) {
    try {
      currentDraft = localStorage.getItem(DRAFT_KEY) || "";
    } catch {
      currentDraft = "";
    }
  }
  return currentDraft;
}

function subscribeToDraft(callback: () => void) {
  window.addEventListener(DRAFT_EVENT, callback);
  return () => window.removeEventListener(DRAFT_EVENT, callback);
}

function updateDraft(value: string) {
  currentDraft = value;
  let persisted = true;
  try {
    if (value) localStorage.setItem(DRAFT_KEY, value);
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    persisted = false;
  }
  window.dispatchEvent(new Event(DRAFT_EVENT));
  return persisted;
}

const getServerDraft = () => "";

type WritingComposerProps = {
  onSave: (content: string) => Promise<void>;
};

export function WritingComposer({ onSave }: WritingComposerProps) {
  const content = useSyncExternalStore(subscribeToDraft, getDraft, getServerDraft);
  const [isFocused, setIsFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draftPersisted, setDraftPersisted] = useState(true);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const id = useId();
  const wordCount = content.trim() ? content.trim().split(/\s+/u).length : 0;

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  }, [content, isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = document.getElementById("writing-background");
    const sidebar = document.getElementById("app-sidebar");
    const intentionBar = document.getElementById("intentions-bar");
    if (background) background.inert = true;
    if (sidebar) sidebar.inert = true;
    if (intentionBar) intentionBar.inert = true;
    editorRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFocused(false);
        focusButtonRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (background) background.inert = false;
      if (sidebar) sidebar.inert = false;
      if (intentionBar) intentionBar.inert = false;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFocused]);

  async function saveMoment() {
    if (!content.trim() || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    setSaved(false);
    const submittedContent = content;
    try {
      await onSave(submittedContent.trim());
      // A new draft typed while the request is in flight belongs to the writer.
      if (getDraft() === submittedContent) updateDraft("");
      setSaved(true);
    } catch {
      setError("Your moment couldn’t be saved. Your writing is still here—please try again.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <section
      className={isFocused ? "writing-focus" : "mb-8"}
      role={isFocused ? "dialog" : undefined}
      aria-modal={isFocused ? true : undefined}
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (!isFocused || event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea"));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <form className="writing-paper" onSubmit={(event) => { event.preventDefault(); void saveMoment(); }}>
        <div className="writing-toolbar flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-8">
          <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.18em] text-accent">
            <Feather size={15} aria-hidden="true" /> A page of your own
          </span>
          <button
            ref={focusButtonRef}
            type="button"
            aria-pressed={isFocused}
            onClick={() => setIsFocused(!isFocused)}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-accent/5 hover:text-accent"
          >
            {isFocused ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFocused ? "Leave focus" : "Focus mode"}
          </button>
        </div>

        <div className="px-6 pb-6 pt-7 sm:px-10 sm:pt-9 lg:px-12">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
            <label id={`${id}-title`} htmlFor={`${id}-editor`} className="font-serif text-xl text-foreground sm:text-2xl">What’s on your mind?</label>
            <span className="text-[11px] tracking-wide text-muted">No perfect words needed.</span>
          </div>
          <textarea
            ref={editorRef}
            id={`${id}-editor`}
            value={content}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            placeholder={"Start with a small moment…\n\nA thought that stayed with you. A little victory. Something you’re still figuring out."}
            className="writing-editor"
            onChange={(event) => {
              setDraftPersisted(updateDraft(event.target.value));
              setSaved(false);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void saveMoment();
              }
            }}
          />
        </div>

        <div className="writing-footer flex flex-wrap items-center justify-between gap-4 border-t border-border bg-background/35 px-6 py-5 sm:px-10 lg:px-12">
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-xs text-muted">
              <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
              <span aria-hidden="true">·</span>
              <span>{content ? (draftPersisted ? "Draft kept on this device" : "Draft kept in this tab") : "A little room to begin"}</span>
            </p>
            <p id={`${id}-hint`} className="text-[11px] text-muted">
              <kbd className="font-sans">Ctrl / ⌘ + Enter</kbd> to save{isFocused ? " · Esc to leave focus" : ""}
            </p>
          </div>
          <button
            type="submit"
            disabled={!content.trim() || isSaving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40 dark:text-[#261a1f]"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={17} />}
            {isSaving ? "Saving your moment…" : "Save moment"}
          </button>
        </div>
        {error && <p id={`${id}-error`} role="alert" className="px-6 pb-5 text-sm text-rose-700 dark:text-rose-300 sm:px-10">{error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 px-6 pb-5 text-sm text-emerald-700 dark:text-emerald-300 sm:px-10"><Check size={15} /> Your moment has a home in your ledger.</p>}
      </form>
    </section>
  );
}
