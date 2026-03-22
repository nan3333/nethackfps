// ── Tile types ────────────────────────────────────────────────────────────────
export enum Tile {
  VOID = 0, WALL = 1, FLOOR = 2, CORRIDOR = 3,
  DOOR_CLOSED = 4, DOOR_OPEN = 5, STAIRS_UP = 6, STAIRS_DOWN = 7,
}

export const SOLID_TILES    = new Set([Tile.VOID, Tile.WALL, Tile.DOOR_CLOSED]);
export const OPAQUE_TILES   = new Set([Tile.VOID, Tile.WALL, Tile.DOOR_CLOSED]);
export const PASSABLE_TILES = new Set([Tile.FLOOR, Tile.CORRIDOR, Tile.DOOR_OPEN,
                                       Tile.STAIRS_UP, Tile.STAIRS_DOWN]);

// ── Hunger ────────────────────────────────────────────────────────────────────
export enum HungerState { SATIATED = 0, NOT_HUNGRY, HUNGRY, WEAK, FAINTING, STARVED }
export const HUNGER_THRESHOLDS: Record<HungerState, number> = {
  [HungerState.SATIATED]:   1000,
  [HungerState.NOT_HUNGRY]:  150,
  [HungerState.HUNGRY]:       50,
  [HungerState.WEAK]:          1,
  [HungerState.FAINTING]:      0,
  [HungerState.STARVED]:      -1,
};

// ── Item types ────────────────────────────────────────────────────────────────
export enum ItemType { WEAPON = 1, ARMOR, FOOD, POTION, SCROLL, GOLD, RING = 7, WAND = 8 }

// ── Raycaster ─────────────────────────────────────────────────────────────────
export const FOV          = Math.PI * 66 / 180;   // 66° horizontal
export const MAX_RAY_DEPTH = 20.0;
export const WIN_LEVEL     = 8;

// ── Input speeds ──────────────────────────────────────────────────────────────
export const ROTATE_SPEED     = 0.04;   // rad/frame (keyboard)
export const MOUSE_YAW_SENS   = 0.0025; // rad/pixel
export const MOUSE_PITCH_SENS = 0.15;   // rows/pixel
export const MAX_PITCH_FRAC   = 0.18;   // fraction of viewH for max pitch

// ── Enhanced character palettes ───────────────────────────────────────────────

// Wall body: shade level 0 (nearest) → 4 (farthest)
export const WALL_BODY   = ['█', '▓', '▒', '░', '·'] as const;
// Mortar/joint row (every N rows creates a horizontal band)
export const WALL_MORTAR = ['▓', '▒', '░', '⋅', ' '] as const;
// Half-block caps at top/bottom of strip (only when strip tall enough)
export const WALL_CAP_TOP = '▀';
export const WALL_CAP_BOT = '▄';

// Corridor walls slightly different texture
export const CORR_BODY   = ['▓', '▒', '░', '·', ' '] as const;

// Door chars by shade level
export const DOOR_BODY = ['╬', '╫', '║', '│', '¦'] as const;
export const DOOR_FRAME_H = '═';
export const DOOR_FRAME_V = '║';

// Stairs
export const STAIR_DOWN_CHARS = ['▼', '▽', '⌄', 'v', '.'] as const;
export const STAIR_UP_CHARS   = ['▲', '△', '⌃', '^', '.'] as const;

// Floor: near → far  (rendered below horizon)
export const FLOOR_CHARS = ['▓', '▒', '░', '·', '⋅', ' '] as const;
export const FLOOR_DISTS = [1.0, 2.5, 5.0, 9.0, 14.0];   // distance thresholds

// Ceiling: near → far  (rendered above horizon)
export const CEIL_CHARS = ['▒', '░', '·', '⋅', ' '] as const;
export const CEIL_DISTS = [2.0, 5.0, 9.0, 14.0];

// Wall shade distance thresholds → maps dist to shade index 0-4
export const SHADE_DISTS = [3.0, 6.0, 10.0, 15.0];

// ── Colors (full RGB strings) ─────────────────────────────────────────────────
export const COL_WALL_CLOSE_X   = '#d0a060';   // warm amber — direct torch-lit face
export const COL_WALL_CLOSE_Y   = '#9a7040';   // cooler amber — shadow face
export const COL_STATUS_BG      = '#001833';
export const COL_MSG            = '#ffee88';
export const COL_PLAYER         = '#44ff88';
export const COL_MONSTER_EASY   = '#cc2222';
export const COL_MONSTER_TOUGH  = '#ff4444';
export const COL_ITEM           = '#44ffff';
export const COL_DOOR           = '#ddaa33';
export const COL_STAIRS         = '#44ffcc';
export const COL_GOLD           = '#ffdd22';
export const COL_MINIMAP_WALL   = '#666677';
export const COL_MINIMAP_FLOOR  = '#44aa66';
export const COL_HP_GOOD        = '#44ff88';
export const COL_HP_LOW         = '#ff4444';
export const COL_XP             = '#aaddff';
export const COL_RING           = '#ff88ff';
export const COL_WAND           = '#88ffff';
