/** Types for `stackcost.mjs`, which the test suite and the site tool call into. */
export interface StackRowInput {
  id: string;
  name: string;
  annualCost: number | string;
  contractEnds?: number | string | null;
  readyYear?: number | string | null;
  semesterAnnual: number | string;
  migrationOnce?: number | string;
  adminHours?: number | string;
}
export interface StackInput { escalation?: number | string; rows: StackRowInput[] }
export interface StackRow {
  id: string; name: string; annual: number; price: number; migration: number; hours: number;
  contractEnds: number; ready: number | null; switchYear: number | null; why: string;
}
export interface StackYear {
  year: number; current: number; remaining: number; semester: number; migration: number;
  withSemester: number; saving: number; cumulative: number; hours: number;
}
export interface StackResult {
  years: StackYear[]; rows: StackRow[]; totalCurrent: number; totalWith: number; totalSaving: number;
  hoursTotal: number; paybackMonth: number | null; switched: number;
}
export declare const HORIZON: number;
export declare function stackCalc(input: StackInput): StackResult;
export declare function stackCsv(input: StackInput, result: StackResult, statuses?: Record<string, string>): string;
export declare const INSTITUTION_TYPES: { id: string; name: string; scale: number }[];
export declare function exampleRow(scale?: number): { annualCost: number; contractEnds: number; readyYear: number; semesterAnnual: number; migrationOnce: number; adminHours: number };
