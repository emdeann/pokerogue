import { globalScene } from "#app/global-scene";
import type { SpeciesId } from "#enums/species-id";
import type { DexAttrProps } from "#types/save-data";
import { getPokemonSpecies } from "#utils/pokemon-utils";
import { PokemonContainer } from "./pokemon-container";

export class StarterContainer extends PokemonContainer {
  constructor(speciesId: SpeciesId) {
    super();

    const defaultProps = globalScene.gameData.getSpeciesDefaultDexAttrProps(speciesId);
    this.setSpecies(speciesId, defaultProps);
  }

  public activateCursor(cursor: Phaser.GameObjects.Image): void {
    this.content.addAt(cursor, 0);
    cursor.setOrigin(0.5, 0.5);
    cursor.setPosition(-1, 1);
  }

  public removeCursor(cursor: Phaser.GameObjects.Image): void {
    if (!this.content.exists(cursor)) {
      return;
    }
    this.content.remove(cursor);
  }

  setSpecies(speciesId: SpeciesId, props: DexAttrProps): void {
    this.updateIcon(getPokemonSpecies(speciesId), props);
    this.icon.setTint(0);
  }
}
