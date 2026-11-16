// Ashwing's simulation: player, weapons, enemies, the boss, bullets,
// particles, pickups, the chain multiplier and the wave director.
//
// Everything is plain objects in arrays, stepped at a fixed dt by
// main.js. The renderer (render.js) only reads this state. Determinism
// for the screenshot poses comes from the seeded RNG: poses reseed it,
// set the scene up directly, and let the normal step run.

import { WAVES, formation } from './waves.js';

export const W = 960;
export const H = 540;

export const ENEMY = {
  dart: { hp: 1, r: 11, score: 100 },
  weaver: { hp: 3, r: 12, score: 150 },
  gunner: { hp: 9, r: 15, score: 300 },
  carrier: { hp: 34, r: 27, score: 800 },
  mine: { hp: 3, r: 12, score: 200 },
  boss: { hp: 700, r: 48, score: 10000 },
};

const TAU = Math.PI * 2;

export class Game {
  constructor(input, sfx) {
    this.input = input;
    this.sfx = sfx;
    this.rng = Math.random;
    this.mode = 'title'; // title | play | over
    this.paused = false;
    this.time = 0;
    this.scroll = 0;
    this.hi = 0;
    try { this.hi = Number(localStorage.getItem('ashwing-hi') ?? 0) || 0; } catch { /* in-memory only */ }
    this.resetWorld();
  }

