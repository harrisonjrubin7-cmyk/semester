"use client";

import { useActionState } from "react";
import { deleteRecommendation } from "@/app/workflow-router/actions";
import { PlatformBadge } from "@/components/ui/badge";
import { ActionMessage } from "@/components/ui/form-bits";
import type { ActionState } from "@/lib/actions/types";
import type { RouterInputs } from "@/lib/workflow-router/inputs";
import type { PlatformId } from "@/lib/workflow-router/platforms";

export type SavedRecommendation = {
  id: string;
  title: string;
  createdAt: string;
  primary: PlatformId;
  confidence: number;
  shared: boolean;
  mine: boolean;
  inputs: RouterInputs;
};

export function SavedList({ items, onLoad }: { items: SavedRecommendation[]; onLoad: (i: RouterInputs, title: string) => void }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteRecommendation, null);
  if (items.length === 0) return <p className="text-sm text-muted">Nothing saved yet. Save a recommendation and it will appear here.</p>;
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-line rounded-lg border border-line">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.title}</p>
              <p className="text-xs text-muted">{new Date(s.createdAt).toLocaleDateString()} · {s.confidence}% · {s.shared ? "shared with organization" : "private"}{s.mine ? "" : " · by a teammate"}</p>
            </div>
            <div className="flex items-center gap-2">
              <PlatformBadge platform={s.primary} />
              <button type="button" onClick={() => onLoad(s.inputs, s.title)} className="rounded-md border border-line px-2 py-1 text-xs hover:bg-surface-2">Load</button>
              <form action={action}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="rounded-md border border-line px-2 py-1 text-xs text-bad hover:bg-bad-soft" aria-label={`Delete ${s.title}`}>Delete</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
      <ActionMessage state={state} />
    </div>
  );
}
