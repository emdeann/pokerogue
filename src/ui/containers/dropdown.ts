import { globalScene } from "#app/global-scene";
import { TextStyle } from "#enums/text-style";
import { ScrollBar } from "#ui/scroll-bar";
import { addTextObject } from "#ui/text";
import { addWindow, WindowVariant } from "#ui/ui-theme";
import { coerceArray } from "#utils/array";
import i18next from "i18next";
import { Buttons, Label } from "phaser3-rex-plugins/templates/ui/ui-components.js";

export enum DropDownState {
  ON = 0,
  OFF = 1,
  EXCLUDE = 2,
  UNLOCKABLE = 3,
  ONE = 4,
  TWO = 5,
}

export enum DropDownType {
  SINGLE = 0,
  MULTI = 1,
  HYBRID = 2,
  RADIAL = 3,
}

export enum SortDirection {
  ASC = -1,
  DESC = 1,
}

export enum SortCriteria {
  NUMBER = 0,
  COST = 1,
  CANDY = 2,
  IV = 3,
  NAME = 4,
  CAUGHT = 5,
  HATCHED = 6,
}

export class DropDownLabel {
  public state: DropDownState;
  public text: string;
  public sprite?: Phaser.GameObjects.Sprite | undefined;

  constructor(label: string, sprite?: Phaser.GameObjects.Sprite, state: DropDownState = DropDownState.OFF) {
    this.text = label || "";
    this.sprite = sprite;
    this.state = state;
  }
}

const OPTION_ON_COLOR = 0x33bbff;
const OPTION_OFF_COLOR = 0x272727;
const OPTION_EXCLUDE_COLOR = 0xff5555;
const OPTION_UNLOCKABLE_COLOR = 0xffff00;
const OPTION_ONE_COLOR = 0x33bbff;
const OPTION_TWO_COLOR = 0x33bbff;

/**
 * Exposes the parameters, allowing parameters to be collected
 * without instantiation. This way, only {@linkcode DropDown}s create
 * options, and as a result there can't be mismatches with types
 */
export interface DropDownOptionParams {
  key: string | number;
  labels: DropDownLabel | DropDownLabel[];
}

export class DropDownOption extends Label {
  public state: DropDownState = DropDownState.ON;
  public toggle: Phaser.GameObjects.Sprite;
  public key: string | number;
  public dir: SortDirection = SortDirection.ASC;
  private currentLabelIndex: number;
  private readonly labels: DropDownLabel[];

  constructor({ key, labels }: DropDownOptionParams, type: DropDownType) {
    labels = coerceArray(labels);
    const sprite = labels[0].sprite;
    let toggle: Phaser.GameObjects.Sprite;

    if (type === DropDownType.SINGLE) {
      toggle = globalScene.add.sprite(0, 0, "cursor");
      toggle.setScale(0.5);
      toggle.setOrigin(0, 0.5);
      toggle.setRotation((Math.PI / 180) * -90);
    } else {
      toggle = globalScene.add.sprite(0, 0, "candy");
      toggle.setScale(0.3);
      toggle.setOrigin(0, 0.5);
    }

    super(globalScene, {
      text: addTextObject(0, 0, labels[0].text ?? "", TextStyle.TOOLTIP_CONTENT),
      space: {
        icon: 3,
      },
      ...(sprite != null && { action: sprite }),
      ...(toggle != null && { icon: toggle }),
    });
    globalScene.add.existing(this);
    this.key = key;
    this.toggle = toggle;

    this.labels = coerceArray(labels);
    this.currentLabelIndex = 0;
    const currentLabel = this.labels[this.currentLabelIndex];

    this.state = currentLabel.state;
  }

  /**
   * Set the visible status of the toggle icon and update its color
   * @param visible whether the icon should be visible or not
   */
  public updateToggleIcon(visible: boolean): void {
    this.toggle.setVisible(visible);
    this.updateToggleIconColor();
  }