  reseed(seed) {
    let a = seed >>> 0;
    this.rng = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  resetWorld() {
    this.player = {
      x: 140, y: H / 2, alive: true, respawnT: 0, invulnT: 0,
      fireT: 0, missileT: 0, shield: false, thrust: 0,
    };
    this.weapon = 1;
    this.lives = 3;
    this.bombs = 2;
    this.score = 0;
    this.chain = 0;
    this.chainT = 0;
    this.wave = 0;
    this.loop = 1;
    this.enemies = [];
    this.pbullets = [];
    this.ebullets = [];
    this.parts = [];
    this.pickups = [];
    this.texts = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.flashT = 0;
    this.banner = null;
    this.boss = null;
    this.director = null;
    this.demoFire = false;
    this.overStats = null;
    this.victoryT = 0;
  }

  get mult() {
    return Math.min(8, 1 + Math.floor(this.chain / 6));
  }

  startRun() {
    this.resetWorld();
    this.mode = 'play';
    this.startWave(1);
    this.sfx.startMusic();
  }

  startWave(n) {
    this.wave = n;
    const script = WAVES[(n - 1) % WAVES.length];
    this.director = {
      t: 0,
      groups: script.map((g) => ({ ...g, spawned: 0, nextAt: g.at })),
      done: false,
    };
    if (n === WAVES.length) {
      this.showBanner('FINAL WAVE', 'the Dreadnought approaches');
      this.sfx.alarm();
    } else {
      this.showBanner(`WAVE ${n}`, n === 1 ? 'good hunting, pilot' : '');
    }
  }

  showBanner(text, sub = '', hold = 2.2) {
    this.banner = { text, sub, t: 0, hold };
  }

  // ------------------------------------------------------------- spawning

  spawnEnemy(kind, y, dx = 0, dy = 0) {
    const base = ENEMY[kind];
    const hpScale = 1 + (this.loop - 1) * 0.6;
    const e = {
      kind,
      x: W + 60 + dx,
      y: Math.min(H - 30, Math.max(30, y + dy)),
      hp: Math.round(base.hp * (kind === 'boss' ? hpScale : 1 + (this.loop - 1) * 0.35)),
      maxHp: 0,
      r: base.r,
      t: this.rng() * 10,
      seed: this.rng() * TAU,
      fireT: 1 + this.rng() * 1.5,
      spawnT: 2 + this.rng() * 2,
      hitT: 0,
      state: kind === 'boss' ? 'enter' : 'fly',
      attackT: 2.2,
      pattern: 0,
    };
    e.maxHp = e.hp;
    if (kind === 'boss') { e.x = W + 130; this.boss = e; }
    this.enemies.push(e);
    return e;
  }

  runDirector(dt) {
    const d = this.director;
    if (!d || d.done) return;
    d.t += dt;
    let allSpawned = true;
    for (const g of d.groups) {
      if (g.spawned >= g.n) continue;
      allSpawned = false;
      if (d.t >= g.nextAt) {
        const off = formation(g.pattern, g.spawned, g.n, g.y);
        this.spawnEnemy(g.kind, g.y + off.dy, off.dx, 0);
        g.spawned++;
        g.nextAt = d.t + g.gap;
      }
    }
    if (allSpawned && this.enemies.length === 0) {
      d.done = true;
      if (this.wave >= WAVES.length) {
        // Boss down and the sky is clear: the run is won; loop harder.
        this.loop++;
        this.showBanner('SECTOR CLEAR', `loop ${this.loop} — they come back angrier`);
        this.victoryT = 2.6;
        this.director = null;
      } else {
        this.startWave(this.wave + 1);
      }
    }
  }

  // ------------------------------------------------------------- combat

  fireWeapons(dt) {
    const p = this.player;
    p.fireT -= dt;
    p.missileT -= dt;
    const wantFire = this.input.down('KeyZ', 'Space') || this.input.mouse.down || this.input.touch !== null || this.demoFire;
    if (!wantFire || p.fireT > 0) return;
    p.fireT = Math.max(p.fireT + 0.15, 0.001);
    const lv = this.weapon;
    const shot = (dy, angle) => this.pbullets.push({
      x: p.x + 22, y: p.y + dy, vx: Math.cos(angle) * 660, vy: Math.sin(angle) * 660,
      r: 4, dmg: 1, missile: false, t: 0,
    });
    if (lv === 1) shot(0, 0);
    if (lv === 2) { shot(-6, 0); shot(6, 0); }
    if (lv === 3) { shot(-6, 0); shot(6, 0); shot(0, -0.16); shot(0, 0.16); }
    if (lv >= 4) { shot(-7, 0); shot(0, 0); shot(7, 0); shot(-4, -0.16); shot(4, 0.16); }
    this.sfx.shoot();
    if (lv >= 4 && p.missileT <= 0) {
      p.missileT = 0.55;
      for (const side of [-1, 1]) {
        this.pbullets.push({
          x: p.x + 8, y: p.y + side * 12, vx: 300, vy: side * 60,
          r: 5, dmg: 3, missile: true, t: 0,
        });
      }
      this.sfx.missile();
    }
  }

  useBomb() {
    if (this.bombs <= 0 || !this.player.alive) return;
    this.bombs--;
    this.flashT = 0.35;
    this.addShake(0.5, 14);
    this.ebullets.length = 0;
    for (const e of [...this.enemies]) {
      this.damageEnemy(e, e.kind === 'boss' ? 60 : 25, true);
    }
    this.burst(this.player.x + 60, this.player.y, 26, '#ffd27a', 320, 0.7);
    this.sfx.bomb();
  }

  damageEnemy(e, dmg, silent = false) {
    e.hp -= dmg;
    e.hitT = 0.05;
    if (!silent) this.sfx.enemyHit();
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    const idx = this.enemies.indexOf(e);
    if (idx === -1) return;
    this.enemies.splice(idx, 1);
    const base = ENEMY[e.kind];
    this.chain++;
    this.chainT = 2.5;
    const gained = base.score * this.mult;
    this.score += gained;
    this.addText(e.x, e.y - 14, `+${gained}`, e.kind === 'boss' ? '#ffd27a' : '#9fd8ff', e.kind === 'boss' ? 22 : 13);
    const colors = { dart: '#ff7a6b', weaver: '#c792ff', gunner: '#ffb35c', carrier: '#ff8f7a', mine: '#ffe066', boss: '#ffd27a' };
    this.burst(e.x, e.y, e.kind === 'boss' ? 90 : e.kind === 'carrier' ? 42 : 16, colors[e.kind], e.kind === 'boss' ? 460 : 300, e.kind === 'boss' ? 1.2 : 0.6);
    this.addShake(e.kind === 'boss' ? 0.7 : 0.18, e.kind === 'boss' ? 16 : 5);
    this.sfx.boom(e.kind === 'boss' ? 2 : e.kind === 'carrier' ? 1.4 : 0.8);
    if (e.kind === 'mine') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 4, t: 0 });
      }
    }
    if (e.kind === 'boss') {
      this.boss = null;
      this.dropPickup(e.x - 40, e.y - 30, 'P');
      this.dropPickup(e.x - 40, e.y + 30, 'B');
      this.dropPickup(e.x - 90, e.y, 'star');
    } else if (e.kind === 'carrier') {
      const table = ['P', 'P', 'B', 'S'];
      this.dropPickup(e.x, e.y, table[Math.floor(this.rng() * table.length)]);
    } else if (this.rng() < 0.07) {
      this.dropPickup(e.x, e.y, this.rng() < 0.6 ? 'P' : this.rng() < 0.5 ? 'B' : 'S');
    }
  }

  dropPickup(x, y, kind) {
    this.pickups.push({ x, y, kind, t: this.rng() * TAU, vx: -46 });
  }

  applyPickup(kind) {
    if (kind === 'P') {
      if (this.weapon < 5) { this.weapon++; this.addText(this.player.x, this.player.y - 30, 'GUN UP', '#ffd27a', 16); }
      else { this.score += 1000; this.addText(this.player.x, this.player.y - 30, '+1000', '#ffd27a', 14); }
      this.sfx.powerup();
    } else if (kind === 'B') {
      this.bombs = Math.min(5, this.bombs + 1);
      this.addText(this.player.x, this.player.y - 30, '+BOMB', '#ff9d7a', 15);
      this.sfx.pickup();
    } else if (kind === 'S') {
      this.player.shield = true;
      this.addText(this.player.x, this.player.y - 30, 'SHIELD', '#7ac2ff', 15);
      this.sfx.pickup();
    } else if (kind === 'star') {
      this.lives = Math.min(6, this.lives + 1);
      this.addText(this.player.x, this.player.y - 30, '1UP', '#ffe066', 18);
      this.sfx.powerup();
    }
  }

  hurtPlayer() {
    const p = this.player;
    if (!p.alive || p.invulnT > 0) return;
    if (p.shield) {
      p.shield = false;
      p.invulnT = 1.2;
      this.sfx.shieldPop();
      this.burst(p.x, p.y, 14, '#7ac2ff', 220, 0.4);
      return;
    }
    p.alive = false;
    p.respawnT = 1.4;
    this.lives--;
    this.chain = 0;
    this.weapon = Math.max(1, this.weapon - 2);
    this.burst(p.x, p.y, 46, '#8fd8ff', 380, 0.9);
    this.addShake(0.6, 13);
    this.sfx.playerDown();
    if (this.lives < 0) {
      this.mode = 'over';
      this.overStats = { score: this.score, wave: this.wave, loop: this.loop };
      if (this.score > this.hi) {
        this.hi = this.score;
        try { localStorage.setItem('ashwing-hi', String(this.hi)); } catch { /* ignore */ }
      }
      this.sfx.stopMusic();
    }
  }

  // ------------------------------------------------------------- fx

  burst(x, y, n, color, speed, life) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 420) break;
      const a = this.rng() * TAU;
      const v = (0.25 + this.rng() * 0.75) * speed;
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: life * (0.5 + this.rng() * 0.8), maxLife: life,
        size: 1.5 + this.rng() * 2.8, color,
      });
    }
  }

  addText(x, y, str, color, size) {
    this.texts.push({ x, y, str, color, size, life: 0.9 });
  }

  addShake(t, mag) {
    this.shakeT = Math.max(this.shakeT, t);
    this.shakeMag = mag;
  }

  // ------------------------------------------------------------- step

  step(dt) {
    this.time += dt;
    this.scroll += dt * 42;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.hold) this.banner = null;
    }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    this.updateFx(dt);

    if (this.mode === 'title') {
      this.updateAmbient(dt);
      if (this.input.confirmPressed()) { this.sfx.unlock(); this.startRun(); }
      this.input.endStep();
      return;
    }
    if (this.mode === 'over') {
      if (this.input.confirmPressed()) { this.sfx.unlock(); this.startRun(); }
      this.input.endStep();
      return;
    }
    if (this.input.pressed('Escape', 'KeyP')) this.paused = !this.paused;
    if (this.input.pressed('KeyM')) this.sfx.toggleMute();
    if (this.paused) { this.input.endStep(); return; }

    if (this.victoryT > 0) {
      this.victoryT -= dt;
      if (this.victoryT <= 0) this.startWave(1);
    } else {
      this.runDirector(dt);
    }
    this.updatePlayer(dt);
    this.fireWeapons(dt);
    if (this.input.pressed('KeyX') || this.input.pressed('MouseRight')) this.useBomb();
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.collide();
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0) this.chain = 0; }
    this.input.endStep();
  }

  /** Title-screen traffic: a few hostiles drift past, nobody shoots. */
  updateAmbient(dt) {
    if (this.rng() < dt * 0.7 && this.enemies.length < 5) {
      this.spawnEnemy(this.rng() < 0.6 ? 'dart' : 'weaver', 60 + this.rng() * (H - 120));
    }
    for (const e of [...this.enemies]) this.moveEnemy(e, dt, true);
  }

  updatePlayer(dt) {
    const p = this.player;
    if (!p.alive) {
      p.respawnT -= dt;
      if (p.respawnT <= 0 && this.mode === 'play') {
        p.alive = true;
        p.x = 130; p.y = H / 2;
        p.invulnT = 2.5;
      }
      return;
    }
    if (p.invulnT > 0) p.invulnT -= dt;
    const focus = this.input.down('ShiftLeft', 'ShiftRight');
    const speed = focus ? 138 : 268;
    let mx = 0, my = 0;
    if (this.input.down('ArrowLeft', 'KeyA')) mx -= 1;
    if (this.input.down('ArrowRight', 'KeyD')) mx += 1;
    if (this.input.down('ArrowUp', 'KeyW')) my -= 1;
    if (this.input.down('ArrowDown', 'KeyS')) my += 1;
    if (mx !== 0 && my !== 0) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    if (this.input.touch) {
      const dx = this.input.touch.x - p.x;
      const dy = this.input.touch.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) { mx = dx / d; my = dy / d; }
    }
    p.x = Math.min(W - 60, Math.max(24, p.x + mx * speed * dt));
    p.y = Math.min(H - 24, Math.max(24, p.y + my * speed * dt));
    p.thrust = Math.min(1, Math.max(-1, my));
    // Engine trail.
    if (this.parts.length < 420 && this.rng() < 0.75) {
      this.parts.push({
        x: p.x - 20, y: p.y + (this.rng() - 0.5) * 5,
        vx: -190 - this.rng() * 60, vy: (this.rng() - 0.5) * 24,
        life: 0.32, maxLife: 0.32, size: 1.6 + this.rng() * 1.6,
        color: this.rng() < 0.5 ? '#6bd8ff' : '#ffb35c',
      });
    }
  }

  moveEnemy(e, dt, ambient = false) {
    e.t += dt;
    const sp = 1 + (this.loop - 1) * 0.12;
    switch (e.kind) {
      case 'dart':
        e.x -= 238 * sp * dt;
        break;
      case 'weaver':
        e.x -= 148 * sp * dt;
        e.y += Math.sin(e.t * 3.4 + e.seed) * 118 * dt;
        break;
      case 'gunner':
        if (e.x > W - 190) e.x -= 96 * sp * dt;
        else e.y += Math.sin(e.t * 0.9 + e.seed) * 26 * dt;
        break;
      case 'carrier':
        if (e.x > W - 240) e.x -= 62 * sp * dt;
        e.y += Math.sin(e.t * 0.6 + e.seed) * 16 * dt;
        break;
      case 'mine':
        e.x -= 42 * sp * dt;
        e.y += Math.sin(e.t * 1.3 + e.seed) * 20 * dt;
        break;
      case 'boss':
        if (e.state === 'enter') {
          e.x -= 74 * dt;
          if (e.x <= W - 170) e.state = 'fight';
        } else {
          e.y = H / 2 + Math.sin(e.t * 0.55) * 118;
          e.x = W - 170 + Math.sin(e.t * 0.23) * 26;
        }
        break;
    }
    if (!ambient && e.x < -70) {
      this.enemies.splice(this.enemies.indexOf(e), 1);
      if (e.kind === 'boss') this.boss = null;
    }
  }

  updateEnemies(dt) {
    for (const e of [...this.enemies]) {
      this.moveEnemy(e, dt);
      if (e.hitT > 0) e.hitT -= dt;
      if (e.kind === 'gunner' && e.x < W - 120 && this.player.alive) {
        e.fireT -= dt;
        if (e.fireT <= 0) {
          e.fireT = 1.7 + this.rng() * 0.7;
          this.aimedShot(e, 205);
        }
      }
      if (e.kind === 'carrier') {
        e.spawnT -= dt;
        if (e.spawnT <= 0 && this.enemies.length < 14) {
          e.spawnT = 2.6;
          this.spawnEnemy('dart', e.y - 18, -40, 0);
        }
      }
      if (e.kind === 'boss' && e.state === 'fight') this.updateBoss(e, dt);
    }
  }

  aimedShot(e, speed) {
    const p = this.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    this.ebullets.push({ x: e.x - 10, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 4, t: 0 });
    this.sfx.tone(300, 140, 0.1, 'sawtooth', 0.05);
  }

  updateBoss(e, dt) {
    e.attackT -= dt;
    const phase = e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3;
    if (e.attackT > 0) return;
    const p = this.player;
    if (e.pattern % 3 === 0) {
      // Fan of five toward the player's half.
      const base = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = -2; i <= 2; i++) {
        const a = base + i * 0.17;
        this.ebullets.push({ x: e.x - 40, y: e.y, vx: Math.cos(a) * 235, vy: Math.sin(a) * 235, r: 4, t: 0 });
      }
      e.attackT = phase === 1 ? 1.5 : 1.15;
    } else if (e.pattern % 3 === 1) {
      for (let i = 0; i < 3; i++) this.aimedShot(e, 265);
      e.attackT = phase === 3 ? 1.3 : 1.7;
    } else {
      // Radial ring; denser and faster in the last phase.
      const n = phase === 3 ? 20 : 14;
      const off = this.rng() * TAU;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        this.ebullets.push({ x: e.x - 20, y: e.y, vx: Math.cos(a) * 148, vy: Math.sin(a) * 148, r: 4, t: 0 });
      }
      e.attackT = phase === 3 ? 1.9 : 2.4;
    }
    if (phase >= 2 && e.pattern % 4 === 3 && this.enemies.length < 10) {
      this.spawnEnemy('weaver', e.y - 90, -120, 0);
      this.spawnEnemy('weaver', e.y + 90, -120, 0);
    }
    e.pattern++;
    this.sfx.tone(180, 90, 0.14, 'sawtooth', 0.07);
  }

  updateBullets(dt) {
    for (const b of this.pbullets) {
      b.t += dt;
      if (b.missile) {
        // Missiles pick the nearest enemy ahead and lean toward it.
        let best = null, bestD = 1e9;
        for (const e of this.enemies) {
          const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
          if (d < bestD) { bestD = d; best = e; }
        }
        if (best) {
          const want = Math.atan2(best.y - b.y, best.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const turn = Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
          const sp = Math.min(560, Math.hypot(b.vx, b.vy) + 620 * dt);
          const na = cur + turn;
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
        if (this.parts.length < 420) {
          this.parts.push({ x: b.x - 6, y: b.y, vx: -60, vy: 0, life: 0.22, maxLife: 0.22, size: 1.5, color: '#ffd27a' });
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.pbullets = this.pbullets.filter((b) => b.x < W + 30 && b.x > -30 && b.y > -30 && b.y < H + 30);
    for (const b of this.ebullets) {
      b.t += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    this.ebullets = this.ebullets.filter((b) => b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const k of [...this.pickups]) {
      k.t += dt;
      k.x += k.vx * dt;
      const dx = p.x - k.x, dy = p.y - k.y;
      const d = Math.hypot(dx, dy);
      if (p.alive && d < 84) { k.x += (dx / d) * 260 * dt; k.y += (dy / d) * 260 * dt; }
      if (p.alive && d < 26) {
        this.applyPickup(k.kind);
        this.pickups.splice(this.pickups.indexOf(k), 1);
      } else if (k.x < -30) {
        this.pickups.splice(this.pickups.indexOf(k), 1);
      }
    }
  }

  updateFx(dt) {
    for (const pt of this.parts) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 1.6 * dt;
      pt.vy *= 1 - 1.6 * dt;
    }
    this.parts = this.parts.filter((pt) => pt.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  collide() {
    const p = this.player;
    // Player bullets vs enemies.
    for (const b of [...this.pbullets]) {
      for (const e of this.enemies) {
        const rr = e.r + b.r - 2;
        if (Math.abs(e.x - b.x) < rr && Math.abs(e.y - b.y) < rr &&
            (e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          this.pbullets.splice(this.pbullets.indexOf(b), 1);
          this.damageEnemy(e, b.dmg);
          break;
        }
      }
    }
    if (!p.alive || p.invulnT > 0) return;
    // Enemy bullets vs player (tight core hitbox: the genre's fairness).
    for (const b of [...this.ebullets]) {
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + 5) ** 2) {
        this.ebullets.splice(this.ebullets.indexOf(b), 1);
        this.hurtPlayer();
        return;
      }
    }
    // Bodies vs player.
    for (const e of this.enemies) {
      const rr = e.r - 3 + 8;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) {
        this.damageEnemy(e, 10);
        this.hurtPlayer();
        return;
      }
    }
  }

  // ------------------------------------------------------------- poses

  /** Deterministic scenes for the screenshots (also handy for testing). */
  pose(name, seed = 1) {
    this.reseed(seed);
    this.resetWorld();
    if (name === 'menu') {
      this.mode = 'title';
      this.scroll = 1500;
      const kinds = ['dart', 'weaver', 'dart', 'weaver'];
      kinds.forEach((k, i) => {
        const e = this.spawnEnemy(k, 110 + i * 100);
        e.x = 380 + i * 150;
      });
      return;
    }
    this.mode = 'play';
    this.player.invulnT = 9999;
    this.demoFire = true;
    if (name === 'action') {
      this.scroll = 2600;
      this.wave = 3;
      this.weapon = 4;
      this.score = 12450;
      this.chain = 14;
      this.player.x = 215; this.player.y = 316;
      const spots = [
        ['gunner', 690, 168], ['weaver', 560, 110], ['weaver', 640, 420],
        ['dart', 760, 250], ['dart', 820, 292], ['carrier', 855, 380],
        ['mine', 470, 250], ['dart', 880, 130],
      ];
      for (const [kind, x, y] of spots) {
        const e = this.spawnEnemy(kind, y);
        e.x = x;
      }
      for (let i = 0; i < 7; i++) {
        this.pbullets.push({ x: 260 + i * 46, y: 310 + (i % 3 - 1) * 7, vx: 660, vy: 0, r: 4, dmg: 1, missile: false, t: 0 });
      }
      this.ebullets.push({ x: 620, y: 190, vx: -205, vy: 40, r: 4, t: 0 });
      this.ebullets.push({ x: 590, y: 215, vx: -205, vy: 22, r: 4, t: 0 });
      this.dropPickup(430, 180, 'P');
      this.burst(700, 330, 18, '#ff7a6b', 260, 0.7);
      this.showBanner('', '');
      this.banner = null;
    } else if (name === 'boss') {
      this.scroll = 3200;
      this.wave = 8;
      this.weapon = 5;
      this.score = 48900;
      this.lives = 2;
      this.bombs = 2;
      this.chain = 9;
      this.player.x = 205; this.player.y = 392;
      const boss = this.spawnEnemy('boss', H / 2);
      boss.state = 'fight';
      boss.x = W - 170;
      boss.hp = Math.round(boss.maxHp * 0.62);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + 0.4;
        this.ebullets.push({ x: boss.x - 20 + Math.cos(a) * 120, y: boss.y + Math.sin(a) * 120, vx: Math.cos(a) * 148, vy: Math.sin(a) * 148, r: 4, t: 0 });
      }
      for (let i = 0; i < 5; i++) {
        this.pbullets.push({ x: 250 + i * 52, y: 386 + (i % 3 - 1) * 6, vx: 660, vy: 0, r: 4, dmg: 1, missile: false, t: 0 });
      }
      this.burst(boss.x - 60, boss.y - 30, 16, '#ffd27a', 240, 0.6);
      this.banner = null;
    } else if (name === 'over') {
      this.demoFire = false;
      this.player.alive = false;
      this.scroll = 900;
      this.mode = 'over';
      this.score = 52340;
      this.overStats = { score: 52340, wave: 8, loop: 1 };
      if (this.hi < 52340) this.hi = 52340;
    }
  }
}
