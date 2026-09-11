import { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { DeadlinePicker } from '../components/DeadlinePicker';
import { forLine } from '../lib/forwork';
import { datedItems } from '../lib/select';
import { ActionButton, ChipRow, EmptyState, FilePick, SectionLabel } from '../components/ui';
import { ChevronRight, Plus, SheetIcon } from '../components/Icons';
import { Folding } from '../components/Fold';
import { secondLine } from '../lib/dim';
import { download } from '../lib/deliver';
import {
  MAX_COLS,
  MAX_DECIMALS,
  MAX_ROWS,
  colIndex,
  colName,
  display,
  evaluate,
  extent,
  filled,
  fromRows,
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
  weighted,
  type Align,
  type CellStyle,
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
import { TEMPLATES, fromTemplate } from '../lib/sheettemplates';
import { fromSheet, sheetFileName, widthsFor, xlsx } from '../lib/xlsx';
import { canBuild, gradeSheet } from '../lib/gradesheet';
import { fromDelimited, fromXlsx, readerFor } from '../lib/xlsxin';
import { LIMIT } from '../state/slices/made';

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
  /*
   * `now: clock` rather than `now`, because this screen already has one.
   *
   * They are two different clocks on purpose. The store's is a `Date` that
   * ticks once a minute, which is what dates a deadline; the `now` below is a
   * millisecond stamp frozen at mount so the bands do not resort themselves
   * under somebody's hand. Aliasing here keeps both, and keeps the frozen one
   * called what the code below already calls it.
   */
  const { state, dispatch, courseCode, catalog, now: clock } = useStore();
  /* One list for the whole shelf — see the same note in `screens/Write.tsx`. */
  const items = useMemo(() => datedItems(catalog, clock), [catalog, clock]);
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
                            forLine(items, sheet.itemId),
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

/** The pictures on the toolbar, in the order a spreadsheet puts them. */
const FORMATS: { id: NumFormat; label: string; says: string }[] = [
  { id: 'plain', label: '123', says: 'Show what is there' },
  { id: 'number', label: '1,000', says: 'A number, grouped' },
  { id: 'percent', label: '%', says: 'A percentage' },
  { id: 'money', label: '$', says: 'Money' },
  { id: 'date', label: 'Date', says: 'A date, from a day count' },
];

const ALIGNS: { id: Align; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Middle' },
  { id: 'right', label: 'Right' },
];

function Grid({ sheet }: { sheet: SheetModel }) {
  const { state, dispatch, say } = useStore();
  const [sel, setSel] = useState<Range>(() => oneCell('A1'));
  /** Which cell has the text cursor in it, so it shows its formula not its answer. */
  const [typing, setTyping] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jump, setJump] = useState('');
  const [allDeadlines, setAllDeadlines] = useState(false);
  const boxes = useRef<Record<string, HTMLInputElement | null>>({});

  /*
   * The editor's own undo, which is not the app's.
   *
   * `lib/undo.ts` offers one step in a toast for eight seconds, which is the
   * right shape for deleting a note and the wrong one for typing into a grid.
   * See `lib/history.ts`. It is held in a ref rather than in state because
   * nothing renders from it except the two buttons' disabled flags, and those
   * are re-read on every render anyway.
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

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, address: string) => {
    const input = e.currentTarget;
    const ends = input.selectionStart === input.selectionEnd;
    const atStart = ends && input.selectionStart === 0;
    const atEnd = ends && input.selectionStart === input.value.length;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      rewind(e.shiftKey ? redo(history) : undo(history));
      return;
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
      const cells = { ...sheet.cells };
      for (const cell of selected) delete cells[cell];
      change({ cells }, 'clear');
    }
  };

  return (
    <Page
      blurb={nothing ? 'Type into a cell. A cell starting with = is a formula.' : `${size.rows} × ${size.cols}`}
      actions={<ActionButton onClick={() => dispatch({ type: 'closeSheet' })}>All sheets</ActionButton>}
    >
      <input
        className="input"
        value={sheet.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder="What this sheet is"
        aria-label="Sheet title"
        style={{ width: '100%', height: 44, fontSize: 'var(--type-lg)' }}
      />
      <CoursePicker value={sheet.courseId} onChange={(id) => patch({ courseId: id })} />
      {/* A grade calculator is for a course; a marked problem set is for one
          deadline, and that is the one somebody goes looking for. */}
      <DeadlinePicker
        courseId={sheet.courseId}
        value={sheet.itemId}
        onChange={(itemId) => patch({ itemId })}
        showAll={allDeadlines}
        onShowAll={() => setAllDeadlines(true)}
      />

      <Toolbar
        style={style}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        onUndo={() => rewind(undo(history))}
        onRedo={() => rewind(redo(history))}
        onFormat={(num) => restyleSelection((was) => ({ ...was, num }), `format:${rangeLabel(sel)}`)}
        onDecimals={(by) =>
          restyleSelection(
            (was) => ({
              ...was,
              // Pressing `.00` on a plain cell makes it a number, which is what
              // the button means — otherwise it does nothing and looks broken.
              num: was.num && was.num !== 'plain' ? was.num : 'number',
              decimals: Math.min(MAX_DECIMALS, Math.max(0, places(was) + by)),
            }),
            `decimals:${rangeLabel(sel)}`,
          )
        }
        onWeight={(key) => restyleSelection((was) => ({ ...was, [key]: !was[key] }), `${key}:${rangeLabel(sel)}`)}
        onAlign={(align) =>
          restyleSelection(
            (was) => ({ ...was, align: was.align === align ? undefined : align }),
            `align:${rangeLabel(sel)}`,
          )
        }
      />

      {/*
        The name box and the formula bar, which is where a spreadsheet's
        chrome earns its place: the cell is 92 pixels wide and the formula in
        it is not, so without this the only way to read `=SUMPRODUCT(B2:B9,C2:C9)`
        was to put the cursor in the cell and scroll it sideways.
      */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
        <input
          className="input"
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => setJump('')}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const where = parseRef(jump.trim());
            if (!where) return;
            e.preventDefault();
            setJump('');
            go(ref(Math.min(where.row, sheet.rows - 1), Math.min(where.col, sheet.cols - 1)));
          }}
          placeholder={rangeLabel(sel)}
          aria-label={`Selected: ${saySize(sel)}. Type a cell to go to it.`}
          spellCheck={false}
          style={{
            width: 84,
            flex: 'none',
            fontSize: 'var(--type-sm)',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <input
          className="input"
          value={raw}
          onChange={(e) => write(focus, e.target.value)}
          aria-label={`What is in ${focus}`}
          placeholder="fx"
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 'var(--type-sm)',
            fontFamily: isFormula(raw) ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
          }}
        />
      </div>

      <div style={{ overflowX: 'auto', marginTop: 'var(--sp-4)' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th aria-label="Row numbers" style={{ width: 28 }} />
              {Array.from({ length: sheet.cols }, (_, c) => (
                <th key={c} scope="col" style={{ padding: 0 }}>
                  <button
                    type="button"
                    className="bare tappable"
                    // Selecting a whole column, which is how anybody totals
                    // one: press the letter, read the sum off the status line.
                    onClick={() =>
                      setSel({ anchor: ref(0, c), focus: ref(sheet.rows - 1, c) })
                    }
                    aria-label={`Select column ${colName(c)}`}
                    style={{
                      ...secondLine(),
                      width: '100%',
                      fontSize: 'var(--type-xs)',
                      padding: 'var(--sp-1)',
                      background:
                        box(sel).left <= c && c <= box(sel).right
                          ? 'var(--app-accent-wash)'
                          : 'transparent',
                    }}
                  >
                    {colName(c)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rows }, (_, r) => (
              <tr key={r}>
                <th scope="row" style={{ padding: 0 }}>
                  <button
                    type="button"
                    className="bare tappable"
                    onClick={() =>
                      setSel({ anchor: ref(r, 0), focus: ref(r, sheet.cols - 1) })
                    }
                    aria-label={`Select row ${r + 1}`}
                    style={{
                      ...secondLine(),
                      width: '100%',
                      fontSize: 'var(--type-xs)',
                      padding: 'var(--sp-1)',
                      textAlign: 'right',
                      background:
                        box(sel).top <= r && r <= box(sel).bottom
                          ? 'var(--app-accent-wash)'
                          : 'transparent',
                    }}
                  >
                    {r + 1}
                  </button>
                </th>
                {Array.from({ length: sheet.cols }, (_, c) => {
                  const address = ref(r, c);
                  return (
                    <Cell
                      key={c}
                      sheet={sheet}
                      address={address}
                      inside={holds(sel, address)}
                      cursor={sel.focus === address}
                      editing={typing === address}
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
            ))}
          </tbody>
        </table>
      </div>

      {/*
        The status line, which is the bottom-right corner of every spreadsheet
        and the answer to the commonest question anybody asks one: select the
        column, read what it comes to. Before this the only way to find out was
        to write a `SUM`, look at it, and delete it again.
      */}
      <div
        role="status"
        style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-4)' }}
      >
        {many(sel)
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
              isFormula(raw) ? ` → ${answer}${wrong ? ' — that is what is wrong, not a value' : ''}` : ''
            }`}
      </div>

      <Tabs
        sheets={state.sheets}
        on={sheet.id}
        onGo={(id) => dispatch({ type: 'openSheet', id })}
        onNew={() => dispatch({ type: 'newSheet', courseId: sheet.courseId })}
      />

      <SectionLabel>The grid’s size</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <ActionButton
          disabled={sheet.rows >= MAX_ROWS}
          onClick={() => change({ rows: Math.min(MAX_ROWS, sheet.rows + 5) }, 'rows')}
        >
          Five more rows
        </ActionButton>
        <ActionButton
          disabled={sheet.cols >= MAX_COLS}
          onClick={() => change({ cols: Math.min(MAX_COLS, sheet.cols + 1) }, 'cols')}
        >
          Another column
        </ActionButton>
      </div>

      <SectionLabel>A sum, written for you</SectionLabel>
      <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-4)' }}>
        {/*
          With a block selected these use it, which is the honest version of
          what this did before: it guessed the column above the cursor and
          hoped. The guess is still here for a single cell, where there is
          nothing else to go on, and what lands in the cell is the formula
          rather than the number so the range can be seen and changed.
        */}
        {many(sel)
          ? `Puts a formula over ${rangeLabel(sel)} in the cell under it.`
          : `Puts a formula in ${focus}. Edit the range afterwards — it guesses the column above.`}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        {(
          [
            ['Total', (range: string) => `=SUM(${range})`],
            ['Average', (range: string) => `=AVERAGE(${range})`],
            ['Std deviation', (range: string) => `=STDEV(${range})`],
            ['Count', (range: string) => `=COUNT(${range})`],
          ] as const
        ).map(([text, build]) => (
          <ActionButton
            key={text}
            onClick={() => {
              const b = box(sel);
              if (many(sel)) {
                const under = ref(Math.min(sheet.rows - 1, b.bottom + 1), b.left);
                write(under, build(rangeLabel(sel)));
                go(under);
                return;
              }
              const above = columnAbove(focus);
              if (above) write(focus, build(above));
            }}
          >
            {text}
          </ActionButton>
        ))}
        <ActionButton
          disabled={many(sel)}
          onClick={() => {
            const scores = columnAbove(focus);
            const weights = columnAbove(focus, 1);
            if (scores && weights) write(focus, weighted(scores, weights));
          }}
        >
          Weighted mark
        </ActionButton>
      </div>

      <SectionLabel>Take it away</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <ActionButton tone="primary" disabled={nothing || busy} onClick={saveExcel}>
          {busy ? 'Writing…' : 'Excel file (.xlsx), formulas and all'}
        </ActionButton>
        <ActionButton
          disabled={nothing}
          onClick={() => {
            download({
              name: sheetFileName(sheet.title).replace(/\.xlsx$/, '.csv'),
              body: toCsv(rows),
              mime: 'text/csv',
            });
            say('CSV saved.');
          }}
        >
          CSV
        </ActionButton>
        <ActionButton
          disabled={nothing}
          onClick={() => {
            void navigator.clipboard?.writeText(toMarkdown(rows));
            say('Table copied as Markdown.');
          }}
        >
          Copy as a Markdown table
        </ActionButton>
        <ActionButton
          disabled={nothing}
          onClick={() => {
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
          }}
        >
          Put it in a new document
        </ActionButton>
      </div>

      <SectionLabel>This sheet</SectionLabel>
      <ActionButton
        onClick={() => {
          dispatch({ type: 'deleteSheet', id: sheet.id });
          say('Sheet deleted.');
        }}
      >
        Delete it
      </ActionButton>
    </Page>
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
  return (
    <td style={{ padding: 0 }}>
      <input
        className="input"
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
          width: 92,
          height: 32,
          borderRadius: 0,
          fontSize: 'var(--type-sm)',
          fontVariantNumeric: 'tabular-nums',
          textAlign: style?.align ?? (numeric ? 'right' : 'left'),
          fontWeight: style?.bold ? 600 : undefined,
          fontStyle: style?.italic ? 'italic' : undefined,
          textDecoration: style?.strike ? 'line-through' : undefined,
          color: bad ? 'var(--app-accent-bright)' : undefined,
          background: inside && !cursor ? 'var(--app-accent-wash)' : undefined,
          outline: cursor ? '1px solid var(--app-accent)' : undefined,
          fontFamily: isFormula(raw)
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : undefined,
        }}
      />
    </td>
  );
}

/**
 * The toolbar.
 *
 * Small buttons in a row that wraps, rather than the icon strip a desktop
 * spreadsheet has: the app is read on a phone first, an icon nobody
 * recognises is a button nobody presses, and `B`, `I`, `S`, `%` and `$` are
 * the five that everybody does recognise. Each one carries a real label for
 * anybody listening rather than looking.
 *
 * Everything here acts on the whole selection. That is the point of having a
 * selection: a picture is put over a column by pressing the column's letter
 * and then one button.
 */
function Toolbar({
  style,
  canUndo: undoable,
  canRedo: redoable,
  onUndo,
  onRedo,
  onFormat,
  onDecimals,
  onWeight,
  onAlign,
}: {
  style: CellStyle;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFormat: (num: NumFormat) => void;
  onDecimals: (by: number) => void;
  onWeight: (key: 'bold' | 'italic' | 'strike') => void;
  onAlign: (align: Align) => void;
}) {
  const tool = (
    text: string,
    says: string,
    onClick: () => void,
    on = false,
    off = false,
  ) => (
    <button
      key={says}
      type="button"
      className="btn btn-ghost"
      onClick={onClick}
      disabled={off}
      aria-label={says}
      aria-pressed={on}
      style={{
        flex: 'none',
        width: 'auto',
        padding: 'var(--sp-2) var(--sp-4)',
        fontSize: 'var(--type-xs)',
        background: on ? 'var(--app-accent-wash)' : undefined,
      }}
    >
      {text}
    </button>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--sp-2)',
        alignItems: 'center',
        marginTop: 'var(--sp-4)',
        paddingBottom: 'var(--sp-3)',
        borderBottom: '1px solid var(--app-line)',
      }}
    >
      {tool('↶', 'Undo', onUndo, false, !undoable)}
      {tool('↷', 'Redo', onRedo, false, !redoable)}
      <Rule />
      {FORMATS.map((f) =>
        tool(f.label, f.says, () => onFormat(f.id), (style.num ?? 'plain') === f.id),
      )}
      {tool('.0', 'Fewer decimal places', () => onDecimals(-1))}
      {tool('.00', 'More decimal places', () => onDecimals(1))}
      <Rule />
      {tool('B', 'Bold', () => onWeight('bold'), style.bold === true)}
      {tool('I', 'Italic', () => onWeight('italic'), style.italic === true)}
      {tool('S', 'Strikethrough', () => onWeight('strike'), style.strike === true)}
      <Rule />
      {ALIGNS.map((a) => tool(a.label, `Align ${a.label.toLowerCase()}`, () => onAlign(a.id), style.align === a.id))}
    </div>
  );
}

/** The hairline between groups of tools. */
function Rule() {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 16, background: 'var(--app-line)', margin: '0 var(--sp-1)' }}
    />
  );
}

/**
 * The tab strip along the bottom.
 *
 * Every spreadsheet has one and this app's sheets were four taps apart: close
 * the sheet, find the shelf, read the list, open the other one. A gradebook
 * and the budget beside it are two things somebody moves between constantly,
 * and the strip is the whole of what makes that one tap.
 *
 * It is the account's sheets rather than tabs inside one workbook, because
 * that is what this app has: an imported workbook's tabs each arrive as a
 * sheet of their own — see `lib/xlsxin.ts` — so the strip shows exactly what
 * the file had in it, with everything else alongside.
 */
function Tabs({
  sheets,
  on,
  onGo,
  onNew,
}: {
  sheets: SheetModel[];
  on: string;
  onGo: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--sp-2)',
        overflowX: 'auto',
        marginTop: 'var(--sp-4)',
        paddingTop: 'var(--sp-3)',
        borderTop: '1px solid var(--app-line)',
      }}
    >
      {sheets.map((sheet) => (
        <button
          key={sheet.id}
          type="button"
          className="btn btn-ghost"
          onClick={() => sheet.id !== on && onGo(sheet.id)}
          aria-current={sheet.id === on ? 'true' : undefined}
          style={{
            flex: 'none',
            width: 'auto',
            maxWidth: 140,
            padding: 'var(--sp-2) var(--sp-5)',
            fontSize: 'var(--type-xs)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            background: sheet.id === on ? 'var(--app-accent-wash)' : undefined,
          }}
        >
          {sheet.title || 'Untitled'}
        </button>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={onNew}
        aria-label="A new sheet"
        style={{ flex: 'none', width: 'auto', padding: 'var(--sp-2) var(--sp-5)' }}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

/**
 * The run of cells above the one selected, as a range.
 *
 * What "Total" means when somebody presses it at the bottom of a column with
 * nothing selected, and a guess rather than an answer — which is why what
 * lands in the cell is the formula rather than the number. They can see the
 * range, and change it. With a block selected the buttons use that instead and
 * this is not called.
 *
 * `over` shifts the column right, for the second range a weighted average
 * needs. Nothing is returned from row 1, where there is nothing above.
 */
function columnAbove(address: string, over = 0): string | null {
  const m = /^([A-Z]+)(\d+)$/.exec(address.toUpperCase());
  if (!m) return null;
  const row = Number.parseInt(m[2], 10);
  if (row < 2) return null;
  const col = over === 0 ? m[1] : colName(colIndex(m[1]) + over);
  return `${col}1:${col}${row - 1}`;
}
