/**
 * The AI system inventory below the family level: every door a model call goes
 * through, every feature that reaches one, and what stops each.
 *
 * `docs/trust/AI-SYSTEM-INVENTORY.md` is a four-family baseline and says so:
 * "each separately configured model, provider route, retrieval collection,
 * prompt/tool set or materially different purpose requires a child entry".
 * This file is those children for what is in the tree today, and the guard that
 * keeps the list from drifting: `ai-systems.test.ts` finds every source file
 * that reaches a model by import and fails when one is not listed here. A new
 * AI call site without an inventory entry is a red test, not a shadow system.
 *
 * Three things are code here rather than prose, because each was found true of
 * the tree and would otherwise stay a sentence nobody could fail:
 *
 * - **A system's tier is the highest of its dimensions** (`tierFloor`). A
 *   confirmation button enables a tier; it does not lower one.
 * - **Which routes a server kill switch can reach** (`KILL_REACH`). Of five
 *   routes, two are reachable. A student's own key, called from the browser,
 *   never asks the server anything.
 * - **No system reaches the model with education-record data (T3 and above)
 *   without a recorded reconciliation** against `toolkit/classification.ts`,
 *   whose gate says T3 never goes to AI.
 *
 * `docs/ai-governance/` is the design this holds. It claims nothing about any
 * deployed environment: this is a repository census, not a deployed-asset one.
 */

import type { Tier } from '../toolkit/classification';
import { AI_RELEASE_GATE } from './ai-lifecycle';
import type { RiskTier } from './ai-assurance';
import type { ActionTier } from './ai-playbook';

export const ROUTES = ['shared-key', 'device-key', 'device-key-openai', 'proxy', 'institution-gateway'] as const;
export type Route = (typeof ROUTES)[number];

/**
 * What `kill.ai_generation` can stop on each route. `server-switch` means the
 * route asks a server that reads the switch before it generates; `none` means
 * the request leaves the browser for a provider without asking Semester.
 */
export const KILL_REACH: Record<Route, 'server-switch' | 'none'> = {
  'shared-key': 'server-switch',
  'institution-gateway': 'server-switch',
  'device-key': 'none',
  'device-key-openai': 'none',
  proxy: 'none',
};

/** The one dated exercise of a route's switch. Absent means no drill is on file. */
export const KILL_DRILLS: Partial<Record<Route, string>> = {
  'shared-key': 'docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json',
};

export interface Door {
  id: string;
  name: string;
  routes: readonly Route[];
  files: readonly string[];
  note: string;
}

export const DOORS: readonly Door[] = [
  {
    id: 'DOOR-1',
    name: 'The consumer door: ask() and its second provider',
    routes: ['shared-key', 'device-key', 'device-key-openai', 'proxy'],
    files: ['app/src/lib/claude.ts', 'app/src/lib/openai.ts'],
    note: 'Every consumer feature reaches a model through ask(). It chooses a route from settings; it does not fail over between them, and it never reads kill.ai_generation.',
  },
  {
    id: 'DOOR-2',
    name: 'The shared-key function',
    routes: ['shared-key'],
    files: ['supabase/functions/claude/index.ts'],
    note: 'Verifies the JWT, reads the kill switch, meters a monthly cap, refuses until the activation gate is recorded. Anthropic only.',
  },
  {
    id: 'DOOR-3',
    name: 'The institutional intelligence gateway',
    routes: ['institution-gateway'],
    files: [
      'app/server/institution/intelligence.ts',
      'app/server/institution/intelligence-runtime.ts',
      'app/server/institution/intelligence-repository.ts',
      'app/server/institution/intelligence-action-store.ts',
      'app/server/institution/providers/openai.ts',
      'app/server/institution/providers/types.ts',
      'packages/institution/src/intelligence.ts',
      'packages/institution/src/agents.ts',
      'packages/institution/src/course-agent-policy.ts',
    ],
    note: 'Tenant policy, approved sources, course policy, budget reserve and settle, prepare and confirm. The runtime accepts OpenAI models only. Not deployed.',
  },
  {
    id: 'DOOR-4',
    name: 'The institutional client',
    routes: ['institution-gateway'],
    files: ['app/src/lib/university.ts'],
    note: 'Does nothing until a school deploys a gateway and configures its address.',
  },
];

