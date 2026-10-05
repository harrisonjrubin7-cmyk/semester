import type { Application } from './apply';
import type { CareerExperience, CareerLibrary } from './career';
import { obj } from './device-library';
import type { SkillClaim, SkillEvidenceLink } from './skills-graph';

/**
 * Career Evidence (Phase I, `career_evidence`): turning what a student has
 * actually done into a résumé, without Semester adding anything they did not.
 *
 * - **Skills** are suggested by `lib/skills-graph.ts` from courses and
 *   experiences. The student confirms, renames or rejects each one; only
 *   confirmed skills go anywhere. A skill the student adds must point at a
 *   course or an experience that shows it.
 * - **Portfolio artifacts** are things they made, each tied to an experience
 *   or a course, tagged only with confirmed skills.
 * - **Bullets** are built from the student's answers to three questions —
 *   how many people it affected, what tools or methods, what the outcome
 *   was — and contain nothing else: an unanswered question leaves its part
 *   out rather than filling it in.
 * - **Résumé versions** pick experiences and finished bullets under one of
 *   three templates, and list confirmed skills only.
 * - **Interview cards** and **fair plans** are checklists the student works
 *   through. Nothing here applies anywhere or sends anything.
 */

export const EVIDENCE_PREFIX = 'semester.career-evidence.v1';

/** This account's evidence for this term. Shared by the Career screen and anything that saves into it. */
export const evidenceKey = (accountId: string | undefined, term: string) => `${EVIDENCE_PREFIX}:${accountId || 'device'}:${term}`;
export const LIMITS = { own: 40, artifacts: 60, bullets: 200, versions: 12, employers: 30, text: 300, long: 2000 } as const;

export type SkillState = 'suggested' | 'confirmed' | 'rejected';

export interface Decision {
  status: 'confirmed' | 'rejected';
  /** The name the student chose; the suggested name unless they renamed it. */
  name: string;
  at: number;
}

export interface EvidenceRef {
  kind: 'experience' | 'course';
  id: string;
  label: string;
}

export interface OwnSkill {
  id: string;
  name: string;
  evidence: EvidenceRef;
  at: number;
}

export const ARTIFACT_KINDS = ['Project', 'Paper', 'Presentation', 'Code', 'Design', 'Data analysis', 'Other'] as const;

export interface Artifact {
  id: string;
  title: string;
  kind: (typeof ARTIFACT_KINDS)[number];
  /** YYYY-MM, or empty. */
  date: string;
  description: string;
  /** https only, or empty. */
  url: string;
  evidence: EvidenceRef;
  skills: string[];
}

export interface Bullet {
  id: string;
  experienceId: string;
  /** "Led", "Rebuilt the intake form" — what they did, in their words. */
  did: string;
  /** How many people it affected. Digits only, or empty. */
  people: string;
  tools: string;
  outcome: string;
  final: boolean;
  updated: number;
}

export const TEMPLATES = [
  { id: 'chronological', label: 'Chronological', blurb: 'Experience first, newest at the top — the default most employers expect.' },
  { id: 'skills_first', label: 'Skills first', blurb: 'Confirmed skills lead, then experience — for a change of field.' },
  { id: 'projects_first', label: 'Projects first', blurb: 'Projects and portfolio lead — for technical, design and research roles.' },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];

export interface ResumeVersion {
  id: string;
  name: string;
  template: TemplateId;
  experienceIds: string[];
  bulletIds: string[];
  artifactIds: string[];
  updated: number;
}

export interface FairEmployer {
  id: string;
  name: string;
  why: string;
  question: string;
  visited: boolean;
  followUp: string;
}

export interface Evidence {
  version: 1;
  decisions: Record<string, Decision>;
  own: OwnSkill[];
  artifacts: Artifact[];
  bullets: Bullet[];
  versions: ResumeVersion[];
  /** Interview card steps ticked, by application id. */
  interviewDone: Record<string, string[]>;
  /** Fair plans, by the fair's opportunity id. */
  fairs: Record<string, { employers: FairEmployer[]; pitch: string }>;
}

