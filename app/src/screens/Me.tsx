import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useRowStyle } from '../components/shell/useShell';
import { permission, requestPermission, type Permission } from '../lib/notify';
import { Blueprint } from '../components/Blueprint';
import { ActionButton, EmptyState, Segmented } from '../components/ui';
import { Group as Panel, NavRow } from '../components/shell/Rows';
import { Bell } from '../components/Icons';
import { NOTIFICATIONS } from '../data/misc';
import { ByTask } from '../components/nav/ByTask';

import type { CourseModule } from '../lib/types';
import { cardKey } from '../lib/review';
import { TypeToConfirm } from '../components/TypeToConfirm';
import { You } from './me/You';

/**
 * The shelves, in the order they read: what you study, what you make with it,
 * the semester itself, the upkeep of it, the campus around it, and then you.
 *
 * One at a time rather than all five stacked. The list was a single scroll of
 * twenty-eight rows under five headings, which is a directory you read once
 * and then never again because you cannot remember which heading a thing was
 * under. Five short shelves you can flick between is the same information and
 * a different object.
 */




/**
 * One course in the list, with the one question the app still asks.
 *
 * Removing a course is the single thing here that an undo cannot fix — it takes
 * the guide, the units, the cards and every answer recorded against them — so
 * this is where `TypeToConfirm` earns its place. Everything else in the app
 * removes immediately and offers the toast in `Undone.tsx` instead.
 *
 * The row owns its own asking state rather than `Me` owning a "which course is
 * being confirmed" field, because a row is exactly the scope the question has.
 */
export function CourseRow({ module: c }: { module: CourseModule }) {
  const { state, dispatch } = useStore();
  const rowThirteen = useRowStyle(13);
  const [asking, setAsking] = useState(false);

  const cards = c.guide.units.reduce((n, u) => n + u.cards.length, 0);
  const answered = c.guide.units.reduce(
    (n, u) => n + u.cards.filter((card) => state.reviews[cardKey(c.course.id, card.q)]).length,
    0,
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-6)',
        ...rowThirteen,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--type-md)' }}>{c.course.code}</div>
        <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}>
          {c.guide.units.length} units · {c.items.length} deadlines · from {c.course.source}
        </div>
      </div>
      <button
        type="button"
        className="bare"
        onClick={() => setAsking(true)}
        style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', flex: 'none', width: 'auto' }}
      >
        REMOVE
      </button>

      {asking && (
        <TypeToConfirm
          title={`Remove ${c.course.code}`}
          what={[
            `${c.guide.units.length} units and ${cards} cards go with it.`,
            `${c.items.length} deadlines from this syllabus go with it.`,
            answered > 0
              ? `${answered} ${answered === 1 ? 'card you have answered' : 'cards you have answered'} — that history goes too.`
              : 'You have not answered any of its cards yet.',
            'Importing the syllabus again brings the course back, but not the answers.',
          ]}
          want={c.course.code}
          describe="the course code"
          confirmLabel="Remove it"
          onConfirm={() => {
            setAsking(false);
            dispatch({ type: 'removeCourse', id: c.course.id });
          }}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  );
}

