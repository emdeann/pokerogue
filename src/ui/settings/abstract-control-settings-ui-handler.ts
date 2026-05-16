import { globalScene } from "#app/global-scene";
import type { Device } from "#enums/devices";
import { TextStyle } from "#enums/text-style";
import type { UiMode } from "#enums/ui-mode";
import { getIconWithSettingName } from "#inputs/config-handler";
import type { CustomInterfaceConfig, InterfaceConfig, MappingSettingName } from "#types/configs/inputs";
import type { BaseSettingsCell } from "#ui/abstract-grid-settings-ui-handler";
import { AbstractGridSettingsUiHandler } from "#ui/abstract-grid-settings-ui-handler";
import { addTextObject, getTextColor } from "#ui/text";
import { toCamelCase } from "#utils/strings";
import i18next from "i18next";

/** Discriminated union representing every kind of row a control-settings page might show. */
export type ControlRow =
  | {
      kind: "placeholder";
      label: string;
    }
  | {
      kind: "value";
      label: string;
      settingName: MappingSettingName;
      options: string[];
      selectedIndex: number;
      locked: boolean;
    }
  | {
      kind: "binding";
      label: string;
      settingName: MappingSettingName;
      padType: string;
      iconFrame: string | null;
      /**
       * The setting's option strings. Index 0 corresponds to the key-icon slot;
       * indices 1+ are the prompt text labels (e.g. "Press to bind").
       */
      options: string[];
      locked: boolean;
    };

/** Cell capable of rendering any {@linkcode ControlRow}. */
type ControlCell = BaseSettingsCell & {
  optionObjs: Phaser.GameObjects.Text[];
  iconObj: Phaser.GameObjects.Sprite;
};

export abstract class AbstractControlSettingsUiHandler extends AbstractGridSettingsUiHandler<ControlRow, ControlCell> {
  protected setting: Record<string, MappingSettingName>;
  protected settingDeviceDefaults: Record<string, number>;
  protected settingDeviceOptions: Record<string, string[]>;
  protected settingBlacklisted: string[];
  // todo type this properly
  protected configs;
  protected commonSettingsCount = 0;
  protected textureOverride: string | null = null;
  protected localStoragePropertyName: string;
  protected device: Device;

  protected maxOptionsAcrossRows = 0;

  abstract saveSettingToLocalStorage(settingName: MappingSettingName, cursor: number): void;
  abstract setSetting(settingName: MappingSettingName, value: number): boolean;

  constructor(mode: UiMode | null = null) {
    super(mode);
  }
  protected getActiveConfig(): CustomInterfaceConfig | null {
    return globalScene.inputController.getActiveConfig(this.device);
  }

  private getLocalStorageSetting(): Record<string, number> {
    return Object.hasOwn(localStorage, this.localStoragePropertyName)
      ? JSON.parse(localStorage.getItem(this.localStoragePropertyName)!)
      : {};
  }

  /** Subclass hook: row to show when no device is connected. Default: no rows. */
  protected getPlaceholderRows(): ControlRow[] {
    return [];
  }

  protected computeRowsForActiveConfig(activeConfig: InterfaceConfig | null): ControlRow[] {
    if (!activeConfig) {
      return this.getPlaceholderRows();
    }

    const config = this.configs.find(c => c.padType === activeConfig.padType) ?? this.configs[0];
    const bindingSettings = Object.keys(config.settings);
    const commonKeys = Object.keys(this.setting)
      .slice(0, this.commonSettingsCount)
      .map(k => this.setting[k]);
    const specificKeys = [...commonKeys, ...bindingSettings];
    const stored = this.getLocalStorageSetting();

    const rows: ControlRow[] = [];
    for (const key of Object.keys(this.setting)) {
      const settingName = this.setting[key];
      if (!specificKeys.includes(settingName)) {
        continue;
      }

      const i18nKey = toCamelCase(key.replace(/ALT(_| )/, ""));
      const locked = this.settingBlacklisted.includes(settingName);
      const isAlt = key.includes("ALT");
      const label = i18next.t(`settings:${i18nKey}`) + (isAlt ? i18next.t("settings:alt") : "");
      const options = this.settingDeviceOptions[settingName];

      if (bindingSettings.includes(settingName)) {
        rows.push({
          kind: "binding",
          label,
          settingName,
          padType: this.textureOverride ?? config.padType,
          iconFrame: activeConfig.custom ? (getIconWithSettingName(activeConfig, settingName) ?? null) : null,
          options,
          locked,
        });
      } else {
        const selected = stored.hasOwnProperty(settingName)
          ? stored[settingName]
          : this.settingDeviceDefaults[settingName];
        rows.push({ kind: "value", label, settingName, options, selectedIndex: selected, locked });
      }
    }
    return rows;
  }

  protected getInitialRows(): ControlRow[] {
    const rows = this.computeRowsForActiveConfig(this.getActiveConfig());
    this.maxOptionsAcrossRows = rows.reduce((m, r) => {
      if (r.kind === "value") {
        return Math.max(m, r.options.length);
      }
      if (r.kind === "binding") {
        // slot 0 is the icon; the remaining options are text labels
        return Math.max(m, Math.max(r.options.length - 1, 0));
      }
      return m;
    }, 0);
    return rows;
  }

