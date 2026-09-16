"use client";

import { useState } from "react";
import {
  ArrowSquareOut,
  Check,
  Copy,
  DeviceMobile,
  Eye,
  EyeSlash,
  Heartbeat,
  PaperPlaneTilt,
} from "@phosphor-icons/react";

const METRICS = [
  "Steps",
  "Active Energy",
  "Exercise Minutes",
  "Walking + Running Distance",
  "Resting Heart Rate",
  "Sleep",
];

/**
 * Setting this up is the one genuinely fiddly thing in the app, so it is laid
 * out as three short moves with the exact values one tap from the clipboard,
 * rather than a paragraph the user has to translate into taps.
 */
export function AppleHealthSetup({ endpoint, token }: { endpoint: string; token: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-[22px] bg-[var(--surface-2)] p-4 text-left transition-transform active:scale-[0.99]"
        aria-expanded={open}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--tint-move)] text-[var(--tint-move-ink)]">
          <Heartbeat weight="fill" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">Connect Apple Health</span>
          <span className="block text-[13px] text-[var(--ink-3)]">
            Your steps, workouts and sleep, synced nightly
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-bold text-[var(--brand)]">
          {open ? "Hide" : "Set up"}
        </span>
      </button>

      {open && (
        <div className="fade mt-3 flex flex-col gap-3">
          <p className="px-1 text-[13px] leading-relaxed text-[var(--ink-2)]">
            Apple does not let a server read Health directly, so your phone sends the numbers
            instead. Three moves, about five minutes, and then it runs itself every night.
          </p>

          <Step
            n={1}
            icon={<DeviceMobile weight="fill" />}
            title="Make a new shortcut"
            body={
              <>
                Open the Shortcuts app and tap <Kbd>+</Kbd>. Give it a name like{" "}
                <Kbd>Sync health</Kbd>.
                <a
                  href="https://apps.apple.com/app/shortcuts/id915249334"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--brand)]"
                >
                  Get Shortcuts
                  <ArrowSquareOut weight="bold" className="size-3.5" />
                </a>
              </>
            }
          />

          <Step
            n={2}
            icon={<Heartbeat weight="fill" />}
            title="Grab today's numbers"
            body={
              <>
                Add a <Kbd>Health Quantity</Kbd> action for each of these. Set the range to{" "}
                <Kbd>Today</Kbd>, calculate the <Kbd>Sum</Kbd>, and save each one to a variable.
                <span className="mt-2.5 flex flex-wrap gap-1.5">
                  {METRICS.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ink-2)]"
                    >
                      {m}
                    </span>
                  ))}
                </span>
                <span className="mt-2 block text-[12px] text-[var(--ink-3)]">
                  Only add the ones you care about. Anything you skip is simply left blank.
                </span>
              </>
            }
          />

          <Step
            n={3}
            icon={<PaperPlaneTilt weight="fill" />}
            title="Send them to Cut"
            body={
              <>
                Add <Kbd>Get Contents of URL</Kbd>, switch the method to <Kbd>POST</Kbd>, then
                paste these in.
                <span className="mt-3 flex flex-col gap-2.5">
                  <CopyRow label="URL" value={endpoint} />
                  <CopyRow label="Header" value={`Authorization: Bearer ${token}`} secret />
                  <CopyRow
                    label="JSON body keys"
                    value="steps, activeEnergy, exerciseMinutes, distanceKm, restingHR, sleepMinutes"
                  />
                </span>
                <span className="mt-3 block text-[12px] leading-relaxed text-[var(--ink-3)]">
                  Set the body type to JSON and point each key at its matching variable. Finally,
                  open the Automation tab, add a Time of Day trigger around 11:30 pm, pick this
                  shortcut and turn on Run Immediately.
                </span>
              </>
            }
          />
        </div>
      )}
    </div>
  );
}

function Step({
  n, icon, title, body,
}: { n: number; icon: React.ReactNode; title: string; body: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[13px] font-bold text-[var(--surface)]">
          {n}
        </span>
        <span className="text-[var(--ink-3)] [&>svg]:size-[18px]">{icon}</span>
        <h3 className="text-[15px] font-bold">{title}</h3>
      </div>
      <div className="mt-3 pl-11 text-[13px] leading-relaxed text-[var(--ink-2)]">{body}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[12px] font-semibold text-[var(--ink)]">
      {children}
    </code>
  );
}

function CopyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);

  return (
    <span className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-[12px] text-[var(--ink)]">
          {shown ? value : value.replace(/Bearer .+/, "Bearer ••••••••••••••••")}
        </code>
        {secret && (
          <button
            onClick={() => setShown((v) => !v)}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--ink-2)] transition-transform active:scale-90"
            aria-label={shown ? "Hide" : "Reveal"}
          >
            {shown ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--surface)] transition-transform active:scale-90"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check weight="bold" className="size-4" /> : <Copy weight="bold" className="size-4" />}
        </button>
      </span>
    </span>
  );
}
