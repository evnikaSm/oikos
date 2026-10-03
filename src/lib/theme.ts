export const THEME_STORAGE_KEY = "oikos-theme-v1";
export type ThemePreference = "light" | "dark" | "system";

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Runs before the page is painted, including when reopening the installed app.
export const themeInitScript = `(() => {
  let preference = "system";
  try { preference = localStorage.getItem("${THEME_STORAGE_KEY}") || "system"; } catch {}
  const dark = preference === "dark" || (preference !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();`;
