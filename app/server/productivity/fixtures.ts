import { randomUUID } from 'node:crypto';
import type { ConsentGrant } from '../../../packages/institution/src/index.ts';
import type { Command } from './contract.ts';
import { MemoryProductivityRepository } from './memory.ts';
import { ProductivityService, type Principal } from './service.ts';

/** Shared by the tests: one fixed "now", a clock that can be moved, and people to be. */
export const T0 = Date.parse('2026-10-05T15:00:00.000Z');

export const clock = (wall: number, device = 'dev-a', counter = 0): string =>
  `${String(wall).padStart(13, '0')}.${String(counter).padStart(4, '0')}.${device}`;

export const ALICE = '11111111-1111-4111-8111-111111111111';
export const BOB = '22222222-2222-4222-8222-222222222222';
export const FEED = '33333333-3333-4333-8333-333333333333';

export const iso = (ms: number) => new Date(ms).toISOString();

export function person(id = ALICE, tenant = 'school-a', extra: Partial<Principal> = {}): Principal {
  return {
    actor: { id, type: 'user', authenticatedAt: iso(T0 - 300_000), mfaLevel: 'standard' },
    tenant: { id: tenant, environment: 'production', verifiedBy: 'membership' },
    membershipIds: [`m-${id}`],
    roleGrants: [{ role: 'student', scopeKind: 'tenant', scopeId: tenant }],
    capabilities: ['productivity:use'],
    featureFlags: [],
    policyVersions: { productivity: '1' },
    ...extra,
  };
}

export function feedJob(tenant = 'school-a', extra: Partial<Principal> = {}): Principal {
  return {
    actor: { id: 'job-calendar-import', type: 'integration', authenticatedAt: iso(T0 - 60_000) },
    tenant: { id: tenant, environment: 'production', verifiedBy: 'service_binding' },
    membershipIds: [],
    roleGrants: [],
    capabilities: ['calendar:import'],
    featureFlags: [],
    policyVersions: { productivity: '1' },
    ...extra,
  };
}

export const shareGrant = (over: Partial<ConsentGrant> = {}): ConsentGrant => ({
  id: 'share-1',
  kind: 'share',
  grantedBy: ALICE,
  grantedTo: BOB,
  scopes: ['tasks:read', 'calendar:read'],
  expiresAt: iso(T0 + 3_600_000),
  revokedAt: null,
  ...over,
});

let counter = 0;
const nextUuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};
export const uuid = nextUuid;

type Base = { commandId?: string; deviceId?: string; clock?: string; createdAt?: string };

/** Builds a command with a fresh id, a clock at `at`, and sensible defaults. */
export function cmd<T extends { type: Command['type'] }>(fields: T & Record<string, unknown>, base: Base & { at?: number } = {}): Command {
  const device = base.deviceId ?? 'dev-a';
  const at = base.at ?? T0;
  return {
    commandId: base.commandId ?? nextUuid(),
    deviceId: device,
    clock: base.clock ?? clock(at, device),
    createdAt: base.createdAt ?? iso(at),
    ...fields,
  } as unknown as Command;
}

export const TASK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const EVENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const createTask = (over: Record<string, unknown> = {}, base: Base & { at?: number } = {}) =>
  cmd({ type: 'task.create', id: TASK_ID, fields: { title: 'Read chapter 4', notes: 'for Thursday', dueAt: '2026-10-08T17:00:00Z', priority: 'high', ...over } }, base);

export const createEvent = (over: Record<string, unknown> = {}, base: Base & { at?: number } = {}) =>
  cmd({
    type: 'calendar_event.create', id: EVENT_ID,
    fields: { title: 'Office hours', startsAt: '2026-10-06T19:00:00Z', endsAt: '2026-10-06T20:00:00Z', timezone: 'America/Chicago', location: 'Furman 101', notes: 'bring draft', ...over },
  }, base);

export function harness(options: { now?: () => number } = {}) {
  const repo = new MemoryProductivityRepository();
  const outcomes: { type: string; status: string; actorType: string }[] = [];
  const decisions: { action: string; allow: boolean; reasonCode?: string }[] = [];
  let at = T0;
  const now = options.now ?? (() => at);
  const service = new ProductivityService({
    repo, now, newId: () => randomUUID(), onCommand: (o) => void outcomes.push(o), onDecision: (d) => void decisions.push(d),
  });
  return { repo, service, outcomes, decisions, setNow: (ms: number) => { at = ms; }, meta: { correlationId: 'req-0123456789abcdef' } };
}
