import type { Environment } from '../../types.ts';

/**
 * The release port. A20's `release.execute` runs only through it, and only
 * after the policy gate has consumed an approval bound to the exact target
 * and artifact hash. No adapter is configured by default: `noRelease` throws
 * and the task is blocked before any approval is spent. A real adapter (a
 * Pages deploy, a Vercel promotion, an Edge Function deploy) is wired by the
 * person who holds its credential, in the operator's own process, and is
 * named in the evidence by `name`.
 */
export interface ReleaseRequest { target: string; artifactHash: string; taskId: string; environment: Environment }
export interface ReleaseResult { reference: string; detail?: string }
export interface ReleaseAdapter { readonly name: string; release(request: ReleaseRequest): Promise<ReleaseResult> }

export class ReleaseUnavailable extends Error {
  constructor() { super('No release adapter is configured. release.execute stays blocked until an owner wires one with its credential; no approval is consumed.'); }
}

export const noRelease: ReleaseAdapter = { name: 'none', release: async () => { throw new ReleaseUnavailable(); } };
