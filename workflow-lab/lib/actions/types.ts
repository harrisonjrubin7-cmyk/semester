import type { FieldErrors } from "@/lib/validation/common";

export type ActionState =
  | null
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string; errors?: FieldErrors };

export const NOT_CONFIGURED: ActionState = {
  ok: false,
  message: "Prototype mode: Supabase is not configured, so nothing can be saved. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
};
export const SIGN_IN_REQUIRED: ActionState = { ok: false, message: "Sign in to do that. This action is protected." };

/** Translate Postgres / PostgREST errors into something a grader can act on, without leaking internals. */
export function describeDbError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || /row-level security/i.test(error.message))
    return "You do not have permission to do that. Viewers are read-only, and you can only change data in your own suites and organizations.";
  if (error.code === "23505") return "That record already exists (same task, platform and attempt). Use a new attempt number or edit the existing run.";
  if (error.code === "23514" && /Persistence grade/i.test(error.message)) return error.message;
  if (error.code === "23514") return "A database check rejected that value. Review the persistence and score fields.";
  if (error.code === "23503") return "A referenced record does not exist (or you cannot see it).";
  return "The database rejected the request.";
}
