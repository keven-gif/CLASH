import type {
  FighterState,
  StageData,
  Camera,
  Particle,
  FloatingText,
  MatchState,
  Platform,
  Vector2,
} from './types';
import { CHARACTER_STATS } from './types';
import {
  applyGravity,
  applyFriction,
  updatePosition,
  checkBlastZone,
  checkFighterPlatformCollision,
  checkHitboxCollision,
  updateCamera,
} from './Physics';
import {
  updateFighterState,
  handleFighterInput,
  fighterTakeHit,
  koFighter,
  getCharacterAccentColor,
} from './Fighter';
import { preloadCharacterImages, preloadStageImages } from './Renderer';
import { updateMovingPlatforms } from './Stage';
import {
  renderStage,
  renderPlatforms,
  renderFighter,
  renderParticles,
  renderFloatingText,
  renderScreenEffects,
  renderCountdown,
  renderKOText,
  renderGameOver,
  renderRespawnEffects,
  triggerShake,
} from './Renderer';
import { InputHandler } from './InputHandler';
import { AIController } from './AIController';

// ─── State Sync Payload (host → client every N frames) ──────────────

export interface FighterSyncData {
  x: number; y: number;
  vx: number; vy: number;
  state: string;
  direction: number;
  damage: number;
  stocks: number;
  isDead: boolean;
  hitstunFrames: number;
  isOnGround: boolean;
}

export interface StateSyncPayload {
  fighters: FighterSyncData[]; // index matches playerIndex
  timer: number;
  frame: number;
}

// ─── Game Loop Options ───────────────────────────────────────────────

export interface GameLoopOptions {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  stage: StageData;
  platforms: Platform[];
  player1: FighterState;
  player2: FighterState;
  inputHandler: InputHandler;
  aiController: AIController;
  /** Optional override for P2 input (online mode). Return null to fall back to AI. */
  getP2Input?: () => { joystick: { x: number; y: number }; attack: boolean; special: boolean; jump: boolean; shield: boolean; grab: boolean; attackPressed: boolean; specialPressed: boolean; jumpPressed: boolean; shieldPressed: boolean; grabPressed: boolean; } | null;
  /** Optional callback to send P1 input over network (online mode). */
  onLocalInput?: (input: { joystick: { x: number; y: number }; attack: boolean; special: boolean; jump: boolean; shield: boolean; grab: boolean; attackPressed: boolean; specialPressed: boolean; jumpPressed: boolean; shieldPressed: boolean; grabPressed: boolean; frame: number }) => void;
  /** Host-only: broadcast authoritative game state every SYNC_INTERVAL frames. */
  onStateSync?: (state: StateSyncPayload) => void;
  matchTime: number;
  onDamageUpdate: (player: 1 | 2, damage: number) => void;
  onStockUpdate: (player: 1 | 2, stocks: number) => void;
  onTimerUpdate: (timer: number) => void;
  onMatchEnd: (winner: 1 | 2) => void;
  onCountdownUpdate: (countdown: number) => void;
  onPhaseUpdate: (phase: MatchState['phase']) => void;
  /** Extra fighters for 3-4 player online matches (fighters[2] and fighters[3]) */
  extraFighters?: FighterState[];
  /** Which fighter index the local player controls (default 0 = P1) */
  myPlayerIndex?: number;
}

// ─── Game Loop Class ─────────────────────────────────────────────────

export class GameLoop {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stage: StageData;
  private platforms: Platform[];
  private player1: FighterState;
  private player2: FighterState;
  private fighters: FighterState[]; // [player1, player2, ...extraFighters]
  private myPlayerIndex: number;
  private inputHandler: InputHandler;
  private aiController: AIController;
  private getP2Input?: GameLoopOptions['getP2Input'];
  private onLocalInput?: GameLoopOptions['onLocalInput'];
  private onStateSync?: GameLoopOptions['onStateSync'];
  // Remote input buffers indexed by playerIndex (for multi-player)
  private remoteInputs: Map<number, { joystick: { x: number; y: number }; attack: boolean; special: boolean; jump: boolean; shield: boolean; grab: boolean; attackPressed: boolean; specialPressed: boolean; jumpPressed: boolean; shieldPressed: boolean; grabPressed: boolean; }> = new Map();
  private localFrame = 0;
  private syncCounter = 0;
  private readonly SYNC_INTERVAL = 2; // broadcast every 2 physics frames (~33ms)