  /**
   * Set the toggle icon color based on the current state
   */
  private updateToggleIconColor(): void {
    switch (this.state) {
      case DropDownState.ON:
        this.toggle.setTint(OPTION_ON_COLOR);
        break;
      case DropDownState.OFF:
        this.toggle.setTint(OPTION_OFF_COLOR);
        break;
      case DropDownState.EXCLUDE:
        this.toggle.setTint(OPTION_EXCLUDE_COLOR);
        break;
      case DropDownState.UNLOCKABLE:
        this.toggle.setTint(OPTION_UNLOCKABLE_COLOR);
        break;
      case DropDownState.ONE:
        this.toggle.setTint(OPTION_ONE_COLOR);
        break;
      case DropDownState.TWO:
        this.toggle.setTint(OPTION_TWO_COLOR);
        break;
    }
  }

  /**
   * Switch the option to its next state and update visuals
   * If only ON/OFF are possible, toggle between the two
   * For radials, move to the next state in the list
   * @returns the updated DropDownState
   */
  public toggleOptionState(): DropDownState {
    if (this.labels.length > 1) {
      return this.setCurrentLabel((this.currentLabelIndex + 1) % this.labels.length);
    }
    const newState = this.state === DropDownState.ON ? DropDownState.OFF : DropDownState.ON;
    return this.setOptionState(newState);
  }

  /**
   * Set the option to the given state and update visuals
   * @param newState the state to switch to
   * @returns the new DropDownState
   */
  public setOptionState(newState: DropDownState): DropDownState {
    const newLabelIndex = this.labels.findIndex(label => label.state === newState);
    if (newLabelIndex !== -1 && newLabelIndex !== this.currentLabelIndex) {
      return this.setCurrentLabel(newLabelIndex);
    }

    this.state = newState;
    this.updateToggleIconColor();
    return newState;
  }

  /**
   * Change the option state to the one at the given index and update visuals
   * @param index index of the state to switch to
   * @returns the new DropDownState
   */
  private setCurrentLabel(index: number): DropDownState {
    const newLabel = this.labels[index];

    if (!newLabel) {
      return this.state;
    }

    this.currentLabelIndex = index;

    // update state, sprite and text to fit the new label
    this.state = newLabel.state;
    this.updateToggleIconColor();

    if (newLabel.sprite) {
      this.setActionTexture(newLabel.sprite?.texture);
    }

    this.setText(newLabel.text);
    return this.state;
  }

  /**
   * Set the current SortDirection to the provided value and update icon accordingly
   * @param SortDirection the new SortDirection to use
   */
  public setDirection(dir: SortDirection): void {
    this.dir = dir;
    this.toggle.flipX = this.dir === SortDirection.DESC;
  }

  /**
   * Toggle the current SortDirection value
   */
  public toggleDirection(): void {
    this.setDirection(this.dir * -1);
  }

  /**
   * Place the toggle icon at the provided position
   * @param x the horizontal position
   * @param y the vertical position
   */
  setTogglePosition(x: number, y: number) {
    if (this.toggle) {
      this.toggle.x = x;
      this.toggle.y = y;
    }
  }

  /**
   * @returns the x position to use for the current label depending on if it has a sprite or not
   */
  getCurrentLabelX(): number | undefined {
    if (this.labels[this.currentLabelIndex].sprite) {
      return this.labels[this.currentLabelIndex].sprite?.x;
    }
    return this.x;
  }

  /**
   * @returns max width needed to display all of the labels
   */
  getWidth(): number {
    return this.width;
  }
}

export class DropDown extends Phaser.GameObjects.Container {
  public options: DropDownOption[];
  private readonly optionButtons: Buttons;
  private cursorObj: Phaser.GameObjects.Image;
  public dropDownType: DropDownType = DropDownType.MULTI;
  public cursor = 0;
  private lastCursor = -1;
  public defaultCursor = 0;
  private onChange: () => void;
  private lastDir: SortDirection = SortDirection.ASC;
  private defaultSettings: any[];
  private dropDownScrollBar: ScrollBar;
  private totalOptions = 0;
  private maxOptions = 0;
  private shownOptions = 0;
  private tooManyOptions = false;
  private firstShown = 0;
  private optionHeight = 0;
  private optionPaddingX = 4;
  private optionPaddingY = 6;
  private optionWidth = 100;
  private cursorOffset = 0;

