import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { Group as Panel, NavRow } from '../shell/Rows';
import { EmptyState } from '../ui';
import { Search } from '../Icons';
import { byTask, narrowTasks, offered, saysFor, type Destination, type TaskSection } from '../../lib/nav';
import { revealKindly, scrollKindly } from '../../lib/prefers';
import type { Screen } from '../../lib/types';

/**
 * The app filed under what somebody is trying to do.
 *
 * The third tab of Progress, and the one that had grown past what its shape
 * could carry. Forty-nine screens, each appearing under every intention it
 * serves, comes to eighty-four rows under nine headings — drawn as one column
 * of full-width rows that was about five screenfuls on a laptop. Everything
 * was there and nothing was findable: you scrolled past the heading that said
 * why a row existed, and to check a heading you scrolled back.
 *
 * Nothing has been dropped to fix that, and no heading hides another. What
 * changed is three things about the shape.
 *
 * ## 1. A way to jump, always on screen
 *
 * Nine chips naming the nine intentions, with how many screens are under
 * each, pinned to the top of the scroller on anything bigger than a phone.
 * They are the overview the page never had — nine headings you can read at
 * once instead of nine you meet one at a time — and pressing one takes you
 * to its section.
 *
 * They are not a filter and they hide nothing: this view has had a chip row
 * that showed one section at a time before, and the note in `screens/Me.tsx`
 * on why it went is still right. A chip that hides the other eight sections
 * makes you guess a heading before you are allowed to look at it. These move
 * the page instead.
 *
 * ## 2. A filter over all eighty-four rows at once
 *
 * The other half of "I cannot find it". Somebody who knows what they want and
 * not which intention it was filed under should not have to read nine
 * headings to check — they type "grades", or "email", or "money", and the
 * list becomes the four rows that answer it, each still under the heading
 * that says why. `narrowTasks` in `lib/nav.ts` is the rule, and it matches
 * what search matches: the label in the school's own words, the blurb, the
 * keywords behind it, and the shelf it lives on.
 *
 * Not the header's own search, which is a different question with a different
 * answer. That ranks deadlines, courses, units and notes together and opens
 * one of them; this narrows one list of screens in place and keeps them in
 * the order their headings put them in.
 *
 * ## 3. Columns, where there is room for them
 *
 * A row is a label, a sentence and a chevron — about forty characters of
 * text in a column that is 700 to 960 pixels wide, so more than half of every
 * row was the gap between the sentence and the chevron. Two columns on a
 * laptop and three on a monitor is the same eighty-four rows in a third of
 * the scrolling. The rule is a container query in `styles/app.css`, asked of
 * the column rather than the window, because the navigation rail can take
 * 250px of a window without the list knowing.
 */

/** Already a tab, or already the screen this is on. Same list as the shelves. */
const HIDE: Screen[] = ['home', 'me', 'notifs'];

/** The id of a section's anchor, for the chip that jumps to it. */
const anchor = (tag: string): string => `task-${tag}`;