  private camera: Camera = {
    x: 0, y: 0, zoom: 1.0,
    targetX: 0, targetY: 0, targetZoom: 1.0,
    shakeX: 0, shakeY: 0, shakeIntensity: 0, shakeDuration: 0,
  };

  private matchState: MatchState = {
    phase: 'countdown',
    countdown: 3,
    timer: 180,
    hitstopFrames: 0,
    koFrames: 0,
    respawnFrames: 0,
    suddenDeath: false,
  };

  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private damageVignette = 0;

  private animFrameId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1000 / 60; // ~16.67ms per frame

  private countdownTimer = 0;
  private countdownValue = 3;
  private showGO = false;
  private goTimer = 0;

  private paused = false;
  private matchEnded = false;
  private matchEndFired = false;
  private opts: GameLoopOptions;

  // Callbacks
  private onDamageUpdate: (player: 1 | 2, damage: number) => void;
  private onStockUpdate: (player: 1 | 2, stocks: number) => void;
  private onTimerUpdate: (timer: number) => void;
  private onMatchEnd: (winner: 1 | 2) => void;
  private onCountdownUpdate: (countdown: number) => void;
  private onPhaseUpdate: (phase: MatchState['phase']) => void;

  constructor(opts: GameLoopOptions) {
    this.opts = opts;
    this.canvas = opts.canvas;
    this.ctx = opts.ctx;
    this.stage = opts.stage;
    this.platforms = opts.platforms;
    this.player1 = opts.player1;
    this.player2 = opts.player2;
    this.fighters = [opts.player1, opts.player2, ...(opts.extraFighters ?? [])];
    this.myPlayerIndex = opts.myPlayerIndex ?? 0;
    this.inputHandler = opts.inputHandler;
    this.aiController = opts.aiController;
    this.getP2Input = opts.getP2Input;
    this.onLocalInput = opts.onLocalInput;
    this.onStateSync = opts.onStateSync;
    this.matchState.timer = opts.matchTime;

    this.onDamageUpdate = opts.onDamageUpdate;
    this.onStockUpdate = opts.onStockUpdate;
    this.onTimerUpdate = opts.onTimerUpdate;
    this.onMatchEnd = opts.onMatchEnd;
    this.onCountdownUpdate = opts.onCountdownUpdate;
    this.onPhaseUpdate = opts.onPhaseUpdate;

    // Set initial camera to center of stage (scaled for 4x platforms)
    this.camera.x = this.stage.platforms[0]?.x ?? 0;
    this.camera.y = (this.stage.platforms[0]?.y ?? 0) - 160;

    // Preload character and stage images for canvas rendering
    preloadCharacterImages();
    preloadStageImages();
  }

  // ── Start / Stop ───────────────────────────────────────────────────

  start(): void {
    this.paused = false;
    this.matchEnded = false;
    this.matchEndFired = false;
    this.matchState.timer = this.opts.matchTime;
    this.matchState.suddenDeath = false;
    this.lastTime = performance.now();
    this.countdownValue = 3;
    this.countdownTimer = 0;
    this.showGO = false;
    this.matchState.phase = 'countdown';
    this.onPhaseUpdate('countdown');
    this.onCountdownUpdate(3);

    // Reset fighters
    this.player1.isDead = false;
    this.player1.state = 'idle';
    this.player1.damage = 0;
    this.player1.stocks = 3;
    this.player1.velocity = { x: 0, y: 0 };
    this.player1.hitstunFrames = 0;
    this.player1.invincibleFrames = 0;
    this.player1.shieldHealth = 100;
    this.player1.shieldActive = false;
    this.player1.hitboxes = [];

    this.player2.isDead = false;
    this.player2.state = 'idle';
    this.player2.damage = 0;
    this.player2.stocks = 3;
    this.player2.velocity = { x: 0, y: 0 };
    this.player2.hitstunFrames = 0;
    this.player2.invincibleFrames = 0;
    this.player2.shieldHealth = 100;
    this.player2.shieldActive = false;
    this.player2.hitboxes = [];

    this.loop = this.loop.bind(this);
    this.loop(performance.now());
  }

