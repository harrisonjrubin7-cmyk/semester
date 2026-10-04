// Generated from app/src/lib/integration/vault.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * Credential vaulting: how a worker turns the pointer in a declaration into a
 * secret for the length of one call, and never any longer than that.
 *
 * `AdapterDeclaration.credentialsReference` is a pointer, checked by
 * `validateDeclaration`. This is the other half: the broker that resolves it.
 * Four rules, each with a test that fails when it is broken:
 *
 *  1. **Tenant-bound.** A reference outside the connection's own namespace is
 *     refused before the backend is asked. A tenant-A connection cannot lease
 *     tenant B's secret by naming it.
 *  2. **Audited first.** The audit record is written before the lease is
 *     issued. If the audit sink fails, there is no lease.
 *  3. **Short-lived.** A lease expires; `reveal()` after that throws.
 *  4. **Unprintable.** A lease serialises, logs and inspects as a reference and
 *     an expiry. The value is reachable only through `reveal()`.
 *
 * Audit events carry the reference, never the value.
 */
export const REFERENCE = /^(vault|env|secret-manager):([A-Za-z0-9_./-]{1,200})$/;

export type SecretScheme = 'vault' | 'env' | 'secret-manager';

export function parseReference(reference: string): { scheme: SecretScheme; path: string } | null {
  const m = REFERENCE.exec(reference);
  return m ? { scheme: m[1] as SecretScheme, path: m[2] } : null;
}

export interface SecretMaterial {
  value: string;
  version: string;
  rotatedAt: Date;
}

export interface SecretBackend {
  read(scheme: SecretScheme, path: string): Promise<SecretMaterial | null>;
}

export interface VaultAuditEvent {
  event: 'credential.leased' | 'credential.refused';
  reference: string;
  tenantId: string;
  connectionId: string;
  purpose: string;
  reason?: string;
  at: string;
}

export interface LeaseRequest {
  reference: string;
  tenantId: string;
  connectionId: string;
  purpose: string;
  ttlMs?: number;
}

export type RefusalReason =
  | 'malformed_reference' | 'scheme_not_allowed' | 'wrong_tenant' | 'not_found' | 'ttl_invalid' | 'audit_unavailable';

export type LeaseResult = { ok: true; lease: CredentialLease } | { ok: false; reason: RefusalReason };

const secrets = new WeakMap<CredentialLease, string>();

export class LeaseExpired extends Error {
  constructor() {
    super('The credential lease has expired');
  }
}

export class CredentialLease {
  readonly reference: string;
  readonly connectionId: string;
  readonly version: string;
  readonly expiresAt: Date;
  private readonly clock: () => Date;

  constructor(reference: string, connectionId: string, version: string, expiresAt: Date, secret: string, clock: () => Date) {
    this.reference = reference;
    this.connectionId = connectionId;
    this.version = version;
    this.expiresAt = expiresAt;
    this.clock = clock;
    secrets.set(this, secret);
  }

  reveal(): string {
    const value = secrets.get(this);
    if (value === undefined || this.clock().getTime() >= this.expiresAt.getTime()) throw new LeaseExpired();
    return value;
  }

  /** Forget the value now, without waiting for the expiry. */
  release(): void {
    secrets.delete(this);
  }

  toJSON(): Record<string, string> {
    return { reference: this.reference, connectionId: this.connectionId, version: this.version, expiresAt: this.expiresAt.toISOString(), value: '[redacted]' };
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `CredentialLease(${this.reference}, expires ${this.expiresAt.toISOString()})`;
  }

  toString(): string {
    return `CredentialLease(${this.reference})`;
  }
}

export interface BrokerOptions {
  backend: SecretBackend;
  /** Called before every lease and every refusal. A throw means no lease. */
  audit: (event: VaultAuditEvent) => void | Promise<void>;
  now?: () => Date;
  /** `env:` pointers read the process environment: development and tests only. */
  allowedSchemes?: readonly SecretScheme[];
  /** `sandbox/` pointers are the mock providers' and never a school's. */
  allowSandbox?: boolean;
  defaultTtlMs?: number;
  maxTtlMs?: number;
}

export class LeaseBroker {
  private readonly options: BrokerOptions;
  private readonly now: () => Date;
  private readonly schemes: readonly SecretScheme[];
  private readonly defaultTtl: number;
  private readonly maxTtl: number;

  constructor(options: BrokerOptions) {
    this.options = options;
    this.now = options.now ?? (() => new Date());
    this.schemes = options.allowedSchemes ?? ['vault', 'secret-manager'];
    this.defaultTtl = options.defaultTtlMs ?? 5 * 60_000;
    this.maxTtl = options.maxTtlMs ?? 15 * 60_000;
  }

  /** Whether a path sits in the namespace a connection of this tenant may read. */
  private inNamespace(path: string, tenantId: string): boolean {
    if (path.includes('..') || path.includes('//')) return false;
    if (path.startsWith(`tenants/${tenantId}/`)) return true;
    if (path.startsWith('platform/')) return true;
    return Boolean(this.options.allowSandbox) && path.startsWith('sandbox/');
  }

  private async audit(request: LeaseRequest, event: VaultAuditEvent['event'], reason?: string): Promise<boolean> {
    try {
      await this.options.audit({
        event, reference: request.reference, tenantId: request.tenantId, connectionId: request.connectionId,
        purpose: request.purpose, ...(reason ? { reason } : {}), at: this.now().toISOString(),
      });
      return true;
    } catch {
      return false;
    }
  }

  private async refuse(request: LeaseRequest, reason: RefusalReason): Promise<LeaseResult> {
    // If even the refusal cannot be recorded, say so; the caller still gets no lease.
    const recorded = await this.audit(request, 'credential.refused', reason);
    return { ok: false, reason: recorded ? reason : 'audit_unavailable' };
  }

  async lease(request: LeaseRequest): Promise<LeaseResult> {
    const ttl = request.ttlMs ?? this.defaultTtl;
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > this.maxTtl) return this.refuse(request, 'ttl_invalid');
    const parsed = parseReference(request.reference);
    if (!parsed) return this.refuse(request, 'malformed_reference');
    if (!this.schemes.includes(parsed.scheme)) return this.refuse(request, 'scheme_not_allowed');
    if (!this.inNamespace(parsed.path, request.tenantId)) return this.refuse(request, 'wrong_tenant');

    const material = await this.options.backend.read(parsed.scheme, parsed.path);
    if (!material) return this.refuse(request, 'not_found');

    if (!(await this.audit(request, 'credential.leased'))) return { ok: false, reason: 'audit_unavailable' };
    const lease = new CredentialLease(request.reference, request.connectionId, material.version,
      new Date(this.now().getTime() + ttl), material.value, this.now);
    return { ok: true, lease };
  }
}

export type RotationStatus = 'ok' | 'due' | 'overdue';

/** `due` inside the last tenth of the allowed age; `overdue` past it. */
export function rotationStatus(rotatedAt: Date, maxAgeDays: number, now: Date): RotationStatus {
  const ageDays = (now.getTime() - rotatedAt.getTime()) / 86_400_000;
  if (ageDays >= maxAgeDays) return 'overdue';
  return ageDays >= maxAgeDays * 0.9 ? 'due' : 'ok';
}

/** A backend over a map, for tests and the sandbox. Never a real store. */
export function memoryBackend(entries: Record<string, SecretMaterial>): SecretBackend & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    async read(scheme, path) {
      reads.push(`${scheme}:${path}`);
      return entries[`${scheme}:${path}`] ?? null;
    },
  };
}
