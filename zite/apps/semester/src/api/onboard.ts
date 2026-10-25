import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { ensureSampleInstitution, seedForUser } from '../lib/seed';
import { audit, forbid } from '../lib/server';

export default createEndpoint({
  description: 'Creates the member’s first workspace or invite-only join request, records consents and optionally loads sample data',
  authenticated: true,
  inputSchema: z.object({
    workspace: z.enum(['sample', 'personal', 'invite']),
    inviteCode: z.string().optional(),
    role: z.enum(['Student', 'Faculty', 'Advisor', 'Administrator']),
    useSample: z.boolean(),
    consents: z.object({ assistant: z.boolean(), directory: z.boolean() }),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const uid = context.user.id;
    const existing = await zite.memberships.findAll({ filters: { member: uid }, limit: 1 });
    if (existing.records.length) return { ok: true };

    let institutionId: string;
    let status = 'Active';
    let isSampleInst = input.workspace === 'sample';
    if (input.workspace === 'invite') {
      const code = (input.inviteCode ?? '').trim().toUpperCase();
      if (code.length < 4) forbid('Enter the invite code from your administrator.');
      const inst = await zite.institutions.findOne({ filters: { inviteCode: code } });
      if (!inst) forbid('That invite code doesn’t match an institution. Check it with your administrator.');
      if (input.role === 'Administrator') forbid('Administrator access is granted by an existing administrator, not by invite.');
      institutionId = inst!.id;
      status = 'Pending';
      isSampleInst = !!inst!.isSample;
    } else if (input.workspace === 'sample') {
      // Decision D-onboard (25 Oct): the Sample institution is shared by everyone who signs up, so nobody may make
      // themselves its administrator. Demo teaching and advising roles stay available over synthetic data.
      if (input.role === 'Administrator') forbid('Administrator access is not self-service in the shared sample. Choose a personal workspace to try the admin console.');
      institutionId = await ensureSampleInstitution();
    } else {
      const inst = await zite.institutions.create({
        record: { name: `${context.user.firstName || 'My'} personal workspace`, tenantType: 'Personal', isSample: false, retentionDays: 365 } as never,
      });
      institutionId = inst.id;
    }
    const roles = [...new Set(['Student', input.role])];
    await zite.memberships.create({
      record: { label: `${context.user.email} · ${roles.join(', ')}`, member: uid, institution: institutionId, roles, status } as never,
    });
    await zite.consents.bulkCreate({
      records: [
        { label: 'Terms of use', member: uid, consentType: 'Terms', granted: true, revoked: false },
        { label: 'Ask Semester may read my course materials', member: uid, consentType: 'Assistant Use', granted: input.consents.assistant, revoked: false },
        { label: 'Show me in the campus directory', member: uid, consentType: 'Directory Visibility', granted: input.consents.directory, revoked: false },
        { label: 'Use my work for AI training', member: uid, consentType: 'AI Training', granted: false, revoked: false },
      ] as never,
    });
    if (input.useSample && (input.workspace !== 'invite' || isSampleInst)) {
      if (input.workspace === 'personal') await ensureSampleInstitution();
      await seedForUser(uid, institutionId);
    }
    await audit({ userId: uid, institutionId }, status === 'Pending' ? 'Join requested' : 'Membership created', `membership:${uid}`, `Roles: ${roles.join(', ')}`, input.workspace === 'invite' ? 'Invite code' : 'Self-service onboarding');
    return { ok: true };
  },
});
