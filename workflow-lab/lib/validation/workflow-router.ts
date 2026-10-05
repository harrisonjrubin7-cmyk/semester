import { z } from "zod";
import { BACKENDS, DELIVERABLES, HANDOFFS, INTERACTIONS, PERSISTENCE, TECH_TARGETS } from "@/lib/workflow-router/inputs";
import { blankToUndefined } from "./common";

export const routerInputsSchema = z.object({
  deliverable: z.enum(DELIVERABLES),
  interaction: z.enum(INTERACTIONS),
  backend: z.enum(BACKENDS),
  tech: z.enum(TECH_TARGETS),
  persistence: z.enum(PERSISTENCE),
  handoff: z.enum(HANDOFFS),
});

/**
 * The client sends only the selections. The server recomputes the
 * recommendation, so a saved row can never contain a result the engine
 * would not have produced.
 */
export const saveRecommendationSchema = z.object({
  title: z.string().trim().min(1, "Give the recommendation a title").max(200),
  organizationId: z.preprocess(blankToUndefined, z.uuid().optional()),
  inputs: routerInputsSchema,
});
export type SaveRecommendationInput = z.infer<typeof saveRecommendationSchema>;

export const exportFormatSchema = z.enum(["md", "json"]);
