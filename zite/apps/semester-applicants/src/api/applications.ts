import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../../../semester/src/lib/pg';
import { APK_MIGRATION } from '../../../semester/src/lib/apkMigration';
import { SPG_MIGRATION } from '../../../semester/src/lib/spgMigration';
import { SHORTLIST_MIGRATION } from '../../../semester/src/lib/shortlistMigration';
import { ADV_MIGRATION } from '../../../semester/src/lib/advMigration';
import { putScanned, ensureFil } from '../../../semester/src/lib/filServer';
import { checkUpload, decodeBase64 } from '../../../semester/src/lib/fileRules';
import { buildPackage, canonical, missing as missingOf, dimensions, modeNotice, type Mode } from '../../../semester/src/lib/applicationRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of APK_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const sha = async (s: string) => String(((await pg().query(`SELECT encode(sha256(convert_to($1,'UTF8')),'hex') AS h`, [s])) as Row[])[0].h);
/** Institutions accepting applications through Semester: they have a published, accepting program listing. */
const nativeTenants = async () => { const has = ((await pg().query(`SELECT to_regclass('spg_programs') IS NOT NULL AS ok`)) as Row[])[0].ok;
  return new Set(has ? ((await pg().query(`SELECT DISTINCT tenant_id FROM spg_programs WHERE state = 'Published' AND accepting`)) as Row[]).map((r) => String(r.tenant_id)) : []); };

const ids = (v: string | string[] | undefined | null): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);
const first = (v: string | string[] | undefined | null) => ids(v)[0];
const no = (m: string): never => { throw new ZiteError(m); };
const CHECK = ['Personal statement', 'Transcript uploaded', 'Program chosen'];

