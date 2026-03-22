"use strict";
(() => {
  // src/renderer.ts
  var CanvasRenderer = class {
    constructor(canvas2, fontSize = 16, transparent = false) {
      this.fontSize = fontSize;
      this.transparent = transparent;
      this.charW = 0;
      this.charH = 0;
      this.cssW = 0;
      this.cssH = 0;
      this.cols = 0;
      this.rows = 0;
      this.buf = [];
      this.prev = [];
      this.canvas = canvas2;
      this.ctx = canvas2.getContext("2d");
      this.measureChar();
    }
    measureChar() {
      const ctx = this.ctx;
      ctx.font = `${this.fontSize}px "Courier New", monospace`;
      const m = ctx.measureText("\u2588");
      this.charW = Math.ceil(m.width);
      this.charH = Math.ceil(this.fontSize * 1.2);
    }
    resize(width, height) {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";
      this.cssW = width;
      this.cssH = height;
      this.cols = Math.floor(width / this.charW);
      this.rows = Math.floor(height / this.charH);
      this.buf = this.makeGrid();
      this.prev = this.makeGrid();
      this.ctx.scale(dpr, dpr);
      this.ctx.font = `${this.fontSize}px "Courier New", monospace`;
    }
    makeGrid() {
      const empty = this.emptyCell;
      return Array.from(
        { length: this.rows },
        () => Array.from({ length: this.cols }, () => ({ ...empty }))
      );
    }
    // Sentinel cell: empty bg ('') means "transparent, don't paint" in overlay mode.
    get emptyCell() {
      return this.transparent ? { ch: " ", fg: "", bg: "" } : { ch: " ", fg: "#ffffff", bg: "#000000" };
    }
    clear() {
      const e = this.emptyCell;
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++) {
          this.buf[r][c].ch = e.ch;
          this.buf[r][c].fg = e.fg;
          this.buf[r][c].bg = e.bg;
        }
    }
    put(col, row, ch, fg, bg = "#000000") {
      if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
      const cell = this.buf[row][col];
      cell.ch = ch;
      cell.fg = fg;
      cell.bg = bg;
    }
    print(col, row, text, fg, bg = "#000000") {
      for (let i = 0; i < text.length; i++) this.put(col + i, row, text[i], fg, bg);
    }
    fill(col, row, w, h, ch, fg, bg) {
      for (let r = row; r < row + h; r++)
        for (let c = col; c < col + w; c++)
          this.put(c, r, ch, fg, bg);
    }
    flush() {
      const ctx = this.ctx;
      ctx.font = `${this.fontSize}px "Courier New", monospace`;
      ctx.textBaseline = "top";
      if (this.transparent) {
        ctx.clearRect(0, 0, this.cssW, this.cssH);
        for (let r = 0; r < this.rows; r++) {
          const y = r * this.charH;
          for (let c = 0; c < this.cols; c++) {
            const cell = this.buf[r][c];
            if (!cell.bg && cell.ch === " ") continue;
            const x = c * this.charW;
            if (cell.bg) {
              ctx.fillStyle = cell.bg;
              ctx.fillRect(x, y, this.charW, this.charH);
            }
            if (cell.ch !== " " && cell.fg) {
              ctx.fillStyle = cell.fg;
              ctx.fillText(cell.ch, x, y);
            }
          }
        }
      } else {
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
            if (cell.ch !== " ") {
              ctx.fillStyle = cell.fg;
              ctx.fillText(cell.ch, x, y);
            }
          }
        }
      }
    }
    get cellW() {
      return this.charW;
    }
    get cellH() {
      return this.charH;
    }
  };

  // src/constants.ts
  var SOLID_TILES = /* @__PURE__ */ new Set([0 /* VOID */, 1 /* WALL */, 4 /* DOOR_CLOSED */]);
  var OPAQUE_TILES = /* @__PURE__ */ new Set([0 /* VOID */, 1 /* WALL */, 4 /* DOOR_CLOSED */]);
  var PASSABLE_TILES = /* @__PURE__ */ new Set([
    2 /* FLOOR */,
    3 /* CORRIDOR */,
    5 /* DOOR_OPEN */,
    6 /* STAIRS_UP */,
    7 /* STAIRS_DOWN */
  ]);
  var HUNGER_THRESHOLDS = {
    [0 /* SATIATED */]: 1e3,
    [1 /* NOT_HUNGRY */]: 150,
    [2 /* HUNGRY */]: 50,
    [3 /* WEAK */]: 1,
    [4 /* FAINTING */]: 0,
    [5 /* STARVED */]: -1
  };
  var FOV = Math.PI * 66 / 180;
  var MAX_RAY_DEPTH = 20;
  var WIN_LEVEL = 8;
  var ROTATE_SPEED = 0.04;
  var MOUSE_YAW_SENS = 25e-4;
  var MOUSE_PITCH_SENS = 0.15;
  var MAX_PITCH_FRAC = 0.18;
  var COL_WALL_CLOSE_X = "#d0a060";
  var COL_WALL_CLOSE_Y = "#9a7040";
  var COL_STATUS_BG = "#001833";
  var COL_MSG = "#ffee88";
  var COL_PLAYER = "#44ff88";
  var COL_MONSTER_EASY = "#cc2222";
  var COL_MONSTER_TOUGH = "#ff4444";
  var COL_ITEM = "#44ffff";
  var COL_STAIRS = "#44ffcc";
  var COL_GOLD = "#ffdd22";
  var COL_MINIMAP_WALL = "#666677";
  var COL_MINIMAP_FLOOR = "#44aa66";
  var COL_HP_GOOD = "#44ff88";
  var COL_HP_LOW = "#ff4444";
  var COL_XP = "#aaddff";
  var COL_RING = "#ff88ff";
  var COL_WAND = "#88ffff";

  // src/dungeon.ts
  var DungeonLevel = class {
    constructor() {
      this.width = 80;
      this.height = 40;
      this.rooms = [];
      this.stairsUp = null;
      this.stairsDown = null;
      this.grid = Array.from(
        { length: this.height },
        () => Array.from({ length: this.width }, () => ({ tile: 0 /* VOID */, explored: false, visible: false }))
      );
    }
    get(x, y) {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
      return this.grid[y][x];
    }
    tile(x, y) {
      return this.get(x, y)?.tile ?? 0 /* VOID */;
    }
    isPassable(x, y) {
      return PASSABLE_TILES.has(this.tile(x, y));
    }
    isSolid(x, y) {
      return SOLID_TILES.has(this.tile(x, y));
    }
  };
  var BSPNode = class {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.left = null;
      this.right = null;
      this.room = null;
    }
    isLeaf() {
      return this.left === null && this.right === null;
    }
  };
  function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function carveRect(level, x, y, w, h, tile) {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++)
        if (row >= 0 && row < level.height && col >= 0 && col < level.width)
          level.grid[row][col].tile = tile;
  }
  var MIN_LEAF = 10;
  function split(node, depth) {
    if (depth === 0 || node.w < MIN_LEAF * 2 && node.h < MIN_LEAF * 2) return;
    const canH = node.h >= MIN_LEAF * 2;
    const canV = node.w >= MIN_LEAF * 2;
    const splitH = canH && (!canV || Math.random() < 0.5);
    if (splitH) {
      const cut = randInt(MIN_LEAF, node.h - MIN_LEAF);
      node.left = new BSPNode(node.x, node.y, node.w, cut);
      node.right = new BSPNode(node.x, node.y + cut, node.w, node.h - cut);
    } else {
      const cut = randInt(MIN_LEAF, node.w - MIN_LEAF);
      node.left = new BSPNode(node.x, node.y, cut, node.h);
      node.right = new BSPNode(node.x + cut, node.y, node.w - cut, node.h);
    }
    split(node.left, depth - 1);
    split(node.right, depth - 1);
  }
  function placeRooms(node, level) {
    if (node.isLeaf()) {
      const rw = randInt(5, Math.min(node.w - 2, 14));
      const rh = randInt(4, Math.min(node.h - 2, 10));
      const rx = node.x + randInt(1, node.w - rw - 1);
      const ry = node.y + randInt(1, node.h - rh - 1);
      const room = { x: rx, y: ry, w: rw, h: rh };
      node.room = room;
      level.rooms.push(room);
      carveRect(level, rx, ry, rw, rh, 2 /* FLOOR */);
    } else {
      if (node.left) placeRooms(node.left, level);
      if (node.right) placeRooms(node.right, level);
    }
  }
  function roomCenter(r) {
    return [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
  }
  function carveCorridor(level, x1, y1, x2, y2) {
    let cx = x1, cy = y1;
    if (Math.random() < 0.5) {
      while (cx !== x2) {
        const t = level.tile(cx, cy);
        if (t === 0 /* VOID */) level.grid[cy][cx].tile = 3 /* CORRIDOR */;
        cx += cx < x2 ? 1 : -1;
      }
      while (cy !== y2) {
        const t = level.tile(cx, cy);
        if (t === 0 /* VOID */) level.grid[cy][cx].tile = 3 /* CORRIDOR */;
        cy += cy < y2 ? 1 : -1;
      }
    } else {
      while (cy !== y2) {
        const t = level.tile(cx, cy);
        if (t === 0 /* VOID */) level.grid[cy][cx].tile = 3 /* CORRIDOR */;
        cy += cy < y2 ? 1 : -1;
      }
      while (cx !== x2) {
        const t = level.tile(cx, cy);
        if (t === 0 /* VOID */) level.grid[cy][cx].tile = 3 /* CORRIDOR */;
        cx += cx < x2 ? 1 : -1;
      }
    }
  }
  function connectBSP(node, level) {
    if (node.isLeaf()) return;
    connectBSP(node.left, level);
    connectBSP(node.right, level);
    const lRoom = findRoom(node.left);
    const rRoom = findRoom(node.right);
    if (lRoom && rRoom) {
      const [x1, y1] = roomCenter(lRoom);
      const [x2, y2] = roomCenter(rRoom);
      carveCorridor(level, x1, y1, x2, y2);
    }
  }
  function findRoom(node) {
    if (node.room) return node.room;
    if (node.left) {
      const r = findRoom(node.left);
      if (r) return r;
    }
    if (node.right) {
      const r = findRoom(node.right);
      if (r) return r;
    }
    return null;
  }
  function placeDoors(level) {
    const { width: W, height: H } = level;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (level.tile(x, y) !== 3 /* CORRIDOR */) continue;
        const adjFloor = (level.tile(x - 1, y) === 2 /* FLOOR */ ? 1 : 0) + (level.tile(x + 1, y) === 2 /* FLOOR */ ? 1 : 0) + (level.tile(x, y - 1) === 2 /* FLOOR */ ? 1 : 0) + (level.tile(x, y + 1) === 2 /* FLOOR */ ? 1 : 0);
        if (adjFloor >= 1 && Math.random() < 0.6) {
          level.grid[y][x].tile = 4 /* DOOR_CLOSED */;
        }
      }
    }
  }
  function placeStairs(level, hasUp, hasDown) {
    const rooms = [...level.rooms];
    if (rooms.length === 0) return;
    if (hasUp) {
      const r = rooms[0];
      const [cx, cy] = roomCenter(r);
      level.grid[cy][cx].tile = 6 /* STAIRS_UP */;
      level.stairsUp = [cx, cy];
    }
    if (hasDown && rooms.length > 1) {
      const r = rooms[rooms.length - 1];
      const [cx, cy] = roomCenter(r);
      level.grid[cy][cx].tile = 7 /* STAIRS_DOWN */;
      level.stairsDown = [cx, cy];
    } else if (hasDown) {
      const r = rooms[0];
      const px = clamp(r.x + r.w - 2, 0, level.width - 1);
      const py = clamp(r.y + r.h - 2, 0, level.height - 1);
      level.grid[py][px].tile = 7 /* STAIRS_DOWN */;
      level.stairsDown = [px, py];
    }
  }
  function addVault(level) {
    for (let attempts = 0; attempts < 20; attempts++) {
      const x = 2 + Math.floor(Math.random() * (level.width - 6));
      const y = 2 + Math.floor(Math.random() * (level.height - 6));
      if (level.grid[y][x].tile !== 1 /* WALL */) continue;
      let adjCorridor = false;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const t = level.grid[y + dy]?.[x + dx]?.tile;
        if (t === 3 /* CORRIDOR */ || t === 2 /* FLOOR */) {
          adjCorridor = true;
          break;
        }
      }
      if (!adjCorridor) continue;
      let clear = true;
      for (let dy = 0; dy <= 2 && clear; dy++)
        for (let dx = 0; dx <= 2 && clear; dx++)
          if (level.grid[y + dy]?.[x + dx]?.tile !== 1 /* WALL */) clear = false;
      if (!clear) continue;
      for (let dy = 0; dy <= 1; dy++)
        for (let dx = 0; dx <= 1; dx++)
          level.grid[y + dy][x + dx] = { tile: 2 /* FLOOR */, explored: false, visible: false };
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx * 2, ny = y + dy * 2;
        const t = level.grid[ny]?.[nx]?.tile;
        if (t === 3 /* CORRIDOR */ || t === 2 /* FLOOR */) {
          level.grid[y + dy][x + dx] = { tile: 3 /* CORRIDOR */, explored: false, visible: false };
          break;
        }
      }
      return [x, y];
    }
    return null;
  }
  function generateMaze(width, height) {
    const level = new DungeonLevel();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        level.grid[y][x] = { tile: 1 /* WALL */, explored: false, visible: false };
    const mw = Math.floor((width - 1) / 2);
    const mh = Math.floor((height - 1) / 2);
    const visited = new Uint8Array(mw * mh);
    const stack = [];
    const startCx = Math.floor(Math.random() * mw);
    const startCy = Math.floor(Math.random() * mh);
    stack.push([startCx, startCy]);
    visited[startCy * mw + startCx] = 1;
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (stack.length > 0) {
      const [cx, cy] = stack[stack.length - 1];
      const mx = cx * 2 + 1;
      const my = cy * 2 + 1;
      level.grid[my][mx] = { tile: 2 /* FLOOR */, explored: false, visible: false };
      const neighbors = [];
      for (const [dx, dy] of dirs) {
        const ncx = cx + dx, ncy = cy + dy;
        if (ncx < 0 || ncx >= mw || ncy < 0 || ncy >= mh) continue;
        if (visited[ncy * mw + ncx]) continue;
        neighbors.push([ncx, ncy, mx + dx, my + dy]);
      }
      if (neighbors.length === 0) {
        stack.pop();
      } else {
        const idx = Math.floor(Math.random() * neighbors.length);
        const [ncx, ncy, wallX, wallY] = neighbors[idx];
        visited[ncy * mw + ncx] = 1;
        level.grid[wallY][wallX] = { tile: 2 /* FLOOR */, explored: false, visible: false };
        stack.push([ncx, ncy]);
      }
    }
    for (let cy = 0; cy < mh; cy++) {
      for (let cx = 0; cx < mw; cx++) {
        if (Math.random() > 0.2) continue;
        const mx = cx * 2 + 1, my = cy * 2 + 1;
        const wallOptions = [];
        for (const [dx, dy] of dirs) {
          const wx = mx + dx, wy = my + dy;
          if (wx < 0 || wx >= width || wy < 0 || wy >= height) continue;
          if (level.grid[wy][wx].tile === 1 /* WALL */) wallOptions.push([wx, wy]);
        }
        if (wallOptions.length > 0) {
          const [wx, wy] = wallOptions[Math.floor(Math.random() * wallOptions.length)];
          level.grid[wy][wx] = { tile: 2 /* FLOOR */, explored: false, visible: false };
        }
      }
    }
    const floorTiles = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (level.grid[y][x].tile === 2 /* FLOOR */) floorTiles.push([x, y]);
    if (floorTiles.length >= 2) {
      const up = floorTiles[Math.floor(Math.random() * Math.min(10, floorTiles.length))];
      let downIdx = 0, bestDist = 0;
      for (let i = 0; i < floorTiles.length; i++) {
        const d = Math.abs(floorTiles[i][0] - up[0]) + Math.abs(floorTiles[i][1] - up[1]);
        if (d > bestDist) {
          bestDist = d;
          downIdx = i;
        }
      }
      const down = floorTiles[downIdx];
      level.grid[up[1]][up[0]] = { tile: 6 /* STAIRS_UP */, explored: false, visible: false };
      level.grid[down[1]][down[0]] = { tile: 7 /* STAIRS_DOWN */, explored: false, visible: false };
      level.stairsUp = [up[0], up[1]];
      level.stairsDown = [down[0], down[1]];
    }
    level.rooms = [];
    return level;
  }
  function generateCave(width, height) {
    const level = new DungeonLevel();
    const grid = new Uint8Array(width * height);
    for (let i = 0; i < grid.length; i++)
      grid[i] = Math.random() < 0.45 ? 1 : 0;
    for (let x = 0; x < width; x++) {
      grid[0 * width + x] = 0;
      grid[(height - 1) * width + x] = 0;
    }
    for (let y = 0; y < height; y++) {
      grid[y * width + 0] = 0;
      grid[y * width + width - 1] = 0;
    }
    function countNeighbors(x, y) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
            n++;
            continue;
          }
          n += grid[ny * width + nx];
        }
      return n;
    }
    function caPass(birthMin, birthMax, surviveMin) {
      const next = new Uint8Array(grid.length);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const n = countNeighbors(x, y);
          const cur = grid[y * width + x];
          if (cur === 0) next[y * width + x] = n >= birthMin && n <= birthMax ? 1 : 0;
          else next[y * width + x] = n >= surviveMin ? 1 : 0;
        }
      }
      grid.set(next);
      for (let x = 0; x < width; x++) {
        grid[0 * width + x] = 0;
        grid[(height - 1) * width + x] = 0;
      }
      for (let y = 0; y < height; y++) {
        grid[y * width + 0] = 0;
        grid[y * width + width - 1] = 0;
      }
    }
    caPass(5, 8, 4);
    caPass(5, 8, 4);
    caPass(5, 8, 3);
    caPass(5, 8, 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isFloor = grid[y * width + x] === 1;
        level.grid[y][x] = { tile: isFloor ? 2 /* FLOOR */ : 1 /* WALL */, explored: false, visible: false };
      }
    }
    const floodVisited = new Uint8Array(width * height);
    let bestStart = [0, 0], bestSize = 0;
    for (let sy = 0; sy < height; sy++) {
      for (let sx = 0; sx < width; sx++) {
        if (grid[sy * width + sx] !== 1 || floodVisited[sy * width + sx]) continue;
        const q = [[sx, sy]];
        floodVisited[sy * width + sx] = 1;
        const region = [];
        let head = 0;
        while (head < q.length) {
          const [cx, cy] = q[head++];
          region.push([cx, cy]);
          for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            if (grid[ny * width + nx] !== 1 || floodVisited[ny * width + nx]) continue;
            floodVisited[ny * width + nx] = 1;
            q.push([nx, ny]);
          }
        }
        if (region.length > bestSize) {
          bestSize = region.length;
          bestStart = [sx, sy];
        }
      }
    }
    const mainVisited = new Uint8Array(width * height);
    const bfsQ = [bestStart];
    mainVisited[bestStart[1] * width + bestStart[0]] = 1;
    let bfsHead = 0;
    while (bfsHead < bfsQ.length) {
      const [cx, cy] = bfsQ[bfsHead++];
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (grid[ny * width + nx] !== 1 || mainVisited[ny * width + nx]) continue;
        mainVisited[ny * width + nx] = 1;
        bfsQ.push([nx, ny]);
      }
    }
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (grid[y * width + x] === 1 && !mainVisited[y * width + x])
          level.grid[y][x] = { tile: 1 /* WALL */, explored: false, visible: false };
    const floors = [];
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (level.grid[y][x].tile === 2 /* FLOOR */) floors.push([x, y]);
    if (floors.length >= 2) {
      const up = floors[Math.floor(Math.random() * Math.floor(floors.length * 0.1))];
      let downIdx = 0, bestDist = 0;
      for (let i = 0; i < floors.length; i++) {
        const d = Math.abs(floors[i][0] - up[0]) + Math.abs(floors[i][1] - up[1]);
        if (d > bestDist) {
          bestDist = d;
          downIdx = i;
        }
      }
      const dn = floors[downIdx];
      level.grid[up[1]][up[0]] = { tile: 6 /* STAIRS_UP */, explored: false, visible: false };
      level.grid[dn[1]][dn[0]] = { tile: 7 /* STAIRS_DOWN */, explored: false, visible: false };
      level.stairsUp = [up[0], up[1]];
      level.stairsDown = [dn[0], dn[1]];
    }
    level.rooms = [];
    return level;
  }
  function generateLevel(dlvl, hasUp, hasDown) {
    const lvl = new DungeonLevel();
    if (dlvl % 5 === 0) {
      return generateCave(lvl.width, lvl.height);
    }
    if (dlvl % 3 === 0) {
      return generateMaze(lvl.width, lvl.height);
    }
    const level = new DungeonLevel();
    const root = new BSPNode(0, 0, level.width, level.height);
    split(root, 4);
    placeRooms(root, level);
    connectBSP(root, level);
    placeDoors(level);
    placeStairs(level, hasUp, hasDown);
    if (Math.random() < 0.3) {
      addVault(level);
    }
    return level;
  }
  var Dungeon = class {
    constructor(maxLevel) {
      this.levels = /* @__PURE__ */ new Map();
      this.maxLevel = maxLevel;
    }
    getLevel(dlvl) {
      if (!this.levels.has(dlvl)) {
        this.levels.set(dlvl, generateLevel(
          dlvl,
          dlvl > 1,
          dlvl < this.maxLevel
        ));
      }
      return this.levels.get(dlvl);
    }
  };

  // src/data.ts
  var MONSTER_DATA = {
    newt: {
      symbol: ":",
      name: "newt",
      color: COL_MONSTER_EASY,
      hpDice: [1, 1, 0],
      ac: 9,
      damage: [1, 2, 0],
      speed: 6,
      xpValue: 1,
      difficulty: 1,
      freq: 5,
      group: "none",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    bat: {
      symbol: "B",
      name: "bat",
      color: COL_MONSTER_EASY,
      hpDice: [1, 4, 0],
      ac: 8,
      damage: [1, 2, 0],
      speed: 22,
      xpValue: 1,
      difficulty: 1,
      freq: 5,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    grid_bug: {
      symbol: "x",
      name: "grid bug",
      color: COL_MONSTER_EASY,
      hpDice: [1, 4, 0],
      ac: 9,
      damage: [1, 2, 0],
      speed: 12,
      xpValue: 3,
      difficulty: 1,
      freq: 3,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    jackal: {
      symbol: "d",
      name: "jackal",
      color: COL_MONSTER_EASY,
      hpDice: [1, 4, 0],
      ac: 7,
      damage: [1, 2, 0],
      speed: 12,
      xpValue: 2,
      difficulty: 1,
      freq: 4,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    kobold: {
      symbol: "k",
      name: "kobold",
      color: COL_MONSTER_EASY,
      hpDice: [1, 8, 0],
      ac: 7,
      damage: [1, 6, 0],
      speed: 10,
      xpValue: 8,
      difficulty: 1,
      freq: 4,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "poisonous"
    },
    goblin: {
      symbol: "g",
      name: "goblin",
      color: COL_MONSTER_EASY,
      hpDice: [1, 4, 0],
      ac: 10,
      damage: [1, 3, 0],
      speed: 6,
      xpValue: 2,
      difficulty: 1,
      freq: 4,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    giant_ant: {
      symbol: "a",
      name: "giant ant",
      color: COL_MONSTER_EASY,
      hpDice: [1, 6, 0],
      ac: 3,
      damage: [1, 4, 0],
      speed: 18,
      xpValue: 5,
      difficulty: 2,
      freq: 3,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    centipede: {
      symbol: "s",
      name: "centipede",
      color: COL_MONSTER_EASY,
      hpDice: [1, 4, 0],
      ac: 3,
      damage: [1, 2, 0],
      speed: 4,
      xpValue: 5,
      difficulty: 2,
      freq: 3,
      group: "none",
      flags: /* @__PURE__ */ new Set(["poison_attack"]),
      corpseEffect: "poisonous"
    },
    gnome: {
      symbol: "G",
      name: "gnome",
      color: COL_MONSTER_EASY,
      hpDice: [1, 6, 0],
      ac: 10,
      damage: [1, 6, 0],
      speed: 6,
      xpValue: 3,
      difficulty: 2,
      freq: 4,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    hobgoblin: {
      symbol: "o",
      name: "hobgoblin",
      color: COL_MONSTER_EASY,
      hpDice: [1, 8, 0],
      ac: 10,
      damage: [1, 6, 0],
      speed: 9,
      xpValue: 3,
      difficulty: 2,
      freq: 4,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    giant_rat: {
      symbol: "r",
      name: "giant rat",
      color: COL_MONSTER_EASY,
      hpDice: [1, 6, 1],
      ac: 7,
      damage: [1, 4, 0],
      speed: 10,
      xpValue: 5,
      difficulty: 1,
      freq: 4,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    orc: {
      symbol: "o",
      name: "orc",
      color: COL_MONSTER_EASY,
      hpDice: [1, 8, 0],
      ac: 10,
      damage: [1, 8, 0],
      speed: 9,
      xpValue: 5,
      difficulty: 3,
      freq: 4,
      group: "large",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    wolf: {
      symbol: "d",
      name: "wolf",
      color: COL_MONSTER_EASY,
      hpDice: [2, 6, 0],
      ac: 7,
      damage: [2, 4, 0],
      speed: 12,
      xpValue: 5,
      difficulty: 3,
      freq: 3,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    dwarf: {
      symbol: "h",
      name: "dwarf",
      color: COL_MONSTER_EASY,
      hpDice: [2, 8, 0],
      ac: 10,
      damage: [1, 6, 0],
      speed: 6,
      xpValue: 4,
      difficulty: 3,
      freq: 3,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    killer_bee: {
      symbol: "a",
      name: "killer bee",
      color: COL_MONSTER_EASY,
      hpDice: [1, 4, 0],
      ac: 4,
      damage: [1, 3, 0],
      speed: 18,
      xpValue: 5,
      difficulty: 3,
      freq: 4,
      group: "large",
      flags: /* @__PURE__ */ new Set(["poison_attack"]),
      corpseEffect: "poisonous"
    },
    zombie: {
      symbol: "Z",
      name: "zombie",
      color: COL_MONSTER_EASY,
      hpDice: [2, 8, 0],
      ac: 8,
      damage: [1, 6, 0],
      speed: 6,
      xpValue: 4,
      difficulty: 3,
      freq: 4,
      group: "none",
      flags: /* @__PURE__ */ new Set(["undead"]),
      corpseEffect: "sickness"
    },
    floating_eye: {
      symbol: "e",
      name: "floating eye",
      color: COL_MONSTER_EASY,
      hpDice: [1, 10, 0],
      ac: 9,
      damage: [0, 0, 0],
      speed: 1,
      xpValue: 10,
      difficulty: 3,
      freq: 3,
      group: "none",
      flags: /* @__PURE__ */ new Set(["passive_paralyze"]),
      corpseEffect: "telepathy"
    },
    gelatinous_cube: {
      symbol: "b",
      name: "gelatinous cube",
      color: COL_MONSTER_EASY,
      hpDice: [4, 16, 0],
      ac: 8,
      damage: [2, 4, 0],
      speed: 6,
      xpValue: 15,
      difficulty: 4,
      freq: 3,
      group: "none",
      flags: /* @__PURE__ */ new Set(["passive_paralyze"]),
      corpseEffect: "safe"
    },
    skeleton: {
      symbol: "Z",
      name: "skeleton",
      color: COL_MONSTER_EASY,
      hpDice: [3, 12, 0],
      ac: 7,
      damage: [1, 6, 0],
      speed: 6,
      xpValue: 6,
      difficulty: 4,
      freq: 2,
      group: "none",
      flags: /* @__PURE__ */ new Set(["undead"]),
      corpseEffect: "safe"
    },
    warg: {
      symbol: "d",
      name: "warg",
      color: COL_MONSTER_EASY,
      hpDice: [2, 8, 0],
      ac: 7,
      damage: [2, 4, 0],
      speed: 12,
      xpValue: 7,
      difficulty: 4,
      freq: 3,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    giant_spider: {
      symbol: "s",
      name: "giant spider",
      color: COL_MONSTER_EASY,
      hpDice: [3, 6, 0],
      ac: 5,
      damage: [2, 4, 0],
      speed: 15,
      xpValue: 15,
      difficulty: 4,
      freq: 3,
      group: "none",
      flags: /* @__PURE__ */ new Set(["poison_attack"]),
      corpseEffect: "poisonous"
    },
    elf: {
      symbol: "@",
      name: "elf",
      color: COL_MONSTER_EASY,
      hpDice: [1, 8, 0],
      ac: 9,
      damage: [2, 6, 0],
      speed: 12,
      xpValue: 5,
      difficulty: 5,
      freq: 3,
      group: "small",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    ogre: {
      symbol: "O",
      name: "ogre",
      color: COL_MONSTER_TOUGH,
      hpDice: [3, 12, 0],
      ac: 5,
      damage: [2, 6, 0],
      speed: 9,
      xpValue: 12,
      difficulty: 5,
      freq: 3,
      group: "none",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    wraith: {
      symbol: "W",
      name: "wraith",
      color: COL_MONSTER_TOUGH,
      hpDice: [4, 16, 0],
      ac: 4,
      damage: [1, 6, 0],
      speed: 12,
      xpValue: 10,
      difficulty: 6,
      freq: 2,
      group: "none",
      flags: /* @__PURE__ */ new Set(["undead", "drain_level"]),
      corpseEffect: "safe"
    },
    mimic: {
      symbol: "m",
      name: "mimic",
      color: COL_MONSTER_TOUGH,
      hpDice: [4, 12, 0],
      ac: 7,
      damage: [3, 4, 0],
      speed: 3,
      xpValue: 10,
      difficulty: 6,
      freq: 2,
      group: "none",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    ochre_jelly: {
      symbol: "j",
      name: "ochre jelly",
      color: COL_MONSTER_TOUGH,
      hpDice: [6, 20, 0],
      ac: 8,
      damage: [3, 6, 0],
      speed: 3,
      xpValue: 20,
      difficulty: 6,
      freq: 2,
      group: "none",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    troll: {
      symbol: "T",
      name: "troll",
      color: COL_MONSTER_TOUGH,
      hpDice: [4, 10, 5],
      ac: 2,
      damage: [2, 8, 3],
      speed: 10,
      xpValue: 50,
      difficulty: 7,
      freq: 3,
      group: "none",
      flags: /* @__PURE__ */ new Set(["regenerate"]),
      corpseEffect: "safe"
    },
    minotaur: {
      symbol: "q",
      name: "minotaur",
      color: COL_MONSTER_TOUGH,
      hpDice: [6, 20, 0],
      ac: 6,
      damage: [3, 10, 0],
      speed: 15,
      xpValue: 35,
      difficulty: 8,
      freq: 2,
      group: "none",
      flags: /* @__PURE__ */ new Set(),
      corpseEffect: "safe"
    },
    vampire: {
      symbol: "V",
      name: "vampire",
      color: COL_MONSTER_TOUGH,
      hpDice: [6, 24, 0],
      ac: 1,
      damage: [1, 8, 0],
      speed: 12,
      xpValue: 40,
      difficulty: 10,
      freq: 2,
      group: "none",
      flags: /* @__PURE__ */ new Set(["undead", "drain_level"]),
      corpseEffect: "safe"
    },
    lich: {
      symbol: "L",
      name: "lich",
      color: COL_MONSTER_TOUGH,
      hpDice: [7, 24, 0],
      ac: 0,
      damage: [3, 4, 0],
      speed: 9,
      xpValue: 50,
      difficulty: 11,
      freq: 1,
      group: "none",
      flags: /* @__PURE__ */ new Set(["undead", "magic_spell"]),
      corpseEffect: "safe"
    },
    dragon: {
      symbol: "D",
      name: "dragon",
      color: COL_MONSTER_TOUGH,
      hpDice: [7, 28, 0],
      ac: -1,
      damage: [4, 8, 0],
      speed: 9,
      xpValue: 100,
      difficulty: 12,
      freq: 1,
      group: "none",
      flags: /* @__PURE__ */ new Set(["fire_breath"]),
      corpseEffect: "safe"
    }
  };
  var WEAPON_DATA = {
    dagger: { symbol: ")", name: "dagger", color: COL_ITEM, damage: [1, 4, 0], weight: 10, toHit: 0 },
    hand_axe: { symbol: ")", name: "hand axe", color: COL_ITEM, damage: [1, 6, 0], weight: 60, toHit: 0 },
    short_sword: { symbol: ")", name: "short sword", color: COL_ITEM, damage: [1, 6, 0], weight: 30, toHit: 0 },
    spear: { symbol: ")", name: "spear", color: COL_ITEM, damage: [1, 6, 0], weight: 50, toHit: 0 },
    trident: { symbol: ")", name: "trident", color: COL_ITEM, damage: [1, 6, 0], weight: 75, toHit: 0 },
    mace: { symbol: ")", name: "mace", color: COL_ITEM, damage: [1, 8, 0], weight: 40, toHit: 0 },
    flail: { symbol: ")", name: "flail", color: COL_ITEM, damage: [1, 8, 0], weight: 75, toHit: 0 },
    quarterstaff: { symbol: ")", name: "quarterstaff", color: COL_ITEM, damage: [1, 6, 0], weight: 40, toHit: 1 },
    long_sword: { symbol: ")", name: "long sword", color: COL_ITEM, damage: [1, 8, 1], weight: 40, toHit: 1 },
    battle_axe: { symbol: ")", name: "battle axe", color: COL_ITEM, damage: [2, 4, 0], weight: 120, toHit: 0 },
    morning_star: { symbol: ")", name: "morning star", color: COL_ITEM, damage: [2, 4, 0], weight: 120, toHit: 0 },
    two_handed_sword: { symbol: ")", name: "two-handed sword", color: COL_ITEM, damage: [3, 6, 0], weight: 150, toHit: 0 },
    katana: { symbol: ")", name: "katana", color: COL_ITEM, damage: [1, 10, 0], weight: 40, toHit: 1 },
    rapier: { symbol: ")", name: "rapier", color: COL_ITEM, damage: [1, 6, 0], weight: 30, toHit: 2 },
    bow: { symbol: ")", name: "bow", color: COL_ITEM, damage: [1, 6, 0], weight: 30, toHit: 0 }
  };
  var ARMOR_DATA = {
    leather_armor: { symbol: "[", name: "leather armor", color: COL_ITEM, acBonus: -2, weight: 50, slot: "suit" },
    studded_leather: { symbol: "[", name: "studded leather armor", color: COL_ITEM, acBonus: -3, weight: 200, slot: "suit" },
    ring_mail: { symbol: "[", name: "ring mail", color: COL_ITEM, acBonus: -3, weight: 80, slot: "suit" },
    chain_mail: { symbol: "[", name: "chain mail", color: COL_ITEM, acBonus: -5, weight: 120, slot: "suit" },
    plate_mail: { symbol: "[", name: "plate mail", color: COL_ITEM, acBonus: -7, weight: 180, slot: "suit" },
    elven_mithril: { symbol: "[", name: "elven mithril-coat", color: COL_ITEM, acBonus: -5, weight: 15, slot: "suit" },
    helmet: { symbol: "[", name: "helmet", color: COL_ITEM, acBonus: -1, weight: 30, slot: "helm" },
    leather_gloves: { symbol: "[", name: "leather gloves", color: COL_ITEM, acBonus: -1, weight: 8, slot: "gloves" },
    high_boots: { symbol: "[", name: "high boots", color: COL_ITEM, acBonus: -1, weight: 20, slot: "boots" },
    small_shield: { symbol: "[", name: "small shield", color: COL_ITEM, acBonus: -1, weight: 30, slot: "shield" },
    large_shield: { symbol: "[", name: "large shield", color: COL_ITEM, acBonus: -2, weight: 100, slot: "shield" },
    cloak_of_protection: { symbol: "[", name: "cloak of protection", color: COL_ITEM, acBonus: -3, weight: 10, slot: "cloak" }
  };
  var FOOD_DATA = {
    ration: { symbol: "%", name: "food ration", color: COL_ITEM, nutrition: 400, weight: 20 },
    cram: { symbol: "%", name: "cram ration", color: COL_ITEM, nutrition: 600, weight: 15 },
    k_ration: { symbol: "%", name: "K-ration", color: COL_ITEM, nutrition: 400, weight: 10 },
    c_ration: { symbol: "%", name: "C-ration", color: COL_ITEM, nutrition: 300, weight: 10 },
    lembas: { symbol: "%", name: "lembas wafer", color: COL_ITEM, nutrition: 800, weight: 5 },
    apple: { symbol: "%", name: "apple", color: COL_ITEM, nutrition: 100, weight: 2 },
    banana: { symbol: "%", name: "banana", color: COL_ITEM, nutrition: 80, weight: 2 },
    carrot: { symbol: "%", name: "carrot", color: COL_ITEM, nutrition: 50, weight: 1 },
    pear: { symbol: "%", name: "pear", color: COL_ITEM, nutrition: 50, weight: 2 },
    melon: { symbol: "%", name: "melon", color: COL_ITEM, nutrition: 100, weight: 30 },
    orange: { symbol: "%", name: "orange", color: COL_ITEM, nutrition: 80, weight: 2 },
    slime_mold: { symbol: "%", name: "slime mold", color: COL_ITEM, nutrition: 100, weight: 5 },
    lizard: { symbol: "%", name: "lizard corpse", color: COL_ITEM, nutrition: 40, weight: 3 }
  };
  var POTION_DATA = {
    healing: { symbol: "!", name: "potion of healing", color: COL_ITEM, effect: "heal", healAmount: [2, 8, 2] },
    extra_healing: { symbol: "!", name: "potion of extra healing", color: COL_ITEM, effect: "heal", healAmount: [4, 8, 4] },
    full_healing: { symbol: "!", name: "potion of full healing", color: COL_ITEM, effect: "full_heal" },
    poison: { symbol: "!", name: "potion of sickness", color: COL_ITEM, effect: "poison", damage: [1, 6, 0] },
    sickness: { symbol: "!", name: "potion of sickness", color: COL_ITEM, effect: "sickness", duration: 20 },
    acid: { symbol: "!", name: "potion of acid", color: COL_ITEM, effect: "acid", damage: [1, 6, 0] },
    speed: { symbol: "!", name: "potion of speed", color: COL_ITEM, effect: "speed", duration: 20 },
    levitation: { symbol: "!", name: "potion of levitation", color: COL_ITEM, effect: "levitation", duration: 20 },
    confusion: { symbol: "!", name: "potion of confusion", color: COL_ITEM, effect: "confusion", duration: 10 },
    blindness: { symbol: "!", name: "potion of blindness", color: COL_ITEM, effect: "blindness", duration: 15 },
    paralysis: { symbol: "!", name: "potion of paralysis", color: COL_ITEM, effect: "paralysis", duration: 5 },
    invisibility: { symbol: "!", name: "potion of invisibility", color: COL_ITEM, effect: "invisibility" },
    gain_ability: { symbol: "!", name: "potion of gain ability", color: COL_ITEM, effect: "gain_str" },
    see_invisible: { symbol: "!", name: "potion of see invisible", color: COL_ITEM, effect: "see_invisible" },
    water: { symbol: "!", name: "potion of water", color: COL_ITEM, effect: "water" },
    booze: { symbol: "!", name: "potion of booze", color: COL_ITEM, effect: "booze", duration: 5 },
    restore_ability: { symbol: "!", name: "potion of restore ability", color: COL_ITEM, effect: "restore_ability" },
    gain_level: { symbol: "!", name: "potion of gain level", color: COL_ITEM, effect: "gain_level" }
  };
  var SCROLL_DATA = {
    identify: { symbol: "?", name: "scroll of identify", color: COL_ITEM, effect: "identify" },
    teleportation: { symbol: "?", name: "scroll of teleportation", color: COL_ITEM, effect: "teleport" },
    enchant_weapon: { symbol: "?", name: "scroll of enchant weapon", color: COL_ITEM, effect: "enchant_weapon" },
    enchant_armor: { symbol: "?", name: "scroll of enchant armor", color: COL_ITEM, effect: "enchant_armor" },
    magic_mapping: { symbol: "?", name: "scroll of magic mapping", color: COL_ITEM, effect: "magic_mapping" },
    remove_curse: { symbol: "?", name: "scroll of remove curse", color: COL_ITEM, effect: "remove_curse", label: "XYZZY PLUGH" },
    genocide: { symbol: "?", name: "scroll of genocide", color: COL_ITEM, effect: "genocide", label: "NR 9" },
    taming: { symbol: "?", name: "scroll of taming", color: COL_ITEM, effect: "taming", label: "ABRA KA DABRA" },
    scare_monster: { symbol: "?", name: "scroll of scare monster", color: COL_ITEM, effect: "scare_monster", label: "ELBERETH" },
    fire: { symbol: "?", name: "scroll of fire", color: COL_ITEM, effect: "fire", label: "FOOBIE BLETCH" },
    earth: { symbol: "?", name: "scroll of earth", color: COL_ITEM, effect: "earth", label: "ELBIB YLOH" },
    create_monster: { symbol: "?", name: "scroll of create monster", color: COL_ITEM, effect: "create_monster", label: "ZELGO MER" }
  };
  var RING_DATA = {
    protection: { name: "ring of protection", adjective: "plain", effect: "ac_bonus", power: 3 },
    fire_res: { name: "ring of fire resistance", adjective: "onyx", effect: "fire_resist", power: 0 },
    cold_res: { name: "ring of cold resistance", adjective: "sapphire", effect: "cold_resist", power: 0 },
    poison_res: { name: "ring of poison resistance", adjective: "jade", effect: "poison_resist", power: 0 },
    hunger: { name: "ring of slow digestion", adjective: "ivory", effect: "slow_hunger", power: 0 },
    regeneration: { name: "ring of regeneration", adjective: "coral", effect: "regen", power: 0 },
    searching: { name: "ring of searching", adjective: "wooden", effect: "searching", power: 0 },
    stealth: { name: "ring of stealth", adjective: "obsidian", effect: "stealth", power: 0 },
    teleportation: { name: "ring of teleportation", adjective: "ammolite", effect: "teleport", power: 0 },
    levitation: { name: "ring of levitation", adjective: "pearl", effect: "levitate", power: 0 },
    strength: { name: "ring of gain strength", adjective: "iron", effect: "str_bonus", power: 2 },
    invisibility: { name: "ring of invisibility", adjective: "moonshadow", effect: "invisible", power: 0 },
    see_invis: { name: "ring of see invisible", adjective: "crystal", effect: "see_invis", power: 0 },
    conflict: { name: "ring of conflict", adjective: "ruby", effect: "conflict", power: 0 },
    free_action: { name: "ring of free action", adjective: "emerald", effect: "free_action", power: 0 },
    sustain_ability: { name: "ring of sustain ability", adjective: "diamond", effect: "sustain", power: 0 },
    aggravate: { name: "ring of aggravate monster", adjective: "tiger eye", effect: "aggravate", power: 0 },
    adornment: { name: "ring of adornment", adjective: "gold", effect: "charisma", power: 2 }
  };
  var WAND_DATA = {
    wishing: { name: "wand of wishing", material: "glass", effect: "wish", charges: [1, 3] },
    death: { name: "wand of death", material: "ebony", effect: "death", charges: [3, 8] },
    polymorph: { name: "wand of polymorph", material: "copper", effect: "polymorph", charges: [3, 8] },
    teleport_away: { name: "wand of teleportation", material: "brass", effect: "teleport_away", charges: [3, 8] },
    cancellation: { name: "wand of cancellation", material: "platinum", effect: "cancellation", charges: [3, 8] },
    striking: { name: "wand of striking", material: "oaken", effect: "striking", charges: [3, 8] },
    magic_missile: { name: "wand of magic missile", material: "balsa", effect: "magic_missile", charges: [3, 8] },
    fire: { name: "wand of fire", material: "steel", effect: "fire_bolt", charges: [3, 8] },
    cold: { name: "wand of cold", material: "silver", effect: "cold_bolt", charges: [3, 8] },
    lightning: { name: "wand of lightning", material: "tin", effect: "lightning", charges: [3, 8] },
    sleep: { name: "wand of sleep", material: "bamboo", effect: "sleep_bolt", charges: [3, 8] },
    slow_monster: { name: "wand of slow monster", material: "maple", effect: "slow", charges: [3, 8] },
    speed_monster: { name: "wand of speed monster", material: "pine", effect: "haste_monster", charges: [3, 8] },
    digging: { name: "wand of digging", material: "iron", effect: "dig", charges: [3, 8] },
    light: { name: "wand of light", material: "crystal", effect: "light", charges: [10, 20] }
  };
  var POTION_COLORS = [
    "ruby",
    "pink",
    "orange",
    "yellow",
    "emerald",
    "cyan",
    "magenta",
    "milky",
    "muddy",
    "smoky",
    "golden",
    "dark",
    "clear",
    "effervescent",
    "slimy",
    "bubbly",
    "white",
    "fizzy",
    "swirly",
    "thick",
    "sparkling",
    "brown",
    "sickly"
  ];
  var POTION_COLOR_HEX = {
    ruby: "#ee2233",
    pink: "#ff88bb",
    orange: "#ff8800",
    yellow: "#ffee00",
    emerald: "#00cc44",
    cyan: "#00ddee",
    magenta: "#ff44ee",
    milky: "#ddddc8",
    muddy: "#7a5533",
    smoky: "#aaaaaa",
    golden: "#ffcc00",
    dark: "#442233",
    clear: "#aaddff",
    effervescent: "#88ffcc",
    slimy: "#44aa22",
    bubbly: "#88aaff",
    white: "#eeeeff",
    fizzy: "#aaffee",
    swirly: "#bb88ff",
    thick: "#996644",
    sparkling: "#ffccff",
    brown: "#884422",
    sickly: "#99aa44"
  };
  var SCROLL_LABELS = [
    "ZELGO MER",
    "JUYED AWK YACC",
    "NR 9",
    "XIXAXA XOXAXA",
    "PRATYAVAYAH",
    "DAIYEN FANSEN",
    "LEP GEX VEN ZEA",
    "TEMOV",
    "GARVEN DEH",
    "READ ME",
    "ELBIB YLOH",
    "VERR YED HULL",
    "VENZAR BORGAVVE",
    "THARR",
    "YUM YUM",
    "DUAM QUASSIN"
  ];
  var RING_ADJECTIVES = [
    "plain",
    "onyx",
    "sapphire",
    "jade",
    "ivory",
    "coral",
    "wooden",
    "obsidian",
    "ammolite",
    "pearl",
    "iron",
    "moonshadow",
    "crystal",
    "ruby",
    "emerald",
    "diamond",
    "tiger eye",
    "gold"
  ];
  var WAND_MATERIALS = [
    "glass",
    "ebony",
    "copper",
    "brass",
    "platinum",
    "oaken",
    "balsa",
    "steel",
    "silver",
    "tin",
    "bamboo",
    "maple",
    "pine",
    "iron",
    "crystal"
  ];
  var ROLE_DATA = {
    barbarian: {
      name: "Barbarian",
      baseStats: [16, 7, 7, 15, 16, 6],
      hpStart: 14,
      hpDice: [2, 10],
      alignments: ["neutral", "chaotic"],
      startWeapon: "battle_axe",
      startArmor: "leather_armor",
      description: "A fierce warrior from the wilderness. High strength and constitution. Favors brute force over finesse."
    },
    valkyrie: {
      name: "Valkyrie",
      baseStats: [10, 7, 7, 7, 10, 7],
      hpStart: 14,
      hpDice: [2, 8],
      alignments: ["lawful", "neutral"],
      startWeapon: "long_sword",
      startArmor: "ring_mail",
      description: "A shield maiden of legend. Well-balanced fighter with good survivability and lawful bearing."
    },
    wizard: {
      name: "Wizard",
      baseStats: [7, 10, 7, 7, 7, 7],
      hpStart: 10,
      hpDice: [1, 8],
      alignments: ["neutral", "chaotic"],
      startWeapon: "quarterstaff",
      startArmor: null,
      description: "A wielder of arcane magic. Fragile but possessing broad knowledge of spells and scrolls."
    },
    rogue: {
      name: "Rogue",
      baseStats: [7, 7, 7, 10, 7, 6],
      hpStart: 10,
      hpDice: [1, 8],
      alignments: ["chaotic"],
      startWeapon: "dagger",
      startArmor: "leather_armor",
      description: "A cunning scoundrel. High dexterity makes for precise strikes and good evasion. Chaotic only."
    },
    healer: {
      name: "Healer",
      baseStats: [7, 7, 13, 7, 11, 16],
      hpStart: 11,
      hpDice: [1, 8],
      alignments: ["neutral"],
      startWeapon: "dagger",
      startArmor: null,
      description: "A skilled medic with high wisdom and charisma. Starts with extra healing potions."
    },
    knight: {
      name: "Knight",
      baseStats: [13, 7, 14, 8, 10, 17],
      hpStart: 14,
      hpDice: [2, 8],
      alignments: ["lawful"],
      startWeapon: "long_sword",
      startArmor: "ring_mail",
      description: "An armored warrior of noble bearing. High strength and charisma. Strictly lawful alignment."
    }
  };
  var RACE_DATA = {
    human: { name: "Human", statMods: [0, 0, 0, 0, 0, 0], alignments: ["lawful", "neutral", "chaotic"], description: "Adaptable and versatile. No bonuses or penalties. Compatible with any role and alignment." },
    elf: { name: "Elf", statMods: [-1, 2, 0, 2, -2, 0], alignments: ["neutral", "chaotic"], description: "Graceful and intelligent. +2 INT and DEX, -1 STR, -2 CON. Cannot be lawful." },
    dwarf: { name: "Dwarf", statMods: [2, 0, 0, 0, 2, -2], alignments: ["lawful", "neutral"], description: "Tough and strong. +2 STR and CON, -2 CHA. Cannot be chaotic." },
    gnome: { name: "Gnome", statMods: [0, 2, 0, 2, 0, -2], alignments: ["neutral"], description: "Small and clever. +2 INT and DEX, -2 CHA. Neutral alignment only." },
    orc: { name: "Orc", statMods: [3, -2, 0, 0, 3, -4], alignments: ["chaotic"], description: "Brutally powerful. +3 STR and CON, -2 INT, -4 CHA. Chaotic alignment only." }
  };
  var NAME_TABLES = {
    human: {
      male: ["Alaric", "Baldric", "Cedric", "Duncan", "Edmund", "Faramir", "Gerard", "Harold", "Ivar", "Jorik"],
      female: ["Aelith", "Brenna", "Cynara", "Delia", "Elena", "Freya", "Gwen", "Hilde", "Isolde", "Juna"]
    },
    elf: {
      male: ["Aerindel", "Caeron", "Elrohir", "Faladel", "Gildor", "Haldir", "Ithilnor", "Legolin"],
      female: ["Aelindra", "Caladwen", "Elenmir", "Finduilas", "Galawen", "Miriel", "Nimrodel"]
    },
    dwarf: {
      male: ["Bronn", "Dvalin", "Farin", "Gimvar", "Hrolf", "Kili", "Nori", "Thorin", "Bifur", "Bofur"],
      female: ["Dis", "Fara", "Helga", "Ingrid", "Kara", "Sigrid", "Thyra", "Ylva"]
    },
    gnome: {
      male: ["Alrik", "Bimble", "Clef", "Drix", "Emnic", "Fimble", "Gimble", "Hobble"],
      female: ["Bimpsy", "Cimble", "Dimble", "Elvy", "Fimsy", "Gilda", "Nimble", "Wimble"]
    },
    orc: {
      male: ["Grak", "Morg", "Vroth", "Krak", "Druk", "Gorb", "Krog", "Thrak", "Urgh", "Bruk"],
      female: ["Grukka", "Morga", "Vritha", "Krakka", "Druka", "Gorba", "Kroga"]
    }
  };

  // src/player.ts
  var nextItemId = 1;
  function makeItemId() {
    return nextItemId++;
  }
  var Player = class {
    constructor() {
      // Position
      this.x = 0.5;
      this.y = 0.5;
      this.angle = 0;
      this.pitch = 0;
      // Head bob
      this.bobPhase = 0;
      this.bobAmplitude = 0;
      // Vitals
      this.hp = 12;
      this.maxHp = 12;
      this.ac = 10;
      // Attributes
      this.str = 16;
      this.dex = 14;
      this.con = 12;
      this.int_ = 10;
      this.wis = 10;
      this.cha = 8;
      // Progression
      this.xl = 1;
      this.xp = 0;
      this.gold = 0;
      this.turns = 0;
      // Character identity
      this.role = "barbarian";
      this.race = "human";
      this.alignment = "neutral";
      this.charName = "Player";
      this.gender = "male";
      this.hpDice = [2, 8];
      // HP/level = hpDice[0] + roll(1, hpDice[1])
      // HP regeneration timer (turns since last regen tick)
      this.regenTimer = 0;
      // Hunger
      this.nutrition = 900;
      this.hungerState = 1 /* NOT_HUNGRY */;
      // Status effects
      this.paralyzed = 0;
      this.hasted = 0;
      this.blinded = 0;
      this.confused = 0;
      this.levitating = 0;
      this.poisoned = 0;
      this.sick = 0;
      // Inventory
      this.inventory = [];
      this.equip = {
        weapon: null,
        armor: null,
        ring_left: null,
        ring_right: null,
        helm: null,
        shield: null,
        boots: null,
        gloves: null,
        cloak: null
      };
    }
    // ── Derived stats ──────────────────────────────────────────────────────────
    get weaponDamage() {
      if (!this.equip.weapon) return [1, 2, 0];
      const w = WEAPON_DATA[this.equip.weapon.key];
      const enc = this.equip.weapon.enchantment;
      return [w.damage[0], w.damage[1], w.damage[2] + enc];
    }
    // NetHack uses STR (abon) for to-hit, not DEX
    strToHit() {
      const s = this.str;
      if (s < 6) return -2;
      if (s < 8) return -1;
      if (s <= 16) return 0;
      if (s <= 18) return 1;
      return 2;
    }
    get toHitBonus() {
      const wBonus = this.equip.weapon ? WEAPON_DATA[this.equip.weapon.key].toHit + this.equip.weapon.enchantment : 0;
      return this.xl + this.strToHit() + wBonus;
    }
    get effectiveAC() {
      const base = 10;
      const armorBonus = this.equip.armor ? ARMOR_DATA[this.equip.armor.key].acBonus + this.equip.armor.enchantment : 0;
      const helmBonus = this.equip.helm ? ARMOR_DATA[this.equip.helm.key].acBonus + this.equip.helm.enchantment : 0;
      const shieldBonus = this.equip.shield ? ARMOR_DATA[this.equip.shield.key].acBonus + this.equip.shield.enchantment : 0;
      const bootsBonus = this.equip.boots ? ARMOR_DATA[this.equip.boots.key].acBonus + this.equip.boots.enchantment : 0;
      const glovesBonus = this.equip.gloves ? ARMOR_DATA[this.equip.gloves.key].acBonus + this.equip.gloves.enchantment : 0;
      const cloakBonus = this.equip.cloak ? ARMOR_DATA[this.equip.cloak.key].acBonus + this.equip.cloak.enchantment : 0;
      const ringAC = this.hasRingEffect("ac_bonus") ? -3 : 0;
      return base + armorBonus + helmBonus + shieldBonus + bootsBonus + glovesBonus + cloakBonus + ringAC;
    }
    get strBonus() {
      return Math.floor((this.str - 10) / 2);
    }
    // CON modifier to HP gained per level (official NetHack formula)
    conMod() {
      const c = this.con;
      if (c <= 3) return -2;
      if (c <= 6) return -1;
      if (c <= 14) return 0;
      if (c <= 16) return 1;
      if (c === 17) return 2;
      if (c === 18) return 3;
      return 4;
    }
    // ── Ring helpers ────────────────────────────────────────────────────────────
    hasRingEffect(effect) {
      return this.equip.ring_left?.effect === effect || this.equip.ring_right?.effect === effect;
    }
    // ── Passive HP regeneration ─────────────────────────────────────────────────
    // Official NetHack: 1 HP every N turns where N = floor(42/(xl+2)) + 1
    // Level 1 → every 15 turns; level 5 → every 7; level 10+ → every 3-4.
    regenTick() {
      if (this.hp >= this.maxHp) {
        this.regenTimer = 0;
        return;
      }
      this.regenTimer++;
      const rate = Math.floor(42 / (this.xl + 2)) + 1;
      if (this.regenTimer >= rate) {
        this.regenTimer = 0;
        this.hp = Math.min(this.hp + 1, this.maxHp);
      }
    }
    // ── Status ticking ──────────────────────────────────────────────────────────
    tickStatus() {
      const msgs = [];
      if (this.blinded > 0) {
        this.blinded--;
        if (this.blinded === 0) msgs.push("Your vision clears.");
      }
      if (this.confused > 0) {
        this.confused--;
        if (this.confused === 0) msgs.push("You feel less confused.");
      }
      if (this.levitating > 0) {
        this.levitating--;
        if (this.levitating === 0) msgs.push("You float gently down.");
      }
      if (this.poisoned > 0) {
        this.poisoned--;
        if (this.poisoned === 0) msgs.push("You feel the poison fading.");
      }
      if (this.sick > 0) {
        this.sick--;
        if (this.sick === 0) msgs.push("You feel better.");
      }
      return msgs;
    }
    // ── Hunger ─────────────────────────────────────────────────────────────────
    updateHunger() {
      this.nutrition--;
      const prev = this.hungerState;
      if (this.nutrition >= HUNGER_THRESHOLDS[0 /* SATIATED */]) this.hungerState = 0 /* SATIATED */;
      else if (this.nutrition >= HUNGER_THRESHOLDS[1 /* NOT_HUNGRY */]) this.hungerState = 1 /* NOT_HUNGRY */;
      else if (this.nutrition >= HUNGER_THRESHOLDS[2 /* HUNGRY */]) this.hungerState = 2 /* HUNGRY */;
      else if (this.nutrition >= HUNGER_THRESHOLDS[3 /* WEAK */]) this.hungerState = 3 /* WEAK */;
      else if (this.nutrition >= HUNGER_THRESHOLDS[4 /* FAINTING */]) this.hungerState = 4 /* FAINTING */;
      else this.hungerState = 5 /* STARVED */;
      if (this.hungerState !== prev) {
        switch (this.hungerState) {
          case 2 /* HUNGRY */:
            return "You are getting hungry.";
          case 3 /* WEAK */:
            return "You feel weak from hunger!";
          case 4 /* FAINTING */:
            return "You faint from lack of food!";
          case 5 /* STARVED */:
            return null;
        }
      }
      return null;
    }
    // ── XP / leveling ──────────────────────────────────────────────────────────
    gainXP(amount) {
      this.xp += amount;
      const threshold = xpThreshold(this.xl);
      if (this.xp >= threshold && this.xl < 30) {
        this.xl++;
        const [fix, rand] = this.hpDice;
        const gained = Math.max(1, fix + rollDice(1, rand, 0) + this.conMod());
        this.maxHp += gained;
        this.hp = Math.min(this.hp + gained, this.maxHp);
        return `Welcome to experience level ${this.xl}! (HP +${gained})`;
      }
      return null;
    }
    // ── Movement ───────────────────────────────────────────────────────────────
    getMoveTarget(forward, strafe) {
      const dx = Math.round(Math.cos(this.angle)) * forward + Math.round(-Math.sin(this.angle)) * strafe;
      const dy = Math.round(Math.sin(this.angle)) * forward + Math.round(Math.cos(this.angle)) * strafe;
      return [Math.round(this.x - 0.5) + dx, Math.round(this.y - 0.5) + dy];
    }
    // ── Inventory helpers ──────────────────────────────────────────────────────
    hasAmulet() {
      return this.inventory.some((i) => i.isAmuletOfYendor);
    }
    addItem(item) {
      if (item.type === 6 /* GOLD */) {
        this.gold += item.count;
        return;
      }
      this.inventory.push(item);
    }
    removeItem(item) {
      const idx = this.inventory.indexOf(item);
      if (idx >= 0) this.inventory.splice(idx, 1);
    }
  };
  function xpThreshold(xl) {
    if (xl <= 9) return 10 * (1 << xl);
    if (xl <= 19) return 1e4 * (1 << xl - 10);
    return 1e7 * (xl - 19);
  }
  function rollDice(num, sides, bonus) {
    let total = bonus;
    for (let i = 0; i < num; i++) total += 1 + Math.floor(Math.random() * sides);
    return total;
  }

  // src/combat.ts
  var nextMonsterId = 1;
  function spawnMonster(key, x, y) {
    const t = MONSTER_DATA[key];
    const hp = rollDice(t.hpDice[0], t.hpDice[1], t.hpDice[2]);
    return {
      id: nextMonsterId++,
      key,
      name: t.name,
      symbol: t.symbol,
      color: t.color,
      x,
      y,
      hp,
      maxHp: hp,
      ac: t.ac,
      damage: t.damage,
      speed: t.speed,
      xpValue: t.xpValue,
      difficulty: t.difficulty,
      flags: new Set(t.flags),
      awake: false,
      targetX: x,
      targetY: y,
      regenTimer: 0,
      paralyzed: 0
    };
  }
  function playerAttack(player, monster) {
    const roll = rollDice(1, 20, 0) + player.toHitBonus;
    const threshold = 20 - monster.ac;
    if (roll < threshold) {
      return { msg: `You miss the ${monster.name}.`, killed: false };
    }
    const [n, s, b] = player.weaponDamage;
    const dmg = Math.max(1, rollDice(n, s, b) + player.strBonus);
    monster.hp -= dmg;
    if (monster.hp <= 0) {
      const lvlMsg = player.gainXP(monster.xpValue);
      let msg = `You kill the ${monster.name}!`;
      if (lvlMsg) msg += " " + lvlMsg;
      return { msg, killed: true };
    }
    return { msg: `You hit the ${monster.name} for ${dmg} damage.`, killed: false };
  }
  function monsterAttack(monster, player) {
    const msgs = [];
    if (monster.damage[0] === 0) {
      if (monster.flags.has("passive_paralyze") && monster.awake) {
        player.paralyzed = Math.max(player.paralyzed, rollDice(1, 4, 2));
        return { msg: `The ${monster.name} paralyzes you!`, dead: false };
      }
      return { msg: "", dead: false };
    }
    if (monster.flags.has("fire_breath")) {
      if (player.hasRingEffect("fire_resist")) {
        msgs.push(`The ${monster.name} breathes fire, but you resist!`);
      } else {
        const fireDmg = rollDice(2, 6, 0);
        player.hp -= fireDmg;
        msgs.push(`The ${monster.name} breathes fire at you for ${fireDmg} damage!`);
        if (player.hp <= 0) return { msg: msgs.join(" "), dead: true };
      }
    }
    const roll = rollDice(1, 20, 0) + monster.difficulty;
    const threshold = 20 - player.effectiveAC;
    if (roll < threshold) {
      if (msgs.length) return { msg: msgs.join(" "), dead: false };
      return { msg: `The ${monster.name} misses.`, dead: false };
    }
    const [n, s, b] = monster.damage;
    const dmg = Math.max(1, rollDice(n, s, b));
    player.hp -= dmg;
    msgs.push(`The ${monster.name} hits you for ${dmg} damage.`);
    if (monster.flags.has("poison_attack")) {
      if (!player.hasRingEffect("poison_resist")) {
        player.poisoned = Math.max(player.poisoned, 10);
        msgs.push("You feel poisoned!");
      }
    }
    if (monster.flags.has("drain_level")) {
      if (player.xl > 1) {
        player.xl--;
        msgs.push(`You feel your life force draining away! (now level ${player.xl})`);
      } else {
        player.hp -= 5;
        msgs.push("Your life force drains away!");
      }
    }
    if (monster.flags.has("magic_spell")) {
      player.confused = Math.max(player.confused, 5);
      msgs.push("The spell confuses you!");
    }
    if (monster.flags.has("drain_hp")) {
      const stolen = Math.min(rollDice(1, 4, 0), dmg);
      monster.hp = Math.min(monster.hp + stolen, monster.maxHp);
    }
    const dead = player.hp <= 0;
    return { msg: msgs.join(" "), dead };
  }

  // src/monsters.ts
  function hasLOS(level, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;
    while (true) {
      if (cx === x1 && cy === y1) return true;
      const t = level.tile(cx, cy);
      if (t === 1 /* WALL */ || t === 4 /* DOOR_CLOSED */ || t === 0 /* VOID */) return false;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }
  var DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  function pathfindStep(level, mx, my, tx, ty) {
    let best = [mx, my];
    let bestDist = Infinity;
    for (const [dx, dy] of DIRS) {
      const nx = mx + dx, ny = my + dy;
      if (!level.isPassable(nx, ny) && !(nx === tx && ny === ty)) continue;
      const dist = Math.abs(nx - tx) + Math.abs(ny - ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = [nx, ny];
      }
    }
    return best;
  }
  function actMonster(monster, player, level, monsters) {
    const msgs = [];
    const px = Math.round(player.x - 0.5);
    const py = Math.round(player.y - 0.5);
    const dist = Math.abs(monster.x - px) + Math.abs(monster.y - py);
    if (monster.flags.has("regenerate")) {
      monster.regenTimer++;
      if (monster.regenTimer >= 3) {
        monster.regenTimer = 0;
        monster.hp = Math.min(monster.hp + 1, monster.maxHp);
      }
    }
    if (!monster.awake) {
      if (dist <= 5 && hasLOS(level, monster.x, monster.y, px, py)) {
        monster.awake = true;
        monster.targetX = px;
        monster.targetY = py;
      } else {
        return msgs;
      }
    }
    if (hasLOS(level, monster.x, monster.y, px, py)) {
      monster.targetX = px;
      monster.targetY = py;
    }
    if (Math.abs(monster.x - px) + Math.abs(monster.y - py) === 1) {
      const { msg, dead } = monsterAttack(monster, player);
      if (msg) msgs.push(msg);
      if (dead) msgs.push("__PLAYER_DEAD__");
      return msgs;
    }
    if (monster.flags.has("passive_paralyze")) return msgs;
    const occupied = new Set(monsters.map((m) => `${m.x},${m.y}`));
    const [nx, ny] = pathfindStep(level, monster.x, monster.y, monster.targetX, monster.targetY);
    if (nx !== monster.x || ny !== monster.y) {
      if (!occupied.has(`${nx},${ny}`) && !(nx === px && ny === py)) {
        monster.x = nx;
        monster.y = ny;
      }
    }
    return msgs;
  }
  function rndMonster(dlvl, playerLevel) {
    const minDiff = Math.floor(dlvl / 6);
    const maxDiff = Math.floor((dlvl + playerLevel) / 2);
    const pool = [];
    for (const [key, m] of Object.entries(MONSTER_DATA)) {
      if (m.difficulty < minDiff || m.difficulty > maxDiff) continue;
      if (m.freq === 0) continue;
      pool.push({ key, weight: m.freq });
    }
    if (pool.length === 0) {
      const mid = Math.floor((minDiff + maxDiff) / 2);
      for (const [key, m] of Object.entries(MONSTER_DATA)) {
        const dist = Math.abs(m.difficulty - mid);
        const weight = Math.max(1, 5 - dist);
        pool.push({ key, weight });
      }
    }
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = Math.floor(Math.random() * total);
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll < 0) return entry.key;
    }
    return pool[pool.length - 1].key;
  }
  function placeMonster(key, level, player) {
    const maxAttempts = 30;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const x = Math.floor(Math.random() * level.width);
      const y = Math.floor(Math.random() * level.height);
      if (!level.isPassable(x, y)) continue;
      if (player !== void 0) {
        const px = Math.round(player.x - 0.5);
        const py = Math.round(player.y - 0.5);
        if (Math.abs(x - px) + Math.abs(y - py) < 3) continue;
      }
      return spawnMonster(key, x, y);
    }
    return null;
  }
  function populateLevel(level, dlvl, playerLevel = 1) {
    const monsters = [];
    const count = 4 + Math.floor(dlvl / 2) + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const key = rndMonster(dlvl, playerLevel);
      const data = MONSTER_DATA[key];
      if (!data) continue;
      let groupSize = 1;
      if (data.group === "small") groupSize = 1 + Math.floor(Math.random() * 3);
      else if (data.group === "large") groupSize = 2 + Math.floor(Math.random() * 6);
      if (dlvl < 3) groupSize = Math.max(1, Math.floor(groupSize / 2));
      for (let g = 0; g < groupSize; g++) {
        const m = placeMonster(key, level);
        if (m) monsters.push(m);
      }
    }
    return monsters;
  }
  function trySpawnRandom(level, dlvl, player, playerLevel = 1) {
    const key = rndMonster(dlvl, playerLevel);
    const data = MONSTER_DATA[key];
    if (!data) return null;
    return placeMonster(key, level, player);
  }

  // src/items.ts
  var IdentificationSystem = class {
    constructor() {
      this.potionAppearance = {};
      this.potionColorHex = {};
      this.scrollAppearance = {};
      this.ringAppearance = {};
      this.wandAppearance = {};
      this.knownPotions = /* @__PURE__ */ new Set();
      this.knownScrolls = /* @__PURE__ */ new Set();
      this.knownRings = /* @__PURE__ */ new Set();
      this.knownWands = /* @__PURE__ */ new Set();
      const colors = shuffle([...POTION_COLORS]);
      const labels = shuffle([...SCROLL_LABELS]);
      const radj = shuffle([...RING_ADJECTIVES]);
      const wmats = shuffle([...WAND_MATERIALS]);
      let ci = 0, li = 0, ri = 0, wi = 0;
      for (const key of Object.keys(POTION_DATA)) {
        const colorName = colors[ci++] ?? "murky";
        this.potionAppearance[key] = colorName + " potion";
        this.potionColorHex[key] = POTION_COLOR_HEX[colorName] ?? COL_ITEM;
      }
      for (const key of Object.keys(SCROLL_DATA)) this.scrollAppearance[key] = `scroll labeled "${labels[li++] ?? "UNKNOWN"}"`;
      for (const key of Object.keys(RING_DATA)) this.ringAppearance[key] = (radj[ri++] ?? "plain") + " ring";
      for (const key of Object.keys(WAND_DATA)) this.wandAppearance[key] = (wmats[wi++] ?? "wooden") + " wand";
    }
    identify(type, key) {
      if (type === "potion") this.knownPotions.add(key);
      else if (type === "scroll") this.knownScrolls.add(key);
      else if (type === "ring") this.knownRings.add(key);
      else this.knownWands.add(key);
    }
    namePotion(key) {
      if (this.knownPotions.has(key)) return POTION_DATA[key].name;
      return this.potionAppearance[key] ?? key;
    }
    nameScroll(key) {
      if (this.knownScrolls.has(key)) return SCROLL_DATA[key].name;
      return this.scrollAppearance[key] ?? key;
    }
    nameRing(key) {
      if (this.knownRings.has(key)) return RING_DATA[key].name;
      return this.ringAppearance[key] ?? key;
    }
    nameWand(key) {
      if (this.knownWands.has(key)) return WAND_DATA[key].name;
      return this.wandAppearance[key] ?? key;
    }
  };
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function makeWeapon(key) {
    const d = WEAPON_DATA[key];
    return {
      id: makeItemId(),
      type: 1 /* WEAPON */,
      key,
      count: 1,
      name: d.name,
      identified: true,
      enchantment: 0,
      isAmuletOfYendor: false,
      damage: d.damage
    };
  }
  function makeArmor(key) {
    const d = ARMOR_DATA[key];
    return {
      id: makeItemId(),
      type: 2 /* ARMOR */,
      key,
      count: 1,
      name: d.name,
      identified: true,
      enchantment: 0,
      isAmuletOfYendor: false
    };
  }
  function makeFood(key) {
    const d = FOOD_DATA[key];
    return {
      id: makeItemId(),
      type: 3 /* FOOD */,
      key,
      count: 1,
      name: d.name,
      identified: true,
      enchantment: 0,
      isAmuletOfYendor: false,
      nutrition: d.nutrition
    };
  }
  function makePotion(key, idSys) {
    const d = POTION_DATA[key];
    return {
      id: makeItemId(),
      type: 4 /* POTION */,
      key,
      count: 1,
      name: idSys.namePotion(key),
      identified: idSys.knownPotions.has(key),
      enchantment: 0,
      isAmuletOfYendor: false,
      effect: d.effect,
      healAmount: d.healAmount,
      damage: d.damage,
      duration: d.duration,
      appearanceColor: idSys.potionColorHex[key]
    };
  }
  function makeScroll(key, idSys) {
    const d = SCROLL_DATA[key];
    return {
      id: makeItemId(),
      type: 5 /* SCROLL */,
      key,
      count: 1,
      name: idSys.nameScroll(key),
      identified: idSys.knownScrolls.has(key),
      enchantment: 0,
      isAmuletOfYendor: false,
      effect: d.effect
    };
  }
  function makeRing(key, idSys) {
    const d = RING_DATA[key];
    return {
      id: makeItemId(),
      type: 7 /* RING */,
      key,
      count: 1,
      name: idSys.nameRing(key),
      identified: idSys.knownRings.has(key),
      enchantment: 0,
      isAmuletOfYendor: false,
      effect: d.effect
    };
  }
  function makeWand(key, idSys) {
    const d = WAND_DATA[key];
    const charges = d.charges[0] + Math.floor(Math.random() * (d.charges[1] - d.charges[0] + 1));
    return {
      id: makeItemId(),
      type: 8 /* WAND */,
      key,
      count: 1,
      name: idSys.nameWand(key),
      identified: idSys.knownWands.has(key),
      enchantment: 0,
      isAmuletOfYendor: false,
      effect: d.effect,
      charges
    };
  }
  function makeGold(count) {
    return {
      id: makeItemId(),
      type: 6 /* GOLD */,
      key: "gold",
      count,
      name: `${count} gold pieces`,
      identified: true,
      enchantment: 0,
      isAmuletOfYendor: false
    };
  }
  function makeAmulet() {
    return {
      id: makeItemId(),
      type: 5 /* SCROLL */,
      key: "amulet",
      count: 1,
      name: "Amulet of Yendor",
      identified: true,
      enchantment: 0,
      isAmuletOfYendor: true
    };
  }
  function placeItemsOnLevel(level, dlvl, idSys) {
    const items = [];
    if (dlvl === WIN_LEVEL && level.rooms.length > 0) {
      const last = level.rooms[level.rooms.length - 1];
      items.push({ x: last.x + Math.floor(last.w / 2), y: last.y + Math.floor(last.h / 2), item: makeAmulet() });
    }
    const weaponKeys = Object.keys(WEAPON_DATA);
    const armorKeys = Object.keys(ARMOR_DATA);
    const foodKeys = Object.keys(FOOD_DATA);
    const potionKeys = Object.keys(POTION_DATA);
    const scrollKeys = Object.keys(SCROLL_DATA);
    const ringKeys = Object.keys(RING_DATA);
    const wandKeys = Object.keys(WAND_DATA);
    const count = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      if (level.rooms.length === 0) break;
      const room = level.rooms[Math.floor(Math.random() * level.rooms.length)];
      const x = room.x + Math.floor(Math.random() * room.w);
      const y = room.y + Math.floor(Math.random() * room.h);
      const roll = Math.random();
      let item;
      if (roll < 0.13) item = makeWeapon(pick(weaponKeys));
      else if (roll < 0.23) item = makeArmor(pick(armorKeys));
      else if (roll < 0.4) item = makeFood(pick(foodKeys));
      else if (roll < 0.58) item = makePotion(pick(potionKeys), idSys);
      else if (roll < 0.72) item = makeScroll(pick(scrollKeys), idSys);
      else if (roll < 0.82) item = makeRing(pick(ringKeys), idSys);
      else if (roll < 0.9) item = makeWand(pick(wandKeys), idSys);
      else item = makeGold(rollDice(2, 6, dlvl * 5));
      items.push({ x, y, item });
    }
    return items;
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // src/game.ts
  var GameState = class {
    constructor() {
      this.player = new Player();
      this.dungeon = new Dungeon(WIN_LEVEL);
      this.idSys = new IdentificationSystem();
      this.dlvl = 1;
      this.phase = "title";
      this.messages = [];
      this.turns = 0;
      this.lastMsgTurn = 0;
      this.levelStates = /* @__PURE__ */ new Map();
    }
    // ── Init ───────────────────────────────────────────────────────────────────
    init() {
      this.phase = "chargen";
    }
    initWithChar(opts) {
      this.player = new Player();
      this.dungeon = new Dungeon(WIN_LEVEL);
      this.idSys = new IdentificationSystem();
      this.dlvl = 1;
      this.turns = 0;
      this.levelStates.clear();
      const role = ROLE_DATA[opts.role];
      const race = RACE_DATA[opts.race];
      const [rStr, rInt, rWis, rDex, rCon, rCha] = role.baseStats;
      const [mStr, mInt, mWis, mDex, mCon, mCha] = race.statMods;
      this.player.str = Math.max(3, rStr + mStr);
      this.player.int_ = Math.max(3, rInt + mInt);
      this.player.wis = Math.max(3, rWis + mWis);
      this.player.dex = Math.max(3, rDex + mDex);
      this.player.con = Math.max(3, rCon + mCon);
      this.player.cha = Math.max(3, rCha + mCha);
      this.player.hp = role.hpStart;
      this.player.maxHp = role.hpStart;
      this.player.hpDice = role.hpDice;
      this.player.role = opts.role;
      this.player.race = opts.race;
      this.player.alignment = opts.alignment;
      this.player.charName = opts.charName;
      this.player.gender = opts.gender;
      this.player.addItem(makeWeapon(role.startWeapon));
      this.player.equip.weapon = this.player.inventory[0];
      if (role.startArmor) {
        this.player.addItem(makeArmor(role.startArmor));
        this.player.equip.armor = this.player.inventory.find((i) => i.key === role.startArmor) ?? null;
      }
      this.player.addItem(makeFood("ration"));
      if (opts.role === "healer") {
        this.player.addItem(makePotion("healing", this.idSys));
        this.player.addItem(makePotion("healing", this.idSys));
      }
      if (opts.role === "wizard") {
        this.player.addItem(makeScroll("identify", this.idSys));
      }
      const roleName = role.name;
      const raceName = race.name;
      this.messages = [`${opts.charName} the ${raceName} ${roleName} \u2014 good luck!`];
      this.enterLevel(1);
      this.phase = "playing";
    }
    // ── Level management ───────────────────────────────────────────────────────
    get currentLevel() {
      return this.dungeon.getLevel(this.dlvl);
    }
    get currentMonsters() {
      return this.levelState().monsters;
    }
    get currentItems() {
      return this.levelState().items;
    }
    levelState() {
      if (!this.levelStates.has(this.dlvl)) {
        this.levelStates.set(this.dlvl, { monsters: [], items: [], populated: false });
      }
      return this.levelStates.get(this.dlvl);
    }
    enterLevel(dlvl, fromBelow = false) {
      this.dlvl = dlvl;
      const level = this.currentLevel;
      const state = this.levelState();
      if (!state.populated) {
        state.monsters = populateLevel(level, dlvl, this.player.xl);
        state.items = placeItemsOnLevel(level, dlvl, this.idSys);
        state.populated = true;
      }
      const pos = fromBelow ? level.stairsDown : dlvl > 1 ? level.stairsUp : null;
      if (pos) {
        this.player.x = pos[0] + 0.5;
        this.player.y = pos[1] + 0.5;
      } else if (level.rooms.length > 0) {
        const r = level.rooms[0];
        this.player.x = r.x + Math.floor(r.w / 2) + 0.5;
        this.player.y = r.y + Math.floor(r.h / 2) + 0.5;
      } else {
        outer: for (let y = 0; y < level.height; y++) {
          for (let x = 0; x < level.width; x++) {
            if (level.isPassable(x, y)) {
              this.player.x = x + 0.5;
              this.player.y = y + 0.5;
              break outer;
            }
          }
        }
      }
    }
    // ── Turn processing ────────────────────────────────────────────────────────
    processTurn() {
      this.turns++;
      this.player.turns++;
      if (this.player.paralyzed > 0) {
        this.player.paralyzed--;
        return;
      }
      this.player.regenTick();
      if (this.player.hasted > 0) this.player.hasted--;
      const statusMsgs = this.player.tickStatus();
      for (const m of statusMsgs) this.addMsg(m);
      const hungerMsg = this.player.updateHunger();
      if (hungerMsg) this.addMsg(hungerMsg);
      if (this.player.hungerState === 5 /* STARVED */) {
        this.player.hp = 0;
        this.phase = "dead";
        this.addMsg("You starve to death!");
        return;
      }
      const level = this.currentLevel;
      const state = this.levelState();
      for (const m of state.monsters) {
        const msgs = actMonster(m, this.player, level, state.monsters);
        for (const msg of msgs) {
          if (msg === "__PLAYER_DEAD__") {
            this.phase = "dead";
            return;
          }
          this.addMsg(msg);
        }
      }
      state.monsters = state.monsters.filter((m) => m.hp > 0);
      if (this.player.hp <= 0) {
        this.phase = "dead";
        return;
      }
      if (Math.random() < 5e-3) {
        const m = trySpawnRandom(level, this.dlvl, this.player, this.player.xl);
        if (m) state.monsters.push(m);
      }
    }
    // ── Player actions ─────────────────────────────────────────────────────────
    tryMove(forward, strafe) {
      if (this.player.paralyzed > 0) {
        this.processTurn();
        return;
      }
      const [tx, ty] = this.player.getMoveTarget(forward, strafe);
      const level = this.currentLevel;
      const m = this.currentMonsters.find((m2) => m2.x === tx && m2.y === ty);
      if (m) {
        const { msg, killed } = playerAttack(this.player, m);
        this.addMsg(msg);
        if (killed) {
          this.dropCorpse(m);
          this.levelState().monsters = this.currentMonsters.filter((x) => x !== m);
        }
        this.processTurn();
        return;
      }
      if (level.tile(tx, ty) === 4 /* DOOR_CLOSED */) {
        level.grid[ty][tx].tile = 5 /* DOOR_OPEN */;
        this.addMsg("You open the door.");
        this.processTurn();
        return;
      }
      if (level.isPassable(tx, ty)) {
        this.player.x = tx + 0.5;
        this.player.y = ty + 0.5;
        this.player.bobPhase += Math.PI * 0.5;
        this.player.bobAmplitude = 1;
        this.processTurn();
        this.noteUnderfoot();
      }
    }
    tryDescend() {
      const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
      const sd = this.currentLevel.stairsDown;
      if (!sd || sd[0] !== px || sd[1] !== py) {
        this.addMsg("There are no stairs going down here.");
        return;
      }
      if (this.dlvl >= WIN_LEVEL) {
        this.addMsg("These stairs lead no further down.");
        return;
      }
      this.enterLevel(this.dlvl + 1);
      this.addMsg(`You descend to dungeon level ${this.dlvl}.`);
      this.processTurn();
    }
    tryAscend() {
      const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
      const su = this.currentLevel.stairsUp;
      if (!su || su[0] !== px || su[1] !== py) {
        this.addMsg("There are no stairs going up here.");
        return;
      }
      if (this.dlvl === 1) {
        if (this.player.hasAmulet()) {
          this.phase = "won";
          this.addMsg("You ascend to the surface carrying the Amulet of Yendor! You win!");
        } else {
          this.addMsg("You cannot leave without the Amulet of Yendor!");
        }
        return;
      }
      this.enterLevel(this.dlvl - 1, true);
      this.addMsg(`You ascend to dungeon level ${this.dlvl}.`);
      this.processTurn();
    }
    tryPickup() {
      const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
      const state = this.levelState();
      const idx = state.items.findIndex((fi2) => fi2.x === px && fi2.y === py);
      if (idx < 0) {
        this.addMsg("There is nothing here to pick up.");
        return;
      }
      const fi = state.items.splice(idx, 1)[0];
      this.player.addItem(fi.item);
      this.addMsg(`You pick up ${fi.item.name}.`);
      this.processTurn();
    }
    useItem(item) {
      const msgs = [];
      if (item.type === 3 /* FOOD */) {
        this.player.nutrition = Math.min(1200, this.player.nutrition + (item.nutrition ?? 200));
        msgs.push(`You eat the ${item.name}. Delicious!`);
        this.player.removeItem(item);
      } else if (item.type === 4 /* POTION */) {
        this.idSys.identify("potion", item.key);
        item.identified = true;
        item.name = POTION_DATA[item.key]?.name ?? item.name;
        switch (item.effect) {
          case "heal": {
            const [n, s, b] = item.healAmount ?? [2, 8, 2];
            const amt = rollDice(n, s, b);
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + amt);
            msgs.push(`You drink the ${item.name}. You feel better!`);
            break;
          }
          case "full_heal":
            this.player.hp = this.player.maxHp;
            msgs.push(`You drink the ${item.name}. You feel completely healed!`);
            break;
          case "poison":
            this.player.hp -= rollDice(...item.damage ?? [1, 6, 0]);
            msgs.push(`You drink the ${item.name}. You feel sick!`);
            break;
          case "sickness":
            this.player.sick = item.duration ?? 20;
            msgs.push(`You drink the ${item.name}. You feel deathly ill!`);
            break;
          case "acid": {
            const acidDmg = rollDice(...item.damage ?? [1, 6, 0]);
            this.player.hp -= acidDmg;
            msgs.push(`You drink the ${item.name}. It burns! (${acidDmg} damage)`);
            break;
          }
          case "speed":
            this.player.hasted = item.duration ?? 20;
            msgs.push(`You drink the ${item.name}. You feel swift!`);
            break;
          case "levitation":
            this.player.levitating = item.duration ?? 20;
            msgs.push(`You drink the ${item.name}. You start to float!`);
            break;
          case "confusion":
            this.player.confused = item.duration ?? 10;
            msgs.push(`You drink the ${item.name}. Huh? What?`);
            break;
          case "booze":
            this.player.confused = item.duration ?? 5;
            msgs.push(`You drink the ${item.name}. Burp!`);
            break;
          case "blindness":
            this.player.blinded = item.duration ?? 15;
            msgs.push(`You drink the ${item.name}. You can't see!`);
            break;
          case "paralysis":
            this.player.paralyzed = item.duration ?? 5;
            msgs.push(`You drink the ${item.name}. You are paralyzed!`);
            break;
          case "invisibility":
            msgs.push(`You drink the ${item.name}. You feel transparent!`);
            break;
          case "gain_str":
            this.player.str++;
            msgs.push(`You drink the ${item.name}. You feel stronger!`);
            break;
          case "see_invisible":
            msgs.push(`You drink the ${item.name}. You can see invisible things!`);
            break;
          case "water":
            msgs.push(`You drink the ${item.name}. Splash!`);
            break;
          case "restore_ability":
            msgs.push(`You drink the ${item.name}. You feel your abilities return!`);
            break;
          case "gain_level": {
            const lvlMsg = this.player.gainXP(999999);
            msgs.push(`You drink the ${item.name}. You feel more powerful!`);
            if (lvlMsg) msgs.push(lvlMsg);
            break;
          }
          default:
            msgs.push(`You drink the ${item.name}.`);
        }
        this.player.removeItem(item);
      } else if (item.type === 5 /* SCROLL */) {
        this.idSys.identify("scroll", item.key);
        item.identified = true;
        switch (item.effect) {
          case "identify": {
            const unid = this.player.inventory.find((i) => !i.identified);
            if (unid) {
              unid.identified = true;
              msgs.push(`You identify the ${unid.name}.`);
            } else msgs.push("Nothing to identify.");
            break;
          }
          case "teleport": {
            const level = this.currentLevel;
            for (let i = 0; i < 50; i++) {
              const x = Math.floor(Math.random() * level.width);
              const y = Math.floor(Math.random() * level.height);
              if (level.isPassable(x, y)) {
                this.player.x = x + 0.5;
                this.player.y = y + 0.5;
                break;
              }
            }
            msgs.push("You feel a wrenching sensation!");
            break;
          }
          case "enchant_weapon":
            if (this.player.equip.weapon) {
              this.player.equip.weapon.enchantment++;
              msgs.push(`Your ${this.player.equip.weapon.name} glows!`);
            } else msgs.push("You have no weapon to enchant.");
            break;
          case "enchant_armor":
            if (this.player.equip.armor) {
              this.player.equip.armor.enchantment++;
              msgs.push(`Your ${this.player.equip.armor.name} glows!`);
            } else msgs.push("You have no armor to enchant.");
            break;
          case "magic_mapping": {
            const level = this.currentLevel;
            for (let y = 0; y < level.height; y++)
              for (let x = 0; x < level.width; x++)
                level.grid[y][x].explored = true;
            msgs.push("A map forms in your mind!");
            break;
          }
          case "remove_curse":
            for (const i of this.player.inventory) {
              if (i.enchantment < 0) i.enchantment = 0;
            }
            msgs.push("You feel the curses lift!");
            break;
          case "scare_monster": {
            const px = Math.round(this.player.x - 0.5);
            const py = Math.round(this.player.y - 0.5);
            const level = this.currentLevel;
            let scared = 0;
            for (const m of this.currentMonsters) {
              if (Math.abs(m.x - px) + Math.abs(m.y - py) <= 8) {
                const dx = m.x - px, dy = m.y - py;
                const nx = m.x + Math.sign(dx || 1);
                const ny = m.y + Math.sign(dy || 1);
                if (level.isPassable(nx, ny)) {
                  m.x = nx;
                  m.y = ny;
                }
                scared++;
              }
            }
            msgs.push(scared > 0 ? `The monsters flee in terror!` : "The monsters seem unimpressed.");
            break;
          }
          case "fire": {
            const fireDmg = rollDice(1, 6, 0);
            let killed = 0;
            for (const m of this.currentMonsters) {
              m.hp -= fireDmg;
              if (m.hp <= 0) killed++;
            }
            this.levelState().monsters = this.currentMonsters.filter((m) => m.hp > 0);
            msgs.push(`Flames burst from the scroll! (${fireDmg} fire damage)${killed > 0 ? ` ${killed} monster(s) die!` : ""}`);
            break;
          }
          case "create_monster": {
            const m = trySpawnRandom(this.currentLevel, this.dlvl, this.player);
            if (m) {
              this.levelState().monsters.push(m);
              msgs.push(`A ${m.name} appears!`);
            } else {
              msgs.push("Nothing happens.");
            }
            break;
          }
          case "genocide":
            msgs.push("You hear distant screams...");
            break;
          case "taming":
            msgs.push("The monsters look friendlier.");
            break;
          case "earth":
            msgs.push("Boulders fall from the ceiling!");
            break;
          default:
            msgs.push("You read the scroll.");
        }
        this.player.removeItem(item);
      } else if (item.type === 1 /* WEAPON */) {
        if (this.player.equip.weapon === item) {
          this.player.equip.weapon = null;
          msgs.push(`You unwield the ${item.name}.`);
        } else {
          this.player.equip.weapon = item;
          msgs.push(`You wield the ${item.name}.`);
        }
      } else if (item.type === 2 /* ARMOR */) {
        this.equipArmor(item, msgs);
      } else if (item.type === 7 /* RING */) {
        this.idSys.identify("ring", item.key);
        item.identified = true;
        if (this.player.equip.ring_left === item || this.player.equip.ring_right === item) {
          if (this.player.equip.ring_left === item) this.player.equip.ring_left = null;
          if (this.player.equip.ring_right === item) this.player.equip.ring_right = null;
          msgs.push(`You remove the ${item.name}.`);
        } else if (!this.player.equip.ring_left) {
          this.player.equip.ring_left = item;
          msgs.push(`You put on the ${item.name} (left hand).`);
        } else if (!this.player.equip.ring_right) {
          this.player.equip.ring_right = item;
          msgs.push(`You put on the ${item.name} (right hand).`);
        } else {
          msgs.push("Your hands are full of rings!");
        }
      } else if (item.type === 8 /* WAND */) {
        this.zapWand(item, msgs);
      }
      for (const m of msgs) this.addMsg(m);
      if (msgs.length) this.processTurn();
    }
    equipArmor(item, msgs) {
      const armorData = ARMOR_DATA[item.key];
      const slot = armorData?.slot ?? "suit";
      const slotMap = {
        suit: "armor",
        helm: "helm",
        gloves: "gloves",
        boots: "boots",
        shield: "shield",
        cloak: "cloak"
      };
      const equipKey = slotMap[slot] ?? "armor";
      const equipObj = this.player.equip;
      const current = equipObj[equipKey];
      if (current === item) {
        equipObj[equipKey] = null;
        msgs.push(`You remove the ${item.name}.`);
      } else {
        equipObj[equipKey] = item;
        msgs.push(`You put on the ${item.name}.`);
      }
    }
    zapWand(item, msgs) {
      if ((item.charges ?? 0) <= 0) {
        msgs.push("The wand is empty.");
        return;
      }
      item.charges = (item.charges ?? 0) - 1;
      this.idSys.identify("wand", item.key);
      item.identified = true;
      const wandData = WAND_DATA[item.key];
      if (!wandData) {
        msgs.push("Fzzt!");
        return;
      }
      const effect = wandData.effect;
      const px = Math.round(this.player.x - 0.5);
      const py = Math.round(this.player.y - 0.5);
      const fdx = Math.round(Math.cos(this.player.angle));
      const fdy = Math.round(Math.sin(this.player.angle));
      let target = null;
      for (let step = 1; step <= 8; step++) {
        const tx = px + fdx * step;
        const ty = py + fdy * step;
        const found = this.currentMonsters.find((m) => m.x === tx && m.y === ty);
        if (found) {
          target = found;
          break;
        }
        if (!this.currentLevel.isPassable(tx, ty)) break;
      }
      switch (effect) {
        case "magic_missile":
        case "striking": {
          if (target) {
            const dmg = rollDice(2, 6, 0);
            target.hp -= dmg;
            msgs.push(`The ${wandData.name} zaps the ${target.name} for ${dmg} damage!`);
            if (target.hp <= 0) {
              msgs.push(`The ${target.name} dies!`);
              this.player.gainXP(target.xpValue);
              this.dropCorpse(target);
              this.levelState().monsters = this.currentMonsters.filter((m) => m !== target);
            }
          } else msgs.push("The bolt fizzles out.");
          break;
        }
        case "fire_bolt":
        case "cold_bolt":
        case "lightning": {
          if (target) {
            const dmg = rollDice(3, 6, 0);
            target.hp -= dmg;
            const verb = effect === "fire_bolt" ? "fire" : effect === "cold_bolt" ? "cold" : "lightning";
            msgs.push(`A bolt of ${verb} hits the ${target.name} for ${dmg} damage!`);
            if (target.hp <= 0) {
              msgs.push(`The ${target.name} dies!`);
              this.player.gainXP(target.xpValue);
              this.dropCorpse(target);
              this.levelState().monsters = this.currentMonsters.filter((m) => m !== target);
            }
          } else msgs.push("The bolt hits the wall.");
          break;
        }
        case "sleep_bolt":
          if (target) {
            target.paralyzed = 5;
            msgs.push(`The ${target.name} falls asleep!`);
          } else msgs.push("The bolt fizzles out.");
          break;
        case "teleport_away":
          if (target) {
            for (let i = 0; i < 30; i++) {
              const x = Math.floor(Math.random() * this.currentLevel.width);
              const y = Math.floor(Math.random() * this.currentLevel.height);
              if (this.currentLevel.isPassable(x, y)) {
                target.x = x;
                target.y = y;
                break;
              }
            }
            msgs.push(`The ${target.name} vanishes!`);
          } else msgs.push("The bolt fizzles out.");
          break;
        case "slow":
          if (target) {
            target.speed = Math.max(1, Math.floor(target.speed / 2));
            msgs.push(`The ${target.name} slows down!`);
          } else msgs.push("The bolt fizzles out.");
          break;
        case "light": {
          const level = this.currentLevel;
          const radius = 10;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              if (dx * dx + dy * dy <= radius * radius) {
                const cell = level.get(px + dx, py + dy);
                if (cell) cell.explored = true;
              }
            }
          }
          msgs.push("The room is illuminated!");
          break;
        }
        case "dig":
          msgs.push("You dig a hole, but nothing changes.");
          break;
        case "wish":
          msgs.push("A wish! Unfortunately, the game cannot grant wishes yet.");
          break;
        case "death":
          if (target) {
            target.hp = 0;
            msgs.push(`The ${target.name} is instantly destroyed!`);
            this.player.gainXP(target.xpValue);
            this.dropCorpse(target);
            this.levelState().monsters = this.currentMonsters.filter((m) => m !== target);
          } else msgs.push("The death ray misses.");
          break;
        case "polymorph":
          if (target) {
            msgs.push(`The ${target.name} changes shape!`);
          } else msgs.push("The bolt fizzles out.");
          break;
        case "cancellation":
          if (target) {
            target.flags = /* @__PURE__ */ new Set();
            msgs.push(`The ${target.name} is cancelled!`);
          } else msgs.push("The bolt fizzles out.");
          break;
        case "haste_monster":
          if (target) {
            target.speed = target.speed * 2;
            msgs.push(`The ${target.name} speeds up!`);
          } else msgs.push("The bolt fizzles out.");
          break;
        default:
          msgs.push(`The ${wandData.name} crackles with energy.`);
      }
      if ((item.charges ?? 0) === 0) msgs.push("The wand is now empty.");
    }
    dropItem(item) {
      const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
      if (this.player.equip.weapon === item) this.player.equip.weapon = null;
      if (this.player.equip.armor === item) this.player.equip.armor = null;
      if (this.player.equip.ring_left === item) this.player.equip.ring_left = null;
      if (this.player.equip.ring_right === item) this.player.equip.ring_right = null;
      if (this.player.equip.helm === item) this.player.equip.helm = null;
      if (this.player.equip.shield === item) this.player.equip.shield = null;
      if (this.player.equip.boots === item) this.player.equip.boots = null;
      if (this.player.equip.gloves === item) this.player.equip.gloves = null;
      if (this.player.equip.cloak === item) this.player.equip.cloak = null;
      this.player.removeItem(item);
      this.levelState().items.push({ x: px, y: py, item });
      this.addMsg(`You drop the ${item.name}.`);
      this.processTurn();
    }
    // ── Helpers ────────────────────────────────────────────────────────────────
    dropCorpse(m) {
      const t = MONSTER_DATA[m.key];
      if (!t) return;
      const corpse = {
        id: Math.random(),
        type: 3 /* FOOD */,
        key: "corpse",
        count: 1,
        name: `${m.name} corpse`,
        identified: true,
        enchantment: 0,
        isAmuletOfYendor: false,
        nutrition: 150
      };
      this.levelState().items.push({ x: m.x, y: m.y, item: corpse });
    }
    noteUnderfoot() {
      const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
      const here = this.currentItems.filter((fi) => fi.x === px && fi.y === py);
      const tile = this.currentLevel.tile(px, py);
      if (here.length === 1) {
        this.addMsg(`You see here: ${here[0].item.name}.`);
      } else if (here.length > 1) {
        this.addMsg(`You see here: ${here[0].item.name} and ${here.length - 1} other item${here.length > 2 ? "s" : ""}.`);
      }
      if (tile === 7 /* STAIRS_DOWN */) this.addMsg("Stairway going down (>) is here.");
      else if (tile === 6 /* STAIRS_UP */) this.addMsg("Stairway going up (<) is here.");
    }
    addMsg(msg) {
      this.messages.push(msg);
      if (this.messages.length > 100) this.messages.shift();
      this.lastMsgTurn = this.turns;
    }
  };

  // src/raycaster.ts
  var LUMA_RAMP = "$@B%8&WM#gGQZO0SCJjTt7f!/|()?-_+~;:,'. ";
  var RAMP_LAST = LUMA_RAMP.length - 1;
  function charFromLuma(luma) {
    return LUMA_RAMP[Math.round((1 - clamp01(luma)) * RAMP_LAST)];
  }
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  function fade(dist) {
    return clamp01(1 - dist / MAX_RAY_DEPTH);
  }
  function darken(hex, factor) {
    const f = clamp01(factor);
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function bayerDither(col, row) {
    return (col + row) % 2 === 0 ? 0.035 : -0.035;
  }
  var BRICK_ROWS = 3;
  var BRICK_COLS = 2;
  function tileHash(a, b) {
    let n = (Math.imul(a ^ a >>> 16, 73244475) ^ Math.imul(b ^ b >>> 16, 295559667)) >>> 0;
    n = (n ^ n >>> 15) >>> 0;
    return n / 4294967296;
  }
  function brickPixelLuma(row, top, lineH, wallX, base, mapX, mapY) {
    if (lineH < 4) return base;
    const tY = (row - top) / lineH;
    const bRowF = tY * BRICK_ROWS;
    const bRowI = Math.floor(bRowF);
    const posInRow = bRowF - bRowI;
    const stagger = bRowI & 1 ? 0.5 / BRICK_COLS : 0;
    const bColF = (wallX + stagger) * BRICK_COLS % 1;
    if (posInRow < 0.18 || bColF < 0.07) return base * 0.28;
    const bColI = Math.floor((wallX + stagger) * BRICK_COLS);
    return clamp01(base + (tileHash(bRowI * 97 + mapX, bColI * 31 + mapY) - 0.5) * 0.14);
  }
  function mkSprite(rows, pal) {
    return rows.map(
      (row) => Array.from(row).map((c) => c === " " ? null : pal[c] ? G(pal[c][0], pal[c][1]) : null)
    );
  }
  var G = (ch, color) => ({ ch, color });
  var _ = null;
  var ITEM_GLYPHS = {
    // ─ Sword: vertical blade, wide crossguard, wrapped grip, pommel ──────────
    weapon: mkSprite([
      "     |      ",
      "     |      ",
      "     |      ",
      "     |      ",
      "   --+--    ",
      "     !      ",
      "    [!]     ",
      "     *      "
    ], {
      "|": ["|", "#ddeeff"],
      "-": ["-", "#cc9900"],
      "+": ["+", "#ffdd22"],
      "!": ["|", "#886644"],
      "[": ["[", "#aa7733"],
      "]": ["]", "#aa7733"],
      "*": ["*", "#ddaa22"]
    }),
    // ─ Chestplate: shoulderguards, gem, strapped torso ───────────────────────
    armor: mkSprite([
      "   /------\\  ",
      "  |  [  ]  | ",
      "  |  [  ]  | ",
      "  |  ----  | ",
      "  |  |  |  | ",
      "  |  |  |  | ",
      "   \\_____/  "
    ], {
      "/": ["/", "#8899bb"],
      "\\": ["\\", "#8899bb"],
      "|": ["|", "#8899bb"],
      "_": ["_", "#7788aa"],
      "-": ["-", "#99aacc"],
      "[": ["[", "#aabbdd"],
      "]": ["]", "#ee4455"]
    }),
    // ─ Apple: stem, round red body, base ─────────────────────────────────────
    food: mkSprite([
      "    ,|,    ",
      "   /   \\  ",
      "  ( ooo )  ",
      "  (     )  ",
      "  (  .  )  ",
      "   \\___/  "
    ], {
      ",": [",", "#44aa22"],
      "|": ["|", "#338811"],
      "/": ["/", "#cc4411"],
      "\\": ["\\", "#cc4411"],
      "(": ["(", "#dd5522"],
      ")": [")", "#dd5522"],
      "o": ["o", "#ee8833"],
      ".": [".", "#992200"],
      "_": ["_", "#aa3300"]
    }),
    // potion — generated dynamically by potionGlyph()
    potion: [],
    // ─ Scroll: rolled parchment with text ────────────────────────────────────
    scroll: mkSprite([
      "  /========\\  ",
      " /  ~~~~~~~~ \\ ",
      "|   --------  |",
      "|   ~~~~~~~~  |",
      "|   --------  |",
      "|   ~~~~~~~~  |",
      " \\  --------  /",
      "  \\========/  "
    ], {
      "/": ["/", "#ccbb77"],
      "\\": ["\\", "#ccbb77"],
      "|": ["|", "#bbaa66"],
      "=": ["=", "#ddcc88"],
      "-": ["-", "#998844"],
      "~": ["~", "#ffffcc"]
    }),
    // ─ Gold coins ────────────────────────────────────────────────────────────
    gold: mkSprite([
      "   $ $ $   ",
      "  $$$$$$$  ",
      " ($$$$$$$) ",
      " ($$$$$$$) ",
      "  -------  "
    ], {
      "$": ["$", "#ffee22"],
      "(": ["(", "#aa8800"],
      ")": [")", "#aa8800"],
      "-": ["-", "#887700"]
    }),
    // ─ Ring with gem ─────────────────────────────────────────────────────────
    ring: mkSprite([
      "   ,OOO,   ",
      "  (     )  ",
      " ( ( * ) ) ",
      "  (     )  ",
      "   -----   "
    ], {
      ",": [",", "#ffaaff"],
      "O": ["O", "#ff88ff"],
      "(": ["(", "#ee77ee"],
      ")": [")", "#ee77ee"],
      "*": ["*", "#ffffff"],
      "-": ["-", "#cc55cc"]
    }),
    // ─ Magic wand ────────────────────────────────────────────────────────────
    wand: mkSprite([
      "    *     ",
      "    |     ",
      "    |     ",
      "    |     ",
      "    |     ",
      "    |     ",
      "   [|]    ",
      "   (=)    "
    ], {
      "*": ["*", "#aaffff"],
      "|": ["|", "#55aacc"],
      "[": ["[", "#4488aa"],
      "]": ["]", "#4488aa"],
      "(": ["(", "#336688"],
      ")": [")", "#336688"],
      "=": ["=", "#2255aa"]
    }),
    // ─ Amulet of Yendor ──────────────────────────────────────────────────────
    amulet: mkSprite([
      "  -O-Y-O-  ",
      "     |     ",
      "    (Y)    ",
      "   ( * )   ",
      "     |     ",
      "     V     "
    ], {
      "-": ["-", "#ffcc77"],
      "O": ["O", "#ffbb44"],
      "Y": ["Y", "#ffff44"],
      "|": ["|", "#ffcc66"],
      "(": ["(", "#ffdd88"],
      ")": [")", "#ffdd88"],
      "*": ["*", "#ffffff"],
      "V": ["V", "#ccaa55"]
    }),
    // ─ Stairs down: arrows + receding steps ──────────────────────────────────
    stairs_down: mkSprite([
      "vvvvvvvvvvvvvv",
      "aaaaaaaaaaaaaa",
      "  bbbbbbbbbb  ",
      "    cccccc    ",
      "      dd      "
    ], {
      "v": ["v", "#55ffcc"],
      "a": ["=", "#99aabb"],
      "b": ["=", "#778899"],
      "c": ["=", "#556677"],
      "d": ["=", "#445566"]
    }),
    // ─ Stairs up ─────────────────────────────────────────────────────────────
    stairs_up: mkSprite([
      "      dd      ",
      "    cccccc    ",
      "  bbbbbbbbbb  ",
      "aaaaaaaaaaaaaa",
      "^^^^^^^^^^^^^^"
    ], {
      "d": ["=", "#445566"],
      "c": ["=", "#556677"],
      "b": ["=", "#778899"],
      "a": ["=", "#99aabb"],
      "^": ["^", "#55ffcc"]
    })
  };
  function potionGlyph(liquidColor) {
    const lc = liquidColor, dc = darken(liquidColor, 0.55);
    const g = "#aaccdd", gd = "#667788";
    return [
      [_, _, G("_", gd), G("_", gd), G("_", gd), _, _],
      [_, G("[", g), G("-", g), G("-", g), G("]", g), _, _],
      [_, G("/", g), G("~", lc), G("~", lc), G("\\", g), _, _],
      [_, G("|", gd), G(".", lc), G(".", dc), G("|", gd), _, _],
      [_, G("|", gd), G("!", lc), G("!", dc), G("|", gd), _, _],
      [_, G("|", gd), G(".", dc), G(".", lc), G("|", gd), _, _],
      [_, G("\\", g), G("_", dc), G("_", dc), G("/", g), _, _],
      [_, G("|", gd), G(" ", gd), G(" ", gd), G("|", gd), _, _],
      [_, G("[", gd), G("=", gd), G("=", gd), G("]", gd), _, _]
    ];
  }
  var MONSTER_GLYPH_FACTORIES = {
    giant_rat: (c) => {
      const d = darken(c, 0.6), t = "#997744";
      return mkSprite([
        "   ,--,    ~~~",
        " ,-    -,~~~  ",
        "(o        >   ",
        "(  ^       )  ",
        "|  ------  |  ",
        " '--------'   ",
        "   /|    |\\  "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "/": ["/", c],
        "\\": ["\\", c],
        ">": [">", c],
        "o": ["o", d],
        "^": ["^", d],
        "~": ["~", t]
      });
    },
    newt: (c) => {
      const d = darken(c, 0.55), s = "#55cc44";
      return mkSprite([
        "  ,--,       ",
        " /o   >===,  ",
        "|  ------  . ",
        "|  -------   ",
        " \\_______/  ",
        "    | |      "
      ], {
        ",": [",", c],
        "-": ["-", c],
        ".": [".", c],
        "/": ["/", c],
        "\\": ["\\", c],
        "|": ["|", d],
        "_": ["_", d],
        "=": ["=", c],
        ">": [">", c],
        "o": ["o", s]
      });
    },
    bat: (c) => {
      const d = darken(c, 0.55), e = "#ff4422";
      return mkSprite([
        "/\\          /\\ ",
        "  \\  ,--,  /  ",
        "  )(o)(o)(    ",
        "   \\ vv /    ",
        "   (    )     ",
        "   |    |     ",
        "   '--''     "
      ], {
        "/": ["/", c],
        "\\": ["\\", c],
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "v": ["v", d],
        "o": ["o", e]
      });
    },
    giant_spider: (c) => {
      const d = darken(c, 0.55), e = "#ff2200";
      return mkSprite([
        "\\   |   /   ",
        " \\  |  /    ",
        " (_______)  ",
        "( (     ) ) ",
        "( (  *  ) ) ",
        " (_______)  ",
        "/   | |  \\  ",
        "    | |     "
      ], {
        "\\": ["\\", c],
        "/": ["/", c],
        "|": ["|", d],
        "_": ["_", c],
        "(": ["(", c],
        ")": [")", c],
        "-": ["-", d],
        "*": ["*", e]
      });
    },
    centipede: (c) => {
      const d = darken(c, 0.55);
      return mkSprite([
        "  o-o-o-o-o-o ",
        " /|/|/|/|/|/| ",
        "  o o o o o o ",
        " \\|\\|\\|\\|\\|\\| ",
        "  o-o-o-o-o-> "
      ], {
        "o": ["o", c],
        "-": ["-", c],
        ">": [">", c],
        "/": ["/", d],
        "\\": ["\\", d],
        "|": ["|", d]
      });
    },
    giant_ant: (c) => {
      const d = darken(c, 0.55);
      return mkSprite([
        "   /\\ /\\    ",
        "  /  V  \\   ",
        " ( (ooo) )  ",
        "  \\  |  /   ",
        "  (  |  )   ",
        " /|  |  |\\  ",
        "/  \\ | /  \\ "
      ], {
        "/": ["/", c],
        "\\": ["\\", c],
        "(": ["(", c],
        ")": [")", c],
        "V": ["V", d],
        "|": ["|", d],
        "o": ["o", d]
      });
    },
    killer_bee: (c) => {
      const d = darken(c, 0.55), y = "#ffee22";
      return mkSprite([
        "  _/ \\_    ",
        " / \\-/ \\   ",
        "( B B B )  ",
        "( ===== )  ",
        " \\_____/   ",
        "    |      ",
        "   /|\\     "
      ], {
        "_": ["_", c],
        "/": ["/", c],
        "\\": ["\\", c],
        "-": ["-", c],
        "(": ["(", c],
        ")": [")", c],
        "B": ["B", y],
        "=": ["=", y],
        "|": ["|", d]
      });
    },
    grid_bug: (c) => {
      const d = darken(c, 0.55);
      return mkSprite([
        " /\\/\\/\\  ",
        "(  ..  )  ",
        "|  ##  |  ",
        " (    )   ",
        " /|  |\\  ",
        "  '--'   "
      ], {
        "/": ["/", c],
        "\\": ["\\", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "#": ["#", d],
        ".": [".", "#ffff88"],
        "-": ["-", c],
        "'": ["'", c]
      });
    },
    goblin: (c) => {
      const d = darken(c, 0.6), e = "#ffff66";
      return mkSprite([
        "  ,---.   ",
        " (o   o)  ",
        " | ^ ^ |  ",
        "  \\---/   ",
        "  |||||   ",
        " /||||\\   ",
        "(  |||  ) ",
        "   | |    ",
        "  / \\ \\ ' "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "o": ["o", e],
        "^": ["^", d]
      });
    },
    kobold: (c) => {
      const d = darken(c, 0.6), e = "#ff8800";
      return mkSprite([
        "  ,---.   ",
        " (o   o)  ",
        " | v v |  ",
        "  \\---/   ",
        "  |||||   ",
        " /||||\\   ",
        "(  |||  ) ",
        "   | |    ",
        "  / \\ \\ ' "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "o": ["o", e],
        "v": ["v", d]
      });
    },
    orc: (c) => {
      const d = darken(c, 0.55), e = "#ffcc44";
      return mkSprite([
        "   ,-----.   ",
        "  (O     O)  ",
        "  | v...v |  ",
        "   '-----'   ",
        "   (|||||)   ",
        "  /|||||||\\  ",
        " (  |||||  ) ",
        "    || ||    ",
        "   /|   |\\  "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "O": ["O", e],
        "v": ["v", d],
        ".": [".", "#eecc88"]
      });
    },
    goblin_variants: (c) => {
      const d = darken(c, 0.55), e = "#ffcc44";
      return mkSprite([
        "  ,----.   ",
        " ( o  o )  ",
        "  \\----/   ",
        "   |||||   ",
        "  /||||\\   ",
        " (  |||  ) ",
        "    | |    "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "o": ["o", e]
      });
    },
    zombie: (c) => {
      const d = darken(c, 0.55);
      return mkSprite([
        "  ,---.    ",
        " (X   X)   ",
        "  \\---/    ",
        "  |||||    ",
        " /|||||\\   ",
        "(  |||  )  ",
        "  || ||    ",
        "  '  '    "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "X": ["X", "#dddddd"],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c]
      });
    },
    skeleton: (c) => {
      const d = darken(c, 0.6), w = "#dddddd";
      return mkSprite([
        "   ,O,     ",
        "  ( * )    ",
        "   \\-/     ",
        "  /|=|\\    ",
        " | | | |   ",
        " | | | |   ",
        " |_   _|   ",
        "  | | |    ",
        "  ' ' '   "
      ], {
        ",": [",", w],
        "O": ["O", w],
        "*": ["*", w],
        "\\": ["\\", w],
        "/": ["/", w],
        "-": ["-", w],
        "|": ["|", w],
        "=": ["=", d],
        "_": ["_", w],
        "'": ["'", w]
      });
    },
    floating_eye: (c) => {
      const d = darken(c, 0.55), p = "#2244ff", w = "#ffffff";
      return mkSprite([
        "   _____   ",
        "  /     \\  ",
        " |  ___  | ",
        " | (*  ) | ",
        " |  ---  | ",
        " |  ~~~  | ",
        "  \\_____/  "
      ], {
        "_": ["_", c],
        "/": ["/", c],
        "\\": ["\\", c],
        "|": ["|", d],
        "(": ["(", w],
        ")": [")", w],
        "*": ["*", p],
        "-": ["-", d],
        "~": ["~", d]
      });
    },
    gelatinous_cube: (c) => {
      const d = darken(c, 0.45);
      return mkSprite([
        " +----------+ ",
        " |..........| ",
        " |. .  . . .| ",
        " |..........| ",
        " |. .  . . .| ",
        " |..........| ",
        " +----------+ "
      ], {
        "+": ["+", c],
        "|": ["|", c],
        "-": ["-", c],
        ".": [".", d],
        " ": [" ", d]
      });
    },
    ochre_jelly: (c) => {
      const d = darken(c, 0.55);
      return mkSprite([
        " ,~~~~~~~~~, ",
        "( ~~~~~~~~~ )",
        "( ~~~~~~~~~~ )",
        "( ~~~~~~~~~ )",
        " '~~~~~~~~~~' ",
        "   --------   "
      ], {
        ",": [",", c],
        "~": ["~", c],
        "(": ["(", c],
        ")": [")", c],
        "'": ["'", c],
        "-": ["-", d]
      });
    },
    mimic: (c) => {
      const d = darken(c, 0.55), b = "#886633", t = "#ffee88";
      return mkSprite([
        ",============,",
        "| ,---..---. |",
        "|.VVVVVVVVVV.|",
        "|============|",
        "|  |      |  |",
        "|  |      |  |",
        "|  |______|  |",
        "'============'"
      ], {
        ",": [",", b],
        "=": ["=", b],
        "|": ["|", b],
        "-": ["-", b],
        ".": [".", d],
        "V": ["V", t],
        "_": ["_", b],
        "'": ["'", b]
      });
    },
    troll: (c) => {
      const d = darken(c, 0.55), e = "#ffcc00";
      return mkSprite([
        "  ,------,   ",
        " ( *    * )  ",
        " | vvvvv |   ",
        "  '--v--'    ",
        "  (|||||||)  ",
        " /||||||||||\\",
        "(  ||||||||  )",
        " (  ||||||  ) ",
        "    || ||    ",
        "   /|   |\\  "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "*": ["*", e],
        "v": ["v", d]
      });
    },
    ogre: (c) => {
      const d = darken(c, 0.55), e = "#ffcc44";
      return mkSprite([
        "   ,-----.   ",
        "  ( O   O )  ",
        "  |  ___  |  ",
        "   \\_---_/   ",
        "   (|||||)   ",
        "  /|||||||\\  ",
        " (  |||||  ) ",
        "    | | |    ",
        "   /|   |\\  "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "_": ["_", c],
        "O": ["O", e]
      });
    },
    minotaur: (c) => {
      const d = darken(c, 0.55), e = "#ffcc44";
      return mkSprite([
        "  /\\     /\\   ",
        " /  \\   /  \\  ",
        "(    ) ( )  ) ",
        "|  [ooo]   |  ",
        " \\  ---  /   ",
        "  (|||||)     ",
        " /|||||||\\    ",
        "(  |||||  )   ",
        "   || ||      ",
        "  /|   |\\    "
      ], {
        "/": ["/", c],
        "\\": ["\\", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "-": ["-", c],
        "[": ["[", d],
        "]": ["]", d],
        "o": ["o", e]
      });
    },
    wraith: (c) => {
      const d = darken(c, 0.45), e = "#ff4488";
      return mkSprite([
        "   ,~~~~,    ",
        "  (  ..  )   ",
        "  ( ---- )   ",
        "   (    )    ",
        "    ( ~ )    ",
        "    )   (    ",
        "   (     )   ",
        "  (       )  ",
        "   '~~~~~'   "
      ], {
        ",": [",", c],
        "~": ["~", c],
        "(": ["(", c],
        ")": [")", c],
        ".": [".", e],
        "-": ["-", d],
        "'": ["'", c]
      });
    },
    vampire: (c) => {
      const d = darken(c, 0.55), e = "#ff2222", w = "#dddddd";
      return mkSprite([
        "   ,---.     ",
        "  (o   o)    ",
        "   \\ W /     ",
        "    | |      ",
        "   /   \\     ",
        "  /  *  \\    ",
        " /       \\   ",
        "|         |  ",
        " '-------'   "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "o": ["o", e],
        "W": ["W", w],
        "*": ["*", "#ffcc44"]
      });
    },
    lich: (c) => {
      const d = darken(c, 0.55), e = "#88ffff", w = "#cccccc";
      return mkSprite([
        "   ,O,       ",
        "  (* *)      ",
        "   \\-/       ",
        "  /|=|\\      ",
        " *| | |*     ",
        "  | | |      ",
        "   \\   /     ",
        "   /   \\     ",
        "  /|   |\\    "
      ], {
        ",": [",", w],
        "O": ["O", w],
        "\\": ["\\", w],
        "/": ["/", w],
        "-": ["-", w],
        "|": ["|", d],
        "=": ["=", d],
        "_": ["_", d],
        "*": ["*", e]
      });
    },
    dragon: (c) => {
      const d = darken(c, 0.55), e = "#ffee22", f = "#ff6600";
      return mkSprite([
        "  /\\/\\  /\\/\\  ",
        " /oooo\\/ oo\\ ",
        "/  --  \\ -- \\",
        "|  /\\/\\ /\\/\\ |",
        " \\/    \\/    \\/",
        " (  ___________)",
        "/ (             )",
        "  |  | |  |  |  ",
        "  \\_____/     "
      ], {
        "/": ["/", c],
        "\\": ["\\", c],
        "o": ["o", e],
        "-": ["-", d],
        "|": ["|", d],
        "(": ["(", c],
        ")": [")", c],
        "_": ["_", c],
        "V": ["V", f]
      });
    },
    wolf: (c) => {
      const d = darken(c, 0.55), e = "#ffcc88";
      return mkSprite([
        "   ,---,    ",
        "  ( o o )   ",
        " < (---) >  ",
        "  (     )   ",
        " /  ---  \\  ",
        "(  /   \\  ) ",
        "  '-----'   "
      ], {
        ",": [",", c],
        "-": ["-", c],
        "'": ["'", c],
        "(": ["(", c],
        ")": [")", c],
        "|": ["|", d],
        "\\": ["\\", c],
        "/": ["/", c],
        "<": ["<", c],
        ">": [">", c],
        "o": ["o", e]
      });
    }
  };
  function genericMonsterGlyph(symbol, color) {
    const d = darken(color, 0.65), d2 = darken(color, 0.42);
    return [
      [_, G("/", d2), G("^", d), G("\\", d2), _],
      [G("(", d), G(".", d2), G(" ", d2), G(".", d2), G(")", d)],
      [G("|", d), G(" ", d2), G(symbol, color), G(" ", d2), G("|", d)],
      [G("(", d), G("_", d2), G(" ", d2), G("_", d2), G(")", d)],
      [_, G("|", d), G("_", d2), G("|", d), _]
    ];
  }
  function makeMonsterGlyph(key, symbol, color) {
    const factory = MONSTER_GLYPH_FACTORIES[key] ?? MONSTER_GLYPH_FACTORIES[
      // alias similar monster types to shared designs
      key === "gnome" ? "goblin_variants" : key === "hobgoblin" ? "goblin_variants" : key === "jackal" ? "wolf" : key === "warg" ? "wolf" : key === "dwarf" ? "goblin_variants" : key === "elf" ? "goblin_variants" : key === "zombie" ? "zombie" : key === "killer_bee" ? "killer_bee" : "goblin"
    ];
    return factory?.(color) ?? genericMonsterGlyph(symbol, color);
  }
  var SPRITE_SCALE = 3;
  function drawSprites(renderer, sprites, player, zBuf, viewX, viewY, viewW, viewH, horizonRow) {
    const dirX = Math.cos(player.angle), dirY = Math.sin(player.angle);
    const halfFov = Math.tan(FOV / 2);
    sprites.sort((a, b) => {
      const dA = (a.x + 0.5 - player.x) ** 2 + (a.y + 0.5 - player.y) ** 2;
      const dB = (b.x + 0.5 - player.x) ** 2 + (b.y + 0.5 - player.y) ** 2;
      return dB - dA;
    });
    for (const sp of sprites) {
      const rx = sp.x + 0.5 - player.x;
      const ry = sp.y + 0.5 - player.y;
      const transformY = dirX * rx + dirY * ry;
      if (transformY <= 0.1) continue;
      const transformX = (dirX * ry - dirY * rx) / halfFov;
      const screenX = Math.round(viewW / 2 * (1 + transformX / transformY));
      if (screenX < 0 || screenX >= viewW) continue;
      const luma = Math.max(0.45, fade(transformY));
      const glyph = sp.glyph;
      const glyphRows = glyph.length;
      const glyphCols = Math.max(...glyph.map((r) => r.length));
      const rawScale = viewH / (transformY * glyphRows);
      if (rawScale < 0.5) {
        if (transformY >= zBuf[screenX]) continue;
        const floorRow = Math.max(0, Math.min(viewH - 1, horizonRow));
        renderer.put(viewX + screenX, viewY + floorRow, sp.singleCh, darken(sp.singleColor, luma));
        continue;
      }
      const perspScale = Math.max(1, Math.min(SPRITE_SCALE * 2, Math.round(rawScale)));
      const scaledH = glyphRows * perspScale;
      const scaledW = glyphCols * perspScale;
      const glyphTop = horizonRow;
      const glyphLeft = screenX - Math.floor(scaledW / 2);
      for (let gr = 0; gr < glyphRows; gr++) {
        const row = glyph[gr];
        for (let gr2 = 0; gr2 < perspScale; gr2++) {
          const sr = glyphTop + gr * perspScale + gr2;
          if (sr < 0 || sr >= viewH) continue;
          for (let gc = 0; gc < row.length; gc++) {
            const cell = row[gc];
            if (!cell) continue;
            for (let gc2 = 0; gc2 < perspScale; gc2++) {
              const sc = glyphLeft + gc * perspScale + gc2;
              if (sc < 0 || sc >= viewW) continue;
              if (transformY >= zBuf[sc]) continue;
              renderer.put(viewX + sc, viewY + sr, cell.ch, darken(cell.color, luma));
            }
          }
        }
      }
    }
  }
  function renderView(renderer, player, level, monsters, items, viewX, viewY, viewW, viewH) {
    const px = player.x, py = player.y;
    const dirX = Math.cos(player.angle), dirY = Math.sin(player.angle);
    const halfFov = Math.tan(FOV / 2);
    const bobOffset = Math.round(Math.sin(player.bobPhase) * player.bobAmplitude * 1.3);
    const horizonRow = Math.floor(viewH / 2) + Math.round(player.pitch) + bobOffset;
    const t = Date.now();
    const ambientPulse = 1 + Math.sin(t * 45e-5) * 0.012;
    const zBuf = new Float64Array(viewW).fill(MAX_RAY_DEPTH);
    for (let r = 0; r < viewH; r++) {
      const fromHorizon = r - horizonRow;
      if (fromHorizon === 0) continue;
      const rowDist = viewH / (2 * Math.abs(fromHorizon));
      const isFloor = fromHorizon > 0;
      const baseLuma = fade(rowDist) * (isFloor ? 0.65 : 0.22);
      if (!isFloor) {
        const fg = darken("#141210", baseLuma / 0.22);
        for (let c = 0; c < viewW; c++)
          renderer.put(viewX + c, viewY + r, charFromLuma(clamp01(baseLuma + bayerDither(c, r))), fg);
        continue;
      }
      let floorX = px + rowDist * (dirX + dirY * halfFov);
      let floorY = py + rowDist * (dirY - dirX * halfFov);
      const fdx = rowDist * -dirY * 2 * halfFov / viewW;
      const fdy = rowDist * dirX * 2 * halfFov / viewW;
      for (let c = 0; c < viewW; c++, floorX += fdx, floorY += fdy) {
        const fx = (floorX % 1 + 1) % 1;
        const fy = (floorY % 1 + 1) % 1;
        const dit = bayerDither(c, r);
        if (fx < 0.06 || fy < 0.06) {
          renderer.put(
            viewX + c,
            viewY + r,
            charFromLuma(clamp01(baseLuma * 0.18 + dit)),
            darken("#0e0a06", baseLuma * 2)
          );
        } else {
          const vary = (tileHash(Math.floor(floorX), Math.floor(floorY)) - 0.5) * 0.18;
          const luma = clamp01(baseLuma + vary + dit);
          renderer.put(viewX + c, viewY + r, charFromLuma(luma), darken("#a87848", luma));
        }
      }
    }
    for (let col = 0; col < viewW; col++) {
      const camX = (2 * col / viewW - 1) * halfFov;
      const rayDirX = dirX - dirY * camX;
      const rayDirY = dirY + dirX * camX;
      let mapX = Math.floor(px), mapY = Math.floor(py);
      const deltaX = Math.abs(1 / (rayDirX || 1e-30));
      const deltaY = Math.abs(1 / (rayDirY || 1e-30));
      const stepX = rayDirX < 0 ? -1 : 1;
      const stepY = rayDirY < 0 ? -1 : 1;
      let sideX = (rayDirX < 0 ? px - mapX : mapX + 1 - px) * deltaX;
      let sideY = (rayDirY < 0 ? py - mapY : mapY + 1 - py) * deltaY;
      let side = 0, hit = false;
      for (let depth = 0; !hit && depth < 128; depth++) {
        if (sideX < sideY) {
          sideX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          sideY += deltaY;
          mapY += stepY;
          side = 1;
        }
        if (OPAQUE_TILES.has(level.tile(mapX, mapY))) hit = true;
      }
      const perpDist = side === 0 ? (mapX - px + (1 - stepX) / 2) / rayDirX : (mapY - py + (1 - stepY) / 2) / rayDirY;
      zBuf[col] = perpDist;
      const lineH = Math.round(viewH / perpDist);
      const top = Math.max(0, horizonRow - Math.floor(lineH / 2));
      const bottom = Math.min(viewH - 1, horizonRow + Math.floor(lineH / 2));
      const hitTile = level.tile(mapX, mapY);
      const isDoor = hitTile === 4 /* DOOR_CLOSED */;
      const luma = clamp01(fade(perpDist) * (side === 0 ? 1 : 0.72) * (isDoor ? 0.85 : 1) * ambientPulse);
      const baseColor = isDoor ? "#9a6020" : side === 0 ? COL_WALL_CLOSE_X : COL_WALL_CLOSE_Y;
      let wallX = side === 0 ? py + perpDist * rayDirY : px + perpDist * rayDirX;
      wallX -= Math.floor(wallX);
      if (side === 0 && rayDirX > 0) wallX = 1 - wallX;
      if (side === 1 && rayDirY < 0) wallX = 1 - wallX;
      const tileVariation = !isDoor ? (tileHash(mapX * 7 + 13, mapY * 11 + 5) - 0.5) * 0.16 : 0;
      const edgeDark = !isDoor && (wallX < 0.04 || wallX > 0.96) ? 0.62 : 1;
      const torchSeed = isDoor ? 1 : tileHash(mapX, mapY);
      const tileHasTorch = !isDoor && torchSeed < 0.25 && perpDist < 6.5 && luma > 0.15 && lineH >= 8;
      const torchPhase = torchSeed * Math.PI * 8;
      const tflick = tileHasTorch ? 1 + Math.sin(t * 31e-4 + torchPhase) * 0.2 + Math.sin(t * 0.0109 + torchPhase * 1.9) * 0.1 : 1;
      const inTorchCenter = tileHasTorch && Math.abs(wallX - 0.5) < 0.065;
      const inTorchGlow = tileHasTorch && Math.abs(wallX - 0.5) < 0.22;
      const sconceRow = top + Math.round(lineH * 0.38);
      for (let row = top; row <= bottom; row++) {
        if (isDoor) {
          const wY = (row - top) / Math.max(1, lineH - 1);
          if (wY < 0.055 || wY > 0.945) {
            renderer.put(viewX + col, viewY + row, "=", darken("#c49050", luma));
            continue;
          }
          if (wallX < 0.07 || wallX > 0.93) {
            renderer.put(viewX + col, viewY + row, "|", darken("#9a6020", luma));
            continue;
          }
          if (wallX > 0.105 && wallX < 0.155 || wallX > 0.845 && wallX < 0.895) {
            renderer.put(viewX + col, viewY + row, "|", darken("#b07828", luma * 0.88));
            continue;
          }
          if (wY > 0.46 && wY < 0.54 || wY > 0.12 && wY < 0.17 || wY > 0.83 && wY < 0.88) {
            renderer.put(viewX + col, viewY + row, "-", darken("#c08038", luma * 0.9));
            continue;
          }
          if (wallX > 0.63 && wallX < 0.75 && wY > 0.45 && wY < 0.55) {
            renderer.put(viewX + col, viewY + row, "o", darken("#d4a000", clamp01(luma * 1.9)));
            continue;
          }
          const gp = wallX * 8.5 % 1;
          if (gp < 0.14)
            renderer.put(viewX + col, viewY + row, "|", darken("#aa6820", luma * 1.05));
          else if (gp < 0.21)
            renderer.put(viewX + col, viewY + row, ":", darken("#8a5018", luma * 0.82));
          else
            renderer.put(viewX + col, viewY + row, charFromLuma(luma * 0.3), darken("#7a4010", luma * 0.55));
        } else {
          const posInStrip = (row - top) / Math.max(1, lineH);
          const ao = posInStrip > 0.88 ? 0.62 : posInStrip < 0.05 ? 0.75 : 1;
          let torchGlow = 0;
          if (inTorchGlow) {
            const rowDist = Math.abs(row - sconceRow);
            const glowR = Math.max(2, Math.round(lineH * 0.3));
            const colWeight = 1 - Math.abs(wallX - 0.5) / 0.22;
            if (rowDist <= glowR)
              torchGlow = colWeight * (1 - rowDist / glowR) * 0.55 * tflick;
          }
          const brickL = brickPixelLuma(row, top, lineH, wallX, luma * (1 + tileVariation), mapX, mapY);
          const finalL = clamp01(brickL * ao * edgeDark + torchGlow);
          const wallCol = torchGlow > 0.1 ? "#e09042" : baseColor;
          renderer.put(viewX + col, viewY + row, charFromLuma(finalL), darken(wallCol, finalL));
        }
      }
      if (isDoor && lineH > 4) {
        const frameFg = darken("#c49050", clamp01(luma * 1.15));
        if (top >= 0) renderer.put(viewX + col, viewY + top, "=", frameFg);
        if (bottom < viewH) renderer.put(viewX + col, viewY + bottom, "=", frameFg);
      }
      if (inTorchCenter) {
        const flame = sconceRow - 1;
        const tip = sconceRow - 2;
        const ember = sconceRow + 1;
        if (tip >= 0 && tip < viewH)
          renderer.put(
            viewX + col,
            viewY + tip,
            ",",
            darken("#ffee88", clamp01(luma * tflick * 1.15))
          );
        if (flame >= 0 && flame < viewH)
          renderer.put(
            viewX + col,
            viewY + flame,
            "*",
            darken("#ffaa22", clamp01(luma * tflick * 2.2))
          );
        if (sconceRow >= 0 && sconceRow < viewH)
          renderer.put(
            viewX + col,
            viewY + sconceRow,
            "+",
            darken("#7a5a38", clamp01(luma * 0.9))
          );
        if (ember >= 0 && ember < viewH)
          renderer.put(
            viewX + col,
            viewY + ember,
            ".",
            darken("#cc5500", clamp01(luma * tflick * 0.75))
          );
      }
    }
    const sprites = [
      ...monsters.map((m) => ({
        x: m.x,
        y: m.y,
        glyph: makeMonsterGlyph(m.key, m.symbol, m.color),
        singleCh: m.symbol,
        singleColor: m.color
      })),
      ...items.map((i) => ({
        x: i.x,
        y: i.y,
        glyph: i.kind === "potion" ? potionGlyph(i.color) : ITEM_GLYPHS[i.kind] ?? genericMonsterGlyph(i.symbol, i.color),
        singleCh: i.symbol,
        singleColor: i.color
      }))
    ];
    if (level.stairsDown) sprites.push({
      x: level.stairsDown[0],
      y: level.stairsDown[1],
      glyph: ITEM_GLYPHS.stairs_down,
      singleCh: "v",
      singleColor: COL_STAIRS
    });
    if (level.stairsUp) sprites.push({
      x: level.stairsUp[0],
      y: level.stairsUp[1],
      glyph: ITEM_GLYPHS.stairs_up,
      singleCh: "^",
      singleColor: COL_STAIRS
    });
    drawSprites(renderer, sprites, player, zBuf, viewX, viewY, viewW, viewH, horizonRow);
  }

  // src/ui.ts
  var WHITE = "#ffffff";
  var GRAY = "#888888";
  var YELLOW = "#ffee44";
  var GREEN = "#44ff88";
  var RED = "#ff4444";
  var MSG_ROWS = 1;
  var STATUS_ROWS = 3;
  function drawMessages(renderer, messages, msgAge) {
    const row = 0;
    renderer.fill(0, row, renderer.cols, MSG_ROWS, " ", WHITE, COL_STATUS_BG);
    if (msgAge < 4) {
      const last = messages[messages.length - 1] ?? "";
      renderer.print(1, row, last.slice(0, renderer.cols - 2), COL_MSG, COL_STATUS_BG);
    }
  }
  var HUNGER_LABELS = {
    0: "Satiated",
    1: "Not Hungry",
    2: "Hungry",
    3: "Weak",
    4: "Fainting",
    5: "Starved"
  };
  function drawStatus(renderer, gs2) {
    const p = gs2.player;
    const baseRow = renderer.rows - STATUS_ROWS;
    renderer.fill(0, baseRow, renderer.cols, STATUS_ROWS, " ", WHITE, COL_STATUS_BG);
    const wpnName = p.equip.weapon ? `${p.equip.weapon.name}${p.equip.weapon.enchantment !== 0 ? ` ${p.equip.weapon.enchantment > 0 ? "+" : ""}${p.equip.weapon.enchantment}` : ""}` : "\u2013";
    const armName = p.equip.armor ? `${p.equip.armor.name}${p.equip.armor.enchantment !== 0 ? ` ${p.equip.armor.enchantment > 0 ? "+" : ""}${p.equip.armor.enchantment}` : ""}` : "\u2013";
    const roleName = ROLE_DATA[p.role]?.name ?? p.role;
    const raceName = RACE_DATA[p.race]?.name ?? p.race;
    const line1 = `${p.charName} the ${raceName} ${roleName}  Dlvl:${gs2.dlvl}  Wpn:${wpnName}  Armor:${armName}`;
    renderer.print(1, baseRow, line1.slice(0, renderer.cols - 2), WHITE, COL_STATUS_BG);
    const hpColor = p.hp < p.maxHp * 0.33 ? COL_HP_LOW : COL_HP_GOOD;
    const hpPrefix = "HP:";
    const hpVal = `${p.hp}`;
    const hpMax = `(${p.maxHp})`;
    let col2 = 1;
    renderer.print(col2, baseRow + 1, hpPrefix, WHITE, COL_STATUS_BG);
    col2 += hpPrefix.length;
    renderer.print(col2, baseRow + 1, hpVal, hpColor, COL_STATUS_BG);
    col2 += hpVal.length;
    renderer.print(col2, baseRow + 1, hpMax, GRAY, COL_STATUS_BG);
    col2 += hpMax.length;
    const statsLine = `  AC:${p.effectiveAC}  Str:${p.str} Dex:${p.dex} Con:${p.con} Int:${p.int_} Wis:${p.wis} Cha:${p.cha}`;
    renderer.print(col2, baseRow + 1, statsLine.slice(0, renderer.cols - col2 - 1), WHITE, COL_STATUS_BG);
    const statusBadges = [];
    if (p.blinded > 0) statusBadges.push("[BLIND]");
    if (p.confused > 0) statusBadges.push("[CONF]");
    if (p.levitating > 0) statusBadges.push("[LEV]");
    if (p.poisoned > 0) statusBadges.push("[POIS]");
    if (p.sick > 0) statusBadges.push("[SICK]");
    if (p.hasted > 0) statusBadges.push("[FAST]");
    if (p.paralyzed > 0) statusBadges.push("[PARA]");
    const statusStr = statusBadges.length > 0 ? "  " + statusBadges.join(" ") : "";
    const hunger = HUNGER_LABELS[p.hungerState] ?? "";
    const line3 = `XL:${p.xl}  XP:${p.xp}  $:${p.gold}  ${hunger}${statusStr}  T:${p.turns}`;
    renderer.print(1, baseRow + 2, line3.slice(0, renderer.cols - 2), COL_XP, COL_STATUS_BG);
  }
  function playerArrow(angle) {
    const a = (angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const idx = Math.round(a / (Math.PI / 4)) % 8;
    return "\u2192\u2198\u2193\u2199\u2190\u2196\u2191\u2197"[idx];
  }
  var MAP_SIZE = 15;
  function drawMinimap(renderer, level, player, monsters, items, viewY, viewH) {
    const mapStartCol = renderer.cols - MAP_SIZE - 1;
    const mapStartRow = viewY;
    const px = Math.round(player.x - 0.5);
    const py = Math.round(player.y - 0.5);
    const halfMap = Math.floor(MAP_SIZE / 2);
    const monSet = new Set(monsters.map((m) => `${m.x},${m.y}`));
    const itemSet = new Set(items.map((i) => `${i.x},${i.y}`));
    for (let row = 0; row < MAP_SIZE; row++) {
      for (let col = 0; col < MAP_SIZE; col++) {
        const wx = px - halfMap + col;
        const wy = py - halfMap + row;
        const cell = level.get(wx, wy);
        if (!cell || !cell.explored) {
          renderer.put(mapStartCol + col, mapStartRow + row, " ", "#000000", "#000000");
          continue;
        }
        let ch = " ", fg = "#000000", bg = "#000000";
        switch (cell.tile) {
          case 1 /* WALL */:
            ch = "\u2588";
            fg = COL_MINIMAP_WALL;
            bg = "#111122";
            break;
          case 2 /* FLOOR */:
            ch = "\xB7";
            fg = COL_MINIMAP_FLOOR;
            bg = "#001108";
            break;
          case 3 /* CORRIDOR */:
            ch = "\xB7";
            fg = "#335533";
            bg = "#001108";
            break;
          case 4 /* DOOR_CLOSED */:
            ch = "+";
            fg = "#ddaa33";
            bg = "#001108";
            break;
          case 5 /* DOOR_OPEN */:
            ch = "/";
            fg = "#ddaa33";
            bg = "#001108";
            break;
          case 7 /* STAIRS_DOWN */:
            ch = ">";
            fg = COL_STAIRS;
            bg = "#001108";
            break;
          case 6 /* STAIRS_UP */:
            ch = "<";
            fg = COL_STAIRS;
            bg = "#001108";
            break;
          default:
            ch = " ";
            fg = "#000000";
            bg = "#000000";
            break;
        }
        if (wx === px && wy === py) {
          ch = playerArrow(player.angle);
          fg = COL_PLAYER;
        } else if (monSet.has(`${wx},${wy}`)) {
          ch = "!";
          fg = COL_MONSTER_EASY;
        } else if (itemSet.has(`${wx},${wy}`)) {
          ch = "*";
          fg = COL_ITEM;
        }
        renderer.put(mapStartCol + col, mapStartRow + row, ch, fg, bg);
      }
    }
  }
  function eqLabel(item) {
    if (!item) return "\u2013";
    const enc = item.enchantment !== 0 ? ` ${item.enchantment > 0 ? "+" : ""}${item.enchantment}` : "";
    const charges = item.charges !== void 0 ? ` (${item.charges})` : "";
    return `${item.name}${enc}${charges}`;
  }
  function drawInventory(renderer, player, selectedIdx) {
    const BG = "#001833";
    const W = Math.min(60, renderer.cols - 4);
    const EQ_ROWS = 6;
    const ITEM_ROWS = Math.min(player.inventory.length, renderer.rows - 4 - EQ_ROWS - 4);
    const H = EQ_ROWS + 4 + Math.max(ITEM_ROWS, 1);
    const startCol = Math.floor((renderer.cols - W) / 2);
    const startRow = Math.max(0, Math.floor((renderer.rows - H) / 2));
    renderer.fill(startCol, startRow, W, H, " ", WHITE, BG);
    renderer.print(startCol + 2, startRow, "[ Inventory ]", YELLOW, BG);
    renderer.print(startCol + 2, startRow + 1, "[Enter] use/equip  [d] drop  [z] zap wand", GRAY, BG);
    let r = startRow + 2;
    renderer.print(startCol + 2, r, "\u2500\u2500 Equipment \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", GRAY, BG);
    r++;
    const half = Math.floor(W / 2) - 2;
    const slots = [
      ["Weapon", player.equip.weapon],
      ["Armor", player.equip.armor],
      ["Helm", player.equip.helm],
      ["Shield", player.equip.shield],
      ["Cloak", player.equip.cloak]
    ];
    const slotsR = [
      ["Ring L", player.equip.ring_left],
      ["Ring R", player.equip.ring_right],
      ["Boots", player.equip.boots],
      ["Gloves", player.equip.gloves],
      ["", null]
    ];
    for (let i = 0; i < slots.length; i++) {
      const [lbl, item] = slots[i];
      const [lbl2, item2] = slotsR[i];
      const left = lbl ? `${lbl.padEnd(7)}: ${eqLabel(item)}` : "";
      const right = lbl2 ? `${lbl2.padEnd(7)}: ${eqLabel(item2)}` : "";
      renderer.print(startCol + 2, r, left.slice(0, half), item ? WHITE : GRAY, BG);
      renderer.print(startCol + 2 + half, r, right.slice(0, half), item2 ? WHITE : GRAY, BG);
      r++;
    }
    renderer.print(startCol + 2, r, "\u2500\u2500 Pack \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500", GRAY, BG);
    r++;
    if (player.inventory.length === 0) {
      renderer.print(startCol + 4, r, "(empty)", GRAY, BG);
      r++;
    }
    for (let i = 0; i < player.inventory.length; i++) {
      if (r >= startRow + H - 1) break;
      const item = player.inventory[i];
      const sel = i === selectedIdx;
      const bg = sel ? "#003366" : BG;
      const enc = item.enchantment !== 0 ? ` ${item.enchantment > 0 ? "+" : ""}${item.enchantment}` : "";
      const chg = item.charges !== void 0 ? ` (${item.charges} charges)` : "";
      const label = `${String.fromCharCode(97 + i)}) ${item.name}${enc}${chg}`;
      renderer.fill(startCol + 1, r, W - 2, 1, " ", WHITE, bg);
      renderer.print(startCol + 2, r, label.slice(0, W - 4), sel ? YELLOW : WHITE, bg);
      r++;
    }
  }
  function drawTitle(renderer) {
    renderer.fill(0, 0, renderer.cols, renderer.rows, " ", WHITE, "#000000");
    const lines = [
      "\u2588\u2588\u2588\u2557   \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557",
      "\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2588\u2588\u2554\u2550\u2550\u255D\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551 \u2588\u2588\u2554\u255D",
      "\u2588\u2588\u2554\u2588\u2588\u2557 \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557     \u2588\u2588\u2551   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2554\u255D ",
      "\u2588\u2588\u2551\u255A\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D     \u2588\u2588\u2551   \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2588\u2588\u2557 ",
      "\u2588\u2588\u2551 \u255A\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557   \u2588\u2588\u2551   \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2557",
      "\u255A\u2550\u255D  \u255A\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D   \u255A\u2550\u255D   \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D",
      "",
      "              F P S  E D I T I O N"
    ];
    const startRow = Math.floor(renderer.rows / 2) - Math.floor(lines.length / 2) - 3;
    for (let i = 0; i < lines.length; i++) {
      const col = Math.floor((renderer.cols - lines[i].length) / 2);
      renderer.print(Math.max(0, col), startRow + i, lines[i], GREEN);
    }
    const instrRow = startRow + lines.length + 2;
    const instr = "Press [Enter] or [Space] to start";
    renderer.print(Math.floor((renderer.cols - instr.length) / 2), instrRow, instr, YELLOW);
    const ctrl = "WASD / vi-keys: move   Mouse: look   , pickup   i inventory   z zap wand   > down   < up   ? help   Q quit";
    renderer.print(Math.max(0, Math.floor((renderer.cols - ctrl.length) / 2)), instrRow + 2, ctrl.slice(0, renderer.cols - 2), GRAY);
  }
  function drawDeath(renderer, gs2) {
    renderer.fill(0, 0, renderer.cols, renderer.rows, " ", WHITE, "#110000");
    const lines = [
      "\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2557 ",
      "\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557",
      "\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551  \u2588\u2588\u2551",
      "\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D  \u2588\u2588\u2551  \u2588\u2588\u2551",
      "\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D",
      "\u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u255D "
    ];
    const r0 = Math.floor(renderer.rows / 2) - 6;
    for (let i = 0; i < lines.length; i++) {
      const col = Math.floor((renderer.cols - lines[i].length) / 2);
      renderer.print(col, r0 + i, lines[i], RED);
    }
    const p = gs2.player;
    const roleName2 = ROLE_DATA[p.role]?.name ?? p.role;
    const raceName2 = RACE_DATA[p.race]?.name ?? p.race;
    const charDesc = `${p.charName} the ${raceName2} ${roleName2} (${p.alignment})`;
    renderer.print(Math.floor((renderer.cols - charDesc.length) / 2), r0 + lines.length, charDesc, WHITE);
    const stats = `Dlvl ${gs2.dlvl}  XL ${p.xl}  XP ${p.xp}  Gold ${p.gold}  Turns ${gs2.turns}`;
    const stats2 = `Str:${p.str} Dex:${p.dex} Con:${p.con} Int:${p.int_} Wis:${p.wis} Cha:${p.cha}  HP:${p.hp}/${p.maxHp}  AC:${p.effectiveAC}`;
    renderer.print(Math.floor((renderer.cols - stats.length) / 2), r0 + lines.length + 1, stats, YELLOW);
    renderer.print(Math.floor((renderer.cols - stats2.length) / 2), r0 + lines.length + 2, stats2, WHITE);
    const lastMsg = gs2.messages[gs2.messages.length - 1] ?? "";
    renderer.print(Math.floor((renderer.cols - lastMsg.length) / 2), r0 + lines.length + 3, lastMsg, GRAY);
    const again = "Press [Enter] or [Space] to play again  [Q] to quit";
    renderer.print(Math.floor((renderer.cols - again.length) / 2), r0 + lines.length + 5, again, GRAY);
  }
  function drawWin(renderer, gs2) {
    renderer.fill(0, 0, renderer.cols, renderer.rows, " ", WHITE, "#001100");
    const msg = "You have retrieved the Amulet of Yendor!";
    const msg2 = "You ascend to the surface... and win!";
    const cr = Math.floor(renderer.rows / 2);
    const col1 = Math.floor((renderer.cols - msg.length) / 2);
    const col2 = Math.floor((renderer.cols - msg2.length) / 2);
    renderer.print(col1, cr - 1, msg, YELLOW);
    renderer.print(col2, cr, msg2, GREEN);
    const stats = `XL ${gs2.player.xl}  XP ${gs2.player.xp}  Gold ${gs2.player.gold}  Turns ${gs2.turns}`;
    renderer.print(Math.floor((renderer.cols - stats.length) / 2), cr + 2, stats, WHITE);
    const again = "Press [Enter] to play again";
    renderer.print(Math.floor((renderer.cols - again.length) / 2), cr + 4, again, GRAY);
  }
  function drawHelp(renderer, invertY = false) {
    const W = Math.min(72, renderer.cols - 4);
    const H = 32;
    const sc = Math.floor((renderer.cols - W) / 2);
    const sr = Math.max(0, Math.floor((renderer.rows - H) / 2));
    const BG = "#001428";
    renderer.fill(sc, sr, W, H, " ", WHITE, BG);
    const title = "[ NETHACKFPS  HELP ]";
    renderer.print(sc + Math.floor((W - title.length) / 2), sr, title, YELLOW, BG);
    renderer.print(sc + 1, sr + 1, "\u2500".repeat(W - 2), GRAY, BG);
    const L = sc + 2;
    const R = sc + Math.floor(W / 2) + 1;
    let lr = sr + 2;
    renderer.print(L, lr++, "MOVEMENT", YELLOW, BG);
    const moves = [
      ["W / K", "Move forward"],
      ["S / J", "Move backward"],
      ["A / H", "Strafe left"],
      ["D / L", "Strafe right"],
      ["\u2190 / Q", "Rotate left"],
      ["\u2192 / E", "Rotate right"],
      ["Mouse", "Look (yaw + pitch)"]
    ];
    for (const [key, desc] of moves) {
      renderer.print(L, lr, key.padEnd(10), GREEN, BG);
      renderer.print(L + 10, lr++, desc, WHITE, BG);
    }
    lr++;
    renderer.print(L, lr++, "ACTIONS", YELLOW, BG);
    const actions = [
      [",", "Pick up item"],
      ["i", "Inventory / equip / use"],
      ["z", "Zap first wand in pack"],
      [".", "Wait one turn"],
      [">", "Descend stairs"],
      ["<", "Ascend stairs (need Amulet on lvl 1)"],
      ["V", `Invert Y-axis [${invertY ? "ON" : "OFF"}]`],
      ["?", "This help screen"],
      ["Q", "Quit"]
    ];
    for (const [key, desc] of actions) {
      renderer.print(L, lr, key.padEnd(10), GREEN, BG);
      renderer.print(L + 10, lr++, desc, WHITE, BG);
    }
    lr++;
    renderer.print(L, lr++, "INVENTORY", YELLOW, BG);
    const invKeys = [
      ["\u2191 / \u2193", "Select item"],
      ["Enter", "Use / equip / wield"],
      ["d", "Drop item"],
      ["Esc", "Close inventory"]
    ];
    for (const [key, desc] of invKeys) {
      renderer.print(L, lr, key.padEnd(10), GREEN, BG);
      renderer.print(L + 10, lr++, desc, WHITE, BG);
    }
    let rr = sr + 2;
    renderer.print(R, rr++, "ITEM TYPES", YELLOW, BG);
    const items = [
      [")", COL_ITEM, "Weapon  \u2013 wield for better damage"],
      ["[", COL_ITEM, "Armor   \u2013 wear to reduce damage taken"],
      ["%", COL_ITEM, "Food    \u2013 eat to stave off hunger"],
      ["!", COL_ITEM, "Potion  \u2013 drink for magical effects"],
      ["?", COL_ITEM, "Scroll  \u2013 read for magical effects"],
      ["=", COL_RING, "Ring    \u2013 equip L/R finger for passive bonus"],
      ["/", COL_WAND, "Wand    \u2013 zap [z] to fire a beam effect"],
      ["$", COL_GOLD, "Gold    \u2013 collected automatically"],
      ['"', "#ffee88", "Amulet  \u2013 bring to surface level to win!"]
    ];
    for (const [sym, color, desc] of items) {
      renderer.print(R, rr, sym.padEnd(4), color, BG);
      renderer.print(R + 4, rr++, desc, WHITE, BG);
    }
    rr++;
    renderer.print(R, rr++, "STATUS EFFECTS", YELLOW, BG);
    const effects = [
      ["[BLIND]", "Cannot see (turns remaining)"],
      ["[CONF]", "Confused \u2014 movement may misfire"],
      ["[POIS]", "Poisoned \u2014 slow HP drain"],
      ["[SICK]", "Sick \u2014 HP drain, curable by potion"],
      ["[LEV]", "Levitating \u2014 cannot descend stairs"],
      ["[FAST]", "Hasted \u2014 extra actions per turn"],
      ["[PARA]", "Paralyzed \u2014 skip your turns"]
    ];
    for (const [badge, desc] of effects) {
      renderer.print(R, rr, badge.padEnd(9), RED, BG);
      renderer.print(R + 9, rr++, desc, WHITE, BG);
    }
    rr++;
    renderer.print(R, rr++, "MINIMAP", YELLOW, BG);
    const legend = [
      ["\u2192\u2198\u2193\u2199\u2190\u2196\u2191\u2197", COL_PLAYER, "You (facing)"],
      ["!", COL_MONSTER_EASY, "Monster nearby"],
      ["*", COL_ITEM, "Item on floor"],
      [">", COL_STAIRS, "Stairs down"],
      ["<", COL_STAIRS, "Stairs up"],
      ["+", "#ddaa33", "Closed door"]
    ];
    for (const [sym, color, desc] of legend) {
      renderer.print(R, rr, sym.slice(0, 3).padEnd(4), color, BG);
      renderer.print(R + 4, rr++, desc, WHITE, BG);
    }
    const fr = sr + H - 3;
    renderer.print(sc + 1, fr, "\u2500".repeat(W - 2), GRAY, BG);
    renderer.print(sc + 2, fr + 1, "Walk into closed doors to open them.  Wear armor to reduce AC.  [?] to close", GRAY, BG);
  }
  function updateExplored(level, player) {
    const px = Math.round(player.x - 0.5);
    const py = Math.round(player.y - 0.5);
    const radius = 8;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = px + dx, ty = py + dy;
        const cell = level.get(tx, ty);
        if (!cell) continue;
        if (hasLOS2(level, px, py, tx, ty)) {
          cell.explored = true;
          cell.visible = true;
        } else {
          cell.visible = false;
        }
      }
    }
  }
  function drawFullMap(renderer, level, dlvl, player, monsters, items) {
    const BG = "#000000";
    renderer.fill(0, 0, renderer.cols, renderer.rows, " ", BG, BG);
    const mapW = level.width;
    const mapH = level.height;
    const mapOffsetX = Math.max(0, Math.floor((renderer.cols - mapW) / 2));
    const mapOffsetY = Math.max(1, Math.floor((renderer.rows - mapH - 1) / 2) + 1);
    const title = `  Dungeon Level ${dlvl}  `;
    const titleX = Math.floor((renderer.cols - title.length) / 2);
    renderer.fill(0, 0, renderer.cols, 1, " ", "#aaddff", "#001833");
    renderer.print(Math.max(0, titleX), 0, title, "#aaddff", "#001833");
    const monSet = new Set(monsters.map((m) => `${m.x},${m.y}`));
    const itemSet = new Set(items.map((i) => `${i.x},${i.y}`));
    const px = Math.round(player.x - 0.5);
    const py = Math.round(player.y - 0.5);
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const sx = mapOffsetX + x;
        const sy = mapOffsetY + y;
        if (sx >= renderer.cols || sy >= renderer.rows) continue;
        const cell = level.get(x, y);
        if (!cell || !cell.explored) {
          renderer.put(sx, sy, " ", BG, BG);
          continue;
        }
        const dim = !cell.visible;
        let ch = " ", fg = BG, bg = "#000811";
        switch (cell.tile) {
          case 1 /* WALL */:
            ch = "\u2588";
            fg = dim ? "#333344" : COL_MINIMAP_WALL;
            bg = dim ? "#0a0a18" : "#111122";
            break;
          case 2 /* FLOOR */:
            ch = "\xB7";
            fg = dim ? "#1a3322" : COL_MINIMAP_FLOOR;
            bg = "#000811";
            break;
          case 3 /* CORRIDOR */:
            ch = "\xB7";
            fg = dim ? "#1a2a1a" : "#335533";
            bg = "#000811";
            break;
          case 4 /* DOOR_CLOSED */:
            ch = "+";
            fg = dim ? "#886600" : "#ddaa33";
            bg = "#000811";
            break;
          case 5 /* DOOR_OPEN */:
            ch = "/";
            fg = dim ? "#886600" : "#ddaa33";
            bg = "#000811";
            break;
          case 7 /* STAIRS_DOWN */:
            ch = ">";
            fg = COL_STAIRS;
            bg = "#000811";
            break;
          case 6 /* STAIRS_UP */:
            ch = "<";
            fg = COL_STAIRS;
            bg = "#000811";
            break;
          default:
            ch = " ";
            fg = BG;
            bg = BG;
            break;
        }
        if (x === px && y === py) {
          ch = playerArrow(player.angle);
          fg = COL_PLAYER;
          bg = "#001108";
        } else if (cell.visible && monSet.has(`${x},${y}`)) {
          ch = "!";
          fg = COL_MONSTER_EASY;
        } else if (cell.visible && itemSet.has(`${x},${y}`)) {
          ch = "*";
          fg = COL_ITEM;
        }
        renderer.put(sx, sy, ch, fg, bg);
      }
    }
  }
  function drawCharGen(renderer, step, cursor, roleKey, raceKey, alignment, charName, gender) {
    const BG = "#000c1a";
    const BG2 = "#001228";
    renderer.fill(0, 0, renderer.cols, renderer.rows, " ", WHITE, BG);
    const role = ROLE_DATA[roleKey];
    const race = RACE_DATA[raceKey];
    const roleKeys = Object.keys(ROLE_DATA);
    const raceKeys = Object.keys(RACE_DATA);
    const titles = {
      role: "CHOOSE YOUR ROLE",
      race: "CHOOSE YOUR RACE",
      alignment: "CHOOSE YOUR ALIGNMENT",
      confirm: "YOUR CHARACTER"
    };
    const title = `[ ${titles[step]} ]`;
    renderer.fill(0, 0, renderer.cols, 1, " ", YELLOW, "#001833");
    renderer.print(Math.floor((renderer.cols - title.length) / 2), 0, title, YELLOW, "#001833");
    const leftW = 26;
    const leftCol = Math.max(2, Math.floor(renderer.cols / 2) - leftW - 2);
    const rightCol = leftCol + leftW + 3;
    const rightW = Math.min(48, renderer.cols - rightCol - 2);
    let row = 3;
    if (step === "role") {
      for (let i = 0; i < roleKeys.length; i++) {
        const rk = roleKeys[i];
        const sel = i === cursor;
        const bg = sel ? "#003366" : BG;
        const fg = sel ? YELLOW : WHITE;
        const mark = sel ? ">" : " ";
        renderer.fill(leftCol, row + i, leftW, 1, " ", fg, bg);
        renderer.print(leftCol, row + i, `${mark} ${ROLE_DATA[rk].name}`, fg, bg);
      }
      renderer.print(leftCol, row + roleKeys.length + 1, "  [R] Random character", GRAY, BG);
    } else if (step === "race") {
      const roleAligns = new Set(role?.alignments ?? []);
      for (let i = 0; i < raceKeys.length; i++) {
        const rk = raceKeys[i];
        const rd = RACE_DATA[rk];
        const compat = rd.alignments.some((a) => roleAligns.has(a));
        const sel = i === cursor;
        const bg = sel ? "#003366" : BG;
        const fg = sel ? YELLOW : compat ? WHITE : GRAY;
        const mark = sel ? ">" : " ";
        renderer.fill(leftCol, row + i, leftW, 1, " ", fg, bg);
        renderer.print(leftCol, row + i, `${mark} ${rd.name}${compat ? "" : " (incompatible)"}`, fg, bg);
      }
      renderer.print(leftCol, row + raceKeys.length + 1, "  [R] Random", GRAY, BG);
    } else if (step === "alignment") {
      const roleAligns = new Set(role?.alignments ?? []);
      const raceAligns = new Set(race?.alignments ?? []);
      const validAligns = ["lawful", "neutral", "chaotic"].filter(
        (a) => roleAligns.has(a) && raceAligns.has(a)
      );
      for (let i = 0; i < validAligns.length; i++) {
        const a = validAligns[i];
        const sel = i === cursor;
        const bg = sel ? "#003366" : BG;
        const fg = sel ? YELLOW : WHITE;
        const mark = sel ? ">" : " ";
        renderer.fill(leftCol, row + i, leftW, 1, " ", fg, bg);
        const label = a.charAt(0).toUpperCase() + a.slice(1);
        renderer.print(leftCol, row + i, `${mark} ${label}`, fg, bg);
      }
      renderer.print(leftCol, row + validAligns.length + 1, "  [R] Random", GRAY, BG);
    } else if (step === "confirm") {
      renderer.fill(leftCol - 1, row - 1, leftW + 2, 14, " ", WHITE, BG2);
      renderer.print(leftCol, row, `Name:      ${charName}`, WHITE, BG2);
      renderer.print(leftCol, row + 1, `Role:      ${ROLE_DATA[roleKey]?.name ?? roleKey}`, YELLOW, BG2);
      renderer.print(leftCol, row + 2, `Race:      ${RACE_DATA[raceKey]?.name ?? raceKey}`, WHITE, BG2);
      renderer.print(leftCol, row + 3, `Alignment: ${alignment.charAt(0).toUpperCase() + alignment.slice(1)}`, WHITE, BG2);
      renderer.print(leftCol, row + 4, `Gender:    ${gender.charAt(0).toUpperCase() + gender.slice(1)}`, WHITE, BG2);
      if (role && race) {
        const s = role.baseStats.map((b, i) => Math.max(3, b + race.statMods[i]));
        renderer.print(leftCol, row + 6, `STR:${String(s[0]).padEnd(4)} INT:${String(s[1]).padEnd(4)} WIS:${s[2]}`, GREEN, BG2);
        renderer.print(leftCol, row + 7, `DEX:${String(s[3]).padEnd(4)} CON:${String(s[4]).padEnd(4)} CHA:${s[5]}`, GREEN, BG2);
        renderer.print(leftCol, row + 8, `HP:  ${role.hpStart}`, COL_HP_GOOD, BG2);
        renderer.print(leftCol, row + 9, `AC:  ${10 + (ARMOR_DATA[role.startArmor ?? ""]?.acBonus ?? 0)}`, WHITE, BG2);
        const wpn = role.startWeapon;
        renderer.print(leftCol, row + 11, `Starts with: ${wpn.replace(/_/g, " ")}${role.startArmor ? ", " + role.startArmor.replace(/_/g, " ") : ""}`, GRAY, BG2);
      }
      renderer.print(leftCol, row + 13, `[Enter] Begin Adventure`, YELLOW, BG2);
      renderer.print(leftCol, row + 14, `[Esc]   Back`, GRAY, BG2);
    }
    if (step !== "confirm") {
      renderer.fill(rightCol - 1, row - 1, rightW + 2, 16, " ", WHITE, BG2);
      let desc = "";
      let stats = [0, 0, 0, 0, 0, 0];
      let hpStart = 0;
      let aligns = [];
      let prevRole = "", prevRace = "";
      if (step === "role") {
        const rk = roleKeys[cursor] ?? roleKey;
        const rd = ROLE_DATA[rk];
        const rcD = RACE_DATA["human"];
        desc = rd?.description ?? "";
        stats = rd ? rd.baseStats.map((b, i) => Math.max(3, b + rcD.statMods[i])) : [];
        hpStart = rd?.hpStart ?? 0;
        aligns = rd?.alignments.map((a) => a.charAt(0).toUpperCase() + a.slice(1)) ?? [];
        prevRole = ROLE_DATA[rk]?.name ?? "";
      } else if (step === "race") {
        const rk = raceKeys[cursor] ?? raceKey;
        const rd = RACE_DATA[rk];
        const rl = ROLE_DATA[roleKey];
        desc = rd?.description ?? "";
        stats = rl && rd ? rl.baseStats.map((b, i) => Math.max(3, b + rd.statMods[i])) : [];
        hpStart = rl?.hpStart ?? 0;
        aligns = rd?.alignments.map((a) => a.charAt(0).toUpperCase() + a.slice(1)) ?? [];
        prevRole = ROLE_DATA[roleKey]?.name ?? "";
        prevRace = RACE_DATA[rk]?.name ?? "";
      } else if (step === "alignment") {
        const rl = ROLE_DATA[roleKey];
        const rc = RACE_DATA[raceKey];
        desc = `Choose ${charName}'s moral alignment. This affects how the dungeon denizens react to you and your interactions with altars.`;
        stats = rl && rc ? rl.baseStats.map((b, i) => Math.max(3, b + rc.statMods[i])) : [];
        hpStart = rl?.hpStart ?? 0;
        prevRole = ROLE_DATA[roleKey]?.name ?? "";
        prevRace = RACE_DATA[raceKey]?.name ?? "";
      }
      const words = desc.split(" ");
      let line = "";
      let dRow = row;
      for (const word of words) {
        if (line.length + word.length + 1 > rightW) {
          renderer.print(rightCol, dRow++, line, WHITE, BG2);
          line = word;
        } else {
          line = line ? line + " " + word : word;
        }
      }
      if (line) renderer.print(rightCol, dRow++, line, WHITE, BG2);
      dRow = row + 5;
      if (prevRole) renderer.print(rightCol, dRow++, `Role: ${prevRole}${prevRace ? "  Race: " + prevRace : ""}`, GRAY, BG2);
      if (stats.length === 6) {
        renderer.print(rightCol, dRow++, `STR:${String(stats[0]).padEnd(4)} INT:${String(stats[1]).padEnd(4)} WIS:${stats[2]}`, GREEN, BG2);
        renderer.print(rightCol, dRow++, `DEX:${String(stats[3]).padEnd(4)} CON:${String(stats[4]).padEnd(4)} CHA:${stats[5]}`, GREEN, BG2);
        if (hpStart) renderer.print(rightCol, dRow++, `Starting HP: ${hpStart}`, COL_HP_GOOD, BG2);
      }
      if (aligns.length) renderer.print(rightCol, dRow++, `Alignments: ${aligns.join(", ")}`, YELLOW, BG2);
    }
    const footRow = renderer.rows - 2;
    renderer.fill(0, footRow, renderer.cols, 1, " ", GRAY, "#001833");
    const footer = step === "confirm" ? "[Enter] Begin   [Esc] Back" : "[\u2191\u2193] Select   [Enter] Confirm   [R] Random character   [Esc] Back";
    renderer.print(Math.floor((renderer.cols - footer.length) / 2), footRow, footer, GRAY, "#001833");
  }
  function hasLOS2(level, x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;
    while (true) {
      if (cx === x1 && cy === y1) return true;
      const t = level.tile(cx, cy);
      if (t === 1 /* WALL */ || t === 0 /* VOID */) return false;
      if (t === 4 /* DOOR_CLOSED */ && !(cx === x0 && cy === y0)) return false;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  // src/main.ts
  function itemSprite(fi) {
    const item = fi.item;
    let symbol;
    let color = COL_ITEM;
    let kind;
    if (item.isAmuletOfYendor) {
      symbol = '"';
      color = "#ffee88";
      kind = "amulet";
    } else switch (item.type) {
      case 1 /* WEAPON */:
        symbol = ")";
        kind = "weapon";
        break;
      case 2 /* ARMOR */:
        symbol = "[";
        kind = "armor";
        break;
      case 3 /* FOOD */:
        symbol = "%";
        kind = "food";
        break;
      case 4 /* POTION */:
        symbol = "!";
        color = item.appearanceColor ?? COL_ITEM;
        kind = "potion";
        break;
      case 5 /* SCROLL */:
        symbol = "?";
        kind = "scroll";
        break;
      case 6 /* GOLD */:
        symbol = "$";
        color = COL_GOLD;
        kind = "gold";
        break;
      case 7 /* RING */:
        symbol = "=";
        color = COL_RING;
        kind = "ring";
        break;
      case 8 /* WAND */:
        symbol = "/";
        color = COL_WAND;
        kind = "wand";
        break;
      default:
        symbol = "*";
        kind = "unknown";
        break;
    }
    return { x: fi.x, y: fi.y, symbol, color, kind };
  }
  var canvas = document.getElementById("game");
  var uiCanvas = document.getElementById("ui");
  var overlay = document.getElementById("overlay");
  var gameRenderer = new CanvasRenderer(canvas, 5);
  var uiRenderer = new CanvasRenderer(
    uiCanvas,
    14,
    /* transparent= */
    true
  );
  var gs = new GameState();
  var cg = {
    step: "role",
    cursor: 0,
    roleKey: "barbarian",
    raceKey: "human",
    alignment: "",
    charName: "Aldric",
    gender: "male"
  };
  var keys = /* @__PURE__ */ new Set();
  var heldKeys = /* @__PURE__ */ new Map();
  var REPEAT_DELAY = 150;
  var REPEAT_RATE = 80;
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    keys.add(e.key);
    heldKeys.set(e.key, { key: e.key, firstFired: false, timer: 0, repeatTimer: 0 });
    handleKeyImmediate(e.key, e);
  });
  document.addEventListener("keyup", (e) => {
    keys.delete(e.key);
    heldKeys.delete(e.key);
  });
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function randomCharGen() {
    const roleKeys = Object.keys(ROLE_DATA);
    const roleKey = pickRandom(roleKeys);
    const role = ROLE_DATA[roleKey];
    const raceKeys = Object.keys(RACE_DATA).filter(
      (rk) => RACE_DATA[rk].alignments.some((a) => role.alignments.includes(a))
    );
    const raceKey = pickRandom(raceKeys);
    const race = RACE_DATA[raceKey];
    const aligns = role.alignments.filter((a) => race.alignments.includes(a));
    const alignment = pickRandom(aligns);
    const gender = Math.random() < 0.5 ? "male" : "female";
    const names = NAME_TABLES[raceKey]?.[gender] ?? NAME_TABLES["human"][gender];
    const charName = pickRandom(names);
    gs.initWithChar({ role: roleKey, race: raceKey, alignment, charName, gender });
    cg = { step: "role", cursor: 0, roleKey, raceKey, alignment, charName, gender };
  }
  function advanceCharGen() {
    const roleKeys = Object.keys(ROLE_DATA);
    const raceKeys = Object.keys(RACE_DATA);
    if (cg.step === "role") {
      cg.roleKey = roleKeys[cg.cursor] ?? cg.roleKey;
      const newRole = ROLE_DATA[cg.roleKey];
      if (!RACE_DATA[cg.raceKey]?.alignments.some((a) => newRole.alignments.includes(a))) {
        cg.raceKey = "human";
      }
      cg.step = "race";
      cg.cursor = raceKeys.indexOf(cg.raceKey);
    } else if (cg.step === "race") {
      const rk = raceKeys[cg.cursor];
      if (rk && RACE_DATA[rk].alignments.some((a) => ROLE_DATA[cg.roleKey].alignments.includes(a))) {
        cg.raceKey = rk;
      }
      const roleAligns = new Set(ROLE_DATA[cg.roleKey].alignments);
      const raceAligns = new Set(RACE_DATA[cg.raceKey].alignments);
      const validAligns = ["lawful", "neutral", "chaotic"].filter((a) => roleAligns.has(a) && raceAligns.has(a));
      cg.step = "alignment";
      cg.cursor = cg.alignment ? validAligns.indexOf(cg.alignment) : 0;
      if (cg.cursor < 0) cg.cursor = 0;
    } else if (cg.step === "alignment") {
      const roleAligns = new Set(ROLE_DATA[cg.roleKey].alignments);
      const raceAligns = new Set(RACE_DATA[cg.raceKey].alignments);
      const validAligns = ["lawful", "neutral", "chaotic"].filter((a) => roleAligns.has(a) && raceAligns.has(a));
      cg.alignment = validAligns[cg.cursor] ?? validAligns[0];
      const names = NAME_TABLES[cg.raceKey]?.[cg.gender] ?? NAME_TABLES["human"][cg.gender];
      cg.charName = pickRandom(names);
      cg.step = "confirm";
      cg.cursor = 0;
    } else if (cg.step === "confirm") {
      gs.initWithChar({
        role: cg.roleKey,
        race: cg.raceKey,
        alignment: cg.alignment,
        charName: cg.charName,
        gender: cg.gender
      });
    }
  }
  function maxCursorForStep(step) {
    if (step === "role") return Object.keys(ROLE_DATA).length - 1;
    if (step === "race") return Object.keys(RACE_DATA).length - 1;
    if (step === "alignment") {
      const roleAligns = new Set(ROLE_DATA[cg.roleKey]?.alignments ?? []);
      const raceAligns = new Set(RACE_DATA[cg.raceKey]?.alignments ?? []);
      return ["lawful", "neutral", "chaotic"].filter((a) => roleAligns.has(a) && raceAligns.has(a)).length - 1;
    }
    return 0;
  }
  function handleKeyImmediate(key, e) {
    if (gs.phase === "title") {
      if (key === "Enter" || key === " ") {
        cg = { step: "role", cursor: 0, roleKey: "barbarian", raceKey: "human", alignment: "", charName: "Aldric", gender: "male" };
        gs.init();
      }
      return;
    }
    if (gs.phase === "chargen") {
      switch (key) {
        case "ArrowUp":
          cg.cursor = Math.max(0, cg.cursor - 1);
          break;
        case "ArrowDown":
          cg.cursor = Math.min(maxCursorForStep(cg.step), cg.cursor + 1);
          break;
        case "Enter":
          advanceCharGen();
          break;
        case "r":
        case "R":
          randomCharGen();
          break;
        case "Escape":
          if (cg.step === "role") {
            gs.phase = "title";
          } else if (cg.step === "race") {
            cg.step = "role";
            cg.cursor = Object.keys(ROLE_DATA).indexOf(cg.roleKey);
          } else if (cg.step === "alignment") {
            cg.step = "race";
            cg.cursor = Object.keys(RACE_DATA).indexOf(cg.raceKey);
          } else if (cg.step === "confirm") {
            cg.step = "alignment";
            cg.cursor = 0;
          }
          break;
      }
      e.preventDefault();
      return;
    }
    if (gs.phase === "dead" || gs.phase === "won") {
      if (key === "Enter" || key === " ") {
        gs.init();
      }
      if (key === "Q" || key === "q") {
      }
      return;
    }
    if (gs.phase === "inventory") {
      handleInventoryKey(key);
      e.preventDefault();
      return;
    }
    if (gs.phase === "help") {
      if (key === "Escape" || key === "?") gs.phase = "playing";
      e.preventDefault();
      return;
    }
    if (gs.phase === "map") {
      if (key === "Escape" || key === "m") gs.phase = "playing";
      e.preventDefault();
      return;
    }
    switch (key) {
      case "Escape":
        if (pointerLocked) document.exitPointerLock();
        break;
      case "i":
        gs.phase = "inventory";
        invIdx = 0;
        break;
      case "m":
        gs.phase = "map";
        break;
      case "?":
        gs.phase = "help";
        break;
      case ",":
        gs.tryPickup();
        break;
      case ".":
      case " ":
        gs.processTurn();
        break;
      case "v":
      case "V":
        pitchInvert = !pitchInvert;
        break;
      case ">":
        gs.tryDescend();
        break;
      case "<":
        gs.tryAscend();
        break;
      case "z": {
        const wand = gs.player.inventory.find((i) => i.type === 8 /* WAND */);
        if (wand) {
          const zapMsgs = [];
          gs.zapWand(wand, zapMsgs);
          for (const m of zapMsgs) gs.addMsg(m);
          if (zapMsgs.length) gs.processTurn();
        } else {
          gs.addMsg("You have no wand to zap.");
        }
        break;
      }
      case "Q":
        if (confirm("Really quit?")) {
          gs.phase = "dead";
        }
        break;
    }
    if (["i", "m", "?", ",", ".", " ", "<", ">", "z"].includes(key)) e.preventDefault();
  }
  var invIdx = 0;
  function handleInventoryKey(key) {
    const inv = gs.player.inventory;
    switch (key) {
      case "Escape":
        gs.phase = "playing";
        break;
      case "i":
        gs.phase = "playing";
        break;
      case "ArrowUp":
        invIdx = Math.max(0, invIdx - 1);
        break;
      case "ArrowDown":
        invIdx = Math.min(inv.length - 1, invIdx + 1);
        break;
      case "Enter": {
        const item = inv[invIdx];
        if (item) {
          gs.useItem(item);
          gs.phase = "playing";
        }
        break;
      }
      case "d": {
        const item = inv[invIdx];
        if (item) {
          gs.dropItem(item);
          invIdx = Math.max(0, Math.min(invIdx, inv.length - 1));
          gs.phase = "playing";
        }
        break;
      }
    }
  }
  var pointerLocked = false;
  var pitchRows = 0;
  var pitchInvert = false;
  function acquirePointerLock() {
    canvas.requestPointerLock();
    const kb = navigator.keyboard;
    if (kb?.lock) kb.lock(["Escape"]).catch(() => {
    });
  }
  canvas.addEventListener("click", () => {
    if (!pointerLocked) acquirePointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    pointerLocked = document.pointerLockElement === canvas;
    if (pointerLocked) {
      overlay.classList.add("hidden");
    } else {
      navigator.keyboard?.unlock?.();
      overlay.classList.remove("hidden");
    }
  });
  document.addEventListener("mousemove", (e) => {
    if (!pointerLocked || gs.phase !== "playing") return;
    gs.player.angle += e.movementX * MOUSE_YAW_SENS;
    pitchRows += e.movementY * MOUSE_PITCH_SENS * (pitchInvert ? -1 : 1);
  });
  function resize() {
    const w = Math.round(window.innerWidth * 0.8);
    const h = Math.round(window.innerHeight * 0.8);
    gameRenderer.resize(w, h);
    uiRenderer.resize(w, h);
  }
  window.addEventListener("resize", resize);
  resize();
  var lastTime = 0;
  function frame(time) {
    const dt = time - lastTime;
    lastTime = time;
    processHeldKeys(dt);
    if (gs.phase === "playing") {
      const viewH = uiRenderer.rows - MSG_ROWS - STATUS_ROWS;
      const maxPitch = Math.floor(viewH * MAX_PITCH_FRAC);
      pitchRows = Math.max(-maxPitch, Math.min(maxPitch, pitchRows));
      gs.player.pitch = Math.round(pitchRows);
      gs.player.bobAmplitude = Math.max(0, gs.player.bobAmplitude - dt * 4e-3);
      updateExplored(gs.currentLevel, gs.player);
    }
    render();
    requestAnimationFrame(frame);
  }
  function processHeldKeys(dt) {
    if (gs.phase !== "playing") return;
    for (const [key, state] of heldKeys) {
      if (key === "ArrowLeft" || key === "q") {
        gs.player.angle -= ROTATE_SPEED;
        continue;
      }
      if (key === "ArrowRight" || key === "e") {
        gs.player.angle += ROTATE_SPEED;
        continue;
      }
      let isMove = false;
      let forward = 0, strafe = 0;
      switch (key) {
        case "w":
        case "k":
          forward = 1;
          isMove = true;
          break;
        case "s":
        case "j":
          forward = -1;
          isMove = true;
          break;
        case "a":
        case "h":
          strafe = -1;
          isMove = true;
          break;
        case "d":
        case "l":
          strafe = 1;
          isMove = true;
          break;
      }
      if (!isMove) continue;
      if (!state.firstFired) {
        state.firstFired = true;
        state.timer = 0;
        continue;
      }
      state.timer += dt;
      if (state.timer >= REPEAT_DELAY + state.repeatTimer * REPEAT_RATE) {
        state.repeatTimer++;
        gs.tryMove(forward, strafe);
      }
    }
  }
  function render() {
    gameRenderer.clear();
    uiRenderer.clear();
    switch (gs.phase) {
      case "title":
        drawTitle(uiRenderer);
        break;
      case "chargen":
        drawCharGen(uiRenderer, cg.step, cg.cursor, cg.roleKey, cg.raceKey, cg.alignment, cg.charName, cg.gender);
        break;
      case "dead":
        drawDeath(uiRenderer, gs);
        break;
      case "won":
        drawWin(uiRenderer, gs);
        break;
      case "map":
        drawFullMap(
          uiRenderer,
          gs.currentLevel,
          gs.dlvl,
          gs.player,
          gs.currentMonsters,
          gs.currentItems
        );
        break;
      case "playing":
      case "inventory":
      case "help": {
        renderView(
          gameRenderer,
          gs.player,
          gs.currentLevel,
          gs.currentMonsters,
          gs.currentItems.map(itemSprite),
          0,
          0,
          gameRenderer.cols,
          gameRenderer.rows
        );
        const uiViewY = MSG_ROWS;
        const uiViewH = uiRenderer.rows - MSG_ROWS - STATUS_ROWS;
        drawMinimap(
          uiRenderer,
          gs.currentLevel,
          gs.player,
          gs.currentMonsters,
          gs.currentItems,
          uiViewY,
          uiViewH
        );
        drawMessages(uiRenderer, gs.messages, gs.turns - gs.lastMsgTurn);
        drawStatus(uiRenderer, gs);
        if (gs.phase === "inventory") drawInventory(uiRenderer, gs.player, invIdx);
        if (gs.phase === "help") drawHelp(uiRenderer, pitchInvert);
        break;
      }
    }
    gameRenderer.flush();
    uiRenderer.flush();
  }
  document.addEventListener("keydown", (e) => {
    if (gs.phase !== "playing" && gs.phase !== "help" || e.repeat) return;
    if (gs.phase === "help") return;
    let forward = 0, strafe = 0;
    switch (e.key) {
      case "w":
      case "k":
        forward = 1;
        break;
      case "s":
      case "j":
        forward = -1;
        break;
      case "a":
      case "h":
        strafe = -1;
        break;
      case "d":
      case "l":
        strafe = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    gs.tryMove(forward, strafe);
  });
  requestAnimationFrame(frame);
})();
//# sourceMappingURL=bundle.js.map