export interface AiSystem {
  id: string;
  /** The family of docs/trust/AI-SYSTEM-INVENTORY.md this is a child of. */
  family: 'AI-01' | 'AI-02' | 'AI-03' | 'AI-04';
  name: string;
  does: string;
  doors: readonly string[];
  /** Source files that reach a model for this system. The census test requires every such file in the tree to be listed once. */
  files: readonly string[];
  /** The designed ceiling, by the tiers of ai-assurance.ts. Tier 4 is refused at intake and never an entry. */
  tier: Exclude<RiskTier['tier'], 4>;
  /** Where the system stands today if that is lower than its designed ceiling, and why. */
  effective?: { tier: Exclude<RiskTier['tier'], 4>; why: string };
  /** The highest action tier of ai-playbook.ts the system can reach. */
  action: ActionTier;
  /** Whether the model chooses among tools (an agent loop) or fills a fixed schema. */
  agentLoop: boolean;
  /** The highest data tier of toolkit/classification.ts that can reach the model. */
  data: Tier;
  /** Required when `data` is T3 or above: why this is not the violation the classification gate would call it. */
  reconcile?: string;
  /** Whether academic integrity is a property of the output (it could be handed in as the student's own work). */
  integrity: boolean;
}

export const SYSTEMS: readonly AiSystem[] = [
  {
    id: 'AI-01.1', family: 'AI-01', name: 'Ask Semester assistant',
    does: 'A chat that reads the student’s own records through lookups and proposes writes as cards the student presses; each write carries its inverse.',
    doors: ['DOOR-1'], files: ['app/src/ai/converse.ts'],
    tier: 3, action: 'C', agentLoop: true, data: 'T3', integrity: true,
    reconcile: 'read_grades and read_attendance reach the model on consumer routes. The toolkit gate says T3 never goes to AI; the assistant predates it and is bounded by the per-school aiFlags category switches instead, which default to on. Reconcile before any institution-directed consumer route (docs/ai-governance/03-retrieval-policy.md RP-08).',
  },
  {
    id: 'AI-01.2', family: 'AI-01', name: 'Study support',
    does: 'Explanations, practice, teach-back, cross-course concept links, worked parallel problems, diagrams, decks, chart commentary, guide rebuilds.',
    doors: ['DOOR-1'],
    files: [
      'app/src/components/StudyStudio.tsx', 'app/src/components/TeachBack.tsx', 'app/src/components/Rework.tsx',
      'app/src/screens/Meet.tsx', 'app/src/screens/Exam.tsx', 'app/src/screens/Solve.tsx',
      'app/src/screens/Draw.tsx', 'app/src/screens/Deck.tsx', 'app/src/screens/Analyse.tsx',
    ],
    tier: 1, action: 'B', agentLoop: false, data: 'T2', integrity: false,
  },
  {
    id: 'AI-01.3', family: 'AI-01', name: 'Writing and drafting',
    does: 'Assignment breakdown and critique that refuses to write the assignment, a project file with blanks where claims go, non-coursework drafting behind gate(), email drafting and proofreading.',
    doors: ['DOOR-1'],
    files: [
      'app/src/lib/assignment.ts', 'app/src/screens/Work.tsx', 'app/src/components/ProjectFile.tsx',
      'app/src/screens/Essay.tsx', 'app/src/components/mail/Compose.tsx', 'app/src/components/CheckIt.tsx',
    ],
    tier: 1, action: 'B', agentLoop: false, data: 'T2', integrity: true,
  },
  {
    id: 'AI-01.4', family: 'AI-01', name: 'Planning narratives',
    does: 'Day, week and exam-runway reports and the weekly update. Every figure is counted in code; the model writes the sentences around them.',
    doors: ['DOOR-1'],
    files: ['app/src/screens/report/Day.tsx', 'app/src/screens/report/Week.tsx', 'app/src/screens/Runway.tsx', 'app/src/screens/Update.tsx'],
    tier: 1, action: 'A', agentLoop: false, data: 'T2', integrity: false,
  },
  {
    id: 'AI-01.5', family: 'AI-01', name: 'Outside-source finding',
    does: 'Suggests sources the course did not assign. The one surface not grounded in the student’s own material, so the one most exposed to fabricated citations.',
    doors: ['DOOR-1'], files: ['app/src/components/FindSources.tsx'],
    tier: 1, action: 'A', agentLoop: false, data: 'T2', integrity: true,
  },
  {
    id: 'AI-03.1', family: 'AI-03', name: 'Syllabus to course',
    does: 'Classifies what was handed in, then builds a course with every deadline carrying the sentence it came from, and maps other material onto shapes the app already stores.',
    doors: ['DOOR-1'],
    files: ['app/src/lib/generate.ts', 'app/src/lib/classify.ts', 'app/src/lib/harvest.ts', 'app/src/screens/Import.tsx'],
    tier: 1, action: 'B', agentLoop: false, data: 'T2', integrity: false,
  },
  {
    id: 'AI-03.2', family: 'AI-03', name: 'Photo and page reading',
    does: 'Transcribes photographed pages and scores, tables kept as tables, and files a score against a course.',
    doors: ['DOOR-1'], files: ['app/src/components/ScoreShot.tsx'],
    tier: 1, action: 'B', agentLoop: false, data: 'T2', integrity: false,
  },
  {
    id: 'AI-03.3', family: 'AI-03', name: 'Announcement to change proposals',
    does: 'Reads pasted prose and proposes date changes, each quoting the sentence it rests on, applied only when the student ticks it.',
    doors: ['DOOR-1'], files: ['app/src/screens/changes/FromText.tsx'],
    tier: 2, action: 'C', agentLoop: false, data: 'T2', integrity: false,
  },
  {
    id: 'AI-02.1', family: 'AI-02', name: 'Institutional intelligence',
    does: 'Four scoped roles (assistant, advisor, tutor, course guide) answering from tenant-approved sources under course policy, with prepare and confirm for actions, and advisor-agenda drafting.',
    doors: ['DOOR-3', 'DOOR-4'],
    files: ['app/src/components/ProductivityPreparation.tsx'],
    tier: 3,
    effective: { tier: 2, why: 'createInstitutionIntelligenceRuntime wires execute to () => ({ verified: false }): no AI-proposed action can run, so the consequential class is designed and not live.' },
    action: 'E', agentLoop: false, data: 'T1', integrity: true,
  },
];

