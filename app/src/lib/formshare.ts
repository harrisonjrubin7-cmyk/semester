import { cloud, cloudConfigured } from './cloud';
import { checkedAnswers, markAnswers, newQuestion } from './creations';
import type { CreativeProject, FormData, FormResponse, Question } from './creations';

/**
 * A form somebody else can actually answer.
 *
 * `lib/creations.ts` has built a real form for a long time — nine question
 * types, branching conditions, marking, a CSV-safe export. What it had no
 * version of was the only thing a form is for: somebody else answering it.
 * `formResponse` was called from one place, the author's own builder, and the
 * answers sat in a device library on the author's machine. A form nobody but
 * its author can open is a questionnaire with one respondent.
 *
 * This is the other side. The author publishes; a link goes out; anybody
 * holding it answers without an account; the answers come back to the author
 * and to nobody else. `supabase/migrations/20260901001100_forms.sql` is the
 * half that enforces it and `supabase/forms.check.sql` is where that
 * enforcement is asserted rather than hoped.
 *
 * ## The answer key does not travel with the questions
 *
 * This is the decision everything here follows from.
 *
 * A question carries `answer` and `points`. Handing the questions to a
 * respondent's browser unchanged would hand it the marking scheme for a quiz
 * it is about to sit — and a score computed on the respondent's device is a
 * score the respondent chose, which is not a scoring system. So `asked()`
 * strips both before anything is uploaded, the key stays in the author's own
 * row where no view and no grant reaches it, and `collect()` marks the
 * answers on the author's device, which is the only place both halves exist
 * at once.
 *
 * That is also why `creations.ts` now has `checkedAnswers` and `markAnswers`
 * as separate functions: checking is what the respondent's browser does and
 * marking is what the author's does, and they had been one pass because until
 * now they always happened on the same machine.
 *
 * ## The link is the whole of the credential
 *
 * A respondent has no account and cannot be asked for one, so the id in the
 * link is what authenticates them, exactly as the token does for a published
 * calendar feed. It is a `gen_random_uuid()` — 122 bits — and anybody holding
 * it can answer. Anybody *not* holding it cannot, and nobody at all can read
 * what came back except the author.
 *
 * ## What this cannot know
 *
 * Whether a form has hit its cap. The count lives in a table a respondent may
 * write to and may not read, so the refusal is the first the answering device
 * hears of it. That is the right way round — a cap a client is trusted to
 * enforce is not a cap — and it is why `answer()` turns the database's
 * refusal into a sentence rather than treating it as an outage.
 */

/** The query parameter a published form arrives on. */
export const FORM_PARAM = 'form';

/** What a respondent is shown. No `marking`, no `owner`, by construction. */
export interface PublishedForm {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  closes: string | null;
}

/** A published id, or null. Anything else in the address bar is not one. */
export function askedForm(search: string): string | null {
  try {
    const id = new URLSearchParams(search).get(FORM_PARAM);
    return id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id
      : null;
  } catch {
    return null;
  }
}

/**
 * The questions with the marking taken out.
 *
 * Not a filter over fields but a rebuild from a blank question, so a field
 * added to `Question` later is absent from the upload until somebody decides
 * it should be there. The other way round — deleting the two known keys —
 * would publish every future field by default, and the failure would be
 * silent.
 *
 * `answer` and `points` are then set to nothing *explicitly* rather than left
 * to the blank question's defaults, which is not belt-and-braces: a new
 * question starts worth one mark, so relying on the default would have
 * published every question's weight. The weight is not the answer, and
 * publishing it still tells a respondent which questions carry the paper.
 */
export function asked(questions: Question[]): Question[] {
  return questions.map((q) => ({
    ...newQuestion(),
    answer: '',
    points: 0,
    id: q.id,
    title: q.title,
    type: q.type,
    required: q.required,
    options: [...q.options],
    condition: q.condition ? { ...q.condition } : null,
  }));
}

/** The marking, keyed by question, for the author's row alone. */
export function keyOf(questions: Question[]): Record<string, { answer: string; points: number }> {
  const key: Record<string, { answer: string; points: number }> = {};
  for (const q of questions) if (q.answer.trim()) key[q.id] = { answer: q.answer, points: q.points };
  return key;
}

/**
 * The address to send somebody.
 *
 * Built from where the page is actually served rather than from a constant,
 * because this app runs from a repository subpath on Pages and from the root
 * of a dev server, and a link that is right in one place and wrong in the
 * other is worse than no link at all.
 */
