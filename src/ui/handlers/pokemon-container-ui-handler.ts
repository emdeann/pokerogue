import { globalScene } from "#app/global-scene";
import { POKERUS_STARTER_COUNT, speciesStarterCosts } from "#balance/starters";
import type { PokemonSpecies } from "#data/pokemon-species";
import { AbilityAttr } from "#enums/ability-attr";
import { AbilityId } from "#enums/ability-id";
import { Button } from "#enums/buttons";
import { DexAttr } from "#enums/dex-attr";
import { DropDownColumn } from "#enums/drop-down-column";
import type { Nature } from "#enums/nature";
import { PokemonType } from "#enums/pokemon-type";
import { TextStyle } from "#enums/text-style";
import { getVariantIcon, getVariantTint, type Variant } from "#sprites/variant";
import type { GameData } from "#system/game-data";
import type { DexEntry } from "#types/dex-data";
import type { StarterPreferences } from "#types/save-data";
import {
  DropDown,
  DropDownLabel,
  type DropDownOptionParams,
  DropDownState,
  DropDownType,
  SortCriteria,
} from "#ui/dropdown";
import { FilterBar } from "#ui/filter-bar";
import { MessageUiHandler } from "#ui/message-ui-handler";
import { POKEMON_CONTAINER_WIDTH, type PokemonContainer } from "#ui/pokemon-container";
import { PokemonIconAnimHelper, PokemonIconAnimMode } from "#ui/pokemon-icon-anim-helper";
import { ScrollBar } from "#ui/scroll-bar";
import {
  isPassiveAvailable,
  isSameSpeciesEggAvailable,
  isUpgradeAnimationEnabled,
  isUpgradeIconEnabled,
  isValueReductionAvailable,
} from "#ui/starter-select-ui-utils";
import { addTextObject, getTextColor } from "#ui/text";
import { addWindow } from "#ui/ui-theme";
import { fixedInt, getLocalizedSpriteKey, randIntRange } from "#utils/common";
import i18next from "i18next";
import FixWidthButtons from "phaser3-rex-plugins/templates/ui/fixwidthbuttons/FixWidthButtons";

/** Number of columns and rows of containers in the visible grid. */
export const COLUMNS = 9;
export const ROWS = 9;
/** Total visible containers (rendered count). */
export const VISIBLE_CONTAINER_COUNT = COLUMNS * ROWS;

export const FILTER_BAR_HEIGHT = 17;

/**
 * Calculates the on-grid position of a container based on its visible index.
 *
 * Both subclasses use the same 9-column / 17-pixel-per-row layout, so the
 * computation lives here in the base.
 */
export function calcContainerPosition(index: number): { x: number; y: number } {
  const yOffset = 13;
  const height = 17;
  const x = (index % COLUMNS) * POKEMON_CONTAINER_WIDTH;
  const y = yOffset + Math.floor(index / COLUMNS) * height;
  return { x, y };
}

/**
 * Structural view of a {@linkcode PokemonContainer} that exposes only the
 * members the base UI handler reads/writes.
 *
 * Using a structural interface instead of `extends PokemonContainer` avoids
 * the variance issues introduced by rexUI Label's `self`-typed callbacks
 * (e.g. `onCreateModalBehavior`, `setText.onCreateModalBehavior`).
 */
export interface PokemonContainerLike extends Phaser.GameObjects.GameObject {
  species: PokemonSpecies;
  icon: Phaser.GameObjects.Sprite;
  shinyIcons: Phaser.GameObjects.Image[];
  label: Phaser.GameObjects.Text;
  starterPassiveBgs: Phaser.GameObjects.Image;
  hiddenAbilityIcon: Phaser.GameObjects.Image;
  favoriteIcon: Phaser.GameObjects.Image;
  classicWinIcon: Phaser.GameObjects.Image;
  candyUpgradeIcon: Phaser.GameObjects.Image;
  candyUpgradeOverlayIcon: Phaser.GameObjects.Image;
  cost: number;

  // Members inherited from Phaser/rexUI that the base handler invokes:
  setVisible(value: boolean): this;
  setPosition(x?: number, y?: number): this;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

/**
 * Generic abstract handler for screens that render a scrollable 9x9 grid of
 * Pokemon containers (e.g. {@linkcode StarterSelectUiHandler},
 * {@linkcode PokedexUiHandler}).
 *
 * @typeParam TContainer - The concrete `PokemonContainer` subtype to render.
 */
export abstract class PokemonContainerUiHandler<TContainer extends PokemonContainerLike> extends MessageUiHandler {
  protected starterSelectContainer: Phaser.GameObjects.Container;
  protected gridButtons: FixWidthButtons;
  protected starterBoxContainer: Phaser.GameObjects.Container;

