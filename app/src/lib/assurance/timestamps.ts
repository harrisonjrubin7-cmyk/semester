// The assurance contracts take ISO 8601 timestamps only. Date.parse alone also accepts
// locale forms such as 10/01/2026, which mean different days on different runtimes.
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoTimestamp(value: string): boolean {
  return ISO_8601.test(value) && !Number.isNaN(Date.parse(value));
}
