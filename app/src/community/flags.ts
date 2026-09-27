/**
 * Switches for Community, and which of them a preview build may turn on.
 *
 * Community is new ground for Semester, and parts of it are dangerous if they
 * ship before the people and processes behind them exist: a volunteer queue
 * with no calibration, an escalation path to a university with no second
 * approver, an alias system with no preservation hold. So the flags come in two
 * kinds.
 *
 * - **Foundation flags** (the feed, reporting, the professional console)
 *   follow the rest of the app: a preview build turns them on, and an explicit
 *   environment value overrides that.
 * - **High-risk flags** ignore the preview default entirely. They are off
 *   unless somebody writes the variable by hand, and `production` is refused
 *   for them outright here — reaching production is a decision for a reviewed
 *   configuration change, not an environment typo.
 *
 * A misspelt value reads as `off`, never as the nearest valid state.
 */

import type { FeatureState } from '../intelligence/contracts';
import { institutionalPreview, type PreviewEnv } from '../lib/institutional-preview';

export type CommunityFlag =
  | 'communityFeed'
  | 'communityReporting'
  | 'moderationConsole'
  | 'institutionEscalation'
  | 'volunteerModeration'
  | 'scopedPseudonymity'
  | 'accountSafetyState'
  | 'communityImages';

export type CommunityFlags = Record<CommunityFlag, FeatureState>;

interface FlagSpec {
  env: string;
  highRisk: boolean;
  /** One line for FEATURE-FLAG-REGISTRY.md and the admin readout. */
  purpose: string;
}

export const COMMUNITY_FLAG_SPECS: Record<CommunityFlag, FlagSpec> = {
  communityFeed: {
    env: 'VITE_COMMUNITY_FEED',
    highRisk: false,
    purpose: 'Communities, memberships, finite explained feeds, study sessions.',
  },
  communityReporting: {
    env: 'VITE_COMMUNITY_REPORTING',
    highRisk: false,
    purpose: 'Report, block, mute and leave, plus pre-post privacy checks.',
  },
  moderationConsole: {
    env: 'VITE_MODERATION_CONSOLE',
    highRisk: false,
    purpose: 'Professional Trust & Safety queue, case actions, appeals.',
  },
  institutionEscalation: {
    env: 'VITE_INSTITUTION_ESCALATION',
    highRisk: true,
    purpose: 'Dual-approved, minimum-data escalation to a campus liaison.',
  },
  volunteerModeration: {
    env: 'VITE_VOLUNTEER_MODERATION',
    highRisk: true,
    purpose: 'Blind P3 and narrow P2 volunteer review queues.',
  },
  scopedPseudonymity: {
    env: 'VITE_SCOPED_PSEUDONYMITY',
    highRisk: true,
    purpose: 'Community-only aliases in approved communities.',
  },
  accountSafetyState: {
    env: 'VITE_ACCOUNT_SAFETY_STATE',
    highRisk: true,
    purpose: 'Private 0–100 Trust & Safety state, staff-only.',
  },
  communityImages: {
    env: 'VITE_COMMUNITY_IMAGES',
    highRisk: true,
    purpose: 'Image posts, held until scanned; nothing clears without a known-abuse check.',
  },
};

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

function state(env: PreviewEnv, spec: FlagSpec, preview: boolean): FeatureState {
  const value = env[spec.env];
  if (value === undefined) return preview && !spec.highRisk ? 'preview' : 'off';
  if (!STATES.includes(value as FeatureState)) return 'off';
  if (spec.highRisk && value === 'production') return 'off';
  return value as FeatureState;
}

export function communityFlags(env: PreviewEnv): CommunityFlags {
  const preview = institutionalPreview(env);
  const out = {} as CommunityFlags;
  for (const key of Object.keys(COMMUNITY_FLAG_SPECS) as CommunityFlag[]) {
    out[key] = state(env, COMMUNITY_FLAG_SPECS[key], preview);
  }
  return out;
}

export function enabled(flags: CommunityFlags, flag: CommunityFlag): boolean {
  return flags[flag] !== 'off';
}

export const COMMUNITY_FLAGS = communityFlags(import.meta.env);
