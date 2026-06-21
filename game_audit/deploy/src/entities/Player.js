/**
 * @file Player.js
 * @description Player entity (Asha) — extends Entity base class.
 *   Handles all movement, combat (3-phase combo, dodge, parry, charge attack),
 *   scale transformation (shrink/grow), inventory, and quest tracking.
 *   All significant events are emitted via window.GameEvents.
 */

// ═══════════════════════════════════════════════════════════════════════════
// Entity Base Class
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Base Entity class for all game objects.
 * Provides position, velocity, bounds, and collision helpers.
 */
class Entity {
  /**
   * @param {number} x - Initial x position in pixels.
   * @param {number} y - Initial y position in pixels.
   */
  constructor(x, y) {
    /** @type {number} Center x position in world pixels. */
    this.x = x;
    /** @type {number} Bottom y position in world pixels (y=0 is ground). */
    this.y = y;
    /** @type {number} Horizontal velocity in pixels/sec. */
    this.vx = 0;
    /** @type {number} Vertical velocity in pixels/sec (positive = down). */
    this.vy = 0;
    /** @type {number} Width in pixels. */
    this.width = 32;
    /** @type {number} Height in pixels. */
    this.height = 32;
    /** @type {boolean} Whether this entity is active and should be updated. */
    this.active = true;
    /** @type {number} Render order / z-index. */
    this.z = 0;
  }

  /**
   * Get the axis-aligned bounding box for this entity.
   * Origin is at bottom-center: x - width/2, y - height.
   * @returns {{x: number, y: number, w: number, h: number}} Bounds object.
   */
  getBounds() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height,
      w: this.width,
      h: this.height,
    };
  }

  /**
   * Check if this entity's bounds overlap with another entity's bounds.
   * @param {Entity} other - Another entity.
   * @returns {boolean} True if bounding boxes overlap.
   */
  intersects(other) {
    const a = this.getBounds();
    const b = other.getBounds();
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  /**
   * Euclidean distance to another entity.
   * @param {Entity|{x: number, y: number}} other - Target position.
   * @returns {number} Distance in pixels.
   */
  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update the entity. Override in subclasses.
   * @param {number} _dt - Delta time in seconds.
   */
  update(_dt) { }

  /**
   * Render the entity. Override in subclasses.
   * @param {Object} _renderer - Renderer instance.
   */
  render(_renderer) { }
}

// ═══════════════════════════════════════════════════════════════════════════
// Player Class
// ═══════════════════════════════════════════════════════════════════════════

/** @typedef {'idle'|'run'|'jump'|'fall'|'attack'|'dodge'|'parry'|'hurt'|'dead'} PlayerState */

/** @typedef {Object} PlayerHitbox
 * @property {number} x - Top-left x.
 * @property {number} y - Top-left y.
 * @property {number} width - Hitbox width.
 * @property {number} height - Hitbox height.
 */

/**
 * Player entity representing the protagonist Asha.
 * Handles movement with coyote time and variable jump height,
 * 3-phase combo attacks, dodge with i-frames, parry, charged attacks,
 * scale transformation (shrink/grow), inventory, and quest tracking.
 */
