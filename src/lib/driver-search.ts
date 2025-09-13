import { edgeKey } from './geometry';
import { getDriverIndex, type DriverIndex } from './driver-index';

export interface DriverSegment {
  cities: string[]; // inclusive city chain covered by this segment
  drivers: string[]; // drivers that cover entire segment
}

export interface DriverRoute {
  cities: string[]; // full city chain from start to end
  segments: DriverSegment[]; // contiguous driver segments
  length: number; // number of edges in the path
  transfers: number; // number of transfers between drivers
  frequency: number; // minimal number of drivers per segment
}

export interface SearchOptions {
  index?: DriverIndex;
  maxDrivers?: number; // maximum segments (drivers) allowed
}

// Helper: BFS to find all shortest paths between two cities
function bfsAllShortestPaths(
  adj: Record<string, string[]>,
  start: string,
  goal: string
): string[][] {
  if (start === goal) return [[start]];
  const queue: string[][] = [[start]];
  const visited = new Map<string, number>();
  visited.set(start, 0);
  const paths: string[][] = [];
  let shortest = Infinity;
  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    const dist = path.length - 1;
    if (dist > shortest) break; // we already found all shortest paths
    if (node === goal) {
      shortest = dist;
      paths.push(path);
      continue;
    }
    const neighbors = adj[node] || [];
    for (const next of neighbors) {
      const nd = dist + 1;
      const prev = visited.get(next);
      if (prev !== undefined && nd > prev) continue;
      visited.set(next, nd);
      queue.push([...path, next]);
    }
  }
  return paths;
}

// Split a path by driver coverage
function splitPathByDriver(
  path: string[],
  index: DriverIndex
): DriverSegment[] | null {
  if (path.length < 2) return null;
  const segments: { cities: string[]; drivers: Set<string> }[] = [];
  let currentDrivers: Set<string> | null = null;
  let startIndex = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const drivers = index.edgeToDrivers[edgeKey(a, b)];
    if (!drivers || drivers.length === 0) return null; // uncovered edge
    const driverSet = new Set(drivers);
    if (currentDrivers === null) {
      currentDrivers = driverSet;
      startIndex = i;
      continue;
    }
    const intersection = new Set<string>();
    currentDrivers.forEach((d) => {
      if (driverSet.has(d)) intersection.add(d);
    });
    if (intersection.size > 0) {
      currentDrivers = intersection;
    } else {
      segments.push({
        cities: path.slice(startIndex, i + 1),
        drivers: currentDrivers,
      });
      currentDrivers = driverSet;
      startIndex = i;
    }
  }
  if (currentDrivers) {
    segments.push({
      cities: path.slice(startIndex, path.length),
      drivers: currentDrivers,
    });
  }
  return segments.map((s) => ({
    cities: s.cities,
    drivers: Array.from(s.drivers).sort(),
  }));
}

export function searchDrivers(
  from: string,
  to: string,
  options: SearchOptions = {}
): DriverRoute[] {
  const index = options.index ?? getDriverIndex();
  const maxDrivers = options.maxDrivers ?? 3;

  const results: DriverRoute[] = [];
  const seenChains = new Set<string>();

  // Direct matches using subpath index
  const key = `${from}::${to}`;
  const routeIds = index.subpath[key] || [];
  if (routeIds.length) {
    const bestByDriver = new Map<string, { cities: string[]; length: number }>();
    for (const rid of routeIds) {
      const entry = index.routeCatalog[rid];
      const ids = entry.city_ids;
      for (let i = 0; i < ids.length; i++) {
        if (ids[i] !== from) continue;
        for (let j = i + 1; j < ids.length; j++) {
          if (ids[j] !== to) continue;
          const chain = ids.slice(i, j + 1);
          const length = chain.length - 1;
          for (const driver of entry.drivers) {
            const cur = bestByDriver.get(driver);
            if (!cur || length < cur.length) {
              bestByDriver.set(driver, { cities: chain, length });
            }
          }
        }
      }
    }
    const chainMap = new Map<string, { cities: string[]; drivers: string[] }>();
    bestByDriver.forEach((value, driver) => {
      const k = value.cities.join('>');
      if (!chainMap.has(k)) chainMap.set(k, { cities: value.cities, drivers: [] });
      chainMap.get(k)!.drivers.push(driver);
    });
    chainMap.forEach(({ cities, drivers }) => {
      drivers.sort();
      const seg: DriverSegment = { cities, drivers };
      const route: DriverRoute = {
        cities,
        segments: [seg],
        length: cities.length - 1,
        transfers: 0,
        frequency: drivers.length,
      };
      results.push(route);
      seenChains.add(cities.join('>'));
    });
  }

  // Composite routes via BFS
  const paths = bfsAllShortestPaths(index.adj, from, to);
  for (const path of paths) {
    const chainKey = path.join('>');
    if (seenChains.has(chainKey)) continue;
    const segments = splitPathByDriver(path, index);
    if (!segments) continue;
    if (segments.length > maxDrivers) continue;
    const frequency = Math.min(...segments.map((s) => s.drivers.length));
    const route: DriverRoute = {
      cities: path,
      segments,
      length: path.length - 1,
      transfers: segments.length - 1,
      frequency,
    };
    results.push(route);
    seenChains.add(chainKey);
  }

  results.sort(
    (a, b) =>
      b.frequency - a.frequency ||
      a.length - b.length ||
      a.transfers - b.transfers
  );

  return results;
}

