import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { test, eq } from './harness';
import { S92_TESTS, evidenceProblems, type PermissionTest } from '../src/lib/permissionEvidence';

let base = resolve('.');
while (!existsSync(join(base, 'apps', 'semester', 'src', 'lib')) && dirname(base) !== base) base = dirname(base);
const read = (f: string) => (existsSync(join(base, f)) ? readFileSync(join(base, f), 'utf8') : null);

test('all 13 S-92 §7 tests are listed in order', () => { eq(S92_TESTS.map((t) => t.id), Array.from({ length: 13 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`)); });
test('every cited check exists and carries the cited label verbatim', () => { eq(evidenceProblems(S92_TESTS, read), []); });
test('the register cannot overclaim (control)', () => {
  const bad: PermissionTest[] = [
    { id: 'X1', test: 't', expected: 'e', status: 'evidenced', proofs: [], gap: '' },
    { id: 'X2', test: 't', expected: 'e', status: 'partial', proofs: [{ file: 'apps/semester/dbchecks/holds.ts', label: 'H99 a check that does not exist' }], gap: '' },
    { id: 'X3', test: 't', expected: 'e', status: 'not built', proofs: [{ file: 'nope.ts', label: 'x' }], gap: 'g' },
  ];
  eq(evidenceProblems(bad, read), ['X1: evidenced needs a repeatable check', 'X2: partial needs a stated gap', 'X2: "H99 a check that does not exist" is not in apps/semester/dbchecks/holds.ts',
    'X3: not built must not cite proofs', 'X3: nope.ts does not exist']);
});
