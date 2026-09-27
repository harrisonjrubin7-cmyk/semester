import type { Doc } from './document';
import { obj } from './device-library';
import type { Source as Citation } from './sources';
import type { SourceLabel } from './source';
import type { Course, CourseUpdate, Item, Note } from './types';

/**
 * Source Locker (Phase H, `source_locker`): every material a course draws on,
 * in one list, with what was built from each.
 *
 * Semester already keeps materials in four places, and this adds no fifth
 * (docs/ai-toolkit/SOURCE-LOCKER-AND-PROVENANCE.md):
 *
 * - **Files** in the Drive (IndexedDB, `lib/files.ts`).
 * - **Added materials**: `state.updates`, which carry the file ids they were
 *   read from, and the cards and terms made from them.
 * - **The syllabus** the course was imported from, and the prepared guide units.
 * - **The reading list**: citations in `state.sources`.
 *
 * What is new is the relationship the app never recorded: which materials a
 * study guide was built from. Study Studio records it when a guide is saved
 * (`built` below), so a material can say what depends on it and removing it
 * can offer to remove those too — after the student has seen the list.
 *
 * The student also decides, per material, whether AI may use it. Study Studio
 * leaves blocked materials out of what it can send. A course whose policy bans
 * AI blocks all of them, and the switch says why.
 */

export const LOCKER_KEY = 'semester.source-locker.v1';
export const MAX_BUILT = 500;
export const MAX_BLOCKED = 2000;

/** A material's stable key: `file:<id>`, `material:<updateId>`, `syllabus:<courseId>`, `reading:<sourceId>`. */
export type MaterialKey = string;

export interface Built {
  /** The generated asset: a saved study guide document. */
  asset: { kind: 'document'; id: string };
  materials: MaterialKey[];
  at: number;
}

export interface Locker {
  version: 1;
  /** Materials the student has told AI not to use. */
  aiBlocked: MaterialKey[];
  built: Built[];
}

export const EMPTY_LOCKER: Locker = { version: 1, aiBlocked: [], built: [] };

const KEY = /^(file|material|syllabus|reading):[^\s]{1,200}$/;
const bad = () => new Error('Saved source locker settings are not valid.');

export function readLocker(value: unknown): Locker {
  if (!obj(value) || value.version !== 1 || !Array.isArray(value.aiBlocked) || !Array.isArray(value.built)) throw bad();
  if (value.aiBlocked.length > MAX_BLOCKED || value.aiBlocked.some((k) => typeof k !== 'string' || !KEY.test(k))) throw bad();
  if (value.built.length > MAX_BUILT) throw bad();
  const built = value.built.map((b): Built => {
    if (!obj(b) || !obj(b.asset) || b.asset.kind !== 'document' || typeof b.asset.id !== 'string' || !b.asset.id || typeof b.at !== 'number') throw bad();
    if (!Array.isArray(b.materials) || b.materials.length > 100 || b.materials.some((k) => typeof k !== 'string' || !KEY.test(k))) throw bad();
    return { asset: { kind: 'document', id: b.asset.id }, materials: [...new Set(b.materials as string[])], at: b.at };
  });
  return { version: 1, aiBlocked: [...new Set(value.aiBlocked as string[])], built };
}

/** Record that a saved asset was built from these materials. The newest record for an asset replaces an older one. */
export function recordBuilt(locker: Locker, docId: string, materials: MaterialKey[], at: number): Locker {
  const keys = [...new Set(materials.filter((k) => KEY.test(k)))];
  if (!keys.length) return locker;
  const rest = locker.built.filter((b) => b.asset.id !== docId);
  const made: Built = { asset: { kind: 'document', id: docId }, materials: keys, at };
  return { ...locker, built: [made, ...rest].slice(0, MAX_BUILT) };
}

export function setAiUse(locker: Locker, key: MaterialKey, allowed: boolean): Locker {
  const blocked = locker.aiBlocked.filter((k) => k !== key);
  return { ...locker, aiBlocked: allowed ? blocked : [...blocked, key].slice(-MAX_BLOCKED) };
}

/** The material a Study Studio source comes from, or null for a personal note or pasted text. */
export function materialOfStudySource(courseId: string, source: { id: string; fileId?: string }): MaterialKey | null {
  if (source.id.startsWith('unit-')) return `syllabus:${courseId}`;
  if (source.id.startsWith('material-')) return `material:${source.id.slice('material-'.length)}`;
  if (source.id.startsWith('upload-') && source.fileId) return `file:${source.fileId}`;
  return null;
}

