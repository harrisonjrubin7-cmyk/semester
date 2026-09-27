// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LEARNER_PATHWAYS,
  LEARNER_TEMPLATES,
  fitsFormat,
  fitsSection,
  fitsWhen,
  learnerPathwaysFlag,
  loadChosen,
  readChosen,
  saveChosen,
  sectionFormat,
  suggestLine,
} from './learner-pathways';
import { PATHWAY_TEMPLATES, newPathwayProject } from './pathway';
import type { Meeting } from './registration';

const KEY = 'semester.learner-pathways.v1:test';
afterEach(() => localStorage.removeItem(KEY));

const at = (h: number, m = 0) => h * 60 + m;
const section = (meetings: Meeting[], location = 'Garland 101') => ({ meetings, location });

describe('the flag', () => {
  it('is off unless the build turns it on, and ignores the institutional preview', () => {
    expect(learnerPathwaysFlag({})).toBe('off');
    expect(learnerPathwaysFlag({ VITE_INSTITUTIONAL_PREVIEW: 'true' })).toBe('off');
    expect(learnerPathwaysFlag({ VITE_PATH_LEARNER_PATHWAYS: 'bogus' })).toBe('off');
    expect(learnerPathwaysFlag({ VITE_PATH_LEARNER_PATHWAYS: 'preview' })).toBe('preview');
  });
});

describe('the checklists', () => {
  /*
   * The voice `PATHWAY_TEMPLATES` already keeps: nothing here submits,
   * approves, enrols or pays, and nothing tells anybody they qualify. Those are
   * decisions an office makes, and a ticked "Submitted" would leave a student
   * believing they had done it.
   */
  const FORBIDDEN_FIRST = /^(submit|approve|apply|enrol|enroll|register|pay|accept|claim)\b/i;
  const FORBIDDEN_ANYWHERE = /\b(eligib\w*|you qualify|guarantee\w*|entitled)\b/i;
  const steps = Object.entries(LEARNER_TEMPLATES).flatMap(([name, list]) => list.map((s) => [name, s] as const));

  it('never submit, approve, enrol or pay, and never say anybody qualifies', () => {
    for (const [name, step] of steps) {
      expect(FORBIDDEN_FIRST.test(step), `${name}: ${step}`).toBe(false);
      expect(FORBIDDEN_ANYWHERE.test(step), `${name}: ${step}`).toBe(false);
    }
  });

  it('the check can see a step that breaks the rule', () => {
    // The control: a pattern that matched nothing would pass the test above.
    expect(FORBIDDEN_FIRST.test('Submit the benefits form')).toBe(true);
    expect(FORBIDDEN_ANYWHERE.test('Confirm you are eligible for aid')).toBe(true);
  });

  it('do not reuse a name the existing checklists already have', () => {
    for (const name of Object.keys(LEARNER_TEMPLATES)) expect(PATHWAY_TEMPLATES[name], name).toBeUndefined();
  });

  it('every pathway offers checklists that exist, and every new checklist is offered by one', () => {
    const offered = new Set(LEARNER_PATHWAYS.flatMap((p) => p.templates));
    for (const t of offered) expect(t in PATHWAY_TEMPLATES || t in LEARNER_TEMPLATES, t).toBe(true);
    for (const t of Object.keys(LEARNER_TEMPLATES)) expect(offered.has(t), t).toBe(true);
  });

  it('start as a project with their steps, like the existing ones', () => {
    const p = newPathwayProject('Military-connected student');
    expect(p.steps.map((s) => s.title)).toEqual(LEARNER_TEMPLATES['Military-connected student']);
    expect(p.steps.every((s) => !s.done)).toBe(true);
    expect(newPathwayProject('Transfer credit').steps.length).toBe(PATHWAY_TEMPLATES['Transfer credit'].length);
  });

  it('where a decision is somebody else’s, the pathway says so', () => {
    const ask = (id: string) => LEARNER_PATHWAYS.find((p) => p.id === id)!.ask.join(' ');
    expect(ask('military')).toMatch(/never calculates/i);
    expect(ask('international')).toMatch(/no immigration, work or tax advice/i);
  });
});

describe('a suggested filter', () => {
  it('is one readable sentence, whichever parts it has', () => {
    expect(suggestLine({ when: 'evening' })).toBe(
      'In Registration, Course search can filter to evening (starting at 5 pm or later) sections.',
    );
    expect(suggestLine({ format: 'online' })).toBe('In Registration, Course search can filter to online sections.');
    expect(suggestLine({ format: 'online', when: 'weekend' })).toBe(
      'In Registration, Course search can filter to online weekend sections.',
    );
    expect(suggestLine(undefined)).toBe('');
  });
});

