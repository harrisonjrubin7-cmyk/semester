// What approving a request is allowed to change. Pure; tested in tests/approvalEffect.test.ts.
// The server writes a structured reference at the START of the request's rubric ("membership:<id> role:<role> " or
// "hold:<id> "), followed by the requester's own free text. Only that leading reference counts, and only on the kind
// of request that carries it, so text a requester types can never add an effect.
export type ApprovalEffect =
  | { kind: 'role'; membershipId: string; role: string }
  | { kind: 'hold'; holdId: string }
  | { kind: 'none' };

export function approvalEffect(title: string | null | undefined, rubric: string | null | undefined): ApprovalEffect {
  const t = title ?? '', r = rubric ?? '';
  if (t.startsWith('Role change')) {
    const m = r.match(/^membership:(\S+) role:(\S+)(?:\s|$)/);
    if (m) return { kind: 'role', membershipId: m[1], role: m[2] };
  }
  if (t.startsWith('Release hold')) {
    const m = r.match(/^hold:(\S+)(?:\s|$)/);
    if (m) return { kind: 'hold', holdId: m[1] };
  }
  return { kind: 'none' };
}

/** The requester's reason as written, without the server's leading reference. */
export function approvalReason(title: string | null | undefined, rubric: string | null | undefined): string {
  const r = rubric ?? '';
  const e = approvalEffect(title, r);
  if (e.kind === 'role') return r.replace(/^membership:\S+ role:\S+\s*/, '');
  if (e.kind === 'hold') return r.replace(/^hold:\S+\s*/, '');
  return r;
}
