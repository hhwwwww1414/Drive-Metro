// Загрузка и парсинг CSV из /public/data
import type {
  City,
  Corridor,
  DataBundle,
  Line,
  LinePath,
  Driver,
  CityGrid,
} from './types';
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

function trimSpaces(s: string): string {
  return s.trim();
}

function unifyDashes(s: string): string {
  return s.replace(/[\u2012\u2013\u2014\u2015]/g, '-');
}

function collapseSpaces(s: string): string {
  return s.replace(/\s{2,}/g, ' ');
}

function normalizeToken(s: string): string {
  return trimSpaces(collapseSpaces(unifyDashes(s)));
}

function toCityGrid(rows: Record<string, string>[]): CityGrid {
  const grid: CityGrid = {};
  rows.forEach((r) => {
    const name = normalizeToken(r.name || r.label || r.city || r.city_id || '');
    const id = r.city_id || r.id || r.label || r.name;
    if (name && id) grid[name] = id;
  });
  return grid;
}

function mapCity(name: string, grid: CityGrid): string {
  const norm = normalizeToken(name);
  const mapped = grid[norm];
  if (!mapped) console.warn(`Unknown city: ${name}`);
  return mapped ?? norm;
}

function toDrivers(rows: Record<string, string>[], grid: CityGrid): Driver[] {
  return rows.map((r) => {
    const name = r['Перевозчик'];
    const raw = r['Города (детализация)'] || '';
    const variants = raw
      .split(/[|;]+/)
      .map((v) => normalizeToken(v))
      .filter(Boolean)
      .map((v) => ({
        city_ids: v.split('-').map((c) => mapCity(c, grid)),
      }));
    return { name, variants } as Driver;
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
  const [citiesTxt, corridorsTxt, linesTxt, pathsTxt, driversTxt, gridTxt] =
    await Promise.all([
      fetchText('/data/cities.csv'),
      fetchText('/data/corridors.csv'),
      fetchText('/data/lines.csv'),
      fetchText('/data/line_paths.csv'),
      fetchText('/data/drivers.csv'),
      fetchText('/data/cities_grid.csv'),
    ]);

  const cities = toCities(parseCSV(citiesTxt));
  const corridors = toCorridors(parseCSV(corridorsTxt)).sort(
    (a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY)
  );
  const lines = toLines(parseCSV(linesTxt)).sort(
    (a, b) => (a.draw_order ?? Number.POSITIVE_INFINITY) - (b.draw_order ?? Number.POSITIVE_INFINITY)
  );
  const linePaths = toLinePaths(parseCSV(pathsTxt));
  const cityGrid = toCityGrid(parseCSV(gridTxt));
  const drivers = toDrivers(parseCSV(driversTxt), cityGrid);

  return { cities, corridors, lines, linePaths, drivers, cityGrid };
}
