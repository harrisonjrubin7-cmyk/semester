import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, ids, first, forbid, audit, userNames } from '../lib/server';
import { bumpEpoch } from '../lib/platform';
import { pg } from '../lib/pg';
import { ensureCal } from '../lib/calendarServer';
import { RGW_MIGRATION } from '../lib/rgwMigration';
import { parseIcs, termDates } from '../lib/connectorImport';

const ROLE = z.enum(['Student', 'Faculty', 'Advisor', 'Tutor', 'Staff', 'Administrator', 'Alumni', 'Employer']);

// The data API returns at most 2000 rows per call; page through with offset (stops at 100k rows).
async function everyRow<T>(page: (o: { offset: number; limit: number }) => Promise<{ records: T[]; hasMore: boolean }>): Promise<{ records: T[] }> {
  const records: T[] = [];
  for (let offset = 0; offset < 100_000; offset += 2000) { const r = await page({ offset, limit: 2000 }); records.push(...r.records); if (!r.hasMore || r.records.length === 0) break; }
  return { records };
}

export default createEndpoint({
  description: 'Institution Console: memberships, connectors, retention, feature status and the audit log (admins only)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('requestRole'), membershipId: z.string(), role: ROLE, reason: z.string().min(3) }),
    z.object({ action: z.literal('setAuthorized'), id: z.string(), authorized: z.boolean() }),
    z.object({ action: z.literal('runSync'), id: z.string() }),
    z.object({ action: z.literal('calendarImport'), id: z.string(), ics: z.string().min(20).max(1_000_000), apply: z.boolean() }),
    z.object({ action: z.literal('rollback'), id: z.string() }),
    z.object({ action: z.literal('setRetention'), days: z.number().int().min(30).max(3650) }),
    z.object({ action: z.literal('setFeature'), id: z.string(), field: z.enum(['designed', 'implemented', 'tested', 'deployed', 'institutionAuthorized']), value: z.boolean() }),
    z.object({ action: z.literal('setMemberStatus'), membershipId: z.string(), status: z.enum(['Active', 'Suspended']) }),
    z.object({ action: z.literal('newInviteCode') }),
    z.object({ action: z.literal('removeSample'), confirm: z.literal('REMOVE') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'connector.manage');
    const I = a.institutionId;
    const inTenant = async (membershipId: string) => {
      const m = await zite.memberships.findOne({ id: membershipId });
      if (!m || first(m.institution) !== I) forbid();
      return m!;
    };
    const integ = async (id: string) => {
      const x = await zite.integrations.findOne({ id });
      if (!x || first(x.institution) !== I) forbid();
      return x!;
    };
    switch (input.action) {
      case 'requestRole': {
        const m = await inTenant(input.membershipId);
        await zite.tasks.create({ record: { title: `Role change: ${m.label?.split(' · ')[0]} → ${input.role}`, owner: a.userId, requestedBy: a.userId, type: 'Approval Request', status: 'Pending Approval', source: 'Made Here', owningOffice: 'Institution administration', rubric: `membership:${m.id} role:${input.role} ${input.reason}` } as never });
        await audit(a, 'Role change requested', `membership:${m.id}`, input.role, 'Administrator');
        return { ok: true };
      }
      case 'setMemberStatus': {
        const m = await inTenant(input.membershipId);
        if (ids(m.member).includes(a.userId)) forbid('You cannot change your own membership.');
        await audit(a, `Membership ${input.status}`, `membership:${m.id}`, '', 'Administrator');
        await zite.memberships.update({ id: m.id, record: { status: input.status } as never });
        // Revocation (backlog C3): the member's open screens and queued commands are refused from now on.
        const who = first(m.member); if (who) await bumpEpoch(I, who, `membership ${input.status}`);
        return { ok: true };
      }
      case 'setAuthorized': {
        const x = await integ(input.id);
        await audit(a, input.authorized ? 'Connector authorized' : 'Connector deauthorized', `integration:${x.id}`, x.connector ?? '', 'Administrator');
        await zite.integrations.update({ id: x.id, record: { authorizedByInstitution: input.authorized, enabled: input.authorized ? x.enabled : false } as never });
        return { ok: true };
      }
      case 'runSync': {
        const x = await integ(input.id);
        if (!x.authorizedByInstitution) forbid('This connector is off until the institution authorizes it.');
        const now = new Date().toISOString();
        if (x.connector === 'SIS') {
          // The SIS connector is the roster gateway (rosterImport.ts, rgw-001): shadow mode, two-person approved connection.
          for (const q of RGW_MIGRATION) await pg().query(q);
          const c = ((await pg().query(`SELECT c.id, c.name, c.source_system, (SELECT max(received_at) FROM rgw_batches b WHERE b.connection_id = c.id) AS last,
              (SELECT count(*) FROM rgw_staged s WHERE s.connection_id = c.id)::int AS staged,
              (SELECT count(*) FROM rgw_results r JOIN rgw_batches b ON b.id = r.batch_id WHERE b.connection_id = c.id AND r.outcome = 'quarantined')::int AS quarantined
            FROM rgw_connections c WHERE c.tenant_id = $1 AND c.state = 'Approved' ORDER BY c.id DESC LIMIT 1`, [I])) as Record<string, unknown>[])[0];
          if (!c) forbid('No approved roster connection yet. Open Roster import, create a connection and have a second administrator approve it.');
          if (!c!.last) forbid(`Connection "${c!.name}" is approved but nothing has been imported. Import users.csv and enrollments.csv in Roster import.`);
          await zite.integrations.update({ id: x.id, record: { syncStatus: 'Synced', enabled: true, retryCount: 0, lastSyncedAt: new Date(String(c!.last)).toISOString(),
            lastReconciliation: `Checked ${now}: roster gateway "${c!.name}" (${c!.source_system}), shadow mode. ${c!.staged} enrollments staged, ${c!.quarantined} rows quarantined. Nothing is written to Semester enrollments; compare them in Roster import.` } as never });
          await audit(a, 'SIS connector checked', `integration:${x.id}`, `${c!.staged} staged`, 'Administrator');
          return { ok: true };
        }
        if (x.connector === 'Calendar') forbid('The calendar connector reads your academic calendar export: paste or upload the .ics file in the card and run a dry run.');
        // LMS and SSO need credentials from outside Semester; record that honestly without counting it as a failed attempt.
        const need = x.connector === 'LMS'
          ? 'needs an LTI 1.3 registration from your LMS (client ID, deployment ID, platform keys and endpoints). None is configured, so no connection was attempted.'
          : 'needs your identity provider (SAML or OpenID Connect metadata). Sign-in currently uses Semester accounts; connecting an identity provider is a platform change made with the Semester founder.';
        await zite.integrations.update({ id: x.id, record: { lastReconciliation: `Checked ${now}: the ${x.connector} connector ${need}` } as never });
        await audit(a, 'Connector checked', `integration:${x.id}`, `${x.connector}: credentials needed`, 'Administrator');
        return { ok: true, note: need };
      }
      case 'calendarImport': {
        const x = await integ(input.id);
        if (x.connector !== 'Calendar') forbid('Calendar files go to the Calendar connector.');
        if (!x.authorizedByInstitution) forbid('This connector is off until the institution authorizes it.');
        const found = termDates(parseIcs(input.ics));
        const complete = found.terms.filter((t) => !t.missing.length);
        const results: { term: string; result: string }[] = [];
        if (input.apply) {
          // Creating proposals needs registrar authority; a different registrar still approves each one (cal-001).
          const r = await requireAction(context.user.id, 'registration.request.decide').catch(() => forbid('Creating calendar proposals needs registrar authority.'));
          await ensureCal();
          for (const t of complete) {
            const d = t.dates as Record<string, string>;
            const e = ((await pg().query(`SELECT cal_propose($1,$2,$3,$4,$5,$6,$7,$8,$9) AS e`, [r!.userId, I, t.term, `${d.regOpens}T08:00:00Z`, `${d.regCloses}T23:59:00Z`, d.addDropEnds, d.classesStart, d.classesEnd,
              'Imported from the institution calendar (.ics) by the Calendar connector'])) as { e: string | null }[])[0].e;
            results.push({ term: t.term, result: e ?? 'proposed — waiting for a second registrar' });
          }
          const ok = results.filter((x2) => x2.result.startsWith('proposed')).length;
          await zite.integrations.update({ id: x.id, record: { syncStatus: ok ? 'Synced' : 'Sync Error', enabled: true, retryCount: 0, lastSyncedAt: new Date().toISOString(),
            lastReconciliation: `Imported ${new Date().toISOString()}: ${found.terms.length} terms found, ${complete.length} complete, ${ok} proposed to the academic calendar. ${results.filter((x2) => !x2.result.startsWith('proposed')).map((x2) => `${x2.term}: ${x2.result}`).join(' ')} Proposals take effect only after a second registrar approves.` } as never });
          await audit(a, 'Calendar connector import', `integration:${x.id}`, `${ok} proposals`, 'Registrar');
        }
        return { ok: true, terms: found.terms, unused: found.unused.slice(0, 50), results };
      }
      case 'rollback': {
        const x = await integ(input.id);
        await zite.integrations.update({ id: x.id, record: { syncStatus: 'Rolled Back', retryCount: 0, lastReconciliation: `Reset ${new Date().toISOString()}. Nothing to remove: the SIS connector is shadow-only (nothing is written to enrollments) and calendar proposals are withdrawn on the Academic calendar page.` } as never });
        await audit(a, 'Sync rolled back', `integration:${x.id}`, '', 'Administrator');
        return { ok: true };
      }
      case 'newInviteCode': {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
        await audit(a, 'Invite code issued', `institution:${I}`, '', 'Administrator');
        await zite.institutions.update({ id: I, record: { inviteCode: code } as never });
        return { ok: true, code };
      }
      case 'removeSample': {
        const inst = await zite.institutions.findOne({ id: I });
        if (!inst?.isSample) forbid('This institution has no sample data to remove.');
        await audit(a, 'Sample data removal started', `institution:${I}`, '', 'Administrator');
        const q = async (sql: string) => (await zite.sql({ query: sql, params: [I] })).rows.map((r) => String(r.id));
        const courseIds = await q(`SELECT "coursesId" AS id FROM "CoursesInstitutions" WHERE "institutionsId"=$1`);
        const allSections = await zite.sections.findAll({ limit: 2000 });
        const sectionIds = allSections.records.filter((s) => courseIds.includes(first(s.course) ?? '')).map((s) => s.id);
        const groupIds = await q(`SELECT "groupsId" AS id FROM "GroupsInstitutions" WHERE "institutionsId"=$1`);
        const eventIds = groupIds.length ? (await zite.sql({ query: `SELECT "eventsId" AS id FROM "EventsGroups" WHERE "groupsId" = ANY($1)`, params: [groupIds] })).rows.map((r) => String(r.id)) : [];
        const reqIds = (await zite.requirements.findAll({ filters: { institution: I }, limit: 500 })).records.map((r) => r.id);
        const mems = await zite.memberships.findAll({ filters: { institution: I }, limit: 500 });
        let removed = 0;
        const del = async (fn: (id: string) => Promise<unknown>, list: string[]) => { for (const id of list) { await fn(id); removed++; } };
        for (const m of mems.records) {
          const uid = first(m.member); if (!uid) continue;
          const [t, e, r] = await Promise.all([
            zite.tasks.findAll({ filters: { owner: uid, source: 'Sample' }, limit: 500 }),
            zite.enrollments.findAll({ filters: { student: uid, source: 'Sample' }, limit: 500 }),
            zite.resources.findAll({ filters: { owner: uid, source: 'Sample' }, limit: 500 }),
          ]);
          await del((id) => zite.tasks.delete({ id }), t.records.map((x) => x.id));
          await del((id) => zite.enrollments.delete({ id }), e.records.map((x) => x.id));
          await del((id) => zite.resources.delete({ id }), r.records.map((x) => x.id));
        }
        await del((id) => zite.events.delete({ id }), eventIds);
        await del((id) => zite.groups.delete({ id }), groupIds);
        await del((id) => zite.sections.delete({ id }), sectionIds);
        await del((id) => zite.courses.delete({ id }), courseIds);
        await del((id) => zite.requirements.delete({ id }), reqIds);
        await zite.institutions.update({ id: I, record: { isSample: false, name: inst!.name?.replace(/\s*\(sample\)$/i, '') } as never });
        await audit(a, 'Sample data removed', `institution:${I}`, `${removed} records removed`, 'Administrator');
        return { ok: true, removed };
      }
      case 'setRetention': {
        await audit(a, 'Retention changed', `institution:${I}`, `${input.days} days`, 'Administrator');
        await zite.institutions.update({ id: I, record: { retentionDays: input.days } as never });
        return { ok: true };
      }
      case 'setFeature': {
        // Feature status is Semester's platform-wide register (no institution column): one customer's admin must not change
        // what every institution is told. Semester maintains it with evidence in the Security Lab; here it is read-only.
        await audit(a, 'Feature status change refused', `feature:${input.id}`, `${input.field}=${input.value}`, 'Administrator');
        return forbid('Feature status is maintained by Semester with evidence, not by institutions.');
      }
    }
    const [inst, mems, ints, feats, auditRows, consents] = await Promise.all([
      zite.institutions.findOne({ id: I }),
      zite.memberships.findAll({ filters: { institution: I }, limit: 500 }),
      zite.integrations.findAll({ filters: { institution: I }, limit: 20 }),
      zite.featureStatus.findAll({ limit: 100 }),
      zite.sql({ query: `SELECT a."id",a."action",a."actor",a."recordRef",a."authority",a."viaAssistant",a."occurredAt" FROM "AuditEvents" a JOIN "AuditEventsInstitutions" ai ON ai."auditEventsId"=a."id" WHERE ai."institutionsId"=$1 ORDER BY a."occurredAt" DESC LIMIT 100`, params: [I] }),
      // Only consents of this institution's members (was a count across every tenant).
      everyRow((o) => zite.consents.findAll({ fields: ['member'], ...o })),
    ]);
    const clean = (v: unknown) => String(v ?? '').replace(/[[\]"{}]/g, '');
    const names = await userNames([...mems.records.map((m) => first(m.member) ?? ''), ...auditRows.rows.map((r) => clean(r.actor))]);
    const checklist = [
      { label: 'Data processing agreement signed', done: false },
      { label: 'SSO tested', done: ints.records.some((x) => x.connector === 'SSO' && x.syncStatus === 'Synced') },
      { label: 'Retention set', done: !!inst?.retentionDays },
      { label: 'Sample data removed', done: !inst?.isSample },
    ];
    return {
      institution: { name: inst?.name ?? '', retentionDays: inst?.retentionDays ?? 365, isSample: !!inst?.isSample, inviteCode: inst?.inviteCode ?? '', aiPolicy: inst?.aiPolicy ?? '' },
      operator: context.user.firstName || context.user.email, me: a.userId,
      memberships: mems.records.map((m) => ({ id: m.id, name: names[first(m.member) ?? ''] ?? m.label ?? '', roles: m.roles ?? [], status: m.status ?? '', self: ids(m.member).includes(a.userId) })),
      integrations: ints.records.map((x) => ({ id: x.id, name: x.name ?? '', connector: x.connector ?? '', enabled: !!x.enabled, authorized: !!x.authorizedByInstitution, syncStatus: x.syncStatus ?? 'Never Run', retryCount: x.retryCount ?? 0, lastSyncedAt: x.lastSyncedAt ?? null, lastReconciliation: x.lastReconciliation ?? '' })),
      features: feats.records.map((f) => ({ id: f.id, feature: f.feature ?? '', designed: !!f.designed, implemented: !!f.implemented, tested: !!f.tested, deployed: !!f.deployed, institutionAuthorized: !!f.institutionAuthorized, testCases: f.testCases ?? '' })),
      audit: auditRows.rows.map((r) => ({ id: String(r.id), action: String(r.action ?? ''), actor: names[clean(r.actor)] ?? 'Member', recordRef: String(r.recordRef ?? ''), authority: String(r.authority ?? ''), viaAssistant: !!r.viaAssistant, at: String(r.occurredAt ?? '') })),
      consentCount: (() => { const ms = new Set(mems.records.map((m) => first(m.member)).filter(Boolean) as string[]); return consents.records.filter((c) => ids(c.member).some((x) => ms.has(x))).length; })(),
      checklist,
    };
  },
});
