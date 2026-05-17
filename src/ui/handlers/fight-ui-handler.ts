import type { InfoToggle } from "#app/battle-scene";
import { globalScene } from "#app/global-scene";
import { getTypeDamageMultiplierColor } from "#data/type";
import { BattleType } from "#enums/battle-type";
import { Button } from "#enums/buttons";
import { Command } from "#enums/command";
import { MoveCategory } from "#enums/move-category";
import { MoveUseMode } from "#enums/move-use-mode";
import { PokemonType } from "#enums/pokemon-type";
import { TextStyle } from "#enums/text-style";
import { UiMode } from "#enums/ui-mode";
import type { EnemyPokemon, Pokemon } from "#field/pokemon";
import type { PokemonMove } from "#moves/pokemon-move";
import type { CommandPhase } from "#phases/command-phase";
import { MoveInfoOverlay } from "#ui/move-info-overlay";
import { ScrollableGridHelper } from "#ui/scrollable-grid-helper";
import { addTextObject, getTextColor } from "#ui/text";
import { UiHandler } from "#ui/ui-handler";
import { fixedInt, getLocalizedSpriteKey, padInt } from "#utils/common";
import i18next from "i18next";

interface MoveWithUser {
  readonly move: PokemonMove;
  readonly user: Pokemon;
}

export class FightUiHandler extends UiHandler implements InfoToggle {
  public static readonly MOVES_CONTAINER_NAME = "moves";

  private moveInfoContainer: Phaser.GameObjects.Container;
  private typeIcon: Phaser.GameObjects.Sprite;
  private ppLabel: Phaser.GameObjects.Text;
  private ppText: Phaser.GameObjects.Text;
  private powerLabel: Phaser.GameObjects.Text;
  private powerText: Phaser.GameObjects.Text;
  private accuracyLabel: Phaser.GameObjects.Text;
  private accuracyText: Phaser.GameObjects.Text;
  private moveCategoryIcon: Phaser.GameObjects.Sprite;
  private moveInfoOverlay: MoveInfoOverlay;
  private gridHelper: ScrollableGridHelper<Phaser.GameObjects.Container, MoveWithUser>;

  protected fieldIndex = 0;
  protected fromCommand: Command = Command.FIGHT;
  protected cursor2 = 0;

  constructor() {
    super(UiMode.FIGHT);
  }

  /**
   * Set the visibility of the objects in the move info container.
   */
  private setInfoVis(visibility: boolean): void {
    this.moveInfoContainer.iterate((o: Phaser.GameObjects.Components.Visible) => o.setVisible(visibility));
  }

  setup() {
    const ui = this.getUi();

    this.gridHelper = new ScrollableGridHelper(18, -38.7, {
      rows: 2,
      columns: 2,
      scrollMode: "none",
      cells: {
        x: 0,
        y: 0,
        spacingX: 114,
        spacingY: 16,
        createCell: () => globalScene.add.container(0, 0),
        renderCell: (container, moveWithUser) => {
          const moveText = addTextObject(0, 0, moveWithUser.move.getName(), TextStyle.WINDOW).setName(
            "text-empty-move",
          );
          moveText
            .setName(moveWithUser.move.getName())
            .setColor(this.getMoveColor(moveWithUser.user, moveWithUser.move) ?? moveText.style.color);
          container.add(moveText);
        },
      },
      cursor: {
        texture: "cursor",
        width: 6,
        height: 10,
        offsetX: -8,
        offsetY: 2.5,
      },
      onItemSelected: (_cell, moveWithUser) => this.onMoveSelect(moveWithUser.move),
      onItemActioned: () => this.processActionInput(),
      wrap: false,
    });

    ui.add(this.gridHelper);

    this.moveInfoContainer = globalScene.add.container(1, 0).setName("move-info");
    ui.add(this.moveInfoContainer);

    this.typeIcon = globalScene.add
      .sprite(globalScene.scaledCanvas.width - 57, -36, getLocalizedSpriteKey("types"), "unknown")
      .setVisible(false);

    this.moveCategoryIcon = globalScene.add
      .sprite(globalScene.scaledCanvas.width - 25, -36, "categories", "physical")
      .setVisible(false);

    this.ppLabel = addTextObject(globalScene.scaledCanvas.width - 70, -26, "PP", TextStyle.MOVE_INFO_CONTENT)
      .setOrigin(0.0, 0.5)
      .setVisible(false)
      .setText(i18next.t("fightUiHandler:pp"));

    this.ppText = addTextObject(globalScene.scaledCanvas.width - 12, -26, "--/--", TextStyle.MOVE_INFO_CONTENT)
      .setOrigin(1, 0.5)
      .setVisible(false);

    this.powerLabel = addTextObject(globalScene.scaledCanvas.width - 70, -18, "POWER", TextStyle.MOVE_INFO_CONTENT)
      .setOrigin(0.0, 0.5)
      .setVisible(false)
      .setText(i18next.t("fightUiHandler:power"));

    this.powerText = addTextObject(globalScene.scaledCanvas.width - 12, -18, "---", TextStyle.MOVE_INFO_CONTENT)
      .setOrigin(1, 0.5)
      .setVisible(false);

    this.accuracyLabel = addTextObject(globalScene.scaledCanvas.width - 70, -10, "ACC", TextStyle.MOVE_INFO_CONTENT)
      .setOrigin(0.0, 0.5)
      .setVisible(false)
      .setText(i18next.t("fightUiHandler:accuracy"));

    this.accuracyText = addTextObject(globalScene.scaledCanvas.width - 12, -10, "---", TextStyle.MOVE_INFO_CONTENT)
      .setOrigin(1, 0.5)
      .setVisible(false);

    this.moveInfoContainer.add([
      this.typeIcon,
      this.moveCategoryIcon,
      this.ppLabel,
      this.ppText,
      this.powerLabel,
      this.powerText,
      this.accuracyLabel,
      this.accuracyText,
    ]);

    // prepare move overlay
    this.moveInfoOverlay = new MoveInfoOverlay({
      delayVisibility: true,
      onSide: true,
      right: true,
      x: 0,
      y: -MoveInfoOverlay.getHeight(true),
      width: globalScene.scaledCanvas.width + 4,
      hideEffectBox: true,
      hideBg: true,
    });
    ui.add(this.moveInfoOverlay);
    // register the overlay to receive toggle events
    globalScene.addInfoToggle(this.moveInfoOverlay, this);
  }

