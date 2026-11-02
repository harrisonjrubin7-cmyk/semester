import express from "express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { authenticate, type AuthConfig } from "./auth";
import { ForbiddenError, requireCapability, withTenant } from "./database";
import type { createLimiter } from "./limiter";

type Limiter = ReturnType<typeof createLimiter>;
type Dependencies = { pool: Pool; auth: AuthConfig; limiter: Limiter };

const paramsSchema = z.object({ tenantId: z.string().uuid() });
const querySchema = z.object({ workspaceId: z.string().uuid() });

export function createApp(deps: Dependencies) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader("X-Request-Id", res.locals.requestId);
    next();
  });
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/v1/tenants/:tenantId/tasks", authenticate(deps.auth), async (req, res, next) => {
    try {
      const { tenantId } = paramsSchema.parse(req.params);
      const { workspaceId } = querySchema.parse(req.query);
      const userId = res.locals.auth.userId;

      await withTenant(deps.pool, { userId, tenantId }, async (db) => {
        await requireCapability(db, tenantId, workspaceId, "tasks.read_own");
      });

      let userBudget;
      let tenantBudget;
      try {
        userBudget = await deps.limiter.consume(`user:${userId}:tasks-read:v1`, { capacity: 30, refillPerSecond: 5 });
        if (!userBudget.allowed) {
          res.setHeader("Retry-After", String(Math.max(1, Math.ceil(userBudget.retryAfterMs / 1000))));
          res.status(429).json({ error: { code: "USER_RATE_LIMITED" } });
          return;
        }
        tenantBudget = await deps.limiter.consume(`tenant:${tenantId}:tasks-read:v1`, { capacity: 300, refillPerSecond: 50 });
      } catch {
        res.status(503).json({ error: { code: "RATE_LIMITER_UNAVAILABLE" } });
        return;
      }
      if (!tenantBudget.allowed) {
        res.setHeader("Retry-After", String(Math.max(1, Math.ceil(tenantBudget.retryAfterMs / 1000))));
        res.status(429).json({ error: { code: "TENANT_RATE_LIMITED" } });
        return;
      }

      const rows = await withTenant(deps.pool, { userId, tenantId }, async (db) => {
        await requireCapability(db, tenantId, workspaceId, "tasks.read_own");
        const result = await db.query(
          `select id, title, state, due_at, version from app.tasks
           where tenant_id = $1 and workspace_id = $2 and owner_user_id = $3
           order by due_at nulls last, id limit 100`,
          [tenantId, workspaceId, userId]
        );
        return result.rows;
      });
      res.json({ data: rows, meta: { requestId: res.locals.requestId } });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    if (error instanceof z.ZodError) return void res.status(400).json({ error: { code: "INVALID_REQUEST" } });
    if (error instanceof ForbiddenError) return void res.status(403).json({ error: { code: "ACCESS_DENIED" } });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", requestId: res.locals.requestId } });
  });

  return app;
}
