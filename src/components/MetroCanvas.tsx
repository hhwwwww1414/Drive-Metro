'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataBundle, Line } from '@/lib/types';
import { buildParallelEdgesForActive, mapCities, tryGetXY } from '@/lib/graph';
import { createLinePath } from '@/lib/geometry';
import { METRO_CONFIG } from '@/lib/metro-config';
import { analyzeRoutes, createUnifiedSegments } from '@/lib/route-analyzer';
import { placeLabels, createLeaderPath } from '@/lib/label-placer';

type Props = {
  bundle: DataBundle;
  activeLines: Set<string>;
};

export default function MetroCanvas({ bundle, activeLines }: Props) {
  // Corridors to render as unified (merged overlaps)
  const unifiedCorridors = useMemo(() => new Set(['EW', 'SEVER', 'MUR', 'MSK-CRM', 'VVO-CRM']), []);

  // Indexes
  const cityIndex = useMemo(() => mapCities(bundle.cities), [bundle.cities]);
  const linesById = useMemo(() => {
    const m: Record<string, Line> = {};
    for (const l of bundle.lines) m[l.line_id] = l;
    return m;
  }, [bundle.lines]);

  // Unified segments per selected corridors
  const unifiedSegments = useMemo(() => {
    const out: ReturnType<typeof createUnifiedSegments> = [];
    for (const corrId of unifiedCorridors) {
      const lines = bundle.lines.filter(l => l.corridor_id === corrId);
      if (!lines.length) continue;
      const ids = new Set(lines.map(l => l.line_id));
      const paths = bundle.linePaths.filter(p => ids.has(p.line_id));
      const analysis = analyzeRoutes(lines, paths, bundle.cities);
      out.push(...createUnifiedSegments(analysis, cityIndex));
    }
    return out;
  }, [bundle.lines, bundle.linePaths, bundle.cities, cityIndex, unifiedCorridors]);

  // Non-unified lines render with parallel offsets
  const activeLinesNonUnified = useMemo(() => {
    const s = new Set<string>();
    activeLines.forEach((id) => {
      const l = linesById[id];
      if (!l || !unifiedCorridors.has(l.corridor_id)) s.add(id);
    });
    return s;
  }, [activeLines, linesById, unifiedCorridors]);
  const parallelEdges = useMemo(
    () => buildParallelEdgesForActive(bundle, activeLinesNonUnified),
    [bundle, activeLinesNonUnified]
  );

  // Fit/zoom/pan state
  const frameRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 100, h: 100 });
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const drag = useRef<{ active: boolean; x: number; y: number; tx0: number; ty0: number }>({
    active: false, x: 0, y: 0, tx0: 0, ty0: 0,
  });

  useEffect(() => {
    if (!frameRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setFrameSize({ w: r.width, h: r.height });
    });
    ro.observe(frameRef.current);
    return () => ro.disconnect();
  }, []);

  // Fit to data
  useEffect(() => {
    const pad = METRO_CONFIG.FIT_PADDING;
    const w = frameSize.w - pad * 2;
    const h = frameSize.h - pad * 2;
    if (w <= 0 || h <= 0) return;

    let minX = +Infinity, minY = +Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of bundle.cities) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    const sx = w / (maxX - minX || 1);
    const sy = h / (maxY - minY || 1);
    const s = Math.min(sx, sy);
    setScale(s);
    const cxData = (minX + maxX) / 2;
    const cyData = (minY + maxY) / 2;
    const cxView = frameSize.w / 2;
    const cyView = frameSize.h / 2;
    setTx(cxView - cxData * s);
    setTy(cyView - cyData * s);
  }, [bundle.cities, frameSize.w, frameSize.h]);

  // Interactions
  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dir = e.deltaY < 0 ? METRO_CONFIG.ZOOM_STEP : 1 / METRO_CONFIG.ZOOM_STEP;
    const newScale = Math.max(METRO_CONFIG.ZOOM_MIN, Math.min(METRO_CONFIG.ZOOM_MAX, scale * dir));
    const wx = (mx - tx) / scale;
    const wy = (my - ty) / scale;
    setScale(newScale);
    setTx(mx - wx * newScale);
    setTy(my - wy * newScale);
  }, [scale, tx, ty]);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { active: true, x: e.clientX, y: e.clientY, tx0: tx, ty0: ty };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  }, [tx, ty]);
  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    setTx(drag.current.tx0 + dx);
    setTy(drag.current.ty0 + dy);
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    drag.current.active = false;
    try { (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId); } catch {}
  }, []);

  // Hover/highlight
  const [highlightedLine, setHighlightedLine] = useState<string | null>(null);
  const handleLineClick = useCallback((lineId: string) => {
    setHighlightedLine(prev => prev === lineId ? null : lineId);
  }, []);

  // Labels
  const labelPlacements = useMemo(() => placeLabels(bundle.cities, scale), [bundle.cities, scale]);

  return (
    <div ref={frameRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%', cursor: drag.current.active ? 'grabbing' : 'grab' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <rect x={0} y={0} width={frameSize.w} height={frameSize.h} fill={METRO_CONFIG.BACKGROUND} />
        <g transform={`translate(${tx},${ty}) scale(${scale})`}>
          {/* Non-unified corridors with parallel offsets */}
          {parallelEdges.map((edge, i) => {
            if (!activeLines.has(edge.line.line_id)) return null;
            const a = tryGetXY(edge.a, cityIndex);
            const b = tryGetXY(edge.b, cityIndex);
            if (!a || !b) return null;
            const isHighlighted = highlightedLine === edge.line.line_id;
            const isDimmed = !!highlightedLine && highlightedLine !== edge.line.line_id;
            const dash = edge.line.style === 'dashed' ? '6,6' : edge.line.style === 'dotted' ? '2,8' : undefined;
            const strokeWidth = isHighlighted ? METRO_CONFIG.LINE_WIDTH_HIGHLIGHTED : METRO_CONFIG.LINE_WIDTH;
            const underStroke = strokeWidth + 1.5;
            const path = createLinePath(a, b, edge.offset);
            return (
              <g key={`edge-${edge.line.line_id}-${edge.a}-${edge.b}-${i}`}>
                <path d={path} stroke="#FFFFFF" strokeWidth={underStroke} strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke" opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : 1} />
                <path d={path} stroke={edge.line.color} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke" opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : METRO_CONFIG.OPACITY_NORMAL} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleLineClick(edge.line.line_id); }} onMouseEnter={() => { if (!highlightedLine) setHighlightedLine(edge.line.line_id); }} onMouseLeave={() => { if (highlightedLine === edge.line.line_id) setHighlightedLine(null); }} />
              </g>
            );
          })}

          {/* Unified corridors rendered once with halo */}
          {unifiedSegments.map((segment, i) => {
            const hasActive = segment.lines.some(l => activeLines.has(l.line_id));
            if (!hasActive) return null;
            const dash = segment.branchType === 'main' ? undefined : segment.lines[0].style === 'dashed' ? '6,6' : segment.lines[0].style === 'dotted' ? '2,8' : undefined;
            const isHighlighted = segment.lines.some(l => highlightedLine === l.line_id);
            const isDimmed = highlightedLine && !segment.lines.some(l => highlightedLine === l.line_id);
            const base = isHighlighted ? METRO_CONFIG.LINE_WIDTH_HIGHLIGHTED : METRO_CONFIG.LINE_WIDTH;
            const strokeWidth = segment.isMainBranch ? base + 1 : base;
            const underStroke = strokeWidth + 1.5;
            const path = createLinePath(segment.from, segment.to);
            return (
              <g key={`unified-${segment.from.city_id}-${segment.to.city_id}-${i}`}>
                <path d={path} stroke="#FFFFFF" strokeWidth={underStroke} strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke" opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : 1} />
                <path d={path} stroke={segment.corridorColor} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" fill="none" vectorEffect="non-scaling-stroke" opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : METRO_CONFIG.OPACITY_NORMAL} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleLineClick(segment.lines[0].line_id); }} onMouseEnter={() => { if (!highlightedLine) setHighlightedLine(segment.lines[0].line_id); }} onMouseLeave={() => { if (highlightedLine === segment.lines[0].line_id) setHighlightedLine(null); }} />
              </g>
            );
          })}

          {/* Stations */}
          {bundle.cities.map((city) => (
            <g key={city.city_id}>
              {city.is_hub === 1 ? (
                <g>
                  <circle cx={city.x} cy={city.y} r={METRO_CONFIG.HUB_OUTER_RADIUS} fill="#fff" stroke="#111" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                  <circle cx={city.x} cy={city.y} r={METRO_CONFIG.HUB_INNER_RADIUS} fill="#fff" stroke="#111" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
                </g>
              ) : (
                <circle cx={city.x} cy={city.y} r={METRO_CONFIG.STATION_RADIUS} fill="#fff" stroke="#111" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              )}
            </g>
          ))}

          {/* Labels */}
          {labelPlacements.map((placement) => {
            const city = bundle.cities.find(c => c.city_id === placement.city_id);
            if (!city) return null;
            const fontSize = city.is_hub ? METRO_CONFIG.FONT_SIZE_HUB : METRO_CONFIG.FONT_SIZE_NORMAL;
            const fontWeight = city.is_hub ? 'bold' : 'normal';
            return (
              <g key={`label-${placement.city_id}`}>
                {placement.hasLeader && placement.leaderEnd && (
                  <path d={createLeaderPath({ x: placement.x, y: placement.y }, placement.leaderEnd)} stroke="#111" strokeWidth={0.75} fill="none" vectorEffect="non-scaling-stroke" />
                )}
                <text x={placement.x} y={placement.y} fontSize={fontSize} fontWeight={fontWeight} fontFamily={METRO_CONFIG.FONT_FAMILY} textAnchor="middle" dominantBaseline="middle" fill={METRO_CONFIG.TEXT_COLOR} style={{ paintOrder: 'stroke' }} stroke={METRO_CONFIG.TEXT_HALO} strokeWidth={METRO_CONFIG.LABEL_HALO_WIDTH}>
                  {city.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

