import { AlertTriangle, Layers3, RefreshCw } from "lucide-react";

export function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading course workspace" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((item) => <div className="skeleton h-28" key={item} />)}
      <span className="sr-only">Loading course workspace</span>
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <section className="panel border-[color:var(--danger)] p-6" role="alert">
      <AlertTriangle aria-hidden="true" className="mb-3 text-[color:var(--danger)]" />
      <h2 className="font-semibold">This workspace could not be loaded</h2>
      <p className="muted reading-width mt-2 text-sm">Your work has not been changed. Check the API connection or sign in again, then retry.</p>
      <details className="muted mt-3 text-xs"><summary>Technical detail</summary><pre className="mt-2 overflow-auto">{String(error)}</pre></details>
      <button className="button button-secondary mt-5" onClick={retry} type="button"><RefreshCw size={16} /> Retry</button>
    </section>
  );
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <section className="panel flex min-h-56 flex-col items-center justify-center p-8 text-center">
      <Layers3 aria-hidden="true" className="mb-4 text-[color:var(--semester-700)]" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="muted reading-width mt-2 text-sm">{detail}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export function OfflineStrip() {
  return (
    <div className="bg-[color:var(--warning)] px-5 py-2 text-center text-sm text-white" role="status">
      Offline. Existing content remains available, but uploads and updates will wait for a connection.
    </div>
  );
}
