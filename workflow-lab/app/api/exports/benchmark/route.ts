import type { NextRequest } from "next/server";
import { z } from "zod";
import { LOCAL_SUITE_ID, loadSuiteBundle, localTemplateBundle } from "@/lib/benchmark/repository";
import { buildSummary } from "@/lib/benchmark/summary";
import { downloadResponse, jsonError } from "@/lib/exports/download";
import { benchmarkCsv } from "@/lib/exports/csv";
import { benchmarkToJson } from "@/lib/exports/json";
import { benchmarkReportMarkdown } from "@/lib/exports/markdown";
import { getUser } from "@/lib/supabase/server";

const querySchema = z.object({
  suite: z.union([z.uuid(), z.literal(LOCAL_SUITE_ID)]),
  format: z.enum(["csv", "md", "json"]).default("csv"),
});

/** GET /api/exports/benchmark?suite=<uuid|local-template>&format=csv|md|json. Runs as the caller, so RLS decides what is exported. */
export async function GET(request: NextRequest) {
  const q = querySchema.safeParse({
    suite: request.nextUrl.searchParams.get("suite"),
    format: request.nextUrl.searchParams.get("format") ?? undefined,
  });
  if (!q.success) return jsonError(400, "suite must be a suite id (or local-template); format must be csv, md or json");

  let bundle;
  if (q.data.suite === LOCAL_SUITE_ID) {
    bundle = localTemplateBundle();
  } else {
    const { supabase, user } = await getUser();
    if (!supabase) return jsonError(503, "Supabase is not configured");
    if (!user) return jsonError(401, "Sign in to export a saved suite");
    try {
      bundle = await loadSuiteBundle(supabase, q.data.suite);
    } catch {
      return jsonError(500, "Could not load the suite");
    }
    // Not found and not permitted look identical on purpose.
    if (!bundle) return jsonError(404, "Suite not found");
  }

  const summary = buildSummary(bundle);
  const name = `benchmark-${bundle.suite.name}`;
  if (q.data.format === "json") return downloadResponse(benchmarkToJson(summary), "json", name);
  if (q.data.format === "md") return downloadResponse(benchmarkReportMarkdown(summary), "md", name);
  return downloadResponse(benchmarkCsv(summary), "csv", name);
}
