/**
 * The documentation system's one definition of "a governed page" and of the
 * line at the top of it — its card.
 *
 * `docs/documentation/README.md` is the prose half: why the card exists and
 * what each field means. This is the part a gate can run. Everything that
 * reads a card (the gate, the generated index, `scripts/docs-stale.mjs`) calls
 * `parseCard` here, so there is exactly one opinion about what a valid card is.
 *
 * Pure: reads files it is handed, never the clock, the network or git.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SEATS } from '../launchreadiness.ts';

export const TYPES = ['tutorial', 'how-to', 'reference', 'explanation', 'runbook', 'help', 'release'] as const;
export type DocType = (typeof TYPES)[number];

export const AUDIENCES = [
  'students', 'families', 'faculty', 'institution-admins', 'implementers',
  'partner-developers', 'contributors', 'operators', 'support', 'buyers', 'security-reviewers',
] as const;
export type DocAudience = (typeof AUDIENCES)[number];

export const TRUTHS = ['generated', 'held', 'reviewed'] as const;
export type DocTruth = (typeof TRUTHS)[number];

/**
 * Days after `Reviewed` before a page is due again. A reference or runbook is
 * read mid-task and goes wrong fastest; an explanation ages slowly. These are
 * reported by `npm run docs:stale`, never failed by a test — a test that
 * fails because the calendar moved is a time bomb, not a guard.
 */
export const REVIEW_DAYS: Record<DocType, number> = {
  reference: 92, 'how-to': 92, runbook: 92, help: 92, release: 366, tutorial: 183, explanation: 183,
};

export interface Card {
  type: DocType;
  audience: DocAudience[];
  owner: string;
  truth: DocTruth;
  reviewed: string;
  heldBy: string | null;
}

export interface CardProblem { problem: string }

/**
 * Words that sell rather than say. Each one has a plainer word or no word, and
 * the style guide lists the plainer word. Matched on whole words in prose only,
 * so a code sample or a quoted UI label that happens to contain one is not hit.
 */
export const FILLER = [
  'simply', 'easily', 'effortless', 'effortlessly', 'seamless', 'seamlessly', 'powerful', 'robust',
  'cutting-edge', 'world-class', 'best-in-class', 'revolutionary', 'game-changing', 'leverage', 'utilize',
  'blazing', 'delightful', 'magical', 'next-generation',
];

/** Directories whose every Markdown file is governed, relative to the repository root. */
export const GOVERNED_DIRS = [
  'docs/documentation', 'docs/developers', 'docs/reference', 'docs/guides', 'docs/help',
  'docs/support', 'docs/releases', 'examples',
] as const;

/** Single files that are governed although their directory is not. */
export const GOVERNED_FILES = [
  'docs/README.md', 'CONTRIBUTING.md',
  'docs/trust/DOCUMENT-MAP.md', 'docs/trust/SECURITY-OVERVIEW.md', 'docs/trust/CONTROL-FACTS.md', 'docs/trust/REVIEWER-QUESTION-MAP.md',
] as const;

/** Markdown under a governed directory that is a skeleton, not a page. */
const isTemplate = (rel: string) => rel.startsWith('docs/documentation/templates/');

export function walk(root: string, dir: string): string[] {
  let names: string[];
  try { names = readdirSync(join(root, dir)); } catch { return []; }
  return names.sort().flatMap((n) => {
    const rel = `${dir}/${n}`;
    if (n === 'node_modules') return [];
    return statSync(join(root, rel)).isDirectory() ? walk(root, rel) : [rel];
  });
}

/** Every governed page that exists, repository-relative, sorted. Templates included: they are held to the same card. */
export function governedPages(root: string): string[] {
  const fromDirs = GOVERNED_DIRS.flatMap((d) => walk(root, d)).filter((f) => f.endsWith('.md'));
  const files = GOVERNED_FILES.filter((f) => {
    try { return statSync(join(root, f)).isFile(); } catch { return false; }
  });
  return [...new Set([...fromDirs, ...files])].sort();
}

