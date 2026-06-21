/**
 * @fileoverview Enemy.js — Enemy entity system with 6 enemy types,
 * 3-phase AI state machine (IDLE → ALERT → AGGRESSIVE),
 * physics integration, and event-driven combat interaction.
 *
 * Includes the Entity base class (section 5) and Enemy subclasses.
 * All vanilla ES6, zero dependencies.
 */

// ─────────────────────────────────────────────────────────────
// Entity Base Class (from SPEC section 5)
// ─────────────────────────────────────────────────────────────

/**
 * Base Entity class.  Every game object that participates in the world
 * (player, enemies, items, etc.) inherits from Entity.
 */
// ─────────────────────────────────────────────────────────────
// Enemy Type Definitions
// ─────────────────────────────────────────────────────────────

/** @enum {string} */
const ENEMY_TYPE_KEYS = {
  GRUNT: 'GRUNT',
  ARCHER: 'ARCHER',
  BRUTE: 'BRUTE',
  FLYER: 'FLYER',
  MAGE: 'MAGE',
  ASSASSIN: 'ASSASSIN'
};

/**
 * Static stats table for each enemy archetype.
 * @type {Object<string, EnemyTypeDef>}
 */
const ENEMY_TYPES = {
  GRUNT: {
    hp: 30,
    damage: 8,
    speed: 80,
    size: { w: 20, h: 28 },
    color: '#8B4513',
    detectionRange: 150,
    attackRange: 35,
    attackCooldown: 1.0,
    xpValue: 10,
    behavior: 'melee_chase'
  },
  ARCHER: {
    hp: 20,
    damage: 12,
    speed: 70,
    size: { w: 18, h: 26 },
    color: '#2E7D32',
    detectionRange: 250,
    attackRange: 180,
    attackCooldown: 2.0,
    xpValue: 15,
    behavior: 'kite'
  },
  BRUTE: {
    hp: 80,
    damage: 20,
    speed: 50,
    size: { w: 32, h: 40 },
    color: '#5D4037',
    detectionRange: 180,
    attackRange: 50,
    attackCooldown: 1.8,
    xpValue: 25,
    behavior: 'heavy_slam'
  },
  FLYER: {
    hp: 25,
    damage: 10,
    speed: 120,
    size: { w: 22, h: 20 },
    color: '#7B1FA2',
    detectionRange: 200,
    attackRange: 30,
    attackCooldown: 1.2,
    xpValue: 15,
    behavior: 'dive_attack'
  },
  MAGE: {
    hp: 35,
    damage: 15,
    speed: 60,
    size: { w: 20, h: 30 },
    color: '#1565C0',
    detectionRange: 220,
    attackRange: 160,
    attackCooldown: 2.5,
    xpValue: 20,
    behavior: 'magic_ranged'
  },
  ASSASSIN: {
    hp: 30,
    damage: 18,
    speed: 140,
    size: { w: 18, h: 26 },
    color: '#37474F',
    detectionRange: 200,
    attackRange: 35,
    attackCooldown: 1.0,
    xpValue: 25,
    behavior: 'flank_dodge'
  }
};

// ─────────────────────────────────────────────────────────────
// Enemy Class
// ─────────────────────────────────────────────────────────────

/**
 * Enemy entity with 3-phase AI state machine.
 *
 * AI states:
 *   IDLE      → patrol / stand, scan for player
 *   ALERT     → face player, brief pause (0.5 s), then become AGGRESSIVE
 *   AGGRESSIVE→ execute behaviour-specific attack patterns
 *   STUNNED   → 2 s recovery, flash white, no actions
 *   DEAD      → removal imminent
 *
 * Physics: gravity, ground collision, friction.
 */
class Enemy extends Entity {
  /**
   * @param {number} x — world x (center)
   * @param {number} y — world y (bottom of sprite)
   * @param {string} type — key from ENEMY_TYPES
   */
  constructor(x, y, type) {
    super(x, y);

    this.type = type;
    this.aiState = 'IDLE'; // IDLE|ALERT|AGGRESSIVE|STUNNED|DEAD
    this.aiTimer = 0;
    this.detectionRange = 200;
    this.attackRange = 40;
    this.loseInterestRange = 350;
    this.loseInterestTimer = 0;
    this.patrolPoints = [];
    this.currentPatrolIndex = 0;
    this.stunTimer = 0;
    this.state = 'idle'; // animation state

    // Combat
    this.maxHP = 30;
    this.hp = 30;
    this.damage = 8;
    this.speed = 80;
    this.attackCooldown = 1.0;
    this.attackTimer = 0;
    this.xpValue = 10;
    this.behavior = 'melee_chase';

    // Physics
    this.onGround = false;
    this.facingRight = true;
    this.friction = 0.85;
    this.gravity = 800;
    this.terminalVelocity = 600;

    // Visual
    this.flashTimer = 0;
    this.flashColor = null;
    this.hitStunTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.deathTimer = 0;
    this.opacity = 1.0;

    // Behaviour-specific fields (populated by setTypeStats)
    this.slamTelegraphTimer = 0;
    this.isTelegraphingSlam = false;
    this.hoverY = 0;
    this.hoverOffset = 0;
    this.divePhase = 'hover'; // hover|dive|recover
    this.diveTimer = 0;
    this.teleportTimer = 0;
    this.flankAngle = 0;
    this.flankDir = 1;
    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.isDodging = false;

    // Projectile bookkeeping (MAGE / ARCHER)
    this.projectileCooldown = 0;

    // Patrol
    this.patrolWaitTimer = 0;
    this.patrolPauseDuration = 1.5;
    this.patrolSpeedMultiplier = 0.4;

    // Stats from type
    this.setTypeStats(type);

    // Size is set by setTypeStats; update width / height accordingly
    this.width = this.size?.w ?? 20;
    this.height = this.size?.h ?? 28;

    // Generate default patrol points if none provided later
    this._generateDefaultPatrol();
  }

