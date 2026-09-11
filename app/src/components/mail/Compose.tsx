import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { ChevronLeft, CloseIcon, SendIcon, TrashIcon } from '../Icons';
import { ChipRow, SectionLabel } from '../ui';
import { CheckIt } from '../CheckIt';
import { Trouble } from '../Trouble';
import { useTrouble } from '../../lib/trouble';
import { secondLine } from '../../lib/dim';
import { ask, configured, provider } from '../../lib/claude';
import { datedItems } from '../../lib/select';
import {
  PURPOSES,
  SYSTEM,
  brief,
  composeUrl,
  fallbackSubject,
  parseDraft,
  purpose as purposeById,
  salutation,
  type MailApp,
  type MailContext,
} from '../../lib/mail';
import type { MailDraft } from '../../lib/mailbox';
import type { CourseId } from '../../lib/types';

const APPS: { id: MailApp; label: string }[] = [
  { id: 'gmail', label: 'Gmail' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'default', label: 'Mail app' },
];

/**
 * The compose window.
 *
 * Docked bottom right over the mailbox, because an email answered while the
 * message is still on screen is an email that gets answered — that is the
 * whole argument for the shape, and it is why Gmail has kept it for fifteen
 * years. On a phone it is the screen.
 *
 * Two things in it are not Gmail's.
 *
 * **Help me write** is the screen this used to be: the nine things a student
 * email ever is, the deadline it is about, and a box for the facts. The draft
 * it produces invents nothing about you — a reason you have not given comes
 * back as `[a blank]`, because putting a made-up excuse in your name into a
 * professor's inbox is a lie told on your behalf. See `lib/mail.ts`.
 *
 * **Send** is honest about what it does. The app has your mail read-only and
 * cannot post a message as you; the button hands the finished draft to Gmail
 * or Outlook with every field filled in, and you press send there. The draft
 * moves to Sent here at that moment, because that is where somebody will look
 * for it, and the window says plainly that the app did not send it.
 */
