// Ashwing's wave scripts. A wave is a list of spawn groups; the director
// starts a group `at` seconds into the wave and releases its members one
// every `gap` seconds. A wave ends when every group has spawned and the
// sky is clear — then the next wave's banner shows. Wave 8 is the boss.
//
// Kinds: dart (fast, fragile), weaver (sine path), gunner (stops and
// shoots), carrier (tough, spawns darts, always drops a pickup), mine
// (slow, bursts into bullets when destroyed). Patterns: line, vee,
// column, arc, pair, single, field.

export const WAVES = [
  // 1 — first contact: two dart lines and a gentle vee.
  [
    { at: 0.5, kind: 'dart', pattern: 'line', n: 5, gap: 0.45, y: 200 },
    { at: 4.0, kind: 'dart', pattern: 'line', n: 5, gap: 0.45, y: 340 },
    { at: 7.5, kind: 'dart', pattern: 'vee', n: 7, gap: 0.3, y: 270 },
  ],
  // 2 — weavers join, darts cross from both lanes.
  [
    { at: 0.5, kind: 'weaver', pattern: 'line', n: 4, gap: 0.8, y: 160 },
    { at: 4.5, kind: 'dart', pattern: 'column', n: 6, gap: 0.35, y: 120 },
    { at: 7.0, kind: 'weaver', pattern: 'line', n: 4, gap: 0.8, y: 380 },
    { at: 10.5, kind: 'dart', pattern: 'vee', n: 9, gap: 0.26, y: 270 },
  ],
  // 3 — first gunner, first carrier (a guaranteed power-up).
  [
    { at: 0.5, kind: 'dart', pattern: 'line', n: 6, gap: 0.4, y: 270 },
    { at: 3.5, kind: 'gunner', pattern: 'single', n: 1, gap: 0, y: 180 },
    { at: 6.0, kind: 'weaver', pattern: 'arc', n: 6, gap: 0.5, y: 270 },
    { at: 9.5, kind: 'carrier', pattern: 'single', n: 1, gap: 0, y: 270 },
    { at: 13.0, kind: 'dart', pattern: 'column', n: 8, gap: 0.3, y: 420 },
  ],
  // 4 — mines seed the field while weavers press.
  [
    { at: 0.5, kind: 'mine', pattern: 'field', n: 5, gap: 0.7, y: 270 },
    { at: 3.0, kind: 'weaver', pattern: 'line', n: 5, gap: 0.7, y: 140 },
    { at: 6.5, kind: 'gunner', pattern: 'pair', n: 2, gap: 1.2, y: 200 },
    { at: 9.0, kind: 'dart', pattern: 'vee', n: 9, gap: 0.24, y: 300 },
    { at: 12.0, kind: 'mine', pattern: 'field', n: 5, gap: 0.7, y: 200 },
  ],
  // 5 — the pincer: streams from top and bottom, carrier in the middle.
  [
    { at: 0.5, kind: 'dart', pattern: 'column', n: 8, gap: 0.32, y: 90 },
    { at: 0.5, kind: 'dart', pattern: 'column', n: 8, gap: 0.32, y: 450 },
    { at: 5.0, kind: 'gunner', pattern: 'single', n: 1, gap: 0, y: 270 },
    { at: 7.5, kind: 'carrier', pattern: 'single', n: 1, gap: 0, y: 270 },
    { at: 11.0, kind: 'weaver', pattern: 'arc', n: 8, gap: 0.42, y: 270 },
  ],
  // 6 — gunner line behind a mine screen.
  [
    { at: 0.5, kind: 'mine', pattern: 'field', n: 7, gap: 0.55, y: 270 },
    { at: 3.5, kind: 'gunner', pattern: 'pair', n: 2, gap: 1.4, y: 150 },
    { at: 5.5, kind: 'gunner', pattern: 'pair', n: 2, gap: 1.4, y: 390 },
    { at: 9.0, kind: 'dart', pattern: 'line', n: 10, gap: 0.3, y: 270 },
    { at: 12.0, kind: 'weaver', pattern: 'line', n: 6, gap: 0.6, y: 200 },
  ],
  // 7 — everything at once, then the second carrier.
  [
    { at: 0.5, kind: 'weaver', pattern: 'arc', n: 8, gap: 0.4, y: 180 },
    { at: 3.0, kind: 'dart', pattern: 'vee', n: 11, gap: 0.22, y: 270 },
    { at: 6.0, kind: 'gunner', pattern: 'pair', n: 2, gap: 1.2, y: 270 },
    { at: 8.5, kind: 'mine', pattern: 'field', n: 6, gap: 0.6, y: 300 },
    { at: 11.0, kind: 'carrier', pattern: 'single', n: 1, gap: 0, y: 270 },
    { at: 14.0, kind: 'dart', pattern: 'column', n: 10, gap: 0.26, y: 140 },
  ],
  // 8 — the Dreadnought, with a light escort trickle while it lives.
  [
    { at: 1.0, kind: 'boss', pattern: 'single', n: 1, gap: 0, y: 270 },
    { at: 14.0, kind: 'dart', pattern: 'line', n: 4, gap: 0.4, y: 120 },
    { at: 26.0, kind: 'weaver', pattern: 'line', n: 3, gap: 0.7, y: 420 },
    { at: 38.0, kind: 'dart', pattern: 'line', n: 4, gap: 0.4, y: 420 },
  ],
];

/** Formation offsets for a pattern: member i's spawn position and drift. */
export function formation(pattern, i, n, y) {
  switch (pattern) {
    case 'vee': {
      const mid = (n - 1) / 2;
      return { dx: Math.abs(i - mid) * 34, dy: (i - mid) * 30 };
    }
    case 'column':
      return { dx: 0, dy: (i - (n - 1) / 2) * 4 };
    case 'arc': {
      const a = (i / Math.max(1, n - 1)) * Math.PI;
      return { dx: Math.sin(a) * 40, dy: -Math.cos(a) * 90 };
    }
    case 'field':
      return { dx: (i % 3) * 70, dy: ((i * 137) % 260) - 130 };
    case 'pair':
      return { dx: 0, dy: i === 0 ? -70 : 70 };
    default: // line, single
      return { dx: 0, dy: 0 };
  }
}
