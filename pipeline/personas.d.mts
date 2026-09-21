/**
 * Types for `personas.mjs`.
 *
 * Same arrangement as `restyle.d.mts` and `align.d.mts`: the module stays
 * plain JavaScript because every script in `pipeline/` does, and
 * `app/src/lib/personas.test.ts` is TypeScript that `tsc -b` covers.
 */

export interface Persona {
  /** One ordinary given name. Not a likeness — see `check`. */
  name: string;
  /** `host` or `expert`, the two roles the podcast scripts already use. */
  role: string;
  /** What this one is for, in four words. */
  label: string;
  build: string;
  age: string;
  hair: string;
  wardrobe: string;
  carry: string;
  demeanour: string;
  /** An accent id from `app/src/lib/look.ts`, so the series shares the palette. */
  accent: string;
  /** Lighting and posture. Free text, and the only field that is. */
  note?: string;
}

export interface Panel {
  view: string;
  expression: string;
}

export interface SheetJob {
  slot: string;
  prompt: string;
  seconds: number;
  provider: string;
  model: string;
}

export const AXES: Record<string, string[]>;
export const ROLES: string[];
export const PERSONAS: Record<string, Persona>;
export const PERSONA_IDS: string[];
export const VIEWS: string[];
export const EXPRESSIONS: string[];

export function panels(): Panel[];
export function describe(persona: Persona): string;
export function sheetPrompt(persona: Persona): string;
export function check(persona: Persona): string[];
export function sheetJob(
  id: string,
  persona: Persona,
  provider: string,
  model: string,
): SheetJob;
