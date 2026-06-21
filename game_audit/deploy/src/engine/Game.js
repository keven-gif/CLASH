/**
 * Game.js — Core Engine for Echoes of the Small
 *
 * The central game controller. Manages the game loop (requestAnimationFrame),
 * state machine, camera system, hitstop, screen shake, canvas setup,
 * and event bus integration. Coordinates all subsystems in the correct update order.
 *
 * State Machine: LOADING → TITLE → PLAYING → PAUSED → INVENTORY → DIALOG → DYING → GAME_OVER → ENDING
 *
 * Game Loop Order: Input → World → Entities → Systems → Camera → Particles → Render → Audio
 */

// ============================================================================
// Global Event Bus — CustomEvent-based pub/sub on window
// ============================================================================

/**
 * Global event emitter for cross-module communication.
 * All modules communicate via window.GameEvents.emit('eventName', payload)
 * and listen via window.GameEvents.on('eventName', callback).
 *
 * Built-in events:
 *   'input:action'        → { action, value }
 *   'combat:hit'          → { attacker, target, damage, isCritical, position }
 *   'combat:combo'        → { count, multiplier }
 *   'combat:parry'        → { attacker, defender, position }
 *   'combat:dodge'        → { entity, direction }
 *   'player:damage'       → { amount, currentHP, maxHP }
 *   'player:death'        → {}
 *   'player:scaleChange'  → { fromScale, toScale, duration }
 *   'player:itemPickup'   → { itemId, itemName }
 *   'world:biomeChange'   → { fromBiome, toBiome }
 *   'world:weatherChange' → { weatherType, intensity }
 *   'world:enterDungeon'  → { dungeonId }
 *   'world:exitDungeon'   → {}
 *   'quest:start'         → { questId }
 *   'quest:update'        → { questId, objective, progress }
 *   'quest:complete'      → { questId, rewards }
 *   'system:notification' → { message, type }
 *   'system:save'         → { slot }
 *   'system:load'         → { slot }
 *   'system:hitstop'      → { duration }
 *   'system:screenshake'  → { intensity, duration }
 */
window.GameEvents = {
  /**
   * Register an event listener.
   * @param {string} event — Event name
   * @param {Function} callback — Handler receiving (detail) object
   * @returns {Function} unsubscribe function
   */
  on(event, callback) {
    const handler = (e) => callback(e.detail);
    window.addEventListener(`game:${event}`, handler);
    return () => window.removeEventListener(`game:${event}`, handler);
  },

  /**
   * Remove an event listener.
   * @param {string} event — Event name
   * @param {Function} callback — Handler to remove
   */
  off(event, callback) {
    window.removeEventListener(`game:${event}`, callback);
  },

  /**
   * Emit an event with a payload.
   * @param {string} event — Event name
   * @param {object} detail — Payload data
   */
  emit(event, detail = {}) {
    window.dispatchEvent(new CustomEvent(`game:${event}`, { detail }));
  }
};

// ============================================================================
// Vector2 Utility Class
// ============================================================================

/** Simple 2D vector for positions, velocities, and movement vectors. */
class Vector2 {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /** Clone this vector. */
  clone() { return new Vector2(this.x, this.y); }

  /** Add another vector (in-place). */
  add(v) { this.x += v.x; this.y += v.y; return this; }

  /** Scale by a scalar (in-place). */
  scale(s) { this.x *= s; this.y *= s; return this; }

  /** Get the magnitude. */
  magnitude() { return Math.sqrt(this.x * this.x + this.y * this.y); }

  /** Normalize to unit length (in-place). Returns zero vector if magnitude is 0. */
  normalize() {
    const mag = this.magnitude();
    if (mag > 0) { this.x /= mag; this.y /= mag; }
    return this;
  }

  /** Return a normalized copy without modifying original. */
  normalized() {
    const mag = this.magnitude();
    if (mag === 0) return new Vector2(0, 0);
    return new Vector2(this.x / mag, this.y / mag);
  }
}

// ============================================================================
// Game Class
// ============================================================================

/** State machine states for the game lifecycle. */
const GameStates = {
  LOADING:   'LOADING',
  TITLE:     'TITLE',
  PLAYING:   'PLAYING',
  PAUSED:    'PAUSED',
  INVENTORY: 'INVENTORY',
  DIALOG:    'DIALOG',
  DYING:     'DYING',
  GAME_OVER: 'GAME_OVER',
  ENDING:    'ENDING'
};

/**
 * Core game engine class. Manages the game loop, state machine, camera,
 * hitstop, screen shake, canvas, and coordinates all subsystems.
 */
