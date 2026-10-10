"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AppShell } from "./app-shell";
import { BenchmarkPanel } from "./benchmark-panel";
import { CalendarPanel } from "./calendar-panel";
import { navigation } from "./navigation";
import { OverviewPanel } from "./overview-panel";
import { ProgressPanel } from "./progress-panel";
import { ReviewPanel } from "./review-panel";
import { SourceStatusBadge } from "./source-status";
import { StudyModePanel } from "./study-mode-panel";
import { UploadPanel } from "./upload-panel";
import { ErrorState, LoadingState } from "./workspace-states";
import type { Asset, BackgroundJob, Course, Event, Progress, Review, SourceFile } from "./workspace-types";

function useOnlineStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

function PageHeader({ mode, course }: { mode: string; course?: Course }) {
  const destination = navigation.find((item) => item.id === mode);
  return <header className="mb-7 flex flex-col justify-between gap-5 border-b border-[color:var(--border-default)] pb-6 lg:flex-row lg:items-end"><div><p className="eyebrow">{destination?.label ?? mode.replaceAll("-", " ")}</p><h1 className="mt-2 font-[family-name:var(--font-heading)] text-4xl font-semibold tracking-tight">{course?.title ?? "Course workspace"}</h1><p className="muted mt-2 text-sm">{destination?.detail ?? "Course study workspace"} · <span className="mono">{course?.timezone ?? "Timezone loading"}</span></p></div><div className="flex flex-wrap items-center gap-2"><SourceStatusBadge detail="This course workspace was created by the signed-in student. Individual records retain their own source status." status="student_entered" /><span className="status-chip" data-tone="neutral">Citations required</span></div></header>;
}

export function Workspace({ courseId, mode }: { courseId: string; mode: string }) {
  const online = useOnlineStatus();
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => api<Course>(`/courses/${courseId}`) });
  const assets = useQuery({ queryKey: ["assets", courseId], queryFn: () => api<Asset[]>(`/courses/${courseId}/study-assets`) });
  const events = useQuery({ queryKey: ["events", courseId], queryFn: () => api<Event[]>(`/courses/${courseId}/calendar-events`) });
  const reviews = useQuery({ queryKey: ["reviews", courseId], queryFn: () => api<Review[]>(`/courses/${courseId}/review-items`) });
  const files = useQuery({ queryKey: ["files", courseId], queryFn: () => api<SourceFile[]>(`/courses/${courseId}/files`), refetchInterval: mode === "uploads" ? 3000 : false });
  const jobs = useQuery({
    queryKey: ["jobs", courseId],
    queryFn: () => api<BackgroundJob[]>(`/courses/${courseId}/jobs`),
    enabled: mode === "uploads",
    refetchInterval: (query) => query.state.data?.some((job) => job.status === "queued" || job.status === "running") ? 2000 : false,
  });
  const progress = useQuery({ queryKey: ["progress", courseId], queryFn: () => api<Progress>(`/courses/${courseId}/progress`), enabled: mode === "progress" });
  const queries = [course, assets, events, reviews, files];
  const loading = queries.some((query) => query.isLoading) || (mode === "progress" && progress.isLoading) || (mode === "uploads" && jobs.isLoading);
  const error = queries.map((query) => query.error).find(Boolean) ?? (mode === "progress" ? progress.error : null) ?? (mode === "uploads" ? jobs.error : null);
  const retry = () => { for (const query of queries) void query.refetch(); if (mode === "progress") void progress.refetch(); if (mode === "uploads") void jobs.refetch(); };

  function content() {
    if (loading) return <LoadingState />;
    if (error || !course.data) return <ErrorState error={error ?? "Course data unavailable"} retry={retry} />;
    if (mode === "overview") return <OverviewPanel course={course.data} events={events.data ?? []} reviews={reviews.data ?? []} />;
    if (mode === "calendar") return <CalendarPanel courseId={courseId} events={events.data ?? []} />;
    if (mode === "review") return <ReviewPanel courseId={courseId} reviews={reviews.data ?? []} />;
    if (mode === "uploads") return <UploadPanel courseId={courseId} files={files.data ?? []} jobs={jobs.data ?? []} offline={!online} />;
    if (mode === "progress") return <ProgressPanel progress={progress.data} />;
    if (mode === "benchmarks") return <BenchmarkPanel />;
    return <StudyModePanel assets={assets.data ?? []} courseId={courseId} mode={mode} />;
  }

  return <AppShell courseId={courseId} courseTitle={course.data?.title ?? "Course workspace"} mode={mode} offline={!online} term={course.data?.term}><PageHeader course={course.data} mode={mode} />{content()}</AppShell>;
}
