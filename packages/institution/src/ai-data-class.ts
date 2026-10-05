/**
 * The data-class check at the AI boundary: what a request may carry to a model,
 * asked of the request itself before anything is sent.
 *
 * `routeAllowed` (`app/src/lib/integration/classification.ts`) has long said
 * where each of T0-T6 may go, and the integration pipeline asks it on every
 * record. Nothing on an AI path did (privacy finding C7): the controls there
 * were an activation gate, a kill switch, a monthly cap and tenant policy, and
 * none of them looks at what is in the request. This is the pure half of the
 * check. Each AI path declares the class of every field it can put on the wire
 * and hands the declarations here; the verdict is a refusal, with the names of
 * the fields and never their contents, or nothing.
 *
 * It lives in `packages/` because both AI paths need it and neither may import
 * the other's side: the institution gateway (`app/server/institution/`) cannot
 * reach into client source, and the shared-key Edge Function is bundled from
 * `supabase/functions/` alone and gets a generated copy
 * (`app/scripts/edge-integration.ts`). So this file imports nothing, and
 * `aiclass.test.ts` holds its vocabulary to the classification module's.
 *
 * Three rules, each the one the rest of the vocabulary already follows:
 *
 *  - **The ceiling is T2.** `PLATFORM_ROUTES` lets T3 reach `approved_ai`, but
 *    the toolkit gate (`lib/toolkit/classification.ts`) says an education record
 *    never goes to an AI service, and the processing register says the same of
 *    the shared key ("T2; T3+ must not be sent"). The ceiling is the stricter
 *    of the two, and `aiclass.test.ts` recomputes it from both so that it
 *    cannot drift from either. This is a technical ceiling, not a statement of
 *    what any provider's terms allow: that is counsel's question (P-12).
 *  - **A field nobody classified is T3.** The toolkit gate's own default: an
 *    unanswered question is not a permissive one. A field added to a request
 *    without a declared class is refused by name, so adding one is a red test
 *    and not a quiet new route.
 *  - **Names, not contents.** A verdict never carries a value from the request,
 *    so a log line or an audit row built from it cannot leak what it refused.
 *
 * What this does not do is read free text and guess its class. A model
 * request's prose (a question, a note, a pasted syllabus) is declared as what
 * the product says it is, T2, and the check does not look inside; the toolkit
 * gate is a lookup, not a judgement, for the same reason. What it can see, it
 * refuses: a field or tool declared above the ceiling, a class that is not one
 * of the seven, and a field with no class at all.
 */

export type DataClass = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

/** In order, least restricted first. Held equal to `classification.ts` by a test. */
export const AI_DATA_CLASSES: readonly DataClass[] = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

/** The highest class any AI request may carry. See the header for why T2. */
export const AI_DATA_CEILING: DataClass = 'T2';

/** What a field with no declared class, or a class that is not one of the seven, is treated as. */
export const UNCLASSIFIED: DataClass = 'T3';

export type FieldClaim = readonly [field: string, declared: string | undefined];

export type ClassVerdict =
  | { ok: true }
  | { ok: false; fields: string[]; highest: DataClass };

const rank = (c: DataClass): number => AI_DATA_CLASSES.indexOf(c);

const isClass = (v: unknown): v is DataClass => typeof v === 'string' && (AI_DATA_CLASSES as readonly string[]).includes(v);

/** The class a declaration counts as: itself if it is one of the seven, else T3. */
export const effectiveClass = (declared: string | undefined): DataClass => (isClass(declared) ? declared : UNCLASSIFIED);

/**
 * Whether every claimed field is at or under the ceiling. `fields` names the
 * ones that are not, in the order given; `highest` is the most restricted
 * class among them.
 */
export function aiClassVerdict(claims: readonly FieldClaim[], ceiling: DataClass = AI_DATA_CEILING): ClassVerdict {
  const over = claims.filter(([, declared]) => rank(effectiveClass(declared)) > rank(ceiling));
  if (over.length === 0) return { ok: true };
  const highest = over
    .map(([, declared]) => effectiveClass(declared))
    .reduce((a, b) => (rank(a) >= rank(b) ? a : b));
  return { ok: false, fields: over.map(([field]) => field), highest };
}
