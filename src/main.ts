import { CanvasRenderer } from './renderer';
import { GameState } from './game';
import { renderView } from './raycaster';
import {
  drawMessages, drawStatus, drawMinimap, drawInventory,
  drawTitle, drawDeath, drawWin, drawHelp, drawFullMap, updateExplored,
  drawCharGen, MSG_ROWS, STATUS_ROWS,
} from './ui';
import { ROLE_DATA, RACE_DATA, NAME_TABLES, Alignment } from './data';
import { ROTATE_SPEED, MOUSE_YAW_SENS, MOUSE_PITCH_SENS, MAX_PITCH_FRAC, ItemType, COL_ITEM, COL_GOLD, COL_RING, COL_WAND } from './constants';
import { FloorItem } from './items';

// ── Item → sprite helper ──────────────────────────────────────────────────────

function itemSprite(fi: FloorItem): { x: number; y: number; symbol: string; color: string; kind: string } {
  const item = fi.item;
  let symbol: string;
  let color = COL_ITEM;
  let kind: string;
  if (item.isAmuletOfYendor) { symbol = '"'; color = '#ffee88'; kind = 'amulet'; }
  else switch (item.type) {
    case ItemType.WEAPON: symbol = ')'; kind = 'weapon'; break;
    case ItemType.ARMOR:  symbol = '['; kind = 'armor';  break;
    case ItemType.FOOD:   symbol = '%'; kind = 'food';   break;
    case ItemType.POTION: symbol = '!'; color = item.appearanceColor ?? COL_ITEM; kind = 'potion'; break;
    case ItemType.SCROLL: symbol = '?'; kind = 'scroll'; break;
    case ItemType.GOLD:   symbol = '$'; color = COL_GOLD; kind = 'gold'; break;
    case ItemType.RING:   symbol = '='; color = COL_RING; kind = 'ring'; break;
    case ItemType.WAND:   symbol = '/'; color = COL_WAND; kind = 'wand'; break;
    default:              symbol = '*'; kind = 'unknown'; break;
  }
  return { x: fi.x, y: fi.y, symbol, color, kind };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const canvas    = document.getElementById('game') as HTMLCanvasElement;
const uiCanvas  = document.getElementById('ui')   as HTMLCanvasElement;
const overlay   = document.getElementById('overlay') as HTMLDivElement;

// Game canvas: small font → maximum raycaster resolution
// UI canvas:   larger font → readable menus/status, transparent background
const gameRenderer = new CanvasRenderer(canvas,   5);
const uiRenderer   = new CanvasRenderer(uiCanvas, 14, /* transparent= */ true);

const gs = new GameState();

// ── Character creator state ────────────────────────────────────────────────────
type CharGenStep = 'role' | 'race' | 'alignment' | 'confirm';
interface CharGenState {
  step:      CharGenStep;
  cursor:    number;
  roleKey:   string;
  raceKey:   string;
  alignment: import('./data').Alignment | '';
  charName:  string;
  gender:    'male' | 'female';
}
let cg: CharGenState = {
  step: 'role', cursor: 0, roleKey: 'barbarian', raceKey: 'human',
  alignment: '', charName: 'Aldric', gender: 'male',
};

// ── Keyboard state ────────────────────────────────────────────────────────────

const keys = new Set<string>();

// Held-key repeat: first press fires immediately, then 150ms delay, then every 80ms
interface KeyRepeat { key: string; firstFired: boolean; timer: number; repeatTimer: number; }
const heldKeys = new Map<string, KeyRepeat>();
const REPEAT_DELAY = 150;
const REPEAT_RATE  = 80;

document.addEventListener('keydown', e => {
  if (e.repeat) return;
  keys.add(e.key);
  heldKeys.set(e.key, { key: e.key, firstFired: false, timer: 0, repeatTimer: 0 });
  handleKeyImmediate(e.key, e);
});

document.addEventListener('keyup', e => {
  keys.delete(e.key);
  heldKeys.delete(e.key);
});

// ── Chargen helpers ────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function randomCharGen(): void {
  const roleKeys  = Object.keys(ROLE_DATA);
  const roleKey   = pickRandom(roleKeys);
  const role      = ROLE_DATA[roleKey];
  const raceKeys  = Object.keys(RACE_DATA).filter(rk =>
    RACE_DATA[rk].alignments.some(a => role.alignments.includes(a))
  );
  const raceKey   = pickRandom(raceKeys);
  const race      = RACE_DATA[raceKey];
  const aligns    = (role.alignments as Alignment[]).filter(a => race.alignments.includes(a));
  const alignment = pickRandom(aligns);
  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
  const names     = NAME_TABLES[raceKey]?.[gender] ?? NAME_TABLES['human'][gender];
  const charName  = pickRandom(names);
  gs.initWithChar({ role: roleKey, race: raceKey, alignment, charName, gender });
  cg = { step: 'role', cursor: 0, roleKey, raceKey, alignment, charName, gender };
}

