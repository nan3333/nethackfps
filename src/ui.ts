import { CanvasRenderer } from './renderer';
import { GameState } from './game';
import { Player, Item } from './player';
import { DungeonLevel } from './dungeon';
import { Tile } from './constants';
import {
  COL_MSG, COL_PLAYER, COL_STATUS_BG, COL_HP_GOOD, COL_HP_LOW, COL_XP,
  COL_MINIMAP_WALL, COL_MINIMAP_FLOOR, COL_GOLD, COL_ITEM, COL_STAIRS,
  COL_MONSTER_EASY, COL_RING, COL_WAND,
} from './constants';
import { ROLE_DATA, RACE_DATA, ARMOR_DATA, Alignment } from './data';

const WHITE  = '#ffffff';
const GRAY   = '#888888';
const YELLOW = '#ffee44';
const GREEN  = '#44ff88';
const RED    = '#ff4444';

// ── Layout constants (rows) ────────────────────────────────────────────────────
export const MSG_ROWS   = 1;
export const STATUS_ROWS = 3;

// ── Message bar ───────────────────────────────────────────────────────────────

export function drawMessages(renderer: CanvasRenderer, messages: string[], msgAge: number): void {
  const row = 0;
  renderer.fill(0, row, renderer.cols, MSG_ROWS, ' ', WHITE, COL_STATUS_BG);
  if (msgAge < 4) {
    const last = messages[messages.length - 1] ?? '';
    renderer.print(1, row, last.slice(0, renderer.cols - 2), COL_MSG, COL_STATUS_BG);
  }
}

// ── Status bar ────────────────────────────────────────────────────────────────

const HUNGER_LABELS: Record<number, string> = {
  0: 'Satiated', 1: 'Not Hungry', 2: 'Hungry', 3: 'Weak', 4: 'Fainting', 5: 'Starved',
};

export function drawStatus(renderer: CanvasRenderer, gs: GameState): void {
  const p = gs.player;
  const baseRow = renderer.rows - STATUS_ROWS;

  renderer.fill(0, baseRow, renderer.cols, STATUS_ROWS, ' ', WHITE, COL_STATUS_BG);

  // Row 1: character name/role, dlvl, equipped weapon/armor summary
  const wpnName  = p.equip.weapon ? `${p.equip.weapon.name}${p.equip.weapon.enchantment !== 0 ? ` ${p.equip.weapon.enchantment > 0 ? '+' : ''}${p.equip.weapon.enchantment}` : ''}` : '–';
  const armName  = p.equip.armor  ? `${p.equip.armor.name}${p.equip.armor.enchantment  !== 0 ? ` ${p.equip.armor.enchantment  > 0 ? '+' : ''}${p.equip.armor.enchantment}`  : ''}` : '–';
  const roleName = ROLE_DATA[p.role]?.name ?? p.role;
  const raceName = RACE_DATA[p.race]?.name ?? p.race;
  const line1    = `${p.charName} the ${raceName} ${roleName}  Dlvl:${gs.dlvl}  Wpn:${wpnName}  Armor:${armName}`;
  renderer.print(1, baseRow, line1.slice(0, renderer.cols - 2), WHITE, COL_STATUS_BG);

  // Row 2: HP/Max, AC, full stat block
  const hpColor = p.hp < p.maxHp * 0.33 ? COL_HP_LOW : COL_HP_GOOD;
  const hpPrefix = 'HP:';
  const hpVal    = `${p.hp}`;
  const hpMax    = `(${p.maxHp})`;
  let col2 = 1;
  renderer.print(col2, baseRow+1, hpPrefix, WHITE, COL_STATUS_BG); col2 += hpPrefix.length;
  renderer.print(col2, baseRow+1, hpVal,    hpColor, COL_STATUS_BG); col2 += hpVal.length;
  renderer.print(col2, baseRow+1, hpMax,    GRAY,    COL_STATUS_BG); col2 += hpMax.length;
  const statsLine = `  AC:${p.effectiveAC}  Str:${p.str} Dex:${p.dex} Con:${p.con} Int:${p.int_} Wis:${p.wis} Cha:${p.cha}`;
  renderer.print(col2, baseRow+1, statsLine.slice(0, renderer.cols - col2 - 1), WHITE, COL_STATUS_BG);

  // Row 3: XL, XP, Gold, Hunger, status badges, Turns
  const statusBadges: string[] = [];
  if (p.blinded    > 0) statusBadges.push('[BLIND]');
  if (p.confused   > 0) statusBadges.push('[CONF]');
  if (p.levitating > 0) statusBadges.push('[LEV]');
  if (p.poisoned   > 0) statusBadges.push('[POIS]');
  if (p.sick       > 0) statusBadges.push('[SICK]');
  if (p.hasted     > 0) statusBadges.push('[FAST]');
  if (p.paralyzed  > 0) statusBadges.push('[PARA]');
  const statusStr = statusBadges.length > 0 ? '  ' + statusBadges.join(' ') : '';
  const hunger    = HUNGER_LABELS[p.hungerState] ?? '';
  const line3     = `XL:${p.xl}  XP:${p.xp}  $:${p.gold}  ${hunger}${statusStr}  T:${p.turns}`;
  renderer.print(1, baseRow+2, line3.slice(0, renderer.cols - 2), COL_XP, COL_STATUS_BG);
}

