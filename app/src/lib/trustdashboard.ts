import type { ExperienceFlags, ModuleFlag, ModuleFlags } from './experience-flags';
import { MODULE_FLAG_NAMES, moduleOn } from './experience-flags';
import { MIN_COHORT } from './institution-ops';
import { CLOCKS, MODULE_EFFECTS } from './governance/policysim';
import { CLAIMS, STATUS_LABEL } from './ops/claims';
import { live, type Incident } from './statusnotice';
import { knownIssues, type Note } from './whatsnew';

/**
 * The customer trust dashboard: what an institution sees about the product
 * it runs, in the twelve rows the brief names, composed from what the app
 * already knows about itself.
 *
 *   Current product version · Enabled modules · Current integrations and
 *   freshness · Open support issues · Known limitations · Security and trust
 *   documents · Accessibility status · Upcoming maintenance · Retention
 *   configuration · AI policy configuration · Feature changes · Usage and
 *   adoption aggregates
 *
 * Every row is derived, never typed: the version is the build stamp, the
 * modules are the flags, the integrations are the connections with their
 * last sync, the maintenance is the status file, the retention is the clock
 * table the policy simulator reads, the accessibility status is the public
 * claims register's own words, the changes are the notes under Me. A row
 * with nothing behind it says so ("no institutional connection is live")
 * rather than printing a value it made up, and the usage row applies the
 * same n ≥ 10 floor the operations studio applies to everything else.
 *
 * Pure. The component gathers the inputs; this only arranges them.
 */

export interface Integration {
  name: string;
  /** Epoch ms of the last successful sync, or null when never. */
  lastSync: number | null;
  scope: string;
  owner: string;
}

export interface Aggregate {
  label: string;
  n: number;
}

export interface TrustInput {
  /** The build id, or empty when the build is not stamped. */
  build: string;
  modules: ModuleFlags;
  experience: ExperienceFlags;
  integrations: readonly Integration[];
  /** Open support issues for this tenant, or null when the console cannot read them. */
  openIssues: number | null;
  incidents: readonly Incident[];
  notes: readonly Note[];
  /** Whether the assistant answers through the school's governed gateway. */
  governedAI: boolean;
  usage: readonly Aggregate[];
  now: number;
}

export interface TrustRow {
  id: string;
  title: string;
  /** The one-line answer. */
  value: string;
  /** The lines under it, when there are any. */
  lines: string[];
  /** Whether the row is a fact of the tree, a live reading, or an absence said plainly. */
  kind: 'fact' | 'live' | 'none';
}

/** The documents an institution may ask for, each a path in the tree that the test holds to exist. */
export const TRUST_DOCUMENTS: readonly { title: string; path: string }[] = [
  { title: 'Security overview', path: 'SECURITY.md' },
  { title: 'Security whitepaper', path: 'docs/trust/SECURITY-WHITEPAPER.md' },
  { title: 'Retention schedule', path: 'RETENTION.md' },
  { title: 'Subprocessor list', path: 'docs/SUBPROCESSORS.md' },
  { title: 'Data-processing agreement checklist', path: 'docs/trust/DPA-CHECKLIST.md' },
  { title: 'Service-level agreement outline', path: 'docs/trust/SLA.md' },
  { title: 'Vendor risk register', path: 'docs/trust/VENDOR-RISK-REGISTER.md' },
  { title: 'SOC 2 readiness', path: 'docs/trust/SOC2-READINESS.md' },
  { title: 'HECVAT and VPAT plan', path: 'docs/trust/HECVAT-VPAT-PLAN.md' },
  { title: 'Penetration-test plan', path: 'docs/trust/PENETRATION-TEST-PLAN.md' },
  { title: 'AI governance', path: 'docs/market-readiness/AI_GOVERNANCE.md' },
  { title: 'Incident communications', path: 'docs/operating-model/INCIDENT-COMMUNICATIONS.md' },
  { title: 'Incident response and recovery playbook', path: 'docs/INCIDENT-RECOVERY-PLAYBOOK.md' },
  { title: 'Institutional trust scorecard', path: 'docs/INSTITUTIONAL-TRUST-SCORECARD.md' },
];

const DAY = 86_400_000;

