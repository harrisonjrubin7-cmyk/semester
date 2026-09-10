import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { Equation } from '../components/Equation';
import { ActionButton, EmptyState, SectionLabel, Toggle } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { ChevronRight, Plus, WriteIcon } from '../components/Icons';
import { Folding } from '../components/Fold';
import { secondLine } from '../lib/dim';
import { download } from '../lib/deliver';
import { docx } from '../lib/docx';
import {
  BLOCK_LABEL,
  blankBlock,
  docFileName,
  fromMarkdown,
  hasContent,
  summary,
  toMarkdown,
  words,
  type Block,
  type BlockKind,
  type Doc,
} from '../lib/document';
import { filled } from '../lib/sheet';
import { TEMPLATES, fromTemplate } from '../lib/doctemplates';
import { characters, findAll, outline, readingMinutes, replaceAll } from '../lib/doctools';
import { revealKindly } from '../lib/prefers';
import { change, forget, keep, restored, versionsOf, type Version } from '../lib/docversions';

/**
 * Write a document.
 *
 * The app's third writing screen and the only one that makes a file you hand
 * in. **Work on it** breaks a brief into a plan and will not write it;
 * **Draft it** writes prose and is fenced off from coursework. Neither of them
 * produces a memo with a table in it, which is what a business or policy course
 * asks for roughly every fortnight — so that happened in Word, and everything
 * this app knows stayed behind.
 *
 * ## Nothing here writes for you
 *
 * There is no model on this screen and no key needed. It is an editor: you
 * type, and it arranges. The assistant can propose a document — `make_document`
 * in `lib/tools.ts` — and that is a proposal you accept, with the same
 * confirmation every other write in this app gets. The distinction is the same
 * one **Draft it** draws and it is deliberate: a screen that quietly writes
 * your coursework is a different product.
 *
 * ## Blocks
 *
 * Seven kinds, each with one editor, and the two that matter are the two
 * nothing else in the app could do: a **table**, which can be pulled straight
 * out of a sheet you built, and an **equation**, which is written properly and
 * lands in Word as a real equation object rather than a picture. See
 * `lib/document.ts` for why this is a list of typed blocks rather than a
 * rich-text field.
 */
export function Write() {
  const { state } = useStore();
  const open = state.documents.find((d) => d.id === state.documentId) ?? null;
  return open ? <Editor doc={open} /> : <Shelf />;
}

// ── The list ─────────────────────────────────────────────────────────────

function Shelf() {
  const { state, dispatch, courseCode } = useStore();
  const [picking, setPicking] = useState(false);

  return (
    <Page blurb="Headings, tables and equations, arranged into a real Word file — or printed straight from here as a PDF.">
      <ActionButton
        tone="primary"
        onClick={() => dispatch({ type: 'newDocument', courseId: null })}
        style={{ marginBottom: 'var(--sp-4)' }}
      >
        New document
      </ActionButton>

      <ActionButton onClick={() => setPicking(!picking)} style={{ marginBottom: 'var(--sp-5)' }}>
        {picking ? 'Never mind' : 'Start from a shape'}
      </ActionButton>

      {picking && (
        <Blueprint style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-7)' }}>
          <SectionLabel>A shape, not a draft</SectionLabel>
          <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-5)' }}>
            Headings and blanks. None of them contains a sentence you could hand in — the app does
            not write coursework.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {TEMPLATES.map((template) => (
              <Blueprint
                key={template.id}
                as="button"
                plain
                onClick={() => {
                  dispatch({ type: 'makeDocument', doc: fromTemplate(template, template.label) });
                  setPicking(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-5)',
                  padding: 'var(--sp-5)',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--type-md)' }}>{template.label}</div>
                  <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>{template.blurb}</div>
                </div>
                <ChevronRight size={15} />
              </Blueprint>
            ))}
          </div>
        </Blueprint>
      )}

      {state.documents.length === 0 ? (
        <EmptyState
          title="Nothing written yet"
          body="A memo, a report, a handout, a one-page brief. It stays on this device unless you are signed in."
          icon={<WriteIcon />}
        />
      ) : (
        <Folding name="Documents">
          <SectionLabel>
            {state.documents.length} {state.documents.length === 1 ? 'document' : 'documents'}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {state.documents.map((doc) => (
              <Blueprint
                key={doc.id}
                as="button"
                plain
                onClick={() => dispatch({ type: 'openDocument', id: doc.id })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-5)',
                  padding: 'var(--sp-6)',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--type-md)' }}>{doc.title || 'Untitled document'}</div>
                  <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-1)' }}>
                    {[
                      doc.courseId ? courseCode(doc.courseId) : 'Personal',
                      `${words(doc)} words`,
                      new Date(doc.updated).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      }),
                    ].join(' · ')}
                  </div>
                </div>
                <ChevronRight size={16} />
              </Blueprint>
            ))}
          </div>
        </Folding>
      )}
    </Page>
  );
}

