import { describe, expect, it } from 'vitest';
import { TASKS, build, check, toMarkdown } from './guidebook';
import { buildGuide, complaint } from '../../scripts/build-guide';
import { DESTINATIONS } from './nav';
import { SHORTCUTS } from './keys';

/**
 * The grounding checks, run where CI will actually see them.
 *
 * This file is the enforcement the guide rests on. Everything in the guide is
 * either lifted from the registry or checked against it, and the failure this
 * exists to prevent is the quiet one: a screen added, the guide not updated,
 * and six months later a guide that describes an app nobody is using.
 *
 * The tests below are the four grounding rules, plus the two properties that
 * make the rules worth having — that adding a screen changes the guide, and
 * that removing one fails rather than passing silently.
 */

describe('the four grounding rules', () => {
  it('agrees with the app as it stands', () => {
    // If this fails, read the message: it names what disagrees.
    const out = buildGuide();
    expect(out.problems, complaint(out.problems)).toEqual([]);
  });

  it('has exactly one entry per screen in Every screen', () => {
    const body = build().sections.find((s) => s.id === 'screens')?.body ?? '';
    const headings = [...body.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    expect(headings).toHaveLength(DESTINATIONS.length);
    expect(new Set(headings).size).toBe(headings.length);
    for (const d of DESTINATIONS) expect(headings, d.screen).toContain(d.label);
  });

  it('names no screen that is not in the registry', () => {
    const known = new Set(DESTINATIONS.map((d) => d.screen));
    for (const s of build().claims.screens) expect(known, s).toContain(s);
    // Including the task routes, which are the hand-written part most likely
    // to name a screen that has since been renamed.
    for (const t of TASKS) for (const s of t.steps) expect(known, `${t.task} → ${s}`).toContain(s);
  });

  it('documents no shortcut that is not bound', () => {
    const bound = new Set(SHORTCUTS.map((s) => s.key));
    for (const k of build().claims.shortcuts) expect(bound, k).toContain(k);
  });
});

describe('what happens when the app changes', () => {
  /**
   * A registry with one more screen in it.
   *
   * Mutating the real array and putting it back is the only way to test this
   * without a seam nothing else needs — and the point being tested is that the
   * check reads the live registry rather than a copy taken at import time.
   */
  const withExtra = <T>(run: () => T): T => {
    DESTINATIONS.push({
      screen: 'proof' as never,
      label: 'A screen the guide has never heard of',
      blurb: 'Added by a test.',
      keywords: 'test',
      group: 'Yours',
      root: 'me',
    });
    try {
      return run();
    } finally {
      DESTINATIONS.pop();
    }
  };

  it('fails when a screen is in the registry and not in the guide', () => {
    /*
     * Acceptance criterion 1 from the other side: the check has to be able to
     * fail, or passing means nothing.
     *
     * The book is built *before* the screen is added, which is the real
     * situation — a guide written against yesterday's registry checked
     * against today's. Building afterwards would include the new screen in
     * both halves and prove only that the two agree with each other.
     */
    const stale = build();
    const problems = withExtra(() => check(stale));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toContain('A screen the guide has never heard of');
  });

  it('adds a screen to the guide when one is added to the registry', () => {
    // Acceptance criterion 2. The entry appears without anybody writing it.
    const body = withExtra(
      () => build().sections.find((s) => s.id === 'screens')?.body ?? '',
    );
    expect(body).toContain('A screen the guide has never heard of');
    expect(body).toContain('Added by a test.');
  });

  it('says what disagrees rather than that something does', () => {
    const said = complaint(['"Maps" (maps) is in the registry and not in the guide.']);
    expect(said).toContain('Maps');
    expect(said).toContain('src/lib/guidebook.ts');
  });
});

describe('the shape of the thing', () => {
  it('has the eight sections the guide is meant to have', () => {
    const ids = build().sections.map((s) => s.id);
    expect(ids[0]).toBe('what');
    expect(ids[1]).toBe('start');
    for (const g of ['semester', 'study', 'make', 'upkeep', 'campus', 'yours']) {
      expect(ids).toContain(`area-${g}`);
    }
    for (const id of ['tasks', 'screens', 'settings', 'keys', 'wrong']) {
      expect(ids).toContain(id);
    }
  });

  it('says what the app does not do', () => {
    // A guide that only sells is a guide nobody trusts.
    const what = build().sections.find((s) => s.id === 'what')?.body ?? '';
    expect(what).toMatch(/does not/i);
    expect(what).toMatch(/does not write your coursework/i);
  });

  it('keeps the app’s voice: no exclamation marks anywhere in it', () => {
    const md = toMarkdown(build());
    expect(md).not.toContain('!');
  });

  it('puts every group’s screens under that group and nowhere else', () => {
    const book = build();
    for (const group of ['Semester', 'Study', 'Make', 'Upkeep', 'Campus', 'Yours']) {
      const body = book.sections.find((s) => s.id === `area-${group.toLowerCase()}`)?.body ?? '';
      const mine = DESTINATIONS.filter((d) => d.group === group);
      for (const d of mine) expect(body, `${d.screen} in ${group}`).toContain(d.label);
      expect(body.split('\n').filter((l) => l.startsWith('- **'))).toHaveLength(mine.length);
    }
  });

  it('reads the shortcut list rather than repeating it', () => {
    const keys = build().sections.find((s) => s.id === 'keys')?.body ?? '';
    expect(keys.split('\n').filter((l) => l.startsWith('- `'))).toHaveLength(SHORTCUTS.length);
  });

  it('produces markdown a person could actually read', () => {
    const md = toMarkdown(build());
    expect(md.startsWith('# Semester')).toBe(true);
    expect(md.length).toBeGreaterThan(6000);
    // No unresolved template holes.
    expect(md).not.toMatch(/undefined|\[object|\{\{/);
  });
});
