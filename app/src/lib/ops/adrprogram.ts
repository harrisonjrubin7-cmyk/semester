import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

/**
 * Holds the ADR program in `docs/decisions/` to its own rules (ADR-0001,
 * `docs/governance/ADR_REVIEW_POLICY.md`).
 *
 * `ADR-nnnn` is a second namespace beside `D-<pull request>` (see
 * `decisionlog.ts`) and beside the older `docs/architecture/NNNN-*.md`
 * records, which are cited by a bare number and held by
 * `operatingsystem.test.ts`. The prefix is what keeps `ADR-0004` (the program's
 * RLS-bypass decision) from being read as `docs/architecture/0004-*` (AI through
 * a metered gateway), so this check also refuses a program ADR that cites an
 * ADR number that does not exist.
 *
 * Read by `adrprogram.test.ts`; nothing the app ships imports it.
 */

export const ADR_ROOT = 'docs/decisions';
export const FOLDERS = ['proposed', 'accepted', 'superseded', 'deprecated'] as const;
export type Folder = (typeof FOLDERS)[number];

/** Which Status values belong in which folder. Moving a file changes its status. */
export const STATUS_IN: Record<Folder, string[]> = {
  proposed: ['Proposed', 'Researching', 'Review Required'],
  accepted: ['Accepted', 'Implemented', 'Verified'],
  superseded: ['Superseded'],
  deprecated: ['Deprecated'],
};

export interface AdrFile {
  /** Repo-relative, e.g. `docs/decisions/proposed/ADR-0001-x.md`. */
  path: string;
  folder: Folder;
  /** `proposed/ADR-0001-x.md`, the form the index and backlog link. */
  rel: string;
  file: string;
  text: string;
}

export const FILE = /^ADR-(\d{4})-[a-z0-9][a-z0-9-]*\.md$/;

export function readAdrs(root: string): AdrFile[] {
  const out: AdrFile[] = [];
  for (const folder of FOLDERS) {
    const dir = join(root, ADR_ROOT, folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.md')) continue;
      out.push({
        path: `${ADR_ROOT}/${folder}/${file}`,
        folder,
        rel: `${folder}/${file}`,
        file,
        text: readFileSync(join(dir, file), 'utf8'),
      });
    }
  }
  return out;
}

const field = (text: string, name: string): string | undefined =>
  new RegExp(`^\\| ${name} \\| (.+?) \\|$`, 'm').exec(text)?.[1].trim();

/** Every `](target)` that points at a file, with any `#anchor` removed. */
export function fileLinks(text: string): string[] {
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1])
    .filter((t) => !/^(https?:|mailto:|#)/.test(t))
    .map((t) => t.split('#')[0])
    .filter(Boolean);
}

export interface Inputs {
  adrs: AdrFile[];
  index: string;
  backlog: string;
  /** Whether a repo-relative path exists. */
  exists: (path: string) => boolean;
}

/** Everything wrong with the program's ADRs, one sentence each. Empty is clean. */
export function problems({ adrs, index, backlog, exists }: Inputs): string[] {
  const out: string[] = [];
  const numbers = new Map<string, string[]>();

  for (const a of adrs) {
    const m = FILE.exec(a.file);
    if (!m) {
      out.push(`${a.path}: not named ADR-<four digits>-<slug>.md`);
      continue;
    }
    const n = m[1];
    numbers.set(n, [...(numbers.get(n) ?? []), a.path]);

    const heading = /^# ADR-(\d{4}) · /m.exec(a.text)?.[1];
    if (heading !== n) out.push(`${a.path}: heading is ADR-${heading ?? '?'}, the file is ADR-${n}`);

    const status = field(a.text, 'Status');
    if (!status || !STATUS_IN[a.folder].includes(status)) {
      out.push(`${a.path}: Status "${status ?? 'missing'}" does not belong in ${a.folder}/ (${STATUS_IN[a.folder].join(', ')})`);
    }

    for (const target of fileLinks(a.text)) {
      const resolved = normalize(join(dirname(a.path), target));
      if (!exists(resolved)) out.push(`${a.path}: link to ${target} resolves to ${resolved}, which does not exist`);
    }

    // Accepted or later needs a way to tell it works (ADR_REVIEW_POLICY, rule 3).
    if (a.folder !== 'proposed' && a.folder !== 'deprecated' && !/^## Fitness functions\s*\n\s*\S/m.test(a.text)) {
      out.push(`${a.path}: ${a.folder}/ needs a Fitness functions section with content`);
    }
  }

  for (const [n, paths] of numbers) {
    if (paths.length > 1) out.push(`ADR-${n} is written ${paths.length} times: ${paths.join(', ')}`);
  }

  // A cited ADR must exist. The prefix keeps this apart from docs/architecture/NNNN.
  const known = new Set(numbers.keys());
  const citing: [string, string][] = [
    ...adrs.map((a): [string, string] => [a.path, a.text]),
    [`${ADR_ROOT}/ADR_INDEX.md`, index],
    [`${ADR_ROOT}/DECISION_BACKLOG.md`, backlog],
  ];
  for (const [where, text] of citing) {
    for (const m of text.matchAll(/\bADR-(\d{4})\b/g)) {
      if (!known.has(m[1])) out.push(`${where}: cites ADR-${m[1]}, which does not exist`);
    }
  }

  for (const [name, text] of [['ADR_INDEX.md', index], ['DECISION_BACKLOG.md', backlog]] as const) {
    for (const a of adrs) {
      if (!text.includes(`(${a.rel})`)) out.push(`${ADR_ROOT}/${name}: does not link ${a.rel}, so a moved or new ADR is missing from it`);
    }
  }
  return out;
}
