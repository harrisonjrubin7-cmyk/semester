import { zite } from 'zitejs/db';
import { pg, HIRING_MIGRATION } from './hiring';

const ids = (v: string | string[] | undefined | null): string[] => (!v ? [] : Array.isArray(v) ? v : [v]);
let ready: Promise<void> | null = null;

export function ensureHiringSchema() {
  if (!ready) {
    const sql = pg();
    ready = (async () => { for (const s of HIRING_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/** Brings Zite applicants that aren't in Postgres yet across (older postings, or applies made before the switch). Idempotent. */
async function absorbZiteApplicants(postingId: string, o: { applicants?: string | string[]; shortlisted?: string | string[]; declined?: string | string[] }) {
  const sl = new Set(ids(o.shortlisted)); const dc = new Set(ids(o.declined));
  for (const a of ids(o.applicants)) {
    await pg().query(`INSERT INTO emp_applications (posting_id, applicant_id, stage) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [postingId, a, sl.has(a) ? 'Shortlisted' : dc.has(a) ? 'Declined' : 'New']);
  }
}

/** One-time import of a caller's existing Zite postings, then keeps Zite-side applicants absorbed. */
export async function importOwn(uid: string) {
  const sql = pg();
  const { records } = await zite.opportunities.findAll({ filters: { postedBy: uid }, limit: 500 });
  for (const o of records) {
    await sql.query(`INSERT INTO emp_postings (id, zite_id, owner_id, title, kind, employer_name, description, location, closes_on) VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [o.id, uid, o.title || 'Untitled', ['Internship', 'Job', 'Research', 'Mentorship'].includes(o.kind ?? '') ? o.kind : 'Job', o.employerName || 'Employer', o.description ?? '', o.location ?? '', o.closesOn || null]);
    const p = (await sql.query(`SELECT id FROM emp_postings WHERE zite_id = $1`, [o.id])) as { id: string }[];
    if (p[0]) await absorbZiteApplicants(p[0].id, o);
  }
}

/** Applies pending outbox rows to Zite. Failures stay pending with the error, and retry on the next call. */
export async function dispatch() {
  const sql = pg();
  const rows = (await sql.query(`SELECT id, kind, payload FROM emp_outbox WHERE status = 'pending' ORDER BY id LIMIT 50`)) as { id: number; kind: string; payload: Record<string, string> }[];
  for (const r of rows) {
    try {
      if (r.kind === 'notify') {
        await zite.messages.create({ record: { body: r.payload.body, sender: r.payload.from, recipients: [r.payload.to], isNotification: true, read: false } as never });
      } else {
        const p = ((await sql.query(`SELECT * FROM emp_postings WHERE id = $1`, [r.payload.postingId])) as Record<string, unknown>[])[0];
        if (p) {
          const zid = p.zite_id ? String(p.zite_id) : null;
          if (p.status === 'deleted') { if (zid && await zite.opportunities.findOne({ id: zid })) await zite.opportunities.delete({ id: zid }); }
          else {
            if (zid) { const cur = await zite.opportunities.findOne({ id: zid }); if (cur) await absorbZiteApplicants(String(p.id), cur); }
            const apps = (await sql.query(`SELECT applicant_id, stage FROM emp_applications WHERE posting_id = $1`, [p.id])) as { applicant_id: string; stage: string }[];
            const rec = {
              title: p.title, kind: p.kind, employerName: p.employer_name, description: p.description, location: p.location,
              closesOn: p.closes_on ? new Date(String(p.closes_on)).toISOString().slice(0, 10) : null, postedBy: p.owner_id,
              applicants: apps.map((a) => a.applicant_id), shortlisted: apps.filter((a) => a.stage === 'Shortlisted').map((a) => a.applicant_id),
              declined: apps.filter((a) => a.stage === 'Declined').map((a) => a.applicant_id),
            };
            if (zid && await zite.opportunities.findOne({ id: zid })) await zite.opportunities.update({ id: zid, record: rec as never });
            else { const c = await zite.opportunities.create({ record: rec as never }); await sql.query(`UPDATE emp_postings SET zite_id = $2 WHERE id = $1`, [p.id, c.id]); }
          }
        }
      }
      await sql.query(`UPDATE emp_outbox SET status = 'dispatched', dispatched_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1`, [r.id]);
    } catch (e) {
      await sql.query(`UPDATE emp_outbox SET attempts = attempts + 1, last_error = $2 WHERE id = $1`, [r.id, String(e instanceof Error ? e.message : e).slice(0, 300)]);
    }
  }
}
