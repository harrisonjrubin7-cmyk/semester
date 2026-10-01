/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_MODULES } from '@semester/contract';
import type { LedgerEntry } from '../record/ledger';
import { FORMAT, NOTICE, READ_KINDS, buildBody, linesAsOf, seal, type Head, type Line } from './body';
import { NOT_CANONICAL, byBytes, canonicalize, sha256Hex } from './canonical';
import { LIMITS, VERIFY_STATUSES } from './model';
import {
  NOTHING_ISSUED,
  NOT_SIGNED,
  VERIFY_LABEL,
  asOfProblem,
  checkProblems,
  copyText,
  courseLine,
  readBody,
  releaseProblems,
  replacesProblem,
  shortHash,
  studentRefProblem,
  todayIso,
  verificationSentence,
} from './views';

/**
 * Issued transcripts' rules, worked out from rows, and held to the migration.
 *
 * `20260930260000_transcripts.sql` is the authority. Four kinds of test here:
 * the shared fixtures, which this file and `supabase/transcripts.check.sql` must
 * both reproduce exactly, so the TypeScript canonical text, body and hash cannot
 * drift from the SQL ones; a parity block that reads the migration's text and
 * holds every limit, vocabulary and argument name in `model.ts` and `client.ts`
 * equal to it; hard cases for the one part most likely to be subtly wrong, the
 * canonical text; and the pure functions on hand-built cases.
 */

const ROOT = join(__dirname, '..', '..', '..', '..');
const SQL = readFileSync(join(ROOT, 'supabase', 'migrations', '20260930260000_transcripts.sql'), 'utf8');

interface CanonicalCase { name: string; value: unknown; text: string; sha256: string }
interface TranscriptCase { name: string; head: Head; lines: Line[]; expected: { body: unknown; text: string; sha256: string } }
const FIXTURES = JSON.parse(readFileSync(join(__dirname, 'fixtures.json'), 'utf8')) as {
  canonical: CanonicalCase[];
  refused_canonical: { name: string; value: unknown }[];
  transcripts: TranscriptCase[];
  refused_transcripts: { name: string; head: Head; lines: Line[] }[];
};

const node = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

// ── The twin, held to the shared fixtures ───────────────────────────────

describe('the TypeScript canonical text and the SQL one run the same fixtures', () => {
  // The control: the probe must be able to read the fixtures at all, and find
  // enough of them to be a test.
  it('reads the fixtures file and finds the cases the SQL suite also reads', () => {
    expect(FIXTURES.canonical.length).toBeGreaterThanOrEqual(10);
    expect(FIXTURES.transcripts.length).toBeGreaterThanOrEqual(4);
    expect(new Set(FIXTURES.canonical.map((f) => f.name)).size).toBe(FIXTURES.canonical.length);
    expect(readFileSync(join(ROOT, 'supabase', 'transcripts.check.sql'), 'utf8')).toContain('transcripts/fixtures.json');
  });

  it.each(FIXTURES.canonical.map((f) => [f.name, f] as const))('reproduces the text and the hash: %s', async (_name, f) => {
    expect(canonicalize(f.value)).toBe(f.text);
    // Three hashes that must agree: the fixture's, Node's, and the platform's own.
    expect(node(f.text)).toBe(f.sha256);
    expect(await sha256Hex(f.text)).toBe(f.sha256);
    // And the text is JSON that says the same thing as the value it came from.
    expect(JSON.parse(f.text)).toEqual(f.value);
  });

  it.each(FIXTURES.refused_canonical.map((f) => [f.name, f] as const))('refuses what a database could not hold alike: %s', (_name, f) => {
    expect(() => canonicalize(f.value)).toThrow(NOT_CANONICAL);
  });

  it.each(FIXTURES.transcripts.map((f) => [f.name, f] as const))('reproduces the body, its text and its hash: %s', async (_name, f) => {
    const body = buildBody(f.head, f.lines);
    expect(body).toEqual(f.expected.body);
    const text = canonicalize(body);
    expect(text).toBe(f.expected.text);
    expect(node(text)).toBe(f.expected.sha256);
    expect((await seal(f.head, f.lines)).sha256).toBe(f.expected.sha256);
  });

  it.each(FIXTURES.refused_transcripts.map((f) => [f.name, f] as const))('refuses: %s', (_name, f) => {
    expect(() => buildBody(f.head, f.lines)).toThrow('one ledger line for each kind and key');
  });

  // The control: the comparisons above are able to fail, so a pass is not vacuous.
  it('would notice a wrong answer', () => {
    const f = FIXTURES.transcripts[0];
    expect(canonicalize(buildBody({ ...f.head, serial: '2' }, f.lines))).not.toBe(f.expected.text);
    expect(node(f.expected.text + ' ')).not.toBe(f.expected.sha256);
    const grade = f.lines.findIndex((l) => l.kind === 'grade');
    const edited = f.lines.map((l, i) => (i === grade ? { ...l, value: l.value + 'x' } : l));
    expect(canonicalize(buildBody(f.head, edited))).not.toBe(f.expected.text);
  });

  it('covers the cases that are hard: escapes, byte order, a missing term, a repeated separator, empty', () => {
    const names = FIXTURES.canonical.map((f) => f.name).join('\n');
    expect(names).toMatch(/UTF-8 bytes/);
    expect(names).toMatch(/short escapes/);
    expect(names).toMatch(/lower-case hex/);
    expect(names).toMatch(/combining/);
    const keys = FIXTURES.transcripts.flatMap((f) => f.lines.map((l) => l.key));
    expect(keys.some((k) => !k.includes(' · '))).toBe(true);
    expect(keys.some((k) => k.split(' · ').length > 2)).toBe(true);
    expect(keys.some((k) => k.startsWith(' · '))).toBe(true);
    expect(FIXTURES.transcripts.some((f) => f.lines.length === 0)).toBe(true);
  });
});

