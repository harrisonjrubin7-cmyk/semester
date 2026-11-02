import type { TaskView } from "@semester/contracts/tasks";
import { authorize, type ActorContext } from "@semester/permissions/authorize";
import { queryOwnTasks } from "./tasks";

export async function getTodayFeed(ctx: ActorContext): Promise<TaskView[]> {
  if (!ctx.tenantId) throw new Error("FORBIDDEN:no_tenant");
  await authorize(ctx, "student.today.read", {
    tenantId: ctx.tenantId,
    ownerAccountId: ctx.accountId,
    sensitivity: "moderate",
  });
  return queryOwnTasks(ctx, 20);
}
