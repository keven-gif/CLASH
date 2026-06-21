/**
 * @file WorldManager.js
 * @description Seeded deterministic chunk-based world generation with 6 biomes,
 *   weather system, day/night cycle, dungeon generation, and collision detection.
 *   Uses mulberry32 PRNG for fully deterministic world generation from a seed.
 */

/**
 * mulberry32 seeded pseudo-random number generator.
 * @param {number} a - Seed value.
 * @returns {function(): number} A function that returns floats in [0,1).
 */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simple 2D noise helper using smoothed value noise (deterministic).
 * @param {function(): number} rng - Seeded random function.
 * @returns {function(number,number): number} Noise function.
 */
function createNoise2D(rng) {
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  // Shuffle
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const grad = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
  ];
  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function dot(g, x, y) {
    return g[0] * x + g[1] * y;
  }
  return function (x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[(perm[xi] + yi) & 255] & 7;
    const ab = perm[(perm[xi] + yi + 1) & 255] & 7;
    const ba = perm[(perm[xi + 1] + yi) & 255] & 7;
    const bb = perm[(perm[xi + 1] + yi + 1) & 255] & 7;
    const x1 = lerp(dot(grad[aa], xf, yf), dot(grad[ba], xf - 1, yf), u);
    const x2 = lerp(dot(grad[ab], xf, yf - 1), dot(grad[bb], xf - 1, yf - 1), u);
    return lerp(x1, x2, v) * 0.5 + 0.5; // normalize to [0,1]
  };
}

/** @typedef {string} Biome - One of FOREST, DESERT, MOUNTAIN, SWAMP, ICE, VOLCANO */

/** @typedef {Object} ChunkData
 * @property {number} x - Chunk x coordinate.
 * @property {number} y - Chunk y coordinate.
 * @property {Uint16Array} tiles - 256 tile IDs (16x16).
 * @property {Biome} biome - Dominant biome for this chunk.
 * @property {Array<Object>} decorations - Decorative objects.
 * @property {Array<Object>} entities - Entity spawn records.
 * @property {Uint8Array} collision - Collision flags per tile.
 */

/** @typedef {Object} ShrinkZone
 * @property {number} x - World x position in pixels.
 * @property {number} y - World y position in pixels.
 * @property {number} radius - Zone radius in pixels.
 * @property {boolean} active - Whether the zone is active.
 */

/** @typedef {Object} DungeonRoom
 * @property {number} x - Room x position in chunk tiles.
 * @property {number} y - Room y position in chunk tiles.
 * @property {number} w - Room width in tiles.
 * @property {number} h - Room height in tiles.
 * @property {number} cx - Room center x in tiles.
 * @property {number} cy - Room center y in tiles.
 * @property {number} id - Room index.
 * @property {Array<number>} connections - Connected room indices.
 */

/** @typedef {Object} DungeonData
 * @property {number} id - Dungeon index.
 * @property {string} biome - Biome theme.
 * @property {number} width - Dungeon width in tiles.
 * @property {number} height - Dungeon height in tiles.
 * @property {Array<DungeonRoom>} rooms - Generated rooms.
 * @property {Uint16Array} tiles - Dungeon tilemap.
 * @property {number} entranceX - Entrance x in pixels.
 * @property {number} entranceY - Entrance y in pixels.
 * @property {number} bossX - Boss room x in pixels.
 * @property {number} bossY - Boss room y in pixels.
 */

/**
 * Biome tile palette definitions. Each entry provides ground, wall, water,
 * and decoration tile IDs for a specific biome.
 */
const BIOME_TILES = {
  FOREST:   { ground: [1, 2, 3], wall: [10, 11], water: 20, decor: [30, 31, 32], platform: [60, 61] },
  DESERT:   { ground: [2, 3, 4], wall: [11, 12], water: 20, decor: [31, 33],   platform: [60, 61] },
  MOUNTAIN: { ground: [3, 4, 5], wall: [12, 13], water: 22, decor: [32, 34],   platform: [62, 63] },
  SWAMP:    { ground: [1, 2, 6], wall: [13, 14], water: 20, decor: [30, 35],   platform: [60, 62] },
  ICE:      { ground: [5, 7, 8], wall: [14, 15], water: 22, decor: [34, 35],   platform: [63, 64] },
  VOLCANO:  { ground: [4, 6, 7], wall: [10, 15], water: 21, decor: [33, 35],   platform: [61, 65] },
};

/**
 * WorldManager — Manages all world generation, chunk storage, biome determination,
 * weather transitions, day/night cycle, dungeon generation, and collision queries.
 */
class WorldManager {
  /**
   * Create a new WorldManager.
   * @param {number} seed - World seed for deterministic generation.
   */
  constructor(seed) {
    this.seed = seed;
    this.tileSize = 32;
    this.chunkSize = 16;       // tiles per chunk
    this.chunkPixelSize = this.chunkSize * this.tileSize; // 512 px
    this.renderDistance = 3;   // chunks visible radius
    this.chunks = new Map();   // key: "cx,cy" → ChunkData
    this.biomes = ['FOREST', 'DESERT', 'MOUNTAIN', 'SWAMP', 'ICE', 'VOLCANO'];
    this.currentBiome = 'FOREST';
    this.weather = 'clear';
    this.weatherIntensity = 0;
    this.targetWeather = 'clear';
    this.targetWeatherIntensity = 0;
    this.weatherTransitionTimer = 0;
    this.weatherTransitionDuration = 30; // 30 seconds
    this.dungeons = [];
    this.activeDungeon = null; // DungeonData or null
    this.dungeonChunks = new Map(); // tile data when inside dungeon
    this.worldTime = 6000;     // Start at dawn (0-24000)
    this.timeOfDay = 'dawn';
    this.dayNightSpeed = 1.0;  // game-time seconds per real second
    this.shrinkZones = [];
    this._weatherTimer = 0;
    this._nextWeatherChange = 60; // seconds until next weather check
    this._dungeonCounter = 0;

    // Create global RNG from seed
    this._rng = mulberry32(this.seed);

    // Pre-generate noise functions seeded from world seed
    this._noise1 = createNoise2D(mulberry32(this.seed));
    this._noise2 = createNoise2D(mulberry32(this.seed + 7919));
    this._noise3 = createNoise2D(mulberry32(this.seed + 104729));

    // Biome section size in chunks (each biome is a large region)
    this.biomeChunkWidth = 12;
    this.biomeChunkHeight = 12;

    // Initialize global event bus if needed
    if (!window.GameEvents) {
      window.GameEvents = document.createElement('div');
    }
  }

  // ─── Utility ───────────────────────────────────────────────────────────

