import { describe, expect, it } from 'vitest'
import { PHASE_TO_STATE, STATE_COPY, SYNC_STATES, transition, type QueuePhase, type SyncEvent, type SyncState } from './status.ts'

const EVENTS: SyncEvent['type'][] = ['edit', 'confirm', 'ack', 'reject', 'conflict', 'resolve', 'retry', 'discard']

describe('the five states', () => {
  it('shows all five and nothing else', () => {
    expect(new Set(Object.values(PHASE_TO_STATE))).toEqual(new Set(SYNC_STATES))
  })

  it('maps every queue phase to a state', () => {
    const phases: QueuePhase[] = ['draft', 'queued', 'sent', 'pending_reconciliation', 'acknowledged', 'reconciled', 'rejected', 'conflict_requires_copy']
    expect(Object.keys(PHASE_TO_STATE).sort()).toEqual([...phases].sort())
  })

  it('never calls an unanswered or ambiguous command synced', () => {
    for (const p of ['draft', 'queued', 'sent', 'pending_reconciliation'] as QueuePhase[]) expect(PHASE_TO_STATE[p]).not.toBe('synced')
  })

  it('reaches synced only through an acknowledgement', () => {
    for (const from of SYNC_STATES) {
      for (const e of EVENTS) {
        const to = transition(from, { type: e } as SyncEvent)
        if (to === 'synced' && from !== 'synced') expect(e, `${from} --${e}--> synced`).toBe('ack')
      }
    }
  })

  it('lets only a pending change be acknowledged', () => {
    for (const from of SYNC_STATES) expect(transition(from, { type: 'ack' }) === 'synced' && from !== 'synced').toBe(from === 'pending')
  })

  it('asks the person to act exactly when it is rejected or conflicted', () => {
    for (const s of SYNC_STATES as SyncState[]) expect(STATE_COPY[s].needsAction).toBe(s === 'rejected' || s === 'conflicted')
  })

  it('says in every state that the work is still saved, or that the server confirmed it', () => {
    for (const s of ['local', 'pending', 'rejected'] as SyncState[]) expect(STATE_COPY[s].detail).toMatch(/saved here/i)
  })
})
