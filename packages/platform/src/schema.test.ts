/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TENANT_STATUSES, DATA_ZONES, ORG_KINDS } from './tenancy/organization.ts';
import { AFFILIATION_KINDS, AFFILIATION_SOURCES, AFFILIATION_STATUSES } from './identity/affiliation.ts';
import { RELATIONSHIP_KINDS, RELATIONSHIP_VERIFICATIONS } from './identity/relationship.ts';
import { CONSENT_EVIDENCE, CONSENT_PURPOSES } from './identity/consent.ts';
import { AUDIT_DECISIONS, GENESIS_HASH } from './identity/audit.ts';
import { APPROVAL_STATES } from './identity/approval.ts';
import { FILE_STATES } from './engines/files.ts';
import { FLAG_KINDS } from './engines/flags.ts';
import { CONNECTION_STATES } from './engines/integration.ts';
import { POLICY_ENVIRONMENTS, RESOURCE_CLASSIFICATIONS } from './seam/institution.ts';
import { ID_PATTERN } from './tenancy/organization.ts';
import { IDEMPOTENCY_KEY_PATTERN } from './gateway/headers.ts';

/**
 * The schema contract and the TypeScript it mirrors must say the same thing.
 *
 * `docs/platform/schema/platform_primitives.sql` is a *proposed* contract (it
 * has not run against PostgreSQL — its header says so). Until it becomes
 * migrations, this test is what stops it rotting: every enumeration the
 * database would constrain is compared with the constant the code uses, and
 * the structural promises of the isolation design — a tenant-bearing
 * composite key, enabled-and-forced RLS, a policy per verb — are checked
 * table by table. The same technique `events.test.ts` uses for the outbox.
 */

const ROOT = resolve(import.meta.dirname, '../../..');
const SQL = readFileSync(join(ROOT, 'docs/platform/schema/platform_primitives.sql'), 'utf8');

const tableBlock = (name: string): string => {
  const m = new RegExp(`create table platform\\.${name} \\(([\\s\\S]*?)\\n\\);`).exec(SQL);
  if (!m) throw new Error(`no table platform.${name} in the contract`);
  return m[1];
};

