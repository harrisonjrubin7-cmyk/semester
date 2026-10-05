import { useEffect, useState } from 'react';
import { cloud, cloudConfigured } from './cloud';
import { obj } from './device-library';
import { MODULE_FLAGS, moduleOn } from './experience-flags';
import { USES, fromCourse, fromInstructor, permits, resolve, STATE_LABEL, usageLabel, type InstructorRules, type PolicySource, type Use, type UseState } from './toolkit/policy';
import type { CoursePolicy } from './types';

/**
 * What instructors have published for a student's courses, read for the
 * student's side of Course Studio (D-100 slice 2). The server half is
 * `supabase/migrations/20260928309000_course_studio.sql`.
 *
 * The student reads the latest published version of each course's rules and
 * guidance for the term, and the latest non-retired version of each pack.
 * Nothing here writes, and nothing here is about the student: reading policy
 * leaves no record anywhere (F5).
 */

/** `lib/types` Course.code → the server's key: "econ  1020" → "ECON 1020", or '' if it is not one. */
export function courseCode(given: string): string {
  const c = given.trim().replace(/\s+/g, ' ').toUpperCase();
  return /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/.test(c) ? c : '';
}

export interface PackItem {
  title: string;
  citation: string;
  link: string;
  authority: 'authoritative' | 'supplemental' | 'prohibited';
}

export interface Pack {
  id: string;
  title: string;
  note: string;
  items: PackItem[];
  published: string;
}

export interface CoursePublication {
  rules?: InstructorRules;
  guidance?: { body: string; published: string };
  packs: Pack[];
}

const STATES = ['allowed', 'limited', 'prohibited', 'required'] as const;
type Stated = (typeof STATES)[number];
const isState = (v: unknown): v is Stated => typeof v === 'string' && (STATES as readonly string[]).includes(v);
const USE_IDS = USES.map(([u]) => u) as readonly string[];
const day = (v: unknown) => (typeof v === 'string' ? v.slice(0, 10) : '');
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** A published rules row, rebuilt field by field: an unknown use or state is dropped, never trusted. */
export function readRules(r: unknown): InstructorRules | undefined {
  if (!obj(r)) return undefined;
  const uses: InstructorRules['uses'] = {};
  if (obj(r.uses)) for (const [k, v] of Object.entries(r.uses)) if (USE_IDS.includes(k) && isState(v)) uses[k as Use] = v;
  return {
    blanket: isState(r.blanket) ? r.blanket : null,
    uses,
    words: text(r.words, 4000),
    link: /^https?:\/\/\S+$/.test(String(r.link ?? '')) ? String(r.link) : '',
    effective: day(r.effective),
    published: day(r.published_at),
  };
}

export function readPackItems(v: unknown): PackItem[] {
  if (!Array.isArray(v)) return [];
  return v.filter(obj).flatMap((i) => {
    const authority = i.authority;
    if (authority !== 'authoritative' && authority !== 'supplemental' && authority !== 'prohibited') return [];
    const title = text(i.title, 200).trim();
    if (!title) return [];
    const link = String(i.link ?? '');
    return [{ title, citation: text(i.citation, 200), link: /^https?:\/\/\S+$/.test(link) ? link : '', authority }];
  });
}

/**
 * The newest version of each thing, from rows of every version. Pure, so the
 * rule "latest wins, retired hides" is testable without a database.
 */
export function latest(
  rules: unknown[],
  guidance: unknown[],
  packs: unknown[],
): Record<string, CoursePublication> {
  const out: Record<string, CoursePublication> = {};
  const at = (code: string) => (out[code] ??= { packs: [] });
  const newest = <T extends Record<string, unknown>>(rows: unknown[], key: (r: T) => string) => {
    const best = new Map<string, T>();
    for (const r of rows.filter(obj) as T[]) {
      const k = key(r);
      const held = best.get(k);
      if (!held || Number(r.version) > Number(held.version)) best.set(k, r);
    }
    return [...best.values()];
  };
  for (const r of newest(rules, (r) => String(r.course_code))) {
    const read = readRules(r);
    if (read) at(String(r.course_code)).rules = read;
  }
  for (const g of newest(guidance, (g) => String(g.course_code))) {
    const body = text(g.body, 4000).trim();
    if (body) at(String(g.course_code)).guidance = { body, published: day(g.published_at) };
  }
  for (const p of newest(packs, (p) => String(p.pack_id))) {
    if (p.retired === true) continue;
    at(String(p.course_code)).packs.push({
      id: String(p.pack_id),
      title: text(p.title, 120),
      note: text(p.note, 2000),
      items: readPackItems(p.items),
      published: day(p.published_at),
    });
  }
  return out;
}

export async function loadPublications(codes: string[], term: string): Promise<Record<string, CoursePublication>> {
  const keys = [...new Set(codes.map(courseCode).filter(Boolean))];
  if (!keys.length) return {};
  const db = await cloud();
  const [r, g, p] = await Promise.all([
    db.from('course_ai_rules').select('course_code, version, blanket, uses, words, link, effective, published_at').eq('term', term).in('course_code', keys),
    db.from('course_guidance').select('course_code, version, body, published_at').eq('term', term).in('course_code', keys),
    db.from('study_packs').select('pack_id, course_code, version, title, note, items, retired, published_at').eq('term', term).in('course_code', keys),
  ]);
  const failed = r.error ?? g.error ?? p.error;
  if (failed) throw new Error(failed.message);
  return latest(r.data ?? [], g.data ?? [], p.data ?? []);
}

