import { Tile, OPAQUE_TILES, FOV, MAX_RAY_DEPTH, COL_WALL_CLOSE_X, COL_WALL_CLOSE_Y, COL_DOOR, COL_STAIRS } from './constants';
import { Player } from './player';
import { DungeonLevel } from './dungeon';
import { CanvasRenderer } from './renderer';
import { Monster } from './monsters';

// ── Luminance character ramp ───────────────────────────────────────────────────
// Characters ordered dense→sparse (visually bright→dark on a black background).
// Inspired by Benji Taylor's luminance-mapped ASCII raycasting technique:
// every rendered cell computes a brightness value in [0,1] then indexes into
// this ramp, giving ~40 distinct shading levels instead of a 5-bucket palette.
const LUMA_RAMP = '$@B%8&WM#gGQZO0SCJjTt7f!/|()?-_+~;:,\'. ';
const RAMP_LAST = LUMA_RAMP.length - 1;

function charFromLuma(luma: number): string {
  return LUMA_RAMP[Math.round((1 - clamp01(luma)) * RAMP_LAST)];
}

function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }

// Linear distance fade: 1.0 at dist=0, 0.0 at dist=MAX_RAY_DEPTH
function fade(dist: number): number { return clamp01(1 - dist / MAX_RAY_DEPTH); }

// Scale a hex colour by factor ∈ [0, 1]
function darken(hex: string, factor: number): string {
  const f = clamp01(factor);
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * f);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// 2×2 Bayer ordered dither — breaks up the horizontal banding that would
// appear on floor/ceiling rows if every column in a row had identical luma.
function bayerDither(col: number, row: number): number {
  return ((col + row) % 2 === 0 ? 0.035 : -0.035);
}

// ── Wall brick and floor stone textures ────────────────────────────────────────
// 3 brick rows × 2 brick columns per wall tile.  Odd courses staggered by ½.
const BRICK_ROWS = 3;
const BRICK_COLS = 2;

// Fast 2-input integer hash → float in [0, 1)
function tileHash(a: number, b: number): number {
  let n = (Math.imul(a ^ (a >>> 16), 0x45d9f3b) ^ Math.imul(b ^ (b >>> 16), 0x119de1f3)) >>> 0;
  n = (n ^ (n >>> 15)) >>> 0;
  return n / 0x100000000;
}

// Returns the luma value for a single pixel inside a brick wall strip.
//   row/top/lineH  — screen-strip geometry, gives vertical texcoord
//   wallX          — horizontal texcoord [0,1) along the hit wall face
//   base           — column's distance-based brightness (unchanged for mortar gaps)
// mapX/mapY seed the hash so every tile face has a unique brick pattern —
// without this, all tiles in a straight corridor look identical.
function brickPixelLuma(row: number, top: number, lineH: number, wallX: number, base: number, mapX: number, mapY: number): number {
  if (lineH < 4) return base;                   // too thin to resolve brick detail
  const tY       = (row - top) / lineH;         // vertical position in tile [0,1)
  const bRowF    = tY * BRICK_ROWS;
  const bRowI    = Math.floor(bRowF);
  const posInRow = bRowF - bRowI;               // position within this brick row [0,1)
  const stagger  = (bRowI & 1) ? 0.5 / BRICK_COLS : 0;
  const bColF    = ((wallX + stagger) * BRICK_COLS) % 1.0;
  // Mortar: 18 % vertical height, 7 % horizontal width
  if (posInRow < 0.18 || bColF < 0.07) return base * 0.28;
  // Per-brick luma variation ± 7 % — seeded by tile world pos so each face differs
  const bColI = Math.floor((wallX + stagger) * BRICK_COLS);
  return clamp01(base + (tileHash(bRowI * 97 + mapX, bColI * 31 + mapY) - 0.5) * 0.14);
}

// ── Sprite rendering ───────────────────────────────────────────────────────────

type GlyphCell = { ch: string; color: string };
type GlyphRow  = (GlyphCell | null)[];

interface Sprite {
  x: number; y: number;
  glyph: GlyphRow[];   // multi-char billboard, null = transparent
  singleCh: string;    // fallback for far sprites
  singleColor: string;
}

// ── Compact sprite encoder ─────────────────────────────────────────────────────
// rows: array of fixed-width strings; space = transparent null cell.
// pal maps each non-space char to [displayChar, cssColor].
function mkSprite(rows: string[], pal: Record<string, [string, string]>): GlyphRow[] {
  return rows.map(row =>
    Array.from(row).map(c => c === ' ' ? null : (pal[c] ? G(pal[c][0], pal[c][1]) : null))
  );
}

// ── Glyph definitions ──────────────────────────────────────────────────────────

const G = (ch: string, color: string): GlyphCell => ({ ch, color });
const _ = null;

// ── Item sprites ───────────────────────────────────────────────────────────────

