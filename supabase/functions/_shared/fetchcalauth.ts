export type FetchcalReply = (body: unknown, status?: number) => Response;
export type FetchcalAuthenticated = (token: string) => Promise<boolean>;
export type FetchcalRun = () => Response | Promise<Response>;

/**
 * Hold the calendar proxy's session boundary in an importable unit.
 *
 * The protected callback contains every outbound calendar request. A missing,
 * malformed, invalid or unreadable session therefore cannot reach egress.
 */
export async function handleFetchcalRequest(
  req: Request,
  authenticated: FetchcalAuthenticated,
  run: FetchcalRun,
  reply: FetchcalReply,
): Promise<Response> {
  const authorization = req.headers.get('Authorization')?.trim() ?? '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1] ?? '';
  if (!bearer) return reply({ error: 'Sign in to read a calendar link on this device.' }, 401);

  try {
    if (!(await authenticated(bearer))) {
      return reply({ error: 'That session is not valid. Sign in again.' }, 401);
    }
  } catch {
    return reply({ error: 'That session is not valid. Sign in again.' }, 401);
  }

  return run();
}
