import { describe, it, expect } from 'vitest';
import { calculateParallelOffsets, type Edge } from '../src/lib/geometry';
import { loadSampleBundle } from './fixtures';

describe('calculateParallelOffsets', () => {
  it('mirrors offsets for reversed edges', () => {
    const bundle = loadSampleBundle();
    const l1 = bundle.lines.find((l) => l.line_id === 'L1')!;
    const l2 = bundle.lines.find((l) => l.line_id === 'L2')!;

    const edges: Edge[] = [
      { a: 'A', b: 'B', line: l1 },
      { a: 'B', b: 'A', line: l2 },
      { a: 'B', b: 'C', line: l1 },
    ];

    const result = calculateParallelOffsets(edges);
    const ab = result.filter(
      (e) => (e.a === 'A' && e.b === 'B') || (e.a === 'B' && e.b === 'A')
    );
    expect(ab.map((e) => e.offset)).toEqual([-3.5, -3.5]);
    const bc = result.find(
      (e) => (e.a === 'B' && e.b === 'C') || (e.a === 'C' && e.b === 'B')
    );
    expect(bc?.offset).toBe(0);
  });
});
