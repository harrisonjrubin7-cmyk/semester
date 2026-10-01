/**
 * The vocabulary of the school's degree audit, typed.
 *
 * `supabase/migrations/20260930250000_degree_audit.sql` is the authority on
 * every limit and every state here, and `degreeaudit.test.ts` reads that file
 * and holds these constants equal to it. They exist so a screen can refuse
 * before a call, never so a screen can allow what the database would not.
 *
 * This is not `lib/degree.ts`, the calculator over requirements a student
 * types in. Nothing here reads or writes it.
 */

import type { AuditResult, Verdict } from './audit';

/** A limit the database enforces, repeated so a form can name it first. */
export const LIMITS = {
  title: 200,
  code: 40,
  requirementName: 200,
  passingGradesMax: 30,
  gradeLength: 6,
  requirementsMax: 60,
  acceptsMax: 100,
} as const;

export type ProgramState = 'draft' | 'published' | 'retired';

export const PROGRAM_STATES: readonly ProgramState[] = ['draft', 'published', 'retired'];

/** The two capabilities the database checks, both held on the school. */
export type DegreeCapability = 'degree:author' | 'degree:audit';

export interface Program {
  id: string;
  code: string;
  title: string;
  catalogYear: number;
  version: number;
  state: ProgramState;
  passingGrades: string[];
  publishedAt: string | null;
}

/** One audit as the database kept it. */
export interface AuditRecord {
  id: string;
  studentRef: string;
  programId: string;
  programCode: string;
  programTitle: string;
  catalogYear: number;
  programVersion: number;
  asOf: string;
  requestedBy: string | null;
  requestedAt: string;
  inputsSha256: string;
  inputsCount: number;
  verdict: Verdict;
  /** Null when what was kept is not in a shape this build can read; the screen says so. */
  result: AuditResult | null;
}
