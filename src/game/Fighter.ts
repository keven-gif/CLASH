import type { FighterState, FighterStateType, Hitbox, Vector2 } from './types';
import { CHARACTER_STATS } from './types';
import { calculateKnockback } from './Physics';

// ─── Attack Data ─────────────────────────────────────────────────────

interface AttackData {
  hitbox: Omit<Hitbox, 'currentFrame' | 'ownerDirection'>;
  startupFrames: number;
  activeFrames: number;
  endlagFrames: number;
  canMove: boolean;
}

const ATTACKS: Record<string, AttackData> = {
  attackJab: {
    hitbox: { x: 28, y: -5, width: 35, height: 30, damage: 4, angle: 45, baseKnockback: 3, knockbackScaling: 30, activeFrames: 3 },
    startupFrames: 3,
    activeFrames: 3,
    endlagFrames: 10,
    canMove: false,
  },
  attackFTilt: {
    hitbox: { x: 32, y: -5, width: 40, height: 32, damage: 8, angle: 35, baseKnockback: 5, knockbackScaling: 50, activeFrames: 4 },
    startupFrames: 5,
    activeFrames: 4,
    endlagFrames: 14,
    canMove: false,
  },
  attackUTilt: {
    hitbox: { x: 0, y: -35, width: 38, height: 30, damage: 7, angle: 90, baseKnockback: 6, knockbackScaling: 45, activeFrames: 4 },
    startupFrames: 4,
    activeFrames: 4,
    endlagFrames: 12,
    canMove: false,
  },
  attackDTilt: {
    hitbox: { x: 30, y: 18, width: 42, height: 18, damage: 6, angle: 20, baseKnockback: 4, knockbackScaling: 40, activeFrames: 3 },
    startupFrames: 4,
    activeFrames: 3,
    endlagFrames: 11,
    canMove: false,
  },
  attackFSmash: {
    hitbox: { x: 38, y: -8, width: 48, height: 38, damage: 18, angle: 30, baseKnockback: 8, knockbackScaling: 80, activeFrames: 5 },
    startupFrames: 12,
    activeFrames: 5,
    endlagFrames: 24,
    canMove: false,
  },
  attackUSmash: {
    hitbox: { x: 0, y: -42, width: 42, height: 36, damage: 16, angle: 80, baseKnockback: 7, knockbackScaling: 75, activeFrames: 4 },
    startupFrames: 10,
    activeFrames: 4,
    endlagFrames: 22,
    canMove: false,
  },
  attackDSmash: {
    hitbox: { x: 0, y: 20, width: 60, height: 22, damage: 14, angle: 10, baseKnockback: 6, knockbackScaling: 70, activeFrames: 5 },
    startupFrames: 8,
    activeFrames: 5,
    endlagFrames: 20,
    canMove: false,
  },
  attackNAir: {
    hitbox: { x: 0, y: 0, width: 46, height: 46, damage: 9, angle: 55, baseKnockback: 5, knockbackScaling: 50, activeFrames: 4 },
    startupFrames: 4,
    activeFrames: 4,
    endlagFrames: 12,
    canMove: true,
  },
  attackFAir: {
    hitbox: { x: 30, y: -5, width: 38, height: 32, damage: 11, angle: 30, baseKnockback: 6, knockbackScaling: 60, activeFrames: 4 },
    startupFrames: 6,
    activeFrames: 4,
    endlagFrames: 16,
    canMove: true,
  },
  attackBAir: {
    hitbox: { x: -30, y: -5, width: 38, height: 32, damage: 12, angle: 140, baseKnockback: 7, knockbackScaling: 65, activeFrames: 4 },
    startupFrames: 6,
    activeFrames: 4,
    endlagFrames: 18,
    canMove: true,
  },
  attackUAir: {
    hitbox: { x: 0, y: -35, width: 36, height: 30, damage: 10, angle: 85, baseKnockback: 6, knockbackScaling: 55, activeFrames: 4 },
    startupFrames: 5,
    activeFrames: 4,
    endlagFrames: 14,
    canMove: true,
  },
  attackDAir: {
    hitbox: { x: 0, y: 28, width: 36, height: 28, damage: 13, angle: -75, baseKnockback: 5, knockbackScaling: 55, activeFrames: 5 },
    startupFrames: 8,
    activeFrames: 5,
    endlagFrames: 20,
    canMove: true,
  },
  attackNSpecial: {
    hitbox: { x: 45, y: -5, width: 50, height: 20, damage: 10, angle: 40, baseKnockback: 6, knockbackScaling: 55, activeFrames: 8 },
    startupFrames: 8,
    activeFrames: 8,
    endlagFrames: 18,
    canMove: false,
  },
  attackSSpecial: {
    hitbox: { x: 35, y: 0, width: 44, height: 30, damage: 12, angle: 35, baseKnockback: 7, knockbackScaling: 60, activeFrames: 6 },
    startupFrames: 10,
    activeFrames: 6,
    endlagFrames: 22,
    canMove: false,
  },
  attackUSpecial: {
    hitbox: { x: 0, y: -10, width: 34, height: 44, damage: 8, angle: 80, baseKnockback: 7, knockbackScaling: 40, activeFrames: 10 },
    startupFrames: 4,
    activeFrames: 10,
    endlagFrames: 16,
    canMove: false,
  },
  attackDSpecial: {
    hitbox: { x: 0, y: 20, width: 55, height: 22, damage: 11, angle: 20, baseKnockback: 6, knockbackScaling: 55, activeFrames: 8 },
    startupFrames: 6,
    activeFrames: 8,
    endlagFrames: 18,
    canMove: false,
  },
  attackGrab: {
    hitbox: { x: 28, y: -5, width: 30, height: 35, damage: 0, angle: 0, baseKnockback: 0, knockbackScaling: 0, activeFrames: 4 },
    startupFrames: 5,
    activeFrames: 4,
    endlagFrames: 20,
    canMove: false,
  },
  attackFThrow: {
    hitbox: { x: 35, y: -5, width: 40, height: 38, damage: 8, angle: 35, baseKnockback: 7, knockbackScaling: 55, activeFrames: 3 },
    startupFrames: 8,
    activeFrames: 3,
    endlagFrames: 16,
    canMove: false,
  },
  attackBThrow: {
    hitbox: { x: -35, y: -5, width: 40, height: 38, damage: 9, angle: 135, baseKnockback: 7, knockbackScaling: 60, activeFrames: 3 },
    startupFrames: 8,
    activeFrames: 3,
    endlagFrames: 16,
    canMove: false,
  },
  attackUThrow: {
    hitbox: { x: 0, y: -35, width: 38, height: 32, damage: 7, angle: 85, baseKnockback: 7, knockbackScaling: 50, activeFrames: 3 },
    startupFrames: 8,
    activeFrames: 3,
    endlagFrames: 16,
    canMove: false,
  },
  attackDThrow: {
    hitbox: { x: 0, y: 25, width: 42, height: 22, damage: 6, angle: 45, baseKnockback: 4, knockbackScaling: 65, activeFrames: 3 },
    startupFrames: 8,
    activeFrames: 3,
    endlagFrames: 18,
    canMove: false,
  },
};

