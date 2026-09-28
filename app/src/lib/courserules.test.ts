import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { courseCode, courseLayers, latest, readPackItems, readRules, studyGate } from './courserules';

/**
 * The student's side of Course Studio (D-100 slice 2). What the server lets
 * be published, and who may read it, is proved by coursestudio.check.sql; this
 * is what the app makes of what it reads.
 */

const row = (over: Record<string, unknown>) => ({ course_code: 'ECON 1020', version: 1, published_at: '2026-09-01T12:00:00Z', ...over });

describe('the course key', () => {
  it('normalises the way the server does', () => {
    expect(courseCode(' econ  1020 ')).toBe('ECON 1020');
    expect(courseCode('PSCI 1104W')).toBe('PSCI 1104W');
    expect(courseCode('Economics')).toBe('');
  });

  it('accepts exactly the codes the migration accepts', () => {
    const sql = readFileSync(join(__dirname, '../../../supabase/migrations/20260928309000_course_studio.sql'), 'utf8');
    expect(sql).toContain(`c ~ '${/^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/.source}'`);
  });
});

describe('what is read', () => {
  it('takes the newest version of each course’s rules and guidance', () => {
    const got = latest(
      [row({ version: 1, blanket: 'prohibited' }), row({ version: 2, blanket: 'allowed', words: 'Practise freely.' })],
      [row({ version: 1, body: 'Old' }), row({ version: 2, body: 'Do the problem sets first.' })],
      [],
    );
    expect(got['ECON 1020'].rules).toMatchObject({ blanket: 'allowed', words: 'Practise freely.', published: '2026-09-01' });
    expect(got['ECON 1020'].guidance?.body).toBe('Do the problem sets first.');
  });

  it('treats an empty newest guidance as withdrawn', () => {
    expect(latest([], [row({ version: 1, body: 'x' }), row({ version: 2, body: '' })], [])['ECON 1020']).toBeUndefined();
  });

  it('shows each pack at its newest version, and hides one retired there', () => {
    const got = latest([], [], [
      row({ pack_id: 'a', version: 1, title: 'Midterm 1', items: [] }),
      row({ pack_id: 'a', version: 2, title: 'Midterm 1', retired: true, items: [] }),
      row({ pack_id: 'b', version: 1, title: 'Final', items: [] }),
    ]);
    expect(got['ECON 1020'].packs.map((p) => p.title)).toEqual(['Final']);
  });

  it('drops a use or state the engine does not know, rather than trusting it', () => {
    expect(readRules(row({ blanket: 'sometimes', uses: { practice: 'allowed', homework: 'allowed', grammar: 'maybe' } }))).toMatchObject({
      blanket: null,
      uses: { practice: 'allowed' },
    });
  });

  it('keeps only references with a title and a known authority, and only http links', () => {
    expect(
      readPackItems([
        { title: 'Slides', citation: 'Week 4', link: 'https://lms.example/w4', authority: 'authoritative' },
        { title: 'Key', link: 'javascript:alert(1)', authority: 'prohibited' },
        { title: '', authority: 'supplemental' },
        { title: 'No authority' },
      ]),
    ).toEqual([
      { title: 'Slides', citation: 'Week 4', link: 'https://lms.example/w4', authority: 'authoritative' },
      { title: 'Key', citation: '', link: '', authority: 'prohibited' },
    ]);
  });
});

describe('Study Studio’s gate', () => {
  const published = (rules: Record<string, unknown>) => latest([row(rules)], [], []);

  it('blocks when the instructor prohibits either study use, and says it was the instructor', () => {
    const gate = studyGate(courseLayers('ECON 1020', { stance: 'allowed', note: '' }, published({ uses: { practice: 'prohibited' } })));
    expect(gate.kind).toBe('prohibited');
    expect(gate.source).toBe('set by your instructor, published 2026-09-01');
  });

  it('asks for disclosure when the instructor allows it with disclosure', () => {
    expect(studyGate(courseLayers('ECON 1020', undefined, published({ blanket: 'limited' }))).kind).toBe('disclose');
  });

  it('asks nothing when the instructor allows both', () => {
    const gate = studyGate(courseLayers('ECON 1020', undefined, published({ blanket: 'allowed', words: 'Use it to study.' })));
    expect(gate.kind).toBe('allowed');
    expect(gate.line).toContain('Explaining course material: Allowed (set by your instructor, published 2026-09-01: "Use it to study.")');
  });

  it('with nothing published, behaves as before: the student’s own note, or a confirmation', () => {
    expect(studyGate(courseLayers('ECON 1020', { stance: 'banned', note: '' }, {})).kind).toBe('prohibited');
    expect(studyGate(courseLayers('ECON 1020', { stance: 'allowed', note: '' }, {})).kind).toBe('allowed');
    expect(studyGate(courseLayers('ECON 1020', { stance: 'unstated', note: '' }, {})).kind).toBe('confirm');
    expect(studyGate(courseLayers('ECON 1020', undefined, {})).source).toBe('nothing on file');
  });

  it('reads another course’s rules for nobody else', () => {
    expect(studyGate(courseLayers('HIST 2100', undefined, published({ blanket: 'allowed' }))).kind).toBe('confirm');
  });
});

describe('do-not-use references in Study Studio', () => {
  const pack = (items: { title: string; authority: 'authoritative' | 'supplemental' | 'prohibited' }[]) => [
    { id: 'p', title: 'P', note: '', published: '', items: items.map((i) => ({ citation: '', link: '', ...i })) },
  ];

  it('matches a title the way a person means it', async () => {
    const { sameTitle } = await import('./courserules');
    expect(sameTitle('Old Answer Key.pdf')).toBe(sameTitle('old answer-key'));
    expect(sameTitle('Week 4 — Slides')).toBe('week 4 slides');
  });

  it('holds back only sources matching a do-not-use reference', async () => {
    const { packGuard } = await import('./courserules');
    const chosen = [{ title: 'Old answer key' }, { title: 'Week 4 slides' }, { title: 'My notes' }];
    const got = packGuard(chosen, pack([{ title: 'OLD ANSWER KEY.pdf', authority: 'prohibited' }, { title: 'Week 4 slides', authority: 'supplemental' }]));
    expect(got.held.map((s) => s.title)).toEqual(['Old answer key']);
    expect(got.send.map((s) => s.title)).toEqual(['Week 4 slides', 'My notes']);
  });

  it('holds nothing back with no packs, or an empty title', async () => {
    const { packGuard } = await import('./courserules');
    expect(packGuard([{ title: 'Anything' }], []).held).toEqual([]);
    expect(packGuard([{ title: '' }], pack([{ title: '!!!', authority: 'prohibited' }])).held).toEqual([]);
  });
});
