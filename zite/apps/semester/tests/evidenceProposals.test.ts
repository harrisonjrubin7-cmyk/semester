// Guard for Security Lab's proposed evidence: every proposal names files that exist, a reference long enough to accept, and
// one proposal per capability and stage. A proposal pointing at a missing file is a claim with nothing behind it.
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { test, eq } from './harness';
import { PROPOSALS } from '../../semester-security-lab/src/lib/evidenceProposals';

let base = resolve('.');
while (!existsSync(join(base, 'apps', 'semester', 'src', 'lib')) && dirname(base) !== base) base = dirname(base);

test('control: the guard sees proposals and a missing file is detected', () => eq([PROPOSALS.length > 10, existsSync(join(base, 'apps/semester/src/lib/nope.ts'))], [true, false]));
test('every file named by a proposal exists', () => eq(PROPOSALS.flatMap((p) => p.files.filter((f) => !existsSync(join(base, f))).map((f) => `${p.key} ${f}`)), []));
test('one proposal per capability and stage', () => eq(PROPOSALS.length, new Set(PROPOSALS.map((p) => p.key)).size));
test('references and scopes are concrete', () => eq(PROPOSALS.filter((p) => p.reference.length < 10 || !p.scope.trim() || !/^[0-9a-f-]{36}$/.test(p.capabilityId)).map((p) => p.key), []));
test('Tested proposals name a test or database check', () => eq(PROPOSALS.filter((p) => p.stage === 'Tested' && !p.files.every((f) => /\/(tests|dbchecks)\//.test(f))).map((p) => p.key), []));
