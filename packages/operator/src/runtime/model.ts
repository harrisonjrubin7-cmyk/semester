/**
 * The model port. An agent whose implementation is `model` needs one; the
 * runtime refuses that path when none is configured, and says so. There is
 * no model in this repository: no SDK dependency is installed (adding one
 * goes through the supply-chain workflow in docs/AGENT-TOOLING.md) and no
 * credential is present in the environment. Plugging the Claude Agent SDK
 * in here is the expansion step, not a thing this package claims.
 */
export interface ModelRequest { system: string; prompt: string; maxTurns: number; costCeilingUsd?: number }
export interface ModelResponse { text: string; costUsd?: number; turns: number }
export interface ModelPort { readonly name: string; complete(request: ModelRequest): Promise<ModelResponse> }

export class ModelUnavailable extends Error {
  constructor() { super('No model port is configured. Model-backed agents stay configured but untested until one is supplied with its own credential and dependency approval.'); }
}

export const noModel: ModelPort = { name: 'none', complete: async () => { throw new ModelUnavailable(); } };