// ─── Create Initial Fighter ──────────────────────────────────────────

export function createFighter(characterId: string, startPos: Vector2): FighterState {
  const stats = CHARACTER_STATS[characterId] ?? CHARACTER_STATS['assassin'];
  return {
    position: { ...startPos },
    velocity: { x: 0, y: 0 },
    state: 'idle',
    prevState: 'idle',
    damage: 0,
    stocks: 3,
    direction: 1,
    isOnGround: true,
    canDoubleJump: true,
    jumpCount: 0,
    maxJumpCount: 2,
    shieldHealth: 100,
    shieldActive: false,
    hitstunFrames: 0,
    invincibleFrames: 0,
    characterId,
    frame: 0,
    stateTimer: 0,
    hitboxes: [],
    hurtbox: { x: 0, y: 0, width: stats.width, height: stats.height },
    isFastFalling: false,
    ledgeGrabsLeft: 2,
    hitFlash: 0,
    respawnTimer: 0,
    trail: [],
    isDead: false,
    coyoteTimer: 0,
    spawnPoint: { ...startPos },
    usedUpSpecial: false,
  };
}

// ─── State Machine Update ────────────────────────────────────────────

export function updateFighterState(fighter: FighterState): void {
  fighter.frame++;
  if (fighter.stateTimer > 0) {
    fighter.stateTimer--;
  }

  // Decrement invincibility
  if (fighter.invincibleFrames > 0) {
    fighter.invincibleFrames--;
  }

  // Decrement hitflash
  if (fighter.hitFlash > 0) {
    fighter.hitFlash--;
  }

  // Decrement hitstun
  if (fighter.hitstunFrames > 0) {
    fighter.hitstunFrames--;
    if (fighter.hitstunFrames <= 0) {
      transitionToState(fighter, fighter.isOnGround ? 'idle' : 'fall');
    }
  }

  // Update hitboxes - remove expired ones
  fighter.hitboxes = fighter.hitboxes.filter((hb) => {
    hb.currentFrame++;
    // Adjust hitbox position based on fighter position and direction
    hb.x = hb.ownerDirection * Math.abs(hb.x);
    return hb.currentFrame <= hb.activeFrames;
  });

  // State-specific transitions
  switch (fighter.state) {
    case 'shield':
      // Shield decays while active
      fighter.shieldHealth = Math.max(0, fighter.shieldHealth - 0.15);
      if (fighter.shieldHealth <= 0) {
        fighter.shieldActive = false;
        transitionToState(fighter, 'hitstun');
        fighter.hitstunFrames = 60; // shield break stun
        fighter.shieldHealth = 100;
      }
      break;

    case 'dodgeGround':
    case 'dodgeAir':
      if (fighter.stateTimer <= 0) {
        transitionToState(fighter, fighter.isOnGround ? 'idle' : 'fall');
      }
      break;

    case 'knockdown':
      if (fighter.stateTimer <= 0) {
        transitionToState(fighter, 'idle');
      }
      break;

    case 'dead':
      fighter.respawnTimer--;
      if (fighter.respawnTimer <= 0) {
        respawnFighter(fighter);
      }
      break;
  }

  // Auto-transition attacks when timer expires
  if (
    fighter.state.startsWith('attack') &&
    fighter.stateTimer <= 0 &&
    fighter.state !== 'attackGrab'
  ) {
    transitionToState(fighter, fighter.isOnGround ? 'idle' : 'fall');
  }

  // Fall transition
  if (!fighter.isOnGround && fighter.velocity.y > 0) {
    if (
      fighter.state !== 'jump' &&
      fighter.state !== 'doubleJump' &&
      fighter.state !== 'hitstun' &&
      fighter.state !== 'launched' &&
      fighter.state !== 'attackGrab' &&
      fighter.state !== 'dodgeAir' &&
      !fighter.state.startsWith('attack')
    ) {
      fighter.state = 'fall';
    }
  }

  // Update hurtbox to match position
  const stats = CHARACTER_STATS[fighter.characterId] ?? CHARACTER_STATS['assassin'];
  fighter.hurtbox.x = fighter.position.x;
  fighter.hurtbox.y = fighter.position.y;
  fighter.hurtbox.width = stats.width;
  fighter.hurtbox.height = stats.height;
}

