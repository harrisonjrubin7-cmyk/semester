// Generated from app/src/lib/integration/adapter.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * What every provider adapter must declare before the gateway will run it.
 *
 * A declaration is data, checked by `validateDeclaration`, so the dashboard
 * can show it, a contract test can hold a real adapter to it, and nothing
 * about a provider lives inside a student feature module. The adapter's code
 * only fetches and parses; mapping, classification, consent, idempotency and
 * provenance are the pipeline's (`pipeline.ts`), identically for every
 * provider.
 */
import type { DataClass } from './classification.ts';
import { withinCeiling } from './classification.ts';
import {
  CANONICAL_ENTITIES, DOMAIN_CEILING, NEVER_DISPLAY, NEVER_INGEST,
  type CanonicalEntity, type ProviderDomain, type SyncDirection, type SyncMode,
} from './catalog.ts';

export type FieldType = 'string' | 'number' | 'boolean' | 'datetime' | 'enum' | 'url';
export type Transform = 'none' | 'trim' | 'lower' | 'iso_datetime';

export interface FieldMapping {
  external: string;
  canonical: string;
  type: FieldType;
  required: boolean;
  enumValues?: readonly string[];
  transform?: Transform;
}

export interface EntityMapping {
  externalEntity: string;
  canonicalEntity: CanonicalEntity;
  version: number;
  /** The provider scope this entity needs approved. */
  scope: string;
  classification: DataClass;
  /** Records about one person carry a subject; tenant-wide ones do not. */
  personal: boolean;
  fields: readonly FieldMapping[];
}

export interface AdapterDeclaration {
  id: string;
  domain: ProviderDomain;
  provider: string;
  product: string;
  version: string;
  authentication: 'oauth2' | 'lti_1_3' | 'saml' | 'oidc' | 'scim' | 'api_key' | 'sftp' | 'mtls' | 'none';
  /** A pointer the worker resolves from the secret manager. Never a secret. */
  credentialsReference: string | null;
  scopes: readonly string[];
  classificationCeiling: DataClass;
  direction: SyncDirection;
  modes: readonly SyncMode[];
  cursor: 'watermark' | 'version_token' | 'page_token' | 'none';
  freshnessTargetMinutes: number;
  rateLimitPerMinute: number;
  retry: { maxAttempts: number; baseMs: number; maxMs: number };
  deadLetter: 'queue' | 'table';
  sourceOfTruth: string;
  consentRequired: boolean;
  retentionDays: number;
  degradedStates: readonly string[];
  disconnect: 'revoke_token' | 'delete_mapping' | 'provider_portal';
  auditEvents: readonly string[];
  featureFlag: string;
  killSwitch: string;
  contractTests: readonly string[];
  entities: readonly EntityMapping[];
  /** True for fixtures. A mock can never be registered as a live adapter. */
  mock: boolean;
}

const NEVER = new RegExp(`(^|[._])(${NEVER_INGEST.join('|')})([._]|$)`);
const NEVER_SHOWN = new RegExp(`(^|_)(${[...NEVER_INGEST, ...NEVER_DISPLAY].join('|')})(_|$)`);

export function namesNeverIngest(name: string): boolean {
  return NEVER.test(name.toLowerCase());
}

/** Whether a canonical field name is one the database will refuse to store. */
export function namesNeverDisplayed(name: string): boolean {
  return NEVER_SHOWN.test(name.toLowerCase());
}

/** Everything wrong with a declaration; empty means it may be registered. */
export function validateDeclaration(d: AdapterDeclaration): string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(d.id)) errors.push('id must be a lowercase slug');
  if (d.credentialsReference !== null
      && !/^(vault|env|secret-manager):[A-Za-z0-9_./-]{1,200}$/.test(d.credentialsReference)) {
    errors.push('credentialsReference must be a secret-manager pointer, not a secret');
  }
  if (!withinCeiling(d.classificationCeiling, DOMAIN_CEILING[d.domain])) {
    errors.push(`classificationCeiling ${d.classificationCeiling} is above what ${d.domain} may be approved for`);
  }
  if (d.direction !== 'read' && !d.featureFlag.startsWith('writeback.')) {
    errors.push('a write direction must sit behind a writeback.* flag');
  }
  if (!d.featureFlag) errors.push('a feature flag is required');
  if (!d.killSwitch.startsWith('kill.')) errors.push('a kill switch is required');
  if (d.contractTests.length === 0) errors.push('at least one contract test is required');
  if (d.modes.length === 0) errors.push('at least one sync mode is required');
  if (d.freshnessTargetMinutes <= 0) errors.push('freshness target must be positive');
  if (d.rateLimitPerMinute <= 0) errors.push('a rate limit is required');
  if (!Number.isFinite(d.retentionDays) || d.retentionDays <= 0 || d.retentionDays > 36500) errors.push('retention must be a finite positive duration of at most 100 years');
  if (!Number.isFinite(d.freshnessTargetMinutes) || d.freshnessTargetMinutes > 525600) errors.push('freshness must be finite and at most one year');
  if (!d.sourceOfTruth.trim()) errors.push('a source owner is required');
  for (const s of d.scopes) {
    if (!/^scope\.[a-z_]+\.[a-z0-9_]+$/.test(s)) errors.push(`scope ${s} is not scope.<domain>.<name>`);
    if (namesNeverIngest(s.replace(/^scope\.[a-z_]+\./, ''))) errors.push(`scope ${s} names something never ingested`);
  }
  for (const e of d.entities) {
    if (!CANONICAL_ENTITIES.includes(e.canonicalEntity)) errors.push(`${e.externalEntity}: unknown canonical entity`);
    if (!d.scopes.includes(e.scope)) errors.push(`${e.externalEntity}: scope ${e.scope} is not declared`);
    if (!withinCeiling(e.classification, d.classificationCeiling)) {
      errors.push(`${e.externalEntity}: ${e.classification} is above the adapter ceiling`);
    }
    if (e.classification === 'T3' && !e.personal) errors.push(`${e.externalEntity}: an education record must be personal`);
    for (const f of e.fields) {
      if (f.canonical === '_governance') errors.push(`${e.externalEntity}: _governance is reserved for server metadata`);
      if (namesNeverIngest(f.external) || namesNeverIngest(f.canonical)) {
        errors.push(`${e.externalEntity}.${f.external}: never ingested`);
      } else if (namesNeverDisplayed(f.canonical)) {
        errors.push(`${e.externalEntity}.${f.canonical}: never stored as a canonical field`);
      }
      if (f.type === 'enum' && !(f.enumValues && f.enumValues.length > 0)) {
        errors.push(`${e.externalEntity}.${f.external}: an enum needs its values`);
      }
    }
  }
  return errors;
}
