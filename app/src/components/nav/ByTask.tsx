import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { EmptyState } from '../ui';
import { Search } from '../Icons';
import { Blueprint } from '../Blueprint';
import { TabGlyph } from '../TabIcon';
import { Caps, DarkTile } from '../soft/Soft';
import { distinctGlyphs } from '../icons.pick';
import { firstFigure } from '../../lib/softtop';
import { byTask, narrowTasks, offered, saysFor, type Destination } from '../../lib/nav';
import { TileSheet } from './TileSheet';
import type { Screen } from '../../lib/types';

/**
 * The app filed under what somebody is trying to do.
 *
 * The third tab of Progress. Forty-nine screens, each appearing under every
 * intention it serves, comes to eighty-four rows under nine headings — and
 * for a long time that was drawn as eighty-four rows, in one or two or three
 * columns depending on the width, under nine headings you met one at a time.
 * Everything was there and nothing was findable: you scrolled past the
 * heading that said why a row existed, and to check a heading you scrolled
 * back. A jump bar of nine chips was bolted on top to make the headings
 * reachable, which is a fair description of the problem rather than a fix
 * for it — a control that exists to get you back to the overview is an
 * admission that the page never showed you one.
 *
 * So the page is the overview now. Nine tiles, one per intention, in the
 * same materials the launcher's shelves are drawn in, and the screens under
 * an intention open over the grid rather than below it.
 *
 * Nothing has been dropped. Every screen still appears under every intention
 * it serves, in the school's own words, with the sentence that says what you
 * would come here to do.
 *
 * ## Why the launcher's shape, exactly
 *
 * These are the same fifty-five screens the launcher files by shelf, and the
 * two views answer different questions about them — *where does this live*
 * against *what was I trying to do*. Two grids of tiles that differed by four
 * pixels and a corner radius would be the kind of difference nobody can name
 * and everybody can see, so `DarkTile`, `distinctGlyphs` and `TileSheet` are
 * one implementation used twice. What is different here is what a tile stands
 * for, which is the only thing that should be.
 *
 * ## A tile has a position; a heading in a list does not
 *
 * "Look ahead past this term" is seventh whether or not anything is under it
 * this week. That is the property the column of headings could not have — the
 * heading you wanted was somewhere between the second row and the
 * eighty-fourth, and somewhere else next week — and it is the reason the
 * second visit is a point rather than a read.
 *
 * ## The filter is still the other half
 *
 * Somebody who knows what they want and not which intention it was filed
 * under should not have to open nine sheets to check. They type "grades", or
 * "email", or "money", and the tiles give way to the screens that answer it,
 * each still under the heading that says why. `narrowTasks` in `lib/nav.ts`
 * is the rule, and it matches what search matches: the label in the school's
 * own words, the blurb, the keywords behind it, and the shelf it lives on.
 *
 * Not the header's own search, which is a different question with a different
 * answer. That ranks deadlines, courses, units and notes together and opens
 * one of them; this narrows one list of screens in place and keeps them in
 * the order their headings put them in.
 */

/** Already a tab, or already the screen this is on. Same list as the shelves. */
const HIDE: Screen[] = ['home', 'me', 'notifs'];

