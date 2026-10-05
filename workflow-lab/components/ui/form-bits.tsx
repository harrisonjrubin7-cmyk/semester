"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import type { ActionState } from "@/lib/actions/types";

export function SubmitButton({ children, pendingLabel = "Saving…", className = "" }: { children: ReactNode; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
      {state.message}
    </p>
  );
}

export function fieldError(state: ActionState, name: string): string | undefined {
  return state && !state.ok ? state.errors?.[name]?.[0] : undefined;
}

export const inputClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus:border-accent disabled:opacity-60";

export function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p id={`${name}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${name}-error`} role="alert" className="text-xs text-bad">{error}</p>}
    </div>
  );
}