export function shareLink(id: string, at: { origin: string; pathname: string }): string {
  const path = at.pathname.replace(/[^/]*$/, '');
  return `${at.origin}${path}?${FORM_PARAM}=${id}`;
}

/** A day as the database wants it, or null for "no date set". */
const stamp = (day: string, end: boolean): string | null =>
  day ? new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}Z`).toISOString() : null;

/** A database timestamp back to the app's day-with-no-timezone. */
const day = (at: string | null): string | null => (at ? at.slice(0, 10) : null);

const needCloud = () => {
  if (!cloudConfigured) {
    throw new Error('Publishing a form needs an account, and this build has no account service.');
  }
};

/** The row as both `publish` and `republish` write it. */
const row = (f: FormData) => ({
  title: '',
  description: f.description,
  questions: asked(f.questions),
  marking: keyOf(f.questions),
  accepting: f.accepting,
  opens: stamp(f.opens, false),
  closes: stamp(f.closes, true),
  response_limit: f.limit,
});

/** Publish, returning the id that is also the link. */
export async function publish(project: CreativeProject): Promise<string> {
  needCloud();
  if (!project.form.questions.length) throw new Error('Add a question before publishing.');
  const db = await cloud();
  const { data: session } = await db.auth.getUser();
  const owner = session.user?.id;
  if (!owner) throw new Error('Sign in to publish a form.');

  const { data, error } = await db
    .from('forms')
    .insert({ ...row(project.form), title: project.title, owner })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** Push edits to a form already published. */
export async function republish(id: string, project: CreativeProject): Promise<void> {
  needCloud();
  const db = await cloud();
  const { error } = await db
    .from('forms')
    .update({ ...row(project.form), title: project.title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Take it down.
 *
 * A delete rather than `accepting = false`, and the responses go with it —
 * the migration's cascade. Withdrawing a form and leaving its answers on a
 * server would be the opposite of what the word means.
 */
export async function withdraw(id: string): Promise<void> {
  needCloud();
  const db = await cloud();
  const { error } = await db.from('forms').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** The form behind a link, or null when there is nothing open at that id. */
export async function openForm(id: string): Promise<PublishedForm | null> {
  needCloud();
  const db = await cloud();
  const { data, error } = await db
    .from('published_forms')
    .select('id, title, description, questions, closes')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as { id: string; title: string; description: string; questions: Question[]; closes: string | null };
  return { id: r.id, title: r.title, description: r.description, questions: r.questions ?? [], closes: day(r.closes) };
}

/**
 * The shape `checkedAnswers` wants, from a form this device may not fully see.
 *
 * `accepting` is true because the view returned a row and the view's WHERE
 * *is* the open check; `responses` is empty and `limit` is the largest a form
 * may have, because the count is on the far side of a policy this device
 * cannot read. Neither is a guess about the world: they are this device
 * saying which questions it is not the one answering.
 */
export function answerable(form: PublishedForm): FormData {
  return {
    description: form.description,
    questions: form.questions,
    responses: [],
    accepting: true,
    opens: '',
    closes: '',
    limit: Number.MAX_SAFE_INTEGER,
    quiz: false,
    sheetId: null,
    published: form.id,
  };
}

/** Send answers. Validated here; marked nowhere near here. */
export async function answer(form: PublishedForm, answers: Record<string, string>): Promise<void> {
  needCloud();
  const clean = checkedAnswers(answerable(form), answers);
  const db = await cloud();
  const { error } = await db.from('form_responses').insert({ form_id: form.id, answers: clean });
  if (error) {
    // A policy refusing the insert is the only way this device learns the form
    // shut or filled up between loading it and answering.
    throw new Error(
      /row-level security|policy/i.test(error.message)
        ? 'This form has stopped taking answers.'
        : error.message,
    );
  }
}

/**
 * What came back, marked here.
 *
 * `form` is the author's own copy, with the answer key on it — which is the
 * whole reason this runs on the author's device and not on a server.
 */
export async function collect(id: string, form: FormData): Promise<FormResponse[]> {
  needCloud();
  const db = await cloud();
  const { data, error } = await db
    .from('form_responses')
    .select('id, answers, created_at')
    .eq('form_id', id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as { id: string; answers: Record<string, string>; created_at: string }[]).map(
    (r) => {
      const answers = r.answers ?? {};
      const { score, possible } = markAnswers(form, answers);
      return { id: r.id, at: r.created_at, answers, score, possible };
    },
  );
}
