// Roster import (owner sources S-92 §1, S-93 §2–3). Parses OneRoster-shaped CSV text (users.csv, enrollments.csv) into
// plain rows for the gateway. This is "OneRoster-shaped", not certified OneRoster: no conformance is claimed. Only allowlisted
// columns are kept; everything else is dropped and reported by name (never by value). Pure; tested in tests/rosterRules.test.ts.
export const USER_FIELDS = ['sourcedId', 'status', 'dateLastModified', 'email', 'givenName', 'familyName', 'role'] as const;
export const ENROLLMENT_FIELDS = ['sourcedId', 'status', 'dateLastModified', 'classSourcedId', 'userSourcedId', 'role'] as const;
const REQUIRED_USER = ['sourcedId', 'email'];
const REQUIRED_ENROLLMENT = ['sourcedId', 'classSourcedId', 'userSourcedId', 'role', 'dateLastModified'];
export const MAX_ROWS = 5000;

export type RosterUser = { sourcedId: string; email: string; givenName: string; familyName: string; status: string };
export type RosterEnrollment = { line: number; sourcedId: string; classSourcedId: string; userSourcedId: string; role: string; status: string; modified: string };
export type Parsed = { users: RosterUser[]; enrollments: RosterEnrollment[]; dropped: string[]; problems: string[] };

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF. Returns rows of cells. */
export function csv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"' && cell === '') { q = true; continue; }
    if (ch === ',') { row.push(cell); cell = ''; continue; }
    if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; continue; }
    cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function table(text: string, name: string, allowed: readonly string[], required: string[], problems: string[], dropped: Set<string>) {
  const rows = csv(text);
  if (!rows.length) { problems.push(`${name} is empty.`); return []; }
  const head = rows[0].map((h) => h.trim());
  for (const r of required) if (!head.includes(r)) problems.push(`${name} has no ${r} column.`);
  if (new Set(head).size !== head.length) problems.push(`${name} repeats a column name.`);
  head.filter((h) => !(allowed as readonly string[]).includes(h)).forEach((h) => dropped.add(`${name}:${h}`));
  if (rows.length - 1 > MAX_ROWS) problems.push(`${name} has more than ${MAX_ROWS} rows; split the file.`);
  return rows.slice(1, MAX_ROWS + 1).map((r, i) => {
    if (r.length !== head.length) problems.push(`${name} line ${i + 2} has ${r.length} fields; the header has ${head.length}.`);
    return { line: i + 2, get: (k: string) => { const j = head.indexOf(k); return j < 0 ? '' : (r[j] ?? '').trim(); } };
  });
}

export function parseRoster(usersCsv: string, enrollmentsCsv: string): Parsed {
  const problems: string[] = []; const dropped = new Set<string>();
  const users = table(usersCsv, 'users.csv', USER_FIELDS, REQUIRED_USER, problems, dropped)
    .map((r) => ({ sourcedId: r.get('sourcedId'), email: r.get('email').toLowerCase(), givenName: r.get('givenName'), familyName: r.get('familyName'), status: r.get('status') || 'active' }));
  const enrollments = table(enrollmentsCsv, 'enrollments.csv', ENROLLMENT_FIELDS, REQUIRED_ENROLLMENT, problems, dropped)
    .map((r) => ({ line: r.line, sourcedId: r.get('sourcedId'), classSourcedId: r.get('classSourcedId'), userSourcedId: r.get('userSourcedId'),
      role: r.get('role').toLowerCase(), status: (r.get('status') || 'active').toLowerCase(), modified: r.get('dateLastModified') }));
  const ids = new Set<string>();
  for (const u of users) { if (!u.sourcedId) problems.push('users.csv has a row with no sourcedId.'); else if (ids.has(u.sourcedId)) problems.push(`users.csv repeats sourcedId ${u.sourcedId}.`); ids.add(u.sourcedId); }
  for (const e of enrollments) {
    if (e.modified && isNaN(new Date(e.modified).getTime())) problems.push(`enrollments.csv line ${e.line}: dateLastModified is not a date.`);
    if (!['active', 'tobedeleted'].includes(e.status)) problems.push(`enrollments.csv line ${e.line}: status must be active or tobedeleted.`);
  }
  return { users, enrollments, dropped: [...dropped].sort(), problems: [...new Set(problems)] };
}
