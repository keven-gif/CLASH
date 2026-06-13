import type { Vector2, GameInput } from './types';

// ─── Constants ───────────────────────────────────────────────────────

const JOYSTICK_DEADZONE = 15;
const JOYSTICK_MAX_RADIUS = 50; // max drag distance in px
const BUFFER_SIZE = 6;

// ─── Input Buffer ────────────────────────────────────────────────────

interface BufferedInput {
  attack: boolean;
  special: boolean;
  jump: boolean;
  shield: boolean;
  grab: boolean;
}

// ─── InputHandler Class ──────────────────────────────────────────────

export class InputHandler {
  private joystick: Vector2 = { x: 0, y: 0 };
  private joystickActive = false;
  private joystickCenter: Vector2 = { x: 0, y: 0 };
  private joystickTouchId: number | null = null;

  private buttons: Record<string, boolean> = {
    attack: false,
    special: false,
    jump: false,
    shield: false,
    grab: false,
  };

  private buttonsPressed: Record<string, boolean> = {
    attack: false,
    special: false,
    jump: false,
    shield: false,
    grab: false,
  };

  private buttonTouchIds: Record<string, number | null> = {
    attack: null,
    special: null,
    jump: null,
    shield: null,
    grab: null,
  };

  private buffer: BufferedInput[] = [];
  // No-op placeholder for future input buffering

  // Button zones (will be set by the React component)
  private buttonZones: Record<string, DOMRect | null> = {
    attack: null,
    special: null,
    jump: null,
    shield: null,
    grab: null,
  };

  private joystickZone: DOMRect | null = null;

  constructor() {
    this.getJoystickDirection = this.getJoystickDirection.bind(this);
    this.getGameInput = this.getGameInput.bind(this);
  }

  // ── Zone Registration ──────────────────────────────────────────────

  setJoystickZone(rect: DOMRect | null): void {
    this.joystickZone = rect;
    if (rect && !this.joystickActive) {
      this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
  }

  setButtonZone(button: string, rect: DOMRect | null): void {
    this.buttonZones[button] = rect;
  }

  // ── Touch Event Handlers ───────────────────────────────────────────

  handleTouchStart(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const { clientX: x, clientY: y, identifier: id } = touch;

      // Check joystick zone
      if (this.joystickZone && this.isInZone(x, y, this.joystickZone) && this.joystickTouchId === null) {
        this.joystickTouchId = id;
        this.joystickActive = true;
        this.joystickCenter = {
          x: this.joystickZone.left + this.joystickZone.width / 2,
          y: this.joystickZone.top + this.joystickZone.height / 2,
        };
        this.updateJoystickPosition(x, y);
        continue;
      }

      // Check button zones
      for (const [btn, zone] of Object.entries(this.buttonZones)) {
        if (zone && this.isInZone(x, y, zone) && this.buttonTouchIds[btn] === null) {
          this.buttonTouchIds[btn] = id;
          this.buttons[btn] = true;
          this.buttonsPressed[btn] = true;
          break;
        }
      }
    }
  }

