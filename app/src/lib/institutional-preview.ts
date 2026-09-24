export type PreviewEnv = Record<string, string | undefined>;

export function institutionalPreview(env: PreviewEnv): boolean {
  return env.VITE_INSTITUTIONAL_PREVIEW === 'true';
}

/** Build-time preview switch. Production remains on the existing chrome. */
export const INSTITUTIONAL_PREVIEW = institutionalPreview(import.meta.env);
