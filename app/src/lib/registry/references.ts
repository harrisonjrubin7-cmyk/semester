// Reference resolution for component passports. validatePassport checks that a
// reference carries the right prefix; this checks that it names something. Until
// policy, evidence, test, release and SLO records exist, a passport is the only
// resolvable artifact, so a reference resolves when some passport declares it.

export type PassportRecord = { file: string; value: unknown };
export type ReferenceSite = { file: string; field: string; id: string };

type Obj = Record<string, unknown>;

// Fields whose values name other artifacts. `upstream`, `downstream` and
// `audit_events` are free text and are deliberately not listed.
const REFERENCE_FIELDS = [
  ['control_plane', 'policy_ids'],
  ['control_plane', 'required_evidence'],
  ['control_plane', 'release_gate'],
  ['quality', 'test_suites'],
  ['quality', 'service_objectives'],
] as const;

const isObject = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);

const passportOf = (value: unknown): Obj | undefined =>
  isObject(value) && isObject(value.passport) ? value.passport : undefined;

export function declaredIds(records: readonly PassportRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const { value } of records) {
    const identity = passportOf(value)?.identity;
    if (isObject(identity) && typeof identity.id === 'string') ids.add(identity.id);
  }
  return ids;
}

export function referenceSites(records: readonly PassportRecord[]): ReferenceSite[] {
  const sites: ReferenceSite[] = [];
  for (const { file, value } of records) {
    const passport = passportOf(value);
    if (!passport) continue;
    for (const [section, field] of REFERENCE_FIELDS) {
      const block = passport[section];
      if (!isObject(block)) continue;
      const raw = block[field];
      const ids: unknown[] = typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : [];
      for (const id of ids) {
        if (typeof id === 'string') sites.push({ file, field: `${section}.${field}`, id });
      }
    }
  }
  return sites;
}

export function danglingReferences(records: readonly PassportRecord[]): ReferenceSite[] {
  const declared = declaredIds(records);
  return referenceSites(records).filter((site) => !declared.has(site.id));
}
