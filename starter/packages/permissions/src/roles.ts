// Only the student role is implemented in this starter.
export const ROLE_GRANTS: Readonly<Record<string, readonly string[]>> = {
  student: [
    "student.today.read",
    "student.tasks.read",
    "student.tasks.create",
  ],
};

export function grantsForRole(roleKey: string | null): string[] {
  if (!roleKey) return [];
  return [...(ROLE_GRANTS[roleKey] ?? [])];
}
