"use client";

import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/auth/sign-in");
        router.refresh();
      }}
      className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--ink-2)] transition-all hover:bg-[var(--surface-2)] active:scale-90"
      aria-label="Sign out"
    >
      <SignOut weight="bold" className="size-[18px]" />
    </button>
  );
}
