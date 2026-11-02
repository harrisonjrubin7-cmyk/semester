import type { Environment } from '../../types.ts';

/**
 * The sending port. A27's `communication.send` runs only through it, and only
 * after the policy gate has consumed an approval bound to the exact action,
 * channel, recipient and content hash. Drafts come first: an adapter declares
 * whether it can place a draft, send, or both, and the handler refuses an
 * action the adapter does not support before the gate is asked, so no
 * approval is spent on a path that cannot complete. No adapter is configured
 * by default: `noSend` throws and the task is blocked before any approval is
 * spent. A real adapter (a mailbox draft, a channel post) is wired by the
 * person who holds its credential, in the operator's own process, and is
 * named in the evidence by `name`.
 */
export type SendAction = 'draft' | 'send';

export interface SendRequest {
  action: SendAction;
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
  /** sha256 over the canonical {channel, recipient, subject, body}; the approval binds it as the artifact. */
  contentHash: string;
  taskId: string;
  environment: Environment;
}
export interface SendResult { reference: string; detail?: string }
export interface SendAdapter {
  readonly name: string;
  /** Which actions the adapter can perform. A drafts-only adapter has `send: false` and is never asked to send. */
  readonly supports: Readonly<Record<SendAction, boolean>>;
  draft(request: SendRequest): Promise<SendResult>;
  send(request: SendRequest): Promise<SendResult>;
}

export class SendUnavailable extends Error {
  constructor() { super('No sending adapter is configured. communication.send stays blocked until an owner wires one with its credential; no approval is consumed.'); }
}

export const noSend: SendAdapter = {
  name: 'none',
  supports: { draft: false, send: false },
  draft: async () => { throw new SendUnavailable(); },
  send: async () => { throw new SendUnavailable(); },
};
