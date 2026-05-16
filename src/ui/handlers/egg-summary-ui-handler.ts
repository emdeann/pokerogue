import { globalScene } from "#app/global-scene";
import { getEggTierForSpecies } from "#data/egg";
import type { EggHatchData } from "#data/egg-hatch-data";
import { Button } from "#enums/buttons";
import { UiMode } from "#enums/ui-mode";
import { HatchedPokemonContainer } from "#ui/hatched-pokemon-container";
import { MessageUiHandler } from "#ui/message-ui-handler";
import { PokemonHatchInfoContainer } from "#ui/pokemon-hatch-info-container";
import { PokemonIconAnimHelper, PokemonIconAnimMode } from "#ui/pokemon-icon-anim-helper";
import { ScrollableGridHelper } from "#ui/scrollable-grid-helper";

const iconContainerX = 112;
const iconContainerY = 9;
const numRows = 9;
const numCols = 11;
const iconSize = 18;

/**
 * UI Handler for the egg summary.
 * Handles navigation and display of each pokemon as a list
 * Also handles display of the pokemon-hatch-info-container
 */
export class EggSummaryUiHandler extends MessageUiHandler {
  /** holds all elements in the scene */
  private eggHatchContainer: Phaser.GameObjects.Container;
  /** holds the grid helper and info container */
  private summaryContainer: Phaser.GameObjects.Container;

  /** hatch info container that displays the current pokemon / hatch (main element on left hand side) */
  private infoContainer: PokemonHatchInfoContainer;
  /** handles jumping animations for the pokemon sprite icons */
  private iconAnimHandler: PokemonIconAnimHelper;
  private eggHatchBg: Phaser.GameObjects.Image;
  private eggHatchData: EggHatchData[];

  private gridHelper: ScrollableGridHelper<Phaser.GameObjects.Container, EggHatchData>;
  /**
   * Maps each cell wrapper to its lazily-created {@linkcode HatchedPokemonContainer} child.
   * Populated during {@linkcode renderHatchCell}, cleared during {@linkcode clear}.
   */
  private hatchedContainers: Map<Phaser.GameObjects.Container, HatchedPokemonContainer> = new Map();
  private lastAnimatedHpc: HatchedPokemonContainer | null = null;

  /** used to add a delay before which it is not possible to exit the summary */
  private blockExit: boolean;

  /**
   * Allows subscribers to listen for events
   *
   * Current Events:
   * - {@linkcode EggEventType.EGG_COUNT_CHANGED} {@linkcode EggCountChangedEvent}
   */
  public readonly eventTarget: EventTarget = new EventTarget();

  constructor() {
    super(UiMode.EGG_HATCH_SUMMARY);
  }

  setup() {
    const ui = this.getUi();

    this.summaryContainer = globalScene.add.container(0, -globalScene.scaledCanvas.height);
    this.summaryContainer.setVisible(false);
    ui.add(this.summaryContainer);

    this.eggHatchContainer = globalScene.add.container(0, -globalScene.scaledCanvas.height);
    this.eggHatchContainer.setVisible(false);
    ui.add(this.eggHatchContainer);

    this.iconAnimHandler = new PokemonIconAnimHelper();
    this.iconAnimHandler.setup();

    this.eggHatchBg = globalScene.add.image(0, 0, "egg_summary_bg");
    this.eggHatchBg.setOrigin(0, 0);
    this.eggHatchContainer.add(this.eggHatchBg);

    this.hatchedContainers = new Map();
    this.gridHelper = new ScrollableGridHelper<Phaser.GameObjects.Container, EggHatchData>(0, 0, {
      rows: numRows,
      columns: numCols,
      scrollBar: {
        x: iconContainerX + numCols * iconSize,
        y: iconContainerY + 3,
        width: 4,
        height: globalScene.scaledCanvas.height - 20,
      },
      cells: {
        x: iconContainerX,
        y: iconContainerY,
        spacingX: iconSize,
        spacingY: iconSize,
        createCell: () => globalScene.add.container(0, 0),
        renderCell: (cell, hatchData) => this.renderHatchCell(cell, hatchData),
      },
      cursor: { texture: "select_cursor", width: iconSize, height: iconSize },
      onItemSelected: (cell, hatchData) => this.onHatchSelected(cell, hatchData),
    });
    this.summaryContainer.add(this.gridHelper);

    this.infoContainer = new PokemonHatchInfoContainer(this.summaryContainer);
    this.infoContainer.setup();
    this.infoContainer.changeToEggSummaryLayout();
    this.infoContainer.setVisible(true);
    this.summaryContainer.add(this.infoContainer);

    this.cursor = -1;
  }

