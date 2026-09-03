import { useState } from 'react';
import { useStore } from '../state/store';
import { addressIn } from '../lib/mail';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, SectionLabel } from '../components/ui';
import { parseMaterial } from '../lib/parse';
import { datedItems, railFor } from '../lib/select';
import { dateToIso } from '../lib/date';
import {
  PROVIDERS,
  addEvent,
  addTask,
  describe,
  fetchRemoteText,
  listMail,
  listRemoteFiles,
  tokens,
  type Message,
  type ProviderId,
  type RemoteFile,
} from '../lib/connect';

const TABS = ['Files', 'Mail', 'Send out'] as const;
type Tab = (typeof TABS)[number];

/**
 * The connected accounts, doing something.
 *
 * Connecting an account is not the feature; what you can then do with it is.
 * Three things, each one a thing a student actually does by hand today:
 *
 *  · **Files** — the syllabus is in Drive or OneDrive, not on the phone. Pull
 *    it straight into a course rather than downloading and re-uploading it.
 *  · **Mail** — course announcements arrive as email and are lost by Thursday.
 *    The ones naming a course become material or a task in one tap.
 *  · **Send out** — a deadline that lives only in this app is a deadline your
 *    phone's alarms know nothing about. Push it to the calendar and the task
 *    list you already use.
 *
 * Nothing here sends mail, deletes a file, or writes anything you did not ask
 * for by name.
 */
