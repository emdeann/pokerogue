import { globalScene } from "#app/global-scene";
import type { PokemonSpecies } from "#data/pokemon-species";
import type { SpeciesDetails } from "#ui/starter-select-ui-utils";
import { PokemonContainer } from "./pokemon-container";

export class PokedexMonContainer extends PokemonContainer {
  public eggMove1Icon: Phaser.GameObjects.Image;
  public tmMove1Icon: Phaser.GameObjects.Image;
  public eggMove2Icon: Phaser.GameObjects.Image;
  public tmMove2Icon: Phaser.GameObjects.Image;
  public passive1Icon: Phaser.GameObjects.Image;
  public passive2Icon: Phaser.GameObjects.Image;
  public passive1OverlayIcon: Phaser.GameObjects.Image;
  public passive2OverlayIcon: Phaser.GameObjects.Image;

  constructor(species: PokemonSpecies, options: SpeciesDetails = {}) {
    super();

    this.setSpecies(species, options);
    this.initPokedexElements();
  }

  private initPokedexElements(): void {
    this.eggMove1Icon = globalScene.add.image(0, 12, "common_egg").setOrigin(0, -0.03).setScale(0.24).setVisible(false);
    this.tmMove1Icon = globalScene.add.image(0, 12, "normal_memory").setOrigin(0).setScale(0.25).setVisible(false);
    this.eggMove2Icon = globalScene.add.image(7, 12, "common_egg").setOrigin(0).setScale(0.25).setVisible(false);
    this.tmMove2Icon = globalScene.add.image(7, 12, "normal_memory").setOrigin(0).setScale(0.25).setVisible(false);
    this.passive1Icon = globalScene.add.image(3, 3, "candy").setOrigin(0).setScale(0.25).setVisible(false);
    this.passive1OverlayIcon = globalScene.add
      .image(12, 12, "candy_overlay")
      .setOrigin(0)
      .setScale(0.25)
      .setVisible(false);
    this.passive2Icon = globalScene.add.image(12, 3, "candy").setOrigin(0).setScale(0.25).setVisible(false);
    this.passive2OverlayIcon = globalScene.add
      .image(12, 12, "candy_overlay")
      .setOrigin(0)
      .setScale(0.25)
      .setVisible(false);

    this.content.add([
      this.eggMove1Icon,
      this.tmMove1Icon,
      this.eggMove2Icon,
      this.tmMove2Icon,
      this.passive1Icon,
      this.passive1OverlayIcon,
      this.passive2Icon,
      this.passive2OverlayIcon,
    ]);
  }

  protected override getOverlayIcons(): Phaser.GameObjects.GameObject[] {
    return [
      ...super.getOverlayIcons(),
      this.eggMove1Icon,
      this.tmMove1Icon,
      this.eggMove2Icon,
      this.tmMove2Icon,
      this.passive1Icon,
      this.passive2Icon,
      this.passive1OverlayIcon,
      this.passive2OverlayIcon,
    ];
  }

  setSpecies(species: PokemonSpecies, options: SpeciesDetails = {}): void {
    const defaultProps = globalScene.gameData.getSpeciesDefaultDexAttrProps(species.speciesId);

    const { shiny, formIndex, female, variant } = options;

    if (formIndex != null) {
      defaultProps.formIndex = formIndex;
    }
    if (shiny != null) {
      defaultProps.shiny = shiny;
    }
    if (variant != null) {
      defaultProps.variant = variant;
    }
    if (female != null) {
      defaultProps.female = female;
    }

    this.updateIcon(species, defaultProps);
  }
}
