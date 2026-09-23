export function institutionalPreview(env: Record<string, string | undefined>): boolean {
  return env.VITE_INSTITUTIONAL_PREVIEW === 'true';
}

/** Build-time preview switch. Production remains on the existing chrome. */
export const INSTITUTIONAL_PREVIEW = institutionalPreview(import.meta.env);