export function Me() {
  const { state, dispatch } = useStore();

  const tab = state.meTab;

  return (
    <Page>
      {/*
        Every other tab opens on a switcher and then one view. Me was the one
        long scroll in the app — a stats card, then a chart, then five headed
        lists of links — which meant Settings was below five sections of things
        that are not settings.

        Two tabs, not three. Settings was the third, and it rendered the very
        index the Settings screen is: pressing the tab and pressing the
        Settings button landed on the same list, so the app had two homes for
        one thing. The screen kept its own — this keeps the row that opens it.
      */}
      {/*
        Where the Everything tab was, as a row rather than a second directory.

        This screen's own note about the Settings tab, two comments up, is the
        rule and this is it applied a second time: the tab drew the index that
        `screens/Directory.tsx` *is*, so pressing Everything and pressing All
        apps landed on the same list of the same registry, gated the same way
        through the same `offered`. The screen keeps its own; this keeps the
        row that opens it.

        Directory was the survivor because it is the better drawing of the
        registry — a category rail, a filter, favourites you pin, and a
        sentence per row — and because the workspace sidebar and the launcher
        already pointed at it. What it did not have was Lately and Not tried,
        and those moved across with this row rather than dying with the tab.

        The keywords stay on this screen's registry row on purpose: "sitemap",
        "what can this app do", "never opened" all still land here, and here
        is one tap from there. `directory` is not a destination — it is the
        shell looking at itself, the way a browser's new-tab page is not a
        bookmark — so it cannot carry them itself.
      */}
      <Panel>
        <NavRow
          label="All apps"
          sub="Every screen in the app, what each is for, and the ones you have never opened"
          onClick={() => dispatch({ type: 'go', screen: 'directory' })}
        />
      </Panel>

      <Segmented
        options={[
          { id: 'you', label: 'You' },
          { id: 'task', label: 'By task' },
        ]}
        value={tab}
        onChange={(next) => dispatch({ type: 'setMeTab', tab: next })}
        style={{ marginBottom: 'var(--sp-7)' }}
      />

      {tab === 'you' && <You />}

      {/*
        The same screens, filed under what somebody is trying to do.

        This was a screen of its own — Everything — whose four views were
        these task headings, the shelves, the never-opened list and the
        shortcut sheet that `?` and the guide already carry. Three of the four
        were tabs of this screen with different headings, so the screen went
        and the one view that was genuinely its own came here.

        The other two have since moved on again, to `screens/Directory.tsx`,
        when the tab holding them turned out to be a second directory beside
        the workspace's. This one did not go with them: a task index is not a
        directory — a screen sits on exactly one shelf and answers as many
        intentions as it serves, so several appear here more than once.

        Its own component now rather than fifty lines inline, because it is a
        grid of tiles with a filter and a sheet that opens over it, and none
        of that is anything the You tab has a use for.
        `components/nav/ByTask.tsx` says what each is for. A screen appears
        under every task it serves, so several appear more than once — that is
        the difference from the shelves, where a screen sits on exactly one: a
        shelf is where a thing lives, and a task is what you wanted when you
        went looking for it.
      */}
      {tab === 'task' && <ByTask />}

    </Page>
  );
}

export function Notifications() {
  const { state, dispatch } = useStore();

  if (state.cleared) {
    return (
      <Page>
        <EmptyState
          title="All caught up."
          body="We’ll poke you 24 hours before the next deadline."
          icon={<Bell size={18} />}
        />
      </Page>
    );
  }

  return (
    <Page>
      {NOTIFICATIONS.map((n, i) => (
        <Blueprint
          key={n.id}
          plain
          style={{
            padding: '13px 14px',
            marginBottom: 'var(--sp-5)',
            background: i < 2 ? 'var(--app-panel)' : 'transparent',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)' }}>
            <span className="tag tag-accent">{n.code}</span>
            <span
              style={{
                fontSize: 'var(--type-xs)',
                color: 'var(--app-dim)',
                fontFamily: 'var(--font-heading)',
                letterSpacing: '0.1em',
              }}
            >
              {n.when}
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'calc(19px * var(--text-scale, 1))',
              lineHeight: 1.15,
              marginTop: 'var(--sp-4)',
            }}
          >
            {n.title}
          </div>
          <div style={{ fontSize: 'var(--type-base)', opacity: 0.7, marginTop: 'var(--sp-1)' }}>{n.body}</div>
        </Blueprint>
      ))}
      <ActionButton
        onClick={() => dispatch({ type: 'clearNotifs' })}
        spacing="0.12em"
        style={{ marginTop: 'var(--sp-4)' }}
      >
        Clear all
      </ActionButton>
    </Page>
  );
}

/**
 * The permission the toggles below need, and an honest note about their reach.
 *
 * These switches did nothing for the whole life of the app: no permission was
 * ever requested, no notification ever shown. They work now while the app is
 * running. What they cannot do is wake a closed phone, and saying so here is
 * the difference between a limitation and a lie.
 */
export function Reminders() {
  const [perm, setPerm] = useState<Permission>(() => permission());

  const line =
    perm === 'granted'
      ? 'Reminders are on for this device.'
      : perm === 'denied'
        ? 'This browser is blocking notifications. Turn them back on in its site settings — the app cannot ask again.'
        : perm === 'unsupported'
          ? 'This browser has no notification support, so these stay off.'
          : 'These need permission before anything can be shown.';

  return (
    <div style={{ marginBottom: 'var(--sp-6)' }}>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        {line} They arrive while the app is open or running in the background. Waking a phone whose
        browser is closed needs a push server, which this deployment does not have — so treat these
        as a nudge while you are working, not an alarm clock.
      </div>
      {perm === 'default' && (
        <ActionButton
          onClick={() => void requestPermission().then(setPerm)}
          style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--type-xs)' }}
        >
          Allow notifications
        </ActionButton>
      )}
    </div>
  );
}