  protected pokemonContainers: TContainer[] = [];
  protected starterSelectScrollBar: ScrollBar;
  public cursorObj: Phaser.GameObjects.Image;
  protected pokerusCursorObjs: Phaser.GameObjects.Image[] = [];
  protected scrollCursor = 0;
  protected oldCursor = -1;

  protected filterBar: FilterBar;
  protected filterMode = false;
  protected filterBarCursor = 0;

  protected iconAnimHandler: PokemonIconAnimHelper;
  protected starterSelectMessageBox: Phaser.GameObjects.NineSlice;
  protected starterSelectMessageBoxContainer: Phaser.GameObjects.Container;
  protected blockInput = false;

  /**
   * Coordinates of the leftmost edge of the grid container window. Subclasses
   * may override this if their layout shifts the grid.
   */
  protected speciesContainerX = 109;

  /** Returns the number of containers to instantiate (defaults to 9 * 9 = 81). */
  protected getContainerCount(): number {
    return VISIBLE_CONTAINER_COUNT;
  }

  /**
   * Instantiate the i-th container.
   *
   * Implementations should construct (e.g.) a `StarterContainer` or
   * `PokedexMonContainer` and return it.
   */
  protected abstract createContainer(index: number): TContainer;

  /**
   * Add filters that aren't part of the shared set.
   */
  protected abstract addExtraFilters(filterBar: FilterBar): void;

  /** Called whenever any filter changes. */
  protected abstract updateStarters(): void;

  /** Called when the scroll cursor changes. */
  protected abstract updateScroll(): void;

  /**
   * Builds the root container for this handler. Subclasses generally call this
   * from their `setup()` and then add additional widgets to
   * {@linkcode starterSelectContainer}.
   */
  protected initRootContainer(): void {
    const sHeight = globalScene.scaledCanvas.height;
    const sWidth = globalScene.scaledCanvas.width;

    this.starterSelectContainer = globalScene.add.container(0, -sHeight).setVisible(false);
    this.getUi().add(this.starterSelectContainer);

    const bgColor = globalScene.add.rectangle(0, 0, sWidth, sHeight, 0x006860).setOrigin(0);
    this.starterSelectContainer.add(bgColor);
  }

  /**
   * Sets up the icon animation helper. Must be called once during setup
   * before containers are constructed.
   */
  protected initIconAnimHandler(): void {
    this.iconAnimHandler = new PokemonIconAnimHelper();
    this.iconAnimHandler.setup();
  }

  /**
   * Builds the inner grid container at the standard offset, populates it with
   * the scroll bar, the pokerus cursors, the main cursor, and `getContainerCount()`
   * containers via {@linkcode createContainer}.
   *
   * @param scrollBarHeight Visible height of the scroll bar (default 155 like StarterSelectUi).
   * @returns The constructed `starterBoxContainer`.
   */
  protected buildGrid(scrollBarHeight = 155): Phaser.GameObjects.Container {
    const starterBoxContainer = globalScene.add.container(this.speciesContainerX + 6, 9);
    this.starterBoxContainer = starterBoxContainer;

    this.starterSelectScrollBar = new ScrollBar(161, 12, 5, scrollBarHeight, 9, (_v, dv) => {
      this.scrollCursor += dv;
      this.updateScroll();
      this.setCursor(this.cursor);
    });
    starterBoxContainer.add(this.starterSelectScrollBar);

    for (let i = 0; i < POKERUS_STARTER_COUNT; i++) {
      const cursorObj = globalScene.add.image(0, 0, "select_cursor_pokerus").setVisible(false).setOrigin(0);
      starterBoxContainer.add(cursorObj);
      this.pokerusCursorObjs.push(cursorObj);
    }

    this.cursorObj = globalScene.add.image(0, 0, "select_cursor").setOrigin(0);
    starterBoxContainer.add(this.cursorObj);

    const count = this.getContainerCount();
    for (let i = 0; i < count; i++) {
      const container = this.createContainer(i);
      container.setVisible(false);
      this.iconAnimHandler.addOrUpdate(container.icon, PokemonIconAnimMode.NONE);
      this.pokemonContainers.push(container);
    }

    this.gridButtons = new FixWidthButtons(globalScene, {
      x: 0,
      y: 13,
      width: COLUMNS * POKEMON_CONTAINER_WIDTH,
      align: "left",
      buttons: this.pokemonContainers,
      origin: 0,
    });
    this.gridButtons.layout();

    starterBoxContainer.add(this.gridButtons);

    this.gridButtons.on("button.over", (_button: PokemonContainerLike, index: number) => {
      this.onGridButtonHover(index);
    });
    this.gridButtons.on("button.click", (_button: PokemonContainerLike, index: number) => {
      this.onGridButtonClick(index);
    });

    return starterBoxContainer;
  }

