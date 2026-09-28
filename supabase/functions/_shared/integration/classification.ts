// Generated from app/src/lib/integration/classification.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * T0–T6 and where each may go.
 *
 * The same table the database seeds into `public.data_classification_rules`
 * as the platform floor. A school may be stricter (a tenant row), never looser
 * — the database refuses that, and `tighten` below refuses it in the same way,
 * so a client can never compute a route the server would not allow.
 */
export type DataClass = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export const DATA_CLASSES: readonly DataClass[] = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'];

export type Destination = 'semester' | 'approved_ai' | 'consumer_ai' | 'external_connector' | 'community';

export const DESTINATIONS: readonly Destination[] = [
  'semester',
  'approved_ai',
  'consumer_ai',
  'external_connector',
  'community',
];

export const CLASS_LABEL: Record<DataClass, string> = {
  T0: 'Public',
  T1: 'Course-authorized, non-sensitive',
  T2: 'Student-owned academic work',
  T3: 'Education record',
  T4: 'Regulated or sensitive student data',
  T5: 'Restricted research, IP or export-controlled',
  T6: 'Highly restricted',
};

export type ClassRoute = Record<Destination, boolean>;

/** The platform floor. Mirrors the seed in 20260927170000_integration_control_plane.sql. */
export const PLATFORM_ROUTES: Record<DataClass, ClassRoute> = {
  T0: { semester: true, approved_ai: true, consumer_ai: true, external_connector: true, community: true },
  T1: { semester: true, approved_ai: true, consumer_ai: false, external_connector: true, community: true },
  T2: { semester: true, approved_ai: true, consumer_ai: false, external_connector: false, community: true },
  T3: { semester: true, approved_ai: true, consumer_ai: false, external_connector: false, community: false },
  T4: { semester: false, approved_ai: false, consumer_ai: false, external_connector: false, community: false },
  T5: { semester: false, approved_ai: false, consumer_ai: false, external_connector: false, community: false },
  T6: { semester: false, approved_ai: false, consumer_ai: false, external_connector: false, community: false },
};

/** Whether data of this class may go to this destination, with a school's own rules applied. */
export function routeAllowed(
  cls: DataClass,
  dest: Destination,
  tenant?: Partial<Record<DataClass, Partial<ClassRoute>>>,
): boolean {
  const floor = PLATFORM_ROUTES[cls]?.[dest] ?? false;
  if (!floor) return false;
  const own = tenant?.[cls]?.[dest];
  return own === undefined ? floor : own && floor;
}

/**
 * A school's rule for a class, refused if any destination is looser than the
 * floor. Returns the error the database would raise, or null.
 */
export function tighten(cls: DataClass, rule: ClassRoute): string | null {
  for (const dest of DESTINATIONS) {
    if (rule[dest] && !PLATFORM_ROUTES[cls][dest]) {
      return `A tenant classification rule may only be stricter than the platform rule for ${cls}.`;
    }
  }
  return null;
}

/** The ordering: a higher class is more restricted. */
export function stricter(a: DataClass, b: DataClass): DataClass {
  return DATA_CLASSES.indexOf(a) >= DATA_CLASSES.indexOf(b) ? a : b;
}

export function withinCeiling(cls: DataClass, ceiling: DataClass): boolean {
  return DATA_CLASSES.indexOf(cls) <= DATA_CLASSES.indexOf(ceiling);
}
