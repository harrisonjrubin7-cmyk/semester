import { describe, expect, it } from 'vitest';
import { modelFor, routesDown, workFor, type Work } from './airoute';
import { RATES } from './spend';
import { MODELS } from './assistant';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Routing — platform §302.
 *
 * The assertion worth having is not "summarising uses Haiku". It is that this
 * can only ever make a request cheaper, because that is what makes it safe to
 * apply to somebody's own API key without asking them.
 */

const WORK: Work[] = [
  'FAST_QA', 'ACADEMIC_TUTOR', 'DOCUMENT_ANALYSIS', 'REASONING',
  'TOOL_ACTION', 'DATA_ANALYSIS', 'SEARCH', 'SUMMARIZATION',
];

const price = (m: string) => RATES[m]?.output ?? Number.POSITIVE_INFINITY;

describe('what routing may do', () => {
  it('never returns a model more expensive than the one chosen', () => {
    for (const work of WORK) {
      for (const chosen of Object.keys(RATES)) {
        const got = modelFor(work, chosen);
        expect(price(got), `${work} on ${chosen} routed up to ${got}`).toBeLessThanOrEqual(
          price(chosen),
        );
      }
    }
  });

  /*
   * The control the rule above needs. "Never more expensive" is satisfied
   * perfectly by a function that always returns the cheapest model there is —
   * and that version would quietly answer a degree question on Haiku, which
   * is the failure this is meant to avoid in the other direction.
   */
  it('still keeps the expensive model where the work needs it', () => {
    for (const work of ['REASONING', 'ACADEMIC_TUTOR', 'TOOL_ACTION'] as Work[]) {
      expect(modelFor(work, 'claude-opus-5'), work).toBe('claude-opus-5');
    }
  });

  it('routes the cheap work down when nothing was chosen but the default', () => {
    expect(modelFor('SUMMARIZATION', 'claude-opus-5')).toBe('claude-haiku-4-5');
    expect(modelFor('FAST_QA', 'claude-opus-5')).toBe('claude-haiku-4-5');
    expect(modelFor('DOCUMENT_ANALYSIS', 'claude-opus-5')).toBe('claude-sonnet-5');
  });

  /*
   * The decision somebody made about their own money. Choosing Haiku is a
   * statement, and a router that "helpfully" upgraded a hard question would
   * spend their quota on their behalf.
   */
  it('never upgrades somebody who chose a cheaper model', () => {
    for (const work of WORK) {
      expect(modelFor(work, 'claude-haiku-4-5'), work).toBe('claude-haiku-4-5');
    }
    expect(modelFor('SUMMARIZATION', 'claude-sonnet-5')).toBe('claude-haiku-4-5');
    expect(modelFor('REASONING', 'claude-sonnet-5')).toBe('claude-sonnet-5');
  });

  /*
   * `claude-fable-5-1` is in `MODELS` and deliberately not in `RATES` — see
   * `lib/spend.ts`, which would rather count a model as unpriced than charge
   * it at a number nobody published. An unpriced model must therefore be left
   * alone rather than treated as infinitely expensive and "improved" to Haiku
   * behind the person's back.
   */
  it('leaves a model it has no price for exactly as chosen', () => {
    const unpriced = MODELS.map((m) => m.id).filter((id) => !(id in RATES));
    expect(unpriced, 'the unpriced case this guards has gone').not.toEqual([]);
    for (const id of unpriced) {
      for (const work of WORK) expect(modelFor(work, id), `${work} on ${id}`).toBe(id);
    }
  });

  it('leaves a model it has never heard of alone', () => {
    expect(modelFor('SUMMARIZATION', 'some-other-provider/model')).toBe(
      'some-other-provider/model',
    );
  });
});

describe('saying so', () => {
  it('reports whether it changed anything', () => {
    expect(routesDown('SUMMARIZATION', 'claude-opus-5')).toBe(true);
    expect(routesDown('REASONING', 'claude-opus-5')).toBe(false);
    expect(routesDown('SUMMARIZATION', 'claude-haiku-4-5')).toBe(false);
  });
});

describe('the table itself', () => {
  it('names a real model for every class', () => {
    const real = new Set(MODELS.map((m) => m.id));
    for (const work of WORK) {
      const got = modelFor(work, 'claude-opus-5');
      expect(real, `${work} routes to ${got}, which is not in MODELS`).toContain(got);
    }
  });
});

describe('the purposes the app actually declares', () => {
  /*
   * Every `about:` in the app, read out of the source rather than listed
   * here. A new caller with a purpose this file has never seen falls to
   * `ACADEMIC_TUTOR` and keeps the ceiling, which is safe — but it also means
   * the label silently does nothing, and nothing would ever say so. This is
   * what says so.
   */
  function abouts(dir: string, found = new Set<string>()): Set<string> {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const at = join(dir, e.name);
      if (e.isDirectory()) abouts(at, found);
      else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) {
        for (const [, v] of readFileSync(at, 'utf8').matchAll(/about: '([a-z-]+)'/g)) found.add(v);
      }
    }
    return found;
  }

  const declared = [...abouts(join(process.cwd(), 'src'))].sort();

  it('finds them, which everything below depends on', () => {
    expect(declared.length, 'no about: labels parsed out of src').toBeGreaterThan(5);
  });

  it('has a class for every one', () => {
    for (const about of declared) {
      expect(workFor(about), `${about} is not mapped`).not.toBeUndefined();
    }
  });

  /*
   * And the decision this PR deliberately does not make. Every current label
   * keeps the ceiling, because choosing which work is safe to run on a
   * cheaper model is a question about output quality and platform §1252 says
   * no AI capability ships without a test set. When somebody lowers one, this
   * fails and they replace it with the benchmark that justified it.
   */
  it('routes none of them down yet, and that is on purpose', () => {
    for (const about of declared) {
      expect(
        modelFor(workFor(about), 'claude-opus-5'),
        `${about} now routes down — that needs a benchmark per §1252`,
      ).toBe('claude-opus-5');
    }
  });
});

describe('the caller', () => {
  it('is used where the model is chosen and where the spend is recorded', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'claude.ts'), 'utf8');
    const uses = [...src.matchAll(/modelFor\(workFor\(/g)].length;
    expect(uses, 'the meter and the request must agree on the model').toBe(2);
    expect(src).not.toMatch(/body: JSON\.stringify\(\{\n\s+model: s\.model,/);
  });
});