// ─── State Transitions ───────────────────────────────────────────────

function transitionToState(fighter: FighterState, newState: FighterStateType): void {
  fighter.prevState = fighter.state;
  fighter.state = newState;
  fighter.frame = 0;
  fighter.shieldActive = newState === 'shield';

  // Clear hitboxes when leaving attack states
  if (fighter.prevState.startsWith('attack')) {
    fighter.hitboxes = [];
  }
}

// ─── Input Handling ──────────────────────────────────────────────────

export function handleFighterInput(
  fighter: FighterState,
  input: {
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
  }
): void {
  if (fighter.isDead) return;
  if (fighter.hitstunFrames > 0) return;
  if (fighter.invincibleFrames > 30) return; // brief spawn protection

  const stats = CHARACTER_STATS[fighter.characterId];
  if (!stats) return;

  // Direction facing
  if (input.joystick.x !== 0 && !fighter.state.startsWith('attack')) {
    fighter.direction = input.joystick.x > 0 ? 1 : -1;
  }

  // ── Shield ─────────────────────────────────────────────────────────
  if (input.shield && fighter.isOnGround && fighter.state === 'idle') {
    transitionToState(fighter, 'shield');
    return;
  }

  if (!input.shield && fighter.state === 'shield') {
    transitionToState(fighter, 'idle');
    fighter.shieldActive = false;
    return;
  }

  // Dodge from shield + direction
  if (
    fighter.state === 'shield' &&
    (Math.abs(input.joystick.x) > 0.5 || Math.abs(input.joystick.y) > 0.5) &&
    input.shieldPressed
  ) {
    transitionToState(fighter, 'dodgeGround');
    fighter.stateTimer = 18;
    const dodgeSpeed = 7;
    fighter.velocity.x = (input.joystick.x > 0 ? 1 : -1) * dodgeSpeed;
    fighter.shieldActive = false;
    return;
  }

  // ── Movement ───────────────────────────────────────────────────────
  if (!fighter.state.startsWith('attack') && fighter.state !== 'shield') {
    // Walk/run
    if (Math.abs(input.joystick.x) > 0.3) {
      const moveSpeed = Math.abs(input.joystick.x) > 0.7 ? stats.speed * 1.4 : stats.speed;
      fighter.velocity.x = input.joystick.x * moveSpeed;
      if (fighter.isOnGround) {
        fighter.state = Math.abs(input.joystick.x) > 0.7 ? 'run' : 'walk';
      }
    } else if (fighter.isOnGround && fighter.state !== 'dodgeGround' && fighter.state !== 'knockdown') {
      fighter.state = 'idle';
    }

    // Crouch
    if (input.joystick.y > 0.5 && fighter.isOnGround) {
      fighter.state = 'crouch';
    }

    // Fast fall
    if (input.joystick.y > 0.6 && !fighter.isOnGround && !fighter.isFastFalling) {
      fighter.isFastFalling = true;
      fighter.state = 'fastFall';
    }
  }

  // ── Jump ───────────────────────────────────────────────────────────
  if (input.jumpPressed) {
    if (fighter.isOnGround) {
      // Ground jump — always allowed on ground
      fighter.velocity.y = -stats.jumpForce;
      fighter.isOnGround = false;
      fighter.jumpCount = 1;
      fighter.canDoubleJump = fighter.maxJumpCount > 1;
      transitionToState(fighter, 'jump');
    } else if (fighter.jumpCount < fighter.maxJumpCount) {
      // Air jump (double jump, triple jump, etc.)
      fighter.velocity.y = -stats.doubleJumpForce;
      fighter.jumpCount++;
      fighter.canDoubleJump = fighter.jumpCount < fighter.maxJumpCount;
      transitionToState(fighter, 'doubleJump');
    }
  }

  // ── Attacks ────────────────────────────────────────────────────────
  if (input.attackPressed && !fighter.state.startsWith('attack')) {
    performAttack(fighter, input);
  }

  if (input.specialPressed && !fighter.state.startsWith('attack')) {
    performSpecial(fighter, input);
  }

  if (input.grabPressed && !fighter.state.startsWith('attack')) {
    performGrab(fighter);
  }
}

