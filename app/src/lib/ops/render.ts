/**
 * The small amount of Markdown the operating registers share when they render
 * themselves: escaping a cell, laying out a table, and the control line every
 * controlled document carries.
 *
 * Nothing here decides anything. The data modules beside it decide; the tests
 * beside those hold the data to the tree and write the pages.
 */

import { dirname, relative } from 'node:path';

/** The single source of truth, at the repository root. */
export const OPERATING_SYSTEM = 'SEMESTER-OPERATING-SYSTEM.md';

/** A table cell: pipes escaped, one line. */
export const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** A Markdown table. Rows are already strings; `cell` them first if they may hold pipes. */
export function table(headers: readonly string[], rows: readonly (readonly string[])[], align: readonly ('left' | 'right')[] = []): string[] {
  const rule = headers.map((_, i) => (align[i] === 'right' ? '---:' : '---'));
  return [`| ${headers.join(' | ')} |`, `| ${rule.join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)];
}

/** A relative link from the document at `from` to the file at `to`, both repository-relative. */
export function link(from: string, to: string): string {
  return relative(dirname(from), to).split('\\').join('/');
}

/**
 * The line every controlled document displays, so that a reader of any of
 * them can find its owner, version, review dates, status, what it supersedes
 * and the decisions behind it without knowing where else to look. The values
 * live in one place on purpose: a control block copied into each document is
 * a control block that drifts.
 */
export function controlLine(from: string): string {
  return `> Owner, version, last and next review, status, supersedes and related decisions: [\`${OPERATING_SYSTEM}\`](${link(from, OPERATING_SYSTEM)}).`;
}

/** The comment a rendered page opens with. */
export function renderedFrom(module: string, test: string): string {
  return `<!-- Rendered from ${module} by ${test}. Edit the data, then run \`npm run registers\` from app/. -->`;
}

/** `2026-09-28` and nothing else. */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isIsoDate = (s: string): boolean => ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
