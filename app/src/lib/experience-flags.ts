import type { FeatureState } from '../intelligence/contracts';
import { institutionalPreview, type PreviewEnv } from './institutional-preview';

export interface ExperienceFlags {
  semesterIntelligence: FeatureState;
  journeyNavigation: FeatureState;
  adaptiveLearning: FeatureState;
  careerSkillsGraph: FeatureState;
  multimodalCapture: FeatureState;
  universityControlPlane: FeatureState;
  humanHelp: FeatureState;
  /** The staff Integration Dashboard. Tenant flags and `integration:view` still apply. */
  integrationDashboard: FeatureState;
  /**
   * The staff Operations studio: data dictionary, suppressed exports,
   * curriculum simulation, evidence, developer platform and readiness.
   */
  institutionalOperations: FeatureState;
  /**
   * Whether Help offers a private-beta invitation. Never on in an
   * institutional preview: an invitation is to a real account's confirmed
   * address, which a preview does not have. Off does not hide a member's own
   * beta or their way out of it; membership alone decides that.
   */
  privateBeta: FeatureState;
  /**
   * Asking Semester's own support about the app, on Help. Never on in an
   * institutional preview: a ticket is a real message to real staff, which a
   * synthetic preview account must not send.
   */
  supportTickets: FeatureState;
  /**
   * The staff campaign manager (lib/gtm, gtm_* tables). RLS decides what each
   * account sees; activation also needs `module.campaign_manager` in production.
   */
  campaignManager: FeatureState;
  /**
   * The staff Migration Center (lib/migration, migration_* tables, D-144). RLS
   * and the stage gate decide what each account sees and may do.
   */
  migrationCenter: FeatureState;
  /**
   * The staff Workflow Builder (lib/workflow, workflow_versions, D-1018). RLS and
   * the second-person publish rule decide what each account may do.
   */
  workflowBuilder: FeatureState;
  /**
   * The staff Configuration Studio (lib/config, school_config_versions, D-1011).
   * RLS and the second-person publish rule decide what each account may do.
   */
  configurationStudio: FeatureState;
  /**
   * The staff academic-record ledger (lib/record, academic_record_* tables,
   * D-145). RLS and the approval trigger decide what each account may do.
   */
  recordLedger: FeatureState;
  /**
   * The staff student-accounts ledger (lib/finance, student_account_* tables,
   * D-146). RLS and the approval trigger decide what each account may do.
   */
  studentAccounts: FeatureState;
  /**
   * Today computed through `src/domains` (steps 3 and 4 of
   * docs/architecture/modular-monolith.md, D-1149).
   *
   * `preview` and `sandbox` run the domain's Today beside the legacy one and
   * report any disagreement to the console; **nothing on screen changes**.
   * `production` cuts over: the "Due today" list takes its membership and order
   * from the domain (the shadow keeps running). A role the domain does not serve
   * is drawn from the legacy selectors as before. Never inherited from an
   * institutional preview: it is a developer's instrument, and a preview account
   * has nothing to compare.
   */
  domainToday: FeatureState;
  /**
   * Ticking a task and moving it a day go through `src/domains/tasks` (step 5 of
   * docs/architecture/modular-monolith.md, D-1149), which refuses a second
   * completion and checks the date. Only `production` switches it on; every
   * other state is the legacy reducer, exactly as before. A repeating task
   * always takes the legacy path: the domain does not own repetition.
   */
  domainTasks: FeatureState;
}

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

function featureState(env: PreviewEnv, key: string, preview: boolean, fallback: FeatureState = 'off'): FeatureState {
  const value = env[key];
  if (value === undefined) return preview ? 'preview' : fallback;
  return STATES.includes(value as FeatureState) ? (value as FeatureState) : 'off';
}

