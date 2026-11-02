export type JwtInput = {
  alg: string; kid: string; signatureValid: boolean;
  iss: string; aud: string; sub: string; typ: string;
  expOffset: number; nbfOffset: number; // seconds relative to now
  tenant: string; workspace: string;
  membership: 'active' | 'revoked';
  assignmentExpired: boolean; capabilityGranted: boolean;
  consentRequired: boolean; consentActive: boolean;
  entitlementActive: boolean;
  targetTenant: string; targetWorkspace: string;
};

export const BASE: JwtInput = {
  alg: 'RS256', kid: 'semester-test-2026', signatureValid: true,
  iss: 'https://id.semester.test', aud: 'semester-api', sub: 'usr_alice', typ: 'at+jwt',
  expOffset: 600, nbfOffset: -60, tenant: 'inst_A', workspace: 'ws_A1',
  membership: 'active', assignmentExpired: false, capabilityGranted: true,
  consentRequired: false, consentActive: true, entitlementActive: true,
  targetTenant: 'inst_A', targetWorkspace: 'ws_A1',
};

export const PRESETS: Record<string, Partial<JwtInput>> = {
  valid: {},
  expired: { expOffset: -120 },
  'not-yet-valid': { nbfOffset: 300 },
  'wrong issuer': { iss: 'https://evil.example' },
  'wrong audience': { aud: 'other-api' },
  'unsupported algorithm': { alg: 'none' },
  'unknown signing key': { kid: 'attacker-key' },
  'invalid signature': { signatureValid: false },
  'missing subject': { sub: '' },
  'revoked membership': { membership: 'revoked' },
  'expired assignment': { assignmentExpired: true },
  'wrong tenant': { targetTenant: 'inst_B', targetWorkspace: 'ws_B1' },
  'wrong workspace': { targetWorkspace: 'ws_A2' },
  'missing consent': { consentRequired: true, consentActive: false },
  'missing entitlement': { entitlementActive: false },
};

const SKEW = 60;
export type Layer = { name: string; result: 'pass' | 'fail' | 'skipped'; codes: string[] };

export function evaluate(i: JwtInput) {
  const layers: Layer[] = [];
  const add = (name: string, codes: string[], skip: boolean) =>
    layers.push({ name, result: skip ? 'skipped' : codes.length ? 'fail' : 'pass', codes: skip ? [] : codes });
  const sig: string[] = [];
  if (!['RS256', 'ES256'].includes(i.alg)) sig.push('ALG_NOT_ALLOWED');
  if (i.kid !== 'semester-test-2026') sig.push('UNKNOWN_KID');
  if (!i.signatureValid) sig.push('SIGNATURE_INVALID');
  add('Signature', sig, false);
  const stop1 = sig.length > 0;
  const c: string[] = [];
  if (i.iss !== 'https://id.semester.test') c.push('ISSUER_MISMATCH');
  if (i.aud !== 'semester-api') c.push('AUDIENCE_MISMATCH');
  if (!i.sub) c.push('SUBJECT_MISSING');
  if (i.typ !== 'at+jwt') c.push('NOT_ACCESS_TOKEN');
  if (i.expOffset < -SKEW) c.push('TOKEN_EXPIRED');
  if (i.nbfOffset > SKEW) c.push('TOKEN_NOT_YET_VALID');
  add('Claims', c, stop1);
  const stop2 = stop1 || c.length > 0;
  const m: string[] = [];
  if (i.membership !== 'active') m.push('MEMBERSHIP_REVOKED');
  if (i.targetTenant !== i.tenant) m.push('TENANT_MISMATCH');
  add('Membership', m, stop2);
  const stop3 = stop2 || m.length > 0;
  const cap: string[] = [];
  if (!i.capabilityGranted) cap.push('CAPABILITY_NOT_GRANTED');
  if (i.assignmentExpired) cap.push('ASSIGNMENT_EXPIRED');
  add('Capability', cap, stop3);
  add('Scope', i.targetWorkspace !== i.workspace ? ['RESOURCE_OUTSIDE_SCOPE'] : [], stop3);
  add('Consent', i.consentRequired && !i.consentActive ? ['CONSENT_MISSING'] : [], stop3);
  add('Entitlement', !i.entitlementActive ? ['ENTITLEMENT_INACTIVE'] : [], stop3);
  const reasonCodes = layers.flatMap((l) => l.codes);
  return { mode: 'simulation', layers, effectiveDecision: reasonCodes.length ? 'deny' : 'allow', reasonCodes };
}
