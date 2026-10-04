import { describe, expect, it } from 'vitest'
import { DEFAULT_LEASE_POLICY as P, evaluateAccess, observe, WIPE_TRIGGERS, wipeDevice, type LeaseState, type WipePorts, type WipeReason } from './device.ts'

const NOW = 1_800_000_000_000
const DAY = 86_400_000
const lease = (o: Partial<LeaseState> = {}): LeaseState => ({
  grant: { deviceId: 'd', tenantId: 't', userId: 'u', issuedAt: NOW, hardExpiresAt: NOW + 90 * DAY, policyVersion: '1', permissionEpoch: 0, accessTokenTtlMs: 900_000 },
  verifiedAt: NOW, highWaterWall: NOW, lastActiveAt: NOW, ...o,
})

describe('evaluateAccess', () => {
  it('allows a verified, active device', () => {
    expect(evaluateAccess(lease(), NOW + 1000).verdict).toBe('ok')
  })
  it('locks after idleness and asks for the person again, keeping data', () => {
    expect(evaluateAccess(lease(), NOW + P.idleLockMs)).toEqual({ verdict: 'locked', why: 'idle' })
  })
  it('wants a server round trip after the offline allowance, but keeps the data', () => {
    const s = lease({ lastActiveAt: NOW + 8 * DAY })
    expect(evaluateAccess(s, NOW + 8 * DAY)).toEqual({ verdict: 'reauth', why: 'stale_lease' })
  })
  it('wipes when the hard lease ends, whatever else is true', () => {
    expect(evaluateAccess(lease({ lastActiveAt: NOW + 91 * DAY, verifiedAt: NOW + 91 * DAY }), NOW + 91 * DAY)).toEqual({ verdict: 'wipe', why: 'lease_expired' })
  })
  it('wipes after too long unverified', () => {
    expect(evaluateAccess(lease(), NOW + 31 * DAY)).toEqual({ verdict: 'wipe', why: 'unverified_too_long' })
  })
  it('wipes on a revocation signal even if everything else looks fine', () => {
    expect(evaluateAccess(lease({ revoked: 'lost_or_stolen' }), NOW + 1)).toEqual({ verdict: 'wipe', why: 'revoked' })
  })
  it('does not let a clock set back stretch the offline allowance', () => {
    // Seen: day 10. Device clock reset to day 1 to dodge the 7-day limit.
    const s = observe(lease({ lastActiveAt: NOW }), NOW + 10 * DAY)
    expect(evaluateAccess({ ...s, lastActiveAt: NOW + DAY }, NOW + DAY)).toEqual({ verdict: 'reauth', why: 'clock_rolled_back' })
  })
  it('tolerates small clock adjustments', () => {
    const s = observe(lease(), NOW + 1000)
    expect(evaluateAccess(s, NOW + 1000 - 30_000).verdict).toBe('ok')
  })
  it('never lowers the high-water mark', () => {
    expect(observe(observe(lease(), NOW + 5000), NOW).highWaterWall).toBe(NOW + 5000)
  })
})

describe('wipeDevice', () => {
  const ports = (log: string[], failing: string[] = []): WipePorts => {
    const step = (n: string) => async () => { log.push(n); if (failing.includes(n)) throw new Error(n) }
    return {
      deleteWrappingKey: step('wrapping_key'), clearCredentials: step('credentials'), deleteDatabase: step('database'),
      deleteAttachmentFiles: step('attachments'),
      writeTombstone: async (t) => { log.push(`tombstone:${t.reason}`) },
    }
  }

  it('destroys the key first, so everything left on disk is noise', async () => {
    const log: string[] = []
    await wipeDevice(ports(log), 'revoked', NOW)
    expect(log[0]).toBe('wrapping_key')
    expect(log).toEqual(['wrapping_key', 'credentials', 'database', 'attachments', 'tombstone:revoked'])
  })

  it('carries on after a failure and reports exactly what failed', async () => {
    const log: string[] = []
    const r = await wipeDevice(ports(log, ['database']), 'logout', NOW)
    expect(r).toEqual({ ok: false, failed: ['database'] })
    expect(log).toContain('attachments')
    expect(log).toContain('tombstone:logout')
  })

  it('is reached from every trigger the contract names', async () => {
    expect([...WIPE_TRIGGERS].sort()).toEqual(['access_expired', 'account_deleted', 'logout', 'membership_removed', 'revoked', 'tenant_switch'])
    for (const t of WIPE_TRIGGERS as WipeReason[]) {
      const log: string[] = []
      const r = await wipeDevice(ports(log), t, NOW)
      expect(r.ok, t).toBe(true)
      expect(log).toHaveLength(5)
    }
  })

  it('stores no content in the tombstone', async () => {
    let seen: unknown
    await wipeDevice({ ...ports([]), writeTombstone: async (t) => { seen = t } }, 'revoked', NOW)
    expect(Object.keys(seen as object).sort()).toEqual(['at', 'reason'])
  })
})
