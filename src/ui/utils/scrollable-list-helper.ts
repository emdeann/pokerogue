import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { TextStyle } from "#enums/text-style";
import { ScrollableGridHelper } from "#ui/scrollable-grid-helper";
import { addBBCodeTextObject, addTextObject } from "#ui/text";
import type BBCodeText from "phaser3-rex-plugins/plugins/bbcodetext";

/** A renderable element for a scrollable list */
type ListCell = Phaser.GameObjects.Container & {
  textObj: Phaser.GameObjects.Text | BBCodeText;
  iconObj?: Phaser.GameObjects.Sprite;
  overlayObj?: Phaser.GameObjects.Sprite;
};

/** Sprite data for a scrollable list (icon, overlay, etc.) */
export interface ScrollableListSprite<TData> {
  texture: string;
  frame?: string;
  x: number;
  y: number;
  scale?: number;
  getFrame?: (data: TData) => string | null | undefined;
  isVisible?: (data: TData) => boolean;
  getTint?: (data: TData) => number | null | undefined;
}

/**
 * Configuration options for a scrollable list
 */
export interface ScrollableListConfig<TData> {
  /** The number of rows in the list */
  rows: number;
  /** Scroll bar config local to the list container */
  scrollBar?: { x: number; y: number; width: number; height: number };

  /** Item layout local to the list container */
  items: {
    x?: number;
    y?: number;
    height: number;
    width: number;
  };

  /** Callback to obtain the text label for a given option */
  getLabel: (data: TData) => string;
  /** Whether the list uses bbcode or raw text */
  bbcode?: boolean;
  /** Text style option */
  textStyle?: TextStyle;
  /** Additional style options via Phaser */
  textOptions?: Phaser.Types.GameObjects.Text.TextStyle;
  textAlign?: "left" | "right";
  cancelText?: string;

  icon?: ScrollableListSprite<TData>;
  overlay?: ScrollableListSprite<TData>;

  /** Selection cursor config */
  cursor?: {
    texture: string;
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
  };

  scrollMode?: "scrollbar" | "arrows" | "none";
  arrowStyle?: TextStyle;

  onItemSelected?: (data: TData) => void;
  onItemActioned?: (data: TData) => void;
  /** Invoked on LEFT/RIGHT while a non-cancel item is highlighted. */
  onItemAdjusted?: ((data: TData, button: Button) => void) | undefined;
  onCancel?: () => void;
}

/** Wrapper of {@linkcode ScrollableGridHelper} for 1D vertical text-based lists */
export class ScrollableListHelper<TData> extends Phaser.GameObjects.Container {
  private readonly gridHelper: ScrollableGridHelper<ListCell, TData | string>;
  private readonly config: ScrollableListConfig<TData>;

  constructor(x: number, y: number, config: ScrollableListConfig<TData>) {
    super(globalScene, x, y);
    globalScene.add.existing(this);
    this.config = config;

    const textStyle = config.textStyle ?? TextStyle.WINDOW;

    const makeSprite = (spec: ScrollableListSprite<TData>): Phaser.GameObjects.Sprite =>
      globalScene.add
        .sprite(spec.x, spec.y, spec.texture, spec.frame)
        .setScale(spec.scale ?? 1)
        .setVisible(false);

    const applySprite = (sprite: Phaser.GameObjects.Sprite, spec: ScrollableListSprite<TData>, data: TData): void => {
      if (spec.getFrame) {
        const frame = spec.getFrame(data);
        if (frame == null) {
          sprite.setVisible(false);
        } else {
          sprite.setFrame(frame).setVisible(true);
        }
      } else {
        sprite.setVisible(spec.isVisible ? spec.isVisible(data) : true);
      }

      if (sprite.visible && spec.getTint) {
        const tint = spec.getTint(data);
        if (tint == null) {
          sprite.clearTint();
        } else {
          sprite.setTint(tint);
        }
      } else {
        sprite.clearTint();
      }
    };

    this.gridHelper = new ScrollableGridHelper<ListCell, TData | string>(0, 0, {
      rows: config.rows + +(config.cancelText != null),
      columns: 1,
      scrollMode: config.scrollMode ?? "scrollbar",
      arrowStyle: config.arrowStyle,
      scrollBar: config.scrollBar ?? { x: 0, y: 0, width: 0, height: 0 },
      cells: {
        x: config.items.x ?? 0,
        y: config.items.y ?? 0,
        spacingX: config.items.width ?? 0,
        spacingY: config.items.height,
        createCell: () => {
          const container = globalScene.add.container(0, 0) as ListCell;
          const textObj = config.bbcode
            ? addBBCodeTextObject(0, 0, "", textStyle, config.textOptions)
            : addTextObject(0, 0, "", textStyle, config.textOptions);
          container.add(textObj);
          container.textObj = textObj;

          if (config.icon) {
            container.iconObj = makeSprite(config.icon);
            container.add(container.iconObj);
          }
          if (config.overlay) {
            container.overlayObj = makeSprite(config.overlay);
            container.add(container.overlayObj);
          }
          return container;
        },
        renderCell: (cell, data) => {
          if (this.isCancelItem(data)) {
            cell.textObj.setText(data);
          } else {
            cell.textObj.setText(config.getLabel(data));
            if (config.icon && cell.iconObj) {
              applySprite(cell.iconObj, config.icon, data);
            }
            if (config.overlay && cell.overlayObj) {
              applySprite(cell.overlayObj, config.overlay, data);
            }
          }
          if (config.textAlign === "right" && cell.textObj.displayWidth > 0 && config.items.width != null) {
            cell.textObj.x = config.items.width - cell.textObj.displayWidth;
          }
        },
      },
      cursor: config.cursor,
      onItemSelected: (_cell, data) => {
        if (!this.isCancelItem(data)) {
          config.onItemSelected?.(data);
        }
      },
      onItemActioned: (_cell, data) => {
        if (this.isCancelItem(data)) {
          config.onCancel?.();
          return;
        }
        config.onItemActioned?.(data);
      },
    });

    this.add(this.gridHelper);
  }

  private isCancelItem(data: TData | string): data is string {
    return this.config.cancelText != null && data === this.config.cancelText;
  }

  /**
   * Replace the items to be displayed. Resets the cursor and scroll position, redraws the grid,
   * and fires {@linkcode ScrollableGridConfig.onItemSelected} for the first item (if any).
   */
  setItems(items: TData[], resetCursor = true): void {
    const displayItems: (TData | string)[] =
      this.config.cancelText != null ? [...items, this.config.cancelText] : items;

    this.gridHelper.setItems(displayItems, resetCursor);
  }

  /** Reset scrolling + cursor position and remove the cursor visual. */
  reset(): void {
    this.gridHelper.reset();
  }

  /** Set whether this grid should be accepting touch input. */
  setTouchEnabled(enabled: boolean): void {
    this.gridHelper.setTouchEnabled(enabled);
  }

  /**
   * Process keyboard input.
   * @returns `true` if the input was consumed
   */
  processInput(button: Button): boolean {
    const currentData = this.gridHelper.getCurrentItem();
    if (
      (button === Button.LEFT || button === Button.RIGHT)
      && this.config.onItemAdjusted
      && currentData != null
      && !this.isCancelItem(currentData)
    ) {
      this.config.onItemAdjusted(currentData, button);
      return true;
    }
    return this.gridHelper.processInput(button);
  }
}
