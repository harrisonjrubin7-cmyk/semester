import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { ask, configured, provider } from '../lib/claude';
import {
  correlation,
  describe,
  fitReport,
  histogram,
  isNumeric,
  numbersIn,
  pairs,
  parseTable,
  regress,
  report,
  show,
  tally,
  type Table,
} from '../lib/stats';

/**
 * Data, analysed.
 *
 * The whole design is one decision: **every number on this page is computed by
 * code in `lib/stats.ts`, not by a language model.** Handing a spreadsheet to a
 * model and asking for the mean produces a figure that looks right and
 * sometimes is not, with no way to tell which from the answer. The formulas
 * here are tested against values worked out by hand.
 *
 * The model is given the finished statistics and asked what they mean — which
 * is the part it is good at, and the part a textbook cannot do for your data.
 * It never sees a column and reports a number.
 */
export function Analyse() {
  const { state, catalog } = useStore();
  const { guide } = useLive(state.guideId);

  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [xi, setXi] = useState(0);
  const [yi, setYi] = useState(1);
  const [reading, setReading] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const table: Table = useMemo(() => parseTable(text), [text]);
  const numericCols = useMemo(
    () => table.headers.map((_, i) => i).filter((i) => isNumeric(table, i)),
    [table],
  );

  const xValues = useMemo(() => numbersIn(table, xi), [table, xi]);
  const xSummary = useMemo(
    () => describe(xValues, table.rows.length - xValues.length),
    [xValues, table.rows.length],
  );
  const bothNumeric = numericCols.includes(xi) && numericCols.includes(yi) && xi !== yi;
  const both = useMemo(() => (bothNumeric ? pairs(table, xi, yi) : []), [table, xi, yi, bothNumeric]);
  const r = useMemo(() => (both.length ? correlation(both) : null), [both]);
  const fit = useMemo(() => (both.length ? regress(both) : null), [both]);
  const bins = useMemo(() => histogram(xValues, 12), [xValues]);
  const categories = useMemo(
    () => (numericCols.includes(xi) ? [] : tally(table.rows.map((row) => row[xi] ?? ''))),
    [table, xi, numericCols],
  );

  const load = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setError('');
    try {
      setText(await f.text());
      setName(f.name);
      setXi(0);
      setYi(1);
      setReading('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const interpret = async () => {
    if (busy || !xSummary) return;
    setBusy(true);
    setError('');
    setReading('');
    abort.current = new AbortController();
    let sofar = '';

    const facts = [
      `Rows: ${table.rows.length}. Columns: ${table.headers.join(', ')}.`,
      report(table.headers[xi] ?? 'x', xSummary),
      fit && bothNumeric
        ? fitReport(table.headers[xi] ?? 'x', table.headers[yi] ?? 'y', fit, r)
        : '',
      categories.length
        ? `Most common values of ${table.headers[xi]}: ${categories
            .map((c) => `${c.value} (${c.count})`)
            .join(', ')}`
        : '',
      catalog.courses.length ? `The course this is for: ${guide.code} — ${guide.name}.` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 1600,
        think: true,
        system: [
          'You are reading statistics a student has already computed from their own data. The',
          'numbers below were calculated by tested code, not by you.',
          '',
          '· Say what they mean in plain language: what is typical, how spread out it is, whether',
          '  the relationship is strong or weak, what the slope means in the units of the data.',
          '· Name what the numbers do NOT support. A correlation is not a cause; a t of 1.4 is not',
          '  a finding; an R² of 0.9 on twelve points is not much of one either.',
          '· Say which assumptions would need checking before this went in a paper, and how.',
          '· Never restate a number differently from how it is given, never compute a new',
          '  statistic yourself, and never guess at a figure that is not listed. If something',
          '  important is missing, say which statistic would be needed and where to get it.',
          '· Six sentences or so. No headings.',
        ].join('\n'),
        messages: [{ role: 'user', content: `What do these say?\n\n${facts}` }],
        onText: (chunk) => {
          sofar += chunk;
          setReading(sofar);
        },
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const stat = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', gap: 12 }}>
      <span style={{ fontSize: 12.5, opacity: 0.6 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Every number here is computed on this device by tested code, not guessed at by a model.
        {provider()} is given the finished statistics and asked what they mean — it never reads a column
        and reports a figure.
      </div>

      <SectionLabel>The data</SectionLabel>
      <input
        ref={file}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/plain"
        hidden
        onChange={(e) => {
          void load(e.target.files);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-block"
        onClick={() => file.current?.click()}
        style={{ height: 44 }}
      >
        Open a CSV
      </button>
      <textarea
        className="input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setName('');
        }}
        placeholder="…or paste it here. Straight out of a spreadsheet works — tabs are read too."
        style={{
          width: '100%',
          minHeight: 96,
          marginTop: 8,
          resize: 'vertical',
          fontSize: 12,
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      />
      {table.rows.length > 0 && (
        <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6 }}>
          {name ? `${name} · ` : ''}
          {table.rows.length} rows · {table.headers.length} columns · {numericCols.length} numeric
        </div>
      )}

      {error ? (
        <div style={{ fontSize: 13, marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      {table.headers.length > 0 && (
        <>
          <SectionLabel>Which column</SectionLabel>
          <select
            className="input"
            value={xi}
            onChange={(e) => setXi(Number(e.target.value))}
            style={{ width: '100%' }}
          >
            {table.headers.map((h, i) => (
              <option key={i} value={i}>
                {h || `Column ${i + 1}`}
                {isNumeric(table, i) ? '' : ' (text)'}
              </option>
            ))}
          </select>

          {numericCols.length > 1 && (
            <>
              <SectionLabel>Against, if you want a relationship</SectionLabel>
              <select
                className="input"
                value={yi}
                onChange={(e) => setYi(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                {table.headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Column ${i + 1}`}
                    {isNumeric(table, i) ? '' : ' (text)'}
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}

      {xSummary && (
        <>
          <SectionLabel>{table.headers[xi] || 'That column'}</SectionLabel>
          <Blueprint style={{ padding: '10px 14px' }}>
            {stat('n', String(xSummary.n))}
            {xSummary.missing > 0 ? stat('not a number', String(xSummary.missing)) : null}
            {stat('mean', show(xSummary.mean))}
            {stat('median', show(xSummary.median))}
            {stat('sd (sample, n−1)', show(xSummary.sd))}
            {stat('min · Q1 · Q3 · max', `${show(xSummary.min)} · ${show(xSummary.q1)} · ${show(xSummary.q3)} · ${show(xSummary.max)}`)}
            {stat('sum', show(xSummary.sum))}
          </Blueprint>

          {bins.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 92, marginTop: 12 }}>
              {bins.map((b, i) => {
                const tallest = Math.max(...bins.map((x) => x.count)) || 1;
                return (
                  <div
                    key={i}
                    title={`${show(b.from)}–${show(b.to)}: ${b.count}`}
                    style={{
                      flex: 1,
                      height: `${Math.max(2, (b.count / tallest) * 100)}%`,
                      background: 'var(--app-accent-deep)',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                );
              })}
            </div>
          )}
          {bins.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, opacity: 0.45, marginTop: 4 }}>
              <span>{show(xSummary.min)}</span>
              <span>{show(xSummary.max)}</span>
            </div>
          )}
        </>
      )}

      {categories.length > 0 && (
        <>
          <SectionLabel>{table.headers[xi] || 'That column'} — counts</SectionLabel>
          <Blueprint style={{ padding: '10px 14px' }}>
            {categories.map((c) => stat(c.value, String(c.count)))}
          </Blueprint>
        </>
      )}

      {fit && bothNumeric && (
        <>
          <SectionLabel>
            {table.headers[yi]} on {table.headers[xi]}
          </SectionLabel>
          <Scatter data={both} slope={fit.slope} intercept={fit.intercept} />
          <Blueprint style={{ padding: '10px 14px', marginTop: 10 }}>
            {stat('pairs used', String(fit.n))}
            {stat('slope', `${show(fit.slope)}  (se ${show(fit.se)})`)}
            {stat('intercept', show(fit.intercept))}
            {stat('t, df', `${show(fit.t, 2)}, ${fit.df}`)}
            {stat('R²', show(fit.r2))}
            {r === null ? null : stat('Pearson r', show(r))}
          </Blueprint>
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
            Rows where either column was blank were dropped, not read as zero. No p-value: turning
            t into one needs the incomplete beta function, and an approximation that is wrong in
            the tail — exactly where a p-value is read — would be worse than a table.
          </div>
        </>
      )}

      {xSummary && configured() && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => void interpret()}
            disabled={busy}
            style={{ height: 46, marginTop: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            {busy ? 'Reading them…' : 'What do these say?'}
          </button>
          {reading ? (
            <div
              style={{
                fontSize: 13.5,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                marginTop: 12,
                padding: 14,
                borderRadius: 'var(--r-lg)',
                border: '1px solid var(--app-line)',
                background: 'var(--app-panel)',
              }}
            >
              {reading}
            </div>
          ) : null}
        </>
      )}
      {xSummary ? <PrintButton label="Print this analysis" style={{ marginTop: 12 }} /> : null}
      <div style={{ height: 26 }} />
    </div>
  );
}

/**
 * The scatter, drawn by hand.
 *
 * A charting library for one plot of one shape is 200kB for something an SVG
 * does in thirty lines. The fitted line is drawn from the same slope and
 * intercept shown in the table, so the picture cannot disagree with the number.
 */
function Scatter({
  data,
  slope,
  intercept,
}: {
  data: { x: number; y: number }[];
  slope: number;
  intercept: number;
}) {
  const xs = data.map((p) => p.x);
  const ys = data.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const px = (v: number) => (x1 === x0 ? 50 : 6 + ((v - x0) / (x1 - x0)) * 88);
  // SVG y grows downward, which is why this subtracts.
  const py = (v: number) => (y1 === y0 ? 50 : 94 - ((v - y0) / (y1 - y0)) * 88);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label="Scatter plot with the fitted line"
      style={{
        width: '100%',
        height: 200,
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--app-line)',
        background: 'var(--app-panel)',
      }}
    >
      <line
        x1={px(x0)}
        y1={py(intercept + slope * x0)}
        x2={px(x1)}
        y2={py(intercept + slope * x1)}
        stroke="var(--app-warn)"
        strokeWidth="0.6"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((p, i) => (
        <circle
          key={i}
          cx={px(p.x)}
          cy={py(p.y)}
          r="1"
          fill="var(--app-accent)"
          opacity="0.75"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
