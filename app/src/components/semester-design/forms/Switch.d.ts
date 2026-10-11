import * as React from 'react';
/**
 * On/off setting that speaks its state as a word beside the track. pending blocks toggling while a save is in flight.
 */
export interface SwitchProps { checked?: boolean; onChange?: (v: boolean) => void; label: string; about?: string; disabled?: boolean; disabledReason?: string; pending?: boolean; onWord?: string; offWord?: string; id?: string; }
export declare function Switch(props: SwitchProps): JSX.Element;
