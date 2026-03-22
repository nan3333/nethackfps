import { HungerState, HUNGER_THRESHOLDS, ItemType } from './constants';
import { WEAPON_DATA, ARMOR_DATA } from './data';

export interface EquipSlots {
  weapon:    Item | null;
  armor:     Item | null;
  ring_left: Item | null;
  ring_right:Item | null;
  helm:      Item | null;
  shield:    Item | null;
  boots:     Item | null;
  gloves:    Item | null;
  cloak:     Item | null;
}

export interface Item {
  id:     number;
  type:   ItemType;
  key:    string;
  count:  number;
  name:   string;
  identified: boolean;
  enchantment: number;
  isAmuletOfYendor: boolean;
  effect?:          string;
  healAmount?:      [number, number, number];
  damage?:          [number, number, number];
  duration?:        number;
  nutrition?:       number;
  charges?:         number;
  appearanceColor?: string;
}

let nextItemId = 1;
export function makeItemId(): number { return nextItemId++; }

export class Player {
  // Position
  x = 0.5;
  y = 0.5;
  angle = 0.0;
  pitch = 0.0;

  // Head bob
  bobPhase     = 0.0;
  bobAmplitude = 0.0;

  // Vitals
  hp    = 12;
  maxHp = 12;
  ac    = 10;

  // Attributes
  str  = 16;
  dex  = 14;
  con  = 12;
  int_ = 10;
  wis  = 10;
  cha  = 8;

  // Progression
  xl    = 1;
  xp    = 0;
  gold  = 0;
  turns = 0;

  // Character identity
  role      = 'barbarian';
  race      = 'human';
  alignment: 'lawful' | 'neutral' | 'chaotic' = 'neutral';
  charName  = 'Player';
  gender: 'male' | 'female' = 'male';
  hpDice: [number, number] = [2, 8]; // HP/level = hpDice[0] + roll(1, hpDice[1])

  // HP regeneration timer (turns since last regen tick)
  regenTimer = 0;

  // Hunger
  nutrition = 900;
  hungerState: HungerState = HungerState.NOT_HUNGRY;

  // Status effects
  paralyzed  = 0;
  hasted     = 0;
  blinded    = 0;
  confused   = 0;
  levitating = 0;
  poisoned   = 0;
  sick       = 0;

  // Inventory
  inventory: Item[] = [];
  equip: EquipSlots = {
    weapon: null, armor: null,
    ring_left: null, ring_right: null,
    helm: null, shield: null, boots: null, gloves: null, cloak: null,
  };

  // ── Derived stats ──────────────────────────────────────────────────────────

  get weaponDamage(): [number, number, number] {
    if (!this.equip.weapon) return [1, 2, 0];
    const w = WEAPON_DATA[this.equip.weapon.key];
    const enc = this.equip.weapon.enchantment;
    return [w.damage[0], w.damage[1], w.damage[2] + enc];
  }

  // NetHack uses STR (abon) for to-hit, not DEX
  private strToHit(): number {
    const s = this.str;
    if (s < 6)  return -2;
    if (s < 8)  return -1;
    if (s <= 16) return 0;
    if (s <= 18) return 1;
    return 2;
  }

  get toHitBonus(): number {
    const wBonus = this.equip.weapon
      ? WEAPON_DATA[this.equip.weapon.key].toHit + this.equip.weapon.enchantment
      : 0;
    return this.xl + this.strToHit() + wBonus;
  }

  get effectiveAC(): number {
    const base = 10;
    const armorBonus = this.equip.armor  ? ARMOR_DATA[this.equip.armor.key].acBonus  + this.equip.armor.enchantment  : 0;
    const helmBonus  = this.equip.helm   ? ARMOR_DATA[this.equip.helm.key].acBonus   + this.equip.helm.enchantment   : 0;
    const shieldBonus= this.equip.shield ? ARMOR_DATA[this.equip.shield.key].acBonus + this.equip.shield.enchantment : 0;
    const bootsBonus = this.equip.boots  ? ARMOR_DATA[this.equip.boots.key].acBonus  + this.equip.boots.enchantment  : 0;
    const glovesBonus= this.equip.gloves ? ARMOR_DATA[this.equip.gloves.key].acBonus + this.equip.gloves.enchantment : 0;
    const cloakBonus = this.equip.cloak  ? ARMOR_DATA[this.equip.cloak.key].acBonus  + this.equip.cloak.enchantment  : 0;
    const ringAC = this.hasRingEffect('ac_bonus') ? -3 : 0;
    return base + armorBonus + helmBonus + shieldBonus + bootsBonus + glovesBonus + cloakBonus + ringAC;
  }

  get strBonus(): number {
    return Math.floor((this.str - 10) / 2);
  }