class Game {
  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------
  constructor() {
    // Canvas and rendering context
    this.canvas = document.getElementById('gameCanvas');
    if (!this.canvas) {
      // Create canvas if not found (for standalone testing)
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'gameCanvas';
      document.body.appendChild(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');

    // Game state
    this.state = GameStates.LOADING;
    this.previousState = null;

    // Timing
    this.lastTime = 0;
    this.deltaTime = 0;
    this.targetFPS = 60;
    this.targetFrameTime = 1000 / this.targetFPS;
    this.accumulator = 0;
    this.maxDeltaTime = 100; // Cap delta to prevent spiral of death

    // Hitstop / time scaling
    this.hitstopTimer = 0;   // Remaining freeze time in seconds
    this.timeScale = 1.0;    // 1.0 = normal, 0.0 = frozen
    this.slowMoTimer = 0;    // For dramatic slow-motion effects

    // Game time tracking
    this.gameTime = 0;       // Total elapsed game time (seconds)
    this.frameCount = 0;     // Total frames rendered

    // World seed
    this.worldSeed = Math.random() * 100000 | 0;

    // Camera system
    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      shakeX: 0,
      shakeY: 0,
      shakeIntensity: 0,
      shakeDuration: 0,
      shakeTimer: 0,
      zoom: 1.0,
      targetZoom: 1.0,
      lerpFactor: 0.08,
      worldWidth: 16384,   // Total world width in pixels
      worldHeight: 16384,  // Total world height in pixels
      lockX: false,
      lockY: false,
      lockXValue: 0,
      lockYValue: 0,
      zones: [] // Camera zones: { x, y, w, h, lockX, lockY }
    };

    // Subsystems (initialized in init())
    this.renderer = null;
    this.input = null;
    this.audio = null;
    this.world = null;
    this.player = null;
    this.ui = null;

    // Entity and system collections
    this.entities = [];      // All active entities (enemies, NPCs, items, etc.)
    this.systems = [];       // Game systems (combat, scale, items, quests)

    // Game loop control
    this.rafId = null;       // requestAnimationFrame handle
    this.isRunning = false;

    // Loading state
    this.assetsLoaded = 0;
    this.totalAssets = 1;    // Minimum: at least the engine itself
    this.loadingProgress = 0;

    // Screen dimensions
    this.width = 0;
    this.height = 0;

    // Debug
    this.debug = false;
    this.fps = 0;
    this.fpsCounter = 0;
    this.fpsTimer = 0;

    // State transition hooks
    this.stateHooks = this._initStateHooks();

    // Event listener cleanup handles
    this._eventUnsubscribers = [];
  }

  // --------------------------------------------------------------------------
  // State Hook Initialization
  // --------------------------------------------------------------------------

  /**
   * Initialize per-state enter/update/exit hooks.
   * Each state can define onEnter, onUpdate, onExit callbacks.
   */
  _initStateHooks() {
    return {
      [GameStates.LOADING]: {
        onEnter: () => this._onEnterLoading(),
        onUpdate: (dt) => this._onUpdateLoading(dt),
        onExit: () => this._onExitLoading()
      },
      [GameStates.TITLE]: {
        onEnter: () => this._onEnterTitle(),
        onUpdate: (dt) => this._onUpdateTitle(dt),
        onExit: () => this._onExitTitle()
      },
      [GameStates.PLAYING]: {
        onEnter: () => this._onEnterPlaying(),
        onUpdate: (dt) => this._onUpdatePlaying(dt),
        onExit: () => this._onExitPlaying()
      },
      [GameStates.PAUSED]: {
        onEnter: () => this._onEnterPaused(),
        onUpdate: (dt) => this._onUpdatePaused(dt),
        onExit: () => this._onExitPaused()
      },
      [GameStates.INVENTORY]: {
        onEnter: () => this._onEnterInventory(),
        onUpdate: (dt) => this._onUpdateInventory(dt),
        onExit: () => this._onExitInventory()
      },
      [GameStates.DIALOG]: {
        onEnter: () => this._onEnterDialog(),
        onUpdate: (dt) => this._onUpdateDialog(dt),
        onExit: () => this._onExitDialog()
      },
      [GameStates.DYING]: {
        onEnter: () => this._onEnterDying(),
        onUpdate: (dt) => this._onUpdateDying(dt),
        onExit: () => this._onExitDying()
      },
      [GameStates.GAME_OVER]: {
        onEnter: () => this._onEnterGameOver(),
        onUpdate: (dt) => this._onUpdateGameOver(dt),
        onExit: () => this._onExitGameOver()
      },
      [GameStates.ENDING]: {
        onEnter: () => this._onEnterEnding(),
        onUpdate: (dt) => this._onUpdateEnding(dt),
        onExit: () => this._onExitEnding()
      }
    };
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize all subsystems, bind events, set up canvas, and begin the game loop.
   * This is the entry point — call once on page load.
   */
  init() {
    console.log('[Game] Initializing Echoes of the Small...');

    // Set up canvas sizing
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Initialize subsystems
    this._initSubsystems();

    // Bind global event listeners
    this._bindGlobalEvents();

    // Bind keyboard for global shortcuts (pause, debug toggle)
    window.addEventListener('keydown', (e) => this._onKeyDown(e));

    // Enter initial state
    this.setState(GameStates.LOADING);

    console.log('[Game] Initialization complete. Starting game loop.');

    // Start the game loop
    this.isRunning = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  /**
   * Initialize all subsystems in dependency order.
   */
  _initSubsystems() {
    // Input manager (no dependencies)
    this.input = new InputManager();
    this.input.init();

    // Renderer (needs canvas + ctx)
    this.renderer = new Renderer(this.canvas, this.ctx);

    // Audio engine (self-contained)
    this.audio = new AudioEngine();
    this.audio.init();

    // Loading progress tracking
    this.assetsLoaded = 0;
    this.totalAssets = 3; // renderer, input, audio

    // Simulate asset loading progress
    const checkReady = () => {
      this.assetsLoaded = 3;
      this.loadingProgress = 1.0;
    };

    // Give subsystems a frame to initialize
    setTimeout(checkReady, 100);
  }

  /**
   * Bind global event bus listeners for game-wide effects.
   */
  _bindGlobalEvents() {
    // Hitstop events from combat system
    const unsubHitstop = window.GameEvents.on('system:hitstop', (data) => {
      this.triggerHitstop(data.duration || 0.1);
    });
    this._eventUnsubscribers.push(unsubHitstop);

    // Screen shake events
    const unsubShake = window.GameEvents.on('system:screenshake', (data) => {
      this.triggerScreenShake(data.intensity || 5, data.duration || 0.2);
    });
    this._eventUnsubscribers.push(unsubShake);

    // Player death
    const unsubDeath = window.GameEvents.on('player:death', () => {
      if (this.state === GameStates.PLAYING) {
        this.setState(GameStates.DYING);
      }
    });
    this._eventUnsubscribers.push(unsubDeath);

    // Biome change → update renderer palette + audio theme
    const unsubBiome = window.GameEvents.on('world:biomeChange', (data) => {
      if (this.renderer) {
        this.renderer.setPalette(data.toBiome);
      }
      if (this.audio) {
        this.audio.setBiome(data.toBiome);
      }
    });
    this._eventUnsubscribers.push(unsubBiome);
  }

  // ==========================================================================
  // Game Loop
  // ==========================================================================

  /**
   * Main game loop driven by requestAnimationFrame.
   * Calculates deltaTime, caps it, normalizes to target FPS,
   * and dispatches to update() and render().
   *
   * @param {number} timestamp — High-resolution timestamp from rAF
   */
  gameLoop(timestamp) {
    if (!this.isRunning) return;

    // Schedule next frame immediately
    this.rafId = requestAnimationFrame((t) => this.gameLoop(t));

    // Calculate delta time in seconds
    this.deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Cap delta time to prevent spiral of death on lag spikes
    if (this.deltaTime > this.maxDeltaTime / 1000) {
      this.deltaTime = this.maxDeltaTime / 1000;
    }

    // Update FPS counter
    this.fpsCounter++;
    this.fpsTimer += this.deltaTime;
    if (this.fpsTimer >= 1.0) {
      this.fps = this.fpsCounter;
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    // Apply time scale (hitstop / slow-mo)
    const effectiveDt = this.deltaTime * this.timeScale;

    // Update hitstop timer
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= this.deltaTime;
      if (this.hitstopTimer <= 0) {
        this.hitstopTimer = 0;
        this.timeScale = 1.0;
      }
    }

    // Update slow-motion timer
    if (this.slowMoTimer > 0) {
      this.slowMoTimer -= this.deltaTime;
      if (this.slowMoTimer <= 0) {
        this.slowMoTimer = 0;
        this.timeScale = 1.0;
      }
    }

    // Only update game state when not frozen
    if (this.hitstopTimer <= 0) {
      // Update game time
      this.gameTime += effectiveDt;
      this.frameCount++;

      // Update input polling (gamepad, touch)
      if (this.input) {
        this.input.update();
      }

      // Main update step
      this.update(effectiveDt);
    }

    // Always render (even during hitstop, just don't advance state)
    this.render();

    // Update audio (last, needs final state)
    if (this.audio) {
      this.audio.update(this.deltaTime);
    }
  }

  /**
   * Main update method. Dispatches to state-specific update hooks.
   * @param {number} dt — Delta time in seconds, normalized
   */
  update(dt) {
    const hooks = this.stateHooks[this.state];
    if (hooks && hooks.onUpdate) {
      hooks.onUpdate(dt);
    }
  }

  /**
   * Main render method. Dispatches to state-specific rendering.
   */
  render() {
    // Clear the canvas
    if (this.renderer) {
      this.renderer.clear();
    } else {
      // Fallback clear
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    // State-specific rendering
    switch (this.state) {
      case GameStates.LOADING:
        this._renderLoading();
        break;
      case GameStates.TITLE:
        this._renderTitle();
        break;
      case GameStates.PLAYING:
        this._renderPlaying();
        break;
      case GameStates.PAUSED:
        this._renderPlaying(); // Render game world behind pause overlay
        this._renderPaused();
        break;
      case GameStates.INVENTORY:
        this._renderPlaying();
        this._renderInventory();
        break;
      case GameStates.DIALOG:
        this._renderPlaying();
        this._renderDialog();
        break;
      case GameStates.DYING:
        this._renderPlaying();
        this._renderDying();
        break;
      case GameStates.GAME_OVER:
        this._renderGameOver();
        break;
      case GameStates.ENDING:
        this._renderEnding();
        break;
    }

    // Debug overlay
    if (this.debug) {
      this._renderDebug();
    }
  }

  // ==========================================================================
  // State Transitions
  // ==========================================================================

  /**
   * Transition to a new game state.
   * Calls exit hook on current state, then enter hook on new state.
   *
   * @param {string} newState — One of GameStates values
   */
  setState(newState) {
    if (!GameStates[newState]) {
      console.error(`[Game] Invalid state: ${newState}`);
      return;
    }

    const oldState = this.state;
    if (oldState === newState) return;

    console.log(`[Game] State transition: ${oldState} → ${newState}`);

    // Exit current state
    const oldHooks = this.stateHooks[oldState];
    if (oldHooks && oldHooks.onExit) {
      oldHooks.onExit();
    }

    // Store previous state (useful for returning from sub-menus)
    this.previousState = oldState;

    // Enter new state
    this.state = newState;
    window.GameEvents.emit('system:stateChange', { from: oldState, to: newState });

    const newHooks = this.stateHooks[newState];
    if (newHooks && newHooks.onEnter) {
      newHooks.onEnter();
    }
  }

  // ==========================================================================
  // State Hook Implementations — LOADING
  // ==========================================================================

  _onEnterLoading() {
    console.log('[Game] Entering LOADING state');
    this.loadingProgress = 0;
    this.assetsLoaded = 0;
  }

  _onUpdateLoading(_dt) {
    // Simulate loading progress
    if (this.loadingProgress < 1.0) {
      this.loadingProgress += 0.01;
      if (this.loadingProgress > 1.0) this.loadingProgress = 1.0;
    }

    // Auto-transition to title when loading is complete
    if (this.loadingProgress >= 1.0 && this.assetsLoaded >= this.totalAssets) {
      // Brief pause on full bar before transitioning
      setTimeout(() => {
        if (this.state === GameStates.LOADING) {
          this.setState(GameStates.TITLE);
        }
      }, 500);
    }
  }

  _onExitLoading() {
    console.log('[Game] Exiting LOADING state');
  }

  // ==========================================================================
  // State Hook Implementations — TITLE
  // ==========================================================================

  _onEnterTitle() {
    console.log('[Game] Entering TITLE state');
    if (this.audio) {
      this.audio.startMusic();
      this.audio.setIntensity(0.0);
    }
    // Start background particles for title atmosphere
    if (this.renderer) {
      for (let i = 0; i < 30; i++) {
        this.renderer.spawnParticle({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          vx: (Math.random() - 0.5) * 20,
          vy: -Math.random() * 30 - 10,
          life: 3 + Math.random() * 4,
          color: ['#7cb342', '#aed581', '#558b2f'][Math.random() * 3 | 0],
          size: 2 + Math.random() * 3,
          gravity: 0,
          fade: 0.3,
          type: 'leaf'
        });
      }
    }
  }

  _onUpdateTitle(_dt) {
    // Check for start input (attack/jump key or any button)
    if (this.input) {
      if (this.input.isJustPressed('attack') || this.input.isJustPressed('jump')) {
        this.start();
      }
    }

    // Update title particles
    if (this.renderer) {
      this.renderer.updateParticles(this.deltaTime);
    }
  }

  _onExitTitle() {
    console.log('[Game] Exiting TITLE state');
  }

  // ==========================================================================
  // State Hook Implementations — PLAYING
  // ==========================================================================

  _onEnterPlaying() {
    console.log('[Game] Entering PLAYING state');
    if (this.audio) {
      this.audio.setIntensity(0.25);
    }
  }

  /**
   * Core gameplay update — the heart of the game loop.
   * Order: Input → World → Entities → Systems → Camera → Particles
   */
  _onUpdatePlaying(dt) {
    // ----- 1. Process Input -----
    this._processInput(dt);

    // ----- 2. Update World -----
    if (this.world) {
      this.world.update(dt, this.player);
    }

    // ----- 3. Update Entities -----
    for (const entity of this.entities) {
      if (entity.active && entity.update) {
        entity.update(dt, this.player, this.world);
      }
    }

    // Remove dead/inactive entities
    this.entities = this.entities.filter(e => e.active);

    // ----- 4. Update Systems -----
    for (const system of this.systems) {
      if (system.update) {
        system.update(dt);
      }
    }

    // ----- 5. Update Camera -----
    this._updateCamera(dt);

    // ----- 6. Update Particles -----
    if (this.renderer) {
      this.renderer.updateParticles(dt);
    }
  }

  _onExitPlaying() {
    console.log('[Game] Exiting PLAYING state');
  }

  // ==========================================================================
  // State Hook Implementations — PAUSED
  // ==========================================================================

  _onEnterPaused() {
    console.log('[Game] Entering PAUSED state');
    if (this.audio) {
      this.audio.setIntensity(0.0);
    }
  }

  _onUpdatePaused(_dt) {
    // Check for unpause
    if (this.input) {
      if (this.input.isJustPressed('pause')) {
        this.setState(GameStates.PLAYING);
      }
    }
  }

  _onExitPaused() {
    console.log('[Game] Exiting PAUSED state');
    if (this.audio) {
      this.audio.setIntensity(0.25);
    }
  }

  // ==========================================================================
  // State Hook Implementations — INVENTORY
  // ==========================================================================

  _onEnterInventory() {
    console.log('[Game] Entering INVENTORY state');
  }

  _onUpdateInventory(_dt) {
    if (this.input) {
      if (this.input.isJustPressed('inventory') || this.input.isJustPressed('pause')) {
        this.setState(GameStates.PLAYING);
      }
    }
  }

  _onExitInventory() {
    console.log('[Game] Exiting INVENTORY state');
  }

  // ==========================================================================
  // State Hook Implementations — DIALOG
  // ==========================================================================

  _onEnterDialog() {
    console.log('[Game] Entering DIALOG state');
  }

  _onUpdateDialog(_dt) {
    if (this.input) {
      if (this.input.isJustPressed('interact') || this.input.isJustPressed('attack')) {
        // Advance dialog — handled by UI/dialog system
        window.GameEvents.emit('dialog:advance', {});
      }
      if (this.input.isJustPressed('pause')) {
        this.setState(GameStates.PLAYING);
      }
    }
  }

  _onExitDialog() {
    console.log('[Game] Exiting DIALOG state');
  }

  // ==========================================================================
  // State Hook Implementations — DYING
  // ==========================================================================

  _onEnterDying() {
    console.log('[Game] Entering DYING state');
    this.deathTimer = 0;
    this.deathDuration = 3.0; // 3 seconds of death animation

    // Dramatic slow-motion
    this.timeScale = 0.3;
    this.slowMoTimer = 1.0;

    // Screen shake
    this.triggerScreenShake(10, 0.5);

    // Audio cue
    if (this.audio) {
      this.audio.setIntensity(0.8);
    }
  }

  _onUpdateDying(dt) {
    this.deathTimer += dt;

    if (this.deathTimer >= this.deathDuration) {
      this.setState(GameStates.GAME_OVER);
    }
  }

  _onExitDying() {
    console.log('[Game] Exiting DYING state');
    this.timeScale = 1.0;
  }

  // ==========================================================================
  // State Hook Implementations — GAME_OVER
  // ==========================================================================

  _onEnterGameOver() {
    console.log('[Game] Entering GAME_OVER state');
    if (this.audio) {
      this.audio.setIntensity(0.5);
    }
  }

  _onUpdateGameOver(_dt) {
    if (this.input) {
      if (this.input.isJustPressed('attack') || this.input.isJustPressed('jump')) {
        // Restart from last checkpoint
        this._respawnPlayer();
        this.setState(GameStates.PLAYING);
      }
      if (this.input.isJustPressed('pause')) {
        this.setState(GameStates.TITLE);
      }
    }
  }

  _onExitGameOver() {
    console.log('[Game] Exiting GAME_OVER state');
  }

  // ==========================================================================
  // State Hook Implementations — ENDING
  // ==========================================================================

  _onEnterEnding() {
    console.log('[Game] Entering ENDING state');
    this.endingTimer = 0;
    if (this.audio) {
      this.audio.setIntensity(1.0);
    }
  }

  _onUpdateEnding(dt) {
    this.endingTimer += dt;

    // After ending sequence, return to title
    if (this.endingTimer >= 10.0) {
      this.setState(GameStates.TITLE);
    }
  }

  _onExitEnding() {
    console.log('[Game] Exiting ENDING state');
  }

  // ==========================================================================
  // Input Processing (PLAYING state)
  // ==========================================================================

  /**
   * Process player input during gameplay.
   * Maps input actions to player behaviors and game state changes.
   * @param {number} dt — Delta time
   */
  _processInput(dt) {
    if (!this.input || !this.player) return;

    // Pause
    if (this.input.isJustPressed('pause')) {
      this.setState(GameStates.PAUSED);
      return;
    }

    // Inventory
    if (this.input.isJustPressed('inventory')) {
      this.setState(GameStates.INVENTORY);
      return;
    }

    // Movement vector from input (keyboard arrows/WASD, gamepad, or touch joystick)
    const moveInput = this.input.getMovementVector();

    // Jump
    const jumpInput = this.input.isJustPressed('jump');

    // Attack
    const attackInput = this.input.isJustPressed('attack');

    // Dodge
    const dodgeInput = this.input.isJustPressed('dodge');

    // Parry
    const parryInput = this.input.isJustPressed('parry');

    // Interact
    const interactInput = this.input.isJustPressed('interact');

    // Shrink
    const shrinkInput = this.input.isJustPressed('shrink');

    // Grow
    const growInput = this.input.isJustPressed('grow');

    // ---- Pass input to player ----
    if (this.player.handleInput) {
      this.player.handleInput({
        move: moveInput,
        jump: jumpInput,
        attack: attackInput,
        dodge: dodgeInput,
        parry: parryInput,
        interact: interactInput,
        shrink: shrinkInput,
        grow: growInput,
        dt
      });
    }

    // ---- Global input actions ----
    // Debug toggle (Backtick/tilde key)
    if (this.input.keys && this.input.keys['Backquote']) {
      this.debug = !this.debug;
      this.input.keys['Backquote'] = false; // Debounce
    }
  }

  // ==========================================================================
  // Camera System
  // ==========================================================================

  /**
   * Update the camera position with smooth lerp following.
   * Applies screen shake, clamps to world bounds, and handles camera zones.
   * @param {number} dt — Delta time
   */
  _updateCamera(dt) {
    if (!this.player) return;

    const cam = this.camera;

    // Target: player position (centered)
    cam.targetX = this.player.x - this.width / 2;
    cam.targetY = this.player.y - this.height / 2;

    // Check camera zones
    for (const zone of cam.zones) {
      if (
        this.player.x >= zone.x &&
        this.player.x <= zone.x + zone.w &&
        this.player.y >= zone.y &&
        this.player.y <= zone.y + zone.h
      ) {
        if (zone.lockX) {
          cam.lockX = true;
          cam.lockXValue = zone.lockXValue !== undefined ? zone.lockXValue : cam.targetX;
        }
        if (zone.lockY) {
          cam.lockY = true;
          cam.lockYValue = zone.lockYValue !== undefined ? zone.lockYValue : cam.targetY;
        }
      }
    }

    // Apply locks
    if (cam.lockX) cam.targetX = cam.lockXValue;
    if (cam.lockY) cam.targetY = cam.lockYValue;

    // Smooth lerp toward target
    cam.x += (cam.targetX - cam.x) * cam.lerpFactor;
    cam.y += (cam.targetY - cam.y) * cam.lerpFactor;

    // Clamp to world bounds (don't show outside the world)
    const maxCamX = cam.worldWidth - this.width;
    const maxCamY = cam.worldHeight - this.height;

    if (cam.x < 0) cam.x = 0;
    if (cam.y < 0) cam.y = 0;
    if (cam.x > maxCamX) cam.x = maxCamX;
    if (cam.y > maxCamY) cam.y = maxCamY;

    // Smooth zoom lerp
    cam.zoom += (cam.targetZoom - cam.zoom) * 0.05;

    // Update screen shake
    if (cam.shakeTimer > 0) {
      cam.shakeTimer -= dt;
      const intensity = cam.shakeIntensity * (cam.shakeTimer / cam.shakeDuration);
      cam.shakeX = (Math.random() * 2 - 1) * intensity;
      cam.shakeY = (Math.random() * 2 - 1) * intensity;

      if (cam.shakeTimer <= 0) {
        cam.shakeX = 0;
        cam.shakeY = 0;
        cam.shakeTimer = 0;
        cam.shakeIntensity = 0;
      }
    } else {
      cam.shakeX = 0;
      cam.shakeY = 0;
    }
  }

  // ==========================================================================
  // Hitstop
  // ==========================================================================

  /**
   * Trigger hitstop — freeze the game for N frames on impact.
   * Creates a satisfying "weight" feeling on heavy hits.
   *
   * @param {number} duration — Freeze duration in seconds (typical: 0.05–0.2)
   */
  triggerHitstop(duration = 0.1) {
    this.hitstopTimer = duration;
    this.timeScale = 0.0;
    window.GameEvents.emit('system:hitstop', { duration });
  }

  /**
   * Trigger slow-motion for dramatic effect.
   * @param {number} factor — Time scale factor (0.1 = 10% speed)
   * @param {number} duration — Duration in seconds
   */
  triggerSlowMotion(factor = 0.3, duration = 1.0) {
    this.timeScale = factor;
    this.slowMoTimer = duration;
  }

  // ==========================================================================
  // Screen Shake
  // ==========================================================================

  /**
   * Trigger screen shake — offset the camera randomly each frame.
   * Intensity decays linearly over the duration.
   *
   * @param {number} intensity — Max pixel offset (typical: 2–15)
   * @param {number} duration — Shake duration in seconds (typical: 0.1–0.5)
   */
  triggerScreenShake(intensity = 5, duration = 0.2) {
    const cam = this.camera;
    cam.shakeIntensity = Math.max(cam.shakeIntensity, intensity);
    cam.shakeDuration = duration;
    cam.shakeTimer = duration;
    window.GameEvents.emit('system:screenshake', { intensity, duration });
  }

  // ==========================================================================
  // Gameplay Control
  // ==========================================================================

  /**
   * Start gameplay — spawn player in the overworld.
   * Called from title screen or new game.
   */
  start() {
    console.log('[Game] Starting gameplay...');

    // Create player if not exists
    if (!this.player) {
      // Will be created by the actual Player module; here we use a placeholder
      // that will be swapped when the real Player.js is loaded
      this.player = this._createPlaceholderPlayer();
    }

    // Reset camera to player
    this.camera.x = this.player.x - this.width / 2;
    this.camera.y = this.player.y - this.height / 2;

    // Transition to playing state
    this.setState(GameStates.PLAYING);

    // Emit game start event
    window.GameEvents.emit('game:start', { seed: this.worldSeed });
  }

  /**
   * Create a placeholder player entity for early engine initialization.
   * Will be replaced by the full Player class when its module loads.
   * @returns {object} Placeholder player object
   */
  _createPlaceholderPlayer() {
    const player = {
      x: 512,
      y: 512,
      width: 24,
      height: 40,
      vx: 0,
      vy: 0,
      hp: 100,
      maxHP: 100,
      active: true,
      scale: 1.0,
      facingRight: true,
      state: 'idle',
      onGround: false,

      update(dt, _input, _world) {
        // Basic physics placeholder
        this.vy += 800 * dt; // gravity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Floor collision placeholder
        if (this.y > 1000) {
          this.y = 1000;
          this.vy = 0;
          this.onGround = true;
        }
      },

      handleInput(input) {
        const speed = 150;
        this.vx = 0;
        if (input.move.x !== 0) {
          this.vx = input.move.x * speed;
          this.facingRight = input.move.x > 0;
          this.state = 'run';
        } else {
          this.state = 'idle';
        }
        if (input.jump && this.onGround) {
          this.vy = -300;
          this.onGround = false;
        }
      },

      render(renderer) {
        // Draw a simple placeholder sprite
        const ctx = renderer.ctx;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.fillStyle = '#d4a373';
        ctx.fillRect(-12, -40, 24, 40);

        // Head
        ctx.fillStyle = '#eac086';
        ctx.fillRect(-8, -52, 16, 16);

        // Weapon
        ctx.fillStyle = '#888';
        ctx.fillRect(8, -30, 12, 4);

        // Direction indicator
        ctx.fillStyle = '#fff';
        const eyeX = this.facingRight ? 4 : -4;
        ctx.fillRect(eyeX - 2, -46, 4, 3);

        ctx.restore();
      },

      takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
          this.hp = 0;
          window.GameEvents.emit('player:death', {});
        } else {
          window.GameEvents.emit('player:damage', { amount, currentHP: this.hp, maxHP: this.maxHP });
        }
      },

      getBounds() {
        return { x: this.x - this.width / 2, y: this.y - this.height, w: this.width, h: this.height };
      }
    };

    return player;
  }

  /**
   * Respawn the player after death.
   * Resets HP and positions player at last checkpoint.
   */
  _respawnPlayer() {
    if (!this.player) return;
    this.player.hp = this.player.maxHP;
    this.player.active = true;
    this.player.vx = 0;
    this.player.vy = 0;
    // TODO: Load checkpoint position from SaveSystem
    window.GameEvents.emit('system:notification', { message: 'Returned to last checkpoint', type: 'info' });
  }

  // ==========================================================================
  // Rendering Helpers
  // ==========================================================================

  /** Render loading screen with progress bar. */
  _renderLoading() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Echoes of the Small', w / 2, h / 2 - 60);

    // Subtitle
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText('Loading...', w / 2, h / 2 - 20);

    // Progress bar background
    const barW = 300;
    const barH = 20;
    const barX = w / 2 - barW / 2;
    const barY = h / 2 + 20;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX, barY, barW, barH);

    // Progress bar fill
    const fillW = barW * this.loadingProgress;
    const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gradient.addColorStop(0, '#2d5016');
    gradient.addColorStop(1, '#7cb342');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, fillW, barH);

