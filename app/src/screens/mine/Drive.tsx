import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { Blueprint } from '../../components/Blueprint';
import { Folding } from '../../components/Fold';
import {
  ActionButton,
  ChipRow,
  EmptyState,
  FilePick,
  SectionLabel,
  Segmented,
} from '../../components/ui';
import { ChevronRight, FolderIcon, StarIcon } from '../../components/Icons';
import { secondLine } from '../../lib/dim';
import { newId } from '../../lib/idb';
import { useTier } from '../../lib/media';
import { size as readableBytes, storageRoom, type Room } from '../../lib/device';
import {
  suggest,
  suggestFolders,
  type FolderHint,
  type Suggestion,
} from '../../lib/drivehome';
import {
  TRASH_DAYS,
  addFile,
  sweepTrash,
  deleteFile,
  emptyTrash,
  formatBytes,
  listFiles,
  listTrash,
  moveFile,
  openFile,
  restoreFile,
  search,
  pinFile,
  starFile,
  tagFile,
  trashFile,
  type Settled,
} from '../../lib/files';
import {
  canMove,
  childrenOf,
  freeName,
  homeOf,
  subtree,
  isCourseFolder,
  trail,
  withCourses,
  type Shown,
} from '../../lib/folders';
import { CoursePicker } from '../../components/CoursePicker';
import { DeadlinePicker } from '../../components/DeadlinePicker';
import { forLine, nameFor } from '../../lib/forwork';

/**
 * The drive.
 *
 * This was a flat list with a Del button on each row, and the two things
 * missing from it were the two a drive is for: somewhere to put things, and a
 * way back from a mistake. A term's files are not a list — they are four
 * courses' worth of readings, slides, problem sets and photographs of a
 * whiteboard, and a flat list of two hundred of those sorted by when they
 * arrived is a list nobody opens twice.
 *
 * ## The delete key no longer deletes
 *
 * It moves a file to the bin, and the bin keeps it. Erasing bytes on a single
 * press is the one thing a file store does that cannot be undone, and it was
 * what the old Del button did — one tap, no confirmation, gone. "Delete
 * forever" still exists, in the bin, where somebody has already had to go
 * looking.
 *
 * ## A folder per course, made for you
 *
 * Derived from the catalogue rather than created, so it is there the day a
 * course is added and gone the day it is removed. See `lib/folders.ts`.
 *
 * ## Two ways to move a file
 *
 * Drag it, or press **Move** and choose. The second is not a fallback for the
 * first — it is the one that works with a tremor, a head pointer or an eye
 * tracker, none of which can hold a press still while travelling, and on a
 * tablet there is no keyboard to fall back to either. `a11y/dragging.test.ts`
 * makes the same argument about the app's orderings.
 */

type View = 'home' | 'drive' | 'starred' | 'recent' | 'bin';

/**
 * The five places, in the order every drive puts them.
 *
 * Home first, because it is the answer to the question somebody has when they
 * open a drive. Then the folders, then the two saved searches, then the bin.
 *
 * Two of the destinations a shared drive has are deliberately not here.
 * "Shared with me" and "Spam" both need somebody else to have sent you
 * something, and nothing in this app can: files are on this device and nothing
 * is uploaded. An empty Shared with me would be a promise of a feature that
 * does not exist, which is worse than its absence.
 */
const PLACES: { id: View; label: string; says: string }[] = [
  { id: 'home', label: 'Home', says: 'What you were working on' },
  { id: 'drive', label: 'My drive', says: 'Every folder and file' },
  { id: 'recent', label: 'Recent', says: 'What you opened lately' },
  { id: 'starred', label: 'Starred', says: 'What you marked' },
  { id: 'bin', label: 'Bin', says: 'Deleted, and still here' },
];
type Sort = 'added' | 'name' | 'size' | 'course';

const SORTS = ['added', 'name', 'size', 'course'] as const satisfies readonly Sort[];

/** The words on the chips. The ids are how a sheet is sorted, not how it reads. */
const SORT_LABELS: Record<Sort, string> = {
  added: 'Newest',
  name: 'Name',
  size: 'Size',
  course: 'Course',
};

/** How much of a file's text is kept for searching. */
const INDEX_CHARS = 20_000;

