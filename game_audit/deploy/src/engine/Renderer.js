/**
 * Renderer.js — Visual System for Echoes of the Small
 *
 * Handles all Canvas 2D rendering including:
 * - Biome color palettes (6 biomes)
 * - Dynamic lighting via offscreen canvas + composite operations
 * - Particle system with object pooling (max 1000 particles)
 * - 8 built-in particle types: dust, spark, blood, magic, leaf, snow, ember, scaleDust
 * - Post-processing vignette effect
 * - Wind system for environmental particle drift
 * - Sprite/tile drawing with flip support
 */

/** Maximum number of particles in the object pool. */
const MAX_PARTICLES = 1000;

/** Wind states for environmental particle drift. */
const WIND_DEFAULT = { x: 15, y: 0, turbulence: 5 };

/**
 * Renderer — Canvas 2D rendering system for Echoes of the Small.
 * Manages drawing, lighting, particles, color palettes, and post-processing effects.
 */
class Renderer {
  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------
  /**
   * @param {HTMLCanvasElement} canvas — Main game canvas
   * @param {CanvasRenderingContext2D} ctx — 2D rendering context
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.width = canvas.width || 1280;
    this.height = canvas.height || 720;

    // ---- 6 Biome Color Palettes ----
    this.palettes = {
      FOREST:   { bg: '#1a2f1a', ground: '#2d5016', accent: '#7cb342', name: 'Forest' },
      DESERT:   { bg: '#2d2416', ground: '#c2a060', accent: '#e6c875', name: 'Desert' },
      MOUNTAIN: { bg: '#1e293b', ground: '#64748b', accent: '#94a3b8', name: 'Mountain' },
      SWAMP:    { bg: '#1a1a10', ground: '#3a4a2a', accent: '#689f38', name: 'Swamp' },
      ICE:      { bg: '#0f172a', ground: '#cbd5e1', accent: '#e2e8f0', name: 'Ice' },
      VOLCANO:  { bg: '#1a0505', ground: '#7f1d1d', accent: '#dc2626', name: 'Volcano' }
    };
    this.currentPalette = this.palettes.FOREST;

    // ---- Dynamic Lighting ----
    this.lightingEnabled = true;
    this.lightingCanvas = document.createElement('canvas');
    this.lightingCtx = this.lightingCanvas.getContext('2d');
    this.lightingCanvas.width = this.width;
    this.lightingCanvas.height = this.height;
    this.lights = [];          // Active light sources this frame
    this.ambientDarkness = 0.6; // Alpha of the dark overlay

    // ---- Particle System (object pool) ----
    this.particles = [];       // Active particles array
    this.particlePool = [];    // Object pool for recycling
    this.particleCount = 0;    // Current active particle count
    this._initParticlePool();

    // ---- Wind System ----
    this.wind = { ...WIND_DEFAULT };
    this.windTimer = 0;
    this.windPhase = 0;

    // ---- Post-Processing ----
    this.vignetteIntensity = 0.7;
    this.chromaticAberration = 0;   // Current aberration offset (pixels)
    this.targetChromatic = 0;       // Target aberration
    this.hitFlashIntensity = 0;     // Red flash on player hit

    // ---- Internal drawing state ----
    this._lastPaletteKey = 'FOREST';
    this.debugDraw = false;
  }

  // --------------------------------------------------------------------------
  // Particle Pool Initialization
  // --------------------------------------------------------------------------
  /**
   * Pre-allocate particle objects for object pooling.
   * Avoids garbage collection during gameplay.
   */
  _initParticlePool() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particlePool.push({
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0, maxLife: 0,
        color: '#ffffff',
        size: 1,
        gravity: 0,
        fade: 0,
        type: 'dust',
        rotation: 0,
        rotSpeed: 0,
        alpha: 1,
        scaleX: 1, scaleY: 1,
        custom: null // For type-specific data
      });
    }
  }

  // --------------------------------------------------------------------------
  // Clearing
  // --------------------------------------------------------------------------
  /**
   * Clear the canvas with the current biome's background color.
   */
  clear() {
    this.ctx.fillStyle = this.currentPalette.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // --------------------------------------------------------------------------
  // Palette Management
  // --------------------------------------------------------------------------
  /**
   * Switch the active color palette for a biome.
   * Also updates lighting ambient level based on biome mood.
   *
   * @param {string} biome — One of: 'FOREST', 'DESERT', 'MOUNTAIN', 'SWAMP', 'ICE', 'VOLCANO'
   */
  setPalette(biome) {
    const palette = this.palettes[biome];
    if (!palette) {
      console.warn(`[Renderer] Unknown biome palette: ${biome}`);
      return;
    }
    this.currentPalette = palette;
    this._lastPaletteKey = biome;

    // Adjust ambient darkness per biome mood
    switch (biome) {
      case 'FOREST':   this.ambientDarkness = 0.55; break;
      case 'DESERT':   this.ambientDarkness = 0.35; break;
      case 'MOUNTAIN': this.ambientDarkness = 0.50; break;
      case 'SWAMP':    this.ambientDarkness = 0.70; break;
      case 'ICE':      this.ambientDarkness = 0.45; break;
      case 'VOLCANO':  this.ambientDarkness = 0.65; break;
    }

    // Emit palette change event
    if (window.GameEvents) {
      window.GameEvents.emit('renderer:paletteChange', { biome, palette });
    }
  }

  /**
   * Get the current palette.
   * @returns {object} Current palette object
   */
  getPalette() {
    return this.currentPalette;
  }

  /**
   * Get a specific palette by biome name.
   * @param {string} biome — Biome key
   * @returns {object|undefined} Palette object or undefined
   */
  getPaletteFor(biome) {
    return this.palettes[biome];
  }

  // --------------------------------------------------------------------------
  // Sprite Drawing
  // --------------------------------------------------------------------------
  /**
   * Draw a sprite at the given position with optional frame and horizontal flip.
   * Supports simple colored rectangle sprites when no image is provided.
   *
   * @param {object} sprite — Sprite config: { color, width, height, image? } or null for default
   * @param {number} x — World X position
   * @param {number} y — World Y position
   * @param {number} [frame=0] — Animation frame index
   * @param {boolean} [flipX=false] — Whether to flip horizontally
   * @param {object} [options={}] — Additional options (alpha, scale, rotation)
   */
  drawSprite(sprite, x, y, frame = 0, flipX = false, options = {}) {
    const ctx = this.ctx;
    ctx.save();

    const w = (sprite && sprite.width) || 32;
    const h = (sprite && sprite.height) || 32;
    const alpha = options.alpha !== undefined ? options.alpha : 1;
    const scale = options.scale !== undefined ? options.scale : 1;
    const rotation = options.rotation || 0;

    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    if (flipX) {
      ctx.scale(-scale, scale);
    } else {
      ctx.scale(scale, scale);
    }

    if (rotation !== 0) {
      ctx.rotate(rotation);
    }

    if (sprite && sprite.image) {
      // Draw actual image sprite
      const frameW = sprite.frameWidth || w;
      const frameH = sprite.frameHeight || h;
      const framesPerRow = sprite.framesPerRow || 1;
      const srcX = (frame % framesPerRow) * frameW;
      const srcY = Math.floor(frame / framesPerRow) * frameH;
      ctx.drawImage(sprite.image, srcX, srcY, frameW, frameH, -w / 2, -h, w, h);
    } else {
      // Draw procedural sprite (colored shape)
      const color = (sprite && sprite.color) || '#888888';
      ctx.fillStyle = color;

      // Draw rounded rectangle shape
      const drawW = w;
      const drawH = h;
      const cornerR = Math.min(4, drawW / 4, drawH / 4);
      ctx.beginPath();
      ctx.moveTo(-drawW / 2 + cornerR, -drawH);
      ctx.lineTo(drawW / 2 - cornerR, -drawH);
      ctx.quadraticCurveTo(drawW / 2, -drawH, drawW / 2, -drawH + cornerR);
      ctx.lineTo(drawW / 2, 0 - cornerR);
      ctx.quadraticCurveTo(drawW / 2, 0, drawW / 2 - cornerR, 0);
      ctx.lineTo(-drawW / 2 + cornerR, 0);
      ctx.quadraticCurveTo(-drawW / 2, 0, -drawW / 2, -cornerR);
      ctx.lineTo(-drawW / 2, -drawH + cornerR);
      ctx.quadraticCurveTo(-drawW / 2, -drawH, -drawW / 2 + cornerR, -drawH);
      ctx.closePath();
      ctx.fill();

      // Inner highlight
      ctx.fillStyle = this._lightenColor(color, 30);
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillRect(-drawW / 2 + 3, -drawH + 3, drawW - 6, drawH / 3);
    }

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // Tile Drawing
  // --------------------------------------------------------------------------
  /**
   * Draw a world tile at the given position.
   * Uses the current biome palette and varies appearance by tile ID.
   *
   * @param {number} tileId — Tile identifier
   * @param {number} x — World X position
   * @param {number} y — World Y position
   * @param {number} [size=32] — Tile size in pixels
   * @param {object} [options={}] — Rendering options
   */
  drawTile(tileId, x, y, size = 32, options = {}) {
    const ctx = this.ctx;
    const palette = this.currentPalette;

    ctx.save();
    ctx.translate(x, y);

    // Determine tile appearance by ID
    let fillColor, borderColor;
    const isPlatform = tileId >= 60 && tileId < 65;

    switch (tileId) {
      case 0: // Empty
        ctx.restore();
        return;

      case 1: case 2: case 3: case 4: // Ground variants
      case 5: case 6: case 7: case 8:
        {
          const variant = tileId - 1;
          const shade = variant * 5;
          fillColor = this._adjustBrightness(palette.ground, shade);
          borderColor = this._adjustBrightness(palette.ground, shade - 10);
        }
        break;

      case 10: case 11: case 12: // Solid walls
      case 13: case 14: case 15:
        {
          const wallShade = -(tileId - 9) * 8;
          fillColor = this._adjustBrightness(palette.ground, wallShade - 20);
          borderColor = this._adjustBrightness(palette.ground, wallShade - 30);
        }
        break;

      case 20: // Water
        fillColor = '#1e3a5f';
        borderColor = '#2a4f7c';
        break;

      case 21: // Lava
        fillColor = '#b91c1c';
        borderColor = '#dc2626';
        break;

      case 22: // Ice
        fillColor = '#93c5fd';
        borderColor = '#bfdbfe';
        break;

      case 30: // Decorative - grass
        fillColor = palette.ground;
        borderColor = this._adjustBrightness(palette.ground, 5);
        break;
      case 31: // Decorative - flowers
        fillColor = palette.ground;
        borderColor = palette.accent;
        break;
      case 32: // Decorative - rocks
        fillColor = this._adjustBrightness(palette.ground, -15);
        borderColor = this._adjustBrightness(palette.ground, -25);
        break;
      case 33: // Decorative - bushes
        fillColor = palette.ground;
        borderColor = this._adjustBrightness(palette.accent, -20);
        break;
      case 34: // Decorative - tall grass
        fillColor = palette.ground;
        borderColor = this._adjustBrightness(palette.accent, 10);
        break;
      case 35: // Decorative - mushrooms/stones
        fillColor = palette.ground;
        borderColor = '#8d6e63';
        break;

      case 40: // Shrink zone marker
        fillColor = 'rgba(0, 200, 200, 0.2)';
        borderColor = 'rgba(0, 255, 255, 0.5)';
        break;

      case 50: // Dungeon entrance
        fillColor = '#2d1b69';
        borderColor = '#5e35b1';
        break;

      case 60: case 61: case 62: // Platforms (jump-through)
      case 63: case 64: case 65:
        fillColor = this._adjustBrightness(palette.ground, 10);
        borderColor = palette.accent;
        break;

      default: // Unknown tile
        fillColor = '#ff00ff';
        borderColor = '#ff88ff';
        break;
    }

    // Draw the tile
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, size, size);

    // Border/highlight
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

    // Tile-specific decorative details
    this._drawTileDetails(ctx, tileId, size, palette);

    // Platform indicator (thinner top line)
    if (isPlatform) {
      ctx.fillStyle = palette.accent;
      ctx.fillRect(2, 0, size - 4, 3);
    }

    // Shrink zone glow effect
    if (tileId === 40) {
      const glowAlpha = 0.3 + Math.sin(performance.now() / 300) * 0.2;
      ctx.fillStyle = `rgba(0, 255, 255, ${glowAlpha})`;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.restore();
  }

  /**
   * Draw decorative details on top of specific tile types.
   * @private
   */
  _drawTileDetails(ctx, tileId, size, palette) {
    switch (tileId) {
      case 30: // Grass tuft
        ctx.strokeStyle = palette.accent;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const gx = 4 + i * 10 + Math.random() * 4;
          ctx.beginPath();
          ctx.moveTo(gx, size);
          ctx.lineTo(gx + 2, size - 6 - Math.random() * 4);
          ctx.stroke();
        }
        break;

      case 31: // Small flower
        ctx.fillStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 32: // Rock
        ctx.fillStyle = this._adjustBrightness(palette.ground, -20);
        ctx.beginPath();
        ctx.arc(size / 2, size / 2 + 4, size / 3, Math.PI, 0);
        ctx.fill();
        break;

      case 50: // Dungeon entrance marker
        ctx.fillStyle = '#7e57c2';
        ctx.fillRect(size / 2 - 4, 4, 8, size - 8);
        ctx.fillStyle = '#b39ddb';
        ctx.fillRect(size / 2 - 2, 6, 4, 4);
        break;

      case 20: // Water shimmer
        {
          const shimmer = Math.sin(performance.now() / 500 + tileId) * 0.3 + 0.5;
          ctx.fillStyle = `rgba(100, 180, 255, ${shimmer * 0.3})`;
          ctx.fillRect(2, size - 6, size - 4, 4);
        }
        break;

      case 21: // Lava glow
        {
          const lavaPulse = Math.sin(performance.now() / 400) * 0.2 + 0.3;
          ctx.fillStyle = `rgba(255, 100, 30, ${lavaPulse})`;
          ctx.fillRect(2, 2, size - 4, 4);
        }
        break;
    }
  }

  // --------------------------------------------------------------------------
  // Dynamic Lighting
  // --------------------------------------------------------------------------
  /**
   * Register a light source to be rendered this frame.
   * Call before renderLighting().
   *
   * @param {number} x — World X position
   * @param {number} y — World Y position
   * @param {number} radius — Light radius in pixels
   * @param {string} [color='#ffffff'] — Light tint color
   * @param {number} [intensity=1.0] — Brightness (0-1)
   */
  drawLight(x, y, radius, color = '#ffffff', intensity = 1.0) {
    this.lights.push({ x, y, radius, color, intensity });
  }

  /**
   * Clear all lights registered this frame.
   * Call at the start of each frame's lighting pass.
   */
  clearLights() {
    this.lights = [];
  }

  /**
   * Render the lighting layer.
   * Creates ambient darkness on an offscreen canvas, then cuts out light
   * circles using 'destination-out' composite operation. Finally composites
   * the lightmap over the main canvas.
   *
   * Algorithm:
   *   1. Fill offscreen canvas with ambient darkness (alpha = ambientDarkness)
   *   2. For each light: draw a radial gradient circle with 'destination-out'
   *      to cut a hole in the darkness
   *   3. Draw the lightmap over main canvas
   *
   * @param {object} camera — Camera object { x, y } for offset
   */
  renderLighting(camera) {
    if (!this.lightingEnabled || this.lights.length === 0) return;

    const lCtx = this.lightingCtx;
    const camX = camera.x;
    const camY = camera.y;

    // Resize lighting canvas if needed
    if (this.lightingCanvas.width !== this.width || this.lightingCanvas.height !== this.height) {
      this.lightingCanvas.width = this.width;
      this.lightingCanvas.height = this.height;
    }

    // Clear lighting canvas
    lCtx.clearRect(0, 0, this.width, this.height);

    // Step 1: Fill with ambient darkness
    lCtx.fillStyle = `rgba(0, 0, 0, ${this.ambientDarkness})`;
    lCtx.fillRect(0, 0, this.width, this.height);

    // Step 2: Cut out light circles
    for (const light of this.lights) {
      const screenX = light.x - camX;
      const screenY = light.y - camY;

      // Skip if off-screen
      if (screenX + light.radius < 0 || screenX - light.radius > this.width ||
          screenY + light.radius < 0 || screenY - light.radius > this.height) {
        continue;
      }

      // Create radial gradient for soft light edge
      const gradient = lCtx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, light.radius
      );

      // Parse color to RGB
      const rgb = this._hexToRgb(light.color);
      const alpha = light.intensity * this.ambientDarkness;

      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.5})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      // Cut the hole using destination-out
      lCtx.globalCompositeOperation = 'destination-out';
      lCtx.beginPath();
      lCtx.arc(screenX, screenY, light.radius, 0, Math.PI * 2);
      lCtx.fillStyle = gradient;
      lCtx.fill();

      // Add colored light contribution back (overlay the light color)
      lCtx.globalCompositeOperation = 'source-over';
      const colorGradient = lCtx.createRadialGradient(
        screenX, screenY, 0,
        screenX, screenY, light.radius
      );
      colorGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${light.intensity * 0.15})`);
      colorGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lCtx.beginPath();
      lCtx.arc(screenX, screenY, light.radius, 0, Math.PI * 2);
      lCtx.fillStyle = colorGradient;
      lCtx.fill();
    }

    // Reset composite operation
    lCtx.globalCompositeOperation = 'source-over';

    // Step 3: Composite lighting layer over main canvas
    this.ctx.save();
    this.ctx.globalAlpha = 1.0;
    this.ctx.drawImage(this.lightingCanvas, 0, 0);
    this.ctx.restore();

    // Clear lights for next frame
    this.lights = [];
  }

  // --------------------------------------------------------------------------
  // Particle System
  // --------------------------------------------------------------------------
  /**
   * Spawn a particle with the given configuration.
   * Uses object pooling — grabs from pool or reuses oldest if at max.
   *
   * @param {object} config — Particle configuration:
   *   { x, y, vx, vy, life, color, size, gravity, fade, type?, rotation?, rotSpeed?, scaleX?, scaleY?, custom? }
   * @returns {object|null} The spawned particle or null if pool full
   */
  spawnParticle(config) {
    // Find an inactive particle from the pool
    let p = null;
    for (let i = 0; i < this.particlePool.length; i++) {
      if (!this.particlePool[i].active) {
        p = this.particlePool[i];
        break;
      }
    }

    // If all active, reuse the oldest one (lowest remaining life)
    if (!p) {
      let oldestIdx = 0;
      let oldestLife = Infinity;
      for (let i = 0; i < this.particlePool.length; i++) {
        const candidate = this.particlePool[i];
        if (candidate.life < oldestLife) {
          oldestLife = candidate.life;
          oldestIdx = i;
        }
      }
      p = this.particlePool[oldestIdx];
    }

    // Configure the particle
    p.active = true;
    p.x = config.x || 0;
    p.y = config.y || 0;
    p.vx = config.vx || 0;
    p.vy = config.vy || 0;
    p.life = config.life || 1.0;
    p.maxLife = p.life;
    p.color = config.color || '#ffffff';
    p.size = config.size || 2;
    p.gravity = config.gravity !== undefined ? config.gravity : 100;
    p.fade = config.fade !== undefined ? config.fade : 1.0;
    p.type = config.type || 'dust';
    p.rotation = config.rotation || 0;
    p.rotSpeed = config.rotSpeed || 0;
    p.alpha = 1;
    p.scaleX = config.scaleX || 1;
    p.scaleY = config.scaleY || 1;
    p.custom = config.custom || null;

    // Type-specific setup
    this._setupParticleType(p);

    // Track active count
    this._recountParticles();

    return p;
  }

  /**
   * Set up particle type-specific properties.
   * @private
   */
  _setupParticleType(p) {
    switch (p.type) {
      case 'dust':
        p.gravity = p.gravity || 80;
        p.fade = p.fade || 0.8;
        break;
      case 'spark':
        p.gravity = 0;
        p.fade = p.fade || 0.5;
        p.rotSpeed = (Math.random() - 0.5) * 10;
        break;
      case 'blood':
        p.gravity = p.gravity || 200;
        p.fade = p.fade || 1.0;
        break;
      case 'magic':
        p.gravity = -30; // Float upward
        p.fade = p.fade || 0.4;
        p.custom = { sparkleTimer: Math.random() * 0.5 };
        break;
      case 'leaf':
        p.gravity = 20;
        p.fade = p.fade || 0.3;
        p.rotSpeed = (Math.random() - 0.5) * 3;
        p.custom = { swayPhase: Math.random() * Math.PI * 2, swayAmp: 20 + Math.random() * 30 };
        break;
      case 'snow':
        p.gravity = 30 + Math.random() * 20;
        p.fade = p.fade || 0.1;
        p.custom = { swayPhase: Math.random() * Math.PI * 2, swayAmp: 10 + Math.random() * 15 };
        break;
      case 'ember':
        p.gravity = -40 - Math.random() * 30; // Float upward
        p.fade = p.fade || 0.4;
        p.custom = { flickerTimer: Math.random() * 0.2 };
        break;
      case 'scaleDust':
        p.gravity = 0;
        p.fade = p.fade || 0.5;
        p.custom = { convergeX: p.custom?.convergeX || p.x, convergeY: p.custom?.convergeY || p.y };
        break;
    }
  }

  /**
   * Spawn a burst of particles (convenience method).
   *
   * @param {object} config — Base particle config
   * @param {number} count — Number of particles to spawn
   * @param {number} [spreadX=0] — Random position spread on X
   * @param {number} [spreadY=0] — Random position spread on Y
   * @param {number} [speedVar=0] — Random velocity variation
   */
  spawnParticleBurst(config, count, spreadX = 0, spreadY = 0, speedVar = 0) {
    for (let i = 0; i < count; i++) {
      const cfg = { ...config };
      cfg.x = (config.x || 0) + (Math.random() - 0.5) * spreadX;
      cfg.y = (config.y || 0) + (Math.random() - 0.5) * spreadY;
      cfg.vx = (config.vx || 0) + (Math.random() - 0.5) * speedVar;
      cfg.vy = (config.vy || 0) + (Math.random() - 0.5) * speedVar;
      this.spawnParticle(cfg);
    }
  }

  /**
   * Spawn particles of a built-in type at a position.
   * Convenience method for common particle effects.
   *
   * @param {string} type — One of: dust, spark, blood, magic, leaf, snow, ember, scaleDust
   * @param {number} x — Spawn X
   * @param {number} y — Spawn Y
   * @param {number} [count=5] — Number of particles
   * @param {object} [overrides={}] — Override default properties
   */
  spawnParticleType(type, x, y, count = 5, overrides = {}) {
    const defaults = this._getParticleDefaults(type, x, y);

    for (let i = 0; i < count; i++) {
      const cfg = { ...defaults, ...overrides };
      // Add randomness
      cfg.x = x + (Math.random() - 0.5) * (overrides.spreadX || 10);
      cfg.y = y + (Math.random() - 0.5) * (overrides.spreadY || 10);
      cfg.vx = defaults.vx + (Math.random() - 0.5) * (overrides.speedVar || 50);
      cfg.vy = defaults.vy + (Math.random() - 0.5) * (overrides.speedVar || 50);
      cfg.size = defaults.size * (0.7 + Math.random() * 0.6);
      this.spawnParticle(cfg);
    }
  }

  /**
   * Get default particle config for built-in types.
   * @private
   */
  _getParticleDefaults(type, x, y) {
    const palette = this.currentPalette;
    switch (type) {
      case 'dust':
        return { x, y, vx: 0, vy: -20, life: 0.5, color: '#a1887f', size: 3, gravity: 60, fade: 0.8, type: 'dust' };
      case 'spark':
        return { x, y, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, life: 0.3, color: '#fff176', size: 2, gravity: 0, fade: 0.5, type: 'spark' };
      case 'blood':
        return { x, y, vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 40, life: 0.6, color: '#c62828', size: 3, gravity: 200, fade: 1.0, type: 'blood' };
      case 'magic':
        return { x, y, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 20, life: 1.0, color: '#9c27b0', size: 3, gravity: -30, fade: 0.4, type: 'magic' };
      case 'leaf':
        return { x, y, vx: 10 + Math.random() * 20, vy: 10 + Math.random() * 15, life: 2.0, color: palette.accent || '#7cb342', size: 4, gravity: 20, fade: 0.3, type: 'leaf' };
      case 'snow':
        return { x, y, vx: 0, vy: 30 + Math.random() * 20, life: 3.0, color: '#e2e8f0', size: 2, gravity: 30, fade: 0.1, type: 'snow' };
      case 'ember':
        return { x, y, vx: (Math.random() - 0.5) * 15, vy: -50 - Math.random() * 40, life: 1.2, color: '#ff6f00', size: 2, gravity: -40, fade: 0.4, type: 'ember' };
      case 'scaleDust':
        return { x, y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.8, color: '#00e5ff', size: 3, gravity: 0, fade: 0.5, type: 'scaleDust', custom: { convergeX: x, convergeY: y } };
      default:
        return { x, y, vx: 0, vy: 0, life: 1, color: '#ffffff', size: 2, gravity: 0, fade: 1, type: 'dust' };
    }
  }

  /**
   * Update all active particles.
   * Applies physics, wind, gravity, type-specific behavior, and culling.
   *
   * @param {number} dt — Delta time in seconds
   */
  updateParticles(dt) {
    // Update wind (slowly varying)
    this.windTimer += dt;
    this.windPhase += dt * 0.5;
    this.wind.x = WIND_DEFAULT.x + Math.sin(this.windPhase) * WIND_DEFAULT.turbulence;

    for (const p of this.particlePool) {
      if (!p.active) continue;

      // Decrease lifetime
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Update alpha based on remaining life
      const lifeRatio = p.life / p.maxLife;
      p.alpha = Math.pow(lifeRatio, p.fade);

      // Apply gravity
      p.vy += p.gravity * dt;

      // Apply wind (type-dependent)
      this._applyWind(p, dt);

      // Type-specific update
      this._updateParticleType(p, dt);

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Update rotation
      p.rotation += p.rotSpeed * dt;
    }

    this._recountParticles();
  }

  /**
   * Apply wind force to a particle based on its type.
   * @private
   */
  _applyWind(p, dt) {
    switch (p.type) {
      case 'leaf':
        p.vx += this.wind.x * dt * 0.5;
        break;
      case 'snow':
        p.vx += this.wind.x * dt * 0.3;
        break;
      case 'ember':
        p.vx += this.wind.x * dt * 0.2;
        break;
      case 'dust':
        p.vx += this.wind.x * dt * 0.1;
        break;
      // spark, blood, magic, scaleDust are less affected by wind
    }
  }

  /**
   * Type-specific particle update logic.
   * @private
   */
  _updateParticleType(p, dt) {
    switch (p.type) {
      case 'spark':
        // Bounce off virtual "ground"
        if (p.vy > 0 && p.y > p.custom?.floorY || 2000) {
          p.vy *= -0.5;
          p.vx *= 0.8;
        }
        // Rapid shrink
        p.size *= 0.99;
        break;

      case 'magic':
        // Sparkle effect
        if (p.custom) {
          p.custom.sparkleTimer -= dt;
          if (p.custom.sparkleTimer <= 0) {
            p.custom.sparkleTimer = 0.1 + Math.random() * 0.3;
            // Brief size pulse
            p.size *= 1.3;
          } else {
            p.size *= 0.995;
          }
        }
        // Slight horizontal drift
        p.vx += Math.sin(this.windTimer * 3 + p.x) * 10 * dt;
        break;

      case 'leaf':
        // Swaying motion
        if (p.custom) {
          p.vx += Math.sin(this.windTimer * 2 + p.custom.swayPhase) * p.custom.swayAmp * dt;
        }
        p.rotSpeed = this.wind.x * 0.1;
        break;

      case 'snow':
        // Gentle sway
        if (p.custom) {
          p.vx += Math.cos(this.windTimer + p.custom.swayPhase) * p.custom.swayAmp * dt;
        }
        break;

      case 'ember':
        // Flicker
        if (p.custom) {
          p.custom.flickerTimer -= dt;
          if (p.custom.flickerTimer <= 0) {
            p.custom.flickerTimer = 0.05 + Math.random() * 0.15;
            p.alpha *= (0.6 + Math.random() * 0.4);
          }
        }
        // Wiggle
        p.vx += Math.sin(this.windTimer * 5 + p.y * 0.1) * 5 * dt;
        break;

      case 'scaleDust':
        // Converge toward center point
        if (p.custom) {
          const dx = p.custom.convergeX - p.x;
          const dy = p.custom.convergeY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            const convergeForce = 100;
            p.vx += (dx / dist) * convergeForce * dt;
            p.vy += (dy / dist) * convergeForce * dt;
          }
          // Spiral
          p.vx += -dy * 2 * dt;
          p.vy += dx * 2 * dt;
        }
        break;

      case 'blood':
        // Stick to ground when landing
        if (p.vy > 0 && p.gravity > 100) {
          // Slow down horizontal
          p.vx *= 0.95;
        }
        break;
    }
  }

  /**
   * Render all active particles.
   */
  renderParticles() {
    const ctx = this.ctx;

    for (const p of this.particlePool) {
      if (!p.active) continue;
      if (p.alpha <= 0.01) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scaleX, p.scaleY);

      // Parse color
      ctx.fillStyle = p.color;

      // Draw based on particle type
      switch (p.type) {
        case 'spark':
          // Glowing line
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size * 2, p.size);
          break;

        case 'magic':
          // Glowing diamond
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.6, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          break;

        case 'leaf':
          // Oval leaf shape
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          // Vein line
          ctx.strokeStyle = this._darkenColor(p.color, 20);
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(-p.size + 1, 0);
          ctx.lineTo(p.size - 1, 0);
          ctx.stroke();
          break;

        case 'snow':
          // Soft circle with glow
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'ember':
          // Flickering orange glow
          ctx.shadowColor = '#ff9800';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (0.8 + Math.random() * 0.4), 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'scaleDust':
          // Cyan glowing square
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 8;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          break;

        case 'blood':
          // Irregular splat
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          // Small droplets
          if (p.alpha > 0.5) {
            ctx.beginPath();
            ctx.arc(p.size, p.size * 0.5, p.size * 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        default: // dust, and fallback
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }

      ctx.restore();
    }
  }

  /**
   * Recount active particles.
   * @private
   */
  _recountParticles() {
    let count = 0;
    for (const p of this.particlePool) {
      if (p.active) count++;
    }
    this.particleCount = count;
  }

  // --------------------------------------------------------------------------
  // Post-Processing Effects
  // --------------------------------------------------------------------------
  /**
   * Apply post-processing effects:
   * - Vignette (darken screen edges)
   * - Chromatic aberration (on hit)
   * - Hit flash (red flash when player is damaged)
   */
  applyPostFX() {
    const ctx = this.ctx;

    // Chromatic aberration decays
    if (this.chromaticAberration > 0.1) {
      this.chromaticAberration *= 0.9;
    } else {
      this.chromaticAberration = 0;
    }

    // Hit flash decays
    if (this.hitFlashIntensity > 0.01) {
      this.hitFlashIntensity *= 0.85;
    } else {
      this.hitFlashIntensity = 0;
    }

    // Apply vignette
    this._drawVignette(ctx);

    // Apply hit flash
    if (this.hitFlashIntensity > 0) {
      ctx.fillStyle = `rgba(200, 30, 30, ${this.hitFlashIntensity * 0.3})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Apply chromatic aberration (subtle RGB channel separation)
    if (this.chromaticAberration > 0.5) {
      this._drawChromaticAberration(ctx);
    }
  }

  /**
   * Draw vignette effect — darken screen edges using a radial gradient.
   * Creates atmospheric focus on the center of the screen.
   * @private
   */
  _drawVignette(ctx) {
    const w = this.width;
    const h = this.height;
    const radius = Math.max(w, h) * 0.7;

    const gradient = ctx.createRadialGradient(
      w / 2, h / 2, radius * 0.4,
      w / 2, h / 2, radius
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, `rgba(0, 0, 0, ${this.vignetteIntensity * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 0, 0, ${this.vignetteIntensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Apply chromatic aberration effect.
   * Creates RGB channel separation at screen edges.
   * @private
   */
  _drawChromaticAberration(ctx) {
    const offset = this.chromaticAberration;

    // Save current canvas content
    const imageData = ctx.getImageData(0, 0, this.width, this.height);

    // This is a simplified approximation — in a full implementation,
    // we'd use composite operations for better performance.
    // For now, we apply a colored edge glow to simulate the effect.
    const gradient = ctx.createRadialGradient(
      this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.3,
      this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.6
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(100, 0, 0, ${Math.min(0.1, offset / 50)})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    void imageData; // Acknowledge we captured it (future use)
  }

  /**
   * Trigger a hit flash effect (red screen flash when player takes damage).
   * @param {number} intensity — Flash intensity (0-1)
   */
  triggerHitFlash(intensity = 0.8) {
    this.hitFlashIntensity = Math.max(this.hitFlashIntensity, intensity);
  }

  /**
   * Trigger chromatic aberration effect.
   * @param {number} amount — Aberration pixel offset
   */
  triggerChromaticAberration(amount = 5) {
    this.chromaticAberration = Math.max(this.chromaticAberration, amount);
  }

  // --------------------------------------------------------------------------
  // Wind System
  // --------------------------------------------------------------------------
  /**
   * Set the wind direction and strength.
   * Affects leaf, snow, ember, and dust particles.
   *
   * @param {number} x — Horizontal wind speed
   * @param {number} y — Vertical wind speed
   * @param {number} turbulence — Random variation amount
   */
  setWind(x, y, turbulence = 5) {
    this.wind.x = x;
    this.wind.y = y;
    this.wind.turbulence = turbulence;
  }

  /**
   * Reset wind to default values.
   */
  resetWind() {
    this.wind = { ...WIND_DEFAULT };
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------
  /**
   * Lighten a hex color by a percentage.
   * @param {string} hex — Hex color string
   * @param {number} percent — Percentage to lighten
   * @returns {string} Lightened hex color
   */
  _lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
    const b = Math.min(255, (num & 0x0000FF) + percent);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Darken a hex color by a percentage.
   * @param {string} hex — Hex color string
   * @param {number} percent — Percentage to darken
   * @returns {string} Darkened hex color
   */
  _darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
    const b = Math.max(0, (num & 0x0000FF) - percent);
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Adjust brightness of a color (hex or rgb) by a delta.
   * @param {string} color — Color string
   * @param {number} delta — Brightness delta (positive = lighter)
   * @returns {string} Adjusted rgb color
   */
  _adjustBrightness(color, delta) {
    if (color.startsWith('#')) {
      const num = parseInt(color.replace('#', ''), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + delta));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + delta));
      const b = Math.min(255, Math.max(0, (num & 0x0000FF) + delta));
      return `rgb(${r},${g},${b})`;
    }
    if (color.startsWith('rgb')) {
      const match = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = Math.min(255, Math.max(0, parseInt(match[1]) + delta));
        const g = Math.min(255, Math.max(0, parseInt(match[2]) + delta));
        const b = Math.min(255, Math.max(0, parseInt(match[3]) + delta));
        return `rgb(${r},${g},${b})`;
      }
    }
    return color;
  }

  /**
   * Convert hex color to RGB object.
   * @param {string} hex — Hex color string
   * @returns {object} { r, g, b }
   */
  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  }

  // --------------------------------------------------------------------------
  // Resize
  // --------------------------------------------------------------------------
  /**
   * Update dimensions when the canvas is resized.
   * @param {number} w — New width
   * @param {number} h — New height
   */
  resize(w, h) {
    this.width = w;
    this.height = h;

    // Resize lighting canvas
    this.lightingCanvas.width = w;
    this.lightingCanvas.height = h;
  }

  // --------------------------------------------------------------------------
  // Stats / Debug
  // --------------------------------------------------------------------------
  /**
   * Get renderer statistics.
   * @returns {object} { particleCount, activeLights, palette, width, height }
   */
  getStats() {
    return {
      particleCount: this.particleCount,
      activeLights: this.lights.length,
      palette: this._lastPaletteKey,
      width: this.width,
      height: this.height,
      wind: { ...this.wind }
    };
  }
}

// Make Renderer class available globally
window.Renderer = Renderer;
