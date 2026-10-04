import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * The operational endpoints: is it alive, is it ready, what is it doing.
 *
 * Three questions, three answers, and they must not be confused. **Liveness**
 * says the process can answer; it checks nothing else, so an orchestrator that
 * restarts on a failed liveness probe does not restart a healthy process
 * because the database is down. **Readiness** says the dependencies it needs
 * are reachable; it is what a load balancer routes on. **Metrics** say what it
 * has been doing, and are the only one of the three that is not public-safe.
 *
 * These are mounted on the internal network, not behind the public hostname,
 * and `/metrics` additionally wants a bearer token — a second wall, because a
 * metrics page is a map of the system and a firewall rule is easy to get wrong.
 *
 * Nothing here ever carries a tenant id, a user id or an error message from a
 * dependency. Labels are route templates and statuses: low cardinality, and
 * nothing a metrics store should not hold.
 */

const BUCKETS = [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

export class Metrics {
  private http = new Map<string, number>();
  private commands = new Map<string, number>();
  private decisions = new Map<string, number>();
  private latency = new Map<string, { counts: number[]; sum: number; count: number }>();

  observeHttp(route: string, status: number, seconds: number): void {
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    bump(this.http, `${route}\u0000${status}`);
    const h = this.latency.get(route) ?? { counts: BUCKETS.map(() => 0), sum: 0, count: 0 };
    BUCKETS.forEach((b, i) => { if (seconds <= b) h.counts[i] = (h.counts[i] ?? 0) + 1; });
    h.sum += seconds;
    h.count += 1;
    this.latency.set(route, h);
  }

  /** One policy decision. The action and the verdict; never who, never about what. */
  observePolicy(action: string, outcome: 'allow' | 'deny'): void {
    const k = `${action}\u0000${outcome}`;
    this.decisions.set(k, (this.decisions.get(k) ?? 0) + 1);
  }

  observeCommand(type: string, status: string): void {
    const k = `${type}\u0000${status}`;
    this.commands.set(k, (this.commands.get(k) ?? 0) + 1);
  }

  /** Prometheus text exposition. `gauges` are read at scrape time, not counted. */
  render(gauges: Record<string, number> = {}): string {
    const lines: string[] = [];
    const label = (v: string) => v.replace(/[\\"\n]/g, '_');
    lines.push('# TYPE semester_http_requests_total counter');
    for (const [k, v] of this.http) {
      const [route, status] = k.split('\u0000');
      lines.push(`semester_http_requests_total{route="${label(route!)}",status="${label(status!)}"} ${v}`);
    }
    lines.push('# TYPE semester_http_request_duration_seconds histogram');
    for (const [route, h] of this.latency) {
      BUCKETS.forEach((b, i) => lines.push(`semester_http_request_duration_seconds_bucket{route="${label(route)}",le="${b}"} ${h.counts[i]}`));
      lines.push(`semester_http_request_duration_seconds_bucket{route="${label(route)}",le="+Inf"} ${h.count}`);
      lines.push(`semester_http_request_duration_seconds_sum{route="${label(route)}"} ${h.sum}`);
      lines.push(`semester_http_request_duration_seconds_count{route="${label(route)}"} ${h.count}`);
    }
    lines.push('# TYPE semester_commands_total counter');
    for (const [k, v] of this.commands) {
      const [type, status] = k.split('\u0000');
      lines.push(`semester_commands_total{type="${label(type!)}",status="${label(status!)}"} ${v}`);
    }
    lines.push('# TYPE semester_policy_decisions_total counter');
    for (const [k, v] of this.decisions) {
      const [action, outcome] = k.split('\u0000');
      lines.push(`semester_policy_decisions_total{action="${label(action!)}",outcome="${label(outcome!)}"} ${v}`);
    }
    for (const [name, value] of Object.entries(gauges)) {
      lines.push(`# TYPE ${name} gauge`, `${name} ${Number.isFinite(value) ? value : 0}`);
    }
    return `${lines.join('\n')}\n`;
  }
}

/**
 * The three hooks that feed a `Metrics`, and the gauges read at scrape time,
 * so wiring the service, the HTTP layer and `/metrics` together is one call
 * and cannot be done half-way. Spread `hooks.service` into `ProductivityService`,
 * pass `hooks.telemetry` to `createProductivityApi`, and `hooks.gauges` here.
 */
export function instrument(metrics: Metrics, outbox?: () => Promise<{ pending: number; oldestPendingAgeSeconds: number; deadLettered: number }>) {
  return {
    service: {
      onCommand: (o: { type: string; status: string }) => metrics.observeCommand(o.type, o.status),
      onDecision: (d: { action: string; allow: boolean }) => metrics.observePolicy(d.action, d.allow ? 'allow' : 'deny'),
    },
    telemetry: (e: { route: string; status: number; durationMs: number }) => metrics.observeHttp(e.route, e.status, e.durationMs / 1000),
    gauges: async (): Promise<Record<string, number>> => {
      if (!outbox) return {};
      const s = await outbox();
      return {
        semester_outbox_pending: s.pending,
        semester_outbox_oldest_pending_age_seconds: s.oldestPendingAgeSeconds,
        semester_outbox_dead_lettered: s.deadLettered,
      };
    },
  };
}

export interface OpsConfig {
  /** Named dependency checks, each of which throws if its dependency is not usable. */
  checks: Record<string, () => Promise<void>>;
  metrics: Metrics;
  gauges?: () => Promise<Record<string, number>>;
  /** Bearer token for `/metrics`. Unset means the endpoint does not exist. */
  metricsToken?: string;
  checkTimeoutMs?: number;
}

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Returns a response for an ops path, or null for any other, so it can sit in front of an API handler. */
export function createOpsHandler(config: OpsConfig): (request: Request) => Promise<Response | null> {
  const timeout = config.checkTimeoutMs ?? 2_000;
  const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

  return async (request) => {
    const path = new URL(request.url).pathname;
    if (request.method !== 'GET') return path === '/healthz' || path === '/readyz' || path === '/metrics' ? json(405, { status: 'method_not_allowed' }) : null;

    if (path === '/healthz') return json(200, { status: 'ok' });

    if (path === '/readyz') {
      const results: Record<string, 'ok' | 'failed'> = {};
      await Promise.all(Object.entries(config.checks).map(async ([name, check]) => {
        try {
          await Promise.race([
            check(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout).unref?.()),
          ]);
          results[name] = 'ok';
        } catch {
          results[name] = 'failed';
        }
      }));
      const ready = Object.values(results).every((r) => r === 'ok');
      return json(ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready', checks: results });
    }

    if (path === '/metrics') {
      const token = config.metricsToken;
      const presented = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
      // Unset token: the endpoint is off, and says nothing about why.
      if (!token) return json(404, { status: 'not_found' });
      if (!presented || !timingSafeEqual(digest(presented), digest(token))) return json(401, { status: 'unauthorized' });
      let gauges: Record<string, number> = {};
      try {
        gauges = config.gauges ? await config.gauges() : {};
      } catch {
        gauges = {};
      }
      return new Response(config.metrics.render(gauges), { status: 200, headers: { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' } });
    }
    return null;
  };
}
