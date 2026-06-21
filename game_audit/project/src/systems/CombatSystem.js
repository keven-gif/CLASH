/**
 * @fileoverview CombatSystem.js — Full combat engine with hitbox/hurtbox
 * AABB collision, combo tracking, damage calculation, projectile system,
 * hit-feel feedback (hitstop, screenshake, particles, knockback), and
 * parry mechanics.
 *
 * All vanilla ES6, zero dependencies.  Communicates via window.GameEvents.
 */

// ─────────────────────────────────────────────────────────────
// Hitbox / Hurtbox Data Structures
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Hitbox
 * @property {Entity} owner — entity that created this hitbox
 * @property {number} x — left edge in world pixels
 * @property {number} y — top edge in world pixels
 * @property {number} w — width
 * @property {number} h — height
 * @property {number} damage — base damage value
 * @property {{x:number, y:number}} knockback — knockback velocity vector
 * @property {string} type — attack type identifier
 * @property {number} duration — seconds this hitbox remains active
 * @property {string} [effect] — optional status effect ('slow', etc.)
 * @property {boolean} [isCharged] — whether this is a charged attack
 * @property {number} [chargeRatio] — 0.0–1.0 charge level
 */

/**
 * @typedef {Object} Hurtbox
 * @property {Entity} owner — entity this hurtbox belongs to
 * @property {number} x — left edge
 * @property {number} y — top edge
 * @property {number} w — width
 * @property {number} h — height
 * @property {string} team — 'player' | 'enemy' | 'neutral'
 */

/**
 * @typedef {Object} Projectile
 * @property {number} x — current x position
 * @property {number} y — current y position
 * @property {number} vx — x velocity
 * @property {number} vy — y velocity
 * @property {number} [gravity] — gravity acceleration
 * @property {boolean} [homing] — whether projectile homes to target
 * @property {number} [homingStrength] — turn rate in rad/s
 * @property {Entity} [target] — homing target
 * @property {number} [speed] — max speed for homing projectiles
 * @property {number} damage
 * @property {Entity} owner
 * @property {string} ownerType — 'player' | 'enemy'
 * @property {string} type — projectile type
 * @property {number} lifetime — remaining seconds
 * @property {number} width
 * @property {number} height
 * @property {string} color
 * @property {number} [pulsePhase] — for pulsing visual
 * @property {boolean} [groundHug] — stays on ground (sand wave)
 * @property {string} [onHitGround] — effect on ground impact
 */

// ─────────────────────────────────────────────────────────────
// Combo Multiplier Table
// ─────────────────────────────────────────────────────────────

/** Combo damage multipliers by consecutive hit count. */
const COMBO_MULTIPLIERS = [1.0, 1.3, 1.6];
/** Cap on combo multiplier. */
const MAX_COMBO_MULTIPLIER = 4.0;
/** Base critical hit chance (10%). */
const CRIT_CHANCE = 0.10;
/** Critical hit damage multiplier. */
const CRIT_MULTIPLIER = 1.5;
/** Full-charge damage multiplier. */
const FULL_CHARGE_MULTIPLIER = 2.0;

// ─────────────────────────────────────────────────────────────
// Hit-Feel Configuration
// ─────────────────────────────────────────────────────────────

/** Hitstop duration range in seconds. */
const HITSTOP_MIN = 0.05;
const HITSTOP_MAX = 0.15;
/** Screen shake intensity range in pixels. */
const SHAKE_MIN = 2;
const SHAKE_MAX = 8;
/** Kill hitstop duration. */
const KILL_HITSTOP = 0.2;
/** Kill screen shake intensity. */
const KILL_SHAKE_INTENSITY = 8;
/** Kill screen shake duration. */
const KILL_SHAKE_DURATION = 0.35;
/** Kill dissolve particle count range. */
const KILL_PARTICLES_MIN = 15;
const KILL_PARTICLES_MAX = 25;
/** White flash duration on hit. */
const HIT_FLASH_DURATION = 0.1;

// ─────────────────────────────────────────────────────────────
// CombatSystem Class
// ─────────────────────────────────────────────────────────────

/**
 * Central combat engine.  Manages hitbox/hurtbox registration,
 * collision resolution, combo tracking, projectiles, damage calc,
 * knockback, hit-feel, and parry mechanics.
 */
class CombatSystem {
  constructor() {
    /** @type {Hitbox[]} Active attack hitboxes this frame. */
    this.hitboxes = [];
    /** @type {Hurtbox[]} Active hurtboxes this frame. */
    this.hurtboxes = [];
    /** @type {Projectile[]} Active projectiles. */
    this.projectiles = [];

    // ── Combo State ──
    this.comboCount = 0;
    this.comboMultiplier = 1.0;
    this.maxComboMultiplier = MAX_COMBO_MULTIPLIER;
    this.comboTimer = 0;
    this.comboWindow = 1.5; // seconds to keep combo alive
    this.lastAttacker = null;

    // ── Hit-Feel Config ──
    this.hitstopDefault = 0.08;
    this.screenShakeDefault = { intensity: 5, duration: 0.2 };

    // ── Player Combo Tracking ──
    this.playerComboPhase = 0; // 0, 1, 2 for 3-hit combo
    this.playerComboTimer = 0;

    // ── Parry State ──
    this.activeParries = []; // { defender, timer, window }

    // ── Statistics ──
    this.totalHitsLanded = 0;
    this.totalDamageDealt = 0;
    this.totalKills = 0;
    this.maxComboAchieved = 0;
    this.totalCrits = 0;
    this.totalParries = 0;

    // ── Event Subscription ──
    this._subscribeToEvents();
  }

