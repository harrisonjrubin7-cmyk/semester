import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { ActionButton, FilePick, SectionLabel } from '../components/ui';
import { Bench, Tool, ToolRule } from '../components/Bench';
import { Gallery, type Starter } from '../components/Gallery';
import { SheetIcon } from '../components/Icons';
import { Folding } from '../components/Fold';
import { secondLine } from '../lib/dim';
import { download } from '../lib/deliver';
import {
  MAX_COLS,
  MAX_ROWS,
  colIndex,
  colName,
  display,
  extent,
  filled,
  fromRows,
  isError,
  isFormula,
  evaluate,
  readTable,
  ref,
  toCsv,
  toMarkdown,
  weighted,
  type Sheet as SheetModel,
} from '../lib/sheet';
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
 * ## Three ways out
 *
 * A real .xlsx with the formulas still in it, a CSV, and a Markdown table for
 * a document or a note. The .xlsx is the one that was missing and it matters:
 * a CSV of a gradebook is the answers with the working thrown away.
 */
export function Sheet() {
  const { state } = useStore();
  const open = state.sheets.find((s) => s.id === state.sheetId) ?? null;
  return open ? <Grid sheet={open} /> : <Shelf />;
}

function Shelf() {
  const { state, dispatch, catalog } = useStore();
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
   * A blank, then the sheets that are worth having the app build for you.
   *
   * Google's row is Blank, To-do list, Annual budget, Monthly budget — a
   * generic four that fit nobody. This app knows what a term contains, so the
   * row is a blank and then one starter per course whose syllabus states its
   * weights: the gradebook for that course, weighted the way the syllabus
   * weights it, with the marks left blank because the app has not been given
   * any.
   */
  const starters: Starter[] = [
    {
      id: 'blank',
      label: 'Blank spreadsheet',
      onPick: () => dispatch({ type: 'newSheet', courseId: null }),
    },
    ...calculable.map((course) => ({
      id: `grades-${course.id}`,
      label: `${course.code} gradebook`,
      blurb: `${course.grading.length} ${course.grading.length === 1 ? 'component' : 'components'}, weighted from the syllabus`,
      preview: <MiniGrid sheet={gradeSheet(course, state.grades[course.id] ?? '').sheet} />,
      onPick: () =>
        dispatch({
          type: 'makeSheet',
          sheet: gradeSheet(course, state.grades[course.id] ?? '').sheet,
          open: true,
        }),
    })),
  ];

  return (
    <Page blurb="A grid you can type into and add up. Out as a real Excel file, a CSV, or a table for a document. Every formula is computed on this device.">
      <Gallery
        startLabel="Start a new spreadsheet"
        starters={starters}
        recentLabel="Your spreadsheets"
        items={state.sheets}
        fallback="Untitled spreadsheet"
        onOpen={(sheet) => dispatch({ type: 'openSheet', id: sheet.id })}
        preview={(sheet) => <MiniGrid sheet={sheet} />}
        under={(sheet) => {
          const size = extent(sheet);
          return size.rows === 0 ? 'empty' : `${size.rows} × ${size.cols}`;
        }}
        shape="grid"
        empty={{
          title: 'No sheets yet',
          body: 'A gradebook, a problem set’s working, a budget. Everything is computed on this device.',
          icon: <SheetIcon />,
        }}
        aside={
          <div style={{ marginBottom: 'var(--sp-7)' }}>
            <Folding name="Open something you already have">
              <FilePick
                accept=".xlsx,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={reading}
                onPick={(picked) => void readFiles(picked)}
                style={{ marginBottom: 'var(--sp-4)' }}
              >
                {reading ? 'Reading…' : 'Open an Excel file or CSV'}
              </FilePick>

              {pasting ? (
                <Blueprint style={{ padding: 'var(--sp-6)' }}>
                  <div
                    style={{
                      ...secondLine(),
                      fontSize: 'var(--type-sm)',
                      marginBottom: 'var(--sp-4)',
                    }}
                  >
                    Paste a copy out of Excel or Google Sheets, a CSV, or a Markdown table. It works
                    out which it is.
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
                        dispatch({
                          type: 'makeSheet',
                          sheet: fromRows('Pasted table', rows),
                          open: true,
                        });
                        setPasting(false);
                        setPasted('');
                      }}
                    >
                      Read it in
                    </ActionButton>
                  </div>
                </Blueprint>
              ) : (
                <ActionButton onClick={() => setPasting(true)}>Paste a table in</ActionButton>
              )}

              {trouble !== '' && (
                <Blueprint style={{ padding: 'var(--sp-5)', marginTop: 'var(--sp-5)' }}>
                  <div style={{ fontSize: 'var(--type-sm)' }}>{trouble}</div>
                </Blueprint>
              )}

              {notes.length > 0 && (
                <Blueprint style={{ padding: 'var(--sp-5)', marginTop: 'var(--sp-5)' }}>
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
            </Folding>
          </div>
        }
      />
    </Page>
  );
}