  // ── Type Setup ──────────────────────────────────────────

  /**
   * Configure all stats, size, colour and behaviour from the ENEMY_TYPES table.
   * @param {string} type
   */
  setTypeStats(type) {
    const def = ENEMY_TYPES[type];
    if (!def) {
      console.warn(`Unknown enemy type: ${type}, defaulting to GRUNT`);
      return this.setTypeStats('GRUNT');
    }
    this.maxHP = def.hp;
    this.hp = def.hp;
    this.damage = def.damage;
    this.speed = def.speed;
    this.size = { ...def.size };
    this.width = def.size.w;
    this.height = def.size.h;
    this.color = def.color;
    this.detectionRange = def.detectionRange;
    this.attackRange = def.attackRange;
    this.attackCooldown = def.attackCooldown;
    this.xpValue = def.xpValue;
    this.behavior = def.behavior;
  }

  /**
   * Build two default patrol points around spawn.
   * @private
   */
  _generateDefaultPatrol() {
    const range = 80;
    this.patrolPoints = [
      { x: this.x - range, y: this.y },
      { x: this.x + range, y: this.y }
    ];
    this.currentPatrolIndex = 0;
  }

  /**
   * Set patrol points from external source (e.g. WorldManager).
   * @param {Array<{x:number, y:number}>} points
   */
  setPatrolPoints(points) {
    if (points && points.length > 0) {
      this.patrolPoints = points.map(p => ({ x: p.x, y: p.y }));
      this.currentPatrolIndex = 0;
    }
  }

  // ── Main Update ─────────────────────────────────────────

  /**
   * Called every frame.  Handles AI, physics, timers and state transitions.
   * @param {number} dt — seconds since last frame
   * @param {Entity} player — player entity
   * @param {WorldManager|null} world — world manager for collision queries
   */
  update(dt, player, world) {
    if (!this.active) return;
    if (this.aiState === 'DEAD') {
      this._updateDeath(dt);
      return;
    }

    // Global timer updates (always run, even when stunned)
    this._updateTimers(dt);

    if (this.aiState === 'STUNNED') {
      this._updateStunned(dt);
      this._applyPhysics(dt, world);
      return;
    }

    // Hit-stun briefly interrupts actions (but doesn't change AI state)
    if (this.hitStunTimer > 0) {
      this._applyPhysics(dt, world);
      return;
    }

    // ── AI State Machine ──
    switch (this.aiState) {
      case 'IDLE':
        this._updateIdle(dt, player, world);
        break;
      case 'ALERT':
        this._updateAlert(dt, player);
        break;
      case 'AGGRESSIVE':
        this._updateAggressive(dt, player, world);
        break;
    }

    this._applyPhysics(dt, world);
    this._updateFacing(player);
  }

