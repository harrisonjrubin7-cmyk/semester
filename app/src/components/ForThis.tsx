import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { Panel } from './Produced';
import { FilePick, SectionLabel } from './ui';
import { ChevronRight, Paperclip, Plus } from './Icons';
import { attachable, attachedTo, WORK_LABEL, type Attached } from '../lib/forwork';
import { addFile, listFiles, openFile, pinFile, type Settled } from '../lib/files';
import type { Action } from '../state/shape';
import type { DatedItem } from '../lib/types';
import { secondLine } from '../lib/dim';

/**
 * The work for one deadline, under the deadline.
 *
 * A deadline row said what was due and when, and the app held the draft, the
 * spreadsheet, the slides and the two PDFs that went with it — filed against
 * the *course*, which is four months wide. So the last step of every evening's
 * work was the same hunt: open Make, open Write, read six documents called
 * "Draft" and guess. Nothing was lost; it was just never in the same place as
 * the thing it was for.
 *
 * This is that place. It sits on the deadline for the reason `BreakItUp` does:
 * the moment somebody wants the draft is the moment they are looking at what
 * it is due for, and a screen you have to go to in order to find your own work
 * is the screen this replaces.
 *
 * ## New here, rather than New and then file it
 *
 * The four buttons make a document, a sheet, a deck or an upload **already**
 * filed against this deadline and its course. That is the whole point — a
 * picker somebody has to remember to use is a picker most work never reaches,
 * and the filing is then wrong in the direction that is invisible. Anything
 * that already exists is attached through the row below instead.
 *
 * ## Why it draws nothing for a deadline with nothing
 *
 * It does not: it draws the New row and one sentence. An empty panel here would
 * be the app's only answer to "where does my work go", and hiding it until
 * there is work would mean the feature is invisible until somebody has already
 * found it another way.
 */