const ITEM_GLYPHS: Record<string, GlyphRow[]> = {

  // ─ Sword: vertical blade, wide crossguard, wrapped grip, pommel ──────────
  weapon: mkSprite([
    '     |      ',
    '     |      ',
    '     |      ',
    '     |      ',
    '   --+--    ',
    '     !      ',
    '    [!]     ',
    '     *      ',
  ], {
    '|': ['|', '#ddeeff'], '-': ['-', '#cc9900'], '+': ['+', '#ffdd22'],
    '!': ['|', '#886644'], '[': ['[', '#aa7733'], ']': [']', '#aa7733'],
    '*': ['*', '#ddaa22'],
  }),

  // ─ Chestplate: shoulderguards, gem, strapped torso ───────────────────────
  armor: mkSprite([
    '   /------\\  ',
    '  |  [  ]  | ',
    '  |  [  ]  | ',
    '  |  ----  | ',
    '  |  |  |  | ',
    '  |  |  |  | ',
    '   \\_____/  ',
  ], {
    '/': ['/', '#8899bb'], '\\': ['\\', '#8899bb'], '|': ['|', '#8899bb'],
    '_': ['_', '#7788aa'], '-': ['-', '#99aacc'], '[': ['[', '#aabbdd'], ']': [']', '#ee4455'],
  }),

  // ─ Apple: stem, round red body, base ─────────────────────────────────────
  food: mkSprite([
    '    ,|,    ',
    '   /   \\  ',
    '  ( ooo )  ',
    '  (     )  ',
    '  (  .  )  ',
    '   \\___/  ',
  ], {
    ',': [',', '#44aa22'], '|': ['|', '#338811'],
    '/': ['/', '#cc4411'], '\\': ['\\', '#cc4411'],
    '(': ['(', '#dd5522'], ')': [')', '#dd5522'],
    'o': ['o', '#ee8833'], '.': ['.', '#992200'], '_': ['_', '#aa3300'],
  }),

  // potion — generated dynamically by potionGlyph()
  potion: [],

  // ─ Scroll: rolled parchment with text ────────────────────────────────────
  scroll: mkSprite([
    '  /========\\  ',
    ' /  ~~~~~~~~ \\ ',
    '|   --------  |',
    '|   ~~~~~~~~  |',
    '|   --------  |',
    '|   ~~~~~~~~  |',
    ' \\  --------  /',
    '  \\========/  ',
  ], {
    '/': ['/', '#ccbb77'], '\\': ['\\', '#ccbb77'], '|': ['|', '#bbaa66'],
    '=': ['=', '#ddcc88'], '-': ['-', '#998844'], '~': ['~', '#ffffcc'],
  }),

  // ─ Gold coins ────────────────────────────────────────────────────────────
  gold: mkSprite([
    '   $ $ $   ',
    '  $$$$$$$  ',
    ' ($$$$$$$) ',
    ' ($$$$$$$) ',
    '  -------  ',
  ], {
    '$': ['$', '#ffee22'], '(': ['(', '#aa8800'], ')': [')', '#aa8800'],
    '-': ['-', '#887700'],
  }),

  // ─ Ring with gem ─────────────────────────────────────────────────────────
  ring: mkSprite([
    '   ,OOO,   ',
    '  (     )  ',
    ' ( ( * ) ) ',
    '  (     )  ',
    '   -----   ',
  ], {
    ',': [',', '#ffaaff'], 'O': ['O', '#ff88ff'],
    '(': ['(', '#ee77ee'], ')': [')', '#ee77ee'],
    '*': ['*', '#ffffff'], '-': ['-', '#cc55cc'],
  }),

  // ─ Magic wand ────────────────────────────────────────────────────────────
  wand: mkSprite([
    '    *     ',
    '    |     ',
    '    |     ',
    '    |     ',
    '    |     ',
    '    |     ',
    '   [|]    ',
    '   (=)    ',
  ], {
    '*': ['*', '#aaffff'], '|': ['|', '#55aacc'],
    '[': ['[', '#4488aa'], ']': [']', '#4488aa'],
    '(': ['(', '#336688'], ')': [')', '#336688'], '=': ['=', '#2255aa'],
  }),

  // ─ Amulet of Yendor ──────────────────────────────────────────────────────
  amulet: mkSprite([
    '  -O-Y-O-  ',
    '     |     ',
    '    (Y)    ',
    '   ( * )   ',
    '     |     ',
    '     V     ',
  ], {
    '-': ['-', '#ffcc77'], 'O': ['O', '#ffbb44'], 'Y': ['Y', '#ffff44'],
    '|': ['|', '#ffcc66'], '(': ['(', '#ffdd88'], ')': [')', '#ffdd88'],
    '*': ['*', '#ffffff'], 'V': ['V', '#ccaa55'],
  }),

  // ─ Stairs down: arrows + receding steps ──────────────────────────────────
  stairs_down: mkSprite([
    'vvvvvvvvvvvvvv',
    'aaaaaaaaaaaaaa',
    '  bbbbbbbbbb  ',
    '    cccccc    ',
    '      dd      ',
  ], {
    'v': ['v', '#55ffcc'],
    'a': ['=', '#99aabb'], 'b': ['=', '#778899'],
    'c': ['=', '#556677'], 'd': ['=', '#445566'],
  }),

  // ─ Stairs up ─────────────────────────────────────────────────────────────
  stairs_up: mkSprite([
    '      dd      ',
    '    cccccc    ',
    '  bbbbbbbbbb  ',
    'aaaaaaaaaaaaaa',
    '^^^^^^^^^^^^^^',
  ], {
    'd': ['=', '#445566'], 'c': ['=', '#556677'],
    'b': ['=', '#778899'], 'a': ['=', '#99aabb'],
    '^': ['^', '#55ffcc'],
  }),
};

// ── Potion glyph (dynamic colour) ─────────────────────────────────────────────
function potionGlyph(liquidColor: string): GlyphRow[] {
  const lc = liquidColor, dc = darken(liquidColor, 0.55);
  const g = '#aaccdd', gd = '#667788';
  return [
    [_,_,G('_',gd),G('_',gd),G('_',gd),_,_],
    [_,G('[',g),G('-',g),G('-',g),G(']',g),_,_],
    [_,G('/',g),G('~',lc),G('~',lc),G('\\',g),_,_],
    [_,G('|',gd),G('.',lc),G('.',dc),G('|',gd),_,_],
    [_,G('|',gd),G('!',lc),G('!',dc),G('|',gd),_,_],
    [_,G('|',gd),G('.',dc),G('.',lc),G('|',gd),_,_],
    [_,G('\\',g),G('_',dc),G('_',dc),G('/',g),_,_],
    [_,G('|',gd),G(' ',gd),G(' ',gd),G('|',gd),_,_],
    [_,G('[',gd),G('=',gd),G('=',gd),G(']',gd),_,_],
  ];
}

