# Echoes of the Small — Game Specification

## 1. Overview

A 2D action-adventure browser game built with HTML5 Canvas 2D. The player controls Asha, a character who can shrink to 1/4 size and grow back, exploring a seamless overworld with 6 biomes and 6 dungeons. Features combo-based combat, dodge/parry mechanics, item collection, quests, relic fusion crafting, and procedural adaptive music.

## 2. Architecture

### 2.1 Tech Stack
- Pure HTML5 Canvas 2D (no frameworks)
- Web Audio API for procedural audio
- localStorage for save data
- No external dependencies

### 2.2 Module Map

```
index.html                    # Full game: loading → title → gameplay
preview.html                  # Instant-play demo (all-in-one, skips menus)

src/engine/
  Game.js                     # Core loop, camera, hitstop, screen shake, state machine
  Renderer.js                 # Canvas ctx, lighting, particles, palettes, post-FX
  InputManager.js             # Keyboard/gamepad/touch → unified action map
  AudioEngine.js              # Procedural music (4 layers), SFX synthesis
  WorldManager.js             # Biome gen, seamless world, dungeons, weather

src/entities/
  Player.js                   # Asha entity + all combat moves + scale transformation
  Enemy.js                    # 6 enemy types with 3-phase AI
  Boss.js                     # 6 dungeon bosses with 3-phase fights

src/systems/
  CombatSystem.js             # Hit detection, combo tracking, damage calc, hit-feel
  ScaleSystem.js              # 0.8s cinematic scale transition, shrink zones
  ItemSystem.js               # 6 dungeon items + inventory
  QuestSystem.js              # 18 side quests with world state consequences
  RelicFusionSystem.js        # 60 fusions (10 secret), lore unlocks
  SaveSystem.js               # 3-slot + auto-save to localStorage

src/ui/
  UIManager.js                # Diegetic HUD, health aura, notifications, menus
```

### 2.3 Game Loop Flow (Game.js)

```
1. Process Input (InputManager)
2. Update World (WorldManager)
3. Update Entities (Player, Enemies, Bosses)
4. Update Systems (Combat, Scale, Items, Quests)
5. Update Camera (follow player with smooth lerp)
6. Update Particles & Post-FX (Renderer)
7. Render Frame (Renderer)
8. Update Audio (AudioEngine)
```

Target: 60fps, deltaTime normalized.

### 2.4 State Machine (Game.js)

States: `LOADING → TITLE → PLAYING → PAUSED → INVENTORY → DIALOG → DYING → GAME_OVER → ENDING`

State transitions are handled by Game.js. Each state has enter/update/exit hooks.

## 3. Global Event Bus

All modules communicate via a global event emitter `window.GameEvents`:

```javascript
// Event names and payloads:
'input:action'        → { action: 'move'|'jump'|'attack'|'dodge'|'parry'|'interact'|'shrink'|'grow', value: boolean|Vector2 }
'combat:hit'          → { attacker, target, damage, isCritical, position }
'combat:combo'        → { count, multiplier }
'combat:parry'        → { attacker, defender, position }
'combat:dodge'        → { entity, direction }
'player:damage'       → { amount, currentHP, maxHP }
'player:death'        → {}
'player:scaleChange'  → { fromScale, toScale, duration: 0.8 }
'player:itemPickup'   → { itemId, itemName }
'world:biomeChange'   → { fromBiome, toBiome }
'world:weatherChange' → { weatherType, intensity }
'world:enterDungeon'  → { dungeonId }
'world:exitDungeon'   → {}
'quest:start'         → { questId }
'quest:update'        → { questId, objective, progress }
'quest:complete'      → { questId, rewards }
'system:notification' → { message, type: 'info'|'warning'|'success' }
'system:save'         → { slot }
'system:load'         → { slot }
'system:hitstop'      → { duration }
'system:screenshake'  → { intensity, duration }
```

## 4. Module Specifications

### 4.1 Game.js — Core Engine

**Class:** `Game`

**Constructor:**
```javascript
constructor() {
  this.canvas = document.getElementById('gameCanvas');
  this.ctx = this.canvas.getContext('2d');
  this.state = 'LOADING';
  this.lastTime = 0;
  this.deltaTime = 0;
  this.camera = { x: 0, y: 0, targetX: 0, targetY: 0, shakeX: 0, shakeY: 0 };
  this.hitstopTimer = 0;        // freeze frames on impact
  this.timeScale = 1.0;         // slows for dramatic effect
  this.gameTime = 0;            // total elapsed game time
  this.worldSeed = Math.random() * 100000 | 0;
}
```

**Key Methods:**
- `init()` — Initialize all subsystems, load assets, set state to TITLE
- `start()` — Begin gameplay, spawn player in overworld
- `gameLoop(timestamp)` — Main loop with deltaTime
- `update(dt)` — Update all systems in order
- `render()` — Clear canvas, apply camera, render world/entities/UI
- `setState(newState)` — Transition with enter/exit hooks
- `triggerHitstop(duration)` — Freeze game for N frames
- `triggerScreenShake(intensity, duration)` — Camera shake
- `resize()` — Handle window resize, maintain aspect ratio

**Camera System:**
- Follows player with smooth lerp (factor 0.08)
- Clamp to world bounds
- Apply shake as offset, decay over time
- Support for camera zones (lock to axis in certain areas)

