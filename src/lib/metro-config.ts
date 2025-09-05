// Конфигурация для метро-схемы согласно ТЗ
export const METRO_CONFIG = {
  // Толщины линий (базовая шкала при масштабе 1.0)
  LINE_WIDTH: 4,
  LINE_WIDTH_HIGHLIGHTED: 6,
  LINE_WIDTH_HOVER: 6,
  
  // Расстояния между параллельными линиями
  PARALLEL_LINE_SPACING: 10, // px между осями
  
  // Радиусы скруглений
  CORNER_RADIUS: 24, // px для поворотов
  
  // Станции
  STATION_RADIUS: 2.5, // px для обычных станций
  HUB_OUTER_RADIUS: 7, // px внешний радиус для узлов
  HUB_INNER_RADIUS: 3.5, // px внутренний радиус для узлов (белая выемка)
  
  // Подписи
  LABEL_OFFSET_BASE: 12, // px базовый отступ
  LABEL_OFFSET_STEP: 5, // px шаг для поиска свободного места
  LABEL_HALO_WIDTH: 2.5, // px белый ореол под текстом
  LABEL_LEADER_DISTANCE: 36, // px расстояние для лидеров
  
  // Типографика
  FONT_SIZE_NORMAL: 12, // px
  FONT_SIZE_HUB: 13, // px для узлов
  FONT_FAMILY: 'Inter, system-ui, sans-serif',
  
  // Цвета
  BACKGROUND: '#FFFFFF',
  TEXT_COLOR: '#111111',
  TEXT_HALO: '#FFFFFF',
  
  // Opacity для состояний
  OPACITY_DIM: 0.4, // для неактивных линий
  OPACITY_NORMAL: 1.0, // для обычных линий
  OPACITY_HIGHLIGHTED: 1.0, // для подсвеченных линий
  
  // LOD (Level of Detail) пороги
  LOD_ZOOM_THRESHOLDS: {
    HIDE_LABELS: 0.8, // < 0.8: скрыть обычные подписи
    SHOW_ALL_LABELS: 1.4, // >= 1.4: показать все подписи
  },
  
  // Анимации
  ANIMATION_DURATION: 200, // ms
  ANIMATION_EASING: 'ease-out',
  
  // Зум
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 4.0,
  ZOOM_STEP: 1.2,
  
  // Паддинги для fit-to-data
  FIT_PADDING: 40, // px
} as const;

export type MetroConfig = typeof METRO_CONFIG;
