export interface IntelligenceSessionScope {
  tenantId: string;
  role: string;
  personId: string;
}

/** A transcript may continue only while all three authorization axes match. */
export function sameSessionScope(
  a: IntelligenceSessionScope,
  b: IntelligenceSessionScope,
): boolean {
  return a.tenantId === b.tenantId && a.role === b.role && a.personId === b.personId;
}
