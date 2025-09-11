export type City = {
  city_id: string;
  label: string;
  x: number;
  y: number;
  is_hub: number; // 1 = пересадочный узел, 0 = обычная станция
  is_corridor_hub: number; // 1 = пересадка между коридорами разрешена
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
  // Логическая группа: варианты одной ветки (необязательное поле)
  group_id?: string;
};

export type LinePath = {
  line_id: string;
  // Вариант маршрута внутри одной линии (необязательное поле)
  variant_id?: string | number;
  seq: number; // порядок точки в линии
  city_id: string;
};

export type DataBundle = {
  cities: City[];
  corridors: Corridor[];
  lines: Line[];
  linePaths: LinePath[];
};

