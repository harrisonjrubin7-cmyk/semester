import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COUNCIL,
  CONDITION,
  CURRENT,
  GATES,
  SEATS,
  decide,
  type Gate,
  type LaunchState,
} from './launchreadiness';

/**
 * The go/no-go is only worth having if it cannot be talked into `go`.
 *
 * Three kinds of check, and the third is the one most easily left out:
 *
 *   - **Evidence exists.** Every cited path is on disk. The control is that a
 *     path known to be absent is reported absent, so a probe pointed at the
 *     wrong root cannot pass everything.
 *   - **Documents agree.** A gate cannot be `met` while the go-live checklist
 *     line it depends on is unticked, and the council document names the same
 *     seats and holders as the data.
 *   - **The function refuses.** Each rule in `decide()` is exercised from a
 *     state that would otherwise be `go`, so a failing rule is seen failing on
 *     its own rather than hidden behind the eleven other reasons today's state
 *     already has.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

/** A state that passes every rule. Each test below breaks exactly one. */
function ready(): LaunchState {
  const gates: Gate[] = GATES.map((g) => ({
    ...g,
    status: 'met',
    evidence: [{ path: 'README.md', shows: 'stand-in' }],
  }));
  return {
    gates,
    council: COUNCIL.map((s) => ({ ...s, holder: `${s.title} (accepted)` })),
    signoffs: [...SEATS],
    blockers: [],
    acceptances: [],
    on: '2026-10-01',
  };
}

