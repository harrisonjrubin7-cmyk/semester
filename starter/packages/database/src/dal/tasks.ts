import { CreateTaskInput, type TaskView } from "@semester/contracts/tasks";
import { authorize, type ActorContext } from "@semester/permissions/authorize";
import { withRlsTransaction } from "../rls";

function requireTenant(ctx: ActorContext): string {
  if (!ctx.tenantId) throw new Error("FORBIDDEN:no_tenant");
  return ctx.tenantId;
}

type TaskRow = { id: string; title: string; status: string; created_at: Date };

function toView(row: TaskRow): TaskView {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function queryOwnTasks(ctx: ActorContext, limit: number): Promise<TaskView[]> {
  const tenantId = requireTenant(ctx);
  return withRlsTransaction({ accountId: ctx.accountId, tenantId }, async (client) => {
    const { rows } = await client.query<TaskRow>(
      `select id, title, status, created_at
         from public.student_tasks
        order by created_at desc
        limit $1`,
      [limit],
    );
    return rows.map(toView);
  });
}

export async function createTask(ctx: ActorContext, input: unknown): Promise<TaskView> {
  const { title } = CreateTaskInput.parse(input);
  const tenantId = requireTenant(ctx);
  await authorize(ctx, "student.tasks.create", {
    tenantId,
    ownerAccountId: ctx.accountId,
    sensitivity: "moderate",
  });
  return withRlsTransaction({ accountId: ctx.accountId, tenantId }, async (client) => {
    const { rows } = await client.query<TaskRow>(
      `insert into public.student_tasks (tenant_id, owner_account_id, title)
       values ($1, $2, $3)
       returning id, title, status, created_at`,
      [tenantId, ctx.accountId, title],
    );
    const row = rows[0];
    if (!row) throw new Error("INSERT_RETURNED_NO_ROW");
    return toView(row);
  });
}
