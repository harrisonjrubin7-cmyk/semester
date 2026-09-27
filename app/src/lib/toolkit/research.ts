import { flatten } from '../cite';
import { finite, obj, textValue } from '../device-library';

/**
 * The Research Studio's rules: what a piece of evidence has to have before it
 * can be called verified, and what a claim has to have before it can be
 * called supported.
 *
 * ## Verified means the student opened the original
 *
 * Every other state is reachable by typing. `verified` is not: `verify`
 * refuses unless the student has said they opened the original source, the
 * source is something that can be cited at all (an AI summary cannot — it is
 * a navigation aid, the brief is explicit), the citation has its authors,
 * year and title, and any quotation either appears in the excerpt the
 * student pasted (matched by `lib/cite.ts`'s strict comparison) or carries
 * the page it is on. None of those can be satisfied by an AI on the
 * student's behalf, which is the point.
 *
 * ## Nothing is filled in
 *
 * Citation export formats what the student entered. A missing year prints as
 * `[year missing]`, not a plausible year. That is uglier than a formatter
 * that guesses, and it is the only kind that cannot fabricate a reference.
 *
 * ## Correlation is not causation, mechanically
 *
 * `overclaims` looks for causal wording in a claim ("causes", "leads to",
 * "the effect of") and, when every study linked to that claim is
 * observational, the audit says so. It is a prompt to reread the sentence,
 * not a grammar rule — wording like "is associated with" passes — and it
 * cannot see a causal claim phrased some other way. It catches the common
 * case, which is the one students actually write.
 */

export const SOURCE_KINDS = [
  ['peer-reviewed', 'Peer-reviewed study'],
  ['preprint', 'Preprint — not yet peer reviewed'],
  ['institutional-report', 'Institutional or government report'],
  ['book', 'Book or chapter'],
  ['course-provided', 'Course-provided reading'],
  ['news', 'News'],
  ['commentary', 'Commentary or opinion'],
  ['student-note', 'Student note'],
  ['ai-summary', 'AI summary — navigation only, never citable'],
  ['unverified', 'Unverified'],
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number][0];

export const DESIGNS = [
  ['randomized', 'Randomized experiment'],
  ['quasi', 'Quasi-experiment'],
  ['cohort', 'Cohort (longitudinal)'],
  ['case-control', 'Case-control'],
  ['cross-sectional', 'Cross-sectional or survey'],
  ['qualitative', 'Qualitative'],
  ['review', 'Systematic review or meta-analysis'],
  ['theory', 'Theory or argument'],
  ['other', 'Other or not stated'],
] as const;

export type Design = (typeof DESIGNS)[number][0];

const OBSERVATIONAL: ReadonlySet<Design> = new Set(['cohort', 'case-control', 'cross-sectional', 'qualitative']);
/** Designs that cannot carry a causal claim: the observational ones, plus theory and an unstated design. */
const NOT_CAUSAL: ReadonlySet<Design> = new Set([...OBSERVATIONAL, 'theory', 'other']);

export interface Evidence {
  id: string;
  kind: SourceKind;
  authors: string;
  year: string;
  title: string;
  venue: string;
  doi: string;
  url: string;
  question: string;
  design: Design;
  sample: string;
  /** Participants or units, when the study states it. */
  n?: number;
  variables: string;
  measures: string;
  analysis: string;
  finding: string;
  uncertainty: string;
  limitations: string;
  conflicts: string;
  relevance: string;
  quote: string;
  page: string;
  /** Text the student pasted from the original, used to check the quotation. */
  excerpt: string;
  screening: 'keep' | 'maybe' | 'exclude' | 'unscreened';
  screeningReason: string;
  originalOpened: boolean;
  verified: boolean;
}

export function blankEvidence(id: string): Evidence {
  return {
    id,
    kind: 'unverified',
    authors: '',
    year: '',
    title: '',
    venue: '',
    doi: '',
    url: '',
    question: '',
    design: 'other',
    sample: '',
    variables: '',
    measures: '',
    analysis: '',
    finding: '',
    uncertainty: '',
    limitations: '',
    conflicts: '',
    relevance: '',
    quote: '',
    page: '',
    excerpt: '',
    screening: 'unscreened',
    screeningReason: '',
    originalOpened: false,
    verified: false,
  };
}