// ── Per-monster high-res ASCII art (12–16 wide × 7–10 tall) ───────────────────
// Each factory receives the monster's colour and returns a GlyphRow grid.
// Dark/mid variants are derived via darken(); secondary colours are hardcoded.

const MONSTER_GLYPH_FACTORIES: Partial<Record<string, (c: string) => GlyphRow[]>> = {

  giant_rat: (c) => {
    const d = darken(c, 0.60), t = '#997744';
    return mkSprite([
      '   ,--,    ~~~',
      ' ,-    -,~~~  ',
      '(o        >   ',
      '(  ^       )  ',
      '|  ------  |  ',
      " '--------'   ",
      '   /|    |\\  ',
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '/': ['/', c], '\\': ['\\', c], '>': ['>', c],
      'o': ['o', d], '^': ['^', d], '~': ['~', t],
    });
  },

  newt: (c) => {
    const d = darken(c, 0.55), s = '#55cc44';
    return mkSprite([
      '  ,--,       ',
      ' /o   >===,  ',
      '|  ------  . ',
      '|  -------   ',
      ' \\_______/  ',
      '    | |      ',
    ], {
      ',': [',', c], '-': ['-', c], '.': ['.', c], '/': ['/', c], '\\': ['\\', c],
      '|': ['|', d], '_': ['_', d], '=': ['=', c], '>': ['>', c],
      'o': ['o', s],
    });
  },

  bat: (c) => {
    const d = darken(c, 0.55), e = '#ff4422';
    return mkSprite([
      '/\\          /\\ ',
      '  \\  ,--,  /  ',
      '  )(o)(o)(    ',
      '   \\ vv /    ',
      '   (    )     ',
      '   |    |     ',
      "   '--''     ",
    ], {
      '/': ['/', c], '\\': ['\\', c], ',': [',', c], '-': ['-', c],
      "'": ["'", c], '(': ['(', c], ')': [')', c], '|': ['|', d],
      'v': ['v', d], 'o': ['o', e],
    });
  },

  giant_spider: (c) => {
    const d = darken(c, 0.55), e = '#ff2200';
    return mkSprite([
      '\\   |   /   ',
      ' \\  |  /    ',
      ' (_______)  ',
      '( (     ) ) ',
      '( (  *  ) ) ',
      ' (_______)  ',
      '/   | |  \\  ',
      '    | |     ',
    ], {
      '\\': ['\\', c], '/': ['/', c], '|': ['|', d], '_': ['_', c],
      '(': ['(', c], ')': [')', c], '-': ['-', d], '*': ['*', e],
    });
  },

  centipede: (c) => {
    const d = darken(c, 0.55);
    return mkSprite([
      '  o-o-o-o-o-o ',
      ' /|/|/|/|/|/| ',
      '  o o o o o o ',
      ' \\|\\|\\|\\|\\|\\| ',
      '  o-o-o-o-o-> ',
    ], {
      'o': ['o', c], '-': ['-', c], '>': ['>', c],
      '/': ['/', d], '\\': ['\\', d], '|': ['|', d],
    });
  },

  giant_ant: (c) => {
    const d = darken(c, 0.55);
    return mkSprite([
      '   /\\ /\\    ',
      '  /  V  \\   ',
      ' ( (ooo) )  ',
      '  \\  |  /   ',
      '  (  |  )   ',
      ' /|  |  |\\  ',
      '/  \\ | /  \\ ',
    ], {
      '/': ['/', c], '\\': ['\\', c], '(': ['(', c], ')': [')', c],
      'V': ['V', d], '|': ['|', d], 'o': ['o', d],
    });
  },

  killer_bee: (c) => {
    const d = darken(c, 0.55), y = '#ffee22';
    return mkSprite([
      '  _/ \\_    ',
      ' / \\-/ \\   ',
      '( B B B )  ',
      '( ===== )  ',
      ' \\_____/   ',
      '    |      ',
      '   /|\\     ',
    ], {
      '_': ['_', c], '/': ['/', c], '\\': ['\\', c], '-': ['-', c],
      '(': ['(', c], ')': [')', c], 'B': ['B', y], '=': ['=', y],
      '|': ['|', d],
    });
  },

  grid_bug: (c) => {
    const d = darken(c, 0.55);
    return mkSprite([
      ' /\\/\\/\\  ',
      '(  ..  )  ',
      '|  ##  |  ',
      ' (    )   ',
      ' /|  |\\  ',
      "  '--'   ",
    ], {
      '/': ['/', c], '\\': ['\\', c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '#': ['#', d], '.': ['.', '#ffff88'],
      '-': ['-', c], "'": ["'", c],
    });
  },

  goblin: (c) => {
    const d = darken(c, 0.60), e = '#ffff66';
    return mkSprite([
      '  ,---.   ',
      ' (o   o)  ',
      ' | ^ ^ |  ',
      '  \\---/   ',
      '  |||||   ',
      ' /||||\\   ',
      '(  |||  ) ',
      '   | |    ',
      "  / \\ \\ ' ",
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c], 'o': ['o', e], '^': ['^', d],
    });
  },

  kobold: (c) => {
    const d = darken(c, 0.60), e = '#ff8800';
    return mkSprite([
      '  ,---.   ',
      ' (o   o)  ',
      ' | v v |  ',
      '  \\---/   ',
      '  |||||   ',
      ' /||||\\   ',
      '(  |||  ) ',
      '   | |    ',
      "  / \\ \\ ' ",
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c], 'o': ['o', e], 'v': ['v', d],
    });
  },

  orc: (c) => {
    const d = darken(c, 0.55), e = '#ffcc44';
    return mkSprite([
      '   ,-----.   ',
      '  (O     O)  ',
      '  | v...v |  ',
      "   '-----'   ",
      '   (|||||)   ',
      '  /|||||||\\  ',
      ' (  |||||  ) ',
      '    || ||    ',
      '   /|   |\\  ',
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c],
      'O': ['O', e], 'v': ['v', d], '.': ['.', '#eecc88'],
    });
  },

  goblin_variants: (c) => {  // gnome, hobgoblin share this
    const d = darken(c, 0.55), e = '#ffcc44';
    return mkSprite([
      '  ,----.   ',
      ' ( o  o )  ',
      '  \\----/   ',
      '   |||||   ',
      '  /||||\\   ',
      ' (  |||  ) ',
      '    | |    ',
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c], 'o': ['o', e],
    });
  },

  zombie: (c) => {
    const d = darken(c, 0.55);
    return mkSprite([
      '  ,---.    ',
      ' (X   X)   ',
      '  \\---/    ',
      '  |||||    ',
      ' /|||||\\   ',
      '(  |||  )  ',
      '  || ||    ',
      "  '  '    ",
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      'X': ['X', '#dddddd'], '|': ['|', d], '\\': ['\\', c], '/': ['/', c],
    });
  },

  skeleton: (c) => {
    const d = darken(c, 0.60), w = '#dddddd';
    return mkSprite([
      '   ,O,     ',
      '  ( * )    ',
      '   \\-/     ',
      '  /|=|\\    ',
      ' | | | |   ',
      ' | | | |   ',
      ' |_   _|   ',
      '  | | |    ',
      "  ' ' '   ",
    ], {
      ',': [',', w], 'O': ['O', w], '*': ['*', w], '\\': ['\\', w],
      '/': ['/', w], '-': ['-', w], '|': ['|', w], '=': ['=', d],
      '_': ['_', w], "'": ["'", w],
    });
  },

  floating_eye: (c) => {
    const d = darken(c, 0.55), p = '#2244ff', w = '#ffffff';
    return mkSprite([
      '   _____   ',
      '  /     \\  ',
      ' |  ___  | ',
      ' | (*  ) | ',
      ' |  ---  | ',
      ' |  ~~~  | ',
      '  \\_____/  ',
    ], {
      '_': ['_', c], '/': ['/', c], '\\': ['\\', c], '|': ['|', d],
      '(': ['(', w], ')': [')', w], '*': ['*', p], '-': ['-', d], '~': ['~', d],
    });
  },

  gelatinous_cube: (c) => {
    const d = darken(c, 0.45);
    return mkSprite([
      ' +----------+ ',
      ' |..........| ',
      ' |. .  . . .| ',
      ' |..........| ',
      ' |. .  . . .| ',
      ' |..........| ',
      ' +----------+ ',
    ], {
      '+': ['+', c], '|': ['|', c], '-': ['-', c], '.': ['.', d], ' ': [' ', d],
    });
  },

  ochre_jelly: (c) => {
    const d = darken(c, 0.55);
    return mkSprite([
      ' ,~~~~~~~~~, ',
      '( ~~~~~~~~~ )',
      '( ~~~~~~~~~~ )',
      '( ~~~~~~~~~ )',
      " '~~~~~~~~~~' ",
      '   --------   ',
    ], {
      ',': [',', c], '~': ['~', c], '(': ['(', c], ')': [')', c],
      "'": ["'", c], '-': ['-', d],
    });
  },

  mimic: (c) => {
    const d = darken(c, 0.55), b = '#886633', t = '#ffee88';
    return mkSprite([
      ',============,',
      '| ,---..---. |',
      '|.VVVVVVVVVV.|',
      '|============|',
      '|  |      |  |',
      '|  |      |  |',
      '|  |______|  |',
      "'============'",
    ], {
      ',': [',', b], '=': ['=', b], '|': ['|', b], '-': ['-', b],
      '.': ['.', d], 'V': ['V', t], '_': ['_', b], "'": ["'", b],
    });
  },

  troll: (c) => {
    const d = darken(c, 0.55), e = '#ffcc00';
    return mkSprite([
      '  ,------,   ',
      ' ( *    * )  ',
      ' | vvvvv |   ',
      "  '--v--'    ",
      '  (|||||||)  ',
      ' /||||||||||\\',
      '(  ||||||||  )',
      ' (  ||||||  ) ',
      '    || ||    ',
      '   /|   |\\  ',
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c],
      '*': ['*', e], 'v': ['v', d],
    });
  },

  ogre: (c) => {
    const d = darken(c, 0.55), e = '#ffcc44';
    return mkSprite([
      '   ,-----.   ',
      '  ( O   O )  ',
      '  |  ___  |  ',
      "   \\_---_/   ",
      '   (|||||)   ',
      '  /|||||||\\  ',
      ' (  |||||  ) ',
      '    | | |    ',
      '   /|   |\\  ',
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c], '_': ['_', c],
      'O': ['O', e],
    });
  },

  minotaur: (c) => {
    const d = darken(c, 0.55), e = '#ffcc44';
    return mkSprite([
      '  /\\     /\\   ',
      ' /  \\   /  \\  ',
      '(    ) ( )  ) ',
      '|  [ooo]   |  ',
      ' \\  ---  /   ',
      '  (|||||)     ',
      ' /|||||||\\    ',
      '(  |||||  )   ',
      '   || ||      ',
      '  /|   |\\    ',
    ], {
      '/': ['/', c], '\\': ['\\', c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '-': ['-', c], '[': ['[', d], ']': [']', d],
      'o': ['o', e],
    });
  },

  wraith: (c) => {
    const d = darken(c, 0.45), e = '#ff4488';
    return mkSprite([
      '   ,~~~~,    ',
      '  (  ..  )   ',
      '  ( ---- )   ',
      '   (    )    ',
      '    ( ~ )    ',
      '    )   (    ',
      '   (     )   ',
      '  (       )  ',
      "   '~~~~~'   ",
    ], {
      ',': [',', c], '~': ['~', c], '(': ['(', c], ')': [')', c],
      '.': ['.', e], '-': ['-', d], "'": ["'", c],
    });
  },

  vampire: (c) => {
    const d = darken(c, 0.55), e = '#ff2222', w = '#dddddd';
    return mkSprite([
      '   ,---.     ',
      '  (o   o)    ',
      '   \\ W /     ',
      '    | |      ',
      '   /   \\     ',
      '  /  *  \\    ',
      ' /       \\   ',
      '|         |  ',
      " '-------'   ",
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c],
      'o': ['o', e], 'W': ['W', w], '*': ['*', '#ffcc44'],
    });
  },

  lich: (c) => {
    const d = darken(c, 0.55), e = '#88ffff', w = '#cccccc';
    return mkSprite([
      '   ,O,       ',
      '  (* *)      ',
      '   \\-/       ',
      '  /|=|\\      ',
      ' *| | |*     ',
      '  | | |      ',
      '   \\   /     ',
      '   /   \\     ',
      '  /|   |\\    ',
    ], {
      ',': [',', w], 'O': ['O', w], '\\': ['\\', w], '/': ['/', w],
      '-': ['-', w], '|': ['|', d], '=': ['=', d], '_': ['_', d],
      '*': ['*', e],
    });
  },

  dragon: (c) => {
    const d = darken(c, 0.55), e = '#ffee22', f = '#ff6600';
    return mkSprite([
      '  /\\/\\  /\\/\\  ',
      ' /oooo\\/ oo\\ ',
      '/  --  \\ -- \\',
      '|  /\\/\\ /\\/\\ |',
      ' \\/    \\/    \\/',
      ' (  ___________)',
      '/ (             )',
      '  |  | |  |  |  ',
      '  \\_____/     ',
    ], {
      '/': ['/', c], '\\': ['\\', c], 'o': ['o', e], '-': ['-', d],
      '|': ['|', d], '(': ['(', c], ')': [')', c], '_': ['_', c],
      'V': ['V', f],
    });
  },

  wolf: (c) => {
    const d = darken(c, 0.55), e = '#ffcc88';
    return mkSprite([
      '   ,---,    ',
      '  ( o o )   ',
      ' < (---) >  ',
      '  (     )   ',
      ' /  ---  \\  ',
      '(  /   \\  ) ',
      "  '-----'   ",
    ], {
      ',': [',', c], '-': ['-', c], "'": ["'", c], '(': ['(', c], ')': [')', c],
      '|': ['|', d], '\\': ['\\', c], '/': ['/', c], '<': ['<', c], '>': ['>', c],
      'o': ['o', e],
    });
  },
};

