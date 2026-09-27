import { describe, expect, it } from 'vitest';
import type { Doc } from './document';
import {
  EMPTY_LOCKER,
  dependents,
  forgetRemoved,
  materialOfStudySource,
  materials,
  readLocker,
  recordBuilt,
  removalPlan,
  setAiUse,
  type FileRef,
  type Locker,
} from './source-locker';
import type { Source as Citation } from './sources';
import type { Course, CourseUpdate, Item, Note } from './types';

/**
 * Phase H's Source Locker model: the list of materials, what depends on each,
 * what removing one does — and does not do — and who decides about AI use.
 */

const course = (over: Partial<Course> = {}): Course => ({ id: 'econ', code: 'ECON 1010', name: 'Econ', source: 'syllabus.pdf', ...over }) as Course;
const file = (id: string, name: string, added: number, over: Partial<FileRef> = {}): FileRef => ({ id, name, type: 'application/pdf', size: 1, added, courseId: 'econ', trashedAt: null, ...over });
const update = (id: string, fileIds: string[], courseId = 'econ'): CourseUpdate =>
  ({ id, courseId, unit: 0, title: `Reading ${id}`, source: 'Reading 7', body: 'text', cards: [{ q: 'q', a: 'a' }, { q: 'q2', a: 'a2' }], terms: [{ t: 't', d: 'd' }], fileIds, created: 5 }) as CourseUpdate;
const note = (id: string, fileIds: string[], courseId = 'econ'): Note => ({ id, title: `Note ${id}`, body: '', created: 1, updated: 1, courseId, fileIds }) as Note;
const doc = (id: string, courseId = 'econ'): Doc => ({ id, title: `Guide ${id}`, subtitle: '', courseId, blocks: [], created: 1, updated: 1 }) as Doc;
const citation = (id: string, url: string): Citation => ({ id, raw: 'Smith 2020', author: 'Smith', year: '2020', title: 'Markets', container: '', url, role: '', courseId: 'econ', project: '', created: 3 });
const item = (id: string, doc: string): Item => ({ id, c: 'econ', title: `Due ${id}`, checked: { confirmed: true, page: 2, doc } }) as unknown as Item;

const FILES = [file('s', 'syllabus.pdf', 1), file('f1', 'notes.pdf', 10), file('f2', 'notes.pdf', 20), file('f3', 'slides.pptx', 30), file('x', 'other.pdf', 40, { courseId: 'hist' })];

describe('the list of materials', () => {
  const list = (locker: Locker = EMPTY_LOCKER, c = course()) =>
    materials({ course: c, files: FILES, updates: [update('u1', ['f1']), update('u9', [], 'hist')], citations: [citation('r1', 'https://doi.org/x'), citation('r2', 'javascript:alert(1)')], locker });

  it('lists the syllabus, this course’s files, added materials and readings — no other course’s', () => {
    expect(list().map((m) => m.key)).toEqual(['syllabus:econ', 'file:f1', 'file:f2', 'file:f3', 'material:u1', 'reading:r1', 'reading:r2']);
  });

  it('gives each a type, a version where there is one, a date, where it is, and a label', () => {
    const [syllabus, f1, f2, f3, u1, r1, r2] = list();
    expect(syllabus).toMatchObject({ type: 'Syllabus and prepared guide', access: 'on_device', label: 'imported', open: { kind: 'file', id: 's' } });
    expect([f1.version, f2.version, f3.version]).toEqual(['Upload 1 of 2 named notes.pdf', 'Upload 2 of 2 named notes.pdf', null]);
    expect(f3).toMatchObject({ type: 'PPTX upload', date: 30, label: 'imported' });
    expect(u1).toMatchObject({ type: 'Added material', from: 'Read from 1 uploaded file · Reading 7', label: 'imported' });
    expect(r1).toMatchObject({ access: 'link', label: 'student_entered', open: { kind: 'url', url: 'https://doi.org/x' } });
    expect(r2.open).toBeNull();
    expect(list().some((m) => m.label === 'institution_verified')).toBe(false);
  });

  it('never lets the syllabus be removed here', () => {
    expect(list()[0].cannotRemove).toContain('Remove the course from Courses');
  });

  it('follows the student’s AI choice, and the course policy over it', () => {
    const blocked = setAiUse(EMPTY_LOCKER, 'file:f1', false);
    expect(list(blocked).find((m) => m.key === 'file:f1')?.ai).toBe('blocked');
    expect(list(setAiUse(blocked, 'file:f1', true)).find((m) => m.key === 'file:f1')?.ai).toBe('allowed');
    const banned = list(EMPTY_LOCKER, course({ ai: { stance: 'banned', note: '' } }));
    expect(new Set(banned.map((m) => m.ai))).toEqual(new Set(['policy']));
  });
});

