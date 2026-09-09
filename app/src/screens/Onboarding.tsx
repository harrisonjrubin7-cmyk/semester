import { useStore } from '../state/store';
import { askReminders, type Tone } from '../lib/tone';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, Toggle } from '../components/ui';
import { NOTIF_DEFS } from '../data/misc';
import { Check } from '../components/Icons';
import type { Catalog } from '../data/catalog';
import { SchoolPicker } from '../components/SchoolPicker';
import { Credentials } from '../components/Credentials';
import { cloudConfigured } from '../lib/cloud';
import { useSoft } from '../components/shell/useShell';
import { Step } from '../components/soft/Soft';
import { welcomeLead, welcomeLine } from '../lib/welcome';

/**
 * The first two screens, written from what is actually loaded.
 *
 * These used to be four fixed sentences about one student's four PDFs — a new
 * user was told "We found 38 dated obligations across four courses" before
 * they had uploaded anything, and shown four filenames that were not theirs.
 * The first thing the app said was false, which is a bad way to be trusted
 * with a semester. Now it counts what is there, and when nothing is there it
 * says what will happen instead of pretending it already has.
 */
function steps(cat: Catalog, tone: Tone, hasAccount: boolean) {
  // A build with no project configured has nothing to sign in to, and saying
  // so is better than a form that answers every press with a service error.
  const offline = !cloudConfigured;
  const n = cat.courses.length;
  const items = cat.items.length;
  const empty = n === 0;

  return [
    {
      k: 'Semester',
      t: empty ? 'Your syllabi. One brain.' : `${n} ${n === 1 ? 'syllabus' : 'syllabi'}. One brain.`,
      b: empty
        ? 'Upload the PDFs your professors posted and get the semester back — every deadline, a study guide you can drill, and a calendar that knows when your classes are.'
        : 'Every deadline in your semester, pulled straight out of the PDFs your professors posted.',
      cta: empty ? 'Show me' : 'Set it up',
    },
    {
      k: 'Step 2 of 5',
      t: empty ? 'Drop one in.' : 'Dropped in. Read.',
      b: empty
        ? 'A syllabus goes in as a PDF, a Word file or pasted text. What comes back is checked before you see it — dates forced into the real calendar, and every quote tested against your own document.'
        : `${items} dated ${items === 1 ? 'obligation' : 'obligations'} across ${n} ${n === 1 ? 'course' : 'courses'} — including the ones buried in prose.`,
      cta: empty ? 'Good' : 'Looks right',
    },
    {
      k: 'Step 3 of 5',
      t: 'Where do you study?',
      /*
       * Asked, and genuinely optional.
       *
       * What it buys is small and specific: the meal screen, the move-out
       * countdown, the campus map, and the app calling your registrar by the
       * name you call it. What it does not touch is everything anybody comes
       * here for — so the skip below is a real path and is worded like one.
       */
      b: 'It switches on the handful of screens that only make sense on a campus, and changes a few words. Everything else works without it.',
      cta: 'Next',
    },
    {
      k: 'Step 4 of 5',
      /*
       * The account, asked for once, where somebody will actually see it.
       *
       * It used to live in Settings → Account and nowhere else, which meant a
       * first run never mentioned that an account existed — and the people who
       * most need one are the people who have not gone looking through
       * Settings yet. It comes fourth rather than first because a password is
       * a bad thing to ask for before somebody knows what the app is, and
       * before the alerts rather than after because a reminder the server
       * sends has to belong to an account: signing in here is what lets the
       * next screen's switches reach a phone that is asleep.
       */
      t: offline
        ? 'This one stays on the device.'
        : hasAccount
          ? 'That is the account done.'
          : 'One semester, every device.',
      b: offline
        ? 'This build has no account service switched on, so there is nothing to sign in to. Everything you do is saved here and goes no further — which is the whole app, minus the copy that follows you to a laptop.'
        : hasAccount
          ? 'Your courses, notes, tasks and ticked boxes are on the account now, and the laptop gets the same semester the moment you sign in there.'
          : 'An email address and a password, and the semester follows you to the laptop and back. Skip it and everything still works — it just stays on this device.',
      cta: offline || hasAccount ? 'Next' : 'Not now',
    },
    {
      k: 'Step 5 of 5',
      t: askReminders(tone),
      b: 'Change any of this later. Nothing here is permanent.',
      cta: empty ? 'Get started' : 'Start the semester',
    },
  ];
}

