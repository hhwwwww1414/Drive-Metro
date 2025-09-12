/// <reference lib="webworker" />

import Papa from 'papaparse';

export interface DriversIndex {
  cityToDrivers: Record<string, string[]>;
  pairToDriversExact: Record<string, string[]>;
  subpathIndex: Record<string, string[]>;
  edgeToDrivers: Record<string, string[]>;
  driverRoutes: Record<string, string[][]>;
  driverMeta: Record<string, { label: string; phone?: string; branches: string[]; corridors: string[] }>;
}

interface BuildMessage {
  csv: string;
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

self.addEventListener('message', (event: MessageEvent<BuildMessage>) => {
  const { csv } = event.data;
  Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    worker: true,
    complete: (results) => {
      const rows = results.data;
      const cityToDrivers: Record<string, Set<string>> = {};
      const pairToDriversExact: Record<string, Set<string>> = {};
      const subpathIndex: Record<string, Set<string>> = {};
      const edgeToDrivers: Record<string, Set<string>> = {};
      const driverRoutes: Record<string, string[][]> = {};
      const driverMeta: Record<string, { label: string; phone?: string; branches: string[]; corridors: string[] }> = {};

      for (const row of rows) {
        const rawDriver = row['Перевозчик'];
        const detail = row['Города (детализация)'];
        if (!rawDriver || rawDriver === '-' || rawDriver === '--') continue;
        if (!detail) continue;

        const driverLabel = rawDriver.trim();
        const driverId = normalize(driverLabel);
        const phoneMatch = driverLabel.match(/(\+?\d[\d\s-]+)/);
        const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '') : undefined;
        const label = phoneMatch ? driverLabel.replace(phoneMatch[1], '').trim() : driverLabel;
        const branches = row['Ветки (может обслужить)']
          ? row['Ветки (может обслужить)']
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const corridors = row['Коридоры (может обслужить)']
          ? row['Коридоры (может обслужить)']
              .split(';')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
        const routes = parseRoutes(detail);
        if (routes.length === 0) continue;

        driverRoutes[driverId] = routes;
        driverMeta[driverId] = { label, phone, branches, corridors };

        for (const cities of routes) {
          for (const city of cities) {
            if (!cityToDrivers[city]) cityToDrivers[city] = new Set();
            cityToDrivers[city].add(driverId);
          }
          const start = cities[0];
          const end = cities[cities.length - 1];
          const pairKey = `${start}|${end}`;
          if (!pairToDriversExact[pairKey]) pairToDriversExact[pairKey] = new Set();
          pairToDriversExact[pairKey].add(driverId);
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

      const index: DriversIndex = {
        cityToDrivers: finalize(cityToDrivers),
        pairToDriversExact: finalize(pairToDriversExact),
        subpathIndex: finalize(subpathIndex),
        edgeToDrivers: finalize(edgeToDrivers),
        driverRoutes,
        driverMeta,
      };

      (self as DedicatedWorkerGlobalScope).postMessage(index);
    },
  });
});

export {};