/**
 * A sheet at thumbnail size: the top-left corner of it, as a real grid.
 *
 * Four columns and five rows, which is what fits and is enough to tell a
 * gradebook from a budget at a glance — the thing a row of identical grey
 * rectangles could not do.
 */
function MiniGrid({ sheet }: { sheet: Omit<SheetModel, 'id'> }) {
  // `filled` wants a whole sheet and a thumbnail may be drawn from one that
  // has not been made yet — the gradebook starters are built to be looked at
  // and only saved if pressed — so it is given an id it does not read.
  const rows = filled({ ...sheet, id: 'preview' }).slice(0, 5);
  if (rows.length === 0) return <SheetIcon size={20} />;
  return (
    <span className="paper" aria-hidden="true">
      {rows.map((row, r) => (
        <span key={r} className="paper-line">
          {row.slice(0, 4).join('  ')}
        </span>
      ))}
    </span>
  );
}

// ── The grid ─────────────────────────────────────────────────────────────

/** The five formulas the toolbar writes for you, and what each puts in the cell. */
const SUMS = [
  { id: 'total', label: 'Total', of: (range: string) => `=SUM(${range})` },
  { id: 'average', label: 'Average', of: (range: string) => `=AVERAGE(${range})` },
  { id: 'stdev', label: 'Std deviation', of: (range: string) => `=STDEV(${range})` },
  { id: 'count', label: 'Count', of: (range: string) => `=COUNT(${range})` },
] as const;

