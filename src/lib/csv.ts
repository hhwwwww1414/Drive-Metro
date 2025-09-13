// Загрузка и парсинг CSV из /public/data
import type { City, Corridor, DataBundle, Line, LinePath } from './types';
import Papa from 'papaparse';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return await res.text();
}

function parseCSV(text: string): Record<string, string>[] {
  const { data } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  return data.map((row) => {
    const rec: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      rec[key.trim()] = typeof value === 'string' ? value.trim() : '';
    });
    return rec;
  });
}

function toCities(rows: Record<string, string>[]): City[] {
  return rows.map((r) => ({
    city_id: r.city_id,
    label: r.label || r.city_id,
    x: Number(r.x),
    y: Number(r.y),
    is_hub: Number(r.is_hub) || 0,
    is_corridor_hub: Number(r.is_corridor_hub) || 0,
  }));
}

function toCorridors(rows: Record<string, string>[]): Corridor[] {
  return rows.map((r) => ({
    corridor_id: r.corridor_id,
    name: r.name,
    color: r.color,
    order: r.order ? Number(r.order) : undefined,
  }));
}

function toLines(rows: Record<string, string>[]): Line[] {
  return rows.map((r) => {
    const base: Partial<Line> = {
      line_id: r.line_id,
      corridor_id: r.corridor_id,
      name: r.name,
      color: r.color,
      style: (r.style as Line['style']) || 'solid',
      draw_order: r.draw_order ? Number(r.draw_order) : undefined,
    };
    if (r.group_id) base.group_id = r.group_id;
    return base as Line;
  });
}

function toLinePaths(rows: Record<string, string>[]): LinePath[] {
  return rows.map((r) => {
    const base: Partial<LinePath> = {
      line_id: r.line_id,
      seq: Number(r.seq),
      city_id: r.city_id,
    };
    if (r.variant_id) base.variant_id = r.variant_id;
    return base as LinePath;
  });
}

export async function loadData(): Promise<DataBundle> {
  const [citiesTxt, corridorsTxt, linesTxt, pathsTxt] = await Promise.all([
    fetchText('/data/cities.csv'),
    fetchText('/data/corridors.csv'),
    fetchText('/data/lines.csv'),
    fetchText('/data/line_paths.csv'),
  ]);

  const cities = toCities(parseCSV(citiesTxt));
  const corridors = toCorridors(parseCSV(corridorsTxt)).sort(
    (a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY)
  );
  const lines = toLines(parseCSV(linesTxt)).sort(
    (a, b) => (a.draw_order ?? Number.POSITIVE_INFINITY) - (b.draw_order ?? Number.POSITIVE_INFINITY)
  );
  const linePaths = toLinePaths(parseCSV(pathsTxt));

  return { cities, corridors, lines, linePaths };
}
