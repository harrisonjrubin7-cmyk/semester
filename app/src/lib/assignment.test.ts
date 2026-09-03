import { describe, expect, it } from 'vitest';
import { clean } from './assignment';

/**
 * This runs on whatever the model returned, and a student acts on the result:
 * they put the dates in their calendar and revise the units it names. So the
 * tests that matter are the ones about what it throws away.
 */
const UNITS = ['12 · Monopoly', '3 · Elasticity'];

describe('clean', () => {
  it('keeps a well-formed breakdown intact', () => {
    const out = clean(
      {
        title: 'Case memo',
        due: '2026-10-14',
        deliverables: [{ what: 'A 4-page memo', detail: 'PDF, 12pt' }],
        rubric: [{ criterion: 'Analysis', weight: '40%', means: 'Depth of reasoning' }],
        steps: [{ do: 'Read the case', why: 'You cannot plan without it', by: '2026-10-08', minutes: 45 }],
        units: ['12 · Monopoly'],
        checklist: ['Check the page limit'],
        unclear: ['Is a bibliography required?'],
      },
      UNITS,
    );
    expect(out.title).toBe('Case memo');
    expect(out.due).toBe('2026-10-14');
    expect(out.steps[0].minutes).toBe(45);
    expect(out.units).toEqual(['12 · Monopoly']);
  });

  // ── what it refuses ────────────────────────────────────────────────────

  it('drops a date that is not a date', () => {
    expect(clean({ due: 'next Tuesday' }, UNITS).due).toBe('');
    expect(clean({ due: '2026-13-45' }, UNITS).due).toBe('');
    expect(clean({ due: '14/10/2026' }, UNITS).due).toBe('');
  });

  it('drops a unit the course does not have', () => {
    // The model naming a plausible-sounding unit that does not exist would
    // send someone revising material they have not got.
    const out = clean({ units: ['12 · Monopoly', '99 · Game Theory'] }, UNITS);
    expect(out.units).toEqual(['12 · Monopoly']);
  });

  it('drops a step with nothing to do', () => {
    const out = clean({ steps: [{ do: '', why: 'x', by: '', minutes: 10 }] }, UNITS);
    expect(out.steps).toHaveLength(0);
  });

  it('drops a rubric row with no criterion, so no weight floats free', () => {
    const out = clean({ rubric: [{ criterion: '  ', weight: '40%', means: 'x' }] }, UNITS);
    expect(out.rubric).toHaveLength(0);
  });

  it('keeps a rubric row with no weight — many syllabi state none', () => {
    const out = clean({ rubric: [{ criterion: 'Clarity', weight: '', means: '' }] }, UNITS);
    expect(out.rubric).toHaveLength(1);
  });

  it('never returns a negative or fractional duration', () => {
    const out = clean(
      { steps: [{ do: 'a', why: '', by: '', minutes: -30 }, { do: 'b', why: '', by: '', minutes: 12.7 }] },
      UNITS,
    );
    expect(out.steps[0].minutes).toBe(0);
    expect(out.steps[1].minutes).toBe(13);
  });

  it('survives a reply that is the wrong shape entirely', () => {
    const nonsense = {
      title: 42,
      deliverables: 'not an array',
      rubric: null,
      steps: [null, 'nope'],
      units: [7],
      checklist: [{}],
    } as unknown as Parameters<typeof clean>[0];
    const out = clean(nonsense, UNITS);
    expect(out.title).toBe('Assignment');
    expect(out.deliverables).toEqual([]);
    expect(out.rubric).toEqual([]);
    expect(out.steps).toEqual([]);
    expect(out.units).toEqual([]);
    expect(out.checklist).toEqual([]);
  });

  it('returns a usable object from nothing at all', () => {
    const out = clean({}, []);
    expect(out.title).toBe('Assignment');
    expect(out.steps).toEqual([]);
  });
});
