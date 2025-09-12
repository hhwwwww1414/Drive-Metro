import { loadDrivers, normalize } from './drivers';

export interface DriverInfo {
  id: string;
  label: string;
  phone?: string;
  branches: string[];
  corridors: string[];
  routes: string[][];
}

export interface CompositeRoute {
  path: string[];
  drivers: DriverInfo[];
  transfers: string[];
}

export interface DriverSearchResult {
  exact: DriverInfo[];
  geozone: DriverInfo[];
  composite: CompositeRoute[];
}

// Находит перевозчиков, чей маршрут начинается в origin и заканчивается в destination
export async function findExactDrivers(origin: string, destination: string): Promise<DriverInfo[]> {
  const index = await loadDrivers();
  origin = normalize(origin);
  destination = normalize(destination);
  const key = `${origin}|${destination}`;
  const ids = index.pairToDriversExact[key] || [];
  const out: DriverInfo[] = [];
  for (const id of ids) {
    const routes = (index.driverRoutes[id] || []).filter(
      (r) => r[0] === origin && r[r.length - 1] === destination
    );
    const meta = index.driverMeta[id] || { label: id, branches: [], corridors: [] };
    out.push({
      id,
      label: meta.label,
      phone: meta.phone,
      branches: meta.branches,
      corridors: meta.corridors,
      routes,
    });
  }
  return out;
}

// Ищет перевозчиков, которые проходят через origin и destination в указанном порядке
export async function findGeozoneDrivers(origin: string, destination: string): Promise<DriverInfo[]> {
  const index = await loadDrivers();
  origin = normalize(origin);
  destination = normalize(destination);
  const a = new Set(index.cityToDrivers[origin] || []);
  const candidates = (index.cityToDrivers[destination] || []).filter((id) => a.has(id));
  const out: DriverInfo[] = [];
  for (const id of candidates) {
    const routes: string[][] = [];
    for (const route of index.driverRoutes[id] || []) {
      const i = route.indexOf(origin);
      const j = route.indexOf(destination);
      if (i >= 0 && j > i) {
        routes.push(route.slice(i, j + 1));
      }
    }
    if (routes.length > 0) {
      const meta = index.driverMeta[id] || { label: id, branches: [], corridors: [] };
      out.push({
        id,
        label: meta.label,
        phone: meta.phone,
        branches: meta.branches,
        corridors: meta.corridors,
        routes,
      });
    }
  }
  return out;
}

// Строит составные маршруты из нескольких перевозчиков
export async function findCompositeRoutes(
  origin: string,
  destination: string,
  edgeToDrivers: Record<string, string[]>,
  maxTransfers = Infinity
): Promise<CompositeRoute[]> {
  const index = await loadDrivers();
  origin = normalize(origin);
  destination = normalize(destination);

  const adjacency: Record<string, string[]> = {};
  for (const key of Object.keys(edgeToDrivers)) {
    const [from, to] = key.split('|');
    if (!adjacency[from]) adjacency[from] = [];
    adjacency[from].push(to);
  }

  // BFS to compute shortest distances
  const dist: Record<string, number> = { [origin]: 0 };
  const q: string[] = [origin];
  while (q.length) {
    const city = q.shift()!;
    const d = dist[city];
    for (const n of adjacency[city] || []) {
      if (dist[n] === undefined) {
        dist[n] = d + 1;
        q.push(n);
      }
    }
  }
  const targetDist = dist[destination];
  if (targetDist === undefined) return [];

  // Collect all shortest paths using DFS respecting distances
  const paths: string[][] = [];
  function dfs(city: string, path: string[]) {
    if (city === destination) {
      paths.push([...path]);
      return;
    }
    const d = dist[city];
    for (const n of adjacency[city] || []) {
      if (dist[n] === d + 1) {
        path.push(n);
        dfs(n, path);
        path.pop();
      }
    }
  }
  dfs(origin, [origin]);

  const results: CompositeRoute[] = [];
  const seen = new Set<string>();

  for (const path of paths) {
    if (path.length < 2) continue;

    const segments: { start: number; end: number; drivers: Set<string> }[] = [];
    let start = 0;
    let current = new Set(edgeToDrivers[path[0] + '|' + path[1]] || []);
    if (current.size === 0) continue;
    for (let i = 2; i < path.length; i++) {
      const key = path[i - 1] + '|' + path[i];
      const nextSet = new Set(edgeToDrivers[key] || []);
      const intersect = new Set([...current].filter((d) => nextSet.has(d)));
      if (intersect.size > 0) {
        current = intersect;
      } else {
        segments.push({ start, end: i - 1, drivers: current });
        start = i - 1;
        current = nextSet;
      }
    }
    segments.push({ start, end: path.length - 1, drivers: current });

    if (segments.length === 0 || segments.length > 3) continue;
    if (segments.some((s) => s.drivers.size === 0)) continue;
    if (segments.length - 1 > maxTransfers) continue;

    const transferCities = segments.slice(0, -1).map((s) => path[s.end]);

    function build(idx: number, chosen: string[]) {
      if (idx === segments.length) {
        const key = path.join('|') + '::' + chosen.join('|');
        if (seen.has(key)) return;
        seen.add(key);
        const driverInfos = chosen.map((id) => {
          const meta = index.driverMeta[id] || {
            label: id,
            branches: [],
            corridors: [],
          };
          return {
            id,
            label: meta.label,
            phone: meta.phone,
            branches: meta.branches,
            corridors: meta.corridors,
            routes: index.driverRoutes[id] || [],
          };
        });
        results.push({ path, drivers: driverInfos, transfers: transferCities });
        return;
      }
      for (const d of segments[idx].drivers) {
        build(idx + 1, [...chosen, d]);
      }
    }

    build(0, []);
  }

  return results;
}

// Выполняет поиск и группирует результаты для UI
export async function searchDrivers(
  origin: string,
  destination: string,
  maxTransfers?: number
): Promise<DriverSearchResult> {
  const index = await loadDrivers();

  const exact = await findExactDrivers(origin, destination);
  const seen = new Set(exact.map((d) => d.id));

  let geozone = await findGeozoneDrivers(origin, destination);
  geozone = geozone.filter((d) => !seen.has(d.id));
  geozone.forEach((d) => seen.add(d.id));

  let composite = await findCompositeRoutes(
    origin,
    destination,
    index.edgeToDrivers,
    maxTransfers
  );
  composite = composite.filter((route) =>
    route.drivers.every((d) => !seen.has(d.id))
  );

  return { exact, geozone, composite };
}

export default searchDrivers;