// Fallback for unknown monster keys — generic humanoid silhouette.
function genericMonsterGlyph(symbol: string, color: string): GlyphRow[] {
  const d = darken(color, 0.65), d2 = darken(color, 0.42);
  return [
    [_,         G('/', d2),       G('^', d),        G('\\', d2), _         ],
    [G('(', d), G('.', d2),       G(' ', d2),        G('.', d2),  G(')', d) ],
    [G('|', d), G(' ', d2),       G(symbol, color),  G(' ', d2),  G('|', d) ],
    [G('(', d), G('_', d2),       G(' ', d2),        G('_', d2),  G(')', d) ],
    [_,         G('|', d),        G('_', d2),         G('|', d),  _         ],
  ];
}

function makeMonsterGlyph(key: string, symbol: string, color: string): GlyphRow[] {
  const factory = MONSTER_GLYPH_FACTORIES[key]
    ?? MONSTER_GLYPH_FACTORIES[
      // alias similar monster types to shared designs
      key === 'gnome'     ? 'goblin_variants' :
      key === 'hobgoblin' ? 'goblin_variants' :
      key === 'jackal'    ? 'wolf' :
      key === 'warg'      ? 'wolf' :
      key === 'dwarf'     ? 'goblin_variants' :
      key === 'elf'       ? 'goblin_variants' :
      key === 'zombie'    ? 'zombie' :
      key === 'killer_bee'? 'killer_bee' :
      'goblin'
    ];
  return factory?.(color) ?? genericMonsterGlyph(symbol, color);
}

