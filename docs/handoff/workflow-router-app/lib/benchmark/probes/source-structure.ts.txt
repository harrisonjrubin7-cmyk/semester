export interface ManifestEntry { path: string; bytes?: number }
export interface SourceStructure { files: number; multiFile: boolean; hasServerCode: boolean; hasMigrations: boolean; hasTests: boolean; hasEnvExample: boolean; leaksServiceRole: boolean }
export function probeSourceStructure(manifest: ManifestEntry[], contents: Record<string, string> = {}): SourceStructure {
  const p = manifest.map((m) => m.path);
  return {
    files: p.length, multiFile: p.length > 1,
    hasServerCode: p.some((x) => /(^|\/)(route\.ts|actions\.ts|middleware\.ts|proxy\.ts)$/.test(x) || /\/api\//.test(x)),
    hasMigrations: p.some((x) => /migrations\/.+\.sql$/.test(x)),
    hasTests: p.some((x) => /\.(test|spec)\.(t|j)sx?$/.test(x)),
    hasEnvExample: p.includes('.env.example'),
    leaksServiceRole: Object.entries(contents).some(([path, t]) => /SERVICE_ROLE/.test(t) && (/^(app|components)\//.test(path) && /['"]use client['"]/.test(t) || /NEXT_PUBLIC_[A-Z_]*SERVICE/.test(t))),
  };
}