export function experienceFlags(env: PreviewEnv): ExperienceFlags {
  const preview = institutionalPreview(env);
  return {
    semesterIntelligence: featureState(env, 'VITE_SEMESTER_INTELLIGENCE', preview),
    // D-003 is no longer a dormant experiment. The five destinations are the
    // product's canonical information architecture; an explicit `off` remains
    // available as a rollback, but a normal build now ships the one-system
    // navigation instead of each device's legacy collection of tabs.
    journeyNavigation: featureState(env, 'VITE_JOURNEY_NAVIGATION', preview, 'production'),
    adaptiveLearning: featureState(env, 'VITE_ADAPTIVE_LEARNING', preview),
    careerSkillsGraph: featureState(env, 'VITE_CAREER_SKILLS_GRAPH', preview),
    multimodalCapture: featureState(env, 'VITE_MULTIMODAL_CAPTURE', preview),
    universityControlPlane: featureState(env, 'VITE_UNIVERSITY_CONTROL_PLANE', preview),
    humanHelp: featureState(env, 'VITE_HUMAN_HELP', preview),
    integrationDashboard: featureState(env, 'VITE_INTEGRATION_DASHBOARD', preview),
    institutionalOperations: featureState(env, 'VITE_INSTITUTIONAL_OPERATIONS', preview),
    privateBeta: featureState(env, 'VITE_PRIVATE_BETA', false),
    supportTickets: featureState(env, 'VITE_SUPPORT_TICKETS', false),
    campaignManager: featureState(env, 'VITE_CAMPAIGN_MANAGER', preview),
    migrationCenter: featureState(env, 'VITE_MIGRATION_CENTER', preview),
    workflowBuilder: featureState(env, 'VITE_WORKFLOW_BUILDER', preview),
    configurationStudio: featureState(env, 'VITE_CONFIGURATION_STUDIO', preview),
    recordLedger: featureState(env, 'VITE_RECORD_LEDGER', preview),
    studentAccounts: featureState(env, 'VITE_STUDENT_ACCOUNTS', preview),
    domainToday: featureState(env, 'VITE_DOMAIN_TODAY', false),
    domainTasks: featureState(env, 'VITE_DOMAIN_TASKS', false),
  };
}

export const EXPERIENCE_FLAGS = experienceFlags(import.meta.env);

/**
 * The feature-expansion modules (docs/FEATURE-EXPANSION-CROSSWALK.md).
 *
 * A second map rather than more keys on `ExperienceFlags`, for one reason:
 * these never default to `preview`. The six above switch on together when a
 * build is an institutional preview; each of these is switched on alone, by
 * its own `VITE_<NAME>` variable, so a pilot can run one module without
 * inheriting fourteen (DECISION-LOG D-012). `today_action_center` is the
 * fifteenth, for the Today polish itself (D-013).
 */
/**
 * Each module and the build variable that sets it, written out rather than
 * built from the name: `lib/deploy.test.ts` finds the app's build inputs by
 * their literal `VITE_` names, and a name assembled at run time would be one
 * the Pages workflow never learns to pass.
 */
export const MODULE_FLAG_ENV = {
  today_action_center: 'VITE_TODAY_ACTION_CENTER',
  registration_day_mode: 'VITE_REGISTRATION_DAY_MODE',
  graduation_simulator: 'VITE_GRADUATION_SIMULATOR',
  cost_planner: 'VITE_COST_PLANNER',
  academic_life_balance: 'VITE_ACADEMIC_LIFE_BALANCE',
  crunch_week_forecast: 'VITE_CRUNCH_WEEK_FORECAST',
  course_detail_v2: 'VITE_COURSE_DETAIL_V2',
  advisor_meeting_mode: 'VITE_ADVISOR_MEETING_MODE',
  study_readiness: 'VITE_STUDY_READINESS',
  source_locker: 'VITE_SOURCE_LOCKER',
  career_evidence: 'VITE_CAREER_EVIDENCE',
  office_action_feed: 'VITE_OFFICE_ACTION_FEED',
  demand_forecasting: 'VITE_DEMAND_FORECASTING',
  semester_wrapped: 'VITE_SEMESTER_WRAPPED',
  offline_mode: 'VITE_OFFLINE_MODE',
  trust_center: 'VITE_TRUST_CENTER',
  // Faculty Course Studio (docs/FACULTY-COURSE-STUDIO-DESIGN.md, D-100 F6):
  // the studio for faculty and, for students, the instructor's published rules
  // and guidance. Off, nothing published is read.
  course_studio: 'VITE_COURSE_STUDIO',
} as const;

export type ModuleFlag = keyof typeof MODULE_FLAG_ENV;
export const MODULE_FLAG_NAMES = Object.keys(MODULE_FLAG_ENV) as ModuleFlag[];
export type ModuleFlags = Record<ModuleFlag, FeatureState>;

export function moduleFlags(env: PreviewEnv): ModuleFlags {
  const flags = {} as ModuleFlags;
  for (const name of MODULE_FLAG_NAMES) {
    // The shared Action Center is the default Today experience. It is the one
    // action system all modules write into, not an optional product module.
    // Keep the exact environment variable as a fail-safe rollback.
    const fallback = name === 'today_action_center' ? 'production' : 'off';
    flags[name] = featureState(env, MODULE_FLAG_ENV[name], false, fallback);
  }
  return flags;
}

export const MODULE_FLAGS = moduleFlags(import.meta.env);

/** On in any state but `off`. The one question most call sites ask. */
export const moduleOn = (state: FeatureState): boolean => state !== 'off';
