# ASHWING

**One fighter. Eight waves. No reinforcements.**

Ashwing is a side-scrolling shoot-'em-up for the desktop browser, written
in vanilla JavaScript on a 2D canvas — no engine, no build step, no
network. You are the last interceptor over a drowned sector: survive
seven scripted waves of darts, weavers, gunners, minefields and carriers,
then bring down the Dreadnought — and if you do, it loops, angrier.

## Play it

```
node serve.ts          # then open http://localhost:8080
```

or open `game/index.html` through any static server. Everything runs
offline from the files in `game/`.

| Input | Action |
|---|---|
| WASD / arrow keys | fly |
| Shift | focus — creep for precision dodging |
| Z / Space / hold mouse | fire |
| X / right-click | bomb (clears bullets, heavy damage) |
| Esc / P | pause |
| M | mute |
| touch drag | fly (fire is automatic while touching) |

## How it plays

- **Chain multiplier.** Kills within 2.5 s of each other build a chain;
  every six chain steps raise the score multiplier, up to ×8. Getting
  hit resets it.
- **Five gun levels.** P drops raise the gun from a single bolt to a
  five-way spread with homing missiles. Death costs two levels.
- **Drops with a magnet.** Carriers always drop; other kills sometimes
  do. P = gun up, B = bomb, S = a shield that eats one hit, ★ = 1UP.
- **A small, honest hitbox.** Only the glowing core of your ship can be
  hit — the genre's fairness rule — so the bullet patterns can be dense.
- **The Dreadnought.** Wave 8's boss cycles fan spreads, aimed bursts
  and radial rings across three phases, and calls in weaver escorts.
  Beating it clears the sector and starts a harder loop.
- **Sound, synthesised.** Every effect and the bass-and-arp music loop
  are generated in WebAudio at runtime; there are no audio files.

## Layout

- `main.ts` — the handoff program: copies `game/` and `screenshots/`
  to the output directory and writes `dossier.json` (the make.fun
  best-game-01 entry program).
- `serve.ts` — a tiny static server for playing locally.
- `game/index.html` — the page; `game/src/` holds the game:
  `main.js` (fixed-step loop, screenshot poses), `game.js` (the whole
  simulation: player, weapons, enemies, boss, director, collisions),
  `waves.js` (the eight wave scripts), `render.js` (all drawing —
  vector ships, pre-rendered nebula and planet, HUD and screens),
  `input.js` (keyboard, mouse, touch), `audio.js` (WebAudio SFX + music).
- `screenshots/` — the four entry screenshots, taken from the game's
  own `?shot=menu|action|boss|over` poses in a headless browser.
- `vendor/makefun-game.ts` — the make.fun dossier library, vendored.

## License

MIT — see `LICENSE`.
