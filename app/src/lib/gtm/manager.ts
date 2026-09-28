/**
 * The campaign manager's reads and writes, against the tables in
 * `supabase/migrations/20260928090000_gtm_foundation.sql`.
 *
 * Every call runs as the signed-in staff member, under RLS: a manager sees and
 * writes their school's campaigns, a reviewer records reviews, an analyst
 * reads suppressed counts, and anybody else gets nothing back. Nothing here
 * decides whether a move is allowed — the database's triggers do, and this
 * turns their refusal into a sentence. So the screen can never offer a move
 * the server would take and then quietly not make.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { FUNNEL_STAGES, canMove, type AudienceCriterion, type CampaignStatus, type FunnelStage, type ReviewKind } from './campaign';

export type CampaignChannel = 'email' | 'sms' | 'push' | 'tiktok' | 'instagram' | 'webinar' | 'alumni' | 'other';

export const CHANNELS: readonly CampaignChannel[] = ['email', 'sms', 'push', 'tiktok', 'instagram', 'webinar', 'alumni', 'other'];

/** One row of `gtm_campaigns`, as the database names it. */
export interface CampaignRow {
  id: string;
  tenant_id: string;
  public_id: string;
  name: string;
  objective: string;
  cycle: string;
  audience: string;
  funnel_stage: FunnelStage;
  audience_criteria: AudienceCriterion[];
  channels: CampaignChannel[];
  start_date: string;
  end_date: string;
  review_date: string | null;
  primary_cta: string;
  owner_id: string;
  approver_id: string | null;
  privacy_basis: string;
  consent_requirements: string[];
  frequency_max: number | null;
  frequency_window_days: number | null;
  quiet_start: number;
  quiet_end: number;
  landing_page: string | null;
  success_metric: string;
  baseline: string | null;
  escalation_path: string;
  claims_substantiated: boolean;
  opt_out_tested: boolean;
  conversion_instrumentation_tested: boolean;
  status: CampaignStatus;
  updated_at: string;
}

/** The columns a draft may change. Status moves go through `move`, never here. */
export type DraftPatch = Partial<
  Omit<CampaignRow, 'id' | 'tenant_id' | 'public_id' | 'owner_id' | 'status' | 'updated_at'>
>;

export interface ReviewRow {
  id: string;
  kind: ReviewKind;
  reviewer_id: string;
  decision: 'approved' | 'changes_requested';
  note: string;
  recorded_at: string;
}

export interface ReportRow {
  metric: string;
  /** Null when fewer than ten: the database suppresses it. */
  value: number | null;
}

export interface NewCampaign {
  tenantId: string;
  name: string;
  objective: string;
  cycle: string;
  audience: string;
  funnelStage: FunnelStage;
  channels: CampaignChannel[];
  startDate: string;
  endDate: string;
}

/** What each move is called on a button. */
export const MOVE_LABEL: Partial<Record<CampaignStatus, string>> = {
  in_review: 'Send for review',
  draft: 'Return to draft',
  approved: 'Approve',
  active: 'Activate',
  paused: 'Pause',
  completed: 'Mark complete',
  retired: 'Retire',
};

const STATUSES: readonly CampaignStatus[] = ['draft', 'in_review', 'approved', 'active', 'paused', 'completed', 'retired'];

/**
 * The moves the database accepts from each status. Derived from `canMove`
 * (which `schema.test.ts` holds to the migration's guard) plus the one move
 * `canMove` leaves to `activationGate`, so there is no third copy to drift.
 */
export const NEXT: Record<CampaignStatus, readonly CampaignStatus[]> = Object.fromEntries(
  STATUSES.map((from) => [from, STATUSES.filter((to) => canMove(from, to) || (from === 'approved' && to === 'active'))]),
) as unknown as Record<CampaignStatus, readonly CampaignStatus[]>;

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  retired: 'Retired',
};

const REVIEW_LABEL: Record<ReviewKind, string> = { privacy: 'Privacy', accessibility: 'Accessibility', brand: 'Brand' };

/**
 * `gtm_activation_failures` returns codes; this is what a manager reads. Each
 * sentence says what to do, not only what is wrong.
 */
