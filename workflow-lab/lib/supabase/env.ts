/** Only the public URL and publishable key are ever read. There is no service-role key anywhere in this app. */
export type SupabaseEnv = { url: string; key: string };

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}
