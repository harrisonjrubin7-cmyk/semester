import { useMemo, useState } from 'react';
import { ScanIsbn } from '../components/ScanIsbn';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel } from '../components/ui';
import { TermSwitch } from '../components/TermSwitch';
import { CAMPUS_LINKS } from '../data/campus';
import {
  KINDS,
  forCourse,
  forTerm,
  kindOf,
  lastTime,
  line,
  money,
  readMoney,
  todo,
  total,
  type Kind,
} from '../lib/cost';
import { readTerm } from '../lib/term';

/**
 * What this term cost.
 *
 * The bookstore has been one tap away from the campus shelf since it was
 * linked, and nothing added up. Rent-versus-buy across four books is a
 * two-hundred-dollar decision made in a hurry in August with no numbers in
 * front of you — and made again next August with no memory of the last one.
 *
 * Nothing is fetched. Prices differ by edition, by seller and by the week,
 * the bookstore has no API a student can use, and a wrong price shown
 * confidently is worse than a blank field. You type what you paid; the app
 * does the arithmetic and remembers it, which is the part nobody can do in
 * their head eleven months later.
 */
export function Costs() {
  const { state, dispatch, catalog, courseCode } = useStore();

  const [what, setWhat] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<Kind>('book');
  const [rented, setRented] = useState(false);
  const [courseId, setCourseId] = useState(catalog.courses[0]?.id ?? '');
  const [bad, setBad] = useState('');

  const mine = useMemo(() => forTerm(state.costs, state.term), [state.costs, state.term]);
  const t = useMemo(() => total(mine), [mine]);
  const bookstore = state.linkUrls['bookstore-textbooks'] ||
    CAMPUS_LINKS.find((l) => l.id === 'bookstore-textbooks')?.url;

  const add = () => {
    const cents = readMoney(amount);
    if (cents === null) {
      setBad('That is not an amount the app can read. Try 64.99, or $65.');
      return;
    }
    if (!what.trim()) {
      setBad('Say what it was, so the list means something in December.');
      return;
    }
    dispatch({
      type: 'addCost',
      cost: {
        courseId,
        what: what.trim(),
        kind,
        cents,
        rented,
        backCents: 0,
        term: state.term,
      },
    });
    setWhat('');
    setAmount('');
    setRented(false);
    setBad('');
  };

  return (
    <div style={{ padding: 18 }}>
      <TermSwitch />

      <Blueprint style={{ padding: '15px 16px', marginTop: 12 }}>
        <div className="kicker">{readTerm(state.term).label}</div>
        <div
          className="chrome-text"
          style={{ fontSize: 'calc(24px * var(--text-scale, 1))', lineHeight: 1.15, marginTop: 6, textWrap: 'pretty' }}
        >
          {line(t)}
        </div>
        {todo(t) ? (
          <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>{todo(t)}</div>
        ) : null}
      </Blueprint>

      {catalog.courses.length > 0 && (
        <>
          <SectionLabel>By course</SectionLabel>
          {catalog.courses.map((c) => {
            const theirs = forCourse(mine, c.id);
            const sum = theirs.reduce((n, x) => n + x.cents, 0);
            const before = lastTime(state.costs, courseCode, c.id, state.term);
            return (
              <div
                key={c.id}
                style={{ padding: '11px 0', borderBottom: '1px solid var(--app-line)' }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span className="tag tag-accent" style={{ flex: 'none' }}>
                    {c.code}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6 }}>
                    {theirs.length === 0
                      ? 'nothing recorded'
                      : `${theirs.length} ${theirs.length === 1 ? 'thing' : 'things'}`}
                  </span>
                  <span
                    style={{
                      flex: 'none',
                      fontSize: 'calc(14px * var(--text-scale, 1))',
                      fontVariantNumeric: 'tabular-nums',
                      opacity: theirs.length === 0 ? 0.4 : 1,
                    }}
                  >
                    {/* A dash rather than $0.00, which reads as "this course
                        was free" rather than "nothing has been entered". */}
                    {theirs.length === 0 ? '—' : money(sum)}
                  </span>
                </div>
                {/* The comparison worth having in August. */}
                {before ? (
                  <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 4 }}>
                    {readTerm(before.term).label}: {money(before.cents)}
                  </div>
                ) : null}
                {theirs.map((x) => (
                  <div
                    key={x.id}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'baseline',
                      marginTop: 7,
                      paddingLeft: 10,
                      borderLeft: '2px solid var(--app-line)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                      {x.what}
                      <span style={{ opacity: 0.5 }}>
                        {' · '}
                        {kindOf(x.kind).label}
                        {x.rented ? ' · rented' : ''}
                        {x.backCents > 0 ? ` · ${money(x.backCents)} back` : ''}
                      </span>
                    </span>
                    <span style={{ flex: 'none', fontSize: 'calc(13px * var(--text-scale, 1))', fontVariantNumeric: 'tabular-nums' }}>
                      {money(x.cents)}
                    </span>
                    {!x.rented && kindOf(x.kind).resellable && x.backCents === 0 ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          const said = window.prompt(`What did you get back for ${x.what}?`, '');
                          const cents = said === null ? null : readMoney(said);
                          if (cents !== null) {
                            dispatch({ type: 'patchCost', id: x.id, patch: { backCents: cents } });
                          }
                        }}
                        style={{ flex: 'none', height: 28, fontSize: 'calc(11px * var(--text-scale, 1))', padding: '0 8px' }}
                      >
                        Sold
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="bare"
                      aria-label={`Remove ${x.what}`}
                      onClick={() => dispatch({ type: 'dropCost', id: x.id })}
                      style={{ width: 24, flex: 'none', opacity: 0.45, fontSize: 'calc(14px * var(--text-scale, 1))' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      <SectionLabel>Add something</SectionLabel>
      <select
        className="input"
        value={courseId}
        aria-label="Which course"
        onChange={(e) => setCourseId(e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
      >
        {catalog.courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.code}
          </option>
        ))}
      </select>

      <input
        className="input"
        value={what}
        aria-label="What it was"
        placeholder="Mankiw, Principles of Macroeconomics, 9e"
        onChange={(e) => setWhat(e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
      />

      {/* The one field a camera can fill in. The app still refuses to fetch a
          price — see the note at the foot of this screen — because that is a
          different question with a different answer. */}
      <ScanIsbn onFound={(isbn) => setWhat((was) => (was.trim() ? `${was} · ${isbn}` : isbn))} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          className="input"
          value={amount}
          aria-label="What it cost"
          placeholder="64.99"
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 110, flex: 'none' }}
        />
        <select
          className="input"
          value={kind}
          aria-label="What kind of thing"
          onChange={(e) => setKind(e.target.value as Kind)}
          style={{ flex: 1, minWidth: 0 }}
        >
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {kindOf(kind).resellable && (
        <button
          type="button"
          className="bare tappable"
          aria-pressed={rented}
          onClick={() => setRented((v) => !v)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '9px 11px',
            marginBottom: 8,
            borderRadius: 'var(--r-md)',
            border: `1px solid ${rented ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
            background: rented ? 'var(--app-accent-wash)' : 'transparent',
            fontSize: 'calc(13px * var(--text-scale, 1))',
          }}
        >
          Rented — it goes back rather than being sold
        </button>
      )}

      {bad ? (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-warn)', marginBottom: 8, lineHeight: 1.45 }}>
          {bad}
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={add}
        disabled={catalog.courses.length === 0}
        style={{ height: 44 }}
      >
        Add it
      </button>

      {bookstore ? (
        <a
          href={bookstore}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary btn-block"
          style={{
            height: 42,
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
          }}
        >
          Open the bookstore →
        </a>
      ) : null}

      <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 14, lineHeight: 1.45 }}>
        Nothing here is looked up. Prices differ by edition, by seller and by the week, and a wrong
        one shown confidently is worse than a blank field — so you type what you paid, and the app
        remembers it for the August when you are deciding again.
      </div>
      <div style={{ height: 26 }} />
    </div>
  );
}