export const citable = (kind: SourceKind) => kind !== 'ai-summary' && kind !== 'unverified';

/** Why this entry cannot be verified yet. Empty means it can. */
export function blockers(e: Evidence): string[] {
  const out: string[] = [];
  if (!e.originalOpened) out.push('Open the original source and confirm you read it.');
  if (e.kind === 'ai-summary') out.push('An AI summary is a navigation aid. Find and cite the original it summarized.');
  else if (e.kind === 'unverified') out.push('Say what kind of source this is.');
  if (!e.authors.trim()) out.push('Add the authors (or the organization).');
  if (!/^\d{4}[a-z]?$/.test(e.year.trim()) && e.year.trim().toLowerCase() !== 'n.d.') out.push('Add the year as four digits, or “n.d.”.');
  if (!e.title.trim()) out.push('Add the title.');
  if (e.quote.trim()) {
    if (e.excerpt.trim()) {
      if (!flatten(e.excerpt).includes(flatten(e.quote))) out.push('The quotation does not appear in the excerpt you pasted from the original.');
    } else if (!e.page.trim()) out.push('Add the page or location of the quotation, or paste the passage it comes from.');
  }
  if (e.screening === 'exclude') out.push('This source is excluded in screening.');
  return out;
}

export type VerifyResult = { ok: true; evidence: Evidence } | { ok: false; reasons: string[] };

export function verify(e: Evidence): VerifyResult {
  const reasons = blockers(e);
  return reasons.length ? { ok: false, reasons } : { ok: true, evidence: { ...e, verified: true } };
}

/**
 * Any edit to a field verification depends on clears `verified`. Otherwise a
 * student could verify an entry and then change its quotation.
 */
const RESETS: readonly (keyof Evidence)[] = ['kind', 'authors', 'year', 'title', 'quote', 'page', 'excerpt', 'originalOpened', 'screening'];

export function edit(e: Evidence, patch: Partial<Evidence>): Evidence {
  const next = { ...e, ...patch, id: e.id };
  if (RESETS.some((k) => k in patch && patch[k] !== e[k])) next.verified = false;
  if ('verified' in patch && patch.verified && blockers(next).length) next.verified = false;
  return next;
}

export function screen(e: Evidence, decision: Evidence['screening'], reason: string): { ok: true; evidence: Evidence } | { ok: false; reason: string } {
  if (decision === 'exclude' && !reason.trim()) return { ok: false, reason: 'Say why this source is excluded — screening needs a reason you can check later.' };
  return { ok: true, evidence: edit(e, { screening: decision, screeningReason: reason.trim() }) };
}

/** Things a reader should know about this study before leaning on it. */
export function cautions(e: Evidence): string[] {
  const out: string[] = [];
  if (e.kind === 'preprint') out.push('Preprint: not yet peer reviewed.');
  if (e.kind === 'news' || e.kind === 'commentary') out.push('Not primary research — find the study it reports on.');
  if (e.n !== undefined && e.n < 30) out.push(`Small sample (n = ${e.n}).`);
  if (e.conflicts.trim() && !/^(none|no|n\/a|none declared|none reported)\.?$/i.test(e.conflicts.trim())) out.push('Conflict of interest declared.');
  if (!e.limitations.trim()) out.push('No limitations recorded yet.');
  if (OBSERVATIONAL.has(e.design)) out.push('Observational design: supports association, not cause.');
  return out;
}

export interface Claim {
  id: string;
  text: string;
  evidence: string[];
}

const CAUSAL =
  /\b(causes?|caused|causing|leads? to|led to|results? in|resulted in|the effect of|effects? of [^.]{0,200} on|impacts?|improves?|reduces?|increases?|decreases?|because of|due to|drives?|prevents?)\b/i;

