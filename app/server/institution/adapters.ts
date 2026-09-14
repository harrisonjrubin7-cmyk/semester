import type { InstitutionAdapter } from './adapter.ts';

/**
 * The approved adapters. There are none, and that is the point.
 *
 * An empty registry is not an unfinished feature — it is the honest state of
 * this app's relationship with any university, and every screen is written to
 * draw it correctly. `screens/University.tsx` says "prepare only" against all
 * thirty-seven services because this array is empty, and the moment it is not,
 * the same screen starts saying "connected" for whatever is in it.
 *
 * So adding an entry here is a serious act. It means a school has written an
 * adapter, tested it, and approved it for their students' real records. Until
 * then the gateway answers 503 for every service, which is the truth.
 *
 * The gateway builds its lookup from this array at construction. An adapter is
 * an explicitly installed server module — never a URL, a name or a class
 * chosen by anything in a request.
 */
export const adapters: InstitutionAdapter[] = [];
