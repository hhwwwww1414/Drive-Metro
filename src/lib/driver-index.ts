import { edgeKey } from './geometry';
import type { Driver } from './types';

export interface RouteCatalogEntry {
  city_ids: string[];
  drivers: string[];
}

export interface DriverIndex {
  pairExact: Record<string, number[]>; // start::end -> route ids
  subpath: Record<string, number[]>;   // any contiguous subpath start::end -> route ids
  edgeToDrivers: Record<string, string[]>; // edge key -> driver names
  adj: Record<string, string[]>; // city -> neighboring cities
  routeCatalog: RouteCatalogEntry[]; // unique route variants
}

function addToMapSet<T>(map: Map<string, Set<T>>, key: string, value: T) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key)!.add(value);
}

/**
 * Builds an index for quick driver route lookups.
 * Should be executed once on application start or inside a Web Worker.
 */
export function createDriverIndex(drivers: Driver[]): DriverIndex {
  const pairExact = new Map<string, Set<number>>();
  const subpath = new Map<string, Set<number>>();
  const edgeToDrivers = new Map<string, Set<string>>();
  const adj = new Map<string, Set<string>>();
  const routeCatalog: RouteCatalogEntry[] = [];
  const variantMap = new Map<string, number>(); // key -> route catalog index

  drivers.forEach((driver) => {
    driver.variants.forEach((variant) => {
      const key = variant.city_ids.join('>');
      let rid = variantMap.get(key);
      if (rid === undefined) {
        rid = routeCatalog.length;
        routeCatalog.push({ city_ids: variant.city_ids.slice(), drivers: [] });
        variantMap.set(key, rid);
      }
      const catalogEntry = routeCatalog[rid];
      if (!catalogEntry.drivers.includes(driver.name)) {
        catalogEntry.drivers.push(driver.name);
      }

      const ids = variant.city_ids;
      const start = ids[0];
      const end = ids[ids.length - 1];
      addToMapSet(pairExact, `${start}::${end}`, rid);

      for (let i = 0; i < ids.length - 1; i++) {
        const a = ids[i];
        const b = ids[i + 1];
        // edges and adjacency
        addToMapSet(edgeToDrivers, edgeKey(a, b), driver.name);
        addToMapSet(adj, a, b);
        addToMapSet(adj, b, a);
        // subpaths starting at a
        for (let j = i + 1; j < ids.length; j++) {
          addToMapSet(subpath, `${a}::${ids[j]}`, rid);
        }
      }
    });
  });

  // convert maps of sets to plain records with arrays
  const mapSetToRecord = <T>(m: Map<string, Set<T>>): Record<string, T[]> => {
    const obj: Record<string, T[]> = {};
    m.forEach((set, key) => {
      obj[key] = Array.from(set);
    });
    return obj;
  };

  return {
    pairExact: mapSetToRecord(pairExact),
    subpath: mapSetToRecord(subpath),
    edgeToDrivers: mapSetToRecord(edgeToDrivers),
    adj: mapSetToRecord(adj),
    routeCatalog,
  };
}

let currentIndex: DriverIndex | null = null;

export function initDriverIndex(drivers: Driver[]): void {
  currentIndex = createDriverIndex(drivers);
}

function requireIndex(): DriverIndex {
  if (!currentIndex) {
    throw new Error('Driver index has not been initialized');
  }
  return currentIndex;
}

export function getDriverIndex(): DriverIndex {
  return requireIndex();
}

function collectDrivers(index: DriverIndex, routeIds: number[]): string[] {
  const set = new Set<string>();
  routeIds.forEach((rid) => {
    index.routeCatalog[rid]?.drivers.forEach((d) => set.add(d));
  });
  return Array.from(set);
}

export function getDriversByExactPair(from: string, to: string, index: DriverIndex = requireIndex()): string[] {
  const key = `${from}::${to}`;
  const routeIds = index.pairExact[key] || [];
  return collectDrivers(index, routeIds);
}

export function getDriversBySubpath(from: string, to: string, index: DriverIndex = requireIndex()): string[] {
  const key = `${from}::${to}`;
  const routeIds = index.subpath[key] || [];
  return collectDrivers(index, routeIds);
}

export function getDriversByEdge(a: string, b: string, index: DriverIndex = requireIndex()): string[] {
  const key = edgeKey(a, b);
  return index.edgeToDrivers[key] || [];
}

export function getAdjacentCities(city: string, index: DriverIndex = requireIndex()): string[] {
  return index.adj[city] || [];
}