export default createEndpoint({
  description: 'Applicant portal: start, edit, submit and withdraw your own applications',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('save'), id: z.string().optional(), institutionId: z.string(), program: z.string().max(120), entryTerm: z.string().max(40), statement: z.string().max(8000) }),
    z.object({ action: z.literal('preview'), id: z.string() }),
    z.object({ action: z.literal('addDocument'), id: z.string(), name: z.string().max(200), mime: z.string().max(120), base64: z.string().max(5_600_000) }),
    z.object({ action: z.literal('removeDocument'), id: z.string(), fileId: z.string().uuid() }),
    z.object({ action: z.literal('openDocument'), id: z.string(), fileId: z.string().uuid() }),
    z.object({ action: z.literal('submit'), id: z.string(), previewSha: z.string().length(64), attested: z.boolean(), requestKey: z.string().min(8).max(80) }),
    z.object({ action: z.literal('programs') }),
    z.object({ action: z.literal('shortlistAdd'), programId: z.number().int() }),
    z.object({ action: z.literal('shortlistRemove'), programId: z.number().int() }),
    z.object({ action: z.literal('visits') }),
    z.object({ action: z.literal('bookVisit'), slotId: z.number().int(), guests: z.number().int().min(1).max(6) }),
    z.object({ action: z.literal('cancelVisit'), bookingId: z.number().int() }),
    z.object({ action: z.literal('withdraw'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    const own = async (id: string) => { const r = await zite.applications.findOne({ id }); if (!r || first(r.applicant) !== uid) no('That application isn’t yours.'); return r!; };
    const log = (action: string, inst: string | undefined, ref: string) => zite.auditEvents.create({ record: { action, actor: uid, institution: inst ? [inst] : undefined, recordRef: ref, authority: 'Applicant' } as never });

    if (input.action === 'save') {
      const inst = await zite.institutions.findOne({ id: input.institutionId });
      if (!inst || inst.tenantType === 'Personal') no('Pick an institution that accepts applications.');
      if (input.id) { const r = await own(input.id); if (r.status !== 'Draft') no('Submitted applications can’t be edited. Withdraw and start again, or contact admissions.'); }
      const record = { label: `${inst!.name} · ${input.program || 'Undecided'}`, applicant: uid, institution: [inst!.id], program: input.program, entryTerm: input.entryTerm, statement: input.statement, status: 'Draft' };
      const saved = input.id ? await zite.applications.update({ id: input.id, record: record as never }) : await zite.applications.create({ record: record as never });
      return { ok: true, id: saved.id };
    }
    await ensure();
    const docsOf = async (appIds: string[]) => appIds.length ? (await pg().query(`SELECT application_id, file_id, filename FROM apk_documents WHERE application_id = ANY($1) ORDER BY added_at`, [appIds])) as Row[] : [];
    const draftOf = async (r: Awaited<ReturnType<typeof own>>) => {
      const inst = await zite.institutions.findOne({ id: first(r.institution) ?? '' });
      // The package references private file ids, never a link anyone could open.
      return { institutionId: inst?.id ?? '', institution: inst?.name ?? 'Institution', program: r.program ?? '', entryTerm: r.entryTerm ?? '', statement: r.statement ?? '',
        documents: (await docsOf([r.id])).map((d) => ({ url: `file:${d.file_id}`, filename: String(d.filename) })) };
    };
    if (input.action === 'addDocument' || input.action === 'removeDocument' || input.action === 'openDocument') {
      const r = await own(input.id);
      const T = first(r.institution) ?? '';
      await ensureFil();
      if (input.action === 'openDocument') {
        const ok = (await pg().query(`SELECT 1 FROM apk_documents WHERE application_id = $1 AND file_id = $2`, [r.id, input.fileId])) as Row[];
        if (!ok.length) no('That document isn’t on this application.');
        const f = ((await pg().query(`SELECT name, mime, encode(bytes, 'base64') AS b64 FROM fil_read($1,$2,$3)`, [T, input.fileId, uid])) as Row[])[0];
        if (!f) no('You do not have access to this file.');
        return { name: String(f.name), mime: String(f.mime), base64: String(f.b64).replace(/\n/g, '') };
      }
      if (r.status !== 'Draft') no('Submitted applications can’t be changed.');
      if (input.action === 'removeDocument') { await pg().query(`DELETE FROM apk_documents WHERE application_id = $1 AND file_id = $2`, [r.id, input.fileId]); return { ok: true }; }
      const bytes = decodeBase64(input.base64);
      if (!bytes) no('The file could not be read. Try again.');
      const bad = checkUpload(input.name, input.mime, bytes!.length);
      if (bad) no(bad);
      const put = await putScanned(T, uid, input.name, input.mime, 'evidence', bytes!);
      if ('blocked' in put) no(`This file was not accepted: ${put.blocked.join(' ')}`);
      await pg().query(`INSERT INTO apk_documents (application_id, file_id, tenant_id, owner_id, filename) VALUES ($1,$2,$3,$4,$5)`, [r.id, (put as { id: string }).id, T, uid, input.name.trim()]);
      return { ok: true, fileId: (put as { id: string }).id };
    }
    if (input.action === 'preview' || input.action === 'submit') {
      const r = await own(input.id);
      if (r.status !== 'Draft') no('This was already submitted.');
      const d = await draftOf(r);
      const miss = missingOf(d);
      if (miss.length) no(`Add ${miss.join(', ')} before submitting.`);
      const pkg = buildPackage(d);
      const h = await sha(canonical(pkg));
      const mode: Mode = (await nativeTenants()).has(d.institutionId) ? 'native' : 'planning';
      if (input.action === 'preview') return { package: pkg, sha: h, mode, notice: modeNotice(mode) };
      const out = String(((await pg().query(`SELECT apk_submit($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) AS r`,
        [uid, first(r.applicant), d.institutionId, r.id, JSON.stringify(pkg), h, input.previewSha, input.attested, input.requestKey, mode === 'native'])) as Row[])[0].r);
      if (!out.startsWith('ok:')) no(out);
      const [, code, version, replay] = out.split(':');
      if (r.status === 'Draft') await zite.applications.update({ id: r.id, record: { status: 'Submitted', submittedAt: new Date().toISOString() } as never });
      if (!replay) await log('Application submitted', d.institutionId, r.id);
      return { ok: true, receipt: code, version: Number(version), replay: !!replay };
    }
    if (input.action === 'shortlistAdd' || input.action === 'shortlistRemove') {
      for (const q of [...SPG_MIGRATION, ...SHORTLIST_MIGRATION]) await pg().query(q);
      const fn = input.action === 'shortlistAdd' ? 'app_shortlist_add' : 'app_shortlist_remove';
      const r = String(((await pg().query(`SELECT ${fn}($1,$2) AS r`, [uid, input.programId])) as Row[])[0].r);
      if (r !== 'ok') no(r);
      return { ok: true };
    }
    if (input.action === 'visits' || input.action === 'bookVisit' || input.action === 'cancelVisit') {
      for (const q of ADV_MIGRATION) await pg().query(q);
      if (input.action === 'bookVisit' || input.action === 'cancelVisit') {
        const fn = input.action === 'bookVisit' ? 'adv_book' : 'adv_cancel';
        const args = input.action === 'bookVisit' ? [uid, input.slotId, input.guests] : [uid, input.bookingId];
        const r = String(((await pg().query(`SELECT ${fn}($1,$2${input.action === 'bookVisit' ? ',$3' : ''}) AS r`, args)) as Row[])[0].r ?? '');
        if (r) no(r);
        return { ok: true };
      }
      const slots = (await pg().query(`SELECT s.*, (SELECT coalesce(sum(guests), 0) FROM adv_bookings b WHERE b.slot_id = s.id AND b.state = 'booked') AS taken
        FROM adv_slots s WHERE s.state = 'open' AND s.starts_at > now() ORDER BY s.starts_at LIMIT 200`)) as Row[];
      const mine = (await pg().query(`SELECT b.id AS booking_id, b.guests, s.id AS slot_id, s.tenant_id, s.starts_at, s.kind, s.location, s.note
        FROM adv_bookings b JOIN adv_slots s ON s.id = b.slot_id WHERE b.user_id = $1 AND b.state = 'booked' ORDER BY s.starts_at`, [uid])) as Row[];
      const insts = (await zite.institutions.findAll({ limit: 500, fields: ['name'] })).records;
      const iname = (t: unknown) => insts.find((i) => i.id === String(t))?.name ?? 'Institution';
      const mySlot = new Map(mine.map((m) => [Number(m.slot_id), Number(m.booking_id)]));
      return {
        slots: slots.map((s) => ({ id: Number(s.id), institutionId: String(s.tenant_id), institution: iname(s.tenant_id), startsAt: new Date(String(s.starts_at)).toISOString(), kind: String(s.kind), location: String(s.location), note: String(s.note), seatsLeft: Number(s.capacity) - Number(s.taken), myBookingId: mySlot.get(Number(s.id)) ?? null })),
        mine: mine.map((m) => ({ bookingId: Number(m.booking_id), slotId: Number(m.slot_id), institution: iname(m.tenant_id), startsAt: new Date(String(m.starts_at)).toISOString(), kind: String(m.kind), location: String(m.location), note: String(m.note), guests: Number(m.guests) })),
      };
    }
    if (input.action === 'programs') {
      for (const q of [...SPG_MIGRATION, ...SHORTLIST_MIGRATION]) await pg().query(q);
      const rows = (await pg().query(`SELECT p.id, p.tenant_id, p.name, p.summary, p.entry_terms, p.accepting, p.annual_cost_cents, p.duration_text, p.format, p.requirements,
          EXISTS (SELECT 1 FROM app_shortlist s WHERE s.user_id = $1 AND s.program_id = p.id) AS shortlisted
        FROM spg_programs p WHERE p.state = 'Published' ORDER BY p.name LIMIT 500`, [uid])) as Row[];
      const insts = rows.length ? (await zite.institutions.findAll({ limit: 500, fields: ['name'] })).records : [];
      return { programs: rows.map((p) => ({ id: Number(p.id), institutionId: String(p.tenant_id), institution: insts.find((i) => i.id === p.tenant_id)?.name ?? 'Institution', name: String(p.name), summary: String(p.summary), entryTerms: String(p.entry_terms), accepting: !!p.accepting, annualCostCents: p.annual_cost_cents == null ? null : Number(p.annual_cost_cents), durationText: String(p.duration_text ?? ''), format: String(p.format ?? ''), requirements: String(p.requirements ?? ''), shortlisted: !!p.shortlisted })) };
    }
    if (input.action === 'withdraw') {
      const r = await own(input.id);
      if (['Admitted', 'Declined', 'Withdrawn'].includes(r.status ?? '')) no('This application is already closed.');
      await zite.applications.update({ id: r.id, record: { status: 'Withdrawn' } as never });
      await log('Application withdrawn', first(r.institution), r.id);
      return { ok: true };
    }
    const [{ records: apps }, { records: insts }] = await Promise.all([
      zite.applications.findAll({ filters: { applicant: uid }, limit: 100 }),
      zite.institutions.findAll({ limit: 200 }),
    ]);
    const open = insts.filter((i) => i.tenantType !== 'Personal');
    const native = await nativeTenants();
    const privDocs = await docsOf(apps.map((a) => a.id));
    const pk = apps.length ? (await pg().query(`SELECT application_id, receipt_code, version, received_at FROM apk_packages WHERE applicant_id = $1`, [uid])) as Row[] : [];
    return {
      institutions: open.map((i) => ({ id: i.id, name: i.name ?? '', sample: !!i.isSample })),
      applications: apps.map((a) => {
        // Private documents only. Anything uploaded earlier to the old public-link field is listed as legacy and never sent.
        const docs = privDocs.filter((d) => d.application_id === a.id).map((d) => ({ fileId: String(d.file_id), filename: String(d.filename) }));
        const legacy = ((a.documents as { url: string; filename: string }[] | undefined) ?? []).map((d) => d.filename);
        return {
          id: a.id, institutionId: first(a.institution) ?? '', institution: open.find((i) => i.id === first(a.institution))?.name ?? 'Institution',
          program: a.program ?? '', entryTerm: a.entryTerm ?? '', statement: a.statement ?? '', status: a.status ?? 'Draft',
          documents: docs, legacyDocuments: legacy, submittedAt: a.submittedAt ?? null, decisionNote: a.decisionNote ?? '',
          checklist: [(a.statement ?? '').length >= 200, docs.length > 0, !!a.program].map((done, i) => ({ label: CHECK[i], done })),
          ...(() => {
            const mode: Mode = native.has(first(a.institution) ?? '') ? 'native' : 'planning';
            const p = pk.find((x) => x.application_id === a.id);
            const miss = [(a.statement ?? '').length >= 200, docs.length > 0, !!a.program].filter((x) => !x).length;
            return { mode, notice: modeNotice(mode), receipt: p ? { code: String(p.receipt_code), version: Number(p.version), receivedAt: new Date(String(p.received_at)).toISOString() } : null,
              dimensions: dimensions({ status: a.status ?? 'Draft', mode, received: !!p, missing: miss }) };
          })(),
        };
      }),
    };
  },
});
