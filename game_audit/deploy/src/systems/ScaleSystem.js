/**
 * @file ScaleSystem.js
 * @description Manages the player's scale transformation system including
 *   shrink zones placement, shrink permission checks, and the 0.8s cinematic
 *   3-phase scale transition with visual effects.
 */

/** @typedef {Object} ShrinkZone
 * @property {number} x - World x position in pixels.
 * @property {number} y - World y position in pixels.
 * @property {number} radius - Zone radius in pixels.
 * @property {boolean} active - Whether the zone is currently active.
 * @property {number} id - Unique zone identifier.
 * @property {string} biome - Biome this zone is located in.
 */

/** @typedef {Object} ScaleTransition
 * @property {boolean} active - Whether a transition is in progress.
 * @property {number} elapsed - Elapsed time in seconds.
 * @property {number} duration - Total transition duration in seconds.
 * @property {number} fromScale - Starting scale.
 * @property {number} toScale - Target scale.
 * @property {number} phase - Current visual phase (1, 2, or 3).
 * @property {'shrink'|'grow'} type - Transition direction.
 */

/** @typedef {Object} ScaleEffect
 * @property {number} speedMult - Speed multiplier at this scale.
 * @property {number} damageMult - Damage multiplier at this scale.
 * @property {number} hitboxMult - Hitbox size multiplier at this scale.
 * @property {boolean} canFitSmallGaps - Whether player can fit through 1-tile gaps.
 * @property {boolean} canWallClimb - Whether player can cling to and climb walls.
 * @property {number} jumpForceMult - Jump force multiplier.
 * @property {number} gravityMult - Gravity multiplier.
 */

/** @typedef {Object} Particle
 * @property {number} x - Position x.
 * @property {number} y - Position y.
 * @property {number} vx - Velocity x.
 * @property {number} vy - Velocity y.
 * @property {number} life - Remaining life in seconds.
 * @property {number} maxLife - Maximum life in seconds.
 * @property {number} size - Particle size in pixels.
 * @property {string} color - Particle color (CSS).
 * @property {number} alpha - Opacity 0-1.
 */

/**
 * ScaleSystem — Manages shrink zones, scale permission, and the
 * cinematic 3-phase 0.8s scale transition between normal (1.0×)
 * and small (0.25×) forms.
 *
 * **Transition Phases:**
 * - Phase 1 (0.0–0.3s): Camera zooms to 1.5×, particles converge on player.
 * - Phase 2 (0.3–0.5s): White flash, actual scale swap occurs.
 * - Phase 3 (0.5–0.8s): Camera zooms back, particles burst outward.
 */
