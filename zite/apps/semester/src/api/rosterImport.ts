import { z } from 'zod';
import { createHash } from 'node:crypto';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, audit, userNames, tenantScope, ids } from '../lib/server';
import { pg } from '../lib/pg';
import { RGW_MIGRATION } from '../lib/rgwMigration';
import { parseRoster } from '../lib/rosterRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of RGW_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const no = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Roster import, shadow mode (S-92, S-93). Integration administrators register a connection (a second one approves it), link
// source classes to this institution's sections, and import OneRoster-shaped CSV. Rows are staged and compared with
// Semester's own enrollments; nothing is written to enrollments. The institution always comes from the caller's membership.
export default createEndpoint({
  description: 'Roster import in shadow mode: connections with two-person approval, class links, OneRoster-shaped CSV import with quarantine, and comparison with Semester enrollments',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('create'), name: z.string().max(120), sourceSystem: z.string().max(120) }),
    z.object({ action: z.literal('approve'), id: z.number().int() }),
    z.object({ action: z.literal('linkClass'), id: z.number().int(), externalClass: z.string().min(1).max(120), sectionId: z.string() }),
    z.object({ action: z.literal('import'), id: z.number().int(), usersCsv: z.string().max(2_000_000), enrollmentsCsv: z.string().max(2_000_000), requestKey: z.string().min(8).max(80) }),
    z.object({ action: z.literal('compare'), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'connector.manage');
    const T = a.institutionId;
    await ensure();
    const conn = async (id: number) => {
      const c = ((await pg().query(`SELECT * FROM rgw_connections WHERE id = $1 AND tenant_id = $2`, [id, T])) as Row[])[0];
      if (!c) no('Connection not found.');
      return c!;
    };
    if (input.action === 'create') {
      if (input.name.trim().length < 3 || input.sourceSystem.trim().length < 2) no('Name the connection and the source system.');
      const r = ((await pg().query(`INSERT INTO rgw_connections (tenant_id, name, standard, source_system, owner_id) VALUES ($1,$2,'OneRoster-shaped CSV',$3,$4) RETURNING id`,
        [T, input.name.trim(), input.sourceSystem.trim(), a.userId])) as Row[])[0];
      await audit(a, 'Roster connection drafted', `rgw:${r.id}`, `${input.name} from ${input.sourceSystem}`, 'Integration admin');
      return { ok: true, id: Number(r.id) };
    }
    if (input.action === 'approve') {
      const r = String(((await pg().query(`SELECT rgw_approve($1,$2,$3) AS r`, [a.userId, T, input.id])) as Row[])[0].r);
      if (r !== 'ok') no(r);
      await audit(a, 'Roster connection approved', `rgw:${input.id}`, 'shadow mode', 'Integration admin (second approver)');
      return { ok: true };
    }
    if (input.action === 'linkClass') {
      await conn(input.id);
      const scope = await tenantScope(T);
      if (!scope.sections.has(input.sectionId)) no('That section is not in your institution.');
      await pg().query(`INSERT INTO rgw_class_links (connection_id, external_class, section_id, linked_by) VALUES ($1,$2,$3,$4)
        ON CONFLICT (connection_id, external_class) DO NOTHING`, [input.id, input.externalClass.trim(), input.sectionId, a.userId]);
      const l = ((await pg().query(`SELECT section_id FROM rgw_class_links WHERE connection_id = $1 AND external_class = $2`, [input.id, input.externalClass.trim()])) as Row[])[0];
      if (String(l.section_id) !== input.sectionId) no('That source class is already linked to another section.');
      await audit(a, 'Roster class linked', `rgw:${input.id}`, `${input.externalClass} → section ${input.sectionId}`, 'Integration admin');
      return { ok: true };
    }
    if (input.action === 'import') {
      await conn(input.id);
      const p = parseRoster(input.usersCsv, input.enrollmentsCsv);
      if (p.problems.length) no(`The file was not imported: ${p.problems.slice(0, 8).join(' ')}${p.problems.length > 8 ? ` (+${p.problems.length - 8} more)` : ''}`);
      // Identity candidates: this institution's members whose account email equals the source email. Nothing outside it.
      const scope = await tenantScope(T);
      const emails = [...new Set(p.users.map((u) => u.email).filter(Boolean))];
      const { rows } = emails.length ? await zite.sql({ query: `SELECT "id", lower("email") AS email FROM "ziteUsers" WHERE lower("email") = ANY($1)`, params: [emails] }) : { rows: [] as Row[] };
      const inside = rows.filter((r) => scope.members.has(String(r.id)));
      const matches = Object.fromEntries(p.users.map((u) => [u.sourcedId, inside.filter((r) => r.email === u.email).map((r) => String(r.id))]));
      const sha = createHash('sha256').update(input.usersCsv).update('\u0000').update(input.enrollmentsCsv).digest('hex');
      const r = String(((await pg().query(`SELECT rgw_ingest($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) AS r`,
        [a.userId, T, input.id, input.requestKey, sha, JSON.stringify(p.enrollments), JSON.stringify(matches)])) as Row[])[0].r);
      if (!r.startsWith('ok:')) no(r);
      const [, bid, replay] = r.split(':');
      const b = ((await pg().query(`SELECT summary FROM rgw_batches WHERE id = $1`, [Number(bid)])) as Row[])[0];
      if (!replay) await audit(a, 'Roster file imported (shadow)', `rgw-batch:${bid}`, JSON.stringify(b.summary), 'Integration admin');
      return { ok: true, batchId: Number(bid), replay: !!replay, summary: b.summary, dropped: p.dropped };
    }
    if (input.action === 'compare') {
      await conn(input.id);
      const staged = (await pg().query(`SELECT person_id, section_id, role, status FROM rgw_staged WHERE connection_id = $1`, [input.id])) as Row[];
      const secIds = [...new Set(((await pg().query(`SELECT section_id FROM rgw_class_links WHERE connection_id = $1`, [input.id])) as Row[]).map((x) => String(x.section_id)))];
      const enr = secIds.length ? (await Promise.all(secIds.map((sid) => zite.enrollments.findAll({ filters: { section: sid }, limit: 2000 })))).flatMap((x) => x.records).filter((e) => e.status === 'Enrolled') : [];
      const secs = await Promise.all(secIds.map((sid) => zite.sections.findOne({ id: sid })));
      const key = (p: string, s: string) => `${p}|${s}`;
      const src = new Set(staged.filter((x) => x.role === 'student' && x.status === 'active').map((x) => key(String(x.person_id), String(x.section_id))));
      const sem = new Set(enr.map((e) => key(ids(e.student)[0] ?? '', ids(e.section)[0] ?? '')));
      const tSrc = new Set(staged.filter((x) => x.role === 'teacher' && x.status === 'active').map((x) => key(String(x.person_id), String(x.section_id))));
      const tSem = new Set(secs.flatMap((s) => (s ? ids(s.instructors).map((i) => key(i, s.id)) : [])));
      const diff = (A: Set<string>, B: Set<string>) => [...A].filter((k) => !B.has(k));
      const people = await userNames([...src, ...sem, ...tSrc, ...tSem].map((k) => k.split('|')[0]));
      const show = (ks: string[]) => ks.slice(0, 50).map((k) => { const [p, s] = k.split('|'); return { person: people[p] ?? 'Person', sectionId: s }; });
      return { mode: 'shadow', note: 'Differences only. Nothing is changed in Semester; an authorized cutover decides what happens next.',
        students: { matching: [...src].filter((k) => sem.has(k)).length, onlyInSource: show(diff(src, sem)), onlyInSemester: show(diff(sem, src)) },
        teachers: { matching: [...tSrc].filter((k) => tSem.has(k)).length, onlyInSource: show(diff(tSrc, tSem)), onlyInSemester: show(diff(tSem, tSrc)) } };
    }
    // get
    const cs = (await pg().query(`SELECT * FROM rgw_connections WHERE tenant_id = $1 ORDER BY id DESC`, [T])) as Row[];
    const cIds = cs.map((c) => Number(c.id));
    const [links, batches, quarantine] = cIds.length ? await Promise.all([
      pg().query(`SELECT connection_id, external_class, section_id FROM rgw_class_links WHERE connection_id = ANY($1) ORDER BY external_class`, [cIds]) as unknown as Promise<Row[]>,
      pg().query(`SELECT id, connection_id, received_at, summary FROM rgw_batches WHERE connection_id = ANY($1) ORDER BY id DESC LIMIT 20`, [cIds]) as unknown as Promise<Row[]>,
      pg().query(`SELECT b.connection_id, r.batch_id, r.line, r.external_enrollment, r.reason FROM rgw_results r JOIN rgw_batches b ON b.id = r.batch_id
        WHERE b.connection_id = ANY($1) AND r.outcome = 'quarantined' AND r.batch_id = (SELECT max(id) FROM rgw_batches WHERE connection_id = b.connection_id) ORDER BY r.line LIMIT 200`, [cIds]) as unknown as Promise<Row[]>,
    ]) : [[], [], []] as Row[][];
    const names = await userNames(cs.flatMap((c) => [String(c.owner_id), String(c.approved_by ?? '')]));
    return {
      me: a.userId,
      connections: cs.map((c) => ({ id: Number(c.id), name: String(c.name), sourceSystem: String(c.source_system), standard: String(c.standard), mode: String(c.mode), state: String(c.state),
        owner: names[String(c.owner_id)] ?? 'Administrator', mine: c.owner_id === a.userId, approvedBy: c.approved_by ? names[String(c.approved_by)] ?? 'Administrator' : null, approvedAt: iso(c.approved_at),
        links: links.filter((l) => Number(l.connection_id) === Number(c.id)).map((l) => ({ externalClass: String(l.external_class), sectionId: String(l.section_id) })),
        batches: batches.filter((b) => Number(b.connection_id) === Number(c.id)).map((b) => ({ id: Number(b.id), at: iso(b.received_at), summary: b.summary })),
        quarantine: quarantine.filter((q) => Number(q.connection_id) === Number(c.id)).map((q) => ({ line: Number(q.line), enrollment: String(q.external_enrollment), reason: String(q.reason) })) })),
    };
  },
});
