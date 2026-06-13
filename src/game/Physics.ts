import type { FighterState, StageData, Vector2 } from './types';
import { CHARACTER_STATS } from './types';

// ─── Physics Constants ───────────────────────────────────────────────

export const GRAVITY = 0.6;
export const TERMINAL_VELOCITY = 12;
export const GROUND_FRICTION = 0.85;
export const AIR_FRICTION = 0.98;
export const FAST_FALL_SPEED = 8;

// ─── Gravity ─────────────────────────────────────────────────────────

export function applyGravity(fighter: FighterState): void {
  const stats = CHARACTER_STATS[fighter.characterId];
  if (!stats) return;

  const grav = GRAVITY * stats.weight;
  fighter.velocity.y += grav;

  // Terminal velocity cap
  const maxFall = fighter.isFastFalling ? FAST_FALL_SPEED : TERMINAL_VELOCITY;
  if (fighter.velocity.y > maxFall) {
    fighter.velocity.y = maxFall;
  }
}

// ─── Friction ────────────────────────────────────────────────────────

export function applyFriction(fighter: FighterState, onGround: boolean): void {
  if (onGround) {
    fighter.velocity.x *= GROUND_FRICTION;
    // Snap to 0 when very slow
    if (Math.abs(fighter.velocity.x) < 0.1) {
      fighter.velocity.x = 0;
    }
  } else {
    fighter.velocity.x *= AIR_FRICTION;
  }
}

// ─── Position Update ─────────────────────────────────────────────────

export function updatePosition(fighter: FighterState): void {
  fighter.position.x += fighter.velocity.x;
  fighter.position.y += fighter.velocity.y;

  // Update trail
  fighter.trail.unshift({ x: fighter.position.x, y: fighter.position.y });
  if (fighter.trail.length > 8) {
    fighter.trail.pop();
  }
}

// ─── Blast Zone Check ────────────────────────────────────────────────

export function checkBlastZone(fighter: FighterState, stage: StageData): boolean {
  const { position } = fighter;
  const { blastZones } = stage;

  return (
    position.x < blastZones.left ||
    position.x > blastZones.right ||
    position.y < blastZones.top ||
    position.y > blastZones.bottom
  );
}

// ─── Knockback Calculation ───────────────────────────────────────────
// Classic Smash formula: KB = (damage * 0.12 + knockbackGrowth * damage * scaling) + baseKnockback
// Then scale by weight and angle

export function calculateKnockback(
  damagePercent: number,
  attackDamage: number,
  baseKnockback: number,
  knockbackScaling: number,
  weight: number,
  angleDegrees: number
): Vector2 {
  // Damage scaling factor
  const damageScaling = damagePercent * 0.12;
  const attackScaling = attackDamage * knockbackScaling * 0.01;
  const totalKnockback = (baseKnockback + damageScaling + attackScaling) / weight;

  // Clamp: min 2, max 28 (lowered cap for tighter knockback control)
  const clampedKB = Math.max(2, Math.min(totalKnockback, 28));

  // Convert angle to radians
  const angleRad = (angleDegrees * Math.PI) / 180;

  // Calculate knockback vector
  const kx = Math.cos(angleRad) * clampedKB;
  const ky = -Math.sin(angleRad) * clampedKB;

  return { x: kx, y: ky };
}

// ─── Platform Collision ──────────────────────────────────────────────

export function checkFighterPlatformCollision(
  fighter: FighterState,
  platforms: Array<{ x: number; y: number; width: number; height: number; isPassThrough: boolean }>
): void {
  const { position, velocity } = fighter;
  const stats = CHARACTER_STATS[fighter.characterId];
  if (!stats) return;

  const fighterBottom = position.y + stats.height / 2;
  const fighterTop = position.y - stats.height / 2;
  const fighterLeft = position.x - stats.width / 2;
  const fighterRight = position.x + stats.width / 2;

  let onGround = false;

  for (const plat of platforms) {
    const platTop = plat.y - plat.height / 2;
    const platBottom = plat.y + plat.height / 2;
    const platLeft = plat.x - plat.width / 2;
    const platRight = plat.x + plat.width / 2;

    // Check horizontal overlap
    const overlapX = fighterLeft < platRight && fighterRight > platLeft;
    if (!overlapX) continue;

    // Check vertical collision
    const wasAbove = position.y - velocity.y - stats.height / 2 <= platTop;

    if (plat.isPassThrough) {
      // Pass-through platform: only land from above, not from below
      if (
        wasAbove &&
        fighterBottom >= platTop &&
        fighterTop < platTop &&
        velocity.y >= 0
      ) {
        position.y = platTop - stats.height / 2;
        velocity.y = 0;
        onGround = true;
        break;
      }
    } else {
      // Solid platform: check all sides
      if (
        fighterBottom >= platTop &&
        fighterTop <= platBottom
      ) {
        // Landing from above
        if (velocity.y >= 0 && wasAbove) {
          position.y = platTop - stats.height / 2;
          velocity.y = 0;
          onGround = true;
          break;
        }
        // Hitting from below
        if (velocity.y < 0 && fighterTop < platBottom) {
          position.y = platBottom + stats.height / 2;
          velocity.y = 0;
          break;
        }
      }
    }
  }

  // Coyote time: don't flip isOnGround to false until 3 consecutive
  // frames of no-platform, preventing edge-case drops from consuming
  // double jump or interrupting attacks on a single missed tick.
  const COYOTE_FRAMES = 3;
  if (onGround) {
    fighter.isOnGround = true;
    fighter.coyoteTimer = 0;
    fighter.jumpCount = 0;
    fighter.canDoubleJump = fighter.maxJumpCount > 1;
    fighter.isFastFalling = false;
    fighter.ledgeGrabsLeft = 2;
  } else if (fighter.isOnGround) {
    // Just left a platform — start coyote countdown
    fighter.coyoteTimer++;
    if (fighter.coyoteTimer >= COYOTE_FRAMES) {
      fighter.isOnGround = false;
      fighter.coyoteTimer = 0;
    }
    // During coyote frames: still "on ground" for gameplay purposes
  }
}

