import { Notice, SectionLabel } from '../ui';
import { Table, type Column } from '../unity/Table';
import type { FeatureState } from '../../intelligence/contracts';
import {
  EXPERIENCE_FLAGS,
  MODULE_FLAGS,
  MODULE_FLAG_NAMES,
  type ExperienceFlags,
  type ModuleFlag,
  type ModuleFlags,
} from '../../lib/experience-flags';
import { UNBUILT, TOOLKIT_FLAGS, type ToolkitFlags } from '../../lib/toolkit/flags';
import { COMMUNITY_FLAGS, COMMUNITY_FLAG_SPECS, type CommunityFlag, type CommunityFlags } from '../../community/flags';
import { LANGUAGE_FLAG } from '../../lib/locale';
import { LIFE_EVENTS_FLAG } from '../../lib/lifeevents';
import { MOMENT_FEEDBACK_FLAG } from '../../lib/momentfeedback';
import { LEARNER_PATHWAYS_FLAG } from '../../lib/learner-pathways';
import { Prose, matches, type ViewProps } from './Fields';

/**
 * What this build ships: the feature flags it was built with, from the four
 * registries that hold them (experience, module, toolkit and community) and the
 * four standalone flags, and the state each was built in.
 *
 * Read-only on purpose. A flag is fixed when a build is made (a `VITE_*`
 * variable, read once into `lib/experience-flags.ts`), and a school's own
 * policy narrows it further at run time; neither can be changed from a page
 * that is already running, so there is no toggle here. A switch that appeared
 * to flip a flag it could not flip would be exactly the false success the
 * console exists to avoid. To change one, set the variable and make a new
 * build.
 *
 * ## Why the descriptions are typed, not free
 *
 * `FLAG_LABELS` is a `Record` over every key of `ExperienceFlags`, so adding a
 * flag to the registry without naming and describing it here is a compile
 * error — the tab cannot quietly fall behind the registry it reports on.
 * Descriptions follow the real consumers and their existing gates.
 */

const STATE_WORD: Record<FeatureState, string> = {
  production: 'On in production',
  sandbox: 'Sandbox',
  preview: 'Preview',
  off: 'Off',
};

/** Most live first, so what a build actually exposes is the top of the table. */
const STATE_RANK: Record<FeatureState, number> = { production: 0, sandbox: 1, preview: 2, off: 3 };

const FLAG_LABELS: Record<keyof ExperienceFlags, { label: string; about: string }> = {
  semesterIntelligence: { label: 'Semester Intelligence', about: 'Gates governed Semester Intelligence responses in chat; the configured AI gateway and its policy checks still apply.' },
  journeyNavigation: { label: 'Journey navigation', about: 'Switches student navigation to five destinations: Today, My Path, Search, Plan and Me. Off restores the legacy destinations.' },
  adaptiveLearning: { label: 'Adaptive learning', about: 'Adds readiness ranges and learning evidence to Study and the course Study Studio.' },
  careerSkillsGraph: { label: 'Career skills graph', about: 'Adds the Skills tab and the course-to-skill evidence graph in Career.' },
  multimodalCapture: { label: 'Multimodal capture', about: 'Adds Course capture controls for bringing material into a course.' },
  universityControlPlane: { label: 'University control plane', about: 'Adds Control and Trust views to University. Database capabilities still decide what an account may do.' },
  humanHelp: { label: 'Human help', about: 'Adds Get help and contextual request handoffs. Existing account and support gates still apply.' },
  integrationDashboard: { label: 'Integration dashboard', about: 'The staff Integration Dashboard. Tenant flags and integration:view still apply.' },
  institutionalOperations: {
    label: 'Institutional operations',
    about: 'The staff Operations studio: data dictionary, suppressed exports, curriculum simulation, evidence, developer platform and readiness.',
  },
  privateBeta: { label: 'Private beta', about: 'Whether Help offers a private-beta invitation. Never on in an institutional preview.' },
  supportTickets: { label: 'Support tickets', about: 'Asking Semester’s own support about the app, on Help. Never on in an institutional preview.' },
  supportEmailNotices: {
    label: 'Support email notices',
    about: 'Whether Help offers the per-ticket email opt-in. Server-side vendor approval remains a separate fail-closed gate.',
  },
  campaignManager: { label: 'Campaign manager', about: 'The staff campaign manager. Row-level security decides what each account sees.' },
  migrationCenter: { label: 'Migration center', about: 'The staff Migration Center. Row-level security and the stage gate decide what each account may do.' },
  workflowBuilder: { label: 'Workflow builder', about: 'The staff Workflow Builder. The second-person publish rule applies.' },
  configurationStudio: { label: 'Configuration studio', about: 'The staff Configuration Studio. The second-person publish rule applies.' },
  recordLedger: { label: 'Record ledger', about: 'The staff academic-record ledger. The approval trigger applies.' },
  studentAccounts: { label: 'Student accounts', about: 'The staff student-accounts ledger. The approval trigger applies.' },
  domainTasks: {
    label: 'Domain actions',
    about: 'Adding, ticking, moving and deleting an action go through its own domain. Only production switches it on; any other state is the legacy reducer.',
  },
};