class Player extends Entity {
  /**
   * @param {number} x - Starting x position.
   * @param {number} y - Starting y position.
   */
  constructor(x, y) {
    super(x, y);

    // ── Dimensions ──────────────────────────────────────────────────
    this.width = 24;       // Player is 24px wide
    this.height = 40;      // Player is 40px tall
    this.originalWidth = 24;
    this.originalHeight = 40;

    // ── Core Stats ──────────────────────────────────────────────────
    /** @type {number} Maximum hit points. */
    this.maxHP = 100;
    /** @type {number} Current hit points. */
    this.hp = 100;
    /** @type {number} Base attack damage. */
    this.baseDamage = 10;
    /** @type {number} Movement speed in pixels/sec. */
    this.speed = 150;
    /** @type {number} Jump impulse in pixels/sec. */
    this.jumpForce = 300;
    /** @type {number} Gravity acceleration in pixels/sec^2. */
    this.gravity = 800;
    /** @type {number} Maximum fall speed. */
    this.maxFallSpeed = 500;

    // ── Scale System ────────────────────────────────────────────────
    /** @type {number} Current visual scale (1.0 or 0.25). */
    this.scale = 1.0;
    /** @type {number} Target scale being transitioned to. */
    this.targetScale = 1.0;
    /** @type {number} Transition progress 0–1. */
    this.scaleTransition = 0;
    /** @type {boolean} True while a scale transition is in progress. */
    this.isScaling = false;
    /** @type {boolean} Whether the player can shrink outside of zones. */
    this.canShrinkAnywhere = false;
    /** @type {Array<{x: number, y: number}>} Visited shrink zone positions. */
    this.visitedShrinkZones = [];

    // ── Combat: Combo System ────────────────────────────────────────
    /** @type {number} Current combo hit count (0-2 for three phases). */
    this.comboCount = 0;
    /** @type {number} Time remaining to continue the combo. */
    this.comboTimer = 0;
    /** @type {number} Max seconds between combo hits. */
    this.comboWindow = 1.5;
    /** @type {boolean} Currently attacking. */
    this.isAttacking = false;
    /** @type {number} Attack phase 0=slash, 1=sweep, 2=slam. */
    this.attackPhase = 0;
    /** @type {number} Remaining attack animation time. */
    this.attackTimer = 0;
    /** @type {number} Duration of each attack phase in seconds. */
    this.attackDuration = 0.25;

    // ── Combat: Dodge ───────────────────────────────────────────────
    /** @type {boolean} Currently dodging. */
    this.isDodging = false;
    /** @type {number} Remaining dodge time. */
    this.dodgeTimer = 0;
    /** @type {number} Total dodge duration in seconds. */
    this.dodgeDuration = 0.4;
    /** @type {number} Remaining dodge cooldown. */
    this.dodgeCooldown = 0;
    /** @type {number} Dodge cooldown duration in seconds. */
    this.dodgeCooldownDuration = 0.8;
    /** @type {number} Dodge speed multiplier. */
    this.dodgeSpeedMult = 2.5;

    // ── Combat: Parry ───────────────────────────────────────────────
    /** @type {boolean} Currently in parry stance. */
    this.isParrying = false;
    /** @type {number} Remaining parry stance time. */
    this.parryTimer = 0;
    /** @type {number} Total parry stance duration. */
    this.parryDuration = 0.5;
    /** @type {number} The active parry window within the stance. */
    this.parryWindow = 0.3;
    /** @type {boolean} Whether the parry successfully blocked an attack. */
    this.parrySuccess = false;

    // ── Combat: Charged Attack ─────────────────────────────────────
    /** @type {boolean} Currently charging an attack. */
    this.isCharging = false;
    /** @type {number} Current charge time in seconds. */
    this.chargeTime = 0;
    /** @type {number} Maximum charge time in seconds. */
    this.maxChargeTime = 1.5;
    /** @type {boolean} Whether the charged attack was released this frame. */
    this.chargeReleased = false;

    // ── Combat: Invincibility ──────────────────────────────────────
    /** @type {boolean} Currently invincible (flashing). */
    this.invincible = false;
    /** @type {number} Remaining invincibility time. */
    this.invincibilityTimer = 0;
    /** @type {number} Invincibility duration after taking damage. */
    this.invincibilityDuration = 1.5;
    /** @type {number} Flash rate for invincibility visual. */
    this.invincibilityFlashRate = 0.1;

    // ── Movement ────────────────────────────────────────────────────
    /** @type {boolean} True if standing on solid ground. */
    this.onGround = false;
    /** @type {boolean} True if facing right. */
    this.facingRight = true;
    /** @type {number} Coyote time remaining after leaving ground. */
    this.coyoteTimer = 0;
    /** @type {number} Max coyote time in seconds. */
    this.coyoteTime = 0.08;
    /** @type {boolean} Jump input is being held (for variable height). */
    this.jumpHeld = false;
    /** @type {number} Minimum jump time before variable height kicks in. */
    this.jumpMinTime = 0.05;
    /** @type {number} How long the current jump has been active. */
    this.jumpTimer = 0;
    /** @type {boolean} Was on ground last frame (for coyote detection). */
    this.wasOnGround = false;
    /** @type {number} Wall cling timer for wall-climbing at small scale. */
    this.wallClingTimer = 0;
    /** @type {boolean} Currently clinging to a wall. */
    this.isWallClinging = false;

    // ── State Machine ───────────────────────────────────────────────
    /** @type {PlayerState} Current player state. */
    this.state = 'idle';
    /** @type {number} State timer for animation timing. */
    this.stateTimer = 0;
    /** @type {number} Hurt/knockback timer. */
    this.hurtTimer = 0;
    /** @type {number} Hurt duration in seconds. */
    this.hurtDuration = 0.3;
    /** @type {number} Knockback velocity x. */
    this.knockbackVx = 0;
    /** @type {number} Knockback velocity y. */
    this.knockbackVy = 0;

    // ── Animation ───────────────────────────────────────────────────
    /** @type {number} Current animation frame index. */
    this.animFrame = 0;
    /** @type {number} Animation timer. */
    this.animTimer = 0;
    /** @type {number} Frames per second for animation. */
    this.animFPS = 8;

    // ── Inventory ───────────────────────────────────────────────────
    /** @type {Array<Object>} Collected dungeon items. */
    this.items = [];
    /** @type {Array<string>} Equipped relic IDs. */
    this.relics = [];
    /** @type {Array<Object>} Discovered relic fusions. */
    this.fusedRelics = [];

    // ── Quests ──────────────────────────────────────────────────────
    /** @type {Array<Object>} Active quest objects. */
    this.activeQuests = [];
    /** @type {Array<string>} Completed quest IDs. */
    this.completedQuests = [];

    // ── Visual ──────────────────────────────────────────────────────
    /** @type {number} Damage flash timer. */
    this.damageFlashTimer = 0;
    /** @type {number} Render offset for screen shake. */
    this.renderOffsetX = 0;
    this.renderOffsetY = 0;

    // ── Event bus reference ─────────────────────────────────────────
    if (!window.GameEvents) {
      window.GameEvents = document.createElement('div');
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STAT GETTERS (scale-aware)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Get the current effective speed, accounting for scale.
   * @returns {number} Effective speed in pixels/sec.
   */
  getEffectiveSpeed() {
    let s = this.speed;
    if (this.scale <= 0.3) s *= 0.6;
    if (this.isDodging) s *= this.dodgeSpeedMult;
    return s;
  }

  /**
   * Get the current effective damage, accounting for scale and combo.
   * @returns {number} Effective damage.
   */
  getEffectiveDamage() {
    let d = this.baseDamage;
    if (this.scale <= 0.3) d *= 0.5;
    // Combo multiplier
    const comboMults = [1.0, 1.3, 1.6];
    d *= comboMults[this.attackPhase] || 1.0;
    return Math.round(d);
  }

  /**
   * Get the current hitbox dimensions accounting for scale.
   * @returns {PlayerHitbox} Scaled hitbox in world coordinates.
   */
  getHitbox() {
    const w = this.width * this.scale;
    const h = this.height * this.scale;
    return {
      x: this.x - w / 2,
      y: this.y - h,
      width: w,
      height: h,
    };
  }

  /**
   * Get the attack hitbox based on facing direction and current combo phase.
   * @returns {PlayerHitbox|null} Attack hitbox or null if not attacking.
   */
  getAttackHitbox() {
    if (!this.isAttacking && !this.isCharging && !this.chargeReleased) return null;

    const hb = this.getHitbox();
    let ax, ay, aw, ah;

    // Phase-based hitbox sizes
    const phaseWidths = [30, 48, 36];  // slash, sweep, slam
    const phaseHeights = [24, 20, 32];

    if (this.chargeReleased || this.isCharging) {
      // Charged attack: larger hitbox
      aw = 40 + (this.chargeTime / this.maxChargeTime) * 20;
      ah = 30;
    } else {
      aw = phaseWidths[this.attackPhase] || 30;
      ah = phaseHeights[this.attackPhase] || 24;
    }

    if (this.facingRight) {
      ax = hb.x + hb.width;
    } else {
      ax = hb.x - aw;
    }
    ay = hb.y + hb.height / 2 - ah / 2;

    // Slam attack hits below
    if (this.attackPhase === 2) {
      ax = hb.x + hb.width / 2 - aw / 2;
      ay = hb.y + hb.height;
      aw = 48; // wider slam
      ah = 24;
    }

    return { x: ax, y: ay, width: aw, height: ah };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MAIN UPDATE
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Main player update — processes input, physics, state machine, timers.
   * @param {number} dt - Delta time in seconds.
   * @param {Object} input - Input manager instance.
   * @param {Object} world - WorldManager instance.
   */
  update(dt, input, world) {
    if (!this.active) return;
    if (this.state === 'dead') {
      this._updateDead(dt);
      return;
    }

    this.stateTimer += dt;

    // ── Update Timers ───────────────────────────────────────────
    this._updateTimers(dt);

    // ── State Machine ───────────────────────────────────────────
    this._updateStateMachine(dt, input, world);

    // ── Handle Input ────────────────────────────────────────────
    this._handleInput(dt, input, world);

    // ── Physics ─────────────────────────────────────────────────
    this._applyPhysics(dt, world);

    // ── Scale Transition ────────────────────────────────────────
    this._updateScaleTransition(dt);

    // ── Update Animation ────────────────────────────────────────
    this._updateAnimation(dt);

    // ── Clear one-shot flags ────────────────────────────────────
    this.chargeReleased = false;
  }

  /**
   * Update all player timers (combo, dodge, parry, invincibility, etc.)
   * @param {number} dt - Delta time in seconds.
   */
  _updateTimers(dt) {
    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
      }
    }

    // Attack timer
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackTimer = 0;
      }
    }

