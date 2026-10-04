/**
 * What a key does to an editable combobox with a list popup.
 *
 * Pure over a small state, like `a11y/modal.ts`'s ring arithmetic, so the part
 * that is easy to get subtly wrong is testable without a browser. Follows the
 * ARIA Authoring Practices pattern for an editable combobox with list
 * autocomplete, and `TopBar`'s existing behaviour (one Escape puts the list
 * away and keeps the text, a second clears it).
 *
 * `cursor` is the option the *virtual* focus is on, `-1` for none: real focus
 * stays in the text box the whole time (`aria-activedescendant`), because the
 * box is where the person is typing.
 *
 * Home and End are not here on purpose. In an editable box they move the text
 * caret, and taking them to jump the list would make the caret unreachable.
 */
export interface ComboState {
  open: boolean;
  cursor: number;
  count: number;
  text: string;
}

export type ComboEffect =
  | { kind: 'none' }
  /** Move or open the list; the key was handled, so stop it reaching the caret. */
  | { kind: 'move'; open: boolean; cursor: number }
  | { kind: 'choose'; index: number }
  | { kind: 'close' }
  | { kind: 'clear' };

const NONE: ComboEffect = { kind: 'none' };

export function comboKey(s: ComboState, key: string): ComboEffect {
  switch (key) {
    case 'ArrowDown':
      if (s.count === 0) return NONE;
      // Closed: open on the first row. Open: step down, and wrap past the last row to the first.
      if (!s.open) return { kind: 'move', open: true, cursor: 0 };
      return { kind: 'move', open: true, cursor: s.cursor + 1 >= s.count ? 0 : s.cursor + 1 };
    case 'ArrowUp':
      if (s.count === 0) return NONE;
      if (!s.open) return { kind: 'move', open: true, cursor: s.count - 1 };
      return { kind: 'move', open: true, cursor: s.cursor <= 0 ? s.count - 1 : s.cursor - 1 };
    case 'Enter':
      // With no row chosen Enter belongs to the form around the box, not to the list.
      return s.open && s.cursor >= 0 && s.cursor < s.count ? { kind: 'choose', index: s.cursor } : NONE;
    case 'Escape':
      if (s.open) return { kind: 'close' };
      return s.text !== '' ? { kind: 'clear' } : NONE;
    default:
      return NONE;
  }
}