describe('what depends on a material', () => {
  const built = recordBuilt(recordBuilt(EMPTY_LOCKER, 'd1', ['file:f1'], 1), 'd2', ['material:u1', 'syllabus:econ'], 2).built;
  const ctx = {
    courseId: 'econ',
    file: FILES[1],
    updates: [update('u1', ['f1']), update('u2', ['f3']), update('u8', ['f1'], 'hist')],
    notes: [note('n1', ['f1']), note('n2', ['f3']), note('n9', ['f1'], 'hist')],
    documents: [doc('d1'), doc('d2'), doc('d9', 'hist')],
    built,
    items: [item('i1', 'notes.pdf'), item('i2', 'syllabus.pdf')],
  };

  it('finds what was read from a file, built from it directly or through its material, attached to it and checked against it', () => {
    const d = dependents('file:f1', ctx);
    expect(d.generated.map((g) => [g.kind, g.id])).toEqual([['material', 'u1'], ['document', 'd1'], ['document', 'd2']]);
    expect(d.generated[0].detail).toBe('Added material read from it: 2 cards, 1 terms');
    expect(d.attached).toEqual([{ noteId: 'n1', title: 'Note n1' }]);
    expect(d.cited).toEqual([{ itemId: 'i1', title: 'Due i1' }]);
  });

  it('only ever looks in this course', () => {
    const d = dependents('file:f1', ctx);
    expect(JSON.stringify(d)).not.toMatch(/u8|n9|d9/);
  });

  it('finds guides built from the syllabus and from an added material', () => {
    expect(dependents('syllabus:econ', ctx).generated.map((g) => g.id)).toEqual(['d2']);
    expect(dependents('material:u1', ctx).generated.map((g) => g.id)).toEqual(['d2']);
  });

  it('forgets a guide that no longer exists', () => {
    expect(dependents('file:f1', { ...ctx, documents: [doc('d2')] }).generated.map((g) => g.id)).toEqual(['u1', 'd2']);
  });
});

describe('removing a material', () => {
  const list = materials({ course: course(), files: FILES, updates: [update('u1', ['f1'])], citations: [citation('r1', '')], locker: EMPTY_LOCKER });
  const byKey = (k: string) => list.find((m) => m.key === k)!;
  const deps = { generated: [{ kind: 'material' as const, id: 'u1', title: 'x', detail: '' }, { kind: 'document' as const, id: 'd1', title: 'y', detail: '' }], attached: [{ noteId: 'n1', title: 'z' }], cited: [] };

  it('trashes the file and detaches notes, and deletes nothing generated unless asked', () => {
    expect(removalPlan(byKey('file:f1'), deps, false)).toEqual([
      { do: 'detachFile', noteId: 'n1', fileId: 'f1' },
      { do: 'trashFile', id: 'f1' },
    ]);
  });

  it('deletes exactly the generated items listed when the student ticks it', () => {
    expect(removalPlan(byKey('file:f1'), deps, true)).toEqual([
      { do: 'deleteUpdate', id: 'u1' },
      { do: 'deleteDocument', id: 'd1' },
      { do: 'detachFile', noteId: 'n1', fileId: 'f1' },
      { do: 'trashFile', id: 'f1' },
    ]);
  });

  it('never deletes a note', () => {
    for (const also of [true, false]) expect(removalPlan(byKey('file:f1'), deps, also).some((s) => s.do === 'detachFile' && 'id' in s)).toBe(false);
    expect(JSON.stringify(removalPlan(byKey('file:f1'), deps, true))).not.toContain('deleteNote');
  });

  it('refuses the syllabus, and a file already in the trash', () => {
    expect(() => removalPlan(byKey('syllabus:econ'), deps, true)).toThrow('Remove the course from Courses');
    const trashed = materials({ course: course(), files: [file('t', 'old.pdf', 1, { trashedAt: 5 })], updates: [], citations: [], locker: EMPTY_LOCKER })[1];
    expect(() => removalPlan(trashed, deps, true)).toThrow('Drive trash');
  });

  it('deletes an added material, and drops a reading', () => {
    expect(removalPlan(byKey('material:u1'), { generated: [], attached: [], cited: [] }, false)).toEqual([{ do: 'deleteUpdate', id: 'u1' }]);
    expect(removalPlan(byKey('reading:r1'), { generated: [], attached: [], cited: [] }, false)).toEqual([{ do: 'dropSource', id: 'r1' }]);
  });

  it('forgets the AI setting and the records of deleted guides afterwards', () => {
    const locker = recordBuilt(setAiUse(EMPTY_LOCKER, 'file:f1', false), 'd1', ['file:f1'], 1);
    const after = forgetRemoved(locker, 'file:f1', removalPlan(byKey('file:f1'), deps, true));
    expect(after).toEqual(EMPTY_LOCKER);
  });
});

describe('Study Studio sources and the stored settings', () => {
  it('maps a Study Studio source to its material, and personal notes and pasted text to none', () => {
    expect(materialOfStudySource('econ', { id: 'unit-2' })).toBe('syllabus:econ');
    expect(materialOfStudySource('econ', { id: 'material-u1' })).toBe('material:u1');
    expect(materialOfStudySource('econ', { id: 'upload-f1-3', fileId: 'f1' })).toBe('file:f1');
    expect(materialOfStudySource('econ', { id: 'note-n1' })).toBeNull();
    expect(materialOfStudySource('econ', { id: 'paste-1' })).toBeNull();
  });

  it('records one build per guide, newest first', () => {
    const l = recordBuilt(recordBuilt(EMPTY_LOCKER, 'd1', ['file:f1'], 1), 'd1', ['file:f2', 'file:f2'], 2);
    expect(l.built).toEqual([{ asset: { kind: 'document', id: 'd1' }, materials: ['file:f2'], at: 2 }]);
    expect(recordBuilt(EMPTY_LOCKER, 'd1', [], 1)).toBe(EMPTY_LOCKER);
  });

  it('reads what it wrote, and refuses anything else', () => {
    const l = recordBuilt(setAiUse(EMPTY_LOCKER, 'reading:r1', false), 'd1', ['file:f1'], 1);
    expect(readLocker(JSON.parse(JSON.stringify(l)))).toEqual(l);
    expect(() => readLocker({ version: 1, aiBlocked: ['whatever'], built: [] })).toThrow();
    expect(() => readLocker({ version: 1, aiBlocked: [], built: [{ asset: { kind: 'deck', id: 'x' }, materials: [], at: 1 }] })).toThrow();
    expect(() => readLocker({ version: 2, aiBlocked: [], built: [] })).toThrow();
  });
});
