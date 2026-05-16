import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { TextStyle } from "#enums/text-style";
import { UiMode } from "#enums/ui-mode";
import { ScrollableListHelper } from "#ui/scrollable-list-helper";
import { addBBCodeTextObject, getTextColor, getTextStyleOptions } from "#ui/text";
import { UiHandler } from "#ui/ui-handler";
import { addWindow } from "#ui/ui-theme";
import { fixedInt, rgbHexToRgba } from "#utils/common";
import { argbFromRgba } from "@material/material-color-utilities";

export interface OptionSelectConfig {
  xOffset?: number;
  yOffset?: number;
  options: OptionSelectItem[];
  maxOptions?: number;
  delay?: number;
  noCancel?: boolean;
  supportHover?: boolean;
}

export interface OptionSelectItem {
  label: string;
  handler: () => boolean;
  onHover?: () => void;
  skip?: boolean;
  keepOpen?: boolean;
  overrideSound?: boolean;
  style?: TextStyle;
  item?: string;
  itemArgs?: any[];
}

export abstract class AbstractOptionSelectUiHandler extends UiHandler {
  protected optionSelectContainer: Phaser.GameObjects.Container;
  protected optionSelectBg: Phaser.GameObjects.NineSlice;

  protected listHelper: ScrollableListHelper<OptionSelectItem> | null = null;

  protected config: OptionSelectConfig | null = null;
  protected blockInput = false;

  protected scale = 0.1666666667;
  protected defaultTextStyle: TextStyle = TextStyle.WINDOW;

  /** Selectable options derived from config.options (skipped items filtered out). */
  protected visibleOptions: OptionSelectItem[] = [];

  abstract getWindowWidth(): number;

  getWindowHeight(): number {
    return (Math.min((this.config?.options ?? []).length, this.config?.maxOptions || 99) + 1) * 96 * this.scale;
  }

  setup() {
    const ui = this.getUi();

    this.optionSelectContainer = globalScene.add.container(globalScene.scaledCanvas.width - 1, -48);
    this.optionSelectContainer.setName(`option-select-${this.mode ? UiMode[this.mode] : "UNKNOWN"}`);
    this.optionSelectContainer.setVisible(false);
    ui.add(this.optionSelectContainer);

    this.optionSelectBg = addWindow(0, 0, this.getWindowWidth(), this.getWindowHeight());
    this.optionSelectBg.setName("option-select-bg");
    this.optionSelectBg.setOrigin(1, 1);
    this.optionSelectContainer.add(this.optionSelectBg);

    this.scale = getTextStyleOptions(TextStyle.WINDOW).scale;
  }

  show(args: any[]): boolean {
    if (args.length === 0 || !Object.hasOwn(args[0], "options") || args[0].options.length === 0) {
      return false;
    }
    super.show(args);

    this.config = args[0] as OptionSelectConfig;
    this.visibleOptions = this.config.options.filter(o => !o.skip);
    if (this.visibleOptions.length === 0) {
      return false;
    }

    this.layoutWindow();
    this.rebuildList();
    this.listHelper!.setItems(this.visibleOptions);

    globalScene.ui.bringToTop(this.optionSelectContainer);
    this.optionSelectContainer.setVisible(true);

    if (this.config.delay) {
      this.blockInput = true;
      this.listHelper!.setAlpha(0.5);
      // Local mute; the manager will fire setInputEnabled(true) right after
      // show() returns, and applyInputState composes the two signals.
      this.applyInputState();
      globalScene.time.delayedCall(fixedInt(this.config.delay), () => this.unblockInput());
    }

    return true;
  }

  /** Format an option's label as BBCode using its style (or the default). */
  private formatLabel(option: OptionSelectItem): string {
    const shadow = getTextColor(option.style ?? this.defaultTextStyle, true);
    const color = getTextColor(option.style ?? TextStyle.WINDOW, false);
    const text = option.item ? `    ${option.label}` : option.label;
    return `[shadow=${shadow}][color=${color}]${text}[/color][/shadow]`;
  }

  private layoutWindow(): void {
    const optionsForWidth =
      globalScene.ui.getMode() === UiMode.AUTO_COMPLETE
        ? this.visibleOptions.slice(0, this.config?.maxOptions ?? this.visibleOptions.length)
        : this.visibleOptions;

    const measure = addBBCodeTextObject(
      0,
      0,
      optionsForWidth.map(o => this.formatLabel(o)).join("\n"),
      TextStyle.WINDOW,
      { maxLines: optionsForWidth.length, lineSpacing: 12 },
    );
    const measuredWidth = measure.displayWidth;
    measure.destroy();

    this.optionSelectBg.width = Math.max(measuredWidth + 24, this.getWindowWidth());
    this.optionSelectBg.height = this.getWindowHeight();

    this.optionSelectContainer.setPosition(
      globalScene.scaledCanvas.width - 1 - (this.config?.xOffset || 0),
      -48 + (this.config?.yOffset || 0),
    );
  }

