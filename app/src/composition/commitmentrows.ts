import { useEffect, useRef, useState } from 'react';
import type { FeatureState } from '../intelligence/contracts';
import { HORIZON_DAYS } from '../lib/commitment-rows';
import { dateToIso } from '../lib/date';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import { datedItems } from '../lib/select';
import type { CommitmentRow } from '../lib/today-center';
import { useNow, useStore } from '../state/store';
import { makeBridge, type Bridge } from './bridge';
import type { StoreSnapshot } from './react';

/**
 * The Action Center's commitment rows, from the domain when a build asks for it.
 *
 * `off`: the screen's own rows, and nothing here loads. `preview` and `sandbox`: the
 * screen's own rows still draw, and where the domain's differ the console says so, once
 * per distinct finding. `production`: the domain's rows draw, but only while they are
 * **loaded, current and complete**; otherwise the screen's own do, which
 * `commitments.test.ts` holds identical. So a late answer, an answer to older state, or
 * an entry with no record behind it costs nothing a student can see.
 */

export type RowSource = 'domain' | 'legacy';

export interface DomainRows {
  /** `null` when an entry had no record to draw it from. */
  readonly rows: readonly CommitmentRow[] | null;
  /** Built from the state the screen is showing now, not older. */
  readonly current: boolean;
}

/** Which rows draw. The only place the flag's meaning is written down. */
export function chooseRows(flag: FeatureState, legacy: CommitmentRow[], domain: DomainRows | null): { rows: CommitmentRow[]; source: RowSource } {
  if (flag === 'production' && domain?.current && domain.rows) return { rows: [...domain.rows], source: 'domain' };
  return { rows: legacy, source: 'legacy' };
}

/**
 * Where the domain's rows differ from the screen's, in words, for the console.
 *
 * "Differ" is what the parity test means: a row the screen has and the domain lacks or
 * draws otherwise, or a row only the domain has that is still to come. One only the domain
 * has that is already past is not a difference: `planCommitments` discards it, and the
 * screen's own source (`upcomingItems`) drops it earlier.
 */
export function differences(legacy: readonly CommitmentRow[], domain: readonly CommitmentRow[], now: number): string[] {
  const out: string[] = [];
  const theirs = new Map(domain.map((r) => [r.id, r]));
  for (const row of legacy) {
    const other = theirs.get(row.id);
    if (!other) out.push(`only on screen: ${row.id}`);
    else if (JSON.stringify(other) !== JSON.stringify(row)) out.push(`differs: ${row.id}`);
  }
  const ours = new Set(legacy.map((r) => r.id));
  for (const row of domain) if (!ours.has(row.id) && row.at >= now - 60_000) out.push(`only in the domain: ${row.id}`);
  return out;
}

const sameKey = (a: readonly unknown[], b: readonly unknown[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** The rows, and where they came from. `useCommitmentRows` is this, for the screen; the source is for the test. */
export function useCommitmentRowsWithSource(
  legacy: CommitmentRow[],
  flag: FeatureState = EXPERIENCE_FLAGS.domainToday,
  log: (message: string, detail?: unknown) => void = (message, detail) => console.warn(message, detail),
): { rows: CommitmentRow[]; source: RowSource } {
  const store = useStore();
  const now = useNow();
  const enabled = flag !== 'off';
  const { state, catalog } = store;
  const snapshot: StoreSnapshot = {
    state,
    catalog,
    accountId: store.account?.id ?? null,
    schoolId: store.school.id,
    now,
    grants: [],
    choices: {},
  };
  // What decides the rows. If any of these moved, an answer built before is out of date.
  const key = [state.tasks, state.appointments, state.done, state.courses, state.sample, catalog, now.getTime()];

  const bridge = useRef<Bridge<StoreSnapshot> | null>(null);
  const latest = useRef({ snapshot, dispatch: store.dispatch, legacy });
  const reported = useRef(new Set<string>());
  const [loaded, setLoaded] = useState<{ ask: () => Promise<readonly CommitmentRow[] | null> } | null>(null);
  const [answer, setAnswer] = useState<{ key: readonly unknown[]; rows: readonly CommitmentRow[] | null } | null>(null);

  // After every commit: publish what is on screen, and release anyone waiting for it.
  useEffect(() => {
    latest.current = { snapshot, dispatch: store.dispatch, legacy };
    bridge.current?.sync(snapshot, store.dispatch);
  });

  // The domains load only for a build that wants them, and are built once.
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void Promise.all([import('./domains'), import('./react'), import('./commitments'), import('../kernel')]).then(
      ([{ composeDomains }, { hostOver }, { commitmentRowsFromDomain }, kernel]) => {
        if (!live) return;
        const made = makeBridge(latest.current.snapshot, latest.current.dispatch);
        bridge.current = made;
        // The domain's "today" is the store's, which is minute-quantised and the one the screen's rows use.
        const clock = { now: () => made.read().now.getTime(), today: () => dateToIso(made.read().now) };
        const domains = composeDomains(hostOver(made.read, made.send, made.settled), { clock, ids: kernel.systemIds, events: kernel.nullSink });
        setLoaded({
          ask: async () => {
            const look = await domains.today.commitments(HORIZON_DAYS);
            if (!look.ok) return null;
            const s = made.read();
            const items = new Map(datedItems(s.catalog, s.now).map((i) => [i.id, i]));
            return commitmentRowsFromDomain(look.value, {
              deadline: (id) => items.get(id),
              appointment: (id) => s.state.appointments.find((a) => a.id === id),
              courseCode: (c) => s.catalog.byId[c]?.code,
            });
          },
        });
      },
    );
    return () => {
      live = false;
    };
  }, [enabled]);

  // Ask again whenever what the rows depend on moves. An answer that arrives after it moved again is dropped.
  useEffect(() => {
    if (!loaded) return;
    let live = true;
    const mine = key;
    void loaded.ask().then((rows) => {
      if (!live) return;
      setAnswer({ key: mine, rows });
      if (flag !== 'production' && rows) {
        const found = differences(latest.current.legacy, rows, latest.current.snapshot.now.getTime());
        const signature = found.join('|');
        if (found.length > 0 && !reported.current.has(signature)) {
          reported.current.add(signature);
          log('[domainToday] the domain’s commitment rows differ from the screen’s', found);
        }
      }
    });
    return () => {
      live = false;
    };
    // `key` is the dependency list, spread; `flag` and `log` do not change the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, ...key]);

  if (!enabled) return { rows: legacy, source: 'legacy' };
  return chooseRows(flag, legacy, answer && { rows: answer.rows, current: sameKey(answer.key, key) });
}

export function useCommitmentRows(legacy: CommitmentRow[], flag: FeatureState = EXPERIENCE_FLAGS.domainToday): CommitmentRow[] {
  return useCommitmentRowsWithSource(legacy, flag).rows;
}
