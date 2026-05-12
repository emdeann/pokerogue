import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { PlayerGender } from "#enums/player-gender";
import { TextStyle } from "#enums/text-style";
import type { UiMode } from "#enums/ui-mode";
import type { Achv } from "#system/achv";
import { achvs, getAchievementDescription } from "#system/achv";
import type { Voucher } from "#system/voucher";
import { getVoucherTypeIcon, getVoucherTypeName, vouchers } from "#system/voucher";
import type { AchvUnlocks, VoucherUnlocks } from "#types/save-data";
import { MessageUiHandler } from "#ui/message-ui-handler";
import { ScrollableGridHelper } from "#ui/scrollable-grid-helper";
import { addTextObject } from "#ui/text";
import { addWindow } from "#ui/ui-theme";
import i18next from "i18next";

const Page = {
  ACHIEVEMENTS: 0,
  VOUCHERS: 1,
} as const;
type Page = (typeof Page)[keyof typeof Page];

interface LanguageSetting {
  TextSize: string;
}

const languageSettings: { [key: string]: LanguageSetting } = {
  de: { TextSize: "80px" },
};

const COLS = 18;
const SHOWN_ROWS = 4;

export class AchvsUiHandler extends MessageUiHandler {
  private mainContainer: Phaser.GameObjects.Container;
  private iconsContainer: Phaser.GameObjects.Container;

  private headerBg: Phaser.GameObjects.NineSlice;
  private headerText: Phaser.GameObjects.Text;
  private headerActionText: Phaser.GameObjects.Text;
  private headerActionButton: Phaser.GameObjects.Sprite;
  private headerBgX: number;
  private iconsBg: Phaser.GameObjects.NineSlice;
  private icons: Phaser.GameObjects.Sprite[];

  private titleBg: Phaser.GameObjects.NineSlice;
  private titleText: Phaser.GameObjects.Text;
  private scoreContainer: Phaser.GameObjects.Container;
  private scoreText: Phaser.GameObjects.Text;
  private unlockText: Phaser.GameObjects.Text;

  private achvsName: string;
  private readonly achvsTotal: number;
  private vouchersName: string;
  private readonly vouchersTotal: number;

  private gridHelper: ScrollableGridHelper;
  private cursorObj: Phaser.GameObjects.NineSlice | null;
  private currentPage: Page;

  constructor(mode: UiMode | null = null) {
    super(mode);

    this.achvsTotal = Object.keys(achvs).length;
    this.vouchersTotal = Object.keys(vouchers).length;
  }

