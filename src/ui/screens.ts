import type { Scene } from "phaser";
import { C, F } from "./tokens";
import type { KvRow, ListItem, PartyView, UiPrimitives } from "./primitives";

type Rect = { x: number; y: number; w: number; h: number };

type MessageState = { mode?: string };
type MainMenuState = { gold: number; party: PartyView[]; cursor: number; close: () => void };
type StatusState = { gold: number; party: PartyView[]; selectedIndex: number; page: number; totalPages: number; rows: KvRow[]; back: () => void; title: string };
type EquipState = { gold: number; party: PartyView[]; selectedIndex: number; rows: KvRow[]; back: () => void; title: string };
type ItemState = { gold: number; party: PartyView[]; items: ListItem[]; cursor: number; page: number; totalPages: number; back: () => void; title: string };
type ShopState = { gold: number; shopType: string; items: ListItem[]; cursor: number; page: number; totalPages: number; back: () => void; title: string; prompt: string };

function splitH(area: Rect, leftW: number, gap: number): [Rect, Rect] {
  return [
    { x: area.x, y: area.y, w: leftW, h: area.h },
    { x: area.x + leftW + gap, y: area.y, w: area.w - leftW - gap, h: area.h },
  ];
}

function parseMessage(message: string) {
  const match = message.match(/^([^:：]{1,10})[:：]\s*(.+)$/);
  return match ? { speaker: match[1], body: match[2] } : { speaker: "", body: message };
}

function pageSlice<T>(items: T[], cursor: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(totalPages - 1, Math.max(0, Math.floor(cursor / pageSize)));
  const start = page * pageSize;
  return { page, totalPages, start, slice: items.slice(start, start + pageSize) };
}

export function drawField(scene: any, ui: UiPrimitives, state: { gold: number }): void {
  ui.goldPill(state.gold);
}

export function drawControls(scene: any, ui: UiPrimitives, state: {}): void {
  void state;
  ui.vpad((dir) => scene.directionInput(dir));
  ui.actionButtons(() => scene.actionA(), () => scene.actionB());
}

export function drawMessage(scene: MessageState, ui: UiPrimitives, message: string, hasMore: boolean): void {
  const parsed = parseMessage(message);
  if (scene["mode"] === "field") ui.scrim(0.35);
  ui.dialog(null, parsed.speaker ? `${parsed.speaker}「${parsed.body}」` : parsed.body, hasMore);
}

export function drawMainMenu(scene: Scene, ui: UiPrimitives, state: MainMenuState): void {
  ui.scrim(0.35);
  ui.goldPill(state.gold);
  const [leftArea, rightArea] = splitH({ x: 8, y: 290, w: 344, h: 290 }, 110, 8);
  ui.partyPanel(leftArea, state.party, -1);
  ui.menuGrid(rightArea, [
    { label: "どうぐ", iconColor: 0xd8a040 },
    { label: "じゅもん", iconColor: 0x6a8ad0 },
    { label: "つよさ", iconColor: 0xd05a5a },
    { label: "そうび", iconColor: 0xd8b860 },
  ], state.cursor);
  ui.fabBack(state.close);
}

export function drawStatus(scene: Scene, ui: UiPrimitives, state: StatusState): void {
  ui.scrim(0.35);
  ui.goldPill(state.gold);
  const [leftArea, rightArea] = splitH({ x: 8, y: 100, w: 344, h: 480 }, 130, 8);
  ui.partyPanel(leftArea, state.party, state.selectedIndex);
  ui.text(rightArea, rightArea.x + rightArea.w / 2, rightArea.y + 12, `${state.title}`, { font: F.BODY, color: C.textAccent, align: "center" });
  ui.kvTable({ x: rightArea.x, y: rightArea.y + 28, w: rightArea.w, h: rightArea.h - 64 }, state.rows);
  ui.pager({ x: rightArea.x, y: rightArea.y + rightArea.h - 24, w: rightArea.w, h: 24 }, state.page, state.totalPages);
  ui.fabBack(state.back);
}

export function drawEquip(scene: Scene, ui: UiPrimitives, state: EquipState): void {
  ui.scrim(0.35);
  ui.goldPill(state.gold);
  const [leftArea, rightArea] = splitH({ x: 8, y: 100, w: 344, h: 480 }, 130, 8);
  ui.partyPanel(leftArea, state.party, state.selectedIndex);
  ui.text(rightArea, rightArea.x + rightArea.w / 2, rightArea.y + 12, state.title, { font: F.BODY, color: C.textAccent, align: "center" });
  ui.kvTable({ x: rightArea.x, y: rightArea.y + 28, w: rightArea.w, h: rightArea.h - 40 }, state.rows);
  ui.fabBack(state.back);
}

export function drawItem(scene: Scene, ui: UiPrimitives, state: ItemState): void {
  ui.scrim(0.35);
  ui.goldPill(state.gold);
  const [leftArea, rightArea] = splitH({ x: 8, y: 100, w: 344, h: 480 }, 130, 8);
  ui.partyPanel(leftArea, state.party, -1);
  ui.text(rightArea, rightArea.x + rightArea.w / 2, rightArea.y + 12, state.title, { font: F.BODY, color: C.textAccent, align: "center" });
  const page = pageSlice(state.items, state.cursor, 5);
  ui.list({ x: rightArea.x, y: rightArea.y + 28, w: rightArea.w, h: rightArea.h - 56 }, page.slice, state.cursor - page.start);
  ui.pager({ x: rightArea.x, y: rightArea.y + rightArea.h - 24, w: rightArea.w, h: 24 }, page.page, page.totalPages);
  ui.fabBack(state.back);
}

export function drawShop(scene: Scene, ui: UiPrimitives, state: ShopState): void {
  ui.scrim(0.35);
  ui.goldPill(state.gold);
  const [leftArea, rightArea] = splitH({ x: 8, y: 290, w: 344, h: 290 }, 130, 8);
  const inner = ui.window(leftArea);
  ui.text(inner, inner.x + 56, inner.y + 18, state.title, { font: F.S, color: C.textAccent, align: "center" });
  ui.text(inner, inner.x + 6, inner.y + 52, state.prompt, { font: F.BODY, color: C.textPrimary });
  const page = pageSlice(state.items, state.cursor, 5);
  ui.list({ x: rightArea.x, y: rightArea.y, w: rightArea.w, h: rightArea.h - 34 }, page.slice.map((item) => ({ ...item, muted: item.muted || false })), state.cursor - page.start);
  ui.pager({ x: rightArea.x, y: rightArea.y + rightArea.h - 24, w: rightArea.w, h: 24 }, page.page, page.totalPages);
  ui.fabBack(state.back);
}
