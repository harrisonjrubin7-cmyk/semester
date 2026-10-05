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
import { matches, type ViewProps } from './Fields';

/**
 * What this build ships: every feature flag, and the state it was built in.
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
  group: 'Experience' | 'Module';
  label: string;
  state: FeatureState;
  about?: string;
}

export function flagRows(experience: ExperienceFlags, modules: ModuleFlags): Row[] {
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
  ];
  return rows.sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.label.localeCompare(b.label));
}

const COLUMNS: Column<Row>[] = [
  { id: 'flag', header: 'Flag', rowHeader: true, cell: (r) => r.label },
  { id: 'state', header: 'State in this build', cell: (r) => <strong>{STATE_WORD[r.state]}</strong> },
  { id: 'group', header: 'Kind', cell: (r) => r.group },
  { id: 'about', header: 'What it controls', cell: (r) => r.about ?? <span style={{ color: 'var(--app-dim)' }}>Not described in the flag registry.</span> },
];

export function Releases({
  env,
  filter,
  experience = EXPERIENCE_FLAGS,
  modules = MODULE_FLAGS,
}: Pick<ViewProps, 'env' | 'filter'> & { experience?: ExperienceFlags; modules?: ModuleFlags }) {
  const all = flagRows(experience, modules);
  const rows = all.filter((r) => matches(filter, r.label, r.id, STATE_WORD[r.state], r.group, r.about));
  const live = all.filter((r) => r.state !== 'off').length;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <Notice>
        Read-only. These are the states this {env.toLowerCase()} build was made with. A flag is fixed when the build is made, and a school’s own
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