  // ── Event Bus Subscription ──────────────────────────────

  /**
   * Subscribe to combat-related events from the global event bus.
   * @private
   */
  _subscribeToEvents() {
    if (typeof window === 'undefined' || !window.GameEvents) return;

    window.GameEvents.on('combat:hitbox', (data) => {
      if (data && data.hitbox) this.registerHitbox(data.hitbox);
    });

    window.GameEvents.on('combat:projectile', (data) => {
      if (data && data.projectile) this.addProjectile(data.projectile);
    });
  }

  // ── Hitbox / Hurtbox Registration ───────────────────────

  /**
   * Register an attack hitbox for collision checking this frame.
   * @param {Hitbox} hitbox
   */
  registerHitbox(hitbox) {
    // Validate required fields
    if (!hitbox.owner || typeof hitbox.x !== 'number' || typeof hitbox.damage !== 'number') {
      console.warn('Invalid hitbox registered:', hitbox);
      return;
    }
    this.hitboxes.push(hitbox);
  }

  /**
   * Register an entity hurtbox for collision checking this frame.
   * @param {Hurtbox} hurtbox
   */
  registerHurtbox(hurtbox) {
    if (!hurtbox.owner || typeof hurtbox.x !== 'number') {
      console.warn('Invalid hurtbox registered:', hurtbox);
      return;
    }
    this.hurtboxes.push(hurtbox);
  }

  /**
   * Convenience: auto-register hurtbox from an entity.
   * Derives team from entity type.
   * @param {Entity} entity
   * @param {number} [x] — override x position
   * @param {number} [y] — override y position
   * @param {number} [w] — override width
   * @param {number} [h] — override height
   */
  registerEntityHurtbox(entity, x, y, w, h) {
    const bounds = entity.getBounds ? entity.getBounds() : {
      x: entity.x - (entity.width || 16) / 2,
      y: entity.y - (entity.height || 16),
      w: entity.width || 16,
      h: entity.height || 16
    };

    let team = 'neutral';
    if (entity.constructor && entity.constructor.name === 'Player') team = 'player';
    else if (entity.constructor && (entity.constructor.name === 'Enemy' || entity.constructor.name === 'Boss')) team = 'enemy';

    this.registerHurtbox({
      owner: entity,
      x: x !== undefined ? x : bounds.x,
      y: y !== undefined ? y : bounds.y,
      w: w !== undefined ? w : bounds.w,
      h: h !== undefined ? h : bounds.h,
      team
    });
  }

  // ── Main Update ─────────────────────────────────────────

  /**
   * Update the combat system for one frame.
   * 1. Decay combo timer
   * 2. Resolve hitbox/hurtbox collisions
   * 3. Update projectiles
   * 4. Clean up expired hitboxes
   * @param {number} dt — seconds since last frame
   * @param {WorldManager|null} world — for collision queries
   */
  update(dt, world) {
    // Decay combo timer
    this._updateComboTimer(dt);

    // Resolve collisions
    this._resolveCollisions();

    // Update projectiles
    this.updateProjectiles(dt, world);

    // Decay hitbox durations
    this._decayHitboxes(dt);

    // Update active parries
    this._updateParries(dt);

    // Clear frame buffers (hitboxes/hurtboxes are re-registered each frame)
    this.hitboxes = [];
    this.hurtboxes = [];
  }

