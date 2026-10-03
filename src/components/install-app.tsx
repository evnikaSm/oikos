"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeToDisplayMode(onChange: () => void) {
  const mode = window.matchMedia("(display-mode: standalone)");
  mode.addEventListener("change", onChange);
  return () => mode.removeEventListener("change", onChange);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstallApp() {
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, () => true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowHelp(current => !current);
      return;
    }
    setInstalling(true);
    setError("");
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
    } catch {
      setError("Nie udało się otworzyć instalacji. Skorzystaj z menu przeglądarki.");
      setShowHelp(true);
    } finally {
      // A browser installation prompt can only be used once, even if dismissed.
      setInstallPrompt(null);
      setInstalling(false);
    }
  }

  if (standalone || installed) return null;

  return (
    <aside className="install-app" aria-label="Instalacja Oikos">
      <div className="install-app-row">
        <div>
          <p className="font-semibold">Oikos na Twoim telefonie</p>
          <p className="muted">Twój dom, prosto z ekranu głównego.</p>
        </div>
        <button type="button" className="btn-secondary flex items-center gap-2" disabled={installing}
          onClick={() => void install()} aria-expanded={showHelp} aria-controls="install-help">
          <Download size={18} aria-hidden="true" />
          {installing ? "Instalowanie…" : "Zainstaluj Oikos"}
        </button>
      </div>
      <div id="install-help" hidden={!showHelp} className="install-help">
        {error && <p role="alert">{error}</p>}
        <p><strong>Android:</strong> otwórz Oikos w Chrome. W menu ⋮ wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”, a następnie „Zainstaluj”.</p>
        <p><strong>iPhone:</strong> w Safari wybierz Udostępnij → Do ekranu początkowego.</p>
        <p>Jeśli nie widzisz instalacji, otwórz stronę bezpośrednio w przeglądarce pod adresem HTTPS. Jeśli Oikos jest już zainstalowany, otwórz go z ikony na ekranie głównym.</p>
      </div>
    </aside>
  );
}
