import type { FighterState, GameInput, AIDifficulty, StageData } from './types';

// ─── AI Configuration by Difficulty ──────────────────────────────────

interface AIConfig {
  attackRange: number;      // max distance to initiate attack
  approachSpeed: number;    // joystick magnitude when approaching (0-1)
  attackCooldown: number;   // frames between attacks
  reactionFrames: number;   // frames of delay before reacting
  jumpChance: number;       // probability of jumping when player is above
  shieldChance: number;     // probability of shielding when player attacks
  specialChance: number;    // probability of using special moves
  smashChance: number;      // probability of using smash attacks at high damage
  edgeguard: boolean;       // whether to edgeguard off-stage players
  comboFollow: boolean;     // whether to chase and combo launched players
}

const CONFIG: Record<AIDifficulty, AIConfig> = {
  easy: {
    attackRange: 50,
    approachSpeed: 0.5,
    attackCooldown: 25,
    reactionFrames: 20,
    jumpChance: 0.2,
    shieldChance: 0.15,
    specialChance: 0.1,
    smashChance: 0.05,
    edgeguard: false,
    comboFollow: false,
  },
  medium: {
    attackRange: 65,
    approachSpeed: 0.75,
    attackCooldown: 12,
    reactionFrames: 8,
    jumpChance: 0.5,
    shieldChance: 0.4,
    specialChance: 0.25,
    smashChance: 0.15,
    edgeguard: true,
    comboFollow: true,
  },
  hard: {
    attackRange: 80,
    approachSpeed: 1.0,
    attackCooldown: 6,
    reactionFrames: 3,
    jumpChance: 0.8,
    shieldChance: 0.7,
    specialChance: 0.4,
    smashChance: 0.3,
    edgeguard: true,
    comboFollow: true,
  },
};

// ─── AI Controller ───────────────────────────────────────────────────

export class AIController {
  private config: AIConfig;
  private attackTimer = 0;
  private reactionTimer = 0;
  private jumpTimer = 0;
  private shieldTimer = 0;
  private comboTimer = 0;

  constructor(difficulty: AIDifficulty = 'medium') {
    this.config = CONFIG[difficulty];
    this.attackTimer = Math.floor(Math.random() * 5);
    this.reactionTimer = this.config.reactionFrames;
  }

  // ── Main Update ── Called every frame by GameLoop ──────────────────