/**
 * The toolkit's flags, named. A `Record` over `ToolkitFlags`, so a new toolkit
 * flag is a compile error until it is named here, as with the experience flags.
 * Descriptions follow the Toolkit consumer; unbuilt flags retain the registry's
 * explicit hardcoded-off explanation.
 */
const TOOLKIT_LABELS: Record<keyof ToolkitFlags, string> = {
  aiToolkit: 'AI Toolkit',
  researchStudio: 'Toolkit: research studio',
  dataStudio: 'Toolkit: data studio',
  dataUpload: 'Toolkit: data upload',
  subjectWorkbenches: 'Toolkit: subject workbenches',
  aiDisclosure: 'Toolkit: AI disclosure',
  codeExecution: 'Toolkit: code execution',
  externalConnectors: 'Toolkit: external connectors',
};

const UNBUILT_ABOUT = 'Cannot be switched on from this build: nothing is built behind it yet, so it reads off whatever the environment says.';
type BuiltToolkitFlag = Exclude<keyof ToolkitFlags, (typeof UNBUILT)[number]>;
const TOOLKIT_ABOUT: Record<BuiltToolkitFlag, string> = {
  aiToolkit: 'The master switch. With it off, every other toolkit flag reads off whatever it was set to.',
  researchStudio: 'Adds Research Studio for research questions, evidence screening and source verification.',
  dataStudio: 'Adds Data Studio for data projects and interpretation.',
  dataUpload: 'Allows file upload inside Data Studio. Data Studio and the toolkit master switch must also be on.',
  subjectWorkbenches: 'Makes subject-specific workbenches reachable from All tools.',
  aiDisclosure: 'Adds the AI-use disclosure builder beside the course policy.',
};

const toolkitAbout = (key: keyof ToolkitFlags): string =>
  (UNBUILT as readonly string[]).includes(key) ? UNBUILT_ABOUT : TOOLKIT_ABOUT[key as BuiltToolkitFlag];

/**
 * The flags that live on their own in the module they gate rather than in a
 * registry. Typed, so a flag added here is a flag the tab shows.
 */
export type StandaloneFlags = Record<'language' | 'lifeEvents' | 'momentFeedback' | 'learnerPathways', FeatureState>;

export const STANDALONE_FLAGS: StandaloneFlags = {
  language: LANGUAGE_FLAG,
  lifeEvents: LIFE_EVENTS_FLAG,
  momentFeedback: MOMENT_FEEDBACK_FLAG,
  learnerPathways: LEARNER_PATHWAYS_FLAG,
};

/** What each says of itself, from the module that holds it; nothing is added. */
const STANDALONE_LABELS: Record<keyof StandaloneFlags, { label: string; about: string }> = {
  language: { label: 'Language', about: 'Honours the learner’s selected locale for date, time and number formatting. Interface copy remains English.' },
  lifeEvents: { label: 'Life events', about: 'Gates the life-events panel. Absent is off.' },
  momentFeedback: { label: 'Moment feedback', about: 'Gates the feedback prompts and the panel. Absent is off.' },
  learnerPathways: { label: 'Learner pathways', about: 'Absent is off, and does not follow the institutional preview.' },
};

/**
 * Every source file that reads a four-state flag from the build environment,
 * and so every one this tab must read. `Releases.sources.test.ts` scans the
 * tree for such files and fails when one is missing from this list, so the tab
 * cannot silently omit a flag a build can turn on.
 */
export const FLAG_SOURCES = [
  'community/flags.ts',
  'lib/experience-flags.ts',
  'lib/learner-pathways.ts',
  'lib/lifeevents.ts',
  'lib/locale.ts',
  'lib/momentfeedback.ts',
  'lib/toolkit/flags.ts',
] as const;

/** `communityFeed` → `feed`, `moderationConsole` → `moderation console`: the words after the `Community:` prefix. */
const communityWords = (key: string): string => key.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^community /, '');

const MODULE_ABOUT: Record<ModuleFlag, string> = {
  today_action_center: 'The shared Action Center on Today. On by default; the variable is kept as a rollback.',
  registration_day_mode: 'Adds the registration-day checklist, countdown and backup picks to the registration plan.',
  graduation_simulator: 'Adds extra scenario presets, detailed comparisons, account draft controls and sharing to the degree-path graduation simulator.',
  cost_planner: 'Adds itemised term-cost scenarios to the graduation simulator.',
  academic_life_balance: 'Adds the weekly academic-life balance view in Plan and is required for the separately flagged heavy-week warning on Today.',
  crunch_week_forecast: 'Adds heavy-week warnings when academic-life balance is also on.',
  course_detail_v2: 'Adds the redesigned course detail experience in the registration workspace.',
  advisor_meeting_mode: 'Adds an advisor-meeting agenda and sharing workflow to the degree path.',
  study_readiness: 'Adds per-unit study readiness before an exam to each course workspace.',
  source_locker: 'Adds a course Sources tab for locking which sources a study session may use.',
  career_evidence: 'Adds coursework skill evidence to course overviews and Career.',
  office_action_feed: 'Adds campus-office actions to Today and the registrar workspace; publishing permissions still apply.',
  demand_forecasting: 'Adds staff course-demand counts in University; database scope and the minimum group size still apply.',
  semester_wrapped: 'Adds the end-of-term Semester Wrapped summary in Me.',
  offline_mode: 'Adds explicit offline working and sync-status surfaces; it does not change server confirmation rules.',
  offline_engine_tasks: 'Personal actions through the offline-sync engine. Actions only, on purpose.',
  trust_center: 'Adds the in-app Trust Center to Privacy and Me.',
  course_studio: 'The faculty Course Studio and, for students, the instructor’s published rules and guidance.',
};

