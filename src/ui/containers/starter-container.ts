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

  public setSpecies(speciesId: SpeciesId, props: DexAttrProps): void {
    this.updateIcon(getPokemonSpecies(speciesId), props);
    this.icon.setTint(0);
  }
}
