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
import { matches, type ViewProps } from './Fields';

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
 * flag to the registry without naming it here is a compile error — the tab
 * cannot quietly fall behind the registry it reports on. `about` is written
 * only where the registry's own documentation says what the flag controls;
 * where it does not, the row says so rather than the tab inventing a sentence.
 */

/** Said in the row, and searched by the filter, so a query taken from the table finds the row. */
const UNDESCRIBED = 'Not described in the flag registry.';

const STATE_WORD: Record<FeatureState, string> = {
  production: 'On in production',
  sandbox: 'Sandbox',
  preview: 'Preview',
  off: 'Off',
};

/** Most live first, so what a build actually exposes is the top of the table. */
const STATE_RANK: Record<FeatureState, number> = { production: 0, sandbox: 1, preview: 2, off: 3 };

const FLAG_LABELS: Record<keyof ExperienceFlags, { label: string; about?: string }> = {
  semesterIntelligence: { label: 'Semester Intelligence' },
  journeyNavigation: { label: 'Journey navigation' },
  adaptiveLearning: { label: 'Adaptive learning' },
  careerSkillsGraph: { label: 'Career skills graph' },
  multimodalCapture: { label: 'Multimodal capture' },
  universityControlPlane: { label: 'University control plane' },
  humanHelp: { label: 'Human help' },
  integrationDashboard: { label: 'Integration dashboard', about: 'The staff Integration Dashboard. Tenant flags and integration:view still apply.' },
  institutionalOperations: {
    label: 'Institutional operations',
    about: 'The staff Operations studio: data dictionary, suppressed exports, curriculum simulation, evidence, developer platform and readiness.',
  },
  privateBeta: { label: 'Private beta', about: 'Whether Help offers a private-beta invitation. Never on in an institutional preview.' },
  supportTickets: { label: 'Support tickets', about: 'Asking Semester’s own support about the app, on Help. Never on in an institutional preview.' },
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
 * What is said about a flag is only what `lib/toolkit/flags.ts` says of it.
 */
const TOOLKIT_LABELS: Record<keyof ToolkitFlags, { label: string; about?: string }> = {
  aiToolkit: { label: 'AI Toolkit', about: 'The master switch. With it off, every other toolkit flag reads off whatever it was set to.' },
  researchStudio: { label: 'Toolkit: research studio' },
  dataStudio: { label: 'Toolkit: data studio' },
  dataUpload: { label: 'Toolkit: data upload' },
  subjectWorkbenches: { label: 'Toolkit: subject workbenches' },
  aiDisclosure: { label: 'Toolkit: AI disclosure' },
  codeExecution: { label: 'Toolkit: code execution' },
  externalConnectors: { label: 'Toolkit: external connectors' },
};

const UNBUILT_ABOUT = 'Cannot be switched on from this build: nothing is built behind it yet, so it reads off whatever the environment says.';

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
const STANDALONE_LABELS: Record<keyof StandaloneFlags, { label: string; about?: string }> = {
  language: { label: 'Language' },
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

const MODULE_ABOUT: Partial<Record<ModuleFlag, string>> = {
  today_action_center: 'The shared Action Center on Today. On by default; the variable is kept as a rollback.',
  offline_engine_tasks: 'Personal actions through the offline-sync engine. Actions only, on purpose.',
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
  about?: string;
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
      label: TOOLKIT_LABELS[key].label,
      state: toolkit[key],
      about: (UNBUILT as readonly string[]).includes(key) ? UNBUILT_ABOUT : TOOLKIT_LABELS[key].about,
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
  { id: 'about', header: 'What it controls', cell: (r) => r.about ?? <span style={{ color: 'var(--app-dim)' }}>{UNDESCRIBED}</span> },
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
  const rows = all.filter((r) => matches(filter, r.label, r.id, STATE_WORD[r.state], r.group, r.about ?? UNDESCRIBED));
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
