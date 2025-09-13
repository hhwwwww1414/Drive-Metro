'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataBundle, Line } from '@/lib/types';
import { buildParallelEdgesForActive, mapCities, tryGetXY } from '@/lib/graph';
import { placeLabels } from '@/lib/label-placer';
import { createLinePath, createLeaderPath, edgeKey } from '@/lib/geometry';
import { METRO_CONFIG } from '@/lib/metro-config';
import { analyzeRoutes, createUnifiedSegments } from '@/lib/route-analyzer';
import type { RouteSegment } from '@/lib/router';

const DEBUG_ROUTE_ANALYSIS =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEBUG_ROUTE_ANALYSIS === 'true';

type Props = {
  bundle: DataBundle;
  activeLines: Set<string>;
  currentRoute?: RouteSegment[];
};

export default function MetroCanvas({
  bundle,
  activeLines,
  currentRoute: route = [],
}: Props) {
  // Анализируем маршруты для выделения общих участков (для отладки)
  useEffect(() => {
    if (!DEBUG_ROUTE_ANALYSIS) return;

    const analysis = analyzeRoutes(bundle.lines, bundle.linePaths, bundle.cities);
    console.log('📊 Анализ маршрутов:');
    console.log(`  Основные ветки: ${analysis.mainBranches.length}`);
    console.log(`  Ответвления: ${analysis.extensions.length}`);
    console.log(`  Всего сегментов: ${analysis.allSegments.length}`);

    const topSegments = analysis.allSegments
      .sort((a, b) => b.lines.length - a.lines.length)
      .slice(0, 5);

    console.log('  Топ-5 загруженных сегментов:');
    topSegments.forEach((segment, i) => {
      console.log(`    ${i + 1}. ${segment.from} → ${segment.to} (${segment.lines.length} линий)`);
    });
  }, [bundle.lines, bundle.linePaths, bundle.cities]);

  // List of corridors to render as unified (merge overlapping segments)
  const unifiedCorridors = useMemo(() => new Set(['EW', 'SEVER', 'MUR', 'MSK-CRM', 'VVO-CRM']), []);
  
  // Создаем объединенные сегменты
  const cityIndex = useMemo(() => mapCities(bundle.cities), [bundle]);
  const unifiedSegmentsForCorridors = useMemo(() => {
    const out: ReturnType<typeof createUnifiedSegments> = [];
    const corrList = Array.from(unifiedCorridors);
    for (const corrId of corrList) {
      const lines = bundle.lines.filter(l => l.corridor_id === corrId);
      if (!lines.length) continue;
      const lineIds = new Set(lines.map(l => l.line_id));
      const paths = bundle.linePaths.filter(p => lineIds.has(p.line_id));
      const analysis = analyzeRoutes(lines, paths, bundle.cities);
      const segments = createUnifiedSegments(analysis, cityIndex);
      out.push(...segments);
    }
    return out;
  }, [bundle.lines, bundle.linePaths, bundle.cities, cityIndex, unifiedCorridors]);

  // Maps to know which lines pass through a station (for interchange ticks)
  const linesById = useMemo(() => {
    const m: Record<string, Line> = {};
    for (const l of bundle.lines) m[l.line_id] = l;
    return m;
  }, [bundle.lines]);
  const cityLinesMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of bundle.linePaths) {
      const arr = m.get(p.city_id) ?? [];
      if (!arr.includes(p.line_id)) arr.push(p.line_id);
      m.set(p.city_id, arr);
    }
    return m;
  }, [bundle.linePaths]);
  
  // Старая система для совместимости (можно будет убрать)
  // Recompute parallel edges based only on visible lines; corridor duplicates are deduped downstream
  const parallelEdges = useMemo(
    () => buildParallelEdgesForActive(bundle, activeLines),
    [bundle, activeLines]
  );

  // вычислим рамку данных (для fit-to-data)
  const dataBBox = useMemo(() => {
    let minX = +Infinity, minY = +Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of bundle.cities) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }, [bundle.cities]);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 100, h: 100 });

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Состояние для подсветки
  const [highlightedLine, setHighlightedLine] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [currentRoute, setCurrentRoute] = useState<RouteSegment[]>(route);
  useEffect(() => { setCurrentRoute(route); }, [route]);

  const routeSegments = useMemo(() => {
    const keys = new Set<string>();
    for (const seg of currentRoute) {
      if (!seg.transfer) {
        const key = edgeKey(seg.from, seg.to);
        // Keep both corridor and line identifiers so highlighting works
        // regardless of which variant was used for the route or rendering
        keys.add(`${key}::${seg.line.corridor_id}`);
        keys.add(`${key}::${seg.line.line_id}`);
      }
    }
    return keys;
  }, [currentRoute]);

  const routeCities = useMemo(() => {
    const set = new Set<string>();
    for (const seg of currentRoute) {
      set.add(seg.from);
      set.add(seg.to);
    }
    return set;
  }, [currentRoute]);

  const hasRoute = currentRoute.length > 0;

  
  // Обработчик клика по линии для подсветки маршрута
  const handleLineClick = useCallback((lineId: string) => {
    setHighlightedLine(prev => prev === lineId ? null : lineId);
  }, []);
  
  // Обработчик клика по станции
  const handleCityClick = useCallback((cityId: string) => {
    setHoveredCity(prev => prev === cityId ? null : cityId);
  }, []);

  // drag state
  const drag = useRef<{ x: number; y: number; tx0: number; ty0: number; active: boolean }>({
    x: 0, y: 0, tx0: 0, ty0: 0, active: false,
  });

  const fitToData = useCallback(() => {
    const pad = METRO_CONFIG.FIT_PADDING;
    const w = frameSize.w - pad * 2;
    const h = frameSize.h - pad * 2;
    if (w <= 0 || h <= 0) return;

    const sx = w / (dataBBox.w || 1);
    const sy = h / (dataBBox.h || 1);
    const s = Math.min(sx, sy);

    setScale(s);
    const cxData = (dataBBox.minX + dataBBox.maxX) / 2;
    const cyData = (dataBBox.minY + dataBBox.maxY) / 2;
    const cxView = frameSize.w / 2;
    const cyView = frameSize.h / 2;

    setTx(cxView - cxData * s);
    setTy(cyView - cyData * s);
  }, [
    frameSize.w,
    frameSize.h,
    dataBBox.minX,
    dataBBox.minY,
    dataBBox.maxX,
    dataBBox.maxY,
    dataBBox.w,
    dataBBox.h,
  ]);

  // наблюдаем размер рамки
  useEffect(() => {
    if (!frameRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setFrameSize({ w: cr.width, h: cr.height });
    });
    ro.observe(frameRef.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { fitToData(); }, [fitToData]);
  
  // Обработка ESC для сброса подсветки
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHighlightedLine(null);
        setHoveredCity(null);
        setCurrentRoute([]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Wheel zoom
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const k = Math.exp(delta * 0.0015);
    const newScale = Math.min(METRO_CONFIG.ZOOM_MAX, Math.max(METRO_CONFIG.ZOOM_MIN, scale * k));

    const pt = svgRef.current!.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRef.current!.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());

    const x = p.x, y = p.y;
    const nx = x * newScale + tx;
    const ny = y * newScale + ty;
    const ox = x * scale + tx;
    const oy = y * scale + ty;

    setScale(newScale);
    setTx(tx + (ox - nx));
    setTy(ty + (oy - ny));
  };

      const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Игнорируем клики по элементам (линиям, станциям)
    if ((e.target as SVGElement).tagName !== 'rect') return;
    
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx0: tx, ty0: ty, active: true };
    svgRef.current?.classList.add('grabbing');
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setTx(drag.current.tx0 + dx);
    setTy(drag.current.ty0 + dy);
  };
  const onPointerUp = () => {
    drag.current.active = false;
    svgRef.current?.classList.remove('grabbing');
  };

  // Размещение подписей с учетом зума
  const labelPlacements = useMemo(() => {
    return placeLabels(bundle.cities, scale);
  }, [bundle.cities, scale]);

  return (
    <div ref={frameRef} className="map-frame">
      <svg
        ref={svgRef}
        className="map-svg"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <rect x={0} y={0} width={frameSize.w} height={frameSize.h} fill="#fff" />

        <g transform={`translate(${tx},${ty}) scale(${scale})`}>
          {/* Parallel edges with offsets to avoid overlaps */}
          {parallelEdges.map((edge, i) => {
            if (!activeLines.has(edge.line.line_id)) return null;
            const a = tryGetXY(edge.a, cityIndex);
            const b = tryGetXY(edge.b, cityIndex);
            if (!a || !b) return null;

            const segKey = `${edgeKey(edge.a, edge.b)}::${edge.line.corridor_id}`;
            const inRoute = routeSegments.has(segKey);
            const isHighlighted = inRoute || highlightedLine === edge.line.line_id;
            const isDimmed = highlightedLine
              ? highlightedLine !== edge.line.line_id
              : hasRoute && !inRoute;

            const dash = edge.line.style === 'dashed' ? '6,6' :
                         edge.line.style === 'dotted' ? '2,8' : undefined;
            const strokeWidth = inRoute
              ? METRO_CONFIG.LINE_WIDTH_HIGHLIGHTED + 1
              : isHighlighted
                ? METRO_CONFIG.LINE_WIDTH_HIGHLIGHTED
                : METRO_CONFIG.LINE_WIDTH;
            const underStroke = strokeWidth + 1.5;

            const path = createLinePath(a, b, edge.offset);
            return (
              <g key={`edge-${edge.line.line_id}-${edge.a}-${edge.b}-${i}`}>
                <path
                  d={path}
                  stroke="#FFFFFF"
                  strokeWidth={underStroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  className="non-scaling"
                  opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : 1}
                />
                <path
                  d={path}
                  stroke={edge.line.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dash}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  className="non-scaling"
                  opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : METRO_CONFIG.OPACITY_NORMAL}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); handleLineClick(edge.line.line_id); }}
                  onMouseEnter={() => { if (!highlightedLine) setHighlightedLine(edge.line.line_id); }}
                  onMouseLeave={() => { if (highlightedLine === edge.line.line_id) setHighlightedLine(null); }}
                />
              </g>
            );
          })}
          {/* объединенные линии */}
          {false && unifiedSegmentsForCorridors.map((segment, i) => {
            // Проверяем, есть ли активные линии в этом сегменте
            const hasActiveLines = segment.lines.some(line => activeLines.has(line.line_id));
            if (!hasActiveLines) return null;

            const dash = segment.branchType === 'main' ? undefined :
                        segment.lines[0].style === 'dashed' ? '6,6' :
                        segment.lines[0].style === 'dotted' ? '2,8' : undefined;

            const isHighlighted = segment.lines.some(line => highlightedLine === line.line_id);
            const isDimmed = highlightedLine && !segment.lines.some(line => highlightedLine === line.line_id);
            
            // Основные ветки рисуем толще
            const strokeWidth = segment.isMainBranch ? 
              (isHighlighted ? METRO_CONFIG.LINE_WIDTH_HIGHLIGHTED + 1 : METRO_CONFIG.LINE_WIDTH + 1) :
              (isHighlighted ? METRO_CONFIG.LINE_WIDTH_HIGHLIGHTED : METRO_CONFIG.LINE_WIDTH);
            
            const opacity = isDimmed ? METRO_CONFIG.OPACITY_DIM : METRO_CONFIG.OPACITY_NORMAL;

            const path = createLinePath(segment.from, segment.to);

            return (
              <path
                key={`unified-${segment.from.city_id}-${segment.to.city_id}-${i}`}
                d={path}
                stroke={segment.corridorColor}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="non-scaling"
                opacity={opacity}
                style={{ cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Подсвечиваем первую линию сегмента
                  handleLineClick(segment.lines[0].line_id);
                }}
                onMouseEnter={() => {
                  if (!highlightedLine) {
                    setHighlightedLine(segment.lines[0].line_id);
                  }
                }}
                onMouseLeave={() => {
                  if (highlightedLine === segment.lines[0].line_id) {
                    setHighlightedLine(null);
                  }
                }}
              />
            );
          })}

          {/* станции */}
          {bundle.cities.map((city) => {
            const isHovered = hoveredCity === city.city_id;
            const isHub = city.is_hub === 1;
            const isRouteCity = routeCities.has(city.city_id);
            
            return (
              <g key={city.city_id}>
                {isHub ? (
                  // Узел - кольцо
                  <g
                    onMouseEnter={() => setHoveredCity(city.city_id)}
                    onMouseLeave={() => setHoveredCity(null)}
                    onClick={(e) => { e.stopPropagation(); handleCityClick(city.city_id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle
                      cx={city.x}
                      cy={city.y}
                      r={METRO_CONFIG.HUB_OUTER_RADIUS + (isRouteCity ? 1 : 0)}
                      fill={isRouteCity ? '#fde68a' : '#fff'}
                      stroke="#111"
                      strokeWidth={isHovered || isRouteCity ? 3 : 2}
                      className="non-scaling"
                    />
                    {(() => {
                      const ids = cityLinesMap.get(city.city_id) || [];
                      const linesHere: Line[] = ids
                        .map((id) => linesById[id])
                        .filter((v): v is Line => Boolean(v) && activeLines.has(v.line_id));
                      const n = Math.min(linesHere.length, 10);
                      const R = METRO_CONFIG.HUB_OUTER_RADIUS;
                      return linesHere.slice(0, n).map((ln: Line, idx: number) => {
                        const ang = (idx / n) * Math.PI * 2;
                        const x1 = city.x + (R - 1.5) * Math.cos(ang);
                        const y1 = city.y + (R - 1.5) * Math.sin(ang);
                        const x2 = city.x + (R + 1.5) * Math.cos(ang);
                        const y2 = city.y + (R + 1.5) * Math.sin(ang);
                        return (
                          <line
                            key={`tick-${city.city_id}-${ln.line_id}-${idx}`}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={ln.color}
                            strokeWidth={1.5}
                            className="non-scaling"
                          />
                        );
                      });
                    })()}
                  </g>
                ) : (
                  // Обычная станция — белый круг с чёрной окантовкой,
                  // чтобы линии визуально «выходили» из точки
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={isRouteCity ? METRO_CONFIG.STATION_RADIUS * 1.5 : METRO_CONFIG.STATION_RADIUS}
                    fill={isRouteCity ? '#fde68a' : '#fff'}
                    stroke={"#111"}
                    strokeWidth={isRouteCity || isHovered ? 2 : 1.25}
                    className="non-scaling"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredCity(city.city_id)}
                    onMouseLeave={() => setHoveredCity(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCityClick(city.city_id);
                    }}
                  />
                )}
              </g>
            );
          })}

          {/* подписи */}
          {labelPlacements.map((placement) => {
            const city = bundle.cities.find(c => c.city_id === placement.city_id);
            if (!city) return null;
            
            const fontSize = city.is_hub ? METRO_CONFIG.FONT_SIZE_HUB : METRO_CONFIG.FONT_SIZE_NORMAL;
            const fontWeight = city.is_hub ? 'bold' : 'normal';
            
            return (
              <g key={`label-${placement.city_id}`}>
                {/* Лидер (тонкая линия к точке) */}
                {placement.hasLeader && placement.leaderEnd && (
                  <path
                    d={createLeaderPath(
                      { x: placement.x, y: placement.y },
                      placement.leaderEnd
                    )}
                    stroke="#111"
                    strokeWidth={0.75}
                    fill="none"
                    className="non-scaling"
                  />
                )}
                
                {/* Текст с белым ореолом */}
                <text
                  x={placement.x}
                  y={placement.y}
                  fontSize={fontSize}
                  fontFamily={METRO_CONFIG.FONT_FAMILY}
                  fontWeight={fontWeight}
                  fill={METRO_CONFIG.TEXT_COLOR}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="non-scaling"
                  style={{
                    paintOrder: 'stroke fill',
                    stroke: METRO_CONFIG.TEXT_HALO,
                    strokeWidth: METRO_CONFIG.LABEL_HALO_WIDTH,
                  }}
                >
                  {city.label || city.city_id}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