  stop(): void {
    this.paused = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  pause(): void {
    this.paused = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  resume(): void {
    if (this.paused) {
      this.paused = false;
      this.lastTime = performance.now();
      this.loop(performance.now());
    }
  }

  destroy(): void {
    this.stop();
  }

  getMatchState(): MatchState {
    return { ...this.matchState };
  }

  // ── Main Loop ──────────────────────────────────────────────────────

  private loop = (currentTime: number): void => {
    if (this.paused) return;

    const rawDt = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Prevent spiral of death
    const dt = Math.min(rawDt, 100);
    this.accumulator += dt;

    // Fixed timestep update
    while (this.accumulator >= this.FIXED_DT) {
      this.update();
      this.accumulator -= this.FIXED_DT;
    }

    // Render
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // ── Update ─────────────────────────────────────────────────────────

  private update(): void {
    // Handle countdown
    if (this.matchState.phase === 'countdown') {
      this.countdownTimer++;
      if (this.countdownTimer >= 60) { // ~1 second
        this.countdownTimer = 0;
        this.countdownValue--;
        this.onCountdownUpdate(this.countdownValue);

        if (this.countdownValue <= 0) {
          this.showGO = true;
          this.goTimer = 45; // 0.75s show "GO!"
          this.matchState.phase = 'active';
          this.onPhaseUpdate('active');
        }
      }
      return; // Don't update fighters during countdown
    }

    // Handle GO! display
    if (this.showGO) {
      this.goTimer--;
      if (this.goTimer <= 0) {
        this.showGO = false;
        this.onCountdownUpdate(-1); // signal GO! is done
      }
    }

    // Handle hitstop
    if (this.matchState.phase === 'hitstop') {
      this.matchState.hitstopFrames--;
      if (this.matchState.hitstopFrames <= 0) {
        this.matchState.phase = 'active';
      }
      this.updateParticles();
      this.updateFloatingText();
      return;
    }

    // Handle KO cinematic
    if (this.matchState.phase === 'ko') {
      this.matchState.koFrames--;
      if (this.matchState.koFrames <= 0) {
        // FFA: check if only one fighter has stocks left
        const alive = this.fighters.filter(f => f.stocks > 0);
        if (alive.length <= 1) {
          // Winner = fighter with most stocks (or index 0 if tie)
          const winnerIdx = this.fighters.reduce((best, f, i) =>
            f.stocks > this.fighters[best].stocks ? i : best, 0);
          this.endMatch(winnerIdx === 0 ? 1 : 2);
          return;
        }
        this.matchState.phase = 'active';
      }
      this.updateParticles();
      this.updateFloatingText();
      this.updateCamera();
      return;
    }

    // Timer
    this.matchState.timer -= 1 / 60;
    if (this.matchState.timer <= 0) {
      this.matchState.timer = 0;
      this.handleTimeUp();
    }
    this.onTimerUpdate(Math.ceil(this.matchState.timer));

    // Update moving platforms
    updateMovingPlatforms(this.platforms);

    // Get local player input
    const localInput = this.inputHandler.getGameInput();
    if (this.onLocalInput) {
      this.onLocalInput({ ...localInput, frame: this.localFrame++ });
    }

    // Update all fighters
    for (let i = 0; i < this.fighters.length; i++) {
      let inp: typeof localInput;
      if (i === this.myPlayerIndex) {
        inp = localInput;
      } else if (i === 1 && this.myPlayerIndex === 0) {
        // 2-player compat: P2 uses getP2Input or AI
        const remoteInput = this.getP2Input?.();
        inp = remoteInput ?? this.aiController.update(this.player2, this.player1, this.stage);
      } else {
        // Multi-player: use buffered remote input or AI
        inp = this.remoteInputs.get(i) ?? this.aiController.update(this.fighters[i], this.fighters[this.myPlayerIndex], this.stage);
      }
      this.updateFighter(this.fighters[i], inp);
    }

    // N-way hitbox collision
    this.checkHitboxCollisionsMulti();

    // Check blast zones / KOs
    this.checkBlastZones();

    // Update particles and effects
    this.updateParticles();
    this.updateFloatingText();

    // Damage vignette decay
    if (this.damageVignette > 0) {
      this.damageVignette -= 0.02;
    }

    // Update camera
    this.updateCamera();

    // Sync React state (first two players only for HUD compat)
    this.onDamageUpdate(1, Math.round(this.fighters[0].damage));
    this.onDamageUpdate(2, Math.round(this.fighters[1]?.damage ?? 0));

    // Host: broadcast authoritative state every SYNC_INTERVAL frames
    if (this.onStateSync && ++this.syncCounter >= this.SYNC_INTERVAL) {
      this.syncCounter = 0;
      this.onStateSync({
        fighters: this.fighters.map(f => this.extractFighterSync(f)),
        timer: this.matchState.timer,
        frame: this.localFrame,
      });
    }
  }

  private extractFighterSync(f: FighterState): FighterSyncData {
    return {
      x: f.position.x, y: f.position.y,
      vx: f.velocity.x, vy: f.velocity.y,
      state: f.state,
      direction: f.direction,
      damage: f.damage,
      stocks: f.stocks,
      isDead: f.isDead,
      hitstunFrames: f.hitstunFrames,
      isOnGround: f.isOnGround,
    };
  }

  /** Client: snap to host's authoritative state. Skip own fighter to avoid rubberbanding. */
  applyRemoteState(state: StateSyncPayload): void {
    if (state.fighters) {
      // Multi-player array format
      for (let i = 0; i < state.fighters.length && i < this.fighters.length; i++) {
        if (i !== this.myPlayerIndex) {
          this.snapFighter(this.fighters[i], state.fighters[i]);
        }
      }
    } else {
      // Legacy 2-player format (backwards compat)
      const legacy = state as any;
      if (legacy.p1 && legacy.p2) {
        this.snapFighter(this.player2, legacy.p1);
        this.snapFighter(this.player1, legacy.p2);
      }
    }
    if (this.matchState.phase === 'active') {
      this.matchState.timer = state.timer;
    }
  }

  /** Apply a remote player's input to their fighter slot. */
  applyRemoteInput(playerIndex: number, input: { joystick: { x: number; y: number }; attack: boolean; special: boolean; jump: boolean; shield: boolean; grab: boolean; attackPressed: boolean; specialPressed: boolean; jumpPressed: boolean; shieldPressed: boolean; grabPressed: boolean; }): void {
    this.remoteInputs.set(playerIndex, input);
  }

  private snapFighter(f: FighterState, s: FighterSyncData): void {
    f.position.x = s.x;
    f.position.y = s.y;
    f.velocity.x = s.vx;
    f.velocity.y = s.vy;
    f.direction = s.direction as 1 | -1;
    f.damage = s.damage;
    f.stocks = s.stocks;
    f.isDead = s.isDead;
    f.hitstunFrames = s.hitstunFrames;
    f.isOnGround = s.isOnGround;
  }

  // ── Update Single Fighter ──────────────────────────────────────────

  private updateFighter(fighter: FighterState, input: {
    joystick: Vector2;
    attack: boolean;
    special: boolean;
    jump: boolean;
    shield: boolean;
    grab: boolean;
    attackPressed: boolean;
    specialPressed: boolean;
    jumpPressed: boolean;
    shieldPressed: boolean;
    grabPressed: boolean;
  }): void {
    // Update state machine FIRST (before the dead-fighter early return).
    // updateFighterState() in Fighter.ts decrements respawnTimer for
    // dead fighters and calls respawnFighter() when it hits zero.
    // If we returned early here, dead fighters would never respawn.
    updateFighterState(fighter);

    // Skip input and physics for dead fighters (but state machine
    // was already updated above, so respawn can still happen).
    if (fighter.isDead) return;

    // Handle input
    handleFighterInput(fighter, input);

    // Physics
    if (!fighter.isOnGround && fighter.state !== 'shield' && !fighter.state.startsWith('attack')) {
      applyGravity(fighter);
    }

    applyFriction(fighter, fighter.isOnGround);
    updatePosition(fighter);

    // Platform collision
    checkFighterPlatformCollision(fighter, this.platforms);

    // Update hurtbox
    const stats = CHARACTER_STATS[fighter.characterId];
    if (stats) {
      fighter.hurtbox.x = fighter.position.x;
      fighter.hurtbox.y = fighter.position.y;
      fighter.hurtbox.width = stats.width;
      fighter.hurtbox.height = stats.height;
    }
  }

  // ── Hitbox Collisions ──────────────────────────────────────────────

  private checkHitboxCollisions(): void {
    this.checkHitboxCollisionsMulti();
  }

  private checkHitboxCollisionsMulti(): void {
    for (let a = 0; a < this.fighters.length; a++) {
      const attacker = this.fighters[a];
      if (attacker.hitboxes.length === 0) continue;
      for (let b = 0; b < this.fighters.length; b++) {
        if (a === b) continue;
        const target = this.fighters[b];
        const result = checkHitboxCollision(attacker, target);
        if (result.hit) {
          const hb = attacker.hitboxes[result.hitboxIndex];
          const targetName: 'player1' | 'player2' = b === this.myPlayerIndex ? 'player1' : 'player2';
          this.applyHit(target, hb, attacker.direction, targetName);
          attacker.hitboxes = attacker.hitboxes.filter((_, i) => i !== result.hitboxIndex);
          break; // one hit per frame per attacker
        }
      }
    }
  }

  private applyHit(
    target: FighterState,
    hitbox: { damage: number; angle: number; baseKnockback: number; knockbackScaling: number; x: number },
    attackerDirection: number,
    targetName: 'player1' | 'player2'
  ): void {
    const result = fighterTakeHit(target, hitbox as import('./types').Hitbox, attackerDirection);
    const isAutoKO = result.isAutoKO;

    // Hitstop for heavy hits (dramatic pause for auto-KO)
    if (isAutoKO) {
      this.matchState.phase = 'hitstop';
      this.matchState.hitstopFrames = 25; // Long dramatic freeze
    } else if (hitbox.damage >= 10) {
      this.matchState.phase = 'hitstop';
      this.matchState.hitstopFrames = Math.min(8, Math.floor(hitbox.damage * 0.5));
    }

    // Screen shake (massive for auto-KO)
    const shakeIntensity = isAutoKO ? 18 : Math.min(8, hitbox.damage * 0.4);
    const shakeDuration = isAutoKO ? 30 : Math.min(12, Math.floor(hitbox.damage * 0.6));
    triggerShake(this.camera, shakeIntensity, shakeDuration);

    // Damage vignette for player
    if (targetName === 'player1') {
      this.damageVignette = isAutoKO ? 1.0 : Math.min(1, hitbox.damage / 20);
    }

    // Spawn hit particles (explosive for auto-KO)
    const accent = getCharacterAccentColor(target.characterId);
    const particleCount = isAutoKO ? 40 : (hitbox.damage >= 10 ? 14 : 8);
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = isAutoKO
        ? (6 + Math.random() * 10)
        : ((hitbox.damage >= 10 ? 4 : 2.5) + Math.random() * 3);
      this.particles.push({
        x: target.position.x,
        y: target.position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1,
        life: isAutoKO ? 50 : (hitbox.damage >= 10 ? 25 : 15),
        maxLife: isAutoKO ? 50 : (hitbox.damage >= 10 ? 25 : 15),
        size: isAutoKO ? (5 + Math.random() * 6) : (hitbox.damage >= 10 ? 4 + Math.random() * 3 : 2 + Math.random() * 2),
        color: isAutoKO ? (i % 3 === 0 ? '#FF0044' : i % 3 === 1 ? '#FFB800' : '#FFFFFF') : (hitbox.damage >= 10 ? '#FFB800' : accent),
        type: 'hitSpark',
      });
    }

    // Floating damage text (dramatic for auto-KO)
    this.floatingTexts.push({
      x: target.position.x,
      y: target.position.y - 30,
      text: isAutoKO ? 'K.O.!' : `+${hitbox.damage}%`,
      color: isAutoKO ? '#FF0044' : accent,
      life: isAutoKO ? 80 : 50,
      maxLife: isAutoKO ? 80 : 50,
      size: isAutoKO ? 56 : (hitbox.damage >= 10 ? 36 : 24),
    });
  }

  // ── Blast Zones ────────────────────────────────────────────────────

  private checkBlastZones(): void {
    // M7: shrink blast zones by 30% during sudden death
    const bzScale = this.matchState.suddenDeath ? 0.7 : 1.0;
    const effectiveStage = bzScale !== 1.0 ? {
      ...this.stage,
      blastZones: {
        left: this.stage.blastZones.left * bzScale,
        right: this.stage.blastZones.right * bzScale,
        top: this.stage.blastZones.top * bzScale,
        bottom: this.stage.blastZones.bottom * bzScale,
      },
    } : this.stage;

    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i];
      if (checkBlastZone(f, effectiveStage) && !f.isDead) {
        koFighter(f);
        // HUD only tracks players 1 & 2 (indices 0 & 1)
        if (i === 0) this.onStockUpdate(1, f.stocks);
        else if (i === 1) this.onStockUpdate(2, f.stocks);
        this.spawnKOParticles(f);
        triggerShake(this.camera, 10, 20);
        this.matchState.phase = 'ko';
        this.matchState.koFrames = 90;
      }
    }
  }

