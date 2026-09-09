"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react";

/**
 * A scrolling strip of recent days instead of a native date input. Thumb
 * friendly, shows context either side, and snaps to the selected day.
 */
export function DayPicker({
  selected,
  today,
  basePath,
  days = 30,
}: {
  selected: string;
  today: string;
  basePath: string;
  days?: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected]);

  const [ty, tm, td] = today.split("-").map(Number);
  const items = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(ty, tm - 1, td - (days - 1 - i)));
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      dayNum: d.getUTCDate(),
      isToday: key === today,
    };
  });

  function go(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === today) next.delete("day");
    else next.set("day", key);
    const qs = next.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0"
      >
        {items.map((d) => {
          const on = d.key === selected;
          return (
            <button
              key={d.key}
              ref={on ? activeRef : undefined}
              onClick={() => go(d.key)}
              aria-current={on ? "date" : undefined}
              className={`flex w-[52px] shrink-0 flex-col items-center gap-1 rounded-2xl border py-2.5 transition-all duration-200 active:scale-95 ${
                on
                  ? "border-transparent bg-[var(--brand)] text-[var(--brand-ink)] shadow-[var(--shadow)]"
                  : "border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--hairline-strong)]"
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wide ${on ? "opacity-80" : "text-[var(--ink-3)]"}`}>
                {d.isToday ? "Today" : d.weekday}
              </span>
              <span className="stat text-[17px] leading-none">{d.dayNum}</span>
            </button>
          );
        })}
      </div>
      <span className="pointer-events-none absolute right-0 top-0 hidden h-full w-12 bg-gradient-to-l from-[var(--canvas)] to-transparent lg:block" />
      <span className="sr-only">
        <CalendarBlank /> Showing {selected}
      </span>
    </div>
  );
}