  // CON modifier to HP gained per level (official NetHack formula)
  conMod(): number {
    const c = this.con;
    if (c <= 3)  return -2;
    if (c <= 6)  return -1;
    if (c <= 14) return 0;
    if (c <= 16) return 1;
    if (c === 17) return 2;
    if (c === 18) return 3;
    return 4;
  }

  // ── Ring helpers ────────────────────────────────────────────────────────────

  hasRingEffect(effect: string): boolean {
    return (this.equip.ring_left?.effect === effect) ||
           (this.equip.ring_right?.effect === effect);
  }

  // ── Passive HP regeneration ─────────────────────────────────────────────────
  // Official NetHack: 1 HP every N turns where N = floor(42/(xl+2)) + 1
  // Level 1 → every 15 turns; level 5 → every 7; level 10+ → every 3-4.

  regenTick(): void {
    if (this.hp >= this.maxHp) { this.regenTimer = 0; return; }
    this.regenTimer++;
    const rate = Math.floor(42 / (this.xl + 2)) + 1;
    if (this.regenTimer >= rate) {
      this.regenTimer = 0;
      this.hp = Math.min(this.hp + 1, this.maxHp);
    }
  }

  // ── Status ticking ──────────────────────────────────────────────────────────

  tickStatus(): string[] {
    const msgs: string[] = [];
    if (this.blinded    > 0) { this.blinded--;    if (this.blinded    === 0) msgs.push('Your vision clears.'); }
    if (this.confused   > 0) { this.confused--;   if (this.confused   === 0) msgs.push('You feel less confused.'); }
    if (this.levitating > 0) { this.levitating--; if (this.levitating === 0) msgs.push('You float gently down.'); }
    if (this.poisoned   > 0) { this.poisoned--;   if (this.poisoned   === 0) msgs.push('You feel the poison fading.'); }
    if (this.sick       > 0) { this.sick--;        if (this.sick       === 0) msgs.push('You feel better.'); }
    return msgs;
  }

  // ── Hunger ─────────────────────────────────────────────────────────────────

  updateHunger(): string | null {
    this.nutrition--;
    const prev = this.hungerState;

    if      (this.nutrition >= HUNGER_THRESHOLDS[HungerState.SATIATED])   this.hungerState = HungerState.SATIATED;
    else if (this.nutrition >= HUNGER_THRESHOLDS[HungerState.NOT_HUNGRY]) this.hungerState = HungerState.NOT_HUNGRY;
    else if (this.nutrition >= HUNGER_THRESHOLDS[HungerState.HUNGRY])     this.hungerState = HungerState.HUNGRY;
    else if (this.nutrition >= HUNGER_THRESHOLDS[HungerState.WEAK])       this.hungerState = HungerState.WEAK;
    else if (this.nutrition >= HUNGER_THRESHOLDS[HungerState.FAINTING])   this.hungerState = HungerState.FAINTING;
    else                                                                   this.hungerState = HungerState.STARVED;

    if (this.hungerState !== prev) {
      switch (this.hungerState) {
        case HungerState.HUNGRY:   return 'You are getting hungry.';
        case HungerState.WEAK:     return 'You feel weak from hunger!';
        case HungerState.FAINTING: return 'You faint from lack of food!';
        case HungerState.STARVED:  return null;
      }
    }
    return null;
  }

  // ── XP / leveling ──────────────────────────────────────────────────────────

  gainXP(amount: number): string | null {
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

  getMoveTarget(forward: number, strafe: number): [number, number] {
    const dx = Math.round(Math.cos(this.angle)) * forward + Math.round(-Math.sin(this.angle)) * strafe;
    const dy = Math.round(Math.sin(this.angle)) * forward + Math.round( Math.cos(this.angle)) * strafe;
    return [Math.round(this.x - 0.5) + dx, Math.round(this.y - 0.5) + dy];
  }

  // ── Inventory helpers ──────────────────────────────────────────────────────

  hasAmulet(): boolean {
    return this.inventory.some(i => i.isAmuletOfYendor);
  }

  addItem(item: Item): void {
    if (item.type === ItemType.GOLD) {
      this.gold += item.count;
      return;
    }
    this.inventory.push(item);
  }

  removeItem(item: Item): void {
    const idx = this.inventory.indexOf(item);
    if (idx >= 0) this.inventory.splice(idx, 1);
  }
}

function xpThreshold(xl: number): number {
  if (xl <= 9)  return 10 * (1 << xl);
  if (xl <= 19) return 10000 * (1 << (xl - 10));
  return 10000000 * (xl - 19);
}

export function rollDice(num: number, sides: number, bonus: number): number {
  let total = bonus;
  for (let i = 0; i < num; i++) total += 1 + Math.floor(Math.random() * sides);
  return total;
}
