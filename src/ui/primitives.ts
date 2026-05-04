import Phaser from "phaser";
import { C, CANVAS, F, P, R, SP, STROKE } from "./tokens";

export type Rect = { x: number; y: number; w: number; h: number };

export type PartyView = {
  name: string;
  iconColor: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  lv: number;
  isAlive: boolean;
};

export type Direction = "up" | "down" | "left" | "right";

export type CellSpec = { label: string; iconColor: number };
export type ListItem = { name: string; right?: string; muted?: boolean };
export type KvRow = { label: string; value: string; accent?: boolean };

const UI_FONT = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", system-ui, sans-serif';
const TEXT_RESOLUTION = 2;

type TextOpts = {
  font?: number;
  color?: string;
  align?: "left" | "center" | "right";
  nowrap?: boolean;
  maxLines?: number;
};

export class UiPrimitives {
  private clipStack: Rect[] = [];
  private textPool: Phaser.GameObjects.Text[] = [];
  private textIndex = 0;
  private zonePool: Phaser.GameObjects.Zone[] = [];
  private zoneIndex = 0;
  private goldLabel: Phaser.GameObjects.Text | null = null;
  private vpadZones: Phaser.GameObjects.Zone[] = [];
  private vpadHeld: Direction | null = null;
  private actionZones: Phaser.GameObjects.Zone[] = [];
  private actionLabels: { a: Phaser.GameObjects.Text | null; b: Phaser.GameObjects.Text | null } = {
    a: null,
    b: null,
  };

  constructor(private scene: Phaser.Scene, private g: Phaser.GameObjects.Graphics) {}

  window(area: Rect, opts?: { padding?: number; tight?: boolean }): Rect {
    const padding = opts?.padding ?? (opts?.tight ? P.windowTight : P.window);
    this.g.fillGradientStyle(C.windowTop, C.windowTop, C.windowBottom, C.windowBottom, 1);
    this.g.fillRoundedRect(area.x, area.y, area.w, area.h, R.window);
    this.g.lineStyle(STROKE.edge, C.windowEdge, 1);
    this.g.strokeRoundedRect(area.x + 0.5, area.y + 0.5, area.w - 1, area.h - 1, R.window);
    return {
      x: area.x + padding,
      y: area.y + padding,
      w: area.w - padding * 2,
      h: area.h - padding * 2,
    };
  }

  scrim(alpha = 0.35): void {
    this.g.fillStyle(C.scrim, alpha);
    this.g.fillRect(0, 0, CANVAS.w, CANVAS.h);
  }

  dialog(speaker: string | null, body: string, hasMore: boolean): void {
    const lines = this.wrapLines(body, 336, F.BODY, 4);
    const height = Math.min(180, Math.max(130, P.dialog * 2 + lines.length * 22 + (hasMore ? 18 : 0)));
    const area = { x: 12, y: CANVAS.h - 12 - height, w: CANVAS.w - 24, h: height };
    const inner = this.window(area);
    const text = speaker ? `${speaker}「${body}」` : body;
    const speakerPrefix = speaker ? `${speaker}「` : "";
    const speakerOffset = speaker ? speakerPrefix.length : 0;
    const contentY = inner.y + (speaker ? 8 : 0);
    const displayLines = this.wrapLines(text, inner.w, F.BODY, 4);
    if (speaker) {
      this.text(inner, inner.x, contentY, text, { font: F.BODY, color: C.textPrimary, nowrap: false, maxLines: 4 });
    } else {
      this.text(inner, inner.x, contentY, text, { font: F.BODY, color: C.textPrimary, nowrap: false, maxLines: 4 });
    }
    if (hasMore) {
      this.text(inner, inner.x + inner.w - 6, inner.y + inner.h - 4, "▼", { font: F.S, color: C.textAccent, align: "right" });
    }
  }

