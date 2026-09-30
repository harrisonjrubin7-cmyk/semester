import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVELS, NO_GROUNDS, mayStep, rank, type Grounds } from '@semester/institution';
import { RUNGS, rungById } from './automationrungs';

const root = join(import.meta.dirname, '../../..');
const FULL: Grounds = { confirmed: true, authority: 'a', policy: 'p', audit: 'x' };

describe('which rung each automated feature stands on', () => {
  it('lists each feature once, on a real rung, citing a file that exists', () => {
    expect(new Set(RUNGS.map((r) => r.id)).size).toBe(RUNGS.length);
    for (const r of RUNGS) {
      expect(LEVELS, r.id).toContain(r.rung);
      expect(r.what.length, r.id).toBeGreaterThan(20);
      expect(existsSync(join(root, r.evidence)), `${r.id} cites ${r.evidence}, which is missing`).toBe(true);
    }
  });

  it('makes anything above prepare say what it was stepped up from, and lets the ladder allow that one step and no other', () => {
    for (const r of RUNGS) {
      if (rank(r.rung) <= rank('prepare')) {
        expect(r.steppedFrom, `${r.id} is at or below prepare and needs no step`).toBeUndefined();
        continue;
      }
      expect(r.steppedFrom, `${r.id} is above prepare and says nothing about how it got there`).toBeDefined();
      expect(rank(r.rung) - rank(r.steppedFrom!), r.id).toBe(1);
      expect(mayStep({ from: r.steppedFrom!, to: r.rung }, FULL).ok, r.id).toBe(true);
      // Without its grounds the same step is refused: a rung is not a label, it is a cost.
      expect(mayStep({ from: r.steppedFrom!, to: r.rung }, NO_GROUNDS).ok, r.id).toBe(false);
    }
  });

  it('keeps every write-capable rung real: execute exists once, in the gateway, and nothing else in the app declares it', () => {
    const executing = RUNGS.filter((r) => rank(r.rung) >= rank('execute'));
    expect(executing.map((r) => r.id)).toEqual(['gateway-commit']);
    expect(rungById('gateway-commit')!.evidence).toBe('app/server/institution/gateway.ts');
    expect(readFileSync(join(root, 'app/server/institution/gateway.ts'), 'utf8')).toMatch(/mayStep\(/);
  });

  it('keeps the suggesting features at or below draft, so a recommendation cannot write', () => {
    for (const id of ['life-events', 'moment-feedback', 'learner-pathways', 'notify-plan-ahead', 'university-templates']) {
      expect(rank(rungById(id)!.rung), id).toBeLessThanOrEqual(rank('draft'));
    }
  });
});
