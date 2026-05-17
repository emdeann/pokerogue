import { globalScene } from "#app/global-scene";
import { getPokeballName } from "#data/pokeball";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import type { PokeballType } from "#enums/pokeball";
import { TextStyle } from "#enums/text-style";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { ScrollableListHelper } from "#ui/scrollable-list-helper";
import { addTextObject, getTextStyleOptions } from "#ui/text";
import { UiHandler } from "#ui/ui-handler";
import { addWindow } from "#ui/ui-theme";
import i18next from "i18next";

export class BallUiHandler extends UiHandler {
  private pokeballSelectBg: Phaser.GameObjects.NineSlice;
  private countsText: Phaser.GameObjects.Text;
  private listHelper: ScrollableListHelper<PokeballType>;

  private cursorObj: Phaser.GameObjects.Image | null;

  private scale = 0.1666666667;

  constructor() {
    super(UiMode.BALL);
  }

  setup() {
    const ui = this.getUi();

    this.scale = getTextStyleOptions(TextStyle.WINDOW).scale;
    const pbs = Array.from(Object.keys(globalScene.pokeballCounts)).map(s => Number.parseInt(s));

    this.listHelper = new ScrollableListHelper(globalScene.scaledCanvas.width - 115, -672 * this.scale - 49, {
      rows: pbs.length,
      items: {
        y: 9,
        width: 96,
        height: 72 * this.scale + 4,
      },
      cursor: {
        texture: "cursor",
        width: 6,
        height: 10,
        offsetX: 9,
        offsetY: 2,
      },
      cancelText: i18next.t("commandUiHandler:ballCancel"),
      textOptions: { lineSpacing: this.scale * 72 },
      getLabel: pb => getPokeballName(pb),
      textAlign: "right",
      onItemActioned: pb => this.onPokeballAction(pb),
      onCancel: () => this.onCancel(),
    });
    this.listHelper.setItems([...pbs]);
    this.listHelper.setVisible(false);

    this.pokeballSelectBg = addWindow(0, 0, 114, 672 * this.scale);
    this.pokeballSelectBg.setOrigin(0, 0);
    this.listHelper.add(this.pokeballSelectBg);
    this.listHelper.sendToBack(this.pokeballSelectBg);
    this.countsText = addTextObject(0, 0, "", TextStyle.WINDOW, {
      maxLines: 5,
    });
    this.countsText.setPositionRelative(this.pokeballSelectBg, 18, 9);
    this.countsText.setLineSpacing(this.scale * 72);
    this.listHelper.add(this.countsText);
    ui.add(this.listHelper);

    this.setCursor(0);
  }

  show(args: any[]): boolean {
    super.show(args);

    this.updateCounts();
    this.listHelper.setVisible(true);
    this.setCursor(this.cursor);

    return true;
  }

  private onCancel(): void {
    this.getUi().setMode(UiMode.COMMAND, (globalScene.phaseManager.getCurrentPhase() as CommandPhase).getFieldIndex());
  }

  private onPokeballAction(pb: PokeballType): boolean {
    if (globalScene.pokeballCounts[pb] <= 0) {
      this.getUi().playError();
      return false;
    }

    const commandPhase = globalScene.phaseManager.getCurrentPhase() as CommandPhase;
    if (commandPhase.handleCommand(Command.BALL, this.cursor)) {
      globalScene.ui.setMode(UiMode.COMMAND, commandPhase.getFieldIndex());
      globalScene.ui.setMode(UiMode.MESSAGE);
      return true;
    }

    return false;
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();
    let success = false;

    switch (button) {
      case Button.CANCEL:
        this.onCancel();
        success = true;
        break;
      case Button.ACTION:
      case Button.UP:
      case Button.DOWN:
        success = this.listHelper.processInput(button);
    }

    if (success) {
      ui.playSelect();
    }

    return success;
  }

  updateCounts() {
    this.countsText.setText(
      Object.values(globalScene.pokeballCounts)
        .map(c => `×${c}`)
        .join("\n"),
    );
  }

  clear() {
    super.clear();
    this.listHelper.setVisible(false);
    this.eraseCursor();
  }

  eraseCursor() {
    if (this.cursorObj) {
      this.cursorObj.destroy();
    }
    this.cursorObj = null;
  }
}
