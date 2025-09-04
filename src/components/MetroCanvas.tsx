'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataBundle } from '@/lib/types';
import { buildAllEdges, mapCities, placeLabels, tryGetXY } from '@/lib/graph';

type Props = {
  bundle: DataBundle;
  activeLines: Set<string>;
};

export default function MetroCanvas({ bundle, activeLines }: Props) {
  const edges = useMemo(() => buildAllEdges(bundle), [bundle]);
  const cityIndex = useMemo(() => mapCities(bundle.cities), [bundle]);

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

  // drag state
  const drag = useRef<{ x: number; y: number; tx0: number; ty0: number; active: boolean }>({
    x: 0, y: 0, tx0: 0, ty0: 0, active: false,
  });

  const fitToData = () => {
    const pad = 60;
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
  };

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fitToData(); }, [frameSize.w, frameSize.h, dataBBox.w, dataBBox.h]);

  // Wheel zoom
  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const k = Math.exp(delta * 0.0015);
    const newScale = Math.min(6, Math.max(0.2, scale * k));

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

  const labels = useMemo(() => {
    const pts: Record<string, { x: number; y: number }> = {};
    for (const c of bundle.cities) pts[c.city_id] = { x: c.x, y: c.y };
    return placeLabels(pts);
  }, [bundle.cities]);

  // реакция на «все/нет» из Legend
  useEffect(() => {
    const onMany = (e: Event) => {
        const detail = (e as CustomEvent).detail as { ids: string[]; on: boolean };
        const set = new Set(activeLines);
        for (const id of detail.ids) {
          if (detail.on) {
            set.add(id);
          } else {
            set.delete(id);
          }
        }
        // хак: пробросим через window → страница обработает и обновит activeLines
        const ev = new CustomEvent('page:update-lines', { detail: Array.from(set) });
        window.dispatchEvent(ev);
      };
      window.addEventListener('legend:toggle-many', onMany as EventListener);
      return () => window.removeEventListener('legend:toggle-many', onMany as EventListener);
    }, [activeLines]);

  return (
    <div ref={frameRef} className="map-frame">
      <div className="map-toolbar">
        <button className="map-btn" onClick={() => setScale((s) => Math.min(6, s * 1.2))}>+</button>
        <button className="map-btn" onClick={() => setScale((s) => Math.max(0.2, s / 1.2))}>−</button>
        <button className="map-btn" onClick={fitToData}>Сброс</button>
      </div>

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
          {/* линии */}
          {edges.map((e, i) => {
            if (!activeLines.has(e.line.line_id)) return null;
            const a = tryGetXY(e.a, cityIndex);
            const b = tryGetXY(e.b, cityIndex);
            if (!a || !b) return null;

            const dash =
              e.line.style === 'dashed' ? '6,6' :
              e.line.style === 'dotted' ? '2,8' : undefined;

            return (
              <line
                key={i}
                x1={a.x} y1={a.y}
                x2={b.x} y2={b.y}
                stroke={e.line.color}
                strokeWidth={6}
                strokeDasharray={dash}
                strokeLinecap="round"
                className="non-scaling"
                opacity={0.95}
              />
            );
          })}

          {/* узлы + подписи */}
          {bundle.cities.map((c) => (
            <g key={c.city_id}>
              <circle cx={c.x} cy={c.y} r={4} fill="#111" className="non-scaling" />
              <text
                x={(labels[c.city_id]?.x ?? c.x + 14)}
                y={(labels[c.city_id]?.y ?? c.y + 4)}
                fontSize={12}
                className="map-label"
              >
                {c.label || c.city_id}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
