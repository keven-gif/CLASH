/**
 * InputManager.js — Unified Input System for Echoes of the Small
 *
 * Combines keyboard, gamepad, and touch input into a single unified action map.
 *
 * Action Map:
 *   move_left, move_right, move_up, move_down → movement (Vector2)
 *   jump     → Space key
 *   attack   → J key
 *   dodge    → K key
 *   parry    → L key
 *   interact → E key
 *   shrink   → Q key
 *   grow     → R key
 *   pause    → Escape key
 *   inventory → Tab key
 *
 * Gamepad: Standard Gamepad API mapping with 0.15 deadzone
 * Touch: Virtual joystick (left) + action buttons (right)
 */

/** Gamepad axis deadzone to prevent drift. */
const GAMEPAD_DEADZONE = 0.15;

/** Number of previous frames to track for just-pressed detection. */
const JUST_PRESSED_HISTORY = 2;

/** Touch joystick configuration. */
const TOUCH_JOYSTICK_CONFIG = {
  radius: 60,           // Joystick base radius in pixels
  knobRadius: 25,       // Joystick knob radius
  centerX: 0,           // Set dynamically based on first touch
  centerY: 0,
  active: false,
  touchId: null,
  posX: 0,              // Current knob position
  posY: 0
};

/** Touch action button configuration. */
const TOUCH_BUTTONS = {
  attack:   { x: 0, y: 0, radius: 35, label: 'J', color: '#c62828', active: false, touchId: null },
  dodge:    { x: 0, y: 0, radius: 35, label: 'K', color: '#1565c0', active: false, touchId: null },
  jump:     { x: 0, y: 0, radius: 35, label: 'S', color: '#2e7d32', active: false, touchId: null },
  interact: { x: 0, y: 0, radius: 30, label: 'E', color: '#f9a825', active: false, touchId: null },
  shrink:   { x: 0, y: 0, radius: 28, label: 'Q', color: '#00838f', active: false, touchId: null },
  pause:    { x: 0, y: 0, radius: 25, label: 'P', color: '#616161', active: false, touchId: null }
};

/**
 * InputManager — Unified input handling for keyboard, gamepad, and touch.
 * Normalizes all input into a consistent action-based API.
 */