  /**
   * Get a deterministic RNG for a specific chunk coordinate.
   * This ensures the same chunk always generates identically.
   * @param {number} cx - Chunk x coordinate.
   * @param {number} cy - Chunk y coordinate.
   * @returns {function(): number} Seeded random function.
   */
  _getChunkRng(cx, cy) {
    // Hash chunk coords with world seed
    const hash = ((cx * 73856093) ^ (cy * 19349663) ^ (this.seed * 83492791)) >>> 0;
    return mulberry32(hash);
  }

  /**
   * Get deterministic noise value at a world position.
   * @param {number} x - World x in tiles.
   * @param {number} y - World y in tiles.
   * @param {number} freq - Noise frequency.
   * @returns {number} Value in [0,1].
   */
  _getNoise(x, y, freq = 1) {
    return this._noise1(x * freq, y * freq);
  }

  /**
   * Get the second noise layer.
   * @param {number} x - World x in tiles.
   * @param {number} y - World y in tiles.
   * @param {number} freq - Noise frequency.
   * @returns {number} Value in [0,1].
   */
  _getNoise2(x, y, freq = 1) {
    return this._noise2(x * freq, y * freq);
  }

  /**
   * Compute the chunk key string.
   * @param {number} cx - Chunk x.
   * @param {number} cy - Chunk y.
   * @returns {string} Key like "3,-7".
   */
  _chunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  /**
   * Convert pixel coordinates to chunk coordinates.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {[number, number]} [cx, cy] chunk coordinates.
   */
  _pixelToChunk(px, py) {
    const cx = Math.floor(px / this.chunkPixelSize);
    const cy = Math.floor(py / this.chunkPixelSize);
    return [cx, cy];
  }

  /**
   * Convert pixel coordinates to local tile coordinates within a chunk.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {[number, number, number, number]} [cx, cy, tx, ty].
   */
  _pixelToTile(px, py) {
    const cx = Math.floor(px / this.chunkPixelSize);
    const cy = Math.floor(py / this.chunkPixelSize);
    const tx = Math.floor((px - cx * this.chunkPixelSize) / this.tileSize);
    const ty = Math.floor((py - cy * this.chunkPixelSize) / this.tileSize);
    return [cx, cy, tx, ty];
  }

  /**
   * Clamp a value to [0, max].
   * @param {number} v - Value.
   * @param {number} max - Maximum.
   * @returns {number} Clamped value.
   */
  _clamp(v, max) {
    return Math.max(0, Math.min(max, v));
  }

  // ─── Biome Determination ───────────────────────────────────────────────

  /**
   * Determine the dominant biome at a given chunk coordinate.
   * The overworld is divided into a 3x2 grid of biome regions.
   * Transitions blend between adjacent biomes.
   * @param {number} cx - Chunk x coordinate.
   * @param {number} cy - Chunk y coordinate.
   * @returns {Biome} The biome name.
   */
  _getBiomeForChunk(cx, cy) {
    // Normalize to biome grid: 3 columns, 2 rows
    const col = Math.floor(cx / this.biomeChunkWidth);
    const row = Math.floor(cy / this.biomeChunkHeight);
    const c = ((col % 3) + 3) % 3;
    const r = ((row % 2) + 2) % 2;
    // Map: row 0 = top, row 1 = bottom; col 0-2 = left to right
    const idx = r * 3 + c;
    return this.biomes[idx] || 'FOREST';
  }

  /**
   * Get the biome at a specific pixel position.
   * Accounts for blend zones at biome boundaries.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {Biome} Biome name.
   */
  getBiomeAt(px, py) {
    const [cx] = this._pixelToChunk(px, py);
    const [, cy] = this._pixelToChunk(px, py);
    const baseBiome = this._getBiomeForChunk(cx, cy);
    // Blend at boundaries using noise
    const localX = (px / this.chunkPixelSize) / this.biomeChunkWidth;
    const localY = (py / this.chunkPixelSize) / this.biomeChunkHeight;
    const blend = this._getNoise(localX * 3, localY * 3, 1);
    if (blend > 0.85) {
      // Occasionally blend to adjacent biome
      const neighbors = this._getNeighborBiomes(cx, cy);
      return neighbors[(blend * 100 | 0) % neighbors.length];
    }
    return baseBiome;
  }

