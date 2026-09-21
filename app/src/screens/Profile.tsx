import { useMemo } from 'react';
import { useStore } from '../state/store';
import { pickPersisted } from '../state/shape';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { Avatar } from '../components/Avatar';
import { SectionLabel } from '../components/ui';
import { CustomRow, Group, NavRow } from '../components/shell/Rows';
import { inventory } from '../lib/inventory';
import { heading, held, named, nothingHeld, oldestLine, saidAbout, toldLine } from '../lib/profile';
import { roleOf } from '../lib/role';
import { cloudConfigured } from '../lib/cloud';

/**
 * You, as a screen.
 *
 * The app has known four things about the person holding it for a long time and
 * never put them together. The name was a field on the Courses settings page;
 * the account was a screen about syncing; the school was a picker further down
 * the same settings page; the role was a list of radio buttons beside it. Every
 * one of those is a good home for a *setting*, and none of them answers the
 * question a person actually asks — "what does this app think I am?" — which is
 * the question behind the little round picture at the top right of every phone.
 *
 * So this is that screen, and the header now has that picture. `lib/profile.ts`
 * holds the arithmetic, `components/Avatar.tsx` draws the letters.
 *
 * ## What it owns, and what it only points at
 *
 * It owns exactly one thing: **your name**. That moved here from Settings →
 * Courses, and it moved rather than being copied — two boxes holding one string
 * is the duplicate this codebase keeps deleting, and a name on a courses page
 * was only ever there because there was nowhere else to put it. Settings has a
 * row pointing here instead.
 *
 * Everything else on this screen is a row. Signing in belongs to Account,
 * because that screen explains what syncs and what does not; what is held and
 * how big it is belongs to Your data; what leaves the device belongs to
 * Privacy; the role and the school belong to the settings page that has the
 * pickers. A profile screen that re-implemented any of those would be the
 * second door onto a room that already has one — see `lib/onehome.test.ts`.
 *
 * The counts under "What Semester holds" are the one thing that looks like an
 * exception and is not: they are `inventory`'s own rows, the same function and
 * therefore the same numbers the data screen prints, summarised to the six a
 * person would recognise as theirs. See `SUMMARY` in `lib/profile.ts`.
 *
 * ## No photograph, no bio, no "member since"
 *
 * The three things a profile screen accumulates when nobody is watching. A
 * photograph needs bytes in a quota that already sheds data when it fills, and
 * uploading one needs a server this app does not have. A bio is for other
 * people to read and there are no other people here. "Member since" is a date
 * about the app; the line at the bottom is a date about *your semester*, which
 * is the thing you would actually want to know before erasing a phone.
 */