// Each glyph "pixel" is rendered as perspScale × perspScale renderer cells.
// perspScale = min(SPRITE_SCALE, round(viewH / transformY / glyphRows)).
// Set SPRITE_SCALE lower now that sprites are inherently high-resolution.
const SPRITE_SCALE = 3;

function drawSprites(
  renderer: CanvasRenderer,
  sprites: Sprite[],
  player: Player,
  zBuf: Float64Array,
  viewX: number, viewY: number, viewW: number, viewH: number,
  horizonRow: number,
): void {
  const dirX = Math.cos(player.angle), dirY = Math.sin(player.angle);
  const halfFov = Math.tan(FOV / 2);

  // Sort far → near so closer sprites overdraw farther ones
  sprites.sort((a, b) => {
    const dA = (a.x + 0.5 - player.x) ** 2 + (a.y + 0.5 - player.y) ** 2;
    const dB = (b.x + 0.5 - player.x) ** 2 + (b.y + 0.5 - player.y) ** 2;
    return dB - dA;
  });

  for (const sp of sprites) {
    const rx = sp.x + 0.5 - player.x;
    const ry = sp.y + 0.5 - player.y;

    // Camera-space transform.
    // With dir=(cosα, sinα) and camera plane=(-sinα, cosα)*halfFov the
    // inverse camera matrix gives:
    //   transformY = dirX·rx + dirY·ry   (perpendicular depth)
    //   transformX = (dirX·ry − dirY·rx) / halfFov  (lateral position)
    const transformY = dirX * rx + dirY * ry;
    if (transformY <= 0.1) continue;  // behind player

    const transformX = (dirX * ry - dirY * rx) / halfFov;
    const screenX    = Math.round((viewW / 2) * (1 + transformX / transformY));
    if (screenX < 0 || screenX >= viewW) continue;

    const luma      = Math.max(0.45, fade(transformY));
    const glyph     = sp.glyph;
    const glyphRows = glyph.length;
    const glyphCols = Math.max(...glyph.map(r => r.length));

    // Perspective-correct scale: matches wall sizing so close sprites are large
    // and distant ones shrink naturally.  rawScale is the ideal cells-per-glyph-row.
    const rawScale   = viewH / (transformY * glyphRows);

    // Too far: glyph would be sub-pixel → fall back to a single character dot
    if (rawScale < 0.5) {
      if (transformY >= zBuf[screenX]) continue;
      const floorRow = Math.max(0, Math.min(viewH - 1, horizonRow));
      renderer.put(viewX + screenX, viewY + floorRow, sp.singleCh, darken(sp.singleColor, luma));
      continue;
    }

    // Cap so point-blank sprites don't consume the entire screen.
    // SPRITE_SCALE (user-tunable base) caps the maximum rendered scale.
    const perspScale = Math.max(1, Math.min(SPRITE_SCALE * 2, Math.round(rawScale)));
    const scaledH    = glyphRows * perspScale;
    const scaledW    = glyphCols * perspScale;

    // Glyph placed so its top is exactly at the horizon — the whole glyph
    // sits in the floor half of the view, grounded on the floor.
    const glyphTop  = horizonRow;
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

// ── Main raycaster ─────────────────────────────────────────────────────────────

export function renderView(
  renderer: CanvasRenderer,
  player: Player,
  level: DungeonLevel,
  monsters: { x: number; y: number; symbol: string; color: string; key: string }[],
  items: { x: number; y: number; symbol: string; color: string; kind: string }[],
  viewX: number, viewY: number, viewW: number, viewH: number,
): void {
  const px = player.x, py = player.y;
  const dirX = Math.cos(player.angle), dirY = Math.sin(player.angle);
  const halfFov = Math.tan(FOV / 2);

  // Head-bob: offset the horizon by a fraction of a row, fading out at rest
  const bobOffset  = Math.round(Math.sin(player.bobPhase) * player.bobAmplitude * 1.3);
  const horizonRow = Math.floor(viewH / 2) + Math.round(player.pitch) + bobOffset;

  // t is used only for per-torch local flicker.  A tiny ambient pulse (~1 %) keeps
  // the scene from feeling completely frozen when standing still without adding
  // the distracting global shimmer of the old full-scene torchFlicker.
  const t = Date.now();
  const ambientPulse = 1 + Math.sin(t * 0.00045) * 0.012;

  // Z-buffer: stores perpendicular wall distance per screen column (for sprite occlusion)
  const zBuf = new Float64Array(viewW).fill(MAX_RAY_DEPTH);

  // ── Floor & ceiling ────────────────────────────────────────────────────────
  // Ceiling: row-constant luma + Bayer dither, no texture.
  // Floor: Lode-style incremental world-position casting so we know the exact
  // tile under each character cell → stone flag tiles with mortar grout lines.
  for (let r = 0; r < viewH; r++) {
    const fromHorizon = r - horizonRow;
    if (fromHorizon === 0) continue;

    const rowDist  = viewH / (2.0 * Math.abs(fromHorizon));
    const isFloor  = fromHorizon > 0;
    // Ceiling is dimmer than floor — oppressive dungeon vault above, warm stone below.
    const baseLuma = fade(rowDist) * (isFloor ? 0.65 : 0.22);

    if (!isFloor) {
      // ── Ceiling: near-black vault, Bayer dither only ────────────────────
      const fg = darken('#141210', baseLuma / 0.22);
      for (let c = 0; c < viewW; c++)
        renderer.put(viewX + c, viewY + r, charFromLuma(clamp01(baseLuma + bayerDither(c, r))), fg);
      continue;
    }

    // ── Floor: warm torch-lit stone flags ────────────────────────────────
    let floorX = px + rowDist * (dirX + dirY * halfFov);
    let floorY = py + rowDist * (dirY - dirX * halfFov);
    const fdx  = rowDist * (-dirY) * 2 * halfFov / viewW;
    const fdy  = rowDist * ( dirX) * 2 * halfFov / viewW;

    for (let c = 0; c < viewW; c++, floorX += fdx, floorY += fdy) {
      const fx  = ((floorX % 1) + 1) % 1;
      const fy  = ((floorY % 1) + 1) % 1;
      const dit = bayerDither(c, r);
      if (fx < 0.06 || fy < 0.06) {
        // Dark grout lines between flags
        renderer.put(viewX + c, viewY + r,
          charFromLuma(clamp01(baseLuma * 0.18 + dit)),
          darken('#0e0a06', baseLuma * 2.0));
      } else {
        // Stone flag body — ±9 % per-tile luma variation for irregular cut stones
        const vary = (tileHash(Math.floor(floorX), Math.floor(floorY)) - 0.5) * 0.18;
        const luma = clamp01(baseLuma + vary + dit);
        renderer.put(viewX + c, viewY + r, charFromLuma(luma), darken('#a87848', luma));
      }
    }
  }

  // ── Walls (DDA) ────────────────────────────────────────────────────────────
  for (let col = 0; col < viewW; col++) {
    // Ray direction for this screen column
    const camX    = (2 * col / viewW - 1) * halfFov;
    const rayDirX = dirX - dirY * camX;
    const rayDirY = dirY + dirX * camX;

    let mapX = Math.floor(px), mapY = Math.floor(py);
    const deltaX = Math.abs(1 / (rayDirX || 1e-30));
    const deltaY = Math.abs(1 / (rayDirY || 1e-30));
    const stepX  = rayDirX < 0 ? -1 : 1;
    const stepY  = rayDirY < 0 ? -1 : 1;
    let sideX = (rayDirX < 0 ? px - mapX : mapX + 1 - px) * deltaX;
    let sideY = (rayDirY < 0 ? py - mapY : mapY + 1 - py) * deltaY;

    let side = 0, hit = false;
    for (let depth = 0; !hit && depth < 128; depth++) {
      if (sideX < sideY) { sideX += deltaX; mapX += stepX; side = 0; }
      else               { sideY += deltaY; mapY += stepY; side = 1; }
      if (OPAQUE_TILES.has(level.tile(mapX, mapY))) hit = true;
    }

    // Fisheye-corrected perpendicular distance
    const perpDist = side === 0
      ? (mapX - px + (1 - stepX) / 2) / rayDirX
      : (mapY - py + (1 - stepY) / 2) / rayDirY;

    zBuf[col] = perpDist;

    const lineH  = Math.round(viewH / perpDist);
    const top    = Math.max(0,       horizonRow - Math.floor(lineH / 2));
    const bottom = Math.min(viewH-1, horizonRow + Math.floor(lineH / 2));

    const hitTile = level.tile(mapX, mapY);
    const isDoor  = hitTile === Tile.DOOR_CLOSED;

    // X-side walls receive full light; Y-side receive 72% (directional shading).
    // ambientPulse adds an imperceptible breath — no global shimmer.
    const luma      = clamp01(fade(perpDist) * (side === 0 ? 1.0 : 0.72) * (isDoor ? 0.85 : 1.0) * ambientPulse);
    const baseColor = isDoor ? '#9a6020' : (side === 0 ? COL_WALL_CLOSE_X : COL_WALL_CLOSE_Y);

    // Horizontal texture coordinate along the hit wall face [0, 1)
    let wallX = side === 0 ? (py + perpDist * rayDirY) : (px + perpDist * rayDirX);
    wallX -= Math.floor(wallX);
    if (side === 0 && rayDirX > 0) wallX = 1 - wallX;
    if (side === 1 && rayDirY < 0) wallX = 1 - wallX;

    // ── Per-tile visual variation — corridor motion cues ─────────────────
    // Without this every wall face in a straight corridor is identical; the
    // player can't tell they're moving.  Two effects fix it:
    //   1. tileVariation: ± 8 % brightness per tile face (unique per mapX/mapY)
    //   2. edgeDark: dark vertical seam at tile boundaries (wallX ≈ 0 / 1)
    const tileVariation = !isDoor ? (tileHash(mapX * 7 + 13, mapY * 11 + 5) - 0.5) * 0.16 : 0;
    const edgeDark      = (!isDoor && (wallX < 0.04 || wallX > 0.96)) ? 0.62 : 1.0;

    // ── Per-column torch pre-computation ─────────────────────────────────
    // Torches only appear on visible (lit, close) walls — not in shadow.
    // Computing this before the row loop lets the row loop add a warm glow halo.
    const torchSeed    = isDoor ? 1.0 : tileHash(mapX, mapY);
    const tileHasTorch = !isDoor && torchSeed < 0.25
                         && perpDist < 6.5 && luma > 0.15 && lineH >= 8;
    const torchPhase   = torchSeed * Math.PI * 8;
    const tflick       = tileHasTorch
      ? 1 + Math.sin(t * 0.0031 + torchPhase) * 0.20
          + Math.sin(t * 0.0109 + torchPhase * 1.9) * 0.10
      : 1.0;
    const inTorchCenter = tileHasTorch && Math.abs(wallX - 0.5) < 0.065;
    const inTorchGlow   = tileHasTorch && Math.abs(wallX - 0.5) < 0.22;
    const sconceRow     = top + Math.round(lineH * 0.38);

    for (let row = top; row <= bottom; row++) {
      if (isDoor) {
        // ── Wood-panelled door ───────────────────────────────────────────────
        // wY: vertical position in door face [0 = top, 1 = bottom]
        const wY = (row - top) / Math.max(1, lineH - 1);

        // Outer top/bottom frame rail
        if (wY < 0.055 || wY > 0.945) {
          renderer.put(viewX + col, viewY + row, '=', darken('#c49050', luma));
          continue;
        }
        // Vertical stile (left and right edges of door)
        if (wallX < 0.07 || wallX > 0.93) {
          renderer.put(viewX + col, viewY + row, '|', darken('#9a6020', luma));
          continue;
        }
        // Inner panel-frame stiles (inset from edges)
        if ((wallX > 0.105 && wallX < 0.155) || (wallX > 0.845 && wallX < 0.895)) {
          renderer.put(viewX + col, viewY + row, '|', darken('#b07828', luma * 0.88));
          continue;
        }
        // Mid rail and inner panel border rails
        if ((wY > 0.46 && wY < 0.54) || (wY > 0.12 && wY < 0.17) || (wY > 0.83 && wY < 0.88)) {
          renderer.put(viewX + col, viewY + row, '-', darken('#c08038', luma * 0.9));
          continue;
        }
        // Brass door knob ~67% across at mid height
        if (wallX > 0.63 && wallX < 0.75 && wY > 0.45 && wY < 0.55) {
          renderer.put(viewX + col, viewY + row, 'o', darken('#d4a000', clamp01(luma * 1.9)));
          continue;
        }
        // Wood grain: vertical lines at ~1/8 intervals; gaps filled with dim panel colour
        const gp = (wallX * 8.5) % 1;
        if (gp < 0.14)
          renderer.put(viewX + col, viewY + row, '|',             darken('#aa6820', luma * 1.05));
        else if (gp < 0.21)
          renderer.put(viewX + col, viewY + row, ':',             darken('#8a5018', luma * 0.82));
        else
          renderer.put(viewX + col, viewY + row, charFromLuma(luma * 0.3), darken('#7a4010', luma * 0.55));

      } else {
        // Ambient occlusion: contact shadow at floor (bottom) and ceiling (top)
        const posInStrip = (row - top) / Math.max(1, lineH);
        const ao = posInStrip > 0.88 ? 0.62 : posInStrip < 0.05 ? 0.75 : 1.0;

        // Torch glow: warm halo on the wall surrounding the bracket position.
        // Fades with both vertical distance from sconce and lateral distance from torch centre.
        let torchGlow = 0;
        if (inTorchGlow) {
          const rowDist   = Math.abs(row - sconceRow);
          const glowR     = Math.max(2, Math.round(lineH * 0.30));
          const colWeight = 1 - Math.abs(wallX - 0.5) / 0.22;
          if (rowDist <= glowR)
            torchGlow = colWeight * (1 - rowDist / glowR) * 0.55 * tflick;
        }

        const brickL  = brickPixelLuma(row, top, lineH, wallX, luma * (1 + tileVariation), mapX, mapY);
        const finalL  = clamp01(brickL * ao * edgeDark + torchGlow);
        // Shift toward warm amber in the glow zone so the stone looks fire-lit
        const wallCol = torchGlow > 0.10 ? '#e09042' : baseColor;
        renderer.put(viewX + col, viewY + row, charFromLuma(finalL), darken(wallCol, finalL));
      }
    }

    // Door: solid frame caps at very top and bottom of strip
    if (isDoor && lineH > 4) {
      const frameFg = darken('#c49050', clamp01(luma * 1.15));
      if (top    >= 0    ) renderer.put(viewX + col, viewY + top,    '=', frameFg);
      if (bottom < viewH ) renderer.put(viewX + col, viewY + bottom, '=', frameFg);
    }

    // ── Wall torches (use pre-computed inTorchCenter / sconceRow / tflick) ──
    if (inTorchCenter) {
      const flame = sconceRow - 1;
      const tip   = sconceRow - 2;
      const ember = sconceRow + 1;
      if (tip   >= 0 && tip   < viewH)
        renderer.put(viewX + col, viewY + tip,      ',',
          darken('#ffee88', clamp01(luma * tflick * 1.15)));
      if (flame >= 0 && flame < viewH)
        renderer.put(viewX + col, viewY + flame,    '*',
          darken('#ffaa22', clamp01(luma * tflick * 2.2)));
      if (sconceRow >= 0 && sconceRow < viewH)
        renderer.put(viewX + col, viewY + sconceRow, '+',
          darken('#7a5a38', clamp01(luma * 0.90)));
      if (ember >= 0 && ember < viewH)
        renderer.put(viewX + col, viewY + ember,    '.',
          darken('#cc5500', clamp01(luma * tflick * 0.75)));
    }
  }

  // ── Sprites ────────────────────────────────────────────────────────────────
  const sprites: Sprite[] = [
    ...monsters.map(m => ({
      x: m.x, y: m.y,
      glyph: makeMonsterGlyph(m.key, m.symbol, m.color),
      singleCh: m.symbol, singleColor: m.color,
    })),
    ...items.map(i => ({
      x: i.x, y: i.y,
      glyph: i.kind === 'potion'
        ? potionGlyph(i.color)
        : (ITEM_GLYPHS[i.kind] ?? genericMonsterGlyph(i.symbol, i.color)),
      singleCh: i.symbol, singleColor: i.color,
    })),
  ];
  if (level.stairsDown) sprites.push({
    x: level.stairsDown[0], y: level.stairsDown[1],
    glyph: ITEM_GLYPHS.stairs_down, singleCh: 'v', singleColor: COL_STAIRS,
  });
  if (level.stairsUp) sprites.push({
    x: level.stairsUp[0], y: level.stairsUp[1],
    glyph: ITEM_GLYPHS.stairs_up, singleCh: '^', singleColor: COL_STAIRS,
  });
  drawSprites(renderer, sprites, player, zBuf, viewX, viewY, viewW, viewH, horizonRow);
}