  /**
   * Lazily creates (or reuses) a {@linkcode HatchedPokemonContainer} inside
   * the wrapper cell and updates it with the given hatch data.
   */
  private renderHatchCell(cell: Phaser.GameObjects.Container, hatchData: EggHatchData): void {
    let hpc = this.hatchedContainers.get(cell);
    if (!hpc) {
      hpc = new HatchedPokemonContainer(0, 0, hatchData);
      cell.add(hpc);
      this.hatchedContainers.set(cell, hpc);
    }
    hpc.updateAndAnimate(hatchData, this.iconAnimHandler);
  }

  /**
   * Called by the grid helper whenever the highlighted hatch entry changes.
   */
  private onHatchSelected(cell: Phaser.GameObjects.Container, hatchData: EggHatchData): void {
    if (this.lastAnimatedHpc) {
      this.iconAnimHandler.addOrUpdate(this.lastAnimatedHpc.icon, PokemonIconAnimMode.NONE);
    }

    const hpc = this.hatchedContainers.get(cell);
    if (hpc) {
      this.iconAnimHandler.addOrUpdate(hpc.icon, PokemonIconAnimMode.ACTIVE);
      this.lastAnimatedHpc = hpc;
    }

    this.infoContainer.showHatchInfo(hatchData);
  }

  clear() {
    super.clear();
    this.gridHelper.reset();
    this.cursor = -1;
    this.lastAnimatedHpc = null;

    this.summaryContainer.setVisible(false);
    this.eggHatchBg.setVisible(false);
    this.getUi().hideTooltip();

    // Note: Questions on garbage collection go to @frutescens
    const activeKeys = globalScene.getActiveKeys();
    // Removing unnecessary sprites from animation manager
    const animKeys = Object.keys(globalScene.anims["anims"]["entries"]);
    animKeys.forEach(key => {
      if (key.startsWith("pkmn__") && !activeKeys.includes(key)) {
        globalScene.anims.remove(key);
      }
    });
    // Removing unnecessary cries from audio cache
    const audioKeys = Object.keys(globalScene.cache.audio.entries.entries);
    audioKeys.forEach(key => {
      if (key.startsWith("cry/") && !activeKeys.includes(key)) {
        delete globalScene.cache.audio.entries.entries[key];
      }
    });
    // Clears eggHatchData in EggSummaryUiHandler
    this.eggHatchData.length = 0;
    // Removes Pokemon icons in EggSummaryUiHandler
    this.iconAnimHandler.removeAll();
    for (const [cell, hpc] of this.hatchedContainers) {
      cell.remove(hpc, true);
    }
    this.hatchedContainers.clear();
  }

  /**
   * @param args EggHatchData[][]
   * args[0]: list of EggHatchData for each egg/pokemon hatched
   */
  show(args: EggHatchData[][]): boolean {
    super.show(args);
    if (args.length > 0) {
      // sort the egg hatch data by egg tier then by species number (then by order hatched)
      this.eggHatchData = args[0].sort(function sortHatchData(a: EggHatchData, b: EggHatchData) {
        const speciesA = a.pokemon.species;
        const speciesB = b.pokemon.species;
        if (getEggTierForSpecies(speciesA) < getEggTierForSpecies(speciesB)) {
          return -1;
        }
        if (getEggTierForSpecies(speciesA) > getEggTierForSpecies(speciesB)) {
          return 1;
        }
        if (speciesA.speciesId < speciesB.speciesId) {
          return -1;
        }
        if (speciesA.speciesId > speciesB.speciesId) {
          return 1;
        }
        return 0;
      });
    }

    this.getUi().bringToTop(this.summaryContainer);
    this.summaryContainer.setVisible(true);
    this.eggHatchContainer.setVisible(true);
    this.eggHatchBg.setVisible(true);
    this.infoContainer.hideDisplayPokemon();

    this.gridHelper.setItems(this.eggHatchData);

    globalScene.playSoundWithoutBgm("evolution_fanfare");

    // Prevent exiting the egg summary for 2 seconds if the egg hatching
    // was skipped automatically and for 1 second otherwise
    const exitBlockingDuration = globalScene.eggSkipPreference === 2 ? 2000 : 1000;
    this.blockExit = true;
    globalScene.time.delayedCall(exitBlockingDuration, () => (this.blockExit = false));

    return true;
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();

    let success = false;
    let error = false;
    if (button === Button.CANCEL) {
      if (this.blockExit) {
        error = true;
      } else {
        const phase = globalScene.phaseManager.getCurrentPhase();
        if (phase.is("EggSummaryPhase")) {
          phase.end();
        }
        success = true;
      }
    } else {
      success = this.gridHelper.processInput(button);
    }

    if (success) {
      ui.playSelect();
    } else if (error) {
      ui.playError();
    }

    return success || error;
  }
}
