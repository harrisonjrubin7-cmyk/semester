import { PATCH_POLICY } from '../supplychain';

export type FindingSeverity = (typeof PATCH_POLICY)[number]['severity'];
export type FindingStatus = 'open' | 'mitigated' | 'fixed' | 'risk-accepted' | 'closed';

export interface ScanReference {
  scanner: string;
  run: string;
  artifact: string;
  digest: string;
  commit: string;
  detectedAt: string;
}

export interface FindingEvent {
  type: 'opened' | 'assigned' | 'mitigated' | 'fixed' | 'risk-accepted' | 'retest-passed' | 'retest-failed';
  at: string;
  detail: string;
}

export interface RetestReference {
  scanner: string;
  run: string;
  artifact: string;
  digest: string;
  testedCommit: string;
  result: 'passed' | 'failed';
  at: string;
}

export interface Finding {
  id: string;
  severity: FindingSeverity;
  component: string;
  summary: string;
  owner: string;
  source: ScanReference;
  dueAt: string;
  status: FindingStatus;
  revision: number;
  history: readonly FindingEvent[];
  mitigation?: { control: string; evidence: string };
  fix?: { commit: string; remediation: string };
  acceptance?: { approver: string; reason: string; expiresAt: string };
  retest?: RetestReference;
}

export interface OpenFinding {
  id: string;
  severity: FindingSeverity;
  component: string;
  summary: string;
  owner: string;
  source: ScanReference;
}

type Versioned = { expectedRevision: number; at: string };
export type FindingCommand =
  | (Versioned & { type: 'assign'; owner: string })
  | (Versioned & { type: 'mitigate'; control: string; evidence: string })
  | (Versioned & { type: 'fix'; fixedCommit: string; remediation: string })
  | (Versioned & { type: 'risk-accept'; approver: string; reason: string; expiresAt: string })
  | (Versioned & RetestReference & { type: 'retest' });

const SHA = /^[a-f0-9]{40}$/i;
const DIGEST = /^sha256:[a-f0-9]{64}$/i;

const text = (value: string, name: string): string => {
  const out = value.trim();
  if (!out) throw new Error(`${name} is required`);
  return out;
};

const instant = (value: string, name: string): Date => {
  const out = new Date(value);
  if (!Number.isFinite(out.getTime())) throw new Error(`${name} must be an ISO timestamp`);
  return out;
};

const commit = (value: string): string => {
  if (!SHA.test(value)) throw new Error('commit must be an exact 40-character SHA');
  return value.toLowerCase();
};

const digest = (value: string): string => {
  if (!DIGEST.test(value)) throw new Error('digest must be an exact sha256 value');
  return value.toLowerCase();
};

const scanReference = (source: ScanReference): ScanReference => ({
  scanner: text(source.scanner, 'scanner'),
  run: text(source.run, 'run'),
  artifact: text(source.artifact, 'artifact'),
  digest: digest(source.digest),
  commit: commit(source.commit),
  detectedAt: instant(source.detectedAt, 'detectedAt').toISOString(),
});

export function openFinding(input: OpenFinding): Finding {
  const source = scanReference(input.source);
  const target = PATCH_POLICY.find((row) => row.severity === input.severity);
  if (!target) throw new Error(`severity ${input.severity as string} has no patch policy`);
  const due = new Date(instant(source.detectedAt, 'detectedAt').getTime() + target.days * 86_400_000);
  return {
    id: text(input.id, 'id'),
    severity: input.severity,
    component: text(input.component, 'component'),
    summary: text(input.summary, 'summary'),
    owner: text(input.owner, 'owner'),
    source,
    dueAt: due.toISOString(),
    status: 'open',
    revision: 1,
    history: [{ type: 'opened', at: source.detectedAt, detail: `${source.scanner}:${source.run}` }],
  };
}

const next = (finding: Finding, event: FindingEvent, patch: Partial<Finding>): Finding => ({
  ...finding,
  ...patch,
  revision: finding.revision + 1,
  history: [...finding.history, event],
});

export function transition(finding: Finding, command: FindingCommand): Finding {
  if (finding.status === 'closed') throw new Error('a closed finding cannot transition; open a new finding if it recurs');
  if (command.expectedRevision !== finding.revision) throw new Error(`stale finding revision: expected ${command.expectedRevision}, current ${finding.revision}`);
  const at = instant(command.at, 'at').toISOString();
  const last = finding.history.at(-1);
  if (last && instant(at, 'at') < instant(last.at, 'last event')) throw new Error('event time precedes the finding history');

  if (command.type === 'assign') {
    const owner = text(command.owner, 'owner');
    return next(finding, { type: 'assigned', at, detail: owner }, { owner });
  }
  if (command.type === 'mitigate') {
    const mitigation = { control: text(command.control, 'control'), evidence: text(command.evidence, 'evidence') };
    return next(finding, { type: 'mitigated', at, detail: `${mitigation.control}; ${mitigation.evidence}` }, { status: 'mitigated', mitigation });
  }
  if (command.type === 'fix') {
    const fix = { commit: commit(command.fixedCommit), remediation: text(command.remediation, 'remediation') };
    return next(finding, { type: 'fixed', at, detail: `${fix.commit}; ${fix.remediation}` }, { status: 'fixed', fix, retest: undefined });
  }
  if (command.type === 'risk-accept') {
    const expiresAt = instant(command.expiresAt, 'expiry').toISOString();
    if (expiresAt <= at) throw new Error('risk-acceptance expiry must be after the approval time');
    const acceptance = {
      approver: text(command.approver, 'approver'),
      reason: text(command.reason, 'reason'),
      expiresAt,
    };
    return next(finding, { type: 'risk-accepted', at, detail: `${acceptance.approver}; expires ${expiresAt}` }, { status: 'risk-accepted', acceptance });
  }

  if (finding.status !== 'fixed' || !finding.fix) throw new Error('a retest requires a fixed finding and its exact fixed commit');
  const retest: RetestReference = {
    scanner: text(command.scanner, 'scanner'),
    run: text(command.run, 'run'),
    artifact: text(command.artifact, 'artifact'),
    digest: digest(command.digest),
    testedCommit: commit(command.testedCommit),
    result: command.result,
    at,
  };
  if (retest.run === finding.source.run) throw new Error('retest must cite an independent scan run');
  if (retest.testedCommit !== finding.fix.commit) throw new Error('retest must exercise the exact fixed commit');
  const passed = retest.result === 'passed';
  return next(
    finding,
    { type: passed ? 'retest-passed' : 'retest-failed', at, detail: `${retest.scanner}:${retest.run}; ${retest.digest}` },
    { status: passed ? 'closed' : 'open', retest },
  );
}

export function isOverdue(finding: Finding, now: string): boolean {
  return finding.status !== 'closed' && instant(now, 'now') > instant(finding.dueAt, 'dueAt');
}
