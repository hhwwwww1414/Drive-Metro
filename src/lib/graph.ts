import type { City, DataBundle, Line } from './types';

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
  const lines = [...bundle.lines].sort((a, b) => (a.draw_order ?? 0) - (b.draw_order ?? 0));
  return lines.flatMap((l) => lineToEdges(l, bundle));
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
