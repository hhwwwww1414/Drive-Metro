import { describe, it, expect } from 'vitest';
import { findRoutes, buildParallelEdges, placeLabels } from '../src/lib/graph';
import { loadSampleBundle } from './fixtures';

const bundle = loadSampleBundle();

describe('findRoutes', () => {
  it('finds simple route without transfers', () => {
    const routes = findRoutes(bundle, 'A', 'C', 1);
    expect(routes).toHaveLength(1);
    const route = routes[0].map((s) => ({
      from: s.from,
      to: s.to,
      line: s.line.line_id,
      transfer: !!s.transfer,
    }));
    expect(route).toEqual([
      { from: 'A', to: 'B', line: 'L1', transfer: false },
      { from: 'B', to: 'C', line: 'L1', transfer: false },
    ]);
  });

  it('handles transfers between corridors', () => {
    const routes = findRoutes(bundle, 'D', 'C', 1);
    expect(routes).toHaveLength(1);
    const route = routes[0].map((s) => ({
      from: s.from,
      to: s.to,
      line: s.line.line_id,
      transfer: !!s.transfer,
    }));
    expect(route).toEqual([
      { from: 'D', to: 'B', line: 'L2', transfer: false },
      { from: 'B', to: 'B', line: 'L1', transfer: true },
      { from: 'B', to: 'C', line: 'L1', transfer: false },
    ]);
  });
});

describe('buildParallelEdges', () => {
  it('calculates offsets for shared segments', () => {
    const edges = buildParallelEdges(bundle);
    const ab = edges.filter(
      (e) => (e.a === 'A' && e.b === 'B') || (e.a === 'B' && e.b === 'A')
    );
    expect(ab).toHaveLength(2);
    const offsets = ab.map((e) => ({ line: e.line.line_id, offset: e.offset })).sort((a,b)=>a.line.localeCompare(b.line));
    expect(offsets).toEqual([
      { line: 'L1', offset: -3.5 },
      { line: 'L2', offset: 3.5 },
    ]);
  });
});

describe('placeLabels', () => {
  it('offsets labels deterministically', () => {
    const pts = { A: { x: 0, y: 0 }, B: { x: 10, y: 0 }, C: { x: 20, y: 0 } };
    const placed = placeLabels(pts);
    expect(placed).toEqual({
      A: { x: 14, y: 4 },
      B: { x: 34, y: 6 },
      C: { x: 54, y: 8 },
    });
  });
});