export const EMPTY_EVIDENCE: Evidence = { version: 1, decisions: {}, own: [], artifacts: [], bullets: [], versions: [], interviewDone: {}, fairs: {} };

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = (s: string, max: number = LIMITS.text) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/* ── Skills ─────────────────────────────────────────────────────────────── */

export interface ReviewedSkill {
  key: string;
  name: string;
  state: SkillState;
  origin: 'suggested' | 'added';
  evidence: (SkillEvidenceLink | EvidenceRef)[];
}

export function reviewedSkills(claims: SkillClaim[], ev: Evidence): ReviewedSkill[] {
  const out: ReviewedSkill[] = claims.map((c) => {
    const d = ev.decisions[slug(c.skill)];
    return { key: slug(c.skill), name: d?.name ?? c.skill, state: d?.status ?? 'suggested', origin: 'suggested', evidence: c.evidence };
  });
  for (const o of ev.own) out.push({ key: `own:${o.id}`, name: o.name, state: 'confirmed', origin: 'added', evidence: [o.evidence] });
  return out;
}

/** The only skills that may appear on a résumé, a pitch or an artifact. */
export function confirmedSkills(claims: SkillClaim[], ev: Evidence): string[] {
  return [...new Set(reviewedSkills(claims, ev).filter((s) => s.state === 'confirmed').map((s) => s.name))];
}

export function decide(ev: Evidence, claim: SkillClaim, status: Decision['status'] | null, name: string | undefined, at: number): Evidence {
  const key = slug(claim.skill);
  const decisions = { ...ev.decisions };
  const before = decisions[key]?.status === 'confirmed' ? decisions[key].name : null;
  if (status === null) delete decisions[key];
  else decisions[key] = { status, name: clean(name ?? decisions[key]?.name ?? claim.skill, 60) || claim.skill, at };
  const after = decisions[key]?.status === 'confirmed' ? decisions[key].name : null;
  // Artifacts are tagged with confirmed skills only. When this one stops being
  // confirmed, or is renamed, its tags follow — unless a skill of the
  // student's own still carries the old name.
  if (before === null || before === after || ev.own.some((o) => o.name === before)) return { ...ev, decisions };
  const artifacts = ev.artifacts.map((a) =>
    a.skills.includes(before)
      ? { ...a, skills: [...new Set(a.skills.flatMap((s) => (s !== before ? [s] : after ? [after] : [])))] }
      : a,
  );
  return { ...ev, decisions, artifacts };
}

/** A skill the student adds must cite something they did that is on record. */
export function addOwnSkill(ev: Evidence, name: string, evidence: EvidenceRef, known: { experiences: CareerExperience[]; courseIds: string[] }, at: number): Evidence {
  const n = clean(name, 60);
  if (!n) throw new Error('Name the skill.');
  if (!citable(evidence, known)) throw new Error('A skill needs a course or an entry of yours that shows it.');
  if (ev.own.length >= LIMITS.own) throw new Error(`You can add up to ${LIMITS.own} skills of your own.`);
  return { ...ev, own: [...ev.own, { id: crypto.randomUUID(), name: n, evidence, at }] };
}

const citable = (e: EvidenceRef, known: { experiences: CareerExperience[]; courseIds: string[] }) =>
  e.kind === 'experience' ? known.experiences.some((x) => x.id === e.id) : known.courseIds.includes(e.id);

/* ── Portfolio ──────────────────────────────────────────────────────────── */

export function saveArtifact(
  ev: Evidence,
  a: Omit<Artifact, 'id'> & { id?: string },
  known: { experiences: CareerExperience[]; courseIds: string[]; confirmed: string[] },
): Evidence {
  const title = clean(a.title);
  if (!title) throw new Error('Give the artifact a title.');
  if (!citable(a.evidence, known)) throw new Error('Tie it to a course or an entry of yours — the thing you made it in.');
  const url = a.url.trim();
  if (url && !/^https:\/\/[^\s]+$/i.test(url)) throw new Error('Links must start with https://.');
  if (a.date && !/^\d{4}-\d{2}$/.test(a.date)) throw new Error('Use a month, like 2026-04.');
  const unconfirmed = a.skills.filter((s) => !known.confirmed.includes(s));
  if (unconfirmed.length) throw new Error(`Only confirmed skills can be tagged: ${unconfirmed.join(', ')}.`);
  if (!a.id && ev.artifacts.length >= LIMITS.artifacts) throw new Error(`You can keep up to ${LIMITS.artifacts} artifacts.`);
  const next: Artifact = { ...a, id: a.id ?? crypto.randomUUID(), title, url, description: clean(a.description, LIMITS.long), skills: [...new Set(a.skills)] };
  return { ...ev, artifacts: [...ev.artifacts.filter((x) => x.id !== next.id), next] };
}

