"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Check, Download, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, download } from "@/lib/api";
import { studyAssetTypes } from "./navigation";
import { SourceStatusBadge } from "./source-status";
import { EmptyState } from "./workspace-states";
import type { Asset, CitationDetail, Flashcard, GuideSection, Progress } from "./workspace-types";

function citationCatalog(content: Record<string, unknown>): Record<string, CitationDetail> {
  const value = content.citations;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, CitationDetail>;
}

function guideSections(content: Record<string, unknown>): GuideSection[] {
  if (!Array.isArray(content.sections)) return [];
  return content.sections.filter((section): section is GuideSection => Boolean(
    section && typeof section === "object" &&
    typeof section.heading === "string" && typeof section.explanation === "string" &&
    Array.isArray(section.citation_ids) && section.citation_ids.every((id: unknown) => typeof id === "string") &&
    (section.key_points === undefined || (
      Array.isArray(section.key_points) && section.key_points.every((point: unknown) => typeof point === "string")
    )) &&
    (section.examples === undefined || (
      Array.isArray(section.examples) && section.examples.every((example: unknown) => typeof example === "string")
    )),
  ));
}

function flashcards(content: Record<string, unknown>): Flashcard[] {
  if (!Array.isArray(content.cards)) return [];
  return content.cards.filter((card): card is Flashcard => Boolean(
    card && typeof card === "object" && typeof card.id === "string" &&
    typeof card.front === "string" && typeof card.back === "string" &&
    Array.isArray(card.citation_ids),
  ));
}

function Citations({ ids, catalog }: { ids: string[]; catalog: Record<string, CitationDetail> }) {
  return <ul aria-label="Sources" className="mt-4 flex flex-wrap gap-2">
    {ids.map((id) => <li className="status-chip" data-tone="info" key={id}>{catalog[id]?.label ?? "Linked source"}</li>)}
  </ul>;
}

function AssetHeader({ asset }: { asset: Asset }) {
  return <header>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="eyebrow">{asset.asset_type.replaceAll("_", " ")}</p>
      <SourceStatusBadge detail="Generated study assets remain AI-assisted until a student reviews them." status={asset.status === "confirmed" ? "ai_assisted" : asset.status} />
    </div>
    <h2 className="mt-4 font-[family-name:var(--font-heading)] text-2xl font-semibold">{asset.title}</h2>
    <p className="muted mt-2 text-sm">Version {asset.generation_version} · updated <span className="mono">{new Date(asset.updated_at).toLocaleDateString()}</span></p>
  </header>;
}

function CardsView({ asset, courseId }: { asset: Asset; courseId: string }) {
  const cards = flashcards(asset.content);
  const catalog = citationCatalog(asset.content);
  const client = useQueryClient();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [confidence, setConfidence] = useState(3);
  const [announcement, setAnnouncement] = useState("");
  const review = useMutation({
    mutationFn: (correct: boolean) => api<Progress["items"][number]>(`/flashcards/${cards[index].id}/review`, {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, concept_id: null, correct, confidence }),
    }),
    onSuccess: (_result, correct) => {
      setAnnouncement(correct ? "Recall recorded." : "Marked for another review.");
      setRevealed(false);
      setIndex((current) => (current + 1) % cards.length);
      void client.invalidateQueries({ queryKey: ["progress", courseId] });
    },
  });
  if (!cards.length) return <p className="muted mt-6" role="status">This stored card set has no valid cited cards.</p>;
  const card = cards[index];
  return <div className="mt-6">
    <p className="muted text-sm"><span className="mono">{index + 1}</span> of <span className="mono">{cards.length}</span></p>
    <div className="mt-3 rounded border border-[color:var(--border-default)] bg-[color:var(--surface-canvas)] p-6">
      <p className="text-lg font-semibold">{card.front}</p>
      {revealed ? <div className="mt-6 border-t border-[color:var(--border-default)] pt-5"><p>{card.back}</p><Citations catalog={catalog} ids={card.citation_ids} /></div> : null}
    </div>
    {!revealed ? <button className="button button-primary mt-4" onClick={() => setRevealed(true)} type="button">Reveal answer</button> : <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="grid gap-2 text-sm" htmlFor={`confidence-${asset.id}`}>Confidence
        <select className="min-h-11 rounded border border-[color:var(--border-strong)] bg-[color:var(--surface-panel)] px-3" id={`confidence-${asset.id}`} onChange={(event) => setConfidence(Number(event.target.value))} value={confidence}>
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
        </select>
      </label>
      <button className="button button-primary" disabled={review.isPending} onClick={() => review.mutate(true)} type="button"><Check size={16} /> I recalled it</button>
      <button className="button button-secondary" disabled={review.isPending} onClick={() => review.mutate(false)} type="button"><RotateCcw size={16} /> Review again</button>
    </div>}
    {review.error ? <p className="mt-3 text-sm text-[color:var(--danger)]" role="alert">{String(review.error)}</p> : null}
    <p aria-live="polite" className="sr-only">{announcement}</p>
  </div>;
}

