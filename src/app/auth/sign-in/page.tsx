import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Mark } from "@/components/mark";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="card card-pad">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Mark className="size-10" />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Pick up where you left off.</p>
        </div>
      </div>
      <AuthForm mode="sign-in" />
    </div>
  );
}