/** Five screens: the promise, what it read, where you study, the account, the alerts. */
export function Onboarding() {
  const { state, dispatch, catalog, now, account } = useStore();
  const soft = useSoft();
  const all = steps(catalog, state.tone, Boolean(account));
  const step = all[state.onb] ?? all[0];

  /*
   * No `<Page>` here, deliberately.
   *
   * Onboarding runs outside the shell: no header, no tab bar, its own
   * `safe-top` and its own padding, one step at a time. There is nothing to
   * search yet — the app has no data until this finishes.
   */
  /*
   * `<main>`, because this is the whole page while it is up.
   *
   * Onboarding replaces the shell rather than sitting inside it, so the
   * `<main>` that `ScrollArea` renders is not on the page at all — and a
   * first run is the one visit where every user is a new user. Lighthouse
   * scored the app 96 on accessibility for exactly this, and the single
   * failing audit was `landmark-one-main` on this screen.
   */
  return (
    <main
      className="safe-top"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '70px 24px 42px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 34 }}>
        {all.map((_, i) => (
          <div key={i} style={{ height: 3, flex: 1, background: 'var(--app-line)' }}>
            <div
              style={{
                height: '100%',
                width: '100%',
                background: 'var(--chrome)',
                opacity: i <= state.onb ? 1 : 0,
              }}
            />
          </div>
        ))}
      </div>

      <div className="kicker">{step.k}</div>
      <div
        className="chrome-text"
        style={{
          fontSize: 'calc(42px * var(--text-scale, 1))',
          lineHeight: 1.04,
          letterSpacing: '-0.01em',
          margin: '10px 0 14px',
          textWrap: 'pretty',
        }}
      >
        {soft && state.onb === 0 ? welcomeLine(catalog, now) : step.t}
      </div>
      <div style={{ fontSize: 'calc(16px * var(--text-scale, 1))', lineHeight: 'var(--leading-relaxed)', opacity: 0.72, maxWidth: '30ch' }}>
        {soft && state.onb === 0 ? welcomeLead(catalog) : step.b}
      </div>

      {/*
        The soft shell says what is ahead, on the first screen only.

        Four numbered cards, one per step, so the four screens that follow are
        a thing with an end rather than a corridor. The steps themselves keep
        every input they had — the school picker and the alert switches are
        where they were, because this is a different opening panel and not a
        different flow, and the restructure's second rule is that no screen
        loses a feature.

        `Step` was built in step 2 and had no callers until here.
      */}
      {soft && state.onb === 0 && (
        <div className="soft-steps">
          {all.map((one, i) => (
            <Step key={one.k} n={i + 1} head={one.t}>
              {one.b}
            </Step>
          ))}
        </div>
      )}

      {/* Empty boxes on a first run look like something failed to load. */}
      {!soft && state.onb === 0 && catalog.courses.length > 0 && (
        <Blueprint
          style={{
            marginTop: 34,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {catalog.courses.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'calc(17px * var(--text-scale, 1))',
                  width: 88,
                  color: 'var(--app-accent)',
                }}
              >
                {c.code}
              </div>
              <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, flex: 1 }}>{c.name}</div>
            </div>
          ))}
        </Blueprint>
      )}

      {state.onb === 1 && catalog.courses.length > 0 && (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          {catalog.courses.map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-6)',
                border: '1px solid var(--app-line)',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  flex: 'none',
                  border: '1.5px solid var(--app-accent)',
                  background: 'var(--chrome)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--chrome-ink)',
                }}
              >
                <Check size={11} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--type-base)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.source || c.code}
                </div>
                <div
                  style={{
                    fontSize: 'var(--type-xs)',
                    opacity: 0.5,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {catalog.items.filter((i) => i.c === c.id).length} dates ·{' '}
                  {catalog.guides[c.id]?.units.length ?? 0} units
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {state.onb === 2 && (
        <div style={{ marginTop: 26 }}>
          <SchoolPicker />
        </div>
      )}

      {/*
        The form, or the sentence that says it is already done.

        `onDone` moves the run on by itself: somebody who has just watched a
        button say "Working…" and then nothing has no way to tell a made
        account from a broken one. It fires only when a session actually
        exists — with email confirmation switched on there is a message about
        an inbox to read instead, and moving off it would be hiding the one
        instruction that matters.
      */}
      {state.onb === 3 && cloudConfigured && (
        <div style={{ marginTop: 'var(--sp-7)' }}>
          {account ? (
            <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-relaxed)' }}>
              Signed in as {account.email}.
            </div>
          ) : (
            <Credentials onDone={() => dispatch({ type: 'onbNext' })} />
          )}
        </div>
      )}

      {state.onb === 4 && (
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column' }}>
          {NOTIF_DEFS.map((n) => (
            <Toggle
              key={n.k}
              label={n.label}
              on={state.notifs[n.k]}
              onChange={() => dispatch({ type: 'toggleNotif', k: n.k })}
            />
          ))}
        </div>
      )}

      {/*
        The way in to the rest of it, on the last step.

        The guide's first two sections and this tour cover the same ground, and
        this covers it better: it knows whether any courses are loaded and says
        something different when they are. Replacing it with generated prose
        would have cost that to gain a consistency nobody would notice. What
        was missing was a way from here to the guide, which is this — and
        `restartOnboarding`, on the guide, is the way back.
      */}
      {state.onb === 4 && (
        <button
          type="button"
          className="bare tappable"
          onClick={() => dispatch({ type: 'go', screen: 'help' })}
          style={{
            marginTop: 18,
            textAlign: 'left',
            fontSize: 'calc(12.5px * var(--text-scale, 1))',
            opacity: 0.6,
            lineHeight: 'var(--leading-normal)',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Or read what every screen does first
        </button>
      )}

      <div style={{ flex: 1, minHeight: 24 }} />

      {/* Secondary on the account step, where the primary action is the
          form's own button and two primaries would be two answers to one
          question. */}
      <ActionButton
        onClick={() => dispatch({ type: 'onbNext' })}
        tone={state.onb === 3 && cloudConfigured && !account ? 'secondary' : 'primary'}
        style={{ fontSize: 'calc(16px * var(--text-scale, 1))' }}
      >
        {step.cta}
      </ActionButton>
      <ActionButton
        onClick={() => dispatch({ type: 'finishOnboarding' })}
        tone="ghost" spacing="0.14em"
        style={{ fontSize: 'var(--type-sm)', opacity: 0.55 }}
      >
        Skip
      </ActionButton>
    </main>
  );
}