// ─── AABB Collision ──────────────────────────────────────────────────

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  const aHalfW = a.width / 2;
  const aHalfH = a.height / 2;
  const bHalfW = b.width / 2;
  const bHalfH = b.height / 2;

  return (
    a.x - aHalfW < b.x + bHalfW &&
    a.x + aHalfW > b.x - bHalfW &&
    a.y - aHalfH < b.y + bHalfH &&
    a.y + aHalfH > b.y - bHalfH
  );
}

// ─── Hitbox vs Hurtbox ───────────────────────────────────────────────

export function checkHitboxCollision(
  attacker: FighterState,
  defender: FighterState
): { hit: boolean; hitboxIndex: number } {
  for (let i = 0; i < attacker.hitboxes.length; i++) {
    const hb = attacker.hitboxes[i];
    // Only active hitboxes (skip startup and expired)
    if (hb.currentFrame <= 0) continue; // still in startup
    if (hb.currentFrame > hb.activeFrames) continue; // expired

    const hitboxAABB: AABB = {
      x: hb.x + attacker.position.x,
      y: hb.y + attacker.position.y,
      width: hb.width,
      height: hb.height,
    };

    const hurtboxAABB: AABB = {
      x: defender.position.x,
      y: defender.position.y,
      width: defender.hurtbox.width,
      height: defender.hurtbox.height,
    };

    if (aabbOverlap(hitboxAABB, hurtboxAABB)) {
      return { hit: true, hitboxIndex: i };
    }
  }
  return { hit: false, hitboxIndex: -1 };
}

// ─── Camera Update ───────────────────────────────────────────────────

export function updateCamera(
  camera: { x: number; y: number; zoom: number; shakeX: number; shakeY: number; shakeIntensity: number; shakeDuration: number },
  fighter1Pos: Vector2,
  fighter2Pos: Vector2,
  _canvasWidth: number,
  _canvasHeight: number,
  stage: StageData
): void {
  // Target: midpoint between fighters
  const midX = (fighter1Pos.x + fighter2Pos.x) / 2;
  const midY = (fighter1Pos.y + fighter2Pos.y) / 2 - 30; // slightly above

  // Zoom based on fighter separation (scaled for 4x larger stages)
  const separation = Math.abs(fighter1Pos.x - fighter2Pos.x) + Math.abs(fighter1Pos.y - fighter2Pos.y) * 0.5;
  let targetZoom = 1.0 - separation * 0.0005;
  targetZoom = Math.max(0.3, Math.min(1.3, targetZoom));

  // Smooth lerp
  camera.x += (midX - camera.x) * 0.08;
  camera.y += (midY - camera.y) * 0.08;
  camera.zoom += (targetZoom - camera.zoom) * 0.05;

  // Bounds - keep stage somewhat visible (scaled for 4x larger stages)
  const platCenterX = stage.platforms[0]?.x ?? 0;
  const platCenterY = stage.platforms[0]?.y ?? 0;
  const maxOffset = 800;
  camera.x = Math.max(platCenterX - maxOffset, Math.min(platCenterX + maxOffset, camera.x));
  camera.y = Math.max(platCenterY - maxOffset - 200, Math.min(platCenterY + 200, camera.y));

  // Screen shake
  if (camera.shakeDuration > 0) {
    camera.shakeDuration--;
    const intensity = camera.shakeIntensity * (camera.shakeDuration / 10);
    camera.shakeX = (Math.random() - 0.5) * intensity * 2;
    camera.shakeY = (Math.random() - 0.5) * intensity * 2;
  } else {
    camera.shakeX = 0;
    camera.shakeY = 0;
  }
}