/** Wording that already says association, which a causal verb inside it does not undo. */
const HEDGED = /\b(associated with|associations? between|correlat\w*|linked (to|with)|predict\w*|related to)\b/i;

export const causalWording = (text: string) => CAUSAL.test(text) && !HEDGED.test(text);

export type ClaimStatus = 'verified' | 'unverified' | 'insufficient-evidence' | 'overclaim';

export interface Audit {
  claim: Claim;
  status: ClaimStatus;
  note: string;
  sources: Evidence[];
}

export function audit(claim: Claim, all: readonly Evidence[]): Audit {
  const linked = claim.evidence.map((id) => all.find((e) => e.id === id)).filter((e): e is Evidence => !!e && e.screening !== 'exclude');
  if (!linked.length) return { claim, status: 'insufficient-evidence', note: 'No evidence is linked to this claim.', sources: [] };
  const verified = linked.filter((e) => e.verified);
  if (!verified.length) return { claim, status: 'unverified', note: 'Linked sources are not verified against the original yet.', sources: linked };
  if (causalWording(claim.text) && verified.every((e) => NOT_CAUSAL.has(e.design)))
    return {
      claim,
      status: 'overclaim',
      note: 'The claim uses causal wording, but no verified source is an experiment. Consider “is associated with”.',
      sources: verified,
    };
  return { claim, status: 'verified', note: `${verified.length} verified source${verified.length === 1 ? '' : 's'}.`, sources: verified };
}

export const AUDIT_LABEL: Record<ClaimStatus, string> = {
  verified: 'Verified',
  unverified: 'Not verified',
  'insufficient-evidence': 'Insufficient evidence',
  overclaim: 'Check wording',
};

const need = (value: string, what: string) => value.trim() || `[${what} missing]`;

export type Style = 'apa' | 'mla' | 'chicago';

/** A reference in a common style, from exactly what was entered. */
export function reference(e: Evidence, style: Style): string {
  const authors = need(e.authors, 'authors');
  const year = need(e.year, 'year');
  const title = need(e.title, 'title');
  const venue = e.venue.trim();
  const link = e.doi.trim() ? `https://doi.org/${e.doi.trim().replace(/^https?:\/\/doi\.org\//, '')}` : e.url.trim();
  if (style === 'apa') return `${authors} (${year}). ${title}.${venue ? ` ${venue}.` : ''}${link ? ` ${link}` : ''}`;
  if (style === 'mla') return `${authors}. “${title}.”${venue ? ` ${venue},` : ''} ${year}.${link ? ` ${link}.` : ''}`;
  return `${authors}. ${year}. “${title}.”${venue ? ` ${venue}.` : ''}${link ? ` ${link}.` : ''}`;
}

const risType = (k: SourceKind) => (k === 'book' ? 'BOOK' : k === 'news' ? 'NEWS' : k === 'institutional-report' ? 'RPRT' : 'JOUR');

/** RIS for reference managers (Zotero, EndNote, Mendeley all read it). */
/*
 * One RIS line per field. A line break inside a value would end the field
 * early, and a value containing "ER  - " on its own line would start a
 * second, invented reference in the student's reference manager.
 */