/** Every route a system can take, from its doors. */
export const routesOf = (s: AiSystem): readonly Route[] => [
  ...new Set(s.doors.flatMap((id) => DOORS.find((d) => d.id === id)?.routes ?? [])),
];

/** The routes of a system that no server switch can stop. */
export const uncontained = (s: AiSystem): readonly Route[] => routesOf(s).filter((r) => KILL_REACH[r] === 'none');

const ACTION_FLOOR: Record<ActionTier, Exclude<RiskTier['tier'], 4>> = { A: 1, B: 1, C: 2, D: 3, E: 3 };

/**
 * The lowest tier a system's own properties allow: its action tier, whether the
 * model chooses tools, and whether it is bound to a named institution's sources.
 * A system may be placed higher than this floor, never lower.
 */
export function tierFloor(s: Pick<AiSystem, 'action' | 'agentLoop' | 'data'>): Exclude<RiskTier['tier'], 4> {
  let floor = ACTION_FLOOR[s.action];
  if (s.agentLoop) floor = 3;
  if (s.data === 'T1' && floor < 2) floor = 2;
  return floor;
}

/**
 * What each tier asks for before a pilot, beyond what the tier below asked.
 * The lines are the evaluation and authority columns of RISK_TIERS in
 * ai-assurance.ts, made checkable; the release gate of ai-lifecycle.ts applies
 * at every tier.
 */
export const TIER_GATES: Record<Exclude<RiskTier['tier'], 4>, readonly string[]> = {
  0: ['Accountable owner named', 'Basic quality and security review'],
  1: [
    'Evaluation run on synthetic cases: grounding, policy adherence, refusal, accessibility, misuse baseline',
    'Privacy and security approval recorded',
  ],
  2: [
    'Source fidelity measured against approved sources',
    'Tenant isolation proven through the AI path, not only the database',
    'Prompt-injection suite including retrieved and uploaded content',
    'Paired-prompt bias suite',
    'Human-handoff route tested end to end',
    'AI governance review recorded',
  ],
  3: [
    'Permission simulation for every tool, as every role',
    'Action preview rendered from typed arguments and bound to the confirmed action',
    'Kill-switch drill against this route, and incident tabletop',
    'Independent red-team not authored by the feature owner',
    'Legal, privacy and accessibility approval',
    'Staged rollout with a canary and a rehearsed rollback',
    'Governance council or executive delegate sign-off',
  ],
};

/** The full list a use case at `tier` must show before a pilot: the release gate, then every tier up to its own. */
export function launchRequirements(tier: Exclude<RiskTier['tier'], 4>): readonly string[] {
  const tiers = [0, 1, 2, 3].filter((t) => t <= tier) as (keyof typeof TIER_GATES)[];
  return [...AI_RELEASE_GATE, ...tiers.flatMap((t) => TIER_GATES[t])];
}