// ── Minimap ───────────────────────────────────────────────────────────────────

// 8-direction arrow that shows the player's facing direction on the minimap.
// angle=0 → east (→), increases clockwise toward south (↓), etc.
function playerArrow(angle: number): string {
  const a   = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const idx = Math.round(a / (Math.PI / 4)) % 8;
  return '→↘↓↙←↖↑↗'[idx];
}

const MAP_SIZE = 15;

export function drawMinimap(
  renderer: CanvasRenderer,
  level: DungeonLevel,
  player: Player,
  monsters: { x: number; y: number }[],
  items: { x: number; y: number }[],
  viewY: number, viewH: number,
): void {
  const mapStartCol = renderer.cols - MAP_SIZE - 1;
  const mapStartRow = viewY;

  const px = Math.round(player.x - 0.5);
  const py = Math.round(player.y - 0.5);
  const halfMap = Math.floor(MAP_SIZE / 2);

  const monSet = new Set(monsters.map(m => `${m.x},${m.y}`));
  const itemSet = new Set(items.map(i => `${i.x},${i.y}`));

  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      const wx = px - halfMap + col;
      const wy = py - halfMap + row;
      const cell = level.get(wx, wy);

      if (!cell || !cell.explored) {
        renderer.put(mapStartCol + col, mapStartRow + row, ' ', '#000000', '#000000');
        continue;
      }

      let ch = ' ', fg = '#000000', bg = '#000000';
      switch (cell.tile) {
        case Tile.WALL:        ch = '█'; fg = COL_MINIMAP_WALL;  bg = '#111122'; break;
        case Tile.FLOOR:       ch = '·'; fg = COL_MINIMAP_FLOOR; bg = '#001108'; break;
        case Tile.CORRIDOR:    ch = '·'; fg = '#335533';          bg = '#001108'; break;
        case Tile.DOOR_CLOSED: ch = '+'; fg = '#ddaa33';          bg = '#001108'; break;
        case Tile.DOOR_OPEN:   ch = '/'; fg = '#ddaa33';          bg = '#001108'; break;
        case Tile.STAIRS_DOWN: ch = '>'; fg = COL_STAIRS;         bg = '#001108'; break;
        case Tile.STAIRS_UP:   ch = '<'; fg = COL_STAIRS;         bg = '#001108'; break;
        default:               ch = ' '; fg = '#000000';           bg = '#000000'; break;
      }

      // Overlays
      if (wx === px && wy === py) { ch = playerArrow(player.angle); fg = COL_PLAYER; }
      else if (monSet.has(`${wx},${wy}`)) { ch = '!'; fg = COL_MONSTER_EASY; }
      else if (itemSet.has(`${wx},${wy}`)) { ch = '*'; fg = COL_ITEM; }

      renderer.put(mapStartCol + col, mapStartRow + row, ch, fg, bg);
    }
  }
}

// ── Inventory overlay ─────────────────────────────────────────────────────────

function eqLabel(item: import('./player').Item | null): string {
  if (!item) return '–';
  const enc = item.enchantment !== 0 ? ` ${item.enchantment > 0 ? '+' : ''}${item.enchantment}` : '';
  const charges = item.charges !== undefined ? ` (${item.charges})` : '';
  return `${item.name}${enc}${charges}`;
}

