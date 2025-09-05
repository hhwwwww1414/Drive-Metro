import type { City, DataBundle, Line } from './types';
import { calculateParallelOffsets, edgeKey, type ParallelEdge } from './geometry';

export type Edge = {
  a: string;       // city_id
  b: string;       // city_id
  line: Line;      // метаданные линии
};

export function mapCities(cities: City[]) {
  const idx: Record<string, City> = {};
  for (const c of cities) idx[c.city_id] = c;
  return idx;
}

export function getXY(cityId: string, index: Record<string, City>) {
  const c = index[cityId];
  return { x: c.x, y: c.y };
}

// мягкая версия: вернёт undefined, если города нет
export function tryGetXY(
  cityId: string,
  index: Record<string, City>
): { x: number; y: number } | undefined {
  const c = index[cityId];
  if (!c) return undefined;
  return { x: c.x, y: c.y };
}

export function lineToEdges(line: Line, bundle: DataBundle): Edge[] {
  const path = bundle.linePaths
    .filter((p) => p.line_id === line.line_id)
    .sort((a, b) => a.seq - b.seq);

  const edges: Edge[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    edges.push({ a: path[i].city_id, b: path[i + 1].city_id, line });
  }
  return edges;
}

export function buildAllEdges(bundle: DataBundle) {
  const lines = [...bundle.lines].sort(
    (a, b) =>
      (a.draw_order ?? Number.POSITIVE_INFINITY) -
      (b.draw_order ?? Number.POSITIVE_INFINITY)
  );
  return lines.flatMap((l) => lineToEdges(l, bundle));
}

// Collapse duplicate edges within the same corridor on a segment, so that
// common sections of multiple variants render as a single stroke per corridor.
function dedupeEdgesByCorridor(edges: Edge[]): Edge[] {
  const seen = new Map<string, Edge>(); // key: segmentKey::corridor_id
  for (const e of edges) {
    const key = `${edgeKey(e.a, e.b)}::${e.line.corridor_id}`;
    if (!seen.has(key)) {
      seen.set(key, e);
    }
  }
  return Array.from(seen.values());
}

// Создает параллельные ребра с разведением линий
export function buildParallelEdges(bundle: DataBundle): ParallelEdge[] {
  const edges = dedupeEdgesByCorridor(buildAllEdges(bundle));
  return calculateParallelOffsets(edges);
}

// Build parallel edges using only currently visible lines.
export function buildParallelEdgesForActive(
  bundle: DataBundle,
  active: Set<string>
): ParallelEdge[] {
  const lines = bundle.lines.filter((l) => active.has(l.line_id));
  const edges = dedupeEdgesByCorridor(lines.flatMap((l) => lineToEdges(l, bundle)));
  return calculateParallelOffsets(edges);
}

export function buildAllEdgesSafe(bundle?: DataBundle | null) {
  if (!bundle) return [];
  return buildAllEdges(bundle);
}

// очень простой раскладчик подписей (без коллизий, но с оффсетами)
export function placeLabels(
  pts: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const keys = Object.keys(pts).sort();
  keys.forEach((k, i) => {
    const p = pts[k];
    const dx = 14 + ((i % 4) * 10); // немного разнесём
    const dy = 4 + ((i % 3) * 2);
    out[k] = { x: p.x + dx, y: p.y + dy };
  });
  return out;
}