  update(cpu: FighterState, player: FighterState, stage: StageData): GameInput {
    // Decrement timers
    if (this.attackTimer > 0) this.attackTimer--;
    if (this.reactionTimer > 0) this.reactionTimer--;
    if (this.jumpTimer > 0) this.jumpTimer--;
    if (this.shieldTimer > 0) this.shieldTimer--;
    if (this.comboTimer > 0) this.comboTimer--;

    // Default input (all zero / false)
    const input: GameInput = {
      joystick: { x: 0, y: 0 },
      attack: false, special: false, jump: false, shield: false, grab: false,
      attackPressed: false, specialPressed: false, jumpPressed: false,
      shieldPressed: false, grabPressed: false,
    };

    // If dead or in hitstun, do nothing
    if (cpu.isDead || cpu.hitstunFrames > 5) return input;

    const dx = player.position.x - cpu.position.x;
    const dy = player.position.y - cpu.position.y;
    const distX = Math.abs(dx);
    const distY = Math.abs(dy);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const facingPlayer = dx > 0 ? 1 : -1;

    // Always face the player
    if (!cpu.state.startsWith('attack')) {
      cpu.direction = facingPlayer;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: OFF-STAGE RECOVERY (highest priority)
    // ═══════════════════════════════════════════════════════════════════
    const mainPlat = stage.platforms[0];
    const platLeftEdge = mainPlat.x - mainPlat.width / 2;
    const platRightEdge = mainPlat.x + mainPlat.width / 2;
    const isOffStage = cpu.position.x < platLeftEdge - 30 || cpu.position.x > platRightEdge + 30;
    const isBelowStage = cpu.position.y > mainPlat.y + 40;

    if ((isOffStage || isBelowStage) && !cpu.isOnGround) {
      // Always move toward stage center
      input.joystick.x = mainPlat.x > cpu.position.x ? 1 : -1;

      // Jump if we can (up-special for recovery)
      if (cpu.jumpCount < cpu.maxJumpCount && this.jumpTimer <= 0) {
        input.jumpPressed = true;
        this.jumpTimer = 10;
      }

      // Use up-special when very far below
      if (isBelowStage && cpu.position.y > mainPlat.y + 200 && this.attackTimer <= 0) {
        input.joystick.y = -1;
        input.specialPressed = true;
        this.attackTimer = 30;
      }

      return input;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: EDGEGUARDING (attack player when they're recovering)
    // ═══════════════════════════════════════════════════════════════════
    const playerOffStage = player.position.x < platLeftEdge - 20 || player.position.x > platRightEdge + 20;
    const playerBelow = player.position.y > mainPlat.y;

    if (this.config.edgeguard && playerOffStage && cpu.isOnGround && this.attackTimer <= 0) {
      // Stand at the edge and attack when player tries to recover
      const atLeftEdge = cpu.position.x < platLeftEdge + 80;
      const atRightEdge = cpu.position.x > platRightEdge - 80;

      if (!atLeftEdge && !atRightEdge) {
        // Move toward the edge the player is recovering from
        input.joystick.x = player.position.x < mainPlat.x ? -1 : 1;
      } else {
        // At edge - attack downward or forward
        if (playerBelow && player.position.x > platLeftEdge && player.position.x < platRightEdge) {
          input.joystick.y = 1; // down attack to spike
          input.attackPressed = true;
          this.attackTimer = this.config.attackCooldown;
          return input;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: COMBO FOLLOW-UP (chase launched players)
    // ═══════════════════════════════════════════════════════════════════
    if (this.config.comboFollow && player.hitstunFrames > 3 && dist < 250) {
      // Move toward player for follow-up
      if (!cpu.isOnGround && dist > 40) {
        input.joystick.x = facingPlayer;
        input.joystick.y = dy > 0 ? 1 : -1;
      }

      // Aerial follow-up attack
      if (!cpu.isOnGround && dist < 70 && this.attackTimer <= 0 && !cpu.state.startsWith('attack')) {
        if (dy > 20) input.joystick.y = 1;
        else if (dy < -20) input.joystick.y = -1;
        else input.joystick.x = 1;
        input.attackPressed = true;
        this.attackTimer = this.config.attackCooldown;
        return input;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: DEFENSE (shield / dodge when player attacks)
    // ═══════════════════════════════════════════════════════════════════
    if (player.hitboxes.length > 0 && dist < 90 && this.reactionTimer <= 0) {
      if (Math.random() < this.config.shieldChance) {
        input.shield = true;
        this.shieldTimer = 15;
        return input;
      }
      // Spot-dodge occasionally
      if (Math.random() < this.config.shieldChance * 0.3 && cpu.isOnGround) {
        input.joystick.x = -facingPlayer;
        input.shieldPressed = true;
        return input;
      }
    }

    // Drop shield when safe
    if (cpu.state === 'shield' && player.hitboxes.length === 0) {
      if (this.shieldTimer <= 0) {
        input.shield = false;
        this.shieldTimer = 0;
      } else {
        input.shield = true;
      }
      return input;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: MOVEMENT (always approach unless attacking)
    // ═══════════════════════════════════════════════════════════════════
    if (!cpu.state.startsWith('attack')) {
      // Approach the player
      if (dist > this.config.attackRange * 0.6) {
        input.joystick.x = facingPlayer * this.config.approachSpeed;
      }
      // Retreat briefly after whiffed attack (if player is attacking)
      else if (dist < 25 && player.hitboxes.length > 0) {
        input.joystick.x = -facingPlayer * this.config.approachSpeed * 0.8;
      }
      // Micro-spacing: stay at attack range
      else if (dist < this.config.attackRange * 0.4) {
        input.joystick.x = -facingPlayer * 0.3;
      }

      // Jump to reach player on platforms
      if (player.position.y < cpu.position.y - 60 && cpu.isOnGround && this.jumpTimer <= 0) {
        if (Math.random() < this.config.jumpChance) {
          input.jumpPressed = true;
          this.jumpTimer = 20;
        }
      }

      // Jump toward player when both in air
      if (!cpu.isOnGround && player.position.y < cpu.position.y - 40 && cpu.jumpCount < cpu.maxJumpCount && this.jumpTimer <= 0) {
        if (Math.random() < this.config.jumpChance * 0.6) {
          input.jumpPressed = true;
          this.jumpTimer = 15;
        }
      }

      // Fast fall to reach grounded player quicker
      if (!cpu.isOnGround && cpu.velocity.y > 0 && player.position.y > cpu.position.y + 40) {
        input.joystick.y = 1;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 6: ATTACK (the good stuff)
    // ═══════════════════════════════════════════════════════════════════
    if (this.attackTimer <= 0 && !cpu.state.startsWith('attack') && dist < this.config.attackRange) {
      // Don't attack if player is invincible (respawning)
      if (player.invincibleFrames > 60) {
        // Just approach
      }
      // Grab if player is shielding and very close
      else if (player.state === 'shield' && dist < 40 && Math.random() < 0.4) {
        input.grabPressed = true;
        this.attackTimer = this.config.attackCooldown;
      }
      // Main attack
      else {
        this.executeAttack(cpu, player, dx, dy, distX, distY, input);
        this.attackTimer = this.config.attackCooldown;
      }
    }

    return input;
  }

  // ── Attack Selection ────────────────────────────────────────────────

  private executeAttack(
    cpu: FighterState,
    player: FighterState,
    _dx: number,
    _dy: number,
    distX: number,
    distY: number,
    input: GameInput
  ): void {
    const isGrounded = cpu.isOnGround;

    // Decide: special or normal attack
    const useSpecial = Math.random() < this.config.specialChance;

    if (useSpecial) {
      // Pick special direction
      if (!isGrounded && cpu.position.y > player.position.y + 60) {
        input.joystick.y = 1; // down-special (spike attempt)
      } else if (!isGrounded && player.position.y < cpu.position.y - 40) {
        input.joystick.y = -1; // up-special (recovery/chase)
      } else if (distX > 60) {
        input.joystick.x = cpu.direction; // side-special
      }
      input.specialPressed = true;
      return;
    }

    // Normal attacks
    if (isGrounded) {
      // Ground attacks
      const useSmash = cpu.damage > 80 && Math.random() < this.config.smashChance;

      if (distY > 25 && player.position.y > cpu.position.y) {
        // Player is below - down tilt / smash
        input.joystick.y = 1;
        input.attackPressed = true;
      } else if (distY > 25 && player.position.y < cpu.position.y) {
        // Player is above - up tilt / smash
        input.joystick.y = -1;
        if (useSmash) input.attackPressed = true; // will be utilt/usmash based on charge
        else input.attackPressed = true;
      } else if (distX > 35) {
        // Player is in front - forward tilt / smash
        input.joystick.x = cpu.direction;
        if (useSmash) {
          // Hold forward for smash (input handled, charge frames in Fighter.ts)
          input.attackPressed = true;
        } else {
          input.attackPressed = true;
        }
      } else {
        // Very close - jab
        input.attackPressed = true;
      }
    } else {
      // Aerial attacks
      if (distY > 20 && player.position.y > cpu.position.y) {
        input.joystick.y = 1;     // dair
        input.joystick.x = cpu.direction;
      } else if (distY > 20 && player.position.y < cpu.position.y) {
        input.joystick.y = -1;    // uair
        input.joystick.x = cpu.direction;
      } else if (distX > 20) {
        input.joystick.x = cpu.direction; // fair
      } else {
        input.joystick.x = 0;     // nair
      }
      input.attackPressed = true;
    }
  }

  // ── Setter ──────────────────────────────────────────────────────────

  setDifficulty(difficulty: AIDifficulty): void {
    this.config = CONFIG[difficulty];
  }
}
