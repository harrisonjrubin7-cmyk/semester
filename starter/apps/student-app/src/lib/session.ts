import { redirect } from "next/navigation";
import { requireSession } from "@semester/auth/server";
import type { RequestContext } from "@semester/auth/types";

export async function requireSessionOrRedirect(next: string): Promise<RequestContext> {
  try {
    return await requireSession();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect(`/signup?next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
}
