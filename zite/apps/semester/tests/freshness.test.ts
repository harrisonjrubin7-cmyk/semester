import { test, eq } from './harness';
import { freshnessOf, routeLoadError, STALE_AFTER_MS } from '../src/lib/freshness';

const T0 = 1_700_000_000_000;

test('nothing loaded yet is unknown, never stale', () => {
  eq(freshnessOf(null, T0), 'unknown');
  eq(freshnessOf(Number.NaN, T0), 'unknown');
});
test('just loaded is fresh; exactly at the threshold is stale', () => {
  eq(freshnessOf(T0, T0), 'fresh');
  eq(freshnessOf(T0, T0 + STALE_AFTER_MS - 1), 'fresh');
  eq(freshnessOf(T0, T0 + STALE_AFTER_MS), 'stale');
  eq(freshnessOf(T0, T0 + STALE_AFTER_MS * 4), 'stale');
});
test('a caller threshold wins; a clock behind the load time stays fresh', () => {
  eq(freshnessOf(T0, T0 + 1_000, 500), 'stale');
  eq(freshnessOf(T0, T0 - 5_000), 'fresh');
});
test('a failure with data on screen is a refresh error; without data it is the page error', () => {
  eq(routeLoadError(true, 'boom').error, null);
  eq(routeLoadError(true, 'boom').refreshError, 'boom');
  eq(routeLoadError(false, 'boom').error, 'boom');
  eq(routeLoadError(false, 'boom').refreshError, null);
});
