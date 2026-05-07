import { globalScene } from "#app/global-scene";
import type { PokemonSpecies } from "#data/pokemon-species";
import type { SpeciesId } from "#enums/species-id";
import { TextStyle } from "#enums/text-style";
import type { DexAttrProps } from "#types/save-data";
import { addTextObject } from "#ui/text";
import { getPokemonSpecies } from "#utils/pokemon-utils";
import Label from "phaser3-rex-plugins/templates/ui/label/Label";

export const STARTER_CONTAINER_WIDTH = 18;
export const STARTER_CONTAINER_HEIGHT = 17;

export class StarterContainer extends Label {
  public species: PokemonSpecies;
  public content: Phaser.GameObjects.Container;

  public icon: Phaser.GameObjects.Sprite;
  public shinyIcons: Phaser.GameObjects.Image[] = [];
  public label: Phaser.GameObjects.Text;
  public starterPassiveBgs: Phaser.GameObjects.Image;
  public hiddenAbilityIcon: Phaser.GameObjects.Image;
  public favoriteIcon: Phaser.GameObjects.Image;
  public classicWinIcon: Phaser.GameObjects.Image;
  public candyUpgradeIcon: Phaser.GameObjects.Image;
  public candyUpgradeOverlayIcon: Phaser.GameObjects.Image;

  public cost = 0;

  constructor(speciesId: SpeciesId) {
    const content = globalScene.add.container(0, 0);

    super(globalScene, {
      width: STARTER_CONTAINER_WIDTH,
      height: STARTER_CONTAINER_HEIGHT,
      icon: content,
      align: "center",
    });

    globalScene.add.existing(this);
    this.content = content;

    const defaultProps = globalScene.gameData.getSpeciesDefaultDexAttrProps(speciesId);
    this.content = content;

    this.setSpecies(speciesId, defaultProps);

    const starterPassiveBg = globalScene.add.image(2, 5, "passive_bg").setOrigin(0).setScale(0.75).setVisible(false);

    content.add(starterPassiveBg);
    this.starterPassiveBgs = starterPassiveBg;

    for (let i = 0; i < 3; i++) {
      const shinyIcon = globalScene.add
        .image(i * -3 + 12, 2, "shiny_star_small")
        .setScale(0.5)
        .setOrigin(0)
        .setVisible(false);

      this.shinyIcons.push(shinyIcon);
    }
    content.add(this.shinyIcons);

    this.label = addTextObject(1, 2, "0", TextStyle.WINDOW, {
      fontSize: "32px",
    })
      .setOrigin(0)
      .setVisible(false);
    this.label.setShadowOffset(2, 2);
    content.add(this.label);

    this.hiddenAbilityIcon = globalScene.add.image(12, 7, "ha_capsule").setOrigin(0).setScale(0.5).setVisible(false);
    this.favoriteIcon = globalScene.add.image(0, 7, "favorite").setOrigin(0).setScale(0.5).setVisible(false);
    this.classicWinIcon = globalScene.add.image(0, 12, "champion_ribbon").setOrigin(0).setScale(0.5).setVisible(false);
    this.candyUpgradeIcon = globalScene.add.image(12, 12, "candy").setOrigin(0).setScale(0.25).setVisible(false);

    this.candyUpgradeOverlayIcon = globalScene.add
      .image(12, 12, "candy_overlay")
      .setOrigin(0)
      .setScale(0.25)
      .setVisible(false);

    content.add([
      this.hiddenAbilityIcon,
      this.favoriteIcon,
      this.classicWinIcon,
      this.candyUpgradeIcon,
      this.candyUpgradeOverlayIcon,
    ]);
  }

  public activateCursor(cursor: Phaser.GameObjects.Image) {
    this.content.addAt(cursor, 0);
    cursor.setOrigin(0.5, 0.5);
    cursor.setPosition(-1, 1);
  }

  public removeCursor(cursor: Phaser.GameObjects.Image) {
    if (!this.content.exists(cursor)) {
      return;
    }
    this.content.remove(cursor);
  }

  setSpecies(speciesId: SpeciesId, props: DexAttrProps) {
    this.species = getPokemonSpecies(speciesId);

    const { shiny, formIndex, female, variant } = props;

    if (this.icon) {
      this.content.remove(this.icon);
      this.icon.destroy();
    }

    // icon
    this.icon = globalScene.add
      .sprite(-2, 2, this.species.getIconAtlasKey(formIndex, shiny, variant))
      .setScale(0.5)
      .setOrigin(0)
      .setFrame(this.species.getIconId(female, formIndex, shiny, variant))
      .setTint(0);
    this.checkIconId(female, formIndex, shiny, variant);
    this.content.add(this.icon);

    [
      this.label,
      this.hiddenAbilityIcon,
      this.favoriteIcon,
      this.classicWinIcon,
      this.candyUpgradeIcon,
      this.candyUpgradeOverlayIcon,
    ].forEach(icon => {
      if (icon) {
        this.content.bringToTop(icon);
      }
    });
  }

  checkIconId(female, formIndex, shiny, variant) {
    if (this.icon.frame.name !== this.species.getIconId(female, formIndex, shiny, variant)) {
      console.log(`${this.species.name}'s variant icon does not exist. Replacing with default.`);
      this.icon.setTexture(this.species.getIconAtlasKey(formIndex, false, variant));
      this.icon.setFrame(this.species.getIconId(female, formIndex, false, variant));
    }
  }
}