export function Drive() {
  const { state, dispatch, courseCode, allItems } = useStore();
  const [files, setFiles] = useState<Settled[]>([]);
  const [binned, setBinned] = useState<Settled[]>([]);
  const [at, setAt] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [room, setRoom] = useState<Room | null>(null);
  const [sort, setSort] = useState<Sort>('added');
  const [grid, setGrid] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [trouble, setTrouble] = useState('');
  const [moving, setMoving] = useState<Settled | null>(null);
  /* The file whose deadline is being changed. A second panel rather than a
     second control on every row: the row already carries a star, a Move and a
     Bin, and a fourth button on a 390px phone is the point at which the file's
     own name stops being readable. */
  const [filing, setFiling] = useState<Settled | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const refresh = () => {
    void listFiles().then(setFiles);
    void listTrash().then(setBinned);
  };
  useEffect(() => {
    // Take out what has been in the bin past its month, then read. `TRASH_DAYS`
    // was a promise nothing kept until this call existed.
    void sweepTrash().then(refresh);
    // How full the browser is. Asked once: the number moves slowly, and it is
    // the browser's own estimate rather than a measurement — see `lib/quota.ts`.
    let alive = true;
    void storageRoom().then((r) => {
      if (alive) setRoom(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
   * Every course the account holds, not only this term's.
   *
   * `catalog` is one term by design, and deriving the folders from it meant a
   * file filed under last term's ECON had no folder to sit in the moment the
   * term switched — still stored, reachable from nowhere.
   */
  const folders = useMemo(
    () => withCourses(state.folders, state.courses.map((m) => m.course)),
    [state.folders, state.courses],
  );


  /*
   * Reading the text out of a file so search can look inside it.
   *
   * Best effort and never fatal: a PDF that will not parse, a format with no
   * reader, a file too big to hold in memory — all of them mean the file is
   * findable by its name, which is how every file worked before this existed.
   */
  const indexed = async (file: File): Promise<string> => {
    try {
      const { extractText } = await import('../../lib/extract');
      const { text } = await extractText(file);
      return text.slice(0, INDEX_CHARS);
    } catch {
      return '';
    }
  };

  const onPick = async (list: File[]) => {
    if (list.length === 0) return;
    const failed: string[] = [];
    try {
      for (const [n, f] of list.entries()) {
        setBusy(list.length > 1 ? `Adding ${n + 1} of ${list.length}…` : 'Adding…');
        // A file added inside a course's folder is filed against that course,
        // so it turns up on the course page without anybody tagging it twice.
        const course = isCourseFolder(at) ? (at as string).slice('course:'.length) : null;
        try {
          await addFile(f, course, at, await indexed(f));
        } catch {
          // One file that will not store — the disk is full, the browser
          // refused — must not take the rest of the selection with it, and
          // must not leave the button saying "Adding…" for ever.
          failed.push(f.name);
        }
      }
    } finally {
      setBusy('');
      setTrouble(
        failed.length === 0
          ? ''
          : `${failed.join(', ')} could not be stored. There may be no room left on this device.`,
      );
      refresh();
    }
  };

  /*
   * Every write to a file goes through here, and every one of them can fail.
   *
   * IndexedDB rejects for reasons that have nothing to do with the press: the
   * disk is full, the browser is in a mode that refuses to store, the
   * transaction is aborted while the tab is being closed. `act` used to
   * `await run` with no catch, so the rejection escaped into an unhandled
   * promise and the screen carried on as though the write had landed — a star
   * that un-stars itself on the next read, a deadline that was never saved,
   * and no sentence anywhere saying so.
   *
   * Caught here rather than at each call site, because there are nine of them
   * and the next one added would have been the tenth to forget. `refresh` runs
   * either way: after a failure it is what puts the row back to what is
   * actually stored, which is the honest thing to show.
   */
  const act = async (run: Promise<unknown>, what = 'That change') => {
    try {
      await run;
      setTrouble('');
    } catch {
      setTrouble(`${what} could not be saved. There may be no room left on this device.`);
    } finally {
      refresh();
    }
  };

  /**
   * Putting a file in a folder, however it got there.
   *
   * Dragging and the Move picker were two paths doing different things: the
   * picker tagged a file against the course when it landed in a course folder
   * and the drag did not, so the same drop filed it under the course or not
   * depending on how you did it. One function, used by both.
   */
  const dropInto = async (id: string, folderId: string | null) => {
    await moveFile(id, folderId);
    if (isCourseFolder(folderId)) {
      await tagFile(id, (folderId as string).slice('course:'.length));
    }
    refresh();
  };

  const here = childrenOf(folders, at);
  const crumbs = trail(folders, at);

  /** What the chosen view is looking at, before searching and sorting. */
  const pool = useMemo(() => {
    if (view === 'bin') return binned;
    // The home draws its own two rows and does not go through the listing at
    // all — except while somebody is searching, when every view is the search.
    if (view === 'home') return files;
    if (view === 'starred') return files.filter((f) => f.starred);
    if (view === 'recent') {
      return [...files]
        .filter((f) => f.openedAt !== null)
        .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
        .slice(0, 30);
    }
    // Searching reaches the whole drive rather than the folder you happen to
    // be standing in — a search that only looked here would answer "no" about
    // a file you can see two folders away.
    // `homeOf` rather than the raw id: a file whose folder has gone — a course
    // removed, a parent folder deleted, a term switched — comes home to the
    // top of the drive rather than disappearing from every view.
    return query.trim() ? files : files.filter((f) => homeOf(folders, f.folderId) === at);
  }, [view, binned, files, at, query, folders]);

  const shown = useMemo(() => {
    const hits = search(pool, query);
    // Recents keep the order the view chose; sorting them by anything else
    // makes the word "recent" mean nothing.
    if (view === 'recent' && !query.trim()) return hits;
    return [...hits].sort((a, b) => {
      if (sort === 'name') return a.file.name.localeCompare(b.file.name);
      if (sort === 'size') return b.file.size - a.file.size;
      if (sort === 'course') {
        return (a.file.courseId ?? 'zzz').localeCompare(b.file.courseId ?? 'zzz');
      }
      return b.file.added - a.file.added;
    });
  }, [pool, query, sort, view]);

  const held = files.reduce((n, f) => n + f.size, 0);
  const searching = query.trim() !== '';
  const inDrive = view === 'drive' && !searching;
  /** The home is the two suggested rows — unless somebody is searching. */
  const onHome = view === 'home' && !searching;
  /* Read once, for the same reason `screens/Sheet.tsx` does: the reasons
     beside a suggestion say "Tuesday", and Tuesday does not move while
     somebody is reading them. */
  const [now] = useState(() => Date.now());
  /*
   * The places go down the side where there is room and across the top where
   * there is not. It is the same five either way: a rail on a phone would take
   * a third of the screen from the files it is for, and a row of five tabs on
   * a desktop leaves half the window empty.
   */
  const beside = useTier() !== 'phone';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexDirection: beside ? 'row' : 'column',
          gap: 'var(--sp-5)',
          alignItems: 'flex-start',
        }}
      >
        <Places
          view={view}
          down={beside}
          room={room}
          held={held}
          onGo={(next) => {
            setView(next);
            setQuery('');
          }}
        />
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search your files"
        placeholder="Search names and what is inside"
        style={{ width: '100%', marginBottom: 'var(--sp-5)' }}
      />

      {trouble !== '' && (
        <Blueprint style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}>
          <div style={{ fontSize: 'var(--type-sm)' }}>{trouble}</div>
        </Blueprint>
      )}

      {inDrive && (
        <Crumbs crumbs={crumbs} onGo={setAt} />
      )}

      {view !== 'bin' && (
        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
          <FilePick onPick={(picked) => void onPick(picked)} disabled={busy !== ''} tone="primary">
            {busy || 'Add files'}
          </FilePick>
          {inDrive && (
            <ActionButton onClick={() => { setNaming(true); setName(''); }}>New folder</ActionButton>
          )}
        </div>
      )}

      {naming && (
        <Blueprint style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}>
          <SectionLabel>Name it</SectionLabel>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Folder name"
            style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
            <ActionButton onClick={() => setNaming(false)}>Cancel</ActionButton>
            <ActionButton
              tone="primary"
              onClick={() => {
                dispatch({
                  type: 'newFolder',
                  id: newId(),
                  name: freeName(folders, at, name),
                  parentId: at,
                });
                setNaming(false);
              }}
            >
              Make it
            </ActionButton>
          </div>
        </Blueprint>
      )}

      {view === 'bin' && binned.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-4)' }}>
            Nothing here is gone yet. Files stay in the bin until you empty it — after{' '}
            {TRASH_DAYS} days the app stops keeping them for you.
          </div>
          <ActionButton
            onClick={() => void act(emptyTrash())}
            aria-label={`Empty the bin — ${binned.length} files, deleted for good`}
          >
            Empty the bin ({binned.length})
          </ActionButton>
        </div>
      )}

      {view !== 'bin' && !onHome && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-4)',
            marginBottom: 'var(--sp-4)',
          }}
        >
          <ChipRow
            options={SORTS}
            value={sort}
            onChange={setSort}
            labels={SORT_LABELS}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setGrid(!grid)}
            aria-label={grid ? 'Show as a list' : 'Show as a grid'}
            style={{ flex: 'none', fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-4)' }}
          >
            {grid ? 'List' : 'Grid'}
          </button>
        </div>
      )}

      {onHome && (
        <Home
          folders={suggestFolders(folders, files, now)}
          files={suggest(files, now)}
          courseCode={courseCode}
          due={(itemId) => forLine(allItems, itemId)}
          onFolder={(id) => {
            setView('drive');
            setAt(id);
          }}
          onOpen={(id) => void openFile(id).then(refresh)}
          onEverything={() => setView('drive')}
        />
      )}

      {inDrive && here.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          {here.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              count={files.filter((f) => homeOf(folders, f.folderId) === folder.id).length}
              onOpen={() => setAt(folder.id)}
              onDropFile={(id) => void dropInto(id, folder.id)}
              onRename={(next) =>
                dispatch({ type: 'renameFolder', id: folder.id, name: freeName(folders, folder.parentId, next) })
              }
              onDelete={async () => {
                /*
                 * The files come out first, then the folder goes — and it is
                 * every folder in the subtree, not just this one.
                 *
                 * `deleteFolder` removes the descendants too, so relocating
                 * only the files directly in this folder left the ones a level
                 * down pointing at an id that no longer existed. `homeOf` now
                 * catches that as a last resort, but a file quietly relocated
                 * to the drive's root by a repair is worse than one moved
                 * deliberately to where its folder used to be.
                 */
                const gone = subtree(folders, folder.id);
                for (const f of files.filter((x) => x.folderId && gone.has(x.folderId))) {
                  await moveFile(f.id, folder.parentId);
                }
                dispatch({ type: 'deleteFolder', id: folder.id });
                refresh();
              }}
            />
          ))}
        </div>
      )}

      {onHome ? null : shown.length === 0 ? (
        <EmptyState
          title={
            view === 'bin'
              ? 'The bin is empty.'
              : searching
                ? 'Nothing matched.'
                : view === 'starred'
                  ? 'Nothing starred.'
                  : view === 'recent'
                    ? 'Nothing opened yet.'
                    : here.length > 0
                      ? 'No files here.'
                      : 'No files.'
          }
          body={
            searching
              ? 'Names and the text inside are both searched. Nothing here has either.'
              : 'Slides, readings, a photo of the whiteboard. They stay on this device — nothing is uploaded.'
          }
          icon={<FolderIcon />}
        />
      ) : (
        <>
          <SectionLabel>
            {shown.length} {shown.length === 1 ? 'file' : 'files'}
            {view !== 'bin' && ` · ${formatBytes(held)} in all`}
          </SectionLabel>
          <div
            style={
              grid && view !== 'bin'
                ? {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: 'var(--sp-4)',
                  }
                : { display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }
            }
          >
            {shown.map(({ file, inText }) => (
              <FileRow
                key={file.id}
                file={file}
                inText={inText}
                grid={grid && view !== 'bin'}
                binned={view === 'bin'}
                where={
                  searching || view !== 'drive'
                    ? (trail(folders, file.folderId).map((f) => f.name).join(' / ') || 'Drive')
                    : ''
                }
                course={file.courseId ? courseCode(file.courseId) : ''}
                /* `nameFor` answers undefined for an id whose deadline has
                   been edited out of the course, so a stale link draws as no
                   link rather than as a broken one. See `lib/forwork.ts`. */
                due={nameFor(allItems, file.itemId)}
                notes={state.notes.filter((n) => n.fileIds.includes(file.id)).length}
                onOpen={() => void openFile(file.id).then(refresh)}
                onStar={() => void act(starFile(file.id, !file.starred))}
                onMove={() => setMoving(file)}
                onFile={() => setFiling(file)}
                onTrash={() => void act(trashFile(file.id))}
                onRestore={() => void act(restoreFile(file.id))}
                onPurge={() => void act(deleteFile(file.id))}
              />
            ))}
          </div>
        </>
      )}

        </div>
      </div>

      {filing && (
        <FileAgainst
          file={filing}
          /*
           * Both writes land before the panel is told anything.
           *
           * The first version set `filing` optimistically and started the
           * write without waiting, so a rejected `tagFile` left the panel
           * offering the new course's deadlines over a file still filed under
           * the old one. `act` reports the failure and `refresh` puts the list
           * back to what is stored; `filing` is only moved once the write is
           * known to have landed.
           *
           * The deadline is cleared with the course, for the reason in
           * `screens/Write.tsx`: a deadline belongs to a course, so the old
           * filing names something the new course does not contain.
           */
          onCourse={async (courseId) => {
            await act(tagFile(filing.id, courseId), 'The course');
            await act(pinFile(filing.id, null), 'The deadline');
            setFiling({ ...filing, courseId, itemId: null });
          }}
          onClose={() => setFiling(null)}
          onPick={async (itemId) => {
            await act(pinFile(filing.id, itemId), 'The deadline');
            setFiling(null);
          }}
        />
      )}

      {moving && (
        <MoveTo
          file={moving}
          folders={folders}
          onClose={() => setMoving(null)}
          onPick={async (folderId) => {
            await dropInto(moving.id, folderId);
            setMoving(null);
          }}
        />
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}

/**
 * The five places, and how full the browser is.
 *
 * A rail beside the files on anything with room and a row of tabs above them
 * on a phone — the same five destinations either way, in the same order, so
 * the app is one app on both.
 *
 * The room line at the bottom is the browser's own estimate, said as an
 * estimate. Every cloud drive puts one here and means something exact by it;
 * this one cannot, and the word "about" is doing real work — a browser rounds
 * the figure hard on purpose, so that somebody cannot be identified by how
 * full their disk is.
 */
function Places({
  view,
  down,
  room,
  held,
  onGo,
}: {
  view: View;
  down: boolean;
  room: Room | null;
  /** What this app's own files come to, which is not what the browser is holding. */
  held: number;
  onGo: (next: View) => void;
}) {
  const share = room && room.used >= 0 && room.quota > 0 ? room.used / room.quota : -1;

  const line =
    share >= 0 ? (
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <div
          aria-hidden="true"
          style={{
            height: 4,
            borderRadius: 'var(--r-sm)',
            background: 'var(--app-track)',
            overflow: 'hidden',
            marginBottom: 'var(--sp-3)',
          }}
        >
          <div
            style={{
              width: `${Math.min(100, share * 100)}%`,
              height: '100%',
              background: 'var(--app-accent-deep)',
            }}
          />
        </div>
        <div style={{ ...secondLine(), fontSize: 'var(--type-xs)' }}>
          {readableBytes(room?.used ?? 0)} of about {readableBytes(room?.quota ?? 0)} used in this
          browser · {formatBytes(held)} of it is files you added here
        </div>
      </div>
    ) : (
      <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-5)' }}>
        {formatBytes(held)} of files, on this device. This browser will not say how much room is
        left.
      </div>
    );

  if (!down) {
    return (
      <div style={{ width: '100%' }}>
        <Segmented
          options={PLACES.map((p) => ({ id: p.id, label: p.label }))}
          value={view}
          onChange={onGo}
          style={{ marginBottom: 'var(--sp-3)' }}
        />
        {line}
      </div>
    );
  }

  return (
    <nav
      aria-label="Places in your drive"
      style={{ flex: 'none', width: 172, display: 'flex', flexDirection: 'column' }}
    >
      {PLACES.map((place) => (
        <button
          key={place.id}
          type="button"
          className="bare tappable"
          onClick={() => onGo(place.id)}
          aria-current={place.id === view ? 'page' : undefined}
          style={{
            textAlign: 'left',
            padding: 'var(--sp-4) var(--sp-5)',
            borderRadius: 'var(--r-sm)',
            background: place.id === view ? 'var(--app-accent-wash)' : undefined,
          }}
        >
          <div style={{ fontSize: 'var(--type-md)' }}>{place.label}</div>
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-1)' }}>
            {place.says}
          </div>
        </button>
      ))}
      {line}
    </nav>
  );
}

