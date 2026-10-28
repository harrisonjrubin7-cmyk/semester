import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { test, eq } from './harness';
import { CONNECTIONS, APP_IDS, statusProblems, summary, type Connection } from '../src/lib/connectionRegister';

let base = resolve('.');
while (!existsSync(join(base, 'apps', 'semester', 'src', 'lib')) && dirname(base) !== base) base = dirname(base);

const PAIRS = ['institution>faculty', 'institution>student', 'faculty>student', 'student>faculty', 'faculty>institution', 'site>applicants',
  'applicants>institution', 'institution>applicants', 'applicants>student', 'student>family', 'family>institution', 'institution>family',
  'employers>student', 'student>employers', 'institution>employers', 'faculty>student', 'institution>developers', 'developers>institution',
  'institution>company', 'company>institution', 'lab>company', 'lab>institution', 'institution>site'];

test('all 23 owner connections are present, in order, with ten real app ids', () => {
  eq(CONNECTIONS.map((c) => `${c.producer}>${c.consumer}`), PAIRS);
  eq(Object.values(APP_IDS).every((v) => /^[a-z0-9]{10}$/.test(v)), true);
  eq(new Set(Object.values(APP_IDS)).size, 10);
});
test('every cited file exists', () => {
  eq(CONNECTIONS.flatMap((c) => [...c.code, ...c.tests].filter((f) => !existsSync(join(base, f))).map((f) => `${c.id} ${f}`)), []);
});
test('no status is stronger than its evidence', () => { eq(CONNECTIONS.flatMap(statusProblems), []); });
test('the guard catches an overclaim (control)', () => {
  const bad: Connection = { ...CONNECTIONS[5], id: 'C06', status: 'observed', code: [], tests: [] };
  eq(statusProblems(bad), ['C06: observed needs code references', 'C06: observed needs test evidence']);
});
test('the summary counts every connection', () => { eq(Object.values(summary()).reduce((a, b) => a + b, 0), 23); });