export function Compose({
  draft,
  onPatch,
  onClose,
  onDiscard,
  onHanded,
}: {
  draft: MailDraft;
  onPatch: (patch: Partial<MailDraft>) => void;
  onClose: () => void;
  onDiscard: () => void;
  onHanded: () => void;
}) {
  const { catalog, now } = useStore();

  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [bcc, setBcc] = useState(draft.bcc);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [courseId, setCourseId] = useState<CourseId | ''>(draft.courseId);
  const [pid, setPid] = useState(draft.purposeId);

  const [copies, setCopies] = useState(Boolean(draft.cc || draft.bcc));
  const [small, setSmall] = useState(false);
  const [helping, setHelping] = useState(false);
  const [itemId, setItemId] = useState('');
  const [facts, setFacts] = useState('');
  const [incoming, setIncoming] = useState('');
  const [app, setApp] = useState<MailApp>('gmail');
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);

  const course = courseId ? (catalog.byId[courseId] ?? null) : null;
  const p = purposeById(pid);
  const items = useMemo(
    () => datedItems(catalog, now).filter((i) => !courseId || i.c === courseId),
    [catalog, now, courseId],
  );
  const item = items.find((i) => i.id === itemId) ?? null;
  const ctx: MailContext = { course, item, from: '', incoming, facts };

  /*
   * Saved as you type, on a settle rather than a keystroke.
   *
   * The draft is a record in the store from the moment Compose was pressed, so
   * this is an edit rather than a save — but the store writes through to
   * IndexedDB, and dispatching on every letter would be a write per letter.
   * Six hundred milliseconds is longer than a word and shorter than a pause.
   */
  useEffect(() => {
    const settle = setTimeout(
      () => onPatch({ to, cc, bcc, subject, body, courseId, purposeId: pid }),
      600,
    );
    return () => clearTimeout(settle);
  }, [to, cc, bcc, subject, body, courseId, pid, onPatch]);

  const keep = () => {
    onPatch({ to, cc, bcc, subject, body, courseId, purposeId: pid });
  };

  const write = async () => {
    if (busy) return;
    setBusy(true);
    trouble.clear();
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 1200,
        system: SYSTEM,
        messages: [{ role: 'user', content: brief(p, ctx) }],
        onText: (chunk) => {
          sofar += chunk;
          const split = parseDraft(sofar);
          if (split.subject) setSubject(split.subject);
          setBody(split.body);
        },
      });
      const split = parseDraft(sofar);
      setSubject(split.subject || fallbackSubject(p, ctx));
      setBody(split.body);
    } catch (e) {
      trouble.failed(e, () => void write());
    } finally {
      setBusy(false);
    }
  };

  const address = to.trim() || course?.email || '';
  const blanks = (body.match(/\[[^\]]+\]/g) ?? []).length;
  const name = subject.trim() || 'New message';

  return (
    <section
      className={small ? 'mb-compose is-small' : 'mb-compose'}
      aria-label="Compose an email"
      role="dialog"
      aria-modal="false"
    >
      <div className="mb-compose-top">
        <span className="mb-compose-name">{name}</span>
        <button
          type="button"
          className="mb-ico"
          aria-label={small ? 'Open the window' : 'Shrink to the bar'}
          aria-expanded={!small}
          onClick={() => setSmall(!small)}
        >
          <ChevronLeft size={17} style={{ transform: small ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
        </button>
        <button
          type="button"
          className="mb-ico"
          aria-label="Close and keep it in Drafts"
          onClick={() => {
            keep();
            onClose();
          }}
        >
          <CloseIcon size={17} />
        </button>
      </div>

      {!small && (
        <>
          <div className="mb-compose-body">
            <div className="mb-field">
              <span className="mb-field-name">To</span>
              <input
                aria-label="Who it goes to"
                type="email"
                value={address}
                placeholder="someone@vanderbilt.edu"
                onChange={(e) => setTo(e.target.value)}
              />
              {!copies && (
                <button
                  type="button"
                  className="mb-folder-n"
                  onClick={() => setCopies(true)}
                  style={{ background: 'transparent', border: 0 }}
                >
                  Cc Bcc
                </button>
              )}
            </div>

            {copies && (
              <>
                <div className="mb-field">
                  <span className="mb-field-name">Cc</span>
                  <input aria-label="Copy to" type="email" value={cc} onChange={(e) => setCc(e.target.value)} />
                </div>
                <div className="mb-field">
                  <span className="mb-field-name">Bcc</span>
                  <input
                    aria-label="Blind copy to"
                    type="email"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="mb-field">
              <span className="mb-field-name">Subject</span>
              <input
                aria-label="The subject line"
                value={subject}
                placeholder={fallbackSubject(p, ctx)}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {course?.prof && (
              <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--type-xs)', ...secondLine() }}>
                {course.prof} · opens “{salutation(course.prof)}”
              </div>
            )}

            <textarea
              className="mb-write"
              aria-label="The email itself"
              value={body}
              spellCheck
              placeholder="Write it, or press Help me write."
              onChange={(e) => setBody(e.target.value)}
            />

            {blanks > 0 && (
              <div
                style={{
                  fontSize: 'var(--type-sm)',
                  marginTop: 'var(--sp-4)',
                  padding: 'var(--sp-5)',
                  borderRadius: 'var(--r-lg)',
                  lineHeight: 'var(--leading-normal)',
                  border: '1px solid var(--app-warn-line)',
                  background: 'var(--app-warn-wash)',
                }}
              >
                {blanks} {blanks === 1 ? 'blank' : 'blanks'} in square brackets still to fill in. Those
                are the facts about you — they were left empty on purpose rather than guessed.
              </div>
            )}

            {body.trim() && <CheckIt text={body} onChange={setBody} label="Check it before you send" />}

            {helping && (
              <div style={{ marginTop: 'var(--sp-6)', borderTop: '1px solid var(--app-line)' }}>
                <SectionLabel>What is it about</SectionLabel>
                <ChipRow
                  options={PURPOSES.map((x) => x.label)}
                  value={p.label}
                  onChange={(label) => {
                    const found = PURPOSES.find((x) => x.label === label);
                    if (found) setPid(found.id);
                  }}
                />
                <div style={{ marginTop: 'var(--sp-4)', fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-normal)', ...secondLine() }}>
                  {p.blurb}
                </div>

                {catalog.courses.length > 0 && (
                  <>
                    <SectionLabel>Which course</SectionLabel>
                    <ChipRow
                      options={['None', ...catalog.courses.map((c) => c.code)]}
                      value={course?.code ?? 'None'}
                      onChange={(code) => {
                        const found = catalog.courses.find((c) => c.code === code);
                        setCourseId(found?.id ?? '');
                        setItemId('');
                      }}
                    />
                  </>
                )}

                {items.length > 0 && (
                  <>
                    <SectionLabel>About which deadline</SectionLabel>
                    <select
                      className="input"
                      aria-label="About which deadline"
                      value={itemId}
                      onChange={(e) => setItemId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="">Not about a specific one</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {catalog.byId[i.c]?.code} · {i.title} · {i.mon} {i.day}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                {p.id === 'reply' && (
                  <>
                    <SectionLabel>The message you are replying to</SectionLabel>
                    <textarea
                      aria-label="The message you are replying to"
                      className="input"
                      value={incoming}
                      onChange={(e) => setIncoming(e.target.value)}
                      placeholder="Paste it here, or open this from the message itself."
                      style={{ width: '100%', minHeight: 90, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
                    />
                  </>
                )}

                <SectionLabel>In your own words</SectionLabel>
                <div style={{ fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-3)', lineHeight: 'var(--leading-normal)', ...secondLine() }}>
                  {p.asks} Anything factual in the draft has to come from here — the app will leave a
                  blank rather than invent a reason for you.
                </div>
                <textarea
                  aria-label="In your own words"
                  className="input"
                  value={facts}
                  onChange={(e) => setFacts(e.target.value)}
                  placeholder="Bullet points are fine. Nobody sees this but you."
                  style={{ width: '100%', minHeight: 80, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
                />

                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => void write()}
                  disabled={busy || !configured()}
                  style={{ height: 42, marginTop: 'var(--sp-5)' }}
                >
                  {busy ? 'Writing…' : body.trim() ? 'Write it again' : 'Draft it'}
                </button>

                {!configured() && (
                  <div style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', ...secondLine() }}>
                    Drafting it for you needs {provider()} — sign in to use the shared key, or add
                    your own under <strong>Ask Claude &rarr; Settings</strong>. Everything else here
                    works without one.
                  </div>
                )}

                <Trouble said={trouble.said} onRetry={trouble.again} busy={busy} />
              </div>
            )}
          </div>

          <div className="mb-compose-foot">
            <a
              className="btn btn-primary"
              href={composeUrl(app, { to: address, subject: subject || fallbackSubject(p, ctx), body })}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                keep();
                onHanded();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
                height: 40,
                textDecoration: 'none',
              }}
            >
              <SendIcon size={16} />
              Open in {APPS.find((a) => a.id === app)?.label}
            </a>

            <select
              className="input"
              aria-label="Which mail app to send it from"
              value={app}
              onChange={(e) => setApp(e.target.value as MailApp)}
              style={{ width: 'auto' }}
            >
              {APPS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn btn-secondary"
              aria-pressed={helping}
              onClick={() => setHelping(!helping)}
              style={{ height: 40 }}
            >
              Help me write
            </button>

            <div style={{ flex: 1 }} />

            <button
              type="button"
              className="mb-ico"
              aria-label="Discard this draft"
              title="Discard this draft"
              onClick={onDiscard}
            >
              <TrashIcon size={17} />
            </button>
          </div>

          <div
            style={{
              padding: 'var(--sp-3) var(--sp-5) var(--sp-5)',
              fontSize: 'var(--type-xs)',
              lineHeight: 'var(--leading-normal)',
              ...secondLine(),
            }}
          >
            The app cannot send this. It has your mail read-only, which is the point — it opens in
            your own mail app with every field filled in, and you press send there.
          </div>
        </>
      )}
    </section>
  );
}
