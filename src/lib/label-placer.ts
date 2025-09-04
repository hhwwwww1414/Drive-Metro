import { METRO_CONFIG } from './metro-config';
import type { City } from './types';
import { getTextBoundingBox, boxesIntersect, calculateLabelPosition, type Point } from './geometry';

export interface LabelPlacement {
  city_id: string;
  x: number;
  y: number;
  quadrant: 'NE' | 'SE' | 'SW' | 'NW';
  radius: number;
  hasLeader: boolean;
  leaderEnd?: Point;
}

export interface LabelBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  city_id: string;
}

// Алгоритм размещения подписей с коллизионным детектором
export function placeLabels(
  cities: City[],
  zoom: number = 1.0
): LabelPlacement[] {
  const placements: LabelPlacement[] = [];
  const occupiedBoxes: LabelBoundingBox[] = [];
  
  // Определяем, какие подписи показывать в зависимости от зума
  const visibleCities = getVisibleCities(cities, zoom);
  
  // Сортируем города по приоритету (узлы сначала)
  const sortedCities = visibleCities.sort((a, b) => {
    if (a.is_hub !== b.is_hub) {
      return b.is_hub - a.is_hub; // узлы сначала
    }
    return a.city_id.localeCompare(b.city_id);
  });
  
  for (const city of sortedCities) {
    const placement = findBestLabelPosition(city, occupiedBoxes, zoom);
    if (placement) {
      placements.push(placement);
      
      // Добавляем bounding box в список занятых
      const fontSize = city.is_hub ? METRO_CONFIG.FONT_SIZE_HUB : METRO_CONFIG.FONT_SIZE_NORMAL;
      const bbox = getTextBoundingBox(city.label, placement.x, placement.y, fontSize);
      occupiedBoxes.push({
        ...bbox,
        city_id: city.city_id,
      });
    }
  }
  
  return placements;
}

// Определяет, какие города показывать в зависимости от зума
function getVisibleCities(cities: City[], zoom: number): City[] {
  if (zoom < METRO_CONFIG.LOD_ZOOM_THRESHOLDS.HIDE_LABELS) {
    // Показываем только узлы
    return cities.filter(city => city.is_hub === 1);
  }
  
  // Показываем все города
  return cities;
}

// Находит лучшую позицию для подписи города
function findBestLabelPosition(
  city: City,
  occupiedBoxes: LabelBoundingBox[],
  zoom: number
): LabelPlacement | null {
  const quadrants: Array<'NE' | 'SE' | 'SW' | 'NW'> = ['NE', 'SE', 'SW', 'NW'];
  const maxRadius = zoom >= METRO_CONFIG.LOD_ZOOM_THRESHOLDS.SHOW_ALL_LABELS ? 5 : 3;
  
  // Пробуем разные квадранты и радиусы
  for (const quadrant of quadrants) {
    for (let radiusStep = 0; radiusStep <= maxRadius; radiusStep++) {
      const radius = radiusStep * METRO_CONFIG.LABEL_OFFSET_STEP;
      const position = calculateLabelPosition(city, quadrant, radius);
      
      if (isPositionFree(position, city.label, occupiedBoxes, city.is_hub === 1)) {
        return {
          city_id: city.city_id,
          x: position.x,
          y: position.y,
          quadrant,
          radius,
          hasLeader: radius > 0,
          leaderEnd: radius > 0 ? { x: city.x, y: city.y } : undefined,
        };
      }
    }
  }
  
  // Если не нашли свободное место, пробуем лидер
  if (zoom >= METRO_CONFIG.LOD_ZOOM_THRESHOLDS.SHOW_ALL_LABELS) {
    return createLeaderLabel(city, occupiedBoxes);
  }
  
  return null;
}

// Проверяет, свободна ли позиция для подписи
function isPositionFree(
  position: Point,
  text: string,
  occupiedBoxes: LabelBoundingBox[],
  isHub: boolean
): boolean {
  const fontSize = isHub ? METRO_CONFIG.FONT_SIZE_HUB : METRO_CONFIG.FONT_SIZE_NORMAL;
  const bbox = getTextBoundingBox(text, position.x, position.y, fontSize);
  
  // Добавляем паддинг для читабельности
  const paddedBbox = {
    x: bbox.x - 2,
    y: bbox.y - 2,
    width: bbox.width + 4,
    height: bbox.height + 4,
  };
  
  return !occupiedBoxes.some(occupied => 
    boxesIntersect(paddedBbox, occupied, 2)
  );
}

// Создает подпись с лидером (тонкой линией к точке)
function createLeaderLabel(
  city: City,
  occupiedBoxes: LabelBoundingBox[]
): LabelPlacement | null {
  const leaderDistance = METRO_CONFIG.LABEL_LEADER_DISTANCE;
  const quadrants: Array<'NE' | 'SE' | 'SW' | 'NW'> = ['NE', 'SE', 'SW', 'NW'];
  
  for (const quadrant of quadrants) {
    const position = calculateLabelPosition(city, quadrant, leaderDistance);
    
    if (isPositionFree(position, city.label, occupiedBoxes, city.is_hub === 1)) {
      return {
        city_id: city.city_id,
        x: position.x,
        y: position.y,
        quadrant,
        radius: leaderDistance,
        hasLeader: true,
        leaderEnd: { x: city.x, y: city.y },
      };
    }
  }
  
  return null;
}

// Создает SVG path для лидера
export function createLeaderPath(start: Point, end: Point): string {
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}