function ReadingView({ asset, courseId, mode }: { asset: Asset; courseId: string; mode: string }) {
  const sections = guideSections(asset.content);
  const catalog = citationCatalog(asset.content);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState("");
  const exportAsset = async (format: "pdf" | "docx") => {
    setExportError(""); setExporting(format);
    try { await download(`/study-assets/${asset.id}/exports/${format}`); }
    catch (error) { setExportError(String(error)); }
    finally { setExporting(""); }
  };
  return <div className="mt-6">
    {!sections.length ? <p className="muted" role="status">This stored material has no valid cited sections.</p> : <div className="space-y-6">{sections.map((section, index) => <section className="border-t border-[color:var(--border-default)] pt-5" key={`${section.heading}-${index}`}>
      <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold">{section.heading}</h3>
      <p className="reading-width mt-3 leading-7">{section.explanation}</p>
      {section.key_points?.length ? <ul className="reading-width mt-4 list-disc space-y-2 pl-5">{section.key_points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
      {section.examples?.length ? <div className="mt-4 rounded border-l-4 border-[color:var(--semester-500)] bg-[color:var(--surface-canvas)] p-4"><p className="eyebrow">Examples</p>{section.examples.map((example) => <p className="mt-2" key={example}>{example}</p>)}</div> : null}
      <Citations catalog={catalog} ids={section.citation_ids} />
    </section>)}</div>}
    {mode === "doc" ? <div className="mt-6 flex flex-wrap gap-3 border-t border-[color:var(--border-default)] pt-5">
      <button className="button button-secondary" disabled={asset.status !== "confirmed" || Boolean(exporting)} onClick={() => void exportAsset("docx")} type="button"><Download size={16} /> {exporting === "docx" ? "Preparing…" : "Download DOCX"}</button>
      <button className="button button-secondary" disabled={asset.status !== "confirmed" || Boolean(exporting)} onClick={() => void exportAsset("pdf")} type="button"><Download size={16} /> {exporting === "pdf" ? "Preparing…" : "Download PDF"}</button>
      {asset.status !== "confirmed" ? <p className="muted basis-full text-sm">Review and confirm this version before exporting it.</p> : null}
      {exportError ? <p className="basis-full text-sm text-[color:var(--danger)]" role="alert">{exportError}</p> : null}
    </div> : null}
    <Link className="button button-secondary mt-5 no-underline" href={`/courses/${courseId}/uploads`}><ExternalLink size={16} /> View source records</Link>
  </div>;
}

function QuizView({ asset, courseId }: { asset: Asset; courseId: string }) {
  const questions = guideSections(asset.content);
  const catalog = citationCatalog(asset.content);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [answers, setAnswers] = useState<Record<number, boolean>>({});
  const complete = useMutation({
    mutationFn: () => api<{ id: string; recorded: boolean; answer_count: number }>(`/quizzes/${asset.id}/attempts`, {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, answers: questions.map((_question, index) => ({ question_index: index, correct: answers[index] })) }),
    }),
  });
  if (!questions.length) return <p className="muted mt-6" role="status">This stored quiz has no valid cited questions.</p>;
  const allRated = questions.every((_question, index) => answers[index] !== undefined);
  return <div className="mt-6 space-y-5">{questions.map((question, index) => <section className="rounded border border-[color:var(--border-default)] p-5" key={`${question.heading}-${index}`}>
    <p className="eyebrow">Prompt {index + 1}</p>
    <h3 className="mt-2 text-lg font-semibold">Explain: {question.heading}</h3>
    {!revealed[index] ? <button className="button button-primary mt-4" onClick={() => setRevealed((current) => ({ ...current, [index]: true }))} type="button">Reveal cited answer</button> : <div className="mt-4 border-t border-[color:var(--border-default)] pt-4">
      <p className="reading-width leading-7">{question.explanation}</p>
      <Citations catalog={catalog} ids={question.citation_ids} />
      <div aria-label={`Rate prompt ${index + 1}`} className="mt-4 flex flex-wrap gap-3" role="group">
        <button aria-pressed={answers[index] === true} className="button button-primary" onClick={() => setAnswers((current) => ({ ...current, [index]: true }))} type="button"><Check size={16} /> I got it</button>
        <button aria-pressed={answers[index] === false} className="button button-secondary" onClick={() => setAnswers((current) => ({ ...current, [index]: false }))} type="button"><RotateCcw size={16} /> Review again</button>
      </div>
    </div>}
  </section>)}
    <button className="button button-primary" disabled={!allRated || complete.isPending || complete.isSuccess} onClick={() => complete.mutate()} type="button"><BookOpenCheck size={16} /> {complete.isSuccess ? "Attempt recorded" : "Finish quiz"}</button>
    {!allRated ? <p className="muted text-sm">Reveal and rate every prompt to finish.</p> : null}
    {complete.error ? <p className="text-sm text-[color:var(--danger)]" role="alert">{String(complete.error)}</p> : null}
    {complete.isSuccess ? <p aria-live="polite" className="text-sm text-[color:var(--success)]">Your self-graded attempt was recorded.</p> : null}
  </div>;
}

