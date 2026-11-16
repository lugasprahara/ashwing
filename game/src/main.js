// Ashwing's boot and main loop: a fixed-step simulation (120 steps a
// second, so bullet patterns stay identical on every display) under a
// requestAnimationFrame renderer.
//
// Screenshot poses: open the page with ?shot=menu|action|boss|over and
// an optional &seed=n and the game sets that scene up deterministically
// and plays it in demo mode (the pilot is invulnerable and the scene is
// kept stocked), which is how the entry's screenshots were taken.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = new Input(canvas);
const sfx = new Sfx();
const game = new Game(input, sfx);
const renderer = new Renderer();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') ?? 1) || 1;
let demo = false;

if (shot) {
  const names = { menu: 'menu', start: 'menu', action: 'action', play: 'action', boss: 'boss', end: 'over', over: 'over' };
  game.pose(names[shot] ?? 'menu', seed);
  demo = true;
}

// In demo (screenshot) mode, keep the action scene stocked: the pose is a
// living diorama, not a freeze-frame.
function stockDemo(dt) {
  if (!demo || game.mode !== 'play') return;
  game.player.invulnT = Math.max(game.player.invulnT, 1);
  if (game.boss && game.boss.hp < game.boss.maxHp * 0.55) {
    game.boss.hp = Math.round(game.boss.maxHp * 0.62); // the diorama boss never falls
  }
  if (game.wave === 3 && game.enemies.length < 5 && Math.random() < dt * 0.8) {
    const kinds = ['dart', 'weaver', 'gunner'];
    game.spawnEnemy(kinds[Math.floor(Math.random() * kinds.length)], 80 + Math.random() * 380);
  }
}

const STEP = 1 / 120;
let acc = 0;
let last = performance.now();

function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.step(STEP);
    stockDemo(STEP);
    acc -= STEP;
  }
  sfx.pumpMusic();
  renderer.draw(ctx, game, sfx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// First interaction unlocks audio (browser policy) and, on the title
// screen, the same click or keypress launches the run via the game.
addEventListener('pointerdown', () => sfx.unlock(), { once: false });
addEventListener('keydown', () => sfx.unlock(), { once: false });

window.__game = { game, sfx, pose: (name, s = 1) => game.pose(name, s) };