// ── The canonical text, hard ───────────────────────────────────────────

describe('the canonical text', () => {
  it('sorts keys by their UTF-8 bytes, which is not the order JavaScript sorts strings in', () => {
    // An emoji is two UTF-16 code units, 0xD83D 0xDE00, and U+FFFF is one, 0xFFFF.
    // By code unit the emoji comes first; by byte, where it is F0 9F 98 80 against
    // EF BF BF, it comes last. The database sorts by byte.
    const emoji = '\u{1F600}';
    const ffff = '￿';
    expect([emoji, ffff].sort()).toEqual([emoji, ffff]);
    expect([emoji, ffff].sort(byBytes)).toEqual([ffff, emoji]);
    expect(canonicalize({ [emoji]: '1', [ffff]: '2' }).indexOf(ffff)).toBeLessThan(canonicalize({ [emoji]: '1', [ffff]: '2' }).indexOf(emoji));
    // A prefix sorts before what it prefixes, and nothing before it.
    expect(byBytes('a', 'ab')).toBe(-1);
    expect(byBytes('ab', 'a')).toBe(1);
    expect(byBytes('', 'a')).toBe(-1);
    expect(byBytes('a', 'a')).toBe(0);
    // Upper case before lower, as bytes.
    expect(['b', 'B', 'a', 'A'].sort(byBytes)).toEqual(['A', 'B', 'a', 'b']);
  });

  it('does not depend on the order keys were added in', () => {
    const a = canonicalize({ one: '1', two: '2', three: { y: '1', x: '2' } });
    const b = canonicalize({ three: { x: '2', y: '1' }, two: '2', one: '1' });
    expect(a).toBe(b);
    expect(a).toBe('{"one":"1","three":{"x":"2","y":"1"},"two":"2"}');
  });

  it('keeps the order of an array', () => {
    expect(canonicalize(['b', 'a'])).toBe('["b","a"]');
  });

  it('writes no whitespace anywhere, and nothing but objects, arrays and strings', () => {
    const text = canonicalize({ a: ['x', { b: 'y z' }], c: '' });
    expect(text).toBe('{"a":["x",{"b":"y z"}],"c":""}');
    for (const bad of [1, 0, true, false, null, undefined, { a: 1 }, [null], [[true]], new Date(0)]) {
      expect(() => canonicalize(bad), String(bad)).toThrow(NOT_CANONICAL);
    }
  });

  // The escaping rule written out by hand, apart from JSON.stringify, so the two
  // can be compared on every character the database might hold.
  const byHand = (s: string): string => {
    let out = '"';
    for (const ch of s) {
      const c = ch.codePointAt(0)!;
      if (ch === '"') out += '\\"';
      else if (ch === '\\') out += '\\\\';
      else if (c === 8) out += '\\b';
      else if (c === 12) out += '\\f';
      else if (c === 10) out += '\\n';
      else if (c === 13) out += '\\r';
      else if (c === 9) out += '\\t';
      else if (c < 0x20) out += `\\u${c.toString(16).padStart(4, '0')}`;
      else out += ch;
    }
    return `${out}"`;
  };

  it('escapes exactly as the migration says, for every character in the first planes of interest', () => {
    const chars: string[] = [];
    for (let c = 1; c < 0x300; c++) chars.push(String.fromCodePoint(c));
    for (const c of [0x2028, 0x2029, 0xfeff, 0xfffd, 0xffff, 0x1f600, 0x1d56c, 0x10ffff]) chars.push(String.fromCodePoint(c));
    expect(chars.length).toBeGreaterThan(700);
    for (const ch of chars) expect(canonicalize(ch), `U+${ch.codePointAt(0)!.toString(16)}`).toBe(byHand(ch));
    expect(canonicalize(chars.join(''))).toBe(byHand(chars.join('')));
  });

  it('writes a control character as \\u00xx in lower case, and DEL as itself', () => {
    expect(canonicalize('\u001f')).toBe('"\\u001f"');
    expect(canonicalize('\u000b')).toBe('"\\u000b"');
    expect(canonicalize('\u007f')).toBe('"\u007f"');
    expect(canonicalize('/')).toBe('"/"');
    expect(canonicalize(' ')).toBe('" "');
  });

  it('does not normalise: a precomposed letter and a combining one are two texts and two hashes', async () => {
    const a = canonicalize('é');
    const b = canonicalize('é');
    expect(a).not.toBe(b);
    expect(await sha256Hex(a)).not.toBe(await sha256Hex(b));
  });

  it('hashes UTF-8 bytes: the digest of café is the one sha256sum gives', async () => {
    expect(await sha256Hex('café')).toBe('850f7dc43910ff890f8879c0ed26fe697c93a067ad93a7d50f466a7028a9bf4e');
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('refuses a lone surrogate, which a database cannot keep and JSON.stringify would write anyway', () => {
    expect(() => canonicalize('\ud83d')).toThrow(NOT_CANONICAL);
    expect(() => canonicalize('x\ude00y')).toThrow(NOT_CANONICAL);
    expect(() => canonicalize({ ['\ud83d']: 'k' })).toThrow(NOT_CANONICAL);
    // A pair is not lone.
    expect(canonicalize('😀')).toBe('"\u{1F600}"');
  });
});

// ── The body ───────────────────────────────────────────────────────────

describe('the body', () => {
  const head: Head = { serial: '7', school_id: 'vu', school_name: 'Vale University', student_ref: 'S100', as_of: '2026-09-30' };
  const line = (kind: Line['kind'], key: string, value: string, effective_on = '2026-01-01'): Line => ({ kind, key, value, effective_on });

  it('names the school, the student, the serial, the date and what it read, and says it is not signed', () => {
    const b = buildBody(head, []);
    expect(b.format).toBe(FORMAT);
    expect(b.school).toEqual({ id: 'vu', name: 'Vale University' });
    expect([b.student_ref, b.serial, b.as_of]).toEqual(['S100', '7', '2026-09-30']);
    expect(b.includes).toEqual([...READ_KINDS]);
    expect(b.notice).toBe(NOTICE);
    expect(NOTICE).toMatch(/not signed/);
    expect(NOTICE).toMatch(/does not show who issued it/);
  });

  it('groups a course under the term its key names, split at the first separator only', () => {
    const b = buildBody(head, [line('grade', 'ECON 1010 · Fall 2025', 'A'), line('grade', 'ART 1 · Spring · Late 2026', 'B'), line('credit', 'NOTERM', '3')]);
    expect(b.terms.map((t) => t.term)).toEqual(['', 'Fall 2025', 'Spring · Late 2026']);
    expect(b.terms[2].courses[0]).toEqual({ course: 'ART 1', key: 'ART 1 · Spring · Late 2026', enrollment: '', grade: 'B', credit: '' });
    expect(b.terms[0].courses[0].course).toBe('NOTERM');
  });

  it('joins one course’s enrolment, grade and credit from three lines, and leaves the rest empty', () => {
    const b = buildBody(head, [line('credit', 'X 1 · T', '3.00'), line('enrollment', 'X 1 · T', 'Enrolled'), line('grade', 'X 1 · T', 'P')]);
    expect(b.terms[0].courses).toEqual([{ course: 'X 1', key: 'X 1 · T', enrollment: 'Enrolled', grade: 'P', credit: '3.00' }]);
    // Credit is the ledger's text: "3.00" is not turned into 3.
    expect(canonicalize(b)).toContain('"credit":"3.00"');
  });

  it('does not read a requirement entry, and refuses two lines for one key', () => {
    expect(() => buildBody(head, [line('grade', 'A · T', 'A'), line('grade', 'A · T', 'B')])).toThrow('one ledger line for each kind and key');
    expect(READ_KINDS).not.toContain('requirement');
  });

  it('is the same body whatever order the lines come in', () => {
    const lines = [line('grade', 'B · T', 'A'), line('grade', 'A · T', 'B'), line('standing', 'z', '1'), line('standing', 'a', '2'), line('conferral', 'c', 'd'), line('transfer_credit', 'm · X', '3')];
    const text = canonicalize(buildBody(head, lines));
    expect(canonicalize(buildBody(head, [...lines].reverse()))).toBe(text);
    expect(canonicalize(buildBody(head, [lines[3], lines[0], lines[5], lines[1], lines[4], lines[2]]))).toBe(text);
  });

  it('seals a body: the text is its canonical text and the hash is of that text', async () => {
    const sealed = await seal(head, [line('grade', 'A · T', 'A')]);
    expect(sealed.text).toBe(canonicalize(sealed.body));
    expect(sealed.sha256).toBe(node(sealed.text));
    // A changed serial is a changed hash: a hash does not carry from one serial to another.
    expect((await seal({ ...head, serial: '8' }, [line('grade', 'A · T', 'A')])).sha256).not.toBe(sealed.sha256);
  });
});

// ── The ledger as of a date ────────────────────────────────────────────

describe('the lines a transcript reads from the ledger', () => {
  let n = 0;
  const entry = (kind: LedgerEntry['kind'], key: string, value: string, effective_on: string, action: LedgerEntry['action'] = 'set'): LedgerEntry => {
    n += 1;
    return {
      id: `id-${String(n).padStart(3, '0')}`, tenant_id: 'vu', student_ref: 'S100', kind, subject_key: key, action, value, previous_value: null,
      previous_entry_id: null, effective_on, reason: 'r', source: 'registrar', change_id: `c-${n}`, proposed_by: null, approved_by: null, override: false,
      recorded_at: `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`,
    };
  };
  const E = [
    entry('grade', 'ECON 1 · Fall', 'B', '2025-12-15'),
    entry('grade', 'ECON 1 · Fall', 'A-', '2026-01-20'),
    entry('standing', 'Academic standing', 'Probation', '2025-10-01'),
    entry('standing', 'Academic standing', '', '2026-01-01', 'void'),
    entry('requirement', 'Gen ed', 'waived', '2025-09-01'),
    entry('conferral', 'B.A.', 'Conferred', '2030-01-01'),
    entry('enrollment', 'ECON 1 · Fall', 'Enrolled', '2025-09-01'),
  ];

  it('is the entry in effect for each key on the date, and a void means absent', () => {
    const early = linesAsOf(E, '2025-12-31');
    expect(early.find((l) => l.kind === 'grade')?.value).toBe('B');
    expect(early.find((l) => l.kind === 'standing')?.value).toBe('Probation');
    const late = linesAsOf(E, '2026-02-01');
    expect(late.find((l) => l.kind === 'grade')?.value).toBe('A-');
    expect(late.some((l) => l.kind === 'standing')).toBe(false);
  });

  it('does not read a requirement entry, or one effective after the date', () => {
    const lines = linesAsOf(E, '2026-02-01');
    expect(lines.some((l) => (l.kind as string) === 'requirement')).toBe(false);
    expect(lines.some((l) => l.kind === 'conferral')).toBe(false);
    expect(linesAsOf(E, '2030-01-01').some((l) => l.kind === 'conferral')).toBe(true);
  });

  it('builds the body the SQL builder would, from the same lines', () => {
    const lines = linesAsOf(E, '2025-12-31');
    const b = buildBody({ serial: '1', school_id: 'vu', school_name: 'Vale University', student_ref: 'S100', as_of: '2025-12-31' }, lines);
    expect(b.terms).toEqual([{ term: 'Fall', courses: [{ course: 'ECON 1', key: 'ECON 1 · Fall', enrollment: 'Enrolled', grade: 'B', credit: '' }] }]);
    expect(b.standing).toEqual([{ key: 'Academic standing', value: 'Probation', effective_on: '2025-10-01' }]);
  });
});

// ── Parity with the migration ──────────────────────────────────────────

describe('the migration and the client say the same thing', () => {
  // The control: the probe must be able to read this file at all.
  it('can read the migration and find what it is looking for', () => {
    expect(SQL.length).toBeGreaterThan(10000);
    expect(SQL).toContain('create table if not exists public.transcripts');
    expect(SQL).not.toContain('create table if not exists public.no_such_table_zz');
  });

  it('holds every limit equal', () => {
    expect(SQL).toContain(`length(btrim(recipient_name)) between 1 and ${LIMITS.recipientName}`);
    expect(SQL).toContain(`length(btrim(recipient_kind)) between 1 and ${LIMITS.recipientKind}`);
    expect(SQL).toContain(`length(btrim(purpose)) between 1 and ${LIMITS.purpose}`);
    expect(SQL).toContain(`length(btrim(reason)) between 1 and ${LIMITS.reason}`);
    expect(SQL).toContain(`'transcript_verify', ${LIMITS.checksPerHour}, 3600`);
  });

  it('holds the kinds read, the operation kinds and the three answers equal', () => {
    expect(SQL).toContain(`e.kind in (${READ_KINDS.map((k) => `'${k}'`).join(', ')})`);
    expect(SQL).toContain("kind in ('issue', 'disclose')");
    expect(SQL).toContain(`jsonb_build_array(${READ_KINDS.map((k) => `'${k}'`).join(', ')})`);
    expect(SQL).toContain(`'format', '${FORMAT}'`);
    expect(SQL).toContain(`'notice', '${NOTICE}'`);
    for (const s of VERIFY_STATUSES) expect(SQL, s).toContain(`'${s}'`);
    expect(VERIFY_STATUSES).toHaveLength(3);
  });

  it('is the module the registry calls records', () => {
    expect(CORE_MODULES).toContain('records');
    expect(SQL).toContain("e.module = 'records'");
    expect(SQL).toContain("t.module = 'records'");
  });

  it('names the two capabilities and who holds them, and widens nothing else', () => {
    expect(SQL).toContain("('registrar', 'transcript:issue')");
    expect(SQL).toContain("('registrar', 'transcript:read')");
    expect(SQL).toContain("('dean',      'transcript:read')");
    const grants = SQL.split('insert into public.role_capabilities')[1].split('on conflict')[0];
    expect(grants.match(/\('[a-z_]+',\s+'[a-z:_]+'\)/g)).toHaveLength(3);
    expect(grants).not.toMatch(/record:|degree:|grades:/);
  });

  // Every RPC's argument names, read out of the function signature.
  const signature = (name: string): string[] => {
    const m = new RegExp(`create or replace function public\\.${name}\\(([^)]*)\\)`, 's').exec(SQL);
    if (!m) throw new Error(`no function ${name}`);
    return [...m[1].matchAll(/want_[a-z_]+/g)].map((x) => x[0]);
  };

  it('has the RPCs the client calls, with the arguments it sends', () => {
    expect(signature('transcript_issue')).toEqual(['want_student_ref', 'want_as_of', 'want_supersedes', 'want_reason', 'want_key']);
    expect(signature('transcript_disclose')).toEqual(['want_serial', 'want_recipient_name', 'want_recipient_kind', 'want_purpose', 'want_key']);
    expect(signature('transcript_verify')).toEqual(['want_serial', 'want_hash']);
    const client = readFileSync(join(__dirname, 'client.ts'), 'utf8');
    for (const arg of [...signature('transcript_issue'), ...signature('transcript_disclose'), ...signature('transcript_verify')]) expect(client, arg).toContain(arg);
  });

  it('reads every kept column the client selects', () => {
    const table = (name: string): string => SQL.split(`create table if not exists public.${name} (`)[1].split('\n);')[0];
    for (const col of ['serial', 'student_ref', 'as_of', 'issued_by', 'issued_at', 'body_text', 'body_sha256']) expect(table('transcripts'), col).toMatch(new RegExp(`^  ${col}\\s`, 'm'));
    for (const col of ['transcript_id', 'by_transcript', 'reason']) expect(table('transcript_supersessions'), col).toMatch(new RegExp(`^  ${col}\\s`, 'm'));
    for (const col of ['transcript_serial', 'student_ref', 'released_by', 'released_at', 'recipient_name', 'recipient_kind', 'purpose']) {
      expect(table('transcript_disclosures'), col).toMatch(new RegExp(`^  ${col}\\s`, 'm'));
    }
  });

  it('keeps the check behind an account and counts it, as the repository does for a signed-in caller', () => {
    expect(SQL).toContain("raise exception 'semester: sign in to check a transcript'");
    expect(SQL).toContain("private.take_direct_rate_limit(me, null, 'transcript_verify'");
    expect(SQL).toContain('revoke all on function public.transcript_verify(bigint, text) from public, anon;');
    expect(SQL).not.toMatch(/grant execute on function public\.transcript_verify[^;]*anon/);
  });

  it('answers a check with exactly four columns, none of them the text or the student', () => {
    expect(SQL).toContain('returns table (status text, school_id text, school_name text, issued_on date)');
  });
});

// ── The pure functions ─────────────────────────────────────────────────

describe('what a check says, and what a form asks first', () => {
  const v = (status: 'valid' | 'superseded' | 'unknown') => ({ status, schoolName: status === 'unknown' ? null : 'Vale University', issuedOn: status === 'unknown' ? null : '2026-09-30' });

  it('says valid, superseded or no match, and names the school and the day', () => {
    expect(verificationSentence(v('valid'))).toMatch(/Vale University issued this transcript on .*2026/);
    expect(verificationSentence(v('valid'))).toMatch(/not been replaced/);
    expect(verificationSentence(v('superseded'))).toMatch(/replaced it with a later one/);
    expect(verificationSentence(v('unknown'))).toMatch(/does not tell you which of the two is wrong/);
    expect(VERIFY_LABEL.unknown).toBe('No match');
  });

  it('never says a transcript is signed, official, certified or authenticated', () => {
    const said = [NOT_SIGNED, NOTICE, NOTHING_ISSUED, ...Object.values(VERIFY_LABEL), ...(['valid', 'superseded', 'unknown'] as const).map((s) => verificationSentence(v(s)))].join(' ');
    expect(said).not.toMatch(/\bofficial|certified|authenticated|authentic\b/i);
    expect(NOT_SIGNED).toMatch(/not a signed transcript/);
    expect(NOT_SIGNED).toMatch(/does not show who issued it/);
    expect(NOT_SIGNED).toMatch(/key/);
  });

  it('hands over the serial and the whole hash, and shows a short one only for comparing', () => {
    const t = { serial: 12, bodySha256: 'ab'.repeat(32) };
    expect(copyText(t)).toBe(`Transcript serial 12\nSHA-256 ${'ab'.repeat(32)}`);
    expect(shortHash(t.bodySha256)).toHaveLength(12);
  });

  it('refuses a date that is later than today or not a date', () => {
    const today = todayIso(new Date(2026, 8, 30, 12));
    expect(today).toBe('2026-09-30');
    expect(asOfProblem('2026-09-30', today)).toBeNull();
    expect(asOfProblem('2026-10-01', today)).toMatch(/never a later one/);
    expect(asOfProblem('1800-01-01', today)).toMatch(/not a date/);
    expect(asOfProblem('', today)).toMatch(/Give the date/);
    expect(asOfProblem('2026-13-45', today)).toMatch(/Give the date/);
  });

  it('refuses a student reference the migration would', () => {
    expect(studentRefProblem('S100')).toBeNull();
    expect(studentRefProblem(' S.1-a_b ')).toBeNull();
    expect(studentRefProblem('')).toMatch(/Give the student/);
    expect(studentRefProblem('S 100')).toMatch(/letters, digits/);
    expect(studentRefProblem('x'.repeat(65))).toMatch(/up to 64/);
  });

  it('wants a serial and a reason together, or neither', () => {
    expect(replacesProblem('', '')).toBeNull();
    expect(replacesProblem('4', 'The record was corrected.')).toBeNull();
    expect(replacesProblem('', 'Because.')).toMatch(/Give the serial/);
    expect(replacesProblem('4', '')).toMatch(/Say why/);
    expect(replacesProblem('four', 'x')).toMatch(/whole number/);
    expect(replacesProblem('0', 'x')).toMatch(/whole number/);
    expect(replacesProblem('4', 'x'.repeat(LIMITS.reason + 1))).toMatch(/up to 500/);
  });

  it('wants who a release was to, what kind of recipient and why', () => {
    expect(releaseProblems('Northern State', 'another school', 'Transfer admission.')).toEqual({});
    expect(releaseProblems('', '', '')).toEqual({ name: 'Say who it was released to.', kind: expect.stringMatching(/kind of recipient/), purpose: 'Say why it was released.' });
    expect(releaseProblems('x'.repeat(201), 'k', 'p').name).toMatch(/200/);
    expect(releaseProblems('n', 'x'.repeat(81), 'p').kind).toMatch(/80/);
    expect(releaseProblems('n', 'k', 'x'.repeat(501)).purpose).toMatch(/500/);
  });

  it('wants a whole-number serial and a 64-character hash for a check', () => {
    expect(checkProblems('12', 'ab'.repeat(32))).toEqual({});
    expect(checkProblems(' 12 ', ` ${'AB'.repeat(32)} `)).toEqual({});
    expect(checkProblems('', '').serial).toMatch(/whole number/);
    expect(checkProblems('12', 'xyz').hash).toMatch(/64/);
    expect(checkProblems('012', 'ab'.repeat(32)).serial).toMatch(/whole number/);
  });

  it('reads the kept text back into a body, or says it cannot', () => {
    const text = canonicalize(buildBody({ serial: '1', school_id: 'vu', school_name: 'V', student_ref: 'S1', as_of: '2026-01-01' }, []));
    expect(readBody(text)?.school.name).toBe('V');
    expect(readBody('not json')).toBeNull();
    expect(readBody('{"format":"another"}')).toBeNull();
    expect(readBody('"x"')).toBeNull();
  });

  it('phrases a course as the ledger holds it and nothing more', () => {
    expect(courseLine({ course: 'ECON 1', enrollment: 'Enrolled', grade: 'A-', credit: '3' })).toBe('ECON 1: grade A-, credit 3');
    expect(courseLine({ course: 'ECON 2', enrollment: 'Enrolled', grade: '', credit: '' })).toBe('ECON 2: enrolled');
    expect(courseLine({ course: 'ECON 3', enrollment: '', grade: '', credit: '1.5' })).toBe('ECON 3: no grade or enrollment on the record, credit 1.5');
  });
});