/**
 * The home: the folders with something happening in them, and the files with
 * a reason beside each.
 *
 * The reason is the whole of why this is better than a list sorted by date.
 * Six rows in an order nobody can see is a list you check against the folders
 * anyway; "You opened it · Tuesday" can be read, agreed with, or seen to be
 * wrong. `lib/drivehome.ts` decides them.
 */
function Home({
  folders,
  files,
  courseCode,
  due,
  onFolder,
  onOpen,
  onEverything,
}: {
  folders: FolderHint[];
  files: Suggestion[];
  courseCode: (id: string) => string;
  /**
   * What a file is for, by its deadline id — "for Quiz #1", or nothing.
   *
   * A resolver rather than the list of deadlines, so this component stays
   * ignorant of the catalogue: it is handed the six words it draws. Empty for
   * a file filed against no deadline, and for one whose deadline has been
   * edited out of its course — see `lib/forwork.ts`.
   */
  due: (itemId: string | null) => string;
  onFolder: (id: string) => void;
  onOpen: (id: string) => void;
  onEverything: () => void;
}) {
  if (folders.length === 0 && files.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet."
        body="Add a reading, a slide deck, a photograph of the whiteboard. They stay on this device — nothing is uploaded."
        icon={<FolderIcon />}
      />
    );
  }

  return (
    <div style={{ marginBottom: 'var(--sp-5)' }}>
      {folders.length > 0 && (
        <>
          <SectionLabel>Folders you have been in</SectionLabel>
          <div
            style={{
              display: 'flex',
              gap: 'var(--sp-4)',
              overflowX: 'auto',
              paddingBottom: 'var(--sp-3)',
              marginBottom: 'var(--sp-5)',
            }}
          >
            {folders.map(({ folder, says }) => (
              <Blueprint
                key={folder.id}
                as="button"
                plain
                onClick={() => onFolder(folder.id)}
                style={{
                  flex: 'none',
                  width: 168,
                  padding: 'var(--sp-5)',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-4)',
                }}
              >
                <FolderIcon size={17} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--type-sm)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {folder.name}
                  </div>
                  <div style={{ ...secondLine(), fontSize: 'var(--type-xs)' }}>{says}</div>
                </div>
              </Blueprint>
            ))}
          </div>
        </>
      )}

      {files.length > 0 && (
        <>
          <SectionLabel aside="Why it is here">Files to pick up again</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {files.map(({ file, says }) => (
              <Blueprint
                key={file.id}
                as="button"
                plain
                onClick={() => onOpen(file.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-5)',
                  padding: 'var(--sp-6)',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 'var(--type-md)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {file.name}
                  </div>
                  <div
                    style={{
                      ...secondLine(),
                      fontSize: 'var(--type-sm)',
                      marginTop: 'var(--sp-1)',
                    }}
                  >
                    {/* The reason, then whose it is, then what it is for —
                        the same three facts in the same order as a row in the
                        drive proper, so the landing screen and the list do not
                        describe one file two ways. */}
                    {[says, file.courseId ? courseCode(file.courseId) : '', due(file.itemId)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {file.starred && <StarIcon on size={15} />}
                <ChevronRight size={16} />
              </Blueprint>
            ))}
          </div>
        </>
      )}

      <ActionButton onClick={onEverything} style={{ marginTop: 'var(--sp-5)' }}>
        Everything in the drive
      </ActionButton>
    </div>
  );
}

function Crumbs({ crumbs, onGo }: { crumbs: Shown[]; onGo: (id: string | null) => void }) {
  return (
    <nav
      aria-label="Where you are in the drive"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        marginBottom: 'var(--sp-5)',
        fontSize: 'var(--type-sm)',
      }}
    >
      <button type="button" className="bare" onClick={() => onGo(null)}>
        Drive
      </button>
      {crumbs.map((folder, i) => (
        <span key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <ChevronRight size={13} />
          {i === crumbs.length - 1 ? (
            <span aria-current="page">{folder.name}</span>
          ) : (
            <button type="button" className="bare" onClick={() => onGo(folder.id)}>
              {folder.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

function FolderRow({
  folder,
  count,
  onOpen,
  onDropFile,
  onRename,
  onDelete,
}: {
  folder: Shown;
  count: number;
  onOpen: () => void;
  onDropFile: (id: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [over, setOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(folder.name);

  if (editing) {
    return (
      <Blueprint plain style={{ padding: 'var(--sp-5)' }}>
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Rename ${folder.name}`}
          style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
        />
        <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <ActionButton onClick={() => setEditing(false)}>Cancel</ActionButton>
          <ActionButton
            tone="primary"
            onClick={() => {
              onRename(draft);
              setEditing(false);
            }}
          >
            Rename
          </ActionButton>
        </div>
      </Blueprint>
    );
  }

  return (
    <Blueprint
      plain
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-5)',
        outline: over ? '1px solid var(--app-accent)' : 'none',
      }}
      onDragOver={(e: React.DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData('text/semester-file');
        if (id) onDropFile(id);
      }}
    >
      <FolderIcon size={17} />
      <button type="button" className="bare" onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{folder.name}</span>
        <span style={{ ...secondLine(), display: 'block', fontSize: 'var(--type-xs)' }}>
          {folder.fromCourse ? 'From your courses' : `${count} ${count === 1 ? 'file' : 'files'}`}
        </span>
      </button>
      {!folder.fromCourse && (
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDraft(folder.name);
              setEditing(true);
            }}
            aria-label={`Rename ${folder.name}`}
            style={{ flex: 'none', fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-3)' }}
          >
            Rename
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onDelete}
            aria-label={`Delete the folder ${folder.name}. Anything in it moves up a level.`}
            style={{ flex: 'none', fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-3)' }}
          >
            Delete
          </button>
        </>
      )}
      <ChevronRight size={15} />
    </Blueprint>
  );
}

function FileRow({
  file,
  inText,
  grid,
  binned,
  where,
  course,
  due,
  notes,
  onOpen,
  onStar,
  onMove,
  onFile,
  onTrash,
  onRestore,
  onPurge,
}: {
  file: Settled;
  inText: boolean;
  grid: boolean;
  binned: boolean;
  where: string;
  course: string;
  /** The deadline this is for, where it is for one that still exists. */
  due?: string;
  notes: number;
  onOpen: () => void;
  onStar: () => void;
  onMove: () => void;
  onFile: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const second = [
    formatBytes(file.size),
    course,
    /*
     * Before the folder rather than after it, and it is the one line on this
     * row somebody scans for. A drive says where a file *is*; this says what it
     * is *for*, which is the question that brought them here.
     */
    due ? `for ${due}` : '',
    where,
    inText ? 'found in the text' : '',
    notes > 0 ? `attached to ${notes} ${notes === 1 ? 'note' : 'notes'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Blueprint
      plain
      draggable={!binned}
      onDragStart={(e: React.DragEvent) => e.dataTransfer.setData('text/semester-file', file.id)}
      style={{
        display: 'flex',
        flexDirection: grid ? 'column' : 'row',
        alignItems: grid ? 'stretch' : 'center',
        gap: 'var(--sp-4)',
        padding: 'var(--sp-5)',
      }}
    >
      <button
        type="button"
        className="bare"
        onClick={onOpen}
        style={{ flex: 1, minWidth: 0, textAlign: 'left' }}
      >
        <span
          style={{
            display: 'block',
            fontSize: 'var(--type-md)',
            lineHeight: 'var(--leading-tight)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: grid ? 'normal' : 'nowrap',
          }}
        >
          {file.name}
        </span>
        <span style={{ ...secondLine(), display: 'block', fontSize: 'var(--type-xs)' }}>{second}</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', flex: 'none' }}>
        {binned ? (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onRestore}
              aria-label={`Put ${file.name} back`}
              style={{ fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-3)' }}
            >
              Put back
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onPurge}
              aria-label={`Delete ${file.name} for good. This cannot be undone.`}
              style={{ fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-3)' }}
            >
              Delete for good
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="bare"
              onClick={onStar}
              aria-label={file.starred ? `Unstar ${file.name}` : `Star ${file.name}`}
              aria-pressed={file.starred}
              style={{ padding: 'var(--sp-2)' }}
            >
              <StarIcon on={file.starred} size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onMove}
              aria-label={`Move ${file.name} to another folder`}
              style={{ fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-3)' }}
            >
              Move
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onFile}
              aria-label={
                due
                  ? `${file.name} is for ${due}. Change which deadline it is for.`
                  : `Say which deadline ${file.name} is for`
              }
              style={{ fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-3)' }}
            >
              For
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onTrash}
              aria-label={`Move ${file.name} to the bin`}
              style={{ fontSize: 'var(--type-xs)', padding: 'var(--sp-2) var(--sp-3)' }}
            >
              Bin
            </button>
          </>
        )}
      </div>
    </Blueprint>
  );
}

/**
 * Which deadline a file is for.
 *
 * A sibling of `MoveTo` below and drawn the same way, because they are the same
 * act asked twice — where does this belong. The difference is that a folder is
 * the student's own filing and a deadline is the syllabus's, so they are two
 * questions rather than one control with two halves.
 *
 * The picker needs a course to offer deadlines from, and a file may have none.
 * Rather than refuse, this offers the course first: a file tagged nothing is
 * almost always a file nobody has got round to tagging, and tagging it here is
 * a tap rather than a trip to another screen. Both writes are independent —
 * `tagFile` and `pinFile` — so neither moves the other behind anybody's back.
 */
function FileAgainst({
  file,
  onCourse,
  onClose,
  onPick,
}: {
  file: Settled;
  onCourse: (courseId: string | null) => void;
  onClose: () => void;
  onPick: (itemId: string | null) => void;
}) {
  const [allDeadlines, setAllDeadlines] = useState(false);

  return (
    <Folding name={`What ${file.name} is for`}>
      <Blueprint style={{ padding: 'var(--sp-5)' }}>
        {/* "Where this belongs" rather than "What it is for": the picker
            below writes its own "What it is for" over the deadline chips, and
            the same three words twice on one panel reads as a rendering
            fault. This heading is the question both halves answer. */}
        <SectionLabel>Where this belongs</SectionLabel>
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
          {file.name}
        </div>
        <CoursePicker value={file.courseId} onChange={onCourse} />
        {file.courseId === null ? (
          <div
            style={{
              ...secondLine(),
              fontSize: 'var(--type-xs)',
              marginTop: 'var(--sp-4)',
              lineHeight: 'var(--leading-relaxed)',
            }}
          >
            Pick a course and its deadlines appear here.
          </div>
        ) : (
          <DeadlinePicker
            courseId={file.courseId}
            value={file.itemId}
            onChange={onPick}
            showAll={allDeadlines}
            onShowAll={() => setAllDeadlines(true)}
          />
        )}
        <ActionButton onClick={onClose} style={{ marginTop: 'var(--sp-5)' }}>
          Done
        </ActionButton>
      </Blueprint>
    </Folding>
  );
}

/**
 * Choosing where a file goes, without dragging it there.
 *
 * Every folder in one flat list, indented by depth rather than opened a level
 * at a time: a drive this size is three folders deep at most, and a picker you
 * have to navigate is a second drive to get lost in.
 */
function MoveTo({
  file,
  folders,
  onClose,
  onPick,
}: {
  file: Settled;
  folders: Shown[];
  onClose: () => void;
  onPick: (folderId: string | null) => void;
}) {
  const rows = useMemo(() => {
    const out: { folder: Shown; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const folder of childrenOf(folders, parentId)) {
        out.push({ folder, depth });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [folders]);

  return (
    <Folding name={`Move ${file.name}`}>
      <Blueprint style={{ padding: 'var(--sp-5)' }}>
        <SectionLabel>Move it to</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <button
            type="button"
            className="bare"
            onClick={() => onPick(null)}
            disabled={file.folderId === null}
            style={{ textAlign: 'left', padding: 'var(--sp-3)' }}
          >
            Drive
          </button>
          {rows.map(({ folder, depth }) => (
            <button
              key={folder.id}
              type="button"
              className="bare"
              onClick={() => onPick(folder.id)}
              disabled={folder.id === file.folderId || !canMove(folders, 'file', folder.id)}
              style={{
                textAlign: 'left',
                padding: 'var(--sp-3)',
                paddingLeft: `calc(var(--sp-3) + ${depth} * var(--sp-6))`,
              }}
            >
              {folder.name}
            </button>
          ))}
        </div>
        <ActionButton onClick={onClose} style={{ marginTop: 'var(--sp-5)' }}>
          Cancel
        </ActionButton>
      </Blueprint>
    </Folding>
  );
}
