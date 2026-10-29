import { zite } from 'zitejs/db';
import { liveShares, ConsentRow, AdvisorCategory } from './shares';

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

/** Students in this institution with a live advisor share to `advisorId` that includes any of `categories`
 *  (the consent is created by the student in advisorShare.ts). This is the only way an advisor reaches a student here. */
export async function adviseesSharing(advisorId: string, members: Set<string>, categories: AdvisorCategory[]): Promise<string[]> {
  const c = (await zite.consents.findAll({ filters: { recipient: advisorId, consentType: 'Data Sharing' }, limit: 2000 })).records.map((r) => ({
    id: r.id, member: ids(r.member), recipient: ids(r.recipient), label: r.label ?? '', consentType: r.consentType ?? '', granted: !!r.granted, revoked: !!r.revoked, expiresOn: r.expiresOn ?? null,
  }) as ConsentRow);
  return liveShares(c, advisorId, 'Advisor', new Date().toISOString().slice(0, 10))
    .filter((x) => members.has(x.studentId) && x.categories.some((k) => (categories as string[]).includes(k))).map((x) => x.studentId);
}
