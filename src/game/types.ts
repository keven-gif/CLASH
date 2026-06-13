// ─── Core Vector Types ───────────────────────────────────────────────

export interface Vector2 {
  x: number;
  y: number;
}

// ─── Hitbox ──────────────────────────────────────────────────────────

export interface Hitbox {
  x: number;
  y: number;
  width: number;
  height: number;
  damage: number;
  angle: number; // degrees, 0 = right, 90 = up, etc.
  baseKnockback: number;
  knockbackScaling: number;
  activeFrames: number;
  currentFrame: number;
  ownerDirection: number; // 1 or -1
}

// ─── Platform ────────────────────────────────────────────────────────

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  isPassThrough: boolean;
  velocity?: Vector2; // for moving platforms
  minX?: number;
  maxX?: number;
}

// ─── Stage ───────────────────────────────────────────────────────────

export interface StageData {
  id: string;
  platforms: Platform[];
  blastZones: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  spawnPoints: Vector2[];
}

// ─── Fighter State ───────────────────────────────────────────────────

export type FighterStateType =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'doubleJump'
  | 'fall'
  | 'fastFall'
  | 'crouch'
  | 'shield'
  | 'dodgeGround'
  | 'dodgeAir'
  | 'hitstun'
  | 'launched'
  | 'tumble'
  | 'ledgeGrab'
  | 'knockdown'
  | 'dead'
  | 'attackJab'
  | 'attackFTilt'
  | 'attackUTilt'
  | 'attackDTilt'
  | 'attackFSmash'
  | 'attackUSmash'
  | 'attackDSmash'
  | 'attackNAir'
  | 'attackFAir'
  | 'attackBAir'
  | 'attackUAir'
  | 'attackDAir'
  | 'attackNSpecial'
  | 'attackSSpecial'
  | 'attackUSpecial'
  | 'attackDSpecial'
  | 'attackGrab'
  | 'attackFThrow'
  | 'attackBThrow'
  | 'attackUThrow'
  | 'attackDThrow';

export interface FighterState {
  position: Vector2;
  velocity: Vector2;
  state: FighterStateType;
  prevState: FighterStateType;
  damage: number;
  stocks: number;
  direction: 1 | -1;
  isOnGround: boolean;
  canDoubleJump: boolean;
  jumpCount: number;        // jumps used since last grounded (0 = on ground)
  maxJumpCount: number;     // 2 for all (ground + double)
  shieldHealth: number;
  shieldActive: boolean;
  hitstunFrames: number;
  invincibleFrames: number;
  characterId: string;
  frame: number; // current animation frame
  stateTimer: number; // frames remaining in current state
  hitboxes: Hitbox[];
  hurtbox: { x: number; y: number; width: number; height: number };
  isFastFalling: boolean;
  ledgeGrabsLeft: number; // prevent infinite ledge regrabs
  hitFlash: number; // frames remaining for white flash
  respawnTimer: number;
  trail: Vector2[]; // previous positions for motion trail
  isDead: boolean;
  coyoteTimer: number; // frames of grace after leaving a platform (0-3)
  spawnPoint: { x: number; y: number }; // respawn position for this fighter
  usedUpSpecial: boolean; // consumed once per airtime — prevents infinite up-B spam
}

// ─── Character Stats ─────────────────────────────────────────────────

export interface CharacterStats {
  speed: number;
  weight: number;
  jumpForce: number;
  doubleJumpForce: number;
  fallSpeed: number;
  runSpeed: number;
  width: number;
  height: number;
}

export const CHARACTER_STATS: Record<string, CharacterStats> = {
  assassin: {
    speed: 5,
    weight: 1.0,
    jumpForce: 14,
    doubleJumpForce: 10,
    fallSpeed: 0.5,
    runSpeed: 6,
    width: 55,
    height: 88,
  },
  swordsman: {
    speed: 4,
    weight: 1.2,
    jumpForce: 13,
    doubleJumpForce: 9,
    fallSpeed: 0.55,
    runSpeed: 5,
    width: 58,
    height: 92,
  },
  ronin: {
    speed: 5,
    weight: 0.9,
    jumpForce: 14.5,
    doubleJumpForce: 11,
    fallSpeed: 0.48,
    runSpeed: 6.5,
    width: 55,
    height: 88,
  },
  alchemist: {
    speed: 3.5,
    weight: 1.1,
    jumpForce: 12,
    doubleJumpForce: 8,
    fallSpeed: 0.52,
    runSpeed: 4.5,
    width: 56,
    height: 90,
  },
  gunner: {
    speed: 3.5,
    weight: 1.0,
    jumpForce: 13,
    doubleJumpForce: 9,
    fallSpeed: 0.5,
    runSpeed: 5,
    width: 56,
    height: 90,
  },
};

// ─── Game Input ──────────────────────────────────────────────────────

export type GameButton = 'attack' | 'special' | 'jump' | 'shield' | 'grab';

export interface GameInput {
  joystick: Vector2; // normalized -1 to 1
  attack: boolean;
  special: boolean;
  jump: boolean;
  shield: boolean;
  grab: boolean;
  attackPressed: boolean; // single press (not hold)
  specialPressed: boolean;
  jumpPressed: boolean;
  shieldPressed: boolean;
  grabPressed: boolean;
}

// ─── Particles / Effects ─────────────────────────────────────────────

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'hitSpark' | 'shieldBreak' | 'jumpDust' | 'landDust' | 'trail' | 'starKO';
  rotation?: number;
  rotationSpeed?: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
  shakeDuration: number;
}

// ─── Match State ─────────────────────────────────────────────────────

export type MatchPhase = 'countdown' | 'active' | 'hitstop' | 'ko' | 'respawn' | 'gameOver';

export interface MatchState {
  phase: MatchPhase;
  countdown: number;
  timer: number; // seconds remaining
  hitstopFrames: number;
  koFrames: number;
  respawnFrames: number;
  suddenDeath: boolean;
}

// ─── AI ──────────────────────────────────────────────────────────────

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIState {
  difficulty: AIDifficulty;
  reactionTimer: number;
  actionTimer: number;
  targetDistance: number;
  isApproaching: boolean;
  isRetreating: boolean;
  isAttacking: boolean;
  lastAction: string;
  mixupCounter: number;
}
