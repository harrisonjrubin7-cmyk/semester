import type { ReactNode } from "react";
import { PLATFORM_LABELS, type PlatformId } from "@/lib/workflow-router/platforms";

type Tone = "neutral" | "ok" | "warn" | "bad" | "accent";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-line",
  ok: "bg-ok-soft text-ok border-transparent",
  warn: "bg-warn-soft text-warn border-transparent",
  bad: "bg-bad-soft text-bad border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const PLATFORM_STYLE: Record<PlatformId, string> = {
  "claude-artifacts": "bg-[var(--p-claude-soft)] text-[var(--p-claude)]",
  "chatgpt-canvas": "bg-[var(--p-canvas-soft)] text-[var(--p-canvas)]",
  v0: "bg-[var(--p-v0-soft)] text-[var(--p-v0)]",
};

export function PlatformBadge({ platform, label }: { platform: PlatformId; label?: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${PLATFORM_STYLE[platform]}`}>
      {label ?? PLATFORM_LABELS[platform]}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "graded" || status === "complete" || status === "completed"
      ? "ok"
      : status === "in-progress" || status === "partial" || status === "running" || status === "queued"
        ? "warn"
        : status === "failed" || status === "unsupported"
          ? "bad"
          : status === "manual-review-required"
            ? "accent"
            : "neutral";
  return <Badge tone={tone}>{status.replace(/-/g, " ")}</Badge>;
}
