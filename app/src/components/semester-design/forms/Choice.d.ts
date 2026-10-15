import * as React from 'react';
/**
 * Radio/checkbox row with a sentence explaining the consequence — used for visibility and sharing choices. Supports disabled reasons, errors and mixed checkboxes.
 */
export interface ChoiceProps { type?: "radio" | "checkbox"; label: string; about?: string; checked?: boolean; defaultChecked?: boolean; onChange?: (e: any) => void; name?: string; value?: string; disabled?: boolean; disabledReason?: string; error?: string; mixed?: boolean; required?: boolean; id?: string; }
export declare function Choice(props: ChoiceProps): JSX.Element;
