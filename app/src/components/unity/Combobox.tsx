import { useId, useState, type ReactNode } from 'react';
import { comboKey } from '../../lib/combobox';

export interface ComboOption {
  id: string;
  label: string;
  /** A second, quieter line: where it is, what it is. */
  detail?: string;
}

/**
 * A text box that offers matches while you type, and lets you pick one.
 *
 * For search and completion — the box is the control and the list is help. To
 * choose one of a few known options, use a native `<select>`: the guide's rule
 * is native semantics where they exist, and a combobox is for when they do not
 * (too many options to scan, or free text is allowed).
 *
 * The ARIA pattern for an editable combobox with list autocomplete: real focus
 * never leaves the box, `aria-activedescendant` names the row the arrow keys
 * are on, and `aria-expanded` follows the list. Keys are `lib/combobox.ts`'s.
 *
 * What it does not do, so a caller does not assume it:
 *
 * - **It does not filter.** `options` is what to offer, in order; the caller
 *   owns the matching and the ranking (`lib/typeahead.ts` is one).
 * - **It does not announce a result count.** The app's one live region is
 *   `useStore().say` and it is for outcomes, not for keystrokes; the active
 *   row is read as the cursor moves, which is the pattern's own feedback.
 * - **It does not keep history or recent items**, and it is not a menu.
 *
 * Rows take the pointer on `mousedown`, with the default prevented, so the box
 * keeps focus and a blur does not close the list before the click lands.
 */
export function Combobox({
  label,
  hideLabel = false,
  value,
  onValueChange,
  options,
  onChoose,
  placeholder,
  listLabel,
  children,
}: {
  label: string;
  /** Hide the label visually. It is still the box's accessible name. */
  hideLabel?: boolean;
  value: string;
  onValueChange: (text: string) => void;
  options: ComboOption[];
  onChoose: (option: ComboOption) => void;
  placeholder?: string;
  /** The list's name; defaults to the label. */
  listLabel?: string;
  /** A hint or message under the box, associated with it. */
  children?: ReactNode;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);

  // The list is only really open when there is something in it.
  const shown = open && options.length > 0;
  const active = shown && cursor >= 0 && cursor < options.length ? cursor : -1;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const choose = (i: number) => {
    onChoose(options[i]);
    setOpen(false);
    setCursor(-1);
  };

  return (
    <div className="combo">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'combo-label'}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        className="combo-input"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={shown ? listId : undefined}
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        aria-describedby={children ? hintId : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
          setCursor(-1);
        }}
        onBlur={() => {
          setOpen(false);
          setCursor(-1);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return; // an IME is still choosing characters
          const effect = comboKey({ open: shown, cursor: active, count: options.length, text: value }, e.key);
          if (effect.kind === 'none') return;
          e.preventDefault();
          if (effect.kind === 'move') {
            setOpen(effect.open);
            setCursor(effect.cursor);
          } else if (effect.kind === 'choose') {
            choose(effect.index);
          } else if (effect.kind === 'close') {
            // Escape puts the list away and leaves the text; the next one clears it.
            e.stopPropagation();
            setOpen(false);
            setCursor(-1);
          } else {
            e.stopPropagation();
            onValueChange('');
          }
        }}
      />
      {children ? (
        <div id={hintId} className="combo-hint">
          {children}
        </div>
      ) : null}
      {shown ? (
        <ul id={listId} role="listbox" aria-label={listLabel ?? label} className="combo-list">
          {options.map((o, i) => (
            <li
              key={o.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className="combo-option"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(i);
              }}
            >
              <span>{o.label}</span>
              {o.detail ? <span className="combo-detail">{o.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
