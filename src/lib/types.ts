export type City = {
  city_id: string;
  label: string;
  x: number;
  y: number;
};

export type Corridor = {
  corridor_id: string;
  name: string;
  color: string; // HEX
};

export type Line = {
  line_id: string;
  corridor_id: string;
  name: string;
  color: string; // HEX
  style?: 'solid' | 'dashed' | 'dotted';
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