export function drawInventory(
  renderer: CanvasRenderer,
  player: Player,
  selectedIdx: number,
): void {
  const BG = '#001833';
  const W = Math.min(60, renderer.cols - 4);

  // Equipment section: 2 cols of 5 rows each (weapon/suit/helm/shield/cloak  +  ring_l/ring_r/boots/gloves/–)
  const EQ_ROWS = 6;   // header + 5 slot pairs
  const ITEM_ROWS = Math.min(player.inventory.length, renderer.rows - 4 - EQ_ROWS - 4);
  const H = EQ_ROWS + 4 + Math.max(ITEM_ROWS, 1);  // eq + dividers/headers + items
  const startCol = Math.floor((renderer.cols - W) / 2);
  const startRow = Math.max(0, Math.floor((renderer.rows - H) / 2));

  renderer.fill(startCol, startRow, W, H, ' ', WHITE, BG);

  // Title
  renderer.print(startCol + 2, startRow, '[ Inventory ]', YELLOW, BG);
  renderer.print(startCol + 2, startRow + 1, '[Enter] use/equip  [d] drop  [z] zap wand', GRAY, BG);

  // ── Equipment slots ──────────────────────────────────────────────────────
  let r = startRow + 2;
  renderer.print(startCol + 2, r, '── Equipment ──────────────────────────────────────────', GRAY, BG);
  r++;

  const half = Math.floor(W / 2) - 2;
  const slots: [string, import('./player').Item | null][] = [
    ['Weapon', player.equip.weapon],
    ['Armor',  player.equip.armor],
    ['Helm',   player.equip.helm],
    ['Shield', player.equip.shield],
    ['Cloak',  player.equip.cloak],
  ];
  const slotsR: [string, import('./player').Item | null][] = [
    ['Ring L', player.equip.ring_left],
    ['Ring R', player.equip.ring_right],
    ['Boots',  player.equip.boots],
    ['Gloves', player.equip.gloves],
    ['',       null],
  ];
  for (let i = 0; i < slots.length; i++) {
    const [lbl, item] = slots[i];
    const [lbl2, item2] = slotsR[i];
    const left  = lbl  ? `${lbl.padEnd(7)}: ${eqLabel(item)}`  : '';
    const right = lbl2 ? `${lbl2.padEnd(7)}: ${eqLabel(item2)}` : '';
    renderer.print(startCol + 2,        r, left.slice(0, half),  item  ? WHITE : GRAY, BG);
    renderer.print(startCol + 2 + half, r, right.slice(0, half), item2 ? WHITE : GRAY, BG);
    r++;
  }

  // ── Item list ─────────────────────────────────────────────────────────────
  renderer.print(startCol + 2, r, '── Pack ────────────────────────────────────────────────', GRAY, BG);
  r++;

  if (player.inventory.length === 0) {
    renderer.print(startCol + 4, r, '(empty)', GRAY, BG);
    r++;
  }

  for (let i = 0; i < player.inventory.length; i++) {
    if (r >= startRow + H - 1) break;
    const item = player.inventory[i];
    const sel  = i === selectedIdx;
    const bg   = sel ? '#003366' : BG;
    const enc  = item.enchantment !== 0 ? ` ${item.enchantment > 0 ? '+' : ''}${item.enchantment}` : '';
    const chg  = item.charges !== undefined ? ` (${item.charges} charges)` : '';
    const label = `${String.fromCharCode(97 + i)}) ${item.name}${enc}${chg}`;
    renderer.fill(startCol + 1, r, W - 2, 1, ' ', WHITE, bg);
    renderer.print(startCol + 2, r, label.slice(0, W - 4), sel ? YELLOW : WHITE, bg);
    r++;
  }
}

// ── Title screen ──────────────────────────────────────────────────────────────

export function drawTitle(renderer: CanvasRenderer): void {
  renderer.fill(0, 0, renderer.cols, renderer.rows, ' ', WHITE, '#000000');
  const lines = [
    '███╗   ██╗███████╗████████╗██╗  ██╗ █████╗  ██████╗██╗  ██╗',
    '████╗  ██║██╔════╝╚══██╔══╝██║  ██║██╔══██╗██╔════╝██║ ██╔╝',
    '██╔██╗ ██║█████╗     ██║   ███████║███████║██║     █████╔╝ ',
    '██║╚██╗██║██╔══╝     ██║   ██╔══██║██╔══██║██║     ██╔═██╗ ',
    '██║ ╚████║███████╗   ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗',
    '╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝',
    '',
    '              F P S  E D I T I O N',
  ];
  const startRow = Math.floor(renderer.rows / 2) - Math.floor(lines.length / 2) - 3;
  for (let i = 0; i < lines.length; i++) {
    const col = Math.floor((renderer.cols - lines[i].length) / 2);
    renderer.print(Math.max(0, col), startRow + i, lines[i], GREEN);
  }
  const instrRow = startRow + lines.length + 2;
  const instr = 'Press [Enter] or [Space] to start';
  renderer.print(Math.floor((renderer.cols - instr.length) / 2), instrRow, instr, YELLOW);
  const ctrl = 'WASD / vi-keys: move   Mouse: look   , pickup   i inventory   z zap wand   > down   < up   ? help   Q quit';
  renderer.print(Math.max(0, Math.floor((renderer.cols - ctrl.length) / 2)), instrRow + 2, ctrl.slice(0, renderer.cols - 2), GRAY);
}

// ── Death screen ──────────────────────────────────────────────────────────────

