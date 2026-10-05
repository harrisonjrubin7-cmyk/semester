/**
 * The adapters the scheduler may run against real connections.
 *
 * Empty, on purpose. No live provider adapter has been written, reviewed and
 * contract-tested yet, and the mocks in `src/lib/integration/mock-*.ts` are
 * fixtures that `runSync` refuses outside tests. Until an adapter is added
 * here, a scheduled tick finds every connection unregistered and runs nothing.
 *
 * Adding one is a reviewed change to this file: its declaration must validate,
 * it must not be a mock, and it must not claim a connection another adapter
 * already claims — `registry.test.ts` holds every entry to that.
 */
import type { RegisteredAdapter } from './tick.ts';

export const ADAPTERS: readonly RegisteredAdapter[] = [];
