import { formatDate } from '../lib/locale';
import { useEffect, useState } from 'react';
import { offline } from '../lib/offline';
import { ELIGIBILITY, programName, whyYouSee, type EligibilityKey, type OfficeAction } from '../lib/office-actions';
import { useOfficeActions } from '../lib/office-actions.hook';
import { myAudiences, publishedPrograms, setAudience, type Audiences } from '../lib/office-actions-remote';
import { useNow } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { SourceBadge } from './SourceBadge';

export const dueLine = (at: number | null) =>
  at === null ? null : `Due ${formatDate(new Date(at), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}`;

type Confirm =
  | { kind: 'open'; action: OfficeAction }
  | { kind: 'done'; action: OfficeAction }
  | { kind: 'audiences'; next: Audiences };

/**
 * Campus office actions (`office_action_feed`, Phase J), in full: on Key
 * dates, where the dates the university sets already live. Today shows the
 * first few, and the Action Center ranks them.
 *
 * Every card carries its office, "Institution verified" with when it was
 * updated, the reason it reached this student, and the official link — which
 * opens only after a confirmation. Two things are written to the account, and
 * both show exactly what first:
 *
 * - **What applies to me.** Programs and eligibilities the student chooses.
 *   No office can read them.
 * - **Mark done.** The office sees a count of students, only at ten or more,
 *   never who.
 */
