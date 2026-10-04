import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unsupportedClaims } from '../gtm/rfp';
import { EXERCISES, PLAYBOOKS } from './incidentplaybooks';
import { QUESTIONS } from './riskreview';
import { OPERATING_SYSTEM } from './render';
import { CONTROLS } from './trustcontrols';
import { REQUIREMENTS } from './trustdomains';
import { ITEMS } from './trustremediation';

/**
 * The pages in `docs/integrated-trust/`, held to the tree.
 *
 * Seven of them are hand-written, and a hand-written page drifts in the ways a
 * generated one cannot: a link to a file that moved, an anchor that no longer
 * matches its heading, a reference to an item, control or playbook that was
 * renumbered, a count in a sentence that no longer matches the data, a word
 * that asserts an outside party's judgement. This test reads every page in the
 * directory, rendered or not, and fails on each of those.
 *
 * The identifiers are the strongest check. `RM-27` in a sentence is only
 * useful if item RM-27 says what the sentence needs it to, and the cheapest
 * way for that to break is a renumbering nobody searched for.
 */

const root = join(import.meta.dirname, '../../../..');
const dir = join(root, 'docs/integrated-trust');
const pages = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
const read = (f: string) => readFileSync(join(dir, f), 'utf8');

/** GitHub's heading anchor. */
export function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

const headings = (text: string): string[] =>
  text
    .split('\n')
    .filter((l) => /^#{1,6} /.test(l))
    .map((l) => slug(l.replace(/^#{1,6} /, '')));

/** The text with fenced code removed, so a sample record is not read as a claim. */
const prose = (text: string) => text.replace(/```[\s\S]*?```/g, '');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = (n: number): string => (n <= 20 ? WORDS[n] : n < 100 ? ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty'][Math.floor(n / 10)] + (n % 10 ? `-${WORDS[n % 10]}` : '') : String(n));

describe('integrated trust pages', () => {
  it('include every page the index lists, and the index lists every page', () => {
    const readme = read('README.md');
    for (const p of pages.filter((x) => x !== 'README.md')) expect(readme, `README does not list ${p}`).toContain(`(${p})`);
    for (const m of readme.matchAll(/\]\(([A-Z-]+\.md)\)/g)) expect(pages, `README lists ${m[1]}, which does not exist`).toContain(m[1]);
  });

  for (const page of pages) {
    describe(page, () => {
      const text = read(page);

      it('opens with a title and the control line', () => {
        expect(text.startsWith('# ')).toBe(true);
        expect(text).toContain(OPERATING_SYSTEM);
      });

      it('links only to files and headings that exist', () => {
        const bad: string[] = [];
        for (const m of prose(text).matchAll(/\]\(([^)\s]+)\)/g)) {
          const target = m[1];
          if (/^(https?:|mailto:)/.test(target)) continue;
          const [file, anchor] = target.split('#');
          const path = file === '' ? join(dir, page) : normalize(join(dir, file));
          if (!existsSync(path)) {
            bad.push(`${target}: no such file`);
            continue;
          }
          if (anchor && statSync(path).isFile() && path.endsWith('.md')) {
            if (!headings(readFileSync(path, 'utf8')).includes(anchor)) bad.push(`${target}: no heading "${anchor}" in ${file || page}`);
          }
        }
        expect(bad).toEqual([]);
      });

      it('mentions only items, controls, playbooks, exercises and questions that exist', () => {
        const body = prose(text);
        const known = {
          RM: new Set(ITEMS.map((i) => i.id)),
          TC: new Set(CONTROLS.map((c) => c.id)),
          IR: new Set(PLAYBOOKS.map((p) => p.id)),
          TT: new Set(EXERCISES.map((e) => e.id)),
          RR: new Set(QUESTIONS.map((q) => q.id)),
        };
        const bad: string[] = [];
        for (const m of body.matchAll(/\b(RM-\d{2}|TC-[A-Z0-9]{2,3}-\d{2}|IR-\d{2}|TT-\d{2}|RR-[A-Z0-9]{2,3}-\d)\b/g)) {
          const id = m[1];
          const kind = id.slice(0, 2) as keyof typeof known;
          if (!known[kind].has(id)) bad.push(id);
        }
        // Ranges such as "RR-A11-1 to 3" and "TC-TSF-03 to 05" name their first id, which is checked above.
        expect([...new Set(bad)]).toEqual([]);
      });

      it('asserts no certification, conformance, guarantee or real-time claim that is not negated', () => {
        // Link targets and code spans are paths and identifiers (docs/compliance/...), not assertions.
        const asserted = prose(text).replace(/\]\([^)]*\)/g, '](…)').replace(/`[^`]*`/g, '``');
        expect(unsupportedClaims(asserted)).toEqual([]);
      });
    });
  }

  it('states counts that match the data', () => {
    const readme = read('README.md');
    expect(readme).toContain(`${word(ITEMS.length)[0].toUpperCase()}${word(ITEMS.length).slice(1)} items`);
    expect(readme).toContain(`${word(PLAYBOOKS.length)[0].toUpperCase()}${word(PLAYBOOKS.length).slice(1)} scenarios`);
    expect(readme).toContain(`${word(EXERCISES.length)[0].toUpperCase()}${word(EXERCISES.length).slice(1)} exercises`);
    expect(read('THREAT-MODELS.md').match(/^## T\d\./gm)?.length).toBe(8);
    expect(readme).toContain('Eight models');
    expect(REQUIREMENTS.length).toBe(13);
  });

});