/* ── Bullets ────────────────────────────────────────────────────────────── */

export const METRIC_PROMPTS = {
  people: 'How many people did this affect?',
  tools: 'What tools or methods did you use?',
  outcome: 'What was the outcome?',
} as const;

const PEOPLE = /^\d{1,3}(,\d{3})*\+?$|^\d+\+?$/;

/**
 * The bullet, from the student's answers and nothing else. An unanswered
 * question is left out — no number, tool or result is ever supplied for
 * them. The only words Semester adds are "using", "reaching", "people".
 */
export function composeBullet(b: Pick<Bullet, 'did' | 'people' | 'tools' | 'outcome'>): string {
  const did = clean(b.did).replace(/[.;,\s]+$/, '');
  if (!did) return '';
  const cap = did.charAt(0).toUpperCase() + did.slice(1);
  const tools = clean(b.tools).replace(/[.;,\s]+$/, '');
  const people = b.people.trim();
  const outcome = clean(b.outcome).replace(/[.;,\s]+$/, '');
  return `${cap}${tools ? ` using ${tools}` : ''}${people && PEOPLE.test(people) ? `, reaching ${people} people` : ''}${outcome ? `; ${outcome}` : ''}.`;
}

/** Which of the three questions are still unanswered, in the prompts' own words. */
export function missingPrompts(b: Pick<Bullet, 'people' | 'tools' | 'outcome'>): string[] {
  return [
    ...(b.people.trim() ? [] : [METRIC_PROMPTS.people]),
    ...(b.tools.trim() ? [] : [METRIC_PROMPTS.tools]),
    ...(b.outcome.trim() ? [] : [METRIC_PROMPTS.outcome]),
  ];
}

export function saveBullet(ev: Evidence, b: Omit<Bullet, 'id' | 'updated'> & { id?: string }, experiences: CareerExperience[], at: number): Evidence {
  if (!experiences.some((e) => e.id === b.experienceId)) throw new Error('A bullet belongs to one of your entries. Add the entry first.');
  if (!clean(b.did)) throw new Error('Say what you did.');
  if (b.people.trim() && !PEOPLE.test(b.people.trim())) throw new Error('Give the number of people as digits, like 40 or 1,200 — or leave it blank.');
  if (!b.id && ev.bullets.length >= LIMITS.bullets) throw new Error(`You can keep up to ${LIMITS.bullets} bullets.`);
  const next: Bullet = { ...b, id: b.id ?? crypto.randomUUID(), did: clean(b.did), tools: clean(b.tools), outcome: clean(b.outcome), people: b.people.trim(), updated: at };
  return { ...ev, bullets: [...ev.bullets.filter((x) => x.id !== next.id), next] };
}

/* ── Résumé versions ────────────────────────────────────────────────────── */

