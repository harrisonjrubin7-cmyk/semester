/**
 * The adapters the scheduler may run against real connections.
 *
 * Only contract-tested, read-only adapters belong here. Registration makes an
 * adapter eligible; it does not activate a connection. Tenant approval,
 * production feature state, approved scope, connection credential reference,
 * and kill switches are still enforced by the worker and provider runtime.
 *
 * Adding one is a reviewed change to this file: its declaration must validate,
 * it must not be a mock, and it must not claim a connection another adapter
 * already claims — `registry.test.ts` holds every entry to that.
 */
import type { RegisteredAdapter } from './tick.ts';
import { CANVAS_READ_ADAPTER } from '../../../packages/platform/src/integrations/canvas-read-adapter.ts';

export const ADAPTERS: readonly RegisteredAdapter[] = [CANVAS_READ_ADAPTER];
