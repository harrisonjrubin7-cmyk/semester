import { EVIDENCE_KINDS, MATURITY_STAGES, type CapabilityRecord, type EvidenceKind, type MaturityStage, type RegistrySnapshot, type ValidationIssue } from '../types.ts';

const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const requiredEvidenceKinds: Record<MaturityStage, readonly EvidenceKind[]> = {
  designed: ['design'],
  schema: ['schema', 'test'],
  policies: ['code', 'test'],
  api: ['code', 'test'],
  user_interface: ['code', 'test'],
  e2e_tested: ['test'],
  staged: ['deployment'],
  production_ready: ['deployment', 'approval'],
  tenant_activated: ['activation', 'approval'],
  monitored: ['monitoring'],
};

export function validateCapabilities(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const systems = new Set(snapshot.systems.map(({ key }) => key));
  const roles = new Set(snapshot.roles.map(({ key }) => key));
  const seen = new Set<string>();

  for (const capability of snapshot.capabilities) {
    const path = `capabilities.${capability.key}`;
    if (!keyPattern.test(capability.key)) issues.push({ code: 'invalid_key', path, message: 'Capability key must be stable lower-case dotted notation.' });
    if (seen.has(capability.key)) issues.push({ code: 'duplicate_key', path, message: 'Capability key is duplicated.' });
    seen.add(capability.key);
    if (!capability.owner.trim()) issues.push({ code: 'missing_owner', path, message: 'Capability requires an owner.' });

    for (const system of capability.systems) {
      if (!systems.has(system)) issues.push({ code: 'unknown_system', path: `${path}.systems`, message: `Unknown system ${system}.` });
    }
    for (const role of Object.keys(capability.roles)) {
      if (!roles.has(role)) issues.push({ code: 'unknown_role', path: `${path}.roles`, message: `Unknown role ${role}.` });
    }

    let previous = true;
    for (const stage of MATURITY_STAGES) {
      const value = capability.maturity[stage];
      const candidateEvidence: unknown = capability.evidence[stage];
      const evidence: unknown[] = Array.isArray(candidateEvidence) ? candidateEvidence : [];
      if (typeof value !== 'boolean') issues.push({ code: 'missing_maturity_stage', path: `${path}.maturity.${stage}`, message: 'Every maturity stage must be explicit.' });
      if (value && !previous) issues.push({ code: 'maturity_gap', path: `${path}.maturity.${stage}`, message: `Stage ${stage} cannot be true after an earlier false stage.` });
      if (value && evidence.length === 0) issues.push({ code: 'missing_stage_evidence', path: `${path}.evidence.${stage}`, message: `True stage ${stage} requires evidence.` });
      const kinds = new Set<EvidenceKind>();
      for (const [index, reference] of evidence.entries()) {
        const evidencePath = `${path}.evidence.${stage}.${index}`;
        if (typeof reference !== 'object' || reference === null) {
          issues.push({ code: 'invalid_evidence_reference', path: evidencePath, message: 'Evidence must be an object with path and kind.' });
          continue;
        }
        const value = reference as { path?: unknown; kind?: unknown };
        if (typeof value.path !== 'string' || !value.path.trim()) issues.push({ code: 'missing_evidence_path', path: evidencePath, message: 'Evidence reference requires a repository path.' });
        if (typeof value.kind !== 'string' || !(EVIDENCE_KINDS as readonly string[]).includes(value.kind)) {
          issues.push({ code: 'invalid_evidence_kind', path: evidencePath, message: `Unknown evidence kind ${String(value.kind)}.` });
        } else kinds.add(value.kind as EvidenceKind);
      }
      if (value) for (const kind of requiredEvidenceKinds[stage]) {
        if (!kinds.has(kind)) issues.push({ code: 'missing_evidence_kind', path: `${path}.evidence.${stage}`, message: `True stage ${stage} requires ${kind} evidence.` });
      }
      previous = previous && value;
    }
  }
  return issues;
}

export function capabilityReport(capabilities: CapabilityRecord[]) {
  return capabilities.map((capability) => ({
    key: capability.key,
    owner: capability.owner,
    maturity: capability.maturity,
    evidence: capability.evidence,
    highestProvenStage: [...MATURITY_STAGES].reverse().find((stage) => capability.maturity[stage]) ?? null,
    nextUnprovenStage: MATURITY_STAGES.find((stage) => !capability.maturity[stage]) ?? null,
  }));
}
