import { ItemType } from './constants';
import { Item, makeItemId, rollDice } from './player';
import {
  WEAPON_DATA, ARMOR_DATA, FOOD_DATA, POTION_DATA, SCROLL_DATA, RING_DATA, WAND_DATA,
  POTION_COLORS, POTION_COLOR_HEX, SCROLL_LABELS, RING_ADJECTIVES, WAND_MATERIALS,
} from './data';
import { COL_ITEM } from './constants';
import { DungeonLevel } from './dungeon';
import { WIN_LEVEL } from './constants';

export type { Item };

// ── Identification system ─────────────────────────────────────────────────────

export class IdentificationSystem {
  potionAppearance: Record<string, string> = {};
  potionColorHex:   Record<string, string> = {};
  scrollAppearance: Record<string, string> = {};
  ringAppearance:   Record<string, string> = {};
  wandAppearance:   Record<string, string> = {};
  knownPotions = new Set<string>();
  knownScrolls = new Set<string>();
  knownRings   = new Set<string>();
  knownWands   = new Set<string>();

  constructor() {
    const colors    = shuffle([...POTION_COLORS]);
    const labels    = shuffle([...SCROLL_LABELS]);
    const radj      = shuffle([...RING_ADJECTIVES]);
    const wmats     = shuffle([...WAND_MATERIALS]);
    let ci = 0, li = 0, ri = 0, wi = 0;
    for (const key of Object.keys(POTION_DATA)) {
      const colorName = colors[ci++] ?? 'murky';
      this.potionAppearance[key] = colorName + ' potion';
      this.potionColorHex[key]   = POTION_COLOR_HEX[colorName] ?? COL_ITEM;
    }
    for (const key of Object.keys(SCROLL_DATA)) this.scrollAppearance[key] = `scroll labeled "${labels[li++] ?? 'UNKNOWN'}"`;
    for (const key of Object.keys(RING_DATA))   this.ringAppearance[key]   = (radj[ri++] ?? 'plain') + ' ring';
    for (const key of Object.keys(WAND_DATA))   this.wandAppearance[key]   = (wmats[wi++] ?? 'wooden') + ' wand';
  }

  identify(type: 'potion' | 'scroll' | 'ring' | 'wand', key: string): void {
    if      (type === 'potion') this.knownPotions.add(key);
    else if (type === 'scroll') this.knownScrolls.add(key);
    else if (type === 'ring')   this.knownRings.add(key);
    else                        this.knownWands.add(key);
  }

  namePotion(key: string): string {
    if (this.knownPotions.has(key)) return POTION_DATA[key].name;
    return this.potionAppearance[key] ?? key;
  }

  nameScroll(key: string): string {
    if (this.knownScrolls.has(key)) return SCROLL_DATA[key].name;
    return this.scrollAppearance[key] ?? key;
  }

  nameRing(key: string): string {
    if (this.knownRings.has(key)) return RING_DATA[key].name;
    return this.ringAppearance[key] ?? key;
  }

