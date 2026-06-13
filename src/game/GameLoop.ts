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
  matchTime: number;
  onDamageUpdate: (player: 1 | 2, damage: number) => void;
  onStockUpdate: (player: 1 | 2, stocks: number) => void;
  onTimerUpdate: (timer: number) => void;
  onMatchEnd: (winner: 1 | 2) => void;
  onCountdownUpdate: (countdown: number) => void;
  onPhaseUpdate: (phase: MatchState['phase']) => void;
}

// ─── Game Loop Class ─────────────────────────────────────────────────

export class GameLoop {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stage: StageData;
  private platforms: Platform[];
  private player1: FighterState;
  private player2: FighterState;
  private inputHandler: InputHandler;
  private aiController: AIController;

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

  // Callbacks
  private onDamageUpdate: (player: 1 | 2, damage: number) => void;
  private onStockUpdate: (player: 1 | 2, stocks: number) => void;
  private onTimerUpdate: (timer: number) => void;
  private onMatchEnd: (winner: 1 | 2) => void;
  private onCountdownUpdate: (countdown: number) => void;
  private onPhaseUpdate: (phase: MatchState['phase']) => void;

  constructor(opts: GameLoopOptions) {
    this.canvas = opts.canvas;
    this.ctx = opts.ctx;
    this.stage = opts.stage;
    this.platforms = opts.platforms;
    this.player1 = opts.player1;
    this.player2 = opts.player2;
    this.inputHandler = opts.inputHandler;
    this.aiController = opts.aiController;
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
        // Check if match should continue or end
        if (this.player1.stocks <= 0) {
          this.endMatch(2);
          return;
        }
        if (this.player2.stocks <= 0) {
          this.endMatch(1);
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

    // Get inputs
    const p1Input = this.inputHandler.getGameInput();
    const p2Input = this.aiController.update(this.player2, this.player1, this.stage);

    // Update fighters
    this.updateFighter(this.player1, p1Input);
    this.updateFighter(this.player2, p2Input);

    // Collision: hitboxes
    this.checkHitboxCollisions();

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

    // Sync React state
    this.onDamageUpdate(1, Math.round(this.player1.damage));
    this.onDamageUpdate(2, Math.round(this.player2.damage));
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
    // P1 attacks P2
    if (this.player1.hitboxes.length > 0) {
      const result = checkHitboxCollision(this.player1, this.player2);
      if (result.hit) {
        const hb = this.player1.hitboxes[result.hitboxIndex];
        this.applyHit(this.player2, hb, this.player1.direction, 'player2');
        // Remove hitbox after it connects (one-hit per active frame)
        this.player1.hitboxes = this.player1.hitboxes.filter((_, i) => i !== result.hitboxIndex);
      }
    }

    // P2 attacks P1
    if (this.player2.hitboxes.length > 0) {
      const result = checkHitboxCollision(this.player2, this.player1);
      if (result.hit) {
        const hb = this.player2.hitboxes[result.hitboxIndex];
        this.applyHit(this.player1, hb, this.player2.direction, 'player1');
        this.player2.hitboxes = this.player2.hitboxes.filter((_, i) => i !== result.hitboxIndex);
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
    // Player 1
    if (checkBlastZone(this.player1, this.stage) && !this.player1.isDead) {
      koFighter(this.player1);
      this.onStockUpdate(1, this.player1.stocks);
      this.spawnKOParticles(this.player1);
      triggerShake(this.camera, 10, 20);
      this.matchState.phase = 'ko';
      this.matchState.koFrames = 90;
    }

    // Player 2
    if (checkBlastZone(this.player2, this.stage) && !this.player2.isDead) {
      koFighter(this.player2);
      this.onStockUpdate(2, this.player2.stocks);
      this.spawnKOParticles(this.player2);
      triggerShake(this.camera, 10, 20);
      this.matchState.phase = 'ko';
      this.matchState.koFrames = 90;
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
    if (this.player1.stocks > this.player2.stocks) {
      this.endMatch(1);
    } else if (this.player2.stocks > this.player1.stocks) {
      this.endMatch(2);
    } else {
      // Sudden death
      this.matchState.suddenDeath = true;
      this.player1.damage = 300;
      this.player2.damage = 300;
      this.onDamageUpdate(1, 300);
      this.onDamageUpdate(2, 300);
      // Shrink blast zones handled in stage
    }
  }

  private endMatch(winner: 1 | 2): void {
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.matchState.phase = 'gameOver';
    this.onPhaseUpdate('gameOver');
    this.onMatchEnd(winner);
  }

  // ── Camera ─────────────────────────────────────────────────────────

  private updateCamera(): void {
    updateCamera(
      this.camera,
      this.player1.isDead ? this.player2.position : this.player1.position,
      this.player2.isDead ? this.player1.position : this.player2.position,
      this.canvas.width,
      this.canvas.height,
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
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Stage background
    const { offsetX, offsetY, scale } = renderStage(ctx, this.stage, this.camera, w, h);

    // Platforms
    renderPlatforms(ctx, this.platforms, offsetX, offsetY, scale);

    // Respawn effects (draw under fighters)
    renderRespawnEffects(ctx, [this.player1, this.player2], offsetX, offsetY, scale);

    // Fighters
    if (!this.player1.isDead || this.player1.state !== 'dead') {
      renderFighter(ctx, this.player1, offsetX, offsetY, scale);
    }
    if (!this.player2.isDead || this.player2.state !== 'dead') {
      renderFighter(ctx, this.player2, offsetX, offsetY, scale);
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
