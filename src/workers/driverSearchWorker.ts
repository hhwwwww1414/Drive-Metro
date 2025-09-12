/// <reference lib="webworker" />

import searchDrivers, { DriverSearchResult } from '@/lib/driver-search';
import { loadDrivers } from '@/lib/drivers';

interface LoadMessage {
  type: 'load';
}

interface SearchMessage {
  type: 'search';
  from: string;
  to: string;
}

type WorkerMessage = LoadMessage | SearchMessage;

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'load':
      await loadDrivers();
      (self as DedicatedWorkerGlobalScope).postMessage({ type: 'loaded' });
      break;
    case 'search':
      try {
        const result: DriverSearchResult = await searchDrivers(msg.from, msg.to);
        (self as DedicatedWorkerGlobalScope).postMessage({ type: 'result', result });
      } catch (err) {
        (self as DedicatedWorkerGlobalScope).postMessage({
          type: 'error',
          error: (err as Error).message,
        });
      }
      break;
  }
});

export {};