const line = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export function ris(entries: readonly Evidence[]): string {
  return entries
    .filter((e) => citable(e.kind))
    .map((e) =>
      [
        `TY  - ${risType(e.kind)}`,
        ...e.authors
          .split(/;|\band\b/)
          .map(line)
          .filter(Boolean)
          .map((a) => `AU  - ${a}`),
        line(e.year) && `PY  - ${line(e.year)}`,
        line(e.title) && `TI  - ${line(e.title)}`,
        line(e.venue) && `JO  - ${line(e.venue)}`,
        line(e.doi) && `DO  - ${line(e.doi)}`,
        line(e.url) && `UR  - ${line(e.url)}`,
        !e.verified && 'N1  - Not yet verified against the original source',
        'ER  - ',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

const bibEscape = (s: string) => s.replace(/[{}\\]/g, '');

export function bibtex(entries: readonly Evidence[]): string {
  return entries
    .filter((e) => citable(e.kind))
    .map((e, i) => {
      const key = `${(e.authors.split(/[,\s;]/)[0] || 'source').replace(/[^A-Za-z]/g, '').toLowerCase() || 'source'}${e.year.replace(/\D/g, '') || i + 1}`;
      const fields = [
        e.authors.trim() && `  author = {${bibEscape(e.authors.replace(/;/g, ' and '))}}`,
        e.title.trim() && `  title = {${bibEscape(e.title)}}`,
        e.year.trim() && `  year = {${bibEscape(e.year)}}`,
        e.venue.trim() && `  journal = {${bibEscape(e.venue)}}`,
        e.doi.trim() && `  doi = {${bibEscape(e.doi)}}`,
        e.url.trim() && `  url = {${bibEscape(e.url)}}`,
        !e.verified && '  note = {Not yet verified against the original source}',
      ].filter(Boolean);
      return `@${e.kind === 'book' ? 'book' : 'article'}{${key},\n${fields.join(',\n')}\n}`;
    })
    .join('\n\n');
}

export interface Project {
  id: string;
  question: string;
  concepts: string;
  synonyms: string;
  databases: string;
  dateRange: string;
  include: string;
  exclude: string;
  evidence: Evidence[];
  claims: Claim[];
}

/** A Boolean search string built from the concept and synonym lists — one OR group per line. */
export function searchString(concepts: string, synonyms: string): string {
  const groups = concepts
    .split('\n')
    .map((c, i) => [c, ...(synonyms.split('\n')[i] ?? '').split(',')].map((w) => w.trim()).filter(Boolean))
    .filter((g) => g.length);
  return groups.map((g) => `(${g.map((w) => (/\s/.test(w) ? `"${w}"` : w)).join(' OR ')})`).join(' AND ');
}

const KINDS = new Set(SOURCE_KINDS.map(([k]) => k));
const DESIGN_SET = new Set(DESIGNS.map(([d]) => d));

function readEvidence(v: unknown): Evidence {
  if (!obj(v) || !textValue(v.id, 80)) throw new Error('An evidence entry is malformed.');
  const base = blankEvidence(v.id);
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof Evidence)[]) {
    const value = v[key];
    if (typeof base[key] === 'string' && textValue(value, 40_000)) out[key] = value;
  }
  out.kind = KINDS.has(v.kind as SourceKind) ? v.kind : 'unverified';
  out.design = DESIGN_SET.has(v.design as Design) ? v.design : 'other';
  out.screening = ['keep', 'maybe', 'exclude', 'unscreened'].includes(v.screening as string) ? v.screening : 'unscreened';
  out.n = finite(v.n, 0, 1e9) ? v.n : undefined;
  out.originalOpened = v.originalOpened === true;
  const evidence = out as unknown as Evidence;
  // Re-check on the way in: a hand-edited file cannot carry a verification its fields do not earn.
  evidence.verified = v.verified === true && blockers(evidence).length === 0;
  return evidence;
}

export function readProjects(value: unknown): Project[] {
  if (!Array.isArray(value)) throw new Error('Research projects are not a list.');
  return value.map((p) => {
    if (!obj(p) || !textValue(p.id, 80)) throw new Error('A research project is malformed.');
    const str = (k: string) => (textValue(p[k], 20_000) ? (p[k] as string) : '');
    return {
      id: p.id,
      question: str('question'),
      concepts: str('concepts'),
      synonyms: str('synonyms'),
      databases: str('databases'),
      dateRange: str('dateRange'),
      include: str('include'),
      exclude: str('exclude'),
      evidence: Array.isArray(p.evidence) ? p.evidence.map(readEvidence) : [],
      claims: Array.isArray(p.claims)
        ? p.claims.filter(obj).map((c) => ({
            id: textValue(c.id, 80) ? c.id : '',
            text: textValue(c.text, 5000) ? c.text : '',
            evidence: Array.isArray(c.evidence) ? c.evidence.filter((x): x is string => textValue(x, 80)) : [],
          }))
        : [],
    };
  });
}