export function Profile() {
  const { state, dispatch, account, sync, school, catalog } = useStore();

  // The same measurement the data screen makes, made once. `pickPersisted` is
  // the whole of what is stored, so nothing can be held and uncounted here.
  // The courses are the one figure taken from the catalogue instead — `held`
  // says why, and the answer is the semester the app ships with.
  const store = useMemo(() => inventory(pickPersisted(state)), [state]);
  const holdings = held(store.rows, catalog.courses.length);
  const said = saidAbout({ account, status: sync.status, at: sync.at });
  const kept = oldestLine(store.span);
  const role = roleOf(state.role);

  return (
    <Page>
      {/*
        The bottom margin is load-bearing in the grouped layout and invisible
        in the other two. A `Group`'s heading carries its own 26px of space
        above it in `plain` and none at all in `grouped` — see
        `components/shell/Rows.tsx`, where the grouped section is spaced by its
        own bottom margin instead — so anything that is *not* a Group has to
        give the one below it room. Margins collapse, so the 26px still wins
        where there is 26px, and this changes nothing outside grouped.
      */}
      <Blueprint
        style={{
          padding: 'var(--sp-7)',
          background: 'var(--app-hero)',
          marginBottom: 'var(--sp-7)',
        }}
      >
        <div style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'center' }}>
          <Avatar name={state.myName} size={64} />
          <div style={{ minWidth: 0 }}>
            <div
              /* The prompt is not the name, and should not be set like one —
                 so it is not set in the chrome gradient at all. That was the
                 only way to say it before, and saying it with `opacity` on
                 `background-clip: text` took a 22px line to 2.20:1, because a
                 gradient has no colour to dim and the whole glyph faded. Plain
                 text at the audited rung is both the larger distinction and
                 the legible one. */
              className={named(state.myName) ? 'chrome-text' : undefined}
              style={{
                fontSize: 'calc(22px * var(--text-scale, 1))',
                lineHeight: 1.1,
                ...(named(state.myName) ? {} : { color: 'var(--app-dim)' }),
              }}
            >
              {heading(state.myName)}
            </div>
            {/* The address, or why there is not one. Ellipsised rather than
                wrapped: an email is one thing, and a second line of it under a
                name reads as a second fact. */}
            <div
              style={{
                fontSize: 'var(--type-base)',
                color: 'var(--app-dim)',
                marginTop: 'calc(3px * var(--density, 1))',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {said.line}
            </div>
            <div
              style={{
                fontSize: 'var(--type-xs-plus)',
                color: 'var(--app-dim)',
                marginTop: 'calc(3px * var(--density, 1))',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              {said.sub}
            </div>
          </div>
        </div>

        {/*
          The button that used to sit here offered `account`, and so does the
          row under "Your account and your data" below. Both were on screen at
          once — one job, two doors, in the one place you are already standing.

          The row is the one that stays, on this file's own principle: this
          screen owns your name and *points* at everything else. A primary
          button is the screen trying to be where you sign in, and signing in
          belongs to Account, "because that screen explains what syncs and what
          does not". Four passes of `SIMPLIFY-AUDIT.md` left the pair standing
          as a taste call; it was settled by the owner, this way.

          What the button knew and the row did not is the third state, and it
          moved rather than being dropped — see the row's `sub`.
        */}
      </Blueprint>

      {/*
        The one thing this screen owns rather than points at.

        It was on Settings → Courses, whose own note said it was there "because
        it is the one thing the app calls you". That was true while there was no
        profile; there is one now, and a name belongs on it.
      */}
      <Group
        header="Your name"
        footer="Only used to address you in the app. It is never sent anywhere, and never guessed at from your email — leaving it blank costs nothing, the app just says “you”."
      >
        <CustomRow>
          <input
            className="input"
            value={state.myName}
            maxLength={40}
            placeholder="What should the app call you?"
            aria-label="Your name"
            onChange={(e) => dispatch({ type: 'setMyName', name: e.target.value })}
            style={{ width: '100%', fontSize: 'var(--type-base-plus)' }}
          />
        </CustomRow>
      </Group>

      {/*
        A row rather than the list itself, for the reason the whole screen is
        rows: the editor lives on the page that explains what leaves the
        device, because that is the context in which "the assistant knows this"
        is a decision rather than a novelty. What belongs here is the count,
        which is what makes it findable from the question this screen answers.
      */}
      <Group header="What the assistant knows about you">
        <NavRow
          label="Things you have told it"
          value={toldLine(state.aboutMe.length)}
          sub="Said once, and every part of the app that asks Claude is told it."
          onClick={() => dispatch({ type: 'go', screen: 'setAssistant' })}
        />
      </Group>

      {/* Where the pickers are, said as values so the rows answer the question
          without being opened. Neither picker is drawn twice. */}
      <Group header="Where you study">
        <NavRow
          label="Your university"
          value={school.name}
          onClick={() => dispatch({ type: 'go', screen: 'setCourses' })}
        />
        <NavRow
          label="What you are here to do"
          value={role.label}
          sub={role.blurb}
          onClick={() => dispatch({ type: 'go', screen: 'setCourses' })}
        />
      </Group>

      <SectionLabel>What Semester holds</SectionLabel>
      {/* Wrapped so the margin below belongs to the whole summary rather than
          to whichever of its two endings happened to render — see the note on
          the hero above for what the margin is for. */}
      <div style={{ marginBottom: 'var(--sp-7)' }}>
        {holdings.length === 0 ? (
        <div
          style={{
            fontSize: 'var(--type-base)',
            color: 'var(--app-dim)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          {nothingHeld()}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            /*
             * Three across on a phone, more where there is room.
             *
             * `auto-fill`, not `auto-fit`, and the difference is the whole
             * reason this line has a comment. `auto-fit` collapses the tracks
             * nothing landed in, so a semester with one thing in it — which is
             * every first week — drew a single tile stretched the full width of
             * the window with one digit in the corner of it. `auto-fill` keeps
             * the empty tracks, so a tile is a tile whether there are six of
             * them or one.
             */
            gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
            gap: 'var(--sp-4)',
          }}
        >
          {/* `plain`: six of these sit in a grid, and six framed cards put
              twenty-four registration marks in a block small enough that they
              collide across the gaps. Blueprint's own rule — feature cards
              keep the marks, repeated rows drop them. */}
          {holdings.map((h) => (
            <Blueprint plain key={h.label} style={{ padding: 'var(--sp-5)' }}>
              <div
                className="chrome-text"
                style={{ fontSize: 'calc(20px * var(--text-scale, 1))', lineHeight: 1.1 }}
              >
                {h.count}
              </div>
              <div
                style={{
                  fontSize: 'var(--type-xs-plus)',
                  color: 'var(--app-dim)',
                  marginTop: 'calc(3px * var(--density, 1))',
                  lineHeight: 'var(--leading-normal)',
                }}
              >
                {h.label}
              </div>
            </Blueprint>
          ))}
        </div>
      )}
        {kept && (
          <div
            style={{
              fontSize: 'var(--type-xs-plus)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-normal)',
              textWrap: 'pretty',
            }}
          >
            {kept}
          </div>
        )}
      </div>

      {/*
        The rest of it, as rows to the screens that own each thing.

        Written out rather than generated from the registry on purpose: this is
        a short, ordered list of the five things somebody opens a profile to
        reach, and the directory on Progress is the screen that lists
        everything. A profile that grew into a second directory would be the
        thing `screens/Me.tsx` already is.
      */}
      <Group header="Your account and your data">
        {/*
          Three states, not two, and the third is the reason this row reads the
          way it does.

          `cloudConfigured` is false on a build where no sign-in is switched
          on, and a row promising "two devices hold one semester" there is a
          promise the build cannot keep — the shape `components/Credentials.tsx`
          exists to refuse. The button this replaced said "How this device
          works" for exactly that case, and the sentence had to survive it.
        */}
        <NavRow
          label="Account"
          sub={
            account
              ? 'Signing in, syncing, and signing out'
              : cloudConfigured
                ? 'Sign in so two devices hold one semester'
                : 'What this copy does without an account'
          }
          onClick={() => dispatch({ type: 'go', screen: 'account' })}
        />
        <NavRow
          label="Your data"
          sub="Every record the app holds, counted and weighed"
          onClick={() => dispatch({ type: 'go', screen: 'data' })}
        />
        <NavRow
          label="Privacy"
          sub="What leaves this device, and how to be rid of all of it"
          onClick={() => dispatch({ type: 'go', screen: 'privacy' })}
        />
        <NavRow
          label="Take it with you"
          sub="A copy of the semester, in formats other things can read"
          onClick={() => dispatch({ type: 'go', screen: 'export' })}
        />
        <NavRow
          label="Settings"
          sub="Colour, type, navigation, alerts, grading"
          onClick={() => dispatch({ type: 'go', screen: 'settings' })}
        />
      </Group>
    </Page>
  );
}
