import * as React from 'react';
/**
 * Labelled input/textarea with associated hint and error — the label is always visible.
 * @startingPoint section="Forms" subtitle="Labelled input/textarea with associated hint and error — the label is always vis" viewport="700x400"
 */
export interface TextFieldProps {
  label: string; hint?: string; error?: string; multiline?: boolean; id?: string;
  value?: string; defaultValue?: string; placeholder?: string; onChange?: (e: any) => void;
  disabled?: boolean; readOnly?: boolean;
  /** Says "Required" in the label and sets aria-required. */
  required?: boolean; optional?: boolean;
  /** Shows a live "n / max" counter unless showCount is false. */
  maxLength?: number; showCount?: boolean;
  /** Short unit text inside the field edge, e.g. "$" or "h". */
  prefix?: React.ReactNode; suffix?: React.ReactNode;
  type?: string; autoComplete?: string; inputMode?: string; name?: string;
}
export declare function TextField(props: TextFieldProps): JSX.Element;
