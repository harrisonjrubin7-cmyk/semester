import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Equation } from './Equation';
import { Blueprint } from './Blueprint';
import { ActionButton, SectionLabel, Toggle } from './ui';
import { Folding } from './Fold';
import { secondLine } from '../lib/dim';
import { free, read, text as showValue, value, type Val } from '../lib/calc';
import { FORMULAS, fields, type Formula } from '../lib/maths';
import { rightOf } from '../lib/plot';

/**
 * The calculator, and the thing that makes it worth having.
 *
 * A phone has a calculator on it already, so a second one that adds and
 * multiplies would be a waste of a screen. What this does that the one on the
 * home screen cannot: it takes the notation this app already writes — the
 * `\frac`, the greek, the subscripted names — so the formula in the library,
 * the formula in your notes and the formula you are working out are the same
 * piece of text, and filling one in is naming its letters rather than
 * retyping it as a line of brackets.
 *
 * That retyping is where the marks go. `\frac{Q_2 - Q_1}{(Q_2 + Q_1)/2}`
 * becomes `(Q2-Q1)/(Q2+Q1)/2` on a keypad — the brackets are dropped because
 * the screen is one line long — and the answer is wrong by a factor of two in
 * a way nobody sees, because it is a plausible number rather than an error.
 *
 * ## What it will not do
 *
 * It will not rearrange. This works a formula out at the values you give it;
 * solving one for a letter is symbolic algebra and a different program. When
 * what you need is the method rather than the number, `Work the problem` is
 * the screen for it, and it says so at the bottom of this one.
 */
