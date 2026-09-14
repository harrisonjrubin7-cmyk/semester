import { forwardRef, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { DeadlinePicker } from '../components/DeadlinePicker';
import { forLine } from '../lib/forwork';
import { ActionButton, ChipRow, EmptyState, FilePick, SectionLabel, Segmented, Toggle } from '../components/ui';
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
  reading,
  sheetKey,
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
  type Cells,
  type Ctx,
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
  rangeOf,
  saySize,
  step,
  summarise,
  type Range,
} from '../lib/grid';
import {
  canRedo,
  canUndo,
  amend,
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
import { moveRef, reachOf, renameIn, renameRef, sheetsBehind, shiftIn, wayOf } from '../lib/sheetedit';
import {
  PASTE_HINTS,
  PASTE_LABELS,
  PASTE_WAYS,
  pasteWay,
  type PasteWay,
} from '../lib/sheetedit';
import { ZOOMS, stepZoom, type Tab as RibbonTab } from '../lib/ribbon';
import { FormulaBar, Ribbon, SheetTabs, StatusBar } from '../components/Ribbon';
import { TEMPLATES, fromTemplate } from '../lib/sheettemplates';
import { fromSheet, sheetFileName, tabNames, widthsFor, xlsx } from '../lib/xlsx';
import { canBuild, gradeSheet } from '../lib/gradesheet';
import { fromDelimited, fromXlsx, readerFor } from '../lib/xlsxin';
import { LIMIT } from '../state/slices/made';
import { corners } from '../lib/chart';
import {
  CHART_KINDS,
  CHART_LABELS,
  CHART_SAYS,
  chartsOf,
  suggest as suggestChart,
  type SheetChart as ChartSpec,
} from '../lib/chart';
import { SheetChart as ChartPicture } from '../components/SheetChart';
import { hides } from '../lib/filter';
import {
  coveredBy,
  joinAt,
  joinsOf,
  landOn,
  cellsOf,
  saysJoin,
  spanOf,
  spansAt,
  whyNotJoin,
  withJoin,
  withoutJoin,
  type Span,
} from '../lib/joined';
import {
  CHECKS,
  CHECK_LABELS,
  allows,
  blankRule as blankCheck,
  checksOf,
  choicesOf,
  ready as checkReady,
  saysRule as saysCheck,
  whyNot as whyNotValue,
  type Check,
  type DataRule,
} from '../lib/validate';
import {
  namesOf,
  pointAt,
  qualified,
  usable as nameUsable,
  whyNot as whyNotName,
  writeRef,
  type NamedRange,
} from '../lib/names';
import {
  AGGREGATES,
  AGGREGATE_LABELS,
  asCells as pivotCells,
  headingOf as pivotHeading,
  pivotNote,
  pivotsOf,
  readPivot,
  suggest as suggestPivot,
  type Aggregate,
  type Pivot,
} from '../lib/pivot';
import {
  TEST_LABELS as FILTER_LABELS,
  TESTS as FILTER_TESTS,
  blankFilter,
  columnsIn,
  filterOf,
  headingOf,
  hidden as hiddenRows,
  saysRule as saysFilter,
  valuesIn,
  withRule,
  withoutRule,
  type FilterRule,
  type SheetFilter,
} from '../lib/filter';
import {
  TEST_LABELS as COND_LABELS,
  TESTS as COND_TESTS,
  blankRule,
  painted,
  rulesOf,
  saysRule as saysCond,
  type CondRule,
  type Test as CondTest,
} from '../lib/condfmt';
import { pictureFileName, standalone } from '../lib/svgout';
import { handOver } from '../lib/draft.hook';
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

/**
 * How far a press may wander and still be a press, in pixels.
 *
 * The same figure and the same reason as `STILL` in `components/Plot.tsx`: a
 * finger on glass never holds perfectly still, and a threshold of zero makes
 * every press a drag on a touchscreen.
 */
const STILL = 6;

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
/**
 * The state of the *other* sheets this step rewrote, by sheet id.
 *
 * Only ever the ones a step actually touched, which is almost never: a
 * structural edit on a sheet something else points into, and nothing else.
 * It is on the snapshot rather than left to the store because undo has to put
 * it back — see `amend` in `lib/history.ts` for the total that is quietly
 * wrong without it.
 */
type Others = Record<string, { cells: Cells; names?: NamedRange[] }>;

interface Snap {
  cells: Record<string, string>;
  styles: Record<string, CellStyle>;
  rows: number;
  cols: number;
  /**
   * The blocks drawn as one cell, where this step changed them.
   *
   * In the snapshot rather than patched beside it, because joining does two
   * things at once — it makes the block *and* clears the cells under it — and
   * an undo that put back only the values would put them back underneath a
   * block that is still there. They would be restored and invisible, which is
   * the hidden-data fault `lib/joined.ts` exists to avoid, reintroduced by the
   * one step meant to be the way out of it. Measured: the toast said "undo
   * brings them back" and undo did not.
   */
  joins?: string[];
  /** Other sheets this step rewrote. Absent on every step that rewrote none. */
  others?: Others;
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
  /** Which panel is open under the ribbon, or none. */
  const [panel, setPanel] = useState<'filter' | 'rules' | 'names' | 'checks' | null>(null);
  /** Which column the filter strip is setting a rule on. */
  const [onColumn, setOnColumn] = useState<number | null>(null);
  const [needle, setNeedle] = useState('');
  const [instead, setInstead] = useState('');
  /**
   * The box in each cell, for putting the cursor back after a change.
   *
   * A wrapped cell is a `<textarea>` and every other cell an `<input>` — see
   * `CellStyle.wrap`. Both answer `focus`, `value` and `selectionStart`, which
   * is all of what this map is asked for.
   */
  const boxes = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  /*
   * The editor's own undo, which is not the app's.
   *
   * `lib/undo.ts` offers one step in a toast for eight seconds, which is the
   * right shape for deleting a note and the wrong one for typing into a grid.
   * See `lib/history.ts`.
   */
  const [history, setHistory] = useState<History<Snap>>(() =>
    start({
      cells: sheet.cells,
      styles: sheet.styles ?? {},
      rows: sheet.rows,
      cols: sheet.cols,
      // The joins too, or the first entry is the one snapshot that cannot put
      // a block back: `apply` patches what the snapshot has, so a missing key
      // leaves the sheet's joins exactly as they are — and undoing a join
      // would restore the cleared values underneath a block still covering
      // them. Every other entry carries them; this one is made by hand.
      joins: sheet.joins ?? [],
    }),
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
      joins: next.joins ?? sheet.joins ?? [],
    };
    setHistory((h) => remember(h, after, tag, Date.now()));
    patch(after);
  };

  /**
   * A new name, and every formula that named the old one following it.
   *
   * A tab's name is part of the address of every cell on it, as far as the
   * other sheets are concerned: `Marks!B1` stops resolving the moment Marks is
   * called something else, and a title is edited by typing — so somebody
   * correcting a typo would turn every reference into their gradebook into
   * `#REF!` on the way through.
   *
   * Renaming is not one of the grid's undoable steps, and it does not need to
   * be: the title and the references move together in one dispatch each, so
   * there is no state where half of it has happened. Typing the old name back
   * brings them back.
   */
  const rename = (title: string) => {
    const was = sheet.title;
    patch({ title });
    if (sheetKey(was) === sheetKey(title) || !sheetKey(was)) return;
    let moved = 0;
    for (const other of state.sheets) {
      if (other.id === sheet.id) continue;
      let changed = false;
      const cells: Cells = {};
      for (const [address, text] of Object.entries(other.cells)) {
        const written = renameIn(text, was, title);
        if (written !== text) changed = true;
        cells[address] = written;
      }
      const theirs = namesOf(other);
      const named = theirs.map((n) => ({ ...n, ref: renameRef(qualified(n.ref, other.title), was, title) }));
      if (named.some((n, i) => n.ref !== theirs[i].ref)) changed = true;
      if (!changed) continue;
      moved += 1;
      dispatch({ type: 'updateSheet', id: other.id, patch: { cells, names: named } });
    }
    // And this sheet's own names, which named it by its old title.
    const mine = names.map((n) => ({ ...n, ref: renameRef(qualified(n.ref, was), was, title) }));
    if (mine.some((n, i) => n.ref !== names[i].ref)) patch({ names: mine });
    if (moved) say(`${moved} other ${moved === 1 ? 'sheet' : 'sheets'} now say “${title}”.`);
  };

  /** A snapshot put back on screen — this grid, and any other sheet it moved. */
  const apply = (snap: Snap) => {
    const { others, ...body } = snap;
    patch(body);
    for (const [id, was] of Object.entries(others ?? {})) {
      dispatch({ type: 'updateSheet', id, patch: { cells: was.cells, names: was.names } });
    }
  };

  /**
   * A change to this grid's *shape*, and the same change seen from every other
   * sheet that points into it.
   *
   * Inserting a row here moves this grid's cells, and `shift` rewrites this
   * grid's own formulas to follow. Nothing on the other sheets moved, so their
   * formulas are left alone by that — and every one of them saying `Marks!B9`
   * is now naming the row above the one it meant. `shiftIn` is the other half,
   * and the two are called from one place because doing only the first is a
   * term total that quietly adds up the wrong nine rows with nothing on either
   * screen looking wrong.
   *
   * The before and after both go into the undo history: the *before* is
   * written onto the entry undo will land on, which never knew those formulas
   * said anything else. See `amend` in `lib/history.ts`.
   */
  const reshape = (next: Body, axis: 'row' | 'col', at: number, by: number, tag: string) => {
    const before: Others = {};
    const after: Others = {};
    for (const other of state.sheets) {
      if (other.id === sheet.id) continue;
      let moved = false;
      const cells: Cells = {};
      for (const [address, text] of Object.entries(other.cells)) {
        const written = shiftIn(text, sheet.title, axis, at, by);
        if (written !== text) moved = true;
        cells[address] = written;
      }
      /*
       * And the names, which are references too.
       *
       * A name left pointing at `Marks!B2:B9` after a row is inserted on Marks
       * is every formula using that name quietly measuring the wrong nine
       * rows — the same fault as a stale formula, one level further out and
       * harder to see, because the formula that is wrong does not mention a
       * row number anywhere.
       */
      const theirs = namesOf(other);
      const named = theirs.map((n) => ({
        ...n,
        ref: moveRef(qualified(n.ref, other.title), sheet.title, axis, at, by),
      }));
      if (named.some((n, i) => n.ref !== theirs[i].ref)) moved = true;
      if (!moved) continue;
      before[other.id] = { cells: other.cells, names: theirs };
      after[other.id] = { cells, names: named };
    }

    // This sheet's own names move with its own rows.
    const mine = names.map((n) => ({
      ...n,
      ref: moveRef(qualified(n.ref, sheet.title), sheet.title, axis, at, by),
    }));
    if (mine.some((n, i) => n.ref !== names[i].ref)) patch({ names: mine });

    /*
     * And the joined blocks, which are ranges too.
     *
     * A heading joined across `A1:C1` with a column inserted inside it has to
     * become `A1:D1`, or it goes on spanning three columns while the thing it
     * heads is four wide — a caption that has quietly stopped being over what
     * it names. Moved through `moveRef`, the same one every formula and every
     * name goes through, rather than by arithmetic written a second time here.
     */
    const spun = joins
      .map((span) => moveRef(qualified(span.range, sheet.title), sheet.title, axis, at, by))
      .map((moved) => spanOf(moved.replace(/^.*!/, '').replace(/\$/g, '')))
      .filter((span): span is Span => span !== null);
    const moved =
      spun.length !== joins.length || spun.some((span, i) => span.range !== joins[i].range);

    const snap: Snap = {
      ...next,
      ...(moved ? { joins: spun.map((span) => span.range) } : {}),
      ...(Object.keys(after).length ? { others: after } : {}),
    };
    setHistory((h) => {
      const kept = Object.keys(before).length
        ? amend(h, (was) => ({ ...was, others: { ...was.others, ...before } }))
        : h;
      return remember(kept, snap, tag, Date.now());
    });
    apply(snap);
    const touched = Object.keys(after).length;
    if (touched) {
      say(`${touched} other ${touched === 1 ? 'sheet' : 'sheets'} pointing here moved with it.`);
    }
  };

  /** The grid as `lib/sheetedit.ts` takes it, and the way a result comes back. */
  const body = (): Body => bodyOf(sheet);

  /**
   * The reading this grid is done under — the clock, and the other sheets.
   *
   * Once per render rather than once per cell: `reading` walks every sheet to
   * build the book, and this component draws `rows × cols` cells that each ask
   * what their formula comes to. Built from the titles and the cells, so
   * renaming a sheet or typing in one moves every formula pointing at it on
   * the next paint.
   *
   * `Date.now()` inside the memo rather than outside it, for the reason in
   * `clock`: a sheet whose formulas span midnight still agrees with itself,
   * because every cell in one paint is read at one instant.
   */
  const over = useMemo(
    () => reading(state.sheets, sheet.title),
    // The identity of the array changes on every edit to any sheet, which is
    // exactly when the book has to be rebuilt.
    [state.sheets, sheet.title],
  );

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
    apply(nowIn(to));
  };

  const rows = filled(sheet, over);
  const size = extent(sheet);
  const nothing = rows.length === 0;

  /**
   * This sheet as a workbook, with every sheet its formulas reach.
   *
   * A single tab was right while a formula could only name cells beside it.
   * The moment one can say `Marks!B1`, exporting this sheet alone writes a
   * formula pointing at a tab that is not in the file — which opens as `#REF!`
   * in Excel, on a number that was correct on the screen it came from. So the
   * sheets it reads come with it, and the sheets *they* read, until the set
   * stops growing.
   *
   * The names are the ones `lib/xlsx.ts` will actually give the tabs — a sheet
   * titled `Q1: marks` becomes the tab `Q1 marks` — and every qualifier is
   * rewritten to match through the same function that decides them, so the
   * formula in the file names the tab in the file.
   */
  const saveExcel = async () => {
    setBusy(true);
    try {
      const wanted: SheetModel[] = [sheet];
      for (let i = 0; i < wanted.length; i += 1) {
        for (const name of sheetsBehind(wanted[i].cells)) {
          const found = state.sheets.find((s) => sheetKey(s.title) === sheetKey(name));
          if (found && !wanted.some((w) => w.id === found.id)) wanted.push(found);
        }
      }

      const names = tabNames(wanted.map((s) => s.title));
      const carried = wanted.map((s, i) => {
        // Every qualifier moved to the tab name it will find in the file.
        const cells: Cells = {};
        for (const [address, text] of Object.entries(s.cells)) {
          let written = text;
          wanted.forEach((other, j) => {
            written = renameIn(written, other.title, names[j]);
          });
          cells[address] = written;
        }
        // The names it defines point at sheets by title too, so they move
        // with the formulas rather than being left naming a tab that the
        // file no longer has.
        const named = namesOf(s).map((n) => {
          let ref = qualified(n.ref, s.title);
          wanted.forEach((other, j) => {
            ref = renameRef(ref, other.title, names[j]);
          });
          return { ...n, ref };
        });
        return { ...s, title: names[i], cells, names: named };
      });

      // Read under the *renamed* book, so a cached value in the file is the
      // value the formula beside it computes.
      const blob = await xlsx({
        tabs: carried.map((s) => {
          const ctx = reading(carried, s.title);
          return { ...fromSheet(s, true, ctx), widths: widthsFor(filled(s, ctx)) };
        }),
      });
      download({
        name: sheetFileName(sheet.title),
        body: blob,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const extra = wanted.length - 1;
      say(extra ? `Excel file saved, with ${extra} sheet${extra === 1 ? '' : 's'} it reads.` : 'Excel file saved.');
    } finally {
      setBusy(false);
    }
  };

  /** Where the cursor is: one end of the selection, and what the formula bar edits. */
  const focus = sel.focus;
  const raw = sheet.cells[focus] ?? '';
  const answer = display(sheet.cells, focus, over);
  const wrong = isError(evaluate(sheet.cells, focus, new Set(), over));
  const style = styleOf(sheet, focus) ?? {};
  /**
   * The filter, and the rows it is keeping out of sight.
   *
   * Read through `filterOf` for the reason `chartsOf` is: a stored copy is
   * restored with `list()`, which trusts what it finds. Recomputed whenever
   * the cells change, because a filter is a view and a view that has to be
   * refreshed by hand is a view that is wrong between refreshes.
   */
  const filter = useMemo(() => filterOf(sheet), [sheet]);
  const away = useMemo(
    () => (filter ? hiddenRows(sheet.cells, filter, over) : new Set<number>()),
    [sheet.cells, filter, over],
  );

  /**
   * The colour rules, and the ranges they cover, resolved once.
   *
   * Once rather than per cell: this component draws `rows × cols` of them and
   * each would otherwise re-parse every rule's range to ask whether it was
   * inside it — four regexes a cell for something that changes when a rule
   * does and not when a number does.
   */
  const rules = useMemo(() => rulesOf(sheet, INKS), [sheet]);
  /** The names this sheet defines, and the summaries drawn under it. */
  const names = useMemo(() => namesOf(sheet), [sheet]);
  const pivots = useMemo(() => pivotsOf(sheet), [sheet]);
  const ruleRanges = useMemo(
    () => new Map(rules.map((r) => [r.range, rangeOf(r.range)])),
    [rules],
  );
  /**
   * The blocks drawn as one cell, and the two questions the grid asks of them.
   *
   * Both maps built once a render rather than per cell: the grid is
   * `rows × cols` components and each one needs to know whether it is drawn at
   * all, which is a `Map.has` here and was a walk of every join without it.
   */
  const joins = useMemo(() => joinsOf(sheet), [sheet]);
  const covered = useMemo(() => coveredBy(joins), [joins]);
  const spans = useMemo(() => spansAt(joins), [joins]);
  /** What the cells are allowed to hold, and the blocks those rules cover. */
  const checks = useMemo(() => checksOf(sheet), [sheet]);
  const checkRanges = useMemo(
    () => new Map(checks.map((c) => [c.id, rangeOf(c.range)])),
    [checks],
  );
  /**
   * The rule covering a cell, or none.
   *
   * The last one wins where two overlap, which is the same answer the colour
   * rules give and for the same reason: a rule added on top of another is
   * somebody saying "and this one instead".
   */
  const checkAt = useCallback(
    (address: string): DataRule | undefined => {
      for (let i = checks.length - 1; i >= 0; i -= 1) {
        const at = checkRanges.get(checks[i].id);
        if (at && holds(at, address) && checkReady(checks[i])) return checks[i];
      }
      return undefined;
    },
    [checks, checkRanges],
  );

  const selected = useMemo(() => cellsIn(sel), [sel]);
  /**
   * The selection's arithmetic, over the rows you can actually see.
   *
   * The one figure on the screen a filter moves, and it has to be this one: a
   * `SUM` in a cell still adds up the hidden rows — see the head of
   * `lib/filter.ts` — and the status bar is what people read for "so what does
   * this come to". Filtering a gradebook to one course and reading a total
   * that quietly includes the other three is the fault this answers.
   */
  const visible = useMemo(() => selected.filter((a) => !hides(away, a)), [selected, away]);
  const totals = useMemo(() => summarise(sheet.cells, visible, over), [sheet.cells, visible, over]);
  /** How many of the selected rows the filter is keeping out of the sum above. */
  const outOfSight = selected.length - visible.length;
  /**
   * Cells anywhere on the sheet that break the rule covering them.
   *
   * Counted over the whole sheet rather than the selection, because the point
   * of a rule is to catch the cell nobody is looking at. Skipped entirely
   * where there are no rules, which is nearly every sheet.
   */
  const broken = useMemo(() => {
    if (!checks.length) return [] as string[];
    /*
     * Walked over each rule's own range, not over the cells that exist.
     *
     * A rule may say an empty cell is *not* allowed, and an empty cell is not
     * a key in `cells` — so scanning what is there would count none of them,
     * while the grid, which asks the question per rendered cell, underlines
     * every one. The count in the status bar and the grid have to be the same
     * claim, or the sheet says two things about itself.
     */
    const out = new Set<string>();
    for (const rule of checks) {
      const at = checkRanges.get(rule.id);
      if (!at || !checkReady(rule)) continue;
      for (const address of cellsIn(at)) {
        // The rule that actually covers it, which where two overlap is the
        // later one — the same answer the cell itself gets.
        if (checkAt(address) !== rule) continue;
        const text = sheet.cells[address] ?? '';
        if (!allows(rule, evaluate(sheet.cells, address, new Set(), over), text)) out.add(address);
      }
    }
    return [...out];
  }, [checks, checkRanges, checkAt, sheet.cells, over]);
  /**
   * The rule the cursor's cell breaks, if it breaks one.
   *
   * Named in the status bar, which is where somebody looks when a cell is
   * marked and they want to know what it wanted. The mark says *something is
   * wrong here*; only this says what.
   */
  const cursorBreaks = useMemo(() => {
    const rule = checks.length ? checkAt(focus) : undefined;
    if (!rule) return undefined;
    return allows(rule, evaluate(sheet.cells, focus, new Set(), over), sheet.cells[focus] ?? '')
      ? undefined
      : rule;
  }, [checks, checkAt, focus, sheet.cells, over]);
  const spot = box(sel);

  /*
   * The charts on this sheet.
   *
   * Read through `chartsOf` rather than off `sheet.charts` directly — a
   * stored copy is restored with `list()`, which takes the holes out of an
   * array and trusts what is left. See `lib/chart.ts`.
   *
   * They are patched rather than put through `change()`: undo in this editor
   * is the grid's, and a drawing is not one of the four fields it records.
   * Adding a chart and then pressing undo should take back the last thing
   * typed, not silently remove the picture.
   */
  const charts = useMemo(() => chartsOf(sheet), [sheet]);
  const setCharts = (next: ChartSpec[]) => patch({ charts: next });

  /**
   * The numbers, handed to the screen whose job is reading them.
   *
   * `screens/Analyse.tsx` does the statistics this grid deliberately does not
   * — describe a column, correlate two, fit a line, count the categories —
   * and it could only be reached by pasting a table into it. So a sheet full
   * of the student's own figures was the one body of data in the app that had
   * to go out through the clipboard and back in.
   *
   * The *displayed* values rather than the cells, so a column of `=B2*C2`
   * arrives as the products. `display` is what the grid itself draws through,
   * which is what makes "what I am looking at" and "what gets analysed" the
   * same thing.
   */
  const analyseThis = () => {
    const b = box(sel);
    const rows = many(sel)
      ? Array.from({ length: b.bottom - b.top + 1 }, (_, r) =>
          Array.from({ length: b.right - b.left + 1 }, (_, c) =>
            display(sheet.cells, ref(b.top + r, b.left + c), over),
          ),
        )
      : filled(sheet, over);
    if (!rows.length) return;
    handOver('analyse', 'text', toCsv(rows), {
      from: `From ${sheet.title}${many(sel) ? `, ${rangeLabel(sel)}` : ''}.`,
    });
    dispatch({ type: 'go', screen: 'analyse' });
    say(`${many(sel) ? rangeLabel(sel) : sheet.title} sent to Analyse data.`);
  };

  const addChart = () => {
    const where = rangeLabel(sel);
    setCharts([...charts, suggestChart(sheet.cells, where, Date.now(), over)]);
    say(`Chart of ${where} added under the grid.`);
  };

  /*
   * The corner of the selection, dragged.
   *
   * `from` is the selection the drag started with, kept because the selection
   * itself moves under the finger to show where the fill will reach — so
   * without a copy there is nothing left to fill *from* when the finger comes
   * up.
   */
  const [dragging, setDragging] = useState<Range | null>(null);
  /**
   * Where the drag started, and whether the finger has left that spot.
   *
   * A `click` still fires after a drag — the pointer capture retargets the
   * `pointerup` to the handle, so the browser sees a press on it — and the
   * press does something different from the drag. Without telling them apart,
   * dragging the handle *backwards* (which correctly fills nothing) fell
   * through to the press and filled down to the foot of the table. Found in a
   * browser, not in a test: both halves work on their own.
   *
   * A ref rather than state because nothing on screen depends on it and a
   * re-render per pointermove is a re-render of every cell in the grid.
   */
  const grabbed = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  /**
   * The fill a drag or a press asks for, run.
   *
   * The range handed to `fill` runs from the *top-left* of what was selected
   * to wherever the finger stopped, whichever corner the selection was made
   * from: `fill` copies the first row of a range down it, so a selection made
   * upwards would otherwise copy the wrong row.
   */
  const runFill = (from: Range, to: string) => {
    const way = wayOf(from, to);
    if (!way) return;
    const at = box(from);
    const range: Range = { anchor: ref(at.top, at.left), focus: to };
    change(fill(bodyOf(sheet), range, way, away), `fill:${way}`);
    setSel(range);
    say(`Filled ${way} to ${to}.`);
  };

  /**
   * Filtering and colouring, patched rather than recorded.
   *
   * Neither is one of the grid's undoable steps, and neither should be: undo
   * in this editor puts back what a cell *held*, and a filter changes nothing
   * a cell holds while a rule changes nothing but the paint over it. Pressing
   * undo after setting a filter should take back the last thing typed, which
   * is what somebody would be reaching for. Both are cleared by the button
   * that set them, which is the honest undo for a view.
   */
  const setFilter = (next: SheetFilter | undefined) => patch({ filter: next });
  const setRules = (next: CondRule[]) => patch({ rules: next });
  const setNames = (next: NamedRange[]) => patch({ names: next });
  const setChecks = (next: DataRule[]) => patch({ checks: next });
  const setPivots = (next: Pivot[]) => patch({ pivots: next });

  /** The whole filled block, for a filter somebody opened without selecting one. */
  const fullRange = (): Range => {
    const size = extent(sheet);
    return { anchor: 'A1', focus: ref(Math.max(0, size.rows - 1), Math.max(0, size.cols - 1)) };
  };

  const addPivot = () => {
    const where = many(sel) ? rangeLabel(sel) : rangeLabel(fullRange());
    setPivots([...pivots, suggestPivot(sheet.cells, where, Date.now(), over)]);
    say(`Summary of ${where} added under the grid.`);
  };

  /**
   * A summary written into the grid, as formulas.
   *
   * Below everything that is filled, with a blank row between — not over the
   * table it summarises, which is the one place it must never land. The cells
   * go through `change` like any keystroke, so it is one step of undo.
   */
  const putPivot = (pivot: Pivot) => {
    const block = pivotCells(sheet.cells, pivot, sheet.title, over);
    if (!block.length) return;
    const size = extent(sheet);
    const top = size.rows + 1;
    const wide = Math.max(...block.map((line) => line.length));
    if (top + block.length > MAX_ROWS || wide > MAX_COLS) {
      say('There is not enough room under the table for that.');
      return;
    }
    const cells = { ...sheet.cells };
    block.forEach((line, r) => {
      line.forEach((text, c) => {
        if (text !== '') cells[ref(top + r, c)] = text;
      });
    });
    change(
      {
        cells,
        rows: Math.min(MAX_ROWS, Math.max(sheet.rows, top + block.length)),
        cols: Math.min(MAX_COLS, Math.max(sheet.cols, wide)),
      },
      `pivot:${pivot.id}`,
    );
    setSel({ anchor: ref(top, 0), focus: ref(top + block.length - 1, wide - 1) });
    say(`Written into ${ref(top, 0)}, as formulas that follow the table.`);
  };

  /**
   * The selection drawn as one cell.
   *
   * The covered cells are cleared, and the sentence says how many held
   * something — see the head of `lib/joined.ts` for why they cannot simply be
   * hidden. It is one step of undo, so the count is a thing somebody can act
   * on rather than a warning they had to read first.
   */
  const joinCells = () => {
    const where = rangeLabel(sel);
    const why = whyNotJoin(joins, where);
    if (why) {
      say(why);
      return;
    }
    const span = spanOf(where);
    if (!span) return;
    const cells = { ...sheet.cells };
    const styles = { ...(sheet.styles ?? {}) };
    let lost = 0;
    for (const address of cellsOf(span)) {
      if (address === span.anchor) continue;
      if ((cells[address] ?? '') !== '') lost += 1;
      delete cells[address];
      delete styles[address];
    }
    // One step: the block and the clearing it caused, so undo takes back both.
    change(
      { cells, styles, joins: withJoin(joins, where).map((j) => j.range) },
      `join:${where}`,
    );
    setSel(oneCell(span.anchor));
    say(
      lost
        ? `${saysJoin(span)}. ${lost} ${lost === 1 ? 'value' : 'values'} under it cleared — undo brings ${lost === 1 ? 'it' : 'them'} back.`
        : `${saysJoin(span)}.`,
    );
  };

  /** The block under the cursor, given its cells back. */
  const splitCells = () => {
    const had = joins.find((span) => cellsOf(span).includes(focus));
    if (!had) {
      say('Nothing here is joined.');
      return;
    }
    change({ joins: withoutJoin(joins, focus).map((j) => j.range) }, `split:${had.range}`);
    say(`${had.range} split back into ${had.rows * had.cols} cells.`);
  };

  /** The filter this sheet has, or one over the selection ready to take a rule. */
  const openFilter = () => {
    setPanel((was) => (was === 'filter' ? null : 'filter'));
    if (!filter) setFilter(blankFilter(rangeLabel(many(sel) ? sel : fullRange())));
    setOnColumn((was) => was ?? spot.left);
  };

  /**
   * The cell the handle sits in: the bottom-right of the selection, and
   * during a drag the bottom-right of the selection it *started* from.
   *
   * The second half is not cosmetic. The selection moves under the finger to
   * preview the fill, so a handle that follows it is rendered into a different
   * `<td>` on the first movement — React unmounts the button, the element
   * holding the pointer capture goes with it, and the drag dies silently after
   * one pixel. Measured: the press filled and the drag did nothing at all.
   */
  const held = box(dragging ?? sel);
  const corner = ref(held.bottom, held.right);

  /**
   * The corner of the selection, which fills when it is dragged and when it
   * is pressed.
   *
   * Both, because a drag is not available to everybody and this is the only
   * affordance in the grid that would otherwise be. Pressing it does what
   * double-clicking it does in Excel — fill to the foot of the table beside
   * it — and the name says which cell that is, so it is the same promise read
   * out loud as seen. ⌘D and ⌘R were already here and still are; this is the
   * thing people reach for, and it is what makes `$A$1` mean something,
   * because until something moved a lone reference nothing held one still.
   */
  const press = useMemo(() => {
    const grid = bodyOf(sheet);
    // Down first: a column of formulas is what this is nearly always for, and
    // a row of them is the case where there is nothing below to follow.
    const down = reachOf(grid, sel, 'down');
    if (down) return { to: down, way: 'down' as const };
    const right = reachOf(grid, sel, 'right');
    return right ? { to: right, way: 'right' as const } : null;
  }, [sheet, sel]);
  const fillHandle = (
    <button
      type="button"
      className="sfill"
      // The direction is in the name because it is not always down — a row
      // with nothing under it fills across — and a control that says one thing
      // and does another is worse than one that says nothing.
      aria-label={press ? `Fill ${press.way} to ${press.to}` : 'Drag to fill'}
      onPointerDown={(e) => {
        // The pointer is captured so the drag survives leaving the handle,
        // which it does immediately — the cells it is filling are all outside
        // it. Without this the browser stops sending moves at the first edge.
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        grabbed.current = { x: e.clientX, y: e.clientY, moved: false };
        setDragging(sel);
      }}
      onPointerMove={(e) => {
        if (!dragging) return;
        const from = grabbed.current;
        if (from && !from.moved) {
          const far = Math.abs(e.clientX - from.x) + Math.abs(e.clientY - from.y);
          if (far > STILL) from.moved = true;
        }
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const name = under?.getAttribute('aria-label') ?? '';
        const to = /^Cell ([A-Z]+\d+)$/.exec(name)?.[1];
        // The selection itself moves under the finger, which is the preview:
        // one fewer thing on screen than a ghost rectangle, and it is already
        // drawn correctly.
        if (to && wayOf(dragging, to)) setSel({ anchor: dragging.anchor, focus: to });
      }}
      onPointerUp={(e) => {
        const from = dragging;
        setDragging(null);
        if (!from) return;
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const name = under?.getAttribute('aria-label') ?? '';
        const to = /^Cell ([A-Z]+\d+)$/.exec(name)?.[1];
        if (to) runFill(from, to);
        else setSel(from);
      }}
      onPointerCancel={() => {
        // A cancelled drag puts the selection back rather than filling to
        // wherever the finger happened to be when the system took over.
        if (dragging) setSel(dragging);
        setDragging(null);
      }}
      onClick={() => {
        // A drag has already done its work on the way up. See `grabbed`.
        const dragged = grabbed.current?.moved ?? false;
        grabbed.current = null;
        if (!dragged && press) runFill(sel, press.to);
      }}
    />
  );

  /** Move the cursor, and take the browser's focus with it. */
  const go = (where: string, extend = false) => {
    /*
     * A cursor moving onto a covered cell lands on the cell that draws it.
     *
     * A covered cell has no box to focus, so without this an arrow key into a
     * joined block moves the selection somewhere invisible and the grid stops
     * answering the keyboard at all. Done here rather than at each caller
     * because this is the one funnel every move goes through.
     */
    const address = landOn(covered, where);
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
    // The answers come with it, so *paste values* can put down what the
    // formulas came to — see `Clip.values` for why they are taken now.
    const taken = copyOut(body(), sel, (address) =>
      show(evaluate(sheet.cells, address, new Set(), over)),
    );
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

  /**
   * Paste, one of the five ways — see `PASTE_WAYS` in `lib/sheetedit.ts`.
   *
   * The same two clipboards in the same order as a plain paste. A clip off the
   * system has no formulas in it, so *values* and *formulas* both put down its
   * text; that is not a special case in here, it is what those words mean
   * about text.
   */
  const pasteSpecial = async (way: PasteWay) => {
    let taken = clip;
    if (!taken) {
      const text = await navigator.clipboard?.readText?.().catch(() => '');
      taken = text ? readClip(text) : null;
    }
    if (!taken) {
      say('There is nothing to paste.');
      return;
    }
    change(pasteWay(body(), focus, taken, way), `paste:${way}:${focus}`);
    say(`${PASTE_LABELS[way]} pasted into ${focus}.`);
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

  const onKey = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, address: string) => {
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
        change(fill(body(), sel, key === 'd' ? 'down' : 'right', away), `fill:${rangeLabel(sel)}`);
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
    /*
     * A line break inside a wrapped cell, on the chord Excel uses for it.
     *
     * Plain Enter still moves down — it has to, or a wrapped column could not
     * be typed down the way every other column is. Without this there would be
     * no way to put a break in at all, and a cell that wraps but cannot be
     * given a line is half the feature.
     */
    if (e.key === 'Enter' && (e.altKey || e.shiftKey) && styleOf(sheet, address)?.wrap) {
      e.preventDefault();
      const cut = input.selectionStart ?? input.value.length;
      const to = input.selectionEnd ?? cut;
      write(address, `${input.value.slice(0, cut)}\n${input.value.slice(to)}`);
      queueMicrotask(() => {
        const box = boxes.current[address];
        if (box) box.selectionStart = box.selectionEnd = cut + 1;
      });
      return;
    }

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
          // `everything` is the plain paste directly above, so it is not
          // offered twice under a second name.
          ...PASTE_WAYS.filter((way) => way !== 'everything').map((way) => ({
            id: `edit.paste.${way}`,
            label: `Paste into ${focus}: ${PASTE_LABELS[way].toLowerCase()}`,
            hint: PASTE_HINTS[way],
            run: () => void pasteSpecial(way),
          })),
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
                : () => reshape(insertRows(body(), spot.top), 'row', spot.top, 1, 'insert:row'),
          },
          {
            id: 'insert.colleft',
            label: `Column left of ${colName(spot.left)}`,
            run:
              sheet.cols >= MAX_COLS
                ? undefined
                : () => reshape(insertCols(body(), spot.left), 'col', spot.left, 1, 'insert:col'),
          },
          {
            id: 'insert.delrow',
            label: `Delete row ${spot.top + 1}`,
            run:
              sheet.rows <= 1
                ? undefined
                : () =>
                    reshape(
                      deleteRows(body(), spot.top, spot.bottom - spot.top + 1),
                      'row',
                      spot.top,
                      -(spot.bottom - spot.top + 1),
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
                    reshape(
                      deleteCols(body(), spot.left, spot.right - spot.left + 1),
                      'col',
                      spot.left,
                      -(spot.right - spot.left + 1),
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
            id: 'insert.name',
            label: names.length ? `Name a block (${names.length})` : 'Name a block',
            hint: 'So a formula can say =SUM(Marks) instead of =SUM($B$2:$B$9).',
            run: () => setPanel((was) => (was === 'names' ? null : 'names')),
          },
          {
            id: 'insert.pivot',
            label: 'Summarise the table',
            hint: 'Group by one column and measure another, under the grid.',
            run: nothing ? undefined : addPivot,
          },
          {
            id: 'insert.chart',
            label: `Chart ${rangeLabel(sel)}`,
            hint: many(sel)
              ? 'Columns, bars, a line or a pie, under the grid.'
              : 'Select the block first — a chart of one cell is a dot.',
            run: many(sel) ? addChart : undefined,
          },
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
        [
          {
            id: 'format.wrap',
            label: 'Wrap text',
            hint: 'Long text folds onto more lines instead of running past the edge. Alt-Enter puts a break in by hand.',
            on: style.wrap === true,
            run: () =>
              restyleSelection(
                (was) => ({ ...was, wrap: was.wrap ? undefined : true }),
                `wrap:${rangeLabel(sel)}`,
              ),
          },
          {
            id: 'format.join',
            label: joinAt(joins, focus)
              ? `Split ${joinAt(joins, focus)!.range} apart`
              : `Join ${rangeLabel(sel)} into one cell`,
            hint: joinAt(joins, focus)
              ? 'Gives the block its cells back. Nothing that was cleared comes back with them.'
              : 'Keeps the top-left value and clears the rest, so what is shown is what is summed.',
            run: joinAt(joins, focus) ? splitCells : many(sel) ? joinCells : undefined,
          },
        ],
        [
          {
            id: 'format.rules',
            label: rules.length ? `Colour by value (${rules.length})` : 'Colour by value',
            hint: 'A colour that follows the number, rather than one painted on and left behind.',
            run: () => setPanel((was) => (was === 'rules' ? null : 'rules')),
          },
        ],
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
            run: many(sel) ? () => change(fill(body(), sel, 'down', away), 'fill:down') : undefined,
          },
          {
            id: 'data.fillright',
            label: 'Fill right',
            run: many(sel) ? () => change(fill(body(), sel, 'right', away), 'fill:right') : undefined,
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
            id: 'data.filter',
            label: filter && away.size ? `Filter (${away.size} hidden)` : 'Filter',
            hint: 'Hides rows. It changes no number — a SUM still adds up what is hidden.',
            run: nothing ? undefined : openFilter,
          },
          {
            id: 'data.checks',
            label: broken.length
              ? `Check what cells may hold (${broken.length} breaking a rule)`
              : 'Check what cells may hold',
            hint: 'Marks what does not match. It never refuses or changes an entry.',
            run: () => setPanel((was) => (was === 'checks' ? null : 'checks')),
          },
          {
            id: 'data.analyse',
            label: many(sel) ? `Analyse ${rangeLabel(sel)}` : 'Analyse this sheet',
            hint: 'Mean, spread, correlation and a fitted line, on the Analyse screen.',
            run: nothing ? undefined : analyseThis,
          },
          {
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
                'A cell starting with = is a formula. SUM, AVERAGE, MEDIAN, STDEV, MIN, MAX, COUNT, IF, ROUND, SQRT, VLOOKUP and SUMPRODUCT are all here, and so are the scientific ones — SIN, COS, TAN, LOG to any base, FACT, COMBIN — and the fitted line: SLOPE, INTERCEPT, RSQ and FORECAST over two columns. A formula can also read another sheet: =Marks!B2. All computed on this device.',
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
            id: 'help.across',
            label: 'How to read another sheet',
            run: () =>
              say(
                'A formula can name another sheet: =Marks!B2, or =SUM(Marks!B2:B9). A name with a space in it goes in apostrophes — \u2018Q1 marks\u2019!B2. Rename a sheet and every formula naming it follows; insert or delete rows on it and every formula pointing into it moves with them. A name no sheet has, or one two sheets share, reads #REF! rather than guessing. Saving as Excel brings the sheets it reads along with it.',
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
            /*
             * The five ways, as a pick rather than five buttons.
             *
             * It shows `everything` as its value because that is what plain
             * Paste beside it does — so the list reads as *and these other
             * four*, rather than as a setting that has been left unset.
             */
            {
              kind: 'pick',
              id: 'c.paste.special',
              label: 'Paste special',
              value: 'everything',
              options: PASTE_WAYS.map((way) => ({
                id: way,
                label: PASTE_LABELS[way],
              })),
              onPick: (id: string) => void pasteSpecial(id as PasteWay),
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
          controls: [
            ...ALIGNS.map((a) => ({
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
            {
              kind: 'button' as const,
              id: 'a.wrap',
              label: 'Wrap text',
              glyph: '↵',
              on: style.wrap === true,
              run: () =>
                restyleSelection(
                  (was) => ({ ...was, wrap: was.wrap ? undefined : true }),
                  `wrap:${rangeLabel(sel)}`,
                ),
            },
            {
              kind: 'button' as const,
              id: 'a.join',
              label: joinAt(joins, focus) ? 'Split apart' : 'Join cells',
              wide: true,
              on: Boolean(joinAt(joins, focus)),
              run: joinAt(joins, focus)
                ? splitCells
                : many(sel)
                  ? joinCells
                  : undefined,
            },
          ],
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
            {
              kind: 'button',
              id: 'n.rules',
              label: 'Colour by value',
              wide: true,
              on: panel === 'rules',
              run: () => setPanel((was) => (was === 'rules' ? null : 'rules')),
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
                  : () => reshape(insertRows(body(), spot.top), 'row', spot.top, 1, 'insert:row'),
            },
            {
              kind: 'button',
              id: 'x.colin',
              label: 'Insert a column to the left of the selection',
              glyph: '+↕',
              run:
                sheet.cols >= MAX_COLS
                  ? undefined
                  : () => reshape(insertCols(body(), spot.left), 'col', spot.left, 1, 'insert:col'),
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
                      reshape(
                        deleteRows(body(), spot.top, spot.bottom - spot.top + 1),
                        'row',
                        spot.top,
                        -(spot.bottom - spot.top + 1),
                        'delete:row',
                      ),
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
                      reshape(
                        deleteCols(body(), spot.left, spot.right - spot.left + 1),
                        'col',
                        spot.left,
                        -(spot.right - spot.left + 1),
                        'delete:col',
                      ),
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
              run: many(sel) ? () => change(fill(body(), sel, 'down', away), 'fill:down') : undefined,
            },
            {
              kind: 'button',
              id: 'e.fillright',
              label: 'Fill right',
              glyph: '→',
              run: many(sel) ? () => change(fill(body(), sel, 'right', away), 'fill:right') : undefined,
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
            {
              kind: 'button',
              id: 'i.chart',
              label: 'Chart',
              wide: true,
              run: many(sel) ? addChart : undefined,
            },
            {
              kind: 'button',
              id: 'i.pivot',
              label: 'Summarise',
              wide: true,
              run: nothing ? undefined : addPivot,
            },
            {
              kind: 'button',
              id: 'i.name',
              label: 'Name a block',
              wide: true,
              on: panel === 'names',
              run: () => setPanel((was) => (was === 'names' ? null : 'names')),
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
            {
              kind: 'button',
              id: 'd.filter',
              label: 'Filter',
              wide: true,
              on: panel === 'filter',
              run: nothing ? undefined : openFilter,
            },
            {
              kind: 'button',
              id: 'd.checks',
              label: broken.length ? `Check entries (${broken.length})` : 'Check entries',
              wide: true,
              on: panel === 'checks',
              run: () => setPanel((was) => (was === 'checks' ? null : 'checks')),
            },
            {
              kind: 'button',
              id: 'd.analyse',
              label: 'Analyse',
              wide: true,
              run: nothing ? undefined : analyseThis,
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
        onTitle={rename}
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

      {panel === 'checks' && (
        <CheckStrip
          checks={checks}
          selection={many(sel) ? rangeLabel(sel) : focus}
          broken={broken.length}
          brokenFor={(rule) => {
            const at = checkRanges.get(rule.id);
            return at ? broken.filter((a) => holds(at, a)).length : 0;
          }}
          onChecks={setChecks}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'names' && (
        <NameStrip
          names={names}
          selection={many(sel) ? rangeLabel(sel) : focus}
          sheetTitle={sheet.title}
          onNames={setNames}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'filter' && filter && (
        <FilterStrip
          sheet={sheet}
          over={over}
          filter={filter}
          column={onColumn ?? spot.left}
          hiddenCount={away.size}
          onColumn={setOnColumn}
          onFilter={setFilter}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'rules' && (
        <RuleStrip
          rules={rules}
          selection={many(sel) ? rangeLabel(sel) : focus}
          onRules={setRules}
          onClose={() => setPanel(null)}
        />
      )}

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
              /*
               * A hidden row is not drawn at all rather than drawn at zero
               * height. A zero-height row still holds focusable inputs, so
               * tabbing across the grid walks into cells nobody can see — and
               * an arrow key from the row above lands the cursor in one.
               */
              if (away.has(r)) return null;
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
                    /*
                     * A covered cell is not drawn at all.
                     *
                     * Not drawn rather than drawn empty: a `<td>` left in
                     * place would push the anchor's `colSpan` along and the
                     * row would be too wide, and an input inside it would be
                     * focusable — the same fault a zero-height hidden row has,
                     * a cursor landing somewhere nobody can see.
                     */
                    if (covered.has(address)) return null;
                    const span = spans.get(address);
                    return (
                      <Cell
                        key={c}
                        span={span}
                        sheet={sheet}
                        over={over}
                        rules={rules}
                        ruleRanges={ruleRanges}
                        check={checks.length ? checkAt(address) : undefined}
                        handle={address === corner ? fillHandle : undefined}
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

      <Pivots
        sheet={sheet}
        over={over}
        pivots={pivots}
        selection={many(sel) ? rangeLabel(sel) : rangeLabel(fullRange())}
        onPivots={setPivots}
        onPut={putPivot}
        onAdd={nothing ? undefined : addPivot}
      />

      <Charts
        sheet={sheet}
        over={over}
        charts={charts}
        selection={rangeLabel(sel)}
        onChange={setCharts}
        onAdd={many(sel) ? addChart : undefined}
      />

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
                // Said where the sum is, not beside the filter: this is the
                // sentence that stops somebody reading a filtered total as a
                // whole one.
                outOfSight
                  ? `${outOfSight} row${outOfSight === 1 ? '' : 's'} hidden, and not counted here`
                  : '',
                totals.count > 0 ? `Sum ${show(totals.sum)}` : `${totals.filled} filled`,
                totals.count > 0 ? `Average ${show(totals.average)}` : '',
                totals.count > 0 ? `Count ${totals.count}` : '',
                totals.count > 0 ? `Min ${show(totals.min)} · Max ${show(totals.max)}` : '',
                totals.wrong ? 'and something in it is an error' : '',
                broken.length
                  ? `${broken.length} cell${broken.length === 1 ? '' : 's'} on this sheet break a rule`
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : `${focus}${raw ? `: ${raw}` : ' is empty'}${
                isFormula(raw)
                  ? ` → ${answer}${wrong ? ' — that is what is wrong, not a value' : ''}`
                  : ''
              }${cursorBreaks ? ` — ${whyNotValue(cursorBreaks)}` : ''}`
        }
        zoom={zoom}
        onZoom={(by) => setZoom(stepZoom(zoom, by > 0 ? 1 : -1))}
      />
    </Page>
  );
}

/**
 * The pictures, under the grid that makes them.
 *
 * Under rather than beside, and in the page's own scroll rather than in a
 * panel: a chart is read *after* the numbers, by somebody who has just
 * finished typing them, and a floating window over a spreadsheet is the thing
 * every spreadsheet gets wrong. Nothing is drawn at all until somebody asks
 * for the first one, so a sheet of eight cells is still a sheet of eight
 * cells.
 *
 * Each chart's controls sit with it and edit it in place. There is no dialogue
 * in front of a new chart asking which four things it should be, because the
 * guess is right most of the time and wrong visibly — you can see it is wrong,
 * which is the fastest correction there is.
 */
function Charts({
  sheet,
  over,
  charts,
  selection,
  onChange,
  onAdd,
}: {
  sheet: SheetModel;
  /** The reading the grid is done under — see `over` in `Grid`. */
  over: Ctx;
  charts: ChartSpec[];
  /** What is selected in the grid now, for the "read this instead" button. */
  selection: string;
  onChange: (next: ChartSpec[]) => void;
  /** Absent when the selection is one cell, which is not a chart. */
  onAdd?: () => void;
}) {
  if (!charts.length) {
    return onAdd ? (
      <div style={{ marginTop: 'var(--sp-6)' }}>
        <ActionButton onClick={onAdd}>Chart {selection}</ActionButton>
      </div>
    ) : null;
  }

  const edit = (id: string, over: Partial<ChartSpec>) =>
    onChange(charts.map((c) => (c.id === id ? { ...c, ...over } : c)));

  return (
    <div style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>Charts</SectionLabel>
      {charts.map((chart) => (
        <ChartCard
          key={chart.id}
          sheet={sheet}
          over={over}
          chart={chart}
          selection={selection}
          onEdit={(over) => edit(chart.id, over)}
          onRemove={() => onChange(charts.filter((c) => c.id !== chart.id))}
        />
      ))}
      {onAdd ? (
        <div style={{ marginTop: 'var(--sp-5)' }}>
          {/*
            "Another way" rather than "too" when a chart of exactly these
            cells is already on the page — which is a real thing to want, a
            pie beside the columns, and not a mistake to be talked out of.
          */}
          <ActionButton onClick={onAdd}>
            {charts.some((c) => c.range === selection)
              ? `Chart ${selection} another way`
              : `Chart ${selection} too`}
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}

function ChartCard({
  sheet,
  over,
  chart,
  selection,
  onEdit,
  onRemove,
}: {
  sheet: SheetModel;
  over: Ctx;
  chart: ChartSpec;
  selection: string;
  onEdit: (over: Partial<ChartSpec>) => void;
  onRemove: () => void;
}) {
  const { say } = useStore();
  const hold = useRef<HTMLDivElement | null>(null);

  const savePicture = () => {
    const svg = hold.current?.querySelector('svg');
    if (!svg) return;
    download({
      name: pictureFileName(chart.title || `${sheet.title} ${chart.range}`),
      // The panel goes under it, or a chart saved on a dark ground opens as
      // light text on nothing.
      body: standalone(svg as SVGSVGElement, 'var(--app-panel)'),
      mime: 'image/svg+xml',
    });
    say('Picture saved.');
  };

  return (
    <Blueprint style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-5)' }}>
      <input
        className="bare"
        value={chart.title}
        onChange={(e) => onEdit({ title: e.target.value })}
        aria-label={`Title of the chart of ${chart.range}`}
        placeholder={`${CHART_LABELS[chart.kind]} of ${chart.range}`}
        style={{
          width: '100%',
          fontSize: 'var(--type-md)',
          background: 'transparent',
          border: 0,
          marginBottom: 'var(--sp-5)',
        }}
      />

      <div ref={hold}>
        <ChartPicture cells={sheet.cells} chart={chart} over={over} />
      </div>

      <Segmented
        options={CHART_KINDS.map((id) => ({ id, label: CHART_LABELS[id] }))}
        // The union rather than `string`, so a kind that is not one of the four
        // cannot reach the store through this picker.
        value={chart.kind}
        onChange={(kind) => onEdit({ kind })}
        style={{ marginTop: 'var(--sp-5)' }}
      />
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)' }}>
        {CHART_SAYS[chart.kind]}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--sp-4)',
          alignItems: 'center',
          marginTop: 'var(--sp-5)',
        }}
      >
        <label style={{ fontSize: 'var(--type-xs)', ...secondLine() }}>
          Reads{' '}
          <input
            className="bare"
            value={chart.range}
            onChange={(e) => onEdit({ range: e.target.value.toUpperCase() })}
            aria-label={`Which cells the chart of ${chart.range} reads`}
            size={9}
            style={{
              fontSize: 'var(--type-xs)',
              background: 'transparent',
              border: '1px solid var(--app-line)',
              borderRadius: 'var(--r-sm)',
              paddingBlock: 'var(--sp-2)',
              paddingInline: 'var(--sp-3)',
            }}
          />
        </label>
        {selection !== chart.range ? (
          <button type="button" className="btn" onClick={() => onEdit({ range: selection })}>
            Read {selection}
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 'var(--sp-4)' }}>
        <Toggle
          on={chart.headers}
          label="The top row names the series"
          onChange={() => onEdit({ headers: !chart.headers })}
        />
        <Toggle
          on={chart.labels}
          label="The left column names the categories"
          onChange={() => onEdit({ labels: !chart.labels })}
        />
      </div>

      <ToolRule />
      <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={savePicture}>
          Save the picture
        </button>
        <button type="button" className="btn" onClick={onRemove}>
          Remove this chart
        </button>
      </div>
    </Blueprint>
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
 * The names, as a strip over the grid.
 *
 * A name and where it points, and a field that says why a name was refused
 * rather than a button that stays disabled — "A1 is a cell, so it cannot also
 * be a name" is a thing somebody can act on, and a greyed-out Add is not.
 */
function NameStrip({
  names,
  selection,
  sheetTitle,
  onNames,
  onClose,
}: {
  names: NamedRange[];
  /** What is selected in the grid, which is what a new name will cover. */
  selection: string;
  sheetTitle: string;
  onNames: (next: NamedRange[]) => void;
  onClose: () => void;
}) {
  const [word, setWord] = useState('');
  const taken = names.some((n) => n.name.toLowerCase() === word.trim().toLowerCase());
  const why = word.trim() === '' ? '' : taken ? `${word.trim()} is already a name here.` : whyNotName(word);

  const add = () => {
    if (!nameUsable(word) || taken) return;
    const at = pointAt(selection, sheetTitle);
    if (!at) return;
    onNames([
      ...names,
      { name: word.trim(), ref: writeRef(sheetTitle, at.from, at.to), created: Date.now() },
    ]);
    setWord('');
  };

  return (
    <div className="fx fx-wrap" aria-label="Names">
      {names.map((named) => (
        <span
          key={named.name}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-3)',
            flex: '1 1 100%',
            alignItems: 'stretch',
          }}
        >
          <input
            className="fx-in"
            value={named.name}
            readOnly
            aria-label={`The name ${named.name}`}
            style={{ flex: '0 1 120px' }}
          />
          <input
            className="fx-in"
            value={named.ref}
            onChange={(e) =>
              onNames(
                names.map((n) => (n.name === named.name ? { ...n, ref: e.target.value.toUpperCase() } : n)),
              )
            }
            aria-label={`Which cells ${named.name} covers`}
            spellCheck={false}
          />
          <button
            type="button"
            className="rib-btn"
            aria-label={`Remove the name ${named.name}`}
            onClick={() => onNames(names.filter((n) => n.name !== named.name))}
          >
            ✕
          </button>
        </span>
      ))}

      <input
        className="fx-in"
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Name this block"
        aria-label={`A name for ${selection}`}
        spellCheck={false}
      />
      <button
        type="button"
        className="rib-btn rib-btn-wide"
        onClick={add}
        disabled={!nameUsable(word) || taken}
      >
        Name {selection}
      </button>
      {why && (
        <span style={{ fontSize: 'var(--type-xs)', ...secondLine(), flex: '1 1 100%' }}>{why}</span>
      )}
      <button type="button" className="rib-btn" aria-label="Close the names" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

/**
 * The pivots, under the grid that makes them.
 *
 * Under rather than beside, and in the page's own scroll, for the same reason
 * the charts are: a summary is read after the numbers, by somebody who has
 * just finished typing them.
 *
 * **Put it in cells** writes formulas, not the figures on screen — see
 * `lib/pivot.ts`. That is what makes the block stay live, chartable and
 * exportable, and it is why this panel has a button rather than a copy.
 */
function Pivots({
  sheet,
  over,
  pivots,
  selection,
  onPivots,
  onPut,
  onAdd,
}: {
  sheet: SheetModel;
  over: Ctx;
  pivots: Pivot[];
  selection: string;
  onPivots: (next: Pivot[]) => void;
  onPut: (pivot: Pivot) => void;
  /** Absent when the selection is one cell, which is not a table. */
  onAdd?: () => void;
}) {
  if (!pivots.length) {
    return onAdd ? (
      <div style={{ marginTop: 'var(--sp-6)' }}>
        <ActionButton onClick={onAdd}>Summarise {selection}</ActionButton>
      </div>
    ) : null;
  }

  const edit = (id: string, change: Partial<Pivot>) =>
    onPivots(pivots.map((p) => (p.id === id ? { ...p, ...change } : p)));

  return (
    <div style={{ marginTop: 'var(--sp-7)' }}>
      <SectionLabel>Summaries</SectionLabel>
      {pivots.map((pivot) => (
        <PivotCard
          key={pivot.id}
          sheet={sheet}
          over={over}
          pivot={pivot}
          onEdit={(change) => edit(pivot.id, change)}
          onPut={() => onPut(pivot)}
          onRemove={() => onPivots(pivots.filter((p) => p.id !== pivot.id))}
        />
      ))}
      {onAdd ? (
        <div style={{ marginTop: 'var(--sp-5)' }}>
          <ActionButton onClick={onAdd}>Summarise {selection} too</ActionButton>
        </div>
      ) : null}
    </div>
  );
}

function PivotCard({
  sheet,
  over,
  pivot,
  onEdit,
  onPut,
  onRemove,
}: {
  sheet: SheetModel;
  over: Ctx;
  pivot: Pivot;
  onEdit: (change: Partial<Pivot>) => void;
  onPut: () => void;
  onRemove: () => void;
}) {
  const read = useMemo(() => readPivot(sheet.cells, pivot, over), [sheet.cells, pivot, over]);
  const note = pivotNote(read);
  const at = corners(pivot.range);
  const columns: number[] = [];
  if (at) for (let c = at.left; c <= at.right; c += 1) columns.push(c);
  const shown = (n: number | null) => (n === null ? '' : show(Number(n.toFixed(10))));

  return (
    <Blueprint style={{ padding: 'var(--sp-6)', marginTop: 'var(--sp-5)' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--sp-4)',
          alignItems: 'center',
          marginBottom: 'var(--sp-5)',
          fontSize: 'var(--type-xs)',
        }}
      >
        <label style={secondLine()}>
          Group{' '}
          <select
            className="fx-in"
            value={String(pivot.by)}
            onChange={(e) => onEdit({ by: Number(e.target.value) })}
            aria-label={`Which column the summary of ${pivot.range} groups by`}
          >
            {columns.map((c) => (
              <option key={c} value={c}>
                {pivotHeading(sheet.cells, pivot, c, over)}
              </option>
            ))}
          </select>
        </label>
        <label style={secondLine()}>
          across{' '}
          <select
            className="fx-in"
            value={pivot.across === null ? '' : String(pivot.across)}
            onChange={(e) => onEdit({ across: e.target.value === '' ? null : Number(e.target.value) })}
            aria-label={`Which column the summary of ${pivot.range} spreads across`}
          >
            <option value="">nothing</option>
            {columns.map((c) => (
              <option key={c} value={c}>
                {pivotHeading(sheet.cells, pivot, c, over)}
              </option>
            ))}
          </select>
        </label>
        <label style={secondLine()}>
          <select
            className="fx-in"
            value={pivot.how}
            onChange={(e) => onEdit({ how: e.target.value as Aggregate })}
            aria-label={`What the summary of ${pivot.range} measures`}
          >
            {AGGREGATES.map((a) => (
              <option key={a} value={a}>
                {AGGREGATE_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        {pivot.how !== 'count' && (
          <label style={secondLine()}>
            of{' '}
            <select
              className="fx-in"
              value={String(pivot.of)}
              onChange={(e) => onEdit({ of: Number(e.target.value) })}
              aria-label={`Which column the summary of ${pivot.range} measures`}
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {pivotHeading(sheet.cells, pivot, c, over)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {read.trouble ? (
        <div style={{ fontSize: 'var(--type-sm)', ...secondLine(), textWrap: 'pretty' }}>
          {read.trouble}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ fontSize: 'var(--type-sm)' }}>
            <thead>
              <tr>
                <th scope="col">{pivotHeading(sheet.cells, pivot, pivot.by, over)}</th>
                {read.columns.map((c, i) => (
                  <th key={`${c}-${i}`} scope="col" style={{ textAlign: 'right' }}>
                    {c || AGGREGATE_LABELS[pivot.how]}
                  </th>
                ))}
                {read.columns.length > 1 && <th scope="col" style={{ textAlign: 'right' }}>Total</th>}
              </tr>
            </thead>
            <tbody>
              {read.rows.map((row, r) => (
                <tr key={`${row}-${r}`}>
                  <th scope="row">{row}</th>
                  {read.cells[r].map((cell, c) => (
                    <td key={c} style={{ textAlign: 'right' }}>
                      {shown(cell.value)}
                    </td>
                  ))}
                  {read.columns.length > 1 && (
                    <td style={{ textAlign: 'right' }}>{shown(read.rowTotals[r])}</td>
                  )}
                </tr>
              ))}
              <tr>
                <th scope="row">Total</th>
                {read.columnTotals.map((t, c) => (
                  <td key={c} style={{ textAlign: 'right' }}>
                    {shown(t)}
                  </td>
                ))}
                {read.columns.length > 1 && (
                  <td style={{ textAlign: 'right' }}>{shown(read.total)}</td>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {note && (
        <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), textWrap: 'pretty' }}>{note}</div>
      )}

      <ToolRule />
      <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={onPut} disabled={Boolean(read.trouble)}>
          Put it in cells
        </button>
        <button type="button" className="btn" onClick={onRemove}>
          Remove this summary
        </button>
      </div>
      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-4)', textWrap: 'pretty' }}>
        What goes in the cells is the arithmetic, not these figures — so it
        follows the marks, a chart can read it, and Excel recalculates it.
      </div>
    </Blueprint>
  );
}

/**
 * The filter, as a strip over the grid.
 *
 * One column at a time, with the rules already set listed as chips beside it.
 * Excel puts a dropdown on every heading; this app is 390 pixels wide, and
 * twelve dropdowns across a heading row is a heading row nobody can read. A
 * picker, a test and a box is the same power in the space there is.
 *
 * The count of hidden rows is here as well as on the status bar, because this
 * is where somebody is looking while they set it up — and because a filter
 * that hides nothing looks exactly like one that is not working.
 */
function FilterStrip({
  sheet,
  over,
  filter,
  column,
  hiddenCount,
  onColumn,
  onFilter,
  onClose,
}: {
  sheet: SheetModel;
  over: Ctx;
  filter: SheetFilter;
  column: number;
  hiddenCount: number;
  onColumn: (next: number) => void;
  onFilter: (next: SheetFilter | undefined) => void;
  onClose: () => void;
}) {
  const rule = filter.rules.find((r) => r.column === column);
  const test = rule?.test ?? 'contains';
  const heading = headingOf(sheet.cells, filter, column, over);
  const offered = valuesIn(sheet.cells, filter, column, over);

  const set = (over_: Partial<FilterRule>) =>
    onFilter(withRule(filter, { column, test, value: rule?.value ?? '', ...over_ }));

  return (
    <div className="fx fx-wrap" role="search" aria-label="Filter">
      <select
        className="fx-in"
        value={String(column)}
        onChange={(e) => onColumn(Number(e.target.value))}
        aria-label="Which column to filter"
      >
        {columnsIn(filter).map((c) => (
          <option key={c.column} value={c.column}>
            {headingOf(sheet.cells, filter, c.column, over)}
          </option>
        ))}
      </select>

      <select
        className="fx-in"
        value={test}
        onChange={(e) => set({ test: e.target.value as FilterRule['test'] })}
        aria-label={`How to filter ${heading}`}
      >
        {FILTER_TESTS.map((t) => (
          <option key={t} value={t}>
            {FILTER_LABELS[t]}
          </option>
        ))}
      </select>

      {test !== 'filled' && (
        <input
          className="fx-in"
          value={rule?.value ?? ''}
          onChange={(e) => set({ value: e.target.value })}
          placeholder={offered[0] ?? heading}
          aria-label={`What ${heading} must be`}
          list={`filter-values-${column}`}
          spellCheck={false}
        />
      )}
      {test === 'between' && (
        <input
          className="fx-in"
          value={rule?.value2 ?? ''}
          onChange={(e) => set({ value2: e.target.value })}
          placeholder="and"
          aria-label={`The far end of the band for ${heading}`}
          spellCheck={false}
        />
      )}
      {/* The values already in that column, offered rather than imposed: a
          column of four courses is four things to pick and a column of two
          hundred marks is still a box you can type into. */}
      <datalist id={`filter-values-${column}`}>
        {offered.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      {rule && (
        <button
          type="button"
          className="rib-btn rib-btn-wide"
          onClick={() => onFilter(withoutRule(filter, column))}
        >
          Clear {heading}
        </button>
      )}

      {filter.rules
        .filter((r) => r.column !== column)
        .map((r) => (
          <button
            key={r.column}
            type="button"
            className="rib-btn rib-btn-wide"
            onClick={() => onColumn(r.column)}
          >
            {saysFilter(r, headingOf(sheet.cells, filter, r.column, over))}
          </button>
        ))}

      <span style={{ fontSize: 'var(--type-xs)', ...secondLine(), alignSelf: 'center' }}>
        {hiddenCount
          ? `${hiddenCount} row${hiddenCount === 1 ? '' : 's'} hidden`
          : `${filter.range}, nothing hidden`}
      </span>

      <button
        type="button"
        className="rib-btn"
        aria-label="Take the filter off"
        onClick={() => {
          onFilter(undefined);
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * The colour rules, as a strip over the grid.
 *
 * Each rule is a row: what it watches, what it asks, and what colour it makes
 * the answer. Added against whatever is selected, because "these cells, under
 * sixty, red" is the sentence somebody is already saying in their head.
 */
function RuleStrip({
  rules,
  selection,
  onRules,
  onClose,
}: {
  rules: CondRule[];
  selection: string;
  onRules: (next: CondRule[]) => void;
  onClose: () => void;
}) {
  const edit = (id: string, over: Partial<CondRule>) =>
    onRules(rules.map((r) => (r.id === id ? { ...r, ...over } : r)));

  return (
    <div className="fx fx-wrap" aria-label="Colour rules">
      {rules.map((rule) => (
        <span
          key={rule.id}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--sp-3)',
            flex: '1 1 100%',
            alignItems: 'stretch',
          }}
        >
          <input
            className="fx-in"
            value={rule.range}
            onChange={(e) => edit(rule.id, { range: e.target.value.toUpperCase() })}
            aria-label={`Which cells the rule ${saysCond(rule)} watches`}
            spellCheck={false}
          />
          <select
            className="fx-in"
            value={rule.test}
            onChange={(e) => edit(rule.id, { test: e.target.value as CondTest })}
            aria-label={`What the rule on ${rule.range} asks`}
          >
            {COND_TESTS.map((t) => (
              <option key={t} value={t}>
                {COND_LABELS[t]}
              </option>
            ))}
          </select>
          {rule.test !== 'empty' && rule.test !== 'error' && (
            <input
              className="fx-in"
              value={rule.value}
              onChange={(e) => edit(rule.id, { value: e.target.value })}
              placeholder="60"
              aria-label={`What the rule on ${rule.range} compares against`}
              spellCheck={false}
            />
          )}
          {rule.test === 'between' && (
            <input
              className="fx-in"
              value={rule.value2 ?? ''}
              onChange={(e) => edit(rule.id, { value2: e.target.value })}
              placeholder="and"
              aria-label={`The far end of the band on ${rule.range}`}
              spellCheck={false}
            />
          )}
          <select
            className="fx-in"
            value={rule.ink}
            onChange={(e) => edit(rule.id, { ink: e.target.value as Ink })}
            aria-label={`What colour the rule on ${rule.range} makes it`}
          >
            {INKS.map((ink) => (
              <option key={ink} value={ink}>
                {INK_NAMES[ink]}
              </option>
            ))}
          </select>
          <select
            className="fx-in"
            value={rule.as}
            onChange={(e) => edit(rule.id, { as: e.target.value as CondRule['as'] })}
            aria-label={`Where the colour on ${rule.range} goes`}
          >
            <option value="wash">Behind it</option>
            <option value="ink">On the type</option>
          </select>
          <button
            type="button"
            className="rib-btn"
            aria-label={`Remove the rule on ${rule.range}`}
            onClick={() => onRules(rules.filter((r) => r.id !== rule.id))}
          >
            ✕
          </button>
        </span>
      ))}

      <button
        type="button"
        className="rib-btn rib-btn-wide"
        onClick={() => onRules([...rules, blankRule(selection)])}
      >
        Colour {selection}
      </button>
      <button type="button" className="rib-btn" aria-label="Close the colour rules" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

/**
 * What the cells in a block are allowed to hold, as a strip over the grid.
 *
 * It says what a rule is *for* rather than only setting it: the count of cells
 * currently breaking it is on the row, so somebody setting a rule over a
 * column that is already full finds out at once how much of it disagrees. A
 * rule that turns out to say forty cells are wrong is usually the rule being
 * wrong, and that is the moment to notice.
 */
function CheckStrip({
  checks,
  selection,
  broken,
  brokenFor,
  onChecks,
  onClose,
}: {
  checks: DataRule[];
  selection: string;
  /** How many cells on the whole sheet break any rule. */
  broken: number;
  /** How many break this one. */
  brokenFor: (rule: DataRule) => number;
  onChecks: (next: DataRule[]) => void;
  onClose: () => void;
}) {
  const edit = (id: string, over: Partial<DataRule>) =>
    onChecks(checks.map((c) => (c.id === id ? { ...c, ...over } : c)));

  return (
    <div className="fx fx-wrap" aria-label="What cells may hold">
      {checks.map((rule) => {
        const wrong = brokenFor(rule);
        return (
          <span
            key={rule.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--sp-3)',
              flex: '1 1 100%',
              alignItems: 'stretch',
            }}
          >
            <input
              className="fx-in"
              value={rule.range}
              onChange={(e) => edit(rule.id, { range: e.target.value.toUpperCase() })}
              aria-label={`Which cells the rule ${saysCheck(rule)} covers`}
              spellCheck={false}
              style={{ flex: '0 1 110px' }}
            />
            <select
              className="fx-in"
              value={rule.check}
              onChange={(e) => edit(rule.id, { check: e.target.value as Check })}
              aria-label={`What the rule on ${rule.range} asks for`}
            >
              {CHECKS.map((c) => (
                <option key={c} value={c}>
                  {CHECK_LABELS[c]}
                </option>
              ))}
            </select>
            {rule.check === 'list' && (
              <input
                className="fx-in"
                value={rule.values}
                onChange={(e) => edit(rule.id, { values: e.target.value })}
                placeholder="ECON, PSCI, BUS"
                aria-label={`The values ${rule.range} may hold, separated by commas`}
                spellCheck={false}
                style={{ flex: '1 1 180px' }}
              />
            )}
            {(rule.check === 'between' || rule.check === 'whole' || rule.check === 'decimal') && (
              <input
                className="fx-in"
                value={rule.min}
                onChange={(e) => edit(rule.id, { min: e.target.value })}
                placeholder="from"
                aria-label={`The lowest ${rule.range} may hold`}
                spellCheck={false}
                style={{ flex: '0 1 90px' }}
              />
            )}
            {(rule.check === 'between' ||
              rule.check === 'whole' ||
              rule.check === 'decimal' ||
              rule.check === 'length') && (
              <input
                className="fx-in"
                value={rule.max}
                onChange={(e) => edit(rule.id, { max: e.target.value })}
                placeholder={rule.check === 'length' ? 'characters' : 'to'}
                aria-label={
                  rule.check === 'length'
                    ? `The longest ${rule.range} may hold`
                    : `The highest ${rule.range} may hold`
                }
                spellCheck={false}
                style={{ flex: '0 1 90px' }}
              />
            )}
            <label
              style={{
                ...secondLine(),
                fontSize: 'var(--type-xs)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
              }}
            >
              <input
                type="checkbox"
                checked={rule.blankOk}
                onChange={(e) => edit(rule.id, { blankOk: e.target.checked })}
                aria-label={`Whether an empty cell in ${rule.range} is allowed`}
              />
              Empty is fine
            </label>
            <button
              type="button"
              className="rib-btn"
              aria-label={`Remove the rule on ${rule.range}`}
              onClick={() => onChecks(checks.filter((c) => c.id !== rule.id))}
            >
              ✕
            </button>
            {wrong > 0 && (
              <span style={{ fontSize: 'var(--type-xs)', ...secondLine(), flex: '1 1 100%' }}>
                {wrong} cell{wrong === 1 ? '' : 's'} in {rule.range} do
                {wrong === 1 ? 'es' : ''} not match this. Nothing has been changed — they are
                underlined in the grid.
              </span>
            )}
          </span>
        );
      })}

      <button
        type="button"
        className="rib-btn rib-btn-wide"
        onClick={() => onChecks([...checks, blankCheck(selection)])}
      >
        Check {selection}
      </button>
      {checks.length > 0 && broken === 0 && (
        <span style={{ fontSize: 'var(--type-xs)', ...secondLine(), flex: '1 1 100%' }}>
          Everything on this sheet matches its rule.
        </span>
      )}
      <button
        type="button"
        className="rib-btn"
        aria-label="Close what cells may hold"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}

/**
 * The box inside a cell: an input, or a textarea where the cell wraps.
 *
 * This is the whole of what wrapping cost. An `<input>` is a single line by
 * definition — there is no CSS that makes one fold — so a cell that wraps has
 * to be a different element, and the two take all the same props except that
 * one has a `value` attribute the browser writes and the other has a child.
 *
 * Only a wrapped cell pays for it. Every other cell in the app is the same
 * `<input>` it was, which matters because this component is `rows × cols` of
 * them and swapping the element type on a whole grid would remount every box
 * in it.
 *
 * `list` is dropped on the textarea rather than passed: a `datalist` does
 * nothing for one, and React would write an attribute the browser ignores.
 */
const Box = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  {
    wrap: boolean;
    className: string;
    list?: string;
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onFocus: () => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    'aria-label': string;
    'aria-invalid'?: true;
    spellCheck: false;
    style: React.CSSProperties;
  }
>(function Box({ wrap, list, 'aria-label': label, ...rest }, ref) {
  /*
   * The name is written out on each element rather than carried in the spread.
   *
   * `src/a11y/labels.ts` reads the source to find a control with no accessible
   * name, and it cannot see through `{...rest}` — so a label passed that way
   * is a real label the rule has to be told to ignore. Writing it here keeps
   * the rule honest about a component that is two elements.
   */
  if (wrap) {
    return (
      <textarea {...rest} aria-label={label} ref={ref as React.Ref<HTMLTextAreaElement>} />
    );
  }
  return (
    <input {...rest} aria-label={label} list={list} ref={ref as React.Ref<HTMLInputElement>} />
  );
});

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
  over,
  rules,
  ruleRanges,
  check,
  span,
  handle,
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
  /** The clock and the other sheets — see `over` in `Grid`. */
  over: Ctx;
  /** The colour rules on this sheet. Empty on nearly every sheet. */
  rules: CondRule[];
  /** Their ranges, parsed once by `Grid` rather than once per cell. */
  ruleRanges: Map<string, Range>;
  /**
   * What this cell is allowed to hold, where a rule covers it.
   *
   * Undefined on every cell of every sheet nobody has set one on, which is
   * what keeps the check off the hot path — see `lib/validate.ts`.
   */
  check?: DataRule;
  /**
   * How far this cell reaches, where it is the anchor of a joined block.
   *
   * Undefined on every ordinary cell, which is nearly all of them — see
   * `lib/joined.ts`.
   */
  span?: Span;
  /** The fill handle, on the one cell that is the corner of the selection. */
  handle?: ReactNode;
  address: string;
  inside: boolean;
  cursor: boolean;
  editing: boolean;
  /** In the row held under the headings, so it is drawn sticky. */
  frozen: boolean;
  zoom: number;
  hold: (el: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onWrite: (value: string) => void;
  onFocus: () => void;
  onExtend: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}) {
  const raw = sheet.cells[address] ?? '';
  const own = styleOf(sheet, address);
  const value = styledDisplay(sheet.cells, address, own, over);
  // Once, not twice: this is `rows × cols` components and the second call was
  // the same walk of the same formula tree for a second answer about it.
  const answer = evaluate(sheet.cells, address, new Set(), over);
  /*
   * The rules, laid over what somebody painted by hand.
   *
   * The rule wins, which is what Excel does and the only answer that makes a
   * rule worth setting — a rule you have to un-paint every cell to see is not
   * a rule. Only the properties it sets are taken, so a bold cell a rule turns
   * red stays bold. Skipped entirely on a sheet with no rules, which is nearly
   * every sheet and is `rows × cols` components not doing any of this.
   */
  const style = rules.length
    ? {
        ...own,
        ...painted(rules, (range) => holds(ruleRanges.get(range) ?? rangeOf(range), address), answer),
      }
    : own;
  const bad = isError(answer);
  /*
   * Whether this cell breaks the rule covering it, and what it may offer.
   *
   * The mark is a *claim about the value*, so it is worked out from the value
   * on every render like the colour rules are — nothing is stored, so nothing
   * can go stale. A list rule also offers its values: a `datalist` rather than
   * a `select`, because the cell has to stay a text box that anything can be
   * typed into. This offers; it does not confine.
   */
  const offers = check ? choicesOf(check) : [];
  const listId = offers.length ? `choices-${address}` : undefined;
  const breaks = check ? !allows(check, answer, raw) : false;
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
    <td
      className={
        [frozen ? 'sfreeze' : '', handle ? 'sfill-cell' : '', span ? 'sjoin' : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
      colSpan={span && span.cols > 1 ? span.cols : undefined}
      rowSpan={span && span.rows > 1 ? span.rows : undefined}
    >
      <Box
        wrap={style?.wrap ?? false}
        className={[
          'scell',
          inside && !cursor ? 'scell-in' : '',
          bad ? 'scell-bad' : '',
          breaks ? 'scell-breaks' : '',
          style?.wrap ? 'scell-wrap' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        list={listId}
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
        aria-label={
          breaks && check
            ? `Cell ${address} — ${whyNotValue(check)}`
            : `Cell ${address}`
        }
        aria-invalid={breaks || undefined}
        spellCheck={false}
        style={{
          // A joined block is one box as wide and as tall as the cells it
          // covers, so the text sits in the middle of the block rather than in
          // the corner of the cell that happens to anchor it.
          width: Math.round(92 * (span?.cols ?? 1) * (zoom / 100)),
          height: Math.round(26 * (span?.rows ?? 1) * (zoom / 100)),
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
      {listId && (
        <datalist id={listId}>
          {offers.map((choice) => (
            <option key={choice} value={choice} />
          ))}
        </datalist>
      )}
      {handle}
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
