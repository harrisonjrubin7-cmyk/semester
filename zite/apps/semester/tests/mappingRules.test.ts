import { test, eq } from './harness';
import { validateMapping, detectDrift } from '../src/lib/mappingRules';

const good = [{ source: 'student_id', target: 'person.externalId', transform: 'trim' as const, required: true }, { source: 'email', target: 'person.email', transform: 'lowercase' as const, required: true }, { source: 'status', target: 'enrollment.status', transform: 'copy' as const, required: false }];
test('a valid mapping passes (control)', () => eq(validateMapping('SIS', good), null));
test('targets outside the allowlist are refused', () => eq(typeof validateMapping('LMS', [{ source: 'x', target: 'grade.final', transform: 'copy', required: true }]), 'string'));
test('free-form target paths are refused', () => eq(typeof validateMapping('SIS', [...good, { source: 'y', target: 'users.isAdmin', transform: 'copy', required: false }]), 'string'));
test('duplicate source or target is refused', () => {
  eq(typeof validateMapping('SIS', [...good, { source: 'EMAIL', target: 'person.name', transform: 'copy', required: false }]), 'string');
  eq(typeof validateMapping('SIS', [...good, { source: 'mail2', target: 'person.email', transform: 'copy', required: false }]), 'string');
});
test('a stable identifier is required', () => eq(typeof validateMapping('SIS', [{ source: 'name', target: 'person.name', transform: 'copy', required: true }]), 'string'));
test('bad source names are refused', () => eq(typeof validateMapping('SIS', [{ source: '1; drop', target: 'person.externalId', transform: 'copy', required: true }]), 'string'));
test('drift: a missing required field is not ok; new fields are reported', () => {
  const d = detectDrift(good, ['Student_ID', 'status', 'phone']);
  eq(d.ok, false); eq(d.missingRequired.join(), 'email'); eq(d.newFields.join(), 'phone');
});
test('drift: missing optional only is still ok (control)', () => { const d = detectDrift(good, ['student_id', 'email']); eq(d.ok, true); eq(d.missingOptional.join(), 'status'); });
test('protected targets are flagged', () => eq(detectDrift([{ source: 'g', target: 'grade.final', transform: 'copy', required: true }], ['g']).protectedTargets.join(), 'grade.final'));