/**
 * The publications for these courses, or {} while loading, when signed out,
 * when the module is off, or when the read failed — in every one of which the
 * student's own record is all there is, exactly as before this existed.
 */
const NONE: Record<string, CoursePublication> = {};

export function useCoursePublications(codes: string[], term: string, signedIn: boolean, on = moduleOn(MODULE_FLAGS.course_studio)) {
  const key = [...new Set(codes.map(courseCode).filter(Boolean))].sort().join('|');
  // What is being asked for, or '' when nothing should be read. The answer is
  // kept against the question, so a stale answer is never shown for a new one
  // and "nothing to read" needs no state change at all.
  const want = on && signedIn && cloudConfigured && key ? `${term}:${key}` : '';
  const [got, setGot] = useState<{ want: string; value: Record<string, CoursePublication> }>({ want: '', value: NONE });
  useEffect(() => {
    if (!want) return;
    let alive = true;
    const [t, codes] = [want.slice(0, want.indexOf(':')), want.slice(want.indexOf(':') + 1).split('|')];
    void loadPublications(codes, t).then(
      (value) => alive && setGot({ want, value }),
      () => alive && setGot({ want, value: NONE }),
    );
    return () => {
      alive = false;
    };
  }, [want]);
  return want && got.want === want ? got.value : NONE;
}

/** The layers for one course: the instructor's published rules, then the student's own note. */
export function courseLayers(code: string, ai: CoursePolicy | undefined, published: Record<string, CoursePublication>): (PolicySource | undefined)[] {
  return [fromInstructor(published[courseCode(code)]?.rules), fromCourse(ai)];
}

// ── Study Studio's gate ────────────────────────────────────────────────

/** A study guide explains material and asks practice questions: both uses have to be permitted. */
export const STUDY_USES: readonly Use[] = ['explanation', 'practice'];

export interface StudyGate {
  /** `prohibited` blocks; `confirm` asks the student to say they checked; `disclose` asks them to disclose; `allowed` asks nothing. */
  kind: 'prohibited' | 'confirm' | 'disclose' | 'allowed';
  /** Who said so, in the words a student reads. */
  source: string;
  /** For the prompt: what each use resolved to and on whose word. */
  line: string;
}

const whoSaid = (p: PolicySource | undefined) =>
  !p ? 'nothing on file' : p.by === 'instructor' ? `set by your instructor${p.lastVerified ? `, published ${p.lastVerified}` : ''}` : p.by === 'institution' ? 'set by your school' : 'your own record of the syllabus';

export function studyGate(layers: readonly (PolicySource | undefined)[]): StudyGate {
  const resolved = STUDY_USES.map((u) => resolve(u, layers));
  const worst = (state: UseState) => resolved.some((r) => r.state === state);
  const deciding = resolved.find((r) => !permits(r.state)) ?? resolved[0];
  const kind: StudyGate['kind'] = worst('prohibited')
    ? 'prohibited'
    : worst('unavailable')
      ? 'confirm'
      : resolved.some((r) => r.state === 'limited' || r.state === 'required')
        ? 'disclose'
        : 'allowed';
  const line = resolved
    .map((r) => `${usageLabel(r.use)}: ${STATE_LABEL[r.state]} (${whoSaid(r.from)}${r.from?.text ? `: "${r.from.text}"` : ''})`)
    .join('; ');
  return { kind, source: whoSaid(deciding.from), line };
}

// ── Study packs in Study Studio ────────────────────────────────────────

/** A title as a person would mean it: case, punctuation, spacing and a file's extension don't count. */
export const sameTitle = (t: string) =>
  t
    .toLowerCase()
    .replace(/\.(pdf|docx?|pptx?|txt|md|rtf)$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Which chosen sources may go to an AI, given the instructor's packs.
 *
 * A pack names references, not text, so nothing here can know two documents
 * are "the same" beyond their titles. That is the guard, stated plainly: a
 * source whose title matches a reference the instructor marked "do not use"
 * is held back and named, whatever the student ticked. It is not a
 * plagiarism detector and does not claim to be — it is the instructor's list,
 * applied to the student's selection before anything is sent.
 */
export function packGuard<T extends { title: string }>(chosen: T[], packs: Pack[]): { send: T[]; held: T[] } {
  const barred = new Set(packs.flatMap((p) => p.items.filter((i) => i.authority === 'prohibited').map((i) => sameTitle(i.title))).filter(Boolean));
  const held = chosen.filter((s) => barred.has(sameTitle(s.title)));
  return { send: chosen.filter((s) => !held.includes(s)), held };
}

export const AUTHORITY_TEXT: Record<PackItem['authority'], string> = {
  authoritative: 'Authoritative',
  supplemental: 'Supplemental',
  prohibited: 'Do not use',
};
