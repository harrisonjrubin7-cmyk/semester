/**
 * Types for `restyle.mjs`.
 *
 * The module itself stays plain JavaScript because every script in `pipeline/`
 * does: `make-script.mjs` says so in its own comments — reading a guide as
 * text rather than importing it "keeps this dependency-free — no ts-node, no
 * build step". That property is worth more than inline types.
 *
 * But `app/src/lib/restyle.test.ts` is TypeScript and `tsc -b` covers it, so
 * without this the guard either fails the typecheck or gets silenced with a
 * suppression that hides real mistakes in the test as well. Declared here, the
 * test is type-checked against the shape it actually calls.
 */

export interface ScriptLine {
  chapter?: string;
  v: string;
  t: string;
  pause?: number;
}

export interface Script {
  id: string;
  course?: string;
  title: string;
  voices: Record<string, string>;
  lines: ScriptLine[];
}

export interface Style {
  label: string;
  blurb: string;
  rules: string[];
}

/** Every quantity a passage states, normalised, counted. */
export function quantities(text: unknown): Map<string, number>;

/** Chapter titles, in running order. */
export function chapters(script: { lines?: ScriptLine[] }): string[];

/** What is wrong with a restyled script. Empty means it may be written. */
export function check(original: Script, restyled: unknown): string[];

/** The id a restyled episode ships under. */
export function restyledId(original: { id: string }, style: string): string;

/** The instruction given to the rewrite pass. */
export function prompt(original: Script, style: Style): string;

/** The script inside a model's reply. Throws if there isn't one. */
export function parseReply(text: unknown): { lines: ScriptLine[] };

/** The file a passing restyle becomes. */
export function restyledScript(
  original: Script,
  styleId: string,
  style: Style,
  lines: ScriptLine[],
): Script;