// ─── Attack Execution ────────────────────────────────────────────────

function performAttack(
  fighter: FighterState,
  input: { joystick: Vector2 }
): void {
  const isGrounded = fighter.isOnGround;
  const jx = input.joystick.x * fighter.direction; // relative to facing
  const jy = input.joystick.y;

  let attackType: FighterStateType;

  if (isGrounded) {
    // Ground attacks
    if (Math.abs(jy) > 0.4) {
      attackType = jy > 0 ? 'attackDTilt' : 'attackUTilt';
    } else if (Math.abs(jx) > 0.3) {
      attackType = 'attackFTilt';
    } else {
      attackType = 'attackJab';
    }
  } else {
    // Aerial attacks
    if (Math.abs(jy) > 0.4) {
      attackType = jy > 0 ? 'attackDAir' : 'attackUAir';
    } else if (Math.abs(jx) > 0.3) {
      attackType = jx > 0 ? 'attackFAir' : 'attackBAir';
    } else {
      attackType = 'attackNAir';
    }
  }

  startAttack(fighter, attackType);
}

function performSpecial(
  fighter: FighterState,
  input: { joystick: Vector2 }
): void {
  const jx = input.joystick.x * fighter.direction;
  const jy = input.joystick.y;

  let attackType: FighterStateType;

  if (Math.abs(jy) > 0.5) {
    attackType = jy > 0 ? 'attackDSpecial' : 'attackUSpecial';
  } else if (Math.abs(jx) > 0.3) {
    attackType = 'attackSSpecial';
  } else {
    attackType = 'attackNSpecial';
  }

  startAttack(fighter, attackType);

  // Up special recovery — one use per airtime
  if (attackType === 'attackUSpecial') {
    if (fighter.usedUpSpecial) return; // already used — cancel silently
    fighter.usedUpSpecial = true;
    const stats = CHARACTER_STATS[fighter.characterId];
    fighter.velocity.y = -(stats?.jumpForce ?? 13) * 1.1;
    fighter.velocity.x = input.joystick.x * 5;
  }
}

function performGrab(fighter: FighterState): void {
  startAttack(fighter, 'attackGrab');
}

function startAttack(fighter: FighterState, attackType: FighterStateType): void {
  const data = ATTACKS[attackType];
  if (!data) return;

  transitionToState(fighter, attackType);
  fighter.stateTimer = data.startupFrames + data.activeFrames + data.endlagFrames;

  // Zero horizontal velocity on grounded attacks that can't move
  // Prevents sliding during attack animation due to friction not fully stopping momentum
  if (fighter.isOnGround && !data.canMove) {
    fighter.velocity.x = 0;
  }

  // Create hitbox (it becomes active after startup frames via the update)
  const hb: Hitbox = {
    ...data.hitbox,
    currentFrame: 0,
    activeFrames: data.activeFrames,
    ownerDirection: fighter.direction,
  };

  // Delay hitbox activation by startup frames using stateTimer check in update
  // For simplicity, add it now but set currentFrame negative
  hb.currentFrame = -data.startupFrames;
  fighter.hitboxes.push(hb);
}

