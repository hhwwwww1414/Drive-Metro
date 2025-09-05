import type { City, Line, LinePath } from './types';
import { edgeKey } from './geometry';

export interface RouteSegment {
  from: string; // city_id
  to: string;   // city_id
  lines: Line[]; // линии, которые проходят через этот сегмент
  isMainBranch: boolean; // является ли основным участком
  branchType?: 'main' | 'extension' | 'branch'; // тип участка
}

export interface RouteAnalysis {
  mainBranches: RouteSegment[]; // основные ветки (общие участки)
  extensions: RouteSegment[];   // ответвления и уникальные участки
  allSegments: RouteSegment[];  // все сегменты
}

// Анализирует маршруты и выделяет общие участки
export function analyzeRoutes(
  lines: Line[],
  linePaths: LinePath[],
  cities: City[]
): RouteAnalysis {
  // Создаем карту сегментов
  const segmentMap = new Map<string, RouteSegment>();
  
  // Проходим по всем линиям и создаем сегменты
  for (const line of lines) {
    const path = linePaths
      .filter(p => p.line_id === line.line_id)
      .sort((a, b) => a.seq - b.seq);
    
    // Создаем сегменты для этой линии
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i].city_id;
      const to = path[i + 1].city_id;
      const key = edgeKey(from, to);
      
      if (!segmentMap.has(key)) {
        segmentMap.set(key, {
          from,
          to,
          lines: [],
          isMainBranch: false,
        });
      }
      
      segmentMap.get(key)!.lines.push(line);
    }
  }
  
  // Определяем основные ветки (сегменты, через которые проходит много линий)
  const allSegments = Array.from(segmentMap.values());
  const mainBranches: RouteSegment[] = [];
  const extensions: RouteSegment[] = [];
  
  // Сортируем сегменты по количеству линий для лучшего анализа
  allSegments.sort((a, b) => b.lines.length - a.lines.length);
  
  for (const segment of allSegments) {
    // Если через сегмент проходит 3+ линий, считаем его основной веткой
    if (segment.lines.length >= 3 || (segment.lines.length >= 2 && (new Set(segment.lines.map(l => l.corridor_id)).size === 1))) {
      segment.isMainBranch = true;
      segment.branchType = 'main';
      mainBranches.push(segment);
    } else if (segment.lines.length === 2) {
      // 2 линии - возможное ответвление
      segment.branchType = 'extension';
      extensions.push(segment);
    } else {
      // 1 линия - уникальный участок
      segment.branchType = 'branch';
      extensions.push(segment);
    }
  }
  
  // Дополнительная логика: если сегмент является частью длинной цепочки основных веток,
  // то даже с 2 линиями можем считать его основным
  for (const segment of extensions) {
    if (segment.lines.length === 2) {
      // Проверяем, является ли этот сегмент частью длинной цепочки
      const isPartOfMainChain = checkIfPartOfMainChain(segment, mainBranches);
      if (isPartOfMainChain) {
        segment.isMainBranch = true;
        segment.branchType = 'main';
        mainBranches.push(segment);
        // Удаляем из extensions
        const index = extensions.indexOf(segment);
        if (index > -1) {
          extensions.splice(index, 1);
        }
      }
    }
  }
  
  return {
    mainBranches,
    extensions,
    allSegments,
  };
}

// Создает упрощенную структуру для рендеринга
export function createSimplifiedRoutes(analysis: RouteAnalysis) {
  const routes: Array<{
    type: 'main' | 'extension' | 'branch';
    segments: RouteSegment[];
    color: string;
    style: string;
  }> = [];
  
  // Группируем основные ветки по цветам коридоров
  const mainBranchGroups = new Map<string, RouteSegment[]>();
  
  for (const segment of analysis.mainBranches) {
    // Берем цвет первой линии как основной
    const primaryLine = segment.lines[0];
    const corridorColor = getCorridorColor(primaryLine);
    
    if (!mainBranchGroups.has(corridorColor)) {
      mainBranchGroups.set(corridorColor, []);
    }
    mainBranchGroups.get(corridorColor)!.push(segment);
  }
  
  // Создаем маршруты для основных веток
  for (const [color, segments] of mainBranchGroups) {
    routes.push({
      type: 'main',
      segments,
      color,
      style: 'solid',
    });
  }
  
  // Добавляем ответвления
  for (const segment of analysis.extensions) {
    const primaryLine = segment.lines[0];
    routes.push({
      type: segment.branchType || 'branch',
      segments: [segment],
      color: primaryLine.color,
      style: primaryLine.style || 'solid',
    });
  }
  
  return routes;
}

// Получает цвет коридора для линии
function getCorridorColor(line: Line): string {
  // Для основных коридоров используем фиксированные цвета
    const corridorColors: Record<string, string> = {
    'EW': '#7ED957',      // Восток-Запад
    'SEVER': '#009A49',   // Север
    'MUR': '#00B7FF',     // Мурманск
    'M6': '#1A73E8',      // М6
    'KAVKAZ': '#F40009',  // Кавказ
    'KRASNODAR': '#CC5500', // Краснодар
    'VLADIKAV': '#FF8F1F',  // Владикавказ
    'VOLGA': '#8B4513',   // Волга
    'SIBERIA': '#6D4C41', // Сибирь
    'MSK-CRM': '#7E57C2',  // Москва–Крым
    'VVO-CRM': '#40E0D0',  // Владивосток–Крым
    'KALIN': '#C0CA33',   // Калининград
  };
  
  return corridorColors[line.corridor_id] || line.color;
}

// Проверяет, является ли сегмент частью длинной цепочки основных веток
function checkIfPartOfMainChain(segment: RouteSegment, mainBranches: RouteSegment[]): boolean {
  // Если сегмент соединяется с основными ветками, считаем его частью цепочки
  for (const mainBranch of mainBranches) {
    // Проверяем, есть ли общие города
    if (segment.from === mainBranch.from || segment.from === mainBranch.to ||
        segment.to === mainBranch.from || segment.to === mainBranch.to) {
      return true;
    }
  }
  return false;
}

// Создает объединенные сегменты для рендеринга
export function createUnifiedSegments(
  analysis: RouteAnalysis,
  cityIndex: Record<string, City>
) {
  const unifiedSegments: Array<{
    from: City;
    to: City;
    lines: Line[];
    isMainBranch: boolean;
    branchType: 'main' | 'extension' | 'branch';
    corridorColor: string;
  }> = [];
  
  for (const segment of analysis.allSegments) {
    const fromCity = cityIndex[segment.from];
    const toCity = cityIndex[segment.to];
    
    if (!fromCity || !toCity) continue;
    
    const primaryLine = segment.lines[0];
    const corridorColor = getCorridorColor(primaryLine);
    
    unifiedSegments.push({
      from: fromCity,
      to: toCity,
      lines: segment.lines,
      isMainBranch: segment.isMainBranch,
      branchType: segment.branchType || 'branch',
      corridorColor,
    });
  }
  
  return unifiedSegments;
}
