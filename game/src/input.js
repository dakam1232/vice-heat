// Keyboard + pointer-lock mouse input. `pressed` is edge-triggered and cleared
// once per simulation frame so actions never fire twice.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressedSet = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    this.onEscape = null;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' && this.onEscape) { this.onEscape(); return; }
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  lock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      const p = this.canvas.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  isDown(code) { return this.down.has(code); }
  pressed(code) { return this.pressedSet.has(code); }
  endFrame() {
    this.pressedSet.clear();
    this.mouseClicked = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