  override show(args: [number?, Command?]): boolean {
    super.show(args);
    const pokemon = (globalScene.phaseManager.getCurrentPhase() as CommandPhase).getPokemon();
    const moveset = pokemon.getMoveset();

    this.fieldIndex = args[0] ?? 0;
    this.fromCommand = args[1] ?? Command.FIGHT;

    const messageHandler = this.getUi().getMessageHandler();
    messageHandler.bg.setVisible(false);
    messageHandler.commandWindow.setVisible(false);
    messageHandler.movesWindowContainer.setVisible(true);

    this.onMoveSelect(moveset[0]);
    this.displayMoves(pokemon);
    this.toggleInfo(false); // in case cancel was pressed while info toggle is active
    this.active = true;
    return true;
  }

  private processActionInput(): boolean {
    return (globalScene.phaseManager.getCurrentPhase() as CommandPhase).handleCommand(
      this.fromCommand,
      this.gridHelper.getCursor(),
      MoveUseMode.NORMAL,
    );
  }

  /**
   * Process the player inputting the selected {@linkcode Button}.
   * @param button - The {@linkcode Button} being pressed
   * @returns Whether the input was successful (ie did anything).
   */
  processInput(button: Button): boolean {
    const ui = this.getUi();
    let success = false;

    switch (button) {
      case Button.ACTION:
        if (this.processActionInput()) {
          success = true;
        } else {
          ui.playError();
        }
        break;
      case Button.CANCEL: {
        // Cannot back out of fight menu if skipToFightInput is enabled
        const { battleType, mysteryEncounter } = globalScene.currentBattle;
        if (battleType !== BattleType.MYSTERY_ENCOUNTER || !mysteryEncounter?.skipToFightInput) {
          ui.setMode(UiMode.COMMAND, this.fieldIndex);
          success = true;
        }
        break;
      }
      case Button.UP:
      case Button.DOWN:
      case Button.LEFT:
      case Button.RIGHT:
        this.gridHelper.processInput(button);
        break;
    }

    if (success) {
      ui.playSelect();
    }

    return success;
  }

  /**
   * Adjust the visibility of move names and the cursor icon when the info overlay is toggled
   * @param visible - The visibility of the info overlay; the move names and cursor's visibility will be set to the opposite
   */
  toggleInfo(visible: boolean): void {
    // The info overlay will already fade in, so we should hide the move name text and cursor immediately
    // rather than adjusting alpha via a tween.
    if (visible) {
      this.gridHelper.setVisible(false);
      return;
    }
    globalScene.tweens.add({
      targets: [this.gridHelper],
      duration: fixedInt(125),
      ease: "Sine.easeInOut",
      alpha: 1,
    });
    this.gridHelper.setVisible(true);
  }

  isActive(): boolean {
    return this.active;
  }

  /** @returns TextStyle according to percentage of PP remaining */
  private static ppRatioToColor(ppRatio: number): TextStyle {
    if (ppRatio > 0.25 && ppRatio <= 0.5) {
      return TextStyle.MOVE_PP_HALF_FULL;
    }
    if (ppRatio > 0 && ppRatio <= 0.25) {
      return TextStyle.MOVE_PP_NEAR_EMPTY;
    }
    if (ppRatio === 0) {
      return TextStyle.MOVE_PP_EMPTY;
    }
    return TextStyle.MOVE_PP_FULL; // default to full if ppRatio is invalid
  }

