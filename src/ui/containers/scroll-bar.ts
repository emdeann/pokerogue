import { globalScene } from "#app/global-scene";

/**
 * A vertical scrollbar element that resizes dynamically based on the current scrolling
 * and number of elements that can be shown on screen
 */
export class ScrollBar extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly handleBody: Phaser.GameObjects.Rectangle;
  private readonly handleBottom: Phaser.GameObjects.NineSlice;
  private readonly displayRows: number;
  private readonly top: number;
  private readonly onScroll: (v: number, dv: number) => void;
  private currentRow: number;
  private totalRows: number;
  private grabOffsetY = 0;

  /**
   * @param x the scrollbar's x position (origin: top left)
   * @param y the scrollbar's y position (origin: top left)
   * @param width the scrollbar's width
   * @param height the scrollbar's height
   * @param maxRows the maximum number of rows that can be shown at once
   */
  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    maxRows: number,
    onScroll: (v: number, dv: number) => void,
  ) {
    super(globalScene, x, y);

    this.top = this.getWorldPoint().y;
    this.displayRows = maxRows;
    this.totalRows = maxRows;
    this.currentRow = 0;

    const borderSize = 2;
    width = Math.max(width, 4);

    this.bg = globalScene.add.nineslice(
      0,
      0,
      "scroll_bar",
      undefined,
      width,
      height,
      borderSize,
      borderSize,
      borderSize,
      borderSize,
    );
    this.bg.setOrigin(0, 0);
    this.add(this.bg);

    this.handleBody = globalScene.add.rectangle(1, 1, width - 2, 4, 0xaaaaaa);
    this.handleBody.setOrigin(0, 0);
    this.add(this.handleBody);

    this.handleBottom = globalScene.add.nineslice(1, 1, "scroll_bar_handle", undefined, width - 2, 2, 2, 0, 0, 0);
    this.handleBottom.setOrigin(0, 0);
    this.add(this.handleBottom);

    this.onScroll = onScroll;

    this.bg.setInteractive();
    this.bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const localY = pointer.downY / 6 - this.top;
      const handleTop = this.handleBody.y;
      const handleBottom = this.handleBody.y + this.handleBody.displayHeight + this.handleBottom.displayHeight;

      if (localY >= handleTop && localY <= handleBottom) {
        this.grabOffsetY = localY - handleTop;
      } else {
        this.grabOffsetY = (this.handleBody.displayHeight + this.handleBottom.displayHeight) / 2;
      }

      this.cursorToPointer(pointer);
    });

    this.bg.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) {
        return;
      }
      this.cursorToPointer(pointer);
    });
  }

  private cursorToPointer(pointer: Phaser.Input.Pointer) {
    const trackHeight = this.bg.displayHeight;
    const handleHeight = this.handleBody.displayHeight + this.handleBottom.displayHeight;

    const localY = Phaser.Math.Clamp(
      pointer.y / 6 - this.top - this.grabOffsetY,
      0,
      trackHeight - handleHeight, // stop when handle bottom hits the track bottom
    );

    const row = Math.round((localY / (trackHeight - handleHeight)) * (this.totalRows - this.displayRows));
    this.setScrollCursor(Phaser.Math.Clamp(row, 0, this.totalRows - this.displayRows));
  }

  /**
   * Set the current row that is displayed
   * Moves the bar handle up or down accordingly
   * @param scrollCursor how many times the view was scrolled down
   */
  setScrollCursor(scrollCursor: number): void {
    if (scrollCursor === this.currentRow) {
      return;
    }

    const change = this.currentRow - scrollCursor;
    this.currentRow = scrollCursor;
    this.updateHandlePosition();
    this.onScroll(scrollCursor, change);
  }

  /**
   * Set the total number of rows to display
   * If it's smaller than the maximum number of rows on screen the bar will get hidden
   * Otherwise the scrollbar handle gets resized based on the ratio to the maximum number of rows
   * @param rows how many rows of data there are in total
   */
  setTotalRows(rows: number): void {
    this.totalRows = rows;
    this.handleBody.height =
      ((this.bg.displayHeight - 1 - this.handleBottom.displayHeight) * this.displayRows) / this.totalRows;
    this.updateHandlePosition();

    this.setVisible(this.totalRows > this.displayRows);
  }

  private updateHandlePosition(): void {
    this.handleBody.y =
      1 + ((this.bg.displayHeight - 1 - this.handleBottom.displayHeight) / this.totalRows) * this.currentRow;
    this.handleBottom.y = this.handleBody.y + this.handleBody.displayHeight;
  }

  public getCurrentRow(): number {
    return this.currentRow;
  }

  public scrollUp(wrap = true): void {
    if (wrap && this.currentRow === 0) {
      this.setScrollCursor(this.totalRows - 1);
    } else {
      this.setScrollCursor(Math.max(0, this.currentRow - 1));
    }
  }

  public scrollDown(wrap = true): void {
    if (wrap && this.currentRow === this.totalRows - 1) {
      this.setScrollCursor(0);
    } else {
      this.setScrollCursor(Math.min(this.totalRows - 1, this.currentRow + 1));
    }
  }
}