  /**
   * Whether grid pointer events are allowed to take effect right now.
   */
  protected canInteractWithGrid(): boolean {
    if (this.blockInput) {
      return false;
    }
    if (this.filterBar?.openDropDown) {
      return false;
    }
    if (globalScene.ui.getHandler() !== this) {
      return false;
    }
    return true;
  }

  /**
   * @returns whether the keyboard cursor is currently on the grid (as opposed
   * to the filter bar or some subclass-specific sub-cursor). Subclasses
   * override to also return false when their own cursors (party / start /
   * random / filter-text / etc.) are visible.
   */
  protected isGridFocused(): boolean {
    return !this.filterMode && this.cursorObj.visible;
  }

  /**
   * Move keyboard focus back onto the grid. Subclasses override to also hide
   * any of their own focus indicators (party / start / random / form-tray
   * cursor, filter text mode, …).
   */
  protected focusGrid(): void {
    if (this.filterMode) {
      this.setFilterMode(false);
    }
    this.cursorObj.setVisible(true);
  }

  /** Pointer hovered the i-th grid button. */
  protected onGridButtonHover(index: number): void {
    if (!this.canInteractWithGrid()) {
      return;
    }
    const container = this.pokemonContainers[index];
    if (!container?.visible) {
      return;
    }
    this.focusGrid();
    if (this.cursor !== index) {
      this.setCursor(index);
    }
  }

  /** Pointer released over the i-th grid button. */
  protected onGridButtonClick(index: number): void {
    if (!this.canInteractWithGrid()) {
      return;
    }
    const container = this.pokemonContainers[index];
    if (!container?.visible) {
      return;
    }

    const alreadySelected = this.isGridFocused() && this.cursor === index;
    this.focusGrid();

    if (alreadySelected) {
      this.processInput(Button.ACTION);
    } else {
      this.setCursor(index);
      this.getUi().playSelect();
    }
  }

  /**
   * Builds the standard message box container at the bottom of the screen.
   */
  protected buildMessageBox(): void {
    const sHeight = globalScene.scaledCanvas.height;
    this.starterSelectMessageBoxContainer = globalScene.add.container(0, sHeight).setVisible(false);
    this.starterSelectMessageBox = addWindow(1, -1, 318, 28).setOrigin(0, 1);
    this.starterSelectMessageBoxContainer.add(this.starterSelectMessageBox);

    this.message = addTextObject(8, 8, "", TextStyle.WINDOW, { maxLines: 2 }).setOrigin(0);
    this.starterSelectMessageBoxContainer.add(this.message);

    this.initPromptSprite(this.starterSelectMessageBoxContainer);
  }

