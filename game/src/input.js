// Keyboard and mouse input for Ashwing.
//
// The game reads held state every step (keys.has), one-shot presses via
// pressed() (true once, on the step after the key went down), and the
// mouse position in canvas coordinates. Enter, Space and a click all
// double as "confirm" for the menu screens; the game asks via
// confirmPressed() and the edge is consumed by whichever screen is up.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.edges = new Set();
    this.mouse = { x: 480, y: 270, down: false, clicked: false };
    this.touch = null;

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.edges.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    const toGame = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * canvas.width,
        y: ((e.clientY - r.top) / r.height) * canvas.height,
      };
    };
    canvas.addEventListener('mousemove', (e) => Object.assign(this.mouse, toGame(e)));
    canvas.addEventListener('mousedown', (e) => {
      Object.assign(this.mouse, toGame(e));
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) this.edges.add('MouseRight');
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.touch = toGame(t);
      this.mouse.clicked = true;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      this.touch = toGame(e.touches[0]);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this.touch = null; });
  }

  /** True while any of the given codes is held. */
  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  /** One-shot: true on the first step after a press; consumes the edge. */
  pressed(...codes) {
    for (const c of codes) {
      if (this.edges.has(c)) { this.edges.delete(c); return true; }
    }
    return false;
  }

  /** Menu confirm: Enter, Space, Z or a fresh click. Consumes the edge. */
  confirmPressed() {
    if (this.mouse.clicked) { this.mouse.clicked = false; return true; }
    return this.pressed('Enter', 'Space', 'KeyZ', 'NumpadEnter');
  }

  /** Call once per step, after the game has read what it needs. */
  endStep() {
    this.edges.clear();
    this.mouse.clicked = false;
  }
}
