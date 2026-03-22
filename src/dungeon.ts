import { Tile, SOLID_TILES, PASSABLE_TILES } from './constants';

export interface Room { x: number; y: number; w: number; h: number; }

export interface Cell { tile: Tile; explored: boolean; visible: boolean; }

export class DungeonLevel {
  readonly width  = 80;
  readonly height = 40;
  grid: Cell[][];
  rooms: Room[] = [];
  stairsUp:   [number, number] | null = null;
  stairsDown: [number, number] | null = null;

  constructor() {
    this.grid = Array.from({ length: this.height }, () =>
      Array.from({ length: this.width }, () => ({ tile: Tile.VOID, explored: false, visible: false }))
    );
  }

  get(x: number, y: number): Cell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.grid[y][x];
  }

  tile(x: number, y: number): Tile {
    return this.get(x, y)?.tile ?? Tile.VOID;
  }

  isPassable(x: number, y: number): boolean {
    return PASSABLE_TILES.has(this.tile(x, y));
  }

  isSolid(x: number, y: number): boolean {
    return SOLID_TILES.has(this.tile(x, y));
  }
}

// ── BSP node ──────────────────────────────────────────────────────────────────
class BSPNode {
  left:  BSPNode | null = null;
  right: BSPNode | null = null;
  room:  Room | null = null;

  constructor(
    public x: number, public y: number,
    public w: number, public h: number
  ) {}

