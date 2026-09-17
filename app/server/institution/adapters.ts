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
 *
 * ## The sandbox is not one of these, and that is deliberate
 *
 * `sandbox.ts` implements the same interface and runs a whole demonstration
 * course, and it is installed by `start.ts` behind its own environment
 * variable rather than added here. The two lists would mean opposite things:
 * an entry here says a school has approved this for real student records, and
 * the sandbox says none of what follows is real. Merging them would make this
 * array's emptiness — the thing every screen reads to say "prepare only" —
 * stop meaning anything, and put a demonstration one import away from a
 * deployment. `sandbox.test.ts` reads this file and fails if it stops being
 * empty or starts mentioning the sandbox.
 */
export const adapters: InstitutionAdapter[] = [];