class InputManager {
  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------
  constructor() {
    // ---- Keyboard State ----
    /** Currently pressed keys: Map<keyCode, boolean> */
    this.keys = {};
    /** Keys pressed this frame (just pressed): Map<keyCode, boolean> */
    this.keysJustPressed = {};
    /** Key history for just-pressed debouncing */
    this._keyHistory = [];

    // ---- Action Map ----
    /** Maps key codes to action names. */
    this.keyMap = {
      // Keyboard arrows
      'ArrowLeft':  'move_left',
      'ArrowRight': 'move_right',
      'ArrowUp':    'move_up',
      'ArrowDown':  'move_down',
      // WASD
      'KeyA':       'move_left',
      'KeyD':       'move_right',
      'KeyW':       'move_up',
      'KeyS':       'move_down',
      // Actions
      'Space':      'jump',
      'KeyJ':       'attack',
      'KeyK':       'dodge',
      'KeyL':       'parry',
      'KeyE':       'interact',
      'KeyQ':       'shrink',
      'KeyR':       'grow',
      // System
      'Escape':     'pause',
      'Tab':        'inventory'
    };

    /** Reverse map: action name → array of key codes */
    this.actionToKeys = {};
    this._buildReverseMap();

    // ---- Action State ----
    /** Current action states: Map<actionName, { pressed, value }> */
    this.actions = {};
    /** Actions pressed this frame (just pressed) */
    this.actionsJustPressed = {};
    /** All defined action names */
    this.actionNames = [
      'move_left', 'move_right', 'move_up', 'move_down',
      'jump', 'attack', 'dodge', 'parry', 'interact',
      'shrink', 'grow', 'pause', 'inventory'
    ];

    this._initActions();

    // ---- Gamepad State ----
    /** Currently connected gamepad index, or null */
    this.activeGamepadIndex = null;
    /** Previous frame's gamepad button states */
    this._prevGamepadButtons = {};
    /** Gamepad button mapping: buttonIndex → actionName */
    this.gamepadMap = {
      0: 'jump',        // A / Cross
      1: 'dodge',       // B / Circle
      2: 'interact',    // X / Square
      3: 'attack',      // Y / Triangle
      4: 'shrink',      // LB / L1
      5: 'grow',        // RB / R1
      6: '',            // LT / L2 (used as analog)
      7: '',            // RT / R2 (used as analog)
      8: 'pause',       // Select / Share / View
      9: 'pause',       // Start / Options / Menu
      10: '',           // Left stick click
      11: '',           // Right stick click
      12: 'move_up',    // D-pad up
      13: 'move_down',  // D-pad down
      14: 'move_left',  // D-pad left
      15: 'move_right'  // D-pad right
    };
    /** Gamepad analog stick to movement mapping */
    this.gamepadAxes = {
      leftStickX: 0,   // Axis 0
      leftStickY: 1    // Axis 1
    };

    // ---- Touch State ----
    this.touchEnabled = false;
    this.joystick = { ...TOUCH_JOYSTICK_CONFIG };
    this.buttons = this._initTouchButtons();
    this._touchElement = null;

    // ---- Movement Vector ----
    /** Cached normalized movement vector from all input sources */
    this._movementVector = { x: 0, y: 0 };

    // ---- DOM Element References ----
    this._boundHandlers = {};

    // ---- Vibration support ----
    this._vibrationSupported = 'vibrate' in navigator;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------
  /**
   * Build reverse action→keys mapping for quick lookup.
   * @private
   */
  _buildReverseMap() {
    this.actionToKeys = {};
    for (const [key, action] of Object.entries(this.keyMap)) {
      if (!this.actionToKeys[action]) {
        this.actionToKeys[action] = [];
      }
      this.actionToKeys[action].push(key);
    }
  }

  /**
   * Initialize action state objects.
   * @private
   */
  _initActions() {
    for (const action of this.actionNames) {
      this.actions[action] = { pressed: false, value: 0 };
      this.actionsJustPressed[action] = { pressed: false, value: 0 };
    }
  }

  /**
   * Initialize touch button configuration.
   * @private
   */
  _initTouchButtons() {
    const buttons = {};
    for (const [name, config] of Object.entries(TOUCH_BUTTONS)) {
      buttons[name] = { ...config };
    }
    return buttons;
  }

  /**
   * Initialize all input listeners.
   * Binds keyboard, gamepad, and touch events.
   */
  init() {
    this._bindKeyboard();
    this._bindGamepad();
    this._bindTouch();

    // Check for touch device
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      this.touchEnabled = true;
      this._setupTouchUI();
    }

    console.log('[InputManager] Initialized. Touch:', this.touchEnabled);
  }

  // --------------------------------------------------------------------------
  // Keyboard Binding
  // --------------------------------------------------------------------------
  /**
   * Bind keyboard event listeners.
   * @private
   */
  _bindKeyboard() {
    this._boundHandlers.keydown = (e) => this._onKeyDown(e);
    this._boundHandlers.keyup = (e) => this._onKeyUp(e);

    window.addEventListener('keydown', this._boundHandlers.keydown);
    window.addEventListener('keyup', this._boundHandlers.keyup);
  }

  /**
   * Handle keydown events.
   * @private
   */
  _onKeyDown(e) {
    const code = e.code;

    // Prevent default for game keys to stop page scrolling
    if (this._isGameKey(code)) {
      e.preventDefault();
    }

    // Track just-pressed
    if (!this.keys[code]) {
      this.keysJustPressed[code] = true;
    }

    this.keys[code] = true;
  }

  /**
   * Handle keyup events.
   * @private
   */
  _onKeyUp(e) {
    const code = e.code;
    this.keys[code] = false;
    this.keysJustPressed[code] = false;
  }

