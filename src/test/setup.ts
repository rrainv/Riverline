// Node 26 exposes globalThis.localStorage as undefined without --localstorage-file,
// which can shadow jsdom's Storage in Vitest. Provide a standard Storage fallback for tests.
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}
