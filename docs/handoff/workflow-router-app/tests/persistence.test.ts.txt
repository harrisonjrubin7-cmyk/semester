import { describe, expect, it } from 'vitest';
import { clampPersistenceGrade, persistenceCeiling } from '@/lib/benchmark/probes/persistence';
describe('persistence ceiling', () => {
  it('local state never earns more than 2', () => { expect(persistenceCeiling({ tested: true, survivedReload: true, mode: 'browser-local', evidence: 'video' }, true)).toBe(2); expect(persistenceCeiling({ tested: true, survivedReload: true, mode: 'local-preview', evidence: 'x' }, true)).toBe(1); });
  it('database with evidence can earn 5', () => { expect(persistenceCeiling({ tested: true, survivedReload: true, mode: 'database', evidence: 'row abc' }, true)).toBe(5); });
  it('untested required persistence is 0', () => { expect(clampPersistenceGrade(5, { tested: false, survivedReload: null, mode: 'database' }, true)).toBe(0); });
  it('lost on reload is 0', () => { expect(persistenceCeiling({ tested: true, survivedReload: false, mode: 'database', evidence: 'log' }, true)).toBe(0); });
});
