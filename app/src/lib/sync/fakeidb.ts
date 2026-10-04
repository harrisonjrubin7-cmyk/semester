// Test support: not shipped, and not a test file so `tsc` checks it.
/** Just enough IndexedDB for `lib/idb.ts`: named databases that outlive a connection. */
export function fakeIndexedDB() {
  const dbs = new Map<string, Map<string, Map<string, unknown>>>();
  const request = <T,>(result: () => T) => {
    const req = { result: undefined as T, error: null, onsuccess: null as null | (() => void), onerror: null as null | (() => void) };
    queueMicrotask(() => {
      req.result = result();
      req.onsuccess?.();
    });
    return req;
  };
  return {
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
          transaction(storeName: string) {
            const rows = stores.get(storeName)!;
            const t: { oncomplete: null | (() => void); objectStore: (s: string) => unknown } = {
              oncomplete: null,
              objectStore: () => ({
                getAll: () => request(() => [...rows.values()]),
                get: (id: string) => request(() => rows.get(id)),
                put: (v: { id: string }) => request(() => (rows.set(v.id, structuredClone(v)), v.id)),
                delete: (id: string) => request(() => void rows.delete(id)),
                clear: () => request(() => void rows.clear()),
              }),
            };
            queueMicrotask(() => queueMicrotask(() => queueMicrotask(() => t.oncomplete?.())));
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