function Grid({ sheet }: { sheet: SheetModel }) {
  const { dispatch, say } = useStore();
  /*
   * Two different things, and they were one.
   *
   * `at` is the selected cell and survives the field losing focus; `typing` is
   * the cell the caret is actually in. Before the formula bar existed there
   * was no difference worth drawing, so one piece of state did both and was
   * cleared on blur — which is precisely what a formula bar cannot live with,
   * because reaching up to it blurs the cell it is about.
   */
  const [at, setAt] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (next: Partial<Omit<SheetModel, 'id'>>) =>
    dispatch({ type: 'updateSheet', id: sheet.id, patch: next });

  const write = (address: string, value: string) => {
    const cells = { ...sheet.cells };
    // Deleting rather than storing an empty string, so a sheet with four
    // values in it stays four entries however far the grid has been dragged.
    if (value === '') delete cells[address];
    else cells[address] = value;
    patch({ cells });
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

  const saveCsv = () => {
    download({
      name: sheetFileName(sheet.title).replace(/\.xlsx$/, '.csv'),
      body: toCsv(rows),
      mime: 'text/csv',
    });
    say('CSV saved.');
  };

  const raw = at ? (sheet.cells[at] ?? '') : '';
  const shown = at ? display(sheet.cells, at) : '';
  const wrong = at ? isError(evaluate(sheet.cells, at)) : false;

  /** Put a formula over the run of cells above the selected one. */
  const sum = (build: (range: string) => string) => {
    if (!at) return;
    const above = columnAbove(at);
    if (above) write(at, build(above));
  };

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
            hint: 'The formulas go with it, not just the answers.',
            run: nothing || busy ? undefined : () => void saveExcel(),
          },
          { id: 'file.csv', label: 'Download as CSV', run: nothing ? undefined : saveCsv },
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
            id: 'edit.clear',
            label: at ? `Clear ${at}` : 'Clear this cell',
            run: at && raw !== '' ? () => write(at, '') : undefined,
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
      id: 'insert',
      label: 'Insert',
      groups: [
        [
          {
            id: 'insert.rows',
            label: 'Five more rows',
            run:
              sheet.rows >= MAX_ROWS
                ? undefined
                : () => patch({ rows: Math.min(MAX_ROWS, sheet.rows + 5) }),
          },
          {
            id: 'insert.col',
            label: 'Another column',
            run:
              sheet.cols >= MAX_COLS
                ? undefined
                : () => patch({ cols: Math.min(MAX_COLS, sheet.cols + 1) }),
          },
        ],
        [
          ...SUMS.map((s) => ({
            id: `insert.${s.id}`,
            label: s.label,
            hint: at ? undefined : 'Choose a cell first.',
            run: at ? () => sum(s.of) : undefined,
          })),
          {
            id: 'insert.weighted',
            label: 'Weighted mark',
            hint: 'Scores in the column above, weights in the one to its right.',
            run: at
              ? () => {
                  const scores = columnAbove(at);
                  const weights = columnAbove(at, 1);
                  if (scores && weights) write(at, weighted(scores, weights));
                }
              : undefined,
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
                'A cell starting with = is a formula. SUM, AVERAGE, MEDIAN, STDEV, MIN, MAX, COUNT, IF, ROUND, SQRT and SUMPRODUCT are all here, computed on this device.',
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
        ],
      ],
    },
  ];

  return (
    <Page
      blurb={
        nothing
          ? 'Type into a cell. A cell starting with = is a formula.'
          : `${size.rows} × ${size.cols}`
      }
    >
      <Bench
        mark={<SheetIcon size={18} />}
        title={sheet.title}
        onTitle={(title) => patch({ title })}
        titleLabel="Sheet title"
        placeholder="Untitled spreadsheet"
        menus={menus}
        actions={
          <ActionButton
            onClick={() => dispatch({ type: 'closeSheet' })}
            style={{ width: 'auto', padding: '0 var(--sp-6)', flex: 'none' }}
          >
            All sheets
          </ActionButton>
        }
        tools={
          <>
            {SUMS.map((s) => (
              <Tool key={s.id} label={s.label} disabled={!at} onClick={() => sum(s.of)} />
            ))}
            <Tool
              label="Weighted mark"
              icon="Weighted"
              disabled={!at}
              onClick={() => {
                if (!at) return;
                const scores = columnAbove(at);
                const weights = columnAbove(at, 1);
                if (scores && weights) write(at, weighted(scores, weights));
              }}
            />
            <ToolRule />
            <Tool
              label="Five more rows"
              icon="+5 rows"
              disabled={sheet.rows >= MAX_ROWS}
              onClick={() => patch({ rows: Math.min(MAX_ROWS, sheet.rows + 5) })}
            />
            <Tool
              label="Another column"
              icon="+1 column"
              disabled={sheet.cols >= MAX_COLS}
              onClick={() => patch({ cols: Math.min(MAX_COLS, sheet.cols + 1) })}
            />
            <ToolRule />
            <Tool
              label={at ? `Clear ${at}` : 'Clear this cell'}
              icon="Clear"
              disabled={!at || raw === ''}
              onClick={() => at && write(at, '')}
            />
          </>
        }
      />

      <CoursePicker value={sheet.courseId} onChange={(id) => patch({ courseId: id })} />

      <SectionLabel>The grid</SectionLabel>
      {/*
       * The formula bar.
       *
       * The app had the same facts in a sentence under the grid — "B7: =SUM(B1:B6)
       * → 88" — which is honest and is not the same thing, because a sentence
       * cannot be typed into. On a phone a formula longer than the 92px cell
       * was a formula you could only edit by scrolling a text field with your
       * thumb. Here it is a full-width field, and it is the one place the raw
       * text of a cell is always visible whatever else has focus.
       */}
      <div className="fx">
        <span className="fx-where">{at ?? '—'}</span>
        <span className="fx-mark" aria-hidden="true">
          fx
        </span>
        <input
          className="fx-field"
          value={raw}
          disabled={at === null}
          onChange={(e) => at && write(at, e.target.value)}
          aria-label={at ? `What is in cell ${at}` : 'Choose a cell to edit it here'}
          placeholder={at === null ? 'Choose a cell' : ''}
          spellCheck={false}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th aria-label="Row numbers" style={{ width: 28 }} />
              {Array.from({ length: sheet.cols }, (_, c) => (
                <th
                  key={c}
                  scope="col"
                  style={{
                    ...secondLine(),
                    fontSize: 'var(--type-xs)',
                    fontWeight: 400,
                    padding: 'var(--sp-1)',
                  }}
                >
                  {colName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.rows }, (_, r) => (
              <tr key={r}>
                <th
                  scope="row"
                  style={{
                    ...secondLine(),
                    fontSize: 'var(--type-xs)',
                    fontWeight: 400,
                    padding: 'var(--sp-1)',
                    textAlign: 'right',
                  }}
                >
                  {r + 1}
                </th>
                {Array.from({ length: sheet.cols }, (_, c) => {
                  const address = ref(r, c);
                  const cell = sheet.cells[address] ?? '';
                  const value = display(sheet.cells, address);
                  const bad = isError(evaluate(sheet.cells, address));
                  const editing = typing === address;
                  return (
                    <td key={c} style={{ padding: 0 }}>
                      <input
                        className={`input${at === address ? ' cell-on' : ''}`}
                        // The formula while the cell has focus, the answer
                        // when it does not — which is what a sheet is, and
                        // what makes a total something you can check rather
                        // than a number that appeared.
                        value={editing ? cell : value}
                        onChange={(e) => write(address, e.target.value)}
                        onFocus={() => {
                          setAt(address);
                          setTyping(address);
                        }}
                        onBlur={() => setTyping((was) => (was === address ? null : was))}
                        aria-label={`Cell ${address}`}
                        spellCheck={false}
                        style={{
                          width: 92,
                          height: 32,
                          borderRadius: 0,
                          fontSize: 'var(--type-sm)',
                          fontVariantNumeric: 'tabular-nums',
                          color: bad ? 'var(--app-accent-bright)' : undefined,
                          fontFamily: isFormula(cell)
                            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
                            : undefined,
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        role="status"
        style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-5)' }}
      >
        {at && isFormula(raw)
          ? `${at} works out to ${shown}${wrong ? ' — and that is what is wrong, not a value' : ''}`
          : 'A cell starting with = is a formula. SUM, AVERAGE, MEDIAN, STDEV, MIN, MAX, COUNT, IF, ROUND, SQRT and SUMPRODUCT are all here.'}
      </div>

      <Sheets open={sheet} />
    </Page>
  );
}

/**
 * The strip of tabs along the bottom.
 *
 * Every spreadsheet has had one since 1985 and it does one thing: it says what
 * else is in here, without going back anywhere. This app keeps sheets as a flat
 * list rather than as tabs inside a workbook — an imported twelve-tab file
 * arrives as twelve sheets — so the strip is that list, which is the same
 * promise honestly kept: everything you have, one press away, with the one you
 * are in marked.
 *
 * It scrolls sideways and does not wrap, because a strip that grows to four
 * rows stops being furniture at the bottom of a grid.
 */
function Sheets({ open }: { open: SheetModel }) {
  const { state, dispatch } = useStore();
  if (state.sheets.length < 2) return null;
  return (
    <div className="tabstrip" role="tablist" aria-label="Your other sheets">
      {state.sheets.map((sheet) => (
        <button
          key={sheet.id}
          type="button"
          role="tab"
          className="tabstrip-tab"
          aria-selected={sheet.id === open.id}
          aria-current={sheet.id === open.id}
          onClick={() => dispatch({ type: 'openSheet', id: sheet.id })}
        >
          {sheet.title.trim() || 'Untitled spreadsheet'}
        </button>
      ))}
    </div>
  );
}

/**
 * The run of cells above the one selected, as a range.
 *
 * What "Total" means when somebody presses it at the bottom of a column, and a
 * guess rather than an answer — which is why what lands in the cell is the
 * formula rather than the number. They can see the range, and change it.
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