### 4.2 Renderer.js — Visual System

**Class:** `Renderer`

**Constructor:**
```javascript
constructor(canvas, ctx) {
  this.canvas = canvas;
  this.ctx = ctx;
  this.width = canvas.width;
  this.height = canvas.height;
  this.particles = [];          // Active particles array
  this.lights = [];             // Dynamic lights
  this.palettes = {
    FOREST:    { bg: '#1a2f1a', ground: '#2d5016', accent: '#7cb342' },
    DESERT:    { bg: '#2d2416', ground: '#c2a060', accent: '#e6c875' },
    MOUNTAIN:  { bg: '#1e293b', ground: '#64748b', accent: '#94a3b8' },
    SWAMP:     { bg: '#1a1a10', ground: '#3a4a2a', accent: '#689f38' },
    ICE:       { bg: '#0f172a', ground: '#cbd5e1', accent: '#e2e8f0' },
    VOLCANO:   { bg: '#1a0505', ground: '#7f1d1d', accent: '#dc2626' }
  };
  this.currentPalette = this.palettes.FOREST;
  this.lightingEnabled = true;
  this.particleCount = 0;
}
```

**Key Methods:**
- `clear()` — Fill with current palette bg
- `setPalette(biome)` — Switch color palette
- `drawSprite(sprite, x, y, frame, flipX)` — Draw sprite with optional flip
- `drawTile(tileId, x, y, size)` — Draw world tile
- `drawLight(x, y, radius, color, intensity)` — Add dynamic light
- `renderLighting()` — Composite lighting layer (darken + lights)
- `spawnParticle(config)` — Spawn particle effect
  - config: `{ x, y, vx, vy, life, color, size, gravity, fade }`
- `updateParticles(dt)` — Update and cull particles
- `renderParticles()` — Draw all particles
- `applyPostFX()` — Vignette, subtle chromatic aberration on hit
- `drawVignette()` — Darken screen edges
- `resize(w, h)` — Update dimensions

**Lighting Algorithm:**
1. Create offscreen canvas for lightmap
2. Fill with ambient darkness (alpha 0.6)
3. Cut out light circles using `globalCompositeOperation = 'destination-out'`
4. Draw lightmap over main canvas

**Particle Types (built-in):**
- `dust` — Brown/gray, gravity, short life
- `spark` — Yellow/white, no gravity, bounce
- `blood` — Red, gravity, splatter
- `magic` — Purple/blue, float upward, sparkle
- `leaf` — Green, drift with wind
- `snow` — White, fall slowly
- `ember` — Orange, float upward, flicker
- `scaleDust` — Cyan/white, converge toward center during scale change

### 4.3 InputManager.js — Controls

**Class:** `InputManager`

**Action Map:**
```javascript
this.keyMap = {
  // Keyboard
  'ArrowLeft':  'move_left',
  'ArrowRight': 'move_right',
  'ArrowUp':    'move_up',
  'ArrowDown':  'move_down',
  'KeyA':       'move_left',
  'KeyD':       'move_right',
  'KeyW':       'move_up',
  'KeyS':       'move_down',
  'Space':      'jump',
  'KeyJ':       'attack',
  'KeyK':       'dodge',
  'KeyL':       'parry',
  'KeyE':       'interact',
  'KeyQ':       'shrink',
  'KeyR':       'grow',
  'Escape':     'pause',
  'Tab':        'inventory',
  // Held states tracked separately
};
```

**Touch Controls (mobile):**
- Virtual joystick (left side): movement
- Action buttons (right side): attack, dodge, parry, shrink/grow
- Double-tap joystick: dodge in that direction

**Gamepad:** Standard mapping via Gamepad API.

**Methods:**
- `init()` — Bind keyboard/mouse/touch/gamepad listeners
- `update()` — Poll gamepad, process held keys
- `isPressed(action)` — Is action currently held?
  - Returns `{ pressed: bool, value: float|Vector2 }`
- `isJustPressed(action)` — Was action pressed this frame?
- `getMovementVector()` — Normalized movement direction
- `vibrate(duration, intensity)` — Controller/phone rumble

### 4.4 AudioEngine.js — Procedural Audio

**Class:** `AudioEngine`

**Architecture:** 4-layer adaptive music system:
1. **Rhythm layer** — Percussive foundation (kick, snare patterns)
2. **Bass layer** — Low melodic foundation
3. **Melody layer** — Main thematic content
4. **Atmosphere layer** — Ambient pads, environmental sounds

Intensity (0.0–1.0) controls which layers play and their volume:
- 0.0–0.25: Only atmosphere
- 0.25–0.5: + bass
- 0.5–0.75: + rhythm
- 0.75–1.0: + melody (full)

**Constructor:**
```javascript
constructor() {
  this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  this.masterGain = this.ctx.createGain();
  this.masterGain.connect(this.ctx.destination);
  this.masterGain.gain.value = 0.7;
  this.currentIntensity = 0.0;
  this.targetIntensity = 0.0;
  this.bpm = 100;
  this.layers = { rhythm: null, bass: null, melody: null, atmosphere: null };
  this.isPlaying = false;
  this.biomeThemes = {}; // Preset note arrays per biome
}
```

