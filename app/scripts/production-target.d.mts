export type ProductionTargetKind = 'pages' | 'vercel';
export interface ProductionTarget {
  kind: ProductionTargetKind;
  app: string;
  label: string;
  evidence: 'availability-monitor';
  provesRelease: false;
}
export declare const PAGES_PRODUCTION_ORIGIN: string;
export declare function resolveProductionTarget(kind: string | undefined, configuredUrl?: string): ProductionTarget;
