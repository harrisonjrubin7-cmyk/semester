/**
 * Alumni relations and fundraising records, typed, over the account service.
 *
 * `supabase/migrations/20261001100000_advancement.sql` is the authority: a
 * graduate opts in (only after a conferral), a gift officer records gifts and
 * pledges against the school's own receipt wording, a refund is a second
 * person's act, and all of it only while the school runs `advancement` in Core
 * (`lib/modulemode.ts`). There is no payment processor, no wealth screening and
 * no donor score; this file asks.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import { formatNumber } from '../locale';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

const onSchool = (grants: readonly Grant[], school: string, cap: string): boolean =>
  school !== '' && grants.some((g) => g.capability === cap && g.scopeKind === 'school' && g.scopeId === school);

/** Whether this person may see donor records at this school (a director sees all, an officer their assigned donors). */
export const canSeeDonors = (grants: readonly Grant[], school: string): boolean => ['adv:read', 'adv:gift', 'adv:configure'].some((c) => onSchool(grants, school, c));
export const canRecordGifts = (grants: readonly Grant[], school: string): boolean => onSchool(grants, school, 'adv:gift');
export const canRefundGifts = (grants: readonly Grant[], school: string): boolean => onSchool(grants, school, 'adv:refund');
export const canConfigureAdvancement = (grants: readonly Grant[], school: string): boolean => onSchool(grants, school, 'adv:configure');

