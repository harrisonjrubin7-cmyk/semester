import { describe, expect, it } from 'vitest'
import { OFFICIAL_PREFIXES } from '../../../app/src/lib/sync/classes.ts'
import {
  assertCacheable, assertCrdt, assertQueueable, CRDT_CLASSES, DATA_CLASSES, dataClasses, freshness,
  NEVER_CACHED, NEVER_QUEUED, OfflinePolicyError, policyFor,
} from './policy.ts'

const NOW = 1_800_000_000_000
const HOUR = 3_600_000

describe('the offline policy table', () => {
  it('refuses a class it does not know instead of defaulting it', () => {
    expect(() => policyFor('mystery')).toThrow(OfflinePolicyError)
    expect(() => assertQueueable('mystery')).toThrow(/unknown_class/)
  })

  it('never lets a device queue money, permissions, approvals, records, grade changes or registration', () => {
    for (const c of ['payment', 'ledger_entry', 'permission_grant', 'consent', 'approval', 'grade_change', 'record_amendment', 'registration', 'grade', 'academic_record', 'billing_summary', 'guardian_projection']) {
      expect(() => assertQueueable(c), c).toThrow(/offline_write_prohibited/)
    }
  })

  it('treats every class the app already calls official as never-queued', () => {
    // The app's own list of official write names must not drift away from this table.
    const official = dataClasses.filter((c) => OFFICIAL_PREFIXES.some((p) => c.startsWith(p)))
    expect(official.length).toBeGreaterThan(0)
    for (const c of official) expect(DATA_CLASSES[c].write, c).toBe('never-queued')
  })

  it('keeps CRDTs to authored, shared text and its annotations — nothing server-authoritative', () => {
    expect([...CRDT_CLASSES].sort()).toEqual(['comment', 'group_work', 'shared_document', 'shared_note'])
    for (const c of dataClasses) {
      if (DATA_CLASSES[c].conflict === 'server-authoritative') expect(() => assertCrdt(c), c).toThrow(/not_a_crdt_class/)
    }
  })

  it('never caches what the contract says never enters the content database', () => {
    for (const c of ['case_note', 'wellness', 'conduct', 'payment', 'ledger_entry', 'consent', 'guardian_projection', 'approval']) {
      expect(NEVER_CACHED).toContain(c)
      expect(() => assertCacheable(c, { optIn: dataClasses })).toThrow(/not_cacheable/)
    }
  })

  it('denies official records offline until the tenant opts in, and then only as an expiring read', () => {
    expect(() => assertCacheable('grade')).toThrow(/tenant_has_not_opted_in/)
    expect(assertCacheable('grade', { optIn: ['grade'] }).write).toBe('never-queued')
    expect(freshness('grade', NOW - 25 * HOUR, NOW, { optIn: ['grade'] })).toBe('expired')
    expect(freshness('grade', NOW - 13 * HOUR, NOW, { optIn: ['grade'] })).toBe('stale')
    expect(freshness('grade', NOW - 1 * HOUR, NOW, { optIn: ['grade'] })).toBe('current')
  })

  it('lets a tenant tighten a limit but never loosen it', () => {
    expect(freshness('grade', NOW - 2 * HOUR, NOW, { optIn: ['grade'], maxStaleMs: { grade: HOUR } })).toBe('expired')
    expect(freshness('grade', NOW - 30 * HOUR, NOW, { optIn: ['grade'], maxStaleMs: { grade: 99 * HOUR } })).toBe('expired')
  })

  it('has every queueable class say how a same-field disagreement is settled', () => {
    for (const c of dataClasses) {
      const p = DATA_CLASSES[c] as { conflict: string; write: string; sameField?: string }
      if (p.conflict === 'field-merge') expect(p.sameField, c).toMatch(/^(hlc|ask)$/)
    }
  })

  it('agrees with itself: never-queued classes are exactly those that are not auto, held or draft', () => {
    for (const c of dataClasses) expect(NEVER_QUEUED.includes(c)).toBe(DATA_CLASSES[c].write === 'never-queued')
  })
})
