// Загрузка и индексация данных о перевозчиках

export interface DriversIndex {
  cityToDrivers: Record<string, string[]>;
  pairToDriversExact: Record<string, string[]>;
  subpathIndex: Record<string, string[]>;
  edgeToDrivers: Record<string, string[]>;
  driverRoutes: Record<string, string[][]>;
  driverMeta: Record<
    string,
    { label: string; phone?: string; branches: string[]; corridors: string[] }
  >;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return await res.text();
}

export function normalize(s: string): string {
  return s
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

import { get, set } from 'idb-keyval';

let cache: DriversIndex | null = null;

const INDEX_KEY = 'drivers-index';
const HASH_KEY = 'drivers-hash';

export async function loadDrivers(): Promise<DriversIndex> {
  if (cache) return cache;

  const text = await fetchText('/data/drivers.csv');
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const [storedHash, storedIndex] = await Promise.all([
    get<string>(HASH_KEY),
    get<DriversIndex>(INDEX_KEY),
  ]);

  if (storedHash === hash && storedIndex) {
    cache = storedIndex;
    return cache;
  }

  const worker = new Worker(
    new URL('../../modules/search-worker/index-builder.ts', import.meta.url),
    { type: 'module' }
  );

  const index: DriversIndex = await new Promise((resolve, reject) => {
    worker.onmessage = (e) => resolve(e.data as DriversIndex);
    worker.onerror = (err) => reject(err);
    worker.postMessage({ csv: text });
  });
  worker.terminate();

  cache = index;
  await Promise.all([set(HASH_KEY, hash), set(INDEX_KEY, index)]);

  return cache;
}
