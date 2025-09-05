// Visual configuration for metro rendering (tuned to a clean Moscow-like style)
export const METRO_CONFIG = {
  // Line thickness
  LINE_WIDTH: 3,
  LINE_WIDTH_HIGHLIGHTED: 4,
  LINE_WIDTH_HOVER: 4,

  // Parallel spacing: distance between line centers on shared segments
  PARALLEL_LINE_SPACING: 7,

  // Geometry
  CORNER_RADIUS: 24,

  // Stations
  STATION_RADIUS: 2.3,
  HUB_OUTER_RADIUS: 7,
  HUB_INNER_RADIUS: 3.5,

  // Labels
  LABEL_OFFSET_BASE: 12,
  LABEL_OFFSET_STEP: 5,
  LABEL_HALO_WIDTH: 1.6,
  LABEL_LEADER_DISTANCE: 36,

  // Typography
  FONT_SIZE_NORMAL: 12,
  FONT_SIZE_HUB: 13,
  FONT_FAMILY: 'Inter, system-ui, sans-serif',

  // Colors
  BACKGROUND: '#FFFFFF',
  TEXT_COLOR: '#111111',
  TEXT_HALO: '#FFFFFF',

  // Opacity
  OPACITY_DIM: 0.4,
  OPACITY_NORMAL: 1.0,
  OPACITY_HIGHLIGHTED: 1.0,

  // LOD (Level of Detail)
  LOD_ZOOM_THRESHOLDS: {
    HIDE_LABELS: 0.8,
    SHOW_ALL_LABELS: 1.4,
  },

  // Animation
  ANIMATION_DURATION: 200,
  ANIMATION_EASING: 'ease-out',

  // Zoom
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 4.0,
  ZOOM_STEP: 1.2,

  // Fit-to-data padding
  FIT_PADDING: 40,
} as const;

export type MetroConfig = typeof METRO_CONFIG;