export function renderResume(v: ResumeVersion, c: CareerLibrary, ev: Evidence, confirmed: string[]): string {
  const entries = v.experienceIds.map((id) => c.experiences.find((e) => e.id === id)).filter((e): e is CareerExperience => !!e);
  const bullets = (e: CareerExperience) =>
    ev.bullets.filter((b) => b.experienceId === e.id && b.final && v.bulletIds.includes(b.id)).map((b) => `- ${composeBullet(b)}`);
  const entry = (e: CareerExperience) => [
    `### ${e.title}${e.organization ? ` · ${e.organization}` : ''}${e.dates ? ` · ${e.dates}` : ''}`,
    ...(bullets(e).length ? bullets(e) : e.details.trim() ? [e.details.trim()] : []),
    '',
  ];
  const projects = entries.filter((e) => e.category === 'Project');
  const rest = entries.filter((e) => e.category !== 'Project');
  const artifacts = v.artifactIds.map((id) => ev.artifacts.find((a) => a.id === id)).filter((a): a is Artifact => !!a);
  const skills = confirmed.length ? ['## Skills', confirmed.join(' · '), ''] : [];
  const experience = rest.length ? ['## Experience', ...rest.flatMap(entry)] : [];
  const project = projects.length || artifacts.length
    ? ['## Projects', ...projects.flatMap(entry), ...artifacts.map((a) => `- ${a.title} (${a.kind}${a.date ? `, ${a.date}` : ''})${a.url ? ` — ${a.url}` : ''}`), '']
    : [];
  const head = [`# ${c.name.trim() || '[Your name]'}`, c.contact.trim() || '[Email · phone · link]', ...(c.headline.trim() ? ['', c.headline.trim()] : []), ''];
  const body = v.template === 'skills_first' ? [...skills, ...experience, ...project] : v.template === 'projects_first' ? [...project, ...experience, ...skills] : [...experience, ...project, ...skills];
  return [...head, ...body].join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function saveVersion(ev: Evidence, v: Omit<ResumeVersion, 'id' | 'updated'> & { id?: string }, at: number): Evidence {
  const name = clean(v.name, 80);
  if (!name) throw new Error('Name the version, e.g. "Consulting internships".');
  if (!v.id && ev.versions.length >= LIMITS.versions) throw new Error(`You can keep up to ${LIMITS.versions} versions.`);
  const next: ResumeVersion = { ...v, name, id: v.id ?? crypto.randomUUID(), updated: at };
  return { ...ev, versions: [...ev.versions.filter((x) => x.id !== next.id), next] };
}

/* ── Interview cards ────────────────────────────────────────────────────── */

export interface InterviewCard {
  applicationId: string;
  title: string;
  by: string;
  steps: { id: string; text: string }[];
}

/** One card per application at the interview stage, with steps the student ticks. Stories come from their finished bullets. */
export function interviewCards(apps: Application[], ev: Evidence): InterviewCard[] {
  const stories = ev.bullets.filter((b) => b.final).slice(0, 3).map(composeBullet);
  return apps
    .filter((a) => a.stage === 'talking')
    .map((a) => ({
      applicationId: a.id,
      title: `${a.role || 'Interview'}${a.org ? ` · ${a.org}` : ''}`,
      by: a.nextBy,
      steps: [
        ...(a.url ? [{ id: 'posting', text: 'Reread the posting and note the three things they ask for most.' }] : []),
        {
          id: 'stories',
          text: stories.length
            ? `Practice two stories aloud from your bullets: ${stories.slice(0, 2).map((s) => `“${s}”`).join(' ')}`
            : 'Write two finished bullets first, then practice them aloud as stories.',
        },
        { id: 'questions', text: 'Prepare two questions to ask them about the role or the team.' },
        { id: 'logistics', text: 'Confirm the time, format and who you will meet.' },
        { id: 'thanks', text: 'Afterwards, send a short thank-you within a day.' },
      ],
    }));
}

/* ── Fair plans ─────────────────────────────────────────────────────────── */

/** A 30-second pitch from the student's own name, headline, entries and confirmed skills — with a gap where something is missing, never a guess. */
export function pitchDraft(c: CareerLibrary, confirmed: string[]): string {
  const latest = c.experiences.filter((e) => e.category !== 'Education' && e.category !== 'Skills').slice(-1)[0];
  return [
    `Hi, I’m ${c.name.trim() || '[your name]'}${c.headline.trim() ? ` — ${c.headline.trim()}` : ' — [what you study and what you are looking for]'}.`,
    latest ? `Most recently: ${latest.title}${latest.organization ? ` at ${latest.organization}` : ''}.` : '[One thing you have done that you are proud of.]',
    confirmed.length ? `I bring ${confirmed.slice(0, 3).join(', ')}.` : '[Two or three skills you have confirmed.]',
    '[Why this employer, in one sentence.]',
  ].join(' ');
}

export function saveEmployer(ev: Evidence, fairId: string, e: Omit<FairEmployer, 'id'> & { id?: string }): Evidence {
  const name = clean(e.name, 120);
  if (!name) throw new Error('Name the employer.');
  const plan = ev.fairs[fairId] ?? { employers: [], pitch: '' };
  if (!e.id && plan.employers.length >= LIMITS.employers) throw new Error(`Up to ${LIMITS.employers} employers per fair.`);
  const next: FairEmployer = { ...e, id: e.id ?? crypto.randomUUID(), name, why: clean(e.why), question: clean(e.question), followUp: clean(e.followUp) };
  return { ...ev, fairs: { ...ev.fairs, [fairId]: { ...plan, employers: [...plan.employers.filter((x) => x.id !== next.id), next] } } };
}

/* ── The device store ───────────────────────────────────────────────────── */

const bad = () => new Error('Saved career evidence is not valid.');
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const ref = (v: unknown): v is EvidenceRef => obj(v) && (v.kind === 'experience' || v.kind === 'course') && str(v.id, 200) && !!v.id && str(v.label, 300);
const strings = (v: unknown, max: number, each = 200) => Array.isArray(v) && v.length <= max && v.every((x) => str(x, each));

export function readEvidence(value: unknown): Evidence {
  if (!obj(value) || value.version !== 1) throw bad();
  const { decisions, own, artifacts, bullets, versions, interviewDone, fairs } = value;
  if (!obj(decisions) || !Array.isArray(own) || !Array.isArray(artifacts) || !Array.isArray(bullets) || !Array.isArray(versions) || !obj(interviewDone) || !obj(fairs)) throw bad();
  if (own.length > LIMITS.own || artifacts.length > LIMITS.artifacts || bullets.length > LIMITS.bullets || versions.length > LIMITS.versions) throw bad();
  for (const d of Object.values(decisions)) if (!obj(d) || (d.status !== 'confirmed' && d.status !== 'rejected') || !str(d.name, 60) || typeof d.at !== 'number') throw bad();
  for (const o of own) if (!obj(o) || !str(o.id, 100) || !str(o.name, 60) || !o.name || !ref(o.evidence) || typeof o.at !== 'number') throw bad();
  for (const a of artifacts) {
    if (!obj(a) || !str(a.id, 100) || !str(a.title, 300) || !(ARTIFACT_KINDS as readonly unknown[]).includes(a.kind) || !str(a.date, 7) || !str(a.description, LIMITS.long)) throw bad();
    if (!str(a.url, 2000) || (a.url && !/^https:\/\//i.test(a.url as string)) || !ref(a.evidence) || !strings(a.skills, 30, 60)) throw bad();
  }
  for (const b of bullets) {
    if (!obj(b) || !str(b.id, 100) || !str(b.experienceId, 100) || !str(b.did, 300) || !str(b.tools, 300) || !str(b.outcome, 300) || typeof b.final !== 'boolean' || typeof b.updated !== 'number') throw bad();
    if (!str(b.people, 20) || (b.people && !PEOPLE.test(b.people as string))) throw bad();
  }
  for (const v of versions) {
    if (!obj(v) || !str(v.id, 100) || !str(v.name, 80) || !TEMPLATES.some((t) => t.id === v.template) || typeof v.updated !== 'number') throw bad();
    if (!strings(v.experienceIds, 100) || !strings(v.bulletIds, LIMITS.bullets) || !strings(v.artifactIds, LIMITS.artifacts)) throw bad();
  }
  for (const done of Object.values(interviewDone)) if (!strings(done, 10, 40)) throw bad();
  for (const f of Object.values(fairs)) {
    if (!obj(f) || !str(f.pitch, LIMITS.long) || !Array.isArray(f.employers) || f.employers.length > LIMITS.employers) throw bad();
    for (const e of f.employers) if (!obj(e) || !str(e.id, 100) || !str(e.name, 120) || !str(e.why, 300) || !str(e.question, 300) || typeof e.visited !== 'boolean' || !str(e.followUp, 300)) throw bad();
  }
  return value as unknown as Evidence;
}
