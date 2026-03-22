// ── Canvas character-cell renderer ────────────────────────────────────────────
// Renders a virtual grid of colored characters to a canvas element.
//
// When constructed with transparent=true the canvas is cleared each frame and
// only cells that have been explicitly put() are drawn — the rest are fully
// transparent, letting a canvas underneath show through.  This is used for the
// UI overlay canvas so the high-resolution game canvas is visible beneath it.

export interface Cell {
  ch:    string;
  fg:    string;
  bg:    string;
}

export class CanvasRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private charW = 0;
  private charH = 0;
  private cssW  = 0;
  private cssH  = 0;
  cols = 0;
  rows = 0;
  private buf:  Cell[][] = [];
  private prev: Cell[][] = [];

  constructor(
    canvas: HTMLCanvasElement,
    private fontSize: number = 16,
    private transparent = false,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.measureChar();
  }

  private measureChar(): void {
    const ctx = this.ctx;
    ctx.font = `${this.fontSize}px "Courier New", monospace`;
    const m = ctx.measureText('█');
    this.charW = Math.ceil(m.width);
    this.charH = Math.ceil(this.fontSize * 1.2);
  }

  resize(width: number, height: number): void {
    // Render at physical pixels so text is crisp on HiDPI / retina screens.
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = Math.round(width  * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width  = width  + 'px';
    this.canvas.style.height = height + 'px';
    this.cssW = width;
    this.cssH = height;
    this.cols = Math.floor(width  / this.charW);
    this.rows = Math.floor(height / this.charH);
    this.buf  = this.makeGrid();
    this.prev = this.makeGrid();
    // Canvas resize resets the context state — restore scale + font.
    this.ctx.scale(dpr, dpr);
    this.ctx.font = `${this.fontSize}px "Courier New", monospace`;
  }

  private makeGrid(): Cell[][] {
    const empty = this.emptyCell;
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({ ...empty }))
    );
  }

  // Sentinel cell: empty bg ('') means "transparent, don't paint" in overlay mode.
  private get emptyCell(): Cell {
    return this.transparent
      ? { ch: ' ', fg: '', bg: '' }
      : { ch: ' ', fg: '#ffffff', bg: '#000000' };
  }

  clear(): void {
    const e = this.emptyCell;
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++) {
        this.buf[r][c].ch = e.ch;
        this.buf[r][c].fg = e.fg;
        this.buf[r][c].bg = e.bg;
      }
  }

  put(col: number, row: number, ch: string, fg: string, bg = '#000000'): void {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const cell = this.buf[row][col];
    cell.ch = ch;
    cell.fg = fg;
    cell.bg = bg;
  }

  print(col: number, row: number, text: string, fg: string, bg = '#000000'): void {
    for (let i = 0; i < text.length; i++) this.put(col + i, row, text[i], fg, bg);
  }

  fill(col: number, row: number, w: number, h: number, ch: string, fg: string, bg: string): void {
    for (let r = row; r < row + h; r++)
      for (let c = col; c < col + w; c++)
        this.put(c, r, ch, fg, bg);
  }

  flush(): void {
    const ctx = this.ctx;
    ctx.font = `${this.fontSize}px "Courier New", monospace`;
    ctx.textBaseline = 'top';

    if (this.transparent) {
      // Clear to fully transparent, then repaint every cell that has content.
      // We skip the dirty-cell cache because clearRect invalidates every pixel.
      ctx.clearRect(0, 0, this.cssW, this.cssH);
      for (let r = 0; r < this.rows; r++) {
        const y = r * this.charH;
        for (let c = 0; c < this.cols; c++) {
          const cell = this.buf[r][c];
          if (!cell.bg && cell.ch === ' ') continue;   // fully transparent cell
          const x = c * this.charW;
          if (cell.bg) {
            ctx.fillStyle = cell.bg;
            ctx.fillRect(x, y, this.charW, this.charH);
          }
          if (cell.ch !== ' ' && cell.fg) {
            ctx.fillStyle = cell.fg;
            ctx.fillText(cell.ch, x, y);
          }
        }
      }
    } else {
      // Opaque canvas: use dirty-cell optimisation to skip unchanged cells.
      for (let r = 0; r < this.rows; r++) {
        const y = r * this.charH;
        for (let c = 0; c < this.cols; c++) {
          const cell = this.buf[r][c];
          const prev = this.prev[r][c];
          if (cell.ch === prev.ch && cell.fg === prev.fg && cell.bg === prev.bg) continue;
          prev.ch = cell.ch;
          prev.fg = cell.fg;
          prev.bg = cell.bg;

          const x = c * this.charW;
          ctx.fillStyle = cell.bg;
          ctx.fillRect(x, y, this.charW, this.charH);
          if (cell.ch !== ' ') {
            ctx.fillStyle = cell.fg;
            ctx.fillText(cell.ch, x, y);
          }
        }
      }
    }
  }

  get cellW(): number { return this.charW; }
  get cellH(): number { return this.charH; }
}