  /**
   * Constructs the filter bar with the shared columns (gen / type / caught /
   * unlocks / sort), then calls {@linkcode addExtraFilters} to let the
   * subclass append misc / biome / etc. before applying hybrid offsets.
   *
   * The dimensions / x-position of the bar are configurable
   *  to accommodate different layouts.
   */
  protected buildFilterBar(opts: {
    x: number;
    y?: number;
    width: number;
    height?: number;
    maxLabels?: number;
    leftGap?: number;
    rightGap?: number;
    onChange?: () => void;
  }): FilterBar {
    const { x, y = 1, width, height = FILTER_BAR_HEIGHT, maxLabels, leftGap, rightGap, onChange } = opts;
    const change = onChange ?? (() => this.updateStarters());

    const filterBar =
      maxLabels !== undefined
        ? new FilterBar(x, y, width, height, maxLabels, leftGap ?? 0, rightGap ?? 0)
        : new FilterBar(x, y, width, height);

    const genOptions: DropDownOptionParams[] = Array.from({ length: 9 }, (_, i) => ({
      key: i + 1,
      labels: new DropDownLabel(i18next.t(`starterSelectUiHandler:gen${i + 1}`)),
    }));
    filterBar.addFilter(
      DropDownColumn.GEN,
      i18next.t("filterBar:genFilter"),
      new DropDown(0, 0, genOptions, change, DropDownType.HYBRID),
    );

    const typeKeys = Object.keys(PokemonType).filter(v => Number.isNaN(Number(v)));
    const typeOptions: DropDownOptionParams[] = [];
    typeKeys.forEach((type, index) => {
      if (index === 0 || index === 19) {
        return;
      }
      const typeSprite = globalScene.add.sprite(0, 0, getLocalizedSpriteKey("types"));
      typeSprite.setScale(0.5);
      typeSprite.setFrame(type.toLowerCase());
      typeOptions.push({ key: index, labels: new DropDownLabel("", typeSprite) });
    });
    filterBar.addFilter(
      DropDownColumn.TYPES,
      i18next.t("filterBar:typeFilter"),
      new DropDown(0, 0, typeOptions, change, DropDownType.HYBRID, 0.5),
    );

    // Subclass-specific columns get inserted before "caught" only if the
    // subclass overrides `addExtraFiltersBeforeCaught`. By default the standard
    // order is preserved.
    this.addExtraFiltersBeforeCaught(filterBar, change);

    const shinySprites: Phaser.GameObjects.Sprite[] = [0, 1, 2].map(v =>
      globalScene.add
        .sprite(0, 0, "shiny_icons")
        .setOrigin(0.15, 0.2)
        .setScale(0.6)
        .setFrame(getVariantIcon(v as Variant))
        .setTint(getVariantTint(v as Variant)),
    );
    const caughtOptions: DropDownOptionParams[] = [
      { key: "SHINY3", labels: new DropDownLabel("", shinySprites[2]) },
      { key: "SHINY2", labels: new DropDownLabel("", shinySprites[1]) },
      { key: "SHINY", labels: new DropDownLabel("", shinySprites[0]) },
      { key: "NORMAL", labels: new DropDownLabel(i18next.t("filterBar:normal")) },
      { key: "UNCAUGHT", labels: new DropDownLabel(i18next.t("filterBar:uncaught")) },
    ];
    filterBar.addFilter(
      DropDownColumn.CAUGHT,
      i18next.t("filterBar:caughtFilter"),
      new DropDown(0, 0, caughtOptions, change, DropDownType.HYBRID),
    );

    const passiveLabels = [
      new DropDownLabel(i18next.t("filterBar:passive"), undefined, DropDownState.OFF),
      new DropDownLabel(i18next.t("filterBar:passiveUnlocked"), undefined, DropDownState.ON),
      new DropDownLabel(i18next.t("filterBar:passiveUnlockable"), undefined, DropDownState.UNLOCKABLE),
      new DropDownLabel(i18next.t("filterBar:passiveLocked"), undefined, DropDownState.EXCLUDE),
    ];
    const costReductionLabels = [
      new DropDownLabel(i18next.t("filterBar:costReduction"), undefined, DropDownState.OFF),
      new DropDownLabel(i18next.t("filterBar:costReductionUnlocked"), undefined, DropDownState.ON),
      new DropDownLabel(i18next.t("filterBar:costReductionUnlockedOne"), undefined, DropDownState.ONE),
      new DropDownLabel(i18next.t("filterBar:costReductionUnlockedTwo"), undefined, DropDownState.TWO),
      new DropDownLabel(i18next.t("filterBar:costReductionUnlockable"), undefined, DropDownState.UNLOCKABLE),
      new DropDownLabel(i18next.t("filterBar:costReductionLocked"), undefined, DropDownState.EXCLUDE),
    ];
    const unlocksOptions: DropDownOptionParams[] = [
      { key: "PASSIVE", labels: passiveLabels },
      { key: "COST_REDUCTION", labels: costReductionLabels },
    ];
    filterBar.addFilter(
      DropDownColumn.UNLOCKS,
      i18next.t("filterBar:unlocksFilter"),
      new DropDown(0, 0, unlocksOptions, change, DropDownType.RADIAL),
    );

    this.addExtraFilters(filterBar);

    const sortOptions: DropDownOptionParams[] = [
      {
        key: SortCriteria.NUMBER,
        labels: new DropDownLabel(i18next.t("filterBar:sortByNumber"), undefined, DropDownState.ON),
      },
      { key: SortCriteria.COST, labels: new DropDownLabel(i18next.t("filterBar:sortByCost")) },
      { key: SortCriteria.CANDY, labels: new DropDownLabel(i18next.t("filterBar:sortByCandies")) },
      { key: SortCriteria.IV, labels: new DropDownLabel(i18next.t("filterBar:sortByIVs")) },
      { key: SortCriteria.NAME, labels: new DropDownLabel(i18next.t("filterBar:sortByName")) },
      { key: SortCriteria.CAUGHT, labels: new DropDownLabel(i18next.t("filterBar:sortByNumCaught")) },
      { key: SortCriteria.HATCHED, labels: new DropDownLabel(i18next.t("filterBar:sortByNumHatched")) },
    ];
    filterBar.addFilter(
      DropDownColumn.SORT,
      i18next.t("filterBar:sortFilter"),
      new DropDown(0, 0, sortOptions, change, DropDownType.SINGLE),
    );

    this.filterBar = filterBar;
    return filterBar;
  }

  /**
   * Insert columns between TYPES and CAUGHT (e.g. PokedexUi
   * adds a BIOME column there).  Default = no-op.
   */
  protected addExtraFiltersBeforeCaught(_filterBar: FilterBar, _onChange: () => void): void {}

