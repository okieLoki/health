"use client";

import { useEffect, useState } from "react";
import { DeviceMobile, DownloadSimple, Share } from "@phosphor-icons/react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** Registers the service worker. Mounted once, renders nothing. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unregistered worker only costs offline support, never the app.
      });
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

/**
 * Install affordance. Chrome and Android fire beforeinstallprompt, which gives
 * a real one-tap install. iOS fires nothing and has no API, so Safari users get
 * the Share sheet instructions instead.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const ua = navigator.userAgent;
    // iPadOS reports as Macintosh, so test for touch as well.
    const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (isIos && /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)) setIosHint(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  if (prompt) {
    return (
      <button
        onClick={async () => {
          await prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === "accepted") setInstalled(true);
          setPrompt(null);
        }}
        className="mb-4 flex w-full items-center gap-3.5 rounded-[26px] border border-[var(--hairline)] bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-sm)] transition-transform active:scale-[0.99]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--tint-body)] text-[var(--tint-body-ink)]">
          <DownloadSimple weight="fill" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Install Cut</span>
          <span className="block text-[13px] text-[var(--ink-3)]">
            Add it to your home screen and it opens like an app
          </span>
        </span>
      </button>
    );
  }

  if (iosHint) {
    return (
      <div className="mb-4 flex items-start gap-3.5 rounded-[26px] border border-[var(--hairline)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--tint-body)] text-[var(--tint-body-ink)]">
          <DeviceMobile weight="fill" className="size-5" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-[var(--ink-2)]">
          <span className="block text-[15px] font-bold text-[var(--ink)]">Add to Home Screen</span>
          Tap{" "}
          <Share weight="bold" className="inline size-4 align-[-3px] text-[var(--ink)]" /> in
          Safari, then choose Add to Home Screen. Cut then opens full screen, without the
          browser bars.
        </p>
      </div>
    );
  }

  return null;
}
