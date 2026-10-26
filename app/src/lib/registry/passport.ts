// Component passport shape. Checks structure and the rules that make a passport
// honest, not whether the owners, policies, or tests it names exist.

export const PASSPORT_TYPES = [
  'capability',
  'service',
  'connector',
  'workflow',
  'policy',
  'screen',
  'data_store',
  'partner_application',
  'operational_control',
] as const;

export type PassportType = (typeof PASSPORT_TYPES)[number];

export type PassportProblem = { path: string; message: string };

// Uppercase prefix, then one or more dash-separated segments: WF-READINESS-001.
const ID_PATTERN = /^[A-Z]{2,4}(-[A-Z0-9]+)+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);

// A reference to another artifact must carry that artifact's prefix: POL-, EVD-, TST-, REL-, SLO-.
const refPattern = (prefix: string) => new RegExp(`^${prefix}-[A-Z0-9]+(-[A-Z0-9]+)*$`);

export function validatePassport(value: unknown): PassportProblem[] {
  const problems: PassportProblem[] = [];
  const need = (ok: boolean, path: string, message: string) => {
    if (!ok) problems.push({ path, message });
  };
  const refs = (path: string, list: unknown, prefix: string) => {
    if (!Array.isArray(list)) return;
    list.forEach((item, i) =>
      need(isText(item) && refPattern(prefix).test(item), `${path}[${i}]`, `must be a ${prefix}- identifier`),
    );
  };

  if (!isObject(value) || !isObject(value.passport)) {
    return [{ path: 'passport', message: 'must be an object with a passport key' }];
  }
  const p = value.passport;

  const section = (name: string): Obj => {
    const s = p[name];
    need(isObject(s), name, 'section is required');
    return isObject(s) ? s : {};
  };

  const identity = section('identity');
  need(isText(identity.id) && ID_PATTERN.test(identity.id), 'identity.id', 'must look like WF-READINESS-001');
  need(isText(identity.name), 'identity.name', 'is required');
  need(
    (PASSPORT_TYPES as readonly unknown[]).includes(identity.type),
    'identity.type',
    `must be one of ${PASSPORT_TYPES.join(', ')}`,
  );

  const accountability = section('accountability');
  for (const field of ['business_owner', 'technical_owner', 'operational_owner', 'review_cadence']) {
    need(isText(accountability[field]), `accountability.${field}`, 'is required');
  }

  const boundaries = section('boundaries');
  for (const field of ['authority_owner', 'data_classification', 'tenant_scope']) {
    need(isText(boundaries[field]), `boundaries.${field}`, 'is required');
  }
  for (const field of ['allowed_uses', 'prohibited_uses']) {
    need(
      isTextList(boundaries[field]) && (boundaries[field] as string[]).length > 0,
      `boundaries.${field}`,
      'must list at least one use',
    );
  }

  const dependencies = section('dependencies');
  need(isTextList(dependencies.upstream), 'dependencies.upstream', 'must be a list (may be empty)');
  need(isTextList(dependencies.downstream), 'dependencies.downstream', 'must be a list (may be empty)');
  for (const field of ['failure_mode', 'degradation_behavior']) {
    need(isText(dependencies[field]), `dependencies.${field}`, 'is required');
  }

  const controls = section('control_plane');
  need(isTextList(controls.policy_ids) && (controls.policy_ids as string[]).length > 0, 'control_plane.policy_ids', 'must list at least one policy');
  for (const field of ['audit_events', 'required_evidence']) {
    need(isTextList(controls[field]) && (controls[field] as string[]).length > 0, `control_plane.${field}`, 'must list at least one entry');
  }
  for (const field of ['release_gate', 'safe_off_path']) {
    need(isText(controls[field]), `control_plane.${field}`, 'is required');
  }
  refs('control_plane.policy_ids', controls.policy_ids, 'POL');
  refs('control_plane.required_evidence', controls.required_evidence, 'EVD');
  if (isText(controls.release_gate)) {
    need(refPattern('REL').test(controls.release_gate), 'control_plane.release_gate', 'must be a REL- identifier');
  }

  const quality = section('quality');
  need(isTextList(quality.test_suites) && (quality.test_suites as string[]).length > 0, 'quality.test_suites', 'must list at least one suite');
  need(
    isTextList(quality.accessibility_requirements) && (quality.accessibility_requirements as string[]).length > 0,
    'quality.accessibility_requirements',
    'must list at least one requirement',
  );
  refs('quality.test_suites', quality.test_suites, 'TST');
  if (quality.service_objectives !== undefined) {
    need(isTextList(quality.service_objectives), 'quality.service_objectives', 'must be a list of text');
    refs('quality.service_objectives', quality.service_objectives, 'SLO');
  }
  if (quality.source_freshness_requirements !== undefined) {
    need(isText(quality.source_freshness_requirements), 'quality.source_freshness_requirements', 'must be text');
  }

  const lifecycle = section('lifecycle');
  need(
    Number.isInteger(lifecycle.maturity_level) && (lifecycle.maturity_level as number) >= 0,
    'lifecycle.maturity_level',
    'must be a non-negative integer',
  );
  for (const field of ['current_status', 'retirement_plan']) {
    need(isText(lifecycle[field]), `lifecycle.${field}`, 'is required');
  }
  // "proposed" may carry placeholders; anything later must say when it was made and reviewed.
  if (lifecycle.current_status !== 'proposed') {
    for (const field of ['created_at', 'last_reviewed_at']) {
      need(
        typeof lifecycle[field] === 'string' && ISO_DATE.test(lifecycle[field] as string),
        `lifecycle.${field}`,
        'must be a YYYY-MM-DD date once the passport is past proposed',
      );
    }
  }

  return problems;
}
