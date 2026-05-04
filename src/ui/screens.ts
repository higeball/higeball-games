import type { Scene } from "phaser";
import type { UiPrimitives } from "./primitives";

export type ScreenState = any;

export function drawField(scene: any, ui: UiPrimitives, state: { gold: number }): void {
  ui.goldPill(state.gold);
  ui.vpad((dir) => scene.directionInput(dir));
  ui.actionButtons(() => scene.actionA(), () => scene.actionB());
}

export function drawMessage(_scene: Scene, _ui: UiPrimitives, _message: string, _hasMore: boolean): void {}

export function drawMainMenu(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}

export function drawStatus(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}

export function drawEquip(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}

export function drawItem(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}

export function drawShop(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}

export function drawLevelUp(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}

export function drawBattleCommand(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}

export function drawBattleSubmenu(_scene: Scene, _ui: UiPrimitives, _state: ScreenState): void {}
