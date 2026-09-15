import { useEffect, useState } from 'react';
import { listFiles, onFilesChanged, openFile, type Settled } from '../lib/files';
import { sourceFor, type Cited } from '../lib/topage';

/**
 * The page number under a quote, as something you can press.
 *
 * `· p. 12` has sat under every imported deadline since citations landed, and
 * the comment above the line that draws it said it was what turned *"the app
 * says the syllabus says this"* into something you can check in ten seconds.
 * Checking it took rather longer: find the PDF in your downloads, open it,
 * scroll to twelve. The app knew the page and had thrown the document away.
 *
 * Now it keeps the document — see `lib/topage.ts` — and this is the press.
 *
 * ## It still prints the page when it cannot open it
 *
 * Which is most courses, for a while: everything imported before the syllabus
 * was kept, everything built from pasted text, every deadline the API did not
 * cite, and any syllabus somebody has binned. In all of those the number is
 * drawn exactly as it was, as text. A button that is sometimes a button and
 * otherwise disabled would be worse than one that is sometimes simply not
 * there — a disabled control is a promise of something you are not allowed to
 * have, and here there is nothing being withheld.
 *
 * ## What the press actually promises
 *
 * To open the document, and to ask for the page. `#page=` is a PDF open
 * parameter that Chrome's viewer and Firefox's pdf.js honour and some others
 * ignore, with no way to ask beforehand and no answer afterwards — so the
 * label says "open" and names the page rather than claiming to land on it. A
 * viewer that ignores the fragment opens at page one, which is what pressing
 * the file in the drive does anyway.
 */
export function OnThePage({ item, courseSource }: { item: Cited; courseSource: string }) {
  const [files, setFiles] = useState<Settled[]>([]);
  /** Set only if the file went between this render and the press. */
  const [gone, setGone] = useState(false);

  /*
   * Files live in IndexedDB rather than the store, so they arrive after the
   * first render. The subscription matters more here than elsewhere: the
   * import screen writes the syllabus *after* it navigates to the course, so
   * without it the first look at a freshly imported deadline would show the
   * page as text and only become pressable on a reload.
   */
  useEffect(() => {
    let alive = true;
    const refresh = () => void listFiles().then((f) => alive && setFiles(f));
    refresh();
    const stop = onFilesChanged(refresh);
    return () => {
      alive = false;
      stop();
    };
  }, []);

  const page = item.checked?.page;
  if (typeof page !== 'number' || page < 1) return null;

  const found = gone ? null : sourceFor(files, item, courseSource);
  if (!found) return <> · p. {page}</>;

  return (
    <>
      {' · '}
      <button
        type="button"
        /* `tap-y` grows the hit area to 44px without moving anything: it is
           a centred `::after`, so the caption keeps its line height and the
           target stops being twelve-point text on a phone. */
        className="tap-y to-page"
        aria-label={`Open ${found.name} at page ${page}`}
        onClick={() => void openFile(found.id, page).then((ok) => setGone(!ok))}
      >
        p. {page}
      </button>
    </>
  );
}
