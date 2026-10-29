export type ClaudeReply = (body: unknown, status?: number) => Response;

export async function handleClaudeRequest<Session>(
  req: Request,
  authenticated: (token: string) => Promise<Session | null>,
  run: (session: Session) => Promise<Response>,
  reply: ClaudeReply,
): Promise<Response> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('Authorization') ?? '');
  if (!match) return reply({ error: { message: 'Sign in to use the shared key.' } }, 401);

  try {
    const session = await authenticated(match[1]);
    if (!session) return reply({ error: { message: 'That session is not valid. Sign in again.' } }, 401);
    return run(session);
  } catch {
    return reply({ error: { message: 'That session is not valid. Sign in again.' } }, 401);
  }
}