  setup() {
    const ui = this.getUi();

    /** Width of the global canvas / 6 */
    const WIDTH = globalScene.scaledCanvas.width;
    /** Height of the global canvas / 6 */
    const HEIGHT = globalScene.scaledCanvas.height;

    this.mainContainer = globalScene.add.container(1, -HEIGHT + 1);
    this.mainContainer.setInteractive(new Phaser.Geom.Rectangle(0, 0, WIDTH, HEIGHT), Phaser.Geom.Rectangle.Contains);

    this.headerBg = addWindow(0, 0, WIDTH - 2, 24);

    this.headerText = addTextObject(0, 0, "", TextStyle.HEADER_LABEL)
      .setOrigin(0)
      .setPositionRelative(this.headerBg, 8, 4);
    this.headerActionButton = new Phaser.GameObjects.Sprite(globalScene, 0, 0, "keyboard", "ACTION.png")
      .setOrigin(0)
      .setPositionRelative(this.headerBg, 236, 6);
    this.headerActionText = addTextObject(0, 0, "", TextStyle.WINDOW, { fontSize: "60px" })
      .setOrigin(0)
      .setPositionRelative(this.headerBg, 264, 8);

    // We need to get the player gender from the game data to add the correct prefix to the achievement name
    const genderIndex = globalScene.gameData.gender ?? PlayerGender.MALE;
    const genderStr = PlayerGender[genderIndex].toLowerCase();

    this.achvsName = i18next.t("achv:achievements.name", { context: genderStr });
    this.vouchersName = i18next.t("voucher:vouchers");

    this.iconsBg = addWindow(0, this.headerBg.height, WIDTH - 2, HEIGHT - this.headerBg.height - 68).setOrigin(0);

    const yOffset = 6;
    this.gridHelper = new ScrollableGridHelper(
      SHOWN_ROWS,
      COLS,
      this.iconsBg.width - 9,
      this.iconsBg.y + yOffset,
      4,
      this.iconsBg.height - yOffset * 2,
    );

    this.iconsContainer = globalScene.add.container(5, this.headerBg.height + 8);

    this.icons = [];

    for (let a = 0; a < SHOWN_ROWS * COLS; a++) {
      const x = (a % COLS) * 17;
      const y = Math.floor(a / COLS) * 19;

      const icon = globalScene.add.sprite(x, y, "items", "unknown").setOrigin(0).setScale(0.5);

      this.icons.push(icon);
      this.iconsContainer.add(icon);
    }

    const titleBg = addWindow(0, this.headerBg.height + this.iconsBg.height, 174, 24);
    this.titleBg = titleBg;

    this.titleText = addTextObject(0, 0, "", TextStyle.WINDOW).setOrigin();
    const textSize = languageSettings[i18next.language]?.TextSize ?? this.titleText.style.fontSize;
    this.titleText.setFontSize(textSize);
    const titleBgCenterX = titleBg.x + titleBg.width / 2;
    const titleBgCenterY = titleBg.y + titleBg.height / 2;
    this.titleText.setPosition(titleBgCenterX, titleBgCenterY);

    this.scoreContainer = globalScene.add.container(titleBg.x + titleBg.width, titleBg.y);
    const scoreBg = addWindow(0, 0, 46, 24);

    this.scoreText = addTextObject(scoreBg.width / 2, scoreBg.height / 2, "", TextStyle.WINDOW).setOrigin();
    this.scoreContainer.add([scoreBg, this.scoreText]);

    const unlockBg = addWindow(this.scoreContainer.x + scoreBg.width, titleBg.y, 98, 24);

    this.unlockText = addTextObject(0, 0, "", TextStyle.WINDOW)
      .setPositionRelative(unlockBg, unlockBg.width / 2, unlockBg.height / 2)
      .setOrigin();

    const descriptionBg = addWindow(0, titleBg.y + titleBg.height, WIDTH - 2, 42);

    const descriptionText = addTextObject(0, 0, "", TextStyle.WINDOW, { maxLines: 2 })
      .setWordWrapWidth(1870)
      .setOrigin(0)
      .setPositionRelative(descriptionBg, 8, 4);

    this.message = descriptionText;

    this.mainContainer.add([
      this.headerBg,
      this.headerActionButton,
      this.headerText,
      this.headerActionText,
      this.iconsBg,
      this.gridHelper.getScrollBar(),
      this.iconsContainer,
      titleBg,
      this.titleText,
      this.scoreContainer,
      unlockBg,
      this.unlockText,
      descriptionBg,
      descriptionText,
    ]);

    ui.add(this.mainContainer);

    this.gridHelper
      .withCursorCallback(() => this.updateCursorPosition())
      .withUpdateGridCallBack(() => this.updateCurrentPageIcons())
      .withUpdateSingleElementCallback(index => this.updateCurrentPageDetails(index));

    this.currentPage = Page.ACHIEVEMENTS;

    this.mainContainer.setVisible(false);
  }

  show(args: any[]): boolean {
    super.show(args);

    this.headerBgX = this.headerBg.getTopRight().x;

    if (this.currentPage === Page.ACHIEVEMENTS) {
      this.gridHelper.setTotalElements(this.achvsTotal);
    } else {
      this.gridHelper.setTotalElements(this.vouchersTotal);
    }

    this.updateCurrentPageIcons();

    this.mainContainer.setVisible(true);
    this.updateCursorPosition();

    this.getUi().moveTo(this.mainContainer, this.getUi().length - 1);

    this.getUi().hideTooltip();

    return true;
  }

