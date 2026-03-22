import { Player } from './player';
import { Monster, monsterAttack, playerAttack, spawnMonster as spawnMonsterRaw } from './combat';
import { DungeonLevel } from './dungeon';
import { PASSABLE_TILES, Tile } from './constants';
import { MONSTER_DATA, MonsterTemplate } from './data';

export type { Monster };

// ── LOS (Bresenham) ───────────────────────────────────────────────────────────

function hasLOS(level: DungeonLevel, x0: number, y0: number, x1: number, y1: number): boolean {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0, cy = y0;
  while (true) {
    if (cx === x1 && cy === y1) return true;
    const t = level.tile(cx, cy);
    if (t === Tile.WALL || t === Tile.DOOR_CLOSED || t === Tile.VOID) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 <  dx) { err += dx; cy += sy; }
  }
}

// ── Greedy pathfinding ────────────────────────────────────────────────────────

const DIRS: [number, number][] = [[0,-1],[0,1],[-1,0],[1,0]];

function pathfindStep(level: DungeonLevel, mx: number, my: number, tx: number, ty: number): [number, number] {
  let best: [number, number] = [mx, my];
  let bestDist = Infinity;
  for (const [dx, dy] of DIRS) {
    const nx = mx + dx, ny = my + dy;
    if (!level.isPassable(nx, ny) && !(nx === tx && ny === ty)) continue;
    const dist = Math.abs(nx - tx) + Math.abs(ny - ty);
    if (dist < bestDist) { bestDist = dist; best = [nx, ny]; }
  }
  return best;
}

// ── Monster AI ────────────────────────────────────────────────────────────────

export function actMonster(
  monster: Monster,
  player:  Player,
  level:   DungeonLevel,
  monsters: Monster[],
): string[] {
  const msgs: string[] = [];
  const px = Math.round(player.x - 0.5);
  const py = Math.round(player.y - 0.5);
  const dist = Math.abs(monster.x - px) + Math.abs(monster.y - py);

  // Troll regeneration
  if (monster.flags.has('regenerate')) {
    monster.regenTimer++;
    if (monster.regenTimer >= 3) {
      monster.regenTimer = 0;
      monster.hp = Math.min(monster.hp + 1, monster.maxHp);
    }
  }

  // Wake up
  if (!monster.awake) {
    if (dist <= 5 && hasLOS(level, monster.x, monster.y, px, py)) {
      monster.awake = true;
      monster.targetX = px;
      monster.targetY = py;
    } else {
      return msgs;
    }
  }

  // Update target if LOS
  if (hasLOS(level, monster.x, monster.y, px, py)) {
    monster.targetX = px;
    monster.targetY = py;
  }

  // Adjacent attack
  if (Math.abs(monster.x - px) + Math.abs(monster.y - py) === 1) {
    const { msg, dead } = monsterAttack(monster, player);
    if (msg) msgs.push(msg);
    if (dead) msgs.push('__PLAYER_DEAD__');
    return msgs;
  }

  // Floating eye: passive only
  if (monster.flags.has('passive_paralyze')) return msgs;

  // Move toward target
  const occupied = new Set(monsters.map(m => `${m.x},${m.y}`));
  const [nx, ny] = pathfindStep(level, monster.x, monster.y, monster.targetX, monster.targetY);
  if (nx !== monster.x || ny !== monster.y) {
    if (!occupied.has(`${nx},${ny}`) && !(nx === px && ny === py)) {
      monster.x = nx;
      monster.y = ny;
    }
  }

  return msgs;
}

// ── Spawning ──────────────────────────────────────────────────────────────────

// NetHack-authentic difficulty-window monster selection
export function rndMonster(dlvl: number, playerLevel: number): string {
  const minDiff = Math.floor(dlvl / 6);
  const maxDiff = Math.floor((dlvl + playerLevel) / 2);

  // Build weighted pool from MONSTER_DATA
  const pool: { key: string; weight: number }[] = [];
  for (const [key, m] of Object.entries(MONSTER_DATA)) {
    if (m.difficulty < minDiff || m.difficulty > maxDiff) continue;
    if (m.freq === 0) continue;
    pool.push({ key, weight: m.freq });
  }

  if (pool.length === 0) {
    // Fallback: pick from all monsters, weighted by how close they are to mid-range
    const mid = Math.floor((minDiff + maxDiff) / 2);
    for (const [key, m] of Object.entries(MONSTER_DATA)) {
      const dist = Math.abs(m.difficulty - mid);
      const weight = Math.max(1, 5 - dist);
      pool.push({ key, weight });
    }
  }

  // Weighted random pick
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let roll = Math.floor(Math.random() * total);
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll < 0) return entry.key;
  }
  return pool[pool.length - 1].key;
}

// Place one monster on a random passable tile; optionally keep distance from player
function placeMonster(
  key: string,
  level: DungeonLevel,
  player?: { x: number; y: number },
): Monster | null {
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = Math.floor(Math.random() * level.width);
    const y = Math.floor(Math.random() * level.height);
    if (!level.isPassable(x, y)) continue;
    if (player !== undefined) {
      const px = Math.round(player.x - 0.5);
      const py = Math.round(player.y - 0.5);
      if (Math.abs(x - px) + Math.abs(y - py) < 3) continue;
    }
    return spawnMonsterRaw(key, x, y);
  }
  return null;
}

export function populateLevel(level: DungeonLevel, dlvl: number, playerLevel = 1): Monster[] {
  const monsters: Monster[] = [];
  const count = 4 + Math.floor(dlvl / 2) + Math.floor(Math.random() * 4);

  for (let i = 0; i < count; i++) {
    const key = rndMonster(dlvl, playerLevel);
    const data = MONSTER_DATA[key];
    if (!data) continue;

    // Group spawning
    let groupSize = 1;
    if (data.group === 'small') groupSize = 1 + Math.floor(Math.random() * 3);
    else if (data.group === 'large') groupSize = 2 + Math.floor(Math.random() * 6);
    // Scale down at low depth
    if (dlvl < 3) groupSize = Math.max(1, Math.floor(groupSize / 2));

    for (let g = 0; g < groupSize; g++) {
      const m = placeMonster(key, level);
      if (m) monsters.push(m);
    }
  }
  return monsters;
}

export function trySpawnRandom(level: DungeonLevel, dlvl: number, player: Player, playerLevel = 1): Monster | null {
  const key = rndMonster(dlvl, playerLevel);
  const data = MONSTER_DATA[key];
  if (!data) return null;
  return placeMonster(key, level, player);
}
