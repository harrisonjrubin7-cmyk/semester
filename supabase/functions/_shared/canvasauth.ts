export type CanvasReply = (body: unknown, status?: number) => Response;

export async function handleCanvasRequest(
  req: Request,
  authenticated: (token: string) => Promise<boolean>,
  run: () => Promise<Response>,
  reply: CanvasReply,
): Promise<Response> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('Authorization') ?? '');
  if (!match) return reply({ error: 'Sign in to read Canvas on this device.' }, 401);

  try {
    if (!(await authenticated(match[1]))) {
      return reply({ error: 'That session is not valid. Sign in again.' }, 401);
    }
  } catch {
    return reply({ error: 'That session is not valid. Sign in again.' }, 401);
  }

  return run();
}
