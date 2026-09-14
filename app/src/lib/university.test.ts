import { describe, expect, it } from 'vitest';
import { DRAFT_LIMITS, readUniversityDrafts } from './university';
import { DRAFT_TEMPLATES } from './university.templates';
import { UNIVERSITY_AREAS, parseAction, validateActionFields } from '@semester/institution';
import type { RecordAction } from '@semester/institution';

/**
 * The two places where something from outside decides what this app does.
 *
 * A draft export is a JSON file a person chose off their own disk — mailed to
 * themselves a term ago, hand-edited, or written by a build that is not this
 * one. An action is a request the gateway parses on the server. Both are
 * parsers over untrusted input, and a parser that is lenient in the wrong
 * place is how a screen ends up rendering somebody else's idea of a draft.
 *
 * The rule both follow, and what most of these tests are really about: reject
 * the whole file rather than salvage part of it. Half an import is worse than
 * none, because the half that vanished is the half nobody notices.
 */

const ok = () => ({
  id: 'a',
  role: 'student' as const,
  area: 'courses' as const,
  title: 'Registration questions',
  body: 'What to ask',
  due: '2026-11-04',
  courseId: 'econ',
  steps: [{ id: 's1', text: 'Check holds', done: false }],
  updatedAt: new Date(2026, 8, 14).toISOString(),
});

const read = (drafts: unknown[]) => readUniversityDrafts(JSON.stringify(drafts));

describe('reading a draft export', () => {
  it('reads back what the exporter wrote', () => {
    const [d] = read([ok()]);
    expect(d.title).toBe('Registration questions');
    expect(d.steps).toEqual([{ id: 's1', text: 'Check holds', done: false }]);
  });

  it('accepts both shapes, because both are out there', () => {
    // The exporter writes `{ version, status, drafts }`; copies saved before
    // it did are a bare array. Neither may stop opening.
    expect(readUniversityDrafts(JSON.stringify([ok()]))).toHaveLength(1);
    expect(readUniversityDrafts(JSON.stringify({ version: 1, drafts: [ok()] }))).toHaveLength(1);
  });

  it('reads an empty file as no drafts rather than as an error', () => {
    // What every account has before it has written anything. The screen reads
    // `localStorage.getItem(key) || '[]'`, so this is the ordinary first load.
    expect(readUniversityDrafts('[]')).toEqual([]);
  });

  it('refuses the whole file when one entry is wrong', () => {
    // The entry after the bad one is valid, and it must not arrive. Salvaging
    // is what makes a silent partial import possible.
    expect(() => read([ok(), { ...ok(), title: 42 }, ok()])).toThrow(/invalid entry/i);
  });

  it('refuses a role or an area it does not know', () => {
    // An area the contract has dropped, or a role somebody typed in by hand.
    // Both would reach `DRAFT_TEMPLATES[area]` and index nothing.
    expect(() => read([{ ...ok(), role: 'chancellor' }])).toThrow();
    expect(() => read([{ ...ok(), area: 'parking' }])).toThrow();
  });

  it('holds every length it promises to hold', () => {
    expect(() => read([{ ...ok(), title: 'x'.repeat(DRAFT_LIMITS.title + 1) }])).toThrow();
    expect(() => read([{ ...ok(), body: 'x'.repeat(DRAFT_LIMITS.body + 1) }])).toThrow();
    expect(() => read([{ ...ok(), id: 'x'.repeat(DRAFT_LIMITS.id + 1) }])).toThrow();
    expect(() =>
      read([{ ...ok(), steps: Array.from({ length: DRAFT_LIMITS.steps + 1 }, (_, i) => ({ id: `s${i}`, text: 'a', done: false })) }]),
    ).toThrow();
    expect(() => read([{ ...ok(), steps: [{ id: 's', text: 'x'.repeat(DRAFT_LIMITS.stepText + 1), done: false }] }])).toThrow();
  });

  it('refuses more drafts than it will hold, before reading any of them', () => {
    const many = Array.from({ length: DRAFT_LIMITS.drafts + 1 }, () => ok());
    expect(() => read(many)).toThrow(new RegExp(String(DRAFT_LIMITS.drafts)));
  });

  it('takes an empty due date and refuses a malformed one', () => {
    // No date is the ordinary state of a draft. A date that is not one would
    // reach `<input type="date">` and silently clear itself.
    expect(read([{ ...ok(), due: '' }])[0].due).toBe('');
    expect(() => read([{ ...ok(), due: 'next tuesday' }])).toThrow();
    expect(() => read([{ ...ok(), updatedAt: 'whenever' }])).toThrow();
  });

  it('keeps only the fields it knows, so an export cannot smuggle one in', () => {
    const [d] = read([{ ...ok(), submitted: true, official: 'yes' }]);
    expect(d).not.toHaveProperty('submitted');
    expect(d).not.toHaveProperty('official');
  });

  it('refuses a step that is not a step', () => {
    expect(() => read([{ ...ok(), steps: [null] }])).toThrow();
    expect(() => read([{ ...ok(), steps: [{ id: 's', text: 'a', done: 'yes' }] }])).toThrow();
    expect(() => read([{ ...ok(), steps: 'all of them' }])).toThrow();
  });
});