  nameWand(key: string): string {
    if (this.knownWands.has(key)) return WAND_DATA[key].name;
    return this.wandAppearance[key] ?? key;
  }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Item constructors ─────────────────────────────────────────────────────────

export function makeWeapon(key: string): Item {
  const d = WEAPON_DATA[key];
  return { id: makeItemId(), type: ItemType.WEAPON, key, count: 1,
    name: d.name, identified: true, enchantment: 0, isAmuletOfYendor: false,
    damage: d.damage };
}

export function makeArmor(key: string): Item {
  const d = ARMOR_DATA[key];
  return { id: makeItemId(), type: ItemType.ARMOR, key, count: 1,
    name: d.name, identified: true, enchantment: 0, isAmuletOfYendor: false };
}

export function makeFood(key: string): Item {
  const d = FOOD_DATA[key];
  return { id: makeItemId(), type: ItemType.FOOD, key, count: 1,
    name: d.name, identified: true, enchantment: 0, isAmuletOfYendor: false,
    nutrition: d.nutrition };
}

export function makePotion(key: string, idSys: IdentificationSystem): Item {
  const d = POTION_DATA[key];
  return { id: makeItemId(), type: ItemType.POTION, key, count: 1,
    name: idSys.namePotion(key), identified: idSys.knownPotions.has(key),
    enchantment: 0, isAmuletOfYendor: false,
    effect: d.effect,
    healAmount: d.healAmount,
    damage: d.damage,
    duration: d.duration,
    appearanceColor: idSys.potionColorHex[key],
  };
}

export function makeScroll(key: string, idSys: IdentificationSystem): Item {
  const d = SCROLL_DATA[key];
  return { id: makeItemId(), type: ItemType.SCROLL, key, count: 1,
    name: idSys.nameScroll(key), identified: idSys.knownScrolls.has(key),
    enchantment: 0, isAmuletOfYendor: false,
    effect: d.effect,
  };
}

export function makeRing(key: string, idSys: IdentificationSystem): Item {
  const d = RING_DATA[key];
  return { id: makeItemId(), type: ItemType.RING, key, count: 1,
    name: idSys.nameRing(key), identified: idSys.knownRings.has(key),
    enchantment: 0, isAmuletOfYendor: false,
    effect: d.effect,
  };
}

export function makeWand(key: string, idSys: IdentificationSystem): Item {
  const d = WAND_DATA[key];
  const charges = d.charges[0] + Math.floor(Math.random() * (d.charges[1] - d.charges[0] + 1));
  return { id: makeItemId(), type: ItemType.WAND, key, count: 1,
    name: idSys.nameWand(key), identified: idSys.knownWands.has(key),
    enchantment: 0, isAmuletOfYendor: false,
    effect: d.effect,
    charges,
  };
}

export function makeGold(count: number): Item {
  return { id: makeItemId(), type: ItemType.GOLD, key: 'gold', count,
    name: `${count} gold pieces`, identified: true, enchantment: 0, isAmuletOfYendor: false };
}

export function makeAmulet(): Item {
  return { id: makeItemId(), type: ItemType.SCROLL, key: 'amulet', count: 1,
    name: 'Amulet of Yendor', identified: true, enchantment: 0, isAmuletOfYendor: true };
}

// ── Level population ──────────────────────────────────────────────────────────

export interface FloorItem { x: number; y: number; item: Item; }

export function placeItemsOnLevel(
  level: DungeonLevel,
  dlvl: number,
  idSys: IdentificationSystem,
): FloorItem[] {
  const items: FloorItem[] = [];

  // Amulet of Yendor on final level
  if (dlvl === WIN_LEVEL && level.rooms.length > 0) {
    const last = level.rooms[level.rooms.length - 1];
    items.push({ x: last.x + Math.floor(last.w / 2), y: last.y + Math.floor(last.h / 2), item: makeAmulet() });
  }

  const weaponKeys  = Object.keys(WEAPON_DATA);
  const armorKeys   = Object.keys(ARMOR_DATA);
  const foodKeys    = Object.keys(FOOD_DATA);
  const potionKeys  = Object.keys(POTION_DATA);
  const scrollKeys  = Object.keys(SCROLL_DATA);
  const ringKeys    = Object.keys(RING_DATA);
  const wandKeys    = Object.keys(WAND_DATA);

  const count = 3 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    if (level.rooms.length === 0) break;
    const room = level.rooms[Math.floor(Math.random() * level.rooms.length)];
    const x = room.x + Math.floor(Math.random() * room.w);
    const y = room.y + Math.floor(Math.random() * room.h);

    const roll = Math.random();
    let item: Item;
    if      (roll < 0.13) item = makeWeapon(pick(weaponKeys));
    else if (roll < 0.23) item = makeArmor(pick(armorKeys));
    else if (roll < 0.40) item = makeFood(pick(foodKeys));
    else if (roll < 0.58) item = makePotion(pick(potionKeys), idSys);
    else if (roll < 0.72) item = makeScroll(pick(scrollKeys), idSys);
    else if (roll < 0.82) item = makeRing(pick(ringKeys), idSys);
    else if (roll < 0.90) item = makeWand(pick(wandKeys), idSys);
    else                  item = makeGold(rollDice(2, 6, dlvl * 5));

    items.push({ x, y, item });
  }

  return items;
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
