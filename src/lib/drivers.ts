// Загрузка и индексация данных о перевозчиках

export interface DriversIndex {
  cityToDrivers: Record<string, string[]>;
  pairToDriversExact: Record<string, string[]>;
  subpathIndex: Record<string, string[]>;
  edgeToDrivers: Record<string, string[]>;
  driverRoutes: Record<string, string[][]>;
  driverMeta: Record<string, { label: string }>;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return await res.text();
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\uFEFF/g, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length === 1 && cols[0] === '') continue;
    const rec: Record<string, string> = {};
    headers.forEach((h, j) => (rec[h] = (cols[j] ?? '').trim()));
    rows.push(rec);
  }
  return rows;
}

function normalize(s: string): string {
  return s
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function parseRoutes(detail: string): string[][] {
  const cleaned = normalize(detail);
  return cleaned
    .split(/\|{1,2}/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.split(/\s+-\s+/).map((c) => c.trim()).filter(Boolean))
    .filter((arr) => arr.length > 1);
}

let cache: DriversIndex | null = null;

export async function loadDrivers(): Promise<DriversIndex> {
  if (cache) return cache;

  const text = await fetchText('/data/drivers.csv');
  const rows = parseCSV(text);

  const cityToDrivers: Record<string, Set<string>> = {};
  const pairToDriversExact: Record<string, Set<string>> = {};
  const subpathIndex: Record<string, Set<string>> = {};
  const edgeToDrivers: Record<string, Set<string>> = {};
  const driverRoutes: Record<string, string[][]> = {};
  const driverMeta: Record<string, { label: string }> = {};

  for (const row of rows) {
    const rawDriver = row['Перевозчик'];
    const detail = row['Города (детализация)'];
    if (!rawDriver || rawDriver === '-' || rawDriver === '--') continue;
    if (!detail) continue;

    const driverLabel = rawDriver.trim();
    const driverId = normalize(driverLabel);
    const routes = parseRoutes(detail);
    if (routes.length === 0) continue;

    driverRoutes[driverId] = routes;
    driverMeta[driverId] = { label: driverLabel };

    for (const cities of routes) {
      // cityToDrivers
      for (const city of cities) {
        if (!cityToDrivers[city]) cityToDrivers[city] = new Set();
        cityToDrivers[city].add(driverId);
      }
      // pairToDriversExact
      const start = cities[0];
      const end = cities[cities.length - 1];
      const pairKey = `${start}|${end}`;
      if (!pairToDriversExact[pairKey]) pairToDriversExact[pairKey] = new Set();
      pairToDriversExact[pairKey].add(driverId);
      // edges and subpaths
      for (let i = 0; i < cities.length - 1; i++) {
        const a = cities[i];
        const b = cities[i + 1];
        const edgeKey = `${a}|${b}`;
        if (!edgeToDrivers[edgeKey]) edgeToDrivers[edgeKey] = new Set();
        edgeToDrivers[edgeKey].add(driverId);
        for (let j = i + 1; j < cities.length; j++) {
          const sub = cities.slice(i, j + 1);
          const key = sub.join('|');
          if (!subpathIndex[key]) subpathIndex[key] = new Set();
          subpathIndex[key].add(driverId);
        }
      }
    }
  }

  function finalize(rec: Record<string, Set<string>>): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(rec)) out[k] = Array.from(v);
    return out;
  }

  cache = {
    cityToDrivers: finalize(cityToDrivers),
    pairToDriversExact: finalize(pairToDriversExact),
    subpathIndex: finalize(subpathIndex),
    edgeToDrivers: finalize(edgeToDrivers),
    driverRoutes,
    driverMeta,
  };

  return cache;
}