  /**
   * Get the biomes of neighboring chunks.
   * @param {number} cx - Chunk x.
   * @param {number} cy - Chunk y.
   * @returns {Array<Biome>} Neighbor biome names.
   */
  _getNeighborBiomes(cx, cy) {
    const neighbors = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
      neighbors.push(this._getBiomeForChunk(cx + dx, cy + dy));
    }
    return neighbors;
  }

  /**
   * Get preferred weather for a biome.
   * @param {Biome} biome - Biome name.
   * @returns {string} Weather type.
   */
  _getBiomeWeather(biome) {
    const weatherMap = {
      FOREST: 'rain',
      DESERT: 'clear',
      MOUNTAIN: 'snow',
      SWAMP: 'fog',
      ICE: 'blizzard',
      VOLCANO: 'ash',
    };
    return weatherMap[biome] || 'clear';
  }

  // ─── Chunk Generation ──────────────────────────────────────────────────

  /**
   * Generate a chunk at the given chunk coordinates deterministically.
   * Uses the chunk-seeded RNG so the same (cx, cy, seed) always produces
   * the same chunk data.
   * @param {number} cx - Chunk x coordinate.
   * @param {number} cy - Chunk y coordinate.
   * @returns {ChunkData} Generated chunk.
   */
  generateChunk(cx, cy) {
    const key = this._chunkKey(cx, cy);
    if (this.chunks.has(key)) return this.chunks.get(key);

    const rng = this._getChunkRng(cx, cy);
    const biome = this._getBiomeForChunk(cx, cy);
    const tiles = new Uint16Array(this.chunkSize * this.chunkSize);
    const collision = new Uint8Array(this.chunkSize * this.chunkSize);
    const decorations = [];
    const entities = [];
    const palette = BIOME_TILES[biome];
    const worldTileX = cx * this.chunkSize;
    const worldTileY = cy * this.chunkSize;

    // --- Terrain generation using multiple noise octaves ---
    for (let ty = 0; ty < this.chunkSize; ty++) {
      for (let tx = 0; tx < this.chunkSize; tx++) {
        const idx = ty * this.chunkSize + tx;
        const wx = worldTileX + tx;
        const wy = worldTileY + ty;

        // Primary height/noise map (terrain shape)
        const n1 = this._getNoise(wx * 0.05, wy * 0.05);
        const n2 = this._getNoise2(wx * 0.12, wy * 0.12);
        const n3 = this._getNoise(wx * 0.25, wy * 0.25, 1);

        // Blend multiple octaves for natural terrain
        const elevation = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

        let tileId = 0;
        let solid = false;

        // Terrain placement rules
        if (elevation < 0.15) {
          // Low areas: water, lava, or ice depending on biome
          if (biome === 'VOLCANO') tileId = 21; // lava
          else if (biome === 'ICE') tileId = 22; // ice
          else tileId = 20; // water
          solid = false;
        } else if (elevation < 0.35) {
          // Shore/transition tiles
          tileId = palette.ground[0];
        } else if (elevation < 0.7) {
          // Ground tiles with variation
          const gIdx = (Math.floor(n2 * 100) + tx + ty) % palette.ground.length;
          tileId = palette.ground[gIdx];
        } else if (elevation < 0.88) {
          // Wall/obstacle tiles
          tileId = palette.wall[0];
          solid = true;
        } else {
          // Solid walls / cliffs
          tileId = palette.wall[1];
          solid = true;
        }

        // Biome-specific overrides
        if (biome === 'SWAMP' && n3 > 0.7) {
          tileId = 20; // Water pools in swamp
          solid = false;
        }
        if (biome === 'DESERT' && n2 > 0.75 && elevation > 0.35) {
          tileId = palette.ground[2]; // Sand dunes
        }
        if (biome === 'MOUNTAIN' && elevation > 0.65) {
          tileId = palette.wall[0]; // Rocky
          solid = true;
        }
        if (biome === 'VOLCANO' && n3 > 0.65 && elevation > 0.3) {
          tileId = 21; // Lava cracks
          solid = false;
        }
        if (biome === 'ICE' && n2 > 0.5) {
          tileId = 22; // Ice patches
          solid = false;
        }

        tiles[idx] = tileId;
        collision[idx] = solid ? 1 : 0;

        // Platform generation (jump-through platforms)
        if (!solid && elevation > 0.4 && elevation < 0.55 && n3 > 0.75) {
          const platIdx = (Math.floor(rng() * palette.platform.length));
          tiles[idx] = palette.platform[platIdx];
          collision[idx] = 2; // 2 = platform (jump-through)
        }

        // --- Decorations ---
        if (!solid && tileId !== 0 && tileId !== 20 && tileId !== 21 && tileId !== 22) {
          if (rng() < 0.06) {
            const decorId = palette.decor[Math.floor(rng() * palette.decor.length)];
            decorations.push({
              x: tx * this.tileSize,
              y: ty * this.tileSize,
              type: decorId,
              variant: Math.floor(rng() * 4),
            });
          }
          // Grass tufts
          if (rng() < 0.03) {
            decorations.push({
              x: tx * this.tileSize,
              y: ty * this.tileSize,
              type: 30,
              variant: Math.floor(rng() * 3),
            });
          }
        }
      }
    }

    // --- Shrink zone generation (rare, biome-dependent) ---
    if (rng() < 0.08) {
      const szx = (Math.floor(rng() * 12) + 2) * this.tileSize;
      const szy = (Math.floor(rng() * 12) + 2) * this.tileSize;
      decorations.push({
        x: szx,
        y: szy,
        type: 40, // shrink zone marker
        variant: 0,
      });
      // Register as a shrink zone
      this.shrinkZones.push({
        x: cx * this.chunkPixelSize + szx,
        y: cy * this.chunkPixelSize + szy,
        radius: 64,
        active: true,
      });
    }

    // --- Dungeon entrance generation (very rare) ---
    if (rng() < 0.015 && this.dungeons.length < 6) {
      const dex = (Math.floor(rng() * 10) + 3) * this.tileSize;
      const dey = (Math.floor(rng() * 10) + 3) * this.tileSize;
      tiles[(Math.floor(dey / this.tileSize)) * this.chunkSize + Math.floor(dex / this.tileSize)] = 50;
      this.dungeons.push({
        id: this._dungeonCounter++,
        x: cx * this.chunkPixelSize + dex,
        y: cy * this.chunkPixelSize + dey,
        biome,
        entered: false,
      });
    }

    // --- Entity spawn generation ---
    const enemySpawnChance = biome === 'VOLCANO' ? 0.04 : biome === 'FOREST' ? 0.03 : 0.025;
    for (let ty = 0; ty < this.chunkSize; ty++) {
      for (let tx = 0; tx < this.chunkSize; tx++) {
        if (rng() < enemySpawnChance) {
          const epx = cx * this.chunkPixelSize + tx * this.tileSize;
          const epy = cy * this.chunkPixelSize + ty * this.tileSize;
          // Only spawn on walkable ground
          const idx = ty * this.chunkSize + tx;
          if (collision[idx] === 0 && tiles[idx] !== 20 && tiles[idx] !== 21 && tiles[idx] !== 22) {
            const enemyType = this._pickEnemyType(biome, rng);
            entities.push({
              x: epx,
              y: epy,
              type: enemyType,
              active: true,
            });
          }
        }
      }
    }

    // Ensure there is a clear ground path through the chunk
    this._carvePassages(tiles, collision, rng, palette);

    const chunk = {
      x: cx,
      y: cy,
      tiles,
      biome,
      decorations,
      entities,
      collision,
    };

    this.chunks.set(key, chunk);
    return chunk;
  }

  /**
   * Carve horizontal and vertical passages through a chunk to ensure
   * the player can traverse without getting stuck.
   * @param {Uint16Array} tiles - Chunk tile data (mutated).
   * @param {Uint8Array} collision - Chunk collision data (mutated).
   * @param {function(): number} rng - Chunk RNG.
   * @param {Object} palette - Biome tile palette.
   */
  _carvePassages(tiles, collision, rng, palette) {
    // Horizontal passage at a random row
    const passRow = 6 + Math.floor(rng() * 4);
    for (let tx = 1; tx < this.chunkSize - 1; tx++) {
      const idx = passRow * this.chunkSize + tx;
      if (collision[idx] === 1) {
        tiles[idx] = palette.ground[0];
        collision[idx] = 0;
      }
      // Also clear the tile above for headroom
      const aboveIdx = (passRow - 1) * this.chunkSize + tx;
      if (collision[aboveIdx] === 1) {
        tiles[aboveIdx] = palette.ground[0];
        collision[aboveIdx] = 0;
      }
    }
    // Vertical passage at a random column
    const passCol = 6 + Math.floor(rng() * 4);
    for (let ty = 1; ty < this.chunkSize - 1; ty++) {
      const idx = ty * this.chunkSize + passCol;
      if (collision[idx] === 1) {
        tiles[idx] = palette.ground[0];
        collision[idx] = 0;
      }
    }
  }

  /**
   * Pick an enemy type appropriate for the given biome.
   * @param {Biome} biome - Biome name.
   * @param {function(): number} rng - Random function.
   * @returns {string} Enemy type name.
   */
  _pickEnemyType(biome, rng) {
    const enemyMap = {
      FOREST:   ['GRUNT', 'ARCHER', 'FLYER'],
      DESERT:   ['GRUNT', 'ARCHER', 'ASSASSIN'],
      MOUNTAIN: ['BRUTE', 'ARCHER', 'MAGE'],
      SWAMP:    ['GRUNT', 'MAGE', 'BRUTE'],
      ICE:      ['ARCHER', 'MAGE', 'FLYER'],
      VOLCANO:  ['BRUTE', 'ASSASSIN', 'MAGE'],
    };
    const pool = enemyMap[biome] || ['GRUNT'];
    return pool[Math.floor(rng() * pool.length)];
  }

  /**
   * Get or generate a chunk at chunk coordinates.
   * @param {number} cx - Chunk x.
   * @param {number} cy - Chunk y.
   * @returns {ChunkData} The chunk data.
   */
  getChunkAt(cx, cy) {
    const key = this._chunkKey(cx, cy);
    if (this.chunks.has(key)) return this.chunks.get(key);
    return this.generateChunk(cx, cy);
  }

  /**
   * Get or generate a chunk at pixel coordinates.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {ChunkData} The chunk data.
   */
  getChunk(px, py) {
    const [cx, cy] = this._pixelToChunk(px, py);
    return this.getChunkAt(cx, cy);
  }

  /**
   * Get the tile ID at a specific pixel position.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {number} Tile ID (0 if out of bounds or no chunk).
   */
  getTile(px, py) {
    if (this.activeDungeon) {
      return this._getDungeonTile(px, py);
    }
    const [cx, cy, tx, ty] = this._pixelToTile(px, py);
    if (tx < 0 || tx >= this.chunkSize || ty < 0 || ty >= this.chunkSize) return 0;
    const chunk = this.getChunkAt(cx, cy);
    return chunk.tiles[ty * this.chunkSize + tx];
  }

  /**
   * Set a tile at a specific pixel position.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @param {number} tileId - Tile ID to set.
   */
  setTile(px, py, tileId) {
    const [cx, cy, tx, ty] = this._pixelToTile(px, py);
    if (tx < 0 || tx >= this.chunkSize || ty < 0 || ty >= this.chunkSize) return;
    const chunk = this.getChunkAt(cx, cy);
    const idx = ty * this.chunkSize + tx;
    chunk.tiles[idx] = tileId;
    // Update collision based on tile type
    chunk.collision[idx] = this._tileIsSolid(tileId) ? 1 : this._tileIsPlatform(tileId) ? 2 : 0;
  }

  /**
   * Check if a tile ID is solid (impassable).
   * @param {number} tileId - The tile ID.
   * @returns {boolean} True if solid.
   */
  _tileIsSolid(tileId) {
    if (tileId >= 10 && tileId <= 15) return true; // walls
    return false;
  }

  /**
   * Check if a tile ID is a platform (jump-through).
   * @param {number} tileId - The tile ID.
   * @returns {boolean} True if a platform.
   */
  _tileIsPlatform(tileId) {
    return tileId >= 60 && tileId <= 65;
  }

  /**
   * Check if a pixel position is solid (blocked).
   * Handles chunk loading and tile collision.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {boolean} True if the position is solid.
   */
  isSolid(px, py) {
    if (this.activeDungeon) {
      return this._getDungeonCollision(px, py) === 1;
    }
    const [cx, cy, tx, ty] = this._pixelToTile(px, py);
    if (tx < 0 || tx >= this.chunkSize || ty < 0 || ty >= this.chunkSize) return true; // Out of bounds = solid
    const chunk = this.getChunkAt(cx, cy);
    return chunk.collision[ty * this.chunkSize + tx] === 1;
  }

  /**
   * Check if a pixel position is a one-way platform.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {boolean} True if the position is a platform.
   */
  isPlatform(px, py) {
    if (this.activeDungeon) {
      return this._getDungeonCollision(px, py) === 2;
    }
    const [cx, cy, tx, ty] = this._pixelToTile(px, py);
    if (tx < 0 || tx >= this.chunkSize || ty < 0 || ty >= this.chunkSize) return false;
    const chunk = this.getChunkAt(cx, cy);
    return chunk.collision[ty * this.chunkSize + tx] === 2;
  }

  /**
   * Get the collision value at a pixel position (0=empty, 1=solid, 2=platform).
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {number} Collision type.
   */
  getCollision(px, py) {
    if (this.activeDungeon) {
      return this._getDungeonCollision(px, py);
    }
    const [cx, cy, tx, ty] = this._pixelToTile(px, py);
    if (tx < 0 || tx >= this.chunkSize || ty < 0 || ty >= this.chunkSize) return 1;
    const chunk = this.getChunkAt(cx, cy);
    return chunk.collision[ty * this.chunkSize + tx];
  }

  // ─── Dungeon Generation ────────────────────────────────────────────────

  /**
   * Generate a procedural dungeon layout.
   * Creates 8-15 rooms connected by corridors, with a key-door
   * progression and the boss room placed farthest from the entrance.
   * @param {number} dungeonId - Dungeon index.
   * @returns {DungeonData} The generated dungeon.
   */
  generateDungeon(dungeonId) {
    const rng = mulberry32(this.seed + dungeonId * 9973);
    const biome = this.dungeons[dungeonId]?.biome || 'FOREST';
    const palette = BIOME_TILES[biome];

    const dWidth = 60;   // tiles
    const dHeight = 40;  // tiles
    const numRooms = 8 + Math.floor(rng() * 8); // 8-15 rooms
    const rooms = [];
    const dTiles = new Uint16Array(dWidth * dHeight);
    const dCollision = new Uint8Array(dWidth * dHeight);
    // Fill with walls
    for (let i = 0; i < dTiles.length; i++) {
      dTiles[i] = palette.wall[0];
      dCollision[i] = 1;
    }

    // --- Room placement with simple separation ---
    const maxAttempts = 200;
    let attempts = 0;
    while (rooms.length < numRooms && attempts < maxAttempts) {
      attempts++;
      const rw = 5 + Math.floor(rng() * 6); // 5-10
      const rh = 4 + Math.floor(rng() * 5); // 4-8
      const rx = 2 + Math.floor(rng() * (dWidth - rw - 4));
      const ry = 2 + Math.floor(rng() * (dHeight - rh - 4));

      // Check overlap with existing rooms (with margin)
      let overlaps = false;
      for (const r of rooms) {
        if (rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      const room = {
        x: rx, y: ry, w: rw, h: rh,
        cx: rx + Math.floor(rw / 2),
        cy: ry + Math.floor(rh / 2),
        id: rooms.length,
        connections: [],
      };
      rooms.push(room);

      // Carve room into tiles
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          const idx = y * dWidth + x;
          dTiles[idx] = palette.ground[Math.floor(rng() * palette.ground.length)];
          dCollision[idx] = 0;
        }
      }
    }

    // Sort rooms by x-position; first room is entrance
    rooms.sort((a, b) => a.x - b.x);
    const entranceRoom = rooms[0];
    // Boss room = farthest from entrance (by Manhattan distance)
    let bossRoom = rooms[0];
    let maxDist = 0;
    for (const r of rooms) {
      const dist = Math.abs(r.cx - entranceRoom.cx) + Math.abs(r.cy - entranceRoom.cy);
      if (dist > maxDist) {
        maxDist = dist;
        bossRoom = r;
      }
    }
    bossRoom.isBossRoom = true;
    entranceRoom.isEntrance = true;

    // --- Connect rooms with corridors (minimum spanning tree + some extra) ---
    const connected = new Set([0]);
    const edges = [];
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        const dist = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy);
        edges.push({ i, j, dist });
      }
    }
    edges.sort((a, b) => a.dist - b.dist);

    for (const edge of edges) {
      if (connected.has(edge.i) && connected.has(edge.j)) continue;
      const a = rooms[edge.i];
      const b = rooms[edge.j];

      // L-shaped corridor from a center to b center
      this._carveCorridor(dTiles, dCollision, a.cx, a.cy, b.cx, b.cy, dWidth, palette, rng);

      a.connections.push(edge.j);
      b.connections.push(edge.i);
      connected.add(edge.i);
      connected.add(edge.j);
    }

    // Add a few extra corridors for loops
    const extraEdges = edges.filter(e => !rooms[e.i].connections.includes(e.j));
    for (let k = 0; k < 2 && k < extraEdges.length; k++) {
      const e = extraEdges[k];
      this._carveCorridor(dTiles, dCollision, rooms[e.i].cx, rooms[e.i].cy, rooms[e.j].cx, rooms[e.j].cy, dWidth, palette, rng);
    }

    // --- Place keys and locked doors ---
    // Simple key-door: 1-2 key+door pairs placed between entrance and boss
    const keyCount = 1 + Math.floor(rng() * 2);
    for (let k = 0; k < keyCount; k++) {
      // Place key in a room that's not entrance and not boss
      const keyRoomIdx = 1 + Math.floor(rng() * (rooms.length - 2));
      const keyRoom = rooms[keyRoomIdx];
      const kx = keyRoom.x + 1 + Math.floor(rng() * (keyRoom.w - 2));
      const ky = keyRoom.y + 1 + Math.floor(rng() * (keyRoom.h - 2));
      const kIdx = ky * dWidth + kx;
      dTiles[kIdx] = 36; // key tile
      dCollision[kIdx] = 0;

      // Place locked door in a corridor near the boss room
      const doorRoomIdx = Math.max(2, rooms.length - 2 - k);
      const doorRoom = rooms[doorRoomIdx];
      const dx2 = doorRoom.x + Math.floor(doorRoom.w / 2);
      const dy2 = doorRoom.y;
      const dIdx = dy2 * dWidth + dx2;
      dTiles[dIdx] = 37; // locked door tile
      dCollision[dIdx] = 1; // solid until unlocked
    }

    // Mark boss room tiles
    for (let y = bossRoom.y; y < bossRoom.y + bossRoom.h; y++) {
      for (let x = bossRoom.x; x < bossRoom.x + bossRoom.w; x++) {
        const idx = y * dWidth + x;
        if (dTiles[idx] === palette.ground[0] || dTiles[idx] < 10) {
          dTiles[idx] = 38; // boss room floor marker
        }
      }
    }

    const dungeonData = {
      id: dungeonId,
      biome,
      width: dWidth,
      height: dHeight,
      rooms,
      tiles: dTiles,
      collision: dCollision,
      entranceX: (entranceRoom.cx * this.tileSize),
      entranceY: (entranceRoom.cy * this.tileSize),
      bossX: (bossRoom.cx * this.tileSize),
      bossY: (bossRoom.cy * this.tileSize),
    };

    return dungeonData;
  }

  /**
   * Carve an L-shaped corridor between two points.
   * @param {Uint16Array} tiles - Dungeon tiles (mutated).
   * @param {Uint8Array} collision - Dungeon collision (mutated).
   * @param {number} x1 - Start x.
   * @param {number} y1 - Start y.
   * @param {number} x2 - End x.
   * @param {number} y2 - End y.
   * @param {number} dWidth - Dungeon width in tiles.
   * @param {Object} palette - Tile palette.
   * @param {function(): number} rng - Random function.
   */
  _carveCorridor(tiles, collision, x1, y1, x2, y2, dWidth, palette, rng) {
    // Horizontal then vertical
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    for (let x = minX; x <= maxX; x++) {
      const idx = y1 * dWidth + x;
      if (idx >= 0 && idx < tiles.length) {
        tiles[idx] = palette.ground[Math.floor(rng() * palette.ground.length)];
        collision[idx] = 0;
      }
    }
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const idx = y * dWidth + x2;
      if (idx >= 0 && idx < tiles.length) {
        tiles[idx] = palette.ground[Math.floor(rng() * palette.ground.length)];
        collision[idx] = 0;
      }
    }
  }

  /**
   * Get a tile within the active dungeon.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {number} Tile ID.
   */
  _getDungeonTile(px, py) {
    if (!this.activeDungeon) return 0;
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    if (tx < 0 || tx >= this.activeDungeon.width || ty < 0 || ty >= this.activeDungeon.height) return 0;
    return this.activeDungeon.tiles[ty * this.activeDungeon.width + tx];
  }

  /**
   * Get collision within the active dungeon.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {number} Collision type (0, 1, or 2).
   */
  _getDungeonCollision(px, py) {
    if (!this.activeDungeon) return 1;
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    if (tx < 0 || tx >= this.activeDungeon.width || ty < 0 || ty >= this.activeDungeon.height) return 1;
    return this.activeDungeon.collision[ty * this.activeDungeon.width + tx];
  }

  /**
   * Enter a dungeon by its ID.
   * Generates the dungeon if needed, stores overworld position.
   * @param {number} dungeonId - The dungeon index.
   * @returns {{x: number, y: number}} Player spawn position inside dungeon.
   */
  enterDungeon(dungeonId) {
    const dungeon = this.generateDungeon(dungeonId);
    this.activeDungeon = dungeon;
    window.GameEvents.dispatchEvent(new CustomEvent('world:enterDungeon', {
      detail: { dungeonId, biome: dungeon.biome },
    }));
    return {
      x: dungeon.entranceX,
      y: dungeon.entranceY,
    };
  }

  /**
   * Exit the active dungeon and return to the overworld.
   * @returns {{x: number, y: number}|null} Overworld position or null.
   */
  exitDungeon() {
    if (!this.activeDungeon) return null;
    const dungeonId = this.activeDungeon.id;
    this.activeDungeon = null;
    // Return player to dungeon entrance position in overworld
    const dInfo = this.dungeons[dungeonId];
    if (dInfo) {
      window.GameEvents.dispatchEvent(new CustomEvent('world:exitDungeon', {
        detail: {},
      }));
      return { x: dInfo.x, y: dInfo.y };
    }
    return null;
  }

  // ─── Weather System ────────────────────────────────────────────────────

  /**
   * Update the weather system. Transitions weather smoothly over 30 seconds.
   * @param {number} dt - Delta time in seconds.
   * @param {{x: number, y: number}} player - Player position.
   */
  _updateWeather(dt, player) {
    // Determine target weather from current biome
    const target = this._getBiomeWeather(this.currentBiome);
    this.targetWeather = target;
    this.targetWeatherIntensity = target === 'clear' ? 0 : 0.7 + Math.random() * 0.3;

    // Timer-based weather change
    this._weatherTimer += dt;
    if (this._weatherTimer >= this._nextWeatherChange) {
      this._weatherTimer = 0;
      this._nextWeatherChange = 30 + Math.random() * 60;
      // Pick new random weather for variety
      const weathers = ['clear', 'rain', 'snow', 'fog', 'ash', 'storm'];
      this.targetWeather = weathers[Math.floor(Math.random() * weathers.length)];
      this.targetWeatherIntensity = this.targetWeather === 'clear' ? 0 : 0.5 + Math.random() * 0.5;

      window.GameEvents.dispatchEvent(new CustomEvent('world:weatherChange', {
        detail: { weatherType: this.targetWeather, intensity: this.targetWeatherIntensity },
      }));
    }

    // Smooth transition
    if (this.weather !== this.targetWeather || Math.abs(this.weatherIntensity - this.targetWeatherIntensity) > 0.01) {
      this.weatherTransitionTimer += dt;
      const t = Math.min(this.weatherTransitionTimer / this.weatherTransitionDuration, 1);
      // Ease in-out
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.weatherIntensity += (this.targetWeatherIntensity - this.weatherIntensity) * eased * dt;
      if (this.weatherIntensity < 0.01 && this.targetWeather === 'clear') {
        this.weather = 'clear';
        this.weatherIntensity = 0;
        this.weatherTransitionTimer = 0;
      } else {
        this.weather = this.targetWeather;
      }
    }
  }

  // ─── Day/Night Cycle ───────────────────────────────────────────────────

  /**
   * Update the day/night cycle.
   * @param {number} dt - Delta time in seconds.
   */
  _updateDayNight(dt) {
    this.worldTime = (this.worldTime + dt * 10 * this.dayNightSpeed) % 24000;
    // Phases: 0-1000 dawn, 1000-12000 day, 12000-13000 dusk, 13000-24000 night
    const prevTimeOfDay = this.timeOfDay;
    if (this.worldTime < 1000) this.timeOfDay = 'dawn';
    else if (this.worldTime < 12000) this.timeOfDay = 'day';
    else if (this.worldTime < 13000) this.timeOfDay = 'dusk';
    else this.timeOfDay = 'night';

    if (prevTimeOfDay !== this.timeOfDay) {
      window.GameEvents.dispatchEvent(new CustomEvent('world:timeChange', {
        detail: { timeOfDay: this.timeOfDay, worldTime: this.worldTime },
      }));
    }
  }

  /**
   * Get the current light level based on time of day.
   * @returns {number} Light level from 0 (dark) to 1 (full daylight).
   */
  getLightLevel() {
    const t = this.worldTime;
    if (t < 1000) return 0.3 + (t / 1000) * 0.7;          // dawn: 0.3 → 1.0
    if (t < 12000) return 1.0;                             // day
    if (t < 13000) return 1.0 - ((t - 12000) / 1000) * 0.7; // dusk: 1.0 → 0.3
    return 0.3;                                            // night
  }

  // ─── Shrink Zones ──────────────────────────────────────────────────────

  /**
   * Get all active shrink zone positions.
   * @returns {Array<ShrinkZone>} Array of shrink zone objects.
   */
  getShrinkZones() {
    return this.shrinkZones.filter(z => z.active);
  }

  /**
   * Check if a position is inside any shrink zone.
   * @param {number} px - Pixel x.
   * @param {number} py - Pixel y.
   * @returns {boolean} True if inside a shrink zone.
   */
  isInShrinkZone(px, py) {
    for (const zone of this.shrinkZones) {
      if (!zone.active) continue;
      const dx = px - zone.x;
      const dy = py - zone.y;
      if (dx * dx + dy * dy < zone.radius * zone.radius) {
        return true;
      }
    }
    return false;
  }

  // ─── Main Update ───────────────────────────────────────────────────────

  /**
   * Update the world manager: weather, day/night, active chunks.
   * @param {number} dt - Delta time in seconds.
   * @param {{x: number, y: number}} player - Player position.
   */
  update(dt, player) {
    this._updateWeather(dt, player);
    this._updateDayNight(dt);

    // Update current biome based on player position
    if (!this.activeDungeon && player) {
      const newBiome = this.getBiomeAt(player.x, player.y);
      if (newBiome !== this.currentBiome) {
        const oldBiome = this.currentBiome;
        this.currentBiome = newBiome;
        window.GameEvents.dispatchEvent(new CustomEvent('world:biomeChange', {
          detail: { fromBiome: oldBiome, toBiome: newBiome },
        }));
      }
    }

    // Ensure surrounding chunks are generated (eager loading)
    if (player) {
      const [pcx, pcy] = this._pixelToChunk(player.x, player.y);
      for (let dy = -this.renderDistance; dy <= this.renderDistance; dy++) {
        for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
          this.getChunkAt(pcx + dx, pcy + dy);
        }
      }
    }
  }

  // ─── Rendering ─────────────────────────────────────────────────────────

  /**
   * Render all visible chunks around the camera.
   * @param {Object} renderer - Renderer instance with ctx, drawTile, etc.
   * @param {{x: number, y: number}} camera - Camera position.
   */
  render(renderer, camera) {
    if (this.activeDungeon) {
      this._renderDungeon(renderer, camera);
      return;
    }

    const ctx = renderer.ctx;
    const canvasW = renderer.canvas ? renderer.canvas.width : 800;
    const canvasH = renderer.canvas ? renderer.canvas.height : 600;

    // Determine visible chunk range
    const startCx = Math.floor((camera.x - canvasW / 2) / this.chunkPixelSize) - 1;
    const startCy = Math.floor((camera.y - canvasH / 2) / this.chunkPixelSize) - 1;
    const endCx = Math.floor((camera.x + canvasW / 2) / this.chunkPixelSize) + 1;
    const endCy = Math.floor((camera.y + canvasH / 2) / this.chunkPixelSize) + 1;

    for (let cy = startCy; cy <= endCy; cy++) {
      for (let cx = startCx; cx <= endCx; cx++) {
        const chunk = this.getChunkAt(cx, cy);
        this._renderChunk(ctx, chunk, camera, canvasW, canvasH);
      }
    }
  }

  /**
   * Render a single chunk.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {ChunkData} chunk - Chunk data.
   * @param {{x: number, y: number}} camera - Camera position.
   * @param {number} canvasW - Canvas width.
   * @param {number} canvasH - Canvas height.
   */
  _renderChunk(ctx, chunk, camera, canvasW, canvasH) {
    const offsetX = Math.round(chunk.x * this.chunkPixelSize - camera.x + canvasW / 2);
    const offsetY = Math.round(chunk.y * this.chunkPixelSize - camera.y + canvasH / 2);

    // Skip if entirely off-screen
    if (offsetX + this.chunkPixelSize < 0 || offsetX > canvasW ||
        offsetY + this.chunkPixelSize < 0 || offsetY > canvasH) {
      return;
    }

    const { tiles, decorations } = chunk;

    for (let ty = 0; ty < this.chunkSize; ty++) {
      for (let tx = 0; tx < this.chunkSize; tx++) {
        const tileId = tiles[ty * this.chunkSize + tx];
        const px = offsetX + tx * this.tileSize;
        const py = offsetY + ty * this.tileSize;

        // Skip off-screen tiles
        if (px + this.tileSize < 0 || px > canvasW || py + this.tileSize < 0 || py > canvasH) {
          continue;
        }

        this._drawTile(ctx, tileId, px, py, this.tileSize, chunk.biome);
      }
    }

    // Render decorations
    for (const decor of decorations) {
      const dpx = offsetX + decor.x;
      const dpy = offsetY + decor.y;
      if (dpx + this.tileSize < 0 || dpx > canvasW || dpy + this.tileSize < 0 || dpy > canvasH) continue;
      this._drawDecoration(ctx, decor, dpx, dpy, this.tileSize);
    }

    // Render shrink zone visuals
    for (const zone of this.shrinkZones) {
      if (!zone.active) continue;
      const zcx = Math.floor(zone.x / this.chunkPixelSize);
      const zcy = Math.floor(zone.y / this.chunkPixelSize);
      if (zcx !== chunk.x || zcy !== chunk.y) continue;
      const zpx = offsetX + (zone.x - chunk.x * this.chunkPixelSize);
      const zpy = offsetY + (zone.y - chunk.y * this.chunkPixelSize);
      this._drawShrinkZone(ctx, zpx, zpy, zone.radius);
    }
  }

  /**
   * Draw a single tile by ID.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} tileId - Tile ID.
   * @param {number} x - Screen x.
   * @param {number} y - Screen y.
   * @param {number} size - Tile size in pixels.
   * @param {Biome} biome - Current biome for coloring.
   */
  _drawTile(ctx, tileId, x, y, size, biome) {
    if (tileId === 0) return; // Empty

    const colors = this._getTileColors(tileId, biome);
    ctx.fillStyle = colors.fill;
    ctx.fillRect(x, y, size, size);

    // Highlight edge for depth
    ctx.fillStyle = colors.highlight;
    ctx.fillRect(x, y, size, 2);
    ctx.fillRect(x, y, 2, size);

    // Shadow edge
    ctx.fillStyle = colors.shadow;
    ctx.fillRect(x, y + size - 2, size, 2);
    ctx.fillRect(x + size - 2, y, 2, size);

    // Special tile rendering
    if (tileId === 20) {
      // Water shimmer
      ctx.fillStyle = `rgba(100, 180, 255, ${0.3 + Math.sin(Date.now() * 0.003 + x) * 0.1})`;
      ctx.fillRect(x + 2, y + size / 2, size - 4, size / 2 - 2);
    } else if (tileId === 21) {
      // Lava glow
      ctx.fillStyle = `rgba(255, 100, 30, ${0.4 + Math.sin(Date.now() * 0.005 + y) * 0.15})`;
      ctx.fillRect(x + 2, y + size / 2, size - 4, size / 2 - 2);
    } else if (tileId === 22) {
      // Ice sparkle
      ctx.fillStyle = `rgba(200, 230, 255, ${0.2 + Math.sin(Date.now() * 0.004 + x + y) * 0.1})`;
      ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
    } else if (tileId === 50) {
      // Dungeon entrance
      ctx.fillStyle = '#4a004a';
      ctx.fillRect(x + 4, y + 4, size - 8, size - 8);
      ctx.strokeStyle = '#ffcc00';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
    }
  }

  /**
   * Get fill colors for a tile ID and biome.
   * @param {number} tileId - Tile ID.
   * @param {Biome} biome - Biome name.
   * @returns {{fill: string, highlight: string, shadow: string}} Color triple.
   */
  _getTileColors(tileId, biome) {
    const palettes = {
      FOREST:   { g: ['#2d5016', '#3a6b1c', '#1e3d0f'], w: ['#1a2f1a', '#0f1f0f'], h: '#4a7c23', s: '#0a1a0a' },
      DESERT:   { g: ['#c2a060', '#d4b070', '#a08040'], w: ['#8b7355', '#6b5335'], h: '#e6c875', s: '#5a4020' },
      MOUNTAIN: { g: ['#64748b', '#7d8fa3', '#4b5563'], w: ['#374151', '#1f2937'], h: '#94a3b8', s: '#1e293b' },
      SWAMP:    { g: ['#3a4a2a', '#4d6035', '#2a361e'], w: ['#1a2510', '#0f1a08'], h: '#689f38', s: '#0a1205' },
      ICE:      { g: ['#cbd5e1', '#e2e8f0', '#94a3b8'], w: ['#64748b', '#475569'], h: '#f1f5f9', s: '#334155' },
      VOLCANO:  { g: ['#7f1d1d', '#991b1b', '#450a0a'], w: ['#450a0a', '#260505'], h: '#dc2626', s: '#1a0505' },
    };
    const p = palettes[biome] || palettes.FOREST;

    if (tileId >= 1 && tileId <= 9) {
      return { fill: p.g[(tileId - 1) % p.g.length], highlight: p.h, shadow: p.s };
    }
    if (tileId >= 10 && tileId <= 15) {
      return { fill: p.w[(tileId - 10) % p.w.length], highlight: p.h, shadow: p.s };
    }
    if (tileId === 20) return { fill: '#1a3a5c', highlight: '#2563eb', shadow: '#0f172a' };
    if (tileId === 21) return { fill: '#7f1d1d', highlight: '#f97316', shadow: '#450a0a' };
    if (tileId === 22) return { fill: '#b8d4e3', highlight: '#e0f2fe', shadow: '#64748b' };
    if (tileId >= 60 && tileId <= 65) return { fill: p.g[0], highlight: p.h, shadow: p.s };
    return { fill: p.g[0], highlight: p.h, shadow: p.s };
  }

  /**
   * Draw a decoration object.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {Object} decor - Decoration data.
   * @param {number} x - Screen x.
   * @param {number} y - Screen y.
   * @param {number} size - Tile size.
   */
  _drawDecoration(ctx, decor, x, y, size) {
    const v = decor.variant;
    switch (decor.type) {
      case 30: // Grass tuft
        ctx.fillStyle = v % 2 === 0 ? '#4a7c23' : '#3d6b1a';
        ctx.fillRect(x + 4, y + size - 8, 4, 8);
        ctx.fillRect(x + 10, y + size - 10, 3, 10);
        ctx.fillRect(x + 18, y + size - 6, 4, 6);
        break;
      case 31: // Flower
        ctx.fillStyle = v % 2 === 0 ? '#e91e63' : '#ffeb3b';
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2d5016';
        ctx.fillRect(x + size / 2 - 1, y + size / 2, 2, size / 2);
        break;
      case 32: // Rock
        ctx.fillStyle = '#5a5a5a';
        ctx.beginPath();
        ctx.ellipse(x + size / 2, y + size - 4, 6 + v, 4 + v, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6a6a6a';
        ctx.beginPath();
        ctx.ellipse(x + size / 2 - 2, y + size - 6, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 33: // Cactus / desert plant
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(x + size / 2 - 2, y + 4, 4, size - 8);
        ctx.fillRect(x + 6, y + 8, size / 2 - 4, 3);
        ctx.fillRect(x + size / 2, y + 12, size / 2 - 6, 3);
        break;
      case 34: // Snow mound / ice crystal
        ctx.fillStyle = '#dbeafe';
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y + 4);
        ctx.lineTo(x + size - 4, y + size - 4);
        ctx.lineTo(x + 4, y + size - 4);
        ctx.closePath();
        ctx.fill();
        break;
      case 35: // Ember / volcano rock
        ctx.fillStyle = '#525252';
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        if (v % 2 === 0) {
          ctx.fillStyle = `rgba(255, 100, 0, ${0.5 + Math.sin(Date.now() * 0.006) * 0.3})`;
          ctx.beginPath();
          ctx.arc(x + size / 2, y + size / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 40: // Shrink zone marker
        this._drawShrinkZone(ctx, x + size / 2, y + size / 2, 48);
        break;
      default:
        break;
    }
  }

  /**
   * Draw a glowing shrink zone on the ground.
   * @param {CanvasRenderingContext2D} ctx - Canvas context.
   * @param {number} cx - Center screen x.
   * @param {number} cy - Center screen y.
   * @param {number} radius - Zone radius in pixels.
   */
  _drawShrinkZone(ctx, cx, cy, radius) {
    // Outer glow
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0, 255, 255, 0.3)');
    grad.addColorStop(0.6, 'rgba(0, 200, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 150, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner ring
    const pulse = 0.8 + Math.sin(Date.now() * 0.004) * 0.2;
    ctx.strokeStyle = `rgba(0, 255, 255, ${0.6 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    // Floating particles
    for (let i = 0; i < 5; i++) {
      const angle = Date.now() * 0.002 + (i / 5) * Math.PI * 2;
      const px = cx + Math.cos(angle) * radius * 0.4;
      const py = cy + Math.sin(angle) * radius * 0.3 - (Date.now() * 0.02 + i * 20) % radius;
      ctx.fillStyle = `rgba(180, 255, 255, ${0.6 * pulse})`;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
  }

  /**
   * Render the active dungeon.
   * @param {Object} renderer - Renderer instance.
   * @param {{x: number, y: number}} camera - Camera position.
   */
  _renderDungeon(renderer, camera) {
    if (!this.activeDungeon) return;
    const ctx = renderer.ctx;
    const canvasW = renderer.canvas ? renderer.canvas.width : 800;
    const canvasH = renderer.canvas ? renderer.canvas.height : 600;
    const { tiles, width, height, biome } = this.activeDungeon;
    const palette = BIOME_TILES[biome];

    const startTx = Math.max(0, Math.floor((camera.x - canvasW / 2) / this.tileSize) - 1);
    const startTy = Math.max(0, Math.floor((camera.y - canvasH / 2) / this.tileSize) - 1);
    const endTx = Math.min(width, Math.floor((camera.x + canvasW / 2) / this.tileSize) + 2);
    const endTy = Math.min(height, Math.floor((camera.y + canvasH / 2) / this.tileSize) + 2);

    for (let ty = startTy; ty < endTy; ty++) {
      for (let tx = startTx; tx < endTx; tx++) {
        const tileId = tiles[ty * width + tx];
        const px = Math.round(tx * this.tileSize - camera.x + canvasW / 2);
        const py = Math.round(ty * this.tileSize - camera.y + canvasH / 2);
        this._drawTile(ctx, tileId, px, py, this.tileSize, biome);
      }
    }
  }

  /**
   * Serialize the world state for saving.
   * @returns {Object} Serialized world state.
   */
  serialize() {
    return {
      seed: this.seed,
      worldTime: this.worldTime,
      currentBiome: this.currentBiome,
      weather: this.weather,
      weatherIntensity: this.weatherIntensity,
      dungeons: this.dungeons.map(d => ({ id: d.id, x: d.x, y: d.y, biome: d.biome, entered: d.entered })),
      shrinkZones: this.shrinkZones.map(z => ({ x: z.x, y: z.y, radius: z.radius, active: z.active })),
    };
  }

  /**
   * Deserialize world state from a saved game.
   * @param {Object} data - Saved world data.
   */
  deserialize(data) {
    if (!data) return;
    this.worldTime = data.worldTime ?? this.worldTime;
    this.currentBiome = data.currentBiome ?? this.currentBiome;
    this.weather = data.weather ?? this.weather;
    this.weatherIntensity = data.weatherIntensity ?? this.weatherIntensity;
    if (data.dungeons) this.dungeons = data.dungeons;
    if (data.shrinkZones) this.shrinkZones = data.shrinkZones;
  }
}

window.WorldManager = WorldManager;