// ── The editor ───────────────────────────────────────────────────────────

const KINDS: BlockKind[] = ['heading', 'text', 'bullets', 'quote', 'table', 'equation', 'break'];

function Editor({ doc }: { doc: Doc }) {
  const { dispatch, say } = useStore();
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');

  const patch = (next: Partial<Omit<Doc, 'id'>>) =>
    dispatch({ type: 'updateDocument', id: doc.id, patch: next });

  const setBlock = (at: number, block: Block) =>
    patch({ blocks: doc.blocks.map((b, i) => (i === at ? block : b)) });

  const addBlock = (kind: BlockKind, at = doc.blocks.length) => {
    const blocks = [...doc.blocks];
    blocks.splice(at, 0, blankBlock(kind));
    patch({ blocks });
    dispatch({ type: 'editBlock', at });
  };

  const removeBlock = (at: number) => {
    const blocks = doc.blocks.filter((_, i) => i !== at);
    patch({ blocks: blocks.length ? blocks : [blankBlock('text')] });
    dispatch({ type: 'editBlock', at: null });
  };

  const count = words(doc);
  const empty = !hasContent(doc);
  const headings = outline(doc);

  const saveWord = async () => {
    setBusy(true);
    try {
      const blob = await docx(doc);
      download({
        name: docFileName(doc.title),
        body: blob,
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      say('Word file saved.');
    } finally {
      setBusy(false);
    }
  };

  const saveMarkdown = () => {
    download({
      name: docFileName(doc.title, 'md'),
      body: toMarkdown(doc),
      mime: 'text/markdown',
    });
    say('Markdown saved.');
  };

  return (
    <Page
      blurb={`${count} ${count === 1 ? 'word' : 'words'} · ${characters(doc)} characters · about ${readingMinutes(doc)} min to read · ${summary(doc.blocks)}`}
      actions={
        <ActionButton onClick={() => dispatch({ type: 'closeDocument' })}>
          All documents
        </ActionButton>
      }
    >
      <input
        className="input"
        value={doc.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="Title"
        aria-label="Document title"
        style={{ width: '100%', height: 46, fontSize: 'var(--type-lg)' }}
      />
      <input
        className="input"
        value={doc.subtitle}
        onChange={(e) => patch({ subtitle: e.target.value })}
        placeholder="Subtitle, your name, the course — optional"
        aria-label="Subtitle"
        style={{ width: '100%', height: 40, marginTop: 'var(--sp-4)' }}
      />
      <CoursePicker value={doc.courseId} onChange={(id) => patch({ courseId: id })} />

      <Saved doc={doc} words={count} />
      {headings.length > 1 && <Outline headings={headings} />}
      <FindReplace doc={doc} onReplace={(next) => patch({ blocks: next.blocks })} />
      <History doc={doc} onRestore={(version) => patch(restored(doc, version))} />

      <SectionLabel>The document</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        {doc.blocks.map((block, at) => (
          <BlockCard
            key={at}
            block={block}
            at={at}
            of={doc.blocks.length}
            onChange={(next) => setBlock(at, next)}
            onRemove={() => removeBlock(at)}
            onMove={(to) => patch({ blocks: moved(doc.blocks, at, to) })}
          />
        ))}
      </div>

      <SectionLabel>Add</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className="bare tappable"
            onClick={() => addBlock(kind)}
            style={{
              width: 'auto',
              padding: 'var(--sp-4) var(--sp-6)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'var(--type-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
            }}
          >
            <Plus size={13} />
            {BLOCK_LABEL[kind]}
          </button>
        ))}
      </div>

      <SectionLabel>Paste something in</SectionLabel>
      {pasting ? (
        <Blueprint style={{ padding: 'var(--sp-6)' }}>
          <textarea
            className="input"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'## A heading\n\nSome prose.\n\n- a list\n\n| a | b |\n| --- | --- |\n| 1 | 2 |'}
            aria-label="Markdown to read in"
            rows={7}
            style={{ width: '100%', fontSize: 'var(--type-base)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() => {
                setPasting(false);
                setPasted('');
              }}
            >
              Cancel
            </ActionButton>
            <ActionButton
              tone="primary"
              disabled={!pasted.trim()}
              onClick={() => {
                const read = fromMarkdown(pasted);
                patch({ blocks: [...(empty ? [] : doc.blocks), ...read] });
                say(`Read in ${summary(read)}.`);
                setPasting(false);
                setPasted('');
              }}
            >
              Read it in
            </ActionButton>
          </div>
        </Blueprint>
      ) : (
        <ActionButton onClick={() => setPasting(true)}>
          Paste notes or Markdown
        </ActionButton>
      )}

      <SectionLabel>Take it away</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <ActionButton tone="primary" disabled={empty || busy} onClick={saveWord}>
          {busy ? 'Writing…' : 'Word file (.docx)'}
        </ActionButton>
        <ActionButton disabled={empty} onClick={saveMarkdown}>
          Markdown (.md)
        </ActionButton>
        <PrintButton label="Print or save as PDF" />
      </div>

      <SectionLabel>This document</SectionLabel>
      <ActionButton
        onClick={() => {
          // The drafts go with the document. Leaving them would keep every
          // paragraph of something somebody deliberately deleted, in a store
          // with nothing left pointing at it.
          void forget(doc.id);
          dispatch({ type: 'deleteDocument', id: doc.id });
          say('Document deleted.');
        }}
      >
        Delete it
      </ActionButton>
    </Page>
  );
}

