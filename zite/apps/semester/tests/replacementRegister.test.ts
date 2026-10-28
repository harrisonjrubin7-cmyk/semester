import { test, eq } from './harness';
import { CAPABILITIES, FIRST_PATH, stageOf, problems, type Capability } from '../src/lib/replacementRegister';

test('the register has no unsupported claims', () => { eq(problems(CAPABILITIES), []); });
test('nothing is marked institution-authorized or production-enabled without an owner approval', () => {
  eq(CAPABILITIES.filter((c) => c.evidence.some((e) => e.stage === 'institution_authorized' || e.stage === 'production_enabled')).map((c) => c.id), []);
});
test('the §16 first path is fully listed and every link names its open gaps or evidence', () => {
  const ids = new Set(CAPABILITIES.map((c) => c.id));
  eq(FIRST_PATH.every((id) => ids.has(id)), true);
  eq(FIRST_PATH.map((id) => stageOf(CAPABILITIES.find((c) => c.id === id)!)), ['tested', 'tested', 'implemented', 'tested', 'tested', 'tested']);
});
test('stages cannot be skipped and evidence cannot be blank (control)', () => {
  const bad: Capability = { id: 'x', area: 'SIS', name: 'x', spec: '', route: null, evidence: [{ stage: 'designed', ref: 'd' }, { stage: 'deployed', ref: 'build 1' }, { stage: 'production_enabled', ref: 'yes' }], gaps: [] };
  eq(stageOf(bad), 'designed');
  eq(problems([bad]), ['x: deployed claimed without tested', 'x: production_enabled claimed without institution_authorized', 'x: production_enabled needs an owner approval reference (APPROVAL:…)']);
});
