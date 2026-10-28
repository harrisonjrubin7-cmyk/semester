// Server-only: the one place student-facing screens read holds from (the Student Holds record).
import { zite } from 'zitejs/db';
import { activeViews, type HoldView } from './holdRules';

export async function holdsFor(studentId: string): Promise<HoldView[]> {
  const { records } = await zite.studentHolds.findAll({ filters: { student: studentId, status: 'Active' }, limit: 50 });
  return activeViews(records as never);
}
