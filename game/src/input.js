// Keyboard + mouse. Edges are consumed once per simulation step; tests can call press/release.
export class Input {
  constructor(target) {
    this.down = new Set();
    this.edges = new Set();
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.click = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.gesture = null;
    this.enabled = true;
    target.addEventListener('keydown', (e) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.edges.add(e.code);
      this.down.add(e.code);
      if (this.gesture) this.gesture();
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.dragging = false; });
    target.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === target) {
        this.yawDelta += e.movementX * 0.0026;
        this.pitchDelta += e.movementY * 0.0022;
      } else if (this.dragging) {
        this.yawDelta += (e.clientX - this.lastX) * 0.005;
        this.pitchDelta += (e.clientY - this.lastY) * 0.004;
        this.lastX = e.clientX; this.lastY = e.clientY;
      }
    });
    target.addEventListener('mousedown', (e) => {
      if (this.gesture) this.gesture();
      this.lastX = e.clientX; this.lastY = e.clientY;
      if (e.button === 2) this.dragging = true;
      if (e.button === 0) this.click = true;
    });
    target.addEventListener('mouseup', (e) => { if (e.button === 2) this.dragging = false; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  is(code) { return this.down.has(code); }
  pressed(code) { return this.edges.has(code); }
  press(code) { if (!this.down.has(code)) this.edges.add(code); this.down.add(code); }
  release(code) { this.down.delete(code); }
  endFrame() {
    this.edges.clear();
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.click = false;
  }
}
