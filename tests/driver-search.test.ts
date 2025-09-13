import { describe, it, expect } from 'vitest';
import type { Driver } from '../src/lib/types';
import { createDriverIndex } from '../src/lib/driver-index';
import { searchDrivers } from '../src/lib/driver-search';

describe('driver-search', () => {
  it('finds direct routes and groups drivers by shortest subpath', () => {
    const drivers: Driver[] = [
      { name: 'D1', variants: [{ city_ids: ['A', 'B', 'C', 'D'] }] },
      { name: 'D2', variants: [
        { city_ids: ['A', 'B', 'C'] },
        { city_ids: ['A', 'G', 'H', 'C'] },
      ] },
      { name: 'D3', variants: [{ city_ids: ['B', 'C'] }] },
      { name: 'D4', variants: [{ city_ids: ['A', 'E', 'C'] }] },
    ];
    const index = createDriverIndex(drivers);
    const res = searchDrivers('A', 'C', { index });
    expect(res).toHaveLength(2);
    expect(res[0].segments[0].cities).toEqual(['A', 'B', 'C']);
    expect(new Set(res[0].segments[0].drivers)).toEqual(new Set(['D1', 'D2']));
    expect(res[1].segments[0].cities).toEqual(['A', 'E', 'C']);
    expect(res[1].segments[0].drivers).toEqual(['D4']);
  });

  it('finds composite routes with up to 3 segments', () => {
    const drivers: Driver[] = [
      { name: 'D1', variants: [{ city_ids: ['A', 'B', 'C'] }] },
      { name: 'D2', variants: [{ city_ids: ['C', 'D'] }] },
      { name: 'D3', variants: [{ city_ids: ['B', 'E', 'D'] }] },
    ];
    const index = createDriverIndex(drivers);
    const res = searchDrivers('A', 'D', { index });
    expect(res).toHaveLength(2);
    const routes = res.map((r) => ({
      path: r.cities.join('>'),
      segments: r.segments.map((s) => ({
        cities: s.cities.join('>'),
        drivers: s.drivers.join(','),
      })),
    }));
    expect(routes).toEqual(expect.arrayContaining([
      {
        path: 'A>B>C>D',
        segments: [
          { cities: 'A>B>C', drivers: 'D1' },
          { cities: 'C>D', drivers: 'D2' },
        ],
      },
      {
        path: 'A>B>E>D',
        segments: [
          { cities: 'A>B', drivers: 'D1' },
          { cities: 'B>E>D', drivers: 'D3' },
        ],
      },
    ]));
  });

  it('respects maxDrivers option', () => {
    const drivers: Driver[] = [
      { name: 'D1', variants: [{ city_ids: ['A', 'B'] }] },
      { name: 'D2', variants: [{ city_ids: ['B', 'C'] }] },
      { name: 'D3', variants: [{ city_ids: ['C', 'D'] }] },
    ];
    const index = createDriverIndex(drivers);
    const res1 = searchDrivers('A', 'D', { index });
    expect(res1).toHaveLength(1);
    const res2 = searchDrivers('A', 'D', { index, maxDrivers: 2 });
    expect(res2).toHaveLength(0);
  });
});

