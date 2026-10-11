import * as React from 'react';
/** "Who can see this?" — the one privacy pattern, with the same four answers in every module. */
export interface VisibilityPickerProps { value?: "only-me" | "course" | "collaborators" | "portfolio"; onChange?: (v: string) => void; allowed?: string[]; locked?: boolean; origin?: "student-entered" | "institution-provided" | "connected-system"; onLearnMore?: () => void; }
export declare function VisibilityPicker(props: VisibilityPickerProps): JSX.Element;
