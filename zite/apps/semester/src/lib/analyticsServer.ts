// Server-only: the aggregate counts behind institution analytics and research snapshots. One place for this SQL, so a research
// snapshot and the analytics screen always mean the same thing. Raw counts never leave the server: callers pass them through
// lib/analytics.ts suppress() before returning anything.
import { zite } from 'zitejs/db';

export type Pair = { label: string; value: number };

export async function rawMetrics(institutionId: string): Promise<Record<string, Pair[]>> {
  const p = [institutionId];
  const q = (query: string) => zite.sql({ query, params: p }).then((r) => r.rows);
  const [members, enroll, reqs, holds, cases, plans] = await Promise.all([
    q(`SELECT r AS role, COUNT(*)::int AS n FROM "Memberships" m JOIN "InstitutionsMemberships" l ON l."membershipsId" = m.id,
     jsonb_array_elements_text(m."roles") r WHERE l."institutionsId" = $1 AND m."status" = 'Active' GROUP BY r`),
    q(`SELECT e."status" AS k, COUNT(*)::int AS n FROM "Enrollments" e JOIN "EnrollmentsSections" es ON es."enrollmentsId" = e.id
     JOIN "CoursesSections" cs ON cs."sectionsId" = es."sectionsId" JOIN "CoursesInstitutions" ci ON ci."coursesId" = cs."coursesId"
     WHERE ci."institutionsId" = $1 GROUP BY e."status"`),
    q(`SELECT r."state" AS k, COUNT(*)::int AS n FROM "RegistrationRequests" r JOIN "RegistrationRequestsInstitutions" l ON l."registrationRequestsId" = r.id
     WHERE l."institutionsId" = $1 GROUP BY r."state"`),
    q(`SELECT h."originatingOffice" AS k, COUNT(*)::int AS n FROM "StudentHolds" h JOIN "InstitutionsStudentHolds" l ON l."studentHoldsId" = h.id
     WHERE l."institutionsId" = $1 AND h."status" = 'Active' GROUP BY h."originatingOffice"`),
    q(`SELECT r."resultCode" AS k, COUNT(*)::int AS n FROM "RegistrationRequests" r JOIN "RegistrationRequestsInstitutions" l ON l."registrationRequestsId" = r.id
     WHERE l."institutionsId" = $1 AND r."state" = 'Rejected' GROUP BY r."resultCode"`),
    q(`SELECT p."status" AS k, COUNT(*)::int AS n FROM "PaymentPlanRequests" p JOIN "InstitutionsPaymentPlanRequests" l ON l."paymentPlanRequestsId" = p.id
     WHERE l."institutionsId" = $1 GROUP BY p."status"`),
  ]);
  const pairs = (rows: Record<string, unknown>[], key = 'k') => rows.map((r) => ({ label: String(r[key] ?? 'Unset'), value: Number(r.n) }));
  // Disclosure control (lib/analytics.ts): raw counts never leave the server; small cells are suppressed with a complement.
  const raw: Record<string, Pair[]> = { members_by_role: pairs(members, 'role'), enrollments_by_status: pairs(enroll), registration_requests: pairs(reqs),
    rejection_reasons: pairs(cases), holds_by_office: pairs(holds), payment_plans: pairs(plans) };
  return raw;
}

/** Size of a cohort: distinct active members holding any of the roles, optionally with an enrolled or completed class in a term. */
export async function cohortSize(institutionId: string, spec: { roles: string[]; term?: string }): Promise<number> {
  const term = spec.term?.trim();
  const { rows } = await zite.sql({
    query: `SELECT COUNT(DISTINCT m."member")::int AS n FROM "Memberships" m JOIN "InstitutionsMemberships" l ON l."membershipsId" = m.id
      WHERE l."institutionsId" = $1 AND m."status" = 'Active' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(m."roles") r WHERE r = ANY($2::text[]))
      ${term ? `AND EXISTS (SELECT 1 FROM "Enrollments" e JOIN "EnrollmentsSections" es ON es."enrollmentsId" = e.id JOIN "Sections" s ON s.id = es."sectionsId"
        WHERE e."student"::text = m."member"::text AND s."term" = $3 AND e."status" IN ('Enrolled', 'Completed'))` : ''}`,
    params: term ? [institutionId, spec.roles, term] : [institutionId, spec.roles],
  });
  return Number((rows[0] as { n: number } | undefined)?.n ?? 0);
}
