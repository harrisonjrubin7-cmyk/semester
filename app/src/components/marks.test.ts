import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/*
 * Blueprint's own rule, quoted from its `plain` doc comment:
 *
 *   "The marks say 'this is a framed object', which is true of a hero card and
 *    false of the fourth row in a list. Ten stacked cards put forty little
 *    crosses on the screen, they collide across the gaps between rows, and what
 *    was a signature becomes texture you have to read past. Feature cards keep
 *    them; repeated rows set this."
 *
 * The rule is easy to state and easy to forget, and forgetting it is invisible
 * in review — one more `<Blueprint>` in a `.map()` reads fine in the diff and
 * puts four more crosses on the screen. So it is checked here rather than
 * trusted: a Blueprint rendered inside a `.map()` is a repeated row and sets
 * `plain`, unless it is listed as a deliberate exception below.
 */

/** Feature cards that sit inside a `.map()` and still earn their marks. */
const HEROES = new Set([
  // One summary card per course, under its own SectionLabel and on the hero
  // background. Sections, not rows — nothing stacks against anything.
  'src/screens/Grades.tsx',
]);

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (path.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/**
 * Whether the tag at `at` is rendered inside a `.map()` callback: walk outward
 * through every enclosing bracket and look for one that opens a `.map(` call.
 */
function insideRepeat(text: string, at: number): boolean {
  let depth = 0;
  for (let i = at - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === ')' || ch === '}' || ch === ']') depth += 1;
    else if (ch === '(' || ch === '{' || ch === '[') {
      if (depth > 0) depth -= 1;
      else if (ch === '(' && /\.(map|flatMap)\s*$/.test(text.slice(Math.max(0, i - 30), i))) return true;
    }
  }
  return false;
}

/** The opening tag's text, from `<Blueprint` to the `>` that closes it. */
function openingTag(text: string, at: number): string {
  let depth = 0;
  for (let i = at; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return text.slice(at, i);
  }
  return '';
}

type Site = { file: string; line: number; repeated: boolean; plain: boolean };

const sites: Site[] = [];
for (const file of tsxFiles('src')) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/<Blueprint\b/g)) {
    const at = match.index;
    sites.push({
      file,
      line: text.slice(0, at).split('\n').length,
      repeated: insideRepeat(text, at),
      plain: /\bplain\b/.test(openingTag(text, at)),
    });
  }
}

describe('registration marks', () => {
  it('finds the Blueprints to check', () => {
    // Guards the scan itself: a regex that stopped matching would make every
    // assertion below pass on an empty list.
    expect(sites.length).toBeGreaterThan(100);
    expect(sites.filter((s) => s.repeated).length).toBeGreaterThan(20);
  });

  it('drops the marks on every repeated row', () => {
    const bare = sites
      .filter((s) => s.repeated && !s.plain && !HEROES.has(s.file))
      .map((s) => `${s.file}:${s.line}`);
    expect(bare).toEqual([]);
  });

  it('keeps every listed exception a real one', () => {
    // An exception that stopped being a Blueprint-in-a-map is stale, and a
    // stale entry silently excuses the next row added to that file.
    for (const file of HEROES) {
      expect(sites.some((s) => s.file === file && s.repeated), `${file} is listed as a hero but has no Blueprint inside a map`).toBe(true);
    }
  });
});
