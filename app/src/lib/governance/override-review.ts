import type { SupabaseClient } from '@supabase/supabase-js';
import { cloud } from '../cloud';

/** The view is aggregate-only; never widen this projection to the case log. */
export const OVERRIDE_PATTERN_COLUMNS =
  'tenant_id, domain, rule_ref, overrides, people, first_at, last_at, last_90_days, recurring';
export const MAX_OVERRIDE_PATTERNS = 200;

export const OVERRIDE_DOMAINS = [
  'academic_record',
  'moderation',
  'credential',
  'notification',
  'permission',
  'integration',
  'migration',
  'ai_output',
] as const;
export type OverrideDomain = (typeof OVERRIDE_DOMAINS)[number];

/** Exact columns exposed by public.override_patterns. */
export interface OverridePatternDatabaseRow {
  tenant_id: string;
  domain: string;
  rule_ref: string;
  overrides: number;
  people: number;
  first_at: string;
  last_at: string;
  last_90_days: number;
  recurring: boolean;
}

/** Safe display shape: tenant and case-level identifiers deliberately do not cross this boundary. */
export interface OverridePattern {
  domain: OverrideDomain;
  ruleRef: string;
  overrides: number;
  people: number;
  firstAt: number | null;
  lastAt: number | null;
  last90Days: number;
  recurring: boolean;
}

interface OverridePatternSelection {
  data: unknown;
  error: { message: string } | null;
}

type SelectRows = (tenantId: string) => Promise<OverridePatternSelection>;

const RULE_REF = /^[a-z0-9_.:-]{1,80}$/;
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-](\d{2}):(\d{2}))$/;

const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysInMonth = (year: number, month: number) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;

/** PostgreSQL timestamptz output, without Date.parse's calendar normalization. */
export function strictTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const match = RFC3339.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, , zone, zh, zm] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  if (zone !== 'Z' && (Number(zh) > 23 || Number(zm) > 59)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const count = (value: unknown, minimum = 0): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum ? value : null;

const domain = (value: unknown): OverrideDomain | null =>
  typeof value === 'string' && OVERRIDE_DOMAINS.includes(value as OverrideDomain)
    ? value as OverrideDomain
    : null;

export function readOverridePattern(row: unknown, tenantId: string): OverridePattern | null {
  if (!row || typeof row !== 'object') return null;
  const value = row as Partial<OverridePatternDatabaseRow>;
  if (value.tenant_id !== tenantId) return null;
  const safeDomain = domain(value.domain);
  if (!safeDomain || typeof value.rule_ref !== 'string' || !RULE_REF.test(value.rule_ref)) return null;
  const overrides = count(value.overrides, 1);
  const people = count(value.people);
  const last90Days = count(value.last_90_days);
  if (overrides === null || people === null || last90Days === null) return null;
  if (people > overrides || last90Days > overrides || value.recurring !== (last90Days >= 3)) return null;

  let firstAt = strictTimestamp(value.first_at);
  let lastAt = strictTimestamp(value.last_at);
  if (firstAt !== null && lastAt !== null && firstAt > lastAt) {
    firstAt = null;
    lastAt = null;
  }
  return {
    domain: safeDomain,
    ruleRef: value.rule_ref,
    overrides,
    people,
    firstAt,
    lastAt,
    last90Days,
    recurring: value.recurring,
  };
}

export function readOverridePatterns(rows: unknown, tenantId: string): OverridePattern[] {
  if (!Array.isArray(rows)) return [];
  const safe: OverridePattern[] = [];
  for (const row of rows) {
    const parsed = readOverridePattern(row, tenantId);
    if (parsed) safe.push(parsed);
    if (safe.length === MAX_OVERRIDE_PATTERNS) break;
  }
  return safe;
}

export async function selectOverridePatternRows(
  tenantId: string,
  getClient: () => Promise<SupabaseClient> = cloud,
): Promise<OverridePatternSelection> {
  const db = await getClient();
  return db
    .from('override_patterns')
    .select(OVERRIDE_PATTERN_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('last_at', { ascending: false })
    .limit(MAX_OVERRIDE_PATTERNS);
}

export async function loadOverridePatterns(
  tenantId: string,
  selectRows: SelectRows = selectOverridePatternRows,
): Promise<OverridePattern[]> {
  const { data, error } = await selectRows(tenantId);
  if (error) throw new Error('Override patterns could not be loaded.');
  return readOverridePatterns(data, tenantId);
}