function advanceCharGen(): void {
  const roleKeys  = Object.keys(ROLE_DATA);
  const raceKeys  = Object.keys(RACE_DATA);

  if (cg.step === 'role') {
    cg.roleKey = roleKeys[cg.cursor] ?? cg.roleKey;
    // Reset race/alignment if incompatible
    const newRole = ROLE_DATA[cg.roleKey];
    if (!RACE_DATA[cg.raceKey]?.alignments.some(a => newRole.alignments.includes(a))) {
      cg.raceKey = 'human';
    }
    cg.step   = 'race';
    cg.cursor = raceKeys.indexOf(cg.raceKey);

  } else if (cg.step === 'race') {
    const rk = raceKeys[cg.cursor];
    if (rk && RACE_DATA[rk].alignments.some(a => ROLE_DATA[cg.roleKey].alignments.includes(a))) {
      cg.raceKey = rk;
    }
    // Build alignment list
    const roleAligns = new Set(ROLE_DATA[cg.roleKey].alignments);
    const raceAligns = new Set(RACE_DATA[cg.raceKey].alignments);
    const validAligns = (['lawful','neutral','chaotic'] as Alignment[]).filter(a => roleAligns.has(a) && raceAligns.has(a));
    cg.step  = 'alignment';
    cg.cursor = cg.alignment ? validAligns.indexOf(cg.alignment as Alignment) : 0;
    if (cg.cursor < 0) cg.cursor = 0;

  } else if (cg.step === 'alignment') {
    const roleAligns = new Set(ROLE_DATA[cg.roleKey].alignments);
    const raceAligns = new Set(RACE_DATA[cg.raceKey].alignments);
    const validAligns = (['lawful','neutral','chaotic'] as Alignment[]).filter(a => roleAligns.has(a) && raceAligns.has(a));
    cg.alignment = validAligns[cg.cursor] ?? validAligns[0];
    // Pick random name for the selected race+gender
    const names  = NAME_TABLES[cg.raceKey]?.[cg.gender] ?? NAME_TABLES['human'][cg.gender];
    cg.charName  = pickRandom(names);
    cg.step      = 'confirm';
    cg.cursor    = 0;

  } else if (cg.step === 'confirm') {
    gs.initWithChar({
      role: cg.roleKey, race: cg.raceKey,
      alignment: cg.alignment as Alignment,
      charName: cg.charName, gender: cg.gender,
    });
  }
}

function maxCursorForStep(step: CharGenStep): number {
  if (step === 'role') return Object.keys(ROLE_DATA).length - 1;
  if (step === 'race') return Object.keys(RACE_DATA).length - 1;
  if (step === 'alignment') {
    const roleAligns = new Set(ROLE_DATA[cg.roleKey]?.alignments ?? []);
    const raceAligns = new Set(RACE_DATA[cg.raceKey]?.alignments ?? []);
    return (['lawful','neutral','chaotic'] as Alignment[]).filter(a => roleAligns.has(a) && raceAligns.has(a)).length - 1;
  }
  return 0;
}