/**
 * One block moved to a new index.
 *
 * `lib/arrange.ts` moves things by identity — `dropped(list, moved, target)`
 * takes the items themselves — and blocks have no id to be identified by.
 * Giving them one would mean a migration for every document already saved, to
 * support two arrows. So this is by position, which is what the two arrows
 * mean anyway.
 */
/**
 * "Saved", said honestly.
 *
 * The document is written to the store on every keystroke and always has been
 * — this is not the save. It is the version history's save: a copy is kept
 * when the writing pauses, and the line says when the last copy was kept and
 * whether it was actually written, rather than flashing "saved" on a timer
 * regardless of whether anything happened.
 *
 * Two seconds after the last change. Long enough that a sentence being typed
 * is one version rather than forty; short enough that the copy exists before
 * somebody puts the phone down.
 */
function Saved({ doc, words: count }: { doc: Doc; words: number }) {
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void keep(doc, count).then((wrote) => {
        if (wrote) setAt(Date.now());
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [doc, count]);

  return (
    <div
      role="status"
      style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-4)' }}
    >
      {at === null
        ? 'Every change is kept as you type.'
        : `A copy of this draft was kept at ${new Date(at).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}.`}
    </div>
  );
}

/** The headings, as a way of finding your place in something long. */
function Outline({ headings }: { headings: ReturnType<typeof outline> }) {
  return (
    <Folding name="Outline">
      <SectionLabel>{headings.length} headings</SectionLabel>
      <nav aria-label="The headings in this document">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {headings.map((h) => (
            <button
              key={`${h.at}-${h.text}`}
              type="button"
              className="bare"
              onClick={() => revealKindly(document.getElementById(`block-${h.at}`), { block: 'center' })}
              style={{
                textAlign: 'left',
                padding: 'var(--sp-2)',
                paddingLeft: `calc(var(--sp-2) + ${h.level - 1} * var(--sp-6))`,
                fontSize: 'var(--type-sm)',
              }}
            >
              {h.text}
            </button>
          ))}
        </div>
      </nav>
    </Folding>
  );
}