    // Progress bar border
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Progress percentage
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${(this.loadingProgress * 100).toFixed(0)}%`, w / 2, barY + barH + 20);
  }

  /** Render title screen. */
  _renderTitle() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background with palette
    const palette = this.renderer ? this.renderer.currentPalette : { bg: '#1a2f1a' };
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    // Render particles
    if (this.renderer) {
      this.renderer.renderParticles();
    }

    // Title glow
    ctx.shadowColor = '#7cb342';
    ctx.shadowBlur = 20;

    // Main title
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.08)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Echoes of the Small', w / 2, h / 2 - 40);

    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#aed581';
    ctx.font = '20px sans-serif';
    ctx.fillText('A 2D Action-Adventure', w / 2, h / 2 + 10);

    // Prompt to start
    const blinkAlpha = Math.sin(this.gameTime * 4) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${blinkAlpha})`;
    ctx.font = '18px sans-serif';
    ctx.fillText('Press J / Space to Start', w / 2, h / 2 + 80);

    // Controls hint
    ctx.fillStyle = '#666666';
    ctx.font = '14px sans-serif';
    ctx.fillText('WASD/Arrows: Move | Space: Jump | J: Attack | K: Dodge | L: Parry', w / 2, h - 60);
    ctx.fillText('Q: Shrink | E: Interact | Esc: Pause | Tab: Inventory', w / 2, h - 40);
  }

  /** Render the main gameplay frame. */
  _renderPlaying() {
    if (!this.renderer) return;

    const ctx = this.ctx;
    const cam = this.camera;

    ctx.save();

    // Apply camera transform (with shake)
    const drawX = Math.round(-cam.x + cam.shakeX);
    const drawY = Math.round(-cam.y + cam.shakeY);
    ctx.translate(drawX, drawY);

    // Apply zoom from center
    if (cam.zoom !== 1.0) {
      const cx = cam.x + this.width / 2;
      const cy = cam.y + this.height / 2;
      ctx.translate(cx, cy);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cx, -cy);
    }

    // ---- Render World ----
    if (this.world && this.world.render) {
      this.world.render(this.renderer, cam);
    } else {
      // Fallback: render a grid pattern
      this._renderFallbackWorld(ctx, cam);
    }

    // ---- Render Entities (sorted by z/y for depth) ----
    const sortedEntities = [...this.entities, this.player].filter(e => e && e.active);
    sortedEntities.sort((a, b) => {
      const za = (a.z || 0) + (a.y || 0) * 0.001;
      const zb = (b.z || 0) + (b.y || 0) * 0.001;
      return za - zb;
    });

    for (const entity of sortedEntities) {
      if (entity.render) {
        entity.render(this.renderer);
      }
    }

    // ---- Render Particles ----
    this.renderer.renderParticles();

    // ---- Render Lighting ----
    if (this.renderer.lightingEnabled) {
      this.renderer.renderLighting(cam);
    }

    ctx.restore();

    // ---- Post-Processing Effects (screen-space) ----
    this.renderer.applyPostFX();
  }

  /** Render a fallback world grid when WorldManager isn't loaded. */
  _renderFallbackWorld(ctx, cam) {
    const tileSize = 32;
    const startX = Math.floor(cam.x / tileSize) * tileSize;
    const startY = Math.floor(cam.y / tileSize) * tileSize;
    const endX = startX + this.width + tileSize * 2;
    const endY = startY + this.height + tileSize * 2;

    for (let x = startX; x < endX; x += tileSize) {
      for (let y = startY; y < endY; y += tileSize) {
        // Checkerboard pattern
        const isDark = ((x / tileSize + y / tileSize) % 2 === 0);
        ctx.fillStyle = isDark ? '#2d5016' : '#33691e';

        // Vary by "biome" based on world position
        const worldSection = Math.floor(x / 2730); // 16384 / 6 ≈ 2730
        const palette = this.renderer ? this.renderer.currentPalette : { ground: '#2d5016' };
        ctx.fillStyle = isDark ? palette.ground : this._lightenColor(palette.ground, 20);

        ctx.fillRect(x, y, tileSize, tileSize);

        // Grid lines
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }
  }

  /** Lighten a hex color by a percentage. */
  _lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
    const b = Math.min(255, (num & 0x0000FF) + percent);
    return `rgb(${r},${g},${b})`;
  }

  /** Render pause overlay. */
  _renderPaused() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    // "PAUSED" text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.08)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', w / 2, h / 2 - 40);

    // Resume hint
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText('Press Esc to Resume', w / 2, h / 2 + 20);
  }

  /** Render inventory overlay. */
  _renderInventory() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = 'rgba(10, 10, 10, 0.85)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.06)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('INVENTORY', w / 2, 60);

    // Inventory grid placeholder
    const slotSize = 48;
    const slotsPerRow = 8;
    const gap = 8;
    const startX = w / 2 - (slotsPerRow * (slotSize + gap)) / 2;
    const startY = 100;

    for (let i = 0; i < 24; i++) {
      const row = Math.floor(i / slotsPerRow);
      const col = i % slotsPerRow;
      const x = startX + col * (slotSize + gap);
      const y = startY + row * (slotSize + gap);

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x, y, slotSize, slotSize);
      ctx.strokeStyle = '#333366';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, slotSize, slotSize);
    }

    ctx.fillStyle = '#888888';
    ctx.font = '14px sans-serif';
    ctx.fillText('Press Tab to close', w / 2, h - 40);
  }

  /** Render dialog overlay. */
  _renderDialog() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Dialog box
    const boxH = 120;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(40, h - boxH - 40, w - 80, boxH);
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, h - boxH - 40, w - 80, boxH);

    // Speaker name
    ctx.fillStyle = '#7cb342';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Speaker', 60, h - boxH - 10);

    // Dialog text
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Dialog text will appear here...', 60, h - boxH + 30);

    // Continue hint
    const blinkAlpha = Math.sin(this.gameTime * 4) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${blinkAlpha})`;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Press E/J to continue', w - 60, h - 60);
  }

  /** Render dying overlay. */
  _renderDying() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Red vignette
    const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8);
    gradient.addColorStop(0, 'rgba(139, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(139, 0, 0, ${Math.min(0.8, this.deathTimer / 2)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  /** Render game over screen. */
  _renderGameOver() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#cc3333';
    ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', w / 2, h / 2 - 40);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px sans-serif';
    ctx.fillText('Press J to Retry | Press Esc for Title', w / 2, h / 2 + 30);
  }

  /** Render ending sequence. */
  _renderEnding() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Fade from black
    const alpha = Math.max(0, 1 - this.endingTimer / 3);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, w, h);

    if (this.endingTimer > 2) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(Math.min(w, h) * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('The End', w / 2, h / 2);

      ctx.font = '18px sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Thank you for playing', w / 2, h / 2 + 40);
    }
  }

  /** Render debug overlay. */
  _renderDebug() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 220, 120);

    ctx.textAlign = 'left';
    ctx.font = '12px monospace';

    const lines = [
      `State: ${this.state}`,
      `FPS: ${this.fps}`,
      `Frame: ${this.frameCount}`,
      `Game Time: ${this.gameTime.toFixed(1)}s`,
      `Entities: ${this.entities.length}`,
      `TimeScale: ${this.timeScale.toFixed(2)}`,
      `DT: ${this.deltaTime.toFixed(4)}s`,
      `Player: ${this.player ? `${this.player.x.toFixed(0)},${this.player.y.toFixed(0)}` : 'N/A'}`
    ];

    lines.forEach((line, i) => {
      ctx.fillStyle = '#00ff00';
      ctx.fillText(line, 18, 28 + i * 14);
    });

    // Camera info
    if (this.player) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 135, 220, 50);
      const camLines = [
        `Camera: ${this.camera.x.toFixed(0)},${this.camera.y.toFixed(0)}`,
        `Shake: ${this.camera.shakeX.toFixed(1)},${this.camera.shakeY.toFixed(1)}`
      ];
      camLines.forEach((line, i) => {
        ctx.fillStyle = '#ffff00';
        ctx.fillText(line, 18, 153 + i * 14);
      });
    }

    // Draw entity bounds
    ctx.save();
    ctx.translate(-this.camera.x + this.camera.shakeX, -this.camera.y + this.camera.shakeY);
    for (const entity of this.entities) {
      if (entity.active && entity.getBounds) {
        const b = entity.getBounds();
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
    }
    // Player bounds
    if (this.player && this.player.getBounds) {
      const b = this.player.getBounds();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.restore();
  }

  // ==========================================================================
  // Keyboard Handler
  // ==========================================================================

  /**
   * Handle global keyboard shortcuts.
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    // These are handled by InputManager, this is just for global shortcuts
    // that InputManager doesn't handle
  }

  // ==========================================================================
  // Canvas Resize
  // ==========================================================================

  /**
   * Handle window resize. Maintains a 16:9 aspect ratio by letterboxing.
   * Updates canvas dimensions and all dependent subsystems.
   */
  resize() {
    const targetAspect = 16 / 9;
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const windowAspect = windowW / windowH;

    let canvasW, canvasH;

    if (windowAspect > targetAspect) {
      // Window is wider than 16:9 — pillarbox
      canvasH = windowH;
      canvasW = Math.floor(windowH * targetAspect);
    } else {
      // Window is taller than 16:9 — letterbox
      canvasW = windowW;
      canvasH = Math.floor(windowW / targetAspect);
    }

    // Set actual canvas pixel dimensions
    this.canvas.width = canvasW;
    this.canvas.height = canvasH;

    // Set CSS display size
    this.canvas.style.width = `${canvasW}px`;
    this.canvas.style.height = `${canvasH}px`;

    // Center the canvas
    this.canvas.style.display = 'block';
    this.canvas.style.margin = 'auto';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.right = '0';
    this.canvas.style.bottom = '0';

    // Update internal dimensions
    this.width = canvasW;
    this.height = canvasH;

    // Propagate resize to renderer
    if (this.renderer) {
      this.renderer.resize(canvasW, canvasH);
    }

    // Update camera world bounds based on new view
    this.camera.worldWidth = Math.max(this.camera.worldWidth, canvasW);
    this.camera.worldHeight = Math.max(this.camera.worldHeight, canvasH);
  }

  // ==========================================================================
  // Entity & System Management
  // ==========================================================================

  /**
   * Register an entity for updates and rendering.
   * @param {Entity} entity — Game entity with update() and render() methods
   */
  addEntity(entity) {
    this.entities.push(entity);
  }

  /**
   * Remove an entity from the game.
   * @param {Entity} entity — Entity to remove
   */
  removeEntity(entity) {
    const idx = this.entities.indexOf(entity);
    if (idx !== -1) {
      this.entities.splice(idx, 1);
    }
  }

  /**
   * Register a game system for updates.
   * @param {object} system — System with update(dt) method
   */
  addSystem(system) {
    this.systems.push(system);
  }

  /**
   * Remove a game system.
   * @param {object} system — System to remove
   */
  removeSystem(system) {
    const idx = this.systems.indexOf(system);
    if (idx !== -1) {
      this.systems.splice(idx, 1);
    }
  }

  // ==========================================================================
  // Camera Zone Management
  // ==========================================================================

  /**
   * Add a camera zone that constrains camera movement.
   * @param {object} zone — { x, y, w, h, lockX?, lockY?, lockXValue?, lockYValue? }
   */
  addCameraZone(zone) {
    this.camera.zones.push(zone);
  }

  /**
   * Remove all camera zones.
   */
  clearCameraZones() {
    this.camera.zones = [];
    this.camera.lockX = false;
    this.camera.lockY = false;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up all resources, event listeners, and stop the game loop.
   * Call before page unload or when restarting.
   */
  destroy() {
    console.log('[Game] Destroying...');
    this.isRunning = false;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Unsubscribe from event bus
    for (const unsub of this._eventUnsubscribers) {
      unsub();
    }
    this._eventUnsubscribers = [];

    // Destroy subsystems
    if (this.audio) this.audio.stopMusic();

    console.log('[Game] Destroyed.');
  }
}

// Make Game class available globally for index.html
window.Game = Game;
