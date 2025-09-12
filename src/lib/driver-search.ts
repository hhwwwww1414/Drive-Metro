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
  edgeToDrivers: Record<string, string[]>
): Promise<CompositeRoute[]> {
  const index = await loadDrivers();
  origin = normalize(origin);
  destination = normalize(destination);
  const adjacency: Record<string, { to: string; drivers: string[] }[]> = {};
  for (const [key, drivers] of Object.entries(edgeToDrivers)) {
    const [from, to] = key.split('|');
    if (!adjacency[from]) adjacency[from] = [];
    adjacency[from].push({ to, drivers });
  }

  const results: CompositeRoute[] = [];
  const queue: { city: string; path: string[]; drivers: string[] }[] = [
    { city: origin, path: [origin], drivers: [] },
  ];
  const seen = new Set<string>();
  const maxDepth = 3; // максимум три ребра (две пересадки)

  while (queue.length) {
    const { city, path, drivers } = queue.shift()!;
    if (path.length > maxDepth + 1) continue;
    if (city === destination && drivers.length > 1) {
      const key = path.join('|') + '::' + drivers.join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const driverInfos = drivers.map((id) => {
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
      results.push({ path, drivers: driverInfos });
      continue;
    }
    const edges = adjacency[city] || [];
    for (const edge of edges) {
      if (path.includes(edge.to)) continue;
      for (const d of edge.drivers) {
        queue.push({ city: edge.to, path: [...path, edge.to], drivers: [...drivers, d] });
      }
    }
  }

  return results;
}

// Выполняет поиск и группирует результаты для UI
export async function searchDrivers(origin: string, destination: string): Promise<DriverSearchResult> {
  const index = await loadDrivers();

  const exact = await findExactDrivers(origin, destination);
  const seen = new Set(exact.map((d) => d.id));

  let geozone = await findGeozoneDrivers(origin, destination);
  geozone = geozone.filter((d) => !seen.has(d.id));
  geozone.forEach((d) => seen.add(d.id));

  let composite = await findCompositeRoutes(origin, destination, index.edgeToDrivers);
  composite = composite.filter((route) =>
    route.drivers.every((d) => !seen.has(d.id))
  );

  return { exact, geozone, composite };
}

export default searchDrivers;