/** A file as the locker needs it: the Drive's metadata, without the bytes. */
export interface FileRef {
  id: string;
  name: string;
  type: string;
  size: number;
  added: number;
  courseId: string | null;
  trashedAt: number | null;
}

export type AiUse = 'allowed' | 'blocked' | 'policy';

export interface Material {
  key: MaterialKey;
  kind: 'file' | 'material' | 'syllabus' | 'reading';
  title: string;
  /** "PDF upload", "Added material", "Syllabus", "Reading list entry". */
  type: string;
  /** "Upload 2 of 2 named notes.pdf", or null where the app keeps no versions. */
  version: string | null;
  /** When it arrived, epoch ms, or null when the app never recorded it. */
  date: number | null;
  access: 'on_device' | 'in_trash' | 'link' | 'no_link' | 'not_on_device';
  label: SourceLabel;
  /** What the provenance line says: where it came from. */
  from: string;
  ai: AiUse;
  /** Why it cannot be removed here, or null when it can. */
  cannotRemove: string | null;
  open: { kind: 'file'; id: string } | { kind: 'url'; url: string } | null;
}

const kindOfFile = (f: FileRef) => {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(f.name)?.[1]?.toUpperCase();
  return ext ? `${ext} upload` : 'Uploaded file';
};

export function materials(input: {
  course: Course;
  files: FileRef[];
  updates: CourseUpdate[];
  citations: Citation[];
  locker: Locker;
}): Material[] {
  const { course, locker } = input;
  const banned = course.ai?.stance === 'banned';
  const ai = (key: MaterialKey): AiUse => (banned ? 'policy' : locker.aiBlocked.includes(key) ? 'blocked' : 'allowed');
  const out: Material[] = [];

  const syllabusFile = input.files.find((f) => f.courseId === course.id && f.name === course.source && f.trashedAt === null);
  out.push({
    key: `syllabus:${course.id}`,
    kind: 'syllabus',
    title: course.source || `${course.code} syllabus`,
    type: 'Syllabus and prepared guide',
    version: null,
    date: null,
    access: syllabusFile ? 'on_device' : 'not_on_device',
    label: 'imported',
    from: 'Imported when the course was added',
    ai: ai(`syllabus:${course.id}`),
    cannotRemove: 'The syllabus is the course itself. Remove the course from Courses to remove it.',
    open: syllabusFile ? { kind: 'file', id: syllabusFile.id } : null,
  });

  const files = input.files.filter((f) => f.courseId === course.id && f.name !== course.source).sort((a, b) => a.added - b.added);
  for (const f of files) {
    const same = files.filter((x) => x.name === f.name);
    const n = same.indexOf(f) + 1;
    out.push({
      key: `file:${f.id}`,
      kind: 'file',
      title: f.name,
      type: kindOfFile(f),
      version: same.length > 1 ? `Upload ${n} of ${same.length} named ${f.name}` : null,
      date: f.added,
      access: f.trashedAt === null ? 'on_device' : 'in_trash',
      label: 'imported',
      from: 'Uploaded to this device',
      ai: ai(`file:${f.id}`),
      cannotRemove: f.trashedAt !== null ? 'Already in Drive trash — restore or empty it in Drive.' : null,
      open: f.trashedAt === null ? { kind: 'file', id: f.id } : null,
    });
  }

  for (const u of input.updates.filter((x) => x.courseId === course.id)) {
    out.push({
      key: `material:${u.id}`,
      kind: 'material',
      title: u.title,
      type: 'Added material',
      version: null,
      date: u.created,
      access: 'on_device',
      label: u.fileIds.length ? 'imported' : 'student_entered',
      from: u.fileIds.length ? `Read from ${u.fileIds.length} uploaded ${u.fileIds.length === 1 ? 'file' : 'files'}${u.source ? ` · ${u.source}` : ''}` : u.source || 'Typed or pasted',
      ai: ai(`material:${u.id}`),
      cannotRemove: null,
      open: null,
    });
  }

  for (const c of input.citations.filter((x) => x.courseId === course.id)) {
    out.push({
      key: `reading:${c.id}`,
      kind: 'reading',
      title: c.title || c.raw.slice(0, 120),
      type: 'Reading list entry',
      version: null,
      date: c.created,
      access: c.url ? 'link' : 'no_link',
      label: 'student_entered',
      from: [c.author, c.year, c.container].filter(Boolean).join(' · ') || 'Citation you added',
      ai: ai(`reading:${c.id}`),
      cannotRemove: null,
      open: c.url && /^https:\/\//i.test(c.url) ? { kind: 'url', url: c.url } : null,
    });
  }
  return out;
}

