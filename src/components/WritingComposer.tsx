"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, Feather, Heart, Leaf, Loader2, Maximize2, Minimize2, RefreshCw, Sparkles, AlignLeft, Type, Wind } from "lucide-react";
import styles from "./WritingComposer.module.css";
import { writingModes } from "@august/shared";

const modeIcons = [Feather, Heart, Wind, Sparkles];

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
  const [modeIndex, setModeIndex] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [ruled, setRuled] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const focusButtonRef = useRef<HTMLButtonElement>(null);
  const savingRef = useRef(false);
  const id = useId();
  const wordCount = content.trim() ? content.trim().split(/\s+/u).length : 0;
  const mode = writingModes[modeIndex];
  const prompt = mode.prompts[promptIndex];

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  }, [content, isFocused, largeText]);

  useEffect(() => {
    if (!isFocused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Isolate the editor at every ancestor, including the mobile navigation.
    const backgroundElements: { element: HTMLElement; inert: boolean }[] = [];
    let current: HTMLElement | null = sectionRef.current;
    while (current && current !== document.body) {
      const parent: HTMLElement | null = current.parentElement;
      if (!parent) break;
      for (const sibling of parent.children) {
        if (sibling instanceof HTMLElement && sibling !== current && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) {
          backgroundElements.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      current = parent;
    }
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
      backgroundElements.forEach(({ element, inert }) => { element.inert = inert; });
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFocused]);

  function usePrompt() {
    const draft = getDraft();
    const next = `${draft.trimEnd()}${draft.trim() ? "\n\n" : ""}${prompt}\n`;
    setDraftPersisted(updateDraft(next));
    setSaved(false);
    setError(null);
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(next.length, next.length);
    });
  }

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
      ref={sectionRef}
      className={`${styles.studio} ${isFocused ? styles.focus : ""}`}
      role={isFocused ? "dialog" : undefined}
      aria-modal={isFocused ? true : undefined}
      aria-labelledby={`${id}-title`}
      onKeyDown={(event) => {
        if (!isFocused || event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea")).filter((element) => element.getClientRects().length > 0);
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
      <div className={styles.studioHeader}>
        <div className={styles.modes} role="group" aria-label="Writing inspiration">
          {writingModes.map((item, index) => {
            const Icon = modeIcons[index];
            return <button key={item.name} type="button" aria-pressed={modeIndex === index}
              onClick={() => { setModeIndex(index); setPromptIndex(0); }} className={styles.mode}>
              <Icon size={15} aria-hidden="true" /><span>{item.name}</span>
            </button>;
          })}
        </div>
        <span className={styles.headerNote}>A small ritual. All yours.</span>
      </div>

      <form className={styles.paper} onSubmit={(event) => { event.preventDefault(); void saveMoment(); }}>
        <div className={styles.toolbar}>
          <span className={styles.pageLabel}><span className={styles.inkDot} /> TODAY’S PAGE</span>
          <div className={styles.tools}>
            <button type="button" aria-label="Show ruled lines" title="Show ruled lines" aria-pressed={ruled} onClick={() => setRuled(!ruled)} className={styles.iconButton}><AlignLeft size={16} aria-hidden="true" /></button>
            <button type="button" aria-label="Larger writing text" title="Larger writing text" aria-pressed={largeText} onClick={() => setLargeText(!largeText)} className={styles.iconButton}><Type size={17} aria-hidden="true" /></button>
            <span className={styles.toolDivider} />
            <button
              ref={focusButtonRef}
              type="button"
              aria-pressed={isFocused}
              onClick={() => setIsFocused(!isFocused)}
              className={styles.focusButton}
            >
              {isFocused ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
              {isFocused ? "Leave focus" : "Focus mode"}
            </button>
          </div>
        </div>

        <div className={styles.pageBody}>
          <div className={styles.writingArea}>
            <div className={styles.editorHeading}>
              <label id={`${id}-title`} htmlFor={`${id}-editor`}>{mode.title}</label>
              <span>No perfect words. Just yours.</span>
            </div>
            <textarea
              ref={editorRef}
              id={`${id}-editor`}
              value={content}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              placeholder={mode.placeholder}
              className={`${styles.editor} ${ruled ? styles.ruled : ""} ${largeText ? styles.largeText : ""}`}
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

          <aside className={styles.inspiration} aria-label="A little inspiration">
            <div className={styles.botanical} aria-hidden="true">
              <svg viewBox="0 0 180 150" fill="none">
                <circle cx="92" cy="74" r="58" fill="currentColor" opacity=".06" />
                <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M70 139C98 115 91 80 110 29M88 111C76 99 62 95 52 86M94 88C107 81 118 69 128 60M101 55C90 49 84 37 84 27" />
                  <path d="M87 110C64 116 50 102 47 82C68 83 84 89 87 110Z" fill="currentColor" fillOpacity=".1" />
                  <path d="M95 87C96 65 113 53 134 55C130 74 117 87 95 87Z" fill="currentColor" fillOpacity=".12" />
                  <path d="M101 56C81 55 73 41 78 22C94 27 102 38 101 56Z" fill="currentColor" fillOpacity=".08" />
                  <path d="M108 36C103 19 112 9 127 6C128 20 121 31 108 36Z" fill="currentColor" fillOpacity=".14" />
                  <path d="M48 45V53M44 49H52M137 106V114M133 110H141" opacity=".5" />
                </g>
              </svg>
            </div>
            <p className={styles.promptEyebrow}>A LITTLE INSPIRATION</p>
            <p className={styles.prompt} aria-live="polite">{prompt}</p>
            <button type="button" onClick={usePrompt} className={styles.usePrompt}>Start with this <ArrowUpRight size={14} aria-hidden="true" /></button>
            <button type="button" onClick={() => setPromptIndex((promptIndex + 1) % mode.prompts.length)} className={styles.nextPrompt}><RefreshCw size={12} aria-hidden="true" /> Another thought</button>
          </aside>
        </div>

        <div className={styles.footer}>
          <div className={styles.draftInfo}>
            <p className={styles.draftStatus}>
              {content ? <Check size={13} aria-hidden="true" /> : <Feather size={13} aria-hidden="true" />}
              <span>{content ? (draftPersisted ? "Draft kept on this device" : "Draft kept in this tab") : "Every beginning counts"}</span>
            </p>
            <p id={`${id}-hint`} className={styles.shortcut}>
              <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span><span aria-hidden="true">·</span>
              <span><kbd>Ctrl / ⌘ + Enter</kbd> to save{isFocused ? " · Esc to leave focus" : ""}</span>
            </p>
          </div>
          <button
            type="submit"
            disabled={!content.trim() || isSaving}
            className={styles.saveButton}
          >
            {isSaving ? "Saving your moment…" : "Save moment"}
            {isSaving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ArrowUpRight size={17} aria-hidden="true" />}
          </button>
        </div>
        {error && <p id={`${id}-error`} role="alert" className="px-6 pb-5 text-sm text-rose-700 dark:text-rose-300 sm:px-10">{error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 px-6 pb-5 text-sm text-emerald-700 dark:text-emerald-300 sm:px-10"><Check size={15} /> Your moment has a home in your ledger.</p>}
      </form>
      <p className={styles.afterword}><Leaf size={13} aria-hidden="true" /> Some days, a sentence is enough.</p>
    </section>
  );
}