  public override showText(
    text: string,
    delay?: number,
    callback?: () => void,
    callbackDelay?: number,
    prompt?: boolean,
    promptDelay?: number,
    moveToTop?: boolean,
  ): void {
    super.showText(text, delay, callback, callbackDelay, prompt, promptDelay);

    const singleLine = text?.indexOf("\n") === -1;
    this.starterSelectMessageBox.setSize(318, singleLine ? 28 : 42);

    if (moveToTop) {
      this.starterSelectMessageBox.setOrigin(0);
      this.starterSelectMessageBoxContainer.setY(0);
      this.message.setY(4);
    } else {
      this.starterSelectMessageBoxContainer.setY(globalScene.scaledCanvas.height);
      this.starterSelectMessageBox.setOrigin(0, 1);
      this.message.setY(singleLine ? -22 : -37);
    }

    this.starterSelectMessageBoxContainer.setVisible(text?.length > 0);
  }

  public override clearText(): void {
    this.starterSelectMessageBoxContainer.setVisible(false);
    super.clearText();
  }

  /**
   * Override-able accessor to the {@linkcode GameData} instance used for
   * passive / value-reduction lookups. Defaults to `globalScene.gameData`,
   * but the pokedex handler may inject a custom game data reference.
   */
  protected getGameData(): GameData {
    return globalScene.gameData;
  }

  protected isUpgradeIconEnabled(): boolean {
    return isUpgradeIconEnabled();
  }

  protected isUpgradeAnimationEnabled(): boolean {
    return isUpgradeAnimationEnabled();
  }

  /**
   * Adds a bouncing tween to the given icon if the species has an available
   * candy upgrade and animations are enabled.
   */
  protected setUpgradeAnimation(icon: Phaser.GameObjects.Sprite, species: PokemonSpecies, startPaused = false): void {
    globalScene.tweens.killTweensOf(icon);
    if (globalScene.candyUpgradeDisplay === 0 || species.speciesId !== species.getRootSpeciesId(false)) {
      return;
    }

    icon.y = 2;

    const tweenChain: Phaser.Types.Tweens.TweenChainBuilderConfig = {
      targets: icon,
      paused: startPaused,
      loop: -1,
      delay: randIntRange(0, 50) * 5,
      loopDelay: fixedInt(1000),
      tweens: [
        { targets: icon, y: "-=5", duration: fixedInt(125), ease: "Cubic.easeOut", yoyo: true },
        { targets: icon, y: "-=3", duration: fixedInt(150), ease: "Cubic.easeOut", yoyo: true },
      ],
    };

    const gameData = this.getGameData();
    if (
      isPassiveAvailable(species.speciesId, gameData)
      || (globalScene.candyUpgradeNotification === 2
        && (isValueReductionAvailable(species.speciesId, gameData)
          || isSameSpeciesEggAvailable(species.speciesId, gameData)))
    ) {
      const chain = globalScene.tweens.chain(tweenChain);
      if (!startPaused) {
        chain.play();
      }
    }
  }

  /** Toggle the candy-upgrade icon visibility based on what's available. */
  protected setUpgradeIcon(starter: TContainer): void {
    const species = starter.species;
    const slotVisible = !!species?.speciesId;
    const gameData = this.getGameData();

    if (
      !species
      || globalScene.candyUpgradeNotification === 0
      || species.speciesId !== species.getRootSpeciesId(false)
    ) {
      starter.candyUpgradeIcon.setVisible(false);
      starter.candyUpgradeOverlayIcon.setVisible(false);
      return;
    }

    const passiveAvailable = isPassiveAvailable(species.speciesId, gameData);
    const valueReductionAvailable = isValueReductionAvailable(species.speciesId, gameData);
    const sameSpeciesEggAvailable = isSameSpeciesEggAvailable(species.speciesId, gameData);

    if (globalScene.candyUpgradeNotification === 1) {
      starter.candyUpgradeIcon.setVisible(slotVisible && passiveAvailable);
      starter.candyUpgradeOverlayIcon.setVisible(slotVisible && starter.candyUpgradeIcon.visible);
    } else if (globalScene.candyUpgradeNotification === 2) {
      starter.candyUpgradeIcon.setVisible(
        slotVisible && (passiveAvailable || valueReductionAvailable || sameSpeciesEggAvailable),
      );
      starter.candyUpgradeOverlayIcon.setVisible(slotVisible && starter.candyUpgradeIcon.visible);
    }
  }

  protected updateCandyUpgradeDisplay(container: TContainer, animSpecies?: PokemonSpecies): void {
    if (this.isUpgradeIconEnabled()) {
      this.setUpgradeIcon(container);
    }
    if (this.isUpgradeAnimationEnabled()) {
      this.setUpgradeAnimation(container.icon, animSpecies ?? container.species, true);
    }
  }

