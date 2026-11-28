"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Cloud, CloudOff, Maximize2, Minimize2, Plus, SlidersHorizontal } from "lucide-react";
import { MAX_DRAFT_LENGTH } from "@/lib/web-draft-model";
import { useJournalDraft } from "./CloudDraftProvider";
import styles from "./WritingComposer.module.css";

type Preferences = { size: number; face: "serif" | "sans"; still: boolean };
const defaults: Preferences = { size: 20, face: "serif", still: false };
const preferenceKey = "august-editor-preferences";

function readPreferences(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey) || "null");
    if (value && [18, 20, 23, 26].includes(value.size) && ["serif", "sans"].includes(value.face)) {
      return { size: value.size, face: value.face, still: value.still === true };
    }
  } catch {}
  return defaults;
}

export function WritingComposer() {
  const [focus, setFocus] = useState(false);
  const [preferences, setPreferences] = useState(defaults);
  const cloudDraft = useJournalDraft();
  const { view, dirty, setEditorActive } = cloudDraft;
  const section = useRef<HTMLElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const creatingEntry = useRef(false);
  const id = useId();
  const filed = view.cloud?.status === "filed";
  const organizing = view.busy === "organize" || view.cloud?.status === "organizing";
  const receipt = view.cloud?.receipt;
  const wordCount = view.content.trim() ? view.content.trim().split(/\s+/u).length : 0;

  useEffect(() => { queueMicrotask(() => setPreferences(readPreferences())); }, []);
  useEffect(() => {
    const blur = () => setEditorActive(false);
    const restore = () => setEditorActive(Boolean(section.current?.contains(document.activeElement)));
    window.addEventListener("blur", blur);
    window.addEventListener("focus", restore);
    document.addEventListener("focusin", restore);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", restore);
      document.removeEventListener("focusin", restore);
      setEditorActive(false);
    };
  }, [setEditorActive]);

  useEffect(() => {
    if (!focus || !section.current) return;
    const editor = section.current;
    const background: { element: HTMLElement; inert: boolean }[] = [];
    let current: HTMLElement | null = editor;
    while (current?.parentElement && current !== document.body) {
      const parent: HTMLElement = current.parentElement;
      for (const sibling of parent.children) {
        if (sibling instanceof HTMLElement && sibling !== current && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) {
          background.push({ element: sibling, inert: sibling.inert });
          sibling.setAttribute("inert", "");
        }
      }
      current = parent;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    field.current?.focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFocus(false);
        requestAnimationFrame(() => focusButton.current?.focus({ preventScroll: true }));
      } else if (event.key === "Tab") {
        const controls = [...editor.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled]), summary, select, input")]
          .filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      background.forEach(({ element, inert }) => element.toggleAttribute("inert", inert));
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyboard);
    };
  }, [focus]);

  useEffect(() => {
    if (creatingEntry.current && !filed && !view.busy && !view.content) {
      creatingEntry.current = false;
      field.current?.focus();
    }
  }, [filed, view.busy, view.content]);

  function adjust(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try { localStorage.setItem(preferenceKey, JSON.stringify(next)); } catch {}
  }

  function statusText() {
    if (view.problem === "load") return "Cloud draft unavailable";
    if (!view.ready) return "Opening cloud draft…";
    if (view.conflict) return "Draft changed on another device";
    if (dirty && view.offline) return "Offline · waiting to save";
    if (view.problem === "save") return "Cloud save couldn’t finish";
    if (dirty || view.busy === "save") return "Saving to cloud…";
    if (organizing) return "Saved to cloud · organizing";
    if (filed) return "In your journal";
    if (view.content) return "Saved to cloud";
    return "Cloud autosave on";
  }

  const warning = view.conflict || view.offline || (view.problem && view.problem !== "organize");
  const status = statusText();
  const actions = receipt ? [
    receipt.tasks && `${receipt.tasks} ${receipt.tasks === 1 ? "task" : "tasks"}`,
    receipt.reminders && `${receipt.reminders} ${receipt.reminders === 1 ? "reminder" : "reminders"}`,
    receipt.events && `${receipt.events} ${receipt.events === 1 ? "event" : "events"}`,
    receipt.calendarEvents && `${receipt.calendarEvents} added to Google Calendar`,
  ].filter(Boolean).join(" · ") : "";

  return <section
    ref={section}
    className={`${styles.sheet} ${focus ? styles.focus : ""}`}
    data-still={preferences.still}
    aria-label={focus ? "Focus editor" : "Journal editor"}
    role={focus ? "dialog" : undefined}
    aria-modal={focus ? true : undefined}
    onBlurCapture={event => {
      if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setEditorActive(false);
    }}
  >
    <div className={styles.paper}>
      <div className={styles.toolbar}>
        <span className={styles.status} role="status">
          {filed ? <Check className={styles.check} size={17} aria-hidden="true" /> : warning ? <CloudOff size={17} aria-hidden="true" /> : <Cloud size={17} aria-hidden="true" />}
          <span>{status}</span>
        </span>
        <div className={styles.tools}>
          <details className={styles.settings}>
            <summary aria-label="Writing preferences" title="Writing preferences">
              <SlidersHorizontal size={17} aria-hidden="true" /><span>Text</span>
            </summary>
            <div className={styles.panel}>
              <label>Text size
                <select value={preferences.size} onChange={event => adjust({ size: Number(event.target.value) })}>
                  <option value={18}>Small</option><option value={20}>Default</option>
                  <option value={23}>Large</option><option value={26}>Extra large</option>
                </select>
              </label>
              <label>Typeface
                <select value={preferences.face} onChange={event => adjust({ face: event.target.value as Preferences["face"] })}>
                  <option value="serif">Serif</option><option value="sans">Sans serif</option>
                </select>
              </label>
              <label className={styles.checkPreference}><input type="checkbox" checked={preferences.still} onChange={event => adjust({ still: event.target.checked })} /> Reduce animations</label>
            </div>
          </details>
          <button type="button" ref={focusButton} onClick={() => setFocus((value) => !value)} aria-pressed={focus} aria-label={focus ? "Exit focus mode" : "Focus mode"}>
            {focus ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
            <span>{focus ? "Exit focus" : "Focus"}</span>
          </button>
        </div>
      </div>
      <label htmlFor={id} className="sr-only">Journal entry</label>
      <textarea
        id={id}
        ref={field}
        className={`${styles.field} ${preferences.face === "sans" ? styles.sans : ""}`}
        style={{ fontSize: `${preferences.size / 16}rem` }}
        value={view.content}
        maxLength={MAX_DRAFT_LENGTH}
        onChange={event => cloudDraft.edit(event.target.value)}
        disabled={!view.ready}
        readOnly={filed || organizing || view.conflict}
        placeholder="Start anywhere…"
        aria-describedby={`${id}-hint`}
        rows={11}
      />
      {view.conflict && <div className={styles.feedback} role="alert">
        <p>Your text is still here. Choose which draft to continue with.</p>
        <button type="button" onClick={() => { cloudDraft.useCloud(); field.current?.focus(); }}>Load cloud draft</button>
        {(!view.cloud || view.cloud.status === "editing") && <button type="button" onClick={() => { cloudDraft.keepMine(); field.current?.focus(); }}>Keep my text</button>}
      </div>}
      {view.problem && !view.conflict && <div className={styles.feedback} role="alert">
        <p>{view.problem === "organize" ? "Your writing is in the cloud. August couldn’t organize the entry yet."
          : view.problem === "load" ? "We couldn’t open your cloud draft." : "Keep this tab open until your changes reach the cloud."}</p>
        <button type="button" onClick={cloudDraft.retry}>Try again</button>
      </div>}
      {view.offline && dirty && !view.problem && <p className={styles.feedback}>Keep this tab open. Autosave will resume when you reconnect.</p>}
      {view.earlier && !view.content && !filed && (
        view.earlier.length <= MAX_DRAFT_LENGTH ? <div className={styles.feedback}><button type="button" onClick={cloudDraft.recoverEarlier}>Recover earlier draft</button></div>
        : <details className={styles.feedback}><summary>Copy earlier draft</summary><p>This draft is too long for one entry. Copy it in smaller sections.</p><pre>{view.earlier}</pre></details>
      )}
      <footer className={styles.footer}>
        <p id={`${id}-hint`}>
          {receipt ? <span className={styles.receipt} key={receipt.noteId}>{receipt.moments} {receipt.moments === 1 ? "moment" : "moments"} saved{actions ? ` · ${actions}` : ""}</span>
            : view.content.length >= MAX_DRAFT_LENGTH ? "This entry reached its character limit. Step away to let August organize it."
            : "Autosaves as you write. August organizes it when you step away."}
        </p>
        {filed ? <button className={styles.newEntry} type="button" onClick={() => {
          creatingEntry.current = true;
          cloudDraft.newEntry();
        }} disabled={Boolean(view.busy)}><Plus size={16} aria-hidden="true" /> New entry</button> : <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>}
      </footer>
    </div>
  </section>;
}
