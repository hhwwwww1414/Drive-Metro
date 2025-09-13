import type { RouteCatalog } from './types';

export function loadRouteCatalog(): Promise<RouteCatalog> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./route-catalog-worker.ts', import.meta.url));
    worker.onmessage = (e) => {
      resolve(e.data as RouteCatalog);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(e);
      worker.terminate();
    };
    worker.postMessage(null);
  });
}
