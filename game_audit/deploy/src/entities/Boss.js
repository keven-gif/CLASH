/**
 * @fileoverview Boss.js — Boss enemy system with 6 unique dungeon bosses,
 * each featuring a 3-phase fight that escalates in difficulty.
 *
 * Boss flow: intro → Phase 1 → transition → Phase 2 → transition → Phase 3
 * → defeat (explosion + unlock + item drop).
 *
 * Each boss has unique arena mechanics, attack patterns, and phase transitions.
 * Extends Enemy (which extends Entity).  All vanilla ES6.
 */

// ─────────────────────────────────────────────────────────────
// Boss Type Definitions
// ─────────────────────────────────────────────────────────────

const BOSSES = {
  OVERGROWN_GUARDIAN: {
    name: 'Overgrown Guardian',
    biome: 'FOREST',
    hp: 300, damage: 15, speed: 60,
    size: { w: 56, h: 72 }, color: '#2E7D32',
    arenaColor: '#1a2f1a'
    // Phase 1: Ground pound melee
    // Phase 2: + Vine whip (long range sweep) + summon Grunts
    // Phase 3: + Entangle (roots player) + faster attacks
  },
  SAND_TITAN: {
    name: 'Sand Titan',
    biome: 'DESERT',
    hp: 400, damage: 20, speed: 40,
    size: { w: 64, h: 80 }, color: '#C2A060',
    arenaColor: '#2d2416'
    // Phase 1: Sand slam, sand wave projectile
    // Phase 2: + Burrow (goes underground, surprise attack)
    // Phase 3: + Sandstorm (obscures vision) + quicksand traps
  },
  STORM_WYVERN: {
    name: 'Storm Wyvern',
    biome: 'MOUNTAIN',
    hp: 350, damage: 18, speed: 100,
    size: { w: 72, h: 48 }, color: '#64748B',
    arenaColor: '#1e293b'
    // Phase 1: Dive attacks, wind gust
    // Phase 2: + Lightning strikes (telegraphed AOE)
    // Phase 3: + Tornado (pulls player) + chain lightning
  },
  PESTILENT_ABOMINATION: {
    name: 'Pestilent Abomination',
    biome: 'SWAMP',
    hp: 450, damage: 12, speed: 50,
    size: { w: 60, h: 56 }, color: '#4A5D23',
    arenaColor: '#1a1a10'
    // Phase 1: Sludge toss, poison cloud
    // Phase 2: + Spawn slimes, poison ground
    // Phase 3: + Regeneration + toxic aura (damage over time near boss)
  },
  FROST_COLOSSUS: {
    name: 'Frost Colossus',
    biome: 'ICE',
    hp: 500, damage: 25, speed: 35,
    size: { w: 68, h: 88 }, color: '#CBD5E1',
    arenaColor: '#0f172a'
    // Phase 1: Ice slam, ice shard throw
    // Phase 2: + Freeze beam (slows player) + ice armor (reduced damage)
    // Phase 3: + Blizzard (wind + snow) + shatter AOE
  },
  INFERNO_DEMON: {
    name: 'Inferno Demon',
    biome: 'VOLCANO',
    hp: 600, damage: 22, speed: 80,
    size: { w: 56, h: 72 }, color: '#DC2626',
    arenaColor: '#1a0505'
    // Phase 1: Fire slash, fireball
    // Phase 2: + Dash attack (leaves fire trail) + lava eruption
    // Phase 3: + Meteor rain + hellfire aura + summon imps
  }
};

const PHASE_THRESHOLDS = [0.75, 0.5, 0.25];
const PHASE_TRANSITION_DURATION = 1.5;

// ─────────────────────────────────────────────────────────────
// Boss Class
// ─────────────────────────────────────────────────────────────

/**
 * Boss entity extending Enemy with multi-phase fights, arena mechanics,
 * and cinematic intro / defeat sequences.
 *
 * Phase escalation: each phase adds new attacks while retaining previous ones.
 * Phase 1: basic pattern
 * Phase 2: + new attacks, faster
 * Phase 3: enrage — all attacks, fastest speed, highest damage
 */
class Boss extends Enemy {
  /**
   * @param {number} x — world x (center)
   * @param {number} y — world y (bottom of sprite)
   * @param {string} bossType — key from BOSSES
   */
  constructor(x, y, bossType) {
    super(x, y, 'BOSS');
    this.bossType = bossType;
    this.phases = [...PHASE_THRESHOLDS];
    this.currentPhase = 1;
    this.maxPhase = 3;
    this.introPlayed = false;
    this.defeated = false;

    this.arenaLeft = x - 300;
    this.arenaRight = x + 300;
    this.arenaTop = y - 200;
    this.arenaBottom = y;

    this.fightState = 'WAITING';
    this.fightTimer = 0;
    this.introTimer = 0;
    this.transitionTimer = 0;
    this.isTransitioning = false;
    this.defeatTimer = 0;

    this.arenaLocked = false;
    this.doors = [];

    this.summonCooldown = 0;
    this.minionList = [];
    this.specialAttackTimer = 0;
    this.attackPatternIndex = 0;
    this.attackPatterns = [];

    this.mechanicState = {};

    this.burrowState = 'above';
    this.burrowTimer = 0;
    this.burrowTargetX = 0;

    this.quicksandTraps = [];
    this.poisonZones = [];
    this.hasIceArmor = false;
    this.iceArmorReduction = 0.5;
    this.fireTrail = [];
    this._fireTrailActive = false;
    this.lightningTargets = [];
    this.lightningWarnTimer = 0;
    this.entangleCooldown = 0;

    this.baseDamage = 0;
    this.baseSpeed = 0;
    this.bossName = '';
    this.biome = '';
    this.arenaColor = '';

    this.setBossType(bossType);
    this.width = this.size ? this.size.w : 56;
    this.height = this.size ? this.size.h : 72;
    this.hp = this.maxHP;
    this._buildAttackPatterns();
  }

  // ── Boss Setup ──────────────────────────────────────────

  setBossType(bossType) {
    const def = BOSSES[bossType];
    if (!def) {
      console.warn('Unknown boss type: ' + bossType + ', defaulting to OVERGROWN_GUARDIAN');
      return this.setBossType('OVERGROWN_GUARDIAN');
    }
    this.bossName = def.name;
    this.biome = def.biome;
    this.maxHP = def.hp;
    this.hp = def.hp;
    this.damage = def.damage;
    this.speed = def.speed;
    this.size = { w: def.size.w, h: def.size.h };
    this.width = def.size.w;
    this.height = def.size.h;
    this.color = def.color;
    this.arenaColor = def.arenaColor;
    this.baseDamage = def.damage;
    this.baseSpeed = def.speed;
  }

  setArenaBounds(bounds) {
    this.arenaLeft = bounds.left;
    this.arenaRight = bounds.right;
    this.arenaTop = bounds.top;
    this.arenaBottom = bounds.bottom;
  }

  setDoors(doors) {
    this.doors = doors || [];
  }

  // ── Main Update ─────────────────────────────────────────

  update(dt, player, world) {
    if (!this.active) return;
    switch (this.fightState) {
      case 'WAITING':
        this._updateWaiting(dt, player);
        return;
      case 'INTRO':
        this._updateIntro(dt, player, world);
        return;
      case 'TRANSITION':
        this._updateTransition(dt, player);
        return;
      case 'DEFEATED':
        this._updateDefeated(dt, world);
        return;
      case 'FIGHTING':
        this._updateFighting(dt, player, world);
        break;
    }
  }

