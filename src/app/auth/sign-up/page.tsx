import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Mark } from "@/components/mark";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="card card-pad">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Mark className="size-10" />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold">Start tracking</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Food, weight, training, fasting and water in one place.
          </p>
        </div>
      </div>
      <AuthForm mode="sign-up" />
    </div>
  );
}
