/**
 * `@semester/platform` — the primitives every Semester domain builds on.
 *
 * Layers, lowest first (an import may only point down; `architecture.test.ts`
 * enforces it): kernel → seam → observability → tenancy → gateway-errors →
 * identity → policy → events → gateway → engines → isolation → sdk / testing /
 * reference. See `docs/platform/README.md` for what each is for.
 */

export * from './kernel/clock.ts';
export * from './kernel/canonical.ts';
export * from './kernel/backoff.ts';

export * from './observability/redact.ts';
export * from './observability/telemetry.ts';

export * from './tenancy/organization.ts';
export * from './tenancy/context.ts';
export * from './tenancy/active-context.ts';

export * from './gateway/errors.ts';
export * from './gateway/headers.ts';
export * from './gateway/idempotency.ts';
export * from './gateway/pagination.ts';
export * from './gateway/versioning.ts';
export * from './gateway/service-auth.ts';
export * from './gateway/command.ts';

export * from './identity/affiliation.ts';
export * from './identity/relationship.ts';
export * from './identity/consent.ts';
export * from './identity/capability.ts';
export * from './identity/approval.ts';
export * from './identity/audit.ts';

export * from './policy/engine.ts';

export * from './events/emit.ts';

export * from './engines/workflow.ts';
export * from './engines/notifications.ts';
export * from './engines/files.ts';
export * from './engines/search.ts';
export * from './engines/flags.ts';
export * from './engines/entitlements.ts';
export * from './engines/reporting.ts';
export * from './engines/integration.ts';
export * from './engines/operations.ts';

export * from './isolation/layers.ts';

export * from './sdk/client.ts';