**Methods:**
- `init()` — Create all synth nodes
- `playNote(frequency, duration, type, volume, destination)` — Play a single note
- `startMusic()` — Begin all 4 layers
- `stopMusic()` — Fade out and stop
- `setIntensity(val)` — Set target intensity (smooth transition)
- `update(dt)` — Adjust layer volumes toward target intensity
- `playSFX(type)` — Play sound effect:
  - `'sword_swing'` — Noise burst + lowpass sweep
  - `'hit_enemy'` — Quick sawtooth descending pitch
  - `'hit_player'` — Low sine thud
  - `'parry'` — Bright metallic ping (high sine + harmonics)
  - `'dodge'` — Quick whoosh (filtered noise)
  - `'footstep'` — Very short noise burst
  - `'item_pickup'` — Ascending 3-note chime
  - `'scale_change'` — Pitch bend drone (descending for shrink, ascending for grow)
  - `'enemy_alert'` — Short dissonant interval
  - `'boss_roar'` — Low frequency saw sweep
  - `'quest_complete'` — Triumphant 5-note fanfare
  - `'ui_select'` — Short blip
  - `'ui_confirm'` — Pleasant chord
- `setBiome(biome)` — Switch chord progression / scale
- `resume()` — Resume AudioContext (browser autoplay policy)

### 4.5 WorldManager.js — World Generation

**Class:** `WorldManager`

**Constructor:**
```javascript
constructor(seed) {
  this.seed = seed;
  this.tileSize = 32;
  this.chunkSize = 16; // tiles per chunk
  this.renderDistance = 3; // chunks
  this.chunks = new Map(); // "x,y" → chunk data
  this.biomes = ['FOREST', 'DESERT', 'MOUNTAIN', 'SWAMP', 'ICE', 'VOLCANO'];
  this.currentBiome = 'FOREST';
  this.weather = 'clear'; // clear|rain|snow|fog|ash|storm
  this.weatherIntensity = 0;
  this.dungeons = []; // Array of dungeon entrances
  this.activeDungeon = null; // Currently inside dungeon
  this.worldTime = 0; // 0-24000 (full day cycle)
  this.timeOfDay = 'day'; // dawn|day|dusk|night
}
```

**Chunk Data:**
```javascript
chunk = {
  x, y, // chunk coordinates
  tiles: Uint16Array[256], // 16x16 tile IDs
  biome: 'FOREST',
  decorations: [], // grass, rocks, etc.
  entities: [], // enemies, items
  collision: [] // solid tile flags
}
```

**Tile IDs:**
- 0: Empty
- 1-8: Ground variants (per biome)
- 10-15: Solid walls (per biome)
- 20: Water
- 21: Lava
- 22: Ice
- 30-35: Decorative (grass, flowers, rocks)
- 40: Shrink zone marker
- 50: Dungeon entrance
- 60-65: Platforms (jump-through)

**Methods:**
- `generateChunk(cx, cy)` — Deterministic generation using seed
- `getChunk(px, py)` — Get or generate chunk at pixel coords
- `getTile(px, py)` — Get tile at pixel coords
- `setTile(px, py, tileId)` — Set tile
- `isSolid(px, py)` — Check collision
- `isPlatform(px, py)` — Check if one-way platform
- `getBiomeAt(px, py)` — Determine biome from world position
- `update(dt, player)` — Update weather, time, active chunks
- `render(renderer, camera)` — Draw visible chunks
- `enterDungeon(dungeonId)` — Generate dungeon floor, transition
- `exitDungeon()` — Return to overworld
- `getShrinkZones()` — Return array of active shrink zone positions

**Biome Layout (Overworld):** The world is a 6-section grid, each section dominated by one biome. Transitions blend between adjacent biomes.

**Dungeon Generation:**
- Procedural room-based layout
- 8-15 rooms per dungeon
- Key + door progression
- Boss room always farthest from entrance
- Themed per biome (Forest Temple, Desert Tomb, etc.)

**Weather System:**
- Each biome has preferred weather (Forest=rain, Desert=clear, Mountain=snow, Swamp=fog, Ice=blizzard, Volcano=ash)
- Weather transitions over 30 seconds
- Visual effects via Renderer particles

### 4.6 Player.js — Player Entity

**Class:** `Player` extends `Entity`

**Constructor:**
```javascript
constructor(x, y) {
  super(x, y);
  this.width = 24;
  this.height = 40;
  
  // Stats
  this.maxHP = 100;
  this.hp = 100;
  this.baseDamage = 10;
  this.speed = 150;
  this.jumpForce = 300;
  
  // Scale system
  this.scale = 1.0;           // 1.0 = normal, 0.25 = shrunk
  this.targetScale = 1.0;
  this.scaleTransition = 0;   // 0-1 during transition
  this.isScaling = false;
  this.canShrink = true;      // Only in shrink zones (overridden later with item)
  this.shrinkZones = [];      // Track visited shrink zones
  
  // Combat
  this.comboCount = 0;
  this.comboTimer = 0;
  this.comboWindow = 1.5;     // Seconds to continue combo
  this.isAttacking = false;
  this.attackPhase = 0;       // 0,1,2 for 3-hit combo
  this.attackTimer = 0;
  this.isDodging = false;
  this.dodgeTimer = 0;
  this.dodgeCooldown = 0;
  this.isParrying = false;
  this.parryTimer = 0;
  this.parryWindow = 0.3;
  this.isCharging = false;
  this.chargeTime = 0;
  this.maxChargeTime = 1.5;
  this.invincible = false;
  this.invincibilityTimer = 0;
  
  // Movement
  this.vx = 0;
  this.vy = 0;
  this.onGround = false;
  this.facingRight = true;
  this.state = 'idle';        // idle|run|jump|fall|attack|dodge|parry|hurt|dead
  
  // Inventory
  this.items = [];            // Collected dungeon items
  this.relics = [];           // Equipped relics
  this.fusedRelics = [];      // Discovered fusions
  
  // Quest
  this.activeQuests = [];
  this.completedQuests = [];
}
```

