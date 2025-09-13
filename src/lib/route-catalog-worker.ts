/* eslint-env worker */
import Papa from 'papaparse';
import { get, set } from 'idb-keyval';
import type { Driver, RouteCatalog } from './types';

const DRIVERS_URL = '/data/drivers.csv';
const GRID_URL = '/data/cities_grid.csv';
const HASH_KEY = 'routeCatalogHash';
const CATALOG_KEY = 'routeCatalog';

async function hashStrings(...texts: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(texts.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

self.addEventListener('message', async () => {
  const [driversCsv, gridCsv] = await Promise.all([
    fetch(DRIVERS_URL).then((r) => r.text()),
    fetch(GRID_URL).then((r) => r.text()),
  ]);

  const currentHash = await hashStrings(driversCsv, gridCsv);
  const cachedHash = await get<string>(HASH_KEY);
  const cachedCatalog = await get<RouteCatalog>(CATALOG_KEY);

  if (cachedHash === currentHash && cachedCatalog) {
    postMessage(cachedCatalog);
    return;
  }

  type RawRecord = Record<string, string>;
  const driversRows = Papa.parse<RawRecord>(driversCsv, { header: true }).data;
  const gridRows = Papa.parse<RawRecord>(gridCsv, { header: true }).data;

  const drivers: Driver[] = driversRows
    .filter((r) => r.driver_id)
    .map((r) => ({
      id: String(r.driver_id),
      path: String(r.route || '')
        .split(';')
        .map((c: string) => c.trim())
        .filter(Boolean),
    }));

  const edgeToDrivers: Record<string, string[]> = {};
  for (const driver of drivers) {
    for (let i = 0; i < driver.path.length - 1; i++) {
      const from = driver.path[i];
      const to = driver.path[i + 1];
      const key = `${from}-${to}`;
      (edgeToDrivers[key] ||= []).push(driver.id);
    }
  }

  const adj: Record<string, string[]> = {};
  for (const row of gridRows) {
    const from = String(row.from || '').trim();
    const to = String(row.to || '').trim();
    if (!from || !to) continue;
    (adj[from] ||= []).push(to);
  }

  const catalog: RouteCatalog = { drivers, edgeToDrivers, adj };

  await set(HASH_KEY, currentHash);
  await set(CATALOG_KEY, catalog);

  postMessage(catalog);
});

export {};
