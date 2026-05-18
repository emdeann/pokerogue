import { MAX_TERAS_PER_ARENA } from "#app/constants";
import { globalScene } from "#app/global-scene";
import { getTypeRgb } from "#data/type";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import { PokemonType } from "#enums/pokemon-type";
import { TextStyle } from "#enums/text-style";
import { UiMode } from "#enums/ui-mode";
import type { CommandPhase } from "#phases/command-phase";
import { PartyUiHandler, PartyUiMode } from "#ui/party-ui-handler";
import { ScrollableGridHelper } from "#ui/scrollable-grid-helper";
import { addTextObject } from "#ui/text";
import { UiHandler } from "#ui/ui-handler";
import { canTerastallize } from "#utils/pokemon-utils";
import i18next from "i18next";

interface DisplayCommand {
  command: Command;
  name: string;
}

export class CommandUiHandler extends UiHandler {
  private gridHelper: ScrollableGridHelper<Phaser.GameObjects.Container, DisplayCommand>;
  private teraSelected = false;
  private teraButton: Phaser.GameObjects.Sprite;

  protected fieldIndex = 0;
  protected cursor2 = 0;

  constructor() {
    super(UiMode.COMMAND);
    this.setupTeraButton();
  }

  public override setup() {
    this.gridHelper = new ScrollableGridHelper(217, -38.7, {
      rows: 2,
      columns: 2,
      scrollMode: "none",
      cells: {
        x: 0,
        y: 0,
        spacingX: 56,
        spacingY: 16,
        createCell: () => globalScene.add.container(0, 0),
        renderCell: (container, displayCommand) => {
          if (displayCommand.command === Command.TERA) {
            container.add(this.teraButton);
            return;
          }
          const commandText = addTextObject(0, 0, displayCommand.name, TextStyle.WINDOW_BATTLE_COMMAND);
          container.add(commandText);
        },
      },
      cursor: {
        texture: "cursor",
        width: 6,
        height: 10,
        offsetX: -8,
        offsetY: 3,
      },
      onItemActioned: (_container, displayCommand) => this.onActionInput(displayCommand.command),
      onItemSelected: () => {
        if (this.teraButton.visible) {
          this.setTeraButtonEnabled(false);
        }
      },
      onExitLeft: () => {
        if (this.teraButton.visible) {
          this.setTeraButtonEnabled(true);
        }
      },
      wrap: false,
    });
    this.gridHelper.add(this.teraButton);
    this.getUi().add(this.gridHelper);
  }

  private setupTeraButton(): void {
    this.teraButton = globalScene.add
      .sprite(-32, 15, "button_tera")
      .setName("terastallize-button")
      .setScale(1.3)
      .setFrame("fire")
      .setPipeline(globalScene.spritePipeline, {
        tone: [0.0, 0.0, 0.0, 0.0],
        ignoreTimeTint: true,
        teraColor: getTypeRgb(PokemonType.FIRE),
        isTerastallized: false,
      })
      .setVisible(false)
      .setInteractive();

    this.teraButton.on("pointerover", () => {
      if (!this.hasInputOwnership()) {
        return;
      }
      this.setTeraButtonEnabled(true);
    });

    this.teraButton.on("pointerout", () => {
      if (!this.hasInputOwnership()) {
        return;
      }
      this.setTeraButtonEnabled(false);
    });

    this.teraButton.on("pointerup", () => {
      if (!this.hasInputOwnership()) {
        return;
      }
      this.onActionInput(Command.TERA);
    });
  }

