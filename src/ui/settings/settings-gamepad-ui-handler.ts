import { globalScene } from "#app/global-scene";
import { Device } from "#enums/devices";
import type { UiMode } from "#enums/ui-mode";
import { PAD_DUALSHOCK } from "#inputs/pad-dualshock";
import { PAD_UNLICENSED_SNES } from "#inputs/pad-unlicensed-snes";
import { PAD_XBOX360 } from "#inputs/pad-xbox360";
import {
  SettingGamepad,
  setSettingGamepad,
  settingGamepadBlackList,
  settingGamepadDefaults,
  settingGamepadOptions,
} from "#system/settings-gamepad";
import type { InterfaceConfig } from "#types/configs/inputs";
import type { ControlRow } from "#ui/abstract-control-settings-ui-handler";
import { AbstractControlSettingsUiHandler } from "#ui/abstract-control-settings-ui-handler";
import { truncateString } from "#utils/common";
import i18next from "i18next";

/** Class representing the settings UI handler for gamepads. */
export class SettingsGamepadUiHandler extends AbstractControlSettingsUiHandler {
  setSetting = setSettingGamepad;

  constructor(mode: UiMode | null = null) {
    super(mode);
    this.title = "Gamepad";
    this.setting = SettingGamepad;
    this.settingDeviceDefaults = settingGamepadDefaults;
    this.settingDeviceOptions = settingGamepadOptions;
    this.configs = [PAD_XBOX360, PAD_DUALSHOCK, PAD_UNLICENSED_SNES];
    this.commonSettingsCount = 2;
    this.localStoragePropertyName = "settingsGamepad";
    this.settingBlacklisted = settingGamepadBlackList;
    this.device = Device.GAMEPAD;
  }

  /** Row shown when no gamepad is connected. */
  protected override getPlaceholderRows(): ControlRow[] {
    return [{ kind: "placeholder", label: i18next.t("settings:gamepadPleasePlug") }];
  }

  /**
   * Build the rows for the active pad, then substitute the connected device's
   * name into the "Controller" row's first option label.
   */
  protected override computeRowsForActiveConfig(activeConfig: InterfaceConfig | null): ControlRow[] {
    const rows = super.computeRowsForActiveConfig(activeConfig);

    const deviceName = globalScene.inputController.selectedDevice[Device.GAMEPAD];
    if (deviceName) {
      for (const row of rows) {
        if (row.kind === "value" && row.settingName === this.setting.Controller) {
          const options = row.options.slice();
          options[0] = truncateString(deviceName, 20);
          row.options = options;
        }
      }
    }

    return rows;
  }

  /**
   * Save the setting to local storage. The "Controller" pseudo-setting only
   * reflects the connected device and is never persisted.
   */
  saveSettingToLocalStorage(settingName, cursor): void {
    if (this.setting[settingName] !== this.setting.Controller) {
      globalScene.gameData.saveControlSetting(
        this.device,
        this.localStoragePropertyName,
        settingName,
        this.settingDeviceDefaults,
        cursor,
      );
    }
  }
}