  constructor(
    x: number,
    y: number,
    options: DropDownOptionParams[],
    onChange: () => void,
    type: DropDownType = DropDownType.MULTI,
    optionSpacing = 2,
  ) {
    const windowPadding = 5;
    const cursorOffset = 7;

    super(globalScene, x - cursorOffset - windowPadding, y);

    this.optionWidth = 100;
    this.optionHeight = 7;
    this.optionPaddingX = 4;
    this.optionPaddingY = 6;
    this.cursorOffset = cursorOffset;

    this.options = options.map(o => new DropDownOption(o, type));
    this.dropDownType = type;
    this.onChange = onChange;

    this.cursorObj = globalScene.add.image(this.optionPaddingX + 13, 0, "cursor");
    this.cursorObj.setScale(0.5);
    this.cursorObj.setOrigin(0, 0);
    this.cursorObj.setVisible(false);

    // For MULTI and HYBRID filter, add an ALL option at the top
    if (this.dropDownType === DropDownType.MULTI || this.dropDownType === DropDownType.HYBRID) {
      this.options.unshift(
        new DropDownOption(
          {
            key: "ALL",
            labels: new DropDownLabel(
              i18next.t("filterBar:all"),
              undefined,
              this.checkForAllOn() ? DropDownState.ON : DropDownState.OFF,
            ),
          },
          this.dropDownType,
        ),
      );
    }

    this.maxOptions = 19;
    this.totalOptions = this.options.length;
    this.tooManyOptions = this.totalOptions > this.maxOptions;
    this.shownOptions = this.tooManyOptions ? this.maxOptions : this.totalOptions;

    this.defaultSettings = this.getSettings();

    // Setup local configuration relative to the Buttons layout
    this.options.forEach(option => {
      const toggleVisibility = type !== DropDownType.SINGLE || option.state === DropDownState.ON;
      option.updateToggleIcon(toggleVisibility);

      // We explicitly size and allow interaction for the RexUI Buttons sizer
      option.setMinHeight(this.optionHeight);

      // Coordinates are now 0-based relative to the option container
      const localBaseX = 0;
      const localBaseY = this.optionHeight / 2;

      //option.setLabelPosition(localBaseX + 8, localBaseY);
      if (type === DropDownType.SINGLE) {
        option.setTogglePosition(localBaseX + 3, localBaseY + 1);
      } else {
        option.setTogglePosition(localBaseX, localBaseY);
      }

      this.firstShown = 0;
    });

    const baseX = cursorOffset + this.optionPaddingX + 3;

    // Use RexUI Buttons to handle stacking, visibility gaps, and click/hover events
    this.optionButtons = new Buttons(globalScene, {
      orientation: "y",
      space: {
        item: optionSpacing,
        top: 3,
        bottom: this.optionPaddingY,
        left: this.optionPaddingX + 5,
        right: this.optionPaddingX,
      },
      buttons: this.options,
      click: { mode: "release" },
      align: "right",
      origin: 0,
      x: baseX,
    });

    if (this.tooManyOptions) {
      this.options.forEach((option, index) => {
        if (index >= this.shownOptions) {
          this.optionButtons.hide(option);
        }
      });
    }

    // Initial layout calculation required to get proper child bounds
    this.optionButtons.layout();

    // Map the RexUI button click/over events to original functionality
    this.optionButtons.on("button.click", (button: DropDownOption) => {
      // Find the absolute index in our main options array
      const absoluteIndex = this.options.indexOf(button);
      this.setCursor(absoluteIndex);
      this.toggleOptionState(absoluteIndex);
    });

    this.optionButtons.on("button.over", (button: DropDownOption) => {
      const absoluteIndex = this.options.indexOf(button);
      this.setCursor(absoluteIndex);
    });

    // We can now calculate the window height reliably based on the sizer's child Y post-layout
    const window = addWindow(
      0,
      0,
      50,
      this.optionButtons.y + this.options[this.shownOptions - 1].y + this.optionHeight + this.optionPaddingY,
      false,
      false,
      undefined,
      undefined,
      WindowVariant.XTHIN,
    );

    this.optionButtons.addBackground(window);
    this.optionButtons.layout();
    this.add(this.optionButtons);
    this.add(this.cursorObj);
    this.setVisible(false);

    if (this.tooManyOptions) {
      this.dropDownScrollBar = new ScrollBar(window.width - 3, 5, 5, window.height - 10, 1);
      this.add(this.dropDownScrollBar);
      this.dropDownScrollBar.setTotalRows(this.totalOptions);
      this.dropDownScrollBar.setScrollCursor(0);
    }
  }