**Key Methods:**
- `update(dt, input, world)` — Main update
  - Handle movement input
  - Apply gravity
  - Ground check
  - Update state machine
  - Update timers (combo, dodge, parry, invincibility)
  - Update scale transition
- `attack()` — Start attack animation
  - If combo window active, advance to next phase (0→1→2→0)
  - Phase 0: Quick slash
  - Phase 1: Sweep attack (wider hitbox)
  - Phase 2: Downward slam (knockdown)
  - Emit `combat:combo` event
- `startCharge()` — Begin charged attack
- `releaseCharge()` — Release charged attack (damage scales with chargeTime/maxChargeTime)
- `dodge(direction)` — Dodge roll with i-frames
  - Duration: 0.4s
  - Speed: 2.5x normal
  - Full invincibility
  - Cooldown: 0.8s
- `parry()` — Parry stance
  - Duration: 0.5s (parryWindow is first 0.3s)
  - If hit during window: negate damage, stun attacker, free counter-attack
  - Emit `combat:parry` event
- `shrink()` — Begin scale transition to 0.25
  - Only if canShrink (in zone or has item)
  - Duration: 0.8s cinematic
  - Can fit through small gaps, reach tiny areas
  - Speed reduced to 0.6x, damage reduced to 0.5x
  - Emit `player:scaleChange`
- `grow()` — Return to scale 1.0
  - Same 0.8s transition
- `takeDamage(amount, source)` — Apply damage with i-frames
  - Trigger hitstop (0.1s)
  - Trigger screen shake
  - Flash red
  - 1.5s invincibility
- `heal(amount)` — Restore HP
- `addItem(item)` — Add to inventory, emit `player:itemPickup`
- `getHitbox()` → `{ x, y, width, height }` — Current hitbox (scaled)
- `getAttackHitbox()` → `{ x, y, width, height }` — Attack hitbox based on facing + combo phase
- `render(renderer)` — Draw player sprite with current animation frame

### 4.7 Enemy.js — Enemy System

**Base Class:** `Enemy` extends `Entity`

**Constructor:**
```javascript
constructor(x, y, type) {
  super(x, y);
  this.type = type;
  this.aiState = 'IDLE';      // IDLE|ALERT|AGGRESSIVE|STUNNED|DEAD
  this.aiTimer = 0;
  this.detectionRange = 200;
  this.attackRange = 40;
  this.loseInterestRange = 350;
  this.patrolPoints = [];
  this.currentPatrolIndex = 0;
  this.stunTimer = 0;
  this.state = 'idle';
  
  // Set stats based on type
  this.setTypeStats(type);
}
```

**Enemy Types:**

```javascript
const ENEMY_TYPES = {
  GRUNT: {
    hp: 30, damage: 8, speed: 80, size: { w: 20, h: 28 },
    color: '#8B4513', detectionRange: 150, attackRange: 35,
    attackCooldown: 1.0, xpValue: 10,
    behavior: 'melee_chase' // Simple chase + attack
  },
  ARCHER: {
    hp: 20, damage: 12, speed: 70, size: { w: 18, h: 26 },
    color: '#2E7D32', detectionRange: 250, attackRange: 180,
    attackCooldown: 2.0, xpValue: 15,
    behavior: 'kite' // Maintain distance, shoot projectiles
  },
  BRUTE: {
    hp: 80, damage: 20, speed: 50, size: { w: 32, h: 40 },
    color: '#5D4037', detectionRange: 180, attackRange: 50,
    attackCooldown: 1.8, xpValue: 25,
    behavior: 'heavy_slam' // Slow but powerful, telegraphed attack
  },
  FLYER: {
    hp: 25, damage: 10, speed: 120, size: { w: 22, h: 20 },
    color: '#7B1FA2', detectionRange: 200, attackRange: 30,
    attackCooldown: 1.2, xpValue: 15,
    behavior: 'dive_attack' // Flies above, dives to attack
  },
  MAGE: {
    hp: 35, damage: 15, speed: 60, size: { w: 20, h: 30 },
    color: '#1565C0', detectionRange: 220, attackRange: 160,
    attackCooldown: 2.5, xpValue: 20,
    behavior: 'magic_ranged' // Homing projectiles, teleport
  },
  ASSASSIN: {
    hp: 30, damage: 18, speed: 140, size: { w: 18, h: 26 },
    color: '#37474F', detectionRange: 200, attackRange: 35,
    attackCooldown: 1.0, xpValue: 25,
    behavior: 'flank_dodge' // Dodges attacks, flanks player
  }
};
```