/**
 * Find, and replace them all at once.
 *
 * The count is shown before anything is replaced, because "replace all" is the
 * one editing action with no natural undo — a document is not a text field and
 * Ctrl+Z does not reach across it. Seeing "14 matches" first is what turns it
 * from a leap into a decision.
 */
function FindReplace({ doc, onReplace }: { doc: Doc; onReplace: (next: Doc) => void }) {
  const [find, setFind] = useState('');
  const [put, setPut] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const hits = useMemo(
    () => findAll(doc, find, { matchCase, wholeWord }),
    [doc, find, matchCase, wholeWord],
  );

  return (
    <Folding name="Find and replace">
      <input
        className="input"
        value={find}
        onChange={(e) => setFind(e.target.value)}
        aria-label="Find"
        placeholder="Find"
        style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
      />
      <input
        className="input"
        value={put}
        onChange={(e) => setPut(e.target.value)}
        aria-label="Replace with"
        placeholder="Replace with"
        style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
      />
      <div style={{ display: 'flex', gap: 'var(--sp-5)', marginBottom: 'var(--sp-4)' }}>
        <Toggle on={matchCase} onChange={() => setMatchCase(!matchCase)} label="Match case" />
        <Toggle on={wholeWord} onChange={() => setWholeWord(!wholeWord)} label="Whole words" />
      </div>
      <div
        role="status"
        style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-4)' }}
      >
        {find.trim() === ''
          ? 'Tables and equations are left alone, and so is a quotation’s source.'
          : `${hits.length} ${hits.length === 1 ? 'match' : 'matches'}`}
      </div>
      <ActionButton
        disabled={hits.length === 0}
        onClick={() => onReplace(replaceAll(doc, find, put, { matchCase, wholeWord }).doc)}
      >
        {hits.length === 0
          ? 'Replace all'
          : `Replace all ${hits.length} ${hits.length === 1 ? 'match' : 'matches'}`}
      </ActionButton>
    </Folding>
  );
}

/** Earlier drafts, and the way back to one. */
function History({ doc, onRestore }: { doc: Doc; onRestore: (version: Version) => void }) {
  const [rows, setRows] = useState<Version[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) void versionsOf(doc.id).then(setRows);
  }, [open, doc.id, doc.updated]);

  return (
    <Folding name="Earlier drafts">
      <div onFocus={() => setOpen(true)} onMouseEnter={() => setOpen(true)}>
        {!open && (
          <ActionButton onClick={() => setOpen(true)}>Show what was kept</ActionButton>
        )}
        {open && rows.length === 0 && (
          <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>
            Nothing kept yet. A copy is made a couple of seconds after you stop typing.
          </div>
        )}
        {open && rows.length > 0 && (
          <>
            <SectionLabel>
              {rows.length} kept · the oldest is dropped once there are more than 20
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {rows.map((version, i) => (
                <Blueprint
                  key={version.id}
                  plain
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    padding: 'var(--sp-5)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--type-md)' }}>
                      {new Date(version.at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                    <div style={{ ...secondLine(), fontSize: 'var(--type-xs)' }}>
                      {change(version, rows[i + 1])}
                    </div>
                  </div>
                  <ActionButton
                    onClick={() => onRestore(version)}
                    aria-label={`Put this document back to the draft kept at ${new Date(
                      version.at,
                    ).toLocaleString()}`}
                    style={{ width: 'auto', padding: 'var(--sp-2) var(--sp-5)' }}
                  >
                    Put back
                  </ActionButton>
                </Blueprint>
              ))}
            </div>
          </>
        )}
      </div>
    </Folding>
  );
}