export const isTemplatePage = isTemplate;

const FIELD = /\*\*([A-Za-z ]+):\*\*\s*([^·]+?)\s*(?:·|$)/g;

/**
 * Reads the card from a page's text: the first line after the title that
 * starts `> **Type:**`. The card must be the page's third line (title, blank,
 * card) — a card that can float anywhere is a card nobody can rely on finding.
 */
export function parseCard(text: string): { card: Card | null; problems: string[] } {
  const lines = text.split('\n');
  const problems: string[] = [];
  if (!/^# \S/.test(lines[0] ?? '')) problems.push('line 1 is not a `# Title`');
  if ((lines[1] ?? '') !== '') problems.push('line 2 is not blank');
  const raw = lines[2] ?? '';
  if (!raw.startsWith('> **Type:**')) {
    problems.push('line 3 is not the card (`> **Type:** …`)');
    return { card: null, problems };
  }
  const fields = new Map<string, string>();
  for (const m of raw.slice(2).matchAll(FIELD)) fields.set(m[1].trim().toLowerCase(), m[2].trim());
  for (const f of ['type', 'audience', 'owner', 'truth', 'reviewed', 'held by']) {
    if (!fields.has(f)) problems.push(`card has no ${f}`);
  }
  const type = fields.get('type') as DocType | undefined;
  if (type && !TYPES.includes(type)) problems.push(`type "${type}" is not one of ${TYPES.join(', ')}`);
  const audience = (fields.get('audience') ?? '').split(',').map((s) => s.trim()).filter(Boolean) as DocAudience[];
  for (const a of audience) if (!AUDIENCES.includes(a)) problems.push(`audience "${a}" is not one of the controlled values`);
  if (fields.has('audience') && audience.length === 0) problems.push('audience is empty');
  const owner = (fields.get('owner') ?? '').replace(/`/g, '');
  if (fields.has('owner') && !(SEATS as readonly string[]).includes(owner)) problems.push(`owner "${owner}" is not a council seat (${SEATS.join(', ')})`);
  const truth = fields.get('truth') as DocTruth | undefined;
  if (truth && !TRUTHS.includes(truth)) problems.push(`truth "${truth}" is not one of ${TRUTHS.join(', ')}`);
  const reviewed = fields.get('reviewed') ?? '';
  if (fields.has('reviewed') && !(/^\d{4}-\d{2}-\d{2}$/.test(reviewed) && !Number.isNaN(Date.parse(`${reviewed}T00:00:00Z`)))) {
    problems.push(`reviewed "${reviewed}" is not a YYYY-MM-DD date`);
  }
  const heldRaw = (fields.get('held by') ?? '').replace(/`/g, '').trim();
  const heldBy = heldRaw === '—' || heldRaw === '' ? null : heldRaw;
  if (problems.length > 0 || !type || !truth) return { card: null, problems };
  return { card: { type, audience, owner, truth, reviewed, heldBy }, problems };
}

/** Relative Markdown links in prose (code spans and fences are not links), with any `#fragment`. */
export function relativeLinks(text: string): { target: string; path: string; fragment: string | null }[] {
  const prose = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const out: { target: string; path: string; fragment: string | null }[] = [];
  for (const m of prose.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|tel:)/.test(target)) continue;
    const [path, fragment] = target.split('#');
    out.push({ target, path, fragment: fragment ?? null });
  }
  return out;
}

/** GitHub's heading anchor: lowercase, punctuation dropped, spaces to hyphens. */
export function slug(heading: string): string {
  return heading.trim().toLowerCase().replace(/`/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
}

export function headingSlugs(text: string): Set<string> {
  const body = text.replace(/```[\s\S]*?```/g, '');
  const seen = new Map<string, number>();
  const out = new Set<string>();
  for (const m of body.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slug(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

export const read = (root: string, rel: string): string => readFileSync(join(root, rel), 'utf8');
export const relFrom = (root: string, abs: string): string => relative(root, abs).split('\\').join('/');