**3-Phase AI:**
1. **IDLE** — Patrol between points or stand still. Check if player in detectionRange → ALERT
2. **ALERT** — Face player, brief pause (0.5s), then → AGGRESSIVE. Emit enemy_alert SFX.
3. **AGGRESSIVE** — Execute behavior:
   - `melee_chase`: Move toward player, attack when in range
   - `kite`: Move away if player too close, shoot when at optimal range
   - `heavy_slam`: Chase, stop to telegraph (0.8s), then slam AOE
   - `dive_attack`: Fly to position above player, dive down
   - `magic_ranged`: Teleport to safe distance, cast homing projectile
   - `flank_dodge`: Circle player, dodge on attack windup, strike from behind
   
   If player exceeds loseInterestRange for 3+ seconds → IDLE

**Stunned state:** Triggered by parry counter, charged attack, or slam. Duration 2s, flash white.

**Methods:**
- `update(dt, player, world)` — AI state machine + physics
- `takeDamage(amount, source)` — HP reduction, flash, knockback
- `attack(target)` — Execute attack based on type
- `die()` — Spawn particles, drop loot, emit event
- `render(renderer)` — Draw enemy with current state visual

### 4.8 Boss.js — Boss System

**Class:** `Boss` extends `Enemy`

**Constructor:**
```javascript
constructor(x, y, bossType) {
  super(x, y, 'BOSS');
  this.bossType = bossType;
  this.phases = [0.75, 0.5, 0.25]; // HP thresholds for phase changes
  this.currentPhase = 1;
  this.maxPhase = 3;
  this.introPlayed = false;
  this.defeated = false;
  
  // Arena bounds
  this.arenaLeft = 0;
  this.arenaRight = 0;
  this.arenaTop = 0;
  this.arenaBottom = 0;
  
  this.setBossType(bossType);
}
```

**Boss Types (6 dungeons):**

```javascript
const BOSSES = {
  OVERGROWN_GUARDIAN: {
    name: 'Overgrown Guardian',
    biome: 'FOREST',
    hp: 300, damage: 15, speed: 60,
    size: { w: 56, h: 72 }, color: '#2E7D32',
    // Phase 1: Slow melee, ground pound
    // Phase 2: + Vine whip (long range), summon Grunts
    // Phase 3: + Entangle (roots player), faster attacks
  },
  SAND_TITAN: {
    name: 'Sand Titan',
    biome: 'DESERT',
    hp: 400, damage: 20, speed: 40,
    size: { w: 64, h: 80 }, color: '#C2A060',
    // Phase 1: Sand slam, sand wave
    // Phase 2: + Burrow (goes underground, surprise attack)
    // Phase 3: + Sandstorm (obscures vision), quicksand traps
  },
  STORM_WYVERN: {
    name: 'Storm Wyvern',
    biome: 'MOUNTAIN',
    hp: 350, damage: 18, speed: 100,
    size: { w: 72, h: 48 }, color: '#64748B',
    // Phase 1: Dive attacks, wind gust
    // Phase 2: + Lightning strikes (telegraphed AOE)
    // Phase 3: + Tornado (pulls player), chain lightning
  },
  PESTILENT_ABOMINATION: {
    name: 'Pestilent Abomination',
    biome: 'SWAMP',
    hp: 450, damage: 12, speed: 50,
    size: { w: 60, h: 56 }, color: '#4A5D23',
    // Phase 1: Sludge toss, poison cloud
    // Phase 2: + Spawn slimes, poison ground
    // Phase 3: + Regeneration, toxic aura (damage over time near)
  },
  FROST_COLOSSUS: {
    name: 'Frost Colossus',
    biome: 'ICE',
    hp: 500, damage: 25, speed: 35,
    size: { w: 68, h: 88 }, color: '#CBD5E1',
    // Phase 1: Ice slam, ice shard throw
    // Phase 2: + Freeze beam (slows), ice armor (reduced damage)
    // Phase 3: + Blizzard (wind + snow), shatter (AOE on death of ice crystals)
  },
  INFERNO_DEMON: {
    name: 'Inferno Demon',
    biome: 'VOLCANO',
    hp: 600, damage: 22, speed: 80,
    size: { w: 56, h: 72 }, color: '#DC2626',
    // Phase 1: Fire slash, fireball
    // Phase 2: + Dash attack (leaves fire trail), lava eruption
    // Phase 3: + Meteor rain, hellfire aura, summon imps
  }
};
```

**Boss Fight Flow:**
1. Player enters boss room → door locks → intro animation
2. Boss introduces with roar + screen shake
3. Phase 1 attacks
4. At 75% HP → phase transition (flash, brief pause, new attack patterns)
5. At 50% HP → phase 2 transition
6. At 25% HP → phase 3 (enrage - faster, more damage)
7. Defeat → explosion of particles, unlock door, drop relic

**Methods:**
- `update(dt, player, world)` — Phase-aware AI
- `enterPhase(phaseNum)` — Transition with visual/audio cues
- `executeAttackPattern(dt, player)` — Current phase's attacks
- `render(renderer)` — Large sprite with health bar
- `onDefeated()` — Unlock doors, spawn loot, restore checkpoints

### 4.9 CombatSystem.js — Combat Engine

**Class:** `CombatSystem`

