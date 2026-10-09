import * as React from 'react';
/** "Open in" row — the way from one object to every place it matters (Plan, Study, Calendar). */
export interface OpenInProps { targets: string[]; about: string; onOpen?: (t: string) => void; }
export declare function OpenIn(props: OpenInProps): JSX.Element;
