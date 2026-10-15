/**
 * Device identity, trust, session lease, and what happens when a device stops
 * being allowed to hold data.
 *
 * A device is an *installation*: a random id and a hardware-held keypair made
 * on first run. It is never a hardware serial, advertising id or IMEI. The
 * private key never leaves the Keychain/Keystore, so a stolen refresh token
 * alone is not a session: requests are signed by the device.
 */
export type DeviceTrust = 'unregistered' | 'pending' | 'trusted' | 'suspect' | 'revoked'

export type AttestationKind = 'app_attest' | 'play_integrity' | 'webauthn_platform' | 'none'

export interface DeviceRecord {
  deviceId: string
  tenantId: string
  userId: string
  /** SPKI of the hardware-held signing key, base64url. */
  publicKey: string
  platform: 'ios' | 'android' | 'web'
  appVersion: string
  attestation: { kind: AttestationKind; verifiedAt: number | null }
  trust: DeviceTrust
  registeredAt: number
  lastSeenAt: number
  revokedAt?: number
  revokedReason?: 'user' | 'admin' | 'lost_or_stolen' | 'membership_removed' | 'account_deleted' | 'security'
}

/**
 * Registration needs a fresh passkey (or MFA) assertion from a person who is
 * already signed in, plus platform attestation where the platform has it.
 * `none` is allowed only for the web client and is recorded as lower trust.
 */
export interface RegistrationRequest {
  challenge: string
  deviceId: string
  publicKey: string
  platform: DeviceRecord['platform']
  appVersion: string
  attestation: { kind: AttestationKind; blob?: string }
  /** WebAuthn assertion over the challenge, proving a present, verified person. */
  userVerification: { credentialId: string; assertion: string }
}

/** What the server hands back. It has a short life and is renewed only while the device stays trusted. */
export interface DeviceLeaseGrant {
  deviceId: string
  tenantId: string
  userId: string
  issuedAt: number
  /** Past this the device wipes, whatever else is true. */
  hardExpiresAt: number
  policyVersion: string
  permissionEpoch: number
  /** Access tokens are 15 minutes and signed per request; the refresh token rotates and reuse revokes the family. */
  accessTokenTtlMs: number
}

export interface LeasePolicy {
  /** How long cached data may be read without hearing from the server. */
  maxOfflineMs: number
  /** After this long without hearing from the server, the device wipes itself. */
  wipeAfterMs: number
  /** Idle time before the app locks and asks for biometrics/passkey again. */
  idleLockMs: number
  /** Tolerance when the device clock appears to have gone backwards. */
  clockSkewMs: number
}

export const DEFAULT_LEASE_POLICY: LeasePolicy = {
  maxOfflineMs: 7 * 86_400_000,
  wipeAfterMs: 30 * 86_400_000,
  idleLockMs: 5 * 60_000,
  clockSkewMs: 2 * 60_000,
}

export interface LeaseState {
  grant: DeviceLeaseGrant
  /** Last time the server confirmed this device in good standing. */
  verifiedAt: number
  /** The latest wall-clock time this device has ever observed. Never lowered. */
  highWaterWall: number
  lastActiveAt: number
  /** Set by a revocation signal (push, sync response, or a membership-removal pull). */
  revoked?: DeviceRecord['revokedReason']
}

export type AccessDecision =
  | { verdict: 'ok' }
  /** Data stays on disk but is not readable: biometrics or passkey needed. */
  | { verdict: 'locked'; why: 'idle' }
  /** Online verification needed before reading or sending. Data is kept. */
  | { verdict: 'reauth'; why: 'stale_lease' | 'clock_rolled_back' }
  /** Destroy keys, database and files. */
  | { verdict: 'wipe'; why: 'revoked' | 'lease_expired' | 'unverified_too_long' }

/**
 * The single question every read and every sync asks. Order matters: revoked
 * and expired beat everything, then tampering, then staleness, then idleness.
 */
export function evaluateAccess(s: LeaseState, now: number, p: LeasePolicy = DEFAULT_LEASE_POLICY): AccessDecision {
  if (s.revoked) return { verdict: 'wipe', why: 'revoked' }
  if (now >= s.grant.hardExpiresAt) return { verdict: 'wipe', why: 'lease_expired' }
  if (now - s.verifiedAt >= p.wipeAfterMs) return { verdict: 'wipe', why: 'unverified_too_long' }
  // A clock set back would stretch every expiry above. Refuse until a server says what time it is.
  if (now < s.highWaterWall - p.clockSkewMs) return { verdict: 'reauth', why: 'clock_rolled_back' }
  if (now - s.verifiedAt >= p.maxOfflineMs) return { verdict: 'reauth', why: 'stale_lease' }
  if (now - s.lastActiveAt >= p.idleLockMs) return { verdict: 'locked', why: 'idle' }
  return { verdict: 'ok' }
}

/** Record that time passed. Call on every foreground and every read. */
export function observe(s: LeaseState, now: number): LeaseState {
  return { ...s, highWaterWall: Math.max(s.highWaterWall, now) }
}

export type WipeReason = 'revoked' | 'access_expired' | 'logout' | 'membership_removed' | 'account_deleted' | 'tenant_switch'

export interface WipePorts {
  /** Delete the hardware-wrapped key. After this the ciphertext is unrecoverable. */
  deleteWrappingKey(): Promise<void>
  /** Delete the database file and its -wal and -shm companions. */
  deleteDatabase(): Promise<void>
  deleteAttachmentFiles(): Promise<void>
  /** Refresh/access tokens, device signing key, push registration. */
  clearCredentials(): Promise<void>
  /** Content-free marker so the screen can say why the data is gone. */
  writeTombstone(t: { reason: WipeReason; at: number }): Promise<void>
}

export interface WipeResult {
  ok: boolean
  /** Steps that failed. The key step runs first, so a failure later leaves only ciphertext. */
  failed: string[]
}

/**
 * Crypto-erase first, then delete. Every step runs even if an earlier one
 * fails: a half-wiped device is worse than a loud error, and once the key is
 * gone what remains on disk is noise.
 */
export async function wipeDevice(ports: WipePorts, reason: WipeReason, now: number): Promise<WipeResult> {
  const failed: string[] = []
  const step = async (name: string, fn: () => Promise<void>) => {
    try { await fn() } catch { failed.push(name) }
  }
  await step('wrapping_key', () => ports.deleteWrappingKey())
  await step('credentials', () => ports.clearCredentials())
  await step('database', () => ports.deleteDatabase())
  await step('attachments', () => ports.deleteAttachmentFiles())
  await step('tombstone', () => ports.writeTombstone({ reason, at: now }))
  return { ok: failed.length === 0, failed }
}

/** Triggers that must all lead to `wipeDevice`. A test walks this list. */
export const WIPE_TRIGGERS: readonly WipeReason[] = [
  'revoked', 'access_expired', 'logout', 'membership_removed', 'account_deleted', 'tenant_switch',
]