  statusRow(party: PartyView[], showTactic = false): Rect {
    const outer = { x: 8, y: 12, w: 344, h: 80 };
    const inner = this.window(outer, { padding: 6, tight: true });
    const rows = party.slice(0, 4);
    const cellW = Math.floor(inner.w / 4);
    rows.forEach((member, i) => {
      const x = inner.x + i * cellW;
      const cell = { x, y: inner.y, w: cellW - 4, h: inner.h };
      this.g.fillStyle(C.windowTop, 0.16);
      this.g.fillRoundedRect(cell.x, cell.y, cell.w, cell.h, R.window);
      this.g.lineStyle(STROKE.edge, C.windowEdge, 0.7);
      this.g.strokeRoundedRect(cell.x + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1, R.window);
      const color = member.isAlive ? C.textPrimary : C.textDisabled;
      this.text(cell, cell.x + 6, cell.y + 6, member.name, { font: F.S, color, nowrap: true });
      this.text(cell, cell.x + 6, cell.y + 24, `Lv${member.lv}`, { font: F.XS, color, nowrap: true });
      this.text(cell, cell.x + 6, cell.y + 38, `HP ${member.hp}/${member.maxHp}`, { font: F.XS, color, nowrap: true });
      this.hpBar(cell.x + 6, cell.y + 54, cell.w - 12, 6, member.hp, member.maxHp);
      if (showTactic) {
        this.text(cell, cell.x + cell.w - 6, cell.y + 6, "たたかう", { font: F.XS, color: C.textMuted, align: "right" });
      }
    });
    return { x: 8, y: 100, w: 344, h: CANVAS.h - 100 };
  }

  partyPanel(area: Rect, party: PartyView[], selectedIndex: number): void {
    const inner = this.window(area);
    const rows = party.slice(0, 4);
    const rowH = 30;
    rows.forEach((member, i) => {
      const rowY = inner.y + i * rowH;
      const selected = i === selectedIndex;
      if (selected) {
        this.g.fillStyle(C.selectedFill, 0.18);
        this.g.fillRoundedRect(inner.x, rowY - 2, inner.w, 26, R.window);
      }
      const color = member.isAlive ? (selected ? C.textAccent : C.textPrimary) : C.textDisabled;
      this.text(inner, inner.x + 2, rowY + 10, member.name, { font: F.S, color, nowrap: true });
      this.text(inner, inner.x + inner.w - 2, rowY + 10, `Lv${member.lv}`, { font: F.XS, color, align: "right", nowrap: true });
      this.text(inner, inner.x + 2, rowY + 22, `HP ${member.hp}/${member.maxHp}`, { font: F.XS, color: member.isAlive ? C.textMuted : C.textDisabled, nowrap: true });
    });
  }

  kvTable(area: Rect, rows: KvRow[]): void {
    const inner = this.window(area);
    const rowH = 22;
    rows.slice(0, Math.floor(inner.h / rowH)).forEach((row, i) => {
      const y = inner.y + i * rowH + 10;
      if (row.accent) {
        this.g.fillStyle(C.selectedFill, 0.12);
        this.g.fillRoundedRect(inner.x - 2, inner.y + i * rowH + 1, inner.w + 4, 20, R.window);
      }
      this.text(inner, inner.x + 2, y, row.label, { font: F.S, color: row.accent ? C.textAccent : C.textMuted, nowrap: true });
      this.text(inner, inner.x + inner.w - 2, y, row.value, { font: F.S, color: C.textPrimary, align: "right", nowrap: true });
    });
  }

  list(area: Rect, items: ListItem[], selectedIndex: number, onTap?: (i: number) => void): void {
    const inner = this.window(area);
    const rowH = 30;
    items.slice(0, Math.floor(inner.h / rowH)).forEach((item, i) => {
      const y = inner.y + i * rowH;
      const selected = i === selectedIndex;
      if (selected) {
        this.g.fillStyle(C.selectedFill, 0.18);
        this.g.fillRoundedRect(inner.x, y, inner.w, rowH - 2, R.window);
        this.g.lineStyle(STROKE.selected, C.windowEdge, 1);
        this.g.strokeRoundedRect(inner.x + 0.5, y + 0.5, inner.w - 1, rowH - 3, R.window);
      }
      const color = item.muted ? C.textDisabled : selected ? C.textAccent : C.textPrimary;
      this.text(inner, inner.x + 2, y + 12, item.name, { font: F.S, color, nowrap: true });
      if (item.right) {
        this.text(inner, inner.x + inner.w - 2, y + 12, item.right, { font: F.S, color, align: "right", nowrap: true });
      }
      if (onTap) {
        const zone = this.getTransientZone(inner.x, y, inner.w, rowH - 2);
        zone.on("pointerdown", () => onTap(i));
      }
    });
  }

