import { Button } from "#enums/buttons";
import { ScrollBar } from "#ui/scroll-bar";

type UpdateGridCallbackFunction = () => void;
type UpdateDetailsCallbackFunction = (index: number) => void;

/**
 * A helper class to handle navigation through a grid of elements that can scroll vertically
 * Uses callbacks to communicate with consumers rather than maintaining direct references
 * How to use:
 * - in `UiHandler.setup`: Initialize with the grid dimensions and positioning,
 * then use chainable methods to set up callbacks for grid/detail updates
 * - in `UiHandler.show`: Set `setTotalElements` to the total number of elements in the list to display
 * - in `UiHandler.processInput`: call `processInput` to have it handle the cursor updates
 * - in `UiHandler.clear`: call `reset`
 */
export class ScrollableGridHelper {
  private readonly ROWS: number;
  private readonly COLUMNS: number;
  private totalElements: number;
  private cursor: number;
  private readonly scrollBar: ScrollBar;
  /** Optional function that will get called if the whole grid needs to get updated */
  private updateGridCallback?: UpdateGridCallbackFunction;
  /** Optional function that will get called if a single element's information needs to get updated */
  private updateDetailsCallback?: UpdateDetailsCallbackFunction;
  /** Optional function that will get called when the cursor changes */
  private cursorUpdateCallback?: (cursor: number) => void;
  private silentScroll: boolean;

  /**
   * @param rows the maximum number of rows shown at once
   * @param columns the maximum number of columns shown at once
   * @param x the scrollbar's x position (origin: top left)
   * @param y the scrollbar's y position (origin: top left)
   * @param width the scrollbar's width
   * @param height the scrollbar's height
   */
  constructor(rows: number, columns: number, x: number, y: number, width: number, height: number) {
    this.ROWS = rows;
    this.COLUMNS = columns;
    this.cursor = 0;
    this.totalElements = rows * columns;
    this.silentScroll = false;

    this.scrollBar = new ScrollBar(x, y, width, height, rows, (newRow: number) => {
      if (!this.silentScroll) {
        this.handleScrollChange(newRow);
      }
    });
  }

  /**
   * Get the ScrollBar instance managed by this helper
   * @returns the ScrollBar
   */
  getScrollBar(): ScrollBar {
    return this.scrollBar;
  }

  /**
   * Get the current cursor position within the visible grid
   * @returns the cursor position (0-based index within displayed rows)
   */
  getCursor(): number {
    return this.cursor;
  }

  /**
   * Set a callback for when the cursor position changes
   * @param callback function to call with the new cursor position
   * @returns this
   */
  withCursorCallback(callback: (cursor: number) => void): ScrollableGridHelper {
    this.cursorUpdateCallback = callback;
    return this;
  }

  /**
   * Set function that will get called if the whole grid needs to get updated
   * @param callback {@linkcode UpdateGridCallbackFunction}
   * @returns this
   */
  withUpdateGridCallBack(callback: UpdateGridCallbackFunction): ScrollableGridHelper {
    this.updateGridCallback = callback;
    return this;
  }

  /**
   * Set function that will get called if a single element's information needs to get updated
   * @param callback {@linkcode UpdateDetailsCallbackFunction}
   * @returns this
   */
  withUpdateSingleElementCallback(callback: UpdateDetailsCallbackFunction): ScrollableGridHelper {
    this.updateDetailsCallback = callback;
    return this;
  }

  /**
   * @param totalElements the total number of elements that the grid needs to display
   */
  setTotalElements(totalElements: number): void {
    this.totalElements = totalElements;
    this.scrollBar.setTotalRows(Math.ceil(this.totalElements / this.COLUMNS));
    this.silentScroll = true;
    this.scrollBar.setScrollCursor(0);
    this.silentScroll = false;
    this.cursor = 0;
  }

  /**
   * @returns how many elements are hidden due to scrolling
   */
  getItemOffset(): number {
    return this.scrollBar.getCurrentRow() * this.COLUMNS;
  }

  /**
   * Get the current scroll row (page) from the scrollbar
   * @returns the current scroll row
   */
  getScrollRow(): number {
    return this.scrollBar.getCurrentRow();
  }

  /**
   * Handle scroll changes from the ScrollBar
   * @param newRow the new scroll row
   */
  private handleScrollChange(newRow: number): void {
    const itemOffset = newRow * this.COLUMNS;
    const maxCursor = Math.min(this.cursor, this.totalElements - itemOffset - 1);

    if (maxCursor !== this.cursor) {
      this.setCursor(maxCursor);
    } else if (this.updateDetailsCallback) {
      this.updateDetailsCallback(this.cursor + itemOffset);
    }

    if (this.updateGridCallback) {
      this.updateGridCallback();
    }
  }

