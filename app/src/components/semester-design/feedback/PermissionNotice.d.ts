import * as React from 'react';
/**
 * States what changed about access, why, and where it is controlled.
 */
export interface PermissionNoticeProps { changed: string; why: string; controlLabel?: string; onControl?: () => void; }
export declare function PermissionNotice(props: PermissionNoticeProps): JSX.Element;
