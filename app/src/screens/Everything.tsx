import { useMemo, useRef, useState } from 'react';
import { Page } from '../components/Page';
import { TabGlyph } from '../components/TabIcon';
import { useStore } from '../state/store';
import { useRowStyle } from '../components/shell/useShell';
import { SHORTCUTS, keyLabel } from '../lib/keys';
import { offered, saysFor, type Destination } from '../lib/nav';
import {
  WHY,
  allRows,
  byTask,
  heldBy,
  matches,
  openedLabel,
  untried,
  type Found,
  type View,
} from '../lib/everything';
import type { Screen } from '../lib/types';

/**
 * Every screen in the app, and whether you have used it.
 *
 * ## Why this is not the Me screen's directory
 *
 * `Me` already lists the same registry, and that list answers "where is the
 * thing called X". It cannot answer the two questions somebody actually has
 * about an app with fifty-four screens in it: what would I use this for, and
 * which parts of it have I never touched. Those need the task tags and the
 * open history, and hanging both off the Me tab would have made a directory
 * you read once into a screen with four modes.
 *
 * ## Nothing here is a list of screens
 *
 * Not one name is written in this file. The rows are `DESTINATIONS`, the task
 * sections are the `taskTags` on those rows, the shortcuts are `SHORTCUTS`,
 * and the counts read the store. Deleting a screen from the registry deletes
 * it from all four views, which is acceptance criterion 7 and the reason the
 * file is shaped this way rather than as four hand-written lists that would
 * have been quicker and wrong by November.
 */

const VIEWS: { id: View; label: string }[] = [
  { id: 'area', label: 'By area' },
  { id: 'task', label: 'By task' },
  { id: 'untried', label: 'Not tried' },
  { id: 'keys', label: 'Shortcuts' },
];

/*
 * The view you were last on, kept out of the store.
 *
 * The brief for this screen allows no reducer changes beyond `taskTags` and
 * `lastOpened`, and it is right to: which tab somebody left a directory on is
 * not part of their semester and has no business syncing between their
 * devices. Its own key, the same as `lib/spend.ts` and `lib/chatlog.ts`, and
 * wrapped because a browser with site data blocked throws on the read rather
 * than returning null.
 */
const VIEW_KEY = 'semester.everything.view';

function lastView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return VIEWS.some((x) => x.id === v) ? (v as View) : 'area';
  } catch {
    return 'area';
  }
}

function rememberView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // A directory that cannot remember a tab is still a directory.
  }
}

export function Everything() {
  const { state, dispatch, catalog, school, now } = useStore();
  const [view, setView] = useState<View>(lastView);

  // The school's own words, everywhere: the meal row says "Meal swipes and
  // Commodore Cash" here for the same reason it does in `Me`. See `lib/nav.ts`.
  const caps = school.capabilities;
  const rows = useMemo(() => offered(caps), [caps]);
  const says = useMemo(() => (d: Destination) => saysFor(d, caps), [caps]);
  const notYet = useMemo(
    () => untried(rows, state.visited, state.lastOpened, now.getTime()),
    [rows, state.visited, state.lastOpened, now],
  );
  const universe = useMemo(() => allRows(rows, says, notYet), [rows, says, notYet]);
  const keywordsFor = useMemo(() => {
    const by = new Map(rows.map((d) => [d.screen, d.keywords]));
    return (screen: Screen) => by.get(screen) ?? '';
  }, [rows]);

  const choose = (next: View) => {
    setView(next);
    rememberView(next);
  };
  const go = (screen: Screen) => dispatch({ type: 'go', screen });

  return (
    <Page
      blurb="Every screen in the app, what it does, and whether you have used it. Built from the same list the tab bar and search read, so nothing here can describe something that is not there."
      /*
       * One box, the frame's.
       *
       * Adding a second field at the top of this screen was the obvious first
       * shape and the wrong one: `<Page>` already puts a box on every screen,
       * `/` focuses it, and two boxes one above the other is exactly the
       * confusion the frame exists to remove. So the four views are flattened
       * into one array of rows that each know which view they came from, and
       * the frame filters that. See `allRows` in `lib/everything.ts`.
       */
      search={{
        placeholder: 'Search every screen, task and shortcut',
        select: () => universe,
        match: (f: Found, q: string) => matches(f, q, keywordsFor),
        empty: (q) => `Nothing in the app matches “${q}” — not a screen, a task or a shortcut.`,
      }}
    >
      {(shown, query) =>
        query ? (
          <Results found={shown} go={go} />
        ) : (
          <>
            <Switcher value={view} onChange={choose} />
            <div id={`panel-${view}`} role="tabpanel" aria-labelledby={`tab-${view}`}>
              {view === 'area' && (
                <ByArea rows={rows} says={says} state={state} catalog={catalog} now={now} go={go} />
              )}
              {view === 'task' && <ByTask rows={rows} says={says} go={go} />}
              {view === 'untried' && (
                <NotTried rows={notYet} says={says} onArea={() => choose('area')} go={go} />
              )}
              {view === 'keys' && <Shortcuts />}
            </div>
          </>
        )
      }
    </Page>
  );
}

