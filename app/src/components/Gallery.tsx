import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { EmptyState } from './ui';
import { Plus } from './Icons';
import {
  SORTS,
  anyPersonal,
  coursesOn,
  grouped,
  named,
  only,
  stamp,
  type Filed,
  type Shape,
  type Sorting,
  type Whose,
} from '../lib/shelf';

/**
 * The screen a file application opens on.
 *
 * Docs, Sheets and Slides all open the same way and have for fifteen years: a
 * row of things to start from across the top, everything you already have
 * below it, cut into Today / Previous 7 days / Previous 30 days / Earlier,
 * with a switch between thumbnails and rows. It is not a house style, it is
 * the shape of the question — *where is the one I had open yesterday* — and
 * every one of those parts answers part of it.
 *
 * This app's three shelves answered none of it. Write listed documents newest
 * first, unsorted, undated beyond `Mar 31`, un-narrowable, with the templates
 * behind a button called "Start from a shape" that had to be pressed before
 * you could see there were any. Sheet listed sheets behind a fold, below two
 * importers and a grade calculator. The deck editor had no shelf at all: the
 * only way back to a deck you had made was the builder that made it.
 *
 * One component now, three screens, and each keeps what is genuinely its own —
 * a document's preview is a page of prose, a sheet's is a grid, a deck's is
 * its first slide. Those are passed in. Everything else is the same because
 * there is no reason for it not to be.
 *
 * ## What the filter is
 *
 * Google's says "Owned by anyone". Ownership is not a question here — every
 * file on these shelves is yours and stays on your device — so the axis is the
 * one a term actually has, which is *which class is this for*. A course shows
 * up in the list only when something on this shelf belongs to it, so the
 * control never offers a choice that leads to an empty screen.
 */
