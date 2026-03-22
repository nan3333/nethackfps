import { WIN_LEVEL, HungerState, ItemType, Tile } from './constants';
import { Dungeon, DungeonLevel } from './dungeon';
import { Player, Item, rollDice } from './player';
import { Monster, actMonster, populateLevel, trySpawnRandom } from './monsters';
import { FloorItem, IdentificationSystem, placeItemsOnLevel, makeWeapon, makeFood, makePotion, makeScroll, makeArmor, makeRing, makeWand } from './items';
import { playerAttack } from './combat';
import { MONSTER_DATA, POTION_DATA, ARMOR_DATA, WAND_DATA, ROLE_DATA, RACE_DATA, Alignment } from './data';

export type GamePhase = 'title' | 'chargen' | 'playing' | 'inventory' | 'help' | 'map' | 'dead' | 'won';

interface LevelState {
  monsters: Monster[];
  items:    FloorItem[];
  populated: boolean;
}

export class GameState {
  player   = new Player();
  dungeon  = new Dungeon(WIN_LEVEL);
  idSys    = new IdentificationSystem();
  dlvl     = 1;
  phase: GamePhase = 'title';
  messages:    string[] = [];
  turns        = 0;
  lastMsgTurn  = 0;

  private levelStates = new Map<number, LevelState>();

  // ── Init ───────────────────────────────────────────────────────────────────

  init(): void {
    this.phase = 'chargen';
  }

  initWithChar(opts: {
    role: string; race: string; alignment: Alignment;
    charName: string; gender: 'male' | 'female';
  }): void {
    this.player   = new Player();
    this.dungeon  = new Dungeon(WIN_LEVEL);
    this.idSys    = new IdentificationSystem();
    this.dlvl     = 1;
    this.turns    = 0;
    this.levelStates.clear();

    const role = ROLE_DATA[opts.role];
    const race = RACE_DATA[opts.race];

    // Apply role base stats + race modifiers
    const [rStr,rInt,rWis,rDex,rCon,rCha] = role.baseStats;
    const [mStr,mInt,mWis,mDex,mCon,mCha] = race.statMods;
    this.player.str  = Math.max(3, rStr + mStr);
    this.player.int_ = Math.max(3, rInt + mInt);
    this.player.wis  = Math.max(3, rWis + mWis);
    this.player.dex  = Math.max(3, rDex + mDex);
    this.player.con  = Math.max(3, rCon + mCon);
    this.player.cha  = Math.max(3, rCha + mCha);

    this.player.hp    = role.hpStart;
    this.player.maxHp = role.hpStart;
    this.player.hpDice   = role.hpDice;
    this.player.role      = opts.role;
    this.player.race      = opts.race;
    this.player.alignment = opts.alignment;
    this.player.charName  = opts.charName;
    this.player.gender    = opts.gender;

    // Starting equipment
    this.player.addItem(makeWeapon(role.startWeapon));
    this.player.equip.weapon = this.player.inventory[0];
    if (role.startArmor) {
      this.player.addItem(makeArmor(role.startArmor));
      this.player.equip.armor = this.player.inventory.find(i => i.key === role.startArmor) ?? null;
    }
    this.player.addItem(makeFood('ration'));
    // Healer gets extra healing potions
    if (opts.role === 'healer') {
      this.player.addItem(makePotion('healing', this.idSys));
      this.player.addItem(makePotion('healing', this.idSys));
    }
    // Wizard gets a scroll of identify
    if (opts.role === 'wizard') {
      this.player.addItem(makeScroll('identify', this.idSys));
    }

    const roleName = role.name;
    const raceName = race.name;
    this.messages = [`${opts.charName} the ${raceName} ${roleName} — good luck!`];

    this.enterLevel(1);
    this.phase = 'playing';
  }

  // ── Level management ───────────────────────────────────────────────────────

  get currentLevel(): DungeonLevel { return this.dungeon.getLevel(this.dlvl); }

  get currentMonsters(): Monster[] { return this.levelState().monsters; }

  get currentItems(): FloorItem[] { return this.levelState().items; }

  private levelState(): LevelState {
    if (!this.levelStates.has(this.dlvl)) {
      this.levelStates.set(this.dlvl, { monsters: [], items: [], populated: false });
    }
    return this.levelStates.get(this.dlvl)!;
  }

