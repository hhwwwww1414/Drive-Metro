export type City = {
  city_id: string;
  label: string;
  x: number;
  y: number;
  is_hub: number; // 1 = узел/пересадка, 0 = обычная станция
};

export type Corridor = {
  corridor_id: string;
  name: string;
  color: string; // HEX
  order?: number; // для сортировки в легенде
};

export type Line = {
  line_id: string;
  corridor_id: string;
  name: string;
  color: string; // HEX
  style?: 'solid' | 'dashed' | 'dotted';
  draw_order?: number; // порядок отрисовки
};

export type LinePath = {
  line_id: string;
  seq: number;    // порядок точки в линии
  city_id: string;
};

export type DataBundle = {
  cities: City[];
  corridors: Corridor[];
  lines: Line[];
  linePaths: LinePath[];
};
