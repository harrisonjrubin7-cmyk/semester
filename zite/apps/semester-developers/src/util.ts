export const errorMessage = (e: unknown) => {
  const x = e as { userFacingMessage?: string; message?: string };
  return x?.userFacingMessage || x?.message || 'Something went wrong.';
};
export const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
