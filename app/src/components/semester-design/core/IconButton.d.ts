import * as React from 'react';
/**
 * Icon-only control with a required accessible name (also its tooltip).
 */
export interface IconButtonProps { icon: string; label: string; size?: "md" | "sm"; pressed?: boolean; onClick?: (e: any) => void; }
export declare function IconButton(props: IconButtonProps): JSX.Element;
