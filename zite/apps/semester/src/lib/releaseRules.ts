// Sanitised releases across trust boundaries (owner register S-85: C19 institution → company, C21 lab → company,
// C22 lab → institution). Pure. Each builder copies an explicit allowlist of fields, so anything added upstream later
// (detail text, evidence summaries, references, counts of people) does not leak by default.
export type CheckState = 'ok' | 'blocked' | 'info';
export type ReadinessRelease = { ready: boolean; generatedAt: string; checks: { key: string; label: string; state: CheckState }[] };

export function readinessRelease(r: { ready: boolean; generatedAt: string; checks: { key: string; label: string; state: string; [k: string]: unknown }[] }): ReadinessRelease {
  const states: CheckState[] = ['ok', 'blocked', 'info'];
  return {
    ready: !!r.ready, generatedAt: String(r.generatedAt),
    checks: r.checks.map((c) => ({ key: String(c.key).slice(0, 40), label: String(c.label).slice(0, 80), state: states.includes(c.state as CheckState) ? (c.state as CheckState) : 'info' })),
  };
}

export type AssuranceRelease = { capabilityId: string; capability: string; domain: string; stages: string[]; environments: string[]; evidenceCount: number };
/** Release coverage only: which stages have evidence and in which environments. Never summaries, references or reviewers. */
export function assuranceRelease(cap: { id: string; capability: string; domain: string }, evidence: { stage?: string | null; environment?: string | null; [k: string]: unknown }[]): AssuranceRelease {
  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.map((x) => String(x ?? '').trim()).filter(Boolean))].sort();
  return { capabilityId: cap.id, capability: cap.capability, domain: cap.domain, stages: uniq(evidence.map((e) => e.stage)), environments: uniq(evidence.map((e) => e.environment)), evidenceCount: evidence.length };
}
/** Production evidence never leaves the lab as part of a release: the lab works on synthetic and sandbox data only. */
export function assuranceProblems(evidence: { environment?: string | null }[]): string[] {
  return evidence.some((e) => /prod/i.test(String(e.environment ?? ''))) ? ['This capability has evidence recorded against production; release only synthetic or sandbox evidence.'] : [];
}
