/**
 * What an identity provider may tell Semester about a person, and what it
 * may never be asked for.
 *
 * SAML sign-in (`app/server/institution/auth.ts`), SCIM provisioning
 * (`provisioning.ts`) and LTI launch (`supabase/functions/_shared/lti.ts`) each
 * already read a fixed handful of fields and ignore the rest. The one place an
 * administrator could widen that is `institution_identity_provider.
 * attribute_mapping` — a free JSON column with nothing constraining it, so a
 * mapping of a campus `gpa` attribute into a tenant's provider row would have
 * been accepted and kept. This file is the rule, and
 * `20260927120000_identity_claim_minimization.sql` is the same rule as a check
 * constraint; `identity.test.ts` holds the two lists equal.
 *
 * ## The allowlist is the guard; the deny list is the explanation
 *
 * A mapping is `{ "<Semester claim>": "<IdP attribute name>" }`. The key must be
 * one of `IDENTITY_CLAIMS`, so whatever an IdP sends can only ever land in a
 * name, a contact address, an affiliation or a scope. The deny list catches
 * the honest mistake — a source attribute *called* `gpa` or `disabilityStatus`
 * — and says which FERPA category it hit. It cannot catch a prohibited
 * attribute sent under an opaque OID, and does not pretend to: that case is
 * still confined to an allowed claim by the key check, and is why claim
 * mappings are reviewed by a person before a provider is authorized.
 *
 * ## Mapping a claim grants nothing
 *
 * `affiliation` and `groups` are candidate inputs. Roles come only from
 * administrator-approved `scim_group_mapping` rows and are then checked by
 * `private.has_capability`; see `docs/SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md`.
 */

/** The Semester-side claims an attribute mapping may populate. */
export const IDENTITY_CLAIMS = [
  'subject',
  'email',
  'display_name',
  'given_name',
  'family_name',
  'affiliation',
  'groups',
  'campus',
  'department',
] as const;

export type IdentityClaim = (typeof IDENTITY_CLAIMS)[number];

/**
 * Fragments that mark a source attribute as a record no identity flow may
 * carry. Compared against the attribute name lowercased with everything but
 * letters and digits removed, so `Financial_Aid`, `financial-aid` and
 * `financialAid` are one name.
 *
 * Deliberately specific: `grade` rather than `grad` (which would refuse
 * `graduationYear`), `dateofbirth` rather than `dob` (which is inside
 * `adobeid`). One over-refusal is kept on purpose: `ssn` is also inside
 * `className` and `businessName`. A false refusal fails closed — the
 * administrator maps a different source attribute — while a false pass would
 * let a Social Security number be kept, so the fragment stays.
 */
export const PROHIBITED_ATTRIBUTE_FRAGMENTS = [
  ['gpa', 'grades and GPA'],
  ['grade', 'grades and GPA'],
  ['transcript', 'grades and GPA'],
  ['financialaid', 'financial aid'],
  ['fafsa', 'financial aid'],
  ['health', 'health, disability and counseling'],
  ['medical', 'health, disability and counseling'],
  ['disability', 'health, disability and counseling'],
  ['accommodation', 'health, disability and counseling'],
  ['counsel', 'health, disability and counseling'],
  ['conduct', 'conduct records'],
  ['disciplin', 'conduct records'],
  ['immigration', 'immigration records'],
  ['visa', 'immigration records'],
  ['citizenship', 'immigration records'],
  ['ssn', 'government identifiers'],
  ['socialsecurity', 'government identifiers'],
  ['dateofbirth', 'government identifiers'],
  ['birthdate', 'government identifiers'],
  ['roster', 'rosters and enrollments'],
  ['enrollment', 'rosters and enrollments'],
  ['submission', 'student submissions'],
  ['attendance', 'attendance and location'],
  ['geolocation', 'attendance and location'],
  ['locationhistory', 'attendance and location'],
  ['privatemessage', 'private messages'],
] as const satisfies readonly (readonly [string, string])[];

export type AttributeMapping = Partial<Record<IdentityClaim, string>>;

export type MappingVerdict =
  | { ok: true; mapping: AttributeMapping }
  | { ok: false; claim: string; reason: string };

const normalized = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The FERPA category an attribute name falls in, or null when it is clear. */
export function prohibitedCategory(attribute: string): string | null {
  const flat = normalized(attribute);
  for (const [fragment, category] of PROHIBITED_ATTRIBUTE_FRAGMENTS) {
    if (flat.includes(fragment)) return category;
  }
  return null;
}

/**
 * Whether a provider's attribute mapping may be stored, and if not, the first
 * entry that refused it. Same rule as the database constraint.
 */
export function checkAttributeMapping(value: unknown): MappingVerdict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, claim: '', reason: 'An attribute mapping is an object of claim to attribute name.' };
  }
  const known = new Set<string>(IDENTITY_CLAIMS);
  const mapping: AttributeMapping = {};
  for (const [claim, attribute] of Object.entries(value)) {
    if (!known.has(claim)) {
      return { ok: false, claim, reason: `"${claim}" is not a claim Semester accepts from an identity provider.` };
    }
    if (typeof attribute !== 'string' || !attribute.trim() || attribute.length > 300) {
      return { ok: false, claim, reason: `The attribute mapped to "${claim}" must be a name of 1 to 300 characters.` };
    }
    const category = prohibitedCategory(attribute);
    if (category) {
      return { ok: false, claim, reason: `"${attribute}" reads as ${category}, which no identity flow may carry.` };
    }
    mapping[claim as IdentityClaim] = attribute.trim();
  }
  return { ok: true, mapping };
}

/**
 * The claims Semester keeps from one assertion: only mapped attributes, only
 * string values (arrays for `groups`), each bounded. Everything else in the
 * assertion is dropped rather than stored for later.
 */
export function minimizeClaims(
  assertion: Readonly<Record<string, unknown>>,
  mapping: AttributeMapping,
): Partial<Record<IdentityClaim, string | string[]>> {
  const kept: Partial<Record<IdentityClaim, string | string[]>> = {};
  for (const claim of IDENTITY_CLAIMS) {
    const source = mapping[claim];
    if (!source || prohibitedCategory(source)) continue;
    const raw = assertion[source];
    if (claim === 'groups') {
      const list = (Array.isArray(raw) ? raw : [raw])
        .filter((g): g is string => typeof g === 'string' && !!g.trim() && g.length <= 300)
        .slice(0, 200);
      if (list.length) kept.groups = list;
    } else if (typeof raw === 'string' && raw.trim() && raw.length <= 300) {
      kept[claim] = raw.trim();
    }
  }
  return kept;
}