function moved<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/** One block, with its own editor and the three controls every block has. */
function BlockCard({
  block,
  at,
  of,
  onChange,
  onRemove,
  onMove,
}: {
  block: Block;
  at: number;
  of: number;
  onChange: (next: Block) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
}) {
  return (
    // The id is what the outline scrolls to. Nothing else reads it.
    <Blueprint plain id={`block-${at}`} style={{ padding: 'var(--sp-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-4)',
          marginBottom: 'var(--sp-5)',
        }}
      >
        <div
          style={{
            ...secondLine(),
            fontSize: 'var(--type-xs)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          {BLOCK_LABEL[block.kind]}
        </div>
        <SmallButton label={`Move ${BLOCK_LABEL[block.kind]} up`} disabled={at === 0} onClick={() => onMove(at - 1)}>
          ↑
        </SmallButton>
        <SmallButton
          label={`Move ${BLOCK_LABEL[block.kind]} down`}
          disabled={at === of - 1}
          onClick={() => onMove(at + 1)}
        >
          ↓
        </SmallButton>
        <SmallButton label={`Remove this ${BLOCK_LABEL[block.kind].toLowerCase()}`} onClick={onRemove}>
          ×
        </SmallButton>
      </div>
      <BlockEditor block={block} onChange={onChange} />
    </Blueprint>
  );
}

function SmallButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="bare tappable"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 30,
        height: 30,
        borderRadius: 'var(--r-sm)',
        border: '1px solid var(--app-line)',
        fontSize: 'var(--type-md)',
        color: disabled ? 'var(--app-dim)' : 'var(--app-fg)',
      }}
    >
      {children}
    </button>
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (next: Block) => void }) {
  switch (block.kind) {
    case 'heading':
      return (
        <>
          <input
            className="input"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="Heading"
            aria-label="Heading text"
            style={{ width: '100%', height: 40 }}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
            {([1, 2, 3] as const).map((level) => (
              <button
                key={level}
                type="button"
                className="bare tappable"
                aria-pressed={block.level === level}
                onClick={() => onChange({ ...block, level })}
                style={{
                  width: 'auto',
                  padding: 'var(--sp-3) var(--sp-6)',
                  borderRadius: 'var(--r-sm)',
                  border: `1px solid ${block.level === level ? 'var(--app-accent)' : 'var(--app-line)'}`,
                  fontSize: 'var(--type-sm)',
                }}
              >
                Level {level}
              </button>
            ))}
          </div>
        </>
      );

    case 'text':
      return (
        <textarea
          className="input"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Write. **Bold** and *italic* work."
          aria-label="Paragraph"
          rows={5}
          style={{ width: '100%', fontSize: 'var(--type-md)', lineHeight: 'var(--leading-relaxed)' }}
        />
      );

    case 'bullets':
      return (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {block.items.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
                <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', width: 18 }}>
                  {block.numbered ? `${i + 1}.` : '•'}
                </div>
                <input
                  className="input"
                  value={line}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      items: block.items.map((x, j) => (j === i ? e.target.value : x)),
                    })
                  }
                  aria-label={`Item ${i + 1}`}
                  style={{ flex: 1, height: 38 }}
                />
                <SmallButton
                  label={`Remove item ${i + 1}`}
                  onClick={() =>
                    onChange({
                      ...block,
                      items: block.items.length > 1 ? block.items.filter((_, j) => j !== i) : [''],
                    })
                  }
                >
                  ×
                </SmallButton>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            <ActionButton onClick={() => onChange({ ...block, items: [...block.items, ''] })}>
              Add item
            </ActionButton>
            <ActionButton onClick={() => onChange({ ...block, numbered: !block.numbered })}>
              {block.numbered ? 'Make it bulleted' : 'Make it numbered'}
            </ActionButton>
          </div>
        </>
      );

    case 'quote':
      return (
        <>
          <textarea
            className="input"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="The passage, word for word."
            aria-label="Quotation"
            rows={4}
            style={{ width: '100%', fontSize: 'var(--type-md)' }}
          />
          <input
            className="input"
            value={block.source}
            onChange={(e) => onChange({ ...block, source: e.target.value })}
            placeholder="Where it came from"
            aria-label="Source of the quotation"
            style={{ width: '100%', height: 38, marginTop: 'var(--sp-4)' }}
          />
        </>
      );

    case 'table':
      return <TableEditor block={block} onChange={onChange} />;

    case 'equation':
      return <EquationEditor block={block} onChange={onChange} />;

    case 'break':
      return (
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>
          Everything after this starts on a new page in the Word file and in print.
        </div>
      );
  }
}

function TableEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { kind: 'table' }>;
  onChange: (next: Block) => void;
}) {
  const { state } = useStore();
  const width = block.rows.reduce((n, r) => Math.max(n, r.length), 0);

  const setCell = (r: number, c: number, value: string) =>
    onChange({
      ...block,
      rows: block.rows.map((row, i) =>
        i === r ? Array.from({ length: width }, (_, j) => (j === c ? value : (row[j] ?? ''))) : row,
      ),
    });

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: width }, (_, c) => (
                  <td key={c} style={{ padding: 'var(--sp-1)' }}>
                    <input
                      className="input"
                      value={row[c] ?? ''}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      aria-label={`Row ${r + 1}, column ${c + 1}`}
                      style={{
                        width: '100%',
                        minWidth: 90,
                        height: 34,
                        fontSize: 'var(--type-sm)',
                        fontWeight: block.header && r === 0 ? 600 : 400,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
        <ActionButton
          onClick={() => onChange({ ...block, rows: [...block.rows, Array.from({ length: width }, () => '')] })}
        >
          Add row
        </ActionButton>
        <ActionButton onClick={() => onChange({ ...block, rows: block.rows.map((r) => [...r, '']) })}>
          Add column
        </ActionButton>
        <ActionButton
          disabled={block.rows.length < 2}
          onClick={() => onChange({ ...block, rows: block.rows.slice(0, -1) })}
        >
          Drop last row
        </ActionButton>
        <ActionButton onClick={() => onChange({ ...block, header: !block.header })}>
          {block.header ? 'No header row' : 'First row is a header'}
        </ActionButton>
      </div>

      {state.sheets.length > 0 ? (
        <>
          <div
            style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-6)' }}
          >
            Or take it from a sheet you have already made — the values, not the formulas.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
            {state.sheets.slice(0, 6).map((sheet) => (
              <button
                key={sheet.id}
                type="button"
                className="bare tappable"
                onClick={() => {
                  const rows = filled(sheet);
                  if (rows.length) onChange({ ...block, rows });
                }}
                style={{
                  width: 'auto',
                  padding: 'var(--sp-4) var(--sp-6)',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--app-line)',
                  fontSize: 'var(--type-sm)',
                }}
              >
                {sheet.title || 'Untitled sheet'}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <input
        className="input"
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Caption — optional"
        aria-label="Table caption"
        style={{ width: '100%', height: 38, marginTop: 'var(--sp-5)' }}
      />
    </>
  );
}

function EquationEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { kind: 'equation' }>;
  onChange: (next: Block) => void;
}) {
  const { state, dispatch } = useStore();
  const kept = useMemo(() => state.equations.slice(0, 8), [state.equations]);

  return (
    <>
      <input
        className="input"
        value={block.latex}
        onChange={(e) => onChange({ ...block, latex: e.target.value })}
        placeholder="E_d = \frac{\Delta Q}{\Delta P}"
        aria-label="Equation"
        spellCheck={false}
        style={{
          width: '100%',
          height: 40,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      />
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <Equation latex={block.latex} showPlain />
      </div>

      {kept.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
          {kept.map((saved) => (
            <button
              key={saved.id}
              type="button"
              className="bare tappable"
              onClick={() => onChange({ ...block, latex: saved.latex })}
              style={{
                width: 'auto',
                padding: 'var(--sp-4) var(--sp-6)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--app-line)',
                fontSize: 'var(--type-sm)',
              }}
            >
              {saved.name}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-5)' }}>
          Equations has a library of the formulas these courses use, and anything you keep there
          turns up here.
        </div>
      )}

      <input
        className="input"
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Caption — optional"
        aria-label="Equation caption"
        style={{ width: '100%', height: 38, marginTop: 'var(--sp-5)' }}
      />

      <div style={{ marginTop: 'var(--sp-5)' }}>
        <ActionButton
          disabled={!block.latex.trim()}
          onClick={() =>
            dispatch({
              type: 'saveEquation',
              equation: {
                name: block.caption.trim() || block.latex.trim().slice(0, 40),
                latex: block.latex,
                note: '',
                courseId: null,
              },
            })
          }
        >
          Keep this equation
        </ActionButton>
      </div>
    </>
  );
}
