// Test support: not shipped, and not a test file so `tsc` checks it.
/** Just enough IndexedDB for `lib/idb.ts`: named databases that outlive a connection. */
export function fakeIndexedDB() {
  const dbs = new Map<string, Map<string, Map<string, unknown>>>();
  let abortNextWrite = false;
  const request = <T,>(result: () => T) => {
    const req = { result: undefined as T, error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
    queueMicrotask(() => {
      req.result = result();
      req.onsuccess?.();
    });
    return req;
  };
  return {
    abortNextWrite() { abortNextWrite = true; },
    open(name: string) {
      const req: { result: unknown; error: null; onupgradeneeded: null | (() => void); onsuccess: null | (() => void); onerror: null | (() => void) } =
        { result: undefined, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        const stores = dbs.get(name) ?? new Map<string, Map<string, unknown>>();
        const fresh = !dbs.has(name);
        dbs.set(name, stores);
        req.result = {
          objectStoreNames: { contains: (s: string) => stores.has(s) },
          createObjectStore: (s: string) => stores.set(s, new Map()),
          close() {},
          transaction(storeName: string, mode: IDBTransactionMode = 'readonly') {
            const rows = stores.get(storeName)!;
            const working = mode === 'readwrite' ? new Map(rows) : rows;
            let aborted = false;
            const t: { error: Error | null; oncomplete: null | (() => void); onabort: null | (() => void); onerror: null | (() => void); abort: () => void; objectStore: (s: string) => unknown } = {
              error: null,
              oncomplete: null,
              onabort: null,
              onerror: null,
              abort: () => {
                if (aborted) return;
                aborted = true;
                t.error = new Error('Synthetic IndexedDB transaction abort.');
                queueMicrotask(() => t.onabort?.());
              },
              objectStore: () => ({
                getAll: () => request(() => [...working.values()]),
                get: (id: string) => request(() => working.get(id)),
                getAllKeys: () => request(() => [...working.keys()]),
                put: (v: { id: string }) => request(() => {
                  working.set(v.id, structuredClone(v));
                  if (abortNextWrite) {
                    abortNextWrite = false;
                    queueMicrotask(() => t.abort());
                  }
                  return v.id;
                }),
                delete: (id: string) => request(() => void working.delete(id)),
                clear: () => request(() => void working.clear()),
              }),
            };
            queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => {
              if (aborted) return;
              if (mode === 'readwrite') {
                rows.clear();
                for (const [key, value] of working) rows.set(key, value);
              }
              t.oncomplete?.();
            })));
            return t;
          },
        };
        if (fresh) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

