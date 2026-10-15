import { z } from "zod";

export const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** An http(s) URL. Rejects javascript:, data:, file: and anything else that is not a web link. */
export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an http(s) URL");

export const optionalHttpUrl = z.preprocess(blankToUndefined, httpUrl.optional());
export const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

/** Boolean from a checkbox / select: "on", "true", "yes", "1" are true; "false", "no", "0" are false; blank is undefined. */
export const tristate = z.preprocess((v) => {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (s === "") return undefined;
  if (["on", "true", "yes", "1"].includes(s)) return true;
  if (["off", "false", "no", "0"].includes(s)) return false;
  return v;
}, z.boolean().optional());

export function formToObject(fd: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [k, v] of fd.entries()) if (!k.startsWith("$ACTION")) out[k] = v;
  return out;
}

export type FieldErrors = Record<string, string[]>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
