import { RATES } from './spend';

/**
 * Which model a piece of work needs — platform §302, and the routing half of
 * §1249's "one gateway".
 *
 * ## What the app does today
 *
 * Every call goes through `ask` in `lib/claude.ts`, which is the gateway §1249
 * asks for. What it does not have is a router: `ask` is handed `s.model`, one
 * setting, by all seven callers — `converse.ts` and the six components that
 * ask directly — so the model is the same whether the work is a tool-using
 * conversation about a degree or turning three lines of notes into flashcards.
 *
 * `lib/assistant.ts` defaults that setting to `claude-opus-5`, and `RATES` in
 * `lib/spend.ts` prices Opus at 5/25 per million tokens against Sonnet's 2/10
 * and Haiku's 1/5. So out of the box every interaction in the app runs on the
 * most expensive model available, which is the sentence §302 ends with:
 * **do not call the most expensive model for every interaction.**
 *
 * ## Down, never up
 *
 * The rule here is the one thing that makes routing safe to apply without
 * asking anybody first: **it may only choose a model at or below the one the
 * person has chosen.**
 *
 * Somebody who has selected Haiku has made a decision about their own money —
 * the shared key is a metered student quota, and their own key is their own
 * bill — and a router that "upgraded" a hard question to Opus would spend
 * theirs on their behalf. So a chosen model is a ceiling, never a floor.
 *
 * In the other direction it is free: a class that does not need the ceiling
 * gets the cheapest model that can do it, and somebody who never touched the
 * setting stops paying Opus rates to make flashcards.
 *
 * This is why the function cannot make anything more expensive, and why the
 * tests below spend most of their effort proving exactly that.
 */

/** The eight classes §302 names. */
export type Work =
  | 'FAST_QA'
  | 'ACADEMIC_TUTOR'
  | 'DOCUMENT_ANALYSIS'
  | 'REASONING'
  | 'TOOL_ACTION'
  | 'DATA_ANALYSIS'
  | 'SEARCH'
  | 'SUMMARIZATION';

/**
 * The cheapest model each class is allowed to fall to.
 *
 * Read as "this work does not need anything better than X", not as "use X".
 * The ceiling still wins when it is lower.
 *
 * The three that keep the ceiling are the ones where being wrong is expensive
 * in something other than money. `REASONING` and `ACADEMIC_TUTOR` are the
 * explaining work `MODELS` describes Opus as best at; `TOOL_ACTION` is the
 * conversation that proposes writes into somebody's semester, where choosing
 * the wrong tool costs a student a wrong card to press rather than a slightly
 * duller sentence.
 */
const FLOOR: Record<Work, string> = {
  REASONING: 'claude-opus-5',
  ACADEMIC_TUTOR: 'claude-opus-5',
  TOOL_ACTION: 'claude-opus-5',
  DOCUMENT_ANALYSIS: 'claude-sonnet-5',
  DATA_ANALYSIS: 'claude-sonnet-5',
  SEARCH: 'claude-haiku-4-5',
  SUMMARIZATION: 'claude-haiku-4-5',
  FAST_QA: 'claude-haiku-4-5',
};

/**
 * What a model costs, for ordering only.
 *
 * Output rate rather than input, because output is five times input across
 * the whole table and is what a long answer actually spends.
 *
 * A model with no published rate — `claude-fable-5-1` is deliberately absent
 * from `RATES`, and `lib/spend.ts` explains why — sorts as **more expensive
 * than anything known**. That is the safe direction: an unpriced model is
 * never chosen as a cheaper alternative, and a person who has chosen one
 * keeps it, because their ceiling is whatever they picked.
 */
function cost(model: string): number {
  return RATES[model]?.output ?? Number.POSITIVE_INFINITY;
}

/**
 * The model to use for this work, given what the person has chosen.
 *
 * Returns `chosen` unchanged whenever the floor is not cheaper — including
 * for any model this file has never heard of, which is the case that must not
 * silently redirect somebody's request to a different provider's model.
 */
export function modelFor(work: Work, chosen: string): string {
  const floor = FLOOR[work];
  if (!floor || floor === chosen) return chosen;
  /*
   * Both must be priced, and the first draft of this got it wrong in a way
   * its own comment denied. `cost` returns `Infinity` for a model with no
   * published rate, so `cost(floor) < cost(chosen)` was *true* for every
   * unpriced choice — Fable, or any model from another provider — and routing
   * silently redirected it to Haiku. "Unpriced sorts as expensive" is the
   * right rule for never *picking* one; it is exactly the wrong rule for
   * deciding whether somebody else's choice may be replaced.
   *
   * So an unpriced ceiling is left alone. There is no basis for calling
   * anything cheaper than a number nobody published.
   */
  if (!(chosen in RATES)) return chosen;
  return cost(floor) < cost(chosen) ? floor : chosen;
}

/** Whether routing would change anything here, for a caller that wants to say so. */
export function routesDown(work: Work, chosen: string): boolean {
  return modelFor(work, chosen) !== chosen;
}

/**
 * The nine purposes the app already declares, mapped onto §302's classes.
 *
 * `ask` takes an `about` on every call — `rewriting`, `solving`, `slides` and
 * six others — and `lib/spendnames.test.ts` fails any caller that omits one.
 * So the app has labelled the purpose of every model call all along, and used
 * the label only to file the money: `claude.ts` reads it once, as
 * `from: options.about || UNNAMED`, and never again.
 *
 * ## Why every one of these keeps the ceiling
 *
 * The mechanism below can lower a model. Deciding *which* work is safe to
 * lower is a different question, and it is a question about output quality
 * that this file has no evidence for. Platform §1252 is explicit — no AI
 * capability ships without a test set — and §984 says not to assume a model
 * change improves a workflow.
 *
 * Routing `rewriting` to Sonnet would cut its output rate from 25 to 10.
 * It might also make every rewritten study guide slightly worse, and nothing
 * in this repository would notice: there is no benchmark for it yet, and a
 * quality regression that no test can see is exactly the kind this app's own
 * audits keep finding months later.
 *
 * So each label maps to a class that keeps the ceiling, and lowering one is a
 * one-line change somebody makes **with a benchmark in hand**. The mechanism
 * is the deliverable here; the downgrades are not, and pretending otherwise
 * would be shipping a guess as a saving.
 */
const WORK_BY_ABOUT: Record<string, Work> = {
  course: 'ACADEMIC_TUTOR',
  coursework: 'ACADEMIC_TUTOR',
  essay: 'ACADEMIC_TUTOR',
  solving: 'REASONING',
  analysis: 'REASONING',
  research: 'REASONING',
  rewriting: 'ACADEMIC_TUTOR',
  slides: 'ACADEMIC_TUTOR',
  diagram: 'ACADEMIC_TUTOR',
};

/**
 * The class for a declared purpose.
 *
 * An unrecognised label is `ACADEMIC_TUTOR`, which keeps the ceiling — a new
 * caller must not be quietly routed down by a router that has never heard of
 * what it is doing.
 */
export function workFor(about: string | undefined): Work {
  return (about && WORK_BY_ABOUT[about]) || 'ACADEMIC_TUTOR';
}