  protected startIconAnimation(cursor: number): void {
    const container = this.pokemonContainers[cursor];
    const icon = container.icon;
    if (this.isUpgradeAnimationEnabled()) {
      globalScene.tweens.getTweensOf(icon).forEach(tween => tween.pause());
      icon.x = -2;
      icon.y = 2;
    }
    this.iconAnimHandler.addOrUpdate(icon, PokemonIconAnimMode.PASSIVE);
  }

  /**
   * Stops the idle animation of the container at the given cursor, and resumes
   * any paused candy-upgrade tween.
   *
   * Subclasses provide the icon-id parameters via {@linkcode getIconIdProps}.
   */
  protected stopIconAnimation(cursor: number): void {
    const container = this.pokemonContainers[cursor];
    if (!container) {
      return;
    }
    const icon = container.icon;
    const { female, formIndex, shiny, variant } = this.getIconIdProps(container);
    this.checkIconId(icon, container.species, female, formIndex, shiny, variant);
    this.iconAnimHandler.addOrUpdate(icon, PokemonIconAnimMode.NONE);
    globalScene.tweens.getTweensOf(icon).forEach(tween => tween.resume());
  }

  protected abstract getIconIdProps(container: TContainer): {
    female: boolean;
    formIndex: number;
    shiny: boolean;
    variant: number;
  };

  /**
   * Validates that an icon's frame matches the expected sprite for the given
   * species; if not, retextures it to the default-variant fallback.
   */
  protected checkIconId(
    icon: Phaser.GameObjects.Sprite,
    species: PokemonSpecies,
    female: boolean,
    formIndex: number,
    shiny: boolean,
    variant: number,
  ): void {
    if (icon.frame.name !== species.getIconId(female, formIndex, shiny, variant)) {
      console.log(
        `${species.name}'s icon ${icon.frame.name} does not match getIconId with female: ${female}, formIndex: ${formIndex}, shiny: ${shiny}, variant: ${variant}`,
      );
      icon
        .setTexture(species.getIconAtlasKey(formIndex, false, variant))
        .setFrame(species.getIconId(female, formIndex, false, variant));
    }
  }

  /**
   * The base implementation handles filter-bar cursor movement and grid
   * cursor positioning. Subclasses should `super.setCursor(cursor)` and then
   * react to the new species selection.
   */
  public override setCursor(cursor: number): boolean {
    let changed = false;
    this.oldCursor = this.cursor;

    if (this.filterMode) {
      changed = this.filterBarCursor !== cursor;
      this.filterBarCursor = cursor;
      this.filterBar.setCursor(cursor);
    } else {
      cursor = Math.max(Math.min(this.pokemonContainers.length - 1, cursor), 0);
      changed = super.setCursor(cursor);

      const pos = calcContainerPosition(cursor);
      this.cursorObj.setPosition(pos.x - 1, pos.y + 1);
    }
    return changed;
  }

  protected setFilterMode(filterMode: boolean): boolean {
    this.cursorObj.setVisible(!filterMode);
    this.filterBar.cursorObj.setVisible(filterMode);

    if (filterMode !== this.filterMode) {
      this.filterMode = filterMode;
      this.setCursor(filterMode ? this.filterBarCursor : this.cursor);
      return true;
    }
    return false;
  }

  /**
   * Shared LEFT/RIGHT/ACTION navigation while the filter bar is focused.
   * UP/DOWN edges are subclass-specific and so are *not* handled here.
   *
   * @returns `true` if the input was consumed.
   */
  protected processFilterBarHorizontal(button: Button): boolean {
    switch (button) {
      case Button.LEFT:
        return this.setCursor(this.filterBarCursor > 0 ? this.filterBarCursor - 1 : this.filterBar.numFilters - 1);
      case Button.RIGHT:
        return this.setCursor(this.filterBarCursor < this.filterBar.numFilters - 1 ? this.filterBarCursor + 1 : 0);
      case Button.ACTION:
        if (this.filterBar.openDropDown) {
          this.filterBar.toggleOptionState();
        } else {
          this.filterBar.toggleDropDown(this.filterBarCursor);
        }
        return true;
      case Button.UP:
        if (this.filterBar.openDropDown) {
          return this.filterBar.decDropDownCursor();
        }
        return false;
      case Button.DOWN:
        if (this.filterBar.openDropDown) {
          return this.filterBar.incDropDownCursor();
        }
        return false;
    }
    return false;
  }