export function Cloud() {
  const { state, dispatch, now, catalog } = useStore();
  const live = tokens();
  const available = (Object.keys(PROVIDERS) as ProviderId[]).filter(
    (id) => live[id] && PROVIDERS[id].calendar,
  );

  const [tab, setTab] = useState<Tab>('Files');
  const [provider, setProvider] = useState<ProviderId>(available[0] ?? 'google');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [mail, setMail] = useState<Message[]>([]);

  const run = async (what: string, fn: () => Promise<string | void>) => {
    setBusy(what);
    setError('');
    setNote('');
    try {
      const said = await fn();
      if (typeof said === 'string') setNote(said);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy('');
    }
  };

  if (available.length === 0) {
    return (
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Nothing connected</div>
          <div className="chrome-text" style={{ fontSize: 25, marginTop: 8, lineHeight: 1.1 }}>
            Connect an account first
          </div>
          <div style={{ fontSize: 13, opacity: 0.78, marginTop: 8, lineHeight: 1.5 }}>
            Microsoft 365 or Google. Then your syllabus in Drive, the announcements in your inbox
            and your real calendar are all reachable from here.
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => dispatch({ type: 'go', screen: 'connect' })}
            style={{ height: 44, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 14 }}
          >
            Connect accounts
          </button>
        </Blueprint>
      </div>
    );
  }

  /** Pull a document's text and file it against a course as material. */
  const importFile = (file: RemoteFile) =>
    run(`Reading ${file.name}…`, async () => {
      const text = await fetchRemoteText(provider, file);
      const parsed = parseMaterial(text);
      const courseId = state.guideId in catalog.byId ? state.guideId : catalog.courses[0]?.id;
      if (!courseId) return 'Add a course first — there is nothing to file this against.';
      dispatch({
        type: 'addUpdate',
        update: {
          courseId,
          unit: null,
          title: file.name.replace(/\.[a-z0-9]+$/i, ''),
          source: PROVIDERS[provider].name,
          body: parsed.body,
          cards: parsed.cards,
          terms: parsed.terms,
          fileIds: [],
        },
      });
      return `Filed under ${catalog.byId[courseId].code}: ${parsed.cards.length} cards, ${parsed.terms.length} terms. It is in Cards, Read, Quiz and Cram now.`;
    });

  const keepMail = (m: Message) => {
    const courseId = m.courseId ?? catalog.courses[0]?.id;
    if (!courseId) return;
    dispatch({
      type: 'addUpdate',
      update: {
        courseId,
        unit: null,
        title: m.subject,
        source: `Email · ${m.from} · ${m.date}`,
        body: m.preview,
        cards: [],
        terms: [],
        fileIds: [],
      },
    });
    setNote(`Kept under ${catalog.byId[courseId].code}. It shows in Read and Cram.`);
  };

  const mailToTask = (m: Message) => {
    dispatch({
      type: 'addTask',
      task: {
        title: m.subject,
        date: m.date,
        time: '',
        note: `${m.from} — ${m.preview.slice(0, 140)}`,
        courseId: m.courseId,
      },
    });
    setNote('Added to your tasks under Mine.');
  };

  /** Everything ahead, onto the calendar you actually use. */
  const sendDeadlines = () =>
    run('Sending…', async () => {
      const ahead = datedItems(catalog, now).filter((i) => !i.isPast);
      for (const item of ahead) {
        await addEvent(provider, {
          title: `${catalog.byId[item.c].code} — ${item.title}`,
          date: dateToIso(item.date),
          at: null,
          minutes: 0,
          note: [item.detail, item.weight, item.quote && `“${item.quote}”`]
            .filter(Boolean)
            .join('\n\n'),
        });
      }
      return `${ahead.length} deadlines added to ${PROVIDERS[provider].name}. They are all-day entries, so they sit at the top of the day rather than blocking an hour.`;
    });

  const sendWeek = () =>
    run('Sending…', async () => {
      let added = 0;
      for (let ahead = 0; ahead < 7; ahead += 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
        for (const block of railFor(catalog, day, [])) {
          if (block.canceled || block.optional) continue;
          await addEvent(provider, {
            title: block.title,
            date: dateToIso(day),
            at: block.at,
            minutes: 50,
            note: block.meta,
          });
          added += 1;
        }
      }
      return `${added} classes added for the next seven days. Repeat it next week, or connect the campus calendar feed instead.`;
    });

  const sendTasks = () =>
    run('Sending…', async () => {
      const mine = state.tasks.filter((t) => !t.done);
      for (const t of mine) {
        await addTask(provider, {
          title: t.title,
          date: t.date,
          note: t.note,
        });
      }
      return `${mine.length} of your own tasks sent to ${provider === 'google' ? 'Google Tasks' : 'Microsoft To Do'}.`;
    });

  return (
    <div style={{ padding: 18 }}>
      {available.length > 1 && (
        <div className="chiprow" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {available.map((id) => {
              const on = id === provider;
              return (
                <button
                  key={id}
                  type="button"
                  className="btn"
                  onClick={() => setProvider(id)}
                  aria-pressed={on}
                  style={{
                    flex: 'none',
                    padding: '5px 11px',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    background: on ? 'var(--chrome)' : 'transparent',
                    color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
                    borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
                  }}
                >
                  {PROVIDERS[id].name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ChipRow options={[...TABS]} value={tab} onChange={(t) => setTab(t as Tab)} />

      {busy && <div style={{ fontSize: 13, opacity: 0.7, marginTop: 14 }}>{busy}</div>}
      {note && (
        <Blueprint style={{ padding: '12px 14px', marginTop: 14, background: 'var(--app-hero)' }}>
          <div style={{ fontSize: 13, lineHeight: 1.5, textWrap: 'pretty' }}>{note}</div>
        </Blueprint>
      )}
      {error && (
        <div style={{ fontSize: 12.5, color: 'var(--app-accent)', marginTop: 14, lineHeight: 1.45 }}>
          {error}
        </div>
      )}

      {tab === 'Files' && (
        <>
          <div style={{ fontSize: 13, opacity: 0.68, marginTop: 14, lineHeight: 1.5, textWrap: 'pretty' }}>
            Recent documents. Bring one in and whatever reads as a question and an answer becomes
            cards on a course; the rest is kept as notes.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== ''}
            onClick={() =>
              void run('Listing…', async () => {
                setFiles(await listRemoteFiles(provider));
              })
            }
            style={{ height: 42, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 12 }}
          >
            List recent files
          </button>
          {files.map((f) => (
            <div key={f.id} style={{ padding: '11px 0', borderBottom: '1px solid var(--app-line)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                </span>
                <span style={{ fontSize: 11, opacity: 0.45, flex: 'none' }}>{f.modified}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                <button
                  type="button"
                  className="bare"
                  disabled={busy !== '' || !f.download}
                  onClick={() => void importFile(f)}
                  style={{ fontSize: 11, letterSpacing: '0.1em', opacity: f.download ? 0.8 : 0.3, width: 'auto' }}
                >
                  ADD TO A COURSE
                </button>
                <a
                  href={f.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.5 }}
                >
                  OPEN
                </a>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'Mail' && (
        <>
          <div style={{ fontSize: 13, opacity: 0.68, marginTop: 14, lineHeight: 1.5, textWrap: 'pretty' }}>
            Mail from the last six weeks that names one of your courses. Read-only — the app never
            sends anything as you.
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== ''}
            onClick={() =>
              void run('Searching your mail…', async () => {
                const found = await listMail(catalog.courses, provider);
                setMail(found);
                if (found.length === 0) return 'Nothing in the last six weeks names a course.';
              })
            }
            style={{ height: 42, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 12 }}
          >
            Find course mail
          </button>
          {mail.map((m) => (
            <Blueprint key={m.id} style={{ padding: '13px 14px', marginTop: 10 }}>
              <div className="kicker">
                {m.courseId ? catalog.byId[m.courseId]?.code : 'Unmatched'} · {m.date}
              </div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, marginTop: 4, lineHeight: 1.25 }}>
                {m.subject}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 2 }}>{m.from}</div>
              <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 7, lineHeight: 1.45 }}>
                {m.preview.slice(0, 220)}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
                <button
                  type="button"
                  className="bare"
                  onClick={() => keepMail(m)}
                  style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.8, width: 'auto' }}
                >
                  KEEP AS MATERIAL
                </button>
                <button
                  type="button"
                  className="bare"
                  onClick={() => mailToTask(m)}
                  style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.8, width: 'auto' }}
                >
                  MAKE A TASK
                </button>
                <button
                  type="button"
                  className="bare"
                  onClick={() =>
                    dispatch({
                      type: 'writeMail',
                      purposeId: 'reply',
                      courseId: m.courseId ?? '',
                      to: addressIn(m.from),
                      incoming: `From: ${m.from}\nSubject: ${m.subject}\n\n${m.preview}`,
                    })
                  }
                  style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.8, width: 'auto' }}
                >
                  DRAFT A REPLY
                </button>
                {m.link && (
                  <a href={m.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.5 }}>
                    OPEN
                  </a>
                )}
              </div>
            </Blueprint>
          ))}
        </>
      )}

      {tab === 'Send out' && (
        <>
          <div style={{ fontSize: 13, opacity: 0.68, marginTop: 14, lineHeight: 1.5, textWrap: 'pretty' }}>
            Push what is in here out to the calendar and task list you already live in. Run these
            once; they add, they never delete, so running one twice makes duplicates.
          </div>

          <SectionLabel>Deadlines</SectionLabel>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== ''}
            onClick={() => void sendDeadlines()}
            style={{ height: 44, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Add {datedItems(catalog, now).filter((i) => !i.isPast).length} deadlines to{' '}
            {PROVIDERS[provider].name}
          </button>

          <SectionLabel>This week's classes</SectionLabel>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== ''}
            onClick={() => void sendWeek()}
            style={{ height: 44, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Add the next seven days
          </button>

          <SectionLabel>Your own tasks</SectionLabel>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy !== '' || state.tasks.filter((t) => !t.done).length === 0}
            onClick={() => void sendTasks()}
            style={{ height: 44, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Send {state.tasks.filter((t) => !t.done).length} unfinished to{' '}
            {provider === 'google' ? 'Google Tasks' : 'Microsoft To Do'}
          </button>
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
