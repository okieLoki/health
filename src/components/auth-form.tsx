"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === "sign-up";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name: name || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "That didn't work. Check your details and try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the auth service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {isSignUp && (
        <Field label="Name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </Field>
      )}
      <Field label="Email">
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </Field>
      <Field label="Password">
        <input
          className="input"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isSignUp ? "At least 8 characters" : "••••••••"}
          autoComplete={isSignUp ? "new-password" : "current-password"}
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg border border-[var(--critical)]/40 bg-[var(--critical)]/10 px-3 py-2 text-sm text-[var(--critical)]">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary mt-1 justify-center">
        {busy ? <Loader2 className="size-4 animate-spin" /> : isSignUp ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
        {isSignUp ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-[var(--text-muted)]">
        {isSignUp ? "Already have an account? " : "No account yet? "}
        <Link href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"} className="text-[var(--accent)] hover:underline">
          {isSignUp ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}
