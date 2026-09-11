import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { DeadlinePicker } from '../components/DeadlinePicker';
import { forLine } from '../lib/forwork';
import { ActionButton, ChipRow, EmptyState, FilePick, SectionLabel } from '../components/ui';
import { Bench, Tool, ToolRule } from '../components/Bench';
import { ChevronRight, Plus, SheetIcon } from '../components/Icons';
import { Folding } from '../components/Fold';
import { secondLine } from '../lib/dim';
import { download } from '../lib/deliver';
import {
  BASE_SIZE,
  INKS,
  INK_NAMES,
  MAX_COLS,
  MAX_DECIMALS,
  MAX_ROWS,
  SIZES,
  colIndex,
  colName,
  display,
  evaluate,
  extent,
  filled,
  fromRows,
  inkOn,
  isError,
  isFormula,
  parseRef,
  places,
  readTable,
  ref,
  restyle,
  show,
  styleOf,
  styledDisplay,
  toCsv,
  toMarkdown,
  washOn,
  weighted,
  type Align,
  type CellStyle,
  type Ink,
  type NumFormat,
  type Sheet as SheetModel,
} from '../lib/sheet';
import {
  at as oneCell,
  box,
  cells as cellsIn,
  holds,
  label as rangeLabel,
  many,
  saySize,
  step,
  summarise,
  type Range,
} from '../lib/grid';
import {
  canRedo,
  canUndo,
  now as nowIn,
  push as remember,
  redo,
  start,
  undo,
  type History,
} from '../lib/history';
import {
  autoSum,
  bodyOf,
  clear as clearOut,
  clipText,
  copy as copyOut,
  deleteCols,
  deleteRows,
  fill,
  find as findIn,
  insertCols,
  insertRows,
  paste as pasteAt,
  readClip,
  replaceAll,
  sortRange,
  sortable,
  type Body,
  type Clip,
} from '../lib/sheetedit';
import { ZOOMS, stepZoom, type Tab as RibbonTab } from '../lib/ribbon';
import { FormulaBar, Ribbon, SheetTabs, StatusBar } from '../components/Ribbon';
import { TEMPLATES, fromTemplate } from '../lib/sheettemplates';
import { fromSheet, sheetFileName, widthsFor, xlsx } from '../lib/xlsx';
import { canBuild, gradeSheet } from '../lib/gradesheet';
import { fromDelimited, fromXlsx, readerFor } from '../lib/xlsxin';
import { LIMIT } from '../state/slices/made';
import type { Menu } from '../lib/menus';

/**
 * A sheet, or a table.
 *
 * One screen for both, because they are one object seen twice: a grid you type
 * into and add up is a sheet while you are working on it and a table the
 * moment it goes into a document. Two screens would have meant building the
 * same grid twice and then a way to move between them.
 *
 * What it is for is the arithmetic a term actually contains — a gradebook
 * weighted by the syllabus's own percentages, a problem set's working shown
 * rather than asserted, a budget for a group project — none of which the app
 * could do, so all of which happened somewhere else.
 *
 * ## The formulas are computed here
 *
 * `lib/sheet.ts` does the arithmetic, on this device, with no model anywhere
 * near it. An error is said in the cell — `#DIV/0!`, `#CYCLE!`, `#NAME?` —
 * rather than resolved to a zero that looks like an answer. See the note at
 * the top of that file: a spreadsheet is the format where an invented figure
 * travels furthest, because nobody re-checks the total.
 *
 * ## What a spreadsheet is, and what this was
 *
 * This was a grid of text boxes. Everything a person does in the first minute
 * of using one — run down a column with the arrow keys, drag across a block to
 * see what it comes to, put a `%` over a column, take back the thing you just
 * typed over — needed a *selection*, a *formula bar* and a *history*, and none
 * of the three existed. They do now, and they are the shape every spreadsheet
 * has for the same reasons:
 *
 * - the **name box and formula bar** above the grid, because the formula is
 *   the thing you are editing and a cell 92 pixels wide cannot show it;
 * - the **selection**, in `lib/grid.ts`, because "what does this column come
 *   to" should be answered by looking rather than by writing a `SUM` and then
 *   deleting it;
 * - the **toolbar**, because a picture over a number is not the number — see
 *   `CellStyle` in `lib/sheet.ts` for why the two are stored apart;
 * - the **tab strip** along the bottom, because the other sheets are one tap
 *   away in every spreadsheet ever written and were four taps away here.
 *
 * ## Three ways out
 *
 * A real .xlsx with the formulas and the formats still in it, a CSV, and a
 * Markdown table for a document or a note. The .xlsx is the one that was
 * missing and it matters: a CSV of a gradebook is the answers with the working
 * thrown away.
 */
export function Sheet() {
  const { state } = useStore();
  const open = state.sheets.find((s) => s.id === state.sheetId) ?? null;
  return open ? <Grid key={open.id} sheet={open} /> : <Shelf />;
}

// ── The shelf ────────────────────────────────────────────────────────────

type Order = 'opened' | 'edited' | 'name' | 'course';

const ORDERS = ['opened', 'edited', 'name', 'course'] as const satisfies readonly Order[];

const ORDER_LABELS: Record<Order, string> = {
  opened: 'Last opened',
  edited: 'Last edited',
  name: 'Name',
  course: 'Course',
};

/** When a sheet was last in front of somebody, whichever way that happened. */
function seenAt(sheet: SheetModel): number {
  return Math.max(sheet.opened ?? 0, sheet.updated);
}

/**
 * The heading a sheet sits under.
 *
 * Today, this week, then everything else — the grouping every file list uses,
 * and the reason it is worth having is that a date beside every row is a date
 * nobody reads, whereas "Today" and "Earlier" are read at a glance.
 */
function whenBand(at: number, now: number): string {
  const day = 86_400_000;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  if (at >= midnight.getTime()) return 'Today';
  if (at >= midnight.getTime() - day) return 'Yesterday';
  if (at >= midnight.getTime() - 6 * day) return 'Earlier this week';
  return 'Earlier';
}

