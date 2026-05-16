import { globalScene } from "#app/global-scene";
import { Device } from "#enums/devices";
import { TextStyle } from "#enums/text-style";
import { UiMode } from "#enums/ui-mode";
import { CFG_KEYBOARD_QWERTY } from "#inputs/cfg-keyboard-qwerty";
import { deleteBind } from "#inputs/config-handler";
import {
  SettingKeyboard,
  setSettingKeyboard,
  settingKeyboardBlackList,
  settingKeyboardDefaults,
  settingKeyboardOptions,
} from "#system/settings-keyboard";
import type { ControlRow } from "#ui/abstract-control-settings-ui-handler";
import { AbstractControlSettingsUiHandler } from "#ui/abstract-control-settings-ui-handler";
import { NavigationManager } from "#ui/navigation-menu";
import { addTextObject } from "#ui/text";
import i18next from "i18next";

export class SettingsKeyboardUiHandler extends AbstractControlSettingsUiHandler {
  setSetting = setSettingKeyboard;

  constructor(mode: UiMode | null = null) {
    super(mode);
    this.title = "Keyboard";
    this.setting = SettingKeyboard;
    this.settingDeviceDefaults = settingKeyboardDefaults;
    this.settingDeviceOptions = settingKeyboardOptions;
    this.configs = [CFG_KEYBOARD_QWERTY];
    this.commonSettingsCount = 0;
    this.textureOverride = "keyboard";
    this.localStoragePropertyName = "settingsKeyboard";
    this.settingBlacklisted = settingKeyboardBlackList;
    this.device = Device.KEYBOARD;

    globalScene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE)?.on("up", this.onDeleteDown, this);
    globalScene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.HOME)?.on("up", this.onHomeDown, this);
  }

  protected override setupActionsBarExtras(): void {
    super.setupActionsBarExtras();

    const iconDelete = globalScene.add
      .sprite(0, 0, "keyboard")
      .setOrigin(0, -0.1)
      .setPositionRelative(this.actionsBg, this.navigationContainer.width - 260, 4);
    this.navigationIcons["BUTTON_DELETE"] = iconDelete;

    const deleteText = addTextObject(0, 0, i18next.t("settings:delete"), TextStyle.SETTINGS_LABEL)
      .setOrigin(0, 0.15)
      .setPositionRelative(iconDelete, -10, 0);

    this.settingsContainer.add([iconDelete, deleteText]);
  }

  protected override getPlaceholderRows(): ControlRow[] {
    return [{ kind: "placeholder", label: i18next.t("settings:keyboardPleasePress") }];
  }

  saveSettingToLocalStorage(settingName, cursor): void {
    if (this.setting[settingName] !== this.setting.Default_Layout) {
      globalScene.gameData.saveControlSetting(
        this.device,
        this.localStoragePropertyName,
        settingName,
        this.settingDeviceDefaults,
        cursor,
      );
    }
  }

  private saveCustomKeyboardMappingToLocalStorage(config): void {
    globalScene.gameData.saveMappingConfigs(globalScene.inputController?.selectedDevice[Device.KEYBOARD], config);
  }

  private onHomeDown(): void {
    if (![UiMode.SETTINGS_KEYBOARD, UiMode.SETTINGS_GAMEPAD].includes(globalScene.ui.getMode())) {
      return;
    }
    globalScene.gameData.resetMappingToFactory();
    NavigationManager.getInstance().updateIcons();
    this.updateBindings();
  }

  private onDeleteDown(): void {
    if (globalScene.ui.getMode() !== UiMode.SETTINGS_KEYBOARD) {
      return;
    }
    if (this.currentRowData?.kind !== "binding") {
      return;
    }
    const activeConfig = this.getActiveConfig();
    if (!activeConfig) {
      return;
    }
    if (deleteBind(activeConfig, this.currentRowData.settingName)) {
      this.saveCustomKeyboardMappingToLocalStorage(activeConfig);
      this.updateBindings();
      NavigationManager.getInstance().updateIcons();
    }
  }
}
