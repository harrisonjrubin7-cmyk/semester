import { useId, useState, type ReactNode } from 'react';
import { dateProblem, localDay } from '../../lib/datefield';
import { formatDate } from '../../lib/locale';
import { FieldMessage, fieldProps } from '../FieldMessage';

/**
 * A date, asked for with the browser's own date control.
 *
 * Not a calendar of our own. The guide's rule is native semantics where they
 * exist, and a hand-built calendar grid is the widget most often broken for a
 * screen reader, a switch user and a phone's own picker — which the native
 * control gets right on every platform for free. What the native control does
 * not do is what this adds: a visible label, a hint, the range checked in
 * words (a keyboard user can type past `min` and `max`), and the message wired
 * the one way `FieldMessage` wires it.
 *
 * The value is `YYYY-MM-DD` or `''`, exactly as the control gives it.
 *
 * The problem shows once the person has left the box, or immediately when the
 * caller passes its own `error` (a failed submit). It does not nag mid-entry.
 */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  required = false,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  /** Always-visible help: the format, or what the date is for. */
  hint?: ReactNode;
  /** The caller's own complaint (a failed submit); it wins over the range check. */
  error?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [touched, setTouched] = useState(false);
  const say = (iso: string) => formatDate(localDay(iso), { day: 'numeric', month: 'long', year: 'numeric' });
  const problem = error ?? (touched ? dateProblem(value, { min, max, required }, say) : undefined);
  return (
    <div className="date-field">
      <label htmlFor={id} className="combo-label">
        {label}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {hint ? (
        <div id={hintId} className="combo-hint">
          {hint}
        </div>
      ) : null}
      <input
        {...fieldProps(id, problem, hint ? hintId : undefined)}
        // `id` is also in the spread; written out so `lint:labels` can see what the label points at.
        id={id}
        type="date"
        className="date-field-input"
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
      />
      <FieldMessage id={id} error={problem} />
    </div>
  );
}