function AssetBody({ asset, courseId, mode }: { asset: Asset; courseId: string; mode: string }) {
  if (mode === "cards") return <CardsView asset={asset} courseId={courseId} />;
  if (mode === "read" || mode === "doc") return <ReadingView asset={asset} courseId={courseId} mode={mode} />;
  if (mode === "quiz") return <QuizView asset={asset} courseId={courseId} />;
  return <details className="mt-5 border-t border-[color:var(--border-default)] pt-4"><summary className="button button-primary cursor-pointer">Open material</summary><pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-[color:var(--surface-canvas)] p-4 text-sm">{JSON.stringify(asset.content, null, 2)}</pre></details>;
}

export function StudyModePanel({ assets, courseId, mode }: { assets: Asset[]; courseId: string; mode: string }) {
  const selected = assets.filter((asset) => asset.status !== "rejected" && (studyAssetTypes[mode] ?? []).includes(asset.asset_type));
  if (!selected.length) return <EmptyState action={<Link className="button button-primary no-underline" href={`/courses/${courseId}/uploads`}>Choose sources</Link>} detail="Select a unit with enough confirmed material or add the source documents needed to generate an honest draft." title={`No ${mode.replaceAll("-", " ")} asset yet`} />;
  return <section className="grid gap-4">{selected.map((asset) => <article className="panel panel-interactive p-5" key={asset.id}><AssetHeader asset={asset} /><AssetBody asset={asset} courseId={courseId} mode={mode} /></article>)}</section>;
}
