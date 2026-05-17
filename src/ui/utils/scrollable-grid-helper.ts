import { globalScene } from "#app/global-scene";
import { Button } from "#enums/buttons";
import { TextStyle } from "#enums/text-style";
import { ScrollBar } from "#ui/scroll-bar";
import { addTextObject } from "#ui/text";

export interface ScrollableGridConfig<TCell extends Phaser.GameObjects.Container, TData> {
  /** Maximum number of rows shown at once */
  rows: number;
  /** Number of columns */
  columns: number;

  /** Scroll bar config local to the grid container */
  scrollBar?: { x: number; y: number; width: number; height: number };

  /** Cell grid configuration */
  cells: {
    /** x position of the cells sub-container */
    x: number;
    /** y position of the cells sub-container */
    y: number;
    /** horizontal pixel distance between adjacent cells */
    spacingX: number;
    /** vertical pixel distance between adjacent cells */
    spacingY: number;
    /** Factory used to create each cell */
    createCell: () => TCell;
    /** Called whenever a cell must (re-)render the given data */
    renderCell: (cell: TCell, data: TData) => void;
  };

  /** Selection cursor configuration. Defaults to `select_cursor_highlight` at 16×16. */
  cursor?:
    | {
        texture: string;
        width: number;
        height: number;
        /** Pixel offset from the cell's top-left where the cursor is drawn */
        offsetX?: number;
        offsetY?: number;
      }
    | undefined;

  /**
   * Called whenever the highlighted item changes (cursor move, scroll, hover, or {@linkcode setItems}).
   * Receives the cell game object and the data item it currently represents.
   */
  onItemSelected?: ((cell: TCell, data: TData) => void) | undefined;

  /**
   * Called when the user presses {@linkcode Button.ACTION} or clicks the currently highlighted cell.
   * If omitted, these actions do nothing.
   */
  onItemActioned?: ((cell: TCell, data: TData) => void) | undefined;

  /** Whether to scroll by top/bottom arrows or scrollbar */
  scrollMode?: "scrollbar" | "arrows" | "none" | undefined;
  /** Style for scroll arrows. Unused unless {@linkcode scrollMode} is set to "arrows" */
  arrowStyle?: TextStyle | undefined;
}

/**
 * A scrollable grid of cells. It is a container and can be added to the consumer for positioning.
 *
 * Handles all common tasks to grids and menus: item display, cursor movement, touch input, scrolling, etc.
 */
