/** ISO dates are UTC; timestamp inputs must explicitly carry their timezone. */
export function instant(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(iso)) return null;
  const date = iso.slice(0, 10);
  const calendar = Date.parse(`${date}T00:00:00Z`);
  const time = Date.parse(iso);
  // Date.parse normalizes impossible days such as February 30; reject them.
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 10) !== date || !Number.isFinite(time)) return null;
  return time;
}
