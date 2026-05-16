import { globalScene } from "#app/global-scene";
import type { Egg } from "#data/egg";
import { Button } from "#enums/buttons";
import { TextStyle } from "#enums/text-style";
import { UiMode } from "#enums/ui-mode";
import { MessageUiHandler } from "#ui/message-ui-handler";
import { PokemonIconAnimHelper, PokemonIconAnimMode } from "#ui/pokemon-icon-anim-helper";
import { ScrollableGridHelper } from "#ui/scrollable-grid-helper";
import { addTextObject } from "#ui/text";
import { addWindow } from "#ui/ui-theme";
import i18next from "i18next";

const ROWS = 9;
const COLS = 11;

export class EggListUiHandler extends MessageUiHandler {
  private eggListContainer: Phaser.GameObjects.Container;
  private eggSprite: Phaser.GameObjects.Sprite;
  private eggNameText: Phaser.GameObjects.Text;
  private eggDateText: Phaser.GameObjects.Text;
  private eggHatchWavesText: Phaser.GameObjects.Text;
  private eggGachaInfoText: Phaser.GameObjects.Text;
  private eggListMessageBoxContainer: Phaser.GameObjects.Container;

  private gridHelper: ScrollableGridHelper<Phaser.GameObjects.Sprite, Egg>;
  private lastAnimatedIcon: Phaser.GameObjects.Sprite | null = null;

  private iconAnimHandler: PokemonIconAnimHelper;

  constructor() {
    super(UiMode.EGG_LIST);
  }

  setup() {
    const ui = this.getUi();

    this.eggListContainer = globalScene.add.container(0, -globalScene.scaledCanvas.height).setVisible(false);
    ui.add(this.eggListContainer);

    const bgColor = globalScene.add
      .rectangle(0, 0, globalScene.scaledCanvas.width, globalScene.scaledCanvas.height, 0x006860)
      .setOrigin(0);
    const eggListBg = globalScene.add.image(0, 0, "egg_list_bg").setOrigin(0);

    this.iconAnimHandler = new PokemonIconAnimHelper();
    this.iconAnimHandler.setup();

    this.eggNameText = addTextObject(8, 68, "", TextStyle.SUMMARY).setOrigin(0);
    this.eggDateText = addTextObject(8, 91, "", TextStyle.EGG_LIST);
    this.eggHatchWavesText = addTextObject(8, 108, "", TextStyle.EGG_LIST).setWordWrapWidth(540);
    this.eggGachaInfoText = addTextObject(8, 152, "", TextStyle.EGG_LIST).setWordWrapWidth(540);

    this.eggSprite = globalScene.add.sprite(54, 37, "egg");

    this.gridHelper = new ScrollableGridHelper<Phaser.GameObjects.Sprite, Egg>(0, 0, {
      rows: ROWS,
      columns: COLS,
      scrollBar: { x: 310, y: 5, width: 4, height: 170 },
      cells: {
        x: 113,
        y: 5,
        spacingX: 18,
        spacingY: 18,
        createCell: () => globalScene.add.sprite(0, 0, "egg_icons").setScale(0.5).setOrigin(0),
        renderCell: (cell, egg) => {
          cell.setFrame(egg.getKey());
          this.iconAnimHandler.addOrUpdate(cell, PokemonIconAnimMode.NONE);
        },
      },
      cursor: { texture: "select_cursor", width: 18, height: 18 },
      onItemSelected: (cell, egg) => this.onEggSelected(cell, egg),
    });

    this.eggListMessageBoxContainer = globalScene.add.container(0, globalScene.scaledCanvas.height).setVisible(false);
    const eggListMessageBox = addWindow(1, -1, 318, 28).setOrigin(0, 1);
    this.eggListMessageBoxContainer.add(eggListMessageBox);

    // Message isn't used, but is expected to exist as this subclasses MessageUiHandler
    this.message = addTextObject(8, -8, "", TextStyle.WINDOW, { maxLines: 1 }).setActive(false).setVisible(false);

    this.cursor = -1;

    this.eggListContainer.add([
      bgColor,
      eggListBg,
      addWindow(1, 85, 106, 22),
      addWindow(1, 102, 106, 50, true),
      addWindow(1, 147, 106, 32, true),
      addWindow(107, 1, 212, 178),
      this.eggNameText,
      this.eggDateText,
      this.eggHatchWavesText,
      this.eggGachaInfoText,
      this.gridHelper,
      this.eggSprite,
    ]);
  }

  override show(args: any[]): boolean {
    super.show(args);

    this.getUi().bringToTop(this.eggListContainer);
    this.eggListContainer.setVisible(true);

    this.gridHelper.setItems(globalScene.gameData.eggs);

    return true;
  }

  /**
   * Grid callback for when the highlighted egg changes.
   */
  private onEggSelected(cell: Phaser.GameObjects.Sprite, egg: Egg): void {
    if (this.lastAnimatedIcon) {
      this.iconAnimHandler.addOrUpdate(this.lastAnimatedIcon, PokemonIconAnimMode.NONE);
    }
    this.iconAnimHandler.addOrUpdate(cell, PokemonIconAnimMode.ACTIVE);
    this.lastAnimatedIcon = cell;

    this.showEggDetails(egg);
  }

  /**
   * Update the information panel for the given egg.
   */
  private showEggDetails(egg: Egg): void {
    this.eggSprite.setFrame(`egg_${egg.getKey()}`);
    this.eggNameText.setText(`${i18next.t("egg:egg")} (${egg.getEggDescriptor()})`);
    this.eggDateText.setText(
      new Date(egg.timestamp).toLocaleString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
      }),
    );
    this.eggHatchWavesText.setText(egg.getEggHatchWavesMessage());
    this.eggGachaInfoText.setText(egg.getEggTypeDescriptor());
  }

  processInput(button: Button): boolean {
    const ui = this.getUi();
    let success = false;

    if (button === Button.CANCEL) {
      ui.revertMode();
      success = true;
    } else {
      success = this.gridHelper.processInput(button);
    }

    if (success) {
      ui.playSelect();
    }

    return success;
  }

  clear(): void {
    super.clear();
    this.gridHelper.reset();
    this.cursor = -1;
    this.lastAnimatedIcon = null;
    this.eggListContainer.setVisible(false);
    this.iconAnimHandler.removeAll();
  }
}
