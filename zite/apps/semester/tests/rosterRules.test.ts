import { test, eq } from './harness';
import { csv, parseRoster } from '../src/lib/rosterRules';

const U = 'sourcedId,email,givenName,familyName,ssn\r\nu1,Ana@Example.edu,Ana,"Diaz, Jr.",123\r\nu2,bo@example.edu,Bo,"Say ""hi""",456\r\n';
const E = 'sourcedId,status,dateLastModified,classSourcedId,userSourcedId,role\ne1,active,2026-10-01T00:00:00Z,c1,u1,student\ne2,tobedeleted,2026-10-02T00:00:00Z,c1,u2,Teacher\n';
test('CSV: quoted commas, doubled quotes, CRLF and a byte-order mark', () => {
  eq(csv('﻿a,"b,c","d""e"\r\n1,2,3'), [['a', 'b,c', 'd"e'], ['1', '2', '3']]);
});
test('a well-formed roster parses; emails and roles are normalised (control)', () => {
  const p = parseRoster(U, E);
  eq(p.problems, []);
  eq(p.users.map((u) => [u.sourcedId, u.email, u.familyName]), [['u1', 'ana@example.edu', 'Diaz, Jr.'], ['u2', 'bo@example.edu', 'Say "hi"']]);
  eq(p.enrollments.map((e) => [e.line, e.role, e.status]), [[2, 'student', 'active'], [3, 'teacher', 'tobedeleted']]);
});
test('columns outside the allowlist are dropped and named, never kept', () => {
  const p = parseRoster(U, E);
  eq(p.dropped, ['users.csv:ssn']);
  eq(JSON.stringify(p.users).includes('123'), false);
});
test('missing columns, ragged lines, bad dates, bad status and repeated ids are refused', () => {
  const p = parseRoster('sourcedId,email\nu1,a@x.edu\nu1,b@x.edu\n', 'sourcedId,classSourcedId,userSourcedId,role,dateLastModified,status\ne1,c1,u1,student,yesterday,active\ne2,c1,u1,student,2026-10-01,maybe\ne3,c1\n');
  eq(p.problems, ['enrollments.csv line 4 has 2 fields; the header has 6.', 'users.csv repeats sourcedId u1.', 'enrollments.csv line 2: dateLastModified is not a date.',
    'enrollments.csv line 3: status must be active or tobedeleted.']);
  eq(parseRoster('email\n', 'sourcedId\n').problems.slice(0, 2), ['users.csv has no sourcedId column.', 'enrollments.csv has no classSourcedId column.']);
});