export function ByTask() {
  const store = useStore();
  const { dispatch, school, account, state, catalog, now } = store;
  const caps = school.capabilities;
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);

  const sections = useMemo(
    () => byTask(offered(caps, state.role).filter((d) => !HIDE.includes(d.screen))),
    [caps, state.role],
  );

  const shown = useMemo(() => narrowTasks(sections, q, caps), [sections, q, caps]);

  /**
   * The one live number on each tile.
   *
   * The first hero figure among the screens under that intention — the same
   * figure the screen itself opens with, so the tile and what it opens can
   * never disagree, and no nine bespoke derivations were written for a grid.
   * An intention served entirely by tools has no figure anywhere under it;
   * those get how many screens are there, which is at least true.
   */
  const values = useMemo(() => {
    const input = { state, catalog, now, caps };
    return new Map(
      sections.map((s) => [
        s.tag,
        firstFigure(s.rows.map((d) => d.screen), input) ?? String(s.rows.length),
      ]),
    );
  }, [sections, state, catalog, now, caps]);

  const all = useMemo(() => sections.reduce((n, s) => n + s.rows.length, 0), [sections]);
  const found = useMemo(() => shown.reduce((n, s) => n + s.rows.length, 0), [shown]);
  const filtering = q.trim() !== '';
  const opened = open === null ? null : (sections.find((s) => s.tag === open) ?? null);

  const go = (screen: Screen) => dispatch({ type: 'go', screen });

  return (
    <>
      <div className="task-bar">
        <div className="task-filter">
          <span aria-hidden className="task-filter-glyph">
            <Search size={15} />
          </span>
          <input
            ref={box}
            className="input task-filter-box"
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
          />
          {filtering && (
            <button
              type="button"
              className="bare tappable task-clear"
              onClick={() => {
                setQ('');
                box.current?.focus();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/*
        What is on screen, said once, for anybody who cannot see it.

        `aria-live` rather than a fresh render of a static sentence: the count
        changes as somebody types, and a polite region is how that reaches a
        screen reader without interrupting the letter being typed.
      */}
      <p id="task-count" aria-live="polite" className="task-note">
        {filtering
          ? found === 0
            ? 'Nothing here matches that.'
            : `${found} ${found === 1 ? 'screen' : 'screens'} under ${shown.length} ${
                shown.length === 1 ? 'heading' : 'headings'
              }.`
          : `${all} entries for ${sections.length} things you might be trying to do. Several screens appear more than once, because they answer more than one question. Open one to see what is under it.`}
      </p>

      {found === 0 ? (
        <EmptyState
          title="No screen matches that"
          body="Try a word from what the screen is for rather than its name — “money”, “email”, “roommate”, “deadline”. The search in the header looks through your deadlines and courses too."
          action={{ label: 'Clear the filter', onClick: () => setQ('') }}
        />
      ) : filtering ? (
        /*
          Narrowed: the screens themselves, still under the heading that says
          why each is there. A grid of nine tiles is the right answer to "show
          me everything" and the wrong one to "show me the four that mention
          money" — that would be nine tiles, most of them empty, hiding four
          screens behind a tap each.
        */
        <nav aria-label="Screens matching the filter" className="task-found">
          {shown.map((section) => (
            <section key={section.tag}>
              <h3 className="soft-caps task-found-head">{section.label}</h3>
              <div className="soft-tiles">
                {section.rows.map((d) => (
                  <ScreenTile key={d.screen} to={d} account={account} go={go} />
                ))}
              </div>
            </section>
          ))}
        </nav>
      ) : (
        <nav aria-label="By task" className="soft-grid task-grid">
          {sections.map((section) => (
            <div key={section.tag} className="soft-grid-cell">
              <DarkTile
                label={`${section.label} — ${section.rows.length} screens`}
                glyphs={distinctGlyphs(section.rows.map((d) => d.screen)).map((screen) => (
                  <TabGlyph key={screen} screen={screen} size={15} />
                ))}
                value={values.get(section.tag) ?? String(section.rows.length)}
                onClick={() => setOpen(section.tag)}
              />
              {/* Outside the tile, on the ground: see `DarkTile`'s note. */}
              <div className="soft-caps soft-grid-name">{section.label}</div>
              <div className="soft-tile-sub">
                {section.rows.length === 1 ? '1 screen' : `${section.rows.length} screens`}
              </div>
            </div>
          ))}
        </nav>
      )}

      {opened && (
        <TileSheet
          name={opened.label}
          sub={opened.rows.length === 1 ? '1 screen' : `${opened.rows.length} screens`}
          onClose={() => setOpen(null)}
        >
          {opened.rows.map((d) => (
            <ScreenTile
              key={d.screen}
              to={d}
              account={account}
              go={(screen) => {
                go(screen);
                setOpen(null);
              }}
            />
          ))}
        </TileSheet>
      )}
    </>
  );
}

/**
 * One screen, in the school's own words.
 *
 * The same tile the launcher's folder draws — glyph, name, the sentence that
 * says what you would come here to do — because it is the same object doing
 * the same job, and the two halves of the directory drifting apart is the
 * thing the shared component prevents. What it does not carry is the drag:
 * a shelf is a place somebody arranges, and an intention is not.
 */
function ScreenTile({
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
  const signed = to.screen === 'account' && account;
  return (
    <Blueprint plain as="button" className="soft-tile surface" onClick={() => go(to.screen)}>
      <div className="soft-tile-glyph">
        <TabGlyph screen={to.screen} size={18} />
      </div>
      <Caps>{signed ? 'Account · synced' : said.label}</Caps>
      <div className="soft-tile-sub">
        {to.screen === 'account' && !account ? 'Not signed in — this device only.' : said.blurb}
      </div>
    </Blueprint>
  );
}
