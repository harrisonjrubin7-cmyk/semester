/**
 * The evaluation-data lint: `EV-05` of docs/ai-governance/06-evaluation-framework.md.
 *
 * Evaluation data is synthetic or expressly approved, and no real student,
 * staff or institutional record may be in any suite. That rule is easy to say
 * and easy to break by accident: a case written from a real email thread keeps
 * the address, and nobody reads fifteen thousand characters of prompt looking
 * for one. This is the check that reads them.
 *
 * It does not write a second detector. `community/pii.ts` already finds
 * emails, phone numbers, coordinates, street addresses and a tenant's student
 * id shape, versioned and explainable, and this runs it over everything a case
 * carries, with the allowances a synthetic set legitimately needs and the two
 * things that detector does not look for:
 *
 * - **Reserved addresses are synthetic.** `example.com`, `.org`, `.net`,
 *   `.edu`, and the `.test` and `.invalid` top levels cannot reach a person;
 *   telephone numbers `555-0100` to `555-0199` are the reserved fiction range.
 * - **A Social Security shape, and a card number that passes the Luhn check.**
 *   A sixteen-digit run that fails the check is a case number, not a card, so
 *   it is not flagged: a lint that cries wolf gets switched off.
 *
 * Only high-confidence kinds block. A room number or "Tuesday at 3pm" is
 * course content in a syllabus case, and the detector already rates those
 * medium for that reason.
 *
 * A lint that has never failed is not known to work, so its test plants each
 * kind in a real case and in every field of one, and shows the reserved forms
 * pass.
 */

import { detectPii, type PiiKind, type PiiOptions } from '../../community/pii';
import type { EvalCase } from './model-quality';

export type LintKind = PiiKind | 'ssn' | 'card';

export interface LintFinding {
  kind: LintKind;
  text: string;
}

const RESERVED_EMAIL_DOMAIN = /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net|edu)|[a-z0-9-]+\.(?:test|invalid|example|localhost))$/i;
const RESERVED_PHONE = /555[\s.-]?01\d\d$/;
const SSN = /(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])/g;
const CARD = /(?<![\d-])(?:\d[ -]?){13,19}(?![\d-])/g;

/** The Luhn check: what separates a card number from any other long run of digits. */
export function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export function lintText(text: string, options: PiiOptions = {}): LintFinding[] {
  const out: LintFinding[] = [];
  for (const f of detectPii(text, options)) {
    if (f.confidence !== 'high') continue;
    const found = text.slice(f.start, f.end);
    if (f.kind === 'email' && RESERVED_EMAIL_DOMAIN.test(found)) continue;
    if (f.kind === 'phone' && RESERVED_PHONE.test(found)) continue;
    out.push({ kind: f.kind, text: found });
  }
  for (const m of text.matchAll(SSN)) out.push({ kind: 'ssn', text: m[0] });
  for (const m of text.matchAll(CARD)) {
    const digits = m[0].replace(/[^\d]/g, '');
    if (luhn(digits)) out.push({ kind: 'card', text: m[0] });
  }
  return out;
}

/** Everything a case carries: the prompt as built, the tools it offers, the good reply, and every reply a check is shown with. */
export function caseText(c: EvalCase): string {
  const built = c.build();
  const checks = c.checks.flatMap((k) => [...(Array.isArray(k.refuses) ? k.refuses : [k.refuses]), ...(k.accepts ?? [])]);
  return [built.system, ...built.messages.map((m) => m.content), JSON.stringify(built.tools ?? []), c.good, ...checks].join('\n');
}

export const lintCase = (c: EvalCase, options: PiiOptions = {}): LintFinding[] => lintText(caseText(c), options);
