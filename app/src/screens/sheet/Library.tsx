import { useMemo, useState } from 'react';
import { FN_GROUPS, findFunctions, skeleton, type FnDoc, type FnGroup } from '../../lib/functions';

/**
 * The function list, which is the thing a spreadsheet is judged on and the
 * thing this one did not have.
 *
 * `lib/sheet.ts` understands 159 functions. The ribbon offered nineteen of
 * them and the Help menu said "and the scientific ones", which meant
 * `XLOOKUP`, `NETWORKDAYS`, `IPMT` and `PERCENTRANK` were all in there and
 * effectively did not exist: a function you cannot spell is a function you do
 * not have, because a misspelt name is `#NAME?` and the shortest way out of
 * `#NAME?` is to open Excel.
 *
 * Both of the programs this borrows from solve it the same way and have for
 * thirty years — a searchable list, grouped, with a line of prose per entry.
 * Excel calls it Insert Function; Sheets puts it under the sigma. This is
 * that, at the size of a phone.
 *
 * ## What pressing one does, and what it deliberately does not
 *
 * It writes `=NAME()` into the cell and leaves the brackets empty. Not a
 * wizard with a box per argument: what somebody needs from a function list is
 * the *spelling* — a misspelt name is a visible `#NAME?`, while a wrongly
 * guessed range is a number that looks right and gets handed in. The
 * arguments are written beside the name, where they can be read while typing.
 *
 * ## Why the search is over the prose too
 *
 * Nobody looking for `IPMT` types "ipmt". They type "interest", which is in
 * the line under it. `lib/functions.ts` ranks a name match above a
 * description match so that typing `sum` still puts `SUM` first — see
 * `findFunctions`.
 */
export function Library({
  onPick,
  onClose,
}: {
  /** The skeleton to write into the cell the cursor is in. */
  onPick: (formula: string, fn: FnDoc) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  /** Null is every shelf, which is what a search wants — it looks everywhere. */
  const [shelf, setShelf] = useState<FnGroup | null>(null);

  const rows = useMemo(() => {
    const found = findFunctions(query);
    return shelf ? found.filter((f) => f.group === shelf) : found;
  }, [query, shelf]);

  return (
    <div className="fnlib">
      <div className="fx" role="search">
        <input
          className="fx-in"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search — a name, or what you want it to work out"
          aria-label="Search the functions"
          spellCheck={false}
        />
        <button type="button" className="rib-btn" aria-label="Close the function list" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="fnlib-shelves">
        <button
          type="button"
          className="rib-btn rib-btn-wide"
          aria-pressed={shelf === null}
          onClick={() => setShelf(null)}
        >
          All
        </button>
        {FN_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            className="rib-btn rib-btn-wide"
            aria-pressed={shelf === g.id}
            title={g.blurb}
            onClick={() => setShelf(shelf === g.id ? null : g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="fnlib-count" role="status">
        {rows.length === 0
          ? 'Nothing here answers to that. The search reads the names and the descriptions both.'
          : `${rows.length} ${rows.length === 1 ? 'function' : 'functions'}${shelf ? ` · ${FN_GROUPS.find((g) => g.id === shelf)?.blurb ?? ''}` : ''}`}
      </div>

      <ul className="fnlib-list">
        {rows.map((fn) => (
          <li key={fn.name}>
            <button
              type="button"
              className="fnlib-row"
              onClick={() => onPick(skeleton(fn), fn)}
              aria-label={`Put ${fn.name} in the cell. ${fn.says}`}
            >
              <span className="fnlib-name">
                {fn.name}
                <span className="fnlib-args">({fn.args})</span>
              </span>
              <span className="fnlib-says">{fn.says}</span>
              <span className="fnlib-eg">{fn.example}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