export function drawDeath(renderer: CanvasRenderer, gs: GameState): void {
  renderer.fill(0, 0, renderer.cols, renderer.rows, ' ', WHITE, '#110000');
  const lines = [
    '██████╗ ██╗███████╗██████╗ ',
    '██╔══██╗██║██╔════╝██╔══██╗',
    '██║  ██║██║█████╗  ██║  ██║',
    '██║  ██║██║██╔══╝  ██║  ██║',
    '██████╔╝██║███████╗██████╔╝',
    '╚═════╝ ╚═╝╚══════╝╚═════╝ ',
  ];
  const r0 = Math.floor(renderer.rows / 2) - 6;
  for (let i = 0; i < lines.length; i++) {
    const col = Math.floor((renderer.cols - lines[i].length) / 2);
    renderer.print(col, r0 + i, lines[i], RED);
  }
  const p = gs.player;
  const roleName2 = ROLE_DATA[p.role]?.name ?? p.role;
  const raceName2 = RACE_DATA[p.race]?.name ?? p.race;
  const charDesc  = `${p.charName} the ${raceName2} ${roleName2} (${p.alignment})`;
  renderer.print(Math.floor((renderer.cols - charDesc.length) / 2), r0 + lines.length, charDesc, WHITE);
  const stats  = `Dlvl ${gs.dlvl}  XL ${p.xl}  XP ${p.xp}  Gold ${p.gold}  Turns ${gs.turns}`;
  const stats2 = `Str:${p.str} Dex:${p.dex} Con:${p.con} Int:${p.int_} Wis:${p.wis} Cha:${p.cha}  HP:${p.hp}/${p.maxHp}  AC:${p.effectiveAC}`;
  renderer.print(Math.floor((renderer.cols - stats.length)  / 2), r0 + lines.length + 1, stats,  YELLOW);
  renderer.print(Math.floor((renderer.cols - stats2.length) / 2), r0 + lines.length + 2, stats2, WHITE);
  const lastMsg = gs.messages[gs.messages.length - 1] ?? '';
  renderer.print(Math.floor((renderer.cols - lastMsg.length) / 2), r0 + lines.length + 3, lastMsg, GRAY);
  const again = 'Press [Enter] or [Space] to play again  [Q] to quit';
  renderer.print(Math.floor((renderer.cols - again.length) / 2), r0 + lines.length + 5, again, GRAY);
}

// ── Win screen ────────────────────────────────────────────────────────────────

export function drawWin(renderer: CanvasRenderer, gs: GameState): void {
  renderer.fill(0, 0, renderer.cols, renderer.rows, ' ', WHITE, '#001100');
  const msg = 'You have retrieved the Amulet of Yendor!';
  const msg2 = 'You ascend to the surface... and win!';
  const cr = Math.floor(renderer.rows / 2);
  const col1 = Math.floor((renderer.cols - msg.length) / 2);
  const col2 = Math.floor((renderer.cols - msg2.length) / 2);
  renderer.print(col1, cr - 1, msg,  YELLOW);
  renderer.print(col2, cr,     msg2, GREEN);
  const stats = `XL ${gs.player.xl}  XP ${gs.player.xp}  Gold ${gs.player.gold}  Turns ${gs.turns}`;
  renderer.print(Math.floor((renderer.cols - stats.length) / 2), cr + 2, stats, WHITE);
  const again = 'Press [Enter] to play again';
  renderer.print(Math.floor((renderer.cols - again.length) / 2), cr + 4, again, GRAY);
}

// ── Help overlay ──────────────────────────────────────────────────────────────

