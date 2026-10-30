export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "august-theme";
export const THEME_CHANGE_EVENT = "august-theme-change";

// Runs before first paint; keep this in sync with the browser theme store.
export const themeInitScript = `(function(){var t;try{t=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}var explicit=t==="light"||t==="dark";document.documentElement.dataset.theme=explicit?t:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.themePreference=explicit?"explicit":"system"})()`;