**Constructor:**
```javascript
constructor() {
  this.hitboxes = [];         // Active attack hitboxes this frame
  this.hurtboxes = [];        // Active hurtboxes this frame
  this.projectiles = [];      // Active projectiles
  this.comboMultiplier = 1.0;
  this.maxComboMultiplier = 4.0;
  this.hitstopDefault = 0.08; // seconds
  this.screenShakeDefault = { intensity: 5, duration: 0.2 };
}
```

**Hitbox/Hurtbox System:**
- Each attack registers a `Hitbox`: `{ owner, x, y, w, h, damage, knockback, type, duration }`
- Each entity has a `Hurtbox`: `{ owner, x, y, w, h, team }`
- Teams: `'player'`, `'enemy'`, `'neutral'`
- Collision = AABB overlap between hitbox and hurtbox where teams differ

**Methods:**
- `registerHitbox(hitbox)` — Add attack hitbox for this frame
- `registerHurtbox(hurtbox)` — Register entity hurtbox
- `update(dt)` — Check all hitbox/hurtbox collisions, apply damage
- `resolveHit(hitbox, hurtbox)` — Calculate damage, apply knockback, spawn particles
- `addProjectile(proj)` — Spawn projectile
- `updateProjectiles(dt, world)` — Move projectiles, check collisions
- `calculateDamage(baseDamage, attacker, defender, isCharged)` → final damage
  - Combo multiplier: ×1.0, ×1.3, ×1.6 for combo hits
  - Charged: ×2.0 at full charge
  - Crit: ×1.5 (10% base chance)
- `applyKnockback(target, source, force)` — Push target away from source

**Hit Feel:**
- On every hit: hitstop (0.05–0.15s based on damage), screen shake (2–8px)
- Enemy hit: flash white for 0.1s, red particles, knockback
- Player hit: red vignette flash, controller rumble
- Kill: larger hitstop (0.2s), more shake, enemy dissolve particles

### 4.10 ScaleSystem.js — Size Transformation

**Class:** `ScaleSystem`

**Constructor:**
```javascript
constructor() {
  this.shrinkZones = [];      // Array of { x, y, radius, active }
  this.transitionDuration = 0.8; // seconds
  this.playerCanShrinkAnywhere = false; // Unlocked after first dungeon item
}
```

**Shrink Zone Visual:** Cyan/white glowing circle on ground, particles drifting upward. Player must stand in zone and press Q to shrink.

**Methods:**
- `addShrinkZone(x, y, radius)` — Add zone to world
- `isInShrinkZone(player)` → boolean
- `canShrink(player)` → boolean
- `startTransition(player, toSmall)` — Begin 0.8s cinematic transition
  - Phase 1 (0–0.3s): Screen zoom toward player, particles converge
  - Phase 2 (0.3–0.5s): Flash, scale change
  - Phase 3 (0.5–0.8s): Zoom back out, particles burst
- `updateTransition(dt, player)` — Update ongoing transition
- `getScaleEffects(scale)` → modified stats
  - scale=0.25: speed×0.6, damage×0.5, hitbox×0.4, can fit small gaps, can climb walls
  - scale=1.0: normal stats

### 4.11 ItemSystem.js — Items & Inventory

**Class:** `ItemSystem`

**6 Dungeon Items:**
```javascript
const DUNGEON_ITEMS = {
  WHISPERING_SEED: {
    id: 'whispering_seed',
    name: 'Whispering Seed',
    dungeon: 'FOREST',
    description: 'A seed that hums with ancient energy. Allows shrinking anywhere.',
    effect: 'shrink_anywhere', // Unlocks shrink outside zones
    passive: null
  },
  MIRAGE_CLOAK: {
    id: 'mirage_cloak',
    name: 'Mirage Cloak',
    dungeon: 'DESERT',
    description: 'Grants a short dash-attack that leaves a mirage.',
    effect: 'dash_attack', // Attack during dodge for extra damage
    passive: 'mirage' // Brief afterimage on dodge
  },
  STONE_HEART: {
    id: 'stone_heart',
    name: 'Stone Heart',
    dungeon: 'MOUNTAIN',
    description: 'Halves knockback, adds super-armor on charged attacks.',
    effect: 'super_armor', // No flinch during charge
    passive: 'knockback_resist'
  },
  MURKY_AMULET: {
    id: 'murky_amulet',
    name: 'Murky Amulet',
    dungeon: 'SWAMP',
    description: 'Attacks apply poison. Poisoned enemies take DOT and slow.',
    effect: 'poison_touch', // 3 damage/sec for 5 sec
    passive: null
  },
  GLACIAL_CORE: {
    id: 'glacial_core',
    name: 'Glacial Core',
    dungeon: 'ICE',
    description: 'Parrying freezes enemies. Frozen enemies shatter for bonus damage.',
    effect: 'freeze_parry', // 3s freeze on successful parry
    passive: 'ice_walking' // No slip on ice
  },
  EMBER_CROWN: {
    id: 'ember_crown',
    name: 'Ember Crown',
    dungeon: 'VOLCANO',
    description: 'Charged attacks fire a flame wave. Full combo finisher explodes.',
    effect: 'flame_charge', // Fire wave projectile on charged attack
    passive: 'combo_explosion' // 3rd combo hit has AOE explosion
  }
};
```

**Methods:**
- `giveItem(player, itemId)` — Add item, apply passive effects
- `hasItem(player, itemId)` → boolean
- `getItemEffects(player)` → array of active effects
- `removeItem(player, itemId)` — Remove item
- `renderInventory(renderer)` — Draw inventory grid

