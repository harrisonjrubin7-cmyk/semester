import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

const allowedHosts = new Set(['app.semester.com', 'staff.semester.com', 'institution.semester.com', 'external.semester.com', 'ops.semester.com', 'company.semester.com', 'developers.semester.com', 'semester.com']);

export function validateRoutes(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const screenRoutes = new Set(snapshot.screens.map((screen) => String(screen.route ?? '')));
  for (const capability of snapshot.capabilities) {
    for (const route of capability.routes) {
      const path = `capabilities.${capability.key}.routes`;
      const [host, ...segments] = route.split('/');
      if (!host || !allowedHosts.has(host) || segments.length === 0) issues.push({ code: 'invalid_route', path, message: `Route ${route} is outside the controlled experience hosts.` });
      if (seen.has(route)) issues.push({ code: 'duplicate_route', path, message: `Route ${route} is duplicated.` });
      if (!screenRoutes.has(route)) issues.push({ code: 'missing_screen', path, message: `Route ${route} has no screen registry record.` });
      seen.add(route);
    }
  }
  return issues;
}
