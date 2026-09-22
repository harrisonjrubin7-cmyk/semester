import { useCallback, useEffect, useState } from 'react';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { useNow } from '../state/store';
import { cloudConfigured } from '../lib/cloud';
import { DIMMED_ROW } from '../lib/dim';
import {
  ageLine,
  moveTo,
  nextFor,
  queue,
  queueLine,
  repeats,
  shortId,
  statusLabel,
  unfinished,
  type Report,
  type ReportStatus,
} from '../lib/moderation';

/**
 * The report queue, which is the half of §58 that had no screen.
 *
 * *"Do not implement report buttons that disappear into nowhere."* The button
 * has existed since 1 September and the table it wrote to had no select policy
 * at all, so every report went somewhere nobody could open.
 * `20260921214500_report_status.sql` gave the table a status and gave
 * administrators a way in; this is the way in.
 *
 * ## Not in the directory, and reached by address
 *
 * `#/moderation`, and it is deliberately absent from `lib/nav.ts`. The only
 * thing the registry could do with it is offer it to everybody — `lib/reveal.ts`
 * gates on facts about a semester, and being an administrator is not one of
 * them and cannot be, because `public.app_admins` has no select policy and a
 * browser cannot read whether it is on the list. A row in every student's
 * directory labelled "Report queue" is either clutter or an invitation, and a
 * screen behind a fact the client is not allowed to know is neither.
 *
 * So the address is the door, `SETUP.md` is where it is written down beside
 * making somebody an administrator, and **the server is the gate**: the same
 * query is sent by whoever opens it and answered only for an administrator.
 *
 * ## What it refuses to guess
 *
 * An empty answer means one of two things — an empty queue, or an account with
 * no business here — and from the device they are identical. The screen says
 * both rather than picking the friendlier one, because "there are no reports"
 * told to somebody who simply cannot read them is a sentence they would
 * repeat.
 *
 * ## What it does not draw
 *
 * Names. `reports.about` is a uuid into `auth.users`, and the row says
 * "account 7f3c2a1b" rather than looking a handle up — the report is about
 * conduct in a room, the account id is what the table holds, and a moderation
 * screen that quietly widens into a people-search is not a thing to build by
 * accident.
 *
 * Nothing here can edit a complaint. The API role's update grant is narrowed
 * to `status` in the migration, so the only thing this screen *can* send is
 * the transition — and that is a property of the database rather than a
 * promise made here.
 */