  handleTouchMove(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const { clientX: x, clientY: y, identifier: id } = touch;

      if (id === this.joystickTouchId) {
        this.updateJoystickPosition(x, y);
      }
    }
  }

  handleTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const { identifier: id } = touch;

      // Release joystick
      if (id === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.joystickActive = false;
        this.joystick = { x: 0, y: 0 };
      }

      // Release buttons
      for (const [btn, touchId] of Object.entries(this.buttonTouchIds)) {
        if (touchId === id) {
          this.buttonTouchIds[btn] = null;
          this.buttons[btn] = false;
        }
      }
    }
  }

  // ── Keyboard Fallback ──────────────────────────────────────────────

  handleKeyDown(key: string): void {
    switch (key.toLowerCase()) {
      case 'a':
      case 'arrowleft':
        this.joystick.x = -1;
        break;
      case 'd':
      case 'arrowright':
        this.joystick.x = 1;
        break;
      case 'w':
      case 'arrowup':
        this.joystick.y = -1;
        break;
      case 's':
      case 'arrowdown':
        this.joystick.y = 1;
        break;
      case 'j':
      case 'z':
        if (!this.buttons.attack) this.buttonsPressed.attack = true;
        this.buttons.attack = true;
        break;
      case 'k':
      case 'x':
        if (!this.buttons.special) this.buttonsPressed.special = true;
        this.buttons.special = true;
        break;
      case 'l':
      case 'c':
        if (!this.buttons.jump) this.buttonsPressed.jump = true;
        this.buttons.jump = true;
        break;
      case 'i':
      case 'v':
        if (!this.buttons.shield) this.buttonsPressed.shield = true;
        this.buttons.shield = true;
        break;
      case 'o':
      case 'b':
        if (!this.buttons.grab) this.buttonsPressed.grab = true;
        this.buttons.grab = true;
        break;
    }
  }

  handleKeyUp(key: string): void {
    switch (key.toLowerCase()) {
      case 'a':
      case 'd':
      case 'arrowleft':
      case 'arrowright':
        this.joystick.x = 0;
        break;
      case 'w':
      case 's':
      case 'arrowup':
      case 'arrowdown':
        this.joystick.y = 0;
        break;
      case 'j':
      case 'z':
        this.buttons.attack = false;
        break;
      case 'k':
      case 'x':
        this.buttons.special = false;
        break;
      case 'l':
      case 'c':
        this.buttons.jump = false;
        break;
      case 'i':
      case 'v':
        this.buttons.shield = false;
        break;
      case 'o':
      case 'b':
        this.buttons.grab = false;
        break;
    }
  }

  // ── Joystick Query ─────────────────────────────────────────────────

  getJoystickDirection(): Vector2 {
    return { ...this.joystick };
  }

  isJoystickActive(): boolean {
    return this.joystickActive;
  }

  getJoystickRawPosition(): Vector2 | null {
    if (!this.joystickActive) return null;
    return {
      x: this.joystick.x * JOYSTICK_MAX_RADIUS,
      y: this.joystick.y * JOYSTICK_MAX_RADIUS,
    };
  }

  // ── Button Setter (public) ─────────────────────────────────────────

  setButton(button: string, pressed: boolean): void {
    if (pressed && !this.buttons[button]) {
      this.buttonsPressed[button] = true;
    }
    this.buttons[button] = pressed;
  }

  // ── Button Queries ─────────────────────────────────────────────────

  isButtonPressed(button: string): boolean {
    return this.buttons[button] ?? false;
  }

  isButtonJustPressed(button: string): boolean {
    return this.buttonsPressed[button] ?? false;
  }

  // ── Game Input ─────────────────────────────────────────────────────

  getGameInput(): GameInput {
    // Store previous for edge detection
    const pressed = { ...this.buttonsPressed };

    // Clear pressed flags (they only last one frame)
    for (const key of Object.keys(this.buttonsPressed)) {
      this.buttonsPressed[key] = false;
    }

    return {
      joystick: { ...this.joystick },
      attack: this.buttons.attack,
      special: this.buttons.special,
      jump: this.buttons.jump,
      shield: this.buttons.shield,
      grab: this.buttons.grab,
      attackPressed: pressed.attack,
      specialPressed: pressed.special,
      jumpPressed: pressed.jump,
      shieldPressed: pressed.shield,
      grabPressed: pressed.grab,
    };
  }

  // ── Buffer ─────────────────────────────────────────────────────────

  updateBuffer(): void {
    this.buffer.unshift({
      attack: this.buttons.attack,
      special: this.buttons.special,
      jump: this.buttons.jump,
      shield: this.buttons.shield,
      grab: this.buttons.grab,
    });
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.pop();
    }
  }

  wasBuffered(button: string): boolean {
    return this.buffer.some((b) => b[button as keyof BufferedInput]);
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  reset(): void {
    this.joystick = { x: 0, y: 0 };
    this.joystickActive = false;
    this.joystickTouchId = null;
    for (const key of Object.keys(this.buttons)) {
      this.buttons[key] = false;
      this.buttonsPressed[key] = false;
      this.buttonTouchIds[key] = null;
    }
    this.buffer = [];
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private isInZone(x: number, y: number, zone: DOMRect): boolean {
    return x >= zone.left && x <= zone.right && y >= zone.top && y <= zone.bottom;
  }

  private updateJoystickPosition(x: number, y: number): void {
    let dx = x - this.joystickCenter.x;
    let dy = y - this.joystickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clamp to max radius
    const maxR = JOYSTICK_MAX_RADIUS;
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    // Apply deadzone and normalize
    const effectiveDist = Math.max(0, dist - JOYSTICK_DEADZONE);
    const maxEffective = maxR - JOYSTICK_DEADZONE;
    const normalizedFactor = maxEffective > 0 ? Math.min(1, effectiveDist / maxEffective) : 0;

    if (dist > 0) {
      this.joystick = {
        x: (dx / dist) * normalizedFactor,
        y: (dy / dist) * normalizedFactor,
      };
    } else {
      this.joystick = { x: 0, y: 0 };
    }
  }
}