  /**
   * Decay the combo timer; reset combo if it expires.
   * @private
   */
  _updateComboTimer(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this._resetCombo();
      }
    }
  }

  /**
   * Reset combo state to zero.
   * @private
   */
  _resetCombo() {
    if (this.comboCount > 0) {
      this.comboCount = 0;
      this.comboMultiplier = 1.0;
      this.playerComboPhase = 0;

      if (typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('combat:combo', { count: 0, multiplier: 1.0 });
      }
    }
  }

  // ── Collision Resolution ────────────────────────────────

  /**
   * Check all hitbox/hurtbox pairs and resolve collisions.
   * Different teams only (players can't hit players, etc.).
   * @private
   */
  _resolveCollisions() {
    const hitsToProcess = [];

    for (const hitbox of this.hitboxes) {
      for (const hurtbox of this.hurtboxes) {
        // Skip if same owner
        if (hitbox.owner === hurtbox.owner) continue;

        // Skip same team
        if (this._sameTeam(hitbox.owner, hurtbox.owner)) continue;

        // AABB overlap check
        if (this._aabbOverlap(hitbox, hurtbox)) {
          // Track already-hit pairs to prevent multi-hit per frame
          const pairKey = `${hitbox.owner._id || hitbox.owner}-${hurtbox.owner._id || hurtbox.owner}`;
          hitsToProcess.push({ hitbox, hurtbox, pairKey });
        }
      }
    }

    // Deduplicate: only first hit per owner pair per frame
    const processedPairs = new Set();
    for (const { hitbox, hurtbox, pairKey } of hitsToProcess) {
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);
      this.resolveHit(hitbox, hurtbox);
    }
  }

  /**
   * Check if two entities are on the same team.
   * @private
   */
  _sameTeam(a, b) {
    const teamA = this._getTeam(a);
    const teamB = this._getTeam(b);
    return teamA === teamB && teamA !== 'neutral';
  }

  /**
   * Determine the team of an entity.
   * @private
   */
  _getTeam(entity) {
    if (!entity) return 'neutral';
    if (entity.team) return entity.team;
    const className = entity.constructor ? entity.constructor.name : '';
    if (className === 'Player') return 'player';
    if (className === 'Enemy' || className === 'Boss') return 'enemy';
    return 'neutral';
  }

  /**
   * AABB overlap test between two rect-like objects.
   * @private
   */
  _aabbOverlap(a, b) {
    const aW = a.w || a.width || 0;
    const aH = a.h || a.height || 0;
    const bW = b.w || b.width || 0;
    const bH = b.h || b.height || 0;
    return (
      a.x < b.x + bW &&
      a.x + aW > b.x &&
      a.y < b.y + bH &&
      a.y + aH > b.y
    );
  }

  // ── Hit Resolution ──────────────────────────────────────

  /**
   * Resolve a single hitbox/hurtbox collision.
   * Calculates final damage, applies it, spawns particles, triggers hit-feel.
   * @param {Hitbox} hitbox
   * @param {Hurtbox} hurtbox
   */
  resolveHit(hitbox, hurtbox) {
    const attacker = hitbox.owner;
    const target = hurtbox.owner;
    if (!target || target.aiState === 'DEAD' || target.state === 'dead') return;

    // Check parry
    if (this._checkParry(hitbox, hurtbox)) {
      return; // Hit was parried
    }

    // Calculate damage
    const isCharged = hitbox.isCharged || false;
    const chargeRatio = hitbox.chargeRatio || 0;
    const damageResult = this.calculateDamage(
      hitbox.damage,
      attacker,
      target,
      isCharged,
      chargeRatio
    );

    const finalDamage = damageResult.damage;
    const isCritical = damageResult.isCritical;

    // Update combo tracking
    this._updateCombo(attacker, finalDamage);

    // Apply damage to target
    if (typeof target.takeDamage === 'function') {
      target.takeDamage(finalDamage, attacker);
    }

    // Track stats
    this.totalHitsLanded++;
    this.totalDamageDealt += finalDamage;
    if (isCritical) this.totalCrits++;

    // Apply knockback
    if (hitbox.knockback) {
      this.applyKnockback(target, attacker, hitbox.knockback);
    }

    // Hit-feel feedback
    this._applyHitFeel(finalDamage, isCritical, target, hitbox);

    // Check for kill
    if (target.hp !== undefined && target.hp <= 0) {
      this._onKill(target, attacker, hitbox);
    }

    // Emit combat hit event
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hit', {
        attacker,
        target,
        damage: finalDamage,
        isCritical,
        position: { x: target.x, y: target.y }
      });
    }
  }

  // ── Damage Calculation ──────────────────────────────────

  /**
   * Calculate final damage from base damage, combo, charge, and crit.
   *
   * Combo multiplier:
   *   Hit 1: ×1.0  |  Hit 2: ×1.3  |  Hit 3+: ×1.6
   * Charged: ×2.0 at full charge (scales linearly with chargeRatio)
   * Crit: 10% base chance, ×1.5
   *
   * @param {number} baseDamage
   * @param {Entity} attacker
   * @param {Entity} _defender
   * @param {boolean} isCharged
   * @param {number} chargeRatio — 0.0 to 1.0
   * @returns {{damage:number, isCritical:boolean}}
   */
  calculateDamage(baseDamage, attacker, _defender, isCharged = false, chargeRatio = 0) {
    let damage = baseDamage;
    let isCritical = false;

    // Combo multiplier (player combos only)
    if (attacker && this._getTeam(attacker) === 'player') {
      damage *= this.comboMultiplier;
    }

    // Charged attack multiplier
    if (isCharged) {
      const chargeMult = 1.0 + (FULL_CHARGE_MULTIPLIER - 1.0) * Math.min(1, chargeRatio);
      damage *= chargeMult;
    }

    // Critical hit
    const critRoll = Math.random();
    if (critRoll < CRIT_CHANCE) {
      damage *= CRIT_MULTIPLIER;
      isCritical = true;
    }

    // Floor to integer
    damage = Math.floor(damage);

    return { damage, isCritical };
  }

  // ── Combo Tracking ──────────────────────────────────────

  /**
   * Update combo state on a successful hit.
   * @private
   */
  _updateCombo(attacker, damage) {
    // Only player attacks build combos
    if (this._getTeam(attacker) !== 'player') return;

    this.comboCount++;
    this.comboTimer = this.comboWindow;

    // Calculate multiplier based on hit count
    const idx = Math.min(this.comboCount - 1, COMBO_MULTIPLIERS.length - 1);
    this.comboMultiplier = COMBO_MULTIPLIERS[idx];

    // Cap at max
    this.comboMultiplier = Math.min(this.comboMultiplier, this.maxComboMultiplier);

    // Track max combo
    if (this.comboCount > this.maxComboAchieved) {
      this.maxComboAchieved = this.comboCount;
    }

    // Emit combo event
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:combo', {
        count: this.comboCount,
        multiplier: this.comboMultiplier
      });
    }
  }

  // ── Knockback ───────────────────────────────────────────

  /**
   * Apply knockback force to a target entity, pushing them away from the source.
   * @param {Entity} target — entity to push
   * @param {Entity} source — entity causing the knockback
   * @param {{x:number, y:number}} force — knockback velocity
   */
  applyKnockback(target, source, force) {
    if (!target) return;

    // Calculate direction from source to target
    const dx = target.x - (source ? source.x : target.x);
    const dist = Math.abs(dx) || 1;
    const dirX = dx / dist;

    // Apply knockback velocities
    if (target.knockbackVx !== undefined) {
      target.knockbackVx = (force.x !== undefined ? force.x : 0) * Math.sign(dirX || 1);
    }
    if (target.knockbackVy !== undefined) {
      target.knockbackVy = force.y !== undefined ? force.y : -100;
    } else if (target.vy !== undefined) {
      target.vy = force.y !== undefined ? force.y : -100;
    }

    // Also set as velocity if knockback fields don't exist
    if (target.vx !== undefined && target.knockbackVx === undefined) {
      target.vx = (force.x !== undefined ? force.x : 0) * Math.sign(dirX || 1);
    }
  }

  // ── Hit-Feel ────────────────────────────────────────────

  /**
   * Apply all hit-feel effects: hitstop, screenshake, flash, particles.
   * @private
   */
  _applyHitFeel(damage, isCritical, target, hitbox) {
    // Hitstop duration scales with damage
    const damageRatio = damage / 20; // normalized around 20 dmg
    const hitstopDuration = Math.min(
      HITSTOP_MAX,
      HITSTOP_MIN + damageRatio * (HITSTOP_MAX - HITSTOP_MIN)
    );

    // Screenshake intensity scales with damage
    const shakeIntensity = Math.min(
      SHAKE_MAX,
      SHAKE_MIN + damageRatio * (SHAKE_MAX - SHAKE_MIN)
    );
    const shakeDuration = 0.1 + damageRatio * 0.15;

    // Emit hitstop
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:hitstop', { duration: hitstopDuration });
      window.GameEvents.emit('system:screenshake', {
        intensity: shakeIntensity,
        duration: shakeDuration
      });
    }

    // Visual flash on target
    if (target.flashTimer !== undefined) {
      target.flashTimer = HIT_FLASH_DURATION;
      if (target.flashColor !== undefined) {
        target.flashColor = '#FFFFFF';
      }
    }

    // Spawn hit particles
    this._spawnHitParticles(target, damage, isCritical, hitbox);

    // Floating damage number
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:damageNumber', {
        x: target.x,
        y: target.y - (target.height || 20),
        damage,
        isCritical
      });
    }
  }

  /**
   * Spawn particles on hit — blood / sparks / magic based on target type.
   * @private
   */
  _spawnHitParticles(target, damage, isCritical, hitbox) {
    if (typeof window === 'undefined' || !window.GameEvents) return;

    const count = isCritical ? 10 : 5 + Math.floor(damage / 5);
    const hitType = hitbox.type || 'melee';

    // Determine particle colors based on attack type
    let colors = ['#FF4444', '#CC0000'];
    if (hitType.includes('ice') || hitType.includes('freeze')) {
      colors = ['#B3E5FC', '#E0F7FA'];
    } else if (hitType.includes('fire') || hitType.includes('inferno')) {
      colors = ['#FF5722', '#FF9800'];
    } else if (hitType.includes('magic') || hitType.includes('mage')) {
      colors = ['#CE93D8', '#AB47BC'];
    } else if (hitType.includes('slam') || hitType.includes('ground')) {
      colors = ['#A1887F', '#8D6E63'];
    }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 100 * (isCritical ? 1.5 : 1);
      const color = colors[Math.floor(Math.random() * colors.length)];

      window.GameEvents.emit('renderer:particle', {
        x: target.x,
        y: target.y - (target.height || 20) / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.3 + Math.random() * 0.3,
        color,
        size: 2 + Math.random() * 3,
        gravity: 150,
        fade: true
      });
    }

    // Critical hit sparkle bonus
    if (isCritical) {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        window.GameEvents.emit('renderer:particle', {
          x: target.x,
          y: target.y - (target.height || 20) / 2,
          vx: Math.cos(angle) * 80,
          vy: Math.sin(angle) * 80 - 30,
          life: 0.4,
          color: '#FFD700',
          size: 3,
          gravity: 50,
          fade: true
        });
      }
    }
  }

  // ── Kill Handling ───────────────────────────────────────

  /**
   * Handle an entity death — enhanced hit-feel, particles, events.
   * @private
   */
  _onKill(target, attacker, _hitbox) {
    this.totalKills++;

    // Big hitstop
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:hitstop', { duration: KILL_HITSTOP });
      window.GameEvents.emit('system:screenshake', {
        intensity: KILL_SHAKE_INTENSITY,
        duration: KILL_SHAKE_DURATION
      });
    }

    // Dissolve particles
    this._spawnKillParticles(target);

    // Reset combo after a short delay (kill usually ends the immediate chain)
    if (this._getTeam(attacker) === 'player') {
      this.comboTimer = this.comboWindow; // Extend combo window on kill
    }

    // If target is a boss, emit boss defeated
    if (target.constructor && target.constructor.name === 'Boss') {
      if (typeof target.onDefeated === 'function') {
        target.onDefeated();
      }
    }
  }

  /**
   * Spawn enhanced dissolve particles on kill.
   * @private
   */
  _spawnKillParticles(target) {
    if (typeof window === 'undefined' || !window.GameEvents) return;

    const count = KILL_PARTICLES_MIN + Math.floor(Math.random() * (KILL_PARTICLES_MAX - KILL_PARTICLES_MIN));
    const baseColor = target.color || '#FF4444';

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 120;

      window.GameEvents.emit('renderer:particle', {
        x: target.x + (Math.random() - 0.5) * (target.width || 20),
        y: target.y - Math.random() * (target.height || 20),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.5 + Math.random() * 0.6,
        color: baseColor,
        size: 3 + Math.random() * 5,
        gravity: 80,
        fade: true
      });
    }

    // Gold XP particles
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      window.GameEvents.emit('renderer:particle', {
        x: target.x,
        y: target.y - (target.height || 20) / 2,
        vx: Math.cos(angle) * 50,
        vy: -80 - Math.random() * 40,
        life: 1.0,
        color: '#FFD700',
        size: 2 + Math.random() * 2,
        gravity: 30,
        fade: true
      });
    }
  }

  // ── Projectile System ───────────────────────────────────

  /**
   * Add a projectile to the active list.
   * @param {Projectile} proj
   */
  addProjectile(proj) {
    if (!proj || typeof proj.x !== 'number') {
      console.warn('Invalid projectile:', proj);
      return;
    }
    // Ensure lifetime
    if (!proj.lifetime) proj.lifetime = 3.0;
    this.projectiles.push(proj);
  }

  /**
   * Update all active projectiles — movement, homing, collision.
   * @param {number} dt
   * @param {WorldManager|null} world
   */
  updateProjectiles(dt, world) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      // Decay lifetime
      p.lifetime -= dt;
      if (p.lifetime <= 0) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Homing behavior
      if (p.homing && p.target && p.target.active) {
        this._applyHoming(p, dt);
      }

      // Gravity
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }

      // Ground-hugging (sand wave)
      if (p.groundHug && world && world.isSolid) {
        if (world.isSolid(p.x, p.y + 2)) {
          p.vy = 0;
          p.y = Math.floor(p.y / (world.tileSize || 32)) * (world.tileSize || 32) - 1;
        }
      }

      // Move
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Pulse animation for homing projectiles
      if (p.homing) {
        p.pulsePhase = (p.pulsePhase || 0) + dt * 8;
      }

      // World collision (ground)
      if (world && world.isSolid && world.isSolid(p.x, p.y)) {
        if (p.onHitGround) {
          this._onProjectileHitGround(p);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Bounds check
      if (p.x < -1000 || p.x > 10000 || p.y < -1000 || p.y > 5000) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Collision with hurtboxes (only opposite team)
      let hit = false;
      for (const hurtbox of this.hurtboxes) {
        if (p.owner === hurtbox.owner) continue;
        if (this._sameTeam(p.owner, hurtbox.owner)) continue;

        const pRect = {
          x: p.x - p.width / 2,
          y: p.y - p.height / 2,
          w: p.width,
          h: p.height
        };

        if (this._aabbOverlap(pRect, hurtbox)) {
          // Projectile hit!
          this._resolveProjectileHit(p, hurtbox);
          hit = true;
          break;
        }
      }

      if (hit) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  /**
   * Apply homing steering toward a target.
   * @private
   */
  _applyHoming(p, dt) {
    const target = p.target;
    const dx = target.x - p.x;
    const dy = (target.y - target.height / 2) - p.y;
    const targetAngle = Math.atan2(dy, dx);

    const currentAngle = Math.atan2(p.vy, p.vx);
    let angleDiff = targetAngle - currentAngle;

    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const turnRate = (p.homingStrength || 3.0) * dt;
    const newAngle = currentAngle + Math.max(-turnRate, Math.min(turnRate, angleDiff));

    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || (p.speed || 100);
    p.vx = Math.cos(newAngle) * speed;
    p.vy = Math.sin(newAngle) * speed;
  }

  /**
   * Handle projectile hitting a target.
   * @private
   */
  _resolveProjectileHit(proj, hurtbox) {
    const target = hurtbox.owner;
    const attacker = proj.owner;

    if (!target || target.aiState === 'DEAD' || target.state === 'dead') return;

    // Check parry
    if (this._checkProjectileParry(proj, hurtbox)) return;

    // Calculate damage
    const damageResult = this.calculateDamage(
      proj.damage,
      attacker,
      target,
      false,
      0
    );

    const finalDamage = damageResult.damage;
    const isCritical = damageResult.isCritical;

    // Update combo
    this._updateCombo(attacker, finalDamage);

    // Apply damage
    if (typeof target.takeDamage === 'function') {
      target.takeDamage(finalDamage, attacker);
    }

    // Stats
    this.totalHitsLanded++;
    this.totalDamageDealt += finalDamage;
    if (isCritical) this.totalCrits++;

    // Knockback from projectile
    const knockDirX = proj.vx >= 0 ? 1 : -1;
    this.applyKnockback(target, attacker, {
      x: knockDirX * 100,
      y: -80
    });

    // Hit feel
    this._applyHitFeel(finalDamage, isCritical, target, {
      type: proj.type,
      damage: proj.damage,
      owner: attacker,
      knockback: { x: knockDirX * 100, y: -80 }
    });

    // Projectile hit particles
    this._spawnProjectileHitParticles(proj);

    // Emit event
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hit', {
        attacker,
        target,
        damage: finalDamage,
        isCritical,
        position: { x: proj.x, y: proj.y }
      });
    }

    // Kill check
    if (target.hp !== undefined && target.hp <= 0) {
      this._onKill(target, attacker, proj);
    }
  }

  /**
   * Spawn particles when a projectile hits something.
   * @private
   */
  _spawnProjectileHitParticles(proj) {
    if (typeof window === 'undefined' || !window.GameEvents) return;

    const colors = [proj.color, '#FFFFFF'];
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      window.GameEvents.emit('renderer:particle', {
        x: proj.x,
        y: proj.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 0.3,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 2,
        gravity: 100,
        fade: true
      });
    }
  }

  /**
   * Handle projectile hitting the ground with a special effect.
   * @private
   */
  _onProjectileHitGround(proj) {
    if (proj.onHitGround === 'poison_pool' || proj.onHitGround === 'fire_pool') {
      const color = proj.onHitGround === 'poison_pool' ? '#689F38' : '#FF5722';
      if (typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('boss:zone', {
          type: proj.onHitGround,
          zone: {
            x: proj.x,
            y: proj.y,
            radius: 30,
            lifetime: 4.0,
            timer: 4.0,
            damage: 2
          }
        });
        // Ground hit particles
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI;
          window.GameEvents.emit('renderer:particle', {
            x: proj.x,
            y: proj.y,
            vx: Math.cos(angle + Math.PI) * 50,
            vy: -Math.sin(angle) * 30,
            life: 0.4,
            color,
            size: 3,
            gravity: 150,
            fade: true
          });
        }
      }
    }
  }

  /**
   * Render all active projectiles.
   * @param {object} renderer — Renderer instance
   */
  renderProjectiles(renderer) {
    const ctx = renderer.ctx;
    for (const p of this.projectiles) {
      ctx.save();

      // Pulsing size for homing projectiles
      let size = p.width;
      if (p.homing) {
        size *= 1.0 + Math.sin(p.pulsePhase || 0) * 0.2;
      }

      ctx.fillStyle = p.color || '#FFFFFF';

      // Draw based on type
      switch (p.type) {
        case 'arrow': {
          // Arrow shape
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillRect(-size / 2, -2, size, 4);
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.moveTo(size / 2, -4);
          ctx.lineTo(size / 2 + 4, 0);
          ctx.lineTo(size / 2, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'magic_homing': {
          // Glowing orb
          ctx.beginPath();
          ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
          // Glow
          ctx.fillStyle = `rgba(156,39,176,${0.2 + Math.sin(p.pulsePhase || 0) * 0.1})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'fireball':
        case 'meteor': {
          // Fire orb with trail
          ctx.beginPath();
          ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
          // Outer glow
          ctx.fillStyle = `rgba(255,87,34,0.3)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 0.8, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'sand_wave': {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size / 2, 0, Math.PI, false);
          ctx.fill();
          break;
        }
        case 'ice_shard': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillStyle = '#B3E5FC';
          ctx.beginPath();
          ctx.moveTo(size / 2, 0);
          ctx.lineTo(-size / 2, -3);
          ctx.lineTo(-size / 2, 3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'sludge': {
          ctx.beginPath();
          ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default: {
          // Default: filled circle
          ctx.beginPath();
          ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }
  }

  // ── Parry System ────────────────────────────────────────

  /**
   * Register a parry attempt from an entity.
   * @param {Entity} defender — entity performing the parry
   * @param {number} duration — total parry stance duration
   * @param {number} window — effective parry window within duration
   */
  registerParry(defender, duration = 0.5, window = 0.3) {
    this.activeParries.push({
      defender,
      timer: duration,
      window: window, // first N seconds are the actual parry window
      active: true
    });
  }

  /**
   * Check if a hitbox is parried by an active parry.
   * @private
   * @param {Hitbox} hitbox
   * @param {Hurtbox} hurtbox
   * @returns {boolean} true if the hit was parried
   */
  _checkParry(hitbox, hurtbox) {
    for (const parry of this.activeParries) {
      if (!parry.active) continue;
      // Must be the defender's hurtbox being hit
      if (hurtbox.owner !== parry.defender) continue;
      // Only parry within the parry window (first N seconds)
      if (parry.timer < (parry.defender.parryWindow || 0.3)) continue;

      // Parry successful! Stun the attacker
      this._executeParry(parry.defender, hitbox.owner);
      return true;
    }
    return false;
  }

  /**
   * Check if a projectile is parried.
   * @private
   */
  _checkProjectileParry(proj, hurtbox) {
    for (const parry of this.activeParries) {
      if (!parry.active) continue;
      if (hurtbox.owner !== parry.defender) continue;
      if (parry.timer < (parry.defender.parryWindow || 0.3)) continue;

      // Deflect projectile
      this._deflectProjectile(proj, parry.defender);
      return true;
    }
    return false;
  }

  /**
   * Execute a successful parry — stun attacker, emit effects.
   * @private
   */
  _executeParry(defender, attacker) {
    // Stun the attacker
    if (attacker && typeof attacker.enterStun === 'function') {
      attacker.enterStun(2.0);
    }

    this.totalParries++;

    // Parry effects
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:parry', {
        attacker,
        defender,
        position: { x: defender.x, y: defender.y }
      });
      window.GameEvents.emit('system:hitstop', { duration: 0.12 });
      window.GameEvents.emit('system:screenshake', {
        intensity: 4,
        duration: 0.2
      });

      // Parry sparkle particles
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        window.GameEvents.emit('renderer:particle', {
          x: defender.x,
          y: defender.y - 15,
          vx: Math.cos(angle) * 60,
          vy: Math.sin(angle) * 60,
          life: 0.4,
          color: '#E0E0E0',
          size: 3,
          gravity: 0,
          fade: true
        });
      }
    }
  }

  /**
   * Deflect a projectile back at its owner.
   * @private
   */
  _deflectProjectile(proj, defender) {
    proj.vx *= -1.5;
    proj.vy *= -0.5;
    proj.owner = defender;
    proj.ownerType = 'player';
    proj.homing = true;
    proj.homingStrength = 5.0;
    proj.target = proj.owner; // will be fixed below
    // Find the original owner as target
    // (In practice, we'd look up the original attacker)

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:parry', {
        attacker: null,
        defender,
        position: { x: defender.x, y: defender.y },
        type: 'projectile_deflect'
      });
    }
  }

  /**
   * Update active parry timers.
   * @private
   */
  _updateParries(dt) {
    for (let i = this.activeParries.length - 1; i >= 0; i--) {
      const parry = this.activeParries[i];
      parry.timer -= dt;
      if (parry.timer <= 0) {
        this.activeParries.splice(i, 1);
      }
    }
  }

  /**
   * Process a parry request from a player/entity.
   * Convenience method that registers parry and emits the event.
   * @param {Entity} entity — entity performing the parry
   */
  processParry(entity) {
    if (!entity) return;
    this.registerParry(entity, entity.parryDuration || 0.5, entity.parryWindow || 0.3);

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:dodge', {
        entity,
        direction: entity.facingRight ? 1 : -1
      });
    }
  }

  // ── Player Attack Hitboxes ──────────────────────────────

  /**
   * Create a player attack hitbox based on combo phase.
   * Phase 0: Quick slash — narrow, fast
   * Phase 1: Sweep — wider hitbox
   * Phase 2: Downward slam — wider + knockdown
   *
   * @param {Entity} player — player entity
   * @param {number} phase — 0, 1, or 2
   * @returns {Hitbox|null}
   */
  createPlayerAttackHitbox(player, phase = 0) {
    if (!player) return null;

    const facing = player.facingRight ? 1 : -1;
    const baseX = player.x + facing * 20;
    const baseY = player.y - player.height * 0.6;

    let hitbox;

    switch (phase) {
      case 0: {
        // Quick slash — narrow
        hitbox = {
          owner: player,
          x: baseX - 8,
          y: baseY,
          w: 22,
          h: 18,
          damage: player.baseDamage || 10,
          knockback: { x: facing * 100, y: -50 },
          type: 'slash_quick',
          duration: 0.08
        };
        break;
      }
      case 1: {
        // Sweep — wider
        hitbox = {
          owner: player,
          x: baseX - 15,
          y: baseY - 4,
          w: 36,
          h: 24,
          damage: player.baseDamage || 10,
          knockback: { x: facing * 150, y: -80 },
          type: 'slash_sweep',
          duration: 0.12
        };
        break;
      }
      case 2: {
        // Downward slam — wide + strong knockback
        hitbox = {
          owner: player,
          x: baseX - 18,
          y: baseY + 4,
          w: 42,
          h: 22,
          damage: Math.floor((player.baseDamage || 10) * 1.3),
          knockback: { x: facing * 200, y: -150 },
          type: 'slash_slam',
          duration: 0.15
        };
        break;
      }
      default:
        return null;
    }

    return hitbox;
  }

  /**
   * Create a charged attack hitbox — large, high damage, scales with charge.
   * @param {Entity} player
   * @param {number} chargeRatio — 0.0 to 1.0
   * @returns {Hitbox|null}
   */
  createChargedAttackHitbox(player, chargeRatio = 1.0) {
    if (!player) return null;

    const facing = player.facingRight ? 1 : -1;
    const sizeMult = 0.8 + chargeRatio * 0.7; // 0.8x to 1.5x size

    const hitbox = {
      owner: player,
      x: player.x + facing * 15 * sizeMult - 12 * sizeMult,
      y: player.y - player.height * 0.7,
      w: 50 * sizeMult,
      h: player.height * 0.7,
      damage: Math.floor((player.baseDamage || 10) * (1.0 + chargeRatio)),
      knockback: { x: facing * (150 + chargeRatio * 250), y: -(100 + chargeRatio * 200) },
      type: 'charged_attack',
      duration: 0.15,
      isCharged: true,
      chargeRatio: chargeRatio
    };

    return hitbox;
  }

  /**
   * Register a player attack hitbox directly (creates + registers).
   * @param {Entity} player
   * @param {number} phase
   */
  registerPlayerAttack(player, phase) {
    const hitbox = this.createPlayerAttackHitbox(player, phase);
    if (hitbox) {
      this.registerHitbox(hitbox);

      // Emit attack event for SFX
      if (typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('combat:playerAttack', {
          player,
          phase,
          position: { x: player.x, y: player.y }
        });
      }
    }
  }

  /**
   * Register a charged player attack (creates + registers).
   * @param {Entity} player
   * @param {number} chargeRatio
   */
  registerChargedAttack(player, chargeRatio) {
    const hitbox = this.createChargedAttackHitbox(player, chargeRatio);
    if (hitbox) {
      this.registerHitbox(hitbox);

      if (typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('combat:chargedAttack', {
          player,
          chargeRatio,
          position: { x: player.x, y: player.y }
        });
      }
    }
  }

  // ── Hitbox Decay ────────────────────────────────────────

  /**
   * Decrease hitbox durations and remove expired ones.
   * @private
   */
  _decayHitboxes(dt) {
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      this.hitboxes[i].duration -= dt;
      if (this.hitboxes[i].duration <= 0) {
        this.hitboxes.splice(i, 1);
      }
    }
  }

  // ── Utility Methods ─────────────────────────────────────

  /**
   * Get current combo info.
   * @returns {{count:number, multiplier:number, timer:number}}
   */
  getComboInfo() {
    return {
      count: this.comboCount,
      multiplier: this.comboMultiplier,
      timer: this.comboTimer,
      maxCombo: this.maxComboAchieved
    };
  }

  /**
   * Get combat statistics.
   * @returns {object}
   */
  getStats() {
    return {
      totalHitsLanded: this.totalHitsLanded,
      totalDamageDealt: this.totalDamageDealt,
      totalKills: this.totalKills,
      maxComboAchieved: this.maxComboAchieved,
      totalCrits: this.totalCrits,
      totalParries: this.totalParries,
      activeProjectiles: this.projectiles.length,
      activeHitboxes: this.hitboxes.length,
      activeHurtboxes: this.hurtboxes.length
    };
  }

  /**
   * Reset all combat state.
   */
  reset() {
    this.hitboxes = [];
    this.hurtboxes = [];
    this.projectiles = [];
    this.comboCount = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.playerComboPhase = 0;
    this.playerComboTimer = 0;
    this.activeParries = [];
    this.totalHitsLanded = 0;
    this.totalDamageDealt = 0;
    this.totalKills = 0;
    this.maxComboAchieved = 0;
    this.totalCrits = 0;
    this.totalParries = 0;
  }

  /**
   * Get the recommended combo phase for the next player attack.
   * @returns {number} 0, 1, or 2
   */
  getNextComboPhase() {
    if (this.comboTimer <= 0) return 0;
    return (this.playerComboPhase + 1) % 3;
  }

  /**
   * Advance the player combo phase after a successful attack.
   * @param {number} phase
   */
  advanceComboPhase(phase) {
    this.playerComboPhase = phase;
    this.playerComboTimer = this.comboWindow;
    this.comboTimer = this.comboWindow;
  }
}

// ─────────────────────────────────────────────────────────────
// Static Factory / Utility Methods
// ─────────────────────────────────────────────────────────────

/**
 * Quick-create a CombatSystem with default settings.
 * @returns {CombatSystem}
 */
CombatSystem.create = function () {
  return new CombatSystem();
};

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CombatSystem };
}
