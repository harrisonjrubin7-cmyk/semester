import { destination } from './nav';
import { canonicalDestinationFor, FIVE_LABELS } from './tabbar';
import type { Screen } from './types';

export const SCREEN_MATURITY = [
  'canonical',
  'contextual',
  'transitional',
  'internal',
  'experimental',
  'deprecated',
  'retired',
] as const;

export type ScreenMaturity = (typeof SCREEN_MATURITY)[number];

export interface ScreenGovernance {
  route: string;
  canonicalDestination: Screen;
  contextualModule: string | null;
  primaryUser: 'student' | 'institution' | 'semester-operator';
  primaryJob: string;
  primaryAction: string;
  dataSources: readonly string[];
  permissionModel: string;
  sourceLabels: readonly string[];
  errorFallback: string;
  accessibilityTests: readonly string[];
  mobileBehavior: string;
  analyticsEvents: readonly string[];
  supportRoute: Screen;
  featureStatus: 'available' | 'controlled-pilot' | 'limited-beta' | 'planned' | 'paused' | 'retired';
  owner: string;
  maturity: ScreenMaturity;
  replacementOrMergeTarget: Screen | null;
}

const INTERNAL = new Set<Screen>(['console', 'moderation', 'registrar', 'registration', 'gradebook']);
const EXPERIMENTAL = new Set<Screen>(['analyse', 'guess', 'launchpad']);
const TRANSITIONAL = new Set<Screen>([
  'mine',
  'account',
  'profile',
  'privacy',
  'data',
  'agreements',
  'recovery',
  'pathway',
  'courses',
  'study',
  'write',
  'sheet',
  'slides',
  'draw',
  'university',
  'hub',
  'directory',
]);

const OWNER: Partial<Record<Screen, string>> = {
  home: 'Student Success',
  degree: 'Academic Path',
  search: 'Discovery and Support',
  calendar: 'Planning',
  me: 'Student Controls',
};

const PRIMARY_ACTION: Partial<Record<Screen, string>> = {
  home: 'Complete the next safe action',
  degree: 'Review or update the academic path',
  search: 'Find a trusted answer and act on it',
  calendar: 'Resolve or schedule the next commitment',
  me: 'Review work, privacy, connections, and controls',
};

/**
 * Required metadata for every routed screen.
 *
 * The registry is derived from the same canonical-home rule as the rail and
 * bottom bar. That makes a newly added route governed immediately, while the
 * explicit sets above record the exceptions that need migration or tighter
 * permissions. A screen cannot silently become a sixth product.
 */
export function governanceFor(screen: Screen): ScreenGovernance {
  const canonical = canonicalDestinationFor(screen);
  const isCanonical = canonical === screen;
  const internal = INTERNAL.has(screen);
  const experimental = EXPERIMENTAL.has(screen);
  const transitional = TRANSITIONAL.has(screen);
  const nav = destination(screen);
  const maturity: ScreenMaturity = internal
    ? 'internal'
    : experimental
      ? 'experimental'
      : transitional
        ? 'transitional'
        : isCanonical
          ? 'canonical'
          : 'contextual';
  const featureStatus = experimental ? 'controlled-pilot' : internal ? 'limited-beta' : 'available';
  const canonicalName = FIVE_LABELS[canonical] ?? canonical;

  return {
    route: `#/${screen}`,
    canonicalDestination: canonical,
    contextualModule: isCanonical ? null : nav?.label ?? screen,
    primaryUser: internal ? (screen === 'console' ? 'semester-operator' : 'institution') : 'student',
    primaryJob: nav?.blurb ?? `Complete this ${canonicalName} workflow in context.`,
    primaryAction: PRIMARY_ACTION[canonical] ?? `Continue in ${canonicalName}`,
    dataSources: internal
      ? ['Authorized institution records', 'Audit events']
      : ['Student-entered records', 'Connected or imported sources', 'Semester-derived context'],
    permissionModel: internal
      ? 'Role, tenant, capability, and audit checks are required.'
      : 'Private to the student unless an explicit, scoped, revocable share applies.',
    sourceLabels: ['Institution verified', 'Imported', 'Student entered', 'Estimated', 'AI-derived', 'Needs review'],
    errorFallback: 'Preserve work, state what may be stale, and offer the official or human route.',
    accessibilityTests: ['keyboard', 'focus', 'landmarks', 'contrast', 'reduced-motion', 'axe'],
    mobileBehavior: 'Use the shared phone shell; contextual detail opens as a bottom sheet.',
    analyticsEvents: [`screen_opened:${screen}`, `canonical_destination:${canonical}`],
    supportRoute: 'university',
    featureStatus,
    owner: OWNER[canonical] ?? 'Student Experience',
    maturity,
    replacementOrMergeTarget: transitional ? canonical : null,
  };
}