  protected showAchv(achv: Achv) {
    // We need to get the player gender from the game data to add the correct prefix to the achievement name
    const genderIndex = globalScene.gameData.gender ?? PlayerGender.MALE;
    const genderStr = PlayerGender[genderIndex].toLowerCase();

    achv.name = i18next.t(`achv:${achv.localizationKey}.name`, {
      context: genderStr,
    });
    achv.description = getAchievementDescription(achv.localizationKey);
    const achvUnlocks = globalScene.gameData.achvUnlocks;
    const unlocked = Object.hasOwn(achvUnlocks, achv.id);
    const hidden = !unlocked && achv.secret && (!achv.parentId || !Object.hasOwn(achvUnlocks, achv.parentId));
    this.titleText.setText(unlocked ? achv.name : "???");
    this.showText(hidden ? "" : achv.description);
    this.scoreText.setText(`${achv.score}pt`);
    this.unlockText.setText(
      unlocked ? new Date(achvUnlocks[achv.id]).toLocaleDateString() : i18next.t("achv:locked.name"),
    );
  }

  protected showVoucher(voucher: Voucher) {
    const voucherUnlocks = globalScene.gameData.voucherUnlocks;
    const unlocked = Object.hasOwn(voucherUnlocks, voucher.id);

    this.titleText.setText(getVoucherTypeName(voucher.voucherType));
    this.showText(voucher.description);
    this.unlockText.setText(
      unlocked ? new Date(voucherUnlocks[voucher.id]).toLocaleDateString() : i18next.t("voucher:locked"),
    );
  }

  /**
   * Update details for the currently selected element
   * @param index The absolute index in the current page's data
   */
  private updateCurrentPageDetails(index: number): void {
    if (this.currentPage === Page.ACHIEVEMENTS) {
      this.showAchv(achvs[Object.keys(achvs)[index]]);
    } else {
      this.showVoucher(vouchers[Object.keys(vouchers)[index]]);
    }
  }

  /**
   * Update all icons for the current page
   */
  private updateCurrentPageIcons(): void {
    this.currentPage === Page.ACHIEVEMENTS ? this.updateAchvIcons() : this.updateVoucherIcons();
  }

  /**
   * Update the visual cursor position and details based on the helper's current cursor state
   * @param pageChange whether this is part of a page/mode change that requires visual updates
   */
  private updateCursorPosition(pageChange?: boolean): void {
    const cursor = this.gridHelper.getCursor();

    if (!this.cursorObj) {
      this.cursorObj = globalScene.add
        .nineslice(0, 0, "select_cursor_highlight", undefined, 16, 16, 1, 1, 1, 1)
        .setOrigin(0);
      this.iconsContainer.add(this.cursorObj);
    }

    this.cursorObj.setPositionRelative(this.icons[cursor], 0, 0);
    const itemOffset = this.gridHelper.getItemOffset();
    switch (this.currentPage) {
      case Page.ACHIEVEMENTS:
        if (pageChange) {
          this.titleBg.width = 174;
          this.titleText.x = this.titleBg.width / 2;
          this.scoreContainer.setVisible(true);
        }
        this.showAchv(achvs[Object.keys(achvs)[cursor + itemOffset]]);
        break;
      case Page.VOUCHERS:
        if (pageChange) {
          this.titleBg.width = 220;
          this.titleText.x = this.titleBg.width / 2;
          this.scoreContainer.setVisible(false);
        }
        this.showVoucher(vouchers[Object.keys(vouchers)[cursor + itemOffset]]);
        break;
    }
  }

  /**
   * Submethod of {@linkcode processInput} that handles the action button input
   * @returns Whether the success sound should be played
   */
  private processActionInput(): true {
    const newPage = this.currentPage === Page.ACHIEVEMENTS ? Page.VOUCHERS : Page.ACHIEVEMENTS;
    const newTotal = newPage === Page.ACHIEVEMENTS ? this.achvsTotal : this.vouchersTotal;

    this.currentPage = newPage;
    this.gridHelper.setTotalElements(newTotal);
    this.updateCurrentPageIcons();
    this.updateCursorPosition(true);
    this.mainContainer.update();
    return true;
  }

