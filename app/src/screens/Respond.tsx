import { useEffect, useState } from 'react';
import { Answering } from '../components/creation/Answering';
import { answer, answerable, openForm, type PublishedForm } from '../lib/formshare';
import { secondLine } from '../lib/dim';

/**
 * A form, answered by somebody who does not have this app.
 *
 * The only page in Semester written for a stranger. It is mounted from
 * `main.tsx` *instead of* the app rather than inside it — no store, no
 * assistant, no tab bar, no onboarding — because a respondent has no
 * semester, and putting a form behind a first-run prompt about importing a
 * syllabus would be asking somebody to adopt an app in order to answer two
 * questions.
 *
 * It is also the reason the answer key is split off in `lib/formshare.ts`:
 * everything this page holds, the person answering holds.
 *
 * ## Four states, and all four are a sentence
 *
 * Loading, gone, ready, sent. "Gone" covers a form that was withdrawn, one
 * that has not opened yet, one whose window has passed and one that never
 * existed, because the view that answers this question does not distinguish
 * them — and it should not: telling a stranger that a form exists but is shut
 * is more than the link entitles them to know.
 */
export default function Respond({ id }: { id: string }) {
  const [form, setForm] = useState<PublishedForm | null>(null);
  const [state, setState] = useState<'loading' | 'gone' | 'ready' | 'sent'>('loading');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    openForm(id)
      .then((f) => {
        if (!live) return;
        if (!f) return setState('gone');
        setForm(f);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (!live) return;
        setNote(e instanceof Error ? e.message : 'That form could not be opened.');
        setState('gone');
      });
    return () => {
      live = false;
    };
  }, [id]);

  /*
   * Longhand, and not a shorthand string, because of what the first draft did:
   * it asked for `var(--sp-6) var(--sp-5) var(--sp-8)` and there is no
   * `--sp-8` — the scale stops at seven. One undefined token in a shorthand
   * voids the whole declaration, so the page rendered with no padding at all
   * and every line of it ran into the left edge of the phone. Nothing went
   * red: it typechecks, it lints, and the suite has no opinion about a CSS
   * custom property that does not exist. It took a screenshot.
   */
  const wrap = {
    maxWidth: 640,
    margin: '0 auto',
    paddingTop: 'var(--sp-7)',
    paddingBottom: 'var(--sp-7)',
    paddingInline: 'var(--sp-7)',
    minHeight: '100dvh',
  } as const;
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' } as const;
  const quiet = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;

  const foot = (
    <p style={{ ...quiet, marginTop: 'var(--sp-7)' }}>
      Made with Semester. Your answers go to whoever sent you this link and to nobody else.
    </p>
  );

  if (state === 'loading') {
    return (
      <main style={wrap}>
        <p role="status" style={body}>
          Opening the form…
        </p>
      </main>
    );
  }

  if (state === 'gone') {
    return (
      <main style={wrap}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-xl)' }}>
          This form is not taking answers
        </h1>
        <p style={{ ...body, marginTop: 'var(--sp-4)' }}>
          {note || 'The link may have expired, or the person who made it may have taken it down.'}
        </p>
        {foot}
      </main>
    );
  }

  if (state === 'sent') {
    return (
      <main style={wrap}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-xl)' }}>Thank you</h1>
        <p style={{ ...body, marginTop: 'var(--sp-4)' }}>
          Your answers have been sent. There is nothing else to do, and you can close this page.
        </p>
        {foot}
      </main>
    );
  }

  const f = form!;

  return (
    <main style={wrap}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-xl)', textWrap: 'pretty' }}>
        {f.title}
      </h1>
      {f.description && <p style={{ ...body, marginTop: 'var(--sp-4)' }}>{f.description}</p>}
      {f.closes && <p style={{ ...quiet, marginTop: 'var(--sp-3)' }}>Closes {f.closes}.</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setNote('');
          answer(f, answers)
            .then(() => setState('sent'))
            .catch((err: unknown) => setNote(err instanceof Error ? err.message : 'That did not send.'))
            .finally(() => setBusy(false));
        }}
      >
        <Answering form={answerable(f)} answers={answers} setAnswers={setAnswers} />

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Sending…' : 'Send my answers'}
        </button>
        {note && (
          <p role="status" style={{ ...body, marginTop: 'var(--sp-5)' }}>
            {note}
          </p>
        )}
      </form>
      {foot}
    </main>
  );
}
