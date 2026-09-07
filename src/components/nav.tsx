"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Barbell,
  ForkKnife,
  House,
  PersonSimple,
  Sparkle,
  User,
} from "@phosphor-icons/react";

const TABS = [
  { href: "/", label: "Today", icon: House },
  { href: "/chat", label: "Ask", icon: Sparkle },
  { href: "/food", label: "Food", icon: ForkKnife },
  { href: "/train", label: "Train", icon: Barbell },
  { href: "/body", label: "Body", icon: PersonSimple },
];

const DESKTOP_EXTRA = [{ href: "/you", label: "You", icon: User }];

const active = (path: string, href: string) =>
  href === "/" ? path === "/" : path.startsWith(href);

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1" aria-label="Sections">
      {[...TABS, ...DESKTOP_EXTRA].map(({ href, label, icon: Icon }) => {
        const on = active(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] font-semibold transition-all duration-200 ${
              on
                ? "bg-[var(--brand-soft)] text-[var(--brand)]"
                : "text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            }`}
          >
            <Icon weight={on ? "fill" : "regular"} className="size-[21px] shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--hairline)] bg-[var(--surface)]/92 backdrop-blur-2xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Sections"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const on = active(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className="group flex flex-col items-center gap-1 pb-2.5 pt-3"
            >
              <Icon
                weight={on ? "fill" : "regular"}
                className={`size-[23px] transition-all duration-200 ${
                  on ? "text-[var(--brand)]" : "text-[var(--ink-3)] group-active:scale-90"
                }`}
              />
              <span
                className={`text-[10px] font-bold tracking-tight transition-colors ${
                  on ? "text-[var(--brand)]" : "text-[var(--ink-3)]"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
