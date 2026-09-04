import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { Blueprint } from '../components/Blueprint';
import { ChipRow, SectionLabel } from '../components/ui';
import { ask, configured, provider } from '../lib/claude';
import { datedItems } from '../lib/select';
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
} from '../lib/mail';
import type { CourseId } from '../lib/types';

const APPS: { id: MailApp; label: string }[] = [
  { id: 'gmail', label: 'Gmail' },
  { id: 'outlook', label: 'Outlook' },
  { id: 'default', label: 'Mail app' },
];

/**
 * The email you have been putting off.
 *
 * Every part of this screen exists because of a specific reason these sit
 * unsent. The address, because it is in a PDF you would have to go and find.
 * The purpose chips, because "what am I actually asking for" is the hard part
 * and there are only about nine answers. The deadline picker, because naming
 * the assignment and its date is what turns a vague email into one that can be
 * answered in ten seconds. And the box marked "in your own words", because
 * that is the only place facts about your life may come from.
 *
 * It stops at the compose window. The app has your mail read-only on purpose
 * and this does not change that: you read the draft, you press send.
 */
export function Mail() {
  const { state, dispatch, now, catalog } = useStore();
  const seed = state.mailSeed;

  const [courseId, setCourseId] = useState<CourseId | ''>(
    seed?.courseId || (catalog.courses[0]?.id ?? ''),
  );
  const [pid, setPid] = useState(seed?.purposeId ?? PURPOSES[0].id);
  const [itemId, setItemId] = useState('');
  const [to, setTo] = useState(seed?.to ?? '');
  const [from, setFrom] = useState('');
  const [facts, setFacts] = useState('');
  const [incoming, setIncoming] = useState(seed?.incoming ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [app, setApp] = useState<MailApp>('gmail');
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const course = courseId ? (catalog.byId[courseId] ?? null) : null;
  const p = purposeById(pid);

  const items = useMemo(
    () => datedItems(catalog, now).filter((i) => !courseId || i.c === courseId),
    [catalog, now, courseId],
  );
  const item = items.find((i) => i.id === itemId) ?? null;

  // The address the syllabus gives, unless you have typed over it.
  const address = to.trim() || course?.email || '';

  const ctx: MailContext = { course, item, from, incoming, facts };

  const write = async () => {
    if (busy) return;
    setBusy(true);
    trouble.clear();
    setCopied(false);
    setSubject('');
    setBody('');
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
          setSubject(split.subject);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
    } catch {
      // Denied clipboard access does not become granted on a second press.
      trouble.wrong(
        'The browser would not give the app the clipboard. Select the text and copy it.',
      );
    }
  };

  const blanks = (body.match(/\[[^\]]+\]/g) ?? []).length;

  if (!configured()) {
    return (
      <div style={{ padding: 18 }}>
        <Blueprint style={{ padding: 16, background: 'var(--app-hero)' }}>
          <div className="kicker">Needs {provider()}</div>
          <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.5, opacity: 0.8 }}>
            Sign in to use the shared key, or add your own under Ask Claude → Settings. The
            addresses below come from your syllabi and work without it.
          </div>
        </Blueprint>
        {course?.email ? (
          <div style={{ fontSize: 13, marginTop: 14, opacity: 0.7 }}>
            {course.prof} — {course.email}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Drafts here, sends from your own mail app. Nothing leaves the app until you press send in
        Gmail or Outlook, and nothing about you goes in the draft unless you type it below.
      </div>

      <SectionLabel>What is it about</SectionLabel>
      <ChipRow
        options={PURPOSES.map((x) => x.label)}
        value={p.label}
        onChange={(label) => {
          const found = PURPOSES.find((x) => x.label === label);
          if (found) setPid(found.id);
        }}
      />
      <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 8, lineHeight: 1.45 }}>{p.blurb}</div>

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
              setTo('');
            }}
          />
        </>
      )}

      <SectionLabel>To</SectionLabel>
      <input
        className="input"
        type="email"
        value={address}
        placeholder="someone@vanderbilt.edu"
        onChange={(e) => setTo(e.target.value)}
        style={{ width: '100%' }}
      />
      {course?.prof ? (
        <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 5 }}>
          {course.prof} · opens “{salutation(course.prof)}”
        </div>
      ) : null}

      {items.length > 0 && (
        <>
          <SectionLabel>About which deadline</SectionLabel>
          <select
            className="input"
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
            className="input"
            value={incoming}
            onChange={(e) => setIncoming(e.target.value)}
            placeholder="Paste it here."
            style={{ width: '100%', minHeight: 110, resize: 'vertical', lineHeight: 1.5 }}
          />
        </>
      )}

      <SectionLabel>In your own words</SectionLabel>
      <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6, lineHeight: 1.45 }}>
        {p.asks} Anything factual in the draft has to come from here — the app will leave a blank
        rather than invent a reason for you.
      </div>
      <textarea
        className="input"
        value={facts}
        onChange={(e) => setFacts(e.target.value)}
        placeholder="Bullet points are fine. Nobody sees this but you."
        style={{ width: '100%', minHeight: 90, resize: 'vertical', lineHeight: 1.5 }}
      />

      <SectionLabel>Sign it</SectionLabel>
      <input
        className="input"
        value={from}
        placeholder="Your name"
        onChange={(e) => setFrom(e.target.value)}
        style={{ width: '100%' }}
      />

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => void write()}
        disabled={busy}
        style={{ height: 46, marginTop: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        {busy ? 'Writing…' : body ? 'Write it again' : 'Draft it'}
      </button>

      <Trouble said={trouble.said} onRetry={trouble.again} busy={Boolean(busy)} />

      {(subject || body) && (
        <>
          <SectionLabel>The draft — yours to change</SectionLabel>
          <input
            className="input"
            value={subject}
            placeholder="Subject"
            onChange={(e) => setSubject(e.target.value)}
            style={{ width: '100%' }}
          />
          <textarea
            className="input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            style={{
              width: '100%',
              minHeight: 260,
              marginTop: 8,
              resize: 'vertical',
              lineHeight: 1.55,
            }}
          />

          {blanks > 0 && (
            <div
              style={{
                fontSize: 12.5,
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 10,
                lineHeight: 1.45,
                border: '1px solid var(--app-warn-line)',
                background: 'var(--app-warn-wash)',
              }}
            >
              {blanks} {blanks === 1 ? 'blank' : 'blanks'} in square brackets still to fill in. Those
              are the facts about you — they were left empty on purpose rather than guessed.
            </div>
          )}

          <SectionLabel>Send it from</SectionLabel>
          <ChipRow
            options={APPS.map((a) => a.label)}
            value={APPS.find((a) => a.id === app)?.label ?? 'Gmail'}
            onChange={(label) => {
              const found = APPS.find((a) => a.label === label);
              if (found) setApp(found.id);
            }}
          />
          <a
            className="btn btn-primary btn-block"
            href={composeUrl(app, { to: address, subject, body })}
            target="_blank"
            rel="noreferrer"
            style={{
              height: 46,
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Open in {APPS.find((a) => a.id === app)?.label}
          </a>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void copy()}
              style={{ flex: 1, height: 42 }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                dispatch({
                  type: 'keepNote',
                  title: subject || 'Email draft',
                  body,
                  courseId: courseId || null,
                });
              }}
              style={{ flex: 1, height: 42 }}
            >
              Keep as note
            </button>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 10, lineHeight: 1.45 }}>
            The app cannot send this. It has your mail read-only, which is the point — read it
            once more and send it yourself.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}
