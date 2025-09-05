'use client';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { DataBundle, Line } from '@/lib/types';
import { buildParallelEdgesForActive, mapCities, tryGetXY } from '@/lib/graph';
import { createLinePath, type Point } from '@/lib/geometry';
import { METRO_CONFIG } from '@/lib/metro-config';
import { analyzeRoutes, createUnifiedSegments } from '@/lib/route-analyzer';
import { placeLabels, createLeaderPath } from '@/lib/label-placer';

type Props = {
  bundle: DataBundle;
  activeLines: Set<string>;
};

export default function MetroCanvas({ bundle, activeLines }: Props) {
  // Unified corridors: render merged common segments
  const unifiedCorridors = useMemo(() => new Set(['EW', 'SEVER', 'MUR', 'MSK-CRM', 'VVO-CRM']), []);

  // Indexes
  const cityIndex = useMemo(() => mapCities(bundle.cities), [bundle.cities]);
  const linesById = useMemo(() => {
    const m: Record<string, Line> = {};
    for (const l of bundle.lines) m[l.line_id] = l;
    return m;
  }, [bundle.lines]);

  // Unified segments per selected corridors
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

  // Use only visible, non-unified lines for parallel offsets
  const activeLinesNonUnified = useMemo(() => {
    const s = new Set<string>();
    activeLines.forEach((id) => {
      const line = linesById[id];
      if (!line || !unifiedCorridors.has(line.corridor_id)) s.add(id);
    });
    return s;
  }, [activeLines, linesById, unifiedCorridors]);
  const parallelEdges = useMemo(
    () => buildParallelEdgesForActive(bundle, activeLinesNonUnified),
    [bundle, activeLinesNonUnified]
  );

  // Zoom/pan (simple, but smooth)
  const frameRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 900, h: 600 });
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  useEffect(() => {
    if (!frameRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setFrameSize({ w: r.width, h: r.height });
    });
    ro.observe(frameRef.current);
    return () => ro.disconnect();
  }, []);

  // Fit to data initially
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

  // Hover/highlight
  const [highlightedLine, setHighlightedLine] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const handleLineClick = useCallback((lineId: string) => {
    setHighlightedLine(prev => prev === lineId ? null : lineId);
  }, []);

  // Labels
  const labelPlacements = useMemo(() => placeLabels(bundle.cities, scale), [bundle.cities, scale]);

  return (
    <div ref={frameRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg ref={svgRef} className="map-svg" style={{ width: '100%', height: '100%' }}>
        <rect x={0} y={0} width={frameSize.w} height={frameSize.h} fill={METRO_CONFIG.BACKGROUND} />
        <g transform={`translate(${tx},${ty}) scale(${scale})`}>
          {/* Per-line edges with parallel offsets for non-unified corridors */}
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
                <path d={path} stroke="#FFFFFF" strokeWidth={underStroke} strokeLinecap="round" strokeLinejoin="round" fill="none" className="non-scaling" opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : 1} />
                <path d={path} stroke={edge.line.color} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" fill="none" className="non-scaling" opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : METRO_CONFIG.OPACITY_NORMAL} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleLineClick(edge.line.line_id); }} onMouseEnter={() => { if (!highlightedLine) setHighlightedLine(edge.line.line_id); }} onMouseLeave={() => { if (highlightedLine === edge.line.line_id) setHighlightedLine(null); }} />
              </g>
            );
          })}

          {/* Unified corridors drawn once with subtle halo */}
          {unifiedSegmentsForCorridors.map((segment, i) => {
            const hasActiveLines = segment.lines.some(line => activeLines.has(line.line_id));
            if (!hasActiveLines) return null;
            const dash = segment.branchType === 'main' ? undefined : segment.lines[0].style === 'dashed' ? '6,6' : segment.lines[0].style === 'dotted' ? '2,8' : undefined;
            const isHighlighted = segment.lines.some(line => highlightedLine === line.line_id);
            const isDimmed = highlightedLine && !segment.lines.some(line => highlightedLine === line.line_id);
            const base = isHighlighted ? METRO_CONFIG.LINE_WIDTH_HIGHLIGHTED : METRO_CONFIG.LINE_WIDTH;
            const strokeWidth = segment.isMainBranch ? base + 1 : base;
            const underStroke = strokeWidth + 1.5;
            const opacity = isDimmed ? METRO_CONFIG.OPACITY_DIM : METRO_CONFIG.OPACITY_NORMAL;
            const path = createLinePath(segment.from, segment.to);

            return (
              <g key={`unified-${segment.from.city_id}-${segment.to.city_id}-${i}`}>
                <path d={path} stroke="#FFFFFF" strokeWidth={underStroke} strokeLinecap="round" strokeLinejoin="round" fill="none" className="non-scaling" opacity={isDimmed ? METRO_CONFIG.OPACITY_DIM : 1} />
                <path d={path} stroke={segment.corridorColor} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" fill="none" className="non-scaling" opacity={opacity} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); handleLineClick(segment.lines[0].line_id); }} onMouseEnter={() => { if (!highlightedLine) setHighlightedLine(segment.lines[0].line_id); }} onMouseLeave={() => { if (highlightedLine === segment.lines[0].line_id) setHighlightedLine(null); }} />
              </g>
            );
          })}

          {/* Stations */}
          {bundle.cities.map((city) => {
            const isHub = city.is_hub === 1;
            return (
              <g key={city.city_id}>
                {isHub ? (
                  <g style={{ cursor: 'pointer' }}>
                    <circle cx={city.x} cy={city.y} r={METRO_CONFIG.HUB_OUTER_RADIUS} fill="#fff" stroke="#111" strokeWidth={2} className="non-scaling" />
                    <circle cx={city.x} cy={city.y} r={METRO_CONFIG.HUB_INNER_RADIUS} fill="#fff" stroke="#111" strokeWidth={1.25} className="non-scaling" />
                  </g>
                ) : (
                  <circle cx={city.x} cy={city.y} r={METRO_CONFIG.STATION_RADIUS} fill="#fff" stroke="#111" strokeWidth={1.25} className="non-scaling" />
                )}
              </g>
            );
          })}

          {/* Labels */}
          {labelPlacements.map((placement) => {
            const city = bundle.cities.find(c => c.city_id === placement.city_id);
            if (!city) return null;
            const fontSize = city.is_hub ? METRO_CONFIG.FONT_SIZE_HUB : METRO_CONFIG.FONT_SIZE_NORMAL;
            const fontWeight = city.is_hub ? 'bold' : 'normal';
            return (
              <g key={`label-${placement.city_id}`}>
                {placement.hasLeader && placement.leaderEnd && (
                  <path d={createLeaderPath({ x: placement.x, y: placement.y }, placement.leaderEnd)} stroke="#111" strokeWidth={0.75} fill="none" className="non-scaling" />
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