export function drawHelp(renderer: CanvasRenderer): void {
  const W  = Math.min(72, renderer.cols - 4);
  const H  = 32;
  const sc = Math.floor((renderer.cols - W) / 2);
  const sr = Math.max(0, Math.floor((renderer.rows - H) / 2));
  const BG = '#001428';

  renderer.fill(sc, sr, W, H, ' ', WHITE, BG);

  // Title
  const title = '[ NETHACKFPS  HELP ]';
  renderer.print(sc + Math.floor((W - title.length) / 2), sr, title, YELLOW, BG);
  renderer.print(sc + 1, sr + 1, '─'.repeat(W - 2), GRAY, BG);

  const L = sc + 2;
  const R = sc + Math.floor(W / 2) + 1;

  // ── Left column ──────────────────────────────────────────────────────────
  let lr = sr + 2;

  renderer.print(L, lr++, 'MOVEMENT', YELLOW, BG);
  const moves: [string, string][] = [
    ['W / K',   'Move forward'],
    ['S / J',   'Move backward'],
    ['A / H',   'Strafe left'],
    ['D / L',   'Strafe right'],
    ['← / Q',   'Rotate left'],
    ['→ / E',   'Rotate right'],
    ['Mouse',   'Look (yaw + pitch)'],
  ];
  for (const [key, desc] of moves) {
    renderer.print(L,      lr,   key.padEnd(10), GREEN, BG);
    renderer.print(L + 10, lr++, desc,           WHITE, BG);
  }

  lr++;
  renderer.print(L, lr++, 'ACTIONS', YELLOW, BG);
  const actions: [string, string][] = [
    [',',  'Pick up item'],
    ['i',  'Inventory / equip / use'],
    ['z',  'Zap first wand in pack'],
    ['.',  'Wait one turn'],
    ['>',  'Descend stairs'],
    ['<',  'Ascend stairs (need Amulet on lvl 1)'],
    ['?',  'This help screen'],
    ['Q',  'Quit'],
  ];
  for (const [key, desc] of actions) {
    renderer.print(L,      lr,   key.padEnd(10), GREEN, BG);
    renderer.print(L + 10, lr++, desc,           WHITE, BG);
  }

  lr++;
  renderer.print(L, lr++, 'INVENTORY', YELLOW, BG);
  const invKeys: [string, string][] = [
    ['↑ / ↓',  'Select item'],
    ['Enter',  'Use / equip / wield'],
    ['d',      'Drop item'],
    ['Esc',    'Close inventory'],
  ];
  for (const [key, desc] of invKeys) {
    renderer.print(L,      lr,   key.padEnd(10), GREEN, BG);
    renderer.print(L + 10, lr++, desc,           WHITE, BG);
  }

  // ── Right column ─────────────────────────────────────────────────────────
  let rr = sr + 2;

  renderer.print(R, rr++, 'ITEM TYPES', YELLOW, BG);
  const items: [string, string, string][] = [
    [')',  COL_ITEM,  'Weapon  – wield for better damage'],
    ['[',  COL_ITEM,  'Armor   – wear to reduce damage taken'],
    ['%',  COL_ITEM,  'Food    – eat to stave off hunger'],
    ['!',  COL_ITEM,  'Potion  – drink for magical effects'],
    ['?',  COL_ITEM,  'Scroll  – read for magical effects'],
    ['=',  COL_RING,  'Ring    – equip L/R finger for passive bonus'],
    ['/',  COL_WAND,  'Wand    – zap [z] to fire a beam effect'],
    ['$',  COL_GOLD,  'Gold    – collected automatically'],
    ['"',  '#ffee88', 'Amulet  – bring to surface level to win!'],
  ];
  for (const [sym, color, desc] of items) {
    renderer.print(R,      rr,   sym.padEnd(4), color, BG);
    renderer.print(R +  4, rr++, desc,          WHITE, BG);
  }

  rr++;
  renderer.print(R, rr++, 'STATUS EFFECTS', YELLOW, BG);
  const effects: [string, string][] = [
    ['[BLIND]', 'Cannot see (turns remaining)'],
    ['[CONF]',  'Confused — movement may misfire'],
    ['[POIS]',  'Poisoned — slow HP drain'],
    ['[SICK]',  'Sick — HP drain, curable by potion'],
    ['[LEV]',   'Levitating — cannot descend stairs'],
    ['[FAST]',  'Hasted — extra actions per turn'],
    ['[PARA]',  'Paralyzed — skip your turns'],
  ];
  for (const [badge, desc] of effects) {
    renderer.print(R,          rr,   badge.padEnd(9), RED,   BG);
    renderer.print(R + 9, rr++, desc,                 WHITE, BG);
  }

  rr++;
  renderer.print(R, rr++, 'MINIMAP', YELLOW, BG);
  const legend: [string, string, string][] = [
    ['→↘↓↙←↖↑↗', COL_PLAYER,       'You (facing)'],
    ['!',          COL_MONSTER_EASY, 'Monster nearby'],
    ['*',          COL_ITEM,         'Item on floor'],
    ['>',          COL_STAIRS,       'Stairs down'],
    ['<',          COL_STAIRS,       'Stairs up'],
    ['+',          '#ddaa33',        'Closed door'],
  ];
  for (const [sym, color, desc] of legend) {
    renderer.print(R,      rr,   sym.slice(0, 3).padEnd(4), color, BG);
    renderer.print(R +  4, rr++, desc,                       WHITE, BG);
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const fr = sr + H - 3;
  renderer.print(sc + 1, fr,     '─'.repeat(W - 2), GRAY, BG);
  renderer.print(sc + 2, fr + 1, 'Walk into closed doors to open them.  Wear armor to reduce AC.  [?] to close', GRAY, BG);
}

// ── Exploration update (Bresenham LOS) ────────────────────────────────────────

export function updateExplored(level: DungeonLevel, player: Player): void {
  const px = Math.round(player.x - 0.5);
  const py = Math.round(player.y - 0.5);
  const radius = 8;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const tx = px + dx, ty = py + dy;
      const cell = level.get(tx, ty);
      if (!cell) continue;
      if (hasLOS(level, px, py, tx, ty)) {
        cell.explored = true;
        cell.visible  = true;
      } else {
        cell.visible = false;
      }
    }
  }
}

