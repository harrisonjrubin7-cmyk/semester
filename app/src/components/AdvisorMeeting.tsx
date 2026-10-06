import { OfflineRefusal } from '../lib/offline-mode';
import { KeepForLater } from './WaitingSends';
import { formatDate } from '../lib/locale';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  EMPTY_MEETINGS,
  LIMITS,
  meetingKey,
  meetingSummary,
  newMeeting,
  payloadLines,
  readMeetings,
  sharePayload,
  type AttachedCourse,
  type AttachedScenario,
  type Line,
  type Meeting,
  type SharePayload,
} from '../lib/advisor-meeting';
import {
  EXPIRY_CHOICES,
  checkPayload,
  deleteShare,
  expiryFrom,
  myShares,
  plausibleEmail,
  revokeShare,
  shareState,
  shareWithAdvisor,
  type ShareEvent,
  type ShareRow,
} from '../lib/advisor-shares';
import { useSavedCourses } from '../lib/advisor-attachments';
import { hours } from '../lib/degree';
import { download } from '../lib/deliver';
import { record, yours } from '../lib/journal';
import { useDeviceLibrary } from '../lib/device-library';
import { EMPTY_GRADUATION, GRADUATION_KEY, readGraduation } from '../lib/graduation';
import { comparisonText } from '../lib/scenario-compare';
import { useNow, useStore } from '../state/store';
import { AdvisorSharedView } from './AdvisorSharedView';
import { ConfirmDialog } from './ConfirmDialog';
import { ActionPreview } from './unity/ActionPreview';