export function OfficeActionFeed({ enabled, accountId }: { enabled: boolean; accountId?: string | null }) {
  const { state, reload, setDone, userId } = useOfficeActions(enabled, accountId);
  const now = useNow().getTime();
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [said, setSaid] = useState('');
  const [failed, setFailed] = useState('');
  const [audiences, setAudiences] = useState<Audiences | null>(null);
  const [programs, setPrograms] = useState<string[]>([]);
  const [draft, setDraft] = useState<Audiences | null>(null);

  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    Promise.all([myAudiences(), publishedPrograms()])
      .then(([mine, offered]) => {
        if (!live) return;
        setAudiences(mine);
        setPrograms([...new Set([...offered, ...mine.programs])].sort());
      })
      .catch(() => live && setAudiences({ programs: [], eligibility: [] }));
    return () => {
      live = false;
    };
  }, [enabled, userId]);

  if (state.kind === 'off') return null;

  const header = (
    <>
      <h3>From campus offices</h3>
      <p className="portal-muted">
        Actions your school’s offices publish. You see the ones sent to your school, a group you are in, or something you
        said applies to you. The office never learns who that is.
      </p>
    </>
  );

  if (state.kind === 'signed-out') {
    return (
      <section className="portal-panel office-feed" aria-label="From campus offices">
        {header}
        <p>Sign in to see what your school’s offices have published for you.</p>
      </section>
    );
  }

  const run = async (what: () => Promise<void>, ok: string) => {
    setFailed('');
    try {
      await what();
      setSaid(ok);
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmed = () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === 'open') {
      window.open(c.action.url, '_blank', 'noopener,noreferrer');
    } else if (c.kind === 'done') {
      void run(() => setDone(c.action.id, true), `Marked done: ${c.action.title}.`);
    } else if (audiences && userId) {
      const next = c.next;
      void run(async () => {
        for (const e of ELIGIBILITY) {
          const was = audiences.eligibility.includes(e.key);
          const is = next.eligibility.includes(e.key);
          if (was !== is) await setAudience(userId, 'eligibility', e.key, is);
        }
        for (const p of programs) {
          const was = audiences.programs.includes(p);
          const is = next.programs.includes(p);
          if (was !== is) await setAudience(userId, 'program', p, is);
        }
        setAudiences(next);
        setDraft(null);
        reload();
      }, 'Saved what applies to you.');
    }
  };

  const open = state.kind === 'ready' ? state.actions.filter((a) => a.doneAt === null) : [];
  const done = state.kind === 'ready' ? state.actions.filter((a) => a.doneAt !== null) : [];
  const choosing = draft ?? audiences;

  return (
    <section className="portal-panel office-feed" aria-label="From campus offices">
      {header}
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      {failed ? <p role="alert">{failed}</p> : null}

      {state.kind === 'loading' ? <p role="status">Loading what your school’s offices published…</p> : null}
      {state.kind === 'error' ? (
        <div role="alert">
          <p>
            {offline()
              ? 'You are offline. Office actions load when you are connected — none are shown rather than an old copy.'
              : `Could not load office actions: ${state.message}`}
          </p>
          <button type="button" className="balance-button" onClick={reload}>
            Try again
          </button>
        </div>
      ) : null}
      {state.kind === 'ready' && !state.actions.length ? (
        <p>No office has published anything that reaches you. If you expected something, check what applies to you below.</p>
      ) : null}

      {open.length ? (
        <ul className="office-list">
          {open.map((a) => (
            <OfficeCard key={a.id} action={a} now={now} onOpen={() => setConfirm({ kind: 'open', action: a })} onDone={() => setConfirm({ kind: 'done', action: a })} />
          ))}
        </ul>
      ) : null}

      {done.length ? (
        <details className="office-done">
          <summary>Marked done ({done.length})</summary>
          <ul className="office-list">
            {done.map((a) => (
              <li key={a.id} className="office-card" data-done="true">
                <strong>{a.title}</strong> — {a.officeLabel}{' '}
                <button type="button" className="balance-button" onClick={() => void run(() => setDone(a.id, false), `Unmarked: ${a.title}.`)}>
                  Not done after all
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {choosing ? (
        <details className="office-audiences">
          <summary>What applies to me</summary>
          <p className="portal-muted">
            Offices can send actions to students who say one of these applies to them. Semester never guesses, and no
            office can see what you choose.
          </p>
          <fieldset>
            <legend>About me</legend>
            {ELIGIBILITY.map((e) => (
              <label key={e.key} className="office-choice">
                <input
                  type="checkbox"
                  checked={choosing.eligibility.includes(e.key)}
                  onChange={(ev) =>
                    setDraft({
                      ...choosing,
                      eligibility: ev.target.checked
                        ? [...choosing.eligibility, e.key]
                        : choosing.eligibility.filter((k): k is EligibilityKey => k !== e.key),
                    })
                  }
                />{' '}
                {e.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>My program</legend>
            {programs.length ? (
              programs.map((p) => (
                <label key={p} className="office-choice">
                  <input
                    type="checkbox"
                    checked={choosing.programs.includes(p)}
                    onChange={(ev) =>
                      setDraft({
                        ...choosing,
                        programs: ev.target.checked ? [...choosing.programs, p] : choosing.programs.filter((k) => k !== p),
                      })
                    }
                  />{' '}
                  {programName(p)}
                </label>
              ))
            ) : (
              <p className="portal-muted">No office at your school publishes to a program yet.</p>
            )}
          </fieldset>
          <button
            type="button"
            className="balance-button"
            disabled={!draft}
            onClick={() => draft && setConfirm({ kind: 'audiences', next: draft })}
          >
            Save what applies to me…
          </button>
        </details>
      ) : null}

      {confirm?.kind === 'open' ? (
        <ConfirmDialog
          title={`Open ${confirm.action.officeLabel}’s page?`}
          tone="external"
          preview={<p className="dialog-url">{confirm.action.url}</p>}
          confirmLabel="Open official page"
          onConfirm={confirmed}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === 'done' ? (
        <ConfirmDialog
          title="Mark this done?"
          preview={
            <>
              <p>
                <strong>{confirm.action.title}</strong>
              </p>
              <p>
                {confirm.action.officeLabel} will see only a count of students who marked this done, and only once ten or
                more have. It never sees your name or anything else about you.
              </p>
              <p>Marking it done here does not tell the office you finished it officially. The official page is the record.</p>
            </>
          }
          confirmLabel="Mark done"
          onConfirm={confirmed}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm?.kind === 'audiences' ? (
        <ConfirmDialog
          title="Save what applies to you?"
          preview={
            <>
              <p>Saved to your account:</p>
              <ul>
                {confirm.next.eligibility.map((k) => (
                  <li key={k}>{ELIGIBILITY.find((e) => e.key === k)?.label}</li>
                ))}
                {confirm.next.programs.map((p) => (
                  <li key={p}>Program: {programName(p)}</li>
                ))}
                {!confirm.next.eligibility.length && !confirm.next.programs.length ? <li>Nothing</li> : null}
              </ul>
              <p>No office can see these. They decide only which actions reach you.</p>
            </>
          }
          confirmLabel="Save"
          onConfirm={confirmed}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}

function OfficeCard({ action: a, now, onOpen, onDone }: { action: OfficeAction; now: number; onOpen: () => void; onDone: () => void }) {
  const due = dueLine(a.dueAt);
  return (
    <li className="office-card" aria-label={`${a.officeLabel}: ${a.title}`}>
      <p className="office-from">{a.officeLabel}</p>
      <p className="office-title">
        <strong>{a.title}</strong>
      </p>
      {due ? <p>{due}</p> : null}
      <p>{a.why}</p>
      <SourceBadge label="institution_verified" at={a.updatedAt} now={now} />
      <details>
        <summary>Why am I seeing this?</summary>
        <p>{whyYouSee(a)}</p>
        <p>Source: {a.sourceNote}</p>
      </details>
      <div className="office-buttons">
        <button type="button" className="balance-button" onClick={onOpen}>
          Open official page
        </button>
        <button type="button" className="balance-button" onClick={onDone}>
          Mark done…
        </button>
      </div>
    </li>
  );
}
