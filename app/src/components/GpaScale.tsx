/**
 * What a letter is worth, which the app had been assuming out loud.
 *
 * `lib/degree.ts` opens by saying why this cannot be hardcoded — universities
 * disagree about whether an A+ is 4.0 or 4.3, some award no minus grades at
 * all, and a few weight by course level — and ends the same paragraph with the
 * rule this component exists to keep:
 *
 * > A wrong GPA displayed confidently is worse than no GPA.
 *
 * `COMMON_SCALE` beside it is labelled "offered as a starting point", and
 * `setScale` has been in the reducer the whole time. Nothing dispatched it.
 * So the starting point was the finishing point: `screens/Degree.tsx` printed
 * a GPA computed against the common American table, said nothing about where
 * that table came from, and gave nobody a way to correct it. For a student at
 * a school that caps an A+ at 4.0, or does not give one, the number was
 * quietly wrong and looked exactly as sure as a right one.
 *
 * Two things fix that, and it takes both. The table is editable, and the
 * screen says which table it is. Neither alone is enough — an editor nobody
 * knows to look for does not stop a wrong number being believed, and a
 * disclaimer over a number you cannot change is an apology rather than a fix.
 *
 * ## The letters are the scale's own keys
 *
 * Not a fixed list of thirteen. A school with no minus grades should be able
 * to end up with a table that has none, so the rows are whatever the stored
 * scale holds, and removing one is how you say "we do not award that". A
 * grade that is not in the table is not counted rather than counted as zero —
 * `gpa()` already works that way, and reports the uncounted courses instead of
 * hiding them.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { COMMON_SCALE, isCommon, type Scale } from '../lib/degree';
import { Folding } from './Fold';

/** The letters in the order a transcript prints them, not the order of a hash. */
function letters(scale: Scale): string[] {
  const order = Object.keys(COMMON_SCALE);
  const known = order.filter((k) => k in scale);
  const extra = Object.keys(scale)
    .filter((k) => !order.includes(k))
    .sort();
  return [...known, ...extra];
}

export function GpaScale() {
  const { state, dispatch } = useStore();
  const scale = state.scale;
  const [adding, setAdding] = useState('');

  const set = (next: Scale) => dispatch({ type: 'setScale', scale: next });

  const put = (letter: string, raw: string) => {
    // An empty field is somebody midway through typing, not a zero. Holding it
    // at the old value until a number arrives keeps the GPA above from jumping
    // to nonsense between two keystrokes.
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n)) return;
    set({ ...scale, [letter]: Math.max(0, Math.min(10, n)) });
  };

  const drop = (letter: string) => {
    const next = { ...scale };
    delete next[letter];
    set(next);
  };

  const add = () => {
    const key = adding.trim().toUpperCase();
    if (!key || key in scale) return;
    set({ ...scale, [key]: 0 });
    setAdding('');
  };

  return (
    <Folding name="GpaScale">
      <SectionLabel style={{ margin: '24px 0 6px' }}>What a letter is worth</SectionLabel>

      <div
        style={{
          fontSize: 'calc(12.5px * var(--text-scale, 1))',
          color: 'var(--app-dim)',
          lineHeight: 'var(--leading-relaxed)',
          marginBottom: 'var(--sp-5)',
          textWrap: 'pretty',
        }}
      >
        {isCommon(scale)
          ? 'This is the common American table, which the app assumes until you say otherwise. Universities disagree — about whether an A+ is 4.0 or 4.3, and about whether minus grades exist at all — so check it against your registrar before trusting the GPA it produces.'
          : 'Your own table. The GPA on The degree is computed from these numbers.'}
      </div>

      {letters(scale).map((letter) => (
        <div
          key={letter}
          style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', marginBottom: 'var(--sp-3)' }}
        >
          <span
            style={{
              width: 44,
              flex: 'none',
              fontSize: 'var(--type-base)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {letter}
          </span>
          <input
            className="input"
            inputMode="decimal"
            defaultValue={String(scale[letter])}
            aria-label={`Grade points for ${letter}`}
            onChange={(e) => put(letter, e.target.value)}
            style={{ width: 84, height: 36, textAlign: 'center', fontSize: 'var(--type-base)' }}
          />
          <button
            type="button"
            className="bare"
            aria-label={`Remove ${letter} from the scale`}
            onClick={() => drop(letter)}
            style={{ width: 30, flex: 'none', color: 'var(--app-dim)', fontSize: 'var(--type-lg)' }}
          >
            ×
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', marginTop: 'var(--sp-5)', flexWrap: 'wrap' }}>
        <input
          className="input"
          value={adding}
          aria-label="A letter grade to add"
          placeholder="S"
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          style={{ width: 84, height: 34, textAlign: 'center', fontSize: 'var(--type-base)' }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={add}
          style={{ height: 34, fontSize: 'var(--type-sm)', padding: '0 11px', flex: 'none' }}
        >
          Add a grade
        </button>
        {isCommon(scale) ? null : (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => set({ ...COMMON_SCALE })}
            style={{ height: 34, fontSize: 'var(--type-sm)', padding: '0 11px', flex: 'none' }}
          >
            Back to the common table
          </button>
        )}
      </div>

      <p
        style={{
          fontSize: 'calc(11.5px * var(--text-scale, 1))',
          color: 'var(--app-dim)',
          marginTop: 'var(--sp-5)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        A grade that is not in this table is not counted rather than counted as a zero, and The
        degree lists the courses it could not count instead of quietly leaving them out. That is
        also how pass/fail and a withdrawal stay out of a GPA without needing a rule of their own.
      </p>
    </Folding>
  );
}
