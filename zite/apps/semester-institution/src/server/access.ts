import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';

export type Capability = 'view' | 'request' | 'chair' | 'schedule' | 'registrar' | 'configure';

const CHAIR = ['Department chair', 'Dean/academic affairs leader', 'Program director'];
const SCHEDULER = ['Department administrator/scheduler', 'Curriculum administrator'];
const REGISTRAR = ['Registrar staff', 'Registration specialist', 'Academic-records specialist'];
const CONFIG = ['Institutional executive', 'Institutional IT'];
const NON_STAFF = new Set(['Student', 'Alumni', 'Employer']);

export const ids = (v: string | string[] | undefined | null): string[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

function capsFor(roles: string[], templates: string[]): Capability[] {
  const admin = roles.includes('Administrator');
  const staff = roles.some((r) => !NON_STAFF.has(r)) || templates.some((t) => [...CHAIR, ...SCHEDULER, ...REGISTRAR, ...CONFIG].includes(t));
  if (!staff) return [];
  const caps: Capability[] = ['view', 'request'];
  if (admin || templates.some((t) => CHAIR.includes(t))) caps.push('chair');
  if (admin || templates.some((t) => SCHEDULER.includes(t))) caps.push('schedule');
  if (admin || templates.some((t) => REGISTRAR.includes(t))) caps.push('registrar');
  if (admin || templates.some((t) => CONFIG.includes(t))) caps.push('configure');
  return caps;
}

export async function getMemberships(userId: string) {
  const { records } = await zite.memberships.findAll({ filters: { member: userId, status: 'Active' }, limit: 200 });
  const byInst = new Map<string, Set<Capability>>();
  for (const m of records) {
    const caps = capsFor(m.roles ?? [], (m.roleTemplates ?? []) as string[]);
    for (const inst of ids(m.institution)) {
      const set = byInst.get(inst) ?? new Set<Capability>();
      caps.forEach((c) => set.add(c));
      byInst.set(inst, set);
    }
  }
  return byInst;
}

/** Deny by default: throws unless the user holds the capability at the institution. */
export async function requireCap(userId: string, institutionId: string, cap: Capability) {
  const caps = (await getMemberships(userId)).get(institutionId);
  if (!caps || !caps.has(cap)) {
    throw new ZiteError({
      code: 'FORBIDDEN',
      message: `User ${userId} lacks ${cap} at ${institutionId}`,
      userFacingMessage: 'You are not authorized to perform this action at this institution.',
    });
  }
  return caps;
}

export async function audit(p: { userId: string; institutionId: string; action: string; recordRef: string; authority: string; details?: string }) {
  await zite.auditEvents.create({
    record: {
      action: p.action,
      actor: p.userId,
      institution: p.institutionId,
      recordRef: p.recordRef,
      authority: p.authority,
      viaAssistant: false,
      details: p.details ?? null,
    },
  });
}