export function Calculator() {
  const { state, dispatch, say } = useStore();
  /*
   * The working is in the store, not here.
   *
   * A formula half filled in is work: you write `\frac{FV}{(1 + r)^n}`, and
   * then go to Formulas to check whether the rate is per period or per year.
   * Held in this component, that trip empties the box — which is the reason
   * people keep a second calculator app open beside this one.
   */
  const source = state.mathWorking;
  const given = state.mathGiven;
  const setSource = (text: string) => dispatch({ type: 'writeMaths', text });
  const setGiven = (next: Record<string, string>) => dispatch({ type: 'writeMaths', given: next });
  const [degrees, setDegrees] = useState(false);
  const [tape, setTape] = useState<{ id: number; source: string; answer: string }[]>([]);
  const [name, setName] = useState('');

  const parsed = read(source);
  const last = tape[0];

  /**
   * The values typed into the boxes, as numbers.
   *
   * Each is read by the same engine as the expression, so `1/3`, `2\pi` and
   * `1.96` are all acceptable answers to "what is z" — which matters, because
   * the alternative is somebody rounding a third to 0.33 in the input box and
   * then wondering about the fourth figure of the answer.
   */
  const vars = useMemo(() => {
    const out: Record<string, Val> = {};
    if (last) {
      const prior = Number(last.answer);
      if (Number.isFinite(prior)) out.ans = prior;
    }
    for (const [key, written] of Object.entries(given)) {
      const got = read(written);
      if (!got.ok) continue;
      const v = value(got.node, { vars: out, degrees });
      if (Array.isArray(v) || Number.isFinite(v)) out[key] = v;
    }
    return out;
  }, [given, degrees, last]);

  // What still has no value: the boxes to draw, in the order they appear.
  const wanted = useMemo(
    () => (parsed.ok ? free(parsed.node, { vars: last ? { ans: 0 } : {} }) : []),
    [parsed, last],
  );

  const answer = parsed.ok ? value(parsed.node, { vars, degrees }) : null;
  const shown = answer === null ? '' : showValue(answer);
  const short = wanted.filter((w) => vars[w] === undefined);

  const insert = (piece: string) => dispatch({ type: 'writeMaths', text: `${source}${piece}`, given });

  const enter = () => {
    if (!parsed.ok || answer === null) return;
    if (!Array.isArray(answer) && !Number.isFinite(answer)) return;
    setTape((was) => [{ id: Date.now(), source, answer: shown }, ...was].slice(0, 30));
  };

  return (
    <>
      <textarea
        className="input"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="\frac{FV}{(1 + r)^n}"
        aria-label="What to work out"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        rows={2}
        style={{
          width: '100%',
          fontSize: 'var(--type-md)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
        {KEYS.map((key) => (
          <button
            key={key.insert}
            type="button"
            className="bare tappable"
            aria-label={key.says}
            title={key.says}
            onClick={() => insert(key.insert)}
            style={{
              width: 'auto',
              minWidth: 38,
              padding: 'var(--sp-3) var(--sp-5)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--app-line)',
              fontSize: 'var(--type-md)',
            }}
          >
            {key.label}
          </button>
        ))}
      </div>

      {source.trim() ? (
        <>
          <SectionLabel>How it reads</SectionLabel>
          <Blueprint style={{ padding: 'var(--sp-6)' }}>
            <Equation latex={source} />
          </Blueprint>
        </>
      ) : null}

      {/*
        Every letter keeps its box, filled or not.
        
        The first version drew a box only for what was still missing, so
        answering one made its box vanish — and a value you cannot see is a
        value you cannot check or correct, which is the whole job of this
        section. What changes when a letter is answered is the note below,
        not the row.
      */}
      {wanted.length > 0 ? (
        <>
          <SectionLabel>Its letters</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {wanted.map((letter) => (
              <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
                <span
                  style={{
                    minWidth: 72,
                    fontSize: 'var(--type-md)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                >
                  {letter}
                </span>
                <input
                  className="input"
                  aria-label={`Value for ${letter}`}
                  value={given[letter] ?? ''}
                  onChange={(e) => setGiven({ ...given, [letter]: e.target.value })}
                  placeholder="a number, or a sum"
                  inputMode="decimal"
                  style={{ flex: 1, minWidth: 0, height: 38, fontSize: 'var(--type-md)' }}
                />
              </div>
            ))}
          </div>
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-3)' }}>
            {short.length > 0
              ? `${short.join(', ')} still ${short.length === 1 ? 'has' : 'have'} no value. Anything left blank is left blank — nothing here fills one in for you.`
              : 'Each of these can be a number or a sum — 1/3 stays a third rather than becoming 0.333.'}
          </div>
        </>
      ) : null}

      <SectionLabel>It comes to</SectionLabel>
      <Blueprint style={{ padding: 'var(--sp-7)', textAlign: 'center' }}>
        <div
          aria-live="polite"
          style={{
            fontSize: 'var(--type-xl)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            wordBreak: 'break-word',
          }}
        >
          {parsed.ok ? (shown === '—' ? '—' : shown) : '—'}
        </div>
        {!parsed.ok && source.trim() ? (
          <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-warn)', marginTop: 'var(--sp-3)' }}>
            {parsed.fault}
          </div>
        ) : null}
        {parsed.ok && shown === '—' && source.trim() ? (
          <div style={{ ...secondLine(), fontSize: 'var(--type-sm)', marginTop: 'var(--sp-3)' }}>
            {short.length > 0
              ? `Give ${short.join(', ')} a value and this fills in.`
              : 'There is no answer at this value — a root of a negative, or a division by zero.'}
          </div>
        ) : null}
      </Blueprint>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
        <ActionButton tone="primary" disabled={!parsed.ok || shown === '—'} onClick={enter}>
          Keep this answer
        </ActionButton>
        <ActionButton
          disabled={!source.trim()}
          onClick={() => {
            void navigator.clipboard?.writeText(`${source} = ${shown}`);
            say('Copied.');
          }}
        >
          Copy it with its answer
        </ActionButton>
        <ActionButton
          disabled={!source.trim()}
          onClick={() => {
            dispatch({ type: 'addPlot', text: source });
            dispatch({ type: 'setMathTab', tab: 'graph' });
            say('It is on the graph.');
          }}
        >
          Put it on the graph
        </ActionButton>
      </div>

      <SectionLabel>Keep the formula</SectionLabel>
      <input
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What it is called"
        aria-label="Name for this formula"
        style={{ width: '100%', height: 40 }}
      />
      <ActionButton
        disabled={!source.trim()}
        style={{ marginTop: 'var(--sp-4)' }}
        onClick={() => {
          dispatch({
            type: 'saveEquation',
            equation: { name, latex: source, note: '', courseId: null, itemId: null },
          });
          say(`${name.trim() || 'The formula'} is kept.`);
          setName('');
        }}
      >
        Keep it
      </ActionButton>

      {tape.length > 0 ? (
        <>
          <SectionLabel>What you have worked out</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {tape.map((row) => (
              <button
                key={row.id}
                type="button"
                className="bare tappable"
                onClick={() => setSource(row.source)}
                style={{
                  textAlign: 'left',
                  padding: 'var(--sp-4) var(--sp-5)',
                  borderRadius: 'var(--r-sm)',
                  border: '1px solid var(--app-line)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 'var(--type-sm)',
                }}
              >
                <span style={{ color: 'var(--app-dim)' }}>{row.source}</span>
                <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>= {row.answer}</span>
              </button>
            ))}
          </div>
          <div style={{ ...secondLine(), fontSize: 'var(--type-xs)', marginTop: 'var(--sp-3)' }}>
            The last answer is <code>ans</code> in anything you type next.
          </div>
        </>
      ) : null}

      <SectionLabel>Work a formula from the library</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {fields().map((field) => (
          <Folding key={field} name={field}>
            <SectionLabel>{field}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {FORMULAS.filter((f) => f.field === field).map((f) => (
                <Pick key={f.id} formula={f} onPick={() => setSource(rightOf(f.latex))} />
              ))}
            </div>
          </Folding>
        ))}
      </div>

      <div style={{ marginTop: 'var(--sp-6)' }}>
        <Toggle on={degrees} label="Work in degrees rather than radians" onChange={() => setDegrees(!degrees)} />
      </div>

      {state.equations.length > 0 ? (
        <>
          <SectionLabel>Or one you kept</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {state.equations.slice(0, 10).map((saved) => (
              <button
                key={saved.id}
                type="button"
                className="bare tappable"
                onClick={() => setSource(rightOf(saved.latex))}
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
    </>
  );
}

function Pick({ formula, onPick }: { formula: Formula; onPick: () => void }) {
  return (
    <button
      type="button"
      className="bare tappable"
      onClick={onPick}
      style={{
        textAlign: 'left',
        padding: 'var(--sp-5) var(--sp-6)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--app-line)',
      }}
    >
      <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{formula.name}</span>
      <span style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
        <Equation latex={formula.latex} inline />
      </span>
    </button>
  );
}

/** The keys worth having on a phone, where a backslash is four taps away. */
const KEYS: { insert: string; label: string; says: string }[] = [
  { insert: '\\frac{}{}', label: 'a⁄b', says: 'Fraction' },
  { insert: '^{}', label: 'xʸ', says: 'Power' },
  { insert: '\\sqrt{}', label: '√', says: 'Root' },
  { insert: '(', label: '(', says: 'Open bracket' },
  { insert: ')', label: ')', says: 'Close bracket' },
  { insert: ' \\times ', label: '×', says: 'Times' },
  { insert: ' / ', label: '÷', says: 'Divide' },
  { insert: '\\pi', label: 'π', says: 'Pi' },
  { insert: 'e', label: 'e', says: 'Euler’s number' },
  { insert: '\\ln(', label: 'ln', says: 'Natural log' },
  { insert: '\\log(', label: 'log', says: 'Log base ten' },
  { insert: '\\sin(', label: 'sin', says: 'Sine' },
  { insert: '\\cos(', label: 'cos', says: 'Cosine' },
  { insert: '\\tan(', label: 'tan', says: 'Tangent' },
  { insert: '%', label: '%', says: 'Per cent' },
  { insert: '!', label: 'n!', says: 'Factorial' },
  { insert: 'mean()', label: 'mean', says: 'Mean of a list' },
  { insert: 'stdev()', label: 'sd', says: 'Standard deviation of a list' },
  { insert: '[1, 2, 3]', label: '[…]', says: 'A list of values' },
  { insert: '\\sum_{i=1}^{n} ', label: '∑', says: 'Sum over a counter' },
];
