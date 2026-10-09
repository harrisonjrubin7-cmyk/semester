import { AlertTriangle, CheckCircle2, CloudOff, Link2, PencilLine, Sparkles } from "lucide-react";

const statuses = {
  institution_verified: { label: "Institution verified", tone: "success", icon: CheckCircle2 },
  connected: { label: "Connected", tone: "info", icon: Link2 },
  student_entered: { label: "Entered by you", tone: "neutral", icon: PencilLine },
  estimated: { label: "Estimated", tone: "warning", icon: AlertTriangle },
  ai_assisted: { label: "AI-assisted", tone: "info", icon: Sparkles },
  needs_review: { label: "Needs review", tone: "warning", icon: AlertTriangle },
  offline: { label: "Offline", tone: "danger", icon: CloudOff },
  confirmed: { label: "Confirmed", tone: "success", icon: CheckCircle2 },
  uploaded: { label: "Uploaded", tone: "neutral", icon: CheckCircle2 },
  queued: { label: "Processing", tone: "info", icon: Link2 },
  failed: { label: "Processing failed", tone: "danger", icon: AlertTriangle },
} as const;

export type SourceStatus = keyof typeof statuses;

export function sourceStatus(value: string) {
  return statuses[value as SourceStatus] ?? {
    label: value.replaceAll("_", " "),
    tone: "neutral",
    icon: CheckCircle2,
  };
}

export function SourceStatusBadge({ status, detail }: { status: string; detail?: string }) {
  const item = sourceStatus(status);
  const Icon = item.icon;
  return (
    <span className="status-chip" data-tone={item.tone} title={detail}>
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      <span>{item.label}</span>
    </span>
  );
}