// ── Full map overlay ──────────────────────────────────────────────────────────

export function drawFullMap(
  renderer: CanvasRenderer,
  level: DungeonLevel,
  dlvl: number,
  player: Player,
  monsters: { x: number; y: number }[],
  items: { x: number; y: number }[],
): void {
  const BG = '#000000';
  renderer.fill(0, 0, renderer.cols, renderer.rows, ' ', BG, BG);

  const mapW = level.width;   // 80
  const mapH = level.height;  // 40

  // Centre map; row 0 reserved for title bar
  const mapOffsetX = Math.max(0, Math.floor((renderer.cols - mapW) / 2));
  const mapOffsetY = Math.max(1, Math.floor((renderer.rows - mapH - 1) / 2) + 1);

  // Title bar
  const title = `  Dungeon Level ${dlvl}  `;
  const titleX = Math.floor((renderer.cols - title.length) / 2);
  renderer.fill(0, 0, renderer.cols, 1, ' ', '#aaddff', '#001833');
  renderer.print(Math.max(0, titleX), 0, title, '#aaddff', '#001833');

  const monSet  = new Set(monsters.map(m => `${m.x},${m.y}`));
  const itemSet = new Set(items.map(i => `${i.x},${i.y}`));
  const px = Math.round(player.x - 0.5);
  const py = Math.round(player.y - 0.5);

  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const sx = mapOffsetX + x;
      const sy = mapOffsetY + y;
      if (sx >= renderer.cols || sy >= renderer.rows) continue;

      const cell = level.get(x, y);
      if (!cell || !cell.explored) {
        renderer.put(sx, sy, ' ', BG, BG);
        continue;
      }

      // Dim unexplored-but-known vs currently visible
      const dim = !cell.visible;
      let ch = ' ', fg = BG, bg = '#000811';

      switch (cell.tile) {
        case Tile.WALL:        ch = '█'; fg = dim ? '#333344' : COL_MINIMAP_WALL;  bg = dim ? '#0a0a18' : '#111122'; break;
        case Tile.FLOOR:       ch = '·'; fg = dim ? '#1a3322' : COL_MINIMAP_FLOOR; bg = '#000811'; break;
        case Tile.CORRIDOR:    ch = '·'; fg = dim ? '#1a2a1a' : '#335533';          bg = '#000811'; break;
        case Tile.DOOR_CLOSED: ch = '+'; fg = dim ? '#886600' : '#ddaa33';          bg = '#000811'; break;
        case Tile.DOOR_OPEN:   ch = '/'; fg = dim ? '#886600' : '#ddaa33';          bg = '#000811'; break;
        case Tile.STAIRS_DOWN: ch = '>'; fg = COL_STAIRS;                            bg = '#000811'; break;
        case Tile.STAIRS_UP:   ch = '<'; fg = COL_STAIRS;                            bg = '#000811'; break;
        default:               ch = ' '; fg = BG; bg = BG; break;
      }

      // Overlays (only show monsters/items in visible cells)
      if (x === px && y === py) {
        ch = playerArrow(player.angle); fg = COL_PLAYER; bg = '#001108';
      } else if (cell.visible && monSet.has(`${x},${y}`)) {
        ch = '!'; fg = COL_MONSTER_EASY;
      } else if (cell.visible && itemSet.has(`${x},${y}`)) {
        ch = '*'; fg = COL_ITEM;
      }

      renderer.put(sx, sy, ch, fg, bg);
    }
  }
}

// ── Character creator ──────────────────────────────────────────────────────────

export type CharGenStep = 'role' | 'race' | 'alignment' | 'confirm';

