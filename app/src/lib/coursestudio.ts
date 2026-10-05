import { cloud } from './cloud';
import { obj } from './device-library';
import { courseCode, readPackItems, readRules, type PackItem } from './courserules';
import { USES, type InstructorRules, type Use, type UseState } from './toolkit/policy';

/**
 * The faculty side of Course Studio (D-100 slice 3): what an instructor
 * publishes, checked here as the server checks it so a mistake is named
 * before the publish rather than after. The server is the authority —
 * `supabase/migrations/20260928309000_course_studio.sql` refuses the same
 * things again, and more (who may publish at all).
 */

export type Stated = Exclude<UseState, 'unavailable'>;

export interface RulesDraft {
  blanket: Stated | null;
  uses: Partial<Record<Use, Stated>>;
  words: string;
  link: string;
  effective: string;
}

export interface PackDraft {
  id: string | null;
  title: string;
  note: string;
  items: PackItem[];
}

export const EMPTY_RULES: RulesDraft = { blanket: null, uses: {}, words: '', link: '', effective: '' };

const HTTP = /^https?:\/\/\S+$/;

/** Why these rules cannot be published as they stand, or [] when they can. */
export function rulesProblems(d: RulesDraft, confirmedFinalAnswers: boolean): string[] {
  const out: string[] = [];
  if (d.words.length > 4000) out.push('Your words are longer than 4,000 characters.');
  if (d.link && (!HTTP.test(d.link) || d.link.length > 500)) out.push('The syllabus link must start with http:// or https://.');
  if (d.effective && !/^\d{4}-\d{2}-\d{2}$/.test(d.effective)) out.push('The effective date is not a date.');
  const fa = d.uses['final-answers'];
  // F3: permitting a final answer is never implied, and never a slip.
  if ((fa === 'allowed' || fa === 'limited' || fa === 'required') && !confirmedFinalAnswers)
    out.push('Confirm that AI may produce final answers for assessments in this course.');
  return out;
}

/** Why this pack cannot be published, or [] when it can. */
export function packProblems(d: PackDraft): string[] {
  const out: string[] = [];
  if (!d.title.trim()) out.push('Name the pack.');
  if (d.title.trim().length > 120) out.push('The name is longer than 120 characters.');
  if (d.note.length > 2000) out.push('The note is longer than 2,000 characters.');
  if (d.items.length > 50) out.push('A pack holds at most 50 references.');
  d.items.forEach((i, n) => {
    if (!i.title.trim()) out.push(`Reference ${n + 1} needs a title.`);
    if (i.title.trim().length > 200) out.push(`Reference ${n + 1}'s title is longer than 200 characters.`);
    if (i.citation.length > 200) out.push(`Reference ${n + 1}'s citation is longer than 200 characters.`);
    if (i.link && (!HTTP.test(i.link) || i.link.length > 500)) out.push(`Reference ${n + 1}'s link must start with http:// or https://.`);
  });
  return out;
}

/** A draft as the student card will read it: the same shape `fromInstructor` takes. */
export function asPublished(d: RulesDraft, published = ''): InstructorRules {
  return { blanket: d.blanket, uses: d.uses, words: d.words.trim(), link: d.link.trim(), effective: d.effective, published };
}

/** A published version back into an editable draft. */
export function draftOf(r: InstructorRules | undefined): RulesDraft {
  return r ? { blanket: r.blanket, uses: { ...r.uses }, words: r.words, link: r.link, effective: r.effective } : EMPTY_RULES;
}

// ── The calls ───────────────────────────────────────────────────────────

const failed = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function myCourses(): Promise<string[]> {
  const { data, error } = await (await cloud()).rpc('my_course_studio_courses');
  failed(error);
  return (Array.isArray(data) ? data : [])
    .map((r) => (obj(r) ? courseCode(String(r.course_code ?? '')) : ''))
    .filter(Boolean);
}

export async function publishRules(code: string, term: string, d: RulesDraft): Promise<number> {
  const { data, error } = await (await cloud()).rpc('publish_course_rules', {
    want_course: code,
    want_term: term,
    want_blanket: d.blanket,
    want_uses: d.uses,
    want_words: d.words.trim(),
    want_link: d.link.trim(),
    want_effective: d.effective || null,
  });
  failed(error);
  return Number(data);
}

export async function publishGuidance(code: string, term: string, body: string): Promise<number> {
  const { data, error } = await (await cloud()).rpc('publish_course_guidance', { want_course: code, want_term: term, want_body: body.trim() });
  failed(error);
  return Number(data);
}

export async function publishPack(code: string, term: string, d: PackDraft, retired = false): Promise<string> {
  const { data, error } = await (await cloud()).rpc('publish_study_pack', {
    want_course: code,
    want_term: term,
    want_pack: d.id,
    want_title: d.title.trim(),
    want_note: d.note,
    want_items: d.items.map((i) => ({ title: i.title.trim(), citation: i.citation.trim(), link: i.link.trim(), authority: i.authority })),
    want_retired: retired,
  });
  failed(error);
  return String(data);
}

export interface Version {
  kind: 'rules' | 'guidance' | 'pack';
  label: string;
  version: number;
  published: string;
  summary: string;
}

/** Every version published for this course and term, newest first. Readable by the whole school (F4). */
export async function history(code: string, term: string): Promise<Version[]> {
  const db = await cloud();
  const [r, g, p] = await Promise.all([
    db.from('course_ai_rules').select('version, blanket, uses, words, published_at').eq('course_code', code).eq('term', term),
    db.from('course_guidance').select('version, body, published_at').eq('course_code', code).eq('term', term),
    db.from('study_packs').select('version, title, items, retired, published_at').eq('course_code', code).eq('term', term),
  ]);
  failed(r.error ?? g.error ?? p.error);
  const rows = (x: { data: unknown[] | null }) => (x.data ?? []).filter(obj);
  const out: Version[] = [
    ...rows(r).map((x) => {
      const read = readRules(x);
      const named = Object.keys(read?.uses ?? {}).length;
      return {
        kind: 'rules' as const,
        label: 'AI rules',
        version: Number(x.version),
        published: String(x.published_at ?? ''),
        summary: `${read?.blanket ? `Everything else: ${read.blanket}` : 'No blanket'} · ${named} named ${named === 1 ? 'use' : 'uses'}`,
      };
    }),
    ...rows(g).map((x) => ({
      kind: 'guidance' as const,
      label: 'Guidance',
      version: Number(x.version),
      published: String(x.published_at ?? ''),
      summary: String(x.body ?? '').trim() ? `${String(x.body).trim().slice(0, 80)}${String(x.body).trim().length > 80 ? '…' : ''}` : 'Withdrawn',
    })),
    ...rows(p).map((x) => ({
      kind: 'pack' as const,
      label: `Pack: ${String(x.title ?? '')}`,
      version: Number(x.version),
      published: String(x.published_at ?? ''),
      summary: x.retired === true ? 'Retired' : `${readPackItems(x.items).length} references`,
    })),
  ];
  return out.sort((a, b) => b.published.localeCompare(a.published) || b.version - a.version);
}

/** The ten uses in the toolkit's order, for the editor's rows. */
export const USE_ROWS = USES;