export const dollars = (cents: number): string => `$${formatNumber(cents / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Dollars typed by a person into whole cents, or null when it is not an amount. */
export function toCents(input: string): number | null {
  const m = /^\s*\$?\s*(\d{1,9})(?:\.(\d{1,2}))?\s*$/.exec(input.replace(/,/g, ''));
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return cents > 0 ? cents : null;
}

export interface AlumniProfile { displayName: string; classYear: number; directory: boolean; solicitable: boolean; optedOut: boolean }

/** The caller's own alumni profile, or null if they have not opted in. */
export async function loadMyProfile(me: string, school: string): Promise<AlumniProfile | null> {
  const db = await cloud();
  const { data, error } = await db.from('alumni_profiles').select('display_name,class_year,directory_visible,solicitable,opted_out_at').eq('tenant_id', school).eq('user_id', me).limit(1);
  if (error) throw serviceError(error, 'Your alumni profile could not be read.');
  const r = rows(data)[0];
  if (!r) return null;
  return { displayName: text(r.display_name), classYear: Number(r.class_year) || 0, directory: r.directory_visible === true, solicitable: r.solicitable === true, optedOut: r.opted_out_at != null };
}

export interface Donor { id: string; kind: string; name: string; email: string; contactOk: boolean }
export interface Fund { id: string; code: string; name: string; designation: string }
export interface Campaign { id: string; name: string; kind: string; goalCents: number; startsOn: string; endsOn: string; raisedCents: number; gifts: number }
export interface GiftRow { id: string; donorId: string; amountCents: number; receivedOn: string; method: string; reference: string; receipt: string; refunded: boolean }
export interface Desk { donors: Donor[]; funds: Fund[]; campaigns: Campaign[]; gifts: GiftRow[]; hasWording: boolean }

export async function loadDesk(school: string): Promise<Desk> {
  const db = await cloud();
  const [d, f, c, g, s] = await Promise.all([
    db.from('advancement_donors').select('id,kind,display_name,email,contact_ok').eq('tenant_id', school).order('display_name', { ascending: true }),
    db.from('advancement_funds').select('id,code,name,designation').eq('tenant_id', school).order('code', { ascending: true }),
    db.from('advancement_campaigns').select('id,name,kind,goal_cents,starts_on,ends_on').eq('tenant_id', school).order('starts_on', { ascending: false }),
    db.from('advancement_gifts').select('id,donor_id,amount_cents,received_on,method,reference').eq('tenant_id', school).order('received_on', { ascending: false }).limit(100),
    db.from('advancement_settings').select('version').eq('tenant_id', school).order('version', { ascending: false }).limit(1),
  ]);
  for (const x of [d, f, c, g, s]) if (x.error) throw serviceError(x.error, 'The fundraising records could not be read.');
  const gift = rows(g.data);
  const ids = gift.map((r) => text(r.id));
  const [rc, rf] = ids.length === 0 ? [{ data: [], error: null }, { data: [], error: null }] : await Promise.all([
    db.from('advancement_receipts').select('gift_id,number').in('gift_id', ids),
    db.from('advancement_refunds').select('gift_id').in('gift_id', ids),
  ]);
  for (const x of [rc, rf]) if (x.error) throw serviceError(x.error, 'The fundraising records could not be read.');
  const receipt = new Map(rows(rc.data).map((r) => [text(r.gift_id), text(r.number)]));
  const refunded = new Set(rows(rf.data).map((r) => text(r.gift_id)));
  const campaigns: Campaign[] = await Promise.all(rows(c.data).map(async (r) => {
    const { data: p } = await db.rpc('adv_campaign_progress', { want_campaign: text(r.id) });
    const k = (p ?? {}) as Row;
    return { id: text(r.id), name: text(r.name), kind: text(r.kind), goalCents: Number(r.goal_cents) || 0, startsOn: text(r.starts_on), endsOn: text(r.ends_on), raisedCents: Number(k.raised_cents) || 0, gifts: Number(k.gifts) || 0 };
  }));
  return {
    donors: rows(d.data).map((r) => ({ id: text(r.id), kind: text(r.kind), name: text(r.display_name), email: text(r.email), contactOk: r.contact_ok === true })),
    funds: rows(f.data).map((r) => ({ id: text(r.id), code: text(r.code), name: text(r.name), designation: text(r.designation) })),
    campaigns,
    gifts: gift.map((r) => ({ id: text(r.id), donorId: text(r.donor_id), amountCents: Number(r.amount_cents) || 0, receivedOn: text(r.received_on), method: text(r.method), reference: text(r.reference), receipt: receipt.get(text(r.id)) ?? '', refunded: refunded.has(text(r.id)) })),
    hasWording: rows(s.data).length > 0,
  };
}

/** Progress toward a goal as a whole percentage, never above 100 and never invented for a zero goal. */
export const percentOf = (raised: number, goal: number): number => (goal > 0 ? Math.min(100, Math.floor((raised * 100) / goal)) : 0);

// ── The writers ──────────────────────────────────────────────────────────

async function call(name: string, args: Record<string, unknown>, fallback: string): Promise<Row> {
  const db = await cloud();
  const { data, error } = await db.rpc(name, args);
  if (error) throw serviceError(error, fallback);
  return (data ?? {}) as Row;
}

export const optIn = (name: string, classYear: number, key: string) => call('alumni_opt_in', { want_display_name: name, want_class_year: classYear, want_key: key }, 'You were not added to the alumni community.');
export const setPreferences = (p: { directory: boolean; solicitable: boolean; optOut: boolean }, key: string) =>
  call('alumni_preferences', { want_directory: p.directory, want_solicitable: p.solicitable, want_opt_out: p.optOut, want_key: key }, 'Your preferences were not saved.');
export const saveSettings = (legalName: string, statement: string, goods: string, key: string) =>
  call('adv_settings_set', { want_legal_name: legalName, want_statement: statement, want_goods_note: goods, want_key: key }, 'The receipt wording was not saved.');
export const saveFund = (code: string, name: string, designation: string, key: string) =>
  call('adv_fund_save', { want_code: code, want_name: name, want_designation: designation, want_key: key }, 'The fund was not saved.');
export const saveDonor = (kind: string, name: string, email: string, key: string) =>
  call('adv_donor_save', { want_kind: kind, want_name: name, want_email: email, want_profile: null, want_key: key }, 'The donor was not saved.');
export interface NewGift { donor: string; fund: string; campaign: string | null; cents: number; received: string; method: string; reference: string; tribute: string }
export const recordGift = (g: NewGift, key: string) =>
  call('adv_gift_record', {
    want_donor: g.donor, want_fund: g.fund, want_campaign: g.campaign, want_pledge: null, want_amount_cents: g.cents, want_received: g.received,
    want_method: g.method, want_reference: g.reference, want_tribute: g.tribute, want_key: key,
  }, 'The gift was not recorded.');
export const refundGift = (gift: string, reason: string, reference: string, key: string) =>
  call('adv_gift_refund', { want_gift: gift, want_reason: reason, want_reference: reference, want_key: key }, 'The refund was not recorded.');
export const addNote = (donor: string, kind: string, note: string, key: string) =>
  call('adv_note_add', { want_donor: donor, want_kind: kind, want_note: note, want_key: key }, 'The note was not saved.');