/**
 * A real tablist, and not the app's `Segmented`.
 *
 * `Segmented` is used on fifteen screens as a toggle group and reports itself
 * with `aria-pressed`, which is the right answer there — those buttons choose
 * what a list is filtered to, not which panel is showing. Here the four
 * buttons genuinely switch panels, so they get `role="tab"`, arrow keys and
 * roving focus, and changing `Segmented` to match would have mislabelled the
 * other fifteen.
 */
function Switcher({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const list = useRef<HTMLDivElement>(null);

  const move = (by: number) => {
    const at = VIEWS.findIndex((v) => v.id === value);
    const next = VIEWS[(at + by + VIEWS.length) % VIEWS.length];
    onChange(next.id);
    // Focus follows selection, which is what a tablist with panels rendered
    // in place should do — the panel is already under the tabs.
    requestAnimationFrame(() => {
      list.current?.querySelector<HTMLButtonElement>(`#tab-${next.id}`)?.focus();
    });
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="How to browse"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      }}
      style={{ display: 'flex', gap: 'var(--sp-3)', margin: 'var(--sp-6) 0 var(--sp-4)' }}
    >
      {VIEWS.map((v) => {
        const on = v.id === value;
        return (
          <button
            key={v.id}
            id={`tab-${v.id}`}
            type="button"
            role="tab"
            className="btn"
            aria-selected={on}
            aria-controls={`panel-${v.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(v.id)}
            style={{
              flex: 1,
              padding: 'var(--sp-4) 0',
              fontSize: 'var(--type-sm)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: on ? 'var(--chrome)' : 'transparent',
              color: on ? 'var(--chrome-ink)' : 'var(--app-fg)',
              borderColor: on ? 'rgba(255,255,255,.5)' : 'var(--app-line)',
              fontWeight: on ? 600 : 400,
            }}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One row, used by three of the four views.
 *
 * The blurb is rendered, not truncated and not a `title` attribute: a
 * directory whose descriptions are one line each with the ends cut off is a
 * directory of first halves, and a tooltip is invisible on the device most of
 * this app is used on.
 */
function Row({
  screen,
  title,
  sub,
  held,
  when,
  go,
}: {
  screen: Screen;
  title: string;
  sub: string;
  held?: string | null;
  when?: string;
  go: (screen: Screen) => void;
}) {
  const row = useRowStyle(0);
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={() => go(screen)}
      style={{
        display: 'flex',
        gap: 'var(--sp-6)',
        alignItems: 'flex-start',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--sp-6) 0',
        ...row,
      }}
    >
      <span style={{ flex: 'none', opacity: 0.75, marginTop: 'var(--sp-1)' }}>
        <TabGlyph screen={screen} size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
            {title}
          </span>
          {held ? (
            <span
              style={{
                flex: 'none',
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                opacity: held === 'empty' ? 0.38 : 0.62,
              }}
            >
              {held}
            </span>
          ) : null}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 'var(--type-sm)',
            opacity: 0.68,
            lineHeight: 'var(--leading-normal)',
            marginTop: 'var(--sp-2)',
            textWrap: 'pretty',
          }}
        >
          {sub}
        </span>
        {when ? (
          <span style={{ display: 'block', fontSize: 'var(--type-xs)', opacity: 0.42, marginTop: 'var(--sp-2)' }}>{when}</span>
        ) : null}
      </span>
    </button>
  );
}

/** A section heading that is a real heading, so a screen reader can jump by it. */
function Heading({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--type-xs)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        opacity: 0.55,
        margin: 'calc(26px * var(--density, 1)) 0 var(--sp-4)',
      }}
    >
      {children}
    </h2>
  );
}

function ByArea({
  rows,
  says,
  state,
  catalog,
  now,
  go,
}: {
  rows: Destination[];
  says: (d: Destination) => { label: string; blurb: string };
  state: ReturnType<typeof useStore>['state'];
  catalog: ReturnType<typeof useStore>['catalog'];
  now: Date;
  go: (screen: Screen) => void;
}) {
  // The shelves in registry order, and only the ones with something on them:
  // a school with no meal plan should not be shown an empty Campus heading.
  const shelves = useMemo(() => {
    const seen: string[] = [];
    for (const d of rows) if (!seen.includes(d.group)) seen.push(d.group);
    return seen.map((group) => ({ group, rows: rows.filter((d) => d.group === group) }));
  }, [rows]);

  return (
    <>
      {shelves.map(({ group, rows: shelf }) => (
        <section key={group} aria-label={group}>
          <Heading>{group}</Heading>
          {shelf.map((d) => {
            const { label, blurb } = says(d);
            return (
              <Row
                key={d.screen}
                screen={d.screen}
                title={label}
                sub={blurb}
                held={heldBy(d.screen, state, catalog)}
                when={openedLabel(state.lastOpened[d.screen], now.getTime())}
                go={go}
              />
            );
          })}
        </section>
      ))}
    </>
  );
}

function ByTask({
  rows,
  says,
  go,
}: {
  rows: Destination[];
  says: (d: Destination) => { label: string; blurb: string };
  go: (screen: Screen) => void;
}) {
  const sections = useMemo(() => byTask(rows), [rows]);
  return (
    <>
      <p style={{ fontSize: 'var(--type-sm)', opacity: 0.6, lineHeight: 'var(--leading-normal)', margin: 0 }}>
        The same screens, filed under what you would be trying to do. Several
        appear more than once, because they answer more than one question.
      </p>
      {sections.map((s) => (
        <section key={s.tag} aria-label={s.label}>
          <Heading>{s.label}</Heading>
          {s.rows.map((d) => {
            const { label, blurb } = says(d);
            return <Row key={d.screen} screen={d.screen} title={label} sub={blurb} go={go} />;
          })}
        </section>
      ))}
    </>
  );
}

function NotTried({
  rows,
  says,
  onArea,
  go,
}: {
  rows: Destination[];
  says: (d: Destination) => { label: string; blurb: string };
  onArea: () => void;
  go: (screen: Screen) => void;
}) {
  if (rows.length === 0) {
    return (
      <div>
        <p style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-normal)', margin: 0 }}>
          You have opened every screen in the app, and none of them more than
          two months ago. There is nothing to show here.
        </p>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={onArea}
          style={{ height: 42, marginTop: 'var(--sp-6)', fontSize: 'var(--type-sm)' }}
        >
          Browse by area instead
        </button>
      </div>
    );
  }

  return (
    <>
      <p style={{ fontSize: 'var(--type-sm)', opacity: 0.6, lineHeight: 'var(--leading-normal)', margin: 0 }}>
        Never opened, or not in the last two months. Each line is the problem
        the screen was built for, rather than what it does — if the description
        had persuaded you, you would have opened it.
      </p>
      {rows.map((d) => {
        const { label, blurb } = says(d);
        return <Row key={d.screen} screen={d.screen} title={label} sub={WHY[d.screen] ?? blurb} go={go} />;
      })}
    </>
  );
}

/**
 * The `?` sheet's list, and the gestures that are not in it.
 *
 * `SHORTCUTS` is imported rather than copied — it is the same array the sheet
 * renders, so a binding changed in `lib/keys.ts` changes both. The gestures
 * are written here because there is no array of them: they are behaviours in
 * three components, and inventing a registry for four rows would be a worse
 * lie about where the truth lives than saying plainly that this list is by
 * hand.
 */
const GESTURES = [
  ['Long press any row', 'Ask the assistant about that one thing'],
  ['Select any text', 'Ask about the selection'],
  ['Swipe the assistant down', 'Put it away'],
  ['Drag the assistant button', 'Move it to either bottom corner'],
];

function Shortcuts() {
  const row = useRowStyle(0);
  return (
    <>
      <p style={{ fontSize: 'var(--type-sm)', opacity: 0.6, lineHeight: 'var(--leading-normal)', margin: 0 }}>
        Keys work where there is a keyboard, so nothing here fires on a phone.
        None of them fire while you are typing.
      </p>

      <section aria-label="Keys">
        <Heading>Keys</Heading>
        {SHORTCUTS.map((s) => (
          <div key={s.key} style={{ display: 'flex', gap: 'var(--sp-6)', alignItems: 'baseline', padding: 'var(--sp-5) 0', ...row }}>
            <kbd
              style={{
                flex: 'none',
                minWidth: 34,
                textAlign: 'center',
                padding: '2px 7px',
                border: '1px solid var(--app-line-top)',
                borderRadius: 'var(--r-sm)',
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--type-xs)',
              }}
            >
              {keyLabel(s.key)}
            </kbd>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' }}>
              {s.does}
            </span>
          </div>
        ))}
      </section>

      <section aria-label="Gestures">
        <Heading>Gestures</Heading>
        {GESTURES.map(([what, does]) => (
          <div key={what} style={{ padding: 'var(--sp-5) 0', ...row }}>
            <div style={{ fontSize: 'var(--type-base)', lineHeight: 'var(--leading-tight)' }}>{what}</div>
            <div style={{ fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-1)' }}>{does}</div>
          </div>
        ))}
      </section>
    </>
  );
}

function Results({ found, go }: { found: Found[]; go: (screen: Screen) => void }) {
  const row = useRowStyle(0);
  const label: Record<View, string> = {
    area: 'By area',
    task: 'By task',
    untried: 'Not tried',
    keys: 'Shortcuts',
  };

  return (
    <div>
      {found.map((f, i) => (
        <div key={`${f.view}-${f.screen ?? f.title}-${i}`} style={{ padding: 'var(--sp-5) 0', ...row }}>
          {/* Which view and which section, because a result lifted out of a
              directory is a result you cannot place — and placing it is how
              somebody learns where the thing lives for next time. */}
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'var(--type-xs)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.45,
            }}
          >
            {label[f.view]} · {f.where}
          </div>
          {f.screen ? (
            <button
              type="button"
              className="bare tappable"
              onClick={() => go(f.screen as Screen)}
              style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 'var(--sp-2)' }}
            >
              <span style={{ display: 'block', fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>
                {f.title}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-sm)',
                  opacity: 0.65,
                  lineHeight: 'var(--leading-normal)',
                  marginTop: 'var(--sp-1)',
                }}
              >
                {f.sub}
              </span>
            </button>
          ) : (
            <div style={{ marginTop: 'var(--sp-2)' }}>
              <div style={{ fontSize: 'var(--type-md)', lineHeight: 'var(--leading-tight)' }}>{f.title}</div>
              <div style={{ fontSize: 'var(--type-sm)', opacity: 0.65, marginTop: 'var(--sp-1)' }}>{f.sub}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