/** The registry's own name for a flag, where the name itself says a word the content standards retire. */
const MODULE_LABEL: Partial<Record<ModuleFlag, string>> = { offline_engine_tasks: 'Offline engine actions' };

const humanise = (name: string): string => {
  const words = name.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

interface Row {
  id: string;
  group: 'Experience' | 'Module' | 'Toolkit' | 'Community' | 'Standalone';
  label: string;
  state: FeatureState;
  about: string;
}

export function flagRows(
  experience: ExperienceFlags,
  modules: ModuleFlags,
  toolkit: ToolkitFlags,
  community: CommunityFlags,
  standalone: StandaloneFlags,
): Row[] {
  const rows: Row[] = [
    ...(Object.keys(FLAG_LABELS) as (keyof ExperienceFlags)[]).map((key) => ({
      id: `experience.${key}`,
      group: 'Experience' as const,
      label: FLAG_LABELS[key].label,
      state: experience[key],
      about: FLAG_LABELS[key].about,
    })),
    ...MODULE_FLAG_NAMES.map((name) => ({
      id: `module.${name}`,
      group: 'Module' as const,
      label: MODULE_LABEL[name] ?? humanise(name),
      state: modules[name],
      about: MODULE_ABOUT[name],
    })),
    ...(Object.keys(TOOLKIT_LABELS) as (keyof ToolkitFlags)[]).map((key) => ({
      id: `toolkit.${key}`,
      group: 'Toolkit' as const,
      label: TOOLKIT_LABELS[key],
      state: toolkit[key],
      about: toolkitAbout(key),
    })),
    ...(Object.keys(COMMUNITY_FLAG_SPECS) as CommunityFlag[]).map((key) => ({
      id: `community.${key}`,
      group: 'Community' as const,
      label: `Community: ${communityWords(key)}`,
      state: community[key],
      about: COMMUNITY_FLAG_SPECS[key].highRisk
        ? `${COMMUNITY_FLAG_SPECS[key].purpose} High risk: never follows the preview default, and production is refused.`
        : COMMUNITY_FLAG_SPECS[key].purpose,
    })),
    ...(Object.keys(STANDALONE_LABELS) as (keyof StandaloneFlags)[]).map((key) => ({
      id: `standalone.${key}`,
      group: 'Standalone' as const,
      label: STANDALONE_LABELS[key].label,
      state: standalone[key],
      about: STANDALONE_LABELS[key].about,
    })),
  ];
  return rows.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.label.localeCompare(b.label));
}

const COLUMNS: Column<Row>[] = [
  { id: 'flag', header: 'Flag', rowHeader: true, cell: (r) => r.label },
  { id: 'state', header: 'State in this build', cell: (r) => <strong>{STATE_WORD[r.state]}</strong> },
  { id: 'group', header: 'Kind', cell: (r) => r.group },
  { id: 'about', header: 'What it controls', cell: (r) => <Prose>{r.about}</Prose> },
];

export function Releases({
  env,
  filter,
  experience = EXPERIENCE_FLAGS,
  modules = MODULE_FLAGS,
  toolkit = TOOLKIT_FLAGS,
  community = COMMUNITY_FLAGS,
  standalone = STANDALONE_FLAGS,
}: Pick<ViewProps, 'env' | 'filter'> & {
  experience?: ExperienceFlags;
  modules?: ModuleFlags;
  toolkit?: ToolkitFlags;
  community?: CommunityFlags;
  standalone?: StandaloneFlags;
}) {
  const all = flagRows(experience, modules, toolkit, community, standalone);
  const rows = all.filter((r) => matches(filter, r.label, r.id, STATE_WORD[r.state], r.group, r.about));
  const live = all.filter((r) => r.state !== 'off').length;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Read-only. These are the states this {env.toLowerCase()} build was made with, from the experience, module, toolkit and community flag registries and the four standalone flags. A flag is fixed when the build is made, and a school’s own
        policy can narrow it further at run time, so nothing here changes either. To change one, set its build variable and make a new build.
      </Notice>
      <SectionLabel aside={`${live} of ${all.length} not off`}>Feature flags</SectionLabel>
      <Table
        caption="Feature flags and their state in this build"
        captionHidden
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        compact="stack"
        empty={<p style={{ marginBlock: 0, color: 'var(--app-dim)' }}>No flags match.</p>}
      />
    </div>
  );
}
