import type { NextRequest } from "next/server";
import { downloadResponse, jsonError } from "@/lib/exports/download";
import { recommendationToJson } from "@/lib/exports/json";
import { recommendationToMarkdown } from "@/lib/exports/markdown";
import { fieldErrors } from "@/lib/validation/common";
import { exportFormatSchema, routerInputsSchema } from "@/lib/validation/workflow-router";
import { recommend } from "@/lib/workflow-router/engine";

/**
 * GET /api/exports/recommendation?format=md|json&deliverable=...&interaction=...&backend=...&tech=...&persistence=...&handoff=...[&task=...]
 * Pure function of the query string: the same selections always give the same file.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const format = exportFormatSchema.safeParse(p.get("format") ?? "md");
  if (!format.success) return jsonError(400, "format must be md or json");

  const inputs = routerInputsSchema.safeParse({
    deliverable: p.get("deliverable"),
    interaction: p.get("interaction"),
    backend: p.get("backend"),
    tech: p.get("tech"),
    persistence: p.get("persistence"),
    handoff: p.get("handoff"),
  });
  if (!inputs.success) return jsonError(400, "Invalid selections", fieldErrors(inputs.error));

  const task = p.get("task")?.slice(0, 2000) || undefined;
  const rec = recommend(inputs.data);
  const name = `semester-recommendation-${rec.primary}`;
  return format.data === "json"
    ? downloadResponse(recommendationToJson(rec, task), "json", name)
    : downloadResponse(recommendationToMarkdown(rec, task), "md", name);
}
