import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureFil } from '../lib/filServer';
import { TRF_MIGRATION } from '../lib/trfMigration';
import { TRT_MIGRATION } from '../lib/trtMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => {
  if (!ready) ready = (async () => { await ensureFil(); for (const q of [...TRF_MIGRATION, ...TRT_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; });
  return ready;
};
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Transcript intake (trt-001). A student attaches a screened transcript from their private files to their own transfer
// request; a registrar (capability checked here) reviews it. Only the student and registrars read it; reads are logged.
export default createEndpoint({
  description: 'Transcript intake for transfer credit: attach a screened transcript, registrar review, logged reads',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('attach'), requestId: z.string().max(80), fileId: z.string().uuid() }),
    z.object({ action: z.literal('review'), id: z.number().int(), version: z.number().int(), decision: z.enum(['accepted_official', 'accepted_unofficial', 'rejected']), note: z.string().max(1000) }),
    z.object({ action: z.literal('read'), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const T = a.institutionId, me = a.userId;
    let registrar = false;
    try { await requireAction(me, 'registration.request.decide'); registrar = true; } catch { /* not a registrar */ }
    const one = async (q: string, p: unknown[]) => ((await pg().query(q, p)) as { r: string }[])[0].r;

    if (input.action === 'attach') {
      const r = await one(`SELECT trt_add($1,$2,$3,$4::uuid) AS r`, [T, me, input.requestId, input.fileId]);
      if (!r.startsWith('ok:')) forbid(r);
      return { ok: true };
    }
    if (input.action === 'review') {
      const r = await one(`SELECT trt_review($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, registrar, input.id, input.version, input.decision, input.note]);
      if (!r.startsWith('ok:')) forbid(r);
      const row = ((await pg().query(`SELECT student_id FROM trt_transcripts WHERE id = $1`, [input.id])) as Row[])[0];
      await audit(a, `Transcript ${input.decision.replace('_', ' ')}`, `transcript:${input.id}`, input.note, 'Registrar');
      if (row) await zite.messages.create({ record: { body: input.decision === 'rejected' ? 'A registrar could not use a transcript you attached. See Transfer credit for why.' : 'A registrar reviewed a transcript you attached.', sender: me, recipients: [String(row.student_id)], isNotification: true, read: false } as never });
      return { ok: true };
    }
    if (input.action === 'read') {
      const r = ((await pg().query(`SELECT name, mime, encode(bytes, 'base64') AS b64 FROM trt_read($1,$2,$3,$4)`, [T, me, registrar, input.id])) as { name: string; mime: string; b64: string }[])[0];
      if (!r) forbid('You cannot open this transcript.');
      return { name: r.name, mime: r.mime, base64: r.b64.replace(/\n/g, '') };
    }

    const rows = (await pg().query(`SELECT t.*, f.name AS file_name, q.ext_institution, q.number FROM trt_transcripts t JOIN fil_files f ON f.id = t.file_id
      JOIN trf_requests q ON q.id = t.request_id WHERE t.tenant_id = $1 AND (t.student_id = $2 OR $3) ORDER BY t.state = 'received' DESC, t.created_at DESC LIMIT 300`, [T, me, registrar])) as Row[];
    const names = await userNames(rows.flatMap((r) => [String(r.student_id), String(r.reviewed_by ?? '')]).filter(Boolean));
    const open = (await pg().query(`SELECT id, ext_institution, number FROM trf_requests WHERE tenant_id = $1 AND student_id = $2 AND state NOT IN ('final', 'withdrawn') ORDER BY created_at DESC`, [T, me])) as Row[];
    return {
      registrar,
      openRequests: open.map((q) => ({ id: String(q.id), label: `#${q.number} · ${q.ext_institution}` })),
      transcripts: rows.map((r) => ({ id: Number(r.id), requestLabel: `#${r.number} · ${r.ext_institution}`, fileName: String(r.file_name), state: String(r.state),
        mine: r.student_id === me, student: r.student_id === me ? 'You' : names[String(r.student_id)] ?? 'Student', reviewedBy: r.reviewed_by ? names[String(r.reviewed_by)] ?? 'Registrar' : null,
        note: String(r.review_note), version: Number(r.version), at: iso(r.created_at) })),
    };
  },
});