  private rebuildList(): void {
    if (this.listHelper) {
      this.listHelper.destroy();
      this.listHelper = null;
    }

    const rowSpacing = 114 * this.scale - 3;
    const rows = Math.min(this.visibleOptions.length, this.config?.maxOptions ?? this.visibleOptions.length);
    const itemsX = this.optionSelectBg.x - this.optionSelectBg.width + 12 + 24 * this.scale;
    const itemsY = this.optionSelectBg.y - this.optionSelectBg.height + 2 + 42 * this.scale;
    const itemsWidth = this.optionSelectBg.width - 24;
    const iconScale = 3 * this.scale;

    this.listHelper = new ScrollableListHelper<OptionSelectItem>(0, 0, {
      rows,
      items: { x: itemsX, y: itemsY, rowSpacing, width: itemsWidth },
      scrollMode: "arrows",
      arrowStyle: this.defaultTextStyle,
      cursor: {
        texture: "cursor",
        width: 6,
        height: 10,
        offsetX: -42 * this.scale,
        offsetY: 18 * this.scale,
      },
      bbcode: true,
      textOptions: { maxLines: 1 },
      getLabel: option => this.formatLabel(option),
      icon: {
        texture: "items",
        x: 36 * this.scale,
        y: 7,
        scale: iconScale,
        getFrame: option => option.item ?? null,
        getTint: option =>
          option.item === "candy" && option.itemArgs ? argbFromRgba(rgbHexToRgba(option.itemArgs[0])) : null,
      },
      overlay: {
        texture: "items",
        frame: "candy_overlay",
        x: 36 * this.scale,
        y: 7,
        scale: iconScale,
        isVisible: option => option.item === "candy",
        getTint: option => (option.itemArgs ? argbFromRgba(rgbHexToRgba(option.itemArgs[1])) : null),
      },
      onItemSelected: option => this.onOptionHovered(option),
      onItemActioned: option => this.runOption(option),
    });

    this.optionSelectContainer.add(this.listHelper);
  }

  /** Fires whenever the highlighted option changes (keyboard, hover, scroll, or setItems). */
  private onOptionHovered(option: OptionSelectItem): void {
    if (this.config) {
      this.cursor = this.config.options.indexOf(option);
    }
    if (this.config?.supportHover) {
      option.onHover?.();
    }
  }

  /** Execute an option's handler and update menu state accordingly. */
  private runOption(option: OptionSelectItem): void {
    const ui = this.getUi();
    if (this.blockInput) {
      ui.playError();
      return;
    }
    if (option.handler()) {
      if (!option.keepOpen) {
        this.clear();
      }
      if (!option.overrideSound) {
        ui.playSelect();
      }
    } else {
      ui.playError();
    }
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();

    if (button === Button.ACTION) {
      if (this.blockInput) {
        ui.playError();
        return false;
      }
      return this.listHelper?.processInput(button) ?? false;
    }

    if (button === Button.SUBMIT && ui.getMode() === UiMode.AUTO_COMPLETE) {
      const wasBlocked = this.blockInput;
      this.blockInput = false;
      try {
        return this.listHelper?.processInput(Button.ACTION) ?? false;
      } finally {
        this.blockInput = wasBlocked;
      }
    }

    if (button === Button.CANCEL) {
      if (this.blockInput) {
        ui.playError();
        return false;
      }
      const scrolling = !!(this.config?.maxOptions && this.config.options.length > this.config.maxOptions);
      if (this.config?.noCancel && !scrolling) {
        return false;
      }
      const last = this.visibleOptions.at(-1);
      if (last) {
        this.runOption(last);
      }
      return true;
    }

    if (button === Button.UP || button === Button.DOWN) {
      const success = this.listHelper?.processInput(button) ?? false;
      if (success) {
        ui.playSelect();
      }
      return success;
    }

    return false;
  }

  unblockInput(): void {
    if (!this.blockInput) {
      return;
    }
    this.blockInput = false;
    this.listHelper?.setAlpha(1);
    this.applyInputState();
  }

  clear() {
    super.clear();
    this.config = null;
    this.visibleOptions = [];
    this.optionSelectContainer.setVisible(false);
    this.listHelper?.reset();
  }

  /**
   * Composes manager-driven ownership with the local `delay`-window mute. The
   * grid receives pointer input only when this handler both owns input and is
   * not currently muted.
   */
  protected override applyInputState(): void {
    this.listHelper?.setTouchEnabled(this.hasInputOwnership() && !this.blockInput);
  }
}