  /**
   * Populate the move info overlay with the information of the move at the given cursor index
   * @param cursor - The cursor position to set the move info for
   */
  private setMoveInfo(pokemonMove: PokemonMove): void {
    const pokemon = (globalScene.phaseManager.getCurrentPhase() as CommandPhase).getPokemon();
    this.setInfoVis(true);
    const moveType = pokemon.getMoveType(pokemonMove.getMove());
    const textureKey = getLocalizedSpriteKey("types");
    this.typeIcon.setTexture(textureKey, PokemonType[moveType].toLowerCase()).setScale(0.8);

    const moveCategory = pokemonMove.getMove().category;
    this.moveCategoryIcon.setTexture("categories", MoveCategory[moveCategory].toLowerCase()).setScale(1.0);
    const power = pokemonMove.getMove().power;
    const accuracy = pokemonMove.getMove().accuracy;
    const maxPP = pokemonMove.getMovePp();
    const pp = maxPP - pokemonMove.ppUsed;

    const ppLeftStr = padInt(pp, 2, "  ");
    const ppMaxStr = padInt(maxPP, 2, "  ");
    this.ppText.setText(`${ppLeftStr}/${ppMaxStr}`);
    this.powerText.setText(`${power >= 0 ? power : "---"}`);
    this.accuracyText.setText(`${accuracy >= 0 ? accuracy : "---"}`);

    const ppColorStyle = FightUiHandler.ppRatioToColor(pp / maxPP);

    // Changes the text color and shadow according to the determined TextStyle
    this.ppText.setColor(getTextColor(ppColorStyle, false)).setShadowColor(getTextColor(ppColorStyle, true));
    this.moveInfoOverlay.show(pokemonMove.getMove());

    pokemon.getOpponents().forEach(opponent => {
      (opponent as EnemyPokemon).updateEffectiveness(this.getEffectivenessText(pokemon, opponent, pokemonMove));
    });
  }

  private onMoveSelect(pokemonMove: PokemonMove): boolean {
    this.moveInfoOverlay.clear();
    this.setMoveInfo(pokemonMove);
    return true;
  }

  /**
   * Gets multiplier text for a pokemon's move against a specific opponent
   */
  private getEffectivenessText(pokemon: Pokemon, opponent: Pokemon, pokemonMove: PokemonMove): string | undefined {
    const effectiveness = opponent.getMoveEffectiveness(
      pokemon,
      pokemonMove.getMove(),
      !opponent.waveData.abilityRevealed,
      undefined,
      undefined,
      true,
    );
    if (pokemonMove.getMove().category === MoveCategory.STATUS) {
      if (effectiveness === 0) {
        return "0x";
      }
      return "1x";
    }

    return `${effectiveness}x`;
  }

  displayMoves(pokemon: Pokemon) {
    this.gridHelper.setItems(pokemon.getMoveset().map(move => ({ user: pokemon, move })));
  }

  /**
   * Returns a specific move's color based on its type effectiveness against opponents
   * If there are multiple opponents, the highest effectiveness' color is returned
   * @returns A color or undefined if the default color should be used
   */
  private getMoveColor(pokemon: Pokemon, pokemonMove: PokemonMove): string | undefined {
    if (!globalScene.typeHints) {
      return;
    }

    const opponents = pokemon.getOpponents();
    if (opponents.length <= 0) {
      return;
    }

    const moveColors = opponents
      .map(opponent =>
        opponent.getMoveEffectiveness(
          pokemon,
          pokemonMove.getMove(),
          !opponent.waveData.abilityRevealed,
          undefined,
          undefined,
          true,
        ),
      )
      .sort((a, b) => b - a)
      .map(effectiveness => {
        if (pokemonMove.getMove().category === MoveCategory.STATUS && effectiveness !== 0) {
          return;
        }
        return getTypeDamageMultiplierColor(effectiveness ?? 0, "offense");
      });

    return moveColors[0];
  }

  clear() {
    super.clear();
    const messageHandler = this.getUi().getMessageHandler();
    this.clearMoves();
    this.setInfoVis(false);
    this.moveInfoOverlay.clear();
    messageHandler.bg.setVisible(true);
    this.active = false;
  }

  clearMoves() {
    this.gridHelper.clearItems();
    const opponents = (globalScene.phaseManager.getCurrentPhase() as CommandPhase).getPokemon().getOpponents();
    opponents.forEach(opponent => {
      (opponent as EnemyPokemon).updateEffectiveness();
    });
  }
}