  isLeaf(): boolean { return this.left === null && this.right === null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function carveRect(level: DungeonLevel, x: number, y: number, w: number, h: number, tile: Tile): void {
  for (let row = y; row < y + h; row++)
    for (let col = x; col < x + w; col++)
      if (row >= 0 && row < level.height && col >= 0 && col < level.width)
        level.grid[row][col].tile = tile;
}

// ── BSP splitting ─────────────────────────────────────────────────────────────
const MIN_LEAF = 10;

function split(node: BSPNode, depth: number): void {
  if (depth === 0 || (node.w < MIN_LEAF * 2 && node.h < MIN_LEAF * 2)) return;

  const canH = node.h >= MIN_LEAF * 2;
  const canV = node.w >= MIN_LEAF * 2;
  const splitH = canH && (!canV || Math.random() < 0.5);

  if (splitH) {
    const cut = randInt(MIN_LEAF, node.h - MIN_LEAF);
    node.left  = new BSPNode(node.x, node.y, node.w, cut);
    node.right = new BSPNode(node.x, node.y + cut, node.w, node.h - cut);
  } else {
    const cut = randInt(MIN_LEAF, node.w - MIN_LEAF);
    node.left  = new BSPNode(node.x, node.y, cut, node.h);
    node.right = new BSPNode(node.x + cut, node.y, node.w - cut, node.h);
  }

  split(node.left!,  depth - 1);
  split(node.right!, depth - 1);
}

// ── Room placement ────────────────────────────────────────────────────────────
function placeRooms(node: BSPNode, level: DungeonLevel): void {
  if (node.isLeaf()) {
    const rw = randInt(5, Math.min(node.w - 2, 14));
    const rh = randInt(4, Math.min(node.h - 2, 10));
    const rx = node.x + randInt(1, node.w - rw - 1);
    const ry = node.y + randInt(1, node.h - rh - 1);
    const room: Room = { x: rx, y: ry, w: rw, h: rh };
    node.room = room;
    level.rooms.push(room);
    carveRect(level, rx, ry, rw, rh, Tile.FLOOR);
  } else {
    if (node.left)  placeRooms(node.left,  level);
    if (node.right) placeRooms(node.right, level);
  }
}

// ── Corridor carving ──────────────────────────────────────────────────────────
function roomCenter(r: Room): [number, number] {
  return [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
}

function carveCorridor(level: DungeonLevel, x1: number, y1: number, x2: number, y2: number): void {
  let cx = x1, cy = y1;
  // L-shaped: horizontal then vertical (or vice-versa, chosen randomly)
  if (Math.random() < 0.5) {
    while (cx !== x2) {
      const t = level.tile(cx, cy);
      if (t === Tile.VOID) level.grid[cy][cx].tile = Tile.CORRIDOR;
      cx += cx < x2 ? 1 : -1;
    }
    while (cy !== y2) {
      const t = level.tile(cx, cy);
      if (t === Tile.VOID) level.grid[cy][cx].tile = Tile.CORRIDOR;
      cy += cy < y2 ? 1 : -1;
    }
  } else {
    while (cy !== y2) {
      const t = level.tile(cx, cy);
      if (t === Tile.VOID) level.grid[cy][cx].tile = Tile.CORRIDOR;
      cy += cy < y2 ? 1 : -1;
    }
    while (cx !== x2) {
      const t = level.tile(cx, cy);
      if (t === Tile.VOID) level.grid[cy][cx].tile = Tile.CORRIDOR;
      cx += cx < x2 ? 1 : -1;
    }
  }
}

// Connect sibling subtrees
function connectBSP(node: BSPNode, level: DungeonLevel): void {
  if (node.isLeaf()) return;
  connectBSP(node.left!,  level);
  connectBSP(node.right!, level);

  const lRoom = findRoom(node.left!);
  const rRoom = findRoom(node.right!);
  if (lRoom && rRoom) {
    const [x1, y1] = roomCenter(lRoom);
    const [x2, y2] = roomCenter(rRoom);
    carveCorridor(level, x1, y1, x2, y2);
  }
}

function findRoom(node: BSPNode): Room | null {
  if (node.room) return node.room;
  if (node.left)  { const r = findRoom(node.left);  if (r) return r; }
  if (node.right) { const r = findRoom(node.right); if (r) return r; }
  return null;
}

// ── Door placement ────────────────────────────────────────────────────────────
function placeDoors(level: DungeonLevel): void {
  const { width: W, height: H } = level;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (level.tile(x, y) !== Tile.CORRIDOR) continue;
      const adjFloor =
        (level.tile(x - 1, y) === Tile.FLOOR ? 1 : 0) +
        (level.tile(x + 1, y) === Tile.FLOOR ? 1 : 0) +
        (level.tile(x, y - 1) === Tile.FLOOR ? 1 : 0) +
        (level.tile(x, y + 1) === Tile.FLOOR ? 1 : 0);
      if (adjFloor >= 1 && Math.random() < 0.6) {
        level.grid[y][x].tile = Tile.DOOR_CLOSED;
      }
    }
  }
}

// ── Stairs ────────────────────────────────────────────────────────────────────
function placeStairs(level: DungeonLevel, hasUp: boolean, hasDown: boolean): void {
  const rooms = [...level.rooms];
  if (rooms.length === 0) return;

  if (hasUp) {
    const r = rooms[0];
    const [cx, cy] = roomCenter(r);
    level.grid[cy][cx].tile = Tile.STAIRS_UP;
    level.stairsUp = [cx, cy];
  }
  if (hasDown && rooms.length > 1) {
    const r = rooms[rooms.length - 1];
    const [cx, cy] = roomCenter(r);
    level.grid[cy][cx].tile = Tile.STAIRS_DOWN;
    level.stairsDown = [cx, cy];
  } else if (hasDown) {
    const r = rooms[0];
    const px = clamp(r.x + r.w - 2, 0, level.width - 1);
    const py = clamp(r.y + r.h - 2, 0, level.height - 1);
    level.grid[py][px].tile = Tile.STAIRS_DOWN;
    level.stairsDown = [px, py];
  }
}

// ── Vault placement (BSP levels) ──────────────────────────────────────────────
function addVault(level: DungeonLevel): [number, number] | null {
  // Try 20 times to find a wall tile adjacent to a corridor
  for (let attempts = 0; attempts < 20; attempts++) {
    const x = 2 + Math.floor(Math.random() * (level.width  - 6));
    const y = 2 + Math.floor(Math.random() * (level.height - 6));

    // Check if location is wall and adjacent to corridor
    if (level.grid[y][x].tile !== Tile.WALL) continue;
    let adjCorridor = false;
    for (const [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]] as [number,number][]) {
      const t = level.grid[y+dy]?.[x+dx]?.tile;
      if (t === Tile.CORRIDOR || t === Tile.FLOOR) { adjCorridor = true; break; }
    }
    if (!adjCorridor) continue;

    // Check 3x3 area is all wall (so vault has room)
    let clear = true;
    for (let dy = 0; dy <= 2 && clear; dy++)
      for (let dx = 0; dx <= 2 && clear; dx++)
        if (level.grid[y+dy]?.[x+dx]?.tile !== Tile.WALL) clear = false;
    if (!clear) continue;

    // Carve 2x2 vault
    for (let dy = 0; dy <= 1; dy++)
      for (let dx = 0; dx <= 1; dx++)
        level.grid[y+dy][x+dx] = { tile: Tile.FLOOR, explored: false, visible: false };

    // Connect vault to adjacent corridor/floor with a single tile
    for (const [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0]] as [number,number][]) {
      const nx = x + dx * 2, ny = y + dy * 2; // check 2 steps away
      const t = level.grid[ny]?.[nx]?.tile;
      if (t === Tile.CORRIDOR || t === Tile.FLOOR) {
        level.grid[y+dy][x+dx] = { tile: Tile.CORRIDOR, explored: false, visible: false };
        break;
      }
    }