    // Dodge timer
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.dodgeTimer = 0;
      }
    }

    // Dodge cooldown
    if (this.dodgeCooldown > 0) {
      this.dodgeCooldown -= dt;
      if (this.dodgeCooldown < 0) this.dodgeCooldown = 0;
    }

    // Parry timer
    if (this.parryTimer > 0) {
      this.parryTimer -= dt;
      if (this.parryTimer <= 0) {
        this.isParrying = false;
        this.parryTimer = 0;
      }
    }

    // Invincibility timer
    if (this.invincibilityTimer > 0) {
      this.invincibilityTimer -= dt;
      if (this.invincibilityTimer <= 0) {
        this.invincible = false;
        this.invincibilityTimer = 0;
      }
    }

    // Charge timer
    if (this.isCharging) {
      this.chargeTime += dt;
      if (this.chargeTime > this.maxChargeTime) {
        this.chargeTime = this.maxChargeTime;
      }
    }

    // Hurt timer
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer <= 0) {
        this.hurtTimer = 0;
        if (this.state === 'hurt') {
          this.state = 'idle';
        }
      }
    }

    // Damage flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      if (this.damageFlashTimer < 0) this.damageFlashTimer = 0;
    }

    // Coyote timer
    if (!this.onGround && this.wasOnGround && this.coyoteTimer > 0) {
      this.coyoteTimer -= dt;
    }

    // Jump timer (for variable height)
    if (this.jumpHeld && this.jumpTimer > 0) {
      this.jumpTimer += dt;
    }

    // Wall cling timer
    if (this.isWallClinging) {
      this.wallClingTimer -= dt;
      if (this.wallClingTimer <= 0) {
        this.isWallClinging = false;
        this.wallClingTimer = 0;
      }
    }
  }

  /**
   * Update the player state machine.
   * @param {number} dt - Delta time.
   * @param {Object} input - Input manager.
   * @param {Object} world - World manager.
   */
  _updateStateMachine(dt, input, world) {
    // Priority: dead > hurt > dodge > parry > attack > jump/fall > run > idle
    if (this.hp <= 0) {
      this.state = 'dead';
      return;
    }

    // State transitions are handled by input and physics,
    // but we ensure consistency here.
    if (this.state === 'hurt' && this.hurtTimer > 0) {
      // Apply knockback
      this.x += this.knockbackVx * dt;
      this.y += this.knockbackVy * dt;
      this.knockbackVx *= 0.9;
      this.knockbackVy *= 0.9;
      return;
    }

    if (this.state === 'dodge' && this.isDodging) return;
    if (this.state === 'parry' && this.isParrying) return;
    if (this.state === 'attack' && this.isAttacking) return;

    // Movement state determination
    const moveX = input.getMovementVector ? input.getMovementVector().x : 0;

    if (!this.onGround) {
      if (this.vy < 0) {
        this.state = 'jump';
      } else {
        this.state = 'fall';
      }
    } else if (Math.abs(moveX) > 0.1) {
      this.state = 'run';
    } else {
      this.state = 'idle';
    }
  }

  /**
   * Process player input.
   * @param {number} dt - Delta time.
   * @param {Object} input - Input manager instance.
   * @param {Object} world - World manager instance.
   */
  _handleInput(dt, input, world) {
    if (this.state === 'hurt' || this.state === 'dead') return;
    if (this.isDodging) return; // Can't act during dodge
    if (this.isScaling) return; // Can't act during scale transition

    const moveVec = input.getMovementVector ? input.getMovementVector() : { x: 0, y: 0 };

    // ── Horizontal Movement ────────────────────────────────────
    if (!this.isAttacking || this.attackPhase === 2) {
      // Allow some movement during slash/sweep, less during slam
      const moveMult = this.isAttacking ? (this.attackPhase === 2 ? 0.2 : 0.4) : 1.0;
      const targetVx = moveVec.x * this.getEffectiveSpeed() * moveMult;

      if (this.isWallClinging) {
        this.vx = 0;
        this.vy = 0; // No gravity while clinging
      } else {
        // Smooth acceleration
        const accel = this.onGround ? 800 : 500;
        if (moveVec.x !== 0) {
          this.vx += (targetVx - this.vx) * Math.min(1, accel * dt / Math.abs(targetVx - this.vx + 0.001));
          if (Math.abs(this.vx) < 0.1) this.vx = 0;
        } else {
          // Deceleration when no input
          const decel = this.onGround ? 1200 : 300;
          if (this.vx > 0) {
            this.vx = Math.max(0, this.vx - decel * dt);
          } else if (this.vx < 0) {
            this.vx = Math.min(0, this.vx + decel * dt);
          }
        }
      }

      // Update facing direction
      if (moveVec.x > 0.1) this.facingRight = true;
      else if (moveVec.x < -0.1) this.facingRight = false;
    }

    // ── Jump ───────────────────────────────────────────────────
    const jumpPressed = input.isJustPressed ? input.isJustPressed('jump') : false;
    const jumpHeld = input.isPressed ? input.isPressed('jump').pressed : false;

    if (jumpPressed) {
      const canCoyoteJump = this.coyoteTimer > 0 && !this.onGround;
      if (this.onGround || canCoyoteJump) {
        this._startJump();
      } else if (this.scale <= 0.3 && this._canWallClimb(world)) {
        // Wall jump when small
        this._wallJump();
      }
    }

    // Variable jump height: release early for a shorter jump
    if (!jumpHeld && this.jumpHeld && this.vy < 0) {
      if (this.jumpTimer > this.jumpMinTime) {
        this.vy *= 0.5; // Cut upward velocity for short hop
      }
    }
    this.jumpHeld = jumpHeld;

    // ── Attack ─────────────────────────────────────────────────
    if (input.isJustPressed && input.isJustPressed('attack')) {
      if (this.isCharging) {
        this.releaseCharge();
      } else {
        this.attack();
      }
    }

    // ── Charge Attack ──────────────────────────────────────────
    if (input.isPressed && input.isPressed('move_up').pressed && input.isPressed('attack').pressed) {
      if (!this.isCharging && !this.isAttacking && this.onGround) {
        this.startCharge();
      }
    }

    // ── Dodge ──────────────────────────────────────────────────
    if (input.isJustPressed && input.isJustPressed('dodge')) {
      const dodgeDir = moveVec.x !== 0 ? Math.sign(moveVec.x) : (this.facingRight ? 1 : -1);
      this.dodge(dodgeDir);
    }

    // ── Parry ──────────────────────────────────────────────────
    if (input.isJustPressed && input.isJustPressed('parry')) {
      this.parry();
    }

    // ── Shrink / Grow ──────────────────────────────────────────
    if (input.isJustPressed && input.isJustPressed('shrink')) {
      this.shrink(world);
    }
    if (input.isJustPressed && input.isJustPressed('grow')) {
      this.grow();
    }
  }

  /**
   * Start a jump with the full jump force.
   */
  _startJump() {
    this.vy = -this.jumpForce;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.jumpHeld = true;
    this.jumpTimer = 0;
    this.isWallClinging = false;
    this.state = 'jump';
  }

  /**
   * Check if the player can wall-climb at the current position.
   * Only works at small scale (0.25×).
   * @param {Object} world - World manager.
   * @returns {boolean} True if a wall is adjacent.
   */
  _canWallClimb(world) {
    if (this.scale > 0.3) return false;
    // Check for solid wall to the left or right
    const checkX = this.facingRight ? this.x + this.width * this.scale / 2 + 2 : this.x - this.width * this.scale / 2 - 2;
    const checkY = this.y - this.height * this.scale / 2;
    return world.isSolid(checkX, checkY) || world.isSolid(checkX, checkY - 8);
  }

  /**
   * Perform a wall jump.
   */
  _wallJump() {
    this.vy = -this.jumpForce * 0.8;
    this.vx = this.facingRight ? -150 : 150;
    this.isWallClinging = false;
    this.facingRight = !this.facingRight;
    this.state = 'jump';
  }

  /**
   * Apply physics: gravity, collision detection, ground checking.
   * @param {number} dt - Delta time.
   * @param {Object} world - World manager.
   */
  _applyPhysics(dt, world) {
    if (this.isWallClinging) return; // No physics while wall-clinging

    // Apply gravity
    if (!this.onGround) {
      this.vy += this.gravity * dt;
      if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;
    }

    // Apply velocity
    const newX = this.x + this.vx * dt;
    const newY = this.y + this.vy * dt;

    // ── Horizontal Collision ───────────────────────────────────
    const hb = this.getHitbox();
    const halfW = hb.width / 2;
    if (this.vx > 0) {
      // Check right edge
      if (world.isSolid(newX + halfW, this.y - hb.height * 0.3) ||
          world.isSolid(newX + halfW, this.y - hb.height * 0.7)) {
        this.vx = 0;
        this.x = Math.floor((newX + halfW) / world.tileSize) * world.tileSize - halfW - 0.1;
        // Try wall cling at small scale
        if (this.scale <= 0.3 && this.vy > 0) {
          this.isWallClinging = true;
          this.wallClingTimer = 2.0; // Can cling for 2 seconds
        }
      } else {
        this.x = newX;
      }
    } else if (this.vx < 0) {
      // Check left edge
      if (world.isSolid(newX - halfW, this.y - hb.height * 0.3) ||
          world.isSolid(newX - halfW, this.y - hb.height * 0.7)) {
        this.vx = 0;
        this.x = Math.floor((newX - halfW) / world.tileSize) * world.tileSize + world.tileSize + halfW + 0.1;
        if (this.scale <= 0.3 && this.vy > 0) {
          this.isWallClinging = true;
          this.wallClingTimer = 2.0;
        }
      } else {
        this.x = newX;
      }
    } else {
      this.x = newX;
    }

    // ── Vertical Collision ─────────────────────────────────────
    const hbAfterX = this.getHitbox();
    if (this.vy > 0) {
      // Falling — check below
      const footY = newY;
      const leftX = this.x - halfW + 2;
      const rightX = this.x + halfW - 2;
      const onSolid = world.isSolid(leftX, footY) || world.isSolid(rightX, footY);
      const onPlatform = world.isPlatform(leftX, footY) || world.isPlatform(rightX, footY);

      if (onSolid || (onPlatform && !this._wasOnPlatform)) {
        this.vy = 0;
        this.y = Math.floor(footY / world.tileSize) * world.tileSize;
        if (!this.onGround) {
          // Just landed
          this._onLand();
        }
        this.onGround = true;
        this._wasOnPlatform = onPlatform;
      } else {
        this.y = newY;
        this.onGround = false;
        this._wasOnPlatform = false;
      }
    } else if (this.vy < 0) {
      // Rising — check above
      const headY = newY - hbAfterX.height;
      if (world.isSolid(this.x - halfW + 2, headY) ||
          world.isSolid(this.x + halfW - 2, headY)) {
        this.vy = 0;
        this.y = Math.floor(headY / world.tileSize) * world.tileSize + world.tileSize + hbAfterX.height;
      } else {
        this.y = newY;
        this.onGround = false;
      }
    } else {
      // No vertical movement — still check if we're on ground
      const footY = newY;
      const leftX = this.x - halfW + 2;
      const rightX = this.x + halfW - 2;
      const onSolid = world.isSolid(leftX, footY) || world.isSolid(rightX, footY);
      const onPlatform = world.isPlatform(leftX, footY) || world.isPlatform(rightX, footY);

      if (onSolid || onPlatform) {
        if (!this.onGround) this._onLand();
        this.onGround = true;
        this._wasOnPlatform = onPlatform;
      } else {
        this.onGround = false;
        this._wasOnPlatform = false;
      }
      this.y = newY;
    }

    // ── Coyote Time ────────────────────────────────────────────
    if (this.onGround && !this.wasOnGround) {
      this._onLand();
    }
    if (!this.onGround && this.wasOnGround && this.coyoteTimer <= 0) {
      // Just left ground, start coyote timer
      this.coyoteTimer = this.coyoteTime;
    }
    this.wasOnGround = this.onGround;

    // ── Fit through small gaps at small scale ──────────────────
    if (this.scale <= 0.3 && this.onGround) {
      // Check if there's a gap above us we can auto-crouch through
      const gapCheckY = this.y - hb.height - this.tileSize;
      if (!world.isSolid(this.x - halfW, gapCheckY) && !world.isSolid(this.x + halfW, gapCheckY)) {
        // Can fit, no adjustment needed
      }
    }
  }

  /**
   * Called when the player lands on ground.
   */
  _onLand() {
    this.coyoteTimer = 0;
    this.jumpTimer = 0;
    this.isWallClinging = false;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // COMBAT METHODS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Execute an attack. Advances through the 3-phase combo if within the combo window.
   * Phase 0: Slash (×1.0) — Phase 1: Sweep (×1.3, wider) — Phase 2: Slam (×1.6, knockdown)
   */
  attack() {
    if (this.isDodging || this.isParrying) return;

    // If already attacking, queue next phase if in window
    if (this.isAttacking) {
      return;
    }

    this.isAttacking = true;
    this.state = 'attack';

    // Determine phase
    if (this.comboTimer > 0 && this.comboCount < 2) {
      this.comboCount++;
    } else {
      this.comboCount = 0;
    }
    this.attackPhase = this.comboCount;
    this.comboTimer = this.comboWindow;
    this.attackTimer = this.attackDuration;

    // Emit combo event
    window.GameEvents.dispatchEvent(new CustomEvent('combat:combo', {
      detail: { count: this.comboCount + 1, multiplier: [1.0, 1.3, 1.6][this.comboCount] },
    }));

    // Emit hitstop for attack feel
    window.GameEvents.dispatchEvent(new CustomEvent('system:hitstop', {
      detail: { duration: 0.02 },
    }));
  }

  /**
   * Begin charging a heavy attack.
   * Hold for up to 1.5 seconds; damage scales from 1.0× to 2.0×.
   */
  startCharge() {
    if (this.isAttacking || this.isDodging || this.isParrying) return;
    if (!this.onGround) return;

    this.isCharging = true;
    this.chargeTime = 0;
    this.state = 'idle'; // Hold position while charging
  }

  /**
   * Release a charged attack.
   * Damage scales linearly with charge time up to 2.0× at full charge.
   */
  releaseCharge() {
    if (!this.isCharging) return;

    const chargeRatio = Math.min(this.chargeTime / this.maxChargeTime, 1.0);
    const damageMult = 1.0 + chargeRatio * 1.0; // 1.0× to 2.0×

    this.isCharging = false;
    this.chargeReleased = true;
    this.chargeTime = 0;

    // Execute a powered attack
    this.isAttacking = true;
    this.attackPhase = 0;
    this.attackTimer = this.attackDuration * 1.3;

    window.GameEvents.dispatchEvent(new CustomEvent('combat:hit', {
      detail: {
        attacker: this,
        damage: this.baseDamage * damageMult,
        isCharged: true,
        chargeRatio,
      },
    }));

    // Stronger hitstop for charged attacks
    window.GameEvents.dispatchEvent(new CustomEvent('system:hitstop', {
      detail: { duration: 0.05 + chargeRatio * 0.1 },
    }));

    window.GameEvents.dispatchEvent(new CustomEvent('system:screenshake', {
      detail: { intensity: 3 + chargeRatio * 5, duration: 0.2 + chargeRatio * 0.2 },
    }));
  }

  /**
   * Dodge roll in the given direction.
   * 0.4s duration at 2.5× speed with full invincibility, 0.8s cooldown.
   * @param {number} direction - 1 for right, -1 for left.
   */
  dodge(direction) {
    if (this.isDodging || this.dodgeCooldown > 0) return;
    if (this.isParrying) return;

    this.isDodging = true;
    this.dodgeTimer = this.dodgeDuration;
    this.dodgeCooldown = this.dodgeCooldownDuration;
    this.invincible = true;
    this.invincibilityTimer = this.dodgeDuration; // i-frames for full dodge
    this.state = 'dodge';

    // Set dodge velocity
    this.vx = direction * this.speed * this.dodgeSpeedMult;
    this.facingRight = direction > 0;

    window.GameEvents.dispatchEvent(new CustomEvent('combat:dodge', {
      detail: { entity: this, direction },
    }));
  }

  /**
   * Enter parry stance for 0.5s.
   * The first 0.3s is the active parry window.
   * A successful parry stuns the attacker and allows a free counter-attack.
   */
  parry() {
    if (this.isDodging || this.isAttacking) return;

    this.isParrying = true;
    this.parryTimer = this.parryDuration;
    this.parrySuccess = false;
    this.state = 'parry';
  }

  /**
   * Check if the parry is currently in its active window.
   * @returns {boolean} True if parry can block an attack.
   */
  isInParryWindow() {
    return this.isParrying &&
           this.parryTimer > (this.parryDuration - this.parryWindow) &&
           !this.parrySuccess;
  }

  /**
   * Called when parry successfully blocks an attack.
   * @param {Entity} attacker - The attacker that was parried.
   */
  onParrySuccess(attacker) {
    this.parrySuccess = true;
    this.isParrying = false;
    this.parryTimer = 0;

    // Brief invincibility after successful parry
    this.invincible = true;
    this.invincibilityTimer = 0.3;

    window.GameEvents.dispatchEvent(new CustomEvent('combat:parry', {
      detail: { attacker, defender: this, position: { x: this.x, y: this.y } },
    }));

    window.GameEvents.dispatchEvent(new CustomEvent('system:hitstop', {
      detail: { duration: 0.15 },
    }));

    window.GameEvents.dispatchEvent(new CustomEvent('system:screenshake', {
      detail: { intensity: 4, duration: 0.25 },
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SCALE METHODS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Shrink to 0.25× scale (small form).
   * Checks if shrinking is allowed (in zone or has Whispering Seed).
   * @param {Object} world - World manager to check shrink zones.
   */
  shrink(world) {
    if (this.scale <= 0.3) return; // Already small
    if (this.isScaling) return;

    // Check permission
    const inZone = world && world.isInShrinkZone(this.x, this.y);
    if (!inZone && !this.canShrinkAnywhere) {
      window.GameEvents.dispatchEvent(new CustomEvent('system:notification', {
        detail: { message: 'Find a Shrink Zone or the Whispering Seed to shrink here.', type: 'warning' },
      }));
      return;
    }

    this.targetScale = 0.25;
    this.isScaling = true;
    this.scaleTransition = 0;

    window.GameEvents.dispatchEvent(new CustomEvent('player:scaleChange', {
      detail: { fromScale: this.scale, toScale: 0.25, duration: 0.8 },
    }));
  }

  /**
   * Grow back to 1.0× scale (normal form).
   */
  grow() {
    if (this.scale >= 0.9) return; // Already normal
    if (this.isScaling) return;

    this.targetScale = 1.0;
    this.isScaling = true;
    this.scaleTransition = 0;

    window.GameEvents.dispatchEvent(new CustomEvent('player:scaleChange', {
      detail: { fromScale: this.scale, toScale: 1.0, duration: 0.8 },
    }));
  }

  /**
   * Toggle between small and normal scale.
   * @param {Object} world - World manager.
   */
  toggleScale(world) {
    if (this.scale >= 0.9) {
      this.shrink(world);
    } else {
      this.grow();
    }
  }

  /**
   * Update the scale transition animation.
   * Uses a smooth 0.8s transition.
   * @param {number} dt - Delta time.
   */
  _updateScaleTransition(dt) {
    if (!this.isScaling) return;

    this.scaleTransition += dt / 0.8; // 0.8s transition
    if (this.scaleTransition >= 1) {
      this.scaleTransition = 1;
      this.scale = this.targetScale;
      this.isScaling = false;
      this.width = this.originalWidth * this.scale;
      this.height = this.originalHeight * this.scale;
      return;
    }

    // Smooth ease-in-out interpolation
    const t = this.scaleTransition;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const fromScale = this.targetScale === 0.25 ? 1.0 : 0.25;
    this.scale = fromScale + (this.targetScale - fromScale) * eased;
    this.width = this.originalWidth * this.scale;
    this.height = this.originalHeight * this.scale;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // DAMAGE / HEALING
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Apply damage to the player with invincibility frames.
   * Triggers hitstop, screen shake, knockback, and damage flash.
   * @param {number} amount - Damage amount.
   * @param {Entity|null} source - The attacker (for knockback direction).
   */
  takeDamage(amount, source) {
    if (this.invincible || this.isDodging || this.hp <= 0) return;

    // Check parry
    if (this.isInParryWindow() && source) {
      this.onParrySuccess(source);
      return;
    }

    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;

    this.invincible = true;
    this.invincibilityTimer = this.invincibilityDuration;
    this.damageFlashTimer = 0.2;
    this.state = 'hurt';
    this.hurtTimer = this.hurtDuration;

    // Knockback
    if (source) {
      const dx = this.x - source.x;
      const dy = this.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.knockbackVx = (dx / dist) * 200;
      this.knockbackVy = -150;
    }

    window.GameEvents.dispatchEvent(new CustomEvent('player:damage', {
      detail: { amount, currentHP: this.hp, maxHP: this.maxHP },
    }));

    window.GameEvents.dispatchEvent(new CustomEvent('system:hitstop', {
      detail: { duration: 0.1 },
    }));

    window.GameEvents.dispatchEvent(new CustomEvent('system:screenshake', {
      detail: { intensity: 5, duration: 0.2 },
    }));

    if (this.hp <= 0) {
      this.state = 'dead';
      window.GameEvents.dispatchEvent(new CustomEvent('player:death', {
        detail: {},
      }));
    }
  }

  /**
   * Heal the player by a given amount.
   * @param {number} amount - HP to restore.
   */
  heal(amount) {
    const oldHP = this.hp;
    this.hp = Math.min(this.hp + amount, this.maxHP);
    const healed = this.hp - oldHP;

    if (healed > 0) {
      window.GameEvents.dispatchEvent(new CustomEvent('system:notification', {
        detail: { message: `+${healed} HP`, type: 'success' },
      }));
    }
  }

  /**
   * Update logic while in the dead state.
   * @param {number} dt - Delta time.
   */
  _updateDead(dt) {
    this.vx *= 0.95;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.animTimer += dt;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // INVENTORY
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Add an item to the inventory.
   * @param {Object} item - Item object with id, name, etc.
   */
  addItem(item) {
    if (!item || !item.id) return;
    this.items.push(item);

    // Check for Whispering Seed — unlocks shrink anywhere
    if (item.id === 'whispering_seed') {
      this.canShrinkAnywhere = true;
    }

    window.GameEvents.dispatchEvent(new CustomEvent('player:itemPickup', {
      detail: { itemId: item.id, itemName: item.name || item.id },
    }));
  }

  /**
   * Check if the player has a specific item.
   * @param {string} itemId - Item ID to check.
   * @returns {boolean} True if the item is in inventory.
   */
  hasItem(itemId) {
    return this.items.some(i => i.id === itemId);
  }

  /**
   * Add a relic to the equipped relics list.
   * @param {string} relicId - Relic identifier.
   */
  addRelic(relicId) {
    if (!this.relics.includes(relicId)) {
      this.relics.push(relicId);
    }
  }

  /**
   * Remove a relic from the equipped list.
   * @param {string} relicId - Relic identifier.
   */
  removeRelic(relicId) {
    this.relics = this.relics.filter(r => r !== relicId);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // QUESTS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Start a quest by adding it to active quests.
   * @param {Object} quest - Quest object with id, name, objectives, etc.
   */
  startQuest(quest) {
    if (!quest || !quest.id) return;
    if (this.activeQuests.some(q => q.id === quest.id)) return;
    if (this.completedQuests.includes(quest.id)) return;

    const questInstance = {
      ...quest,
      progress: 0,
      startedAt: Date.now(),
    };
    this.activeQuests.push(questInstance);

    window.GameEvents.dispatchEvent(new CustomEvent('quest:start', {
      detail: { questId: quest.id },
    }));
  }

  /**
   * Update quest progress.
   * @param {string} questId - Quest ID.
   * @param {number} progress - New progress value.
   */
  updateQuestProgress(questId, progress) {
    const quest = this.activeQuests.find(q => q.id === questId);
    if (!quest) return;
    quest.progress = progress;

    window.GameEvents.dispatchEvent(new CustomEvent('quest:update', {
      detail: { questId, objective: quest.objective, progress },
    }));

    if (quest.target !== undefined && progress >= quest.target) {
      this.completeQuest(questId);
    }
  }

  /**
   * Complete a quest, granting rewards.
   * @param {string} questId - Quest ID to complete.
   */
  completeQuest(questId) {
    const questIndex = this.activeQuests.findIndex(q => q.id === questId);
    if (questIndex === -1) return;
    const quest = this.activeQuests[questIndex];
    this.activeQuests.splice(questIndex, 1);
    this.completedQuests.push(questId);

    // Grant rewards
    if (quest.reward) {
      // Reward handling depends on reward type
      if (quest.reward === 'hp_upgrade') this.maxHP += 10;
      else if (quest.reward === 'speed_upgrade') this.speed += 15;
      else if (quest.reward === 'jump_upgrade') this.jumpForce += 30;
      else if (quest.reward === 'damage_upgrade') this.baseDamage += 2;
      else if (quest.reward === 'parry_upgrade') this.parryWindow += 0.1;
      else if (quest.reward.startsWith('relic_')) this.addRelic(quest.reward);
    }

    window.GameEvents.dispatchEvent(new CustomEvent('quest:complete', {
      detail: { questId, rewards: quest.reward ? [quest.reward] : [] },
    }));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ANIMATION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Update animation frame timing.
   * @param {number} dt - Delta time.
   */
  _updateAnimation(dt) {
    this.animTimer += dt;
    const frameDuration = 1 / this.animFPS;
    if (this.animTimer >= frameDuration) {
      this.animTimer -= frameDuration;
      this.animFrame++;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RENDERING
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Render the player sprite.
   * Draws a simple humanoid shape with weapon, using the current animation state.
   * @param {Object} renderer - Renderer instance with ctx.
   */
  render(renderer) {
    if (!this.active) return;
    const ctx = renderer.ctx;

    // Skip rendering during invincibility flash
    if (this.invincible && Math.floor(this.invincibilityTimer / this.invincibilityFlashRate) % 2 === 0) {
      return;
    }

    const hb = this.getHitbox();
    const px = hb.x;
    const py = hb.y;
    const pw = hb.width;
    const ph = hb.height;

    // Body color based on state
    let bodyColor = '#c0843d'; // Default skin
    let tunicColor = '#2d6a9f'; // Blue tunic
    let hairColor = '#3e2723'; // Dark brown hair
    let pantsColor = '#4e342e'; // Brown pants

    if (this.state === 'hurt' || this.damageFlashTimer > 0) {
      bodyColor = '#ff4444';
      tunicColor = '#ff4444';
    } else if (this.isParrying) {
      tunicColor = '#ffd700'; // Gold glow while parrying
    } else if (this.isCharging) {
      const pulse = 0.5 + (this.chargeTime / this.maxChargeTime) * 0.5;
      tunicColor = `rgb(${45 + 200 * pulse | 0}, ${106 + 100 * pulse | 0}, ${159 + 50 * pulse | 0})`;
    }

    ctx.save();

    // Dodge roll rotation
    if (this.isDodging) {
      const rollAngle = (this.dodgeDuration - this.dodgeTimer) * Math.PI * 4 * (this.facingRight ? 1 : -1);
      ctx.translate(this.x, this.y - ph / 2);
      ctx.rotate(rollAngle);
      ctx.translate(-this.x, -(this.y - ph / 2));
    }

    // ── Draw Body ──────────────────────────────────────────────
    // Head
    const headSize = pw * 0.45;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(this.x, py + headSize * 0.8, headSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = hairColor;
    ctx.beginPath();
    ctx.arc(this.x, py + headSize * 0.6, headSize / 2 + 1, Math.PI, Math.PI * 2);
    ctx.fill();

    // Tunic (body)
    ctx.fillStyle = tunicColor;
    const bodyTop = py + headSize;
    const bodyH = ph * 0.35;
    ctx.fillRect(this.x - pw * 0.35, bodyTop, pw * 0.7, bodyH);

    // Pants
    ctx.fillStyle = pantsColor;
    ctx.fillRect(this.x - pw * 0.3, bodyTop + bodyH, pw * 0.6, ph - headSize - bodyH - 2);

    // Legs (animated for running)
    if (this.state === 'run' || this.state === 'dodge') {
      const legOffset = Math.sin(this.animFrame * 0.8) * 4;
      ctx.fillStyle = pantsColor;
      ctx.fillRect(this.x - pw * 0.25, this.y - 10, pw * 0.2, 10 + legOffset);
      ctx.fillRect(this.x + pw * 0.05, this.y - 10, pw * 0.2, 10 - legOffset);
    } else {
      ctx.fillStyle = pantsColor;
      ctx.fillRect(this.x - pw * 0.25, this.y - 10, pw * 0.2, 10);
      ctx.fillRect(this.x + pw * 0.05, this.y - 10, pw * 0.2, 10);
    }

    // ── Draw Arms / Weapon ─────────────────────────────────────
    if (this.isAttacking) {
      // Weapon swing animation
      const swingProgress = 1 - (this.attackTimer / this.attackDuration);
      const swingAngle = this.facingRight
        ? -Math.PI / 4 + swingProgress * Math.PI * 1.2
        : -Math.PI * 0.75 - swingProgress * Math.PI * 1.2;

      // Arm
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x, bodyTop + 4);
      const handX = this.x + Math.cos(swingAngle) * 16;
      const handY = bodyTop + 4 + Math.sin(swingAngle) * 16;
      ctx.lineTo(handX, handY);
      ctx.stroke();

      // Sword
      ctx.strokeStyle = '#b0b0b0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(handX + Math.cos(swingAngle + 0.3) * 18, handY + Math.sin(swingAngle + 0.3) * 18);
      ctx.stroke();

      // Attack hitbox debug (optional - can be removed in production)
      // const ahb = this.getAttackHitbox();
      // if (ahb) {
      //   ctx.strokeStyle = 'rgba(255,0,0,0.3)';
      //   ctx.strokeRect(ahb.x, ahb.y, ahb.width, ahb.height);
      // }
    } else if (this.isCharging) {
      // Arms raised with glowing weapon
      const chargeGlow = this.chargeTime / this.maxChargeTime;
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x, bodyTop + 4);
      const raisedX = this.facingRight ? this.x + 10 : this.x - 10;
      ctx.lineTo(raisedX, bodyTop - 8);
      ctx.stroke();

      // Glowing sword above head
      ctx.strokeStyle = `rgb(${176 + 79 * chargeGlow | 0}, ${176 + 79 * chargeGlow | 0}, ${176 + 79 * chargeGlow | 0})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(raisedX - 5, bodyTop - 8);
      ctx.lineTo(raisedX + 12, bodyTop - 8);
      ctx.stroke();

      // Charge particles
      for (let i = 0; i < 3; i++) {
        const angle = Date.now() * 0.005 + i * Math.PI * 2 / 3;
        const r = 10 + chargeGlow * 8;
        ctx.fillStyle = `rgba(200, 200, 255, ${0.5 + chargeGlow * 0.5})`;
        ctx.fillRect(raisedX + Math.cos(angle) * r - 1, bodyTop - 8 + Math.sin(angle) * r - 1, 2, 2);
      }
    } else {
      // Idle arm
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x, bodyTop + 4);
      ctx.lineTo(this.facingRight ? this.x + 8 : this.x - 8, bodyTop + 12);
      ctx.stroke();
    }

    // ── Parry Shield Visual ────────────────────────────────────
    if (this.isParrying) {
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.6 + Math.sin(Date.now() * 0.01) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y - ph / 2, ph * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Scale Indicator ────────────────────────────────────────
    if (this.scale < 0.9) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SMALL', this.x, py - 4);
    }

    ctx.restore();
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SERIALIZATION
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Serialize player state for saving.
   * @returns {Object} Player save data.
   */
  serialize() {
    return {
      x: this.x,
      y: this.y,
      hp: this.hp,
      maxHP: this.maxHP,
      scale: this.scale,
      items: this.items,
      relics: this.relics,
      fusedRelics: this.fusedRelics,
      activeQuests: this.activeQuests,
      completedQuests: this.completedQuests,
      canShrinkAnywhere: this.canShrinkAnywhere,
    };
  }

  /**
   * Deserialize player state from save data.
   * @param {Object} data - Save data.
   */
  deserialize(data) {
    if (!data) return;
    this.x = data.x ?? this.x;
    this.y = data.y ?? this.y;
    this.hp = data.hp ?? this.hp;
    this.maxHP = data.maxHP ?? this.maxHP;
    this.scale = data.scale ?? this.scale;
    this.items = data.items ?? this.items;
    this.relics = data.relics ?? this.relics;
    this.fusedRelics = data.fusedRelics ?? this.fusedRelics;
    this.activeQuests = data.activeQuests ?? this.activeQuests;
    this.completedQuests = data.completedQuests ?? this.completedQuests;
    this.canShrinkAnywhere = data.canShrinkAnywhere ?? this.canShrinkAnywhere;
    this.width = this.originalWidth * this.scale;
    this.height = this.originalHeight * this.scale;
  }
}

window.Entity = Entity;
window.Player = Player;
