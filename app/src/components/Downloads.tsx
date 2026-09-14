import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { ActionButton, SectionLabel } from './ui';
import { Folding } from './Fold';
import { size } from '../lib/device';
import {
  clearCourse,
  clearDownloads,
  readDownloads,
  shelves,
  totalBytes,
  type Shelf,
} from '../lib/downloads';

/**
 * What playing offline has cost, and the button that gives it back.
 *
 * *Room on this device*, right above this, reads
 * `navigator.storage.estimate()` — which counts the media cache, so a student
 * who has worked through the term watches that number climb past two hundred
 * megabytes with nothing on the screen saying what it is or what to do. This
 * is the what and the what-to-do. `lib/downloads.ts` has the reasoning about
 * the cache itself.
 *
 * ## One tap, and a true sentence
 *
 * No confirmation. `TypeToConfirm` says why it exists — *"everything else that
 * removes something is undoable"* — and this is the ordinary case rather than
 * the exception: nothing is lost that pressing Play does not bring back. What
 * the sentence beside the button has to be honest about is the one case where
 * that is not free, which is the case the whole cache is for: on a plane, or
 * in a basement library, they do not come back until there is a connection.
 * So it says that, and it says it before the press rather than after.
 *
 * ## Why per course as well as all
 *
 * Because the two questions are different. "This browser is getting full" is
 * answered by the total; "I have finished PSCI and I am still doing ECON" is
 * not, and clearing the lot to answer it means re-downloading a course still
 * in use. A course is the unit the app is organised around everywhere else.
 */
export function Downloads() {
  const { catalog } = useStore();
  const [shelf, setShelf] = useState<Shelf[] | null>(null);
  const [bytes, setBytes] = useState(0);
  /*
   * Which clear is running, or null.
   *
   * `null` rather than `''` because `''` is a real shelf: everything the path
   * does not name a course for is grouped under it, and with the empty string
   * standing for "nothing is running" that row's button read *Clearing…* from
   * the moment the screen drew. Found by opening the screen rather than by any
   * test — the row only appears when something uncoursed is cached.
   */
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const read = useCallback(async () => {
    const items = await readDownloads();
    setShelf(shelves(items));
    setBytes(totalBytes(items));
  }, []);

  useEffect(() => {
    let alive = true;
    void readDownloads().then((items) => {
      if (!alive) return;
      setShelf(shelves(items));
      setBytes(totalBytes(items));
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Nothing downloaded, nothing to say — including while the first read is
   * still going, and on a browser with no Cache Storage at all. An empty
   * section headed "Downloaded to play offline" is a question the screen has
   * raised and then not answered.
   */
  if (!shelf || shelf.length === 0) return null;

  const run = async (what: string, job: () => Promise<boolean>) => {
    setBusy(what);
    const ok = await job();
    setFailed(!ok);
    await read();
    setBusy(null);
  };

  /** The course code where the app knows it, and the id where it does not. */
  const nameOf = (course: string) => {
    if (!course) return 'Everything else';
    return catalog.byId[course]?.code ?? course.toUpperCase();
  };

  return (
    <Folding name="Downloads">
      <SectionLabel>Downloaded to play offline</SectionLabel>

      <div
        style={{
          fontSize: 'var(--type-sm)',
          ...secondLine(),
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {size(bytes)} of lessons, podcast editions, decks and handouts are kept on this device so
        they play with no signal. They are part of the room used above.
      </div>

      <ul style={{ listStyle: 'none', margin: 'var(--sp-5) 0 0', padding: 0 }}>
        {shelf.map((s, i) => (
          <li
            key={s.course || 'other'}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'var(--sp-4)',
              flexWrap: 'wrap',
              paddingBlock: 'var(--sp-5)',
              // A rule between the rows, not under the last one: the button
              // below it is already a boundary, and two in a row reads as a gap.
              borderTop: i === 0 ? undefined : '1px solid var(--app-line)',
            }}
          >
            <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
              <div style={{ fontSize: 'var(--type-md)' }}>{nameOf(s.course)}</div>
              <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), lineHeight: 'var(--leading-normal)' }}>
                {s.line}
              </div>
            </div>
            <div
              style={{
                fontSize: 'var(--type-sm)',
                fontVariantNumeric: 'tabular-nums',
                ...secondLine(),
              }}
            >
              {size(s.bytes)}
            </div>
            {/*
              The name is on the button for a reader and not for a looker:
              three rows of "Clear ECON 1020" is the course code said twice in
              one line, and "Clear Everything else" does not read as English at
              all. The visible word is the verb; the accessible name is the
              whole sentence, which is what a screen reader announces when it
              lists the buttons on this screen out of context.
            */}
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`Clear ${nameOf(s.course)}`}
              onClick={() => void run(`shelf:${s.course}`, () => clearCourse(s.course))}
              disabled={busy !== null}
              style={{ fontSize: 'var(--type-xs)', paddingLeft: 'var(--sp-4)', paddingRight: 'var(--sp-4)' }}
            >
              {busy === `shelf:${s.course}` ? 'Clearing…' : 'Clear'}
            </button>
          </li>
        ))}
      </ul>

      <ActionButton
        onClick={() => void run('all', clearDownloads)}
        disabled={busy !== null}
        style={{ marginTop: 'var(--sp-5)', fontSize: 'var(--type-sm)' }}
      >
        {busy === 'all' ? 'Clearing…' : `Clear all ${size(bytes)}`}
      </ActionButton>

      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        {failed
          ? 'This browser would not let the app empty its cache, so nothing was cleared. Clearing the site’s data from the browser’s own settings does the same job.'
          : 'Nothing of yours is in here — no notes, no answers, no ticked boxes. These are the recordings and files the app ships, and they download again the next time you play one, which needs a connection.'}
      </div>
    </Folding>
  );
}
