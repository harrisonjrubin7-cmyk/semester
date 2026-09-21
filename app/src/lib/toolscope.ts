import type { ToolSpec } from './claude';
import type { Mode } from './mode';

/**
 * Which tools each assistant mode is allowed to propose.
 *
 * Platform §309 of `docs/PLATFORM_REQUIREMENTS.md` — least privilege for AI
 * surfaces. An academic tutor gets read access and may create practice; it
 * does not get payment, account administration or course drop **because
 * nobody gave it those**, rather than because it was asked not to use them.
 *
 * ## What this repository actually had
 *
 * `ai/converse.ts` already narrows by mode, and the comment there states the
 * intent plainly: app mode "answers from the guidebook and nothing else —
 * that narrowness is what stops it inventing a feature". So `LOOKUPS`, which
 * read the student's records, are withheld from it.
 *
 * The writes were not. All sixteen of `TOOLS` reached every mode, so a
 * question about where a setting lives — *"how do I change my grade scale"* —
 * sat in front of a model holding `make_document`, `add_application`,
 * `mark_attendance` and `set_day_budget`. The mode designed to be the narrow
 * one had the widest write surface in the app.
 *
 * **This is hardening, not a patched exploit, and it is worth being exact
 * about which.** Nothing executed on its own: `readProposal` turns every
 * write into a card the student presses, so the failure available here was a
 * question about a setting answered with an offer to create a spreadsheet,
 * not a silent write. Least privilege is the point regardless — the card
 * should not be offerable, and the next tool added should not quietly widen
 * three modes at once.
 */

/**
 * Tools that operate the app itself rather than the student's semester.
 *
 * `open_screen` takes somebody to the setting they asked about, which is the
 * whole job of app mode. `set_look` changes an appearance setting, which is
 * the one category of write that *is* the app's own furniture — the thing app
 * mode exists to answer questions about.
 *
 * Every other tool writes into a semester: tasks, deadlines, attendance,
 * notes, sources, applications, documents, sheets, equations, timers,
 * budgets. None of them is an answer to "where is this button".
 */
export const APP_TOOLS = ['open_screen', 'set_look'];

/**
 * What each mode may propose.
 *
 * `grounded` is the mode reading the student's own records to answer a
 * question about them, and it is the one that legitimately changes a
 * semester — so it keeps everything.
 *
 * `general` explains a concept. It is deliberately *not* restricted here, and
 * that is a decision rather than an omission: `lib/mode.ts` routes anything
 * matching `MINE` to `grounded`, so a request like "add a task to read
 * chapter three" lands in general only when it does not mention the student
 * at all. Narrowing general would take away the writes from phrasings the
 * router has not been tuned for, which trades a real capability for a
 * theoretical tightening. Revisit it with evidence from real questions.
 */
export function toolsFor(mode: Mode, all: ToolSpec[]): ToolSpec[] {
  if (mode !== 'app') return all;
  return all.filter((t) => APP_TOOLS.includes(t.name));
}
