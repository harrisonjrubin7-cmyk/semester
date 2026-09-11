import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { CoursePicker } from '../components/CoursePicker';
import { DeadlinePicker } from '../components/DeadlinePicker';
import { forLine } from '../lib/forwork';
import { datedItems } from '../lib/select';
import { Equation } from '../components/Equation';
import { ActionButton, SectionLabel, Segmented } from '../components/ui';
import { Folding } from '../components/Fold';
import { secondLine } from '../lib/dim';
import {
  BIG,
  FORMULAS,
  SYMBOLS,
  fields,
  keepFrom,
  parse,
  plain,
  type Formula,
} from '../lib/maths';
import type { CourseId } from '../lib/types';

/**
 * Write an equation properly.
 *
 * A student in econ and statistics writes the same twenty formulas all term
 * and had nowhere in this app to put one. What went into a note was
 * `(P2-P1)/((P2+P1)/2)` — which is not what the syllabus prints, not what a
 * marker reads, and not something you can check at a glance three weeks later.
 *
 * ## Why a library rather than a blank box
 *
 * The blank box is why equation editors go unused: knowing that `\frac` exists
 * is a different skill from knowing the formula, and somebody who has to learn
 * the first before writing the second opens a different application. So the
 * screen opens on the formulas these courses actually use, each with its
 * symbols named — and the box is there for when you want to change one or
 * write your own.
 *
 * The named symbols are the part a picture of an equation loses and the part a
 * marker looks for. See `FORMULAS` in `lib/maths.ts`.
 *
 * ## What it will not do
 *
 * It will not compute, substitute or rearrange. `Sheet or table` does
 * arithmetic and says so; an equation renderer that quietly simplified would
 * be a second calculator nobody had tested.
 */