  getWidth(): number {
    return this.optionButtons.width;
  }

  toggleVisibility(): void {
    this.setVisible(!this.visible);
  }

  setVisible(value: boolean): this {
    super.setVisible(value);
    return this;
  }

  resetCursor(): boolean {
    if (this.dropDownType === DropDownType.HYBRID && this.checkForAllOff()) {
      return this.setCursor(this.lastCursor);
    }
    return this.setCursor(this.defaultCursor);
  }

  setCursor(cursor: number): boolean {
    if (this.tooManyOptions) {
      this.setLabels(cursor);
    }

    this.cursor = cursor;
    if (cursor < 0) {
      cursor = 0;
      this.cursorObj.setVisible(false);
      return false;
    }
    if (cursor >= this.options.length) {
      cursor = this.options.length - 1;
      this.cursorObj.y = this.optionButtons.y + this.options[cursor].y - 3;
      this.cursorObj.setVisible(true);
      return false;
    }
    this.cursorObj.y = this.optionButtons.y + this.options[cursor].y - 3;
    this.cursorObj.setVisible(true);

    if (this.dropDownType === DropDownType.HYBRID) {
      this.lastCursor = cursor;
      this.onChange();
    }
    return true;
  }

  setLabels(cursor: number) {
    if (cursor === 0 && this.lastCursor === this.totalOptions - 1) {
      this.firstShown = 0;
    } else if (cursor === this.totalOptions - 1 && this.lastCursor === 0) {
      this.firstShown = this.totalOptions - this.shownOptions;
    } else if (cursor - this.firstShown >= this.shownOptions && cursor > this.lastCursor) {
      this.firstShown += 1;
    } else if (cursor < this.firstShown && cursor < this.lastCursor) {
      this.firstShown -= 1;
    }

    // Rely exclusively on RexUI to recalculate child coordinates based on visibility
    this.options.forEach((option, index) => {
      if (index < this.firstShown || index >= this.firstShown + this.shownOptions) {
        this.optionButtons.hide(option);
      } else {
        this.optionButtons.show(option);
      }
    });

    this.optionButtons.layout();
    this.dropDownScrollBar.setScrollCursor(cursor);
  }

  /**
   * Switch the option at the provided index to its next state and update visuals
   * Update accordingly the other options if needed:
   *  - if "all" is toggled, also update all other options
   *  - for DropDownType.SINGLE, unselect the previously selected option if applicable
   * @param index the index of the option for which to update the state
   */
  toggleOptionState(index: number = this.cursor): void {
    const option: DropDownOption = this.options[index];
    if (this.dropDownType === DropDownType.MULTI || this.dropDownType === DropDownType.HYBRID) {
      const newState = option.toggleOptionState();
      if (index === 0) {
        // we are on the All option > put all other options to the newState
        this.setAllOptions(newState);
      } else if (newState === DropDownState.ON && this.checkForAllOn()) {
        // select the "all" option if all others are selected, other unselect it
        this.options[0].setOptionState(DropDownState.ON);
      } else {
        this.options[0].setOptionState(DropDownState.OFF);
      }
    } else if (this.dropDownType === DropDownType.SINGLE) {
      if (option.state === DropDownState.OFF) {
        this.options.forEach(opt => {
          opt.setOptionState(DropDownState.OFF);
          opt.setDirection(SortDirection.ASC);
          opt.toggle.setVisible(false);
        });
        option.setOptionState(DropDownState.ON);
        option.setDirection(this.lastDir);
        option.toggle.setVisible(true);
      } else {
        option.toggleDirection();
        this.lastDir = this.options[this.cursor].dir;
      }
    } else if (this.dropDownType === DropDownType.RADIAL) {
      option.toggleOptionState();
    }
    this.onChange();
  }

  /**
   * Check whether all options except the "ALL" one are ON
   * @returns true if all options are set to DropDownState.ON, false otherwise
   */
  checkForAllOn(): boolean {
    return this.options.every((option, i) => i === 0 || option.state === DropDownState.ON);
  }

  /**
   * Check whether all options except the "ALL" one are OFF
   * @returns true if all options are set to DropDownState.OFF, false otherwise
   */
  checkForAllOff(): boolean {
    return this.options.every((option, i) => i === 0 || option.state === DropDownState.OFF);
  }