### 4.12 QuestSystem.js — Quests

**Class:** `QuestSystem`

**18 Side Quests:**
```javascript
const QUESTS = [
  // Forest quests (3)
  { id: 'lost_kitten', name: 'Lost in the Canopy', biome: 'FOREST', type: 'find', target: 'kitten', reward: 'relic_leaf' },
  { id: 'herb_gather', name: 'Healer\'s Request', biome: 'FOREST', type: 'collect', target: 'rare_herb', count: 5, reward: 'hp_upgrade' },
  { id: 'ancient_ruin', name: 'Whispers of the Past', biome: 'FOREST', type: 'explore', target: 'hidden_ruin', reward: 'lore_fragment_1' },
  
  // Desert quests (3)
  { id: 'water_ration', name: 'Dying of Thirst', biome: 'DESERT', type: 'collect', target: 'water_crystal', count: 3, reward: 'relic_sand' },
  { id: 'merchant_escort', name: 'Caravan Guard', biome: 'DESERT', type: 'escort', target: 'merchant', reward: 'gold_pouch' },
  { id: 'sunken_city', name: 'City Beneath Sands', biome: 'DESERT', type: 'explore', target: 'sunken_city', reward: 'lore_fragment_2' },
  
  // Mountain quests (3)
  { id: 'climber_rescue', name: 'Alpine Rescue', biome: 'MOUNTAIN', type: 'rescue', target: 'climber', reward: 'relic_stone' },
  { id: 'goat_roundup', name: 'Mountain Goats', biome: 'MOUNTAIN', type: 'collect', target: 'goat', count: 4, reward: 'jump_upgrade' },
  { id: 'eagle_nest', name: 'Nest of the Sky King', biome: 'MOUNTAIN', type: 'explore', target: 'eagle_nest', reward: 'lore_fragment_3' },
  
  // Swamp quests (3)
  { id: 'fog_guide', name: 'Through the Mist', biome: 'SWAMP', type: 'escort', target: 'lost_traveler', reward: 'relic_muck' },
  { id: 'lily_pad_race', name: 'Swamp Sprint', biome: 'SWAMP', type: 'race', target: 'race_endpoint', timeLimit: 60, reward: 'speed_upgrade' },
  { id: 'witch_herbs', name: 'The Hag\'s Bargain', biome: 'SWAMP', type: 'collect', target: 'witch_herb', count: 7, reward: 'lore_fragment_4' },
  
  // Ice quests (3)
  { id: 'frozen_exporer', name: 'Icebound', biome: 'ICE', type: 'rescue', target: 'frozen_explorer', reward: 'relic_ice' },
  { id: 'ice_sculpture', name: 'Frozen Art', biome: 'ICE', type: 'collect', target: 'ice_crystal', count: 6, reward: 'parry_upgrade' },
  { id: 'aurora_watcher', name: 'Chasing Lights', biome: 'ICE', type: 'explore', target: 'aurora_peak', reward: 'lore_fragment_5' },
  
  // Volcano quests (3)
  { id: 'lava_fishing', name: 'What Lurks Below', biome: 'VOLCANO', type: 'collect', target: 'fire_fish', count: 3, reward: 'relic_ember' },
  { id: 'demon_hunter', name: 'Cleansing Fire', biome: 'VOLCANO', type: 'kill', target: 'demon', count: 10, reward: 'damage_upgrade' },
  { id: 'volcano_summit', name: 'Heart of the Mountain', biome: 'VOLCANO', type: 'explore', target: 'volcano_heart', reward: 'lore_fragment_6' }
];
```

**Methods:**
- `startQuest(questId)` — Activate quest, show notification
- `updateQuest(questId, progress)` — Advance quest objective
- `completeQuest(questId)` — Grant rewards, mark complete, show notification
- `getAvailableQuests(biome)` → array of available quests in biome
- `getActiveQuests()` → array of active quests
- `loadQuestState(savedState)` — Restore from save
- `serialize()` → quest state for saving

### 4.13 RelicFusionSystem.js — Crafting

**Class:** `RelicFusionSystem`

**10 Base Relics** (collected from quests/bosses):
`leaf, sand, stone, muck, ice, ember, dew, shadow, light, void`

**60 Fusions** (combinations of 2-3 relics):
- 50 normal fusions: combinations yield passive bonuses
- 10 secret fusions: rare combinations with unique powerful effects

**Example Fusions:**
```javascript
const FUSIONS = {
  'leaf+stone': { name: 'Living Armor', effect: 'regen_hp', value: 2 }, // 2 HP/sec regen
  'ember+ice': { name: 'Thermal Equilibrium', effect: 'elemental_immune', value: 1 }, // No fire/frost damage
  'sand+shadow': { name: 'Desert Phantom', effect: 'invisible_dodge', value: 1 }, // Brief invisibility after dodge
  'light+void': { name: 'Cosmic Balance', effect: 'damage_reflect', value: 0.3 }, // Reflect 30% damage
  // Secret: 3-relic combinations
  'leaf+dew+light': { name: 'Photosynthesis', effect: 'sun_heal', value: 5, secret: true }, // Heal 5/sec in daylight
  'ember+void+shadow': { name: 'Dark Flame', effect: 'life_steal', value: 0.2, secret: true }, // 20% lifesteal
  'stone+ice+sand': { name: 'Eternal Foundation', effect: 'cannot_be_moved', value: 1, secret: true }, // Immune to knockback
};
```

