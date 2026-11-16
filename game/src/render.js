// Ashwing's renderer: everything is drawn with canvas paths — no image
// assets. The background is a pre-rendered nebula plate plus a ringed
// planet and three star layers scrolling at different rates; ships are
// small vector silhouettes with a hit-flash; the HUD is tabular text.

import { W, H } from './game.js';

const FONT = '"Segoe UI", system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export class Renderer {
  constructor() {
    this.nebula = this.makeNebula();
    this.planet = this.makePlanet();
    this.vignette = this.makeVignette();
    this.layers = [0.12, 0.3, 0.62].map((f, li) => ({
      f,
      stars: Array.from({ length: 64 }, (_, i) => ({
        x: ((i * 197 + li * 331) % 977),
        y: ((i * 149 + li * 97) % 541),
        r: li === 2 ? 1.7 : li === 1 ? 1.2 : 0.8,
        tw: (i % 7) * 0.9,
      })),
    }));
  }

  makeNebula() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const blobs = [
      [210, 120, 300, 'rgba(64, 44, 140, 0.50)'],
      [760, 90, 260, 'rgba(20, 90, 140, 0.42)'],
      [520, 430, 330, 'rgba(120, 40, 90, 0.34)'],
      [880, 430, 220, 'rgba(16, 110, 110, 0.30)'],
      [90, 430, 200, 'rgba(30, 60, 150, 0.36)'],
    ];
    for (const [bx, by, br, col] of blobs) {
      const g = x.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    return c;
  }

  makePlanet() {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 300;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(118, 108, 20, 150, 150, 108);
    g.addColorStop(0, '#7fa8d8');
    g.addColorStop(0.55, '#3d6396');
    g.addColorStop(1, '#16283f');
    x.fillStyle = g;
    x.beginPath(); x.arc(150, 150, 104, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 0.25;
    x.fillStyle = '#dceeff';
    for (const [bx, by, br] of [[110, 120, 26], [180, 170, 34], [140, 200, 18], [196, 116, 14]]) {
      x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(190, 215, 255, 0.5)';
    x.lineWidth = 7;
    x.beginPath();
    x.ellipse(150, 158, 142, 34, -0.32, 0, Math.PI * 2);
    x.stroke();
    return c;
  }

  makeVignette() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(2,3,8,0.55)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    return c;
  }

  draw(ctx, g, sfx) {
    ctx.save();
    if (g.shakeT > 0) {
      const m = g.shakeMag * (g.shakeT / 0.5);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    this.drawBackground(ctx, g);
    for (const k of g.pickups) this.drawPickup(ctx, g, k);
    for (const e of g.enemies) this.drawEnemy(ctx, g, e);
    if (g.mode !== 'title') this.drawPlayer(ctx, g);
    this.drawBullets(ctx, g);
    this.drawParticles(ctx, g);
    this.drawTexts(ctx, g);
    ctx.restore();

    ctx.drawImage(this.vignette, 0, 0);
    if (g.flashT > 0) {
      ctx.fillStyle = `rgba(255, 240, 200, ${Math.min(0.55, g.flashT * 1.4)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (g.mode === 'play') this.drawHud(ctx, g, sfx);
    if (g.banner && g.mode === 'play') this.drawBanner(ctx, g);
    if (g.mode === 'title') this.drawTitle(ctx, g);
    if (g.mode === 'over') this.drawOver(ctx, g);
    if (g.paused && g.mode === 'play') {
      ctx.fillStyle = 'rgba(3, 5, 12, 0.62)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8eef7';
      ctx.font = `600 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2);
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = '#93a5c0';
      ctx.fillText('Esc or P to resume', W / 2, H / 2 + 30);
    }
  }

  drawBackground(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#070b1c');
    grad.addColorStop(0.55, '#05070f');
    grad.addColorStop(1, '#0a0716');
    ctx.fillStyle = grad;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    const nx = -((g.scroll * 0.05) % W);
    ctx.drawImage(this.nebula, nx, 0);
    ctx.drawImage(this.nebula, nx + W, 0);
    const px = 900 - ((g.scroll * 0.08) % 1200);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(this.planet, px, 40, 230, 230);
    ctx.globalAlpha = 1;
    for (const layer of this.layers) {
      ctx.fillStyle = '#cfe2ff';
      for (const s of layer.stars) {
        const x = ((s.x - g.scroll * layer.f) % W + W) % W;
        const tw = 0.55 + 0.45 * Math.sin(g.time * 1.7 + s.tw);
        ctx.globalAlpha = tw * (layer.f + 0.35);
        ctx.fillRect(x, s.y, s.r, s.r);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- ships

  shipPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(2, -6);
    ctx.lineTo(-12, -15);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-8, 4);
    ctx.lineTo(-12, 15);
    ctx.lineTo(2, 6);
    ctx.closePath();
  }

  drawPlayer(ctx, g) {
    const p = g.player;
    if (!p.alive) return;
    if (p.invulnT > 0 && p.invulnT < 3 && Math.floor(g.time * 14) % 2 === 0 && !p.shield) return; // blink (short respawn grace only)
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.thrust * 0.16);
    // Engine flame.
    const fl = 12 + Math.sin(g.time * 42) * 4 + (p.thrust !== 0 ? 2 : 0);
    ctx.fillStyle = 'rgba(255, 160, 60, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-15, -3.4); ctx.lineTo(-15 - fl, 0); ctx.lineTo(-15, 3.4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(140, 220, 255, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-15, -1.8); ctx.lineTo(-15 - fl * 0.55, 0); ctx.lineTo(-15, 1.8);
    ctx.closePath(); ctx.fill();
    // Hull.
    this.shipPath(ctx);
    ctx.fillStyle = '#dfe9ff';
    ctx.fill();
    ctx.strokeStyle = '#5f7fb8';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#22355c';
    ctx.beginPath();
    ctx.moveTo(2, -6); ctx.lineTo(-12, -15); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 6); ctx.lineTo(-12, 15); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#54c8ff';
    ctx.beginPath();
    ctx.ellipse(8, 0, 6.5, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.shield) {
      ctx.strokeStyle = `rgba(122, 194, 255, ${0.55 + 0.3 * Math.sin(g.time * 6)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 27, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The core: the only part that can be hit.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  enemyPath(ctx, kind) {
    ctx.beginPath();
    switch (kind) {
      case 'dart':
        ctx.moveTo(-15, 0); ctx.lineTo(6, -8); ctx.lineTo(12, -3); ctx.lineTo(12, 3); ctx.lineTo(6, 8);
        break;
      case 'weaver':
        ctx.moveTo(-17, 0); ctx.lineTo(0, -5); ctx.lineTo(14, -13); ctx.lineTo(10, 0); ctx.lineTo(14, 13); ctx.lineTo(0, 5);
        break;
      case 'gunner':
        rr(ctx, -15, -11, 30, 22, 5);
        break;
      case 'carrier':
        ctx.moveTo(-30, -8); ctx.lineTo(16, -16); ctx.lineTo(30, -6); ctx.lineTo(30, 6); ctx.lineTo(16, 16); ctx.lineTo(-30, 8); ctx.lineTo(-22, 0);
        break;
      case 'mine':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r1 = 13, r0 = 8;
          ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
          const a2 = a + Math.PI / 8;
          ctx.lineTo(Math.cos(a2) * r0, Math.sin(a2) * r0);
        }
        break;
      case 'boss':
        ctx.moveTo(-52, -14); ctx.lineTo(-20, -34); ctx.lineTo(30, -30); ctx.lineTo(52, -10);
        ctx.lineTo(52, 10); ctx.lineTo(30, 30); ctx.lineTo(-20, 34); ctx.lineTo(-52, 14); ctx.lineTo(-38, 0);
        break;
    }
    ctx.closePath();
  }

  drawEnemy(ctx, g, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const colors = {
      dart: '#e5484d', weaver: '#9a6bff', gunner: '#e07f2e',
      carrier: '#b0563a', mine: '#5c6675', boss: '#7a4a56',
    };
    this.enemyPath(ctx, e.kind);
    ctx.fillStyle = colors[e.kind];
    ctx.fill();
    ctx.strokeStyle = 'rgba(10, 8, 16, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (e.kind === 'gunner') {
      ctx.fillStyle = '#ffd27a';
      ctx.fillRect(-24, -2.4, 12, 4.8);
      ctx.fillStyle = '#3a2413';
      ctx.beginPath(); ctx.arc(2, 0, 5.4, 0, Math.PI * 2); ctx.fill();
    }
    if (e.kind === 'carrier') {
      ctx.fillStyle = 'rgba(255, 210, 122, 0.9)';
      for (const dx of [-16, 2, 20]) { ctx.beginPath(); ctx.arc(dx, 0, 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = 'rgba(20, 10, 10, 0.5)';
      ctx.fillRect(-30, -3, 60, 6);
    }
    if (e.kind === 'mine') {
      ctx.fillStyle = Math.sin(g.time * 7 + e.seed) > 0 ? '#ff5252' : '#571d1d';
      ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, Math.PI * 2); ctx.fill();
    }
    if (e.kind === 'boss') {
      ctx.fillStyle = 'rgba(24, 14, 18, 0.45)';
      ctx.fillRect(-40, -26, 74, 9);
      ctx.fillRect(-40, 17, 74, 9);
      ctx.fillStyle = 'rgba(255, 190, 150, 0.20)';
      ctx.fillRect(-46, -4, 88, 8);
      ctx.fillStyle = '#2c1c22';
      for (const [cx, cy] of [[-18, -16], [8, 0], [-18, 16]]) {
        ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255, ${120 + Math.floor(100 * Math.sin(g.time * 5))}, 60, 0.95)`;
        ctx.beginPath(); ctx.arc(cx, cy, 4.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2c1c22';
      }
      ctx.fillStyle = 'rgba(255, 210, 122, 0.85)';
      ctx.fillRect(-52, -2, 14, 4);
      ctx.fillRect(38, -2, 14, 4);
    }
    if (e.hitT > 0) {
      this.enemyPath(ctx, e.kind);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fill();
    }
    ctx.restore();
    if ((e.kind === 'carrier' || e.kind === 'gunner') && e.hp < e.maxHp) {
      const w = e.kind === 'carrier' ? 52 : 30;
      ctx.fillStyle = 'rgba(10, 12, 20, 0.7)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
      ctx.fillStyle = '#ff7a6b';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, (w * e.hp) / e.maxHp, 4);
    }
  }

  drawBullets(ctx, g) {
    for (const b of g.pbullets) {
      if (b.missile) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.moveTo(8, 0); ctx.lineTo(-6, -3.4); ctx.lineTo(-6, 3.4);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.strokeStyle = 'rgba(84, 200, 255, 0.35)';
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(b.x - 17, b.y); ctx.lineTo(b.x + 5, b.y); ctx.stroke();
        ctx.strokeStyle = '#bfefff';
        ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(b.x - 17, b.y); ctx.lineTo(b.x + 5, b.y); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x + 5, b.y, 2.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const b of g.ebullets) {
      ctx.fillStyle = 'rgba(255, 82, 160, 0.28)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff52a0';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawPickup(ctx, g, k) {
    const bob = Math.sin(k.t * 4) * 3;
    const conf = {
      P: ['#ffd27a', 'P'], B: ['#ff9d7a', 'B'], S: ['#7ac2ff', 'S'], star: ['#ffe066', '★'],
    }[k.kind];
    ctx.save();
    ctx.translate(k.x, k.y + bob);
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(k.t * 5);
    ctx.fillStyle = conf[0];
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    rr(ctx, -12, -12, 24, 24, 6);
    ctx.fillStyle = '#101827';
    ctx.fill();
    ctx.strokeStyle = conf[0];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = conf[0];
    ctx.font = `700 ${k.kind === 'star' ? 15 : 14}px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(conf[1], 0, 1);
    ctx.restore();
  }

  drawParticles(ctx, g) {
    for (const pt of g.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx, g) {
    ctx.textAlign = 'center';
    for (const t of g.texts) {
      ctx.globalAlpha = Math.min(1, t.life / 0.5);
      ctx.font = `700 ${t.size}px ${MONO}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- screens

  drawHud(ctx, g, sfx) {
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = `600 12px ${MONO}`;
    ctx.fillStyle = '#93a5c0';
    ctx.fillText('SCORE', 18, 24);
    ctx.fillText('HI', 128, 24);
    ctx.font = `700 19px ${MONO}`;
    ctx.fillStyle = '#e8eef7';
    ctx.fillText(String(g.score).padStart(6, '0'), 18, 46);
    ctx.fillStyle = '#93a5c0';
    ctx.fillText(String(Math.max(g.hi, g.score)).padStart(6, '0'), 128, 46);

    ctx.textAlign = 'right';
    ctx.font = `600 12px ${MONO}`;
    ctx.fillStyle = '#93a5c0';
    ctx.fillText(`WAVE ${g.wave} · LOOP ${g.loop}`, W - 18, 24);
    if (g.chain > 1) {
      ctx.font = `700 19px ${MONO}`;
      ctx.fillStyle = g.mult >= 8 ? '#ffd27a' : '#9fd8ff';
      ctx.fillText(`×${g.mult} CHAIN ${g.chain}`, W - 18, 46);
      ctx.fillStyle = 'rgba(159, 216, 255, 0.5)';
      ctx.fillRect(W - 18 - 110 * (g.chainT / 2.5), 52, 110 * (g.chainT / 2.5), 3);
    }
    if (sfx.muted) {
      ctx.font = `600 11px ${MONO}`;
      ctx.fillStyle = '#5c6c88';
      ctx.fillText('MUTED (M)', W - 18, H - 14);
    }

    // Lives and bombs, bottom-left.
    for (let i = 0; i < Math.max(0, g.lives); i++) {
      ctx.save();
      ctx.translate(34 + i * 30, H - 22);
      ctx.scale(0.62, 0.62);
      this.shipPath(ctx);
      ctx.fillStyle = '#dfe9ff';
      ctx.fill();
      ctx.restore();
    }
    ctx.font = `600 13px ${MONO}`;
    ctx.fillStyle = '#ff9d7a';
    ctx.textAlign = 'left';
    ctx.fillText(`◎ BOMBS ${g.bombs}  (X)`, 34 + Math.max(0, g.lives) * 30 + 12, H - 17);

    // Weapon pips, bottom-right.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#93a5c0';
    ctx.font = `600 12px ${MONO}`;
    ctx.fillText(`GUN Lv${g.weapon}`, W - 18 - 5 * 16 - 8, H - 17);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < g.weapon ? '#ffd27a' : 'rgba(147, 165, 192, 0.3)';
      ctx.fillRect(W - 18 - (5 - i) * 16, H - 30, 11, 9);
    }

    // Boss bar.
    if (g.boss) {
      const w = 430;
      ctx.textAlign = 'center';
      ctx.font = `600 11px ${MONO}`;
      ctx.fillStyle = '#ff9d7a';
      ctx.fillText('DREADNOUGHT', W / 2, 66);
      ctx.fillStyle = 'rgba(10, 12, 20, 0.72)';
      rr(ctx, W / 2 - w / 2, 72, w, 9, 4);
      ctx.fill();
      ctx.fillStyle = '#e5484d';
      rr(ctx, W / 2 - w / 2, 72, (w * Math.max(0, g.boss.hp)) / g.boss.maxHp, 9, 4);
      ctx.fill();
    }
  }

  drawBanner(ctx, g) {
    const b = g.banner;
    const a = b.t < 0.3 ? b.t / 0.3 : b.t > b.hold - 0.4 ? Math.max(0, (b.hold - b.t) / 0.4) : 1;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = '#e8eef7';
    ctx.fillText(b.text, W / 2, 150);
    if (b.sub) {
      ctx.font = `15px ${FONT}`;
      ctx.fillStyle = '#9fd8ff';
      ctx.fillText(b.sub, W / 2, 178);
    }
    ctx.globalAlpha = 1;
  }

  drawTitle(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(4, 6, 15, 0.25)');
    grad.addColorStop(0.5, 'rgba(4, 6, 15, 0.55)');
    grad.addColorStop(1, 'rgba(4, 6, 15, 0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `800 92px ${FONT}`;
    ctx.fillStyle = 'rgba(84, 200, 255, 0.35)';
    ctx.fillText('ASHWING', W / 2 + 3, 183);
    const lg = ctx.createLinearGradient(0, 110, 0, 190);
    lg.addColorStop(0, '#ffffff');
    lg.addColorStop(0.6, '#bfe3ff');
    lg.addColorStop(1, '#5f9fdf');
    ctx.fillStyle = lg;
    ctx.fillText('ASHWING', W / 2, 180);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = '#ffb35c';
    ctx.fillText('o n e   f i g h t e r · e i g h t   w a v e s · n o   r e i n f o r c e m e n t s', W / 2, 216);

    ctx.font = `14.5px ${FONT}`;
    ctx.fillStyle = '#c7d3e8';
    const lines = [
      'Fly with WASD or the arrow keys — hold Shift to creep for precision',
      'Fire with Z, Space or the mouse · Bomb with X or right-click',
      'Chain kills to raise the multiplier · Grab P, B, S and ★ drops',
      'Survive seven waves, then bring down the Dreadnought',
    ];
    lines.forEach((s, i) => ctx.fillText(s, W / 2, 286 + i * 24));

    if (g.time % 1.25 < 0.95) {
      ctx.font = `700 19px ${FONT}`;
      ctx.fillStyle = '#ffd27a';
      ctx.fillText('PRESS ENTER OR CLICK TO LAUNCH', W / 2, 424);
    }
    ctx.font = `13px ${MONO}`;
    ctx.fillStyle = '#93a5c0';
    ctx.fillText(`HI-SCORE ${String(g.hi).padStart(6, '0')}   ·   M mutes   ·   Esc pauses`, W / 2, 492);
  }

  drawOver(ctx, g) {
    ctx.fillStyle = 'rgba(3, 5, 12, 0.66)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.font = `800 54px ${FONT}`;
    ctx.fillStyle = '#ff7a6b';
    ctx.fillText('GAME OVER', W / 2, 168);
    const s = g.overStats ?? { score: g.score, wave: g.wave, loop: g.loop };
    ctx.font = `700 30px ${MONO}`;
    ctx.fillStyle = '#e8eef7';
    ctx.fillText(String(s.score).padStart(6, '0'), W / 2, 226);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = '#93a5c0';
    ctx.fillText(`reached wave ${s.wave} · loop ${s.loop}`, W / 2, 256);
    if (s.score >= g.hi && s.score > 0) {
      ctx.font = `700 16px ${FONT}`;
      ctx.fillStyle = '#ffd27a';
      ctx.fillText('★ NEW HI-SCORE ★', W / 2, 288);
    }
    if (g.time % 1.25 < 0.95) {
      ctx.font = `600 16px ${FONT}`;
      ctx.fillStyle = '#c7d3e8';
      ctx.fillText('ENTER OR CLICK TO FLY AGAIN', W / 2, 348);
    }
  }
}