  /**
   * Tests a `caughtAttr` bigint against the user's CAUGHT-column dropdown
   * selection. Returns `true` if the species passes the filter.
   */
  protected fitsCaughtFilter(caughtAttr: bigint): boolean {
    const isNonShinyCaught = !!(caughtAttr & DexAttr.NON_SHINY);
    const isShinyCaught = !!(caughtAttr & DexAttr.SHINY);
    const isVariant1Caught = isShinyCaught && !!(caughtAttr & DexAttr.DEFAULT_VARIANT);
    const isVariant2Caught = isShinyCaught && !!(caughtAttr & DexAttr.VARIANT_2);
    const isVariant3Caught = isShinyCaught && !!(caughtAttr & DexAttr.VARIANT_3);
    const isUncaught = !isNonShinyCaught && !isVariant1Caught && !isVariant2Caught && !isVariant3Caught;
    return this.filterBar.getVals(DropDownColumn.CAUGHT).some((caught: string) => {
      switch (caught) {
        case "SHINY3":
          return isVariant3Caught;
        case "SHINY2":
          return isVariant2Caught && !isVariant3Caught;
        case "SHINY":
          return isVariant1Caught && !isVariant2Caught && !isVariant3Caught;
        case "NORMAL":
          return isNonShinyCaught && !isVariant1Caught && !isVariant2Caught && !isVariant3Caught;
        case "UNCAUGHT":
          return isUncaught;
      }
      return false;
    });
  }

  protected fitsPassiveFilter(speciesId: number, isUnlocked: boolean, isProgressable: boolean): boolean {
    const isUnlockable = isPassiveAvailable(speciesId, this.getGameData()) && !isUnlocked;
    return this.filterBar.getVals(DropDownColumn.UNLOCKS).some((u: any) => {
      if (u.val !== "PASSIVE") {
        return false;
      }
      switch (u.state) {
        case DropDownState.ON:
          return isUnlocked;
        case DropDownState.EXCLUDE:
          return isProgressable && !isUnlocked;
        case DropDownState.UNLOCKABLE:
          return isUnlockable;
        case DropDownState.OFF:
          return true;
      }
      return false;
    });
  }

  protected fitsCostReductionFilter(speciesId: number, valueReduction: number, isProgressable: boolean): boolean {
    const isOne = valueReduction === 1;
    const isTwo = valueReduction === 2;
    const isUnlockable = isValueReductionAvailable(speciesId, this.getGameData());
    return this.filterBar.getVals(DropDownColumn.UNLOCKS).some((u: any) => {
      if (u.val !== "COST_REDUCTION") {
        return false;
      }
      switch (u.state) {
        case DropDownState.ON:
          return isOne || isTwo;
        case DropDownState.ONE:
          return isOne;
        case DropDownState.TWO:
          return isTwo;
        case DropDownState.EXCLUDE:
          return isProgressable && !(isOne || isTwo);
        case DropDownState.UNLOCKABLE:
          return isUnlockable;
        case DropDownState.OFF:
          return true;
      }
      return false;
    });
  }

  /** Generic on/off/exclude tri-state matcher for a misc-column flag. */
  protected fitsMiscBoolean(key: string, value: boolean): boolean {
    return this.filterBar.getVals(DropDownColumn.MISC).some((misc: any) => {
      if (misc.val !== key) {
        return false;
      }
      switch (misc.state) {
        case DropDownState.ON:
          return value;
        case DropDownState.EXCLUDE:
          return !value;
        case DropDownState.OFF:
          return true;
      }
      return false;
    });
  }

  /** Tri-state matcher with a "progressable" gate on EXCLUDE. */
  protected fitsMiscBooleanGated(key: string, value: boolean, gateOnExclude: boolean): boolean {
    return this.filterBar.getVals(DropDownColumn.MISC).some((misc: any) => {
      if (misc.val !== key) {
        return false;
      }
      switch (misc.state) {
        case DropDownState.ON:
          return value;
        case DropDownState.EXCLUDE:
          return gateOnExclude && !value;
        case DropDownState.OFF:
          return true;
      }
      return false;
    });
  }

  protected fitsHiddenAbility(species: PokemonSpecies, abilityAttr: number): boolean {
    const speciesHasHiddenAbility =
      species.abilityHidden !== species.ability1 && species.abilityHidden !== AbilityId.NONE;
    const hasHA = !!(abilityAttr & AbilityAttr.ABILITY_HIDDEN);
    return this.filterBar.getVals(DropDownColumn.MISC).some((misc: any) => {
      if (misc.val !== "HIDDEN_ABILITY") {
        return false;
      }
      switch (misc.state) {
        case DropDownState.ON:
          return hasHA;
        case DropDownState.EXCLUDE:
          return speciesHasHiddenAbility && !hasHA;
        case DropDownState.OFF:
          return true;
      }
      return false;
    });
  }

  protected fitsClassicWin(classicWinCount: number | undefined): boolean {
    const hasWon = (classicWinCount ?? 0) > 0;
    const hasNotWon = classicWinCount === 0;
    const isUndefined = classicWinCount === undefined;
    return this.filterBar.getVals(DropDownColumn.MISC).some((misc: any) => {
      if (misc.val !== "WIN") {
        return false;
      }
      switch (misc.state) {
        case DropDownState.ON:
          return hasWon;
        case DropDownState.EXCLUDE:
          return hasNotWon || isUndefined;
        case DropDownState.OFF:
          return true;
      }
      return false;
    });
  }

