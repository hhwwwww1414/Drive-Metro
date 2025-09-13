import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import type {
  DataBundle,
  City,
  Corridor,
  Line,
  LinePath,
  Driver,
  CityGrid,
} from '../src/lib/types';

function parseCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(file, 'utf8');
  const { data } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return data as Record<string, string>[];
}

function toCities(rows: Record<string, string>[]): City[] {
  return rows.map((r) => ({
    city_id: r.city_id!,
    label: r.label || r.city_id!,
    x: Number(r.x),
    y: Number(r.y),
    is_hub: Number(r.is_hub) || 0,
    is_corridor_hub: Number(r.is_corridor_hub) || 0,
  }));
}

function toCorridors(rows: Record<string, string>[]): Corridor[] {
  return rows.map((r) => ({
    corridor_id: r.corridor_id!,
    name: r.name!,
    color: r.color!,
  }));
}

function toLines(rows: Record<string, string>[]): Line[] {
  return rows.map((r) => ({
    line_id: r.line_id!,
    corridor_id: r.corridor_id!,
    name: r.name!,
    color: r.color!,
  }));
}

function toLinePaths(rows: Record<string, string>[]): LinePath[] {
  return rows.map((r) => ({
    line_id: r.line_id!,
    seq: Number(r.seq),
    city_id: r.city_id!,
  }));
}

export function loadSampleBundle(): DataBundle {
  const base = path.join(__dirname, 'fixtures');
  const cities = toCities(parseCsv(path.join(base, 'cities.csv')));
  const corridors = toCorridors(parseCsv(path.join(base, 'corridors.csv')));
  const lines = toLines(parseCsv(path.join(base, 'lines.csv')));
  const linePaths = toLinePaths(parseCsv(path.join(base, 'line_paths.csv')));
  const drivers: Driver[] = [];
  const cityGrid: CityGrid = {};
  return { cities, corridors, lines, linePaths, drivers, cityGrid };
}