describe('the choice', () => {
  it('keeps only known pathways, once each, in the listed order', () => {
    expect(readChosen(['online', 'nope', 'working', 'online', 7, null])).toEqual(['working', 'online']);
    expect(readChosen('working')).toEqual([]);
    expect(readChosen(undefined)).toEqual([]);
  });

  it('survives a reload on this device, and choosing none removes it', () => {
    expect(saveChosen(KEY, ['caregiver', 'transfer'])).toBe(true);
    expect(loadChosen(KEY)).toEqual(['transfer', 'caregiver']);
    saveChosen(KEY, []);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('reads nothing from a corrupted copy rather than throwing', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadChosen(KEY)).toEqual([]);
  });
});

describe('section filters', () => {
  it('read the format from the catalog’s own location text', () => {
    expect(sectionFormat(section([{ days: [1], start: at(9), end: at(10) }]))).toBe('in_person');
    expect(sectionFormat(section([{ days: [1], start: at(9), end: at(10) }], 'Online (synchronous)'))).toBe('online');
    expect(sectionFormat(section([], 'TBA'))).toBe('online');
    expect(sectionFormat(section([{ days: [2], start: at(18), end: at(20) }], 'Hybrid — Wilson 120 / Zoom'))).toBe('hybrid');
    expect(fitsFormat(section([], 'Remote'), 'online')).toBe(true);
    expect(fitsFormat(section([], 'Remote'), 'in_person')).toBe(false);
  });

  it('call a section evening only if every meeting starts at 5 pm or later', () => {
    expect(fitsWhen(section([{ days: [1, 3], start: at(17), end: at(18, 15) }]), 'evening')).toBe(true);
    expect(fitsWhen(section([{ days: [1, 3], start: at(16, 59), end: at(18) }]), 'evening')).toBe(false);
    const mixed = section([
      { days: [2], start: at(18), end: at(20) },
      { days: [4], start: at(10), end: at(11) },
    ]);
    expect(fitsWhen(mixed, 'evening')).toBe(false);
  });

  it('sort mornings, afternoons and weekends at their edges', () => {
    expect(fitsWhen(section([{ days: [1], start: at(9), end: at(12) }]), 'morning')).toBe(true);
    expect(fitsWhen(section([{ days: [1], start: at(11), end: at(12, 15) }]), 'morning')).toBe(false);
    expect(fitsWhen(section([{ days: [1], start: at(12), end: at(17) }]), 'afternoon')).toBe(true);
    expect(fitsWhen(section([{ days: [0, 6], start: at(10), end: at(13) }]), 'weekend')).toBe(true);
    expect(fitsWhen(section([{ days: [5, 6], start: at(10), end: at(13) }]), 'weekend')).toBe(false);
  });

  it('let a section with no set meeting time through every time window', () => {
    for (const w of ['morning', 'afternoon', 'evening', 'weekend'] as const) expect(fitsWhen(section([]), w)).toBe(true);
  });

  it('combine: an evening online section for somebody who works days', () => {
    const evening = section([{ days: [1], start: at(18), end: at(21) }], 'Online via Zoom');
    const daytime = section([{ days: [1], start: at(10), end: at(11) }], 'Online via Zoom');
    expect(fitsSection(evening, { when: 'evening', format: 'online' })).toBe(true);
    expect(fitsSection(daytime, { when: 'evening', format: 'online' })).toBe(false);
    expect(fitsSection(daytime, { when: 'any', format: 'any' })).toBe(true);
  });
});

describe('nothing infers a pathway', () => {
  /*
   * Structural, for the reason `rootunmount.test.ts` gives: a behavioural test
   * sees the cases it tries, and the failure this prevents is one quiet import
   * that lets the panel guess somebody is a parent from their calendar.
   */
  const importsOf = (path: string) =>
    [...readFileSync(join(__dirname, path), 'utf8').matchAll(/^import[\s\S]*?from '([^']+)';/gm)].map((m) => m[1]);

  it('the module imports only types', () => {
    const text = readFileSync(join(__dirname, 'learner-pathways.ts'), 'utf8');
    expect([...text.matchAll(/^import (?!type )/gm)]).toEqual([]);
    expect(importsOf('learner-pathways.ts').sort()).toEqual(['../intelligence/contracts', './registration']);
  });

  it('the panel imports no store, profile or record', () => {
    expect(importsOf('../components/LearnerPathways.tsx').sort()).toEqual(
      ['../lib/dim', '../lib/learner-pathways', './ui', 'react'].sort(),
    );
  });

  it('the choice is not part of anything that syncs', () => {
    for (const path of ['cloud.ts', 'privacy.ts', '../state/shape.ts']) {
      expect(readFileSync(join(__dirname, path), 'utf8'), path).not.toMatch(/learner-pathways/);
    }
  });
});
