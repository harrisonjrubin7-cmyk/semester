import * as React from 'react';
/** Floating pill during a focus session: time left, task, Pause/Resume, End (asks once inline when unsaved). */
export interface FocusBarProps { task: string; remaining?: string; onPause?: () => void; onResume?: () => void; onEnd?: () => void; breakDue?: string; paused?: boolean; unsaved?: boolean; }
export declare function FocusBar(props: FocusBarProps): JSX.Element;
