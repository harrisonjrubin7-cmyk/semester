import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FURTHER, beforeYouSend, needsMoreThanATap, reaches, sortFor, type Reach } from './reach';
import { TOOLS } from './tools';

const SOURCE = readFileSync(new URL('./tools.ts', import.meta.url), 'utf8');
/** Comments blanked, so prose quoting a field is not read as code. */
const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/^\s*\/\/.*$/gm, '');

describe('how far a proposal reaches', () => {
  it('is ordered, smallest first', () => {
    expect([...FURTHER]).toEqual(['look', 'mine', 'outward', 'binding', 'guarded']);
    expect(reaches('binding', 'outward')).toBe(true);
    expect(reaches('outward', 'binding')).toBe(false);
    expect(reaches('mine', 'mine')).toBe(true);
  });

  it('puts the line where the undo stops working', () => {
    // Not severity in the abstract. A task you added comes off your list; a
    // message somebody has read cannot be unread.
    expect(needsMoreThanATap('look')).toBe(false);
    expect(needsMoreThanATap('mine')).toBe(false);
    expect(needsMoreThanATap('outward')).toBe(true);
    expect(needsMoreThanATap('binding')).toBe(true);
    expect(needsMoreThanATap('guarded')).toBe(true);
  });

  it('says what cannot be taken back, rather than "are you sure"', () => {
    expect(beforeYouSend('look')).toBe('');
    expect(beforeYouSend('mine')).toBe('');
    expect(beforeYouSend('outward')).toMatch(/cannot be unsent/);
    expect(beforeYouSend('binding')).toMatch(/commits/);
    expect(beforeYouSend('guarded')).toMatch(/more than a tap/);
  });

  it('derives the drawing decision, so two fields cannot disagree', () => {
    expect(sortFor('look')).toBe('view');
    for (const r of FURTHER.filter((x) => x !== 'look')) expect(sortFor(r)).toBe('write');
  });
});

describe('the tools, against that vocabulary', () => {
  it('never writes sort beside reach, which is how the two would drift apart', () => {
    // A proposal marked `outward` and `view` would be sent without being kept.
    // `sortFor` is the only way `sort` is allowed to get a value.
    //
    // An assignment, not the type. `Proposal` declares `sort: 'write' | 'view';`
    // and must go on doing so — the trailing comma is what tells a value being
    // written from a union being named, and matching both made this fail on
    // the one line it exists to protect.
    const literal = code.match(/sort:\s*'(write|view)'\s*,/g) ?? [];
    expect(
      literal,
      'a proposal writes its own sort instead of deriving it from reach',
    ).toHaveLength(0);
    expect((code.match(/sort: sortFor\(/g) ?? []).length).toBeGreaterThan(10);
  });

  it('gives every proposal a reach', () => {
    const reachCount = (code.match(/\breach: '/g) ?? []).length;
    const sortCount = (code.match(/\bsort: sortFor\(/g) ?? []).length;
    expect(reachCount, 'a proposal is built with no reach declared').toBe(sortCount);
    expect(reachCount).toBeGreaterThanOrEqual(16);
  });

  /*
   * The census, and it is the whole point of the file.
   *
   * Every tool the app has touches the student's own device: sixteen of them,
   * each a dispatch into the local store, none visible to another person. So
   * a single tap is the right confirmation for all of them and nothing here
   * changes how any of them behave.
   *
   * This test exists to go red the day that stops being true. The write tools
   * a campus platform wants — message a classmate, RSVP to an event, post an
   * announcement — would arrive, be perfectly well described by `sort:
   * 'write'`, and inherit the confirmation a checkbox gets, with nothing in
   * the file objecting because nothing in the file was asking.
   *
   * When one does arrive: `needsMoreThanATap` is already true for it, and
   * `beforeYouSend` already has its sentence. What is missing is a caller —
   * `ai/converse.ts` applies a proposal on one tap today — and that caller is
   * what this failure is asking somebody to write. Raising the number here
   * without writing it is how the tripwire gets stepped over.
   */
  it('has no tool that reaches past your own device, and says so on purpose', () => {
    const declared = [...code.matchAll(/\breach: '([a-z]+)'/g)].map((m) => m[1] as Reach);
    const far = declared.filter((r) => needsMoreThanATap(r));
    expect(
      far,
      'a tool now reaches further than your own device. `needsMoreThanATap` and ' +
        '`beforeYouSend` are ready for it; `ai/converse.ts` still applies every ' +
        'proposal on one tap. Give it the confirmation before raising this number.',
    ).toEqual([]);
    expect(new Set(declared)).toEqual(new Set(['look', 'mine']));
  });

  it('is measuring the real registry, not an empty list', () => {
    // The census-over-nothing failure this repository keeps finding in its own
    // instruments: both assertions above pass perfectly against a file with no
    // proposals in it at all.
    expect(TOOLS.length).toBeGreaterThanOrEqual(16);
    expect(TOOLS.some((t) => t.name === 'add_task')).toBe(true);
  });
});