export function Moderation() {
  const now = useNow();
  /*
   * A build with no account service is decided here rather than in the effect.
   * Setting it from inside `useEffect` is a synchronous `setState` in an
   * effect — a render, then immediately another — and the app's lint budget is
   * the right place for that argument to be settled. It is knowable before the
   * first render, so it is the initial state.
   */
  const [rows, setRows] = useState<Report[] | null>(cloudConfigured ? null : []);
  const [trouble, setTrouble] = useState(
    cloudConfigured ? '' : 'No account service is configured for this build, so there is nothing to read.',
  );
  const [moving, setMoving] = useState('');

  /** The round trip, with no state in it — what came back, or what went wrong. */
  const read = useCallback(async (): Promise<{ rows: Report[]; trouble: string }> => {
    if (!cloudConfigured) return { rows: [], trouble: '' };
    try {
      return { rows: await queue(), trouble: '' };
    } catch (e) {
      return { rows: [], trouble: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  const apply = useCallback((got: { rows: Report[]; trouble: string }) => {
    setRows(got.rows);
    setTrouble(got.trouble);
  }, []);

  /*
   * The first read, and the only thing this effect does is start it.
   *
   * `live` rather than a bare call: the queue read is a round trip, and a
   * screen left during it would otherwise set state on a component that is
   * gone. Nothing here sets state before the `await`, which is what keeps this
   * out of the app's warning budget — see the initial state above.
   */
  useEffect(() => {
    let live = true;
    void (async () => {
      const got = await read();
      if (live) apply(got);
    })();
    return () => {
      live = false;
    };
  }, [read, apply]);

  const move = async (report: Report, status: ReportStatus) => {
    setMoving(report.id);
    try {
      await moveTo(report.id, status);
      // Re-read rather than patch the row in place: the update is subject to a
      // policy, and a screen that assumed it worked would show a status the
      // server never accepted.
      apply(await read());
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : String(e));
    } finally {
      setMoving('');
    }
  };

  const list = rows ?? [];
  const patterns = repeats(list);

  return (
    <Page
      blurb={
        <>
          Reports of a message or an account, and the four things you can do with one. The server
          sends these to administrators and to nobody else — see{' '}
          <code>20260921214500_report_status.sql</code>.
        </>
      }
    >
      {rows === null ? (
        <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)' }}>Reading…</div>
      ) : (
        <>
          <div
            style={{
              fontSize: 'var(--type-base)',
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
              marginBottom: 'var(--sp-6)',
            }}
          >
            {queueLine(list)}
          </div>

          {trouble && (
            <div
              style={{
                fontSize: 'var(--type-sm-plus)',
                lineHeight: 'var(--leading-normal)',
                paddingBlock: 'calc(11px * var(--density, 1))',
                paddingInline: 'calc(13px * var(--density, 1))',
                border: '1px solid var(--app-warn-line)',
                background: 'var(--app-warn-wash)',
                borderRadius: 'var(--r-md)',
                marginBottom: 'var(--sp-6)',
                textWrap: 'pretty',
              }}
            >
              {trouble}
            </div>
          )}

          {/*
            The one thing a queue can say that a single report cannot. Above the
            list rather than as a badge on a row, because it is a fact about an
            account across several rows and no one row can carry it.
          */}
          {patterns.length > 0 && (
            <>
              <SectionLabel>Reported by more than one person</SectionLabel>
              <div style={{ marginBottom: 'var(--sp-6)' }}>
                {patterns.map((p) => (
                  <div
                    key={p.about}
                    style={{
                      fontSize: 'var(--type-sm-plus)',
                      lineHeight: 'var(--leading-normal)',
                      marginBottom: 'calc(4px * var(--density, 1))',
                    }}
                  >
                    Account {shortId(p.about)} — {p.reporters} people, {p.reports}{' '}
                    {p.reports === 1 ? 'report' : 'reports'}.
                  </div>
                ))}
              </div>
            </>
          )}

          {list.map((r) => (
            <Blueprint
              key={r.id}
              // A repeated row, so no registration marks — `components/marks.test.ts`
              // caught this and is right to: ten stacked cards put forty little
              // crosses on the screen and the signature becomes texture.
              plain
              style={{
                padding: 'var(--sp-6)',
                marginBottom: 'var(--sp-5)',
                // A whole row dimmed, which is what `DIMMED_ROW` is the
                // audited token for: a report somebody has finished with stays
                // legible and stops competing with the ones that have not been.
                opacity: unfinished(r) ? 1 : DIMMED_ROW,
              }}
            >
              <div className="kicker">
                {statusLabel(r.status)} · {ageLine(r.created_at, now.getTime())}
              </div>
              <div
                style={{
                  fontSize: 'var(--type-base)',
                  marginTop: 'calc(6px * var(--density, 1))',
                  lineHeight: 'var(--leading-normal)',
                  textWrap: 'pretty',
                }}
              >
                {r.reason}
              </div>
              {/* What the message said, kept by the table because a report
                  about a deleted message is otherwise unreadable. */}
              {r.copy && (
                <div
                  style={{
                    borderLeft: '2px solid var(--app-line)',
                    paddingLeft: 'calc(12px * var(--density, 1))',
                    marginTop: 'var(--sp-4)',
                    fontSize: 'var(--type-sm-plus)',
                    color: 'var(--app-dim)',
                    lineHeight: 'var(--leading-relaxed)',
                    fontStyle: 'italic',
                    textWrap: 'pretty',
                  }}
                >
                  {r.copy}
                </div>
              )}
              <div
                style={{
                  fontSize: 'var(--type-xs)',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-4)',
                }}
              >
                About account {shortId(r.about)} · reported by {shortId(r.reporter)}
                {r.message_id ? '' : ' · the message has since been deleted'}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'calc(14px * var(--density, 1))',
                  marginTop: 'calc(6px * var(--density, 1))',
                }}
              >
                {nextFor(r.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="bare tappable"
                    disabled={moving === r.id}
                    onClick={() => void move(r, s)}
                    style={{
                      width: 'auto',
                      minHeight: 44,
                      paddingInline: '0',
                      fontSize: 'var(--type-sm)',
                      color: 'var(--app-dim)',
                      textAlign: 'left',
                    }}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </Blueprint>
          ))}
        </>
      )}
    </Page>
  );
}