  menuGrid(area: Rect, cells: CellSpec[], selectedIndex: number, onTap?: (i: number) => void): void {
    const inner = this.window(area);
    const gap = SP.s;
    const cellW = Math.floor((inner.w - gap) / 2);
    const cellH = Math.floor((inner.h - gap) / 2);
    cells.slice(0, 4).forEach((cell, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = inner.x + col * (cellW + gap);
      const y = inner.y + row * (cellH + gap);
      const selected = i === selectedIndex;
      this.g.fillStyle(C.windowTop, selected ? 0.26 : 0.14);
      this.g.fillRoundedRect(x, y, cellW, cellH, R.window);
      if (selected) {
        this.g.lineStyle(STROKE.selected, C.windowEdge, 1);
        this.g.strokeRoundedRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1, R.window);
      } else {
        this.g.lineStyle(STROKE.edge, C.windowEdge, 0.75);
        this.g.strokeRoundedRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1, R.window);
      }
      this.g.fillStyle(cell.iconColor, 1);
      this.g.fillCircle(x + 14, y + 14, 5);
      this.text({ x, y, w: cellW, h: cellH }, x + cellW / 2, y + cellH / 2 + 1, cell.label, {
        font: F.M,
        color: selected ? C.textAccent : C.textPrimary,
        align: "center",
        nowrap: true,
      });
      if (onTap) {
        const zone = this.getTransientZone(x, y, cellW, cellH);
        zone.on("pointerdown", () => onTap(i));
      }
    });
  }

  pager(area: Rect, page: number, total: number): void {
    const y = area.y + area.h - 12;
    const label = total <= 1 ? "" : `◀ ${page + 1}/${total} ▶`;
    if (!label) return;
    this.text(area, area.x + area.w / 2, y, label, { font: F.XS, color: C.textMuted, align: "center", nowrap: true });
  }

  goldPill(gold: number): void {
    const text = `${gold}G`;
    const width = Math.max(64, this.measureWidth(text, F.BODY) + 24);
    const x = CANVAS.w - 12 - width;
    const y = 12;
    this.g.fillGradientStyle(C.windowTop, C.windowTop, C.windowBottom, C.windowBottom, 1);
    this.g.fillRoundedRect(x, y, width, 28, R.pill);
    this.g.lineStyle(STROKE.edge, C.windowEdge, 1);
    this.g.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, 27, R.pill);
    if (!this.goldLabel) {
      this.goldLabel = this.scene.add.text(x + width / 2, y + 14, text, {
        fontFamily: UI_FONT,
        fontSize: `${F.BODY}px`,
        color: C.textAccent,
        fontStyle: "bold",
        resolution: TEXT_RESOLUTION,
      }).setOrigin(0.5);
    }
    this.goldLabel.setText(text);
    this.goldLabel.setPosition(x + width / 2, y + 14);
    this.goldLabel.setVisible(true);
  }

  fabBack(onTap: () => void): void {
    const size = 44;
    const x = CANVAS.w - 12 - size;
    const y = CANVAS.h - 12 - size;
    this.g.fillGradientStyle(C.windowTop, C.windowTop, C.windowBottom, C.windowBottom, 1);
    this.g.fillCircle(x + size / 2, y + size / 2, size / 2);
    this.g.lineStyle(STROKE.edge, C.windowEdge, 1);
    this.g.strokeCircle(x + size / 2, y + size / 2, size / 2);
    this.text({ x, y, w: size, h: size }, x + size / 2, y + size / 2, "←", { font: F.M, color: C.textPrimary, align: "center" });
    this.getTransientZone(x, y, size, size).on("pointerdown", onTap);
  }

  vpad(onDir: (d: Direction) => void): void {
    const cx = 16 + 65;
    const cy = CANVAS.h - 16 - 65;
    const r = 65;
    this.g.fillStyle(C.vpadFill, 0.08);
    this.g.fillCircle(cx, cy, r);
    this.g.lineStyle(1, C.vpadStroke, 0.45);
    this.g.strokeCircle(cx, cy, r);
    this.drawTri(cx, cy - 34, "up");
    this.drawTri(cx, cy + 34, "down");
    this.drawTri(cx - 34, cy, "left");
    this.drawTri(cx + 34, cy, "right");
    const dirs: { dx: number; dy: number; dir: Direction }[] = [
      { dx: 0, dy: -40, dir: "up" },
      { dx: 0, dy: 40, dir: "down" },
      { dx: -40, dy: 0, dir: "left" },
      { dx: 40, dy: 0, dir: "right" },
    ];
    dirs.forEach((d, i) => {
      const zone = this.vpadZones[i] ?? this.scene.add.zone(cx + d.dx, cy + d.dy, 44, 44).setInteractive();
      this.vpadZones[i] = zone;
      zone.setPosition(cx + d.dx, cy + d.dy);
      zone.removeAllListeners();
      zone.on("pointerdown", () => {
        this.vpadHeld = d.dir;
        onDir(d.dir);
      });
      zone.on("pointerup", () => {
        if (this.vpadHeld === d.dir) this.vpadHeld = null;
      });
      zone.on("pointerout", () => {
        if (this.vpadHeld === d.dir) this.vpadHeld = null;
      });
      zone.on("pointerupoutside", () => {
        if (this.vpadHeld === d.dir) this.vpadHeld = null;
      });
    });
  }

  actionButtons(onA: () => void, onB: () => void): void {
    const ax = CANVAS.w - 14 - 30;
    const ay = CANVAS.h - 14 - 30;
    const bx = CANVAS.w - 14 - 25 - 5;
    const by = 596 - 30 - 16 - 25;
    this.drawCircleButton(ax, ay, 30, C.btnA.top, C.btnA.bottom, "A");
    this.drawCircleButton(bx, by, 25, C.btnB.top, C.btnB.bottom, "B");
    const aZone = this.actionZones[0] ?? this.scene.add.zone(ax, ay, 64, 64).setInteractive();
    aZone.setPosition(ax, ay);
    aZone.removeAllListeners();
    aZone.on("pointerdown", onA);
    this.actionZones[0] = aZone;
    const bZone = this.actionZones[1] ?? this.scene.add.zone(bx, by, 54, 54).setInteractive();
    bZone.setPosition(bx, by);
    bZone.removeAllListeners();
    bZone.on("pointerdown", onB);
    this.actionZones[1] = bZone;
  }

  hpBar(x: number, y: number, w: number, h: number, value: number, max: number): void {
    const ratio = Phaser.Math.Clamp(value / Math.max(1, max), 0, 1);
    this.g.fillStyle(0x000000, 0.35);
    this.g.fillRoundedRect(x, y, w, h, 2);
    const color = ratio < 0.25 ? 0xff8a78 : ratio < 0.5 ? 0xffe89a : 0xb3f5b3;
    this.g.fillStyle(color, 1);
    this.g.fillRoundedRect(x + 1, y + 1, Math.max(0, (w - 2) * ratio), h - 2, 2);
    this.g.lineStyle(1, C.windowEdge, 0.55);
    this.g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 2);
  }

  text(area: Rect, x: number, y: number, value: string, opts?: TextOpts): void {
    const font = opts?.font ?? F.S;
    const color = opts?.color ?? C.textPrimary;
    const align = opts?.align ?? "left";
    const nowrap = opts?.nowrap ?? true;
    const maxLines = opts?.maxLines ?? 1;
    const clip = this.currentClip(area);
    let t = this.textPool[this.textIndex];
    if (!t) {
      t = this.scene.add.text(0, 0, "", {
        fontFamily: UI_FONT,
        fontSize: `${F.S}px`,
        color: C.textPrimary,
        fontStyle: "bold",
        resolution: TEXT_RESOLUTION,
      });
      t.setPadding(2, 2, 2, 2);
      this.textPool[this.textIndex] = t;
    }
    t.setVisible(true);
    t.setStyle({ fontSize: `${font}px`, color });
    t.setOrigin(align === "center" ? 0.5 : align === "right" ? 1 : 0, 0.5);
    t.setText(value);
    t.setPosition(Math.round(x), Math.round(y));
    const availableW = Math.max(0, clip.x + clip.w - x - 2);
    const availableH = Math.max(0, clip.y + clip.h - y + font);
    const maxW = availableW > 0 ? availableW : area.w;
    if (nowrap) {
      let s = value;
      while (s.length > 1 && this.measureWidth(`${s}…`, font) > maxW) {
        s = s.slice(0, -1);
      }
      if (s !== value) {
        t.setText(`${s}…`);
      }
    } else {
      const lines = this.wrapLines(value, maxW, font, maxLines);
      t.setText(lines.join("\n"));
    }
    if (t.height > availableH && nowrap) {
      t.setVisible(true);
    }
    this.textIndex += 1;
    return;
  }

  beginFrame(): void {
    if (this.goldLabel) this.goldLabel.setVisible(false);
    this.textIndex = 0;
    this.zoneIndex = 0;
  }

  endFrame(): void {
    for (let i = this.textIndex; i < this.textPool.length; i += 1) {
      this.textPool[i].setVisible(false);
    }
    for (let i = this.zoneIndex; i < this.zonePool.length; i += 1) {
      this.zonePool[i].setVisible(false).removeInteractive();
    }
  }

  clearFrame(): void {
    this.beginFrame();
  }

  getHeldDirection(): Direction | null {
    return this.vpadHeld;
  }

  withClip<T>(area: Rect, fn: () => T): T {
    this.clipStack.push(area);
    try {
      return fn();
    } finally {
      this.clipStack.pop();
    }
  }

  private currentClip(area: Rect): Rect {
    const clip = this.clipStack.at(-1);
    if (!clip) return area;
    const x1 = Math.max(area.x, clip.x);
    const y1 = Math.max(area.y, clip.y);
    const x2 = Math.min(area.x + area.w, clip.x + clip.w);
    const y2 = Math.min(area.y + area.h, clip.y + clip.h);
    return { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
  }

  private getTransientZone(x: number, y: number, w: number, h: number): Phaser.GameObjects.Zone {
    let zone = this.zonePool[this.zoneIndex];
    if (!zone) {
      zone = this.scene.add.zone(0, 0, 1, 1);
      this.zonePool[this.zoneIndex] = zone;
    }
    zone.setPosition(x, y);
    zone.setSize(w, h);
    zone.setVisible(true);
    zone.setInteractive();
    zone.removeAllListeners();
    this.zoneIndex += 1;
    return zone;
  }

  private wrapLines(value: string, maxW: number, font: number, maxLines: number): string[] {
    const result: string[] = [];
    const paragraphs = value.split("\n");
    for (const paragraph of paragraphs) {
      let line = "";
      for (const ch of paragraph) {
        if (this.measureWidth(line + ch, font) <= maxW || line.length === 0) {
          line += ch;
        } else {
          result.push(line);
          line = ch;
          if (result.length >= maxLines) return this.ellipsisLines(result, maxW, font, maxLines);
        }
      }
      result.push(line);
      if (result.length >= maxLines) return this.ellipsisLines(result, maxW, font, maxLines);
    }
    return result.slice(0, maxLines);
  }

  private ellipsisLines(lines: string[], maxW: number, font: number, maxLines: number): string[] {
    const clipped = lines.slice(0, maxLines);
    const last = clipped[maxLines - 1];
    if (last && this.measureWidth(`${last}…`, font) > maxW) {
      let s = last;
      while (s.length > 1 && this.measureWidth(`${s}…`, font) > maxW) {
        s = s.slice(0, -1);
      }
      clipped[maxLines - 1] = `${s}…`;
    } else if (last) {
      clipped[maxLines - 1] = `${last}…`;
    }
    return clipped;
  }

  private measureWidth(value: string, font: number): number {
    let w = 0;
    for (const ch of value) {
      w += /[　-鿿＀-￯]/.test(ch) ? font : font * 0.55;
    }
    return Math.ceil(w + 4);
  }

  private drawCircleButton(cx: number, cy: number, r: number, top: number, bottom: number, label: string): void {
    this.g.fillGradientStyle(top, top, bottom, bottom, 1);
    this.g.fillCircle(cx, cy, r);
    this.g.lineStyle(STROKE.edge, C.windowEdge, 1);
    this.g.strokeCircle(cx, cy, r);
    const key = label === "A" ? "a" : "b";
    const size = label === "A" ? F.M : F.M;
    const text = this.actionLabels[key] ?? this.scene.add.text(cx, cy, label, {
      fontFamily: UI_FONT,
      fontSize: `${size}px`,
      color: C.textPrimary,
      fontStyle: "bold",
      resolution: TEXT_RESOLUTION,
    }).setOrigin(0.5);
    text.setText(label);
    text.setPosition(cx, cy);
    this.actionLabels[key] = text;
  }

  private drawTri(cx: number, cy: number, dir: Direction): void {
    const s = 8;
    this.g.fillStyle(0xffffff, 0.85);
    if (dir === "up") {
      this.g.fillTriangle(cx, cy - s, cx - s, cy + s, cx + s, cy + s);
    } else if (dir === "down") {
      this.g.fillTriangle(cx, cy + s, cx - s, cy - s, cx + s, cy - s);
    } else if (dir === "left") {
      this.g.fillTriangle(cx - s, cy, cx + s, cy - s, cx + s, cy + s);
    } else {
      this.g.fillTriangle(cx + s, cy, cx - s, cy - s, cx - s, cy + s);
    }
  }
}
