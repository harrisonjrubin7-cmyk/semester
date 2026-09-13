import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ZOOMS, live, showing, tidy, type Control, type Tab } from '../lib/ribbon';

/**
 * The spreadsheet's chrome: a ribbon, a formula bar, a tab strip, a status bar.
 *
 * Four pieces, drawn here rather than in `screens/Sheet.tsx`, because each of
 * them is a shape somebody already knows and the app's only job is to draw it
 * the way they know it. See `lib/ribbon.ts` for what a ribbon is for and why
 * it is a value; this is the drawing of that value plus the three bars that go
 * round the grid.
 *
 * ## Why every one of these exists
 *
 * A spreadsheet is four bars around a grid and each bar answers a question
 * that the grid itself cannot:
 *
 *   - the **ribbon**, because a cell has a dozen things you might do to it and
 *     they belong in named groups rather than in a row of fifteen;
 *   - the **formula bar**, because the cell is 92 pixels wide and
 *     `=SUMPRODUCT(B2:B9,C2:C9)` is not — and because the *name box* beside it
 *     is the only way to say where you are and go somewhere else in one move;
 *   - the **tab strip**, because the other sheet is one tap away in every
 *     spreadsheet ever written;
 *   - the **status bar**, because the commonest question anybody asks a
 *     spreadsheet — what does this column come to — should be answered by
 *     selecting it and looking, not by writing a `SUM` and deleting it again.
 *
 * ## The phone
 *
 * One rule, not two layouts: everything here scrolls sideways rather than
 * wrapping or folding. A ribbon that reflowed into four rows on a phone would
 * move every button somewhere new at the width where the screen is smallest,
 * and the group names — the whole point of a ribbon — would be the first
 * thing dropped. Scrolling keeps the order and keeps the names.
 */

