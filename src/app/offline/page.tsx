import type { Metadata } from "next";
import { Mark } from "@/components/mark";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-8 text-center">
      <Mark className="size-12 text-[var(--ink-3)]" />
      <h1 className="mt-6 text-[22px] font-extrabold tracking-[-0.03em]">You are offline</h1>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-[var(--ink-2)]">
        Cut needs a connection to work out what you ate. Everything you logged is safe, it lives
        on the server.
      </p>
      <a href="/" className="btn-primary mt-7">
        Try again
      </a>
    </main>
  );
}
