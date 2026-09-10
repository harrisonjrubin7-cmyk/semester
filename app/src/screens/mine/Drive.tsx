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
import {
  TRASH_DAYS,
  addFile,
  deleteFile,
  emptyTrash,
  formatBytes,
  listFiles,
  listTrash,
  moveFile,
  openFile,
  restoreFile,
  search,
  starFile,
  tagFile,
  trashFile,
  type Settled,
} from '../../lib/files';
import {
  canMove,
  childrenOf,
  freeName,
  isCourseFolder,
  trail,
  withCourses,
  type Shown,
} from '../../lib/folders';

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

type View = 'drive' | 'starred' | 'recent' | 'bin';
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
  const { state, dispatch, catalog, courseCode } = useStore();
  const [files, setFiles] = useState<Settled[]>([]);
  const [binned, setBinned] = useState<Settled[]>([]);
  const [at, setAt] = useState<string | null>(null);
  const [view, setView] = useState<View>('drive');
  const [sort, setSort] = useState<Sort>('added');
  const [grid, setGrid] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [moving, setMoving] = useState<Settled | null>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const refresh = () => {
    void listFiles().then(setFiles);
    void listTrash().then(setBinned);
  };
  useEffect(refresh, []);

  const folders = useMemo(
    () => withCourses(state.folders, catalog.courses),
    [state.folders, catalog.courses],
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
    for (const [n, f] of list.entries()) {
      setBusy(list.length > 1 ? `Adding ${n + 1} of ${list.length}…` : 'Adding…');
      // A file dropped into a course's folder is filed against that course, so
      // it turns up on the course page without anybody tagging it twice.
      const course = isCourseFolder(at) ? (at as string).slice('course:'.length) : null;
      await addFile(f, course, at, await indexed(f));
    }
    setBusy('');
    refresh();
  };

  const act = async (run: Promise<unknown>) => {
    await run;
    refresh();
  };

  const here = childrenOf(folders, at);
  const crumbs = trail(folders, at);

  /** What the chosen view is looking at, before searching and sorting. */
  const pool = useMemo(() => {
    if (view === 'bin') return binned;
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
    return query.trim() ? files : files.filter((f) => f.folderId === at);
  }, [view, binned, files, at, query]);

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

  const room = files.reduce((n, f) => n + f.size, 0);
  const searching = query.trim() !== '';
  const inDrive = view === 'drive' && !searching;

  return (
    <div>
      <Segmented
        options={[
          { id: 'drive', label: 'Drive' },
          { id: 'starred', label: 'Starred' },
          { id: 'recent', label: 'Recent' },
          { id: 'bin', label: 'Bin' },
        ]}
        value={view}
        onChange={(next) => {
          setView(next);
          setQuery('');
        }}
        style={{ marginBottom: 'var(--sp-5)' }}
      />

      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search your files"
        placeholder="Search names and what is inside"
        style={{ width: '100%', marginBottom: 'var(--sp-5)' }}
      />

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

      {view !== 'bin' && (
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

      {inDrive && here.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          {here.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              count={files.filter((f) => f.folderId === folder.id).length}
              onOpen={() => setAt(folder.id)}
              onDropFile={(id) => void act(moveFile(id, folder.id))}
              onRename={(next) =>
                dispatch({ type: 'renameFolder', id: folder.id, name: freeName(folders, folder.parentId, next) })
              }
              onDelete={async () => {
                /*
                 * The files come out first, then the folder goes.
                 *
                 * The reducer cannot reach IndexedDB, so if the folder went
                 * first and this failed, every file in it would point at
                 * somewhere that does not exist — present in the store,
                 * invisible in every view. Same order, same reason, as the
                 * note on `deleteFolder` in `state/slices/made.ts`.
                 */
                for (const f of files.filter((x) => x.folderId === folder.id)) {
                  await moveFile(f.id, folder.parentId);
                }
                dispatch({ type: 'deleteFolder', id: folder.id });
                refresh();
              }}
            />
          ))}
        </div>
      )}

      {shown.length === 0 ? (
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
            {view !== 'bin' && ` · ${formatBytes(room)} in all`}
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
                notes={state.notes.filter((n) => n.fileIds.includes(file.id)).length}
                onOpen={() => void openFile(file.id).then(refresh)}
                onStar={() => void act(starFile(file.id, !file.starred))}
                onMove={() => setMoving(file)}
                onTrash={() => void act(trashFile(file.id))}
                onRestore={() => void act(restoreFile(file.id))}
                onPurge={() => void act(deleteFile(file.id))}
              />
            ))}
          </div>
        </>
      )}

      {moving && (
        <MoveTo
          file={moving}
          folders={folders}
          onClose={() => setMoving(null)}
          onPick={async (folderId) => {
            await moveFile(moving.id, folderId);
            // Dropping a file into a course folder files it against that
            // course too, which is what makes it appear on the course page.
            if (isCourseFolder(folderId)) {
              await tagFile(moving.id, (folderId as string).slice('course:'.length));
            }
            setMoving(null);
            refresh();
          }}
        />
      )}
      <div style={{ height: 22 }} />
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
  notes,
  onOpen,
  onStar,
  onMove,
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
  notes: number;
  onOpen: () => void;
  onStar: () => void;
  onMove: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPurge: () => void;
}) {
  const second = [
    formatBytes(file.size),
    course,
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