  /**
   * Get the current selected values for each option
   * @returns an array of values, depending on the DropDownType
   *  - if MULTI or HYBRID, an array of all the values of the options set to ON (except the ALL one)
   *  - if RADIAL, an array where the value for each option is of the form { val: any, state: DropDownState }
   *  - if SINGLE, a single object of the form { val: any, state: SortDirection }
   */
  getVals(): any[] {
    if (this.dropDownType === DropDownType.MULTI) {
      return this.options.filter((option, i) => i > 0 && option.state === DropDownState.ON).map(option => option.key);
    }
    if (this.dropDownType === DropDownType.HYBRID) {
      const selected = this.options
        .filter((option, i) => i > 0 && option.state === DropDownState.ON)
        .map(option => option.key);
      if (selected.length > 0) {
        return selected;
      }
      // if nothing is selected and the ALL option is hovered, return all elements
      if (this.cursor === 0) {
        return this.options.filter((_, i) => i > 0).map(option => option.key);
      }
      // if nothing is selected and a single option is hovered, return that one
      return [this.options[this.cursor].key];
    }
    if (this.dropDownType === DropDownType.RADIAL) {
      return this.options.map(option => {
        return { val: option.key, state: option.state };
      });
    }
    return this.options
      .filter(option => option.state === DropDownState.ON)
      .map(option => {
        return { val: option.key, dir: option.dir };
      });
  }

  /**
   * Get the current selected settings dictionary for each option
   * @returns an array of dictionaries with the current state of each option
   * - the settings dictionary is like this { val: any, state: DropDownState, cursor: boolean, dir: SortDirection }
   */
  private getSettings(): any[] {
    const settings: any[] = [];
    for (let i = 0; i < this.options.length; i++) {
      settings.push({
        val: this.options[i].key,
        state: this.options[i].state,
        cursor: this.cursor === i,
        dir: this.options[i].dir,
      });
    }
    return settings;
  }

  /**
   * Check whether the values of all options are the same as the default ones
   * @returns true if they are the same, false otherwise
   */
  public hasDefaultValues(): boolean {
    const currentValues = this.getSettings();

    const compareValues = (keys: string[]): boolean => {
      return (
        currentValues.length === this.defaultSettings.length
        && currentValues.every((value, index) => keys.every(key => value[key] === this.defaultSettings[index][key]))
      );
    };

    switch (this.dropDownType) {
      case DropDownType.MULTI:
      case DropDownType.RADIAL:
        return compareValues(["val", "state"]);

      case DropDownType.HYBRID:
        return compareValues(["val", "state", "cursor"]);

      case DropDownType.SINGLE:
        return compareValues(["val", "state", "dir"]);

      default:
        return false;
    }
  }

  /**
   * Set all values to their default state
   */
  public resetToDefault(): void {
    if (this.defaultSettings.length > 0) {
      this.setCursor(this.defaultCursor);
      this.lastDir = SortDirection.ASC;

      for (let i = 0; i < this.options.length; i++) {
        // reset values with the defaultValues
        if (this.dropDownType === DropDownType.SINGLE) {
          if (this.defaultSettings[i].state === DropDownState.OFF) {
            this.options[i].setOptionState(DropDownState.OFF);
            this.options[i].setDirection(SortDirection.ASC);
            this.options[i].toggle.setVisible(false);
          } else {
            this.options[i].setOptionState(DropDownState.ON);
            this.options[i].setDirection(SortDirection.ASC);
            this.options[i].toggle.setVisible(true);
          }
        } else if (this.defaultSettings[i]) {
          this.options[i].setOptionState(this.defaultSettings[i]["state"]);
        }
      }

      this.onChange();
    }
  }

  /**
   * Set all options to a specific state
   * @param state the DropDownState to assign to each option
   */
  private setAllOptions(state: DropDownState): void {
    // For single type dropdown, setting all options is not relevant
    if (this.dropDownType === DropDownType.SINGLE) {
      return;
    }

    for (const option of this.options) {
      option.setOptionState(state);
    }
  }

  /**
   * Set all options to their ON state
   */
  public selectAllOptions() {
    this.setAllOptions(DropDownState.ON);
  }

  /**
   * Set all options to their OFF state
   */
  public unselectAllOptions() {
    this.setAllOptions(DropDownState.OFF);
  }
}
