"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

/** Registra o service worker (só em produção, para não atrapalhar o `next dev`). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const noopSubscribe = () => () => {};
/** Lê um valor só do navegador sem divergir do HTML do servidor (que usa `server`). */
function useBrowserValue<T>(read: () => T, server: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => server);
}

/**
 * Botão "Instalar app". Chrome/Android/desktop: usa o evento `beforeinstallprompt`.
 * iPhone/iPad (Safari não tem esse evento): mostra o passo a passo "Adicionar à Tela de Início".
 * Some quando o app já está instalado/aberto como app.
 */
export function InstallButton() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  // No servidor assume "já instalado" (botão escondido): evita piscar e diferença de hidratação.
  const standalone = useBrowserValue(
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    true,
  );
  const ios = useBrowserValue(
    () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    false,
  );

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvent(e as InstallEvent); };
    const onInstalled = () => { setJustInstalled(true); setEvent(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || justInstalled || (!event && !ios)) return null;
  return (
    <div className="relative">
      <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={async () => {
        if (event) {
          await event.prompt();
          const { outcome } = await event.userChoice;
          if (outcome === "accepted") setJustInstalled(true);
          setEvent(null);
        } else setHelp((v) => !v);
      }}>
        Instalar app
      </Button>
      {help && (
        <p role="status" className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-line bg-surface p-3 text-xs text-muted shadow-lg">
          No Safari, toque em <strong className="text-fg">Compartilhar</strong> e depois em <strong className="text-fg">Adicionar à Tela de Início</strong>.
        </p>
      )}
    </div>
  );
}
