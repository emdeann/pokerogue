import { pokerogueApi } from "#api/api";
import { loggedInUser } from "#app/account";
import { globalScene } from "#app/global-scene";
import { UiMode } from "#enums/ui-mode";
import type { InputFieldConfig } from "#ui/form-modal-ui-handler";
import { FormModalUiHandler } from "#ui/form-modal-ui-handler";
import type { ModalConfig } from "#ui/modal-ui-handler";
import i18next from "i18next";

export class ChangeUsernameFormUiHandler extends FormModalUiHandler {
  public override getModalTitle(): string {
    return i18next.t("menu:changeUsername");
  }

  public override getWidth(): number {
    return 160;
  }

  public override getMargin(): [number, number, number, number] {
    return [0, 0, 48, 0];
  }

  public override getButtonLabels(): string[] {
    return [i18next.t("menu:confirm"), i18next.t("menu:cancel")];
  }

  public override getInputFieldConfigs(): InputFieldConfig[] {
    return [{ label: i18next.t("menu:newUsername") }];
  }

  public override getReadableErrorMessage(error: string): string {
    const colonIndex = error?.indexOf(":");
    if (colonIndex > 0) {
      error = error.slice(0, colonIndex);
    }

    switch (error) {
      case "invalid username":
        return i18next.t("menu:invalidRegisterUsername");
      case "failed to change username":
      case "username already taken":
        return i18next.t("menu:usernameAlreadyUsed");
    }

    return super.getReadableErrorMessage(error);
  }

  public override show(args: [ModalConfig, ...any[]]): boolean {
    if (!super.show(args)) {
      return false;
    }

    const config = args[0];
    const originalSubmitAction = this.submitAction;

    this.submitAction = () => {
      globalScene.ui.setMode(UiMode.LOADING, { buttonActions: [] });

      const onFail = (error: string | null) => {
        globalScene.ui.setMode(UiMode.CHANGE_USERNAME_FORM, Object.assign(config, { errorMessage: error?.trim() }));
        globalScene.ui.playError();
      };

      const newUsername = this.inputs[0].text?.trim();
      if (!newUsername) {
        return onFail(this.getReadableErrorMessage("invalid username"));
      }
      if (newUsername === loggedInUser?.username) {
        return originalSubmitAction?.();
      }

      pokerogueApi.account.changeUsername({ username: newUsername }).then(error => {
        if (error) {
          return onFail(error);
        }

        this.migrateLocalStorageUsername(loggedInUser?.username, newUsername);
        if (loggedInUser) {
          loggedInUser.username = newUsername;
        }

        globalScene.ui.revertMode();
        originalSubmitAction?.();
      });
    };

    return true;
  }

  /**
   * Migrate localStorage entries belonging to the renamed user.
   *
   * @remarks
   * Assumes localStorage keys are formatted <key>_<user> such that <key> itself does not contain an underscore.
   */
  private migrateLocalStorageUsername(oldUsername: string | undefined, newUsername: string): void {
    if (!oldUsername || oldUsername === newUsername) {
      return;
    }

    const oldSuffix = `_${oldUsername}`;
    const newSuffix = `_${newUsername}`;

    const keys = Object.keys(localStorage);

    for (const oldKey of keys) {
      if (!oldKey.endsWith(oldSuffix)) {
        continue;
      }

      const newKey = oldKey.slice(0, -oldSuffix.length) + newSuffix;

      const data = localStorage.getItem(oldKey);
      if (data === null) {
        continue;
      }

      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, data);
      }
      localStorage.removeItem(oldKey);
    }
  }
}
