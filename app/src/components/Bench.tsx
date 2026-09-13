import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTier } from '../lib/media';
import { tidy, type Command, type Menu } from '../lib/menus';
import { Check, ChevronRight } from './Icons';

/**
 * The bar across the top of a screen that makes a file.
 *
 * Three screens in this app make one — `screens/Write.tsx`, `screens/Sheet.tsx`
 * and `screens/deck/Edit.tsx` — and each had invented its own furniture. The
 * title was an `<input class="input">` on two of them and absent on the third.
 * The exports were three buttons under "Take it away" on Write, four under the
 * same words on Sheet, and one button in a corner on the deck. Deleting the
 * thing you were editing was a full-width button at the bottom of the page,
 * below the export buttons, which is where nobody looks and is one thumb-slip
 * from Save.
 *
 * So all three now open the same way, and it is the way every editor opens:
 * the type's glyph, the title as the heading it is, a menu bar, a toolbar.
 * Nothing here is novel and that is the entire point — a student who has used
 * Word, Docs, Pages, Excel or Keynote has already learned this screen, and the
 * app gets that for the price of not inventing anything.
 *
 * ## The title is a heading that happens to be editable
 *
 * Drawn with no box until it is hovered or focused. A form field at the top of
 * a document is a form field you fill in once and then read past forty times,
 * and drawing a border round it for all forty is drawing the container instead
 * of the thing. `app.css` has the three states.
 *
 * ## The menus are a value, and the phone gets all of them
 *
 * `lib/menus.ts` holds the list and the rules; this draws it. Above 760px it
 * is the row of names everybody knows. Below, all of them fold into one
 * button, because eight words across a phone is either eight words too small
 * to read or a row that has to be dragged — and a menu you have to discover by
 * dragging is a menu that does not exist. Folded, nothing is lost: the panel
 * lists every menu under its own name, in order, with the same group rules.
 *
 * That is the whole responsive rule, and it is one rule rather than two
 * layouts. The title, toolbar and everything below are identical at every
 * width.
 */
export function Bench({
  mark,
  title,
  onTitle,
  titleLabel,
  placeholder,
  meta,
  menus,
  tools,
  actions,
}: {
  /** The type's glyph — the app's own icon for this kind of file. */
  mark?: ReactNode;
  title: string;
  onTitle: (next: string) => void;
  /** What a screen reader calls the title field. "Document title". */
  titleLabel: string;
  /** What an untitled one says. "Untitled document". */
  placeholder: string;
  /** The line under the title: a word count, a grid size, a running time. */
  meta?: ReactNode;
  menus: Menu[];
  /** The toolbar's contents — `Tool`, `ToolPick` and `ToolRule`, in a row. */
  tools?: ReactNode;
  /** The one control that leaves the editor. Drawn beside the title. */
  actions?: ReactNode;
}) {
  const drawn = tidy(menus);
  return (
    <div className="bench">
      <div className="bench-top">
        {mark && <span className="bench-mark">{mark}</span>}
        <input
          className="bench-title"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder={placeholder}
          aria-label={titleLabel}
          spellCheck={false}
        />
        {actions}
      </div>
      {drawn.length > 0 && <MenuBar menus={drawn} />}
      {tools && <div className="bench-tools">{tools}</div>}
      {meta && (
        <div className="bench-meta" role="status">
          {meta}
        </div>
      )}
    </div>
  );
}

/** The row of names, or the one button that stands for all of them. */
function MenuBar({ menus }: { menus: Menu[] }) {
  const phone = useTier() === 'phone';
  const [open, setOpen] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement | null>(null);

  /*
   * Closing on a press elsewhere, and on Escape.
   *
   * `pointerdown` rather than `click`: a menu that closes on click closes
   * *after* the press has already landed on whatever is underneath it, so
   * dismissing a menu by pressing a cell also types in that cell. Down is
   * when somebody has decided to go elsewhere.
   */
  useEffect(() => {
    if (open === null) return;
    const away = (e: PointerEvent) => {
      if (!bar.current?.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  if (phone) {
    const showing = open === 'all';
    return (
      <div ref={bar}>
        <button
          type="button"
          className="bench-name bench-name-all tappable"
          aria-expanded={showing}
          aria-haspopup="true"
          onClick={() => setOpen(showing ? null : 'all')}
        >
          Menu
          <ChevronRight size={12} style={{ transform: showing ? 'rotate(90deg)' : 'none' }} />
        </button>
        {showing && (
          <div className="bench-all">
            {menus.map((menu) => (
              <div key={menu.id}>
                <div className="bench-all-name">{menu.label}</div>
                <Items menu={menu} onDone={() => setOpen(null)} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bench-bar" ref={bar}>
      {menus.map((menu) => {
        const showing = open === menu.id;
        return (
          <div key={menu.id} className="bench-menu">
            <button
              type="button"
              className="bench-name"
              aria-expanded={showing}
              aria-haspopup="true"
              onClick={() => setOpen(showing ? null : menu.id)}
              // Once one is open, moving across the bar moves the menu — which
              // is how every menu bar since 1984 has behaved, and the reason
              // reading a bar costs one press rather than eight.
              onPointerEnter={() => setOpen((was) => (was === null ? was : menu.id))}
            >
              {menu.label}
            </button>
            {showing && (
              <div className="bench-pop">
                <Items menu={menu} onDone={() => setOpen(null)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** One menu's items, in their groups, with a rule between. */
function Items({ menu, onDone }: { menu: Menu; onDone: () => void }) {
  return (
    <>
      {menu.groups.map((group, at) => (
        <div key={at} className="bench-group">
          {group.map((item) => (
            <Item key={item.id} item={item} onDone={onDone} />
          ))}
        </div>
      ))}
    </>
  );
}

function Item({ item, onDone }: { item: Command; onDone: () => void }) {
  return (
    <button
      type="button"
      className="bench-item"
      disabled={item.disabled}
      // A tick is a state, not a label, so it is announced as one rather than
      // left for a sighted reader to infer from the mark in the gutter.
      aria-checked={item.on === undefined ? undefined : item.on}
      role={item.on === undefined ? undefined : 'menuitemcheckbox'}
      onClick={() => {
        item.run?.();
        onDone();
      }}
    >
      <span className="bench-tick" aria-hidden="true">
        {item.on ? <Check size={13} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {item.label}
        {item.hint && <span className="bench-item-hint">{item.hint}</span>}
      </span>
    </button>
  );
}

/**
 * One button on the toolbar.
 *
 * An icon where there is a good one and the word where there is not, and the
 * name is passed either way — a toolbar of unlabelled glyphs is the classic
 * way to make a screen unusable without a mouse and unreadable with a screen
 * reader. `title` gives the hover tip; `aria-label` gives the name.
 */
export function Tool({
  label,
  icon,
  onClick,
  pressed,
  disabled = false,
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  /** Present for the buttons that are states — Bold on, Outline showing. */
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="bench-tool"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ?? label}
    </button>
  );
}

/** The toolbar's dropdown — the style picker, the layout picker. */
export function ToolPick<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="bench-sel"
      aria-label={label}
      title={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** The hairline between two groups of tools. */
export function ToolRule() {
  return <span className="bench-rule" aria-hidden="true" />;
}
