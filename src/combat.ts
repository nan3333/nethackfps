import { Player, rollDice } from './player';
import { MONSTER_DATA } from './data';

export interface Monster {
  id:      number;
  key:     string;
  name:    string;
  symbol:  string;
  color:   string;
  x:       number;
  y:       number;
  hp:      number;
  maxHp:   number;
  ac:      number;
  damage:  [number, number, number];
  speed:   number;
  xpValue: number;
  difficulty: number;
  flags:   Set<string>;
  awake:   boolean;
  targetX: number;
  targetY: number;
  regenTimer: number;
  paralyzed?: number;
}

let nextMonsterId = 1;

export function spawnMonster(key: string, x: number, y: number): Monster {
  const t = MONSTER_DATA[key];
  const hp = rollDice(t.hpDice[0], t.hpDice[1], t.hpDice[2]);
  return {
    id: nextMonsterId++,
    key, name: t.name, symbol: t.symbol, color: t.color,
    x, y, hp, maxHp: hp,
    ac: t.ac,
    damage: t.damage,
    speed: t.speed, xpValue: t.xpValue, difficulty: t.difficulty,
    flags: new Set(t.flags),
    awake: false, targetX: x, targetY: y,
    regenTimer: 0,
    paralyzed: 0,
  };
}

// ── Player attacks monster ────────────────────────────────────────────────────

export function playerAttack(player: Player, monster: Monster): { msg: string; killed: boolean } {
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
    if (lvlMsg) msg += ' ' + lvlMsg;
    return { msg, killed: true };
  }

  return { msg: `You hit the ${monster.name} for ${dmg} damage.`, killed: false };
}

// ── Monster attacks player ────────────────────────────────────────────────────

export function monsterAttack(monster: Monster, player: Player): { msg: string; dead: boolean } {
  const msgs: string[] = [];

  if (monster.damage[0] === 0) {
    // Passive effect — floating eye / gelatinous cube paralyze
    if (monster.flags.has('passive_paralyze') && monster.awake) {
      player.paralyzed = Math.max(player.paralyzed, rollDice(1, 4, 2));
      return { msg: `The ${monster.name} paralyzes you!`, dead: false };
    }
    return { msg: '', dead: false };
  }

  // fire_breath: separate damage roll
  if (monster.flags.has('fire_breath')) {
    if (player.hasRingEffect('fire_resist')) {
      msgs.push(`The ${monster.name} breathes fire, but you resist!`);
    } else {
      const fireDmg = rollDice(2, 6, 0);
      player.hp -= fireDmg;
      msgs.push(`The ${monster.name} breathes fire at you for ${fireDmg} damage!`);
      if (player.hp <= 0) return { msg: msgs.join(' '), dead: true };
    }
  }

  const roll = rollDice(1, 20, 0) + monster.difficulty;
  const threshold = 20 - player.effectiveAC;

  if (roll < threshold) {
    if (msgs.length) return { msg: msgs.join(' '), dead: false };
    return { msg: `The ${monster.name} misses.`, dead: false };
  }

  const [n, s, b] = monster.damage;
  const dmg = Math.max(1, rollDice(n, s, b));
  player.hp -= dmg;
  msgs.push(`The ${monster.name} hits you for ${dmg} damage.`);

  // Special attack flags
  if (monster.flags.has('poison_attack')) {
    if (!player.hasRingEffect('poison_resist')) {
      player.poisoned = Math.max(player.poisoned, 10);
      msgs.push('You feel poisoned!');
    }
  }

  if (monster.flags.has('drain_level')) {
    if (player.xl > 1) {
      player.xl--;
      msgs.push(`You feel your life force draining away! (now level ${player.xl})`);
    } else {
      player.hp -= 5;
      msgs.push('Your life force drains away!');
    }
  }

  if (monster.flags.has('magic_spell')) {
    player.confused = Math.max(player.confused, 5);
    msgs.push('The spell confuses you!');
  }

  if (monster.flags.has('drain_hp')) {
    const stolen = Math.min(rollDice(1, 4, 0), dmg);
    monster.hp = Math.min(monster.hp + stolen, monster.maxHp);
  }

  const dead = player.hp <= 0;
  return { msg: msgs.join(' '), dead };
}