    return [x, y]; // return vault origin
  }
  return null;
}

// ── Maze generator ────────────────────────────────────────────────────────────
function generateMaze(width: number, height: number): DungeonLevel {
  const level = new DungeonLevel();

  // Fill everything with walls
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      level.grid[y][x] = { tile: Tile.WALL, explored: false, visible: false };

  // Iterative DFS on odd-coordinate grid (maze cells at even x,y positions)
  // The maze grid is (width/2) x (height/2) cells
  // Each maze cell (cx, cy) maps to map position (cx*2+1, cy*2+1)
  const mw = Math.floor((width  - 1) / 2);
  const mh = Math.floor((height - 1) / 2);
  const visited = new Uint8Array(mw * mh);

  const stack: [number, number][] = [];
  const startCx = Math.floor(Math.random() * mw);
  const startCy = Math.floor(Math.random() * mh);
  stack.push([startCx, startCy]);
  visited[startCy * mw + startCx] = 1;

  const dirs = [[0,-1],[1,0],[0,1],[-1,0]];

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];

    // Carve current maze cell to floor
    const mx = cx * 2 + 1;
    const my = cy * 2 + 1;
    level.grid[my][mx] = { tile: Tile.FLOOR, explored: false, visible: false };

    // Find unvisited neighbors
    const neighbors: [number, number, number, number][] = []; // [ncx, ncy, wallX, wallY]
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
      // Carve the wall between current and neighbor
      level.grid[wallY][wallX] = { tile: Tile.FLOOR, explored: false, visible: false };
      stack.push([ncx, ncy]);
    }
  }

  // 20% dead-end removal: cells with only 1 floor neighbor get connected to a random neighbor
  for (let cy = 0; cy < mh; cy++) {
    for (let cx = 0; cx < mw; cx++) {
      if (Math.random() > 0.20) continue;
      const mx = cx * 2 + 1, my = cy * 2 + 1;
      // Count floor neighbors of the wall cells
      const wallOptions: [number, number][] = [];
      for (const [dx, dy] of dirs) {
        const wx = mx + dx, wy = my + dy;
        if (wx < 0 || wx >= width || wy < 0 || wy >= height) continue;
        if (level.grid[wy][wx].tile === Tile.WALL) wallOptions.push([wx, wy]);
      }
      if (wallOptions.length > 0) {
        const [wx, wy] = wallOptions[Math.floor(Math.random() * wallOptions.length)];
        level.grid[wy][wx] = { tile: Tile.FLOOR, explored: false, visible: false };
      }
    }
  }

  // Place stairs: find two floor tiles far apart
  const floorTiles: [number,number][] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (level.grid[y][x].tile === Tile.FLOOR) floorTiles.push([x, y]);

  if (floorTiles.length >= 2) {
    // stairsUp near start, stairsDown far from start
    const up = floorTiles[Math.floor(Math.random() * Math.min(10, floorTiles.length))];
    let downIdx = 0, bestDist = 0;
    for (let i = 0; i < floorTiles.length; i++) {
      const d = Math.abs(floorTiles[i][0] - up[0]) + Math.abs(floorTiles[i][1] - up[1]);
      if (d > bestDist) { bestDist = d; downIdx = i; }
    }
    const down = floorTiles[downIdx];
    level.grid[up[1]][up[0]]     = { tile: Tile.STAIRS_UP,   explored: false, visible: false };
    level.grid[down[1]][down[0]] = { tile: Tile.STAIRS_DOWN, explored: false, visible: false };
    level.stairsUp   = [up[0],   up[1]];
    level.stairsDown = [down[0], down[1]];
  }

  // No rooms in maze level
  level.rooms = [];

  return level;
}