const day = (iso: string) => formatDate(new Date(iso), { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Advisor Meeting Mode (`advisor_meeting_mode`, Phase G), in My Path.
 *
 * The student prepares on their own device: agenda, questions, what to
 * attach, follow-ups, private notes. Two things leave the device, and both
 * show exactly what will leave first:
 *
 * - **Export or print** a summary (private notes are never in it).
 * - **Share with an advisor** at their school, signed in, with an expiry they
 *   choose. The sharing panel lists every share, its state, when the advisor
 *   opened it, and revoke and delete.
 *
 * Nothing is shared by default, and no link-based access exists (D-016).
 */
export function AdvisorMeeting({ accountId }: { accountId: string | null }) {
  const { state, account } = useStore();
  const now = useNow();
  const library = useDeviceLibrary(meetingKey(accountId), readMeetings, EMPTY_MEETINGS);
  const meetings = library.value.meetings;
  const [openId, setOpenId] = useState<string | null>(null);
  const meeting = meetings.find((m) => m.id === openId) ?? meetings[0] ?? null;
  const graduation = useDeviceLibrary(GRADUATION_KEY, readGraduation, EMPTY_GRADUATION).value;
  const saved = useSavedCourses();
  const [confirm, setConfirm] = useState<'download' | 'print' | 'share' | 'remove' | null>(null);
  const [said, setSaid] = useState('');
  // Set when a share was refused for want of a connection: the offer to keep it.
  const [offer, setOffer] = useState<{ summary: string; payload: unknown } | null>(null);
  const [sharedAs, setSharedAs] = useState('');
  const [email, setEmail] = useState('');
  const [days, setDays] = useState<number>(30);
  const [refresh, setRefresh] = useState(0);
  const headingId = useId();

  const edit = (patch: Partial<Meeting>) => {
    if (!meeting) return;
    library.update((lib) => ({ ...lib, meetings: lib.meetings.map((m) => (m.id === meeting.id ? { ...m, ...patch } : m)) }));
  };
  const add = () => {
    const m = newMeeting(Date.now());
    if (library.update((lib) => ({ ...lib, meetings: [m, ...lib.meetings].slice(0, LIMITS.meetings) }))) setOpenId(m.id);
  };

  const scenario: AttachedScenario | null = useMemo(() => {
    const s = meeting?.attach.scenario ? graduation.scenarios.find((x) => x.id === meeting.attach.scenario) : null;
    return s ? { name: s.name, lines: comparisonText(graduation.plan, hours(state.taken).withThisTerm, s).split('\n').slice(1) } : null;
  }, [meeting, graduation, state.taken]);
  const courses: AttachedCourse[] = useMemo(
    () => (meeting ? saved.filter((c) => meeting.attach.courses.includes(c.id)).map(({ id: _id, ...c }) => c) : []),
    [meeting, saved],
  );
  const payload: SharePayload | null = meeting ? sharePayload(meeting, { sharedAs, scenario, courses }) : null;

  if (!meeting) {
    return (
      <section className="portal-panel advisor-meeting" aria-labelledby={headingId}>
        <h3 id={headingId}>Advisor meeting</h3>
        <p className="portal-muted">Prepare an agenda and questions, choose what to bring, and note what to do afterwards.</p>
        <button type="button" className="balance-button" onClick={add}>
          Prepare a meeting
        </button>
        {library.error ? <p role="alert">{library.error}</p> : null}
        <AdvisorSharedView key={accountId ?? 'signed-out'} signedIn={Boolean(accountId)} />
      </section>
    );
  }

  const summary = payload ? meetingSummary(meeting, payload) : '';
  const done = () => {
    const what = confirm;
    setConfirm(null);
    if (what === 'download') {
      download({ name: `${meeting.title || 'Advisor meeting'}.txt`, body: summary, mime: 'text/plain' });
      setSaid('Summary downloaded. Private notes were left out.');
    } else if (what === 'print') {
      const w = window.open('', '_blank', 'noopener');
      if (!w) {
        setSaid('The print window was blocked. Download the summary instead.');
        return;
      }
      const pre = w.document.createElement('pre');
      pre.textContent = summary;
      w.document.body.append(pre);
      w.print();
      setSaid('Summary sent to print. Private notes were left out.');
    } else if (what === 'remove') {
      library.update((lib) => ({ ...lib, meetings: lib.meetings.filter((m) => m.id !== meeting.id) }));
      setOpenId(null);
      setSaid('Meeting preparation removed from this device. Shares already made are unchanged — revoke them below.');
    }
  };

  const doShare = async () => {
    setConfirm(null);
    if (!payload) return;
    try {
      await shareWithAdvisor(email, meeting.title, payload, days, now.getTime());
      record(account?.id ?? null, {
        kind: 'agenda-shared',
        detail: `with ${email.trim()} until ${day(expiryFrom(days, now.getTime()))}`,
        about: { type: 'agenda', id: meeting.id, label: meeting.title },
        provenance: yours(`Shared with ${email.trim()} until ${day(expiryFrom(days, now.getTime()))}`),
      });
      setSaid(`Shared with ${email.trim()} until ${day(expiryFrom(days, now.getTime()))}. You can revoke it below at any time.`);
      setRefresh((n) => n + 1);
      setOffer(null);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : 'The share could not be made.');
      // Nothing was sent, and nothing is waiting — unless the student keeps it.
      if (e instanceof OfflineRefusal) {
        setOffer({
          summary: `Share “${meeting.title}” with ${email.trim()}, for ${days} days from when you send it`,
          payload: { email: email.trim(), title: meeting.title, payload, days },
        });
      } else setOffer(null);
    }
  };

  let shareProblem = '';
  try {
    if (payload) checkPayload(payload);
  } catch (e) {
    shareProblem = e instanceof Error ? e.message : '';
  }

  return (
    <section className="portal-panel advisor-meeting" aria-labelledby={headingId}>
      <h3 id={headingId}>Advisor meeting</h3>
      <div className="portal-filter-row">
        {meetings.length > 1 ? (
          <label className="portal-check">
            Meeting
            <select className="input" value={meeting.id} onChange={(e) => setOpenId(e.target.value)}>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                  {m.date ? ` · ${m.date}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="balance-button" onClick={add} disabled={meetings.length >= LIMITS.meetings}>
          New meeting
        </button>
      </div>
      <div className="portal-filter-row">
        <label className="portal-check">
          Title
          <input className="input" maxLength={LIMITS.title} value={meeting.title} onChange={(e) => edit({ title: e.target.value })} />
        </label>
        <label className="portal-check">
          Date
          <input className="input" type="date" value={meeting.date ?? ''} onChange={(e) => edit({ date: e.target.value || null })} />
        </label>
      </div>

      <LineList
        title="Agenda"
        one="Agenda item"
        add="Add an agenda item"
        items={meeting.agenda}
        onChange={(agenda) => edit({ agenda })}
      />
      <LineList
        title="Questions"
        one="Question"
        add="Add a question"
        items={meeting.questions}
        onChange={(questions) => edit({ questions: questions.map((q) => ({ answer: '', ...meeting.questions.find((x) => x.id === q.id), ...q })) })}
        extra={(item) => {
          const q = meeting.questions.find((x) => x.id === item.id);
          return (
            <label className="portal-check">
              Answer, after the meeting
              <input
                className="input"
                maxLength={LIMITS.text}
                value={q?.answer ?? ''}
                onChange={(e) => edit({ questions: meeting.questions.map((x) => (x.id === item.id ? { ...x, answer: e.target.value } : x)) })}
              />
            </label>
          );
        }}
      />

      <h4 className="balance-heading">What to bring</h4>
      <p className="portal-muted">Only what you tick here can be shared. Nothing else — not your study history, grades, notes or anything else — ever is.</p>
      <label className="portal-check">
        Plan scenario
        <select className="input" value={meeting.attach.scenario ?? ''} onChange={(e) => edit({ attach: { ...meeting.attach, scenario: e.target.value || null } })}>
          <option value="">None</option>
          {graduation.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {saved.length ? (
        <fieldset className="advisor-attach">
          <legend>Saved courses</legend>
          {saved.map((c) => (
            <label key={c.id} className="portal-check">
              <input
                type="checkbox"
                checked={meeting.attach.courses.includes(c.id)}
                onChange={(e) =>
                  edit({
                    attach: {
                      ...meeting.attach,
                      courses: e.target.checked ? [...meeting.attach.courses, c.id].slice(0, LIMITS.courses) : meeting.attach.courses.filter((x) => x !== c.id),
                    },
                  })
                }
              />
              {c.code} · {c.section} — {c.title}
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="portal-muted">Save courses in Course search to bring them.</p>
      )}
      <label className="portal-check">
        <input
          type="checkbox"
          checked={meeting.attach.followUps}
          onChange={(e) => edit({ attach: { ...meeting.attach, followUps: e.target.checked } })}
        />
        Include my follow-up actions when I share
      </label>

      <LineList
        title="Follow-up actions"
        one="Follow-up"
        add="Add a follow-up"
        items={meeting.followUps}
        onChange={(items) => edit({ followUps: items.map((f) => ({ done: false, due: null, ...meeting.followUps.find((x) => x.id === f.id), ...f })) })}
        extra={(item) => {
          const f = meeting.followUps.find((x) => x.id === item.id);
          const set = (patch: { done?: boolean; due?: string | null }) =>
            edit({ followUps: meeting.followUps.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) });
          return (
            <>
              <label className="portal-check">
                <input type="checkbox" checked={f?.done ?? false} onChange={(e) => set({ done: e.target.checked })} />
                Done
              </label>
              <label className="portal-check">
                By
                <input className="input" type="date" value={f?.due ?? ''} onChange={(e) => set({ due: e.target.value || null })} />
              </label>
            </>
          );
        }}
      />

      <label className="portal-check advisor-notes">
        Private notes — only on this device, never shared or exported
        <textarea className="input" maxLength={5000} rows={3} value={meeting.notes} onChange={(e) => edit({ notes: e.target.value })} />
      </label>

      <div className="course-v2-actions">
        <button type="button" className="balance-button" onClick={() => setConfirm('download')}>
          Download summary…
        </button>
        <button type="button" className="balance-button" onClick={() => setConfirm('print')}>
          Print summary…
        </button>
        <button type="button" className="balance-button" onClick={() => setConfirm('remove')}>
          Remove this meeting…
        </button>
      </div>
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      {offer ? <KeepForLater kind="share" summary={offer.summary} payload={offer.payload} /> : null}

      <h4 className="balance-heading">Share with your advisor</h4>
      {accountId ? (
        <>
          <p className="portal-muted">
            Your advisor signs in to Semester to see it. Only an advisor at your school can be chosen, the share ends when you
            say, you can revoke it any time, and you see when it was opened.
          </p>
          <div className="portal-filter-row">
            <label className="portal-check">
              Your name, as your advisor knows you
              <input className="input" maxLength={80} value={sharedAs} onChange={(e) => setSharedAs(e.target.value)} />
            </label>
            <label className="portal-check">
              Advisor’s school email
              <input className="input" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="portal-check">
              Access ends after
              <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {EXPIRY_CHOICES.map((c) => (
                  <option key={c.days} value={c.days}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {shareProblem ? <p className="portal-muted">{shareProblem}</p> : null}
          <button
            type="button"
            className="balance-button"
            disabled={!plausibleEmail(email) || !sharedAs.trim() || Boolean(shareProblem)}
            onClick={() => setConfirm('share')}
          >
            Preview and share…
          </button>
          {/* Keyed by account: after a switch on a shared device it starts empty and reloads, never showing the last account's shares. */}
          <SharingPanel key={accountId} refresh={refresh} onSaid={setSaid} />
        </>
      ) : (
        <p className="portal-muted">Sign in to share with an advisor. You can still download or print the summary and bring it.</p>
      )}

      <AdvisorSharedView key={accountId ?? 'signed-out'} signedIn={Boolean(accountId)} />

      {confirm === 'download' || confirm === 'print' ? (
        <ConfirmDialog
          title={confirm === 'download' ? 'Download this summary?' : 'Print this summary?'}
          preview={
            <>
              <pre className="advisor-summary">{summary}</pre>
              <p>Private notes are not included.</p>
            </>
          }
          confirmLabel={confirm === 'download' ? 'Download' : 'Print'}
          onConfirm={done}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'remove' ? (
        <ConfirmDialog
          title="Remove this meeting from this device?"
          preview={<p>“{meeting.title}” — its agenda, questions, follow-ups and private notes. Shares you already made stay until you revoke them.</p>}
          confirmLabel="Remove"
          onConfirm={done}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'share' && payload ? (
        <ConfirmDialog
          title="Share this with your advisor?"
          preview={
            <ActionPreview
              subject={meeting?.title || 'This meeting'}
              says={
                <>
                  <strong>{email.trim()}</strong> will see exactly this, as “{payload.sharedAs}”, until {day(expiryFrom(days, now.getTime()))}:
                </>
              }
              exactly={payloadLines(payload).map((s) => (
                <div key={s.heading}>
                  <p>
                    <strong>{s.heading}</strong>
                  </p>
                  <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
                </div>
              ))}
              doesNotChange="Nothing else is shared."
              recovery={{ kind: 'undo', how: 'Revoke it from this screen. You will see when it is opened.' }}
            />
          }
          confirmLabel="Share"
          onConfirm={() => void doShare()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}

function LineList({
  title,
  one,
  add,
  items,
  onChange,
  extra,
}: {
  title: string;
  /** What one item is called: "Question", so the field reads "Question 2". */
  one: string;
  add: string;
  items: Line[];
  onChange: (next: Line[]) => void;
  extra?: (item: Line) => React.ReactNode;
}) {
  return (
    <>
      <h4 className="balance-heading">{title}</h4>
      {items.length ? (
        <ol className="advisor-lines">
          {items.map((item, i) => (
            <li key={item.id}>
              <label className="portal-check">
                {one} {i + 1}
                <input
                  className="input"
                  maxLength={LIMITS.text}
                  value={item.text}
                  onChange={(e) => onChange(items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)))}
                />
              </label>
              {extra ? extra(item) : null}
              <button type="button" aria-label={`Remove ${one.toLowerCase()} ${i + 1}`} onClick={() => onChange(items.filter((x) => x.id !== item.id))}>
                Remove
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <button
        type="button"
        className="balance-button"
        disabled={items.length >= LIMITS.items}
        onClick={() => onChange([...items, { id: crypto.randomUUID(), text: '' }])}
      >
        {add}
      </button>
    </>
  );
}

function SharingPanel({ refresh, onSaid }: { refresh: number; onSaid: (s: string) => void }) {
  const [data, setData] = useState<{ shares: ShareRow[]; events: ShareEvent[] } | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ row: ShareRow; what: 'revoke' | 'delete' } | null>(null);
  const [now] = useState(() => Date.now());
  const load = useCallback(() => {
    myShares().then(
      (d) => {
        setData(d);
        setError('');
      },
      (e: unknown) => setError(e instanceof Error ? e.message : 'Your shares could not be loaded.'),
    );
  }, []);
  useEffect(load, [load, refresh]);

  const act = async () => {
    if (!confirm) return;
    const { row, what } = confirm;
    setConfirm(null);
    try {
      if (what === 'revoke') await revokeShare(row.id);
      else await deleteShare(row.id);
      onSaid(what === 'revoke' ? `“${row.title}” is revoked. Your advisor can no longer open it.` : `“${row.title}” and its access log are deleted.`);
      load();
    } catch (e) {
      onSaid(e instanceof Error ? e.message : 'That did not work.');
    }
  };

  return (
    <section className="advisor-shares" aria-label="Your advisor shares">
      <h4 className="balance-heading">Your shares</h4>
      {error ? (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={load}>
            Try again
          </button>
        </p>
      ) : !data ? (
        <p className="portal-muted">Loading your shares…</p>
      ) : !data.shares.length ? (
        <p className="portal-muted">You have not shared anything with an advisor.</p>
      ) : (
        <ul className="advisor-share-list">
          {data.shares.map((row) => {
            const st = shareState(row, now);
            const opened = data.events.filter((e) => e.share_id === row.id);
            return (
              <li key={row.id} data-state={st}>
                <strong>{row.title}</strong> — shared {day(row.created_at)}.{' '}
                {st === 'active' ? `Open until ${day(row.expires_at)}.` : st === 'expired' ? `Expired ${day(row.expires_at)}.` : `Revoked ${day(row.revoked_at!)}.`}{' '}
                {opened.length ? `Opened ${opened.length} ${opened.length === 1 ? 'time' : 'times'}, last on ${day(opened[0].read_at)}.` : 'Not opened yet.'}
                <span className="course-v2-actions">
                  {st === 'active' ? (
                    <button type="button" className="balance-button" onClick={() => setConfirm({ row, what: 'revoke' })}>
                      Revoke…
                    </button>
                  ) : null}
                  <button type="button" className="balance-button" onClick={() => setConfirm({ row, what: 'delete' })}>
                    Delete…
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {confirm ? (
        <ConfirmDialog
          title={confirm.what === 'revoke' ? 'Revoke this share?' : 'Delete this share?'}
          preview={
            <p>
              {confirm.what === 'revoke'
                ? `“${confirm.row.title}” stops opening for your advisor now. It stays in your list, with its access log, until you delete it.`
                : `“${confirm.row.title}” and its access log are deleted. If it is still open, your advisor loses it too.`}
            </p>
          }
          confirmLabel={confirm.what === 'revoke' ? 'Revoke' : 'Delete'}
          onConfirm={() => void act()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </section>
  );
}

