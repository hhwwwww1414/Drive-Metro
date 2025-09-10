import type { DataBundle, Line } from './types';

export type RouteSegment = {
  from: string;
  to: string;
  line: Line;
  transfer?: boolean;
};

export function nodeKey(cityId: string, lineId: string) {
  return `${cityId}::${lineId}`;
}

function parseNodeKey(key: string) {
  const [cityId, lineId] = key.split('::');
  return { cityId, lineId };
}

export function buildSegmentsFromPath(
  path: string[],
  bundle: DataBundle
): RouteSegment[] {
  const lineIndex: Record<string, Line> = {};
  for (const line of bundle.lines) lineIndex[line.line_id] = line;

  const segments: RouteSegment[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const { cityId: fromCity, lineId: fromLine } = parseNodeKey(path[i]);
    const { cityId: toCity, lineId: toLine } = parseNodeKey(path[i + 1]);

    if (fromCity === toCity) {
      segments.push({
        from: fromCity,
        to: toCity,
        line: lineIndex[toLine],
        transfer: true,
      });
    } else {
      segments.push({
        from: fromCity,
        to: toCity,
        line: lineIndex[fromLine],
      });
    }
  }
  return segments;
}