  private enterLevel(dlvl: number, fromBelow = false): void {
    this.dlvl = dlvl;
    const level = this.currentLevel;
    const state = this.levelState();

    if (!state.populated) {
      state.monsters = populateLevel(level, dlvl, this.player.xl);
      state.items    = placeItemsOnLevel(level, dlvl, this.idSys);
      state.populated = true;
    }

    // Ascending (fromBelow) → land at stairsDown on this level (the hole you climbed out of).
    // Descending           → land at stairsUp on this level.
    const pos = fromBelow ? level.stairsDown : (dlvl > 1 ? level.stairsUp : null);
    if (pos) {
      this.player.x = pos[0] + 0.5;
      this.player.y = pos[1] + 0.5;
    } else if (level.rooms.length > 0) {
      const r = level.rooms[0];
      this.player.x = r.x + Math.floor(r.w / 2) + 0.5;
      this.player.y = r.y + Math.floor(r.h / 2) + 0.5;
    } else {
      // Maze/cave levels: find first floor tile
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

  processTurn(): void {
    this.turns++;
    this.player.turns++;

    // Paralysis ticks
    if (this.player.paralyzed > 0) {
      this.player.paralyzed--;
      return;
    }

    // Passive HP regeneration (official NetHack rate)
    this.player.regenTick();

    // Haste ticks
    if (this.player.hasted > 0) this.player.hasted--;

    // Status effects tick
    const statusMsgs = this.player.tickStatus();
    for (const m of statusMsgs) this.addMsg(m);

    // Hunger
    const hungerMsg = this.player.updateHunger();
    if (hungerMsg) this.addMsg(hungerMsg);
    if (this.player.hungerState === HungerState.STARVED) {
      this.player.hp = 0;
      this.phase = 'dead';
      this.addMsg('You starve to death!');
      return;
    }

    // Monster turns
    const level = this.currentLevel;
    const state = this.levelState();

    for (const m of state.monsters) {
      const msgs = actMonster(m, this.player, level, state.monsters);
      for (const msg of msgs) {
        if (msg === '__PLAYER_DEAD__') {
          this.phase = 'dead';
          return;
        }
        this.addMsg(msg);
      }
    }

    // Remove dead monsters
    state.monsters = state.monsters.filter(m => m.hp > 0);

    // Check player death from special attacks (drain_level etc.)
    if (this.player.hp <= 0) {
      this.phase = 'dead';
      return;
    }

    // Rare random spawn (0.5% per turn)
    if (Math.random() < 0.005) {
      const m = trySpawnRandom(level, this.dlvl, this.player, this.player.xl);
      if (m) state.monsters.push(m);
    }
  }

  // ── Player actions ─────────────────────────────────────────────────────────

  tryMove(forward: number, strafe: number): void {
    if (this.player.paralyzed > 0) { this.processTurn(); return; }
    const [tx, ty] = this.player.getMoveTarget(forward, strafe);
    const level = this.currentLevel;

    // Attack monster at target?
    const m = this.currentMonsters.find(m => m.x === tx && m.y === ty);
    if (m) {
      const { msg, killed } = playerAttack(this.player, m);
      this.addMsg(msg);
      if (killed) {
        this.dropCorpse(m);
        this.levelState().monsters = this.currentMonsters.filter(x => x !== m);
      }
      this.processTurn();
      return;
    }

    // Open a closed door instead of walking into it
    if (level.tile(tx, ty) === Tile.DOOR_CLOSED) {
      level.grid[ty][tx].tile = Tile.DOOR_OPEN;
      this.addMsg('You open the door.');
      this.processTurn();
      return;
    }

    if (level.isPassable(tx, ty)) {
      this.player.x = tx + 0.5;
      this.player.y = ty + 0.5;
      this.player.bobPhase    += Math.PI * 0.5;
      this.player.bobAmplitude = 1.0;
      this.processTurn();
      this.noteUnderfoot();
    }
  }

  tryDescend(): void {
    const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
    const sd = this.currentLevel.stairsDown;
    if (!sd || sd[0] !== px || sd[1] !== py) { this.addMsg('There are no stairs going down here.'); return; }
    if (this.dlvl >= WIN_LEVEL) { this.addMsg('These stairs lead no further down.'); return; }
    this.enterLevel(this.dlvl + 1);
    this.addMsg(`You descend to dungeon level ${this.dlvl}.`);
    this.processTurn();
  }

  tryAscend(): void {
    const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
    const su = this.currentLevel.stairsUp;
    if (!su || su[0] !== px || su[1] !== py) { this.addMsg('There are no stairs going up here.'); return; }

    if (this.dlvl === 1) {
      if (this.player.hasAmulet()) {
        this.phase = 'won';
        this.addMsg('You ascend to the surface carrying the Amulet of Yendor! You win!');
      } else {
        this.addMsg('You cannot leave without the Amulet of Yendor!');
      }
      return;
    }
    this.enterLevel(this.dlvl - 1, true);
    this.addMsg(`You ascend to dungeon level ${this.dlvl}.`);
    this.processTurn();
  }

  tryPickup(): void {
    const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
    const state = this.levelState();
    const idx = state.items.findIndex(fi => fi.x === px && fi.y === py);
    if (idx < 0) { this.addMsg('There is nothing here to pick up.'); return; }
    const fi = state.items.splice(idx, 1)[0];
    this.player.addItem(fi.item);
    this.addMsg(`You pick up ${fi.item.name}.`);
    this.processTurn();
  }

  useItem(item: Item): void {
    const msgs: string[] = [];
    if (item.type === ItemType.FOOD) {
      this.player.nutrition = Math.min(1200, this.player.nutrition + (item.nutrition ?? 200));
      msgs.push(`You eat the ${item.name}. Delicious!`);
      this.player.removeItem(item);

    } else if (item.type === ItemType.POTION) {
      this.idSys.identify('potion', item.key);
      item.identified = true;
      item.name = POTION_DATA[item.key]?.name ?? item.name;

      switch (item.effect) {
        case 'heal': {
          const [n, s, b] = item.healAmount ?? [2, 8, 2];
          const amt = rollDice(n, s, b);
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + amt);
          msgs.push(`You drink the ${item.name}. You feel better!`);
          break;
        }
        case 'full_heal':
          this.player.hp = this.player.maxHp;
          msgs.push(`You drink the ${item.name}. You feel completely healed!`);
          break;
        case 'poison':
          this.player.hp -= rollDice(...(item.damage ?? [1, 6, 0]));
          msgs.push(`You drink the ${item.name}. You feel sick!`);
          break;
        case 'sickness':
          this.player.sick = item.duration ?? 20;
          msgs.push(`You drink the ${item.name}. You feel deathly ill!`);
          break;
        case 'acid': {
          const acidDmg = rollDice(...(item.damage ?? [1, 6, 0]));
          this.player.hp -= acidDmg;
          msgs.push(`You drink the ${item.name}. It burns! (${acidDmg} damage)`);
          break;
        }
        case 'speed':
          this.player.hasted = item.duration ?? 20;
          msgs.push(`You drink the ${item.name}. You feel swift!`);
          break;
        case 'levitation':
          this.player.levitating = item.duration ?? 20;
          msgs.push(`You drink the ${item.name}. You start to float!`);
          break;
        case 'confusion':
          this.player.confused = item.duration ?? 10;
          msgs.push(`You drink the ${item.name}. Huh? What?`);
          break;
        case 'booze':
          this.player.confused = item.duration ?? 5;
          msgs.push(`You drink the ${item.name}. Burp!`);
          break;
        case 'blindness':
          this.player.blinded = item.duration ?? 15;
          msgs.push(`You drink the ${item.name}. You can't see!`);
          break;
        case 'paralysis':
          this.player.paralyzed = item.duration ?? 5;
          msgs.push(`You drink the ${item.name}. You are paralyzed!`);
          break;
        case 'invisibility':
          msgs.push(`You drink the ${item.name}. You feel transparent!`);
          break;
        case 'gain_str':
          this.player.str++;
          msgs.push(`You drink the ${item.name}. You feel stronger!`);
          break;
        case 'see_invisible':
          msgs.push(`You drink the ${item.name}. You can see invisible things!`);
          break;
        case 'water':
          msgs.push(`You drink the ${item.name}. Splash!`);
          break;
        case 'restore_ability':
          msgs.push(`You drink the ${item.name}. You feel your abilities return!`);
          break;
        case 'gain_level': {
          const lvlMsg = this.player.gainXP(999999);
          msgs.push(`You drink the ${item.name}. You feel more powerful!`);
          if (lvlMsg) msgs.push(lvlMsg);
          break;
        }
        default:
          msgs.push(`You drink the ${item.name}.`);
      }
      this.player.removeItem(item);

    } else if (item.type === ItemType.SCROLL) {
      this.idSys.identify('scroll', item.key);
      item.identified = true;
      switch (item.effect) {
        case 'identify': {
          const unid = this.player.inventory.find(i => !i.identified);
          if (unid) { unid.identified = true; msgs.push(`You identify the ${unid.name}.`); }
          else msgs.push('Nothing to identify.');
          break;
        }
        case 'teleport': {
          const level = this.currentLevel;
          for (let i = 0; i < 50; i++) {
            const x = Math.floor(Math.random() * level.width);
            const y = Math.floor(Math.random() * level.height);
            if (level.isPassable(x, y)) { this.player.x = x + 0.5; this.player.y = y + 0.5; break; }
          }
          msgs.push('You feel a wrenching sensation!');
          break;
        }
        case 'enchant_weapon':
          if (this.player.equip.weapon) {
            this.player.equip.weapon.enchantment++;
            msgs.push(`Your ${this.player.equip.weapon.name} glows!`);
          } else msgs.push('You have no weapon to enchant.');
          break;
        case 'enchant_armor':
          if (this.player.equip.armor) {
            this.player.equip.armor.enchantment++;
            msgs.push(`Your ${this.player.equip.armor.name} glows!`);
          } else msgs.push('You have no armor to enchant.');
          break;
        case 'magic_mapping': {
          const level = this.currentLevel;
          for (let y = 0; y < level.height; y++)
            for (let x = 0; x < level.width; x++)
              level.grid[y][x].explored = true;
          msgs.push('A map forms in your mind!');
          break;
        }
        case 'remove_curse':
          for (const i of this.player.inventory) {
            if (i.enchantment < 0) i.enchantment = 0;
          }
          msgs.push('You feel the curses lift!');
          break;
        case 'scare_monster': {
          const px = Math.round(this.player.x - 0.5);
          const py = Math.round(this.player.y - 0.5);
          const level = this.currentLevel;
          let scared = 0;
          for (const m of this.currentMonsters) {
            if (Math.abs(m.x - px) + Math.abs(m.y - py) <= 8) {
              // Push monster away from player
              const dx = m.x - px, dy = m.y - py;
              const nx = m.x + Math.sign(dx || 1);
              const ny = m.y + Math.sign(dy || 1);
              if (level.isPassable(nx, ny)) { m.x = nx; m.y = ny; }
              scared++;
            }
          }
          msgs.push(scared > 0 ? `The monsters flee in terror!` : 'The monsters seem unimpressed.');
          break;
        }
        case 'fire': {
          const fireDmg = rollDice(1, 6, 0);
          let killed = 0;
          for (const m of this.currentMonsters) {
            m.hp -= fireDmg;
            if (m.hp <= 0) killed++;
          }
          this.levelState().monsters = this.currentMonsters.filter(m => m.hp > 0);
          msgs.push(`Flames burst from the scroll! (${fireDmg} fire damage)${killed > 0 ? ` ${killed} monster(s) die!` : ''}`);
          break;
        }
        case 'create_monster': {
          const m = trySpawnRandom(this.currentLevel, this.dlvl, this.player);
          if (m) {
            this.levelState().monsters.push(m);
            msgs.push(`A ${m.name} appears!`);
          } else {
            msgs.push('Nothing happens.');
          }
          break;
        }
        case 'genocide':
          msgs.push('You hear distant screams...');
          break;
        case 'taming':
          msgs.push('The monsters look friendlier.');
          break;
        case 'earth':
          msgs.push('Boulders fall from the ceiling!');
          break;
        default:
          msgs.push('You read the scroll.');
      }
      this.player.removeItem(item);

    } else if (item.type === ItemType.WEAPON) {
      if (this.player.equip.weapon === item) {
        this.player.equip.weapon = null;
        msgs.push(`You unwield the ${item.name}.`);
      } else {
        this.player.equip.weapon = item;
        msgs.push(`You wield the ${item.name}.`);
      }

    } else if (item.type === ItemType.ARMOR) {
      this.equipArmor(item, msgs);

    } else if (item.type === ItemType.RING) {
      this.idSys.identify('ring', item.key);
      item.identified = true;
      // Equip into left or right ring slot
      if (this.player.equip.ring_left === item || this.player.equip.ring_right === item) {
        if (this.player.equip.ring_left === item)  this.player.equip.ring_left = null;
        if (this.player.equip.ring_right === item) this.player.equip.ring_right = null;
        msgs.push(`You remove the ${item.name}.`);
      } else if (!this.player.equip.ring_left) {
        this.player.equip.ring_left = item;
        msgs.push(`You put on the ${item.name} (left hand).`);
      } else if (!this.player.equip.ring_right) {
        this.player.equip.ring_right = item;
        msgs.push(`You put on the ${item.name} (right hand).`);
      } else {
        msgs.push('Your hands are full of rings!');
      }

    } else if (item.type === ItemType.WAND) {
      // Zap in forward direction
      this.zapWand(item, msgs);
    }

    for (const m of msgs) this.addMsg(m);
    if (msgs.length) this.processTurn();
  }

  private equipArmor(item: Item, msgs: string[]): void {
    const armorData = ARMOR_DATA[item.key];
    const slot = armorData?.slot ?? 'suit';

    const slotMap: Record<string, keyof typeof this.player.equip> = {
      suit:   'armor',
      helm:   'helm',
      gloves: 'gloves',
      boots:  'boots',
      shield: 'shield',
      cloak:  'cloak',
    };

    const equipKey = slotMap[slot] ?? 'armor';
    const equipObj = this.player.equip as unknown as Record<string, Item | null>;
    const current = equipObj[equipKey];

    if (current === item) {
      equipObj[equipKey] = null;
      msgs.push(`You remove the ${item.name}.`);
    } else {
      equipObj[equipKey] = item;
      msgs.push(`You put on the ${item.name}.`);
    }
  }

  zapWand(item: Item, msgs: string[]): void {
    if ((item.charges ?? 0) <= 0) {
      msgs.push('The wand is empty.');
      return;
    }
    item.charges = (item.charges ?? 0) - 1;
    this.idSys.identify('wand', item.key);
    item.identified = true;

    const wandData = WAND_DATA[item.key];
    if (!wandData) { msgs.push('Fzzt!'); return; }
    const effect = wandData.effect;

    // Find first monster in player's forward direction
    const px = Math.round(this.player.x - 0.5);
    const py = Math.round(this.player.y - 0.5);
    const fdx = Math.round(Math.cos(this.player.angle));
    const fdy = Math.round(Math.sin(this.player.angle));
    let target: Monster | null = null;
    for (let step = 1; step <= 8; step++) {
      const tx = px + fdx * step;
      const ty = py + fdy * step;
      const found = this.currentMonsters.find(m => m.x === tx && m.y === ty);
      if (found) { target = found; break; }
      if (!this.currentLevel.isPassable(tx, ty)) break;
    }

    switch (effect) {
      case 'magic_missile':
      case 'striking': {
        if (target) {
          const dmg = rollDice(2, 6, 0);
          target.hp -= dmg;
          msgs.push(`The ${wandData.name} zaps the ${target.name} for ${dmg} damage!`);
          if (target.hp <= 0) {
            msgs.push(`The ${target.name} dies!`);
            this.player.gainXP(target.xpValue);
            this.dropCorpse(target);
            this.levelState().monsters = this.currentMonsters.filter(m => m !== target);
          }
        } else msgs.push('The bolt fizzles out.');
        break;
      }
      case 'fire_bolt':
      case 'cold_bolt':
      case 'lightning': {
        if (target) {
          const dmg = rollDice(3, 6, 0);
          target.hp -= dmg;
          const verb = effect === 'fire_bolt' ? 'fire' : effect === 'cold_bolt' ? 'cold' : 'lightning';
          msgs.push(`A bolt of ${verb} hits the ${target.name} for ${dmg} damage!`);
          if (target.hp <= 0) {
            msgs.push(`The ${target.name} dies!`);
            this.player.gainXP(target.xpValue);
            this.dropCorpse(target);
            this.levelState().monsters = this.currentMonsters.filter(m => m !== target);
          }
        } else msgs.push('The bolt hits the wall.');
        break;
      }
      case 'sleep_bolt':
        if (target) {
          target.paralyzed = 5;
          msgs.push(`The ${target.name} falls asleep!`);
        } else msgs.push('The bolt fizzles out.');
        break;
      case 'teleport_away':
        if (target) {
          for (let i = 0; i < 30; i++) {
            const x = Math.floor(Math.random() * this.currentLevel.width);
            const y = Math.floor(Math.random() * this.currentLevel.height);
            if (this.currentLevel.isPassable(x, y)) { target.x = x; target.y = y; break; }
          }
          msgs.push(`The ${target.name} vanishes!`);
        } else msgs.push('The bolt fizzles out.');
        break;
      case 'slow':
        if (target) {
          target.speed = Math.max(1, Math.floor(target.speed / 2));
          msgs.push(`The ${target.name} slows down!`);
        } else msgs.push('The bolt fizzles out.');
        break;
      case 'light': {
        const level = this.currentLevel;
        const radius = 10;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx*dx + dy*dy <= radius*radius) {
              const cell = level.get(px + dx, py + dy);
              if (cell) cell.explored = true;
            }
          }
        }
        msgs.push('The room is illuminated!');
        break;
      }
      case 'dig':
        msgs.push('You dig a hole, but nothing changes.');
        break;
      case 'wish':
        msgs.push('A wish! Unfortunately, the game cannot grant wishes yet.');
        break;
      case 'death':
        if (target) {
          target.hp = 0;
          msgs.push(`The ${target.name} is instantly destroyed!`);
          this.player.gainXP(target.xpValue);
          this.dropCorpse(target);
          this.levelState().monsters = this.currentMonsters.filter(m => m !== target);
        } else msgs.push('The death ray misses.');
        break;
      case 'polymorph':
        if (target) {
          msgs.push(`The ${target.name} changes shape!`);
        } else msgs.push('The bolt fizzles out.');
        break;
      case 'cancellation':
        if (target) {
          target.flags = new Set();
          msgs.push(`The ${target.name} is cancelled!`);
        } else msgs.push('The bolt fizzles out.');
        break;
      case 'haste_monster':
        if (target) {
          target.speed = target.speed * 2;
          msgs.push(`The ${target.name} speeds up!`);
        } else msgs.push('The bolt fizzles out.');
        break;
      default:
        msgs.push(`The ${wandData.name} crackles with energy.`);
    }

    if ((item.charges ?? 0) === 0) msgs.push('The wand is now empty.');
  }

  dropItem(item: Item): void {
    const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
    if (this.player.equip.weapon    === item) this.player.equip.weapon    = null;
    if (this.player.equip.armor     === item) this.player.equip.armor     = null;
    if (this.player.equip.ring_left === item) this.player.equip.ring_left = null;
    if (this.player.equip.ring_right=== item) this.player.equip.ring_right= null;
    if (this.player.equip.helm      === item) this.player.equip.helm      = null;
    if (this.player.equip.shield    === item) this.player.equip.shield    = null;
    if (this.player.equip.boots     === item) this.player.equip.boots     = null;
    if (this.player.equip.gloves    === item) this.player.equip.gloves    = null;
    if (this.player.equip.cloak     === item) this.player.equip.cloak     = null;
    this.player.removeItem(item);
    this.levelState().items.push({ x: px, y: py, item });
    this.addMsg(`You drop the ${item.name}.`);
    this.processTurn();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private dropCorpse(m: Monster): void {
    const t = MONSTER_DATA[m.key];
    if (!t) return;
    const corpse: Item = {
      id: Math.random(), type: ItemType.FOOD, key: 'corpse',
      count: 1, name: `${m.name} corpse`, identified: true,
      enchantment: 0, isAmuletOfYendor: false,
      nutrition: 150,
    };
    this.levelState().items.push({ x: m.x, y: m.y, item: corpse });
  }

  noteUnderfoot(): void {
    const [px, py] = [Math.round(this.player.x - 0.5), Math.round(this.player.y - 0.5)];
    const here = this.currentItems.filter(fi => fi.x === px && fi.y === py);
    const tile  = this.currentLevel.tile(px, py);

    if (here.length === 1) {
      this.addMsg(`You see here: ${here[0].item.name}.`);
    } else if (here.length > 1) {
      this.addMsg(`You see here: ${here[0].item.name} and ${here.length - 1} other item${here.length > 2 ? 's' : ''}.`);
    }

    if (tile === Tile.STAIRS_DOWN) this.addMsg('Stairway going down (>) is here.');
    else if (tile === Tile.STAIRS_UP) this.addMsg('Stairway going up (<) is here.');
  }

  addMsg(msg: string): void {
    this.messages.push(msg);
    if (this.messages.length > 100) this.messages.shift();
    this.lastMsgTurn = this.turns;
  }
}