  // ── Fight State: WAITING ────────────────────────────────

  _updateWaiting(dt, player) {
    this.state = 'idle';
    this.vx *= 0.9;
    this.vy *= 0.9;
    if (
      player.x >= this.arenaLeft &&
      player.x <= this.arenaRight &&
      player.y >= this.arenaTop &&
      player.y <= this.arenaBottom
    ) {
      this._startIntro();
    }
  }

  // ── Fight State: INTRO ──────────────────────────────────

  _startIntro() {
    this.fightState = 'INTRO';
    this.introTimer = 2.5;
    this.arenaLocked = true;
    this.state = 'intro';
    this._lockDoors();
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:intro', {
        boss: this, bossType: this.bossType, name: this.bossName
      });
      window.GameEvents.emit('system:screenshake', { intensity: 4, duration: 2.0 });
      window.GameEvents.emit('system:hitstop', { duration: 0.5 });
      window.GameEvents.emit('system:notification', {
        message: this.bossName + ' awakens!', type: 'warning'
      });
    }
  }

  _updateIntro(dt, player, world) {
    this.introTimer -= dt;
    if (this.introTimer > 1.5) {
      this.state = 'roar';
    } else if (this.introTimer > 0.5) {
      this.state = 'idle';
    }
    this._applyBossPhysics(dt, world);
    if (this.introTimer <= 0) {
      this.fightState = 'FIGHTING';
      this.introPlayed = true;
      this.currentPhase = 1;
      this._buildAttackPatterns();
      if (typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('boss:phase', { boss: this, phase: 1, name: this.bossName });
      }
    }
  }

  // ── Fight State: FIGHTING ───────────────────────────────

  _updateFighting(dt, player, world) {
    const hpRatio = this.hp / this.maxHP;
    const nextThreshold = this.phases[this.currentPhase - 1];
    if (nextThreshold !== undefined && hpRatio <= nextThreshold && !this.isTransitioning) {
      this._startPhaseTransition(this.currentPhase + 1);
      return;
    }
    this._enforceArenaBounds();
    this._applyBossPhysics(dt, world);
    this.attackTimer -= dt;
    this.summonCooldown -= dt;
    this.specialAttackTimer -= dt;
    this.entangleCooldown -= dt;
    this._updateMechanics(dt, player, world);
    this.executeAttackPattern(dt, player, world);
    this.facingRight = player.x > this.x;
    this.aiState = 'AGGRESSIVE';
  }

  // ── Fight State: TRANSITION ─────────────────────────────

  _startPhaseTransition(newPhase) {
    this.fightState = 'TRANSITION';
    this.isTransitioning = true;
    this.transitionTimer = PHASE_TRANSITION_DURATION;
    this.currentPhase = newPhase;
    this.state = 'transition';
    this.vx = 0;
    this.vy = 0;
    this.flashTimer = PHASE_TRANSITION_DURATION;
    this.flashColor = '#FFFFFF';
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:phase', { boss: this, phase: newPhase, name: this.bossName });
      window.GameEvents.emit('system:hitstop', { duration: PHASE_TRANSITION_DURATION });
      window.GameEvents.emit('system:screenshake', { intensity: 6, duration: PHASE_TRANSITION_DURATION });
      window.GameEvents.emit('system:notification', {
        message: this.bossName + ' — Phase ' + newPhase + '!', type: 'warning'
      });
    }
    this._applyPhaseStats(newPhase);
  }

  _updateTransition(dt, player) {
    this.transitionTimer -= dt;
    this.flashTimer = this.transitionTimer;
    this.flashColor = Math.sin(this.transitionTimer * 10) > 0 ? '#FFFFFF' : this.color;
    if (this.transitionTimer <= 0) {
      this.fightState = 'FIGHTING';
      this.isTransitioning = false;
      this.flashTimer = 0;
      this.flashColor = null;
      this._buildAttackPatterns();
    }
  }

  _applyPhaseStats(phase) {
    const mult = 1.0 + (phase - 1) * 0.15;
    this.speed = Math.floor(this.baseSpeed * mult);
    this.damage = Math.floor(this.baseDamage * mult);
  }

  // ── Fight State: DEFEATED ───────────────────────────────

  _startDefeated() {
    this.fightState = 'DEFEATED';
    this.defeated = true;
    this.defeatTimer = 0;
    this.state = 'defeated';
    this.vx = 0;
    this.vy = 0;
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:hitstop', { duration: 0.3 });
      window.GameEvents.emit('system:screenshake', { intensity: 10, duration: 1.0 });
      window.GameEvents.emit('boss:defeated', { boss: this, bossType: this.bossType, name: this.bossName });
      window.GameEvents.emit('system:notification', {
        message: this.bossName + ' defeated!', type: 'success'
      });
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 200;
        window.GameEvents.emit('renderer:particle', {
          x: this.x, y: this.y - this.height / 2,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
          life: 1.0 + Math.random(), color: this.color,
          size: 4 + Math.random() * 8, gravity: 80, fade: true
        });
      }
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * Math.PI * 2;
        window.GameEvents.emit('renderer:particle', {
          x: this.x, y: this.y - this.height / 2,
          vx: Math.cos(a) * (40 + Math.random() * 80), vy: -100 - Math.random() * 60,
          life: 1.5, color: '#FFD700', size: 3 + Math.random() * 3,
          gravity: 30, fade: true
        });
      }
    }
  }

  _updateDefeated(dt, world) {
    this.defeatTimer += dt;
    if (this.defeatTimer >= 0.5 && this.arenaLocked) {
      this._unlockDoors();
      this.arenaLocked = false;
      this._dropLoot();
    }
    this.opacity = Math.max(0, 1.0 - this.defeatTimer / 2.0);
    this.vy -= 30 * dt;
    if (Math.random() < 0.3 && typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('renderer:particle', {
        x: this.x + (Math.random() - 0.5) * this.width,
        y: this.y - Math.random() * this.height,
        vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30,
        life: 0.8, color: this.color, size: 2 + Math.random() * 4,
        gravity: 20, fade: true
      });
    }
    this._applyBossPhysics(dt, world);
    if (this.defeatTimer >= 3.0) this.active = false;
  }

  onDefeated() {
    if (this.defeated) return;
    this.hp = 0;
    this._startDefeated();
  }

  // ── Arena Management ────────────────────────────────────

  _lockDoors() {
    this.arenaLocked = true;
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:arenaLock', { boss: this, doors: this.doors, locked: true });
    }
  }

  _unlockDoors() {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:arenaLock', { boss: this, doors: this.doors, locked: false });
    }
  }

  _enforceArenaBounds() {
    const margin = this.width / 2;
    if (this.x < this.arenaLeft + margin) {
      this.x = this.arenaLeft + margin;
      this.vx = Math.abs(this.vx) * 0.3;
    }
    if (this.x > this.arenaRight - margin) {
      this.x = this.arenaRight - margin;
      this.vx = -Math.abs(this.vx) * 0.3;
    }
    if (this.y > this.arenaBottom) {
      this.y = this.arenaBottom;
      this.vy = 0;
      this.onGround = true;
    }
    if (this.y < this.arenaTop) {
      this.y = this.arenaTop;
      this.vy = Math.abs(this.vy);
    }
  }

  _dropLoot() {
    const ITEM_DROPS = {
      OVERGROWN_GUARDIAN: 'whispering_seed',
      SAND_TITAN: 'mirage_cloak',
      STORM_WYVERN: 'stone_heart',
      PESTILENT_ABOMINATION: 'murky_amulet',
      FROST_COLOSSUS: 'glacial_core',
      INFERNO_DEMON: 'ember_crown'
    };
    const itemId = ITEM_DROPS[this.bossType];
    if (itemId && typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:loot', {
        boss: this, itemId,
        position: { x: this.x, y: this.y }
      });
    }
  }

  // ── Boss Physics ────────────────────────────────────────

  _applyBossPhysics(dt, world) {
    this.vy += this.gravity * dt;
    if (this.vy > this.terminalVelocity) this.vy = this.terminalVelocity;
    if (this.onGround) this.vx *= this.friction;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= this.arenaBottom) {
      this.y = this.arenaBottom;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    this._enforceArenaBounds();
    if (world && world.isSolid && world.isSolid(this.x, this.y + 2)) {
      const tileSize = world.tileSize || 32;
      this.y = Math.floor((this.y + 2) / tileSize) * tileSize - 2;
      this.vy = 0;
      this.onGround = true;
    }
  }

  // ── Mechanic State Updates ──────────────────────────────

  _updateMechanics(dt, player, world) {
    switch (this.bossType) {
      case 'SAND_TITAN':
        this._updateBurrow(dt, player);
        this._updateQuicksandTraps(dt, player);
        break;
      case 'PESTILENT_ABOMINATION':
        this._updatePoisonZones(dt, player);
        break;
      case 'STORM_WYVERN':
        this._updateLightning(dt, player);
        break;
      case 'FROST_COLOSSUS':
        this._updateIceArmor(dt);
        break;
      case 'INFERNO_DEMON':
        this._updateFireTrail(dt);
        break;
    }
  }

  // ── Attack Pattern Builder ──────────────────────────────

  _buildAttackPatterns() {
    const p = this.currentPhase;
    const patterns = [];
    switch (this.bossType) {
      case 'OVERGROWN_GUARDIAN':
        patterns.push('ground_pound');
        if (p >= 2) patterns.push('vine_whip', 'summon_grunts');
        if (p >= 3) patterns.push('entangle');
        break;
      case 'SAND_TITAN':
        patterns.push('sand_slam', 'sand_wave');
        if (p >= 2) patterns.push('burrow');
        if (p >= 3) patterns.push('sandstorm', 'quicksand');
        break;
      case 'STORM_WYVERN':
        patterns.push('dive_attack', 'wind_gust');
        if (p >= 2) patterns.push('lightning_strike');
        if (p >= 3) patterns.push('tornado', 'chain_lightning');
        break;
      case 'PESTILENT_ABOMINATION':
        patterns.push('sludge_toss', 'poison_cloud');
        if (p >= 2) patterns.push('spawn_slimes', 'poison_ground');
        if (p >= 3) patterns.push('regenerate', 'toxic_aura');
        break;
      case 'FROST_COLOSSUS':
        patterns.push('ice_slam', 'ice_shard');
        if (p >= 2) { patterns.push('freeze_beam'); this.hasIceArmor = true; }
        if (p >= 3) patterns.push('blizzard', 'shatter');
        break;
      case 'INFERNO_DEMON':
        patterns.push('fire_slash', 'fireball');
        if (p >= 2) patterns.push('dash_attack', 'lava_eruption');
        if (p >= 3) patterns.push('meteor_rain', 'hellfire_aura', 'summon_imps');
        break;
    }
    this.attackPatterns = patterns;
    this.attackPatternIndex = 0;
  }

  // ── Attack Pattern Execution ────────────────────────────

  executeAttackPattern(dt, player, world) {
    if (this.attackTimer > 0) return;
    const attack = this.attackPatterns[this.attackPatternIndex];
    this.attackPatternIndex = (this.attackPatternIndex + 1) % this.attackPatterns.length;
    switch (attack) {
      case 'ground_pound': this._executeGroundPound(player); break;
      case 'vine_whip': this._executeVineWhip(player); break;
      case 'summon_grunts': this._executeSummonGrunts(world); break;
      case 'entangle': this._executeEntangle(player); break;
      case 'sand_slam': this._executeSandSlam(player); break;
      case 'sand_wave': this._executeSandWave(player); break;
      case 'burrow': this._executeBurrow(player); break;
      case 'sandstorm': this._executeSandstorm(); break;
      case 'quicksand': this._executeQuicksand(player); break;
      case 'dive_attack': this._executeBossDive(player); break;
      case 'wind_gust': this._executeWindGust(player); break;
      case 'lightning_strike': this._executeLightningStrike(player); break;
      case 'tornado': this._executeTornado(player); break;
      case 'chain_lightning': this._executeChainLightning(player); break;
      case 'sludge_toss': this._executeSludgeToss(player); break;
      case 'poison_cloud': this._executePoisonCloud(player); break;
      case 'spawn_slimes': this._executeSpawnSlimes(world); break;
      case 'poison_ground': this._executePoisonGround(); break;
      case 'regenerate': this._executeRegenerate(); break;
      case 'toxic_aura': break;
      case 'ice_slam': this._executeIceSlam(player); break;
      case 'ice_shard': this._executeIceShard(player); break;
      case 'freeze_beam': this._executeFreezeBeam(player); break;
      case 'blizzard': this._executeBlizzard(); break;
      case 'shatter': this._executeShatter(player); break;
      case 'fire_slash': this._executeFireSlash(player); break;
      case 'fireball': this._executeFireball(player); break;
      case 'dash_attack': this._executeDashAttack(player); break;
      case 'lava_eruption': this._executeLavaEruption(player); break;
      case 'meteor_rain': this._executeMeteorRain(player); break;
      case 'hellfire_aura': break;
      case 'summon_imps': this._executeSummonImps(world); break;
    }
  }

  // ── OVERGROWN_GUARDIAN Attacks ──────────────────────────

  _executeGroundPound(player) {
    this.state = 'attack';
    this.vx = 0;
    const telegraphTime = this.currentPhase >= 3 ? 0.4 : 0.7;
    const self = this;
    const timeoutId = setTimeout(function () {
      clearTimeout(timeoutId);
      if (!self.active || self.fightState !== 'FIGHTING') return;
      const aoeW = 90;
      const aoeH = 35;
      const hitbox = {
        owner: self, x: self.x - aoeW / 2, y: self.y - 15,
        w: aoeW, h: aoeH, damage: self.damage,
        knockback: { x: 350, y: -200 },
        type: 'boss_slam', duration: 0.15
      };
      self._emitHitbox(hitbox);
      self._emitScreenshake(8, 0.35);
      self._emitHitstop(0.15);
      self._spawnGroundParticles(15, '#2E7D32');
      const dist = Math.abs(player.x - self.x);
      if (dist < aoeW / 2) {
        self._damagePlayer(player, self.damage, {
          x: player.x > self.x ? 350 : -350, y: -200
        });
      }
    }, telegraphTime * 1000);
    this.attackTimer = this.currentPhase >= 3 ? 1.2 : 1.8;
  }

  _executeVineWhip(player) {
    this.state = 'attack';
    const facing = player.x > this.x ? 1 : -1;
    this.facingRight = facing > 0;
    const whipReach = 160;
    const hitbox = {
      owner: this, x: this.x + facing * 30,
      y: this.y - this.height * 0.5,
      w: whipReach, h: 25,
      damage: Math.floor(this.damage * 0.8),
      knockback: { x: facing * 250, y: -120 },
      type: 'vine_whip', duration: 0.2
    };
    this._emitHitbox(hitbox);
    this._emitScreenshake(4, 0.2);
    this._spawnGroundParticles(8, '#4CAF50');
    const dist = Math.abs(player.x - (this.x + facing * 30));
    if (dist < whipReach) {
      this._damagePlayer(player, Math.floor(this.damage * 0.8), {
        x: facing * 250, y: -120
      });
    }
    this.attackTimer = 2.0;
  }

  _executeSummonGrunts(world) {
    this.state = 'cast';
    if (this.summonCooldown > 0) { this.attackTimer = 0.5; return; }
    const spawnCount = this.currentPhase >= 3 ? 3 : 2;
    if (typeof window !== 'undefined' && window.GameEvents) {
      for (let i = 0; i < spawnCount; i++) {
        const offsetX = (Math.random() - 0.5) * 200;
        const spawnX = Math.max(this.arenaLeft + 30,
          Math.min(this.arenaRight - 30, this.x + offsetX));
        window.GameEvents.emit('boss:summon', {
          boss: this, enemyType: 'GRUNT',
          position: { x: spawnX, y: this.arenaBottom }
        });
      }
      this._spawnGroundParticles(10, '#2E7D32');
      this._emitScreenshake(3, 0.2);
    }
    this.summonCooldown = 8.0;
    this.attackTimer = 1.5;
  }

  _executeEntangle(player) {
    if (this.entangleCooldown > 0) { this.attackTimer = 0.5; return; }
    this.state = 'cast';
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:debuff', {
        boss: this, type: 'entangle', target: player,
        duration: 3.0, position: { x: player.x, y: player.y }
      });
      this._spawnGroundParticles(12, '#1B5E20');
      this._emitScreenshake(3, 0.25);
    }
    this.entangleCooldown = 10.0;
    this.attackTimer = 2.0;
  }

  // ── SAND_TITAN Attacks ──────────────────────────────────

  _executeSandSlam(player) {
    this.state = 'attack';
    const facing = player.x > this.x ? 1 : -1;
    this.facingRight = facing > 0;
    const hitbox = {
      owner: this, x: this.x + facing * 20 - 15, y: this.y - 25,
      w: 50, h: 35, damage: this.damage,
      knockback: { x: facing * 300, y: -180 },
      type: 'sand_slam', duration: 0.15
    };
    this._emitHitbox(hitbox);
    this._emitScreenshake(7, 0.3);
    this._spawnGroundParticles(10, '#C2A060');
    if (Math.abs(player.x - (this.x + facing * 20)) < 35) {
      this._damagePlayer(player, this.damage, { x: facing * 300, y: -180 });
    }
    this.attackTimer = 1.8;
  }

  _executeSandWave(player) {
    this.state = 'attack';
    const facing = player.x > this.x ? 1 : -1;
    this.facingRight = facing > 0;
    const proj = {
      x: this.x + facing * 35, y: this.y - 8,
      vx: facing * 200, vy: 0, gravity: 0,
      damage: Math.floor(this.damage * 0.7),
      owner: this, ownerType: 'enemy', type: 'sand_wave',
      lifetime: 3.0, width: 40, height: 16,
      color: '#C2A060', groundHug: true
    };
    this._emitProjectile(proj);
    this._spawnGroundParticles(6, '#C2A060');
    this.attackTimer = 2.0;
  }

  _executeBurrow(player) {
    if (this.burrowState !== 'above') { this.attackTimer = 0.5; return; }
    this.state = 'burrow';
    this.burrowState = 'burrowing';
    this.burrowTimer = 1.0;
    this.burrowTargetX = player.x;
    this._spawnGroundParticles(10, '#C2A060');
    this._emitScreenshake(3, 0.3);
    this.attackTimer = 3.0;
  }

  _updateBurrow(dt, player) {
    switch (this.burrowState) {
      case 'burrowing':
        this.burrowTimer -= dt;
        this.opacity = Math.max(0.1, this.burrowTimer);
        if (this.burrowTimer <= 0) {
          this.burrowState = 'underground';
          this.burrowTimer = 1.5;
          this.opacity = 0;
          this.x = player.x + (Math.random() - 0.5) * 60;
        }
        break;
      case 'underground':
        this.burrowTimer -= dt;
        if (this.burrowTimer <= 0) {
          this.burrowState = 'emerging';
          this.burrowTimer = 0.5;
          this.x = Math.max(this.arenaLeft + 40,
            Math.min(this.arenaRight - 40, player.x + (Math.random() - 0.5) * 40));
          this.opacity = 1;
        }
        break;
      case 'emerging':
        this.burrowTimer -= dt;
        if (this.burrowTimer <= 0.1 && this.burrowTimer > 0) {
          const aoeW = 80;
          const hitbox = {
            owner: this, x: this.x - aoeW / 2, y: this.y - 20,
            w: aoeW, h: 30,
            damage: Math.floor(this.damage * 1.3),
            knockback: { x: 300, y: -250 },
            type: 'burrow_emerge', duration: 0.2
          };
          this._emitHitbox(hitbox);
          this._emitScreenshake(8, 0.35);
          this._spawnGroundParticles(15, '#C2A060');
          const dist = Math.abs(player.x - this.x);
          if (dist < aoeW / 2) {
            this._damagePlayer(player, Math.floor(this.damage * 1.3), {
              x: player.x > this.x ? 300 : -300, y: -250
            });
          }
        }
        if (this.burrowTimer <= 0) this.burrowState = 'above';
        break;
    }
  }

  _executeSandstorm() {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:environment', {
        boss: this, type: 'sandstorm', duration: 8.0,
        arena: { left: this.arenaLeft, right: this.arenaRight,
          top: this.arenaTop, bottom: this.arenaBottom }
      });
      this._emitScreenshake(2, 8.0);
    }
    this.attackTimer = 10.0;
  }

  _executeQuicksand(player) {
    this.state = 'cast';
    const trap = {
      x: player.x, y: this.arenaBottom,
      radius: 35, lifetime: 8.0, timer: 8.0
    };
    this.quicksandTraps.push(trap);
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:trap', { boss: this, type: 'quicksand', trap });
    }
    this.attackTimer = 5.0;
  }

  _updateQuicksandTraps(dt, player) {
    for (let i = this.quicksandTraps.length - 1; i >= 0; i--) {
      const trap = this.quicksandTraps[i];
      trap.timer -= dt;
      if (trap.timer <= 0) { this.quicksandTraps.splice(i, 1); continue; }
      const dx = player.x - trap.x;
      const dy = player.y - trap.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < trap.radius && typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('boss:debuff', {
          boss: this, type: 'quicksand_slow', target: player, slowFactor: 0.4
        });
      }
    }
  }

  // ── STORM_WYVERN Attacks ────────────────────────────────

  _executeBossDive(player) {
    this.state = 'dive';
    this.vy = -400;
    this.onGround = false;
    const self = this;
    setTimeout(function () {
      if (!self.active || self.fightState !== 'FIGHTING') return;
      const dx = player.x - self.x;
      const dy = player.y - self.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = 500;
      self.vx = (dx / dist) * speed;
      self.vy = Math.abs((dy / dist) * speed) + 100;
      setTimeout(function () {
        if (!self.active || self.fightState !== 'FIGHTING') return;
        if (self.onGround || Math.abs(self.y - self.arenaBottom) < 10) {
          const aoeW = 70;
          const hitbox = {
            owner: self, x: self.x - aoeW / 2, y: self.y - 20,
            w: aoeW, h: 25, damage: self.damage,
            knockback: { x: 300, y: -200 },
            type: 'dive_impact', duration: 0.15
          };
          self._emitHitbox(hitbox);
          self._emitScreenshake(7, 0.3);
          self._spawnGroundParticles(12, '#64748B');
          const pDist = Math.abs(player.x - self.x);
          if (pDist < aoeW / 2) {
            self._damagePlayer(player, self.damage, {
              x: player.x > self.x ? 300 : -300, y: -200
            });
          }
        }
      }, 400);
    }, 600);
    this.attackTimer = 2.5;
  }

  _executeWindGust(player) {
    this.state = 'attack';
    const facing = player.x > this.x ? 1 : -1;
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:force', {
        boss: this, type: 'wind_gust', target: player,
        forceX: facing * 500, forceY: -100, duration: 0.5
      });
      this._spawnGroundParticles(8, '#B0BEC5');
    }
    this.attackTimer = 2.0;
  }

  _executeLightningStrike(player) {
    this.state = 'cast';
    this.lightningTargets.push({
      x: player.x, y: player.y, timer: 1.0, warning: true
    });
    this.attackTimer = 2.5;
  }

  _updateLightning(dt, player) {
    for (let i = this.lightningTargets.length - 1; i >= 0; i--) {
      const lt = this.lightningTargets[i];
      lt.timer -= dt;
      if (lt.timer <= 0 && lt.warning) {
        lt.warning = false;
        lt.timer = 0.2;
        const hitbox = {
          owner: this, x: lt.x - 20, y: lt.y - 30,
          w: 40, h: 50, damage: Math.floor(this.damage * 1.2),
          knockback: { x: 0, y: -300 },
          type: 'lightning', duration: 0.15
        };
        this._emitHitbox(hitbox);
        this._emitScreenshake(6, 0.2);
        if (typeof window !== 'undefined' && window.GameEvents) {
          window.GameEvents.emit('renderer:particle', {
            x: lt.x, y: lt.y, vx: 0, vy: -200,
            life: 0.3, color: '#FFEB3B', size: 20, gravity: 0, fade: true
          });
        }
        const dx = player.x - lt.x;
        const dy = player.y - lt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 25) {
          this._damagePlayer(player, Math.floor(this.damage * 1.2), { x: 0, y: -300 });
        }
      } else if (lt.timer <= 0 && !lt.warning) {
        this.lightningTargets.splice(i, 1);
      }
    }
  }

  _executeTornado(player) {
    this.state = 'cast';
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:force', {
        boss: this, type: 'tornado_pull', target: player,
        pullX: this.x, pullY: this.y, strength: 200, duration: 5.0
      });
      this._emitScreenshake(2, 5.0);
    }
    this.attackTimer = 7.0;
  }

  _executeChainLightning(player) {
    this.state = 'cast';
    const strikes = [{ x: player.x, y: player.y }];
    if (this.minionList) {
      this.minionList.forEach(function (m) {
        if (m.active) strikes.push({ x: m.x, y: m.y });
      });
    }
    const self = this;
    strikes.forEach(function (strike, i) {
      setTimeout(function () {
        if (!self.active || self.fightState !== 'FIGHTING') return;
        const hitbox = {
          owner: self, x: strike.x - 18, y: strike.y - 25,
          w: 36, h: 40, damage: Math.floor(self.damage * 0.7),
          knockback: { x: 0, y: -200 },
          type: 'chain_lightning', duration: 0.1
        };
        self._emitHitbox(hitbox);
        if (typeof window !== 'undefined' && window.GameEvents) {
          window.GameEvents.emit('renderer:particle', {
            x: strike.x, y: strike.y, vx: 0, vy: -150,
            life: 0.2, color: '#FFEB3B', size: 15, gravity: 0, fade: true
          });
        }
      }, i * 150);
    });
    this._emitScreenshake(4, strikes.length * 0.15);
    this.attackTimer = 3.5;
  }


  // ── PESTILENT_ABOMINATION Attacks ───────────────────────

  _executeSludgeToss(player) {
    this.state = 'attack';
    const dx = player.x - this.x;
    const dy = player.y - (this.y - this.height);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const proj = {
      x: this.x, y: this.y - this.height * 0.6,
      vx: (dx / dist) * 150, vy: -200, gravity: 500,
      damage: Math.floor(this.damage * 0.6),
      owner: this, ownerType: 'enemy', type: 'sludge',
      lifetime: 3.0, width: 14, height: 14,
      color: '#689F38', onHitGround: 'poison_pool'
    };
    this._emitProjectile(proj);
    this.attackTimer = 1.8;
  }

  _executePoisonCloud(player) {
    this.state = 'cast';
    const cloud = {
      x: player.x, y: player.y,
      radius: 50, lifetime: 5.0, timer: 5.0, damage: 3
    };
    this.poisonZones.push(cloud);
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:zone', { boss: this, type: 'poison_cloud', zone: cloud });
    }
    this.attackTimer = 4.0;
  }

  _executeSpawnSlimes(world) {
    this.state = 'cast';
    if (this.summonCooldown > 0) { this.attackTimer = 0.5; return; }
    const count = 2;
    if (typeof window !== 'undefined' && window.GameEvents) {
      for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * 150;
        const spawnX = Math.max(this.arenaLeft + 20,
          Math.min(this.arenaRight - 20, this.x + offsetX));
        window.GameEvents.emit('boss:summon', {
          boss: this, enemyType: 'GRUNT',
          position: { x: spawnX, y: this.arenaBottom },
          overrideColor: '#8BC34A'
        });
      }
    }
    this.summonCooldown = 10.0;
    this.attackTimer = 2.0;
  }

  _executePoisonGround() {
    this.state = 'cast';
    for (let i = 0; i < 3; i++) {
      const px = this.arenaLeft + ((i + 0.5) / 3) * (this.arenaRight - this.arenaLeft);
      this.poisonZones.push({
        x: px, y: this.arenaBottom,
        radius: 40, lifetime: 8.0, timer: 8.0, damage: 2
      });
    }
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:zone', { boss: this, type: 'poison_ground' });
    }
    this.attackTimer = 6.0;
  }

  _executeRegenerate() {
    this.state = 'cast';
    const healAmount = Math.floor(this.maxHP * 0.05);
    this.hp = Math.min(this.maxHP, this.hp + healAmount);
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:heal', {
        boss: this, amount: healAmount,
        position: { x: this.x, y: this.y - this.height }
      });
      this._spawnGroundParticles(8, '#4CAF50');
    }
    this.attackTimer = 5.0;
  }

  _updatePoisonZones(dt, player) {
    for (let i = this.poisonZones.length - 1; i >= 0; i--) {
      const zone = this.poisonZones[i];
      zone.timer -= dt;
      if (zone.timer <= 0) { this.poisonZones.splice(i, 1); continue; }
      const dx = player.x - zone.x;
      const dy = player.y - zone.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < zone.radius) {
        const tickDamage = zone.damage * dt;
        this._damagePlayer(player, tickDamage, { x: 0, y: 0 }, true);
      }
    }
    if (this.currentPhase >= 3) {
      const distToBoss = Math.abs(player.x - this.x);
      if (distToBoss < 60) {
        this._damagePlayer(player, 4 * dt, { x: 0, y: 0 }, true);
      }
    }
  }

  // ── FROST_COLOSSUS Attacks ──────────────────────────────

  _executeIceSlam(player) {
    this.state = 'attack';
    const facing = player.x > this.x ? 1 : -1;
    this.facingRight = facing > 0;
    this.vx = 0;
    const hitbox = {
      owner: this, x: this.x + facing * 25 - 20, y: this.y - 30,
      w: 55, h: 40, damage: this.damage,
      knockback: { x: facing * 250, y: -150 },
      type: 'ice_slam', duration: 0.18, effect: 'slow'
    };
    this._emitHitbox(hitbox);
    this._emitScreenshake(8, 0.35);
    this._spawnGroundParticles(12, '#E0F7FA');
    if (Math.abs(player.x - (this.x + facing * 25)) < 35) {
      this._damagePlayer(player, this.damage, { x: facing * 250, y: -150 });
    }
    this.attackTimer = 2.0;
  }

  _executeIceShard(player) {
    this.state = 'attack';
    const dx = player.x - this.x;
    const dy = player.y - (this.y - this.height * 0.5);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const proj = {
      x: this.x, y: this.y - this.height * 0.5,
      vx: (dx / dist) * 220, vy: (dy / dist) * 220, gravity: 100,
      damage: Math.floor(this.damage * 0.7),
      owner: this, ownerType: 'enemy', type: 'ice_shard',
      lifetime: 2.5, width: 12, height: 12, color: '#B3E5FC'
    };
    this._emitProjectile(proj);
    this.attackTimer = 1.5;
  }

  _executeFreezeBeam(player) {
    this.state = 'cast';
    const facing = player.x > this.x ? 1 : -1;
    this.facingRight = facing > 0;
    const beamLen = 140;
    const hitbox = {
      owner: this, x: this.x + facing * 10,
      y: this.y - this.height * 0.4,
      w: beamLen, h: 20,
      damage: Math.floor(this.damage * 0.4),
      knockback: { x: facing * 50, y: 0 },
      type: 'freeze_beam', duration: 1.0, effect: 'slow'
    };
    this._emitHitbox(hitbox);
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:debuff', {
        boss: this, type: 'freeze_slow', target: player, duration: 3.0
      });
    }
    this.attackTimer = 3.0;
  }

  _updateIceArmor(dt) {
    if (this.currentPhase >= 2 && this.hasIceArmor) {
      // Damage reduction handled in takeDamage override
    }
  }

  takeDamage(amount, source) {
    if (this.hasIceArmor && this.currentPhase >= 2) {
      amount = Math.floor(amount * (1 - this.iceArmorReduction));
    }
    Enemy.prototype.takeDamage.call(this, amount, source);
    if (this.hp <= 0 && !this.defeated) {
      this.hp = 0;
      this.onDefeated();
    }
  }

  _executeBlizzard() {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:environment', {
        boss: this, type: 'blizzard', duration: 8.0
      });
      window.GameEvents.emit('boss:force', {
        boss: this, type: 'wind_push',
        forceX: (Math.random() > 0.5 ? 1 : -1) * 150, duration: 8.0
      });
      this._emitScreenshake(1, 8.0);
    }
    this.attackTimer = 10.0;
  }

  _executeShatter(player) {
    this.state = 'cast';
    this.vx = 0;
    const aoeW = 120;
    const hitbox = {
      owner: this, x: this.x - aoeW / 2, y: this.y - 25,
      w: aoeW, h: 40,
      damage: Math.floor(this.damage * 1.5),
      knockback: { x: 400, y: -250 },
      type: 'shatter', duration: 0.2
    };
    const self = this;
    setTimeout(function () {
      if (!self.active || self.fightState !== 'FIGHTING') return;
      self._emitHitbox(hitbox);
      self._emitScreenshake(10, 0.5);
      self._emitHitstop(0.2);
      self._spawnGroundParticles(20, '#E0F7FA');
      const dist = Math.abs(player.x - self.x);
      if (dist < aoeW / 2) {
        self._damagePlayer(player, Math.floor(self.damage * 1.5), {
          x: player.x > self.x ? 400 : -400, y: -250
        });
      }
    }, 600);
    this.attackTimer = 3.5;
  }

  // ── INFERNO_DEMON Attacks ───────────────────────────────

  _executeFireSlash(player) {
    this.state = 'attack';
    const facing = player.x > this.x ? 1 : -1;
    this.facingRight = facing > 0;
    const hitbox = {
      owner: this, x: this.x + facing * 22 - 18, y: this.y - 25,
      w: 50, h: 35, damage: this.damage,
      knockback: { x: facing * 280, y: -120 },
      type: 'fire_slash', duration: 0.15
    };
    this._emitHitbox(hitbox);
    this._emitScreenshake(5, 0.2);
    this._spawnGroundParticles(8, '#FF5722');
    if (Math.abs(player.x - (this.x + facing * 22)) < 30) {
      this._damagePlayer(player, this.damage, { x: facing * 280, y: -120 });
    }
    this.attackTimer = 1.2;
  }

  _executeFireball(player) {
    this.state = 'attack';
    const dx = player.x - this.x;
    const dy = player.y - (this.y - this.height * 0.5);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const proj = {
      x: this.x, y: this.y - this.height * 0.5,
      vx: (dx / dist) * 250, vy: (dy / dist) * 250, gravity: 0,
      homing: true, homingStrength: 1.5, target: player, speed: 250,
      damage: Math.floor(this.damage * 0.8),
      owner: this, ownerType: 'enemy', type: 'fireball',
      lifetime: 3.0, width: 14, height: 14, color: '#FF5722'
    };
    this._emitProjectile(proj);
    this.attackTimer = 1.5;
  }

  _executeDashAttack(player) {
    this.state = 'dash';
    const facing = player.x > this.x ? 1 : -1;
    this.facingRight = facing > 0;
    const dashSpeed = 500;
    this.vx = facing * dashSpeed;
    this.vy = 0;
    this._startFireTrail();
    const hitbox = {
      owner: this, x: this.x - 20, y: this.y - 25,
      w: 50, h: 35,
      damage: Math.floor(this.damage * 1.2),
      knockback: { x: facing * 350, y: -100 },
      type: 'dash_attack', duration: 0.3
    };
    this._emitHitbox(hitbox);
    const self = this;
    setTimeout(function () {
      self.vx *= 0.3;
      self._stopFireTrail();
    }, 300);
    this._emitScreenshake(4, 0.3);
    this.attackTimer = 2.5;
  }

  _startFireTrail() { this._fireTrailActive = true; }
  _stopFireTrail() { this._fireTrailActive = false; }

  _updateFireTrail(dt) {
    if (!this._fireTrailActive) return;
    if (Math.random() < dt * 10) {
      this.fireTrail.push({
        x: this.x, y: this.y, radius: 18,
        lifetime: 3.0, timer: 3.0, damage: 2
      });
    }
    for (let i = this.fireTrail.length - 1; i >= 0; i--) {
      const ft = this.fireTrail[i];
      ft.timer -= dt;
      if (ft.timer <= 0) this.fireTrail.splice(i, 1);
    }
  }

  _executeLavaEruption(player) {
    this.state = 'cast';
    const eruptionX = player.x;
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:warning', {
        boss: this, type: 'lava_eruption',
        x: eruptionX, y: this.arenaBottom, duration: 0.8
      });
    }
    const self = this;
    setTimeout(function () {
      if (!self.active || self.fightState !== 'FIGHTING') return;
      const hitbox = {
        owner: self, x: eruptionX - 20, y: self.arenaBottom - 60,
        w: 40, h: 60,
        damage: Math.floor(self.damage * 1.3),
        knockback: { x: 0, y: -350 },
        type: 'lava_eruption', duration: 0.3
      };
      self._emitHitbox(hitbox);
      self._emitScreenshake(7, 0.3);
      const dist = Math.abs(player.x - eruptionX);
      if (dist < 25) {
        self._damagePlayer(player, Math.floor(self.damage * 1.3), { x: 0, y: -350 });
      }
    }, 800);
    this.attackTimer = 3.0;
  }

  _executeMeteorRain(player) {
    this.state = 'cast';
    const meteorCount = 5 + this.currentPhase;
    const self = this;
    for (let i = 0; i < meteorCount; i++) {
      setTimeout(function () {
        if (!self.active || self.fightState !== 'FIGHTING') return;
        const targetX = player.x + (Math.random() - 0.5) * 120;
        const proj = {
          x: targetX, y: self.arenaTop - 50,
          vx: (Math.random() - 0.5) * 40,
          vy: 300 + Math.random() * 150, gravity: 200,
          damage: Math.floor(self.damage * 0.6),
          owner: self, ownerType: 'enemy', type: 'meteor',
          lifetime: 2.0, width: 16, height: 16,
          color: '#FF3D00', onHitGround: 'fire_pool'
        };
        self._emitProjectile(proj);
      }, i * 250);
    }
    this._emitScreenshake(3, meteorCount * 0.25);
    this.attackTimer = 5.0;
  }

  _executeSummonImps(world) {
    this.state = 'cast';
    if (this.summonCooldown > 0) { this.attackTimer = 0.5; return; }
    const count = 3;
    if (typeof window !== 'undefined' && window.GameEvents) {
      for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * 180;
        const spawnX = Math.max(this.arenaLeft + 20,
          Math.min(this.arenaRight - 20, this.x + offsetX));
        window.GameEvents.emit('boss:summon', {
          boss: this, enemyType: 'FLYER',
          position: { x: spawnX, y: this.arenaBottom - 30 }
        });
      }
      this._spawnGroundParticles(12, '#FF5722');
    }
    this.summonCooldown = 12.0;
    this.attackTimer = 2.0;
  }

  // ── Shared Helpers ──────────────────────────────────────

  _emitHitbox(hitbox) {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:hitbox', { hitbox });
    }
  }

  _emitProjectile(proj) {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('combat:projectile', { projectile: proj });
    }
    this._pendingProjectiles = this._pendingProjectiles || [];
    this._pendingProjectiles.push(proj);
  }

  _emitScreenshake(intensity, duration) {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:screenshake', { intensity, duration });
    }
  }

  _emitHitstop(duration) {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:hitstop', { duration });
    }
  }

  _spawnGroundParticles(count, color) {
    if (typeof window === 'undefined' || !window.GameEvents) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI;
      const speed = 50 + Math.random() * 120;
      window.GameEvents.emit('renderer:particle', {
        x: this.x + (Math.random() - 0.5) * 40, y: this.y,
        vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
        vy: -Math.abs(Math.sin(angle) * speed),
        life: 0.4 + Math.random() * 0.4,
        color, size: 3 + Math.random() * 4,
        gravity: 200, fade: true
      });
    }
  }

  _damagePlayer(player, amount, knockback, isDot) {
    if (!player) return;
    isDot = isDot || false;
    if (player.aiState === 'DEAD') return;
    if (player.invincible && !isDot) return;
    if (player.isDodging && player.dodgeTimer > 0 && !isDot) return;
    if (typeof player.takeDamage === 'function') {
      player.takeDamage(Math.floor(amount), this);
    }
    if (knockback) {
      if (player.knockbackVx !== undefined) player.knockbackVx = knockback.x;
      if (player.knockbackVy !== undefined) player.knockbackVy = knockback.y;
    }
  }

  // ── Phase Transition (Public) ───────────────────────────

  enterPhase(phaseNum) {
    if (phaseNum < 1 || phaseNum > this.maxPhase) return;
    this.currentPhase = phaseNum;
    this._applyPhaseStats(phaseNum);
    this._buildAttackPatterns();
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('boss:phase', {
        boss: this, phase: phaseNum, name: this.bossName
      });
    }
  }

  // ── Rendering ───────────────────────────────────────────

  render(renderer) {
    if (!this.active) return;
    const ctx = renderer.ctx;
    ctx.save();
    if (this.opacity < 1) ctx.globalAlpha = this.opacity;
    if (this.isTransitioning && this.flashTimer > 0) {
      const flashIntensity = 0.3 + (this.flashTimer / PHASE_TRANSITION_DURATION) * 0.7;
      ctx.globalAlpha *= flashIntensity;
    }
    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;
    const halfW = w / 2;
    const dx = x - halfW;
    const dy = y - h;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y, halfW * 1.1, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const bodyColor = (this.flashTimer > 0) ? (this.flashColor || '#FFFFFF') : this.color;
    ctx.fillStyle = bodyColor;
    this._drawBossBody(ctx, dx, dy, w, h);

    if (this.currentPhase >= 2 && !this.isTransitioning) {
      const glowIntensity = 0.08 + Math.sin(Date.now() / 300) * 0.04;
      ctx.fillStyle = 'rgba(255,255,255,' + glowIntensity + ')';
      ctx.beginPath();
      ctx.ellipse(x, dy + h / 2, halfW * 1.3, h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.currentPhase >= 3 && !this.isTransitioning) {
      const auraAlpha = 0.1 + Math.sin(Date.now() / 150) * 0.05;
      ctx.fillStyle = 'rgba(255,0,0,' + auraAlpha + ')';
      ctx.beginPath();
      ctx.ellipse(x, dy + h / 2, halfW * 1.2, h * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this._drawBossOverlays(ctx, dx, dy, w, h, halfW);
    this._drawBossHealthBar(ctx, x, dy, w);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.bossName, x, dy - 16);

    if (this.currentPhase > 1) {
      ctx.fillStyle = '#FFD700';
      ctx.font = '9px sans-serif';
      ctx.fillText('PHASE ' + this.currentPhase, x, dy - 6);
    }

    if (this.bossType === 'SAND_TITAN' && this.burrowState === 'underground') {
      ctx.fillStyle = 'rgba(194,160,96,0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.fightState === 'INTRO') {
      ctx.fillStyle = '#FFEB3B';
      ctx.font = '10px sans-serif';
      ctx.fillText('!', x, dy - 24);
    }

    ctx.restore();
    this._renderEnvironmentEffects(renderer);
  }

  _drawBossBody(ctx, dx, dy, w, h) {
    ctx.beginPath();
    const radius = 6;
    ctx.moveTo(dx + radius, dy);
    ctx.lineTo(dx + w - radius, dy);
    ctx.quadraticCurveTo(dx + w, dy, dx + w, dy + radius);
    ctx.lineTo(dx + w, dy + h - radius);
    ctx.quadraticCurveTo(dx + w, dy + h, dx + w - radius, dy + h);
    ctx.lineTo(dx + radius, dy + h);
    ctx.quadraticCurveTo(dx, dy + h, dx, dy + h - radius);
    ctx.lineTo(dx, dy + radius);
    ctx.quadraticCurveTo(dx, dy, dx + radius, dy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const eyeY = dy + h * 0.22;
    const eyeSizeW = 5;
    const eyeSizeH = 6;
    const eyeGlow = 'rgba(255,50,50,0.6)';

    ctx.fillStyle = eyeGlow;
    if (this.facingRight) {
      ctx.beginPath(); ctx.ellipse(dx + w * 0.58, eyeY + 3, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(dx + w * 0.78, eyeY + 3, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(dx + w * 0.18, eyeY + 3, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(dx + w * 0.38, eyeY + 3, 7, 8, 0, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#FFFFFF';
    if (this.facingRight) {
      ctx.fillRect(dx + w * 0.55, eyeY, eyeSizeW, eyeSizeH);
      ctx.fillRect(dx + w * 0.75, eyeY, eyeSizeW, eyeSizeH);
      ctx.fillStyle = '#000000';
      ctx.fillRect(dx + w * 0.58, eyeY + 2, 3, 3);
      ctx.fillRect(dx + w * 0.78, eyeY + 2, 3, 3);
    } else {
      ctx.fillRect(dx + w * 0.15, eyeY, eyeSizeW, eyeSizeH);
      ctx.fillRect(dx + w * 0.35, eyeY, eyeSizeW, eyeSizeH);
      ctx.fillStyle = '#000000';
      ctx.fillRect(dx + w * 0.15, eyeY + 2, 3, 3);
      ctx.fillRect(dx + w * 0.35, eyeY + 2, 3, 3);
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const mouthY = dy + h * 0.55;
    const mouthW = w * 0.3;
    if (this.fightState === 'INTRO' || this.state === 'roar') {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(this.x, mouthY, mouthW / 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(this.x - mouthW / 2, mouthY);
      ctx.lineTo(this.x + mouthW / 2, mouthY);
      ctx.stroke();
    }
  }

  _drawBossOverlays(ctx, dx, dy, w, h, halfW) {
    switch (this.bossType) {
      case 'OVERGROWN_GUARDIAN': {
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.1, dy);
        ctx.quadraticCurveTo(dx - 8, dy + h * 0.3, dx + w * 0.15, dy + h * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.9, dy);
        ctx.quadraticCurveTo(dx + w + 8, dy + h * 0.3, dx + w * 0.85, dy + h * 0.5);
        ctx.stroke();
        ctx.fillStyle = '#66BB6A';
        ctx.beginPath();
        ctx.ellipse(dx - 4, dy + h * 0.25, 4, 2, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(dx + w + 4, dy + h * 0.25, 4, 2, -Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'SAND_TITAN': {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const ly = dy + h * (0.3 + i * 0.2);
          ctx.beginPath();
          ctx.moveTo(dx + w * 0.1, ly);
          ctx.lineTo(dx + w * 0.9, ly + (i % 2 === 0 ? 3 : -3));
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(dx + w * 0.2, dy + h * 0.35, w * 0.6, h * 0.15);
        break;
      }
      case 'STORM_WYVERN': {
        const wingFlap = Math.sin(Date.now() / 120) * 15;
        ctx.fillStyle = '#546E7A';
        ctx.beginPath();
        ctx.moveTo(dx, dy + h * 0.3);
        ctx.quadraticCurveTo(dx - 30 + wingFlap, dy + h * 0.1, dx - 20 + wingFlap, dy + h * 0.5);
        ctx.lineTo(dx, dy + h * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(dx + w, dy + h * 0.3);
        ctx.quadraticCurveTo(dx + w + 30 - wingFlap, dy + h * 0.1, dx + w + 20 - wingFlap, dy + h * 0.5);
        ctx.lineTo(dx + w, dy + h * 0.45);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'PESTILENT_ABOMINATION': {
        ctx.fillStyle = '#689F38';
        const growthP = Date.now() / 500;
        ctx.beginPath();
        ctx.arc(dx + w * 0.3, dy + h * 0.4, 4 + Math.sin(growthP) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dx + w * 0.7, dy + h * 0.35, 3 + Math.cos(growthP) * 1, 0, Math.PI * 2);
        ctx.fill();
        const dripY = (Date.now() % 2000) / 2000 * h * 0.3;
        ctx.fillStyle = '#8BC34A';
        ctx.beginPath();
        ctx.arc(dx + w * 0.3, dy + h * 0.4 + dripY, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'FROST_COLOSSUS': {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.5, dy + h * 0.15);
        ctx.lineTo(dx + w * 0.6, dy + h * 0.3);
        ctx.lineTo(dx + w * 0.4, dy + h * 0.3);
        ctx.closePath();
        ctx.fill();
        if (this.hasIceArmor && this.currentPhase >= 2) {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 2;
          ctx.strokeRect(dx + 2, dy + 2, w - 4, h - 4);
        }
        break;
      }
      case 'INFERNO_DEMON': {
        const flicker = Math.sin(Date.now() / 50) * 0.1 + 0.15;
        ctx.fillStyle = 'rgba(255,100,0,' + flicker + ')';
        ctx.beginPath();
        ctx.ellipse(this.x, dy + h + 3, halfW, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.2, dy);
        ctx.lineTo(dx + w * 0.15, dy - 12);
        ctx.lineTo(dx + w * 0.3, dy + 3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(dx + w * 0.8, dy);
        ctx.lineTo(dx + w * 0.85, dy - 12);
        ctx.lineTo(dx + w * 0.7, dy + 3);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
  }

  _drawBossHealthBar(ctx, x, dy, w) {
    if (this.fightState === 'WAITING') return;
    const barW = w + 20;
    const barH = 6;
    const bx = x - barW / 2;
    const by = dy - 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, barW, barH);
    for (let t = 0; t < this.phases.length; t++) {
      const tx = bx + barW * (1 - this.phases[t]);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(tx - 1, by, 2, barH);
    }
    const ratio = Math.max(0, this.hp / this.maxHP);
    let r, g;
    if (this.currentPhase >= 3) { r = 220; g = 20; }
    else if (this.currentPhase >= 2) { r = 220; g = 120; }
    else { r = Math.floor(255 * (1 - ratio)); g = Math.floor(255 * ratio); }
    ctx.fillStyle = 'rgb(' + r + ',' + g + ',0)';
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(this.hp) + '/' + this.maxHP, x, by + barH + 9);
  }

  _renderEnvironmentEffects(renderer) {
    const ctx = renderer.ctx;
    ctx.save();
    for (const zone of this.poisonZones) {
      const alpha = Math.min(1, zone.timer / 2) * 0.25;
      ctx.fillStyle = 'rgba(104,159,56,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ft of this.fireTrail) {
      const alpha = Math.min(1, ft.timer / 1) * 0.35;
      ctx.fillStyle = 'rgba(255,87,34,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(ft.x, ft.y, ft.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const trap of this.quicksandTraps) {
      const alpha = Math.min(1, trap.timer / 3) * 0.3;
      ctx.fillStyle = 'rgba(194,160,96,' + alpha + ')';
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const lt of this.lightningTargets) {
      if (lt.warning) {
        const blink = Math.sin(Date.now() / 50) > 0;
        ctx.fillStyle = blink ? 'rgba(255,235,59,0.4)' : 'rgba(255,235,59,0.1)';
        ctx.beginPath();
        ctx.arc(lt.x, lt.y, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

// ─────────────────────────────────────────────────────────────
// Static Factory Methods
// ─────────────────────────────────────────────────────────────

Boss.create = function (x, y, bossType) {
  return new Boss(x, y, bossType);
};

Boss.getTypes = function () {
  return Object.keys(BOSSES);
};

Boss.getInfo = function (bossType) {
  return BOSSES[bossType] || null;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Boss, BOSSES, PHASE_THRESHOLDS };
}