  /**
   * Check if a key is a game key that should have preventDefault.
   * @private
   */
  _isGameKey(code) {
    const gameKeys = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'Tab', 'Escape',
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'KeyE', 'KeyQ', 'KeyR',
      'KeyJ', 'KeyK', 'KeyL'
    ];
    return gameKeys.includes(code);
  }

  // --------------------------------------------------------------------------
  // Gamepad Binding
  // --------------------------------------------------------------------------
  /**
   * Bind gamepad connection events.
   * @private
   */
  _bindGamepad() {
    window.addEventListener('gamepadconnected', (e) => {
      console.log(`[InputManager] Gamepad connected: ${e.gamepad.id} (index ${e.gamepad.index})`);
      this.activeGamepadIndex = e.gamepad.index;
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      console.log(`[InputManager] Gamepad disconnected: index ${e.gamepad.index}`);
      if (this.activeGamepadIndex === e.gamepad.index) {
        this.activeGamepadIndex = null;
      }
    });
  }

  /**
   * Poll the active gamepad for current button and axis states.
   * @private
   */
  _pollGamepad() {
    if (this.activeGamepadIndex === null) return;

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[this.activeGamepadIndex];
    if (!gp) return;

    // Poll buttons
    for (let i = 0; i < gp.buttons.length && i < 16; i++) {
      const button = gp.buttons[i];
      const pressed = button.pressed || (button.value > 0.5);
      const action = this.gamepadMap[i];

      if (action) {
        // Track just-pressed for gamepad buttons
        const wasPressed = this._prevGamepadButtons[i] || false;
        if (pressed && !wasPressed) {
          this.actionsJustPressed[action] = { pressed: true, value: 1 };
        }

        if (pressed) {
          this.actions[action] = { pressed: true, value: 1 };
        }
      }

      this._prevGamepadButtons[i] = pressed;
    }

    // Poll left analog stick for movement
    const stickX = gp.axes[this.gamepadAxes.leftStickX] || 0;
    const stickY = gp.axes[this.gamepadAxes.leftStickY] || 0;

    // Apply deadzone
    const deadzone = GAMEPAD_DEADZONE;
    const applyDeadzone = (v) => Math.abs(v) < deadzone ? 0 : v;
    const dx = applyDeadzone(stickX);
    const dy = applyDeadzone(stickY);

    if (Math.abs(dx) > 0) {
      const actionX = dx > 0 ? 'move_right' : 'move_left';
      this.actions[actionX] = { pressed: true, value: Math.abs(dx) };
    }
    if (Math.abs(dy) > 0) {
      const actionY = dy > 0 ? 'move_down' : 'move_up';
      this.actions[actionY] = { pressed: true, value: Math.abs(dy) };
    }

    // Also map right stick buttons if applicable
    if (gp.buttons[6] && gp.buttons[6].pressed) {
      this.actions['parry'] = { pressed: true, value: 1 };
    }
    if (gp.buttons[7] && gp.buttons[7].pressed) {
      this.actions['inventory'] = { pressed: true, value: 1 };
    }
  }

  // --------------------------------------------------------------------------
  // Touch Binding
  // --------------------------------------------------------------------------
  /**
   * Bind touch event listeners.
   * @private
   */
  _bindTouch() {
    // We'll bind to the canvas element once we have a reference
    // The actual setup happens in _setupTouchUI
  }

  /**
   * Set up the touch UI overlay.
   * Creates a dedicated touch layer for virtual controls.
   * @private
   */
  _setupTouchUI() {
    // Get or create touch overlay
    let touchOverlay = document.getElementById('touchOverlay');
    if (!touchOverlay) {
      touchOverlay = document.createElement('div');
      touchOverlay.id = 'touchOverlay';
      touchOverlay.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        pointer-events: auto;
        touch-action: none;
        z-index: 100;
        user-select: none;
        -webkit-user-select: none;
      `;
      document.body.appendChild(touchOverlay);
    }

    this._touchElement = touchOverlay;

    // Position buttons on the right side
    this._layoutTouchButtons();

    // Bind touch events
    touchOverlay.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    touchOverlay.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    touchOverlay.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    touchOverlay.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });

    // Handle resize
    window.addEventListener('resize', () => this._layoutTouchButtons());
  }

  /**
   * Layout touch buttons on the right side of the screen.
   * @private
   */
  _layoutTouchButtons() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Joystick on the left
    this.joystick.baseX = 100;
    this.joystick.baseY = h - 120;

    // Action buttons on the right (arranged in a comfortable arc)
    const rightX = w - 50;
    const rightY = h - 140;

    this.buttons.attack.x = rightX - 80;
    this.buttons.attack.y = rightY + 20;

    this.buttons.dodge.x = rightX - 30;
    this.buttons.dodge.y = rightY - 40;

    this.buttons.jump.x = rightX + 20;
    this.buttons.jump.y = rightY + 20;

    this.buttons.interact.x = rightX - 140;
    this.buttons.interact.y = rightY - 20;

    this.buttons.shrink.x = rightX + 10;
    this.buttons.shrink.y = rightY - 70;

    this.buttons.pause.x = w - 40;
    this.buttons.pause.y = 40;
  }

  /**
   * Handle touch start events.
   * @private
   */
  _onTouchStart(e) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const tx = touch.clientX;
      const ty = touch.clientY;

      // Check if touching joystick area (left side)
      if (tx < window.innerWidth * 0.4 && !this.joystick.active) {
        this.joystick.active = true;
        this.joystick.touchId = touch.identifier;
        this.joystick.centerX = tx;
        this.joystick.centerY = ty;
        this.joystick.posX = tx;
        this.joystick.posY = ty;
        continue;
      }

      // Check if touching any action button
      for (const [name, btn] of Object.entries(this.buttons)) {
        const dist = Math.hypot(tx - btn.x, ty - btn.y);
        if (dist < btn.radius && !btn.active) {
          btn.active = true;
          btn.touchId = touch.identifier;
          this.actionsJustPressed[name] = { pressed: true, value: 1 };
          this.actions[name] = { pressed: true, value: 1 };
          break;
        }
      }
    }
  }

  /**
   * Handle touch move events.
   * @private
   */
  _onTouchMove(e) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Update joystick
      if (this.joystick.active && touch.identifier === this.joystick.touchId) {
        const dx = touch.clientX - this.joystick.centerX;
        const dy = touch.clientY - this.joystick.centerY;
        const dist = Math.hypot(dx, dy);
        const maxDist = this.joystick.radius;

        // Clamp to joystick radius
        if (dist > maxDist) {
          const ratio = maxDist / dist;
          this.joystick.posX = this.joystick.centerX + dx * ratio;
          this.joystick.posY = this.joystick.centerY + dy * ratio;
        } else {
          this.joystick.posX = touch.clientX;
          this.joystick.posY = touch.clientY;
        }
      }
    }
  }

  /**
   * Handle touch end events.
   * @private
   */
  _onTouchEnd(e) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // Release joystick
      if (this.joystick.active && touch.identifier === this.joystick.touchId) {
        this.joystick.active = false;
        this.joystick.touchId = null;
        this.joystick.posX = this.joystick.centerX;
        this.joystick.posY = this.joystick.centerY;
      }

      // Release buttons
      for (const [name, btn] of Object.entries(this.buttons)) {
        if (btn.active && touch.identifier === btn.touchId) {
          btn.active = false;
          btn.touchId = null;
          this.actions[name] = { pressed: false, value: 0 };
        }
      }
    }
  }

  /**
   * Draw the touch UI overlay (call from render loop when touch is enabled).
   */
  renderTouchUI(ctx) {
    if (!this.touchEnabled) return;

    // Draw joystick
    if (this.joystick.active || true) { // Always show for discoverability
      const j = this.joystick;

      // Joystick base
      ctx.beginPath();
      ctx.arc(j.centerX, j.centerY, j.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Joystick knob
      const knobX = j.active ? j.posX : j.centerX;
      const knobY = j.active ? j.posY : j.centerY;
      ctx.beginPath();
      ctx.arc(knobX, knobY, j.knobRadius, 0, Math.PI * 2);
      ctx.fillStyle = j.active ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw buttons
    for (const [name, btn] of Object.entries(this.buttons)) {
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
      ctx.fillStyle = btn.active
        ? this._hexToRgba(btn.color, 0.7)
        : this._hexToRgba(btn.color, 0.3);
      ctx.fill();
      ctx.strokeStyle = this._hexToRgba(btn.color, 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Button label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${btn.radius * 0.6}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x, btn.y);
    }
  }

  // --------------------------------------------------------------------------
  // Update
  // --------------------------------------------------------------------------
  /**
   * Update input state.
   * Polls gamepad, processes held keys, computes movement vector.
   * Call once per frame before game logic.
   */
  update() {
    // Reset actions (keyboard will re-apply, gamepad/touch need polling)
    for (const action of this.actionNames) {
      this.actions[action] = { pressed: false, value: 0 };
    }

    // Process keyboard input
    this._processKeyboard();

    // Poll gamepad
    this._pollGamepad();

    // Process touch joystick
    this._processTouchJoystick();

    // Compute unified movement vector
    this._computeMovementVector();
  }

  /**
   * Process keyboard keys into action states.
   * @private
   */
  _processKeyboard() {
    for (const [code, action] of Object.entries(this.keyMap)) {
      if (this.keys[code]) {
        const isMovement = action.startsWith('move_');
        this.actions[action] = {
          pressed: true,
          value: isMovement ? 1 : 1
        };
      }
    }
  }

  /**
   * Process touch joystick into movement actions.
   * @private
   */
  _processTouchJoystick() {
    if (!this.joystick.active) return;

    const j = this.joystick;
    const dx = j.posX - j.centerX;
    const dy = j.posY - j.centerY;
    const maxDist = j.radius;

    // Normalize
    let nx = dx / maxDist;
    let ny = dy / maxDist;

    // Clamp
    const mag = Math.hypot(nx, ny);
    if (mag > 1) {
      nx /= mag;
      ny /= mag;
    }

    // Apply deadzone
    if (Math.abs(nx) < 0.1) nx = 0;
    if (Math.abs(ny) < 0.1) ny = 0;

    // Set movement actions
    if (Math.abs(nx) > 0) {
      const action = nx > 0 ? 'move_right' : 'move_left';
      this.actions[action] = { pressed: true, value: Math.abs(nx) };
    }
    if (Math.abs(ny) > 0) {
      const action = ny > 0 ? 'move_down' : 'move_up';
      this.actions[action] = { pressed: true, value: Math.abs(ny) };
    }
  }

  /**
   * Compute the unified movement vector from all input sources.
   * @private
   */
  _computeMovementVector() {
    let mx = 0, my = 0;

    // Horizontal
    if (this.actions.move_left.pressed) {
      mx -= this.actions.move_left.value;
    }
    if (this.actions.move_right.pressed) {
      mx += this.actions.move_right.value;
    }

    // Vertical
    if (this.actions.move_up.pressed) {
      my -= this.actions.move_up.value;
    }
    if (this.actions.move_down.pressed) {
      my += this.actions.move_down.value;
    }

    // Normalize
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }

    this._movementVector.x = mx;
    this._movementVector.y = my;
  }

  // --------------------------------------------------------------------------
  // Public Query API
  // --------------------------------------------------------------------------
  /**
   * Check if an action is currently being held.
   *
   * @param {string} action — Action name (e.g., 'jump', 'attack', 'move_left')
   * @returns {{ pressed: boolean, value: number|Vector2 }} Action state
   *   - pressed: Whether the action is active
   *   - value: For movement, a Vector2; for buttons, 0 or 1
   */
  isPressed(action) {
    // Movement actions return the unified vector
    if (action === 'move') {
      return {
        pressed: this._movementVector.x !== 0 || this._movementVector.y !== 0,
        value: new Vector2(this._movementVector.x, this._movementVector.y)
      };
    }

    const state = this.actions[action];
    if (state) {
      return { pressed: state.pressed, value: state.value };
    }
    return { pressed: false, value: 0 };
  }

  /**
   * Check if an action was just pressed this frame (single trigger).
   * Returns true only on the first frame the action becomes active.
   *
   * @param {string} action — Action name
   * @returns {{ pressed: boolean, value: number|Vector2 }} Just-pressed state
   */
  isJustPressed(action) {
    // Check from keyboard just-pressed
    const keyCodes = this.actionToKeys[action];
    if (keyCodes) {
      for (const code of keyCodes) {
        if (this.keysJustPressed[code]) {
          // Consume the just-pressed so it doesn't fire again
          this.keysJustPressed[code] = false;

          if (action === 'move') {
            return { pressed: true, value: new Vector2(this._movementVector.x, this._movementVector.y) };
          }
          return { pressed: true, value: 1 };
        }
      }
    }

    // Check from gamepad just-pressed
    const justState = this.actionsJustPressed[action];
    if (justState && justState.pressed) {
      this.actionsJustPressed[action] = { pressed: false, value: 0 };

      if (action === 'move') {
        return { pressed: true, value: new Vector2(this._movementVector.x, this._movementVector.y) };
      }
      return { pressed: true, value: justState.value };
    }

    // Check from touch just-pressed
    const btn = this.buttons[action];
    if (btn && btn.active && this.actionsJustPressed[action]?.pressed) {
      this.actionsJustPressed[action] = { pressed: false, value: 0 };
      return { pressed: true, value: 1 };
    }

    return { pressed: false, value: 0 };
  }

  /**
   * Get the normalized movement vector from all input sources.
   * Combines keyboard (arrows/WASD), gamepad analog stick, and touch joystick.
   *
   * @returns {Vector2} Normalized movement direction (x: -1 to 1, y: -1 to 1)
   */
  getMovementVector() {
    return new Vector2(this._movementVector.x, this._movementVector.y);
  }

  /**
   * Get the raw movement vector magnitude (for analog speed control).
   * @returns {number} Magnitude between 0 and 1
   */
  getMovementMagnitude() {
    return Math.hypot(this._movementVector.x, this._movementVector.y);
  }

  // --------------------------------------------------------------------------
  // Vibration
  // --------------------------------------------------------------------------
  /**
   * Trigger vibration on supported devices (controller or phone).
   *
   * @param {number} duration — Vibration duration in milliseconds
   * @param {number} intensity — Intensity 0.0–1.0
   */
  vibrate(duration = 200, intensity = 0.5) {
    // Phone vibration
    if (this._vibrationSupported) {
      navigator.vibrate(duration);
    }

    // Gamepad vibration (if supported)
    if (this.activeGamepadIndex !== null) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[this.activeGamepadIndex];
      if (gp && gp.vibrationActuator) {
        gp.vibrationActuator.playEffect('dual-rumble', {
          duration,
          strongMagnitude: intensity,
          weakMagnitude: intensity * 0.5
        }).catch(() => {});
      }
    }
  }

  /**
   * Trigger a short light vibration (UI feedback).
   */
  vibrateLight() {
    this.vibrate(30, 0.3);
  }

  /**
   * Trigger a medium vibration (action feedback).
   */
  vibrateMedium() {
    this.vibrate(80, 0.6);
  }

  /**
   * Trigger a heavy vibration (impact feedback).
   */
  vibrateHeavy() {
    this.vibrate(200, 1.0);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------
  /**
   * Check if a specific key is currently pressed.
   * @param {string} code — Keyboard event code (e.g., 'KeyA', 'Space')
   * @returns {boolean}
   */
  isKeyPressed(code) {
    return !!this.keys[code];
  }

  /**
   * Check if any input is active (keyboard, gamepad, or touch).
   * @returns {boolean}
   */
  hasAnyInput() {
    // Check keyboard
    for (const v of Object.values(this.keys)) {
      if (v) return true;
    }
    // Check gamepad
    if (this.activeGamepadIndex !== null) {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[this.activeGamepadIndex];
      if (gp) {
        for (const btn of gp.buttons) {
          if (btn.pressed) return true;
        }
        for (const axis of gp.axes) {
          if (Math.abs(axis) > GAMEPAD_DEADZONE) return true;
        }
      }
    }
    // Check touch
    if (this.joystick.active) return true;
    for (const btn of Object.values(this.buttons)) {
      if (btn.active) return true;
    }
    return false;
  }

  /**
   * Get the currently connected gamepad info.
   * @returns {object|null} Gamepad info or null
   */
  getGamepadInfo() {
    if (this.activeGamepadIndex === null) return null;
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[this.activeGamepadIndex];
    if (!gp) return null;
    return {
      id: gp.id,
      index: gp.index,
      mapping: gp.mapping,
      axes: gp.axes.length,
      buttons: gp.buttons.length
    };
  }

  /**
   * Check if a gamepad is currently connected.
   * @returns {boolean}
   */
  isGamepadConnected() {
    return this.activeGamepadIndex !== null;
  }

  /**
   * Check if touch controls are active.
   * @returns {boolean}
   */
  isTouchActive() {
    return this.touchEnabled;
  }

  /**
   * Enable or disable touch controls.
   * @param {boolean} enabled
   */
  setTouchEnabled(enabled) {
    this.touchEnabled = enabled;
    const overlay = document.getElementById('touchOverlay');
    if (overlay) {
      overlay.style.display = enabled ? 'block' : 'none';
    }
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------
  /**
   * Remove all event listeners and clean up.
   */
  destroy() {
    // Remove keyboard listeners
    if (this._boundHandlers.keydown) {
      window.removeEventListener('keydown', this._boundHandlers.keydown);
    }
    if (this._boundHandlers.keyup) {
      window.removeEventListener('keyup', this._boundHandlers.keyup);
    }

    // Remove touch overlay
    const overlay = document.getElementById('touchOverlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------
  /**
   * Convert hex color to rgba string.
   * @private
   */
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

// Make InputManager class available globally
window.InputManager = InputManager;

// Ensure Vector2 is available (defined in Game.js, but declare minimally here for standalone use)
if (typeof Vector2 === 'undefined') {
  window.Vector2 = class Vector2 {
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  };
}
