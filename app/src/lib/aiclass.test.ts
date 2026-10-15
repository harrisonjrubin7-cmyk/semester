import { describe, expect, it } from 'vitest';
import { DATA_CLASSES, routeAllowed } from './integration/classification';
import { AI_DATA_CEILING, AI_DATA_CLASSES, aiClassVerdict, effectiveClass } from '../../../packages/institution/src/ai-data-class';
import { gate } from './toolkit/classification';

/**
 * The pure half of the C7 check. The ceiling is not written down twice: it is
 * the highest class that BOTH the platform floor (`routeAllowed`, what the
 * database also enforces) and the toolkit gate (what a student is told) let
 * reach an AI service, and this recomputes it from the two.
 */
describe('the AI data-class ceiling', () => {
  it('speaks the same seven classes, in the same order, as the classification module', () => {
    expect(AI_DATA_CLASSES).toEqual(DATA_CLASSES);
  });

  it('is the stricter of the platform floor and the toolkit gate, recomputed', () => {
    const both = DATA_CLASSES.filter((c) => routeAllowed(c, 'approved_ai') && gate(c, 'ai', true).allowed);
    expect(both).toEqual(['T0', 'T1', 'T2']);
    expect(AI_DATA_CEILING).toBe(both[both.length - 1]);
  });

  it('leaves T3 under the ceiling out even though the platform floor would route it', () => {
    expect(routeAllowed('T3', 'approved_ai')).toBe(true);
    expect(gate('T3', 'ai', true).allowed).toBe(false);
    expect(aiClassVerdict([['record', 'T3']]).ok).toBe(false);
  });
});

describe('the verdict', () => {
  it('control: fields at or under the ceiling pass', () => {
    expect(aiClassVerdict([['model', 'T0'], ['source', 'T1'], ['question', 'T2']])).toEqual({ ok: true });
    expect(aiClassVerdict([])).toEqual({ ok: true });
  });

  it('refuses every class above the ceiling, and says which field and the highest class', () => {
    for (const c of ['T3', 'T4', 'T5', 'T6'] as const) {
      expect(aiClassVerdict([['question', 'T2'], [`f-${c}`, c]]), c).toEqual({ ok: false, fields: [`f-${c}`], highest: c });
    }
    expect(aiClassVerdict([['a', 'T3'], ['b', 'T6'], ['c', 'T4']])).toEqual({ ok: false, fields: ['a', 'b', 'c'], highest: 'T6' });
  });

  it('treats a field with no class, or a class that is not one of the seven, as T3', () => {
    expect(effectiveClass(undefined)).toBe('T3');
    expect(effectiveClass('T9')).toBe('T3');
    expect(effectiveClass('t1')).toBe('T3');
    expect(aiClassVerdict([['nobody-classified-me', undefined]])).toEqual({ ok: false, fields: ['nobody-classified-me'], highest: 'T3' });
    expect(aiClassVerdict([['x', 'T9']]).ok).toBe(false);
  });

  it('can be given a stricter ceiling, never read as a looser one by default', () => {
    expect(aiClassVerdict([['q', 'T2']], 'T1').ok).toBe(false);
    expect(aiClassVerdict([['q', 'T2']]).ok).toBe(true);
  });
});
