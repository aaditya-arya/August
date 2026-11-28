"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useCloudDraft } from "@/lib/use-cloud-draft";
import { useAccount } from "./AuthBoundary";

const DraftContext = createContext<(ReturnType<typeof useCloudDraft> & {
  setEditorActive: (active: boolean) => void;
}) | null>(null);

function notifyFiled() {
  window.dispatchEvent(new Event("august-ledger-changed"));
}

export function CloudDraftProvider({ children }: { children: ReactNode }) {
  const { id } = useAccount();
  const [editorActive, setEditorActive] = useState(false);
  const draft = useCloudDraft(id, editorActive, notifyFiled);
  return <DraftContext.Provider value={{ ...draft, setEditorActive }}>{children}</DraftContext.Provider>;
}

export function useJournalDraft() {
  const draft = useContext(DraftContext);
  if (!draft) throw new Error("The journal draft requires a signed-in account.");
  return draft;
}
