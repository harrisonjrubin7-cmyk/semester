import { describe, expect, it } from 'vitest';
import { BANDS, CASES, CRITICAL_CAP, firstJson, grade, scoreRun } from './model-quality';
import { DATA_RULE } from '../../ai/untrusted';
import { systemPrompt } from '../../ai/prompt';
import { LOOKUPS } from '../lookup';
import { TOOLS } from '../tools';
import { toolsFor } from '../toolscope';

/**
 * Holds the model-quality evaluation set without a model. Every case must
 * build the prompt it claims to, every check must pass the case's good reply,
 * and every check must refuse its own bad reply, on its own. A check shown only
 * alongside another is not shown at all: the first draft of this set held a
 * case to one bad reply, and disabling its answer-withholding check left the
 * case green because the other check refused the same reply. A check that
 * passes everything would score a model that ignored the question as well as
 * one that answered it.
 */

describe('the model-quality evaluation set', () => {
  it('has fifteen cases, ids once, over the five workflows built first and the career one', () => {
    expect(CASES).toHaveLength(15);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(new Set(CASES.map((c) => c.workflow))).toEqual(new Set(['WF-01', 'WF-02', 'WF-03', 'WF-04', 'WF-05', 'WF-06']));
    expect(CASES.filter((c) => c.critical).length).toBeGreaterThanOrEqual(8);
  });

  for (const c of CASES) {
    it(`${c.id} ${c.name}: every check passes the good reply`, () => {
      expect(grade(c, c.good).failed).toEqual([]);
    });

    for (const k of c.checks) {
      it(`${c.id} ${c.name}: “${k.name}” refuses its own bad replies, and accepts the ones it must`, () => {
        for (const bad of typeof k.refuses === 'string' ? [k.refuses] : k.refuses) expect(k.pass(bad), bad).toBe(false);
        for (const ok of k.accepts ?? []) expect(k.pass(ok), ok).toBe(true);
      });
    }

    it(`${c.id} ${c.name}: builds a real prompt, with the material rule where material goes`, () => {
      const b = c.build();
      expect(b.system.length).toBeGreaterThan(200);
      expect(b.messages.length).toBeGreaterThan(0);
      const whole = `${b.system}\n${b.messages.map((m) => m.content).join('\n')}`;
      if (whole.includes('<material')) expect(whole).toContain(DATA_RULE);
    });
  }

  it('gives every assistant case exactly the tools the app offers in its mode, and the others none', () => {
    const opening = (mode: 'app' | 'grounded' | 'general') => systemPrompt(mode, '').slice(0, 60);
    let assistant = 0;
    for (const c of CASES) {
      const b = c.build();
      const mode = (['grounded', 'general', 'app'] as const).find((m) => b.system.startsWith(opening(m)));
      if (!mode) {
        expect(b.tools, c.id).toBeUndefined();
        continue;
      }
      assistant++;
      expect(b.tools?.map((t) => t.name), c.id).toEqual(toolsFor(mode, mode === 'app' ? TOOLS : [...TOOLS, ...LOOKUPS]).map((t) => t.name));
    }
    expect(assistant).toBeGreaterThanOrEqual(9);
  });

  it('reads JSON the way the app does, and refuses what is not an object', () => {
    expect(firstJson('Here it is: {"a":1} done')).toEqual({ a: 1 });
    expect(firstJson('no json')).toBeNull();
    expect(firstJson('{"a":')).toBeNull();
    expect(firstJson('[1,2]')).toBeNull();
  });
});

describe('scoring a run', () => {
  const all = (passed: (id: string) => boolean) => CASES.map((c) => ({ id: c.id, passed: passed(c.id) }));

  it('scores a clean run 5', () => {
    expect(scoreRun(all(() => true))).toEqual({ score: 5, rate: 1, criticalFailed: [] });
  });

  it('caps a run that fails any critical case, however high its rate', () => {
    const critical = CASES.find((c) => c.critical)!.id;
    const r = scoreRun(all((id) => id !== critical));
    expect(r.rate).toBeGreaterThanOrEqual(0.9);
    expect(r.score).toBe(CRITICAL_CAP);
    expect(r.criticalFailed).toEqual([critical]);
  });

  it('bands a run that fails only non-critical cases by its rate', () => {
    const soft = CASES.filter((c) => !c.critical).map((c) => c.id);
    const r = scoreRun(all((id) => id !== soft[0]));
    expect(r.criticalFailed).toEqual([]);
    expect(r.score).toBe(BANDS.find((b) => r.rate >= b.min)!.score);
    expect(r.score).toBeLessThan(5);
  });

  it('refuses a partial run, and a run that repeats a case', () => {
    expect(() => scoreRun(all(() => true).slice(1))).toThrow();
    const twice = all(() => true);
    twice[1] = { ...twice[0] };
    expect(() => scoreRun(twice)).toThrow();
  });

  it('keeps its bands in order, ending at zero', () => {
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].min).toBeLessThan(BANDS[i - 1].min);
      expect(BANDS[i].score).toBeLessThan(BANDS[i - 1].score);
    }
    expect(BANDS.at(-1)).toEqual({ min: 0, score: 0 });
  });
});