**Methods:**
- `discoverFusion(relics)` → fusion object or null
- `getAvailableFusions(collectedRelics)` → array of possible fusions
- `getDiscoveredFusions()` → array of discovered fusion IDs
- `getLoreForFusion(fusionId)` → string (lore text)
- `applyFusionEffects(player, fusionId)` — Apply passive to player
- `serialize()` → discovered fusions for save

### 4.14 SaveSystem.js — Persistence

**Class:** `SaveSystem`

**Save Data Structure:**
```javascript
const SAVE_SCHEMA = {
  version: 1,
  slot: 0, // 0,1,2
  timestamp: 0,
  player: {
    x: 0, y: 0,
    hp: 100, maxHP: 100,
    scale: 1.0,
    items: [],
    relics: [],
    equippedFusions: []
  },
  world: {
    seed: 0,
    discoveredChunks: [],
    currentBiome: 'FOREST',
    worldTime: 0,
    clearedDungeons: [],
    unlockedDoors: [],
    defeatedBosses: []
  },
  quests: {
    active: [],
    completed: [],
    objectives: {}
  },
  fusion: {
    discovered: [],
    collectedRelics: []
  },
  stats: {
    playTime: 0,
    enemiesKilled: 0,
    deaths: 0,
    combosMax: 0,
    shrinksUsed: 0
  }
};
```

**Methods:**
- `save(slot)` → boolean — Save to localStorage key `eots_save_{slot}`
- `load(slot)` → saveData or null
- `deleteSave(slot)` — Remove save
- `hasSave(slot)` → boolean
- `getSaveInfo(slot)` → { exists, timestamp, playTime, completion% }
- `autoSave()` — Save to slot 99 (auto)
- `exportToString()` → base64 save string
- `importFromString(str)` → boolean

### 4.15 UIManager.js — Interface

**Class:** `UIManager`

**Diegetic HUD Elements:**
- **Health Aura** — Player glows subtly, color shifts from green (full) to red (low)
- **Combo Display** — Numbers appear near player on hits, fade upward
- **Notifications** — Bottom-center, slide up, fade out
- **Minimap** — Top-right corner, shows discovered area
- **Scale Indicator** — Small icon showing current size state

**Screen Overlays:**
- Loading screen (progress bar + tip text)
- Title screen (animated background, menu options)
- Pause menu (resume, settings, save, quit)
- Inventory grid (items with descriptions on hover)
- Quest log (active/completed quest list)
- Fusion codex (discovered fusions with lore)
- Game over screen (stats, retry, quit)
- Settings (sound, controls, display)

**Methods:**
- `init()` — Create DOM elements for all screens
- `showScreen(name)` — Display screen overlay
- `hideScreen(name)` — Hide screen
- `showNotification(message, type)` — Show transient notification
- `updateHUD(dt, player)` — Update HUD elements
- `renderHUD(renderer)` — Draw in-game HUD (health bar, minimap, etc.)
- `showDialog(speaker, text)` — Dialog box with typewriter effect
- `showDamageNumber(x, y, amount, isCritical)` — Floating damage text
- `updateMinimap(world, player)` — Update minimap canvas
- `render(renderer)` — Draw all UI elements

## 5. Entity Base Class

```javascript
class Entity {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.width = 32; this.height = 32;
    this.active = true;
    this.z = 0; // render order
  }
  
  getBounds() {
    return { x: this.x - this.width/2, y: this.y - this.height, w: this.width, h: this.height };
  }
  
  intersects(other) {
    const a = this.getBounds();
    const b = other.getBounds();
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  
  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx*dx + dy*dy);
  }
  
  update(dt) { }
  render(renderer) { }
}
```

## 6. Asset Generation Strategy

Since we have no external assets, everything is procedural:

**Sprites:** Canvas-drawn shapes/colors representing entities
- Player: Simple humanoid shape with weapon
- Enemies: Color-coded shapes per type
- Bosses: Larger, more detailed shapes
- Items: Glowing orbs with distinct colors

**Tilesets:** Procedural patterns per biome
- Ground: Colored rectangles with noise texture
- Walls: Darker variants with edge highlighting
- Decorations: Simple geometric shapes

**Audio:** Fully procedural via Web Audio API (see AudioEngine)

**Particles:** Renderer particle system for all effects

## 7. index.html Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>Echoes of the Small</title>
  <style>/* Fullscreen canvas, no scrollbars */</style>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <div id="uiOverlay"><!-- HUD, menus, dialogs --></div>
  <script src="src/engine/Game.js"></script>
  <script src="src/engine/Renderer.js"></script>
  <!-- ... all modules ... -->
  <script>const game = new Game(); game.init();</script>
</body>
</html>
```

## 8. preview.html

Same as index.html but:
- Skips loading screen (instant start)
- Skips title screen (direct to gameplay)
- Pre-generates a small world section
- Includes all code inline (single file)
- Auto-shrinks the player after 5 seconds to demo scale mechanic

## 9. Performance Targets

- 60fps on modern browsers
- Max 1000 particles on screen
- Max 50 enemies active
- Chunk-based world rendering (only visible chunks)
- Object pooling for particles and projectiles
