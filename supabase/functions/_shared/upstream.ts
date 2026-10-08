/**
 * Where the shared key's request goes: Anthropic directly, or Vercel AI
 * Gateway's Anthropic-compatible `/v1/messages` when `AI_GATEWAY_API_KEY` is
 * set.
 *
 * The gateway speaks the same request and the same event stream, so
 * `claude/index.ts` changes nothing else: the clamp, the spend meter and the
 * activation gate all see the Anthropic model id. Only what leaves the function
 * differs, and only here:
 *
 *  - the credential is a bearer token, not `x-api-key`;
 *  - the model id is the gateway's (`anthropic/claude-haiku-4.5`, with a dot
 *    where Anthropic writes `4-5`);
 *  - the prompt-token count at `api.anthropic.com` is skipped, because the
 *    gateway key must never be sent to a host that is not the gateway.
 *
 * Nothing in this file reads the environment or touches the network.
 */

export const ANTHROPIC_MESSAGES = 'https://api.anthropic.com/v1/messages';
export const GATEWAY_MESSAGES = 'https://ai-gateway.vercel.sh/v1/messages';

/** `claude-haiku-4-5` → `anthropic/claude-haiku-4.5`; a dated id loses its date. */
export function gatewayModel(id: string): string {
  const bare = id.replace(/^anthropic\//, '').replace(/-\d{8}$/, '');
  return `anthropic/${bare.replace(/-(\d+)-(\d+)$/, '-$1.$2')}`;
}

export interface Upstream {
  url: string;
  headers: Record<string, string>;
  /** True when the gateway is the destination. */
  gateway: boolean;
  /** Rewrites a clamped request body for this destination. */
  body: (clamped: string) => string;
}

/** The gateway when it has a key, Anthropic otherwise. Both keys are already checked sendable. */
export function chooseUpstream(keys: { gateway?: string | null; anthropic?: string | null }): Upstream | null {
  if (keys.gateway) {
    return {
      url: GATEWAY_MESSAGES,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.gateway}` },
      gateway: true,
      body: (clamped) => {
        const parsed = JSON.parse(clamped) as Record<string, unknown>;
        if (typeof parsed.model === 'string') parsed.model = gatewayModel(parsed.model);
        return JSON.stringify(parsed);
      },
    };
  }
  if (keys.anthropic) {
    return {
      url: ANTHROPIC_MESSAGES,
      headers: { 'Content-Type': 'application/json', 'x-api-key': keys.anthropic, 'anthropic-version': '2023-06-01' },
      gateway: false,
      body: (clamped) => clamped,
    };
  }
  return null;
}
