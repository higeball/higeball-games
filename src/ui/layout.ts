export const LAYOUT = {
  CANVAS: { w: 360, h: 472 },
  CONTROLS: { w: 360, h: 168 },
  GAP: { xs: 2, s: 4, m: 8, l: 12, xl: 16 },
  RADIUS: { window: 4, button: 8, pill: 999 },
  PAD: { window: 8, panel: 12, message: 14 },

  HUD: { x: 8, y: 6, w: 344, h: 50 },
  FIELD_TOP: 62,
  PANEL_Y: 306,

  MESSAGE: { x: 12, y: 316, w: 336, h: 146 },
  MESSAGE_PORTRAIT: { x: 24, y: 338, w: 52, h: 76 },
  MESSAGE_SPEAKER: { x: 82, y: 322, w: 124, h: 30 },

  BATTLE: {
    MSG: { x: 8, y: 310, w: 344, h: 58 },
    STATUS: { x: 8, y: 372, w: 140, h: 96 },
    CMD: { x: 152, y: 372, w: 200, h: 96 },
    SUBMENU: { x: 12, y: 308, w: 200, h: 140 },
    ENEMY_X: 104,
    ENEMY_Y: 154,
    PARTY_X: 252,
    PARTY_Y: 142,
    PARTY_GAP: 34,
  },

  MENU: {
    MAIN: { x: 20, y: 88, w: 200, h: 220 },
    NARROW: { x: 20, y: 88, w: 160, h: 220 },
    WIDE: { x: 20, y: 74, w: 320, h: 214 },
    STATUS: { x: 20, y: 88, w: 320, h: 320 },
  },
} as const;

export const COLORS = {
  text: {
    primary: "#fff3cb",
    accent: "#ffe58a",
    muted: "#d8c98f",
    disabled: "#a89c8d",
    danger: "#ffb0a0",
    hpLow: "#ff8a78",
    mpAccent: "#9ad7ff",
  },
  window: {
    panelFill: 0x202735,
    panelBorder: 0xf3d17b,
    ffTop: 0x1d3f8f,
    ffBottom: 0x142457,
    ffBorder: 0xe7e7ef,
    ffInset: 0x050816,
    dimOverlay: { color: 0x000000, alphaSubmenu: 0.4, alphaField: 0.35 },
  },
} as const;

export const FONT = { XS: 12, S: 14, M: 16, L: 18, XL: 22 } as const;

export const DISPLAY = { D1: 22, D2: 26, D3: 30, D4: 34 } as const;