  protected createRowCell(): ControlCell {
    const container = globalScene.add.container(0, 0) as ControlCell;

    const labelObj = addTextObject(8, 0, "", TextStyle.SETTINGS_LABEL).setOrigin(0);
    container.add(labelObj);
    container.labelObj = labelObj;

    container.iconObj = globalScene.add.sprite(0, 0, "keyboard").setOrigin(0, -0.15).setVisible(false);
    container.add(container.iconObj);

    container.optionObjs = [];
    for (let i = 0; i < Math.max(this.maxOptionsAcrossRows, 2); i++) {
      const opt = addTextObject(0, 0, "", TextStyle.WINDOW).setOrigin(0).setVisible(false);
      container.add(opt);
      container.optionObjs.push(opt);
    }
    return container;
  }

  protected renderRowCell(cell: ControlCell, row: ControlRow): void {
    if (row.kind === "placeholder") {
      cell.labelObj.setText(row.label).setColor(getTextColor(TextStyle.SETTINGS_LABEL));
      cell.iconObj.setVisible(false);
      for (const opt of cell.optionObjs) {
        opt.setVisible(false);
      }
      return;
    }

    const labelStyle = row.locked ? TextStyle.SETTINGS_LOCKED : TextStyle.SETTINGS_LABEL;
    cell.labelObj.setText(row.label).setColor(getTextColor(labelStyle)).setShadowColor(getTextColor(labelStyle, true));

    if (row.kind === "binding") {
      // Slot 0 = key icon, slots 1+ = prompt text (blank when locked), exactly
      // as the original handler laid out optionValueLabels for binding rows.
      cell.iconObj.setTexture(row.padType).setVisible(true);
      if (row.iconFrame) {
        cell.iconObj.setFrame(row.iconFrame).setAlpha(1);
      } else {
        cell.iconObj.setAlpha(0); // keeps the slot's footprint, hidden like the original
      }

      const numText = Math.max(row.options.length - 1, 0);
      for (let o = 0; o < cell.optionObjs.length; o++) {
        const opt = cell.optionObjs[o];
        if (o < numText) {
          opt
            .setText(row.locked ? "" : row.options[o + 1])
            .setVisible(true)
            .setColor(getTextColor(TextStyle.WINDOW))
            .setShadowColor(getTextColor(TextStyle.WINDOW, true));
        } else {
          opt.setVisible(false);
        }
      }

      const slots: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Text)[] = [cell.iconObj];
      for (let o = 0; o < numText; o++) {
        slots.push(cell.optionObjs[o]);
      }

      const totalWidth = slots.reduce((sum, go) => sum + go.width, 0);
      const labelWidth = Math.max(130, cell.labelObj.displayWidth + 8);
      const totalSpace = 297 - labelWidth - totalWidth / 6;
      const optionSpacing = slots.length > 1 ? Math.floor(totalSpace / (slots.length - 1)) : 0;

      let xOffset = 0;
      for (const go of slots) {
        go.setPositionRelative(cell.labelObj, labelWidth + xOffset, 0);
        xOffset += go.width / 6 + optionSpacing;
      }
      return;
    }

    // value row
    cell.iconObj.setVisible(false);

    const numOptions = row.options.length;
    for (let o = 0; o < cell.optionObjs.length; o++) {
      const opt = cell.optionObjs[o];
      if (o < numOptions) {
        const style = o === row.selectedIndex ? TextStyle.SETTINGS_SELECTED : TextStyle.WINDOW;
        opt
          .setText(row.options[o])
          .setVisible(true)
          .setColor(getTextColor(style))
          .setShadowColor(getTextColor(style, true));
      } else {
        opt.setVisible(false);
      }
    }

    const totalWidth = row.options.reduce((sum, _o, o) => sum + cell.optionObjs[o].width, 0);
    const labelWidth = Math.max(130, cell.labelObj.displayWidth + 8);
    const totalSpace = 297 - labelWidth - totalWidth / 6;
    const optionSpacing = numOptions > 1 ? Math.floor(totalSpace / (numOptions - 1)) : 0;

    let xOffset = 0;
    for (let o = 0; o < numOptions; o++) {
      cell.optionObjs[o].setPositionRelative(cell.labelObj, labelWidth + xOffset, 0);
      xOffset += cell.optionObjs[o].width / 6 + optionSpacing;
    }
  }

  protected onAction(row: ControlRow): boolean {
    if (row.kind !== "binding" || row.locked) {
      return false;
    }
    this.settingsGrid?.setTouchEnabled(false);
    return this.setSetting(row.settingName, 1);
  }

  protected onLeftRight(row: ControlRow, _index: number, dir: -1 | 1): boolean {
    if (row.kind !== "value" || row.locked) {
      return false;
    }
    const next = Phaser.Math.Wrap(row.selectedIndex + dir, 0, row.options.length);
    if (next === row.selectedIndex) {
      return false;
    }
    row.selectedIndex = next;
    this.refreshCurrentCell();
    this.saveSettingToLocalStorage(row.settingName, next);
    return true;
  }

  protected setupActionsBarExtras(): void {
    const iconReset = globalScene.add
      .sprite(0, 0, "keyboard")
      .setOrigin(0, -0.1)
      .setPositionRelative(this.actionsBg, this.cancelText.x - 28, 4);
    this.navigationIcons["BUTTON_HOME"] = iconReset;

    const resetText = addTextObject(0, 0, i18next.t("settings:reset"), TextStyle.SETTINGS_LABEL)
      .setOrigin(0, 0.15)
      .setPositionRelative(iconReset, -10, 0);

    this.settingsContainer.add([iconReset, resetText]);
  }

  /** Recompute rows from the current device state (e.g. after a binding delete / layout change). */
  updateBindings(): void {
    this.updateNavigationIcons();
    this.refreshRows();
  }
}