  show(args: any[]): boolean {
    super.show(args);

    const commands: DisplayCommand[] = [
      { command: Command.FIGHT, name: i18next.t("commandUiHandler:fight") },
      { command: Command.BALL, name: i18next.t("commandUiHandler:ball") },
      { command: Command.POKEMON, name: i18next.t("commandUiHandler:pokemon") },
      { command: Command.RUN, name: i18next.t("commandUiHandler:run") },
    ];

    this.gridHelper.setItems(commands, false);
    this.getUi().bringToTop(this.gridHelper);
    this.fieldIndex = args.length > 0 ? (args[0] as number) : 0;

    this.gridHelper.setVisible(true);
    this.teraSelected = false;
    if (this.canTera()) {
      this.teraButton.setVisible(true);
      this.teraButton.setFrame(PokemonType[globalScene.getField()[this.fieldIndex].getTeraType()].toLowerCase());
      this.setTeraButtonEnabled(false);
    } else {
      this.teraButton.setVisible(false);
    }

    let commandPhase: CommandPhase;
    const currentPhase = globalScene.phaseManager.getCurrentPhase();
    if (currentPhase.is("CommandPhase")) {
      commandPhase = currentPhase;
    } else {
      commandPhase = globalScene.phaseManager.getStandbyPhase() as CommandPhase;
    }

    const pokemonName = commandPhase.getPokemon().getNameToRender({ prependFormName: false });
    const messageHandler = this.getUi().getMessageHandler();
    messageHandler.bg.setVisible(true);
    messageHandler.commandWindow.setVisible(true);
    messageHandler.movesWindowContainer.setVisible(false);
    messageHandler.message.setWordWrapWidth(this.canTera() ? 910 : 1110);
    messageHandler.showText(i18next.t("commandUiHandler:actionMessage", { pokemonName }), 0);
    return true;
  }

  private onActionInput(command: Command): void {
    const ui = this.getUi();
    switch (command) {
      case Command.FIGHT:
        ui.setMode(UiMode.FIGHT, (globalScene.phaseManager.getCurrentPhase() as CommandPhase).getFieldIndex());
        break;
      case Command.BALL:
        ui.setModeWithoutClear(UiMode.BALL);
        break;
      case Command.POKEMON:
        ui.setMode(
          UiMode.PARTY,
          PartyUiMode.SWITCH,
          (globalScene.phaseManager.getCurrentPhase() as CommandPhase).getPokemon().getFieldIndex(),
          null,
          PartyUiHandler.FilterNonFainted,
        );
        break;
      case Command.RUN:
        (globalScene.phaseManager.getCurrentPhase() as CommandPhase).handleCommand(Command.RUN, 0);
        break;
      case Command.TERA:
        ui.setMode(
          UiMode.FIGHT,
          (globalScene.phaseManager.getCurrentPhase() as CommandPhase).getFieldIndex(),
          Command.TERA,
        );
        break;
    }
  }

  public override processInput(button: Button): boolean {
    const ui = this.getUi();
    let success = false;

    if (this.teraSelected) {
      success = true;
      if (button === Button.ACTION) {
        this.onActionInput(Command.TERA);
      } else if (button === Button.RIGHT) {
        this.setTeraButtonEnabled(false);
      }
    } else {
      switch (button) {
        case Button.CANCEL:
          (globalScene.phaseManager.getCurrentPhase() as CommandPhase).cancel();
          success = true;
          break;
        case Button.ACTION:
        case Button.UP:
        case Button.DOWN:
        case Button.LEFT:
        case Button.RIGHT:
          success = this.gridHelper.processInput(button);
      }
    }

    if (success) {
      ui.playSelect();
    }

    return success;
  }

  private canTera(): boolean {
    const activePokemon = globalScene.getField()[this.fieldIndex];
    const currentTeras = globalScene.arena.playerTerasUsed;
    const canTera = activePokemon.isPlayer() && canTerastallize(activePokemon);
    const plannedTera = +(
      globalScene.currentBattle.preTurnCommands[0]?.command === Command.TERA && this.fieldIndex > 0
    );
    return canTera && currentTeras + plannedTera < MAX_TERAS_PER_ARENA;
  }

  private setTeraButtonEnabled(enabled: boolean) {
    this.teraSelected = enabled;
    this.teraButton.setPipeline(globalScene.spritePipeline, {
      tone: [0.0, 0.0, 0.0, 0.0],
      ignoreTimeTint: true,
      teraColor: getTypeRgb(globalScene.getField()[this.fieldIndex].getTeraType()),
      isTerastallized: enabled,
    });
    this.gridHelper.setCursorVisible(!enabled);
  }

  public override clear(): void {
    super.clear();
    this.getUi().getMessageHandler().commandWindow.setVisible(false);
    this.gridHelper.setVisible(false);
    this.getUi().getMessageHandler().clearText();
  }
}