export function drawCharGen(
  renderer: CanvasRenderer,
  step: CharGenStep,
  cursor: number,
  roleKey: string,
  raceKey: string,
  alignment: Alignment | '',
  charName: string,
  gender: 'male' | 'female',
): void {
  const BG  = '#000c1a';
  const BG2 = '#001228';
  renderer.fill(0, 0, renderer.cols, renderer.rows, ' ', WHITE, BG);

  const role    = ROLE_DATA[roleKey];
  const race    = RACE_DATA[raceKey];
  const roleKeys = Object.keys(ROLE_DATA);
  const raceKeys = Object.keys(RACE_DATA);

  // Title bar
  const titles: Record<CharGenStep, string> = {
    role:      'CHOOSE YOUR ROLE',
    race:      'CHOOSE YOUR RACE',
    alignment: 'CHOOSE YOUR ALIGNMENT',
    confirm:   'YOUR CHARACTER',
  };
  const title = `[ ${titles[step]} ]`;
  renderer.fill(0, 0, renderer.cols, 1, ' ', YELLOW, '#001833');
  renderer.print(Math.floor((renderer.cols - title.length) / 2), 0, title, YELLOW, '#001833');

  const leftW  = 26;
  const leftCol = Math.max(2, Math.floor(renderer.cols / 2) - leftW - 2);
  const rightCol = leftCol + leftW + 3;
  const rightW  = Math.min(48, renderer.cols - rightCol - 2);
  let   row    = 3;

  // ── Left panel: option list ──────────────────────────────────────────────
  if (step === 'role') {
    for (let i = 0; i < roleKeys.length; i++) {
      const rk  = roleKeys[i];
      const sel = i === cursor;
      const bg  = sel ? '#003366' : BG;
      const fg  = sel ? YELLOW    : WHITE;
      const mark = sel ? '>' : ' ';
      renderer.fill(leftCol, row + i, leftW, 1, ' ', fg, bg);
      renderer.print(leftCol, row + i, `${mark} ${ROLE_DATA[rk].name}`, fg, bg);
    }
    renderer.print(leftCol, row + roleKeys.length + 1, '  [R] Random character', GRAY, BG);

  } else if (step === 'race') {
    // Filter races compatible with selected role alignment
    const roleAligns = new Set(role?.alignments ?? []);
    for (let i = 0; i < raceKeys.length; i++) {
      const rk  = raceKeys[i];
      const rd  = RACE_DATA[rk];
      const compat = rd.alignments.some(a => roleAligns.has(a));
      const sel = i === cursor;
      const bg  = sel ? '#003366' : BG;
      const fg  = sel ? YELLOW : (compat ? WHITE : GRAY);
      const mark = sel ? '>' : ' ';
      renderer.fill(leftCol, row + i, leftW, 1, ' ', fg, bg);
      renderer.print(leftCol, row + i, `${mark} ${rd.name}${compat ? '' : ' (incompatible)'}`, fg, bg);
    }
    renderer.print(leftCol, row + raceKeys.length + 1, '  [R] Random', GRAY, BG);

  } else if (step === 'alignment') {
    // Only show alignments valid for role+race combo
    const roleAligns   = new Set(role?.alignments ?? []);
    const raceAligns   = new Set(race?.alignments ?? []);
    const validAligns  = (['lawful','neutral','chaotic'] as Alignment[]).filter(
      a => roleAligns.has(a) && raceAligns.has(a)
    );
    for (let i = 0; i < validAligns.length; i++) {
      const a   = validAligns[i];
      const sel = i === cursor;
      const bg  = sel ? '#003366' : BG;
      const fg  = sel ? YELLOW : WHITE;
      const mark = sel ? '>' : ' ';
      renderer.fill(leftCol, row + i, leftW, 1, ' ', fg, bg);
      const label = a.charAt(0).toUpperCase() + a.slice(1);
      renderer.print(leftCol, row + i, `${mark} ${label}`, fg, bg);
    }
    renderer.print(leftCol, row + validAligns.length + 1, '  [R] Random', GRAY, BG);

  } else if (step === 'confirm') {
    // Summary panel
    renderer.fill(leftCol - 1, row - 1, leftW + 2, 14, ' ', WHITE, BG2);
    renderer.print(leftCol, row,     `Name:      ${charName}`, WHITE, BG2);
    renderer.print(leftCol, row + 1, `Role:      ${ROLE_DATA[roleKey]?.name ?? roleKey}`, YELLOW, BG2);
    renderer.print(leftCol, row + 2, `Race:      ${RACE_DATA[raceKey]?.name ?? raceKey}`, WHITE, BG2);
    renderer.print(leftCol, row + 3, `Alignment: ${alignment.charAt(0).toUpperCase() + alignment.slice(1)}`, WHITE, BG2);
    renderer.print(leftCol, row + 4, `Gender:    ${gender.charAt(0).toUpperCase() + gender.slice(1)}`, WHITE, BG2);
    if (role && race) {
      const s = role.baseStats.map((b, i) => Math.max(3, b + race.statMods[i]));
      renderer.print(leftCol, row + 6,  `STR:${String(s[0]).padEnd(4)} INT:${String(s[1]).padEnd(4)} WIS:${s[2]}`, GREEN, BG2);
      renderer.print(leftCol, row + 7,  `DEX:${String(s[3]).padEnd(4)} CON:${String(s[4]).padEnd(4)} CHA:${s[5]}`, GREEN, BG2);
      renderer.print(leftCol, row + 8,  `HP:  ${role.hpStart}`, COL_HP_GOOD, BG2);
      renderer.print(leftCol, row + 9,  `AC:  ${10 + (ARMOR_DATA[role.startArmor ?? '']?.acBonus ?? 0)}`, WHITE, BG2);
      const wpn = role.startWeapon;
      renderer.print(leftCol, row + 11, `Starts with: ${wpn.replace(/_/g,' ')}${role.startArmor ? ', ' + role.startArmor.replace(/_/g,' ') : ''}`, GRAY, BG2);
    }
    renderer.print(leftCol, row + 13, `[Enter] Begin Adventure`, YELLOW, BG2);
    renderer.print(leftCol, row + 14, `[Esc]   Back`,            GRAY,   BG2);
  }

  // ── Right panel: description + stats preview ────────────────────────────
  if (step !== 'confirm') {
    renderer.fill(rightCol - 1, row - 1, rightW + 2, 16, ' ', WHITE, BG2);

    let desc = '';
    let stats: number[] = [0,0,0,0,0,0];
    let hpStart = 0;
    let aligns: string[] = [];
    let prevRole = '', prevRace = '';

    if (step === 'role') {
      const rk   = roleKeys[cursor] ?? roleKey;
      const rd   = ROLE_DATA[rk];
      const rcD  = RACE_DATA['human'];
      desc       = rd?.description ?? '';
      stats      = rd ? rd.baseStats.map((b, i) => Math.max(3, b + rcD.statMods[i])) : [];
      hpStart    = rd?.hpStart ?? 0;
      aligns     = rd?.alignments.map(a => a.charAt(0).toUpperCase() + a.slice(1)) ?? [];
      prevRole   = ROLE_DATA[rk]?.name ?? '';
    } else if (step === 'race') {
      const rk   = raceKeys[cursor] ?? raceKey;
      const rd   = RACE_DATA[rk];
      const rl   = ROLE_DATA[roleKey];
      desc       = rd?.description ?? '';
      stats      = rl && rd ? rl.baseStats.map((b, i) => Math.max(3, b + rd.statMods[i])) : [];
      hpStart    = rl?.hpStart ?? 0;
      aligns     = rd?.alignments.map(a => a.charAt(0).toUpperCase() + a.slice(1)) ?? [];
      prevRole   = ROLE_DATA[roleKey]?.name ?? '';
      prevRace   = RACE_DATA[rk]?.name ?? '';
    } else if (step === 'alignment') {
      const rl   = ROLE_DATA[roleKey];
      const rc   = RACE_DATA[raceKey];
      desc       = `Choose ${charName}'s moral alignment. This affects how the dungeon denizens react to you and your interactions with altars.`;
      stats      = rl && rc ? rl.baseStats.map((b, i) => Math.max(3, b + rc.statMods[i])) : [];
      hpStart    = rl?.hpStart ?? 0;
      prevRole   = ROLE_DATA[roleKey]?.name ?? '';
      prevRace   = RACE_DATA[raceKey]?.name ?? '';
    }

    // Wrap description
    const words  = desc.split(' ');
    let   line   = '';
    let   dRow   = row;
    for (const word of words) {
      if (line.length + word.length + 1 > rightW) {
        renderer.print(rightCol, dRow++, line, WHITE, BG2);
        line = word;
      } else {
        line = line ? line + ' ' + word : word;
      }
    }
    if (line) renderer.print(rightCol, dRow++, line, WHITE, BG2);

    dRow = row + 5;
    if (prevRole) renderer.print(rightCol, dRow++, `Role: ${prevRole}${prevRace ? '  Race: '+prevRace : ''}`, GRAY, BG2);
    if (stats.length === 6) {
      renderer.print(rightCol, dRow++, `STR:${String(stats[0]).padEnd(4)} INT:${String(stats[1]).padEnd(4)} WIS:${stats[2]}`, GREEN, BG2);
      renderer.print(rightCol, dRow++, `DEX:${String(stats[3]).padEnd(4)} CON:${String(stats[4]).padEnd(4)} CHA:${stats[5]}`, GREEN, BG2);
      if (hpStart) renderer.print(rightCol, dRow++, `Starting HP: ${hpStart}`, COL_HP_GOOD, BG2);
    }
    if (aligns.length) renderer.print(rightCol, dRow++, `Alignments: ${aligns.join(', ')}`, YELLOW, BG2);
  }

  // Footer
  const footRow = renderer.rows - 2;
  renderer.fill(0, footRow, renderer.cols, 1, ' ', GRAY, '#001833');
  const footer = step === 'confirm'
    ? '[Enter] Begin   [Esc] Back'
    : '[↑↓] Select   [Enter] Confirm   [R] Random character   [Esc] Back';
  renderer.print(Math.floor((renderer.cols - footer.length) / 2), footRow, footer, GRAY, '#001833');
}

function hasLOS(level: DungeonLevel, x0: number, y0: number, x1: number, y1: number): boolean {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;
  while (true) {
    if (cx === x1 && cy === y1) return true;
    const t = level.tile(cx, cy);
    if (t === Tile.WALL || t === Tile.VOID) return false;
    if (t === Tile.DOOR_CLOSED && !(cx === x0 && cy === y0)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 <  dx) { err += dx; cy += sy; }
  }
}
