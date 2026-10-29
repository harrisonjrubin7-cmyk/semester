// Guard for the control plane's "enforced" label: every module listed in TCP_ENFORCED names a file that really calls
// requireModule (or moduleOn) for that module, and quota:true only where consume:true is passed. A label with no check
// behind it would tell an administrator that switching a module off does something it does not.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { test, eq } from './harness';
import { TCP_ENFORCED, TCP_MODULES } from '../src/lib/tcpMigration';

let base = resolve('.');
while (!existsSync(join(base, 'apps', 'semester', 'src', 'lib')) && dirname(base) !== base) base = dirname(base);
const src = (f: string) => (existsSync(join(base, f)) ? readFileSync(join(base, f), 'utf8') : '');
const calls = (text: string, m: string) => new RegExp(`(requireModule|moduleOn)\\([^)]*'${m}'`).test(text);
const consumes = (text: string, m: string) => new RegExp(`requireModule\\([^)]*'${m}'[^)]*consume:\\s*true`).test(text);

test('control: the probe detects a call and the absence of one', () => eq([calls("await requireModule(t, 'x', [], { consume: true })", 'x'), calls("await requireModule(t, 'y', [])", 'x'), consumes("requireModule(t, 'x', [])", 'x')], [true, false, false]));
test('every enforced module is a catalog module and listed once', () => eq([TCP_ENFORCED.every((e) => (TCP_MODULES as readonly string[]).includes(e.module)), new Set(TCP_ENFORCED.map((e) => e.module)).size === TCP_ENFORCED.length], [true, true]));
test('every enforced module is checked in the file it names', () => eq(TCP_ENFORCED.filter((e) => !calls(src(e.where), e.module)).map((e) => `${e.module} @ ${e.where}`), []));
test('quota is claimed only where a call is counted', () => eq(TCP_ENFORCED.filter((e) => e.quota !== consumes(src(e.where), e.module)).map((e) => e.module), []));