export function ForThis({ item }: { item: DatedItem }) {
  const { state, dispatch } = useStore();
  const [files, setFiles] = useState<Settled[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState('');
  /** What went wrong with the last write, in a sentence, or empty. */
  const [trouble, setTrouble] = useState('');

  /*
   * Files live in IndexedDB, not in the store, so they arrive after the first
   * render and have to be re-read whenever this panel changes one. Failing
   * soft is the store's own rule — `listFiles` answers with an empty list in a
   * private window rather than throwing — so a blocked browser sees the five
   * things that are in the store and no file rows.
   */
  const refresh = () => void listFiles().then(setFiles);
  useEffect(refresh, []);

  const held = { ...state, files };
  const mine = attachedTo(held, item.id);
  const free = adding ? attachable(held, item.c) : [];

  /*
   * Attaching something that already exists.
   *
   * The five kinds in the store go through the reducer and cannot fail. A
   * file is a write to IndexedDB and can: no room left, a browser that
   * refuses to store, a transaction aborted as the tab closes. The first
   * version discarded that rejection with `void`, which meant the panel
   * stayed open, nothing was attached, and nothing anywhere said so — the
   * press simply did nothing, which is the worst thing a control can do.
   *
   * So the panel only closes once the write has landed, and a failure is a
   * sentence rather than a silence.
   */
  const attach = async (a: Attached) => {
    if (a.kind === 'file') {
      try {
        await pinFile(a.id, item.id);
      } catch {
        setTrouble(`${a.title} could not be filed against this. There may be no room left on this device.`);
        refresh();
        return;
      }
      refresh();
    } else {
      dispatch(filing(a, item.id));
    }
    setTrouble('');
    setAdding(false);
  };

  /** Taking the link off, with the same failure to report as putting it on. */
  const loose = async (a: Attached) => {
    if (a.kind !== 'file') {
      dispatch(filing(a, null));
      return;
    }
    try {
      await pinFile(a.id, null);
      setTrouble('');
    } catch {
      setTrouble(`${a.title} could not be unfiled. There may be no room left on this device.`);
    } finally {
      refresh();
    }
  };

  const onPick = async (list: File[]) => {
    if (list.length === 0) return;
    const failed: string[] = [];
    try {
      for (const [n, f] of list.entries()) {
        setBusy(list.length > 1 ? `Adding ${n + 1} of ${list.length}…` : 'Adding…');
        /*
         * Per file, not around the loop.
         *
         * One file that will not store — a video past the quota, a name the
         * browser refuses — must not take the rest of the selection with it.
         * Around the loop it did: pick five readings, have the second fail,
         * and the last three were never attempted and never mentioned. This
         * is the shape `screens/mine/Drive.tsx` already uses for the same
         * job, and the report below names what was lost.
         */
        try {
          await addFile(f, item.c, null, '', item.id);
        } catch {
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

  return (
    <div style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel style={{ margin: '0 0 var(--sp-4)' }}>Work for this</SectionLabel>

      {/*
        A write that did not land, said rather than swallowed.
        Above the list, because it is about the list: the row somebody
        expected is not in it, and this is the only thing on the screen that
        can say why.
      */}
      {trouble !== '' && (
        <Panel style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
            {trouble}
          </div>
        </Panel>
      )}

      {mine.length === 0 ? (
        <div
          style={{
            fontSize: 'var(--type-sm)',
            ...secondLine(),
            lineHeight: 'var(--leading-relaxed)',
            marginBottom: 'var(--sp-5)',
          }}
        >
          Nothing filed against this yet. Anything you start here is filed against it, and turns
          up on this deadline wherever you see it next.
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          {mine.map((a) => (
            <Row
              key={`${a.kind}:${a.id}`}
              work={a}
              onOpen={() => open(a, dispatch)}
              onLoose={() => void loose(a)}
            />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <New onClick={() => dispatch({ type: 'newDocument', courseId: item.c, itemId: item.id })}>
          Document
        </New>
        <New onClick={() => dispatch({ type: 'newSheet', courseId: item.c, itemId: item.id })}>
          Sheet
        </New>
        <New onClick={() => dispatch({ type: 'newDeck', courseId: item.c, itemId: item.id })}>
          Deck
        </New>
        <New onClick={() => dispatch({ type: 'newNote', courseId: item.c, itemId: item.id })}>
          Note
        </New>
        {/* The one that is not a dispatch: a file comes from the operating
            system's own picker, which `FilePick` is the app's single way of
            opening. See the note on it in `components/ui.tsx`. */}
        {/* `width: auto` for the same reason as the Unfile button below:
            `.bare` sets `width: 100%`, and without it this label stretches to
            the end of the row and draws a hover panel across the gap beside
            it. */}
        <FilePick
          block={false}
          tone="bare"
          onPick={onPick}
          style={{ display: 'inline-flex', width: 'auto' }}
        >
          <NewFace>{busy || 'Upload'}</NewFace>
        </FilePick>
      </div>

      {/* Attaching something that already exists is the quieter half, and sits
          under the New row because making something is what people do first. */}
      <button
        type="button"
        className="bare tappable"
        onClick={() => setAdding((was) => !was)}
        aria-expanded={adding}
        style={{
          width: 'auto',
          padding: 'var(--sp-4) 0 0',
          fontSize: 'var(--type-sm)',
          color: 'var(--app-accent-deep)',
        }}
      >
        {adding ? 'Never mind' : 'Attach something you already have'}
      </button>

      {adding && (
        <Panel style={{ marginTop: 'var(--sp-4)' }} tone="inset">
          {free.length === 0 ? (
            <div style={{ fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-relaxed)' }}>
              Everything you have made for this course is already filed against a deadline. To move
              one here, open it and change what it is for.
            </div>
          ) : (
            free.map((a) => (
              <button
                key={`${a.kind}:${a.id}`}
                type="button"
                className="bare tappable"
                onClick={() => void attach(a)}
                style={{
                  width: '100%',
                  display: 'flex',
                  gap: 'var(--sp-4)',
                  alignItems: 'center',
                  padding: 'var(--sp-4) 0',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--app-line)',
                }}
              >
                <Plus size={15} style={{ flex: 'none', ...secondLine() }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{a.title}</span>
                  <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine() }}>
                    {WORK_LABEL[a.kind]}
                  </span>
                </span>
              </button>
            ))
          )}
        </Panel>
      )}
    </div>
  );
}

/** One piece of work: what it is, and the way out of the filing. */
function Row({
  work,
  onOpen,
  onLoose,
}: {
  work: Attached;
  onOpen: () => void;
  onLoose: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-4)',
        alignItems: 'center',
        borderTop: '1px solid var(--app-line)',
      }}
    >
      <button
        type="button"
        className="bare tappable on-paper"
        onClick={onOpen}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          gap: 'var(--sp-4)',
          alignItems: 'center',
          padding: 'var(--sp-5) 0',
          textAlign: 'left',
        }}
      >
        {/* `currentColor`, so the audited dim token reaches the glyph the same
            way it reaches the line under it. */}
        <Paperclip size={15} style={{ flex: 'none', ...secondLine() }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontSize: 'var(--type-md)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {work.title}
          </span>
          <span style={{ display: 'block', fontSize: 'var(--type-xs)', ...secondLine() }}>
            {WORK_LABEL[work.kind]}
          </span>
        </span>
        <ChevronRight size={15} style={{ ...secondLine(), flex: 'none' }} />
      </button>
      {/*
        Unfile, not delete, and the word matters more here than anywhere else
        in the app: this row is the only view of somebody's coursework that
        sits next to a deadline, and a button here that erased a draft would be
        the worst mistake the app is able to make. It takes the link off. The
        document stays exactly where it was, in Write, with its course.
      */}
      <button
        type="button"
        className="bare tappable"
        onClick={onLoose}
        aria-label={`Unfile ${work.title} from this deadline`}
        /* `width: auto` is not decoration. `.bare` sets `width: 100%`, and a
           flex item with `flex: none` takes its basis from that width — so
           without this the Unfile button claims the whole row and the title
           beside it is squeezed to nothing. Measured: the work row rendered
           as one letter per line. */
        style={{
          flex: 'none',
          width: 'auto',
          padding: 'var(--sp-5) var(--sp-3)',
          fontSize: 'var(--type-xs)',
          ...secondLine(),
        }}
      >
        Unfile
      </button>
    </div>
  );
}

/** The New row's buttons, which are one shape drawn five times. */
function New({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="bare tappable" onClick={onClick} style={{ width: 'auto' }}>
      <NewFace>{children}</NewFace>
    </button>
  );
}

function NewFace({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3) var(--sp-5)',
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--app-line)',
        fontSize: 'var(--type-sm)',
      }}
    >
      <Plus size={13} style={{ ...secondLine() }} />
      {children}
    </span>
  );
}

/**
 * How each kind is opened, in one place.
 *
 * A switch rather than a field on `Attached`, because an action is not data:
 * putting a dispatch on the row would make `lib/forwork.ts` import the store's
 * action type in order to describe a document, and the module is meant to be
 * readable without the app around it.
 *
 * The equation is the odd one and the reason `mathTab` is in state: it has no
 * screen of its own, so it is reached by landing on the Kept third of the
 * equations screen. Landing on Write — an empty box — is what a link that only
 * said `go: equations` would have done.
 */
function open(work: Attached, dispatch: (action: Action) => void) {
  switch (work.kind) {
    case 'document':
      dispatch({ type: 'openDocument', id: work.id });
      return;
    case 'sheet':
      dispatch({ type: 'openSheet', id: work.id });
      return;
    case 'deck':
      dispatch({ type: 'editDeck', id: work.id });
      return;
    case 'note':
      dispatch({ type: 'openNote', id: work.id });
      return;
    case 'equation':
      dispatch({ type: 'setMathTab', tab: 'kept' });
      dispatch({ type: 'go', screen: 'equations' });
      return;
    case 'file':
      // The bytes themselves, in a tab of their own. A row that opened the
      // drive and left somebody to find the file again would be a row that
      // pointed at where the thing is rather than opening it.
      void openFile(work.id);
      return;
  }
}

/**
 * Filing one of the five store-held kinds against a deadline, or against none.
 *
 * One function for both directions rather than a `pin` and a `loosen` that
 * were the same switch written twice — the pair had already drifted, with the
 * unfile half reaching into IndexedDB itself while its twin returned an
 * action. A file is not here at all: it is a write that can fail, so it is
 * handled where a failure can be reported. See `attach` and `loose` above.
 */
function filing(work: Attached, itemId: string | null): Action {
  switch (work.kind) {
    case 'document':
      return { type: 'updateDocument', id: work.id, patch: { itemId } };
    case 'sheet':
      return { type: 'updateSheet', id: work.id, patch: { itemId } };
    case 'deck':
      return { type: 'updateDeck', id: work.id, patch: { itemId } };
    case 'note':
      return { type: 'updateNote', id: work.id, patch: { itemId } };
    default:
      return { type: 'fileEquation', id: work.id, itemId };
  }
}