describe('the launch go/no-go', () => {
  describe('its evidence', () => {
    it('can tell a missing file from a present one, which is what the next check relies on', () => {
      expect(existsSync(join(root, 'README.md'))).toBe(true);
      expect(existsSync(join(root, 'app/src/lib/no-such-launch-evidence.ts'))).toBe(false);
    });

    it('cites only files that exist', () => {
      for (const gate of GATES) {
        for (const { path } of gate.evidence) {
          expect(existsSync(join(root, path)), `${gate.id} cites ${path}, which is missing`).toBe(true);
        }
      }
    });

    it('never marks a gate met or partial without evidence, nor anything short of met without a gap', () => {
      for (const gate of GATES) {
        if (gate.status !== 'unmet') expect(gate.evidence.length, `${gate.id} is ${gate.status} with nothing cited`).toBeGreaterThan(0);
        if (gate.status !== 'met') expect(gate.gap?.trim(), `${gate.id} is ${gate.status} and says nothing is missing`).toBeTruthy();
      }
    });

    it('holds every gate the command lists, once each, owned by a real seat', () => {
      const text = read('docs/GO-NO-GO-CHECKLIST.md');
      expect(new Set(GATES.map((g) => g.id)).size).toBe(GATES.length);
      expect(GATES).toHaveLength(12);
      for (const gate of GATES) {
        expect(SEATS).toContain(gate.owner);
        expect(text, `the checklist does not state “${gate.requirement}”`).toContain(gate.requirement);
      }
    });
  });

  describe('agreeing with the documents beside it', () => {
    const blocking = read('docs/market-readiness/GO_LIVE_CHECKLIST.md')
      .split(/^## /m)
      .find((section) => section.startsWith('Blocking'))!
      .split('\n')
      .filter((line) => /^- \[.\] /.test(line));

    it('finds the go-live checklist’s blocking list, so the next check is about something', () => {
      expect(blocking.length).toBeGreaterThan(5);
    });

    it('does not mark a gate met while a go-live line it depends on is unticked', () => {
      for (const gate of GATES) {
        for (const pattern of gate.goLive ?? []) {
          const lines = blocking.filter((line) => pattern.test(line));
          expect(lines.length, `${gate.id}: ${pattern} matches no blocking line — the checklist was reworded`).toBeGreaterThan(0);
          if (gate.status === 'met') {
            for (const line of lines) expect(line, `${gate.id} is met, and the checklist disagrees`).toMatch(/^- \[x\]/);
          }
        }
      }
    });

    it('shows the same status for each gate in the checklist document', () => {
      const text = read('docs/GO-NO-GO-CHECKLIST.md');
      for (const gate of GATES) {
        const row = text.split('\n').find((line) => line.includes(`\`${gate.id}\``) && line.startsWith('|'));
        expect(row, `no row for ${gate.id}`).toBeTruthy();
        expect(row, `${gate.id} is ${gate.status} in the data`).toContain(`\`${gate.status.toUpperCase()}\``);
      }
    });

    it('names the same seats and holders in the council document', () => {
      const text = read('docs/LAUNCH-READINESS-COUNCIL.md');
      for (const seat of COUNCIL) {
        const row = text.split('\n').find((line) => line.startsWith(`| \`${seat.seat}\``));
        expect(row, `the council document has no row for ${seat.seat}`).toBeTruthy();
        expect(row).toContain(seat.holder ?? 'Vacant');
      }
    });

    it('states the verdict the function gives', () => {
      const word = { go: 'GO', 'go-with-conditions': 'GO WITH CONDITIONS', 'no-go': 'NO-GO' } as const;
      const verdict = word[decide(CURRENT).verdict];
      for (const doc of ['docs/LAUNCH-READINESS-COUNCIL.md', 'docs/GO-NO-GO-CHECKLIST.md']) {
        expect(read(doc), doc).toContain(`**Current verdict: \`${verdict}\`.**`);
      }
    });

    it('resolves every part of the launch condition to gates that exist', () => {
      expect(CONDITION).toHaveLength(8);
      const ids = new Set(GATES.map((g) => g.id));
      for (const part of CONDITION) {
        expect(part.gates.length).toBeGreaterThan(0);
        for (const id of part.gates) expect(ids.has(id), `${part.part} names ${id}`).toBe(true);
      }
      const covered = new Set(CONDITION.flatMap((p) => p.gates));
      for (const id of ids) expect(covered.has(id), `${id} is in no part of the condition`).toBe(true);
    });
  });

  describe('deciding', () => {
    it('is go from a state that meets everything — the control for every refusal below', () => {
      expect(decide(ready())).toEqual({ verdict: 'go', reasons: [], conditions: [] });
    });

    it('is no-go today, and says why at length', () => {
      const { verdict, reasons } = decide(CURRENT);
      expect(verdict).toBe('no-go');
      // Four seats held since 2026-09-28, three more since 2026-09-30, and none
      // signed: holding is not signing.
      const held = COUNCIL.filter((s) => s.holder !== null).map((s) => s.seat);
      expect(held).toEqual(['founder', 'product', 'engineering', 'privacy', 'accessibility', 'success', 'operations']);
      expect(reasons.filter((r) => r.endsWith('is vacant.'))).toHaveLength(SEATS.length - held.length);
      for (const seat of held) expect(reasons).toContain(`Seat ${seat} has not signed.`);
      expect(CURRENT.signoffs).toEqual([]);
      expect(reasons.some((r) => r.startsWith('golden-path:'))).toBe(true);
      // The one met gate is not a reason; every other gate is.
      expect(reasons.some((r) => r.startsWith('known-limitations:'))).toBe(false);
      expect(reasons.filter((r) => /^[a-z-]+: (partial|unmet) — /.test(r))).toHaveLength(GATES.length - 1);
    });

    it('holds a seat only by a role label, never an address or a username', () => {
      for (const seat of COUNCIL) {
        if (seat.holder === null) continue;
        expect(seat.holder, seat.seat).not.toMatch(/@|github|harrison/i);
      }
    });

    it('refuses a gate that is not met', () => {
      const state = ready();
      state.gates = state.gates.map((g) => (g.id === 'backup-restore' ? { ...g, status: 'partial', gap: 'not drilled' } : g));
      const { verdict, reasons } = decide(state);
      expect(verdict).toBe('no-go');
      expect(reasons).toContain('backup-restore: partial — not drilled');
      expect(reasons.some((r) => r.includes('one repeatable implementation path'))).toBe(true);
    });

    it('refuses a gate marked met with nothing cited', () => {
      const state = ready();
      state.gates = state.gates.map((g) => (g.id === 'data-scope' ? { ...g, evidence: [] } : g));
      expect(decide(state).reasons).toEqual(['data-scope: marked met with no evidence.']);
    });

    it('refuses a vacant seat and an unsigned one', () => {
      const state = ready();
      state.council = state.council.map((s) => (s.seat === 'champion' ? { ...s, holder: null } : s));
      state.signoffs = SEATS.filter((s) => s !== 'security');
      expect(decide(state).reasons).toEqual(['Seat security has not signed.', 'Seat champion is vacant.']);
    });

    it('refuses a council with a seat left out, or one seat twice', () => {
      const state = ready();
      state.council = state.council.filter((s) => s.seat !== 'champion');
      expect(decide(state).reasons).toEqual(['Seat champion is missing from the council.']);
      const doubled = ready();
      const founder = doubled.council.find((s) => s.seat === 'founder')!;
      doubled.council = doubled.council.map((s) => (s.seat === 'champion' ? founder : s));
      expect(decide(doubled).reasons).toEqual([
        'Seat founder appears 2 times on the council.',
        'Seat champion is missing from the council.',
      ]);
    });

    it('honours no waiver against a decision date that is not a date', () => {
      const state: LaunchState = {
        ...ready(),
        blockers: [{ id: 'B-2', severity: 'P2', summary: 'slow export on large accounts' }],
        acceptances: [{ blocker: 'B-2', by: 'founder', reason: 'pilot accounts are small', disclosure: 'Large exports are slow.', expires: '2020-01-01' }],
        on: '',
      };
      const { verdict, reasons } = decide(state);
      expect(verdict).toBe('no-go');
      expect(reasons[0]).toBe('The decision date "" is not a date (YYYY-MM-DD).');
      expect(reasons).toContain('Open P2 B-2: slow export on large accounts');
    });

    it('refuses an open blocker of any severity that nobody accepted', () => {
      const state = { ...ready(), blockers: [{ id: 'B-3', severity: 'P3' as const, summary: 'copy typo' }] };
      expect(decide(state).verdict).toBe('no-go');
    });

    it('lets the founder accept a P2 until it expires — and that is go with conditions, never a clean go', () => {
      const acceptance = { blocker: 'B-2', by: 'founder' as const, reason: 'pilot accounts are small', disclosure: 'Exporting a very large account can take a few minutes.', expires: '2026-11-01' };
      const state: LaunchState = {
        ...ready(),
        blockers: [{ id: 'B-2', severity: 'P2', summary: 'slow export on large accounts' }],
        acceptances: [acceptance],
      };
      expect(decide(state)).toEqual({
        verdict: 'go-with-conditions',
        reasons: [],
        conditions: [{ blocker: 'B-2', severity: 'P2', by: 'founder', reason: acceptance.reason, disclosure: acceptance.disclosure, expires: '2026-11-01' }],
      });
      const expired = decide({ ...state, on: '2026-11-01' });
      expect(expired.verdict).toBe('no-go');
      expect(expired.conditions).toEqual([]);
      expect(expired.reasons).toEqual([
        'Risk acceptance for B-2 expired on 2026-11-01.',
        'Open P2 B-2: slow export on large accounts',
      ]);
    });

    it('lists every condition in the blockers’ order, and none while anything else is open', () => {
      const state: LaunchState = {
        ...ready(),
        blockers: [
          { id: 'B-3', severity: 'P3', summary: 'copy typo' },
          { id: 'B-2', severity: 'P2', summary: 'slow export' },
        ],
        acceptances: [
          { blocker: 'B-2', by: 'founder', reason: 'small accounts', disclosure: 'Large exports are slow.', expires: '2026-11-01' },
          { blocker: 'B-3', by: 'founder', reason: 'cosmetic', disclosure: 'One label is misspelt.', expires: '2026-10-15' },
        ],
      };
      expect(decide(state).verdict).toBe('go-with-conditions');
      expect(decide(state).conditions.map((c) => c.blocker)).toEqual(['B-3', 'B-2']);
      const unsigned = { ...state, signoffs: SEATS.filter((s) => s !== 'privacy') };
      expect(decide(unsigned).verdict).toBe('no-go');
      expect(decide(unsigned).conditions).toEqual([]);
    });

    it('refuses an acceptance that says nothing about what pilot users are told', () => {
      const state: LaunchState = {
        ...ready(),
        blockers: [{ id: 'B-2', severity: 'P2', summary: 'slow export' }],
        acceptances: [{ blocker: 'B-2', by: 'founder', reason: 'small accounts', disclosure: '  ', expires: '2026-11-01' }],
      };
      const { verdict, reasons, conditions } = decide(state);
      expect(verdict).toBe('no-go');
      expect(conditions).toEqual([]);
      expect(reasons).toEqual(['Risk acceptance for B-2 says nothing about what pilot users are told.', 'Open P2 B-2: slow export']);
    });

    it('never lets a P0 or P1 be accepted, by anyone', () => {
      for (const severity of ['P0', 'P1'] as const) {
        const state: LaunchState = {
          ...ready(),
          blockers: [{ id: 'B-1', severity, summary: 'cross-tenant read' }],
          acceptances: [{ blocker: 'B-1', by: 'founder', reason: 'deadline', disclosure: 'none', expires: '2027-01-01' }],
        };
        const { verdict, reasons } = decide(state);
        expect(verdict).toBe('no-go');
        expect(reasons).toContain(`B-1 is ${severity}; a ${severity} cannot be accepted, only fixed.`);
        expect(reasons).toContain(`Open ${severity} B-1: cross-tenant read`);
      }
    });

    it('does not let any seat but the founder accept risk, or accept without a reason or an end date', () => {
      const base: LaunchState = { ...ready(), blockers: [{ id: 'B-2', severity: 'P2', summary: 'x' }] };
      const by = decide({ ...base, acceptances: [{ blocker: 'B-2', by: 'engineering', reason: 'fine', disclosure: 'told', expires: '2027-01-01' }] });
      expect(by.reasons).toContain('Risk acceptance for B-2 is by engineering; only founder accepts risk.');
      const why = decide({ ...base, acceptances: [{ blocker: 'B-2', by: 'founder', reason: ' ', disclosure: 'told', expires: '2027-01-01' }] });
      expect(why.reasons).toContain('Risk acceptance for B-2 gives no reason.');
      const when = decide({ ...base, acceptances: [{ blocker: 'B-2', by: 'founder', reason: 'fine', disclosure: 'told', expires: 'later' }] });
      expect(when.reasons).toContain('Risk acceptance for B-2 has no valid expiry.');
      for (const v of [by, why, when]) expect(v.verdict).toBe('no-go');
    });

    it('reports an acceptance for something that is not a blocker, rather than ignoring it', () => {
      const state: LaunchState = { ...ready(), acceptances: [{ blocker: 'B-9', by: 'founder', reason: 'r', disclosure: 'd', expires: '2027-01-01' }] };
      expect(decide(state).reasons).toEqual(['Risk acceptance names B-9, which is not an open blocker.']);
    });
  });
});