// Actions that should fire exactly once on keydown
function handleKeyImmediate(key: string, e: KeyboardEvent): void {
  if (gs.phase === 'title') {
    if (key === 'Enter' || key === ' ') {
      cg = { step: 'role', cursor: 0, roleKey: 'barbarian', raceKey: 'human', alignment: '', charName: 'Aldric', gender: 'male' };
      gs.init();
    }
    return;
  }

  if (gs.phase === 'chargen') {
    switch (key) {
      case 'ArrowUp':   cg.cursor = Math.max(0, cg.cursor - 1); break;
      case 'ArrowDown': cg.cursor = Math.min(maxCursorForStep(cg.step), cg.cursor + 1); break;
      case 'Enter':     advanceCharGen(); break;
      case 'r': case 'R': randomCharGen(); break;
      case 'Escape':
        if (cg.step === 'role') { gs.phase = 'title'; }
        else if (cg.step === 'race')      { cg.step = 'role';      cg.cursor = Object.keys(ROLE_DATA).indexOf(cg.roleKey); }
        else if (cg.step === 'alignment') { cg.step = 'race';      cg.cursor = Object.keys(RACE_DATA).indexOf(cg.raceKey); }
        else if (cg.step === 'confirm')   { cg.step = 'alignment'; cg.cursor = 0; }
        break;
    }
    e.preventDefault();
    return;
  }
  if (gs.phase === 'dead' || gs.phase === 'won') {
    if (key === 'Enter' || key === ' ') { gs.init(); }
    if (key === 'Q' || key === 'q') { /* can't really quit browser */ }
    return;
  }

  if (gs.phase === 'inventory') {
    handleInventoryKey(key);
    e.preventDefault();
    return;
  }

  if (gs.phase === 'help') {
    if (key === 'Escape' || key === '?') gs.phase = 'playing';
    e.preventDefault();
    return;
  }

  if (gs.phase === 'map') {
    if (key === 'Escape' || key === 'm') gs.phase = 'playing';
    e.preventDefault();
    return;
  }

  // Playing
  switch (key) {
    case 'Escape': if (pointerLocked) document.exitPointerLock(); break;
    case 'i': gs.phase = 'inventory'; invIdx = 0; break;
    case 'm': gs.phase = 'map'; break;
    case '?': gs.phase = 'help'; break;
    case ',': gs.tryPickup(); break;
    case '.': case ' ': gs.processTurn(); break;
    case 'v': case 'V': pitchInvert = !pitchInvert; break;
    case '>': gs.tryDescend(); break;
    case '<': gs.tryAscend(); break;
    case 'z': {
      // Zap first wand in inventory
      const wand = gs.player.inventory.find(i => i.type === ItemType.WAND);
      if (wand) {
        const zapMsgs: string[] = [];
        gs.zapWand(wand, zapMsgs);
        for (const m of zapMsgs) gs.addMsg(m);
        if (zapMsgs.length) gs.processTurn();
      } else {
        gs.addMsg('You have no wand to zap.');
      }
      break;
    }
    case 'Q': if (confirm('Really quit?')) { gs.phase = 'dead'; } break;
  }
  if (['i','m','?',',','.',' ','<','>','z'].includes(key)) e.preventDefault();
}

// Inventory UI state
let invIdx = 0;

function handleInventoryKey(key: string): void {
  const inv = gs.player.inventory;
  switch (key) {
    case 'Escape': gs.phase = 'playing'; break;
    case 'i':      gs.phase = 'playing'; break;
    case 'ArrowUp':   invIdx = Math.max(0, invIdx - 1); break;
    case 'ArrowDown': invIdx = Math.min(inv.length - 1, invIdx + 1); break;
    case 'Enter': {
      const item = inv[invIdx];
      if (item) { gs.useItem(item); gs.phase = 'playing'; }
      break;
    }
    case 'd': {
      const item = inv[invIdx];
      if (item) { gs.dropItem(item); invIdx = Math.max(0, Math.min(invIdx, inv.length - 1)); gs.phase = 'playing'; }
      break;
    }
  }
}

// ── Mouse / Pointer Lock ──────────────────────────────────────────────────────

let pointerLocked = false;
let pitchRows = 0;      // accumulated pitch (in row units)
let pitchInvert = false;

// The browser spec forbids re-acquiring pointer lock after Escape — so instead
// we use the Keyboard Lock API (Chrome/Edge) to intercept Escape ourselves
// before the browser sees it.  When keyboard.lock is unavailable (Firefox/Safari)
// Escape still releases pointer lock as normal; menus can still be closed with
// their dedicated keys (?, m, i).
function acquirePointerLock(): void {
  canvas.requestPointerLock();
  const kb = (navigator as any).keyboard;
  if (kb?.lock) kb.lock(['Escape']).catch(() => {});
}

canvas.addEventListener('click', () => {
  if (!pointerLocked) acquirePointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) {
    overlay.classList.add('hidden');
  } else {
    (navigator as any).keyboard?.unlock?.();
    overlay.classList.remove('hidden');
  }
});

document.addEventListener('mousemove', e => {
  if (!pointerLocked || gs.phase !== 'playing') return;
  gs.player.angle += e.movementX * MOUSE_YAW_SENS;
  pitchRows       += e.movementY * MOUSE_PITCH_SENS * (pitchInvert ? -1 : 1);
});

// ── Resize ────────────────────────────────────────────────────────────────────

