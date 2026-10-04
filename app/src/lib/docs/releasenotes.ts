/**
 * Release notes, from the changelog.
 *
 * `CHANGELOG.md` is the running record of everything a tester can notice, one
 * `###` entry at a time, written in the pull request that made the change.
 * A release note is the curated cut of it that goes to a cohort or an
 * institution on a date. This module is the seam between them: it reads the
 * changelog, drafts a note whose headings are copied from it exactly, and
 * checks a finished note against it — so a note cannot name a change the
 * changelog does not hold, and a draft cannot be published with its
 * to-dos still in it.
 *
 * Pure: the commit and the date are arguments. `scripts/release-draft.mjs` is
 * the part that asks git.
 */

export interface ChangelogEntry {
  /** The `##` section it sits in: `Unreleased`, `2026-09-17`, … */
  section: string;
  /** The `###` heading, verbatim. */
  heading: string;
  /** Everything under the heading up to the next heading. */
  body: string;
}

export function parseChangelog(text: string): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  let section = '';
  let cur: ChangelogEntry | null = null;
  for (const line of text.split('\n')) {
    const h2 = /^## (.+?)\s*$/.exec(line);
    const h3 = /^### (.+?)\s*$/.exec(line);
    if (h2) { section = h2[1]; cur = null; continue; }
    if (h3 && section) { cur = { section, heading: h3[1], body: '' }; out.push(cur); continue; }
    if (cur) cur.body += `${line}\n`;
  }
  for (const e of out) e.body = e.body.trim();
  return out;
}

/** The first paragraph of an entry: what a reader needs before deciding to read on. */
export const lead = (body: string): string => body.split(/\n\s*\n/)[0].replace(/\s*\n\s*/g, ' ').trim();

export const EDIT = 'TODO(edit)';

/** The classes of change `docs/releases/CHANGE-COMMUNICATION.md` sorts a change into, least to most to say. */
export const CHANGE_CLASSES = ['invisible', 'visible', 'behaviour', 'breaking', 'activation', 'security', 'incident'] as const;

export const SECTIONS = ['What you need to do', 'What changed', 'Known problems', 'Who to ask'] as const;

export function draftNote(input: { date: string; commit: string; entries: readonly ChangelogEntry[] }): string {
  const { date, commit, entries } = input;
  return [
    `# Release note: ${date}`,
    '',
    `> **Type:** release · **Audience:** students, institution-admins · **Owner:** \`product\` · **Truth:** reviewed · **Reviewed:** ${date} · **Held by:** —`,
    '',
    `${EDIT} one sentence: what this release changes for the person reading, and whether they must do anything.`,
    '',
    `**Cut from:** \`${commit}\``,
    '',
    '## What you need to do',
    '',
    `${EDIT} "Nothing." or the exact action and the date it matters.`,
    '',
    '## What changed',
    '',
    ...entries.flatMap((e) => [`### ${e.heading}`, '', `${lead(e.body)} ${EDIT} keep, shorten or remove this change; say what got worse or was taken away.`, '']),
    '## Known problems',
    '',
    `${EDIT} anything shipped that does not work as described, and the workaround. "None known." is an answer only if someone looked.`,
    '',
    '## Who to ask',
    '',
    `${EDIT} the support route, with its status stated honestly (see docs/support/README.md).`,
    '',
  ].join('\n');
}

const SHA = /^\*\*Cut from:\*\* `([0-9a-f]{7,40})`$/m;

/** What is wrong with a finished note, against the changelog it claims to cut. */
export function checkNote(text: string, changelog: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  if (text.includes(EDIT)) problems.push(`still contains ${EDIT}`);
  if (!SHA.test(text)) problems.push('has no `**Cut from:** `<commit>`` line with a 7–40 character hex commit');
  let last = -1;
  for (const s of SECTIONS) {
    const at = text.indexOf(`\n## ${s}\n`);
    if (at < 0) problems.push(`has no "## ${s}" section`);
    else if (at < last) problems.push(`"## ${s}" is out of order`);
    else last = at;
  }
  const changed = /\n## What changed\n([\s\S]*?)(?=\n## |$)/.exec(text)?.[1] ?? '';
  const headings = [...changed.matchAll(/^### (.+?)\s*$/gm)].map((m) => m[1]);
  if (headings.length === 0) problems.push('"What changed" lists no change');
  for (const h of headings) if (!changelog.has(h)) problems.push(`"${h}" is not a heading in CHANGELOG.md`);
  const need = /\n## What you need to do\n([\s\S]*?)(?=\n## |$)/.exec(text)?.[1].trim() ?? '';
  if (need === '') problems.push('"What you need to do" is empty; the answer may be "Nothing."');
  return problems;
}
