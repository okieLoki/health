import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getProfile } from "@/lib/auth";
import { SideNav, TabBar } from "@/components/nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";
import { Mark } from "@/components/mark";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/sign-in");

  // Without height, birth date and sex there is no calorie target to show,
  // so send a new account straight through set-up rather than into an empty app.
  const profile = await getProfile(user.id);
  if (!profile.heightCm || !profile.birthDate || !profile.sex) redirect("/onboarding");

  const initial = (user.name ?? user.email).charAt(0).toUpperCase();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[252px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--hairline)] bg-[var(--surface)] px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Mark className="size-8 text-[var(--brand)]" />
          <span className="text-[21px] font-extrabold tracking-[-0.05em]">Cut</span>
        </Link>
        <SideNav />
        <div className="mt-auto flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-[14px] font-bold text-[var(--brand-ink)]">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold">{user.name ?? "You"}</p>
            <p className="truncate text-[11px] text-[var(--ink-3)]">{user.email}</p>
          </div>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--hairline)] bg-[var(--canvas)]/75 px-5 py-3 backdrop-blur-2xl lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <Mark className="size-7 text-[var(--brand)]" />
            <span className="text-[18px] font-extrabold tracking-[-0.05em]">Cut</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              href="/you"
              aria-label="Your profile"
              className="grid size-9 place-items-center rounded-full bg-[var(--brand)] text-[13px] font-bold text-[var(--brand-ink)] transition-transform active:scale-90"
            >
              {initial}
            </Link>
          </div>
        </header>

        {children}
      </div>

      <TabBar />
    </div>
  );
}
