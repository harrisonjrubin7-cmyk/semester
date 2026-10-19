import { describe, expect, it } from 'vitest';
import {
  APPLICATION_EDGES,
  INSTALLATION_EDGES,
  RELEASE_EDGES,
  canApproveInstallation,
  transition,
  type ApplicationState,
  type InstallationState,
  type ReleaseState,
  type Table,
} from './lifecycle';

const none = new Set<string>();
const all = (...items: string[]): ReadonlySet<string> => new Set(items);

describe('lifecycle tables', () => {
  it('give every state a row, so no state is silently unreachable or undefined', () => {
    expect(Object.keys(APPLICATION_EDGES).sort()).toEqual(
      ['active', 'draft', 'retired', 'sandbox-enabled', 'suspended'],
    );
    expect(Object.keys(RELEASE_EDGES).sort()).toEqual(
      ['certified', 'changes-required', 'draft', 'submitted', 'withdrawn'],
    );
    expect(Object.keys(INSTALLATION_EDGES).sort()).toEqual(
      ['approved', 'enabled', 'offboarded', 'pilot', 'requested', 'revoked'],
    );
  });

  it('only point at states the same lifecycle defines', () => {
    const targets = (table: Table<string>): string[] =>
      Object.values(table).flatMap((edges) => edges.map((edge) => edge.to));
    const known = (table: Table<string>): Set<string> => new Set(Object.keys(table));
    for (const table of [APPLICATION_EDGES, RELEASE_EDGES, INSTALLATION_EDGES] as const) {
      const states = known(table);
      for (const target of targets(table)) {
        expect(states.has(target)).toBe(true);
      }
    }
  });

  it('leave retired, withdrawn and offboarded as terminal states', () => {
    expect(APPLICATION_EDGES.retired).toEqual([]);
    expect(RELEASE_EDGES.withdrawn).toEqual([]);
    expect(INSTALLATION_EDGES.offboarded).toEqual([]);
  });
});

describe('application lifecycle', () => {
  it('moves forward along the specified chain when its evidence is present', () => {
    expect(transition(APPLICATION_EDGES, 'draft', 'sandbox-enabled', all('sandbox-fixtures'))).toEqual({
      ok: true,
      to: 'sandbox-enabled',
    });
  });

  it('refuses to skip a state and lists the moves that are allowed', () => {
    const result = transition(APPLICATION_EDGES, 'draft', 'active', all('certified-release'));
    expect(result).toEqual({ ok: false, code: 'INVALID_TRANSITION', allowed: ['sandbox-enabled'] });
  });

  it('refuses suspended → active, because the specification does not define reinstatement', () => {
    const result = transition<ApplicationState>(APPLICATION_EDGES, 'suspended', 'active', all('reason'));
    expect(result.ok).toBe(false);
  });

  it('requires the evidence named on the edge and reports exactly what is missing', () => {
    const result = transition(APPLICATION_EDGES, 'sandbox-enabled', 'active', none);
    expect(result).toEqual({ ok: false, code: 'EVIDENCE_REQUIRED', missing: ['certified-release'] });
  });
});

describe('release lifecycle', () => {
  it('needs an immutable artifact digest and a dependency inventory to submit', () => {
    const result = transition(RELEASE_EDGES, 'draft', 'submitted', all('artifact-digest'));
    expect(result).toEqual({ ok: false, code: 'EVIDENCE_REQUIRED', missing: ['dependency-inventory'] });
  });

  it('certifies only with findings and a signed decision', () => {
    const missingDecision = transition(RELEASE_EDGES, 'submitted', 'certified', all('findings'));
    expect(missingDecision).toEqual({ ok: false, code: 'EVIDENCE_REQUIRED', missing: ['signed-decision'] });

    const complete = transition(RELEASE_EDGES, 'submitted', 'certified', all('findings', 'signed-decision'));
    expect(complete).toEqual({ ok: true, to: 'certified' });
  });

  it('resubmits a changed release as a new artifact rather than certifying it in place', () => {
    expect(transition(RELEASE_EDGES, 'changes-required', 'certified', all('findings', 'signed-decision')).ok).toBe(
      false,
    );
    const resubmit = transition(RELEASE_EDGES, 'changes-required', 'submitted', all('artifact-digest', 'dependency-inventory'));
    expect(resubmit).toEqual({ ok: true, to: 'submitted' });
  });

  it('lets a release be withdrawn from every non-terminal state', () => {
    for (const from of ['draft', 'submitted', 'changes-required', 'certified'] as const satisfies readonly ReleaseState[]) {
      expect(transition(RELEASE_EDGES, from, 'withdrawn', none).ok).toBe(true);
    }
  });
});

describe('installation lifecycle', () => {
  it('walks requested → approved → pilot → enabled with each step evidenced', () => {
    expect(transition(INSTALLATION_EDGES, 'requested', 'approved', all('approved-scopes'))).toEqual({
      ok: true,
      to: 'approved',
    });
    expect(transition(INSTALLATION_EDGES, 'approved', 'pilot', all('pilot-plan'))).toEqual({ ok: true, to: 'pilot' });

    const enable = transition(INSTALLATION_EDGES, 'pilot', 'enabled', all('pilot-outcome'));
    expect(enable).toEqual({ ok: false, code: 'EVIDENCE_REQUIRED', missing: ['rollback-readiness'] });
  });

  it('cannot reach offboarded without downstream acknowledgment', () => {
    const state: InstallationState = 'revoked';
    expect(transition(INSTALLATION_EDGES, state, 'offboarded', none)).toEqual({
      ok: false,
      code: 'EVIDENCE_REQUIRED',
      missing: ['downstream-acknowledgment'],
    });
  });

  it('refuses a move from an unknown or prototype-key state read off the wire', () => {
    // A runtime string is not a state until it is checked. The cast only lets the
    // test pass a value the type system would otherwise refuse.
    const hostile = 'constructor' as InstallationState;
    expect(transition(INSTALLATION_EDGES, hostile, 'approved', all('approved-scopes'))).toEqual({
      ok: false,
      code: 'INVALID_TRANSITION',
      allowed: [],
    });
  });
});

describe('cross-lifecycle rule', () => {
  it('approves an installation only for a certified release', () => {
    const releases: readonly ReleaseState[] = ['draft', 'submitted', 'changes-required', 'certified', 'withdrawn'];
    expect(releases.filter(canApproveInstallation)).toEqual(['certified']);
  });
});
