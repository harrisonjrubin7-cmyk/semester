/** A calculator connection, not a stored second copy of an assumption. */
export interface AssumptionAdapter {
  id: string;
  label: string;
  value: string;
  owner: 'student' | 'institution';
  source: string;
  /** Changes to calculator context discard an open draft. Never persisted. */
  context?: string;
  type?: 'number' | 'text' | 'date';
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  options?: readonly string[];
  validate: (value: string) => boolean;
  outcomes: (value: string) => string[];
  apply: (value: string) => boolean | void;
}

export function numericAssumption(input: Omit<AssumptionAdapter, 'value' | 'type' | 'validate' | 'outcomes' | 'apply'> & {
  value: number;
  min: number;
  max: number;
  outcomes: (value: number) => string[];
  apply: (value: number) => boolean | void;
}): AssumptionAdapter {
  return {
    ...input,
    value: String(input.value),
    type: 'number',
    validate: value => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= input.min && Number(value) <= input.max && (!input.step || Math.abs((Number(value) - input.min) / input.step - Math.round((Number(value) - input.min) / input.step)) < 1e-8),
    outcomes: value => input.outcomes(Number(value)),
    apply: value => input.apply(Number(value)),
  };
}