  /**
   * Decrement all frame timers.
   * @private
   */
  _updateTimers(dt) {
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.hitStunTimer > 0) this.hitStunTimer -= dt;
    if (this.projectileCooldown > 0) this.projectileCooldown -= dt;
    if (this.dodgeCooldown > 0) this.dodgeCooldown -= dt;
    if (this.dodgeTimer > 0) this.dodgeTimer -= dt;
    if (this.isDodging && this.dodgeTimer <= 0) this.isDodging = false;
    if (this.teleportTimer > 0) this.teleportTimer -= dt;
  }

  // ── State: IDLE ─────────────────────────────────────────

  /**
   * IDLE: patrol between points, or stand still.  Transition to ALERT
   * if player comes within detectionRange.
   * @private
   */
  _updateIdle(dt, player, world) {
    this.state = 'idle';

    // Patrol behaviour
    if (this.patrolPoints.length > 1) {
      this._doPatrol(dt, world);
    } else {
      // Stand still — idle bob animation
      this.vx *= this.friction;
    }

    // Check for player detection
    const distSq = this.distanceToSq(player);
    const detectSq = this.detectionRange * this.detectionRange;
    if (distSq < detectSq) {
      this._enterAlert();
    }
  }

  /**
   * Move toward current patrol point, then pause.
   * @private
   */
  _doPatrol(dt, world) {
    if (this.patrolWaitTimer > 0) {
      this.patrolWaitTimer -= dt;
      this.vx *= this.friction;
      return;
    }

    const target = this.patrolPoints[this.currentPatrolIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      // Reached point — wait and go to next
      this.patrolWaitTimer = this.patrolPauseDuration;
      this.currentPatrolIndex =
        (this.currentPatrolIndex + 1) % this.patrolPoints.length;
      this.vx *= this.friction;
      return;
    }

    const moveSpeed = this.speed * this.patrolSpeedMultiplier;
    this.vx += (dx / dist) * moveSpeed * dt * 10;
    this.facingRight = dx > 0;
  }

  // ── State: ALERT ────────────────────────────────────────

  /**
   * Enter the ALERT state — brief pause before aggression.
   * @private
   */
  _enterAlert() {
    this.aiState = 'ALERT';
    this.aiTimer = 0.5; // 0.5 s pause
    this.state = 'alert';
    this.vx = 0;

    // Emit SFX event
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('enemy_alert', {
        enemy: this,
        type: this.type,
        position: { x: this.x, y: this.y }
      });
      window.GameEvents.emit('system:notification', {
        message: `${this.type} spotted you!`,
        type: 'warning'
      });
    }
  }

  /**
   * ALERT: face player and pause, then go AGGRESSIVE.
   * @private
   */
  _updateAlert(dt, player) {
    this.aiTimer -= dt;

    // Face player during alert
    this.facingRight = player.x > this.x;

    if (this.aiTimer <= 0) {
      this.aiState = 'AGGRESSIVE';
      this.loseInterestTimer = 0;
      this.state = 'aggressive';
    }
  }

  // ── State: AGGRESSIVE ───────────────────────────────────

  /**
   * AGGRESSIVE: behaviour-specific attack patterns.
   * @private
   */
  _updateAggressive(dt, player, world) {
    const distSq = this.distanceToSq(player);
    const loseSq = this.loseInterestRange * this.loseInterestRange;

    // Check lose-interest
    if (distSq > loseSq) {
      this.loseInterestTimer += dt;
      if (this.loseInterestTimer >= 3.0) {
        this.aiState = 'IDLE';
        this.state = 'idle';
        this.loseInterestTimer = 0;
        this.vx = 0;
        return;
      }
    } else {
      this.loseInterestTimer = 0;
    }

    // Delegate to behaviour handler
    switch (this.behavior) {
      case 'melee_chase':
        this._behaviorMeleeChase(dt, player, distSq);
        break;
      case 'kite':
        this._behaviorKite(dt, player, distSq, world);
        break;
      case 'heavy_slam':
        this._behaviorHeavySlam(dt, player, distSq, world);
        break;
      case 'dive_attack':
        this._behaviorDiveAttack(dt, player, distSq, world);
        break;
      case 'magic_ranged':
        this._behaviorMagicRanged(dt, player, distSq, world);
        break;
      case 'flank_dodge':
        this._behaviorFlankDodge(dt, player, distSq, world);
        break;
      default:
        this._behaviorMeleeChase(dt, player, distSq);
    }
  }

  // ── Behaviour: melee_chase (GRUNT) ──────────────────────

  /**
   * GRUNT: simple chase + melee attack.
   * @private
   */
  _behaviorMeleeChase(dt, player, distSq) {
    const attackSq = this.attackRange * this.attackRange;

    if (distSq < attackSq) {
      // Attack
      this.vx *= this.friction;
      if (this.attackTimer <= 0) {
        this._executeMeleeAttack(player);
        this.attackTimer = this.attackCooldown;
      }
    } else {
      // Chase
      const dx = player.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.vx += dir * this.speed * dt * 10;
      this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
      this.state = 'chase';
    }
  }

  // ── Behaviour: kite (ARCHER) ────────────────────────────

  /**
   * ARCHER: maintain optimal distance, shoot projectiles.
   * @private
   */
  _behaviorKite(dt, player, distSq, _world) {
    const optimalMin = 120;
    const optimalMax = 180;

    const dx = player.x - this.x;
    const dist = Math.sqrt(distSq);
    const dir = dist > 0 ? dx / dist : 1;

    if (dist < optimalMin) {
      // Too close — back away
      this.vx -= dir * this.speed * dt * 12;
      this.state = 'retreat';
    } else if (dist > optimalMax) {
      // Too far — approach
      this.vx += dir * this.speed * dt * 8;
      this.state = 'chase';
    } else {
      // In sweet spot — stop and shoot
      this.vx *= this.friction;
      this.state = 'attack';
      if (this.attackTimer <= 0 && this.projectileCooldown <= 0) {
        this._shootArrow(player);
        this.attackTimer = this.attackCooldown;
        this.projectileCooldown = 0.8;
      }
    }
  }

  /**
   * Fire an arrow projectile toward the player (with gravity arc).
   * @private
   */
  _shootArrow(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.height / 2 - (player.y - player.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const speed = 250;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed - 120; // slight upward arc

    const arrow = {
      x: this.x,
      y: this.y - this.height * 0.7,
      vx,
      vy,
      gravity: 400,
      damage: this.damage,
      owner: this,
      ownerType: 'enemy',
      type: 'arrow',
      lifetime: 3.0,
      width: 12,
      height: 4,
      color: '#8B4513'
    };

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:projectile', { projectile: arrow });
    }

    // Store in local array so updateProjectiles can handle it
    this._pendingProjectiles = this._pendingProjectiles || [];
    this._pendingProjectiles.push(arrow);
  }

  // ── Behaviour: heavy_slam (BRUTE) ───────────────────────

  /**
   * BRUTE: slow chase, telegraphed slam AOE.
   * @private
   */
  _behaviorHeavySlam(dt, player, distSq, _world) {
    if (this.isTelegraphingSlam) {
      this._updateSlamTelegraph(dt, player);
      return;
    }

    const attackSq = this.attackRange * this.attackRange;

    if (distSq < attackSq) {
      this.vx *= this.friction;
      if (this.attackTimer <= 0) {
        this._startSlamTelegraph();
      }
    } else {
      const dx = player.x - this.x;
      const dir = dx >= 0 ? 1 : -1;
      this.vx += dir * this.speed * dt * 8;
      this.vx = Math.max(-this.speed * 0.7, Math.min(this.speed * 0.7, this.vx));
      this.state = 'chase';
    }
  }

  /**
   * Begin the 0.8 s slam telegraph.
   * @private
   */
  _startSlamTelegraph() {
    this.isTelegraphingSlam = true;
    this.slamTelegraphTimer = 0.8;
    this.state = 'telegraph';
    this.vx = 0;

    // Visual warning — shake slightly
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:screenshake', {
        intensity: 1,
        duration: 0.8
      });
    }
  }

  /**
   * Count down telegraph, then execute slam.
   * @private
   */
  _updateSlamTelegraph(dt, player) {
    this.slamTelegraphTimer -= dt;
    // Face player during telegraph
    this.facingRight = player.x > this.x;

    if (this.slamTelegraphTimer <= 0) {
      this.isTelegraphingSlam = false;
      this._executeSlamAttack(player);
      this.attackTimer = this.attackCooldown;
    }
  }

  /**
   * Execute the AOE slam — wide hitbox + screen shake.
   * @private
   */
  _executeSlamAttack(player) {
    this.state = 'attack';

    // AOE hitbox: wide area around brute
    const aoeW = 80;
    const aoeH = 30;
    const hitbox = {
      owner: this,
      x: this.x - aoeW / 2,
      y: this.y - 10,
      w: aoeW,
      h: aoeH,
      damage: this.damage,
      knockback: { x: 300, y: -150 },
      type: 'slam_aoe',
      duration: 0.15
    };

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hitbox', { hitbox });
      window.GameEvents.emit('system:hitstop', { duration: 0.12 });
      window.GameEvents.emit('system:screenshake', {
        intensity: 6,
        duration: 0.3
      });
    }

    // Dust particles
    this._spawnSlamParticles();

    // Check immediate hit on player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < aoeW / 2) {
      this._applyDamageToPlayer(player, this.damage, {
        x: (dx / dist) * 300,
        y: -150
      });
    }
  }

  // ── Behaviour: dive_attack (FLYER) ──────────────────────

  /**
   * FLYER: hovers 80 px above player, then dives down.
   * @private
   */
  _behaviorDiveAttack(dt, player, distSq, _world) {
    const attackSq = this.attackRange * this.attackRange;

    switch (this.divePhase) {
      case 'hover':
        // Hover above player
        this.hoverOffset = 80;
        this.hoverY = player.y - this.hoverOffset;
        const dx = player.x - this.x;
        this.vx += (dx > 0 ? 1 : -1) * this.speed * 0.5 * dt * 8;
        this.vx = Math.max(-this.speed * 0.4, Math.min(this.speed * 0.4, this.vx));

        // Smoothly move toward hover height
        const dy = this.hoverY - this.y;
        this.vy += dy * 2 * dt;
        this.vy *= 0.9;

        this.state = 'hover';

        // Initiate dive when close horizontally and cooldown ready
        if (Math.abs(dx) < 30 && this.attackTimer <= 0) {
          this.divePhase = 'dive';
          this.diveTimer = 0;
          this.state = 'dive';
        }
        break;

      case 'dive':
        // Dive straight down fast
        this.vx *= 0.9;
        this.vy += this.speed * 3 * dt;
        if (this.vy > 400) this.vy = 400;

        // Check if we hit ground or player
        if (this.onGround || distSq < attackSq) {
          this.divePhase = 'recover';
          this.diveTimer = 0.6;
          if (distSq < attackSq * 2) {
            this._executeDiveAttack(player);
          }
          // Bounce back up
          this.vy = -200;
        }
        break;

      case 'recover':
        this.diveTimer -= dt;
        // Float back up
        this.vy -= 200 * dt;
        this.vx *= 0.9;
        this.state = 'recover';
        if (this.diveTimer <= 0) {
          this.divePhase = 'hover';
          this.attackTimer = this.attackCooldown;
        }
        break;
    }
  }

  /**
   * Execute dive attack damage.
   * @private
   */
  _executeDiveAttack(player) {
    const hitbox = {
      owner: this,
      x: this.x - 18,
      y: this.y - 10,
      w: 36,
      h: 20,
      damage: this.damage,
      knockback: { x: 200, y: -200 },
      type: 'dive',
      duration: 0.1
    };

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hitbox', { hitbox });
      window.GameEvents.emit('system:hitstop', { duration: 0.1 });
      window.GameEvents.emit('system:screenshake', {
        intensity: 4,
        duration: 0.2
      });
    }

    this._applyDamageToPlayer(player, this.damage, {
      x: (player.x - this.x) > 0 ? 200 : -200,
      y: -200
    });
  }

  // ── Behaviour: magic_ranged (MAGE) ──────────────────────

  /**
   * MAGE: teleport when player gets close, fire homing projectiles.
   * @private
   */
  _behaviorMagicRanged(dt, player, distSq, _world) {
    const dist = Math.sqrt(distSq);
    const tooClose = 80;

    // Teleport if player is too close and teleport off cooldown
    if (dist < tooClose && this.teleportTimer <= 0) {
      this._teleportAway(player);
      return;
    }

    // Maintain mid-range distance
    const dx = player.x - this.x;
    const dir = dist > 0 ? dx / dist : 1;

    if (dist > this.attackRange) {
      // Approach to attack range
      this.vx += dir * this.speed * 0.6 * dt * 8;
    } else {
      this.vx *= this.friction;
    }

    // Cast homing projectile
    if (this.attackTimer <= 0 && this.projectileCooldown <= 0) {
      this._castHomingProjectile(player);
      this.attackTimer = this.attackCooldown;
      this.projectileCooldown = 1.0;
    }

    this.state = dist < this.attackRange ? 'attack' : 'chase';
  }

  /**
   * Teleport to a safe distance behind or away from player.
   * @private
   */
  _teleportAway(player) {
    const teleportDist = 180;
    const angle = Math.atan2(this.y - player.y, this.x - player.x);
    const jitter = (Math.random() - 0.5) * 1.0; // ±0.5 rad

    this.x = player.x + Math.cos(angle + jitter) * teleportDist;
    this.y = player.y + Math.sin(angle + jitter) * 20; // keep roughly same height
    this.teleportTimer = 2.0;
    this.vx = 0;
    this.vy = 0;
    this.state = 'teleport';

    // Spawn magic particles at old and new position
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:teleport', {
        enemy: this,
        from: { x: this.x, y: this.y },
        to: { x: this.x, y: this.y }
      });
    }
  }

  /**
   * Cast a slow homing magic projectile.
   * @private
   */
  _castHomingProjectile(player) {
    const proj = {
      x: this.x,
      y: this.y - this.height * 0.7,
      vx: 0,
      vy: -30,
      homing: true,
      homingStrength: 3.0, // radians per second turn rate
      target: player,
      speed: 100,
      damage: this.damage,
      owner: this,
      ownerType: 'enemy',
      type: 'magic_homing',
      lifetime: 5.0,
      width: 10,
      height: 10,
      color: '#9C27B0',
      pulsePhase: 0
    };

    this._pendingProjectiles = this._pendingProjectiles || [];
    this._pendingProjectiles.push(proj);
  }

  // ── Behaviour: flank_dodge (ASSASSIN) ───────────────────

  /**
   * ASSASSIN: orbit the player, dodge on attack, strike from behind.
   * @private
   */
  _behaviorFlankDodge(dt, player, distSq, _world) {
    const dist = Math.sqrt(distSq);
    const orbitRadius = 70;

    // Update flank orbit angle
    this.flankAngle += this.flankDir * 2.5 * dt;

    // Calculate desired orbit position
    const targetX = player.x + Math.cos(this.flankAngle) * orbitRadius;
    const targetY = player.y + Math.sin(this.flankAngle) * 5;

    const dx = targetX - this.x;
    const dy = targetY - this.y;

    if (!this.isDodging) {
      this.vx += dx * 6 * dt;
      this.vy += dy * 6 * dt;
      this.vx = Math.max(-this.speed, Math.min(this.speed, this.vx));
    }

    // Dodge if player is attacking and we're in range
    // (In a full implementation, we'd check player.isAttacking)
    if (!this.isDodging && this.dodgeCooldown <= 0 && dist < 60) {
      if (Math.random() < 0.4) {
        this._triggerDodge();
      }
    }

    // Attack from behind (when on opposite side from player's facing)
    const isBehindPlayer =
      (player.facingRight && this.x < player.x) ||
      (!player.facingRight && this.x > player.x);

    if (
      isBehindPlayer &&
      dist < this.attackRange + 10 &&
      this.attackTimer <= 0 &&
      !this.isDodging
    ) {
      this._executeBackstab(player);
      this.attackTimer = this.attackCooldown;
    }

    this.state = this.isDodging ? 'dodge' : dist < this.attackRange ? 'attack' : 'flank';
  }

  /**
   * Quick dodge roll in a perpendicular direction.
   * @private
   */
  _triggerDodge() {
    this.isDodging = true;
    this.dodgeTimer = 0.25;
    this.dodgeCooldown = 1.0;

    const dodgeAngle = this.flankAngle + (Math.PI / 2) * this.flankDir;
    const dodgeSpeed = 300;
    this.vx = Math.cos(dodgeAngle) * dodgeSpeed;
    this.vy = Math.sin(dodgeAngle) * dodgeSpeed * 0.3;
  }

  /**
   * Backstab attack — extra damage from behind.
   * @private
   */
  _executeBackstab(player) {
    const hitbox = {
      owner: this,
      x: this.x - 14,
      y: this.y - 16,
      w: 28,
      h: 20,
      damage: Math.floor(this.damage * 1.5),
      knockback: { x: 150, y: -100 },
      type: 'backstab',
      duration: 0.1
    };

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hitbox', { hitbox });
      window.GameEvents.emit('system:hitstop', { duration: 0.08 });
    }

    this._applyDamageToPlayer(player, Math.floor(this.damage * 1.5), {
      x: this.facingRight ? 150 : -150,
      y: -100
    });
  }

  // ── State: STUNNED ──────────────────────────────────────

  /**
   * STUNNED: flash white, no movement or actions for 2 seconds.
   * @private
   */
  _updateStunned(dt) {
    this.stunTimer -= dt;
    this.flashColor = '#FFFFFF';
    this.flashTimer = 0.1;
    this.vx *= 0.8;
    this.state = 'stunned';

    if (this.stunTimer <= 0) {
      this.aiState = 'AGGRESSIVE';
      this.flashColor = null;
      this.state = 'aggressive';
    }
  }

  /**
   * Enter stunned state (called externally by CombatSystem on parry etc.).
   * @param {number} duration — seconds to remain stunned
   */
  enterStun(duration = 2.0) {
    this.aiState = 'STUNNED';
    this.stunTimer = duration;
    this.vx = 0;
    this.isTelegraphingSlam = false;
    this.isDodging = false;

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:stun', {
        enemy: this,
        duration
      });
    }
  }

  // ── State: DEATH ────────────────────────────────────────

  /**
   * Update the death dissolve animation.
   * @private
   */
  _updateDeath(dt) {
    this.deathTimer += dt;
    this.opacity = Math.max(0, 1.0 - this.deathTimer / 0.8);
    this.vx *= 0.9;
    this.vy -= 20 * dt; // float upward slightly

    if (this.deathTimer >= 1.0) {
      this.active = false;
    }
  }

  // ── Physics ─────────────────────────────────────────────

  /**
   * Apply gravity, friction, velocity integration and ground collision.
   * @private
   */
  _applyPhysics(dt, world) {
    // Apply knockback velocity override (briefly)
    if (this.knockbackVx !== 0 || this.knockbackVy !== 0) {
      this.vx = this.knockbackVx;
      this.vy = this.knockbackVy;
      this.knockbackVx *= 0.85;
      this.knockbackVy *= 0.85;
      if (Math.abs(this.knockbackVx) < 5) this.knockbackVx = 0;
      if (Math.abs(this.knockbackVy) < 5) this.knockbackVy = 0;
    }

    // Gravity (flyers have reduced gravity)
    if (this.behavior === 'dive_attack') {
      if (this.divePhase === 'hover') {
        this.vy *= 0.92; // floating
      } else {
        this.vy += this.gravity * 0.5 * dt;
      }
    } else {
      this.vy += this.gravity * dt;
    }

    // Terminal velocity
    if (this.vy > this.terminalVelocity) this.vy = this.terminalVelocity;
    if (this.vy < -this.terminalVelocity) this.vy = -this.terminalVelocity;

    // Friction on ground
    if (this.onGround) {
      this.vx *= this.friction;
    }

    // Apply velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Ground collision
    this._checkGroundCollision(world);

    // World bounds (simple clamp)
    if (world && world.isSolid) {
      this._resolveWorldCollision(world);
    }
  }

  /**
   * Simple ground collision — check if entity is on solid ground.
   * @private
   */
  _checkGroundCollision(world) {
    if (!world || !world.isSolid) {
      // No world collision available — simple floor at y = 500
      if (this.y > 500) {
        this.y = 500;
        this.vy = 0;
        this.onGround = true;
      }
      return;
    }

    // Check tile below entity
    const footX = this.x;
    const footY = this.y + 2;
    if (world.isSolid(footX, footY)) {
      // Snap to ground
      const tileSize = world.tileSize || 32;
      this.y = Math.floor(footY / tileSize) * tileSize - 2;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  /**
   * Resolve wall collisions with the world.
   * @private
   */
  _resolveWorldCollision(world) {
    if (!world.isSolid) return;
    const tileSize = world.tileSize || 32;
    const halfW = this.width / 2;

    // Left wall
    if (world.isSolid(this.x - halfW - 1, this.y - this.height / 2)) {
      this.x =
        Math.floor((this.x - halfW) / tileSize) * tileSize + tileSize + halfW;
      this.vx = 0;
    }
    // Right wall
    if (world.isSolid(this.x + halfW + 1, this.y - this.height / 2)) {
      this.x =
        Math.floor((this.x + halfW) / tileSize) * tileSize - halfW;
      this.vx = 0;
    }
  }

  /**
   * Face toward the player.
   * @private
   */
  _updateFacing(player) {
    if (Math.abs(this.vx) > 5) {
      this.facingRight = this.vx > 0;
    } else if (player) {
      this.facingRight = player.x > this.x;
    }
  }

  // ── Attack Execution ────────────────────────────────────

  /**
   * Execute a basic melee attack — creates a hitbox.
   * @param {Entity} player
   * @private
   */
  _executeMeleeAttack(player) {
    this.state = 'attack';
    const reach = 24;
    const facing = this.facingRight ? 1 : -1;

    const hitbox = {
      owner: this,
      x: this.x + facing * reach - 10,
      y: this.y - this.height * 0.6,
      w: 20,
      h: 16,
      damage: this.damage,
      knockback: { x: facing * 120, y: -80 },
      type: 'melee',
      duration: 0.1
    };

    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hitbox', { hitbox });
    }

    // Check immediate overlap
    const pBounds = player.getBounds ? player.getBounds() : { x: player.x - 12, y: player.y - 20, w: 24, h: 20 };
    if (this._aabbOverlap(hitbox, pBounds)) {
      this._applyDamageToPlayer(player, this.damage, {
        x: facing * 120,
        y: -80
      });
    }
  }

  /**
   * Helper: AABB overlap test.
   * @private
   */
  _aabbOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + (a.w || a.width) > b.x &&
      a.y < b.y + b.h &&
      a.y + (a.h || a.height) > b.y
    );
  }

  /**
   * Apply damage to player with knockback.
   * @private
   */
  _applyDamageToPlayer(player, amount, knockback) {
    if (player.invincible || (player.isDodging && player.dodgeTimer > 0)) {
      return;
    }
    if (typeof player.takeDamage === 'function') {
      player.takeDamage(amount, this);
    }
    if (knockback && typeof player.knockbackVx !== 'undefined') {
      player.knockbackVx = knockback.x;
      player.knockbackVy = knockback.y;
    }
  }

  /**
   * Spawn dust particles for slam attack.
   * @private
   */
  _spawnSlamParticles() {
    if (typeof window !== 'undefined' && window.GameEvents) {
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * i) / 6;
        const speed = 80 + Math.random() * 120;
        window.GameEvents.emit('renderer:particle', {
          x: this.x,
          y: this.y,
          vx: Math.cos(angle) * speed,
          vy: -Math.abs(Math.sin(angle) * speed * 0.5),
          life: 0.6 + Math.random() * 0.4,
          color: '#A1887F',
          size: 3 + Math.random() * 4,
          gravity: 200,
          fade: true
        });
      }
    }
  }

  // ── Damage / Death ──────────────────────────────────────

  /**
   * Receive damage from an external source.
   * @param {number} amount — raw damage
   * @param {Entity|null} source — who dealt the damage
   */
  takeDamage(amount, source) {
    if (this.aiState === 'DEAD') return;

    this.hp -= amount;
    this.flashTimer = 0.12;
    this.flashColor = '#FFFFFF';
    this.hitStunTimer = 0.08;

    // Knockback
    if (source) {
      const dx = this.x - source.x;
      const dy = this.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.knockbackVx = (dx / dist) * 150;
      this.knockbackVy = -100;
    }

    // Emit hit event
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hit', {
        attacker: source,
        target: this,
        damage: amount,
        position: { x: this.x, y: this.y }
      });
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  /**
   * Trigger death sequence — particles, loot drop, event emission.
   */
  die() {
    this.aiState = 'DEAD';
    this.state = 'dead';
    this.deathTimer = 0;
    this.vx *= 0.3;
    this.vy = -50;

    // Death particles
    if (typeof window !== 'undefined' && window.GameEvents) {
      // Hitstop + screenshake on kill
      window.GameEvents.emit('system:hitstop', { duration: 0.2 });
      window.GameEvents.emit('system:screenshake', {
        intensity: 8,
        duration: 0.35
      });

      // Spawn dissolve particles
      for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 100;
        window.GameEvents.emit('renderer:particle', {
          x: this.x,
          y: this.y - this.height / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 50,
          life: 0.5 + Math.random() * 0.5,
          color: this.color,
          size: 3 + Math.random() * 4,
          gravity: 100,
          fade: true
        });
      }

      // XP orb particles
      for (let i = 0; i < 5; i++) {
        window.GameEvents.emit('renderer:particle', {
          x: this.x,
          y: this.y - this.height / 2,
          vx: (Math.random() - 0.5) * 60,
          vy: -60 - Math.random() * 40,
          life: 1.0,
          color: '#FFD700',
          size: 2,
          gravity: 30,
          fade: true
        });
      }

      window.GameEvents.emit('combat:kill', {
        enemy: this,
        type: this.type,
        xpValue: this.xpValue,
        position: { x: this.x, y: this.y }
      });
    }
  }

  /**
   * Execute an attack against a target.  (Public interface for CombatSystem.)
   * @param {Entity} target
   */
  attack(target) {
    if (this.aiState === 'DEAD' || this.aiState === 'STUNNED') return;

    if (this.behavior === 'heavy_slam') {
      this._executeSlamAttack(target);
    } else if (this.behavior === 'dive_attack') {
      this._executeDiveAttack(target);
    } else {
      this._executeMeleeAttack(target);
    }
  }

  // ── Projectile Access ───────────────────────────────────

  /**
   * Return and clear any projectiles fired this frame.
   * Called by CombatSystem to take ownership of projectiles.
   * @returns {Array<object>}
   */
  flushProjectiles() {
    const projs = this._pendingProjectiles || [];
    this._pendingProjectiles = [];
    return projs;
  }

  // ── Rendering ───────────────────────────────────────────

  /**
   * Draw the enemy using the renderer.
   * @param {object} renderer — Renderer instance
   */
  render(renderer) {
    if (!this.active) return;

    const ctx = renderer.ctx;
    ctx.save();

    // Apply opacity (for death dissolve)
    if (this.opacity < 1) {
      ctx.globalAlpha = this.opacity;
    }

    // Flash effect
    if (this.flashTimer > 0) {
      ctx.globalAlpha *= 0.6 + Math.sin(this.flashTimer * 40) * 0.4;
    }

    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;
    const halfW = w / 2;
    const drawX = x - halfW;
    const drawY = y - h;

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    const shadowScale = this.onGround ? 1 : 0.6 + (1 / (Math.abs(this.vy) * 0.01 + 1)) * 0.4;
    ctx.ellipse(x, y, halfW * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw enemy body (coloured rectangle with details)
    ctx.fillStyle = this.flashTimer > 0
      ? (this.flashColor || '#FFFFFF')
      : this.color;

    // Base shape
    this._drawEnemyBody(ctx, drawX, drawY, w, h);

    // Behaviour-specific overlays
    this._drawBehaviourOverlays(ctx, drawX, drawY, w, h);

    // Health bar (only when damaged)
    if (this.hp < this.maxHP && this.aiState !== 'DEAD') {
      this._drawHealthBar(ctx, x, drawY - 8, w);
    }

    // AI state indicator (debug / subtle)
    if (this.aiState === 'ALERT') {
      ctx.fillStyle = '#FF0000';
      ctx.beginPath();
      ctx.arc(x, drawY - 12, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.aiState === 'STUNNED') {
      // Stars spinning around head
      const starAngle = Date.now() / 200;
      ctx.fillStyle = '#FFD700';
      for (let i = 0; i < 3; i++) {
        const sa = starAngle + (i * Math.PI * 2) / 3;
        const sx = x + Math.cos(sa) * 10;
        const sy = drawY - 6 + Math.sin(sa) * 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Draw the basic enemy body shape.
   * @private
   */
  _drawEnemyBody(ctx, dx, dy, w, h) {
    // Main body
    ctx.fillRect(dx, dy, w, h);

    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dx, dy, w, h);

    // Eyes (white squares)
    const eyeSize = 3;
    const eyeY = dy + h * 0.25;
    const eyeOffsetX = w * 0.2;
    ctx.fillStyle = '#FFFFFF';
    if (this.facingRight) {
      ctx.fillRect(dx + w * 0.55, eyeY, eyeSize, eyeSize);
      ctx.fillRect(dx + w * 0.75, eyeY, eyeSize, eyeSize);
      // Pupils
      ctx.fillStyle = '#000000';
      ctx.fillRect(dx + w * 0.58, eyeY + 1, 2, 2);
      ctx.fillRect(dx + w * 0.78, eyeY + 1, 2, 2);
    } else {
      ctx.fillRect(dx + w * 0.15, eyeY, eyeSize, eyeSize);
      ctx.fillRect(dx + w * 0.35, eyeY, eyeSize, eyeSize);
      ctx.fillStyle = '#000000';
      ctx.fillRect(dx + w * 0.15, eyeY + 1, 2, 2);
      ctx.fillRect(dx + w * 0.35, eyeY + 1, 2, 2);
    }
  }

  /**
   * Draw behaviour-specific visual overlays.
   * @private
   */
  _drawBehaviourOverlays(ctx, dx, dy, w, h) {
    switch (this.behavior) {
      case 'kite': {
        // Bow indication
        ctx.fillStyle = '#5D4037';
        const bowX = this.facingRight ? dx + w : dx - 4;
        ctx.fillRect(bowX, dy + h * 0.4, 4, h * 0.4);
        break;
      }
      case 'heavy_slam': {
        // Muscle lines
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.3, dy + h * 0.3);
        ctx.lineTo(dx + w * 0.3, dy + h * 0.8);
        ctx.moveTo(dx + w * 0.7, dy + h * 0.3);
        ctx.lineTo(dx + w * 0.7, dy + h * 0.8);
        ctx.stroke();
        break;
      }
      case 'dive_attack': {
        // Wings
        ctx.fillStyle = '#4A148C';
        const wingFlap = Math.sin(Date.now() / 80) * 5;
        if (this.divePhase === 'hover') {
          ctx.beginPath();
          ctx.ellipse(
            dx + w / 2,
            dy + h * 0.3 + wingFlap,
            w * 0.8,
            4,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        break;
      }
      case 'magic_ranged': {
        // Magic aura pulse
        const pulse = Math.sin(Date.now() / 200) * 0.1 + 0.1;
        ctx.fillStyle = `rgba(156,39,176,${pulse})`;
        ctx.beginPath();
        ctx.arc(dx + w / 2, dy + h / 2, w * 0.6, 0, Math.PI * 2);
        ctx.fill();
        // Staff
        ctx.fillStyle = '#4E342E';
        ctx.fillRect(this.facingRight ? dx + w - 2 : dx - 2, dy, 3, h);
        break;
      }
      case 'flank_dodge': {
        // Cloak / hood shading
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(dx, dy, w, h * 0.4);
        break;
      }
    }

    // Telegraph warning (BRUTE slam)
    if (this.isTelegraphingSlam) {
      const flash = Math.sin(this.slamTelegraphTimer * 30) > 0;
      if (flash) {
        ctx.fillStyle = 'rgba(255,200,0,0.3)';
        ctx.fillRect(dx - 20, dy - 4, w + 40, h + 4);
      }
      // Warning indicator below
      ctx.fillStyle = '#FF0000';
      ctx.globalAlpha = 0.5 + Math.sin(this.slamTelegraphTimer * 20) * 0.3;
      ctx.beginPath();
      ctx.moveTo(this.x - 8, this.y + 6);
      ctx.lineTo(this.x + 8, this.y + 6);
      ctx.lineTo(this.x, this.y + 14);
      ctx.closePath();
      ctx.fill();
    }

    // Teleport effect (MAGE)
    if (this.teleportTimer > 1.5) {
      ctx.globalAlpha = (2.0 - this.teleportTimer) * 2;
      ctx.fillStyle = '#9C27B0';
      ctx.beginPath();
      ctx.arc(this.x, this.y - h / 2, w * 0.8 * (2.0 - this.teleportTimer), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw a small health bar above the enemy.
   * @private
   */
  _drawHealthBar(ctx, x, y, w) {
    const barW = w + 4;
    const barH = 3;
    const bx = x - barW / 2;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, y, barW, barH);

    // Fill
    const ratio = this.hp / this.maxHP;
    const r = Math.floor(255 * (1 - ratio));
    const g = Math.floor(255 * ratio);
    ctx.fillStyle = `rgb(${r},${g},0)`;
    ctx.fillRect(bx, y, barW * ratio, barH);
  }
}

// ─────────────────────────────────────────────────────────────
// Static Factory Methods
// ─────────────────────────────────────────────────────────────

/**
 * Create an enemy from type key and position.
 * @param {number} x
 * @param {number} y
 * @param {string} type — ENEMY_TYPE_KEYS value
 * @returns {Enemy}
 */
Enemy.create = function (x, y, type) {
  return new Enemy(x, y, type);
};

/**
 * Get a list of all supported enemy type keys.
 * @returns {string[]}
 */
Enemy.getTypes = function () {
  return Object.keys(ENEMY_TYPES);
};

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Entity, Enemy, ENEMY_TYPES, ENEMY_TYPE_KEYS };
}
