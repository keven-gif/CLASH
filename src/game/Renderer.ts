import type { FighterState, StageData, Camera, Particle, FloatingText, Platform } from './types';
import { CHARACTER_STATS } from './types';
import { getCharacterAccentColor } from './Fighter';

// ─── Character Image Cache ───────────────────────────────────────────
// Maps characterId → loaded HTMLImageElement for canvas rendering.

const CHARACTER_IMAGES: Record<string, HTMLImageElement> = {};

function loadCharacterImage(characterId: string, src: string): HTMLImageElement {
  if (CHARACTER_IMAGES[characterId]) return CHARACTER_IMAGES[characterId];
  const img = new Image();
  img.src = src;
  CHARACTER_IMAGES[characterId] = img;
  return img;
}

export function preloadCharacterImages(): void {
  const base = import.meta.env.BASE_URL;
  loadCharacterImage('assassin', `${base}characters/assassin.png?v=2`);
  loadCharacterImage('swordsman', `${base}characters/swordsman.png?v=2`);
  loadCharacterImage('ronin', `${base}characters/ronin.jpg?v=2`);
  loadCharacterImage('alchemist', `${base}characters/alchemist.png?v=2`);
  loadCharacterImage('gunner', `${base}characters/gunner.png?v=2`);
}

// ─── Stage Background Image Cache ────────────────────────────────────

const STAGE_IMAGES: Record<string, HTMLImageElement> = {};

function loadStageImage(stageId: string, src: string): HTMLImageElement {
  if (STAGE_IMAGES[stageId]) return STAGE_IMAGES[stageId];
  const img = new Image();
  img.src = src;
  STAGE_IMAGES[stageId] = img;
  return img;
}

export function preloadStageImages(): void {
  const base = import.meta.env.BASE_URL;
  loadStageImage('battlefield', `${base}stages/stage-battlefield.jpg?v=2`);
  loadStageImage('final', `${base}stages/stage-final-destination.jpg?v=2`);
  loadStageImage('hazard', `${base}stages/stage-hazard.jpg?v=2`);
}

// ─── Character Silhouette Colors ─────────────────────────────────────

const CHARACTER_COLORS: Record<string, { primary: string; secondary: string }> = {
  assassin: { primary: '#2d2d5e', secondary: '#7c3aed' },
  swordsman: { primary: '#7f1d1d', secondary: '#dc2626' },
  ronin:     { primary: '#1c1c1c', secondary: '#6b7280' },
  alchemist: { primary: '#14532d', secondary: '#22c55e' },
  gunner:    { primary: '#1e3a5f', secondary: '#3b82f6' },
};

// ─── Character Silhouette Drawing ────────────────────────────────────