class ScaleSystem {
  constructor() {
    /** @type {Array<ShrinkZone>} All shrink zones in the world. */
    this.shrinkZones = [];

    /** @type {number} Total transition duration in seconds. */
    this.transitionDuration = 0.8;

    /**
     * Whether the player can shrink outside of designated zones.
     * Unlocked after obtaining the Whispering Seed dungeon item.
     * @type {boolean}
     */
    this.playerCanShrinkAnywhere = false;

    /** @type {ScaleTransition|null} Current transition state. */
    this.transition = null;

    /** @type {number} Next unique zone ID. */
    this._nextZoneId = 1;

    /** @type {Array<Particle>} Active particles for visual effects. */
    this.particles = [];

    /** @type {number} Camera zoom offset during transition (0 = no zoom). */
    this.cameraZoom = 0;

    /** @type {number} Flash opacity during transition phase 2. */
    this.flashOpacity = 0;

    /** @type {string} Current scale status for external queries. */
    this.currentScaleState = 'normal'; // 'normal' | 'small' | 'transitioning'

    // Initialize event bus
    if (!window.GameEvents) {
      window.GameEvents = document.createElement('div');
    }

    // Bind methods
    this.addShrinkZone = this.addShrinkZone.bind(this);
    this.isInShrinkZone = this.isInShrinkZone.bind(this);
    this.canShrink = this.canShrink.bind(this);
    this.startTransition = this.startTransition.bind(this);
    this.updateTransition = this.updateTransition.bind(this);
    this.getScaleEffects = this.getScaleEffects.bind(this);
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shrink Zone Management
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add a new shrink zone to the world.
   * @param {number} x - World x position in pixels.
   * @param {number} y - World y position in pixels.
   * @param {number} [radius=64] - Zone radius in pixels.
   * @param {string} [biome='FOREST'] - Biome the zone is in.
   * @returns {ShrinkZone} The created zone.
   */
  addShrinkZone(x, y, radius = 64, biome = 'FOREST') {
    const zone = {
      x,
      y,
      radius,
      active: true,
      id: this._nextZoneId++,
      biome,
    };
    this.shrinkZones.push(zone);
    return zone;
  }

  /**
   * Remove a shrink zone by ID.
   * @param {number} zoneId - Zone ID to remove.
   * @returns {boolean} True if a zone was removed.
   */
  removeShrinkZone(zoneId) {
    const idx = this.shrinkZones.findIndex(z => z.id === zoneId);
    if (idx !== -1) {
      this.shrinkZones.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Deactivate a shrink zone (hide it without removing).
   * @param {number} zoneId - Zone ID to deactivate.
   */
  deactivateZone(zoneId) {
    const zone = this.shrinkZones.find(z => z.id === zoneId);
    if (zone) zone.active = false;
  }

  /**
   * Reactivate a shrink zone.
   * @param {number} zoneId - Zone ID to activate.
   */
  activateZone(zoneId) {
    const zone = this.shrinkZones.find(z => z.id === zoneId);
    if (zone) zone.active = true;
  }

  /**
   * Get all active shrink zones.
   * @returns {Array<ShrinkZone>} Active zones.
   */
  getActiveZones() {
    return this.shrinkZones.filter(z => z.active);
  }

  /**
   * Check if a world position is inside any active shrink zone.
   * @param {number} px - World x position.
   * @param {number} py - World y position.
   * @returns {boolean} True if inside at least one zone.
   */
  isInShrinkZone(px, py) {
    for (const zone of this.shrinkZones) {
      if (!zone.active) continue;
      const dx = px - zone.x;
      const dy = py - zone.y;
      // Use squared distance for efficiency
      if (dx * dx + dy * dy <= zone.radius * zone.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a player entity can shrink at their current position.
   * Returns true if either: (a) player is in a shrink zone, or
   * (b) player has unlocked anywhere-shrinking.
   * @param {{x: number, y: number}} player - Player position object.
   * @param {boolean} [hasWhisperingSeed=false] - Whether player has the unlock item.
   * @returns {boolean} True if shrinking is permitted.
   */
  canShrink(player, hasWhisperingSeed = false) {
    if (hasWhisperingSeed || this.playerCanShrinkAnywhere) return true;
    return this.isInShrinkZone(player.x, player.y);
  }

  /**
   * Check if a player entity can grow (always true unless transitioning).
   * @returns {boolean} True if growing is permitted.
   */
  canGrow() {
    return !this.transition || !this.transition.active;
  }

  /**
   * Unlock the ability to shrink anywhere (called when obtaining
   * the Whispering Seed dungeon item).
   */
  unlockShrinkAnywhere() {
    this.playerCanShrinkAnywhere = true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Scale Effects
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the stat modifiers for a given scale value.
   * At 0.25×: speed×0.6, damage×0.5, hitbox×0.4, can fit small gaps, can wall climb.
   * At 1.0×: all stats are normal.
   * @param {number} scale - The player's current scale (typically 0.25 or 1.0).
   * @returns {ScaleEffect} Stat modifier object.
   */
  getScaleEffects(scale) {
    if (scale <= 0.3) {
      return {
        speedMult: 0.6,
        damageMult: 0.5,
        hitboxMult: 0.4,
        canFitSmallGaps: true,
        canWallClimb: true,
        jumpForceMult: 1.0,
        gravityMult: 1.0,
      };
    }
    return {
      speedMult: 1.0,
      damageMult: 1.0,
      hitboxMult: 1.0,
      canFitSmallGaps: false,
      canWallClimb: false,
      jumpForceMult: 1.0,
      gravityMult: 1.0,
    };
  }

  /**
   * Interpolate scale effects during a transition.
   * @param {number} fromScale - Starting scale.
   * @param {number} toScale - Target scale.
   * @param {number} t - Interpolation factor 0-1.
   * @returns {ScaleEffect} Blended scale effects.
   */
  getTransitionEffects(fromScale, toScale, t) {
    const fromEffects = this.getScaleEffects(fromScale);
    const toEffects = this.getScaleEffects(toScale);

    function lerp(a, b, tVal) {
      return a + (b - a) * tVal;
    }

    return {
      speedMult: lerp(fromEffects.speedMult, toEffects.speedMult, t),
      damageMult: lerp(fromEffects.damageMult, toEffects.damageMult, t),
      hitboxMult: lerp(fromEffects.hitboxMult, toEffects.hitboxMult, t),
      canFitSmallGaps: t > 0.5 ? toEffects.canFitSmallGaps : fromEffects.canFitSmallGaps,
      canWallClimb: t > 0.5 ? toEffects.canWallClimb : fromEffects.canWallClimb,
      jumpForceMult: lerp(fromEffects.jumpForceMult, toEffects.jumpForceMult, t),
      gravityMult: lerp(fromEffects.gravityMult, toEffects.gravityMult, t),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3-Phase Cinematic Transition
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start a scale transition (shrink or grow).
   *
   * The transition is a 0.8s cinematic sequence:
   * - **Phase 1** (0.0–0.3s): Camera zooms to 1.5× toward the player.
   *   Ambient particles converge toward the player center.
   * - **Phase 2** (0.3–0.5s): Bright white flash. The actual scale swap
   *   occurs at the midpoint of this phase.
   * - **Phase 3** (0.5–0.8s): Camera zooms back to 1.0×. Particles burst
   *   outward from the player.
   *
   * @param {{x: number, y: number}} playerPos - Player world position.
   * @param {boolean} toSmall - True to shrink to 0.25×, false to grow to 1.0×.
   * @param {number} [fromScale] - Optional explicit starting scale.
   */
  startTransition(playerPos, toSmall, fromScale) {
    const startScale = fromScale !== undefined ? fromScale : (toSmall ? 1.0 : 0.25);
    const endScale = toSmall ? 0.25 : 1.0;

    this.transition = {
      active: true,
      elapsed: 0,
      duration: this.transitionDuration,
      fromScale: startScale,
      toScale: endScale,
      phase: 1,
      type: toSmall ? 'shrink' : 'grow',
    };

    this.currentScaleState = 'transitioning';

    // Spawn initial convergence particles for Phase 1
    this._spawnConvergenceParticles(playerPos);

    // Emit event
    window.GameEvents.dispatchEvent(new CustomEvent('player:scaleChange', {
      detail: {
        fromScale: startScale,
        toScale: endScale,
        duration: this.transitionDuration,
      },
    }));

    // Audio cue
    window.GameEvents.dispatchEvent(new CustomEvent('system:sfx', {
      detail: { type: 'scale_change', shrinking: toSmall },
    }));
  }

  /**
   * Update an ongoing scale transition.
   * Call this every frame while a transition is active.
   * @param {number} dt - Delta time in seconds.
   * @param {{x: number, y: number}} playerPos - Player world position.
   * @param {Object} [renderer] - Optional renderer for particle spawning.
   * @returns {{done: boolean, swapped: boolean, phase: number}} Transition status.
   */
  updateTransition(dt, playerPos, renderer) {
    if (!this.transition || !this.transition.active) {
      return { done: true, swapped: true, phase: 0 };
    }

    const t = this.transition;
    t.elapsed += dt;
    const progress = Math.min(t.elapsed / t.duration, 1.0);

    // Determine phase
    if (progress < 0.375) {
      t.phase = 1;
      // Phase 1: Zoom in, particles converge
      const phaseProgress = progress / 0.375;
      this.cameraZoom = phaseProgress * 0.5; // 0 → 0.5 zoom
      this.flashOpacity = 0;

      // Spawn convergence particles periodically
      if (Math.random() < 0.3) {
        this._spawnConvergenceParticle(playerPos);
      }
    } else if (progress < 0.625) {
      const prevPhase = t.phase;
      t.phase = 2;
      // Phase 2: Flash and swap
      const phaseProgress = (progress - 0.375) / 0.25;
      this.cameraZoom = 0.5;
      // Flash ramps up then down within this phase
      this.flashOpacity = phaseProgress < 0.5
        ? phaseProgress * 2 * 0.9
        : (1 - phaseProgress) * 2 * 0.9;

      // Scale swap happens at the midpoint of phase 2
      const swapped = prevPhase === 1 || (phaseProgress >= 0.5);

      if (swapped && prevPhase === 1) {
        // Just entered phase 2 midpoint — scale has conceptually swapped
        this._spawnSwapParticles(playerPos);
      }
    } else {
      t.phase = 3;
      // Phase 3: Zoom back, particles burst
      const phaseProgress = (progress - 0.625) / 0.375;
      const eased = 1 - Math.pow(1 - phaseProgress, 3); // ease-out cubic
      this.cameraZoom = 0.5 * (1 - eased);
      this.flashOpacity = 0;

      // Burst particles
      if (Math.random() < 0.4) {
        this._spawnBurstParticle(playerPos);
      }
    }

    // Update all particles
    this._updateParticles(dt);

    // Transition complete
    if (progress >= 1.0) {
      t.active = false;
      this.cameraZoom = 0;
      this.flashOpacity = 0;
      this.currentScaleState = t.toScale <= 0.3 ? 'small' : 'normal';
      return { done: true, swapped: true, phase: 3 };
    }

    return {
      done: false,
      swapped: progress > 0.5,
      phase: t.phase,
      progress,
      cameraZoom: this.cameraZoom,
      flashOpacity: this.flashOpacity,
    };
  }

  /**
   * Get the current visual scale during a transition.
   * Returns a smoothly interpolated value between fromScale and toScale.
   * @returns {number} Current interpolated scale.
   */
  getCurrentVisualScale() {
    if (!this.transition || !this.transition.active) return null;
    const t = this.transition;
    const progress = t.elapsed / t.duration;
    // Smooth ease in-out
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    return t.fromScale + (t.toScale - t.fromScale) * eased;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Particle Effects
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Spawn a batch of particles that converge toward the player.
   * Used at the start of Phase 1.
   * @param {{x: number, y: number}} center - Target position.
   */
  _spawnConvergenceParticles(center) {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      const px = center.x + Math.cos(angle) * dist;
      const py = center.y + Math.sin(angle) * dist;
      this.particles.push({
        x: px,
        y: py,
        vx: (center.x - px) * 3, // Velocity toward center
        vy: (center.y - py) * 3,
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.3 + Math.random() * 0.2,
        size: 2 + Math.random() * 3,
        color: '#00ffff',
        alpha: 0.8,
      });
    }
  }

  /**
   * Spawn a single convergence particle.
   * @param {{x: number, y: number}} center - Target position.
   */
  _spawnConvergenceParticle(center) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 100;
    const px = center.x + Math.cos(angle) * dist;
    const py = center.y + Math.sin(angle) * dist;
    this.particles.push({
      x: px,
      y: py,
      vx: (center.x - px) * (1.5 + Math.random()),
      vy: (center.y - py) * (1.5 + Math.random()),
      life: 0.3 + Math.random() * 0.2,
      maxLife: 0.3 + Math.random() * 0.2,
      size: 1.5 + Math.random() * 2,
      color: Math.random() < 0.5 ? '#00ffff' : '#ffffff',
      alpha: 0.7,
    });
  }

  /**
   * Spawn particles at the scale swap moment (mid Phase 2).
   * @param {{x: number, y: number}} center - Position.
   */
  _spawnSwapParticles(center) {
    // Ring of bright particles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      this.particles.push({
        x: center.x + Math.cos(angle) * 10,
        y: center.y + Math.sin(angle) * 10,
        vx: Math.cos(angle) * (50 + Math.random() * 50),
        vy: Math.sin(angle) * (50 + Math.random() * 50),
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.2 + Math.random() * 0.3,
        size: 2 + Math.random() * 3,
        color: '#ffffff',
        alpha: 1.0,
      });
    }
  }

  /**
   * Spawn a burst particle for Phase 3.
   * @param {{x: number, y: number}} center - Burst center.
   */
  _spawnBurstParticle(center) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 60;
    this.particles.push({
      x: center.x + (Math.random() - 0.5) * 20,
      y: center.y + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.3 + Math.random() * 0.3,
      maxLife: 0.3 + Math.random() * 0.3,
      size: 1.5 + Math.random() * 2.5,
      color: Math.random() < 0.3 ? '#00ffff' : '#aaffff',
      alpha: 0.8,
    });
  }

  /**
   * Spawn ambient floating particles for an active shrink zone.
   * Call this periodically while rendering a zone.
   * @param {{x: number, y: number}} zonePos - Zone center.
   * @param {number} radius - Zone radius.
   */
  spawnZoneParticles(zonePos, radius) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    this.particles.push({
      x: zonePos.x + Math.cos(angle) * dist,
      y: zonePos.y + Math.sin(angle) * dist,
      vx: (Math.random() - 0.5) * 10,
      vy: -20 - Math.random() * 30, // Float upward
      life: 1.0 + Math.random() * 1.5,
      maxLife: 1.0 + Math.random() * 1.5,
      size: 1 + Math.random() * 2,
      color: Math.random() < 0.7 ? '#00ffff' : '#88ffff',
      alpha: 0.6,
    });
  }

  /**
   * Update all particles (position, life, culling).
   * @param {number} dt - Delta time in seconds.
   */
  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, (p.life / p.maxLife) * 0.8);

      // Slight damping
      p.vx *= 0.98;
      p.vy *= 0.98;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main Update & Render
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Main update for the scale system.
   * Processes any active transition and updates particles.
   * @param {number} dt - Delta time in seconds.
   * @param {{x: number, y: number}} playerPos - Player world position.
   * @param {Object} [renderer] - Optional renderer.
   */
  update(dt, playerPos, renderer) {
    // Update active transition
    if (this.transition && this.transition.active) {
      this.updateTransition(dt, playerPos, renderer);
    }

    // Update particles (even without transition, for zone effects)
    this._updateParticles(dt);
  }

  /**
   * Render scale system visuals: transition effects and shrink zones.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {{x: number, y: number}} camera - Camera position.
   * @param {number} canvasW - Canvas width.
   * @param {number} canvasH - Canvas height.
   * @param {{x: number, y: number}} playerPos - Player position for relative drawing.
   */
  render(ctx, camera, canvasW, canvasH, playerPos) {
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    // ── Render Particles ───────────────────────────────────────
    for (const p of this.particles) {
      const sx = p.x - camera.x + cx;
      const sy = p.y - camera.y + cy;
      if (sx < -10 || sx > canvasW + 10 || sy < -10 || sy > canvasH + 10) continue;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1.0;

    // ── Render Flash Overlay ───────────────────────────────────
    if (this.flashOpacity > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.flashOpacity})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // ── Render Shrink Zones ────────────────────────────────────
    for (const zone of this.shrinkZones) {
      if (!zone.active) continue;
      const sx = zone.x - camera.x + cx;
      const sy = zone.y - camera.y + cy;
      // Only render if on screen
      if (sx + zone.radius < 0 || sx - zone.radius > canvasW ||
          sy + zone.radius < 0 || sy - zone.radius > canvasH) continue;

      this._renderShrinkZone(ctx, sx, sy, zone.radius);
    }

    // ── Render Scale Indicator ─────────────────────────────────
    if (this.currentScaleState === 'small') {
      // Small persistent indicator when shrunk
      ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('SCALE: 1/4', 10, canvasH - 10);
    }
  }

  /**
   * Render a single shrink zone visual.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} sx - Screen x.
   * @param {number} sy - Screen y.
   * @param {number} radius - Zone radius.
   */
  _renderShrinkZone(ctx, sx, sy, radius) {
    const time = Date.now() * 0.001;

    // Outer glow (pulsing)
    const pulse = 0.7 + Math.sin(time * 2) * 0.3;
    const outerGrad = ctx.createRadialGradient(sx, sy, radius * 0.1, sx, sy, radius);
    outerGrad.addColorStop(0, `rgba(0, 255, 255, ${0.15 * pulse})`);
    outerGrad.addColorStop(0.5, `rgba(0, 200, 255, ${0.08 * pulse})`);
    outerGrad.addColorStop(1, 'rgba(0, 150, 255, 0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner ring (rotating dashes)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(time * 0.5);
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 * pulse})`;
    ctx.lineWidth = 2;
    const innerR = radius * 0.4;
    for (let i = 0; i < 8; i++) {
      const a1 = (i / 8) * Math.PI * 2;
      const a2 = a1 + Math.PI * 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, innerR, a1, a2);
      ctx.stroke();
    }
    ctx.restore();

    // Floating particles inside the zone
    for (let i = 0; i < 4; i++) {
      const angle = time * 0.8 + (i / 4) * Math.PI * 2;
      const dist = innerR * 0.7;
      const px = sx + Math.cos(angle) * dist;
      const py = sy + Math.sin(angle) * dist - (time * 20 + i * 15) % radius;
      ctx.fillStyle = `rgba(180, 255, 255, ${0.6 * pulse})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center glow dot
    ctx.fillStyle = `rgba(200, 255, 255, ${0.4 * pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Serialization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Serialize scale system state for saving.
   * @returns {Object} Save data.
   */
  serialize() {
    return {
      shrinkZones: this.shrinkZones.map(z => ({
        x: z.x,
        y: z.y,
        radius: z.radius,
        active: z.active,
        id: z.id,
        biome: z.biome,
      })),
      playerCanShrinkAnywhere: this.playerCanShrinkAnywhere,
      currentScaleState: this.currentScaleState,
      nextZoneId: this._nextZoneId,
    };
  }

  /**
   * Deserialize scale system state.
   * @param {Object} data - Save data.
   */
  deserialize(data) {
    if (!data) return;
    if (data.shrinkZones) this.shrinkZones = data.shrinkZones;
    if (data.playerCanShrinkAnywhere !== undefined) {
      this.playerCanShrinkAnywhere = data.playerCanShrinkAnywhere;
    }
    if (data.currentScaleState) this.currentScaleState = data.currentScaleState;
    if (data.nextZoneId) this._nextZoneId = data.nextZoneId;
  }

  /**
   * Reset the scale system to initial state.
   */
  reset() {
    this.shrinkZones = [];
    this.transition = null;
    this.particles = [];
    this.cameraZoom = 0;
    this.flashOpacity = 0;
    this.currentScaleState = 'normal';
    this.playerCanShrinkAnywhere = false;
    this._nextZoneId = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Convenience static methods
// ─────────────────────────────────────────────────────────────────────────

/**
 * Quick static helper to compute scale effects without instantiating.
 * @param {number} scale - Scale value.
 * @returns {ScaleEffect} Effect modifiers.
 */
function getScaleEffects(scale) {
  if (scale <= 0.3) {
    return {
      speedMult: 0.6,
      damageMult: 0.5,
      hitboxMult: 0.4,
      canFitSmallGaps: true,
      canWallClimb: true,
      jumpForceMult: 1.0,
      gravityMult: 1.0,
    };
  }
  return {
    speedMult: 1.0,
    damageMult: 1.0,
    hitboxMult: 1.0,
    canFitSmallGaps: false,
    canWallClimb: false,
    jumpForceMult: 1.0,
    gravityMult: 1.0,
  };
}

window.ScaleSystem = ScaleSystem;
window.getScaleEffects = getScaleEffects;
