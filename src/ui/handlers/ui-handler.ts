import { globalScene } from "#app/global-scene";
import type { Button } from "#enums/buttons";
import type { UiMode } from "#enums/ui-mode";

/**
 * A basic abstract class to act as a holder and processor for UI elements.
 */
export abstract class UiHandler {
  protected mode: number | null;
  protected cursor = 0;
  public active = false;

  /** True iff the UI manager currently considers this handler the input owner. */
  private inputOwned = false;

  /**
   * @param mode The mode of the UI element. These should be unique.
   */
  constructor(mode: UiMode | null = null) {
    this.mode = mode;
  }

  abstract setup(): void;

  show(_args: any[]): boolean {
    this.active = true;

    return true;
  }

  abstract processInput(button: Button): boolean;

  getUi() {
    return globalScene.ui;
  }

  getCursor(): number {
    return this.cursor;
  }

  setCursor(cursor: number): boolean {
    const changed = this.cursor !== cursor;
    if (changed) {
      this.cursor = cursor;
    }

    return changed;
  }

  /**
   * Called by the UI to determine when this handler is allowed to receive touch inputs.
   */
  setInputEnabled(enabled: boolean): void {
    this.inputOwned = enabled;
    this.applyInputState();
  }

  /** Whether the UI manager currently considers this handler the input owner. */
  protected hasInputOwnership(): boolean {
    return this.inputOwned;
  }

  /**
   * Subclasses may override this to apply additional conditions to touch input allowance.
   */
  protected applyInputState(): void {}

  /**
   * Changes the style of the mouse cursor.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/cursor}
   * @param cursorStyle cursor style to apply
   */
  protected setMouseCursorStyle(cursorStyle: "pointer" | "default") {
    globalScene.input.manager.canvas.style.cursor = cursorStyle;
  }

  clear() {
    this.active = false;
  }

  /**
   * To be implemented by individual handlers when necessary to free memory
   * Called when {@linkcode BattleScene} is reset
   */
  destroy(): void {}
}