function drawCharacterSilhouette(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  x: number, y: number,
  width: number, height: number,
  direction: number,
  _state: string
): void {
  const colors = CHARACTER_COLORS[characterId] ?? { primary: '#888', secondary: '#555' };
  ctx.save();
  if (direction === -1) {
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.translate(-x, -y);
  }

  const cx = x;
  const cy = y;

  // Head
  ctx.fillStyle = colors.primary;
  ctx.beginPath();
  ctx.arc(cx, cy - height * 0.35, width * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(cx - width * 0.14, cy - height * 0.28, width * 0.28, height * 0.3);

  // Legs
  ctx.fillStyle = colors.primary;
  ctx.fillRect(cx - width * 0.12, cy + 0.02 * height, width * 0.1, height * 0.25);
  ctx.fillRect(cx + 0.02 * width, cy + 0.02 * height, width * 0.1, height * 0.25);

  // Arms
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(cx - width * 0.24, cy - height * 0.25, width * 0.1, height * 0.22);
  ctx.fillRect(cx + width * 0.14, cy - height * 0.25, width * 0.1, height * 0.22);

  // Weapon
  const scale = height / 100;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  switch (characterId) {
    case 'assassin':
      ctx.arc(cx + width * 0.3, cy - height * 0.1, width * 0.2, -0.8, 0.8);
      break;
    case 'swordsman':
      ctx.moveTo(cx + width * 0.24, cy - height * 0.28);
      ctx.lineTo(cx + width * 0.38, cy - height * 0.08);
      break;
    case 'ronin':
      ctx.moveTo(cx + width * 0.24, cy - height * 0.32);
      ctx.lineTo(cx + width * 0.44, cy + height * 0.02);
      break;
    case 'alchemist':
      ctx.moveTo(cx + width * 0.24, cy - height * 0.22);
      ctx.lineTo(cx + width * 0.36, cy - height * 0.14);
      ctx.arc(cx + width * 0.38, cy - height * 0.1, width * 0.07, 0, Math.PI * 2);
      break;
    case 'gunner':
      ctx.moveTo(cx + width * 0.24, cy - height * 0.18);
      ctx.lineTo(cx + width * 0.44, cy - height * 0.18);
      ctx.moveTo(cx + width * 0.34, cy - height * 0.18);
      ctx.lineTo(cx + width * 0.34, cy - height * 0.10);
      break;
  }
  ctx.stroke();

  ctx.restore();
}

// ─── Render Stage ────────────────────────────────────────────────────

export function renderStage(
  ctx: CanvasRenderingContext2D,
  stage: StageData,
  camera: Camera,
  canvasWidth: number,
  canvasHeight: number
): { offsetX: number; offsetY: number; scale: number } {
  const scale = camera.zoom;
  const offsetX = -camera.x * scale + canvasWidth / 2 + camera.shakeX;
  const offsetY = -camera.y * scale + canvasHeight / 2 + camera.shakeY;

  ctx.save();

  // Stage background image (drawn full-canvas, covering everything)
  const stageImg = STAGE_IMAGES[stage.id];
  if (stageImg && stageImg.complete && stageImg.naturalWidth > 0) {
    // Draw the stage image covering the full canvas
    // Use cover-fit: scale to fill while preserving aspect ratio
    const imgRatio = stageImg.naturalWidth / stageImg.naturalHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawW: number, drawH: number, drawX: number, drawY: number;
    if (imgRatio > canvasRatio) {
      // Image is wider than canvas — fit to height, crop sides
      drawH = canvasHeight;
      drawW = canvasHeight * imgRatio;
      drawX = (canvasWidth - drawW) / 2;
      drawY = 0;
    } else {
      // Image is taller than canvas — fit to width, crop top/bottom
      drawW = canvasWidth;
      drawH = canvasWidth / imgRatio;
      drawX = 0;
      drawY = (canvasHeight - drawH) / 2;
    }
    ctx.drawImage(stageImg, drawX, drawY, drawW, drawH);
  } else {
    // Fallback gradient while image loads
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    switch (stage.id) {
      case 'battlefield':
        bgGrad.addColorStop(0, '#0d0d1a');
        bgGrad.addColorStop(0.5, '#1a1a2e');
        bgGrad.addColorStop(1, '#0d0d1a');
        break;
      case 'final':
        bgGrad.addColorStop(0, '#050510');
        bgGrad.addColorStop(0.5, '#0a0a1a');
        bgGrad.addColorStop(1, '#050510');
        break;
      case 'hazard':
        bgGrad.addColorStop(0, '#1a0f0f');
        bgGrad.addColorStop(0.5, '#1e1010');
        bgGrad.addColorStop(1, '#140a0a');
        break;
      default:
        bgGrad.addColorStop(0, '#050507');
        bgGrad.addColorStop(1, '#0A0A0F');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Stars overlay for final destination (subtle, on top of background)
  if (stage.id === 'final') {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 80; i++) {
      const sx = ((i * 137.5 + 50) % canvasWidth);
      const sy = ((i * 89.7 + 100) % canvasHeight);
      const size = (i % 3 === 0) ? 1.5 : 0.8;
      ctx.globalAlpha = 0.3 + (i % 5) * 0.1;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Blast zone lines
  ctx.strokeStyle = '#E81D2D33';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  const bz = stage.blastZones;
  ctx.strokeRect(
    bz.left * scale + offsetX,
    bz.top * scale + offsetY,
    (bz.right - bz.left) * scale,
    (bz.bottom - bz.top) * scale
  );
  ctx.setLineDash([]);

  ctx.restore();

  return { offsetX, offsetY, scale };
}

// ─── Render Platforms ────────────────────────────────────────────────

export function renderPlatforms(
  ctx: CanvasRenderingContext2D,
  platforms: Platform[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  for (const plat of platforms) {
    const x = (plat.x - plat.width / 2) * scale + offsetX;
    const y = (plat.y - plat.height / 2) * scale + offsetY;
    const w = plat.width * scale;
    const h = plat.height * scale;

    // Platform body
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#1E1E2Acc');
    grad.addColorStop(1, '#111118cc');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Cyan edge glow
    ctx.strokeStyle = '#00E5D440';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Top highlight
    ctx.fillStyle = '#00E5D420';
    ctx.fillRect(x, y, w, 2);

    // Hazard indicator for moving platforms
    if (plat.velocity) {
      ctx.fillStyle = '#FFB80030';
      ctx.fillRect(x, y + h - 3, w, 3);
    }
  }
}

// ─── Render Fighter ──────────────────────────────────────────────────

export function renderFighter(
  ctx: CanvasRenderingContext2D,
  fighter: FighterState,
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  if (fighter.isDead && fighter.state === 'dead') return;

  const stats = CHARACTER_STATS[fighter.characterId];
  if (!stats) return;

  const accent = getCharacterAccentColor(fighter.characterId);

  const x = fighter.position.x * scale + offsetX;
  const y = fighter.position.y * scale + offsetY;
  const w = stats.width * scale;
  const h = stats.height * scale;

  // Invincibility blinking
  if (fighter.invincibleFrames > 0) {
    const blinkCycle = Math.floor(fighter.invincibleFrames / 6) % 2;
    if (blinkCycle === 0) {
      ctx.globalAlpha = 0.3;
    }
  }

  // Drop shadow for depth
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + h / 2 + 4 * scale, w * 0.4, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Trail ──────────────────────────────────────────────────────────
  if (fighter.trail.length > 1) {
    for (let i = fighter.trail.length - 1; i > 0; i--) {
      const t = fighter.trail[i];
      const alpha = 0.06 * (1 - i / fighter.trail.length);
      ctx.globalAlpha = alpha * (ctx.globalAlpha < 1 ? ctx.globalAlpha : 1);
      ctx.fillStyle = accent;
      ctx.fillRect(
        (t.x - stats.width / 2) * scale + offsetX,
        (t.y - stats.height / 2) * scale + offsetY,
        w,
        h
      );
    }
    ctx.globalAlpha = fighter.invincibleFrames > 0 && Math.floor(fighter.invincibleFrames / 6) % 2 === 0 ? 0.3 : 1;
  }

  ctx.save();

  // Flip based on direction
  if (fighter.direction === -1) {
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.translate(-x, -y);
  }

  // ── Character Silhouette ───────────────────────────────────────────
  if (fighter.hitFlash > 0) {
    // Hit flash: draw white rectangle
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 6 * scale);
    ctx.fill();
  } else {
    drawCharacterSilhouette(
      ctx,
      fighter.characterId,
      x, y,
      w, h,
      fighter.direction,
      fighter.state
    );

    // Damage tint overlay
    if (fighter.damage > 50) {
      const tintAlpha = Math.min(0.3, (fighter.damage - 50) / 500);
      ctx.fillStyle = `rgba(232, 29, 45, ${tintAlpha})`;
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 6 * scale);
      ctx.fill();
    }
  }

  // White border outline for visibility against any background
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2 * scale;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 6 * scale);
  ctx.stroke();

  ctx.restore();

  // Damage % above fighter head
  if (fighter.damage > 0) {
    const dmgText = `${Math.round(fighter.damage)}%`;
    ctx.font = `bold ${14 * scale}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = fighter.damage > 100 ? '#FF4444' : fighter.damage > 50 ? '#FFB800' : '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3 * scale;
    ctx.strokeText(dmgText, x, y - h / 2 - 8 * scale);
    ctx.fillText(dmgText, x, y - h / 2 - 8 * scale);
  }

  // ── Shield Bubble ──────────────────────────────────────────────────
  if (fighter.shieldActive) {
    const shieldRadius = (45 + stats.height / 2) * scale;
    const shieldAlpha = Math.max(0.15, fighter.shieldHealth / 150);

    ctx.save();
    ctx.strokeStyle = `rgba(77, 166, 255, ${shieldAlpha + 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = `rgba(77, 166, 255, ${shieldAlpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, shieldRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Shield pulsing effect
    ctx.strokeStyle = `rgba(77, 166, 255, ${shieldAlpha * 0.15})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, shieldRadius * 1.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ── Hitboxes (debug/flash) ─────────────────────────────────────────
  for (const hb of fighter.hitboxes) {
    if (hb.currentFrame < 0 || hb.currentFrame > hb.activeFrames) continue;
    const hbx = (fighter.position.x + hb.x) * scale + offsetX;
    const hby = (fighter.position.y + hb.y) * scale + offsetY;
    ctx.save();
    ctx.fillStyle = `${accent}55`;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.fillRect(hbx - hb.width * scale / 2, hby - hb.height * scale / 2, hb.width * scale, hb.height * scale);
    ctx.strokeRect(hbx - hb.width * scale / 2, hby - hb.height * scale / 2, hb.width * scale, hb.height * scale);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}

// ─── Render Respawn Effects ──────────────────────────────────────────

export function renderRespawnEffects(
  ctx: CanvasRenderingContext2D,
  fighters: FighterState[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  for (const fighter of fighters) {
    // Draw respawn glow for newly respawned (invincible) fighters
    if (fighter.invincibleFrames > 0 && !fighter.isDead) {
      const x = fighter.spawnPoint.x * scale + offsetX;
      const y = fighter.spawnPoint.y * scale + offsetY;
      const glowRadius = 25 * scale;
      const alpha = Math.min(0.4, fighter.invincibleFrames / 200);

      // Ground glow circle
      const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      grad.addColorStop(0, `rgba(0, 229, 212, ${alpha})`);
      grad.addColorStop(1, 'rgba(0, 229, 212, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Blinking indicator
      const blink = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(0, 229, 212, ${alpha * blink})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, glowRadius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

// ─── Render Particles ────────────────────────────────────────────────

export function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;

    const px = p.x * scale + offsetX;
    const py = p.y * scale + offsetY;
    const size = p.size * scale;

    switch (p.type) {
      case 'hitSpark':
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'shieldBreak':
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((p.rotation ?? 0) * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(-size, -size * 0.5);
        ctx.lineTo(size, -size * 0.5);
        ctx.lineTo(0, size);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;

      case 'jumpDust':
      case 'landDust':
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'starKO':
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.globalAlpha = alpha;
        const twinkle = Math.sin(Date.now() * 0.02) * 0.5 + 0.5;
        ctx.beginPath();
        ctx.arc(px, py, size * (0.5 + twinkle * 0.5), 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'trail':
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.2;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.restore();
  }
}

// ─── Render Floating Text ────────────────────────────────────────────

export function renderFloatingText(
  ctx: CanvasRenderingContext2D,
  texts: FloatingText[],
  offsetX: number,
  offsetY: number,
  scale: number
): void {
  for (const ft of texts) {
    const alpha = Math.max(0, ft.life / ft.maxLife);
    const progress = 1 - ft.life / ft.maxLife;
    const yOffset = progress * -60 * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `900 ${ft.size * scale}px Orbitron, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.strokeStyle = '#0A0A0F';
    ctx.lineWidth = 3 * scale;
    ctx.strokeText(ft.text, ft.x * scale + offsetX, ft.y * scale + offsetY + yOffset);

    // Fill
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x * scale + offsetX, ft.y * scale + offsetY + yOffset);

    ctx.restore();
  }
}

// ─── Render Effects ──────────────────────────────────────────────────

export function renderScreenEffects(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  damageVignette: number
): void {
  if (damageVignette > 0) {
    const grad = ctx.createRadialGradient(
      canvasWidth / 2, canvasHeight / 2, canvasWidth * 0.25,
      canvasWidth / 2, canvasHeight / 2, canvasWidth * 0.75
    );
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(1, `rgba(232, 29, 45, ${damageVignette * 0.3})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
}

// ─── Render Countdown ────────────────────────────────────────────────

export function renderCountdown(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  countdown: number
): void {
  ctx.save();
  ctx.font = `900 140px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (countdown > 0) {
    const text = countdown.toString();
    const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.05;
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#F0F0F5';
    ctx.shadowColor = '#00E5D4';
    ctx.shadowBlur = 30;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else if (countdown === 0) {
    // GO!
    const pulse = 1 + Math.sin(Date.now() * 0.015) * 0.03;
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#00E5D4';
    ctx.shadowColor = '#00E5D4';
    ctx.shadowBlur = 40;
    ctx.fillText('GO!', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

// ─── Render KO Text ──────────────────────────────────────────────────

export function renderKOText(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  koTimer: number
): void {
  if (koTimer <= 0) return;

  ctx.save();
  const progress = Math.min(1, (120 - koTimer) / 30);
  const scale = 0.5 + progress * 0.5;

  ctx.font = `900 100px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = '#E81D2D';
  ctx.shadowBlur = 40;
  ctx.fillText('KO!', 0, 0);

  ctx.restore();
}

// ─── Render Game Over ────────────────────────────────────────────────

export function renderGameOver(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(5, 5, 7, 0.6)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.font = `900 80px Orbitron, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = '#00E5D4';
  ctx.shadowBlur = 30;
  ctx.fillText('GAME!', canvasWidth / 2, canvasHeight / 2);
  ctx.restore();
}

// ─── Helper: Rounded Rectangle ───────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Camera Setup ────────────────────────────────────────────────────

export function createDefaultCamera(): Camera {
  return {
    x: 0,
    y: 0,
    zoom: 1.0,
    targetX: 0,
    targetY: 0,
    targetZoom: 1.0,
    shakeX: 0,
    shakeY: 0,
    shakeIntensity: 0,
    shakeDuration: 0,
  };
}

export function triggerShake(camera: Camera, intensity: number, duration: number): void {
  camera.shakeIntensity = intensity;
  camera.shakeDuration = duration;
}