import { METRO_CONFIG } from './metro-config';
import type { City, Line, LinePath } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface Edge {
  a: string; // city_id
  b: string; // city_id
  line: Line;
}

export interface ParallelEdge extends Edge {
  offset: number; // смещение от основной оси в пикселях
}

// Вычисляет расстояние между двумя точками
export function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Вычисляет угол между двумя точками в радианах
export function angle(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Вычисляет перпендикулярный вектор (нормализованный)
export function perpendicular(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { x: 0, y: 1 };
  return { x: -dy / len, y: dx / len };
}

// Создает ключ для ребра (упорядоченный)
export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Группирует ребра по общим сегментам
export function groupEdgesBySegment(edges: Edge[]): Map<string, Edge[]> {
  const groups = new Map<string, Edge[]>();
  
  for (const edge of edges) {
    const key = edgeKey(edge.a, edge.b);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(edge);
  }
  
  return groups;
}

// Вычисляет смещения для параллельных линий
export function calculateParallelOffsets(edges: Edge[]): ParallelEdge[] {
  const groups = groupEdgesBySegment(edges);
  const result: ParallelEdge[] = [];
  
  for (const [segmentKey, segmentEdges] of groups) {
    // Сортируем линии по line_id для стабильного порядка
    const sortedEdges = segmentEdges.sort((a, b) => a.line.line_id.localeCompare(b.line.line_id));
    
    // Вычисляем смещения симметрично относительно центра
    const count = sortedEdges.length;
    const spacing = METRO_CONFIG.PARALLEL_LINE_SPACING;
    
    for (let i = 0; i < count; i++) {
      let offset = 0;
      if (count > 1) {
        // Симметричное распределение: -1.5, -0.5, +0.5, +1.5 для 4 линий
        const center = (count - 1) / 2;
        offset = (i - center) * spacing;
      }

      const edge = sortedEdges[i];
      // If the edge direction is reversed relative to the canonical
      // segment order, flip the offset so that parallel lines are drawn on
      // opposite sides of the shared segment regardless of their order in
      // the CSV paths.
      const direction = edge.a < edge.b ? 1 : -1;

      result.push({
        ...edge,
        offset: offset * direction,
      });
    }
  }
  
  return result;
}

// Создает SVG path для линии с учетом смещения
export function createLinePath(
  a: Point,
  b: Point,
  offset: number = 0,
  radius: number = METRO_CONFIG.CORNER_RADIUS
): string {
  if (offset === 0) {
    // Прямая линия
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  
  // Смещенная линия
  const perp = perpendicular(a, b);
  const offsetA = {
    x: a.x + perp.x * offset,
    y: a.y + perp.y * offset,
  };
  const offsetB = {
    x: b.x + perp.x * offset,
    y: b.y + perp.y * offset,
  };
  
  // Для смещенных линий используем прямые с закругленными концами
  return `M ${offsetA.x} ${offsetA.y} L ${offsetB.x} ${offsetB.y}`;
}

// Создает путь с скруглениями для последовательности точек
export function createRoundedPath(
  points: Point[],
  offset: number = 0,
  radius: number = METRO_CONFIG.CORNER_RADIUS
): string {
  if (points.length < 2) return '';
  
  if (points.length === 2) {
    return createLinePath(points[0], points[1], offset, radius);
  }
  
  const pathParts: string[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    
    if (i === 0) {
      // Начальная точка
      if (offset === 0) {
        pathParts.push(`M ${current.x} ${current.y}`);
      } else {
        const perp = perpendicular(current, next);
        const offsetPoint = {
          x: current.x + perp.x * offset,
          y: current.y + perp.y * offset,
        };
        pathParts.push(`M ${offsetPoint.x} ${offsetPoint.y}`);
      }
    }
    
    // Добавляем сегмент с возможным скруглением
    if (i < points.length - 2) {
      // Есть следующая точка - добавляем скругление
      const afterNext = points[i + 2];
      const segment = createRoundedSegment(current, next, afterNext, offset, radius);
      pathParts.push(segment);
    } else {
      // Последний сегмент - прямая линия
      const segment = createLinePath(current, next, offset, radius);
      pathParts.push(segment.replace(/^M \d+\.?\d* \d+\.?\d* /, 'L '));
    }
  }
  
  return pathParts.join(' ');
}

// Создает скругленный сегмент между тремя точками
function createRoundedSegment(
  a: Point,
  b: Point,
  c: Point,
  offset: number = 0,
  radius: number = METRO_CONFIG.CORNER_RADIUS
): string {
  if (offset === 0) {
    // Прямая линия с закруглением
    return `L ${b.x} ${b.y}`;
  }
  
  // Смещенные точки
  const perpAB = perpendicular(a, b);
  const perpBC = perpendicular(b, c);
  
  const offsetA = {
    x: a.x + perpAB.x * offset,
    y: a.y + perpAB.y * offset,
  };
  const offsetB = {
    x: b.x + perpAB.x * offset,
    y: b.y + perpAB.y * offset,
  };
  const offsetC = {
    x: c.x + perpBC.x * offset,
    y: c.y + perpBC.y * offset,
  };
  
  // Пока используем прямые линии
  return `L ${offsetB.x} ${offsetB.y}`;
}

// Создает путь для линии из последовательности городов
export function createLinePathFromCities(
  cities: City[],
  cityIndex: Record<string, City>,
  offset: number = 0
): string {
  if (cities.length < 2) return '';
  
  const points = cities.map(city => cityIndex[city.city_id]).filter(Boolean) as City[];
  if (points.length < 2) return '';
  
  const pathParts: string[] = [];
  
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const segment = createLinePath(a, b, offset);
    
    if (i === 0) {
      pathParts.push(segment);
    } else {
      // Убираем "M" из последующих сегментов, оставляем только "L"
      pathParts.push(segment.replace(/^M \d+\.?\d* \d+\.?\d* /, 'L '));
    }
  }
  
  return pathParts.join(' ');
}

// Вычисляет bounding box для текста
export function getTextBoundingBox(
  text: string,
  x: number,
  y: number,
  fontSize: number = METRO_CONFIG.FONT_SIZE_NORMAL
): { x: number; y: number; width: number; height: number } {
  // Приблизительная оценка размеров текста
  const charWidth = fontSize * 0.6; // приблизительная ширина символа
  const width = text.length * charWidth;
  const height = fontSize * 1.2; // высота с учетом line-height
  
  return {
    x: x - width / 2,
    y: y - height / 2,
    width,
    height,
  };
}

// Проверяет пересечение двух bounding box
export function boxesIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  padding: number = 2
): boolean {
  return !(
    a.x + a.width + padding < b.x ||
    b.x + b.width + padding < a.x ||
    a.y + a.height + padding < b.y ||
    b.y + b.height + padding < a.y
  );
}

// Вычисляет позицию подписи с учетом квадрантов
export function calculateLabelPosition(
  city: City,
  quadrant: 'NE' | 'SE' | 'SW' | 'NW',
  radius: number
): Point {
  const baseOffset = METRO_CONFIG.LABEL_OFFSET_BASE;
  const offset = baseOffset + radius;
  
  switch (quadrant) {
    case 'NE':
      return { x: city.x + offset, y: city.y - offset };
    case 'SE':
      return { x: city.x + offset, y: city.y + offset };
    case 'SW':
      return { x: city.x - offset, y: city.y + offset };
    case 'NW':
      return { x: city.x - offset, y: city.y - offset };
  }
}

// Создает SVG path для лидера (тонкой линии к точке)
export function createLeaderPath(start: Point, end: Point): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}