export function Ribbon({
  tabs,
  on,
  onTab,
}: {
  tabs: Tab[];
  /** Which tab is open. Held by the screen so it survives a re-render. */
  on: string;
  onTab: (id: string) => void;
}) {
  const drawn = tidy(tabs);
  const open = showing(tabs, on);
  if (!open) return null;
  return (
    <div className="rib">
      <div className="rib-tabs" role="tablist" aria-label="Ribbon">
        {drawn.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="rib-tab"
            aria-selected={tab.id === open.id}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="rib-body" role="tabpanel" aria-label={`${open.label} tools`}>
        {open.groups.map((group) => (
          <div key={group.id} className="rib-group">
            <div className="rib-row">
              {group.controls.map((control) => (
                <Piece key={control.id} control={control} />
              ))}
            </div>
            {/*
              The name under the group, which is the cheapest documentation an
              interface can carry: four glyphs with `Number` under them are
              four glyphs somebody can guess at.
            */}
            <div className="rib-group-name">{group.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One control, whichever of the four kinds it is. */
function Piece({ control }: { control: Control }) {
  const dead = !live(control);
  if (control.kind === 'button') {
    return (
      <button
        type="button"
        className={control.wide ? 'rib-btn rib-btn-wide' : 'rib-btn'}
        title={control.label}
        aria-label={control.label}
        aria-pressed={control.on}
        disabled={dead}
        onClick={control.run}
      >
        {control.wide || !control.glyph ? control.label : control.glyph}
      </button>
    );
  }
  if (control.kind === 'pick') {
    return (
      <select
        className="rib-sel"
        aria-label={control.label}
        title={control.label}
        value={control.value}
        disabled={dead}
        onChange={(e) => control.onPick?.(e.target.value)}
      >
        {control.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (control.kind === 'slider') {
    return (
      <input
        type="range"
        className="rib-range"
        aria-label={control.label}
        title={control.label}
        min={control.min}
        max={control.max}
        step={control.step}
        value={control.value}
        disabled={dead}
        onChange={(e) => control.onSlide?.(Number(e.target.value))}
      />
    );
  }
  return <Swatches control={control} />;
}

/**
 * A colour button that opens its six colours.
 *
 * Six named colours rather than a wheel, for the reason given beside `Ink` in
 * `lib/sheet.ts`: this app is dark, a colour picked against white is
 * unreadable here, and a palette somebody can hold in their head is one they
 * use consistently. "None" is first, because taking a colour off is the
 * commonest thing anybody does with one.
 */
function Swatches({ control }: { control: Control & { kind: 'swatches' } }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div className="rib-swatch" ref={box}>
      <button
        type="button"
        className="rib-btn"
        title={control.label}
        aria-label={control.label}
        aria-expanded={open}
        disabled={!live(control)}
        onClick={() => setOpen((was) => !was)}
      >
        {control.glyph ?? control.label}
        <span
          aria-hidden="true"
          className="rib-swatch-now"
          data-ink={control.value ?? 'none'}
        />
      </button>
      {open && (
        <div className="rib-pop">
          <button
            type="button"
            className="rib-pop-item"
            onClick={() => {
              control.onPick?.(null);
              setOpen(false);
            }}
          >
            None
          </button>
          {control.options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="rib-pop-item"
              aria-pressed={control.value === o.id}
              onClick={() => {
                control.onPick?.(o.id);
                setOpen(false);
              }}
            >
              <span aria-hidden="true" className="rib-chip" data-ink={o.id} />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The name box and the formula bar.
 *
 * The name box does two jobs and both matter: it says where you are — `A1`, or
 * `B2:D9` for a block, which is how somebody checks the range they are about
 * to total is the range they meant — and typing a reference into it goes
 * there. The `fx` between them is not decoration: it is the mark every
 * spreadsheet puts at that spot, and it is what tells somebody the long box is
 * for a formula rather than for a note.
 */
export function FormulaBar({
  where,
  says,
  onGo,
  value,
  onChange,
  onKeyDown,
  mono,
}: {
  /** What the name box shows when nothing is being typed into it: `B2:D9`. */
  where: string;
  /** The whole of it said in words, for anybody listening. */
  says: string;
  /** A reference somebody typed and pressed Enter on. */
  onGo: (text: string) => void;
  value: string;
  onChange: (next: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Whether what is in the cell is a formula, and so drawn in a monospace. */
  mono: boolean;
}) {
  const [typed, setTyped] = useState('');
  return (
    <div className="fx">
      <input
        className="fx-name"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => setTyped('')}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          onGo(typed.trim());
          setTyped('');
        }}
        placeholder={where}
        aria-label={`${says}. Type a cell to go to it.`}
        spellCheck={false}
      />
      <span className="fx-mark" aria-hidden="true">
        fx
      </span>
      <input
        className={mono ? 'fx-in fx-mono' : 'fx-in'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label={`What is in ${where}`}
        spellCheck={false}
      />
    </div>
  );
}

/**
 * The tab strip along the bottom.
 *
 * It is the account's sheets rather than tabs inside one workbook, because
 * that is what this app has: an imported workbook's tabs each arrive as a
 * sheet of their own — see `lib/xlsxin.ts` — so the strip shows exactly what
 * the file had in it, with everything else alongside.
 */
export function SheetTabs({
  sheets,
  on,
  onGo,
  onNew,
}: {
  sheets: { id: string; title: string }[];
  on: string;
  onGo: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="stabs">
      {sheets.map((sheet) => (
        <button
          key={sheet.id}
          type="button"
          className="stab"
          aria-current={sheet.id === on ? 'true' : undefined}
          onClick={() => sheet.id !== on && onGo(sheet.id)}
        >
          {sheet.title || 'Untitled'}
        </button>
      ))}
      <button type="button" className="stab stab-new" aria-label="A new sheet" onClick={onNew}>
        +
      </button>
    </div>
  );
}

/**
 * The status bar: what the editor is doing, what the selection comes to, zoom.
 *
 * `Ready` and `Enter` are Excel's own two words and they answer a real
 * question — whether the next keystroke goes into the cell or moves the
 * cursor — which in a grid of real text inputs is the one thing somebody
 * cannot tell by looking.
 */
export function StatusBar({
  mode,
  stats,
  zoom,
  onZoom,
}: {
  mode: string;
  /** The five numbers under the selection, already worded. */
  stats: ReactNode;
  zoom: number;
  onZoom: (next: number) => void;
}) {
  return (
    <div className="sbar" role="status">
      <span className="sbar-mode">{mode}</span>
      <span className="sbar-stat">{stats}</span>
      <span className="sbar-zoom">
        <button
          type="button"
          className="sbar-btn"
          aria-label="Zoom out"
          disabled={zoom <= ZOOMS[0]}
          onClick={() => onZoom(-1)}
        >
          −
        </button>
        <span className="sbar-pc">{zoom}%</span>
        <button
          type="button"
          className="sbar-btn"
          aria-label="Zoom in"
          disabled={zoom >= ZOOMS[ZOOMS.length - 1]}
          onClick={() => onZoom(1)}
        >
          +
        </button>
      </span>
    </div>
  );
}