  private spawnKOParticles(fighter: FighterState): void {
    const accent = getCharacterAccentColor(fighter.characterId);
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 3 + Math.random() * 5;
      this.particles.push({
        x: fighter.position.x,
        y: fighter.position.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 40,
        maxLife: 40,
        size: 3 + Math.random() * 4,
        color: i % 3 === 0 ? '#FFFFFF' : accent,
        type: 'hitSpark',
      });
    }
  }

  // ── Time Up ────────────────────────────────────────────────────────

  private handleTimeUp(): void {
    // Winner = fighter with most stocks; tie-break by least damage
    const best = this.fighters.reduce((best, f, i) => {
      const bF = this.fighters[best];
      if (f.stocks > bF.stocks) return i;
      if (f.stocks === bF.stocks && f.damage < bF.damage) return i;
      return best;
    }, 0);
    const second = this.fighters.reduce((b2, f, i) => {
      if (i === best) return b2;
      const b2F = this.fighters[b2];
      if (b2F < 0 || f.stocks > b2F.stocks) return i;
      return b2;
    }, best === 0 ? 1 : 0);

    if (this.fighters[best].stocks === this.fighters[second].stocks &&
        Math.abs(this.fighters[best].damage - this.fighters[second].damage) < 5) {
      // Sudden death
      this.matchState.suddenDeath = true;
      this.fighters.forEach((f, i) => {
        f.damage = 300;
        if (i === 0) this.onDamageUpdate(1, 300);
        else if (i === 1) this.onDamageUpdate(2, 300);
      });
    } else {
      this.endMatch(best === 0 ? 1 : 2);
    }
  }

  private endMatch(winner: 1 | 2): void {
    if (this.matchEnded) return;
    this.matchEnded = true;
    if (this.matchEndFired) return;
    this.matchEndFired = true;
    this.matchState.phase = 'gameOver';
    this.onPhaseUpdate('gameOver');
    this.onMatchEnd(winner);
  }

  // ── Camera ─────────────────────────────────────────────────────────

  private updateCamera(): void {
    const dpr = window.devicePixelRatio || 1;
    // For 3-4 player: compute centroid of alive fighters and use spread as zoom hint
    const alive = this.fighters.filter(f => !f.isDead);
    const p1 = alive[0]?.position ?? this.fighters[0].position;
    const p2 = alive[1]?.position ?? this.fighters[this.fighters.length - 1].position;
    updateCamera(
      this.camera,
      p1,
      p2,
      this.canvas.width / dpr,
      this.canvas.height / dpr,
      this.stage
    );
  }

  // ── Particles ──────────────────────────────────────────────────────

  private updateParticles(): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // slight gravity
      p.life--;

      if (p.rotation !== undefined && p.rotationSpeed !== undefined) {
        p.rotation += p.rotationSpeed;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateFloatingText(): void {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life--;
      ft.y -= 0.8; // float up
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  private render(): void {
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    // Stage background
    const { offsetX, offsetY, scale } = renderStage(ctx, this.stage, this.camera, w, h);

    // Platforms
    renderPlatforms(ctx, this.platforms, offsetX, offsetY, scale);

    // Respawn effects (draw under fighters)
    renderRespawnEffects(ctx, this.fighters, offsetX, offsetY, scale);

    // Fighters (all of them)
    for (const fighter of this.fighters) {
      if (!fighter.isDead || fighter.state !== 'dead') {
        renderFighter(ctx, fighter, offsetX, offsetY, scale);
      }
    }

    // Particles
    renderParticles(ctx, this.particles, offsetX, offsetY, scale);

    // Floating text
    renderFloatingText(ctx, this.floatingTexts, offsetX, offsetY, scale);

    // Screen effects
    renderScreenEffects(ctx, w, h, this.damageVignette);

    // Countdown
    if (this.matchState.phase === 'countdown') {
      renderCountdown(ctx, w, h, this.countdownValue);
    } else if (this.showGO) {
      renderCountdown(ctx, w, h, 0);
    }

    // KO text
    if (this.matchState.phase === 'ko') {
      renderKOText(ctx, w, h, this.matchState.koFrames);
    }

    // Game over
    if (this.matchState.phase === 'gameOver') {
      renderGameOver(ctx, w, h);
    }
  }
}
