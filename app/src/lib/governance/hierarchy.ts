/**
 * Multi-campus policy inheritance: system → campus → school → program → course.
 *
 * A university system sets policy once; a campus, a school inside it (law,
 * medicine, continuing education), a program and a course may each narrow it.
 * None of them may widen it. That one rule is what makes central governance
 * mean something while still letting a branch campus be stricter than the
 * flagship — and it is the same rule the classification floor already uses
 * (`tighten` in integration/classification.ts), applied at every level.
 *
 * Branding is the exception, deliberately: it is Tier 1 content, and a law
 * school carrying its own mark is local identity, not a weaker control. So
 * brand overrides downward (nearest wins) while policy narrows downward
 * (strictest wins).
 *
 * Isolation: a chain is resolved only if every node belongs to the same system
 * tenant. A campus that names a parent in another system is refused rather
 * than silently inheriting a stranger's policy — cross-campus data is joined
 * by agreement (cross-registration), never by hierarchy.
 *
 * See docs/operating-model/MULTI-CAMPUS.md and ADR 0005.
 */
import type { FeatureState } from '../../intelligence/contracts';
import { DATA_CLASSES, DESTINATIONS, routeAllowed, type ClassRoute, type DataClass } from '../integration/classification';

export type Level = 'system' | 'campus' | 'school' | 'program' | 'course';

export const LEVELS: readonly Level[] = ['system', 'campus', 'school', 'program', 'course'];

export interface Brand {
  name?: string;
  logo?: string;
  accent?: string;
}

export interface PolicyNode {
  id: string;
  level: Level;
  /** The system tenant this node belongs to. Every node in a chain must share it. */
  systemId: string;
  parentId?: string;
  features?: Record<string, FeatureState>;
  classRoutes?: Partial<Record<DataClass, Partial<ClassRoute>>>;
  aiAllowed?: boolean;
  /** Days. A child may shorten retention, never lengthen it. */
  retentionDays?: number;
  brand?: Brand;
}

export interface ResolvedPolicy {
  features: Record<string, FeatureState>;
  classRoutes: Record<DataClass, ClassRoute>;
  aiAllowed: boolean;
  retentionDays: number | null;
  brand: Brand;
  /** Every place a child asked for something looser than its parent, and was held to the parent. */
  clamped: string[];
}

const RANK: Record<FeatureState, number> = { off: 0, preview: 1, sandbox: 2, production: 3 };

function narrower(a: FeatureState, b: FeatureState): FeatureState {
  return RANK[a] <= RANK[b] ? a : b;
}

export type ResolveResult = { ok: true; policy: ResolvedPolicy } | { ok: false; error: string };

/**
 * Resolve the effective policy at `leafId`, walking up through `nodes`.
 * Features a parent never mentions are off: nothing defaults on at any level.
 */
export function resolve(nodes: readonly PolicyNode[], leafId: string): ResolveResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: PolicyNode[] = [];
  const seen = new Set<string>();
  let at = byId.get(leafId);
  if (!at) return { ok: false, error: `No policy node ${leafId}.` };
  while (at) {
    if (seen.has(at.id)) return { ok: false, error: `Policy hierarchy has a cycle at ${at.id}.` };
    seen.add(at.id);
    chain.unshift(at);
    if (!at.parentId) break;
    const parent = byId.get(at.parentId);
    if (!parent) return { ok: false, error: `${at.id} names a parent ${at.parentId} that does not exist.` };
    at = parent;
  }
  const root = chain[0];
  if (root.level !== 'system') return { ok: false, error: `${root.id} is a root but not a system tenant.` };
  for (let i = 1; i < chain.length; i++) {
    const n = chain[i];
    if (n.systemId !== root.systemId) {
      return { ok: false, error: `${n.id} belongs to system ${n.systemId}, not ${root.systemId}; systems never inherit from each other.` };
    }
    if (LEVELS.indexOf(n.level) <= LEVELS.indexOf(chain[i - 1].level)) {
      return { ok: false, error: `${n.id} (${n.level}) cannot sit under ${chain[i - 1].id} (${chain[i - 1].level}).` };
    }
  }

  const clamped: string[] = [];
  let features: Record<string, FeatureState> = {};
  const classRoutes = Object.fromEntries(
    DATA_CLASSES.map((c) => [c, Object.fromEntries(DESTINATIONS.map((d) => [d, routeAllowed(c, d)])) as ClassRoute]),
  ) as Record<DataClass, ClassRoute>;
  let aiAllowed = true;
  let retentionDays: number | null = null;
  let brand: Brand = {};

  chain.forEach((n, i) => {
    // Features: the root declares; every level below can only narrow.
    if (i === 0) features = { ...(n.features ?? {}) };
    else {
      const next: Record<string, FeatureState> = { ...features };
      for (const [key, want] of Object.entries(n.features ?? {})) {
        const parent = features[key] ?? 'off';
        next[key] = narrower(parent, want);
        if (next[key] !== want) clamped.push(`${n.id}: ${key} asked ${want}, held to ${parent}`);
      }
      features = next;
    }
    for (const c of DATA_CLASSES) {
      for (const d of DESTINATIONS) {
        const want = n.classRoutes?.[c]?.[d];
        if (want === undefined) continue;
        if (want && !classRoutes[c][d]) clamped.push(`${n.id}: ${c} → ${d} asked open, held closed`);
        classRoutes[c][d] = classRoutes[c][d] && want;
      }
    }
    if (n.aiAllowed !== undefined) {
      if (n.aiAllowed && !aiAllowed) clamped.push(`${n.id}: AI asked on, held off`);
      aiAllowed = aiAllowed && n.aiAllowed;
    }
    if (n.retentionDays !== undefined) {
      if (retentionDays !== null && n.retentionDays > retentionDays) {
        clamped.push(`${n.id}: retention asked ${n.retentionDays} days, held to ${retentionDays}`);
      } else retentionDays = n.retentionDays;
    }
    brand = { ...brand, ...(n.brand ?? {}) };
  });

  return { ok: true, policy: { features, classRoutes, aiAllowed, retentionDays, brand, clamped } };
}