  private processUpInput(
    scrollCursor: number,
    maxScrollCursor: number,
    currentRowIndex: number,
    onScreenRows: number,
    lastVisibleIndex: number,
  ): boolean {
    if (currentRowIndex > 0) {
      return this.setCursor(this.cursor - this.COLUMNS);
    }
    if (scrollCursor > 0) {
      return this.setScrollCursor(scrollCursor - 1);
    }
    let newCursor = this.cursor + (onScreenRows - 1) * this.COLUMNS;
    if (newCursor > lastVisibleIndex) {
      newCursor -= this.COLUMNS;
    }
    return this.setScrollCursor(maxScrollCursor, newCursor);
  }

  private processDownInput(
    scrollCursor: number,
    maxScrollCursor: number,
    currentRowIndex: number,
    onScreenRows: number,
    itemOffset: number,
  ): boolean {
    if (currentRowIndex < onScreenRows - 1) {
      return this.setCursor(Math.min(this.cursor + this.COLUMNS, this.totalElements - itemOffset - 1));
    }
    if (scrollCursor < maxScrollCursor) {
      return this.setScrollCursor(scrollCursor + 1);
    }
    return this.setScrollCursor(0, this.cursor % this.COLUMNS);
  }

  private processLeftInput(
    scrollCursor: number,
    maxScrollCursor: number,
    currentRowIndex: number,
    currentColumnIndex: number,
    onScreenRows: number,
    lastVisibleIndex: number,
  ): boolean {
    if (currentColumnIndex > 0) {
      return this.setCursor(this.cursor - 1);
    }
    if (scrollCursor === maxScrollCursor && currentRowIndex === onScreenRows - 1) {
      return this.setCursor(lastVisibleIndex);
    }
    return this.setCursor(this.cursor + this.COLUMNS - 1);
  }

  private processRightInput(currentColumnIndex: number, itemOffset: number): boolean {
    if (currentColumnIndex < this.COLUMNS - 1 && this.cursor + itemOffset < this.totalElements - 1) {
      return this.setCursor(this.cursor + 1);
    }
    return this.setCursor(this.cursor - currentColumnIndex);
  }

  /**
   * Update the cursor and scrollCursor based on user input
   * @param button the button that was pressed
   * @returns `true` if either the cursor or scrollCursor was updated
   */
  processInput(button: Button): boolean {
    let success = false;
    const scrollCursor = this.scrollBar.getCurrentRow();
    const onScreenRows = Math.min(this.ROWS, Math.ceil(this.totalElements / this.COLUMNS));
    const maxScrollCursor = Math.max(0, Math.ceil(this.totalElements / this.COLUMNS) - onScreenRows);
    const currentRowIndex = Math.floor(this.cursor / this.COLUMNS);
    const currentColumnIndex = this.cursor % this.COLUMNS;
    const itemOffset = scrollCursor * this.COLUMNS;
    const lastVisibleIndex = Math.min(this.totalElements - 1, this.totalElements - maxScrollCursor * this.COLUMNS - 1);

    switch (button) {
      case Button.UP:
        success = this.processUpInput(scrollCursor, maxScrollCursor, currentRowIndex, onScreenRows, lastVisibleIndex);
        break;
      case Button.DOWN:
        success = this.processDownInput(scrollCursor, maxScrollCursor, currentRowIndex, onScreenRows, itemOffset);
        break;
      case Button.LEFT:
        this.processLeftInput(
          scrollCursor,
          maxScrollCursor,
          currentRowIndex,
          currentColumnIndex,
          onScreenRows,
          lastVisibleIndex,
        );
        break;
      case Button.RIGHT:
        this.processRightInput(currentColumnIndex, itemOffset);
        break;
    }
    return success;
  }

  /**
   * Reset the scrolling and cursor position
   */
  reset(): void {
    this.silentScroll = true;
    this.scrollBar.setScrollCursor(0);
    this.silentScroll = false;
    this.cursor = 0;
  }

  /**
   * Update the cursor position and notify via callback
   * @param cursor the new cursor position
   * @returns whether the cursor actually changed
   */
  private setCursor(cursor: number): boolean {
    if (cursor === this.cursor) {
      return false;
    }
    this.cursor = cursor;
    if (this.cursorUpdateCallback) {
      this.cursorUpdateCallback(cursor);
    }
    return true;
  }

  private setScrollCursor(scrollCursor: number, cursor?: number): boolean {
    let changed = false;

    this.scrollBar.setScrollCursor(scrollCursor);
    changed = true;

    if (cursor !== undefined) {
      changed = this.setCursor(cursor) || changed;
    } else {
      const itemOffset = scrollCursor * this.COLUMNS;
      const maxCursor = Math.min(this.cursor, this.totalElements - itemOffset - 1);
      if (maxCursor !== this.cursor) {
        changed = this.setCursor(maxCursor) || changed;
      }
    }

    return changed;
  }
}
