import { describe, it, expect } from 'vitest';
import type { Driver } from '../src/lib/types';
import {
  initDriverIndex,
  getDriverIndex,
  getDriversByExactPair,
  getDriversBySubpath,
  getDriversByEdge,
  getAdjacentCities,
} from '../src/lib/driver-index';

describe('driver-index', () => {
  const drivers: Driver[] = [
    { name: 'D1', variants: [{ city_ids: ['A', 'B', 'C'] }] },
    { name: 'D2', variants: [{ city_ids: ['C', 'D'] }] },
    { name: 'D3', variants: [{ city_ids: ['A', 'B', 'C'] }] },
  ];

  initDriverIndex(drivers);
  const index = getDriverIndex();

  it('deduplicates route variants', () => {
    expect(index.routeCatalog).toHaveLength(2);
  });

  it('finds drivers by exact pair', () => {
    expect(new Set(getDriversByExactPair('A', 'C'))).toEqual(new Set(['D1', 'D3']));
    expect(getDriversByExactPair('C', 'D')).toEqual(['D2']);
  });

  it('finds drivers by subpath', () => {
    expect(new Set(getDriversBySubpath('A', 'B'))).toEqual(new Set(['D1', 'D3']));
    expect(new Set(getDriversBySubpath('B', 'C'))).toEqual(new Set(['D1', 'D3']));
  });

  it('maps edges to drivers', () => {
    expect(new Set(getDriversByEdge('A', 'B'))).toEqual(new Set(['D1', 'D3']));
    expect(getDriversByEdge('C', 'D')).toEqual(['D2']);
  });

  it('builds adjacency map', () => {
    expect(new Set(getAdjacentCities('B'))).toEqual(new Set(['A', 'C']));
    expect(new Set(getAdjacentCities('C'))).toEqual(new Set(['B', 'D']));
  });
});