  /**
   * Removes any preferences that aren't actually valid for the given species
   * (unlocked variants, abilities, gender, form, nature). Mutates the input
   * in place and returns it.
   *
   * @param species - species whose preferences are being sanitized
   * @param starterPreferences - the user's preferences for that species
   * @param dexEntry - dex entry to use for caught/seen flags
   * @param starterAbilityAttr - bitmask of unlocked abilities
   */
  protected sanitizeStarterPreferences(
    species: PokemonSpecies,
    starterPreferences: StarterPreferences | undefined,
    dexEntry: DexEntry | undefined,
    starterAbilityAttr: number,
  ): StarterPreferences {
    if (!starterPreferences || !dexEntry?.caughtAttr) {
      return starterPreferences ?? {};
    }
    const caughtAttr = dexEntry.caughtAttr;

    const hasShiny = caughtAttr & DexAttr.SHINY;
    const hasNonShiny = caughtAttr & DexAttr.NON_SHINY;
    if (starterPreferences.shiny && !hasShiny) {
      starterPreferences.shiny = undefined;
      starterPreferences.variant = undefined;
    } else if (starterPreferences.shiny === false && !hasNonShiny) {
      starterPreferences.shiny = undefined;
    }

    if (starterPreferences.variant !== undefined) {
      const unlockedVariants = [
        hasShiny && caughtAttr & DexAttr.DEFAULT_VARIANT,
        hasShiny && caughtAttr & DexAttr.VARIANT_2,
        hasShiny && caughtAttr & DexAttr.VARIANT_3,
      ];
      if (
        Number.isNaN(starterPreferences.variant)
        || starterPreferences.variant < 0
        || !unlockedVariants[starterPreferences.variant]
      ) {
        starterPreferences.variant = undefined;
      }
    }

    if (
      starterPreferences.female !== undefined
      && !(starterPreferences.female ? caughtAttr & DexAttr.FEMALE : caughtAttr & DexAttr.MALE)
    ) {
      starterPreferences.female = undefined;
    }

    if (starterPreferences.abilityIndex !== undefined) {
      const speciesHasSingleAbility = species.ability2 === species.ability1;
      const hasAbility1 = starterAbilityAttr & AbilityAttr.ABILITY_1;
      const hasAbility2 = starterAbilityAttr & AbilityAttr.ABILITY_2;
      const hasHiddenAbility = starterAbilityAttr & AbilityAttr.ABILITY_HIDDEN;
      const unlockedAbilities = [
        hasAbility1,
        speciesHasSingleAbility ? hasAbility2 && !hasAbility1 : hasAbility2,
        hasHiddenAbility,
      ];
      if (!unlockedAbilities[starterPreferences.abilityIndex]) {
        starterPreferences.abilityIndex = undefined;
      }
    }

    const selectedForm = starterPreferences.formIndex;
    if (
      selectedForm !== undefined
      && (!species.forms[selectedForm]?.isStarterSelectable
        || !(caughtAttr & this.getGameData().getFormAttr(selectedForm)))
    ) {
      starterPreferences.formIndex = undefined;
    }

    if (starterPreferences.nature !== undefined) {
      const unlockedNatures = this.getGameData().getNaturesForAttr(dexEntry.natureAttr);
      if (unlockedNatures.indexOf(starterPreferences.nature as unknown as Nature) < 0) {
        starterPreferences.nature = undefined;
      }
    }

    return starterPreferences;
  }

  /**
   * Updates a container's value label to reflect the current cost / discount
   * relative to the species' base starter value.
   *
   * @param starter - the container whose label to update
   * @param starterValue - the (possibly discounted) cost
   */
  protected applyStarterValueLabel(starter: TContainer, starterValue: number): void {
    const speciesId = starter.species.speciesId;
    const baseStarterValue = speciesStarterCosts[speciesId];
    if (baseStarterValue == null) {
      return;
    }
    starter.cost = starterValue;
    let valueStr = starterValue.toString();
    if (valueStr.startsWith("0.")) {
      valueStr = valueStr.slice(1);
    }
    starter.label.setText(valueStr);
    let textStyle: TextStyle;
    switch (baseStarterValue - starterValue) {
      case 0:
        textStyle = TextStyle.WINDOW;
        break;
      case 1:
      case 0.5:
        textStyle = TextStyle.SUMMARY_BLUE;
        break;
      default:
        textStyle = TextStyle.SUMMARY_GOLD;
        break;
    }
    starter.label.setColor(getTextColor(textStyle)).setShadowColor(getTextColor(textStyle, true));
  }

  public override destroy(): void {
    this.pokemonContainers = [];
  }
}
