// Загрузка и парсинг CSV из /public/data
import type { City, Corridor, DataBundle, Line, LinePath } from './types';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
  return await res.text();
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(','); // наши CSV без запятых в названиях
    if (cols.length === 1 && cols[0] === '') continue;
    const rec: Record<string, string> = {};
    headers.forEach((h, j) => (rec[h] = (cols[j] ?? '').trim()));
    rows.push(rec);
  }
  return rows;
}

function toCities(rows: Record<string, string>[]): City[] {
  return rows.map((r) => ({
    city_id: r.city_id,
    label: r.label || r.city_id,
    x: Number(r.x),
    y: Number(r.y),
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
  return rows.map((r) => ({
    line_id: r.line_id,
    corridor_id: r.corridor_id,
    name: r.name,
    color: r.color,
    style: (r.style as Line['style']) || 'solid',
    draw_order: r.draw_order ? Number(r.draw_order) : undefined,
  }));
}

function toLinePaths(rows: Record<string, string>[]): LinePath[] {
  return rows.map((r) => ({
    line_id: r.line_id,
    seq: Number(r.seq),
    city_id: r.city_id,
  }));
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
