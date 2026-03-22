import { COL_MONSTER_EASY, COL_MONSTER_TOUGH, COL_ITEM } from './constants';

// ── Monster data ──────────────────────────────────────────────────────────────
export interface MonsterTemplate {
  symbol: string; name: string; color: string;
  hpDice: [number, number, number];  // [num, sides, bonus]
  ac: number;
  damage: [number, number, number];
  speed: number; xpValue: number; difficulty: number;
  freq: number;
  group: 'none' | 'small' | 'large';
  flags: Set<string>;
  corpseEffect: string;
}

export const MONSTER_DATA: Record<string, MonsterTemplate> = {
  newt:          { symbol:':', name:'newt',          color:COL_MONSTER_EASY,
    hpDice:[1,1,0],  ac:9,  damage:[1,2,0], speed:6,  xpValue:1,   difficulty:1,  freq:5, group:'none',
    flags:new Set(), corpseEffect:'safe' },
  bat:           { symbol:'B', name:'bat',           color:COL_MONSTER_EASY,
    hpDice:[1,4,0],  ac:8,  damage:[1,2,0], speed:22, xpValue:1,   difficulty:1,  freq:5, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  grid_bug:      { symbol:'x', name:'grid bug',      color:COL_MONSTER_EASY,
    hpDice:[1,4,0],  ac:9,  damage:[1,2,0], speed:12, xpValue:3,   difficulty:1,  freq:3, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  jackal:        { symbol:'d', name:'jackal',        color:COL_MONSTER_EASY,
    hpDice:[1,4,0],  ac:7,  damage:[1,2,0], speed:12, xpValue:2,   difficulty:1,  freq:4, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  kobold:        { symbol:'k', name:'kobold',        color:COL_MONSTER_EASY,
    hpDice:[1,8,0],  ac:7,  damage:[1,6,0], speed:10, xpValue:8,   difficulty:1,  freq:4, group:'small',
    flags:new Set(), corpseEffect:'poisonous' },
  goblin:        { symbol:'g', name:'goblin',        color:COL_MONSTER_EASY,
    hpDice:[1,4,0],  ac:10, damage:[1,3,0], speed:6,  xpValue:2,   difficulty:1,  freq:4, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  giant_ant:     { symbol:'a', name:'giant ant',     color:COL_MONSTER_EASY,
    hpDice:[1,6,0],  ac:3,  damage:[1,4,0], speed:18, xpValue:5,   difficulty:2,  freq:3, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  centipede:     { symbol:'s', name:'centipede',     color:COL_MONSTER_EASY,
    hpDice:[1,4,0],  ac:3,  damage:[1,2,0], speed:4,  xpValue:5,   difficulty:2,  freq:3, group:'none',
    flags:new Set(['poison_attack']), corpseEffect:'poisonous' },
  gnome:         { symbol:'G', name:'gnome',         color:COL_MONSTER_EASY,
    hpDice:[1,6,0],  ac:10, damage:[1,6,0], speed:6,  xpValue:3,   difficulty:2,  freq:4, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  hobgoblin:     { symbol:'o', name:'hobgoblin',     color:COL_MONSTER_EASY,
    hpDice:[1,8,0],  ac:10, damage:[1,6,0], speed:9,  xpValue:3,   difficulty:2,  freq:4, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  giant_rat:     { symbol:'r', name:'giant rat',     color:COL_MONSTER_EASY,
    hpDice:[1,6,1],  ac:7,  damage:[1,4,0], speed:10, xpValue:5,   difficulty:1,  freq:4, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  orc:           { symbol:'o', name:'orc',           color:COL_MONSTER_EASY,
    hpDice:[1,8,0],  ac:10, damage:[1,8,0], speed:9,  xpValue:5,   difficulty:3,  freq:4, group:'large',
    flags:new Set(), corpseEffect:'safe' },
  wolf:          { symbol:'d', name:'wolf',          color:COL_MONSTER_EASY,
    hpDice:[2,6,0],  ac:7,  damage:[2,4,0], speed:12, xpValue:5,   difficulty:3,  freq:3, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  dwarf:         { symbol:'h', name:'dwarf',         color:COL_MONSTER_EASY,
    hpDice:[2,8,0],  ac:10, damage:[1,6,0], speed:6,  xpValue:4,   difficulty:3,  freq:3, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  killer_bee:    { symbol:'a', name:'killer bee',    color:COL_MONSTER_EASY,
    hpDice:[1,4,0],  ac:4,  damage:[1,3,0], speed:18, xpValue:5,   difficulty:3,  freq:4, group:'large',
    flags:new Set(['poison_attack']), corpseEffect:'poisonous' },
  zombie:        { symbol:'Z', name:'zombie',        color:COL_MONSTER_EASY,
    hpDice:[2,8,0],  ac:8,  damage:[1,6,0], speed:6,  xpValue:4,   difficulty:3,  freq:4, group:'none',
    flags:new Set(['undead']), corpseEffect:'sickness' },
  floating_eye:  { symbol:'e', name:'floating eye',  color:COL_MONSTER_EASY,
    hpDice:[1,10,0], ac:9,  damage:[0,0,0], speed:1,  xpValue:10,  difficulty:3,  freq:3, group:'none',
    flags:new Set(['passive_paralyze']), corpseEffect:'telepathy' },
  gelatinous_cube: { symbol:'b', name:'gelatinous cube', color:COL_MONSTER_EASY,
    hpDice:[4,16,0], ac:8,  damage:[2,4,0], speed:6,  xpValue:15,  difficulty:4,  freq:3, group:'none',
    flags:new Set(['passive_paralyze']), corpseEffect:'safe' },
  skeleton:      { symbol:'Z', name:'skeleton',      color:COL_MONSTER_EASY,
    hpDice:[3,12,0], ac:7,  damage:[1,6,0], speed:6,  xpValue:6,   difficulty:4,  freq:2, group:'none',
    flags:new Set(['undead']), corpseEffect:'safe' },
  warg:          { symbol:'d', name:'warg',          color:COL_MONSTER_EASY,
    hpDice:[2,8,0],  ac:7,  damage:[2,4,0], speed:12, xpValue:7,   difficulty:4,  freq:3, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  giant_spider:  { symbol:'s', name:'giant spider',  color:COL_MONSTER_EASY,
    hpDice:[3,6,0],  ac:5,  damage:[2,4,0], speed:15, xpValue:15,  difficulty:4,  freq:3, group:'none',
    flags:new Set(['poison_attack']), corpseEffect:'poisonous' },
  elf:           { symbol:'@', name:'elf',           color:COL_MONSTER_EASY,
    hpDice:[1,8,0],  ac:9,  damage:[2,6,0], speed:12, xpValue:5,   difficulty:5,  freq:3, group:'small',
    flags:new Set(), corpseEffect:'safe' },
  ogre:          { symbol:'O', name:'ogre',          color:COL_MONSTER_TOUGH,
    hpDice:[3,12,0], ac:5,  damage:[2,6,0], speed:9,  xpValue:12,  difficulty:5,  freq:3, group:'none',
    flags:new Set(), corpseEffect:'safe' },
  wraith:        { symbol:'W', name:'wraith',        color:COL_MONSTER_TOUGH,
    hpDice:[4,16,0], ac:4,  damage:[1,6,0], speed:12, xpValue:10,  difficulty:6,  freq:2, group:'none',
    flags:new Set(['undead','drain_level']), corpseEffect:'safe' },
  mimic:         { symbol:'m', name:'mimic',         color:COL_MONSTER_TOUGH,
    hpDice:[4,12,0], ac:7,  damage:[3,4,0], speed:3,  xpValue:10,  difficulty:6,  freq:2, group:'none',
    flags:new Set(), corpseEffect:'safe' },
  ochre_jelly:   { symbol:'j', name:'ochre jelly',   color:COL_MONSTER_TOUGH,
    hpDice:[6,20,0], ac:8,  damage:[3,6,0], speed:3,  xpValue:20,  difficulty:6,  freq:2, group:'none',
    flags:new Set(), corpseEffect:'safe' },
  troll:         { symbol:'T', name:'troll',         color:COL_MONSTER_TOUGH,
    hpDice:[4,10,5], ac:2,  damage:[2,8,3], speed:10, xpValue:50,  difficulty:7,  freq:3, group:'none',
    flags:new Set(['regenerate']), corpseEffect:'safe' },
  minotaur:      { symbol:'q', name:'minotaur',      color:COL_MONSTER_TOUGH,
    hpDice:[6,20,0], ac:6,  damage:[3,10,0],speed:15, xpValue:35,  difficulty:8,  freq:2, group:'none',
    flags:new Set(), corpseEffect:'safe' },
  vampire:       { symbol:'V', name:'vampire',       color:COL_MONSTER_TOUGH,
    hpDice:[6,24,0], ac:1,  damage:[1,8,0], speed:12, xpValue:40,  difficulty:10, freq:2, group:'none',
    flags:new Set(['undead','drain_level']), corpseEffect:'safe' },
  lich:          { symbol:'L', name:'lich',          color:COL_MONSTER_TOUGH,
    hpDice:[7,24,0], ac:0,  damage:[3,4,0], speed:9,  xpValue:50,  difficulty:11, freq:1, group:'none',
    flags:new Set(['undead','magic_spell']), corpseEffect:'safe' },
  dragon:        { symbol:'D', name:'dragon',        color:COL_MONSTER_TOUGH,
    hpDice:[7,28,0], ac:-1, damage:[4,8,0], speed:9,  xpValue:100, difficulty:12, freq:1, group:'none',
    flags:new Set(['fire_breath']), corpseEffect:'safe' },
};

// ── Weapon data ───────────────────────────────────────────────────────────────
export interface WeaponData {
  symbol: string; name: string; color: string;
  damage: [number, number, number]; weight: number; toHit: number;
}
export const WEAPON_DATA: Record<string, WeaponData> = {
  dagger:           { symbol:')', name:'dagger',           color:COL_ITEM, damage:[1,4,0], weight:10,  toHit:0  },
  hand_axe:         { symbol:')', name:'hand axe',         color:COL_ITEM, damage:[1,6,0], weight:60,  toHit:0  },
  short_sword:      { symbol:')', name:'short sword',      color:COL_ITEM, damage:[1,6,0], weight:30,  toHit:0  },
  spear:            { symbol:')', name:'spear',            color:COL_ITEM, damage:[1,6,0], weight:50,  toHit:0  },
  trident:          { symbol:')', name:'trident',          color:COL_ITEM, damage:[1,6,0], weight:75,  toHit:0  },
  mace:             { symbol:')', name:'mace',             color:COL_ITEM, damage:[1,8,0], weight:40,  toHit:0  },
  flail:            { symbol:')', name:'flail',            color:COL_ITEM, damage:[1,8,0], weight:75,  toHit:0  },
  quarterstaff:     { symbol:')', name:'quarterstaff',     color:COL_ITEM, damage:[1,6,0], weight:40,  toHit:1  },
  long_sword:       { symbol:')', name:'long sword',       color:COL_ITEM, damage:[1,8,1], weight:40,  toHit:1  },
  battle_axe:       { symbol:')', name:'battle axe',       color:COL_ITEM, damage:[2,4,0], weight:120, toHit:0  },
  morning_star:     { symbol:')', name:'morning star',     color:COL_ITEM, damage:[2,4,0], weight:120, toHit:0  },
  two_handed_sword: { symbol:')', name:'two-handed sword', color:COL_ITEM, damage:[3,6,0], weight:150, toHit:0  },
  katana:           { symbol:')', name:'katana',           color:COL_ITEM, damage:[1,10,0],weight:40,  toHit:1  },
  rapier:           { symbol:')', name:'rapier',           color:COL_ITEM, damage:[1,6,0], weight:30,  toHit:2  },
  bow:              { symbol:')', name:'bow',              color:COL_ITEM, damage:[1,6,0], weight:30,  toHit:0  },
};

// ── Armor data ────────────────────────────────────────────────────────────────
export interface ArmorData { symbol: string; name: string; color: string; acBonus: number; weight: number; slot: string; }
export const ARMOR_DATA: Record<string, ArmorData> = {
  leather_armor:      { symbol:'[', name:'leather armor',           color:COL_ITEM, acBonus:-2, weight:50,  slot:'suit'   },
  studded_leather:    { symbol:'[', name:'studded leather armor',   color:COL_ITEM, acBonus:-3, weight:200, slot:'suit'   },
  ring_mail:          { symbol:'[', name:'ring mail',               color:COL_ITEM, acBonus:-3, weight:80,  slot:'suit'   },
  chain_mail:         { symbol:'[', name:'chain mail',              color:COL_ITEM, acBonus:-5, weight:120, slot:'suit'   },
  plate_mail:         { symbol:'[', name:'plate mail',              color:COL_ITEM, acBonus:-7, weight:180, slot:'suit'   },
  elven_mithril:      { symbol:'[', name:'elven mithril-coat',      color:COL_ITEM, acBonus:-5, weight:15,  slot:'suit'   },
  helmet:             { symbol:'[', name:'helmet',                  color:COL_ITEM, acBonus:-1, weight:30,  slot:'helm'   },
  leather_gloves:     { symbol:'[', name:'leather gloves',         color:COL_ITEM, acBonus:-1, weight:8,   slot:'gloves' },
  high_boots:         { symbol:'[', name:'high boots',             color:COL_ITEM, acBonus:-1, weight:20,  slot:'boots'  },
  small_shield:       { symbol:'[', name:'small shield',           color:COL_ITEM, acBonus:-1, weight:30,  slot:'shield' },
  large_shield:       { symbol:'[', name:'large shield',           color:COL_ITEM, acBonus:-2, weight:100, slot:'shield' },
  cloak_of_protection:{ symbol:'[', name:'cloak of protection',    color:COL_ITEM, acBonus:-3, weight:10,  slot:'cloak'  },
};

// ── Food data ─────────────────────────────────────────────────────────────────
export interface FoodData { symbol: string; name: string; color: string; nutrition: number; weight: number; }
export const FOOD_DATA: Record<string, FoodData> = {
  ration:    { symbol:'%', name:'food ration',   color:COL_ITEM, nutrition:400, weight:20 },
  cram:      { symbol:'%', name:'cram ration',   color:COL_ITEM, nutrition:600, weight:15 },
  k_ration:  { symbol:'%', name:'K-ration',      color:COL_ITEM, nutrition:400, weight:10 },
  c_ration:  { symbol:'%', name:'C-ration',      color:COL_ITEM, nutrition:300, weight:10 },
  lembas:    { symbol:'%', name:'lembas wafer',  color:COL_ITEM, nutrition:800, weight:5  },
  apple:     { symbol:'%', name:'apple',         color:COL_ITEM, nutrition:100, weight:2  },
  banana:    { symbol:'%', name:'banana',        color:COL_ITEM, nutrition:80,  weight:2  },
  carrot:    { symbol:'%', name:'carrot',        color:COL_ITEM, nutrition:50,  weight:1  },
  pear:      { symbol:'%', name:'pear',          color:COL_ITEM, nutrition:50,  weight:2  },
  melon:     { symbol:'%', name:'melon',         color:COL_ITEM, nutrition:100, weight:30 },
  orange:    { symbol:'%', name:'orange',        color:COL_ITEM, nutrition:80,  weight:2  },
  slime_mold:{ symbol:'%', name:'slime mold',    color:COL_ITEM, nutrition:100, weight:5  },
  lizard:    { symbol:'%', name:'lizard corpse', color:COL_ITEM, nutrition:40,  weight:3  },
};

// ── Potion data ───────────────────────────────────────────────────────────────
export interface PotionData {
  symbol: string; name: string; color: string; effect: string;
  healAmount?: [number, number, number];
  damage?: [number, number, number];
  duration?: number;
}
export const POTION_DATA: Record<string, PotionData> = {
  healing:         { symbol:'!', name:'potion of healing',         color:COL_ITEM, effect:'heal',            healAmount:[2,8,2] },
  extra_healing:   { symbol:'!', name:'potion of extra healing',   color:COL_ITEM, effect:'heal',            healAmount:[4,8,4] },
  full_healing:    { symbol:'!', name:'potion of full healing',    color:COL_ITEM, effect:'full_heal' },
  poison:          { symbol:'!', name:'potion of sickness',        color:COL_ITEM, effect:'poison',          damage:[1,6,0] },
  sickness:        { symbol:'!', name:'potion of sickness',        color:COL_ITEM, effect:'sickness',        duration:20 },
  acid:            { symbol:'!', name:'potion of acid',            color:COL_ITEM, effect:'acid',            damage:[1,6,0] },
  speed:           { symbol:'!', name:'potion of speed',           color:COL_ITEM, effect:'speed',           duration:20 },
  levitation:      { symbol:'!', name:'potion of levitation',      color:COL_ITEM, effect:'levitation',      duration:20 },
  confusion:       { symbol:'!', name:'potion of confusion',       color:COL_ITEM, effect:'confusion',       duration:10 },
  blindness:       { symbol:'!', name:'potion of blindness',       color:COL_ITEM, effect:'blindness',       duration:15 },
  paralysis:       { symbol:'!', name:'potion of paralysis',       color:COL_ITEM, effect:'paralysis',       duration:5 },
  invisibility:    { symbol:'!', name:'potion of invisibility',    color:COL_ITEM, effect:'invisibility' },
  gain_ability:    { symbol:'!', name:'potion of gain ability',    color:COL_ITEM, effect:'gain_str' },
  see_invisible:   { symbol:'!', name:'potion of see invisible',   color:COL_ITEM, effect:'see_invisible' },
  water:           { symbol:'!', name:'potion of water',           color:COL_ITEM, effect:'water' },
  booze:           { symbol:'!', name:'potion of booze',           color:COL_ITEM, effect:'booze',           duration:5 },
  restore_ability: { symbol:'!', name:'potion of restore ability', color:COL_ITEM, effect:'restore_ability' },
  gain_level:      { symbol:'!', name:'potion of gain level',      color:COL_ITEM, effect:'gain_level' },
};

// ── Scroll data ───────────────────────────────────────────────────────────────
export interface ScrollData { symbol: string; name: string; color: string; effect: string; label?: string; }
export const SCROLL_DATA: Record<string, ScrollData> = {
  identify:       { symbol:'?', name:'scroll of identify',       color:COL_ITEM, effect:'identify' },
  teleportation:  { symbol:'?', name:'scroll of teleportation',  color:COL_ITEM, effect:'teleport' },
  enchant_weapon: { symbol:'?', name:'scroll of enchant weapon', color:COL_ITEM, effect:'enchant_weapon' },
  enchant_armor:  { symbol:'?', name:'scroll of enchant armor',  color:COL_ITEM, effect:'enchant_armor' },
  magic_mapping:  { symbol:'?', name:'scroll of magic mapping',  color:COL_ITEM, effect:'magic_mapping' },
  remove_curse:   { symbol:'?', name:'scroll of remove curse',   color:COL_ITEM, effect:'remove_curse',   label:'XYZZY PLUGH' },
  genocide:       { symbol:'?', name:'scroll of genocide',       color:COL_ITEM, effect:'genocide',       label:'NR 9' },
  taming:         { symbol:'?', name:'scroll of taming',         color:COL_ITEM, effect:'taming',         label:'ABRA KA DABRA' },
  scare_monster:  { symbol:'?', name:'scroll of scare monster',  color:COL_ITEM, effect:'scare_monster',  label:'ELBERETH' },
  fire:           { symbol:'?', name:'scroll of fire',           color:COL_ITEM, effect:'fire',           label:'FOOBIE BLETCH' },
  earth:          { symbol:'?', name:'scroll of earth',          color:COL_ITEM, effect:'earth',          label:'ELBIB YLOH' },
  create_monster: { symbol:'?', name:'scroll of create monster', color:COL_ITEM, effect:'create_monster', label:'ZELGO MER' },
};

// ── Ring data ─────────────────────────────────────────────────────────────────
export interface RingData { name: string; adjective: string; effect: string; power: number; }
export const RING_DATA: Record<string, RingData> = {
  protection:       { name:'ring of protection',        adjective:'plain',      effect:'ac_bonus',     power:3 },
  fire_res:         { name:'ring of fire resistance',   adjective:'onyx',       effect:'fire_resist',  power:0 },
  cold_res:         { name:'ring of cold resistance',   adjective:'sapphire',   effect:'cold_resist',  power:0 },
  poison_res:       { name:'ring of poison resistance', adjective:'jade',       effect:'poison_resist', power:0 },
  hunger:           { name:'ring of slow digestion',    adjective:'ivory',      effect:'slow_hunger',  power:0 },
  regeneration:     { name:'ring of regeneration',      adjective:'coral',      effect:'regen',        power:0 },
  searching:        { name:'ring of searching',         adjective:'wooden',     effect:'searching',    power:0 },
  stealth:          { name:'ring of stealth',           adjective:'obsidian',   effect:'stealth',      power:0 },
  teleportation:    { name:'ring of teleportation',     adjective:'ammolite',   effect:'teleport',     power:0 },
  levitation:       { name:'ring of levitation',        adjective:'pearl',      effect:'levitate',     power:0 },
  strength:         { name:'ring of gain strength',     adjective:'iron',       effect:'str_bonus',    power:2 },
  invisibility:     { name:'ring of invisibility',      adjective:'moonshadow', effect:'invisible',    power:0 },
  see_invis:        { name:'ring of see invisible',     adjective:'crystal',    effect:'see_invis',    power:0 },
  conflict:         { name:'ring of conflict',          adjective:'ruby',       effect:'conflict',     power:0 },
  free_action:      { name:'ring of free action',       adjective:'emerald',    effect:'free_action',  power:0 },
  sustain_ability:  { name:'ring of sustain ability',   adjective:'diamond',    effect:'sustain',      power:0 },
  aggravate:        { name:'ring of aggravate monster', adjective:'tiger eye',  effect:'aggravate',    power:0 },
  adornment:        { name:'ring of adornment',         adjective:'gold',       effect:'charisma',     power:2 },
};

// ── Wand data ─────────────────────────────────────────────────────────────────
export interface WandData { name: string; material: string; effect: string; charges: [number, number]; }
export const WAND_DATA: Record<string, WandData> = {
  wishing:       { name:'wand of wishing',        material:'glass',    effect:'wish',         charges:[1,3]   },
  death:         { name:'wand of death',          material:'ebony',    effect:'death',        charges:[3,8]   },
  polymorph:     { name:'wand of polymorph',      material:'copper',   effect:'polymorph',    charges:[3,8]   },
  teleport_away: { name:'wand of teleportation',  material:'brass',    effect:'teleport_away',charges:[3,8]   },
  cancellation:  { name:'wand of cancellation',   material:'platinum', effect:'cancellation', charges:[3,8]   },
  striking:      { name:'wand of striking',       material:'oaken',    effect:'striking',     charges:[3,8]   },
  magic_missile: { name:'wand of magic missile',  material:'balsa',    effect:'magic_missile',charges:[3,8]   },
  fire:          { name:'wand of fire',           material:'steel',    effect:'fire_bolt',    charges:[3,8]   },
  cold:          { name:'wand of cold',           material:'silver',   effect:'cold_bolt',    charges:[3,8]   },
  lightning:     { name:'wand of lightning',      material:'tin',      effect:'lightning',    charges:[3,8]   },
  sleep:         { name:'wand of sleep',          material:'bamboo',   effect:'sleep_bolt',   charges:[3,8]   },
  slow_monster:  { name:'wand of slow monster',   material:'maple',    effect:'slow',         charges:[3,8]   },
  speed_monster: { name:'wand of speed monster',  material:'pine',     effect:'haste_monster',charges:[3,8]   },
  digging:       { name:'wand of digging',        material:'iron',     effect:'dig',          charges:[3,8]   },
  light:         { name:'wand of light',          material:'crystal',  effect:'light',        charges:[10,20] },
};

// ── Potion / scroll / ring / wand flavour text (randomised per game) ──────────
export const POTION_COLORS = [
  'ruby','pink','orange','yellow','emerald','cyan','magenta','milky',
  'muddy','smoky','golden','dark','clear','effervescent','slimy','bubbly',
  'white','fizzy','swirly','thick','sparkling','brown','sickly',
];

// Hex colour for each potion appearance name — used to tint the floor glyph
export const POTION_COLOR_HEX: Record<string, string> = {
  ruby:         '#ee2233',
  pink:         '#ff88bb',
  orange:       '#ff8800',
  yellow:       '#ffee00',
  emerald:      '#00cc44',
  cyan:         '#00ddee',
  magenta:      '#ff44ee',
  milky:        '#ddddc8',
  muddy:        '#7a5533',
  smoky:        '#aaaaaa',
  golden:       '#ffcc00',
  dark:         '#442233',
  clear:        '#aaddff',
  effervescent: '#88ffcc',
  slimy:        '#44aa22',
  bubbly:       '#88aaff',
  white:        '#eeeeff',
  fizzy:        '#aaffee',
  swirly:       '#bb88ff',
  thick:        '#996644',
  sparkling:    '#ffccff',
  brown:        '#884422',
  sickly:       '#99aa44',
};
export const SCROLL_LABELS = [
  'ZELGO MER','JUYED AWK YACC','NR 9','XIXAXA XOXAXA','PRATYAVAYAH',
  'DAIYEN FANSEN','LEP GEX VEN ZEA','TEMOV','GARVEN DEH','READ ME',
  'ELBIB YLOH','VERR YED HULL','VENZAR BORGAVVE','THARR','YUM YUM',
  'DUAM QUASSIN',
];
export const RING_ADJECTIVES = [
  'plain','onyx','sapphire','jade','ivory','coral','wooden','obsidian',
  'ammolite','pearl','iron','moonshadow','crystal','ruby','emerald',
  'diamond','tiger eye','gold',
];
export const WAND_MATERIALS = [
  'glass','ebony','copper','brass','platinum','oaken','balsa','steel',
  'silver','tin','bamboo','maple','pine','iron','crystal',
];

// ── Character roles ───────────────────────────────────────────────────────────

export type Alignment = 'lawful' | 'neutral' | 'chaotic';

export interface RoleData {
  name:        string;
  baseStats:   [number,number,number,number,number,number]; // STR INT WIS DEX CON CHA
  hpStart:     number;
  hpDice:      [number,number]; // HP/level = fix + roll(1,rand)
  alignments:  Alignment[];
  startWeapon: string;          // key from WEAPON_DATA
  startArmor:  string | null;   // key from ARMOR_DATA or null
  description: string;
}

export const ROLE_DATA: Record<string, RoleData> = {
  barbarian: {
    name: 'Barbarian', baseStats: [16,7,7,15,16,6], hpStart: 14, hpDice: [2,10],
    alignments: ['neutral','chaotic'], startWeapon: 'battle_axe', startArmor: 'leather_armor',
    description: 'A fierce warrior from the wilderness. High strength and constitution. Favors brute force over finesse.',
  },
  valkyrie: {
    name: 'Valkyrie', baseStats: [10,7,7,7,10,7], hpStart: 14, hpDice: [2,8],
    alignments: ['lawful','neutral'], startWeapon: 'long_sword', startArmor: 'ring_mail',
    description: 'A shield maiden of legend. Well-balanced fighter with good survivability and lawful bearing.',
  },
  wizard: {
    name: 'Wizard', baseStats: [7,10,7,7,7,7], hpStart: 10, hpDice: [1,8],
    alignments: ['neutral','chaotic'], startWeapon: 'quarterstaff', startArmor: null,
    description: 'A wielder of arcane magic. Fragile but possessing broad knowledge of spells and scrolls.',
  },
  rogue: {
    name: 'Rogue', baseStats: [7,7,7,10,7,6], hpStart: 10, hpDice: [1,8],
    alignments: ['chaotic'], startWeapon: 'dagger', startArmor: 'leather_armor',
    description: 'A cunning scoundrel. High dexterity makes for precise strikes and good evasion. Chaotic only.',
  },
  healer: {
    name: 'Healer', baseStats: [7,7,13,7,11,16], hpStart: 11, hpDice: [1,8],
    alignments: ['neutral'], startWeapon: 'dagger', startArmor: null,
    description: 'A skilled medic with high wisdom and charisma. Starts with extra healing potions.',
  },
  knight: {
    name: 'Knight', baseStats: [13,7,14,8,10,17], hpStart: 14, hpDice: [2,8],
    alignments: ['lawful'], startWeapon: 'long_sword', startArmor: 'ring_mail',
    description: 'An armored warrior of noble bearing. High strength and charisma. Strictly lawful alignment.',
  },
};

// ── Character races ───────────────────────────────────────────────────────────

export interface RaceData {
  name:        string;
  statMods:    [number,number,number,number,number,number]; // STR INT WIS DEX CON CHA
  alignments:  Alignment[];
  description: string;
}

export const RACE_DATA: Record<string, RaceData> = {
  human:  { name:'Human',  statMods:[0,0,0,0,0,0],   alignments:['lawful','neutral','chaotic'], description:'Adaptable and versatile. No bonuses or penalties. Compatible with any role and alignment.' },
  elf:    { name:'Elf',    statMods:[-1,2,0,2,-2,0],  alignments:['neutral','chaotic'],          description:'Graceful and intelligent. +2 INT and DEX, -1 STR, -2 CON. Cannot be lawful.' },
  dwarf:  { name:'Dwarf',  statMods:[2,0,0,0,2,-2],   alignments:['lawful','neutral'],           description:'Tough and strong. +2 STR and CON, -2 CHA. Cannot be chaotic.' },
  gnome:  { name:'Gnome',  statMods:[0,2,0,2,0,-2],   alignments:['neutral'],                   description:'Small and clever. +2 INT and DEX, -2 CHA. Neutral alignment only.' },
  orc:    { name:'Orc',    statMods:[3,-2,0,0,3,-4],  alignments:['chaotic'],                   description:'Brutally powerful. +3 STR and CON, -2 INT, -4 CHA. Chaotic alignment only.' },
};

// ── Name tables ───────────────────────────────────────────────────────────────

export const NAME_TABLES: Record<string, { male: string[]; female: string[] }> = {
  human: {
    male:   ['Alaric','Baldric','Cedric','Duncan','Edmund','Faramir','Gerard','Harold','Ivar','Jorik'],
    female: ['Aelith','Brenna','Cynara','Delia','Elena','Freya','Gwen','Hilde','Isolde','Juna'],
  },
  elf: {
    male:   ['Aerindel','Caeron','Elrohir','Faladel','Gildor','Haldir','Ithilnor','Legolin'],
    female: ['Aelindra','Caladwen','Elenmir','Finduilas','Galawen','Miriel','Nimrodel'],
  },
  dwarf: {
    male:   ['Bronn','Dvalin','Farin','Gimvar','Hrolf','Kili','Nori','Thorin','Bifur','Bofur'],
    female: ['Dis','Fara','Helga','Ingrid','Kara','Sigrid','Thyra','Ylva'],
  },
  gnome: {
    male:   ['Alrik','Bimble','Clef','Drix','Emnic','Fimble','Gimble','Hobble'],
    female: ['Bimpsy','Cimble','Dimble','Elvy','Fimsy','Gilda','Nimble','Wimble'],
  },
  orc: {
    male:   ['Grak','Morg','Vroth','Krak','Druk','Gorb','Krog','Thrak','Urgh','Bruk'],
    female: ['Grukka','Morga','Vritha','Krakka','Druka','Gorba','Kroga'],
  },
};