  /**
   * Process user input to navigate through the achievements and vouchers UI.
   * @param button - The button that was pressed
   * @returns Whether an action was successfully processed
   */
  processInput(button: Button): boolean {
    let success = false;

    switch (button) {
      case Button.ACTION:
        success = this.processActionInput();
        break;
      case Button.CANCEL:
        success = true;
        globalScene.ui.revertMode();
        break;
      case Button.UP:
      case Button.DOWN:
      case Button.LEFT:
      case Button.RIGHT:
        success = this.gridHelper.processInput(button);
        break;
    }

    if (success) {
      this.getUi().playSelect();
    }

    return success;
  }
  // #endregion Input Processing

  /**
   * This method now delegates to the grid helper for cursor state.
   * @param _cursor the cursor position (ignored - for compatibility only)
   * @param _pageChange whether this is a page change
   * @returns always true for compatibility
   */
  setCursor(_cursor: number, _pageChange?: boolean): boolean {
    this.updateCursorPosition(_pageChange);
    return true;
  }

  /**
   * Updates the icons displayed on the UI based on the current page and scroll cursor.
   * @param items - The items to display (achievements or vouchers).
   * @param unlocks - The unlocks data for the items.
   * @param headerText - The text for the header.
   * @param actionText - The text for the action button.
   * @param forAchievements - `True` when updating icons for the achievements page, `false` for the vouchers page.
   */
  private updateIcons<T extends boolean>(
    items: T extends true ? Achv[] : Voucher[],
    unlocks: T extends true ? AchvUnlocks : VoucherUnlocks,
    headerText: string,
    actionText: string,
    forAchievements: T,
  ): void {
    this.headerText.text = headerText;
    this.headerActionText.text = actionText;
    const textPosition = this.headerBgX - this.headerActionText.displayWidth - 8;
    this.headerActionText.setX(textPosition);
    this.headerActionButton.setX(textPosition - this.headerActionButton.displayWidth - 4);

    const itemOffset = this.gridHelper.getItemOffset();
    const itemLimit = SHOWN_ROWS * COLS;

    const itemRange = items.slice(itemOffset, itemLimit + itemOffset);

    itemRange.forEach((item: (typeof itemRange)[0], i: number) => {
      const icon = this.icons[i];
      const unlocked = Object.hasOwn(unlocks, item.id);
      let tinted = !unlocked;
      if (forAchievements) {
        // Typescript cannot properly infer the type of `item` here, so we need to cast it
        const achv = item as Achv;
        const hidden = !unlocked && achv.secret && (!achv.parentId || !Object.hasOwn(unlocks, achv.parentId));
        tinted &&= !hidden;
        icon.setFrame(hidden ? "unknown" : achv.iconImage);
      } else {
        icon.setFrame(getVoucherTypeIcon((item as Voucher).voucherType));
      }

      icon.setVisible(true);
      if (tinted) {
        icon.setTintFill(0);
      } else {
        icon.clearTint();
      }
    });

    if (itemRange.length < this.icons.length) {
      this.icons.slice(itemRange.length).forEach(i => i.setVisible(false));
    }
  }

  /**
   * Update the achievement icons displayed on the UI based on the current scroll cursor.
   */
  updateAchvIcons(): void {
    this.updateIcons(Object.values(achvs), globalScene.gameData.achvUnlocks, this.achvsName, this.vouchersName, true);
  }

  /**
   * Update the voucher icons displayed on the UI based on the current scroll cursor.
   */
  updateVoucherIcons(): void {
    this.updateIcons(
      Object.values(vouchers),
      globalScene.gameData.voucherUnlocks,
      this.vouchersName,
      this.achvsName,
      false,
    );
  }

  clear() {
    super.clear();
    this.currentPage = Page.ACHIEVEMENTS;
    this.mainContainer.setVisible(false);
    this.gridHelper.reset();
    this.updateCursorPosition(true);
    this.eraseCursor();
  }

  eraseCursor() {
    if (this.cursorObj) {
      this.cursorObj.destroy();
    }
    this.cursorObj = null;
  }
}