function Shelf() {
  const { state, dispatch, courseCode, catalog, allItems } = useStore();
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  /*
   * The courses whose syllabus states weights this app can read. A course
   * whose grading is prose — "at the instructor's discretion" — is left out
   * rather than offered a calculator with blank weights in it, which would be
   * a sheet that looks like it knows something and does not.
   */
  const calculable = catalog.courses.filter(canBuild);
  /** What the last import had to leave behind, and anything that went wrong. */
  const [notes, setNotes] = useState<string[]>([]);
  const [trouble, setTrouble] = useState('');
  const [reading, setReading] = useState(false);
  const [order, setOrder] = useState<Order>('opened');

  /*
   * Reading picked files, one after another rather than all at once: a
   * workbook is parsed on this thread, and three at a time on a phone is a
   * frozen screen. A file that fails says why and does not stop the rest.
   */
  const readFiles = async (picked: File[]) => {
    setReading(true);
    setTrouble('');
    const said: string[] = [];
    const problems: string[] = [];
    // `state` does not change while this loop runs, so the room left has to be
    // counted here — otherwise three files of eighty sheets each all see the
    // same room and the third one evicts what the first two added.
    let taken = 0;
    for (const file of picked) {
      const kind = readerFor(file);
      if (!kind) {
        problems.push(`${file.name} is not a spreadsheet this app can open.`);
        continue;
      }
      try {
        const read = kind === 'xlsx' ? await fromXlsx(file) : await fromDelimited(file);
        /*
         * Room first.
         *
         * `makeSheet` prepends and then cuts the list to `LIMIT`, so importing
         * a twelve-tab workbook with 195 sheets already kept would push seven
         * of them off the end — and the next write to storage makes that
         * permanent. Nothing said so; the import looked like it worked.
         *
         * So the workbook is refused whole rather than half-imported: there is
         * no good way to choose which of somebody's existing sheets to lose,
         * and the answer to "you have too many" is theirs to make.
         */
        const room = LIMIT - state.sheets.length - taken;
        if (read.sheets.length > room) {
          problems.push(
            `${file.name} holds ${read.sheets.length} ${read.sheets.length === 1 ? 'sheet' : 'sheets'} ` +
              `and there is room for ${Math.max(0, room)}. Delete some sheets and try again — ` +
              'nothing was imported and nothing was lost.',
          );
          continue;
        }
        // Newest last, so a multi-sheet workbook lands in the order its tabs
        // were in rather than reversed.
        for (const sheet of read.sheets) dispatch({ type: 'makeSheet', sheet });
        taken += read.sheets.length;
        said.push(...read.notes);
      } catch (e) {
        problems.push(e instanceof Error ? e.message : `${file.name} could not be read.`);
      }
    }
    setNotes([...new Set(said)]);
    setTrouble(problems.join(' '));
    setReading(false);
  };

  /*
   * The clock, read once when the shelf opens rather than on every render.
   * The bands below are "Today" and "Earlier this week": they do not move
   * while somebody is looking at the list, and a clock read during render is
   * a value that changes for no reason anybody asked for.
   */
  const [now] = useState(() => Date.now());

  /**
   * The list, in the chosen order, cut into bands.
   *
   * The bands are only drawn for the two time orders: "Earlier this week" over
   * a list sorted by name is a heading that means nothing, and a heading that
   * means nothing is worse than no heading.
   */
  const bands = useMemo(() => {
    const sorted = [...state.sheets].sort((a, b) => {
      if (order === 'name') return (a.title || '').localeCompare(b.title || '');
      if (order === 'course') {
        return (a.courseId ?? 'zzz').localeCompare(b.courseId ?? 'zzz');
      }
      if (order === 'edited') return b.updated - a.updated;
      return seenAt(b) - seenAt(a);
    });
    if (order !== 'opened' && order !== 'edited') return [{ band: '', rows: sorted }];
    const out: { band: string; rows: SheetModel[] }[] = [];
    for (const sheet of sorted) {
      const band = whenBand(order === 'edited' ? sheet.updated : seenAt(sheet), now);
      const last = out[out.length - 1];
      if (last && last.band === band) last.rows.push(sheet);
      else out.push({ band, rows: [sheet] });
    }
    return out;
  }, [state.sheets, order, now]);

  return (
    <Page blurb="A grid you can type into and add up. Out as a real Excel file, a CSV, or a table for a document.">
      <SectionLabel>Start a new sheet</SectionLabel>
      <Gallery
        onBlank={() => dispatch({ type: 'newSheet', courseId: null })}
        onTemplate={(id) => {
          const template = TEMPLATES.find((t) => t.id === id);
          if (!template) return;
          dispatch({ type: 'makeSheet', sheet: fromTemplate(template, template.label), open: true });
        }}
      />

      <SectionLabel>Or bring one in</SectionLabel>
      {pasting ? (
        <Blueprint style={{ padding: 'var(--sp-6)' }}>
          <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-4)' }}>
            Paste a copy out of Excel or Google Sheets, a CSV, or a Markdown table. It works out
            which it is.
          </div>
          <textarea
            className="input"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            aria-label="Table to read in"
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
                const rows = readTable(pasted);
                if (!rows.length) return;
                dispatch({ type: 'makeSheet', sheet: fromRows('Pasted table', rows) });
                setPasting(false);
                setPasted('');
              }}
            >
              Read it in
            </ActionButton>
          </div>
        </Blueprint>
      ) : (
        <ActionButton onClick={() => setPasting(true)} style={{ marginBottom: 'var(--sp-4)' }}>
          Paste a table in
        </ActionButton>
      )}

      <FilePick
        accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={reading}
        onPick={(picked) => void readFiles(picked)}
        style={{ marginBottom: 'var(--sp-5)' }}
      >
        {reading ? 'Reading…' : 'Open an Excel file or CSV'}
      </FilePick>

      {trouble !== '' && (
        <Blueprint style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}>
          <div style={{ fontSize: 'var(--type-sm)' }}>{trouble}</div>
        </Blueprint>
      )}

      {notes.length > 0 && (
        <Blueprint style={{ padding: 'var(--sp-5)', marginBottom: 'var(--sp-7)' }}>
          <SectionLabel>What did not come across</SectionLabel>
          <ul
            style={{
              ...secondLine(),
              fontSize: 'var(--type-sm)',
              margin: 0,
              paddingLeft: 'var(--sp-6)',
            }}
          >
            {notes.map((note) => (
              <li key={note} style={{ marginTop: 'var(--sp-2)' }}>
                {note}
              </li>
            ))}
          </ul>
        </Blueprint>
      )}

      {calculable.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-7)' }}>
        <Folding name="What do I need?">
          <SectionLabel>From your syllabus</SectionLabel>
          <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-4)' }}>
            A sheet per course, weighted the way its syllabus weights it, with the scores left for
            you to fill in. Nothing in it is a grade your university has given you.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {calculable.map((course) => (
              <Blueprint
                key={course.id}
                as="button"
                plain
                onClick={() =>
                  dispatch({
                    type: 'makeSheet',
                    sheet: gradeSheet(course, state.grades[course.id] ?? '').sheet,
                    open: true,
                  })
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-5)',
                  padding: 'var(--sp-6)',
                  textAlign: 'left',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--type-md)' }}>{course.code}</div>
                  <div
                    style={{
                      ...secondLine(),
                      fontSize: 'var(--type-sm)',
                      marginTop: 'var(--sp-1)',
                    }}
                  >
                    {course.grading.length}{' '}
                    {course.grading.length === 1 ? 'component' : 'components'} from the syllabus
                  </div>
                </div>
                <ChevronRight size={16} />
              </Blueprint>
            ))}
          </div>
        </Folding>
        </div>
      )}

      {state.sheets.length === 0 ? (
        <EmptyState
          title="No sheets yet"
          body="A gradebook, a problem set's working, a budget. Everything is computed on this device."
          icon={<SheetIcon />}
        />
      ) : (
        <>
          <SectionLabel
            aside={`${state.sheets.length} ${state.sheets.length === 1 ? 'sheet' : 'sheets'}`}
          >
            Your sheets
          </SectionLabel>
          {/*
            The order, and not an owner filter beside it.

            A file list in a shared drive opens with "Owned by anyone" next to
            the sort, and there is nothing here for that control to mean: these
            sheets are on this device, they have one owner, and a filter with a
            single answer is chrome that teaches people to look for a second
            answer that does not exist.
          */}
          <ChipRow
            options={ORDERS}
            value={order}
            onChange={setOrder}
            labels={ORDER_LABELS}
            style={{ marginBottom: 'var(--sp-4)' }}
          />
          {bands.map(({ band, rows }) => (
            <div key={band || 'all'} style={{ marginBottom: 'var(--sp-5)' }}>
              {band !== '' && (
                <div
                  style={{
                    ...secondLine(),
                    fontSize: 'var(--type-xs)',
                    marginBottom: 'var(--sp-3)',
                  }}
                >
                  {band}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                {rows.map((sheet) => {
                  const size = extent(sheet);
                  return (
                    <Blueprint
                      key={sheet.id}
                      as="button"
                      plain
                      onClick={() => dispatch({ type: 'openSheet', id: sheet.id })}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--sp-5)',
                        padding: 'var(--sp-6)',
                        textAlign: 'left',
                      }}
                    >
                      <SheetIcon size={17} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--type-md)' }}>
                          {sheet.title || 'Untitled sheet'}
                        </div>
                        <div
                          style={{
                            ...secondLine(),
                            fontSize: 'var(--type-sm)',
                            marginTop: 'var(--sp-1)',
                          }}
                        >
                          {[
                            sheet.courseId ? courseCode(sheet.courseId) : 'Personal',
                            forLine(allItems, sheet.itemId),
                            size.rows === 0 ? 'empty' : `${size.rows} × ${size.cols}`,
                            new Date(order === 'edited' ? sheet.updated : seenAt(sheet)).toLocaleDateString(
                              undefined,
                              { month: 'short', day: 'numeric' },
                            ),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <ChevronRight size={16} />
                    </Blueprint>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </Page>
  );
}

/**
 * The row of things to start from.
 *
 * A blank sheet first, then the templates — the order every spreadsheet's
 * gallery uses, because "blank" is what most people want and burying it under
 * five cards they have to read first is a worse start than no gallery at all.
 * It scrolls sideways on a phone rather than wrapping into a wall of cards.
 */
function Gallery({
  onBlank,
  onTemplate,
}: {
  onBlank: () => void;
  onTemplate: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-4)',
        overflowX: 'auto',
        paddingBottom: 'var(--sp-3)',
        marginBottom: 'var(--sp-5)',
      }}
    >
      <Blueprint
        as="button"
        onClick={onBlank}
        style={{
          flex: 'none',
          width: 116,
          padding: 'var(--sp-5)',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-3)',
        }}
      >
        <Plus size={18} />
        <div style={{ fontSize: 'var(--type-sm)' }}>Blank sheet</div>
        <div style={{ ...secondLine(), fontSize: 'var(--type-xs)' }}>Nothing in it yet</div>
      </Blueprint>
      {TEMPLATES.map((template) => (
        <Blueprint
          key={template.id}
          as="button"
          plain
          onClick={() => onTemplate(template.id)}
          style={{
            flex: 'none',
            width: 116,
            padding: 'var(--sp-5)',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-3)',
          }}
        >
          <Thumb rows={template.rows} />
          <div style={{ fontSize: 'var(--type-sm)' }}>{template.label}</div>
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)' }}>{template.says}</div>
        </Blueprint>
      ))}
    </div>
  );
}

/**
 * A template, drawn the size of a postage stamp.
 *
 * Enough to see the shape of it — a heading row, some columns, a total at the
 * bottom — without reading a word, which is what the picture on a template
 * card is for. Ten rows at most; a card is not a preview.
 */
function Thumb({ rows }: { rows: string[][] }) {
  const wide = Math.min(5, rows.reduce((n, row) => Math.max(n, row.length), 0));
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.max(1, wide)}, 1fr)`,
        gap: 'var(--sp-1)',
        width: '100%',
        height: 34,
        border: '1px solid var(--app-line)',
        padding: 'var(--sp-1)',
      }}
    >
      {rows.slice(0, 5).flatMap((row, r) =>
        Array.from({ length: wide }, (_, c) => (
          <div
            key={`${r}-${c}`}
            style={{
              background:
                r === 0
                  ? 'var(--app-accent-wash)'
                  : (row[c] ?? '') !== ''
                    ? 'var(--app-track)'
                    : 'transparent',
            }}
          />
        )),
      )}
    </div>
  );
}

// ── The grid ─────────────────────────────────────────────────────────────

/**
 * What the editor remembers, for undo.
 *
 * The grid and its formatting, which is what typing and the toolbar change.
 * Not the title or the course: those are two labelled fields in plain sight
 * above the grid, and an undo that silently reverted the title while somebody
 * was taking back a cell would be worse than no undo on them at all.
 */
interface Snap {
  cells: Record<string, string>;
  styles: Record<string, CellStyle>;
  rows: number;
  cols: number;
}

/**
 * The pictures, in the order a spreadsheet puts them.
 *
 * Three names each, and they are not redundant: `label` is the glyph for a
 * button, `short` is what fits in a dropdown, and `says` is the sentence a
 * menu and a screen reader need. Writing one and abbreviating it at the call
 * site is how "A date, from a day count" ends up as "A date, from a d…" in a
 * select box a third of the ribbon wide.
 */
const FORMATS: { id: NumFormat; label: string; short: string; says: string }[] = [
  { id: 'plain', label: '123', short: 'Plain', says: 'Show what is there' },
  { id: 'number', label: '1,000', short: 'Number', says: 'A number, grouped' },
  { id: 'percent', label: '%', short: 'Percent', says: 'A percentage' },
  { id: 'money', label: '$', short: 'Money', says: 'Money' },
  { id: 'date', label: 'Date', short: 'Date', says: 'A date, from a day count' },
];

const ALIGNS: { id: Align; label: string; glyph: string }[] = [
  { id: 'left', label: 'Left', glyph: '⇤' },
  { id: 'center', label: 'Middle', glyph: '↔' },
  { id: 'right', label: 'Right', glyph: '⇥' },
];

/**
 * What the borders dropdown offers.
 *
 * Three, not Excel's thirteen. `All` rules every cell, which is the one that
 * makes a block read as a table; `Outline` rules only the outside, which is
 * what an underlined total or a boxed answer wants; `None` takes them off.
 * The other ten in Excel are combinations nobody picks from a list — they
 * pick one of these and adjust.
 */
const EDGES = [
  { id: '', label: 'No borders' },
  { id: 'all', label: 'All borders' },
  { id: 'box', label: 'Outline' },
] as const;

function Grid({ sheet }: { sheet: SheetModel }) {
  const { state, dispatch, say } = useStore();
  const [sel, setSel] = useState<Range>(() => oneCell('A1'));
  /** Which cell has the text cursor in it, so it shows its formula not its answer. */
  const [typing, setTyping] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allDeadlines, setAllDeadlines] = useState(false);
  /** Which ribbon tab is open. Held here so it survives every re-render. */
  const [ribbon, setRibbon] = useState('home');
  const [zoom, setZoom] = useState(100);
  /**
   * What was last cut or copied, kept in the app rather than only on the
   * system clipboard.
   *
   * The system clipboard carries tab-separated text and nothing else, so a
   * block copied through it arrives with its formulas turned into whatever
   * they computed to. Keeping the block here as well is what lets a copied
   * `=SUM(B2:B9)` land two columns over as `=SUM(D2:D9)`. Both are written:
   * this for pasting back into the app, the text for pasting into Excel.
   */
  const [clip, setClip] = useState<Clip | null>(null);
  /** What the View tab is showing, and what it is hiding. */
  const [view, setView] = useState({ lines: true, heads: true, formulas: false, freeze: true });
  const [seeking, setSeeking] = useState(false);
  const [needle, setNeedle] = useState('');
  const [instead, setInstead] = useState('');
  const boxes = useRef<Record<string, HTMLInputElement | null>>({});

  /*
   * The editor's own undo, which is not the app's.
   *
   * `lib/undo.ts` offers one step in a toast for eight seconds, which is the
   * right shape for deleting a note and the wrong one for typing into a grid.
   * See `lib/history.ts`.
   */
  const [history, setHistory] = useState<History<Snap>>(() =>
    start({ cells: sheet.cells, styles: sheet.styles ?? {}, rows: sheet.rows, cols: sheet.cols }),
  );

  const patch = useCallback(
    (next: Partial<Omit<SheetModel, 'id'>>) =>
      dispatch({ type: 'updateSheet', id: sheet.id, patch: next }),
    [dispatch, sheet.id],
  );

  /**
   * A change, recorded and applied.
   *
   * The `tag` is what decides whether this joins the last step or starts a new
   * one — typing in B4 is one step, and moving to C4 starts another. See
   * `push` in `lib/history.ts`.
   */
  const change = (next: Partial<Snap>, tag: string) => {
    const after: Snap = {
      cells: next.cells ?? sheet.cells,
      styles: next.styles ?? sheet.styles ?? {},
      rows: next.rows ?? sheet.rows,
      cols: next.cols ?? sheet.cols,
    };
    setHistory((h) => remember(h, after, tag, Date.now()));
    patch(after);
  };

  /** The grid as `lib/sheetedit.ts` takes it, and the way a result comes back. */
  const body = (): Body => bodyOf(sheet);

  const write = (address: string, value: string) => {
    const cells = { ...sheet.cells };
    // Deleting rather than storing an empty string, so a sheet with four
    // values in it stays four entries however far the grid has been dragged.
    if (value === '') delete cells[address];
    else cells[address] = value;
    change({ cells }, `type:${address}`);
  };

  /** Put every cell in the selection through the same change of style. */
  const restyleSelection = (fn: (was: CellStyle) => CellStyle, tag: string) => {
    change({ styles: restyle(sheet, cellsIn(sel), fn) }, tag);
  };

  const rewind = (to: History<Snap>) => {
    setHistory(to);
    patch(nowIn(to));
  };

  const rows = filled(sheet);
  const size = extent(sheet);
  const nothing = rows.length === 0;

  const saveExcel = async () => {
    setBusy(true);
    try {
      const tab = fromSheet(sheet);
      const blob = await xlsx({ tabs: [{ ...tab, widths: widthsFor(rows) }] });
      download({
        name: sheetFileName(sheet.title),
        body: blob,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      say('Excel file saved.');
    } finally {
      setBusy(false);
    }
  };

  /** Where the cursor is: one end of the selection, and what the formula bar edits. */
  const focus = sel.focus;
  const raw = sheet.cells[focus] ?? '';
  const answer = display(sheet.cells, focus);
  const wrong = isError(evaluate(sheet.cells, focus));
  const style = styleOf(sheet, focus) ?? {};
  const selected = useMemo(() => cellsIn(sel), [sel]);
  const totals = useMemo(() => summarise(sheet.cells, selected), [sheet.cells, selected]);
  const spot = box(sel);

  /** Move the cursor, and take the browser's focus with it. */
  const go = (address: string, extend = false) => {
    setSel((was) => (extend ? { ...was, focus: address } : oneCell(address)));
    if (!extend) {
      setTyping(null);
      // After the state has settled, or the input being focused is the one
      // about to be re-rendered with a different value.
      queueMicrotask(() => boxes.current[address]?.focus());
    }
  };

  // ── What the ribbon's buttons do ───────────────────────────────────────

  const cutOrCopy = (andClear: boolean) => {
    const taken = copyOut(body(), sel);
    setClip(taken);
    void navigator.clipboard?.writeText(clipText(taken));
    if (andClear) change(clearOut(body(), sel), `cut:${rangeLabel(sel)}`);
    say(andClear ? `${rangeLabel(sel)} cut.` : `${rangeLabel(sel)} copied.`);
  };

  /**
   * Paste, from the app's own clipboard where there is one and from the
   * system's where there is not.
   *
   * In that order on purpose: a block copied in this app carries its formulas
   * and the text version of the same block does not, so preferring the text
   * would throw the working away on every internal copy.
   */
  const pasteIn = async () => {
    let taken = clip;
    if (!taken) {
      const text = await navigator.clipboard?.readText?.().catch(() => '');
      taken = text ? readClip(text) : null;
    }
    if (!taken) {
      say('There is nothing to paste.');
      return;
    }
    change(pasteAt(body(), focus, taken), `paste:${focus}`);
    say(`Pasted into ${focus}.`);
  };

  const sum = (fn: string) => {
    const put = autoSum(body(), sel, fn);
    if (!put) {
      say('There is nothing above or to the left of this cell to add up.');
      return;
    }
    /*
     * The grid grows by a row where the total needs one.
     *
     * A whole column selected has no row under it, and the two alternatives
     * were both wrong: putting the `SUM` in the last cell of the block makes
     * it part of its own range — `#CYCLE!` — and refusing does nothing and
     * looks broken. Growing is what Excel does and what pressing Σ means.
     */
    const where = parseRef(put.at);
    change(
      {
        cells: { ...sheet.cells, [put.at]: put.formula },
        rows: Math.max(sheet.rows, (where?.row ?? 0) + 1),
      },
      `sum:${put.at}`,
    );
    go(put.at);
  };

  const sortBy = (direction: 'asc' | 'desc') => {
    if (!sortable(body(), sel)) {
      say('This block has a formula in it, so sorting it would break the formula. Sort the values instead.');
      return;
    }
    change(sortRange(body(), sel, spot.left, direction), `sort:${rangeLabel(sel)}`);
    say(`Sorted by column ${colName(spot.left)}.`);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, address: string) => {
    const input = e.currentTarget;
    const ends = input.selectionStart === input.selectionEnd;
    const atStart = ends && input.selectionStart === 0;
    const atEnd = ends && input.selectionStart === input.value.length;
    const meta = e.metaKey || e.ctrlKey;

    if (meta) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        rewind(e.shiftKey ? redo(history) : undo(history));
        return;
      }
      /*
       * Fill down and fill right, on the two keys every spreadsheet binds them
       * to. These are the one place `lib/keys.ts`'s rule about not taking a
       * Meta chord is worth the exception it makes elsewhere in this file:
       * neither ⌘D nor ⌘R means anything in a text box, and both mean exactly
       * this in Excel, Sheets and Numbers.
       */
      if ((key === 'd' || key === 'r') && many(sel)) {
        e.preventDefault();
        change(fill(body(), sel, key === 'd' ? 'down' : 'right'), `fill:${rangeLabel(sel)}`);
        return;
      }
      if (key === 'c' || key === 'x') {
        if (!many(sel)) return; // one cell is the text box's own copy
        e.preventDefault();
        cutOrCopy(key === 'x');
        return;
      }
    }
    /*
     * Up and down always move; left and right move only from the end they
     * point at.
     *
     * The rule every grid of real text inputs has to pick, and this is the one
     * that keeps both halves working: a caret inside `=SUM(B2:B9)` can still
     * be walked through a character at a time, and an arrow pressed at the end
     * of a cell goes to the next cell, which is what the hand doing data entry
     * expects.
     */
    const moves: Record<string, [number, number] | undefined> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: atStart ? [0, -1] : undefined,
      ArrowRight: atEnd ? [0, 1] : undefined,
      Enter: [1, 0],
      Tab: [0, e.shiftKey ? -1 : 1],
    };
    const move = moves[e.key];
    if (move) {
      // Shift-arrow grows the selection; shift-Tab and shift-Enter are moves,
      // which is what every spreadsheet does with them.
      const extend = e.shiftKey && e.key.startsWith('Arrow');
      e.preventDefault();
      go(step(extend ? sel.focus : address, move[0], move[1], sheet.rows, sheet.cols), extend);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setTyping(null);
      input.blur();
      return;
    }
    // Delete over a block clears it. Over one cell the key does what a key in
    // a text box does, or there would be no way to backspace a typo.
    if ((e.key === 'Delete' || e.key === 'Backspace') && many(sel) && input.value === '') {
      e.preventDefault();
      change(clearOut(body(), sel), 'clear');
    }
  };

  /*
   * The menu bar, which the ribbon below is not and does not replace.
   *
   * The ribbon is what you press while the cursor is in a cell; the menus are
   * everything the screen can do to the *file* — new, copy, download, print,
   * delete — plus, on Edit and Format, a named way to reach what the ribbon
   * draws as a glyph. That is not a duplication anybody has ever objected to:
   * Excel and Sheets both put the format buttons on the bar and the same
   * formats on a menu, because a button is for the hand that knows where it
   * is and a menu is for everybody else. See `lib/menus.ts`.
   */
  const menus: Menu[] = [
    {
      id: 'file',
      label: 'File',
      groups: [
        [
          {
            id: 'file.new',
            label: 'New spreadsheet',
            run: () => dispatch({ type: 'newSheet', courseId: sheet.courseId }),
          },
          {
            id: 'file.copy',
            label: 'Make a copy',
            run: () => {
              const { id: _id, ...rest } = sheet;
              dispatch({
                type: 'makeSheet',
                sheet: { ...rest, title: `${sheet.title || 'Untitled spreadsheet'} (copy)` },
                open: true,
              });
              say('Copied. You are now in the copy.');
            },
          },
        ],
        [
          {
            id: 'file.xlsx',
            label: busy ? 'Writing the Excel file…' : 'Download as Excel (.xlsx)',
            hint: 'The formulas and the formatting go with it, not just the answers.',
            run: nothing || busy ? undefined : () => void saveExcel(),
          },
          {
            id: 'file.csv',
            label: 'Download as CSV',
            run: nothing
              ? undefined
              : () => {
                  download({
                    name: sheetFileName(sheet.title).replace(/\.xlsx$/, '.csv'),
                    body: toCsv(rows),
                    mime: 'text/csv',
                  });
                  say('CSV saved.');
                },
          },
          { id: 'file.print', label: 'Print, or save as PDF', run: () => window.print() },
        ],
        [
          {
            id: 'file.delete',
            label: 'Move to the bin',
            hint: 'Undo is offered for a few seconds afterwards.',
            run: () => dispatch({ type: 'deleteSheet', id: sheet.id }),
          },
        ],
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      groups: [
        [
          {
            id: 'edit.undo',
            label: 'Undo',
            run: canUndo(history) ? () => rewind(undo(history)) : undefined,
          },
          {
            id: 'edit.redo',
            label: 'Redo',
            run: canRedo(history) ? () => rewind(redo(history)) : undefined,
          },
        ],
        [
          {
            id: 'edit.cut',
            label: `Cut ${rangeLabel(sel)}`,
            run: selected.some((cell) => sheet.cells[cell]) ? () => cutOrCopy(true) : undefined,
          },
          {
            id: 'edit.copy',
            label: `Copy ${rangeLabel(sel)}`,
            run: selected.some((cell) => sheet.cells[cell]) ? () => cutOrCopy(false) : undefined,
          },
          {
            id: 'edit.paste',
            label: `Paste into ${focus}`,
            run: () => void pasteIn(),
          },
          {
            id: 'edit.clear',
            label: `Clear ${rangeLabel(sel)}`,
            run: selected.some((cell) => sheet.cells[cell])
              ? () => change(clearOut(body(), sel), 'clear')
              : undefined,
          },
        ],
        [
          {
            id: 'edit.markdown',
            label: 'Copy as a Markdown table',
            run: nothing
              ? undefined
              : () => {
                  void navigator.clipboard?.writeText(toMarkdown(rows));
                  say('Table copied as Markdown.');
                },
          },
          {
            id: 'edit.document',
            label: 'Put this table in a new document',
            run: nothing
              ? undefined
              : () => {
                  dispatch({
                    type: 'makeDocument',
                    doc: {
                      title: sheet.title || 'Table',
                      subtitle: '',
                      courseId: sheet.courseId,
                      blocks: [{ kind: 'table', rows, header: rows.length > 1, caption: '' }],
                    },
                  });
                  say('A document has been made with this table in it.');
                },
          },
        ],
      ],
    },
    {
      id: 'view',
      label: 'View',
      groups: [
        [
          {
            id: 'view.lines',
            label: 'Gridlines',
            on: view.lines,
            run: () => setView((was) => ({ ...was, lines: !was.lines })),
          },
          {
            id: 'view.heads',
            label: 'Row and column headings',
            on: view.heads,
            run: () => setView((was) => ({ ...was, heads: !was.heads })),
          },
          {
            id: 'view.freeze',
            label: 'Freeze the top row',
            on: view.freeze,
            run: () => setView((was) => ({ ...was, freeze: !was.freeze })),
          },
          {
            id: 'view.formulas',
            label: 'Show formulas rather than answers',
            hint: 'What is typed in every cell, which is how a sheet is checked.',
            on: view.formulas,
            run: () => setView((was) => ({ ...was, formulas: !was.formulas })),
          },
        ],
      ],
    },
    {
      id: 'insert',
      label: 'Insert',
      groups: [
        [
          {
            id: 'insert.rowabove',
            label: `Row above ${rangeLabel(sel)}`,
            hint: 'The formulas below it move with it.',
            run:
              sheet.rows >= MAX_ROWS
                ? undefined
                : () => change(insertRows(body(), spot.top), 'insert:row'),
          },
          {
            id: 'insert.colleft',
            label: `Column left of ${colName(spot.left)}`,
            run:
              sheet.cols >= MAX_COLS
                ? undefined
                : () => change(insertCols(body(), spot.left), 'insert:col'),
          },
          {
            id: 'insert.delrow',
            label: `Delete row ${spot.top + 1}`,
            run:
              sheet.rows <= 1
                ? undefined
                : () =>
                    change(
                      deleteRows(body(), spot.top, spot.bottom - spot.top + 1),
                      'delete:row',
                    ),
          },
          {
            id: 'insert.delcol',
            label: `Delete column ${colName(spot.left)}`,
            run:
              sheet.cols <= 1
                ? undefined
                : () =>
                    change(
                      deleteCols(body(), spot.left, spot.right - spot.left + 1),
                      'delete:col',
                    ),
          },
        ],
        [
          ...(
            [
              ['total', 'Total', 'SUM'],
              ['average', 'Average', 'AVERAGE'],
              ['stdev', 'Std deviation', 'STDEV'],
              ['count', 'Count', 'COUNT'],
            ] as const
          ).map(([id, label, fn]) => ({
            id: `insert.${id}`,
            label,
            hint: many(sel)
              ? `Over ${rangeLabel(sel)}, in the cell under it.`
              : `In ${focus}, over the run of cells above it.`,
            run: () => sum(fn),
          })),
          {
            id: 'insert.weighted',
            label: 'Weighted mark',
            hint: 'Scores in the column above, weights in the one to its right.',
            run: weightedHere() ? () => write(focus, weightedHere() as string) : undefined,
          },
        ],
      ],
    },
    {
      id: 'format',
      label: 'Format',
      groups: [
        FORMATS.map((f) => ({
          id: `format.${f.id}`,
          label: f.says,
          on: (style.num ?? 'plain') === f.id,
          run: () => restyleSelection((was) => ({ ...was, num: f.id }), `format:${rangeLabel(sel)}`),
        })),
        (['bold', 'italic', 'under'] as const).map((key) => ({
          id: `format.${key}`,
          label: key === 'bold' ? 'Bold' : key === 'italic' ? 'Italic' : 'Underline',
          on: Boolean(style[key]),
          run: () =>
            restyleSelection((was) => ({ ...was, [key]: !was[key] }), `${key}:${rangeLabel(sel)}`),
        })),
        ALIGNS.map((a) => ({
          id: `format.align.${a.id}`,
          label: `Align ${a.label.toLowerCase()}`,
          on: style.align === a.id,
          run: () =>
            restyleSelection(
              (was) => ({ ...was, align: was.align === a.id ? undefined : a.id }),
              `align:${rangeLabel(sel)}`,
            ),
        })),
      ],
    },
    {
      id: 'data',
      label: 'Data',
      groups: [
        [
          {
            id: 'data.asc',
            label: `Sort ${rangeLabel(sel)} A → Z`,
            run: many(sel) ? () => sortBy('asc') : undefined,
          },
          {
            id: 'data.desc',
            label: `Sort ${rangeLabel(sel)} Z → A`,
            run: many(sel) ? () => sortBy('desc') : undefined,
          },
        ],
        [
          {
            id: 'data.filldown',
            label: 'Fill down',
            hint: 'The top row of the selection, copied down it, formulas moved.',
            run: many(sel) ? () => change(fill(body(), sel, 'down'), 'fill:down') : undefined,
          },
          {
            id: 'data.fillright',
            label: 'Fill right',
            run: many(sel) ? () => change(fill(body(), sel, 'right'), 'fill:right') : undefined,
          },
        ],
        [
          {
            /*
             * Find and replace lives here rather than on Edit, with sort and
             * fill, because all three are things done to a body of data
             * rather than to the cell under the cursor — and because it
             * searches what was *typed*, which is the same promise the other
             * two keep about formulas.
             */
            id: 'data.find',
            label: 'Find and replace',
            hint: 'Searches the formulas, not the answers they produced.',
            run: () => setSeeking(true),
          },
        ],
      ],
    },
    {
      id: 'help',
      label: 'Help',
      groups: [
        [
          {
            id: 'help.formulas',
            label: 'What the formulas can do',
            run: () =>
              say(
                'A cell starting with = is a formula. SUM, AVERAGE, MEDIAN, STDEV, MIN, MAX, COUNT, IF, ROUND, SQRT, VLOOKUP and SUMPRODUCT are all here, and so are the scientific ones — SIN, COS, TAN, LOG to any base, FACT, COMBIN — and the fitted line: SLOPE, INTERCEPT, RSQ and FORECAST over two columns. All computed on this device.',
              ),
          },
          {
            id: 'help.errors',
            label: 'Why a cell says #NAME?',
            run: () =>
              say(
                'An error is said in the cell rather than resolved to a zero that looks like an answer. #DIV/0!, #CYCLE!, #NAME? and #REF! each name what is wrong.',
              ),
          },
          {
            id: 'help.format',
            label: 'What formatting does to a number',
            run: () =>
              say(
                'Nothing. A format is a picture over the cell, kept apart from what is in it, so a formula always reads the value you typed.',
              ),
          },
          {
            id: 'help.dollar',
            label: 'What a $ in a reference does',
            run: () =>
              say(
                'It holds that part still when the formula is filled or pasted. =B2*$F$1 dragged down column C becomes =B3*$F$1, so the rate in F1 keeps being the rate.',
              ),
          },
        ],
      ],
    },
  ];

  /** The weighted-average formula for where the cursor is, or nothing. */
  function weightedHere(): string | null {
    const scores = columnAbove(focus);
    const weights = columnAbove(focus, 1);
    return scores && weights ? weighted(scores, weights) : null;
  }

  // ── The ribbon ─────────────────────────────────────────────────────────

  const anySelected = selected.some((cell) => sheet.cells[cell]);
  const inks = INKS.map((ink) => ({ id: ink, label: INK_NAMES[ink] }));

  const tabs: RibbonTab[] = [
    {
      id: 'home',
      label: 'Home',
      groups: [
        {
          id: 'g.clip',
          label: 'Clipboard',
          controls: [
            {
              kind: 'button',
              id: 'c.paste',
              label: 'Paste',
              glyph: '⎘',
              run: () => void pasteIn(),
            },
            {
              kind: 'button',
              id: 'c.cut',
              label: 'Cut',
              glyph: '✂',
              run: anySelected ? () => cutOrCopy(true) : undefined,
            },
            {
              kind: 'button',
              id: 'c.copy',
              label: 'Copy',
              glyph: '⧉',
              run: anySelected ? () => cutOrCopy(false) : undefined,
            },
          ],
        },
        {
          id: 'g.font',
          label: 'Font',
          controls: [
            {
              kind: 'pick',
              id: 'f.size',
              label: 'Type size',
              value: String(style.size ?? BASE_SIZE),
              options: SIZES.map((n) => ({ id: String(n), label: String(n) })),
              onPick: (id) =>
                restyleSelection(
                  (was) => ({ ...was, size: Number(id) }),
                  `size:${rangeLabel(sel)}`,
                ),
            },
            ...(
              [
                ['bold', 'Bold', 'B'],
                ['italic', 'Italic', 'I'],
                ['under', 'Underline', 'U'],
                ['strike', 'Strikethrough', 'S'],
              ] as const
            ).map(([key, label, glyph]) => ({
              kind: 'button' as const,
              id: `f.${key}`,
              label,
              glyph,
              on: Boolean(style[key]),
              run: () =>
                restyleSelection(
                  (was) => ({ ...was, [key]: !was[key] }),
                  `${key}:${rangeLabel(sel)}`,
                ),
            })),
            {
              kind: 'swatches',
              id: 'f.ink',
              label: 'Type colour',
              glyph: 'A',
              value: style.ink,
              options: inks,
              onPick: (id) =>
                restyleSelection(
                  (was) => ({ ...was, ink: (id as Ink | null) ?? undefined }),
                  `ink:${rangeLabel(sel)}`,
                ),
            },
            {
              kind: 'swatches',
              id: 'f.wash',
              label: 'Fill colour',
              glyph: '▦',
              value: style.wash,
              options: inks,
              onPick: (id) =>
                restyleSelection(
                  (was) => ({ ...was, wash: (id as Ink | null) ?? undefined }),
                  `wash:${rangeLabel(sel)}`,
                ),
            },
            {
              kind: 'pick',
              id: 'f.edge',
              label: 'Borders',
              value: style.edge ?? '',
              options: EDGES,
              onPick: (id) => rule(id),
            },
          ],
        },
        {
          id: 'g.align',
          label: 'Alignment',
          controls: ALIGNS.map((a) => ({
            kind: 'button' as const,
            id: `a.${a.id}`,
            label: `Align ${a.label.toLowerCase()}`,
            glyph: a.glyph,
            on: style.align === a.id,
            run: () =>
              restyleSelection(
                (was) => ({ ...was, align: was.align === a.id ? undefined : a.id }),
                `align:${rangeLabel(sel)}`,
              ),
          })),
        },
        {
          id: 'g.number',
          label: 'Number',
          controls: [
            {
              kind: 'pick',
              id: 'n.format',
              label: 'Number format',
              value: style.num ?? 'plain',
              options: FORMATS.map((f) => ({ id: f.id, label: f.short })),
              onPick: (id) =>
                restyleSelection(
                  (was) => ({ ...was, num: id as NumFormat }),
                  `format:${rangeLabel(sel)}`,
                ),
            },
            {
              kind: 'button',
              id: 'n.less',
              label: 'Fewer decimal places',
              glyph: '.0',
              run: () => decimals(-1),
            },
            {
              kind: 'button',
              id: 'n.more',
              label: 'More decimal places',
              glyph: '.00',
              run: () => decimals(1),
            },
          ],
        },
        {
          id: 'g.cells',
          label: 'Cells',
          controls: [
            {
              kind: 'button',
              id: 'x.rowin',
              label: 'Insert a row above the selection',
              glyph: '+↔',
              run:
                sheet.rows >= MAX_ROWS
                  ? undefined
                  : () => change(insertRows(body(), spot.top), 'insert:row'),
            },
            {
              kind: 'button',
              id: 'x.colin',
              label: 'Insert a column to the left of the selection',
              glyph: '+↕',
              run:
                sheet.cols >= MAX_COLS
                  ? undefined
                  : () => change(insertCols(body(), spot.left), 'insert:col'),
            },
            {
              kind: 'button',
              id: 'x.rowout',
              label: 'Delete the selected rows',
              glyph: '−↔',
              run:
                sheet.rows <= 1
                  ? undefined
                  : () =>
                      change(deleteRows(body(), spot.top, spot.bottom - spot.top + 1), 'delete:row'),
            },
            {
              kind: 'button',
              id: 'x.colout',
              label: 'Delete the selected columns',
              glyph: '−↕',
              run:
                sheet.cols <= 1
                  ? undefined
                  : () =>
                      change(deleteCols(body(), spot.left, spot.right - spot.left + 1), 'delete:col'),
            },
          ],
        },
        {
          id: 'g.editing',
          label: 'Editing',
          controls: [
            { kind: 'button', id: 'e.sum', label: 'AutoSum', glyph: 'Σ', run: () => sum('SUM') },
            {
              kind: 'button',
              id: 'e.filldown',
              label: 'Fill down',
              glyph: '↓',
              run: many(sel) ? () => change(fill(body(), sel, 'down'), 'fill:down') : undefined,
            },
            {
              kind: 'button',
              id: 'e.fillright',
              label: 'Fill right',
              glyph: '→',
              run: many(sel) ? () => change(fill(body(), sel, 'right'), 'fill:right') : undefined,
            },
            {
              kind: 'button',
              id: 'e.clear',
              label: 'Clear what is selected',
              glyph: '⌫',
              run: anySelected ? () => change(clearOut(body(), sel), 'clear') : undefined,
            },
            {
              kind: 'button',
              id: 'e.find',
              label: 'Find and replace',
              glyph: '⌕',
              run: () => setSeeking((was) => !was),
            },
          ],
        },
      ],
    },
    {
      id: 'insert',
      label: 'Insert',
      groups: [
        {
          id: 'g.calc',
          label: 'Working',
          controls: [
            {
              kind: 'button',
              id: 'i.total',
              label: 'Total',
              wide: true,
              run: () => sum('SUM'),
            },
            {
              kind: 'button',
              id: 'i.average',
              label: 'Average',
              wide: true,
              run: () => sum('AVERAGE'),
            },
            {
              kind: 'button',
              id: 'i.count',
              label: 'Count',
              wide: true,
              run: () => sum('COUNT'),
            },
            {
              kind: 'button',
              id: 'i.stdev',
              label: 'Std deviation',
              wide: true,
              run: () => sum('STDEV'),
            },
            {
              kind: 'button',
              id: 'i.weighted',
              label: 'Weighted mark',
              wide: true,
              run: weightedHere() ? () => write(focus, weightedHere() as string) : undefined,
            },
          ],
        },
        {
          id: 'g.size',
          label: 'The grid',
          controls: [
            {
              kind: 'button',
              id: 'i.rows',
              label: 'Five more rows',
              wide: true,
              run:
                sheet.rows >= MAX_ROWS
                  ? undefined
                  : () => change({ rows: Math.min(MAX_ROWS, sheet.rows + 5) }, 'grow'),
            },
            {
              kind: 'button',
              id: 'i.cols',
              label: 'Another column',
              wide: true,
              run:
                sheet.cols >= MAX_COLS
                  ? undefined
                  : () => change({ cols: Math.min(MAX_COLS, sheet.cols + 1) }, 'grow'),
            },
          ],
        },
        {
          id: 'g.out',
          label: 'Elsewhere',
          controls: [
            {
              kind: 'button',
              id: 'i.doc',
              label: 'Table in a document',
              wide: true,
              run: nothing
                ? undefined
                : () => {
                    dispatch({
                      type: 'makeDocument',
                      doc: {
                        title: sheet.title || 'Table',
                        subtitle: '',
                        courseId: sheet.courseId,
                        blocks: [{ kind: 'table', rows, header: rows.length > 1, caption: '' }],
                      },
                    });
                    say('A document has been made with this table in it.');
                  },
            },
            {
              kind: 'button',
              id: 'i.md',
              label: 'Copy as Markdown',
              wide: true,
              run: nothing
                ? undefined
                : () => {
                    void navigator.clipboard?.writeText(toMarkdown(rows));
                    say('Table copied as Markdown.');
                  },
            },
          ],
        },
      ],
    },
    {
      id: 'formulas',
      label: 'Formulas',
      groups: [
        {
          id: 'g.lib',
          label: 'Function library',
          controls: (['SUM', 'AVERAGE', 'MEDIAN', 'STDEV', 'MIN', 'MAX', 'COUNT'] as const).map((fn) => ({
            kind: 'button' as const,
            id: `fn.${fn}`,
            label: fn,
            wide: true,
            run: () => sum(fn),
          })),
        },
        {
          id: 'g.write',
          label: 'Write one',
          // The fitted line and the quartiles sit here rather than in the
          // library above, because neither takes a single range: `SLOPE` wants
          // the y column and the x column, and `QUARTILE` a range and which
          // quarter. The spelling is what this list is for.
          controls: (
            [
              'IF', 'ROUND', 'VLOOKUP', 'SUMPRODUCT', 'SUMIF',
              'QUARTILE', 'PERCENTILE', 'SLOPE', 'INTERCEPT', 'RSQ', 'FORECAST', 'LOG',
            ] as const
          ).map((fn) => ({
            kind: 'button' as const,
            id: `fw.${fn}`,
            label: fn,
            wide: true,
            /*
             * The name and its brackets, with the cursor left in them.
             *
             * Not a wizard and not a guess at the arguments: what somebody
             * needs from a function list is the spelling, because a misspelt
             * name is `#NAME?` and a wrong range is a number that looks right.
             */
            run: () => write(focus, `=${fn}()`),
          })),
        },
        {
          id: 'g.audit',
          label: 'Checking',
          controls: [
            {
              kind: 'button',
              id: 'fa.show',
              label: 'Show formulas',
              wide: true,
              on: view.formulas,
              run: () => setView((was) => ({ ...was, formulas: !was.formulas })),
            },
          ],
        },
      ],
    },
    {
      id: 'data',
      label: 'Data',
      groups: [
        {
          id: 'g.sort',
          label: 'Sort',
          controls: [
            {
              kind: 'button',
              id: 'd.asc',
              label: 'Sort A to Z',
              glyph: '↓A',
              run: many(sel) ? () => sortBy('asc') : undefined,
            },
            {
              kind: 'button',
              id: 'd.desc',
              label: 'Sort Z to A',
              glyph: '↑A',
              run: many(sel) ? () => sortBy('desc') : undefined,
            },
          ],
        },
        {
          id: 'g.tools',
          label: 'Tools',
          controls: [
            {
              kind: 'button',
              id: 'd.find',
              label: 'Find and replace',
              wide: true,
              on: seeking,
              run: () => setSeeking((was) => !was),
            },
            {
              kind: 'button',
              id: 'd.filldown',
              label: 'Fill down',
              wide: true,
              run: many(sel) ? () => change(fill(body(), sel, 'down'), 'fill:down') : undefined,
            },
            {
              kind: 'button',
              id: 'd.fillright',
              label: 'Fill right',
              wide: true,
              run: many(sel) ? () => change(fill(body(), sel, 'right'), 'fill:right') : undefined,
            },
          ],
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      groups: [
        {
          id: 'g.show',
          label: 'Show',
          controls: (
            [
              ['lines', 'Gridlines'],
              ['heads', 'Headings'],
              ['freeze', 'Freeze top row'],
              ['formulas', 'Formulas'],
            ] as const
          ).map(([key, label]) => ({
            kind: 'button' as const,
            id: `v.${key}`,
            label,
            wide: true,
            on: view[key],
            run: () => setView((was) => ({ ...was, [key]: !was[key] })),
          })),
        },
        {
          id: 'g.zoom',
          label: 'Zoom',
          controls: [
            {
              kind: 'slider',
              id: 'v.zoom',
              label: 'Zoom',
              value: ZOOMS.indexOf(zoom as (typeof ZOOMS)[number]),
              min: 0,
              max: ZOOMS.length - 1,
              step: 1,
              onSlide: (at) => setZoom(ZOOMS[at]),
            },
            {
              kind: 'button',
              id: 'v.reset',
              label: 'Back to 100%',
              wide: true,
              run: zoom === 100 ? undefined : () => setZoom(100),
            },
          ],
        },
      ],
    },
  ];

  /** More or fewer decimal places on everything selected. */
  function decimals(by: number) {
    restyleSelection(
      (was) => ({
        ...was,
        // Pressing `.00` on a plain cell makes it a number, which is what the
        // button means — otherwise it does nothing and looks broken.
        num: was.num && was.num !== 'plain' ? was.num : 'number',
        decimals: Math.min(MAX_DECIMALS, Math.max(0, places(was) + by)),
      }),
      `decimals:${rangeLabel(sel)}`,
    );
  }

  /**
   * Rule the selection.
   *
   * `all` puts four sides on every cell and `box` puts them only round the
   * outside, which is the difference between a table and an outline and is
   * why this cannot be one value written to every cell: the bottom-left cell
   * of an outlined block wants `b` and `l` and nothing else.
   */
  function rule(kind: string) {
    change(
      {
        styles: (() => {
          let styles = sheet.styles ?? {};
          for (const address of selected) {
            const where = parseRef(address);
            if (!where) continue;
            const edge =
              kind === ''
                ? ''
                : kind === 'all'
                  ? 'tblr'
                  : [
                      where.row === spot.top ? 't' : '',
                      where.row === spot.bottom ? 'b' : '',
                      where.col === spot.left ? 'l' : '',
                      where.col === spot.right ? 'r' : '',
                    ].join('');
            styles = restyle({ ...sheet, styles }, [address], (was) => ({ ...was, edge }));
          }
          return styles;
        })(),
      },
      `edge:${rangeLabel(sel)}`,
    );
  }

  const found = seeking ? findIn(body(), needle) : [];

  return (
    <Page
      blurb={
        nothing ? 'Type into a cell. A cell starting with = is a formula.' : `${size.rows} × ${size.cols}`
      }
    >
      <Bench
        mark={<SheetIcon size={18} />}
        title={sheet.title}
        onTitle={(title) => patch({ title })}
        titleLabel="Sheet title"
        placeholder="Untitled spreadsheet"
        menus={menus}
        tools={
          <>
            <Tool label="Save as an Excel file" icon="⤓" disabled={nothing || busy} onClick={() => void saveExcel()} />
            <Tool label="Undo" icon="↶" disabled={!canUndo(history)} onClick={() => rewind(undo(history))} />
            <Tool label="Redo" icon="↷" disabled={!canRedo(history)} onClick={() => rewind(redo(history))} />
            <ToolRule />
            <Tool label="Print, or save as PDF" icon="⎙" onClick={() => window.print()} />
          </>
        }
        actions={
          <ActionButton
            onClick={() => dispatch({ type: 'closeSheet' })}
            style={{ width: 'auto', padding: '0 var(--sp-6)', flex: 'none' }}
          >
            All sheets
          </ActionButton>
        }
      />
      {/* The deadline goes with the course — see the note in `screens/Write.tsx`. */}
      <CoursePicker
        value={sheet.courseId}
        onChange={(id) => patch({ courseId: id, itemId: null })}
      />
      {/* A grade calculator is for a course; a marked problem set is for one
          deadline, and that is the one somebody goes looking for. */}
      <DeadlinePicker
        courseId={sheet.courseId}
        value={sheet.itemId}
        onChange={(itemId) => patch({ itemId })}
        showAll={allDeadlines}
        onShowAll={() => setAllDeadlines(true)}
      />

      <Ribbon tabs={tabs} on={ribbon} onTab={setRibbon} />

      {seeking && (
        <Seek
          needle={needle}
          instead={instead}
          hits={found.length}
          onNeedle={setNeedle}
          onInstead={setInstead}
          onGo={() => found[0] && go(found[0].address)}
          onReplace={() => {
            const done = replaceAll(body(), needle, instead);
            if (done.changed === 0) {
              say('Nothing matched.');
              return;
            }
            change(done.body, 'replace');
            say(`${done.changed} ${done.changed === 1 ? 'cell' : 'cells'} changed.`);
          }}
          onClose={() => setSeeking(false)}
        />
      )}

      {/*
        The name box and the formula bar, which is where a spreadsheet's chrome
        earns its place: the cell is 92 pixels wide and the formula in it is
        not, so without this the only way to read `=SUMPRODUCT(B2:B9,C2:C9)`
        was to put the cursor in the cell and scroll it sideways.
      */}
      <FormulaBar
        where={rangeLabel(sel)}
        says={`Selected: ${saySize(sel)}`}
        onGo={(text) => {
          const where = parseRef(text);
          if (!where) return;
          go(ref(Math.min(where.row, sheet.rows - 1), Math.min(where.col, sheet.cols - 1)));
        }}
        value={raw}
        onChange={(next) => write(focus, next)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          go(step(focus, 1, 0, sheet.rows, sheet.cols));
        }}
        mono={isFormula(raw)}
      />

      <div className={view.lines ? 'sgrid' : 'sgrid sgrid-plain'}>
        <table>
          {view.heads && (
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    className="shead"
                    // The corner box, which selects the whole sheet — the one
                    // control every spreadsheet puts where the two headers
                    // cross, and the fastest way to format a table at once.
                    onClick={() =>
                      setSel({ anchor: 'A1', focus: ref(sheet.rows - 1, sheet.cols - 1) })
                    }
                    aria-label="Select the whole sheet"
                  >
                    ◤
                  </button>
                </th>
                {Array.from({ length: sheet.cols }, (_, c) => (
                  <th key={c} scope="col">
                    <button
                      type="button"
                      className="shead"
                      // Selecting a whole column, which is how anybody totals
                      // one: press the letter, read the sum off the status bar.
                      onClick={() => setSel({ anchor: ref(0, c), focus: ref(sheet.rows - 1, c) })}
                      aria-label={`Select column ${colName(c)}`}
                      aria-pressed={spot.left <= c && c <= spot.right}
                    >
                      {colName(c)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {Array.from({ length: sheet.rows }, (_, r) => {
              const frozen = view.freeze && view.heads && r === 0;
              return (
                <tr key={r}>
                  {view.heads && (
                    <th scope="row" className={frozen ? 'sfreeze' : undefined}>
                      <button
                        type="button"
                        className="shead srow"
                        onClick={() => setSel({ anchor: ref(r, 0), focus: ref(r, sheet.cols - 1) })}
                        aria-label={`Select row ${r + 1}`}
                        aria-pressed={spot.top <= r && r <= spot.bottom}
                      >
                        {r + 1}
                      </button>
                    </th>
                  )}
                  {Array.from({ length: sheet.cols }, (_, c) => {
                    const address = ref(r, c);
                    return (
                      <Cell
                        key={c}
                        sheet={sheet}
                        address={address}
                        inside={holds(sel, address)}
                        cursor={sel.focus === address}
                        editing={typing === address || view.formulas}
                        frozen={frozen}
                        zoom={zoom}
                        hold={(el) => {
                          boxes.current[address] = el;
                        }}
                        onWrite={(value) => write(address, value)}
                        onFocus={() => {
                          setTyping(address);
                          setSel(oneCell(address));
                        }}
                        onExtend={() => setSel((was) => ({ ...was, focus: address }))}
                        onBlur={() => setTyping((was) => (was === address ? null : was))}
                        onKeyDown={(e) => onKey(e, address)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SheetTabs
        sheets={state.sheets}
        on={sheet.id}
        onGo={(id) => dispatch({ type: 'openSheet', id })}
        onNew={() => dispatch({ type: 'newSheet', courseId: sheet.courseId })}
      />

      {/*
        The status bar, which is the bottom of every spreadsheet and the answer
        to the commonest question anybody asks one: select the column, read
        what it comes to. Before this the only way to find out was to write a
        `SUM`, look at it, and delete it again.
      */}
      <StatusBar
        mode={typing === null ? 'Ready' : 'Enter'}
        stats={
          many(sel)
            ? [
                saySize(sel),
                totals.count > 0 ? `Sum ${show(totals.sum)}` : `${totals.filled} filled`,
                totals.count > 0 ? `Average ${show(totals.average)}` : '',
                totals.count > 0 ? `Count ${totals.count}` : '',
                totals.count > 0 ? `Min ${show(totals.min)} · Max ${show(totals.max)}` : '',
                totals.wrong ? 'and something in it is an error' : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : `${focus}${raw ? `: ${raw}` : ' is empty'}${
                isFormula(raw)
                  ? ` → ${answer}${wrong ? ' — that is what is wrong, not a value' : ''}`
                  : ''
              }`
        }
        zoom={zoom}
        onZoom={(by) => setZoom(stepZoom(zoom, by > 0 ? 1 : -1))}
      />
    </Page>
  );
}

/**
 * Find and replace, as a strip over the grid.
 *
 * It searches what was *typed* rather than what is shown — see `find` in
 * `lib/sheetedit.ts` — which is the choice that makes replace worth having: a
 * search of the answers would find the `162` a `SUM` produced and not the
 * `=SUM(D2:D5)` that produced it, so replacing it would do nothing anybody
 * could see.
 */
function Seek({
  needle,
  instead,
  hits,
  onNeedle,
  onInstead,
  onGo,
  onReplace,
  onClose,
}: {
  needle: string;
  instead: string;
  hits: number;
  onNeedle: (next: string) => void;
  onInstead: (next: string) => void;
  onGo: () => void;
  onReplace: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fx" role="search">
      <input
        className="fx-in"
        value={needle}
        onChange={(e) => onNeedle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onGo()}
        placeholder="Find what was typed"
        aria-label="Find"
        spellCheck={false}
      />
      <input
        className="fx-in"
        value={instead}
        onChange={(e) => onInstead(e.target.value)}
        placeholder="Replace with"
        aria-label="Replace with"
        spellCheck={false}
      />
      <button type="button" className="rib-btn rib-btn-wide" onClick={onGo} disabled={hits === 0}>
        {needle === '' ? 'Find' : `${hits} found`}
      </button>
      <button
        type="button"
        className="rib-btn rib-btn-wide"
        onClick={onReplace}
        disabled={hits === 0}
      >
        Replace all
      </button>
      <button type="button" className="rib-btn" aria-label="Close find and replace" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

/**
 * One cell.
 *
 * Its own component because the grid is `rows × cols` of these and the whole
 * screen re-rendering on every keystroke was already the slowest thing here.
 *
 * The input shows the *formula* while the cursor is in it and the *answer*
 * when it is not, which is what a spreadsheet is and what makes a total
 * something you can check rather than a number that appeared.
 */
function Cell({
  sheet,
  address,
  inside,
  cursor,
  editing,
  frozen,
  zoom,
  hold,
  onWrite,
  onFocus,
  onExtend,
  onBlur,
  onKeyDown,
}: {
  sheet: SheetModel;
  address: string;
  inside: boolean;
  cursor: boolean;
  editing: boolean;
  /** In the row held under the headings, so it is drawn sticky. */
  frozen: boolean;
  zoom: number;
  hold: (el: HTMLInputElement | null) => void;
  onWrite: (value: string) => void;
  onFocus: () => void;
  onExtend: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const raw = sheet.cells[address] ?? '';
  const style = styleOf(sheet, address);
  const value = styledDisplay(sheet.cells, address, style);
  // Once, not twice: this is `rows × cols` components and the second call was
  // the same walk of the same formula tree for a second answer about it.
  const answer = evaluate(sheet.cells, address);
  const bad = isError(answer);
  /*
   * Numbers right, text left, unless somebody has said otherwise.
   *
   * The spreadsheet rule, and the reason it is the rule: a column of figures
   * that lines up at the decimal point can be read down, and one that does not
   * has to be read across. `align` on the style overrides it.
   */
  const numeric = typeof answer === 'number';
  const scale = ((style?.size ?? BASE_SIZE) / BASE_SIZE) * (zoom / 100);
  const line = '1px solid var(--app-accent-deep)';
  const edge = style?.edge ?? '';
  return (
    <td className={frozen ? 'sfreeze' : undefined}>
      <input
        className={['scell', inside && !cursor ? 'scell-in' : '', bad ? 'scell-bad' : '']
          .filter(Boolean)
          .join(' ')}
        ref={hold}
        value={editing ? raw : value}
        onChange={(e) => onWrite(e.target.value)}
        onMouseDown={(e) => {
          // Shift-click extends the selection rather than moving it, which is
          // the pointer's half of shift-arrow. The default would move focus
          // and collapse the selection to this cell.
          if (e.shiftKey) {
            e.preventDefault();
            onExtend();
          }
        }}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        aria-label={`Cell ${address}`}
        spellCheck={false}
        style={{
          width: Math.round(92 * (zoom / 100)),
          height: Math.round(26 * (zoom / 100)),
          fontSize: `calc(var(--type-sm) * ${scale})`,
          textAlign: style?.align ?? (numeric ? 'right' : 'left'),
          fontWeight: style?.bold ? 600 : undefined,
          fontStyle: style?.italic ? 'italic' : undefined,
          textDecoration:
            [style?.strike ? 'line-through' : '', style?.under ? 'underline' : '']
              .filter(Boolean)
              .join(' ') || undefined,
          color: style?.ink && !bad ? inkOn(style.ink) : undefined,
          background: style?.wash ? washOn(style.wash) : undefined,
          borderTop: edge.includes('t') ? line : undefined,
          borderBottom: edge.includes('b') ? line : undefined,
          borderLeft: edge.includes('l') ? line : undefined,
          borderRight: edge.includes('r') ? line : undefined,
          fontFamily: isFormula(raw)
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : undefined,
        }}
      />
    </td>
  );
}

/**
 * The run of cells above the one selected, as a range.
 *
 * What a weighted mark needs and the one thing `autoSum` does not answer: two
 * columns rather than one, the scores and the weights beside them. Nothing is
 * returned from row 1, where there is nothing above.
 *
 * `over` shifts the column right, for the second of the two ranges.
 */
function columnAbove(address: string, over = 0): string | null {
  const m = /^([A-Z]+)(\d+)$/.exec(address.toUpperCase());
  if (!m) return null;
  const row = Number.parseInt(m[2], 10);
  if (row < 2) return null;
  const col = over === 0 ? m[1] : colName(colIndex(m[1]) + over);
  return `${col}1:${col}${row - 1}`;
}
