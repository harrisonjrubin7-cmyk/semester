/**
 * Static checks over exported source files. These create EVIDENCE for a human
 * grader; they never replace review, and they say nothing about architecture
 * quality by themselves.
 */
export type SourceFile = { path: string; content: string; language?: string };

export type StaticProbeResult = {
  passed: boolean;
  score: number;
  max: number;
  checks: Array<{ id: string; label: string; found: boolean }>;
  evidence: string[];
};

const CHECKS: Array<{ id: string; label: string; test: (files: SourceFile[]) => boolean }> = [
  { id: "readme", label: "README present", test: (f) => f.some((x) => /readme/i.test(x.path)) },
  { id: "typescript", label: "TypeScript source", test: (f) => f.some((x) => /\.(ts|tsx)$/.test(x.path)) },
  {
    id: "error-state",
    label: "Error-state handling",
    test: (f) => f.some((x) => /ErrorBoundary|setError|catch\s*\(|throw new Error|error\.tsx/.test(x.content) || /error\.tsx$/.test(x.path)),
  },
  {
    id: "loading-state",
    label: "Loading-state handling",
    test: (f) => f.some((x) => /isLoading|isPending|useFormStatus|Suspense|loading\.tsx|\bloading\b\s*[=:?]/.test(x.content) || /loading\.tsx$/.test(x.path)),
  },
  { id: "validation", label: "Input validation", test: (f) => f.some((x) => /\bzod\b|safeParse|\.parse\(|validate/i.test(x.content)) },
  { id: "tests", label: "Tests present", test: (f) => f.some((x) => /(\.|\/)(test|spec)\.[tj]sx?$/.test(x.path)) },
];

export function scoreSourceStructure(files: SourceFile[]): StaticProbeResult {
  const checks = CHECKS.map((c) => ({ id: c.id, label: c.label, found: files.length > 0 && c.test(files) }));
  const score = checks.filter((c) => c.found).length;
  return {
    passed: score >= 3,
    score,
    max: checks.length,
    checks,
    evidence: files.length === 0 ? ["No source files were captured."] : checks.filter((c) => c.found).map((c) => `${c.label} detected`),
  };
}

/** Flags that a server secret was shipped to code that runs in the browser. */
export function findSecretLeaks(files: SourceFile[]): string[] {
  const hits: string[] = [];
  for (const f of files) {
    if (/NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET)/i.test(f.content)) hits.push(`${f.path}: secret-looking NEXT_PUBLIC_ variable`);
    if (/service_role/i.test(f.content) && /["']use client["']/.test(f.content)) hits.push(`${f.path}: service-role reference in a client component`);
    if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(f.content)) hits.push(`${f.path}: Supabase secret key literal`);
  }
  return hits;
}
