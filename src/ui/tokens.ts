// src/ui/tokens.ts

// === Color ===
// Phaser graphics 用は number、setStyle 用 / Phaser.Text 用は string
export const C = {
  // Window fills (gradient: top→bottom)
  windowTop: 0x0d2773,
  windowBottom: 0x061447,
  windowEdge: 0xffffff,

  // Text
  textPrimary: "#ffffff",
  textMuted: "#cfd6e8",
  textAccent: "#ffe89a",
  textMp: "#b3f5b3",
  textDisabled: "#6e7894",
  textDanger: "#ff8a78",

  // Overlays
  scrim: 0x000000,
  overlayPanel: 0x000000,

  // Action buttons
  btnA: { top: 0xe63973, bottom: 0xb3214f },
  btnB: { top: 0x2d6cd9, bottom: 0x1c4a9a },

  // Vpad
  vpadFill: 0xffffff,
  vpadStroke: 0xffffff,

  // Selected highlight in lists / cells
  selectedFill: 0xffffff,
} as const;

// === Font sizes ===
export const F = {
  XS: 12,
  S: 14,
  M: 16,
  BODY: 17,
  TITLE: 20,
  D1: 24,
} as const;

// === Spacing ===
export const SP = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
} as const;

// === Radius ===
export const R = {
  window: 8,
  button: 6,
  pill: 999,
} as const;

// === Padding ===
export const P = {
  window: 14,
  windowTight: 8,
  dialog: 18,
  dialogX: 20,
} as const;

// === Stroke ===
export const STROKE = {
  edge: 1,
  selected: 1,
  divider: 1,
} as const;

// === Canvas ===
export const CANVAS = { w: 360, h: 640 } as const;
