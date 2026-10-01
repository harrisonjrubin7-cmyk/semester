/** Student-owned planning; no registration or external sending side effects. */
export const TRIAGE = [
  'Needs action',
  'Needs decision',
  'Waiting on someone',
  'Saved for later',
  'Completed',
  'Archived',
] as const;
export const IMPORTANCE = [
  'Not included',
  'Nice to have',
  'Important',
  'Essential',
] as const;
export const FITS = ['unknown', 'weak', 'moderate', 'strong'] as const;
export type FitState = (typeof FITS)[number];
export interface Criterion {
  id: string;
  label: string;
  weight: number;
}
export interface Evidence {
  fit: FitState;
  explanation: string;
  source: string;
  checked: string;
}
export interface DecisionOption {
  id: string;
  title: string;
  official: string;
  fits: Record<string, Evidence>;
}
export interface Assumption {
  id: string;
  label: string;
  value: string;
  owner: 'student' | 'estimate' | 'institution' | 'AI' | 'scenario';
  source: string;
  impacts: string;
  review: boolean;
}
export interface Decision {
  id: string;
  title: string;
  goal: string;
  options: DecisionOption[];
  criteria: Criterion[];
  assumptions: Assumption[];
  questions: string;
  revisit: string;
  reflection: string;
  paused: boolean;
  decided: boolean;
}
export interface Capture {
  id: string;
  title: string;
  kind: string;
  source: string;
  reason: string;
  context: string;
  next: string;
  due: string;
  status: (typeof TRIAGE)[number];
  authorized: boolean;
}
export interface Draft {
  id: string;
  title: string;
  body: string;
  status: 'Prepared' | 'Saved';
}
export interface Snapshot {
  id: string;
  at: string;
  decision: Decision;
}
export interface Productivity {
  version: 1;
  decisions: Decision[];
  captures: Capture[];
  drafts: Draft[];
  journal: Snapshot[];
  preferences: Assumption[];
}
export const EMPTY_PRODUCTIVITY: Productivity = {
  version: 1,
  decisions: [],
  captures: [],
  drafts: [],
  journal: [],
  preferences: [],
};
export const id = () => crypto.randomUUID();
export function newDecision(title: string): Decision {
  return {
    id: id(),
    title,
    goal: '',
    options: [],
    criteria: [
      'Requirement fit',
      'Schedule fit',
      'Eligibility clarity',
      'Interest',
      'Workload estimate',
      'Career relevance',
      'Cost / location',
    ].map((label, i) => ({ id: id(), label, weight: i < 3 ? 3 : 2 })),
    assumptions: [],
    questions: '',
    revisit: '',
    reflection: '',
    paused: false,
    decided: false,
  };
}
export function newOption(title: string): DecisionOption {
  return { id: id(), title, official: '', fits: {} };
}
export function supportedFit(option: DecisionOption, criteria: Criterion[]) {
  const active = criteria.filter((c) => c.weight > 0);
  const known = active.filter(
    (c) => option.fits[c.id]?.fit && option.fits[c.id].fit !== 'unknown',
  );
  const weights = known.reduce((n, c) => n + c.weight, 0);
  const total = active.reduce((n, c) => n + c.weight, 0);
  const values = { weak: 0, moderate: 0.5, strong: 1, unknown: 0 };
  return {
    fit: weights
      ? known.reduce(
          (n, c) => n + c.weight * values[option.fits[c.id].fit],
          0,
        ) / weights
      : null,
    coverage: total ? weights / total : 0,
    unknown: active.length - known.length,
  };
}
export function readiness(d: Decision) {
  const evidence = d.options.flatMap((o) =>
    d.criteria.filter((c) => c.weight > 0).map((c) => o.fits[c.id]),
  );
  const checks = [
    { label: 'Goal stated', done: !!d.goal.trim() },
    { label: 'At least two options considered', done: d.options.length >= 2 },
    {
      label: 'Sources checked',
      done: evidence.length > 0 && evidence.every((e) => currentEvidence(e)),
    },
    { label: 'Preferences set', done: d.criteria.some((c) => c.weight > 0) },
    { label: 'Assumptions visible', done: d.assumptions.length > 0 },
    {
      label: 'Official questions resolved',
      done: !d.questions.trim() && !d.assumptions.some((a) => a.review),
    },
  ];
  const state = d.paused
    ? 'Paused by student'
    : d.decided
      ? 'Decided and saved'
      : !checks[5].done
        ? 'Needs official review'
        : !checks[2].done
          ? 'Needs one source check'
          : checks.every((c) => c.done)
            ? 'Ready to save'
            : 'Waiting on information';
  return { checks, state };
}
export function advisorPacket(d: Decision): string {
  return [
    `# ${d.title}`,
    `Goal: ${d.goal}`,
    `Planning comparison; no official registration submitted.`,
    ...d.options.map(
      (o) =>
        `\n## ${o.title}\nOfficial route: ${o.official || 'Ask your advisor or official owner'}\n` +
        d.criteria
          .map((c) => {
            const e = o.fits[c.id];
            return `${c.label} (${IMPORTANCE[c.weight]}): ${e?.fit || 'unknown'} — ${e?.explanation || 'Needs review'}\nSource: ${e?.source || 'Missing'} · checked: ${e?.checked || 'Unknown'}`;
          })
          .join('\n'),
    ),
    '\n## Assumptions',
    ...d.assumptions.map(
      (a) =>
        `${a.label}: ${a.value} (${a.owner}) · ${a.source || 'Source not recorded'}${a.review ? ' · needs review' : ''}`,
    ),
    `\nQuestions: ${d.questions || 'None recorded'}`,
    `Revisit: ${d.revisit || 'Not set'}`,
  ].join('\n');
}
/** Reject damaged records rather than silently overwriting student work. */
export function readProductivity(value: unknown): Productivity {
  const v = value as Productivity;
  const text = (x: unknown) => typeof x === 'string';
  const assumption = (a: Assumption) =>
    a &&
    text(a.id) &&
    text(a.label) &&
    text(a.value) &&
    ['student', 'estimate', 'institution', 'AI', 'scenario'].includes(
      a.owner,
    ) &&
    text(a.source) &&
    text(a.impacts) &&
    typeof a.review === 'boolean';
  const decision = (d: Decision): boolean =>
    !!d &&
    text(d.id) &&
    text(d.title) &&
    text(d.goal) &&
    text(d.questions) &&
    text(d.revisit) &&
    text(d.reflection) &&
    typeof d.paused === 'boolean' &&
    typeof d.decided === 'boolean' &&
    Array.isArray(d.options) &&
    d.options.length <= 3 &&
    d.options.every(
      (o) =>
        o &&
        text(o.id) &&
        text(o.title) &&
        text(o.official) &&
        o.fits &&
        typeof o.fits === 'object' &&
        Object.values(o.fits).every(
          (e) =>
            e &&
            FITS.includes(e.fit) &&
            text(e.explanation) &&
            text(e.source) &&
            text(e.checked),
        ),
    ) &&
    Array.isArray(d.criteria) &&
    d.criteria.every(
      (c) =>
        c &&
        text(c.id) &&
        text(c.label) &&
        Number.isInteger(c.weight) &&
        c.weight >= 0 &&
        c.weight <= 3,
    ) &&
    Array.isArray(d.assumptions) &&
    d.assumptions.every(assumption);
  if (
    !v ||
    v.version !== 1 ||
    !Array.isArray(v.decisions) ||
    !v.decisions.every(decision) ||
    !Array.isArray(v.captures) ||
    !v.captures.every(
      (c) =>
        c &&
        [
          'id',
          'title',
          'kind',
          'source',
          'reason',
          'context',
          'next',
          'due',
        ].every((k) => text(c[k as keyof Capture])) &&
        TRIAGE.includes(c.status) &&
        typeof c.authorized === 'boolean',
    ) ||
    !Array.isArray(v.drafts) ||
    !v.drafts.every(
      (d) =>
        d &&
        text(d.id) &&
        text(d.title) &&
        text(d.body) &&
        ['Prepared', 'Saved'].includes(d.status),
    ) ||
    !Array.isArray(v.journal) ||
    !v.journal.every(
      (s) => s && text(s.id) && text(s.at) && decision(s.decision),
    ) ||
    !Array.isArray(v.preferences) ||
    !v.preferences.every(assumption)
  )
    throw new Error('Invalid productivity workspace');
  return v;
}
export const TEMPLATES: Record<string, string> = {
  'Advisor agenda':
    'Purpose:\nDesired outcome:\nCurrent plan:\nQuestions:\nSource links:\nDocuments to bring:\nFollow-up actions:',
  'Office-hours question':
    'Course:\nWhat I tried:\nWhere I got stuck:\nSpecific question:\nRelevant source:',
  'Tutor request':
    'Course / topic:\nGoal:\nAvailability:\nWork attempted:\nSource:',
  'Research outreach email':
    'Recipient:\nResearch interest:\nRelevant experience:\nSpecific question:\nAvailability:\nSource:',
  'Internship outreach email':
    'Recipient:\nOpportunity:\nWhy I am interested:\nRelevant evidence:\nRequest:\nSource:',
  'Scholarship tracker':
    'Scholarship:\nOfficial source:\nDeadline:\nEligibility to confirm:\nDocuments:\nNext action:',
  'Study plan':
    'Course:\nGoal:\nSources:\nStudy blocks:\nPractice:\nNext review:',
  'Exam review plan':
    'Exam / date:\nTopics:\nSources:\nPractice questions:\nWork blocks:\nQuestions for help:',
  'Lab report structure':
    'Question:\nMethods:\nResults:\nAnalysis:\nLimitations:\nSources:',
  'Essay outline':
    'Prompt:\nThesis:\nEvidence and sources:\nCounterargument:\nConclusion:\nWork blocks:',
  'Group project charter':
    'Goal:\nRoles:\nMilestones:\nCommunication:\nFiles:\nQuestions:\nAgreement:',
  'Meeting agenda':
    'Purpose:\nDesired outcome:\nQuestions:\nSources / documents:\nNotes during meeting:\nDecisions:\nFollow-up actions:\nNext meeting:',
  'Course override request':
    'Course:\nOfficial owner:\nReason:\nPrerequisites / evidence:\nPolicy source:\nQuestion:',
  'Study abroad comparison':
    'Programs:\nCredit approval questions:\nCost estimates / currency:\nDeadlines:\nOfficial sources:\nNext action:',
  'Transfer-credit packet':
    'Course / institution:\nSyllabus:\nTranscript:\nOfficial policy:\nApproval questions:\nNext review:',
  'Career fair prep':
    'Goal:\nOrganizations:\nQuestions:\nResume:\nSource links:\nFollow-up:',
  'Resume bullet': 'Action:\nContext:\nResult supported by evidence:\nSource:',
  Reflection:
    'Decision:\nDid workload feel realistic?\nDid it fit my goal?\nWhat would I change?\nPreference update I choose:',
  'Registration packet':
    'Plan:\nBackup sections:\nEligibility questions:\nOfficial sources:\nDeadline:\nAdvisor questions:',
  'Career application checklist':
    'Opportunity:\nOfficial deadline:\nResume:\nDraft email:\nWriting sample:\nNext action:',
  'Source summary':
    'Source URL / owner:\nLast checked:\nWhat it says:\nUncertainty:\nQuestions:',
};

export function currentEvidence(
  e: Evidence | undefined,
  now = Date.now(),
): boolean {
  if (
    !e ||
    e.fit === 'unknown' ||
    !e.source.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(e.checked)
  )
    return false;
  const [year, month, day] = e.checked.split('-').map(Number);
  const parsed = new Date(`${e.checked}T12:00:00`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  )
    return false;
  const today = new Date(now);
  const age =
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
    Date.UTC(year, month - 1, day);
  return age >= 0 && age <= 30 * 86400000;
}
/** Preserve recorded fits, but require source review after changing planning inputs. */
export function withAssumption(d: Decision, a: Assumption): Decision {
  const before = d.assumptions.find((x) => x.id === a.id);
  if (before?.owner === 'institution')
    throw new Error('Institution-owned assumptions cannot be overwritten');
  return {
    ...d,
    decided: false,
    assumptions: [...d.assumptions.filter((x) => x.id !== a.id), a],
    options: d.options.map((o) => ({
      ...o,
      fits: Object.fromEntries(
        Object.entries(o.fits).map(([key, evidence]) => [
          key,
          { ...evidence, checked: '' },
        ]),
      ),
    })),
  };
}
