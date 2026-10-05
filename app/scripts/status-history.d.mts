/** Types for `status-history.mjs`, which the test suite calls into rather than reads as text. */
export type BarState = 'nodata' | 'up' | 'partial' | 'down';
export interface Cell { ok: number; total: number }
export interface History { version: 1; since: string | null; days: Record<string, Record<string, Cell>> }
export interface Bar { day: string; state: BarState; ok: number; total: number }
export interface Summary { bars: Bar[]; ok: number; total: number; percent: number | null; daysWithData: number }
export interface Incident {
  id: string; title: string; components: string[]; impact: 'down' | 'partial' | 'maintenance';
  started: string; resolved: string | null;
  updates: { at: string; status: 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'scheduled'; body: string }[];
}
export interface IncidentFile { updated: string; incidents: Incident[] }

export declare const DAYS: number;
export declare const COMPONENTS: { id: string; name: string; detail: string }[];
export declare const COMPONENT_IDS: string[];
export declare const FUNCTION_ANSWERS: Set<number>;
export declare const INCIDENT_STATUSES: string[];
export declare const INCIDENT_IMPACTS: string[];
export declare function dayKey(date: Date | string | number): string;
export declare function emptyHistory(): History;
export declare function barState(ok: number | undefined, total: number | undefined): BarState;
export declare function record(history: History, results: Record<string, boolean>, now?: Date | string | number): History;
export declare function prune(history: History, now?: Date | string | number, keep?: number): History;
export declare function summarise(history: History, now?: Date | string | number, days?: number): Record<string, Summary>;
export declare function probeAll(config: { app: string; supabase: string; key: string; origin?: string }, fetchImpl?: typeof fetch): Promise<Record<string, boolean>>;
export declare function incidentProblems(data: unknown): string[];
export declare function incidentDays(incident: Pick<Incident, 'started' | 'resolved'>, now?: Date | string | number): string[];
export declare function incidentFeed(data: IncidentFile, where: { site: string; feedUrl: string }): string;
