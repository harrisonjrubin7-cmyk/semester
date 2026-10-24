import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAction, ids, first, forbid, audit, userNames } from '../lib/server';
import { bumpEpoch } from '../lib/platform';

const ROLE = z.enum(['Student', 'Faculty', 'Advisor', 'Tutor', 'Staff', 'Administrator', 'Alumni', 'Employer']);

export default createEndpoint({
  description: 'Institution Console: memberships, connectors, retention, feature status and the audit log (admins only)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('requestRole'), membershipId: z.string(), role: ROLE, reason: z.string().min(3) }),
    z.object({ action: z.literal('setAuthorized'), id: z.string(), authorized: z.boolean() }),
    z.object({ action: z.literal('runSync'), id: z.string() }),
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
        // No live endpoint is configured in the foundation phase: record an honest failure and retry count.
        const retry = (x.retryCount ?? 0) + 1;
        await zite.integrations.update({ id: x.id, record: { syncStatus: retry >= 3 ? 'Sync Error' : 'Retrying', retryCount: retry, lastReconciliation: `Run ${new Date().toISOString()}: no live ${x.connector} connection configured. 0 records read, 0 changed. Attempt ${retry}.` } as never });
        await audit(a, 'Sync attempted', `integration:${x.id}`, `Attempt ${retry}`, 'Administrator');
        return { ok: true };
      }
      case 'rollback': {
        const x = await integ(input.id);
        await zite.integrations.update({ id: x.id, record: { syncStatus: 'Rolled Back', retryCount: 0, lastReconciliation: `Rolled back ${new Date().toISOString()}. No synced records to remove.` } as never });
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
      zite.consents.findAll({ limit: 5000, fields: ['member'] }),
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