describe('the draft templates', () => {
  it('has one for every area the contract knows', () => {
    // The `Record<UniversityArea, …>` type says this at compile time; this
    // says it at run time, which is what matters for an area read out of a
    // file rather than written in the source.
    for (const [id] of UNIVERSITY_AREAS) expect(DRAFT_TEMPLATES[id], id).toBeTruthy();
    expect(Object.keys(DRAFT_TEMPLATES)).toHaveLength(UNIVERSITY_AREAS.length);
  });

  it('gives every one of them something to do', () => {
    for (const [id] of UNIVERSITY_AREAS) {
      expect(DRAFT_TEMPLATES[id].title.length, id).toBeGreaterThan(0);
      expect(DRAFT_TEMPLATES[id].steps.length, id).toBeGreaterThan(0);
    }
  });

  /*
   * The one content rule, and it is the whole posture of the screen.
   *
   * A template that said "Submit the form" would have this app claiming to do
   * something it cannot do, in the place a student is most likely to believe
   * it — a checklist headed with their university's name. Preparation
   * language only, and asserted rather than trusted to review.
   */
  it('never tells somebody they have submitted anything', () => {
    /*
     * Calibrated against the templates rather than guessed at.
     *
     * The first version of this matched a bare `approved`, and failed on
     * "Use approved services for sensitive documents" — an instruction, not a
     * claim. Thirteen templates legitimately say "official" and four say
     * "approval", because telling somebody to wait for official approval is
     * exactly the honesty this test is protecting. What must never appear is
     * a statement that the student's own official action has *happened*.
     */
    const claims =
      /\b(you (have |'ve )?(submitted|enrolled|enroled|paid)|submission (is )?(complete|confirmed)|successfully (submitted|enrolled|paid)|payment (complete|confirmed|received)|now (enrolled|registered))\b/i;

    // It catches the thing it is for.
    expect('You have submitted the form').toMatch(claims);
    expect('Payment confirmed').toMatch(claims);

    for (const [id] of UNIVERSITY_AREAS) {
      const t = DRAFT_TEMPLATES[id];
      const all = [t.title, t.body, ...t.steps].join(' ');
      expect(all, `${id} claims an official outcome`).not.toMatch(claims);
    }
  });
});

describe('an action off the wire', () => {
  const action: RecordAction = {
    id: 'drop',
    label: 'Drop this course',
    fields: [
      { id: 'reason', label: 'Reason', kind: 'select', required: true, options: ['Schedule', 'Other'] },
      { id: 'credits', label: 'Credits', kind: 'number', required: false },
    ],
  };
  const input = { area: 'registration' as const, recordId: 'r1', version: 'v9', actionId: 'drop', fields: {} };

  it('reads one a screen actually sends', () => {
    expect(parseAction({ ...input, fields: { reason: 'Other' } }).actionId).toBe('drop');
  });

  it('refuses anything that is not an object with a known area', () => {
    for (const bad of [null, 'drop', 42, [], { ...input, area: 'parking' }]) {
      expect(() => parseAction(bad)).toThrow();
    }
  });

  it('refuses a record or action id that is missing, empty or enormous', () => {
    expect(() => parseAction({ ...input, recordId: '' })).toThrow();
    expect(() => parseAction({ ...input, actionId: 'x'.repeat(201) })).toThrow();
    expect(() => parseAction({ ...input, version: undefined })).toThrow();
  });

  it('refuses fields that would exhaust the gateway', () => {
    const many = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`f${i}`, 'a']));
    expect(() => parseAction({ ...input, fields: many })).toThrow();
    expect(() => parseAction({ ...input, fields: { reason: 'x'.repeat(20_001) } })).toThrow();
    expect(() => parseAction({ ...input, fields: { 'not a key': 'a' } })).toThrow();
  });

  it('holds a required field, a listed option and a number', () => {
    const at = (fields: Record<string, string>) => () =>
      validateActionFields({ ...input, area: 'registration', fields }, action);
    expect(at({ reason: 'Other' })).not.toThrow();
    expect(at({})).toThrow(/required/i);
    expect(at({ reason: 'Because' })).toThrow(/listed/i);
    expect(at({ reason: 'Other', credits: 'three' })).toThrow(/number/i);
    expect(at({ reason: 'Other', credits: '3' })).not.toThrow();
  });

  it('refuses a field the action never offered, rather than dropping it', () => {
    // Dropping it quietly would mean a student filled something in and the
    // gateway acted as though they had not.
    expect(() => validateActionFields({ ...input, fields: { smuggled: 'x' } }, action)).toThrow(/unexpected/i);
  });
});
