import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { getSessionByToken } from "@semester/database/sessions";
import { grantsForRole } from "@semester/permissions/roles";
import type { RequestContext } from "./types";

// Same expression as apps/student-app/src/middleware.ts. Keep the two in step.
export const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || "semester_session";

export async function requireSession(): Promise<RequestContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) throw new Error("UNAUTHENTICATED");

  const session = await getSessionByToken(token);
  if (!session) throw new Error("UNAUTHENTICATED");

  const headerStore = await headers();
  return {
    sessionId: session.id,
    accountId: session.accountId,
    tenantId: session.tenantId,
    membershipId: session.membershipId,
    activeWorkspace: session.activeWorkspace,
    grants: grantsForRole(session.roleKey),
    correlationId: headerStore.get("x-correlation-id") ?? randomUUID(),
  };
}
