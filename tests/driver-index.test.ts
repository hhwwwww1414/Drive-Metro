import { describe, it, expect } from 'vitest';
import { edgeKey } from '../src/lib/geometry';
import type { Driver } from '../src/lib/types';
import {
  createDriverIndex,
  getDriversByExactPair,
  getDriversBySubpath,
} from '../src/lib/driver-index';

describe('driver-index', () => {
  const drivers: Driver[] = [
    { name: 'D1', variants: [{ city_ids: ['A', 'B', 'C'] }] },
    { name: 'D2', variants: [{ city_ids: ['C', 'D'] }] },
    { name: 'D3', variants: [{ city_ids: ['A', 'B', 'C'] }] },
  ];

  const index = createDriverIndex(drivers);

  it('deduplicates route variants', () => {
    expect(index.routeCatalog).toHaveLength(2);
  });

  it('finds drivers by exact pair', () => {
    expect(new Set(getDriversByExactPair(index, 'A', 'C'))).toEqual(new Set(['D1', 'D3']));
    expect(getDriversByExactPair(index, 'C', 'D')).toEqual(['D2']);
  });

  it('finds drivers by subpath', () => {
    expect(new Set(getDriversBySubpath(index, 'A', 'B'))).toEqual(new Set(['D1', 'D3']));
    expect(new Set(getDriversBySubpath(index, 'B', 'C'))).toEqual(new Set(['D1', 'D3']));
  });

  it('maps edges to drivers', () => {
    const ab = edgeKey('A', 'B');
    const cd = edgeKey('C', 'D');
    expect(new Set(index.edgeToDrivers[ab])).toEqual(new Set(['D1', 'D3']));
    expect(index.edgeToDrivers[cd]).toEqual(['D2']);
  });

  it('builds adjacency map', () => {
    expect(new Set(index.adj['B'])).toEqual(new Set(['A', 'C']));
    expect(new Set(index.adj['C'])).toEqual(new Set(['B', 'D']));
  });
});