export function Equations() {
  const { state, dispatch } = useStore();
  const tab = state.mathTab;
  const setTab = (next: typeof tab) => dispatch({ type: 'setMathTab', tab: next });

  return (
    <Page blurb="On screen, into a document, or as one line you can paste anywhere. Nothing here computes — it writes.">
      <Segmented
        options={[
          { id: 'write', label: 'Write' },
          { id: 'library', label: 'Formulas' },
          { id: 'kept', label: `Kept${state.equations.length ? ` (${state.equations.length})` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 'var(--sp-7)' }}
      />
      {tab === 'write' ? <Writer /> : tab === 'library' ? <Library /> : <Kept />}
    </Page>
  );
}

// ── Writing one ──────────────────────────────────────────────────────────

/** The pieces of notation somebody reaches for, with what each does. */
const PIECES: { insert: string; label: string; says: string }[] = [
  { insert: '\\frac{a}{b}', label: 'a⁄b', says: 'Fraction' },
  { insert: 'x^{2}', label: 'x²', says: 'Power' },
  { insert: 'x_{i}', label: 'xᵢ', says: 'Subscript' },
  { insert: '\\sqrt{x}', label: '√x', says: 'Root' },
  { insert: '\\sum_{i=1}^{n} x_i', label: '∑', says: 'Sum' },
  { insert: '\\bar{x}', label: 'x̄', says: 'Mean' },
  { insert: '\\hat{p}', label: 'p̂', says: 'Estimate' },
  { insert: '\\times ', label: '×', says: 'Times' },
  { insert: '\\pm ', label: '±', says: 'Plus or minus' },
  { insert: '\\le ', label: '≤', says: 'At most' },
  { insert: '\\ge ', label: '≥', says: 'At least' },
  { insert: '\\approx ', label: '≈', says: 'About' },
  { insert: '\\Delta ', label: 'Δ', says: 'Change in' },
  { insert: '\\sigma ', label: 'σ', says: 'Sigma' },
  { insert: '\\mu ', label: 'μ', says: 'Mu' },
  { insert: '\\beta ', label: 'β', says: 'Beta' },
  { insert: '\\text{name}', label: 'abc', says: 'Words' },
];

function Writer() {
  const { state, dispatch, say } = useStore();
  const [latex, setLatex] = useState('');
  const [name, setName] = useState('');
  const [courseId, setCourseId] = useState<CourseId | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [allDeadlines, setAllDeadlines] = useState(false);

  const line = plain(parse(latex));
  const ready = latex.trim().length > 0;

  return (
    <>
      <textarea
        className="input"
        value={latex}
        onChange={(e) => setLatex(e.target.value)}
        placeholder="E_d = \frac{\Delta Q}{\Delta P}"
        aria-label="The equation"
        spellCheck={false}
        rows={3}
        style={{
          width: '100%',
          fontSize: 'var(--type-md)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-5)' }}>
        {PIECES.map((piece) => (
          <button
            key={piece.insert}
            type="button"
            className="bare tappable"
            aria-label={piece.says}
            title={piece.says}
            onClick={() => setLatex((was) => `${was}${was && !was.endsWith(' ') ? ' ' : ''}${piece.insert}`)}
            style={{
              width: 'auto',
              minWidth: 40,
              padding: 'var(--sp-3) var(--sp-5)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'var(--type-md)',
            }}
          >
            {piece.label}
          </button>
        ))}
      </div>

      <SectionLabel>How it reads</SectionLabel>
      {ready ? (
        <Blueprint style={{ padding: 'var(--sp-7)' }}>
          <Equation latex={latex} showPlain />
        </Blueprint>
      ) : (
        <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>
          Type something above, or start from a formula under Formulas. Anything this does not
          recognise comes through as the characters you typed rather than as an error.
        </div>
      )}

      <SectionLabel>Keep it</SectionLabel>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What it is called"
        aria-label="Name for this equation"
        style={{ width: '100%', height: 40 }}
      />
      <CoursePicker value={courseId} onChange={setCourseId} />
      {/* The problem set it was written out for, so it is beside that deadline
          the next time the same substitution is needed. */}
      <DeadlinePicker
        courseId={courseId}
        value={itemId}
        onChange={setItemId}
        showAll={allDeadlines}
        onShowAll={() => setAllDeadlines(true)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
        <ActionButton
          tone="primary"
          disabled={!ready}
          onClick={() => {
            dispatch({
              type: 'saveEquation',
              equation: { name, latex, note: '', courseId, itemId },
            });
            say(`${name.trim() || 'The equation'} is kept.`);
            setName('');
          }}
        >
          Keep it
        </ActionButton>
        <ActionButton
          disabled={!ready}
          onClick={() => {
            void navigator.clipboard?.writeText(line);
            say('Copied as one line.');
          }}
        >
          Copy as one line
        </ActionButton>
        <ActionButton
          disabled={!ready}
          onClick={() => {
            dispatch({
              type: 'makeDocument',
              doc: {
                title: name.trim() || 'Equation',
                subtitle: '',
                courseId,
                itemId,
                blocks: [{ kind: 'equation', latex, caption: name.trim() }],
              },
            });
            say('A document has been made with this equation in it.');
          }}
        >
          Put it in a new document
        </ActionButton>
      </div>

      {state.equations.length > 0 ? (
        <>
          <SectionLabel>Start from one you kept</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {state.equations.slice(0, 10).map((saved) => (
              <button
                key={saved.id}
                type="button"
                className="bare tappable"
                onClick={() => {
                  setLatex(saved.latex);
                  setName(saved.name);
                }}
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
        </>
      ) : null}

      <SectionLabel>The notation</SectionLabel>
      <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-relaxed)' }}>
        A small piece of LaTeX, which is what a textbook and a syllabus already write.{' '}
        <code>{'\\frac{a}{b}'}</code>, <code>x^2</code>, <code>x_i</code>, <code>{'\\sqrt{x}'}</code>,{' '}
        <code>{'\\text{words}'}</code>, and {Object.keys(SYMBOLS).length} named symbols —{' '}
        <code>{'\\alpha'}</code> through <code>{'\\Omega'}</code>, <code>{'\\le'}</code>,{' '}
        <code>{'\\approx'}</code>, <code>{'\\to'}</code>. The big operators —{' '}
        {Object.keys(BIG).map((b) => `\\${b}`).join(', ')} — take their limits with{' '}
        <code>_</code> and <code>^</code>.
      </div>
    </>
  );
}

// ── The library ──────────────────────────────────────────────────────────

function Library() {
  const { dispatch, say } = useStore();

  return (
    <>
      {fields().map((field) => (
        <Folding key={field} name={field}>
          <SectionLabel>{field}</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
            {FORMULAS.filter((f) => f.field === field).map((f) => (
              <FormulaCard
                key={f.id}
                formula={f}
                onKeep={() => {
                  dispatch({ type: 'saveEquation', equation: keepFrom(f) });
                  say(`${f.name} is kept.`);
                }}
              />
            ))}
          </div>
        </Folding>
      ))}
    </>
  );
}

function FormulaCard({ formula, onKeep }: { formula: Formula; onKeep: () => void }) {
  return (
    <Blueprint plain style={{ padding: 'var(--sp-6)' }}>
      <div style={{ fontSize: 'var(--type-md)' }}>{formula.name}</div>
      <div style={{ margin: 'var(--sp-6) 0' }}>
        <Equation latex={formula.latex} />
      </div>
      <div
        style={{
          ...secondLine(),
          fontSize: 'var(--type-sm)',
          lineHeight: 'var(--leading-relaxed)',
        }}
      >
        {formula.says}
      </div>
      <ul
        style={{
          ...secondLine(),
          fontSize: 'var(--type-sm)',
          margin: 'var(--sp-5) 0 0',
          paddingLeft: 'var(--sp-7)',
          lineHeight: 'var(--leading-relaxed)',
        }}
      >
        {formula.where.map((w) => (
          <li key={w.symbol}>
            <Equation latex={w.symbol} inline /> — {w.means}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 'var(--sp-6)' }}>
        <ActionButton onClick={onKeep}>Keep it</ActionButton>
      </div>
    </Blueprint>
  );
}

// ── What has been kept ───────────────────────────────────────────────────

function Kept() {
  const { state, dispatch, say, courseCode, catalog, now } = useStore();
  /* One list for the whole shelf — see the same note in `screens/Write.tsx`. */
  const items = useMemo(() => datedItems(catalog, now), [catalog, now]);

  if (state.equations.length === 0) {
    return (
      <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>
        Nothing kept yet. Anything you keep here turns up inside a document’s equation block, so
        you write a formula once a term rather than once a week.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
      {state.equations.map((saved) => (
        <Blueprint key={saved.id} plain style={{ padding: 'var(--sp-6)' }}>
          <div style={{ fontSize: 'var(--type-md)' }}>{saved.name}</div>
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-1)' }}>
            {[saved.courseId ? courseCode(saved.courseId) : 'Personal', forLine(items, saved.itemId)]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div style={{ margin: 'var(--sp-6) 0' }}>
            <Equation latex={saved.latex} showPlain />
          </div>
          {saved.note ? (
            <div style={{ ...secondLine(), fontSize: 'var(--type-sm)' }}>{saved.note}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() => {
                void navigator.clipboard?.writeText(plain(parse(saved.latex)));
                say('Copied as one line.');
              }}
            >
              Copy
            </ActionButton>
            <ActionButton
              onClick={() => {
                dispatch({ type: 'deleteEquation', id: saved.id });
                say('Removed.');
              }}
            >
              Remove
            </ActionButton>
          </div>
        </Blueprint>
      ))}
    </div>
  );
}
