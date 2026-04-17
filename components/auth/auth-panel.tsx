"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

type Mode = "login" | "signup";
type AuthContext = "student" | "mentor";

export function AuthPanel({
  context = "student"
}: {
  context?: AuthContext;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mentorContext = context === "mentor";
  const nextPath = searchParams.get("next") ?? (mentorContext ? "/mentor" : "/setup");
  const [mode, setMode] = useState<Mode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mentorAccessCode, setMentorAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords must match before the account can be created.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(mode === "login" ? "/auth/login" : "/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName || null,
          account_type: mentorContext ? "mentor" : "student",
          mentor_access_code: mentorContext ? mentorAccessCode || null : null,
          required_role: mentorContext && mode === "login" ? "mentor" : "student"
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Authentication failed.");
      }

      router.push(nextPath);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Authentication failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-xl rounded-[34px] p-7">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">
          {mentorContext ? "Mentor access" : "Secure access"}
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-white">
          {mentorContext ? "Mentor sign-in" : "Sign in"}
        </h1>
        <p className="text-sm text-white/62">
          {mentorContext
            ? "Review flagged sessions and use live takeover when needed."
            : "Passwords are hashed; your sessions and scores stay tied to this account."}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/5 p-1">
        {(["login", "signup"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mist/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1522] ${
              mode === value
                ? "border border-sky-200/18 bg-[linear-gradient(135deg,rgba(103,176,221,0.2)_0%,rgba(39,83,122,0.72)_100%)] text-white shadow-[0_10px_28px_rgba(8,15,28,0.28)]"
                : "text-white/70 hover:bg-white/6 hover:text-white"
            }`}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
          >
            {value === "login"
              ? "Sign in"
              : mentorContext
                ? "Create mentor account"
                : "Create account"}
          </button>
        ))}
      </div>

      <form className="mt-6 grid gap-4" onSubmit={submit}>
        {mode === "signup" ? (
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Display name</span>
            <input
              className="field"
              placeholder={mentorContext ? "Mentor name" : "Your name"}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
        ) : null}

        <label className="grid gap-2">
          <span className="text-sm text-white/74">Email</span>
          <input
            className="field"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm text-white/74">Password</span>
          <input
            className="field"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {mode === "signup" ? (
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Confirm password</span>
            <input
              className="field"
              type="password"
              placeholder="Repeat the password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
        ) : null}

        {mentorContext && mode === "signup" ? (
          <label className="grid gap-2">
            <span className="text-sm text-white/74">Mentor access code</span>
            <input
              className="field"
              type="password"
              placeholder="Required unless your email is already mentor-approved"
              value={mentorAccessCode}
              onChange={(event) => setMentorAccessCode(event.target.value)}
            />
          </label>
        ) : null}

        {error ? <Toast title={error} tone="error" /> : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-sm leading-6 text-white/54">
            {mentorContext
              ? mode === "login"
                ? "Only accounts with mentor or admin access can sign in here. Approved emails and mentor access codes are both supported."
                : "Create a mentor account with an approved mentor email or the shared mentor access code."
              : mode === "login"
                ? "Use the same account to keep your history, resume context, and skill signals tied to you."
                : "Create an account to keep your history, resume context, and skill signals tied to you."}
          </p>
          <Button type="submit" disabled={submitting} className="self-start sm:self-auto">
            {submitting
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign in"
                : mentorContext
                  ? "Create mentor account"
                  : "Create account"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
