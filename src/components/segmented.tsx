"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/** Pill segmented control, the standard way to switch a range on a chart. */
export function Segmented({
  param,
  options,
  defaultValue,
}: {
  param: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const current = params.get(param) ?? defaultValue;

  return (
    <div className="inline-flex rounded-full bg-[var(--surface-2)] p-1" role="tablist">
      {options.map((o) => {
        const on = o.value === current;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => {
              const next = new URLSearchParams(params.toString());
              if (o.value === defaultValue) next.delete(param);
              else next.set(param, o.value);
              const qs = next.toString();
              router.push(qs ? `${path}?${qs}` : path, { scroll: false });
            }}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all duration-200 ${
              on ? "bg-[var(--ink)] text-[var(--surface)] shadow-sm" : "text-[var(--ink-3)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