function resize(): void {
  const w = Math.round(window.innerWidth  * 0.80);
  const h = Math.round(window.innerHeight * 0.80);
  gameRenderer.resize(w, h);
  uiRenderer.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// ── Game loop ─────────────────────────────────────────────────────────────────

let lastTime = 0;

function frame(time: number): void {
  const dt = time - lastTime;
  lastTime = time;

  processHeldKeys(dt);

  if (gs.phase === 'playing') {
    const viewH    = uiRenderer.rows - MSG_ROWS - STATUS_ROWS;
    const maxPitch = Math.floor(viewH * MAX_PITCH_FRAC);
    pitchRows      = Math.max(-maxPitch, Math.min(maxPitch, pitchRows));
    gs.player.pitch = Math.round(pitchRows);

    // Bob amplitude decays to 0 when standing still (~300 ms half-life)
    gs.player.bobAmplitude = Math.max(0, gs.player.bobAmplitude - dt * 0.004);

    updateExplored(gs.currentLevel, gs.player);
  }

  render();
  requestAnimationFrame(frame);
}

function processHeldKeys(dt: number): void {
  if (gs.phase !== 'playing') return;

  for (const [key, state] of heldKeys) {
    // Rotation: free (no turn cost)
    if (key === 'ArrowLeft' || key === 'q') {
      gs.player.angle -= ROTATE_SPEED;
      continue;
    }
    if (key === 'ArrowRight' || key === 'e') {
      gs.player.angle += ROTATE_SPEED;
      continue;
    }

    // Movement keys: fire first press immediately (already done), then with repeat
    let isMove = false;
    let forward = 0, strafe = 0;
    switch (key) {
      case 'w': case 'k': forward =  1; isMove = true; break;
      case 's': case 'j': forward = -1; isMove = true; break;
      case 'a': case 'h': strafe  = -1; isMove = true; break;
      case 'd': case 'l': strafe  =  1; isMove = true; break;
    }

    if (!isMove) continue;

    if (!state.firstFired) {
      // First fire already happened in keydown; just mark it
      state.firstFired = true;
      state.timer = 0;
      continue;
    }

    state.timer += dt;
    if (state.timer >= REPEAT_DELAY + state.repeatTimer * REPEAT_RATE) {
      state.repeatTimer++;
      gs.tryMove(forward, strafe);
    }
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function render(): void {
  gameRenderer.clear();
  uiRenderer.clear();

  switch (gs.phase) {
    case 'title':
      drawTitle(uiRenderer);
      break;

    case 'chargen':
      drawCharGen(uiRenderer, cg.step, cg.cursor, cg.roleKey, cg.raceKey, cg.alignment, cg.charName, cg.gender);
      break;

    case 'dead':
      drawDeath(uiRenderer, gs);
      break;

    case 'won':
      drawWin(uiRenderer, gs);
      break;

    case 'map':
      drawFullMap(uiRenderer, gs.currentLevel, gs.dlvl, gs.player,
        gs.currentMonsters, gs.currentItems);
      break;

    case 'playing':
    case 'inventory':
    case 'help': {
      // ── Game canvas: full-viewport raycaster (no UI margins) ──────────────
      renderView(gameRenderer, gs.player, gs.currentLevel, gs.currentMonsters,
        gs.currentItems.map(itemSprite),
        0, 0, gameRenderer.cols, gameRenderer.rows);

      // ── UI canvas: HUD elements at readable font size ─────────────────────
      const uiViewY = MSG_ROWS;
      const uiViewH = uiRenderer.rows - MSG_ROWS - STATUS_ROWS;

      drawMinimap(uiRenderer, gs.currentLevel, gs.player,
        gs.currentMonsters, gs.currentItems, uiViewY, uiViewH);
      drawMessages(uiRenderer, gs.messages, gs.turns - gs.lastMsgTurn);
      drawStatus(uiRenderer, gs);

      if (gs.phase === 'inventory') drawInventory(uiRenderer, gs.player, invIdx);
      if (gs.phase === 'help')      drawHelp(uiRenderer, pitchInvert);
      break;
    }
  }

  gameRenderer.flush();
  uiRenderer.flush();
}

// ── First move on keydown (not repeat) ────────────────────────────────────────
// The keydown handler calls handleKeyImmediate which handles non-move keys.
// For move keys, we fire the first move here separately to avoid delay.
document.addEventListener('keydown', e => {
  if ((gs.phase !== 'playing' && gs.phase !== 'help') || e.repeat) return;
  if (gs.phase === 'help') return;
  let forward = 0, strafe = 0;
  switch (e.key) {
    case 'w': case 'k': forward =  1; break;
    case 's': case 'j': forward = -1; break;
    case 'a': case 'h': strafe  = -1; break;
    case 'd': case 'l': strafe  =  1; break;
    default: return;
  }
  e.preventDefault();
  gs.tryMove(forward, strafe);
});

// ── Start ─────────────────────────────────────────────────────────────────────

requestAnimationFrame(frame);
