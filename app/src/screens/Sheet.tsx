import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { ActionButton, EmptyState, SectionLabel } from '../components/ui';
import { ChevronRight, SheetIcon } from '../components/Icons';
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
  const { state, dispatch, courseCode, catalog } = useStore();
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  /*
   * The courses whose syllabus states weights this app can read. A course
   * whose grading is prose — "at the instructor's discretion" — is left out
   * rather than offered a calculator with blank weights in it, which would be
   * a sheet that looks like it knows something and does not.
   */
  const calculable = catalog.courses.filter(canBuild);

  return (
    <Page blurb="A grid you can type into and add up. Out as a real Excel file, a CSV, or a table for a document.">
      <ActionButton
        tone="primary"
        onClick={() => dispatch({ type: 'newSheet', courseId: null })}
        style={{ marginBottom: 'var(--sp-5)' }}
      >
        New sheet
      </ActionButton>

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
        <ActionButton onClick={() => setPasting(true)} style={{ marginBottom: 'var(--sp-7)' }}>
          Paste a table in
        </ActionButton>
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
              <Blueprint key={course.id} plain style={{ padding: 'var(--sp-5)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--type-md)' }}>{course.code}</div>
                    <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>
                      {course.grading.length}{' '}
                      {course.grading.length === 1 ? 'component' : 'components'} from the syllabus
                    </div>
                  </div>
                  <ActionButton
                    onClick={() => {
                      const { sheet } = gradeSheet(course, state.grades[course.id] ?? '');
                      dispatch({ type: 'makeSheet', sheet });
                    }}
                  >
                    Build it
                  </ActionButton>
                </div>
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
        <Folding name="Sheets">
          <SectionLabel>
            {state.sheets.length} {state.sheets.length === 1 ? 'sheet' : 'sheets'}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {state.sheets.map((sheet) => {
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--type-md)' }}>{sheet.title || 'Untitled sheet'}</div>
                    <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-1)' }}>
                      {[
                        sheet.courseId ? courseCode(sheet.courseId) : 'Personal',
                        size.rows === 0
                          ? 'empty'
                          : `${size.rows} × ${size.cols}`,
                        new Date(sheet.updated).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        }),
                      ].join(' · ')}
                    </div>
                  </div>
                  <ChevronRight size={16} />
                </Blueprint>
              );
            })}
          </div>
        </Folding>
      )}
    </Page>
  );
}

// ── The grid ─────────────────────────────────────────────────────────────

function Grid({ sheet }: { sheet: SheetModel }) {
  const { dispatch, say } = useStore();
  const [at, setAt] = useState<string | null>(null);
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

  const selected = at ? (sheet.cells[at] ?? '') : '';
  const shown = at ? display(sheet.cells, at) : '';
  const wrong = at ? isError(evaluate(sheet.cells, at)) : false;

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

      <SectionLabel>The grid</SectionLabel>
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
                  const raw = sheet.cells[address] ?? '';
                  const value = display(sheet.cells, address);
                  const bad = isError(evaluate(sheet.cells, address));
                  const editing = at === address;
                  return (
                    <td key={c} style={{ padding: 0 }}>
                      <input
                        className="input"
                        // The formula while the cell has focus, the answer
                        // when it does not — which is what a sheet is, and
                        // what makes a total something you can check rather
                        // than a number that appeared.
                        value={editing ? raw : value}
                        onChange={(e) => write(address, e.target.value)}
                        onFocus={() => setAt(address)}
                        onBlur={() => setAt((was) => (was === address ? null : was))}
                        aria-label={`Cell ${address}`}
                        spellCheck={false}
                        style={{
                          width: 92,
                          height: 32,
                          borderRadius: 0,
                          fontSize: 'var(--type-sm)',
                          fontVariantNumeric: 'tabular-nums',
                          color: bad ? 'var(--app-accent-bright)' : undefined,
                          fontFamily: isFormula(raw)
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
        {at
          ? `${at}${selected ? `: ${selected}` : ' is empty'}${
              isFormula(selected) ? ` → ${shown}${wrong ? ' — that is what is wrong, not a value' : ''}` : ''
            }`
          : 'A cell starting with = is a formula. SUM, AVERAGE, MEDIAN, STDEV, MIN, MAX, COUNT, IF, ROUND, SQRT and SUMPRODUCT are all here.'}
      </div>

      <SectionLabel>The grid’s size</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        <ActionButton
          disabled={sheet.rows >= MAX_ROWS}
          onClick={() => patch({ rows: Math.min(MAX_ROWS, sheet.rows + 5) })}
        >
          Five more rows
        </ActionButton>
        <ActionButton
          disabled={sheet.cols >= MAX_COLS}
          onClick={() => patch({ cols: Math.min(MAX_COLS, sheet.cols + 1) })}
        >
          Another column
        </ActionButton>
      </div>

      <SectionLabel>A sum, written for you</SectionLabel>
      <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-4)' }}>
        {at
          ? `Puts a formula in ${at}. Edit the range afterwards — it guesses the column above.`
          : 'Choose a cell first, and these will fill it in.'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
        {(
          [
            ['Total', (range: string) => `=SUM(${range})`],
            ['Average', (range: string) => `=AVERAGE(${range})`],
            ['Std deviation', (range: string) => `=STDEV(${range})`],
            ['Count', (range: string) => `=COUNT(${range})`],
          ] as const
        ).map(([label, build]) => (
          <ActionButton
            key={label}
            disabled={!at}
            onClick={() => {
              if (!at) return;
              const above = columnAbove(at);
              if (above) write(at, build(above));
            }}
          >
            {label}
          </ActionButton>
        ))}
        <ActionButton
          disabled={!at}
          onClick={() => {
            if (!at) return;
            const scores = columnAbove(at);
            const weights = columnAbove(at, 1);
            if (scores && weights) write(at, weighted(scores, weights));
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