export class ScrollableGridHelper<TCell extends Phaser.GameObjects.Container, TData> extends Phaser.GameObjects
  .Container {
  private readonly ROWS: number;
  private readonly COLUMNS: number;
  private readonly config: ScrollableGridConfig<TCell, TData>;
  private readonly scrollBar: ScrollBar | undefined;
  private readonly cellsContainer: Phaser.GameObjects.Container;
  private readonly cells: TCell[];
  private cursorObj: Phaser.GameObjects.NineSlice | null = null;

  private items: TData[] = [];
  private cursor = 0;
  /** If true, suppress scroll events */
  private silentScroll = false;
  private readonly scrollMode: "scrollbar" | "arrows" | "none";
  private readonly upArrow: Phaser.GameObjects.Text | null = null;
  private readonly downArrow: Phaser.GameObjects.Text | null = null;
  /** Whether touch controls are currently accepted by this grid */
  private touchEnabled = true;

  /**
   * @param x - The x coordinate for the grid container
   * @param y - The y coordinate for the grid container
   * @param config - Configuration for the grid itself
   */
  constructor(x: number, y: number, config: ScrollableGridConfig<TCell, TData>) {
    super(globalScene, x, y);
    globalScene.add.existing(this);

    this.config = config;
    this.ROWS = config.rows;
    this.COLUMNS = config.columns;
    this.scrollMode = config.scrollMode ?? "scrollbar";

    if (config.scrollBar != null) {
      this.scrollBar = new ScrollBar(
        config.scrollBar.x,
        config.scrollBar.y,
        config.scrollBar.width,
        config.scrollBar.height,
        this.ROWS,
        (newRow: number) => {
          if (!this.silentScroll) {
            this.handleScrollChange(newRow);
          }
        },
      );
      this.add(this.scrollBar);
    }

    this.cellsContainer = globalScene.add.container(config.cells.x, config.cells.y);
    this.cells = [];
    for (let i = 0; i < this.ROWS * this.COLUMNS; i++) {
      const cell = config.cells.createCell();
      cell.setPosition(
        (i % this.COLUMNS) * config.cells.spacingX,
        Math.floor(i / this.COLUMNS) * config.cells.spacingY,
      );
      this.cells.push(cell);
      this.cellsContainer.add(cell);
    }
    this.add(this.cellsContainer);

    if (this.scrollMode === "arrows") {
      const arrowX = config.cells.x + ((this.COLUMNS - 1) * config.cells.spacingX) / 2;
      const cellsBottom = config.cells.y + this.ROWS * config.cells.spacingY;
      const arrowStyle = config.arrowStyle ?? TextStyle.WINDOW;

      this.upArrow = addTextObject(arrowX, config.cells.y, "↑", arrowStyle).setOrigin(0.5, 1);
      this.downArrow = addTextObject(arrowX, cellsBottom, "↓", arrowStyle).setOrigin(0.5, 0);
      this.upArrow.setVisible(false);
      this.downArrow.setVisible(false);

      this.add([this.upArrow, this.downArrow]);
    }
    this.scrollBar?.setVisible(false);
    this.cellsContainer.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, this.COLUMNS * config.cells.spacingX, this.ROWS * config.cells.spacingY),
      Phaser.Geom.Rectangle.Contains,
    );
    this.enableTouchEvents();
  }

  private enableTouchEvents(): void {
    this.cellsContainer.on("pointermove", (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      this.handlePointerMove(localX, localY);
    });

    this.cellsContainer.on("pointerdown", (_pointer: Phaser.Input.Pointer, localX: number, localY: number) => {
      this.handlePointerDown(localX, localY);
    });
  }

  /**
   * Replace the items to be displayed. Resets the cursor and scroll position, redraws the grid,
   * and fires {@linkcode ScrollableGridConfig.onItemSelected} for the first item (if any).
   */
  setItems(items: TData[]): void {
    this.items = items;
    this.scrollBar?.setTotalRows(Math.ceil(items.length / this.COLUMNS));
    this.setScrollCursor(0, 0);
    this.refreshAll();
  }

  /** Reset scrolling + cursor position and remove the cursor visual. */
  reset(): void {
    this.setScrollCursor(0, 0);
    if (this.cursorObj) {
      this.cursorObj.destroy();
      this.cursorObj = null;
    }
  }

  /**
   * Process keyboard input.
   * @returns `true` if the input was consumed
   */
  processInput(button: Button): boolean {
    if (button === Button.ACTION) {
      return this.processActionInput();
    }

    if (this.items.length === 0) {
      return false;
    }

    const scrollCursor = this.scrollBar?.getCurrentRow() ?? 0;
    const onScreenRows = Math.min(this.ROWS, Math.ceil(this.items.length / this.COLUMNS));
    const maxScrollCursor = Math.max(0, Math.ceil(this.items.length / this.COLUMNS) - onScreenRows);
    const currentRowIndex = Math.floor(this.cursor / this.COLUMNS);
    const currentColumnIndex = this.cursor % this.COLUMNS;
    const itemOffset = scrollCursor * this.COLUMNS;
    const lastVisibleIndex = Math.min(this.items.length - 1, this.items.length - maxScrollCursor * this.COLUMNS - 1);

    switch (button) {
      case Button.UP:
        return this.processUpInput(scrollCursor, maxScrollCursor, currentRowIndex, onScreenRows, lastVisibleIndex);
      case Button.DOWN:
        return this.processDownInput(scrollCursor, maxScrollCursor, currentRowIndex, onScreenRows, itemOffset);
      case Button.LEFT:
        return this.processLeftInput(
          scrollCursor,
          maxScrollCursor,
          currentRowIndex,
          currentColumnIndex,
          onScreenRows,
          lastVisibleIndex,
        );
      case Button.RIGHT:
        return this.processRightInput(currentColumnIndex, itemOffset);
    }
    return false;
  }

  /**
   * Convert a pointer position (local to the cells container) to a cell slot index,
   * or `null` if the position is outside the grid or over an empty slot.
   */
  private pointerToSlot(localX: number, localY: number): number | null {
    const col = Math.floor(localX / this.config.cells.spacingX);
    const row = Math.floor(localY / this.config.cells.spacingY);

    if (col < 0 || col >= this.COLUMNS || row < 0 || row >= this.ROWS) {
      return null;
    }

    const slot = row * this.COLUMNS + col;

    if (slot + this.getItemOffset() >= this.items.length) {
      return null;
    }

    return slot;
  }

  /**
   * Set whether this grid should be accepting touch input.
   */
  public setTouchEnabled(enabled: boolean): void {
    this.touchEnabled = enabled;
  }

  /**
   * Event handler to run when the pointer (mouse or touch) is hovered over a cell.
   */
  private handlePointerMove(localX: number, localY: number): void {
    if (!this.touchEnabled) {
      return;
    }
    const slot = this.pointerToSlot(localX, localY);
    if (slot !== null && slot !== this.cursor) {
      this.setCursor(slot);
    }
  }

  /**
   * Event handler to run when the pointer is clicked/pressed on a cell.
   */
  private handlePointerDown(localX: number, localY: number): void {
    if (!this.touchEnabled) {
      return;
    }
    const slot = this.pointerToSlot(localX, localY);
    if (slot === null) {
      return;
    }
    if (slot === this.cursor) {
      this.processActionInput();
    } else {
      this.setCursor(slot);
    }
  }

  /**
   * Called on action input, runs the on action callback if one was provided.
   * @returns `true` if the callback was called
   */
  private processActionInput(): boolean {
    if (!this.config.onItemActioned || this.items.length === 0) {
      return false;
    }
    const absIndex = this.cursor + this.getItemOffset();
    if (absIndex >= this.items.length) {
      return false;
    }
    this.config.onItemActioned(this.cells[this.cursor], this.items[absIndex]);
    return true;
  }

  /**
   * @returns The offset from relative index to absolute index for an item given the scroll amount
   */
  private getItemOffset(): number {
    return this.scrollBar?.getCurrentRow() ?? 0 * this.COLUMNS;
  }

  /**
   * Render cells for each visible item; hide any unoccupied cells.
   */
  private renderGrid(): void {
    const offset = this.getItemOffset();
    const visible = this.items.slice(offset, offset + this.cells.length);
    visible.forEach((data, i) => {
      this.cells[i].setVisible(true);
      this.config.cells.renderCell(this.cells[i], data);
    });
    for (let i = visible.length; i < this.cells.length; i++) {
      this.cells[i].setVisible(false);
    }
  }

  /**
   * Update the location of the cursor based on its current location, creating a new texture if one doesn't exist.
   */
  private updateCursorVisual(): void {
    if (this.items.length === 0) {
      if (this.cursorObj) {
        this.cursorObj.setVisible(false);
      }
      return;
    }
    const cfg = this.config.cursor ?? { texture: "select_cursor_highlight", width: 16, height: 16 };
    if (!this.cursorObj) {
      this.cursorObj = globalScene.add
        .nineslice(0, 0, cfg.texture, undefined, cfg.width, cfg.height, 1, 1, 1, 1)
        .setOrigin(0);
      this.cellsContainer.add(this.cursorObj);
    }
    this.cursorObj.setVisible(true);
    this.cursorObj.setPositionRelative(this.cells[this.cursor], cfg.offsetX ?? 0, cfg.offsetY ?? 0);
  }

  /**
   * Run the `onItemSelected` callback for the selected item, if the callback was defined.
   */
  private notifySelection(): void {
    if (!this.config.onItemSelected || this.items.length === 0) {
      return;
    }
    const absIndex = this.cursor + this.getItemOffset();
    if (absIndex < this.items.length) {
      this.config.onItemSelected(this.cells[this.cursor], this.items[absIndex]);
    }
  }

  /**
   * Refresh all grid elements.
   */
  private refreshAll(): void {
    this.renderGrid();
    this.updateCursorVisual();
    this.updateScrollIndicators();
    this.notifySelection();
  }

  /**
   * Show/hide the scrollbar or arrow indicators based on the current scroll state.
   * If all items fit without scrolling, all indicators are hidden regardless of mode.
   */
  private updateScrollIndicators(): void {
    const totalCellSlots = this.ROWS * this.COLUMNS;
    const needsScroll = this.items.length > totalCellSlots;
    const offset = this.getItemOffset();
    const canScrollUp = needsScroll && offset > 0;
    const canScrollDown = needsScroll && offset + totalCellSlots < this.items.length;

    switch (this.scrollMode) {
      case "scrollbar":
        this.scrollBar?.setVisible(needsScroll);
        break;
      case "arrows":
        this.scrollBar?.setVisible(false);
        this.upArrow?.setVisible(canScrollUp);
        this.downArrow?.setVisible(canScrollDown);
        break;
      case "none":
        this.scrollBar?.setVisible(false);
        break;
    }
  }

  /**
   * Callback to handle a row change notification from the ScrollBar.
   * @param newRow - The new scrolled row
   */
  private handleScrollChange(newRow: number): void {
    const itemOffset = newRow * this.COLUMNS;
    const maxCursor = Math.min(this.cursor, this.items.length - itemOffset - 1);
    if (maxCursor !== this.cursor) {
      this.cursor = maxCursor;
    }
    this.refreshAll();
  }

  /**
   * Set the cursor to the given relative location.
   * @param cursor - The new location for the cursor
   * @returns If the cursor actually moved (i.e. if the new location is different)
   */
  private setCursor(cursor: number): boolean {
    if (cursor === this.cursor) {
      return false;
    }
    this.cursor = cursor;
    this.updateCursorVisual();
    this.notifySelection();
    return true;
  }

  private setScrollCursor(scrollCursor: number, cursor?: number): boolean {
    if (cursor !== undefined) {
      this.cursor = cursor;
    }
    this.silentScroll = true;
    this.scrollBar?.setScrollCursor(scrollCursor);
    this.silentScroll = false;
    this.refreshAll();
    return true;
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
      return this.setCursor(Math.min(this.cursor + this.COLUMNS, this.items.length - itemOffset - 1));
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
    if (currentColumnIndex < this.COLUMNS - 1 && this.cursor + itemOffset < this.items.length - 1) {
      return this.setCursor(this.cursor + 1);
    }
    return this.setCursor(this.cursor - currentColumnIndex);
  }

  public clearItems(): void {
    this.setItems([]);
  }

  // todo this is provided for migration simplicity but will ideally be removed eventually
  public getCursor(): number {
    return this.cursor;
  }
}
