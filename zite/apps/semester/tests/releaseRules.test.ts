import { test, eq } from './harness';
import { readinessRelease, assuranceRelease, assuranceProblems } from '../src/lib/releaseRules';

test('a readiness release keeps only key, label and state of each check (control: values pass through)', () => {
  const r = readinessRelease({ ready: false, generatedAt: '2026-10-28T00:00:00Z', checks: [{ key: 'members', label: 'People onboarded', state: 'ok', detail: '412 people hold a membership.' }, { key: 'x', label: 'Odd', state: 'weird' }] } as never);
  eq(r, { ready: false, generatedAt: '2026-10-28T00:00:00Z', checks: [{ key: 'members', label: 'People onboarded', state: 'ok' }, { key: 'x', label: 'Odd', state: 'info' }] });
  eq(JSON.stringify(r).includes('412'), false);
});
test('an assurance release carries coverage, never summaries, references or reviewers', () => {
  const r = assuranceRelease({ id: 'c1', capability: 'Enrollment', domain: 'SIS' }, [
    { stage: 'Tested', environment: 'Synthetic', summary: 'student 123 row', reference: 'https://x', reviewer: 'u1' },
    { stage: 'Designed', environment: 'Synthetic' }, { stage: 'Tested', environment: 'Sandbox' }]);
  eq(r, { capabilityId: 'c1', capability: 'Enrollment', domain: 'SIS', stages: ['Designed', 'Tested'], environments: ['Sandbox', 'Synthetic'], evidenceCount: 3 });
  eq(/student 123|https|u1/.test(JSON.stringify(r)), false);
});
test('production evidence blocks a release', () => {
  eq(assuranceProblems([{ environment: 'Synthetic' }]), []);
  eq(assuranceProblems([{ environment: 'Production' }]).length, 1);
});
