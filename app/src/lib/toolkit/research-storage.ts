import { flatten } from '../cite';
import { finite, obj, textValue } from '../device-library';
import { DESIGN_IDS, SOURCE_KIND_IDS, type Design, type SourceKind } from './research-ids';

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

export type VerificationIssue =
  | 'original-not-opened'
  | 'ai-summary'
  | 'unverified-kind'
  | 'missing-authors'
  | 'invalid-year'
  | 'missing-title'
  | 'quote-not-in-excerpt'
  | 'quote-location-missing'
  | 'excluded';

export function verificationIssues(e: Evidence): VerificationIssue[] {
  const out: VerificationIssue[] = [];
  if (!e.originalOpened) out.push('original-not-opened');
  if (e.kind === 'ai-summary') out.push('ai-summary');
  else if (e.kind === 'unverified') out.push('unverified-kind');
  if (!e.authors.trim()) out.push('missing-authors');
  if (!/^\d{4}[a-z]?$/.test(e.year.trim()) && e.year.trim().toLowerCase() !== 'n.d.') out.push('invalid-year');
  if (!e.title.trim()) out.push('missing-title');
  if (e.quote.trim()) {
    if (e.excerpt.trim()) {
      if (!flatten(e.excerpt).includes(flatten(e.quote))) out.push('quote-not-in-excerpt');
    } else if (!e.page.trim()) out.push('quote-location-missing');
  }
  if (e.screening === 'exclude') out.push('excluded');
  return out;
}

export interface Claim {
  id: string;
  text: string;
  evidence: string[];
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

const KINDS = new Set(SOURCE_KIND_IDS);
const DESIGN_SET = new Set(DESIGN_IDS);

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
  evidence.verified = v.verified === true && verificationIssues(evidence).length === 0;
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