const listIn = (name: string, column: string): string[] => {
  const m = new RegExp(`\\b${column}\\s+text[^,\\n]*?check \\(${column} in \\(([^)]+)\\)\\)`).exec(tableBlock(name));
  if (!m) throw new Error(`no enumeration for ${name}.${column}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

const same = (a: readonly string[], b: readonly string[]) => expect([...a].sort()).toEqual([...b].sort());

describe('schema contract mirrors the code', () => {
  it.each([
    ['tenant', 'status', TENANT_STATUSES],
    ['tenant', 'data_zone', DATA_ZONES],
    ['tenant', 'environment', POLICY_ENVIRONMENTS],
    ['org_node', 'kind', ORG_KINDS],
    ['affiliation', 'kind', AFFILIATION_KINDS],
    ['affiliation', 'status', AFFILIATION_STATUSES],
    ['affiliation', 'source', AFFILIATION_SOURCES],
    ['relationship', 'kind', RELATIONSHIP_KINDS],
    ['relationship', 'verification', RELATIONSHIP_VERIFICATIONS],
    ['consent', 'purpose', CONSENT_PURPOSES],
    ['consent', 'evidence', CONSENT_EVIDENCE],
    ['audit_event', 'decision', AUDIT_DECISIONS],
    ['approval_request', 'state', APPROVAL_STATES],
    ['file_object', 'classification', RESOURCE_CLASSIFICATIONS],
    ['file_object', 'state', FILE_STATES],
    ['feature_flag', 'kind', FLAG_KINDS],
    ['connection', 'state', CONNECTION_STATES],
  ] as const)('%s.%s', (table, column, expected) => {
    same(listIn(table, column), expected);
  });

  it('the genesis hash, id alphabet and idempotency-key shape are the same in SQL and TypeScript', () => {
    expect(SQL).toContain(`repeat('0', 64)`);
    expect(GENESIS_HASH).toBe('0'.repeat(64));
    expect(SQL).toContain(ID_PATTERN.source.replace(/\\\//g, '/'));
    expect(SQL).toContain(IDEMPOTENCY_KEY_PATTERN.source.replace(/^\^/, '^').replace('{16,128}$', '{16,128}$'));
  });
});

describe('schema contract: the isolation promises, table by table', () => {
  const tables = [...SQL.matchAll(/create table platform\.(\w+) \(/g)].map((m) => m[1]);
  const GLOBAL = ['tenant', 'feature_flag'];
  const tenantOwned = tables.filter((t) => !GLOBAL.includes(t));

  it('finds the tables (control: a regex that matches nothing would pass everything below)', () => {
    expect(tables.length).toBeGreaterThanOrEqual(12);
    expect(tenantOwned).toContain('audit_event');
  });

  it('every tenant-owned table carries tenant_id, not null, and leads its primary key with it', () => {
    for (const t of tenantOwned) {
      const b = tableBlock(t);
      expect(b, t).toMatch(/\btenant_id\s+platform\.id not null/);
      expect(b, t).toMatch(/primary key \(tenant_id,/);
    }
  });

  it('every tenant-owned table is in the RLS loop, which enables, forces and writes a policy per verb', () => {
    const loop = /foreach t in array array\[([\s\S]*?)\] loop([\s\S]*?)end loop;/.exec(SQL);
    expect(loop).not.toBeNull();
    const listed = [...loop![1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
    same(listed, tenantOwned);
    for (const verb of ['enable row level security', 'force row level security', 'for select', 'for insert', 'for update', 'for delete']) expect(loop![2]).toContain(verb);
    expect(loop![2]).toContain('app.tenant_id()');
  });

  it('write policies carry WITH CHECK, so a row cannot be inserted or moved into another tenant', () => {
    const loop = /foreach t in array[\s\S]*?end loop;/.exec(SQL)![0];
    expect(loop).toMatch(/for insert with check \(tenant_id = app\.tenant_id\(\)\)/);
    expect(loop).toMatch(/for update using \(tenant_id = app\.tenant_id\(\)\) with check \(tenant_id = app\.tenant_id\(\)\)/);
  });

  it('a child names its parent by (tenant_id, id), so a parent in another tenant cannot be referenced', () => {
    expect(tableBlock('org_node')).toContain('foreign key (tenant_id, parent_id) references platform.org_node (tenant_id, id)');
    expect(tableBlock('affiliation')).toContain('foreign key (tenant_id, node_id) references platform.org_node (tenant_id, id)');
    expect(tableBlock('inbox_message')).toContain('foreign key (tenant_id, connection_id) references platform.connection (tenant_id, id)');
  });

  it('the request-context helpers fail closed when the context is missing', () => {
    expect(SQL).toMatch(/function app\.tenant_id\(\)[\s\S]*?raise exception 'no tenant in request context'/);
    expect(SQL).toMatch(/function app\.person_id\(\)[\s\S]*?raise exception 'no person in request context'/);
    expect(SQL).toContain("set_config('app.tenant_id', p_tenant_id, true)"); // transaction-local: a pooled connection cannot leak it
  });

  it('the audit log is append-only and chained in the database as far as the database can see', () => {
    expect(SQL).toContain('audit_event is append-only');
    expect(SQL).toContain('audit chain broken');
    expect(SQL).toMatch(/before update or delete on platform\.audit_event/);
    expect(SQL).toMatch(/before truncate on platform\.audit_event/);
  });

  it('a tenant-gated flag defaults off and an object key must start with its own tenant — both enforced by a constraint', () => {
    expect(tableBlock('feature_flag')).toContain("check (kind <> 'tenant_gated' or default_value = false)");
    expect(tableBlock('file_object')).toContain("starts_with(object_key, 't/' || tenant_id || '/' || classification || '/')");
  });

  it('a credential reference is a reference — secret:// — never a secret', () => {
    expect(tableBlock('connection')).toContain("credential_ref ~ '^secret://'");
  });

  it('says plainly that it is a proposal that has not run, and is not under supabase/migrations', () => {
    expect(SQL.slice(0, 400)).toContain('PROPOSED CONTRACT. NOT A MIGRATION. NOT APPLIED. NOT RUN AGAINST POSTGRES.');
  });
});
