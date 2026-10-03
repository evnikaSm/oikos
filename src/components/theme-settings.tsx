"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { parseTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const CHANGE_EVENT = "oikos-theme-change";
let temporaryPreference: ThemePreference | null = null;

function savePreference(value: ThemePreference): boolean {
  temporaryPreference = value;
  let saved = false;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
    temporaryPreference = null;
    saved = true;
  } catch { /* Keep this page usable when storage is blocked. */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return saved;
}

function getPreference(): ThemePreference {
  if (temporaryPreference) return temporaryPreference;
  try { return parseTheme(localStorage.getItem(THEME_STORAGE_KEY)); }
  catch { return "system"; }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      temporaryPreference = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function subscribeSystem(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function usePreference() {
  return useSyncExternalStore(subscribe, getPreference, () => "system" as const);
}

export function ThemeManager() {
  const preference = usePreference();
  const systemDark = useSyncExternalStore(subscribeSystem,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => false);

  useEffect(() => {
    // Read browser values here as well to avoid applying the server fallback during hydration.
    const selected = getPreference();
    const dark = selected === "dark" || (selected === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#191c1b" : "#f1e3d3");
  }, [preference, systemDark]);

  return null;
}

const options = [
  { value: "light", label: "Jasny", icon: Sun },
  { value: "dark", label: "Ciemny", icon: Moon },
  { value: "system", label: "Systemowy", icon: Monitor },
] as const;

export function ThemeSettings() {
  const preference = usePreference();
  const [message, setMessage] = useState("");

  function selectTheme(value: ThemePreference) {
    setMessage(savePreference(value)
      ? "Zapisano wygląd na tym urządzeniu."
      : "Wygląd zmieniony. Przeglądarka blokuje zapis — ustawienie działa tylko do zamknięcia strony.");
  }

  return (
    <section className="panel appearance-panel" aria-labelledby="appearance-title">
      <p className="eyebrow">Po Twojemu</p>
      <h3 id="appearance-title" className="text-xl font-semibold mt-1">Wygląd aplikacji</h3>
      <p id="appearance-description" className="muted mt-2">Wybierz swój klimat. Zapamiętamy go na tym urządzeniu.</p>
      <fieldset className="theme-options" aria-describedby="appearance-description">
        <legend className="sr-only">Motyw kolorystyczny</legend>
        {options.map(({ value, label, icon: Icon }) => (
          <label key={value} className="theme-option">
            <input type="radio" name="oikos-theme" value={value} checked={preference === value}
              onChange={() => selectTheme(value)} />
            <span className={`theme-option-card theme-preview-${value}`}>
              <span className="theme-preview" aria-hidden="true">
                <span className="theme-preview-sidebar" />
                <span className="theme-preview-content"><span /><span /><span /></span>
              </span>
              <span className="theme-option-label"><Icon size={17} aria-hidden="true" />{label}
                <Check className="theme-check" size={16} aria-hidden="true" /></span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="muted text-xs mt-3">Systemowy dopasowuje motyw do ustawień telefonu.</p>
      <p role="status" className="theme-status">{message}</p>
    </section>
  );
}
