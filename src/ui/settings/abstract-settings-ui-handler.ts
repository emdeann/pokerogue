import { globalScene } from "#app/global-scene";
import { TextStyle } from "#enums/text-style";
import { UiMode } from "#enums/ui-mode";
import type { SettingType } from "#system/settings";
import { Setting, SettingKeys } from "#system/settings";
import type { BaseSettingsCell } from "#ui/abstract-grid-settings-ui-handler";
import { AbstractGridSettingsUiHandler } from "#ui/abstract-grid-settings-ui-handler";
import { addTextObject, getTextColor } from "#ui/text";
import type { TitleUiHandler } from "#ui/title-ui-handler";
import i18next from "i18next";

/** Settings row cell: a label and a fixed-size pool of value labels. */
type SettingCell = BaseSettingsCell & {
  optionObjs: Phaser.GameObjects.Text[];
};

export class AbstractSettingsUiHandler extends AbstractGridSettingsUiHandler<Setting, SettingCell> {
  protected settings: Setting[];
  protected localStorageKey: string;
  private readonly optionCursors: number[] = [];
  private readonly maxOptionsCount: number;
  private reloadRequired = false;

  constructor(type: SettingType, mode: UiMode | null = null) {
    super(mode);
    this.settings = Setting.filter(s => s.type === type && !s?.isHidden?.());
    this.maxOptionsCount = this.settings.reduce((m, s) => Math.max(m, s.options.length), 0);
    this.optionCursors = this.settings.map(s => s.default);
  }

  protected getInitialRows(): Setting[] {
    const stored: object = Object.hasOwn(localStorage, this.localStorageKey)
      ? JSON.parse(localStorage.getItem(this.localStorageKey)!)
      : {};
    this.settings.forEach((setting, s) => {
      this.optionCursors[s] = Object.hasOwn(stored, setting.key) ? stored[setting.key] : setting.default;
    });
    return this.settings;
  }

  /**
   * Create a single cell container
   * @returns The created cell
   */
  protected createRowCell(): SettingCell {
    const container = globalScene.add.container(0, 0) as SettingCell;
    const labelObj = addTextObject(8, 0, "", TextStyle.SETTINGS_LABEL).setOrigin(0);
    container.add(labelObj);
    container.labelObj = labelObj;
    container.optionObjs = [];
    for (let i = 0; i < this.maxOptionsCount; i++) {
      const opt = addTextObject(0, 0, "", TextStyle.SETTINGS_VALUE).setOrigin(0).setVisible(false);
      container.add(opt);
      container.optionObjs.push(opt);
    }
    return container;
  }

  /**
   * Render the given cell and setting
   * @param cell - The cell to render
   * @param setting - The setting in the cell
   */
  protected renderRowCell(cell: SettingCell, setting: Setting): void {
    const index = this.settings.indexOf(setting);
    const selected = this.optionCursors[index];

    cell.labelObj.setText(setting.label + (setting?.requireReload ? "*" : ""));

    const numOptions = setting.options.length;
    for (let o = 0; o < cell.optionObjs.length; o++) {
      const optionObj = cell.optionObjs[o];
      if (o < numOptions) {
        const style = o === selected ? TextStyle.SETTINGS_SELECTED : TextStyle.SETTINGS_VALUE;
        optionObj
          .setText(setting.options[o].label)
          .setVisible(true)
          .setColor(getTextColor(style))
          .setShadowColor(getTextColor(style, true));
      } else {
        optionObj.setVisible(false);
      }
    }

    const totalWidth = setting.options.reduce((sum, _opt, o) => sum + cell.optionObjs[o].width, 0);
    const labelWidth = Math.max(78, cell.labelObj.displayWidth + 8);
    const totalSpace = 297 - labelWidth - totalWidth / 6;
    const optionSpacing = Math.floor(totalSpace / (numOptions - 1));

    let xOffset = 0;
    for (let o = 0; o < numOptions; o++) {
      cell.optionObjs[o].setPositionRelative(cell.labelObj, labelWidth + xOffset, 0);
      xOffset += cell.optionObjs[o].width / 6 + optionSpacing;
    }
  }

  protected onSetup(): void {
    if (this.settings.some(s => s.requireReload)) {
      const text = addTextObject(0, 0, `*${i18next.t("settings:requireReload")}`, TextStyle.SETTINGS_LABEL)
        .setOrigin(0, 0.15)
        .setPositionRelative(this.actionsBg, 6, 0)
        .setY(this.actionText.y);
      this.settingsContainer.add(text);
    }
  }

  protected onLeftRight(setting: Setting, index: number, dir: -1 | 1): boolean {
    let bound = setting.options.length;
    let f: typeof Phaser.Math.Wrap = Phaser.Math.Wrap;
    if (setting?.clamp) {
      f = Phaser.Math.Clamp;
      bound -= 1; // clamp is right-inclusive; wrap isn't
    }
    return this.setOptionCursor(index, f(this.optionCursors[index] + dir, 0, bound), true);
  }

  protected onAction(setting: Setting): boolean {
    return setting?.activatable ? this.activateSetting(setting) : false;
  }

  activateSetting(setting: Setting): boolean {
    switch (setting.key) {
      case SettingKeys.Move_Touch_Controls:
        globalScene.inputController.moveTouchControlsHandler.enableConfigurationMode(this.getUi());
        return true;
    }
    return false;
  }

  setOptionCursor(settingIndex: number, cursor: number, save?: boolean): boolean {
    if (settingIndex === -1) {
      settingIndex = this.currentRowIndex;
    }
    const setting = this.settings[settingIndex];
    const lastCursor = this.optionCursors[settingIndex];
    if (cursor === lastCursor) {
      return false;
    }

    this.optionCursors[settingIndex] = cursor;
    if (settingIndex === this.currentRowIndex) {
      this.refreshCurrentCell();
    }

    if (save) {
      const saveSetting = () => {
        globalScene.gameData.saveSetting(setting.key, cursor);
        if (setting.requireReload) {
          this.reloadRequired = true;
        }
      };
      if (setting.options[cursor].needConfirmation) {
        const confirmUpdateSetting = () => {
          globalScene.ui.revertMode();
          this.showText("");
          saveSetting();
        };
        const cancelUpdateSetting = () => {
          globalScene.ui.revertMode();
          this.showText("");
          this.setOptionCursor(settingIndex, lastCursor, false);
        };
        const confirmationMessage =
          setting.options[cursor].confirmationMessage ?? i18next.t("settings:defaultConfirmMessage");
        globalScene.ui.showText(confirmationMessage, null, () => {
          globalScene.ui.setOverlayMode(UiMode.CONFIRM, confirmUpdateSetting, cancelUpdateSetting, null, null, 1, 750);
        });
      } else {
        saveSetting();
      }
    }
    return true;
  }

  public override clear() {
    super.clear();
    this.getUi().bgmBar.toggleBgmBar(globalScene.showBgmBar);
    (this.getUi().handlers[UiMode.TITLE] as TitleUiHandler)?.updateUsername();
    if (this.reloadRequired) {
      this.reloadRequired = false;
      globalScene.reset(true, false, true);
    }
  }
}
