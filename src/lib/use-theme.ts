"use client";

import { useSyncExternalStore } from "react";
import { THEME_CHANGE_EVENT, THEME_STORAGE_KEY, type Theme } from "./theme";

function getSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function applyTheme(theme: Theme, explicit: boolean) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = explicit ? "explicit" : "system";
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function setTheme(theme: Theme) {
  applyTheme(theme, true);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current tab still works when browser storage is unavailable.
  }
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const followSystem = () => {
    if (document.documentElement.dataset.themePreference !== "explicit") {
      applyTheme(media.matches ? "dark" : "light", false);
    }
  };
  const syncStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    const value = event.key === null ? null : event.newValue;
    const explicit = value === "dark" || value === "light";
    applyTheme(explicit ? value : media.matches ? "dark" : "light", explicit);
  };

  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", syncStorage);
  media.addEventListener("change", followSystem);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", syncStorage);
    media.removeEventListener("change", followSystem);
  };
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