export function Gallery<T extends Filed>({
  startLabel,
  starters,
  recentLabel,
  items,
  fallback,
  onOpen,
  preview,
  under,
  shape = 'page',
  aside,
  empty,
}: {
  /** "Start a new document". */
  startLabel: string;
  starters: Starter[];
  /** "Recent documents". */
  recentLabel: string;
  items: T[];
  /** What an untitled one is called. "Untitled spreadsheet". */
  fallback: string;
  onOpen: (item: T) => void;
  /** The thumbnail's contents. The frame around it is drawn here. */
  preview: (item: T) => ReactNode;
  /** The second line under a card: "412 words", "8 × 4", "12 slides". */
  under: (item: T) => string;
  /** The thumbnail's proportions — a page, a slide, or a grid. */
  shape?: Art;
  /**
   * What a screen has that the others do not, drawn between the two halves.
   *
   * Sheet opens a workbook somebody drops on it and reads a pasted table;
   * the deck builds one from a study unit or a brief. Those are neither a
   * thing to start from nor a thing you already have, and they are where
   * Google puts its own file-open control — beside the shelf, under the row
   * of blanks.
   */
  aside?: ReactNode;
  /** Drawn in place of the whole shelf when there is nothing on it. */
  empty: { title: string; body: string; icon: ReactNode };
}) {
  const { courseCode } = useStore();
  const [by, setBy] = useState<Sorting>('opened');
  const [view, setView] = useState<Shape>('grid');
  const [whose, setWhose] = useState<Whose>('all');

  /*
   * Which courses to offer, and whether to offer "Not for a course" — both
   * decided from the files, in `lib/shelf.ts`, where they are tested.
   *
   * `courseCode` falls back to the id upper-cased, which is a name for a course
   * the app no longer holds and is better than a row with no heading.
   */
  const courses = useMemo(
    () =>
      coursesOn(items)
        .map((id) => ({ id: id as Whose, label: courseCode(id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [items, courseCode],
  );
  const personal = anyPersonal(items);

  const mine = only(items, whose);
  /*
   * One reading of the clock for the whole render.
   *
   * The headings and the dates beside the rows have to agree about what "now"
   * is: two calls either side of midnight would put a file under "Today" and
   * then date it yesterday, in the same list.
   */
  const now = Date.now();
  const groups = grouped(mine, by, now);

  return (
    <>
      <div className="gal-head">
        <div className="gal-head-name">{startLabel}</div>
      </div>
      <div className="gal-start">
        {starters.map((s) => (
          <button
            key={s.id}
            type="button"
            className="gal-starter tappable"
            onClick={s.onPick}
            disabled={s.disabled}
          >
            <span className="gal-art" style={artStyle(shape)}>
              {s.preview ?? <Plus size={20} />}
            </span>
            <span className="gal-name" style={{ display: 'block' }}>
              {s.label}
            </span>
            {s.blurb && (
              <span className="gal-under" style={{ display: 'block' }}>
                {s.blurb}
              </span>
            )}
          </button>
        ))}
      </div>

      {aside}

      <div className="gal-head">
        <div className="gal-head-name">{recentLabel}</div>
        {/*
         * No controls over an empty shelf.
         *
         * A sort picker and a grid/list switch above "Nothing written yet" are
         * three controls that cannot change anything, offered at the one moment
         * somebody has no idea what this screen is. They arrive with the first
         * file, which is also when they start to mean something.
         */}
        {items.length > 0 && courses.length > 0 && (
          <select
            className="bench-sel"
            aria-label="Which course to show"
            value={whose}
            onChange={(e) => setWhose(e.target.value as Whose)}
          >
            <option value="all">Every course</option>
            {/*
             * Offered only where there is something to find behind it. A shelf
             * whose every file belongs to a course still listed "Not for a
             * course", and choosing it emptied the screen and explained that
             * the filter had done it — a control that can only ever fail.
             */}
            {personal && <option value="personal">Not for a course</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        {items.length > 0 && (
          <>
            <select
              className="bench-sel"
              aria-label="What to sort by"
              value={by}
              onChange={(e) => setBy(e.target.value as Sorting)}
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="bench-tool"
              aria-pressed={view === 'list'}
              aria-label={view === 'grid' ? 'Show these as a list' : 'Show these as thumbnails'}
              title={view === 'grid' ? 'Show these as a list' : 'Show these as thumbnails'}
              onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            >
              {view === 'grid' ? 'List' : 'Grid'}
            </button>
          </>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState title={empty.title} body={empty.body} icon={empty.icon} />
      ) : mine.length === 0 ? (
        /*
         * Narrowed to nothing. Not an empty state — the shelf is not empty,
         * the filter is — so it says which, and the control that caused it is
         * still on screen directly above.
         */
        <div className="gal-under" role="status">
          Nothing on this shelf belongs to that course. Every course brings the rest back.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label || 'all'}>
            {group.label && <h3 className="gal-when">{group.label}</h3>}
            {view === 'grid' ? (
              <div className="gal-grid">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="gal-card tappable"
                    onClick={() => onOpen(item)}
                  >
                    <span className="gal-art" style={artStyle(shape)}>
                      {preview(item)}
                    </span>
                    <span className="gal-name" style={{ display: 'block' }}>
                      {named(item, fallback)}
                    </span>
                    <span className="gal-under" style={{ display: 'block' }}>
                      {[item.courseId ? courseCode(item.courseId) : 'Personal', under(item)].join(
                        ' · ',
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="gal-rows">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="gal-row tappable"
                    onClick={() => onOpen(item)}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="gal-name" style={{ display: 'block', marginTop: 0 }}>
                        {named(item, fallback)}
                      </span>
                      <span className="gal-under" style={{ display: 'block' }}>
                        {under(item)}
                      </span>
                    </span>
                    <span className="gal-col">
                      {item.courseId ? courseCode(item.courseId) : 'Personal'}
                    </span>
                    <span className="gal-col">
                      {stamp(by === 'made' ? item.created : item.updated, now)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}

/** One thing to start from: a blank, a template, an importer. */
export interface Starter {
  id: string;
  label: string;
  /** The line under the name — the template's own sentence. */
  blurb?: string;
  /** A drawing of what it makes. A plus is drawn where there is none. */
  preview?: ReactNode;
  onPick: () => void;
  disabled?: boolean;
}

/**
 * The three proportions a thumbnail comes in.
 *
 * A page, a slide and a grid are genuinely different shapes and drawing all
 * three as squares would make a deck look like a document. These are the real
 * ratios: US Letter, 16:9, and a spreadsheet's wider-than-tall window.
 */
export type Art = 'page' | 'wide' | 'grid';

function artStyle(shape: Art): CSSProperties {
  return { aspectRatio: shape === 'page' ? '8.5 / 11' : shape === 'wide' ? '16 / 9' : '4 / 3' };
}