export function failureText(code: string): string {
  if (code.startsWith('status:')) {
    const s = code.slice('status:'.length) as CampaignStatus;
    return `It is ${STATUS_LABEL[s]?.toLowerCase() ?? s}. A campaign activates from approved or paused.`;
  }
  if (code.startsWith('review:')) {
    const kinds = code.slice('review:'.length).split(',').filter(Boolean) as ReviewKind[];
    return `Still needs ${kinds.map((k) => REVIEW_LABEL[k] ?? k).join(', ').toLowerCase()} review, by someone other than the owner, since the last edit.`;
  }
  const text: Record<string, string> = {
    flag: 'The campaign module is not on for your school in production. Your school’s configurer turns it on.',
    kill_switch: 'Sharing is switched off for your school (kill.sharing). Nothing can go out until it is released.',
    approver: 'Name an approver who is not the campaign’s owner.',
    owner: 'Its owner’s account was deleted, so no one owns it. Start a new draft from it to take it over.',
    privacy_basis: 'Say what makes contacting this audience lawful and expected (the privacy basis).',
    primary_cta: 'Give the one action this campaign asks for.',
    success_metric: 'Name the metric this campaign will be judged on.',
    escalation_path: 'Say who to contact if something goes wrong.',
    consent_requirements: 'List the consent versions a recipient must have given.',
    frequency_cap: 'Set a frequency cap: how many messages, over how many days.',
    landing_page: 'Add a landing page with the standard attribution link.',
    review_date: 'Set a review date on or after the end date.',
    claims_substantiated: 'Confirm every claim in the campaign can be substantiated.',
    opt_out_tested: 'Test the opt-out and confirm it.',
    conversion_instrumentation_tested: 'Test the conversion tracking and confirm it.',
    not_found: 'This campaign is not visible to your account.',
  };
  return text[code] ?? code;
}

/** A database refusal, as the sentence its trigger raised; anything else, as a plain failure. */
function refusal(error: { message?: string } | null, fallback: string): Error {
  const m = error?.message ?? '';
  if (/row-level security|permission denied/i.test(m)) return new Error('Your account cannot do that at this school.');
  return new Error(m.replace(/^This campaign cannot activate: /, 'Cannot activate yet: ') || fallback);
}

/**
 * Whether an account holding these verified capabilities at a school should
 * see the Campaigns tab at all: any of manage, review or report. RLS decides
 * what it then sees; this only keeps the tab away from everyone else.
 */
export function campaignsAllowed(verified: readonly string[]): boolean {
  return verified.some((c) => c === 'campaign:manage' || c === 'campaign:review' || c === 'campaign:report');
}

export function stageLabel(stage: FunnelStage): string {
  return `${stage}. ${FUNNEL_STAGES[stage].stage}`;
}

export interface CampaignApi {
  list(): Promise<CampaignRow[]>;
  create(input: NewCampaign): Promise<string>;
  save(id: string, patch: DraftPatch): Promise<void>;
  move(id: string, to: CampaignStatus): Promise<void>;
  failures(id: string): Promise<string[]>;
  audienceCount(id: string): Promise<number | null>;
  reviews(id: string): Promise<ReviewRow[]>;
  review(row: CampaignRow, kind: ReviewKind, decision: ReviewRow['decision'], note: string): Promise<void>;
  report(id: string): Promise<ReportRow[]>;
}

export function campaignApi(db: SupabaseClient): CampaignApi {
  return {
    async list() {
      const { data, error } = await db.from('gtm_campaigns').select('*').order('updated_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load campaigns.');
      return (data ?? []) as CampaignRow[];
    },
    async create(c) {
      const { data, error } = await db
        .from('gtm_campaigns')
        .insert({
          tenant_id: c.tenantId, name: c.name, objective: c.objective, cycle: c.cycle, audience: c.audience,
          funnel_stage: c.funnelStage, channels: c.channels, start_date: c.startDate, end_date: c.endDate,
        })
        .select('id')
        .single();
      if (error) throw refusal(error, 'Could not create the campaign.');
      return (data as { id: string }).id;
    },
    async save(id, patch) {
      const { error } = await db.from('gtm_campaigns').update(patch).eq('id', id);
      if (error) throw refusal(error, 'Could not save.');
    },
    async move(id, to) {
      const { data, error } = await db.from('gtm_campaigns').update({ status: to }).eq('id', id).select('id');
      if (error) throw refusal(error, 'Could not move the campaign.');
      if (!data || data.length === 0) throw new Error('Your account cannot move this campaign.');
    },
    async failures(id) {
      const { data, error } = await db.rpc('gtm_activation_failures', { want_campaign: id });
      if (error) throw refusal(error, 'Could not check the release gate.');
      return (data ?? []) as string[];
    },
    async audienceCount(id) {
      const { data, error } = await db.rpc('gtm_audience_count', { want_campaign: id });
      if (error) return null;
      return typeof data === 'number' ? data : Number(data);
    },
    async reviews(id) {
      const { data, error } = await db
        .from('gtm_campaign_reviews')
        .select('id, kind, reviewer_id, decision, note, recorded_at')
        .eq('campaign_id', id)
        .order('recorded_at', { ascending: false });
      if (error) throw refusal(error, 'Could not load reviews.');
      return (data ?? []) as ReviewRow[];
    },
    async review(row, kind, decision, note) {
      const { error } = await db
        .from('gtm_campaign_reviews')
        .insert({ tenant_id: row.tenant_id, campaign_id: row.id, kind, decision, note });
      if (error) throw refusal(error, 'Could not record the review.');
    },
    async report(id) {
      const { data, error } = await db.rpc('gtm_campaign_report', { want_campaign: id });
      if (error) throw refusal(error, 'Could not load results.');
      return (data ?? []) as ReportRow[];
    },
  };
}