export function ByTask() {
  const { dispatch, school, account } = useStore();
  const [q, setQ] = useState('');
  const box = useRef<HTMLInputElement>(null);

  const sections = useMemo(
    () => byTask(offered(school.capabilities).filter((d) => !HIDE.includes(d.screen))),
    [school.capabilities],
  );

  const shown = useMemo(
    () => narrowTasks(sections, q, school.capabilities),
    [sections, q, school.capabilities],
  );

  const all = useMemo(() => sections.reduce((n, s) => n + s.rows.length, 0), [sections]);
  const found = useMemo(() => shown.reduce((n, s) => n + s.rows.length, 0), [shown]);
  const filtering = q.trim() !== '';

  /**
   * To the section, and then to the section rather than past it.
   *
   * Three things, and leaving any one out serves only some of the people
   * pressing the chip.
   *
   * **The page moves**, which is the obvious one.
   *
   * **The cursor moves with it.** Focus goes to the section, or the next Tab
   * from a chip is the chip after it and somebody navigating by keyboard has
   * been shown a section they cannot then walk into. `preventScroll` so the
   * browser does not jump instantly to where the smooth scroll is already on
   * its way.
   *
   * **The bar does not land on top of the heading.** The bar is pinned, so a
   * heading scrolled to the top of the scroller arrives underneath it — and
   * its height is not a number anybody can write down: the chips wrap onto
   * one line or two depending on the width, and every word in them grows with
   * the text-size setting. So it is measured, at the moment of the jump,
   * rather than guessed. `scroll-margin` in the stylesheet is the same answer
   * for the path below, which is what runs when the scroller cannot be found.
   */
  const jump = useCallback((tag: string) => {
    const el = document.getElementById(anchor(tag));
    if (!el) return;
    const area = el.closest('.scrollarea');
    const bar = document.querySelector('.task-bar');
    // Only when it is actually pinned: below 760px it scrolls away with
    // everything else and taking its height off would leave a gap.
    const pinned = bar && getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().height : 0;
    if (area) {
      const top =
        area.scrollTop + el.getBoundingClientRect().top - area.getBoundingClientRect().top - pinned - 12;
      scrollKindly(area, { top: Math.max(0, top) });
    } else {
      revealKindly(el, { block: 'start' });
    }
    el.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <div className="task-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          <span aria-hidden style={{ display: 'flex', opacity: 0.45, flex: 'none' }}>
            <Search size={15} />
          </span>
          <input
            ref={box}
            className="input"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Escape empties it rather than closing anything, because there
              // is nothing here to close. A filter you cannot clear without
              // holding backspace is a filter people leave on.
              if (e.key === 'Escape' && q !== '') {
                e.preventDefault();
                setQ('');
              }
            }}
            placeholder="Filter — grades, email, money, a deadline…"
            aria-label="Filter these screens"
            aria-describedby="task-count"
            /* A minimum rather than a height: larger text has to grow the
               field, not be clipped by it. 44 is the target WCAG 2.2 asks
               for, and the field is the one thing on this bar somebody has
               to hit before they can use anything else. */
            style={{ flex: 1, minWidth: 0, minHeight: 44, fontSize: 'var(--type-md)' }}
          />
          {filtering && (
            <button
              type="button"
              className="bare tappable"
              onClick={() => {
                setQ('');
                box.current?.focus();
              }}
              style={{
                width: 'auto',
                flex: 'none',
                paddingBlock: 'var(--sp-4)',
                paddingInline: 'var(--sp-3)',
                fontSize: 'var(--type-xs)',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.6,
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/*
          The nine headings, at once. Hidden while filtering: the list is
          already short, and a chip that jumps to a section the filter has
          emptied is a control that does nothing.
        */}
        {!filtering && (
          // A landmark of its own, and named, because it is the one control
          // that reaches the whole page: somebody moving by landmark can get
          // back to the nine headings from the foot of the list without
          // reading their way there. `a11y/landmarks.test.ts` is the rule
          // that every `<nav>` here carries a name.
          <nav aria-label="Jump to a task" className="chiprow task-chips" style={{ marginTop: 'var(--sp-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', paddingRight: 'var(--page-pad)' }}>
              {sections.map((s) => (
                <button
                  key={s.tag}
                  type="button"
                  className="btn"
                  onClick={() => jump(s.tag)}
                  /* The count is beside the words on screen and inside the
                     name here, because "Keep track of what is due 9" read
                     aloud is a heading with a number stuck to it. What the
                     chip does is not visible either — it is a heading that
                     is a button — so the name says it. */
                  aria-label={`Go to ${s.label} — ${s.rows.length} screens`}
                  style={{
                    flex: 'none',
                    paddingBlock: 'var(--sp-4)',
                    paddingInline: 'var(--sp-6)',
                    fontSize: 'var(--type-sm)',
                    background: 'transparent',
                    color: 'var(--app-fg)',
                    borderColor: 'var(--app-line)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                  <span
                    aria-hidden
                    style={{ opacity: 0.5, marginLeft: 'var(--sp-3)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {s.rows.length}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        )}
      </div>

      {/*
        What is on screen, said once, for anybody who cannot see it.

        `aria-live` rather than a fresh render of a static sentence: the count
        changes as somebody types, and a polite region is how that reaches a
        screen reader without interrupting the letter being typed.
      */}
      <p
        id="task-count"
        aria-live="polite"
        style={{
          fontSize: 'var(--type-sm)',
          opacity: 0.6,
          lineHeight: 'var(--leading-normal)',
          marginBlock: 'var(--sp-5) var(--sp-6)',
          marginInline: 0,
          textWrap: 'pretty',
        }}
      >
        {filtering
          ? found === 0
            ? 'Nothing here matches that.'
            : `${found} ${found === 1 ? 'screen' : 'screens'} under ${shown.length} ${
                shown.length === 1 ? 'heading' : 'headings'
              }.`
          : `${all} entries for ${sections.length} things you might be trying to do. Several screens appear more than once, because they answer more than one question.`}
      </p>

      {/*
        Out to the page's own gutter, so the panels' edges are the app's
        edges — the same pull the shelves beside this make. A token rather
        than the `-18px` that was written here: the gutter is 30 on a desktop
        and 20 on a tablet, and a hard 18 left this list short of the shelves
        it sits next to on both.
      */}
      {found === 0 ? (
        <EmptyState
          title="No screen matches that"
          body="Try a word from what the screen is for rather than its name — “money”, “email”, “roommate”, “deadline”. The search in the header looks through your deadlines and courses too."
          action={{ label: 'Clear the filter', onClick: () => setQ('') }}
        />
      ) : (
        <nav aria-label="By task" className="task-list" style={{ marginInline: 'calc(-1 * var(--page-pad))' }}>
          {shown.map((section) => (
            <Section key={section.tag} section={section} account={account} go={(s) => dispatch({ type: 'go', screen: s })} />
          ))}
        </nav>
      )}
    </>
  );
}

/**
 * One heading and the screens under it.
 *
 * The anchor is a wrapper rather than the `<section>` `Panel` already draws,
 * because `Panel` names that element after its own heading and takes no id.
 * `tabIndex={-1}` makes it focusable by script and not by Tab — landing here
 * from a chip puts the cursor above the heading, so the next Tab is the first
 * row of the section rather than the chip after the one just pressed.
 */
function Section({
  section,
  account,
  go,
}: {
  section: TaskSection;
  account: { email: string } | null;
  go: (screen: Screen) => void;
}) {
  return (
    <div id={anchor(section.tag)} className="task-anchor" tabIndex={-1} style={{ outline: 'none' }}>
      <Panel header={section.label}>
        <div className="task-rows">
          {section.rows.map((d) => (
            <Row key={d.screen} to={d} account={account} go={go} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

/**
 * One row, in the school's own words.
 *
 * The same `NavRow` the shelves beside this use — one row component, so the
 * two halves of the directory cannot drift apart. What is added here is the
 * clamp on the sentence: in a 300px column an unclamped blurb is three lines,
 * and three-line rows in three columns is the scrolling this view was
 * supposed to have stopped.
 */
function Row({
  to,
  account,
  go,
}: {
  to: Destination;
  account: { email: string } | null;
  go: (screen: Screen) => void;
}) {
  const { school } = useStore();
  const said = saysFor(to, school.capabilities);
  return (
    <NavRow
      label={to.screen === 'account' && account ? 'Account · synced' : said.label}
      sub={
        <span className="task-blurb">
          {to.screen === 'account' && !account ? 'Not signed in — this device only.' : said.blurb}
        </span>
      }
      onClick={() => go(to.screen)}
    />
  );
}
