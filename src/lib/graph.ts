import type { City, DataBundle, Line } from './types';
import { calculateParallelOffsets, edgeKey, type ParallelEdge } from './geometry';
import { buildSegmentsFromPath, nodeKey, type RouteSegment } from './router';

// города, в которых допускается пересадка между коридорами
// если город не входит в список, маршрут старается оставаться
// в пределах одного коридора
const CORRIDOR_HUBS = new Set([
  'Москва',
  'Ростов-на-Дону',
  'Тольятти',
  'Набережные Челны',
  'Казань',
  'Уфа',
  'Екатеринбург',
  'Тюмень',
  'Новосибирск',
  'Омск',
  'Красноярск',
]);

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

type Cost = { transfers: number; length: number };
type WeightedEdge = { to: string; cost: Cost };
type WeightedGraph = Map<string, WeightedEdge[]>;

function addCost(a: Cost, b: Cost): Cost {
  return { transfers: a.transfers + b.transfers, length: a.length + b.length };
}

function compareCost(a: Cost, b: Cost): number {
  return a.transfers - b.transfers || a.length - b.length;
}

function buildWeightedGraph(bundle: DataBundle): {
  graph: WeightedGraph;
  cityLines: Map<string, Set<string>>;
} {
  const edges = buildAllEdges(bundle);
  const graph: WeightedGraph = new Map();
  const cityLines = new Map<string, Set<string>>();
  const lineCorridor = new Map<string, string>();
  for (const l of bundle.lines) lineCorridor.set(l.line_id, l.corridor_id);

  function addEdge(from: string, to: string, cost: Cost) {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push({ to, cost });
  }

  function addCityLine(city: string, line: string) {
    if (!cityLines.has(city)) cityLines.set(city, new Set());
    cityLines.get(city)!.add(line);
  }

  // ребра без пересадок
  for (const e of edges) {
    const a = nodeKey(e.a, e.line.line_id);
    const b = nodeKey(e.b, e.line.line_id);
    const cost: Cost = { transfers: 0, length: 1 };
    addEdge(a, b, cost);
    addEdge(b, a, cost);
    addCityLine(e.a, e.line.line_id);
    addCityLine(e.b, e.line.line_id);
  }

  // пересадки в узлах
  for (const [city, lines] of cityLines) {
    const ls = Array.from(lines);
    for (let i = 0; i < ls.length; i++) {
      for (let j = i + 1; j < ls.length; j++) {
        const l1 = ls[i];
        const l2 = ls[j];
        const c1 = lineCorridor.get(l1);
        const c2 = lineCorridor.get(l2);
        const n1 = nodeKey(city, l1);
        const n2 = nodeKey(city, l2);

        if (c1 === c2) {
          const cost: Cost = { transfers: 0, length: 0 };
          addEdge(n1, n2, cost);
          addEdge(n2, n1, cost);
        } else if (CORRIDOR_HUBS.has(city)) {
          const cost: Cost = { transfers: 1, length: 0 };
          addEdge(n1, n2, cost);
          addEdge(n2, n1, cost);
        }
      }
    }
  }

  return { graph, cityLines };
}

type Path = { nodes: string[]; cost: Cost };

function shortestPath(
  graph: WeightedGraph,
  startNodes: string[],
  endNodes: Set<string>
): Path | null {
  const queue: Array<{ node: string; cost: Cost; path: string[] }> = [];
  for (const n of startNodes) {
    queue.push({ node: n, cost: { transfers: 0, length: 0 }, path: [n] });
  }
  const seen = new Map<string, Cost>();

  while (queue.length) {
    queue.sort((a, b) => compareCost(a.cost, b.cost));
    const cur = queue.shift()!;
    if (endNodes.has(cur.node)) return { nodes: cur.path, cost: cur.cost };
    const prevBest = seen.get(cur.node);
    if (prevBest && compareCost(cur.cost, prevBest) > 0) continue;
    seen.set(cur.node, cur.cost);
    const neighbors = graph.get(cur.node) || [];
    for (const { to, cost } of neighbors) {
      const nextCost = addCost(cur.cost, cost);
      const best = seen.get(to);
      if (!best || compareCost(nextCost, best) < 0) {
        queue.push({ node: to, cost: nextCost, path: [...cur.path, to] });
      }
    }
  }
  return null;
}

function pathCost(path: string[], graph: WeightedGraph): Cost {
  let cost: Cost = { transfers: 0, length: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const edges = graph.get(path[i]) || [];
    const edge = edges.find((e) => e.to === path[i + 1]);
    if (edge) cost = addCost(cost, edge.cost);
  }
  return cost;
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function kShortestPaths(
  graphOrig: WeightedGraph,
  startNodes: string[],
  endNodes: Set<string>,
  k: number
): Path[] {
  const first = shortestPath(graphOrig, startNodes, endNodes);
  if (!first) return [];
  const A: Path[] = [first];
  const B: Path[] = [];

  for (let k1 = 1; k1 < k; k1++) {
    const prev = A[k1 - 1];
    for (let i = 0; i < prev.nodes.length - 1; i++) {
      const spurNode = prev.nodes[i];
      const rootPath = prev.nodes.slice(0, i + 1);

      const graph: WeightedGraph = new Map();
      for (const [node, edges] of graphOrig) {
        graph.set(node, edges.slice());
      }

      for (const p of A) {
        if (p.nodes.length > i && arraysEqual(rootPath, p.nodes.slice(0, i + 1))) {
          const from = p.nodes[i];
          const to = p.nodes[i + 1];
          const edges = graph.get(from);
          if (edges) {
            const idx = edges.findIndex((e) => e.to === to);
            if (idx !== -1) edges.splice(idx, 1);
          }
        }
      }

      const spurPath = shortestPath(graph, [spurNode], endNodes);
      if (spurPath) {
        const totalNodes = rootPath.slice(0, -1).concat(spurPath.nodes);
        const rootCost = pathCost(rootPath, graphOrig);
        const totalCost = addCost(rootCost, spurPath.cost);
        const candidate: Path = { nodes: totalNodes, cost: totalCost };
        if (!B.some((p) => arraysEqual(p.nodes, totalNodes))) {
          B.push(candidate);
        }
      }
    }

    if (!B.length) break;
    B.sort((a, b) => compareCost(a.cost, b.cost));
    A.push(B.shift()!);
  }

  return A;
}

export function findRoutes(
  bundle: DataBundle,
  startId: string,
  endId: string,
  k = 3
): RouteSegment[][] {
  if (startId === endId) return [];

  const { graph, cityLines } = buildWeightedGraph(bundle);
  const startLines = cityLines.get(startId);
  const endLines = cityLines.get(endId);
  if (!startLines || !endLines) return [];

  const startNodes = Array.from(startLines, (l) => nodeKey(startId, l));
  const endNodes = new Set(Array.from(endLines, (l) => nodeKey(endId, l)));

  const paths = kShortestPaths(graph, startNodes, endNodes, k);
  return paths.map((p) => buildSegmentsFromPath(p.nodes, bundle));
}

// Сохранённая версия для совместимости: возвращает только первый маршрут
export function findRoute(
  bundle: DataBundle,
  startId: string,
  endId: string
): RouteSegment[] {
  return findRoutes(bundle, startId, endId, 1)[0] ?? [];
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