// ─── Take Hit ────────────────────────────────────────────────────────

export function fighterTakeHit(
  fighter: FighterState,
  hitbox: Hitbox,
  attackerDirection: number
): { knockedBack: boolean; kbVector: Vector2; isAutoKO: boolean } {
  const stats = CHARACTER_STATS[fighter.characterId];
  const weight = stats?.weight ?? 1.0;

  // Apply damage
  fighter.damage += hitbox.damage;
  fighter.hitFlash = 4;

  // 300%+ DAMAGE = AUTOMATIC KO (any hit sends you flying off-screen)
  const isAutoKO = fighter.damage >= 300;

  // Calculate knockback
  const kbVector = calculateKnockback(
    fighter.damage,
    hitbox.damage,
    hitbox.baseKnockback,
    hitbox.knockbackScaling,
    weight,
    hitbox.angle
  );

  // Apply knockback in attacker's facing direction
  const kbDir = hitbox.x >= 0 ? attackerDirection : -attackerDirection;

  if (isAutoKO) {
    // Auto-KO: send fighter flying way past blast zones with massive velocity
    // Direction: up and away from attacker for dramatic star-KO effect
    const awayDir = kbDir;
    fighter.velocity.x = awayDir * (18 + Math.random() * 8);  // 18-26 horizontal
    fighter.velocity.y = -(22 + Math.random() * 12);           // -22 to -34 vertical (up and away)
  } else {
    // Normal knockback
    fighter.velocity.x = kbVector.x * kbDir;
    fighter.velocity.y = kbVector.y;
  }

  // Enter hitstun (longer stun for auto-KO so they can't recover)
  const hitstunDuration = isAutoKO
    ? 120  // 2 seconds of hitstun — can't act, will definitely fly past blast zones
    : Math.max(8, Math.min(60, Math.floor((Math.abs(kbVector.x) + Math.abs(kbVector.y)) * 3)));
  fighter.hitstunFrames = hitstunDuration;
  transitionToState(fighter, 'launched');
  fighter.isOnGround = false;
  fighter.shieldActive = false;

  return {
    knockedBack: true,
    kbVector,
    isAutoKO,
  };
}

// ─── Respawn ─────────────────────────────────────────────────────────

export function respawnFighter(fighter: FighterState): void {
  // Respawn at the fighter's designated spawn point (set during creation)
  // with a slight y-offset so they fall onto the platform naturally.
  fighter.position = {
    x: fighter.spawnPoint.x,
    y: fighter.spawnPoint.y - 30, // 30 units above spawn for a short fall
  };
  fighter.velocity = { x: 0, y: 0 };
  fighter.damage = 0;
  fighter.state = 'fall';
  fighter.hitstunFrames = 0;
  fighter.invincibleFrames = 120; // 2 seconds of invincibility
  fighter.isDead = false;
  fighter.jumpCount = 0;
  fighter.shieldHealth = 100;
  fighter.shieldActive = false;
  fighter.hitboxes = [];
  fighter.trail = [];
  fighter.coyoteTimer = 0;
  fighter.isOnGround = false;
  fighter.canDoubleJump = true;
  fighter.usedUpSpecial = false;
}

// ─── KO ──────────────────────────────────────────────────────────────

export function koFighter(fighter: FighterState): void {
  fighter.stocks--;
  fighter.isDead = true;
  fighter.state = 'dead';
  fighter.respawnTimer = 120; // 2 second delay before respawn
  fighter.velocity = { x: 0, y: 0 };
  fighter.hitboxes = [];
}

// ─── Get Accent Color ────────────────────────────────────────────────

export function getCharacterAccentColor(characterId: string): string {
  const colors: Record<string, string> = {
    assassin: '#E81D2D',
    swordsman: '#00E5D4',
    ronin: '#4DA6FF',
    alchemist: '#39FF14',
    gunner: '#FF8C00',
  };
  return colors[characterId] ?? '#FFFFFF';
}

// ─── Get Damage Color ────────────────────────────────────────────────

export function getDamageColor(damage: number): string {
  if (damage <= 50) return '#00E5D4';
  if (damage <= 120) return '#FFB800';
  if (damage <= 250) return '#E81D2D';
  return '#FF0044';
}