export interface Dependents {
  /** Built from this material. Deleted only if the student ticks it. */
  generated: { kind: 'material' | 'document'; id: string; title: string; detail: string }[];
  /** Notes it is attached to. Never deleted: the note is the student's writing; the attachment is removed. */
  attached: { noteId: string; title: string }[];
  /** Deadlines whose date was checked against it. Kept; the citation stops opening. */
  cited: { itemId: string; title: string }[];
}

export function dependents(
  key: MaterialKey,
  ctx: { courseId: string; file?: FileRef; updates: CourseUpdate[]; notes: Note[]; documents: Doc[]; built: Built[]; items: Item[] },
): Dependents {
  const docs = new Map(ctx.documents.filter((d) => d.courseId === ctx.courseId).map((d) => [d.id, d]));
  const generatedDocs = ctx.built
    .filter((b) => b.materials.includes(key) && docs.has(b.asset.id))
    .map((b) => ({ kind: 'document' as const, id: b.asset.id, title: docs.get(b.asset.id)!.title, detail: 'Study guide built from it' }));

  if (!key.startsWith('file:')) return { generated: generatedDocs, attached: [], cited: [] };
  const fileId = key.slice('file:'.length);
  const fromFile = ctx.updates.filter((u) => u.courseId === ctx.courseId && u.fileIds.includes(fileId));
  // A document built from a material that was itself read from this file depends on the file too.
  const viaMaterial = ctx.built
    .filter((b) => fromFile.some((u) => b.materials.includes(`material:${u.id}`)) && docs.has(b.asset.id) && !generatedDocs.some((g) => g.id === b.asset.id))
    .map((b) => ({ kind: 'document' as const, id: b.asset.id, title: docs.get(b.asset.id)!.title, detail: 'Study guide built from material read from it' }));
  return {
    generated: [
      ...fromFile.map((u) => ({
        kind: 'material' as const,
        id: u.id,
        title: u.title,
        detail: `Added material read from it: ${u.cards.length} cards, ${u.terms.length} terms`,
      })),
      ...generatedDocs,
      ...viaMaterial,
    ],
    attached: ctx.notes.filter((n) => n.courseId === ctx.courseId && n.fileIds.includes(fileId)).map((n) => ({ noteId: n.id, title: n.title || 'Untitled note' })),
    cited: ctx.file ? ctx.items.filter((i) => i.c === ctx.courseId && i.checked?.doc === ctx.file!.name).map((i) => ({ itemId: i.id, title: i.title })) : [],
  };
}

/** What removing does, as steps the screen carries out. Pure, so it can be checked. */
export type Step =
  | { do: 'trashFile'; id: string }
  | { do: 'detachFile'; noteId: string; fileId: string }
  | { do: 'deleteUpdate'; id: string }
  | { do: 'deleteDocument'; id: string }
  | { do: 'dropSource'; id: string };

export function removalPlan(material: Material, deps: Dependents, alsoGenerated: boolean): Step[] {
  if (material.cannotRemove) throw new Error(material.cannotRemove);
  const id = material.key.slice(material.key.indexOf(':') + 1);
  const steps: Step[] = [];
  if (alsoGenerated) {
    for (const g of deps.generated) steps.push(g.kind === 'material' ? { do: 'deleteUpdate', id: g.id } : { do: 'deleteDocument', id: g.id });
  }
  if (material.kind === 'file') {
    for (const a of deps.attached) steps.push({ do: 'detachFile', noteId: a.noteId, fileId: id });
    steps.push({ do: 'trashFile', id });
  } else if (material.kind === 'material') {
    if (!steps.some((s) => s.do === 'deleteUpdate' && s.id === id)) steps.push({ do: 'deleteUpdate', id });
  } else if (material.kind === 'reading') {
    steps.push({ do: 'dropSource', id });
  }
  return steps;
}

/** After a removal: forget the removed material's AI setting and any records of deleted assets. */
export function forgetRemoved(locker: Locker, key: MaterialKey, steps: Step[]): Locker {
  const goneDocs = new Set(steps.filter((s) => s.do === 'deleteDocument').map((s) => (s as { id: string }).id));
  return {
    ...locker,
    aiBlocked: locker.aiBlocked.filter((k) => k !== key),
    built: locker.built.filter((b) => !goneDocs.has(b.asset.id)),
  };
}
