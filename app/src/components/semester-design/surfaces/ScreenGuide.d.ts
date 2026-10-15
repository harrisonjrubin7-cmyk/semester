import * as React from 'react';
/** "About this screen" disclosure at the foot of every screen — what it is for, where its data comes from, who decides. */
export interface ScreenGuideProps { items: { q: string; a: string }[]; open?: boolean; }
export declare function ScreenGuide(props: ScreenGuideProps): JSX.Element;