/** "2 hours ago", "3 days ago", "never". */
export function ago(at: number | null, now: number): string {
  if (at === null || !Number.isFinite(at)) return 'never';
  const ms = Math.max(0, now - at);
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min ago`;
  if (ms < DAY) return `${Math.round(ms / 3_600_000)} h ago`;
  return `${Math.round(ms / DAY)} days ago`;
}

const a11yClaims = ['a11y-app', 'a11y-human', 'vpat'] as const;

export function trustDashboard(input: TrustInput): TrustRow[] {
  const on = MODULE_FLAG_NAMES.filter((m: ModuleFlag) => moduleOn(input.modules[m]));
  const maintenance = input.incidents.filter((i) => i.kind === 'maintenance' && (i.until === null || i.until >= input.now));
  const open = input.incidents.filter((i) => i.kind === 'incident' && live(i, input.now));
  const known = knownIssues(input.notes);
  const changes = [...input.notes].filter((n) => !n.known).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const shown = input.usage.filter((u) => u.n >= MIN_COHORT);
  const suppressed = input.usage.length - shown.length;

  return [
    {
      id: 'version',
      title: 'Current product version',
      value: input.build ? `Build ${input.build}` : 'Unstamped build: every change reaches the live page within minutes, and the changelog is dated by when it did.',
      lines: [],
      kind: input.build ? 'fact' : 'none',
    },
    {
      id: 'modules',
      title: 'Enabled modules',
      value: on.length ? `${on.length} of ${MODULE_FLAG_NAMES.length} modules on` : 'No optional module is on. The core app runs without any.',
      lines: on.map((m) => MODULE_EFFECTS[m].label),
      kind: 'fact',
    },
    {
      id: 'integrations',
      title: 'Current integrations and freshness',
      value: input.integrations.length
        ? `${input.integrations.length} connection${input.integrations.length === 1 ? '' : 's'}. No institutional connection is live; these are calendar subscriptions students added.`
        : 'No connection. No institutional connection is live today.',
      lines: input.integrations.map((i) => `${i.name} · ${i.scope} · last sync ${ago(i.lastSync, input.now)} · owner ${i.owner}`),
      kind: input.integrations.length ? 'live' : 'none',
    },
    {
      id: 'support',
      title: 'Open support issues',
      value: input.openIssues === null ? 'Not readable from this console: support tickets are off, or this account may not read them.' : `${input.openIssues} open`,
      lines: [],
      kind: input.openIssues === null ? 'none' : 'live',
    },
    {
      id: 'limitations',
      title: 'Known limitations',
      value: known.length ? `${known.length} known issue${known.length === 1 ? '' : 's'} listed under What changed` : 'No known issue is listed under What changed.',
      lines: known.map((n) => `${n.date} · ${n.title}`),
      kind: known.length ? 'fact' : 'none',
    },
    {
      id: 'documents',
      title: 'Security and trust documents',
      value: `${TRUST_DOCUMENTS.length} documents, each in the repository at the path shown`,
      lines: TRUST_DOCUMENTS.map((d) => `${d.title} — ${d.path}`),
      kind: 'fact',
    },
    {
      id: 'accessibility',
      title: 'Accessibility status',
      value: 'From the public claims register, in its own words',
      lines: a11yClaims.map((id) => {
        const c = CLAIMS.find((x) => x.id === id);
        return c ? `${c.claim} — ${STATUS_LABEL[c.status]}` : id;
      }),
      kind: 'fact',
    },
    {
      id: 'maintenance',
      title: 'Upcoming maintenance',
      value: maintenance.length
        ? `${maintenance.length} scheduled`
        : open.length
          ? `None scheduled; ${open.length} incident${open.length === 1 ? '' : 's'} open`
          : 'None scheduled, and no incident open.',
      lines: [...maintenance, ...open].map((i) => `${i.date} · ${i.title} · ${i.status}`),
      kind: maintenance.length || open.length ? 'live' : 'none',
    },
    {
      id: 'retention',
      title: 'Retention configuration',
      value: 'Student work is kept until the student deletes it. The clocks that run are records about it:',
      lines: CLOCKS.filter((c) => c.days !== null).map((c) => `${c.label} — ${c.days} days`),
      kind: 'fact',
    },
    {
      id: 'ai',
      title: 'AI policy configuration',
      value: input.governedAI
        ? 'Governed: every answer goes through the school’s gateway and the modes the school allows.'
        : 'Personal controls only: the student controls what the assistant may see; no school policy is in force.',
      lines: [
        moduleOn(input.modules.course_studio) ? 'Course Studio on: a course’s published AI policy is shown before the assistant answers.' : 'Course Studio off: the AI policy a student records for a course is what applies.',
        'Every answer carries source strength, policy state and its limits.',
      ],
      kind: 'fact',
    },
    {
      id: 'changes',
      title: 'Feature changes',
      value: changes.length ? `Latest ${changes.length}, dated by when each reached the live page` : 'No change recorded yet.',
      lines: changes.map((n) => `${n.date} · ${n.title}`),
      kind: changes.length ? 'fact' : 'none',
    },
    {
      id: 'usage',
      title: 'Usage and adoption aggregates',
      value: shown.length
        ? `${shown.length} aggregate${shown.length === 1 ? '' : 's'} at n ≥ ${MIN_COHORT}${suppressed ? `; ${suppressed} suppressed as too small` : ''}`
        : input.usage.length
          ? `Every aggregate is under n = ${MIN_COHORT} and is suppressed.`
          : `No aggregate is published: no institution is connected. When one is, nothing under n = ${MIN_COHORT} is shown.`,
      lines: shown.map((u) => `${u.label} — ${u.n}`),
      kind: shown.length ? 'live' : 'none',
    },
  ];
}
