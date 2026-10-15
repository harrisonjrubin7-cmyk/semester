"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/types";
import { signInWithMagicLink, signInWithPassword, signUpWithPassword } from "@/app/auth/sign-in/actions";
import { ActionMessage, Field, SubmitButton, fieldError, inputClass } from "@/components/ui/form-bits";

type Mode = "magic" | "password" | "signup";

export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("magic");
  const [magic, magicAction] = useActionState<ActionState, FormData>(signInWithMagicLink, null);
  const [pw, pwAction] = useActionState<ActionState, FormData>(signInWithPassword, null);
  const [signup, signupAction] = useActionState<ActionState, FormData>(signUpWithPassword, null);

  const state = mode === "magic" ? magic : mode === "password" ? pw : signup;
  const action = mode === "magic" ? magicAction : mode === "password" ? pwAction : signupAction;

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1 text-sm">
        {(
          [
            ["magic", "Magic link"],
            ["password", "Password"],
            ["signup", "Create account"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-2 py-1.5 font-medium ${mode === m ? "bg-surface shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form key={mode} action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" error={fieldError(state, "email")}>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} aria-describedby="email-error" />
        </Field>
        {mode !== "magic" && (
          <Field label="Password" name="password" error={fieldError(state, "password")} hint={mode === "signup" ? "At least 8 characters." : undefined}>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              className={inputClass}
            />
          </Field>
        )}
        <SubmitButton className="w-full" pendingLabel="Working…">
          {mode === "magic" ? "Email me a sign-in link" : mode === "password" ? "Sign in" : "Create account"}
        </SubmitButton>
        <ActionMessage state={state} />
      </form>
    </div>
  );
}
