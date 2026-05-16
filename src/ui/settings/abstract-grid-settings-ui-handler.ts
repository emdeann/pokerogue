import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { TextStyle } from "#enums/text-style";
import type { UiMode } from "#enums/ui-mode";
import type { MappingSettingName } from "#types/configs/inputs";
import { MessageUiHandler } from "#ui/message-ui-handler";
import { NavigationManager, NavigationMenu } from "#ui/navigation-menu";
import { ScrollableGridHelper } from "#ui/scrollable-grid-helper";
import { addTextObject } from "#ui/text";
import { addWindow } from "#ui/ui-theme";
import i18next from "i18next";

export interface InputsIcons {
  [key: string]: Phaser.GameObjects.Sprite;
}

/** Minimum shape every settings cell must satisfy. Subclasses extend this with whatever extra widgets they need. */
export type BaseSettingsCell = Phaser.GameObjects.Container & {
  labelObj: Phaser.GameObjects.Text;
};

/**
 * Shared base for grid-backed settings pages (gameplay settings, gamepad bindings, keyboard
 * bindings, etc.).
 */
export abstract class AbstractGridSettingsUiHandler<
  TRowData,
  TCell extends BaseSettingsCell = BaseSettingsCell,
> extends MessageUiHandler {
  protected settingsContainer: Phaser.GameObjects.Container;
  protected optionsBg: Phaser.GameObjects.NineSlice;
  protected actionsBg: Phaser.GameObjects.NineSlice;
  protected navigationContainer: NavigationMenu;
  protected navigationIcons: InputsIcons;
  protected messageBoxContainer: Phaser.GameObjects.Container;
  protected actionText: Phaser.GameObjects.Text;
  protected cancelText: Phaser.GameObjects.Text;

  protected settingsGrid: ScrollableGridHelper<TCell, TRowData> | null = null;

  /** The data currently shown in the grid. */
  protected rows: TRowData[] = [];

  /** Highlighted row's data / cell / absolute index set with the grid's `onItemSelected`. */
  protected currentRowData: TRowData | null = null;
  protected currentCell: TCell | null = null;
  protected currentRowIndex = 0;

  protected rowsToDisplay = 8;
  /** Page name used for container/messagebox naming and any logging. Subclasses set this in their constructor. */
  protected title = "settings";

  constructor(mode: UiMode | null = null) {
    super(mode);
  }

  /** Build a fresh, empty cell. Called {@linkcode rowsToDisplay} times by the grid. */
  protected abstract createRowCell(): TCell;

  /** Render `data` into `cell`. Called by the grid on display, scroll, and explicit refresh. */
  protected abstract renderRowCell(cell: TCell, data: TRowData): void;

  /** Return the dataset to show on (re-)entry. */
  protected abstract getInitialRows(): TRowData[];

  /** Called when action is pressed on the highlighted row. Return `true` if the input was consumed. */
  protected onAction(_data: TRowData, _index: number): boolean {
    return false;
  }

  /** Called on left/right for the highlighted row. Return `true` if the input was consumed. */
  protected onLeftRight(_data: TRowData, _index: number, _dir: -1 | 1): boolean {
    return false;
  }

  /** Add any subclass-specific widgets to the actions bar, positioned relative to `this.actionsBg` /
   *  `this.cancelText` (which sits immediately left of the action icon). */
  protected setupActionsBarExtras(): void {}

  /** Final step of `setup()`, after all chrome is added to `settingsContainer`. */
  protected onSetup(): void {}

  /** Called from `show()` just before the container is made visible. */
  protected onShow(): void {}

  /** Called from `clear()` just after the container is hidden. */
  protected onClear(): void {}

  public override setup() {
    const ui = this.getUi();
    const canvasWidth = globalScene.scaledCanvas.width;
    const canvasHeight = globalScene.scaledCanvas.height;

    this.settingsContainer = globalScene.add
      .container(1, -canvasHeight + 1)
      .setName(`settings-${this.title}`)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, canvasWidth, canvasHeight - 20), Phaser.Geom.Rectangle.Contains);

    this.navigationIcons = {};
    this.navigationContainer = new NavigationMenu(0, 0);
    const navWidth = this.navigationContainer.width;
    const navHeight = this.navigationContainer.height;

    this.optionsBg = addWindow(0, navHeight, canvasWidth - 2, canvasHeight - 16 - navHeight - 2)
      .setName("window-options-bg")
      .setOrigin(0);

    this.actionsBg = addWindow(0, canvasHeight - navHeight, canvasWidth - 2, 22).setOrigin(0);

    const iconAction = globalScene.add
      .sprite(0, 0, "keyboard")
      .setOrigin(0, -0.1)
      .setPositionRelative(this.actionsBg, navWidth - 32, 4);
    this.navigationIcons["BUTTON_ACTION"] = iconAction;

    this.actionText = addTextObject(0, 0, i18next.t("settings:action"), TextStyle.SETTINGS_LABEL).setOrigin(0, 0.15);
    this.actionText.setPositionRelative(iconAction, -this.actionText.width / 6 - 2, 0);

    const iconCancel = globalScene.add
      .sprite(0, 0, "keyboard")
      .setOrigin(0, -0.1)
      .setPositionRelative(this.actionsBg, this.actionText.x - 28, 4);
    this.navigationIcons["BUTTON_CANCEL"] = iconCancel;

    this.cancelText = addTextObject(0, 0, i18next.t("settings:back"), TextStyle.SETTINGS_LABEL).setOrigin(0, 0.15);
    this.cancelText.setPositionRelative(iconCancel, -this.cancelText.width / 6 - 2, 0);
    this.setupActionsBarExtras();

    const initialRows = this.getInitialRows();
    this.rows = initialRows;
    const needsScroll = initialRows.length > this.rowsToDisplay;
    const cursorWidth = canvasWidth - (needsScroll ? 16 : 10);

    this.settingsGrid = new ScrollableGridHelper<TCell, TRowData>(0, 0, {
      rows: this.rowsToDisplay,
      columns: 1,
      scrollMode: "scrollbar",
      scrollBar: {
        x: this.optionsBg.width - 9,
        y: this.optionsBg.y + 5,
        width: 4,
        height: this.optionsBg.height - 11,
      },
      cells: {
        x: 0,
        y: 28,
        spacingX: cursorWidth,
        spacingY: 16,
        createCell: () => this.createRowCell(),
        renderCell: (cell, data) => this.renderRowCell(cell, data),
      },
      cursor: {
        texture: "summary_moves_cursor",
        width: cursorWidth,
        height: 16,
        offsetX: 4,
        offsetY: navHeight - 24,
      },
      onItemSelected: (cell, data) => {
        this.currentCell = cell;
        this.currentRowData = data;
        this.currentRowIndex = this.rows.indexOf(data);
        this.cursor = this.currentRowIndex;
      },
      onItemActioned: (_cell, data) => {
        if (this.onAction(data, this.currentRowIndex)) {
          this.getUi().playSelect();
        }
      },
    });

    this.messageBoxContainer = globalScene.add
      .container(0, canvasHeight)
      .setName(`settings-${this.title}-message-box`)
      .setVisible(false);
    const messageBox = addWindow(0, -1, canvasWidth - 2, 48).setOrigin(0, 1);
    this.messageBoxContainer.add(messageBox);
    const messageText = addTextObject(8, -40, "", TextStyle.WINDOW, { maxLines: 2 })
      .setWordWrapWidth(globalScene.game.canvas.width - 60)
      .setOrigin(0);
    this.messageBoxContainer.add(messageText);
    this.message = messageText;

    this.settingsContainer.add([
      this.optionsBg,
      this.settingsGrid,
      this.navigationContainer,
      this.actionsBg,
      iconAction,
      iconCancel,
      this.actionText,
      this.cancelText,
      this.messageBoxContainer,
    ]);

    ui.add(this.settingsContainer);
    this.settingsContainer.setVisible(false);

    this.onSetup();
  }

  public override show(args: any[]): boolean {
    super.show(args);
    this.updateNavigationIcons();

    this.currentCell = null;
    this.currentRowData = null;
    this.currentRowIndex = 0;

    this.refreshRows();

    this.onShow();

    this.settingsContainer.setVisible(true);
    const ui = this.getUi();
    ui.moveTo(this.settingsContainer, ui.length - 1);
    ui.hideTooltip();
    return true;
  }

  /** Re-fetch rows and hand them to the grid. Resets cursor/scroll to row 0. */
  protected refreshRows(): void {
    this.rows = this.getInitialRows();
    this.settingsGrid?.setItems(this.rows);
  }

  /** Re-render the currently highlighted row's cell in place, without modifying cursor/scroll. */
  protected refreshCurrentCell(): void {
    if (this.currentCell && this.currentRowData != null) {
      this.renderRowCell(this.currentCell, this.currentRowData);
    }
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();
    let success = false;

    if (button === Button.CANCEL) {
      success = true;
      NavigationManager.getInstance().reset();
      globalScene.ui.revertMode();
    } else {
      switch (button) {
        case Button.UP:
        case Button.DOWN:
          success = this.settingsGrid?.processInput(button) ?? false;
          break;
        case Button.LEFT:
          if (this.currentRowData != null) {
            success = this.onLeftRight(this.currentRowData, this.currentRowIndex, -1);
          }
          break;
        case Button.RIGHT:
          if (this.currentRowData != null) {
            success = this.onLeftRight(this.currentRowData, this.currentRowIndex, 1);
          }
          break;
        case Button.CYCLE_FORM:
        case Button.CYCLE_SHINY:
          success = this.navigationContainer.navigate(button);
          break;
        case Button.ACTION:
          if (this.currentRowData != null) {
            success = this.onAction(this.currentRowData, this.currentRowIndex);
          }
          break;
      }
    }

    if (success) {
      ui.playSelect();
    }
    return success;
  }

  /**
   * Refresh the input-icon textures shown in the actions bar. Subclasses may extend (e.g. to also
   * recompute row data after a binding change) but should always call `super`.
   */
  protected updateNavigationIcons(): void {
    const specialIcons: Record<string, string> = {
      BUTTON_HOME: "HOME.png",
      BUTTON_DELETE: "DEL.png",
    };
    for (const name of Object.keys(this.navigationIcons)) {
      if (specialIcons[name]) {
        this.navigationIcons[name].setTexture("keyboard").setFrame(specialIcons[name]).alpha = 1;
        continue;
      }
      const inputController = globalScene.inputController;
      const icon = inputController?.getIconForLatestInputRecorded(name as MappingSettingName);
      const type = inputController?.getLastSourceType();
      if (icon && type != null) {
        this.navigationIcons[name].setTexture(type).setFrame(icon).setAlpha(1);
      } else {
        this.navigationIcons[name].alpha = 0;
      }
    }
    NavigationManager.getInstance().updateIcons();
  }

  clear(): void {
    super.clear();
    this.settingsContainer.setVisible(false);
    this.settingsGrid?.reset();
    this.currentCell = null;
    this.currentRowData = null;
    this.onClear();
  }

  override showText(
    text: string,
    delay?: number,
    callback?: () => void,
    callbackDelay?: number,
    prompt?: boolean,
    promptDelay?: number,
  ) {
    this.messageBoxContainer.setVisible(text?.length > 0);
    super.showText(text, delay, callback, callbackDelay, prompt, promptDelay);
  }

  /** Settings handlers have no handler-local mute; ownership alone gates touch. */
  protected override applyInputState(): void {
    this.settingsGrid?.setTouchEnabled(this.hasInputOwnership());
  }
}
