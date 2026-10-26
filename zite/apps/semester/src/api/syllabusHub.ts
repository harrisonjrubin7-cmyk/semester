import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, ids, forbid, audit } from '../lib/server';
import { pg } from '../lib/pg';
import { CRS_MIGRATION } from '../lib/crsMigration';
import { SYL_MIGRATION } from '../lib/sylMigration';
import { extractDates, extractWeights } from '../lib/syllabusExtract';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...CRS_MIGRATION, ...SYL_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);

// Student syllabus hub (S-72 §E). Official syllabi are the instructor-published versions of the student's own sections
// (read-only). Private syllabi are pasted text with a source reference and append-only versions; PDF extraction is not
// implemented. Dates and grading weights are extracted by fixed patterns and stay pending until the student accepts them; an
// accepted date can become a task, accepted weights become a grade-tracker proposal the student previews before applying.
export default createEndpoint({
  description: 'Syllabus hub: official and private syllabi, versions, pattern-based extraction with student review, tasks from dates',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('save'), docId: z.number().int().nullable(), course: z.string().min(2).max(120), title: z.string().min(2).max(160), sourceRef: z.string().min(3).max(300),
      body: z.string().min(20).max(60000), effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), note: z.string().max(300).default(''), expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('review'), ref: z.string().min(5).max(80), version: z.number().int().min(1), key: z.string().min(2).max(120), decision: z.enum(['accepted', 'rejected']) }),
    z.object({ action: z.literal('createTask'), title: z.string().min(1).max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ref: z.string().min(5).max(80) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const year = new Date().getFullYear();
    const [secs, enr, courses] = await Promise.all([zite.sections.findAll({ limit: 2000 }), zite.enrollments.findAll({ filters: { student: me }, limit: 500 }), zite.courses.findAll({ limit: 2000 })]);
    const mySections = new Set(enr.records.filter((e) => e.status === 'Enrolled' || e.status === 'Completed').flatMap((e) => ids(e.section)));
    let result: unknown = null;

    if (input.action === 'save') {
      const out = ((await sql.query(`SELECT syl_save($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10) AS r`, [T, me, input.docId, input.course, input.title, input.sourceRef, input.body, input.effectiveDate, input.note, input.expectedVersion])) as { r: string }[])[0].r;
      if (!out.startsWith('ok:')) forbid(out);
      const [, doc, v] = out.split(':');
      result = { docId: Number(doc), version: Number(v) };
    }
    if (input.action === 'review') {
      if (input.ref.startsWith('section:') && !mySections.has(input.ref.slice(8))) forbid('You are not enrolled in that section.');
      const e = ((await sql.query(`SELECT syl_review($1,$2,$3,$4,$5,$6) AS e`, [T, me, input.ref, input.version, input.key, input.decision])) as { e: string | null }[])[0].e;
      if (e) forbid(e);
    }
    if (input.action === 'createTask') {
      if (input.ref.startsWith('section:') && !mySections.has(input.ref.slice(8))) forbid('You are not enrolled in that section.');
      await zite.tasks.create({ record: { title: input.title, owner: me, type: 'Personal', source: 'Made Here', status: 'Open', dueAt: `${input.date}T17:00:00.000Z` } as never });
      await audit(a, 'Task created from a reviewed syllabus date', `user:${me}`, input.ref, 'Owner');
      result = { created: true };
    }

    const reviews = (await sql.query(`SELECT ref, version, item_key, decision FROM syl_reviews WHERE tenant_id = $1 AND student_id = $2`, [T, me])) as Row[];
    const decided = (ref: string, v: number) => Object.fromEntries(reviews.filter((r) => r.ref === ref && Number(r.version) === v).map((r) => [String(r.item_key), String(r.decision)]));
    const shape = (ref: string, v: number, body: string) => ({ dates: extractDates(body, year), weights: extractWeights(body), decisions: decided(ref, v) });

    const sectionIds = [...mySections];
    const offVersions = sectionIds.length ? (await sql.query(`SELECT section_id, version, body, change_note, published_at FROM crs_syllabus_versions WHERE section_id = ANY($1::text[]) ORDER BY section_id, version DESC`, [sectionIds])) as Row[] : [];
    const cById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
    const official = secs.records.filter((s) => mySections.has(s.id)).map((s) => {
      const versions = offVersions.filter((v) => v.section_id === s.id);
      const c = cById[first(s.course) ?? ''];
      const latest = versions[0];
      return {
        ref: `section:${s.id}`, course: c?.code ? `${c.code} ${c.title ?? ''}`.trim() : s.label ?? 'Section', title: s.label ?? 'Section', instructorPublished: !!latest,
        versions: versions.map((v) => ({ version: Number(v.version), body: String(v.body), note: String(v.change_note ?? ''), at: iso(v.published_at) })),
        ...(latest ? shape(`section:${s.id}`, Number(latest.version), String(latest.body)) : { dates: [], weights: [], decisions: {} }),
      };
    });
    const docs = (await sql.query(`SELECT * FROM syl_docs WHERE tenant_id = $1 AND student_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC`, [T, me])) as Row[];
    const vers = docs.length ? (await sql.query(`SELECT * FROM syl_versions WHERE doc_id = ANY($1::bigint[]) ORDER BY doc_id, version DESC`, [docs.map((d) => Number(d.id))])) as Row[] : [];
    const mine = docs.map((d) => {
      const vs = vers.filter((v) => Number(v.doc_id) === Number(d.id));
      const latest = vs[0];
      return {
        ref: `doc:${d.id}`, docId: Number(d.id), course: String(d.course), title: String(d.title), sourceRef: String(d.source_ref),
        versions: vs.map((v) => ({ version: Number(v.version), body: String(v.body), note: String(v.change_note), effectiveDate: day(v.effective_date), at: iso(v.created_at) })),
        ...(latest ? shape(`doc:${d.id}`, Number(latest.version), String(latest.body)) : { dates: [], weights: [], decisions: {} }),
      };
    });
    return { result, year, official, mine };
  },
});
