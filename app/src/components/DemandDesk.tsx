import { useEffect, useState } from 'react';
import { offline } from '../lib/offline';
import {
  DEMAND_SOURCE_LINE,
  NOT_FOR_LINE,
  backupLine,
  byDepartment,
  capacityLine,
  pressureLine,
  type DemandRow,
} from '../lib/course-demand';
import { courseDemand, myDemandScopes, type DemandScope } from '../lib/course-demand-remote';
import { useNow, useStore } from '../state/store';
import { SourceBadge } from './SourceBadge';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; rows: DemandRow[] };

/**
 * Course demand for staff (`demand_forecasting`, Phase K), on University ›
 * Demand. What a registrar, department chair, dean or institutional
 * researcher may read: courses ten or more consenting students plan, with
 * backups at ten or more, and seats and waitlist where the registrar has
 * synced sections. Which departments appear is the database's decision, from
 * the account's `demand:read` scope; this screen never widens it.
 *
 * There is no row for a person anywhere on it, and nothing to export.
 */
export function DemandDesk({ accountId }: { accountId?: string | null } = {}) {
  const { account, state } = useStore();
  const userId = accountId !== undefined ? accountId : (account?.id ?? null);
  const now = useNow().getTime();
  const [scopes, setScopes] = useState<DemandScope[] | null>(null);
  const [term, setTerm] = useState(state.term || '');
  const [asked, setAsked] = useState('');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    if (!userId) return;
    let live = true;
    myDemandScopes()
      .then((s) => live && setScopes(s))
      .catch(() => live && setScopes([]));
    return () => {
      live = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!asked || !scopes?.length) return;
    let live = true;
    courseDemand(asked)
      .then((rows) => live && setLoad({ kind: 'ready', rows }))
      .catch((e: unknown) => live && setLoad({ kind: 'error', message: e instanceof Error ? e.message : String(e) }));
    return () => {
      live = false;
    };
  }, [asked, scopes]);

  const intro = (
    <>
      <h3>Course demand</h3>
      <p className="portal-muted">
        {DEMAND_SOURCE_LINE} A course appears only when ten or more of them plan it. {NOT_FOR_LINE}
      </p>
    </>
  );

  if (!userId) {
    return (
      <section className="portal-panel demand-desk" aria-label="Course demand">
        {intro}
        <p>Sign in with a registrar or department account to see course demand.</p>
      </section>
    );
  }
  if (scopes === null) return <p role="status">Checking your access…</p>;
  if (!scopes.length) {
    return (
      <section className="portal-panel demand-desk" aria-label="Course demand">
        {intro}
        <p>Course demand is for registrar, department, dean and institutional research accounts. This account has none of those scopes.</p>
      </section>
    );
  }

  const groups = load.kind === 'ready' ? byDepartment(load.rows) : [];
  return (
    <section className="portal-panel demand-desk" aria-label="Course demand">
      {intro}
      <p className="portal-muted">
        Your scope: {scopes.map((s) => (s.kind === 'school' ? `all of ${s.id}` : `${s.id.split('/').slice(1).join('/')} at ${s.id.split('/')[0]}`)).join('; ')}.
      </p>
      <form
        className="demand-term"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!term.trim()) return;
          setLoad({ kind: 'loading' });
          setAsked(term.trim());
        }}
      >
        <label className="office-field">
          <span>Term</span>
          <input aria-label="Term" value={term} onChange={(ev) => setTerm(ev.target.value)} placeholder="2027SP" />
        </label>
        <button type="submit" className="balance-button" disabled={!term.trim()}>
          Show demand
        </button>
      </form>

      {asked && load.kind === 'loading' ? <p role="status">Loading demand for {asked}…</p> : null}
      {load.kind === 'error' ? (
        <p role="alert">
          {offline() ? 'You are offline. Demand loads when you are connected — no old counts are shown as current.' : `Could not load demand: ${load.message}`}
        </p>
      ) : null}
      {asked && load.kind === 'ready' && !load.rows.length ? (
        <p>No course has ten or more contributing students for {asked} in your scope yet.</p>
      ) : null}

      {groups.map((g) => (
        <section key={g.department} className="demand-department" aria-label={`${g.department} demand`}>
          <h4>{g.department}</h4>
          <ul className="demand-list">
            {g.rows.map((r) => (
              <li key={r.course} className="demand-row">
                <p className="office-title">
                  <strong>{r.course}</strong> — {r.planned} planning to take
                </p>
                <p>{backupLine(r)}</p>
                <SourceBadge label="estimated" at={r.countedAt} now={now} />
                <p>
                  {capacityLine(r)}
                  {pressureLine(r) ? ` · ${pressureLine(r)}` : ''}
                </p>
                {r.capacity !== null ? (
                  <SourceBadge label="imported" at={r.capacitySyncedAt} now={now} />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