// ── Cave generator (cellular automaton) ──────────────────────────────────────
function generateCave(width: number, height: number): DungeonLevel {
  const level = new DungeonLevel();

  // Initialize with 45% floor fill
  const grid = new Uint8Array(width * height); // 1 = floor, 0 = wall
  for (let i = 0; i < grid.length; i++)
    grid[i] = Math.random() < 0.45 ? 1 : 0;

  // Force border walls
  for (let x = 0; x < width;  x++) { grid[0 * width + x] = 0; grid[(height-1) * width + x] = 0; }
  for (let y = 0; y < height; y++) { grid[y * width + 0] = 0; grid[y * width + width-1] = 0; }

  function countNeighbors(x: number, y: number): number {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) { n++; continue; } // border counts as wall
        n += grid[ny * width + nx];
      }
    return n;
  }

  function caPass(birthMin: number, birthMax: number, surviveMin: number): void {
    const next = new Uint8Array(grid.length);
    for (let y = 1; y < height-1; y++) {
      for (let x = 1; x < width-1; x++) {
        const n = countNeighbors(x, y);
        const cur = grid[y * width + x];
        if (cur === 0) next[y * width + x] = (n >= birthMin && n <= birthMax) ? 1 : 0;
        else           next[y * width + x] = n >= surviveMin ? 1 : 0;
      }
    }
    grid.set(next);
    // Keep borders as wall
    for (let x = 0; x < width;  x++) { grid[0 * width + x] = 0; grid[(height-1) * width + x] = 0; }
    for (let y = 0; y < height; y++) { grid[y * width + 0] = 0; grid[y * width + width-1] = 0; }
  }

  caPass(5, 8, 4);   // pass 1
  caPass(5, 8, 4);   // pass 2
  caPass(5, 8, 3);   // pass 3
  caPass(5, 8, 3);   // pass 4

  // Apply to level grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isFloor = grid[y * width + x] === 1;
      level.grid[y][x] = { tile: isFloor ? Tile.FLOOR : Tile.WALL, explored: false, visible: false };
    }
  }

  // Flood fill to find largest connected region
  const floodVisited = new Uint8Array(width * height);
  let bestStart: [number,number] = [0,0], bestSize = 0;

  for (let sy = 0; sy < height; sy++) {
    for (let sx = 0; sx < width; sx++) {
      if (grid[sy * width + sx] !== 1 || floodVisited[sy * width + sx]) continue;
      // BFS
      const q: [number,number][] = [[sx,sy]];
      floodVisited[sy * width + sx] = 1;
      const region: [number,number][] = [];
      let head = 0;
      while (head < q.length) {
        const [cx, cy] = q[head++];
        region.push([cx, cy]);
        for (const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]] as [number,number][]) {
          const nx = cx+dx, ny = cy+dy;
          if (nx<0||nx>=width||ny<0||ny>=height) continue;
          if (grid[ny*width+nx] !== 1 || floodVisited[ny*width+nx]) continue;
          floodVisited[ny*width+nx] = 1;
          q.push([nx,ny]);
        }
      }
      if (region.length > bestSize) { bestSize = region.length; bestStart = [sx,sy]; }
    }
  }

  // Fill non-largest regions with wall
  const mainVisited = new Uint8Array(width * height);
  const bfsQ: [number,number][] = [bestStart];
  mainVisited[bestStart[1] * width + bestStart[0]] = 1;
  let bfsHead = 0;
  while (bfsHead < bfsQ.length) {
    const [cx,cy] = bfsQ[bfsHead++];
    for (const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]] as [number,number][]) {
      const nx = cx+dx, ny = cy+dy;
      if (nx<0||nx>=width||ny<0||ny>=height) continue;
      if (grid[ny*width+nx] !== 1 || mainVisited[ny*width+nx]) continue;
      mainVisited[ny*width+nx] = 1;
      bfsQ.push([nx,ny]);
    }
  }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (grid[y*width+x] === 1 && !mainVisited[y*width+x])
        level.grid[y][x] = { tile: Tile.WALL, explored: false, visible: false };

  // Collect all floor tiles in main region
  const floors: [number,number][] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (level.grid[y][x].tile === Tile.FLOOR) floors.push([x,y]);

  if (floors.length >= 2) {
    const up = floors[Math.floor(Math.random() * Math.floor(floors.length * 0.1))];
    let downIdx = 0, bestDist = 0;
    for (let i = 0; i < floors.length; i++) {
      const d = Math.abs(floors[i][0]-up[0]) + Math.abs(floors[i][1]-up[1]);
      if (d > bestDist) { bestDist = d; downIdx = i; }
    }
    const dn = floors[downIdx];
    level.grid[up[1]][up[0]] = { tile: Tile.STAIRS_UP,   explored: false, visible: false };
    level.grid[dn[1]][dn[0]] = { tile: Tile.STAIRS_DOWN, explored: false, visible: false };
    level.stairsUp   = [up[0], up[1]];
    level.stairsDown = [dn[0], dn[1]];
  }

  level.rooms = [];
  return level;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function generateLevel(dlvl: number, hasUp: boolean, hasDown: boolean): DungeonLevel {
  const lvl = new DungeonLevel();

  // Every 5th level: cave (cellular automaton)
  if (dlvl % 5 === 0) {
    return generateCave(lvl.width, lvl.height);
  }

  // Every 3rd level (but not also 5th): maze
  if (dlvl % 3 === 0) {
    return generateMaze(lvl.width, lvl.height);
  }

  // Default: BSP room-based level
  const level = new DungeonLevel();
  const root = new BSPNode(0, 0, level.width, level.height);
  split(root, 4);
  placeRooms(root, level);
  connectBSP(root, level);
  placeDoors(level);
  placeStairs(level, hasUp, hasDown);

  // 30% chance to add a vault
  if (Math.random() < 0.30) {
    addVault(level);
  }

  return level;
}

// ── Dungeon (multi-level container) ───────────────────────────────────────────
export class Dungeon {
  private levels = new Map<number, DungeonLevel>();
  readonly maxLevel: number;

  constructor(maxLevel: number) { this.maxLevel = maxLevel; }

  getLevel(dlvl: number): DungeonLevel {
    if (!this.levels.has(dlvl)) {
      this.levels.set(dlvl, generateLevel(
        dlvl,
        dlvl > 1,
        dlvl < this.maxLevel,
      ));
    }
    return this.levels.get(dlvl)!;
  }
}
