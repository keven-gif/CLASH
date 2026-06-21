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
  loadCharacterImage('zero', `${base}characters/zero.svg`);
  loadCharacterImage('gunner-sheet', `${base}characters/blaze-sheet-clean.png?v=2`);
  loadCharacterImage('swordsman-sheet', `${base}characters/ace-sheet-clean.png?v=2`);
  loadCharacterImage('assassin-sheet', `${base}characters/shadow-sheet-clean.png?v=2`);
  loadCharacterImage('ronin-sheet', `${base}characters/kaze-sheet-clean.png?v=2`);
  loadCharacterImage('alchemist-sheet', `${base}characters/mix-sheet-clean.png?v=2`);
}

// ─── Sprite Sheet Config ─────────────────────────────────────────────
// Clean sheets: 952×549, 8 cols × 3 rows → each frame 119×183 px
// Row 0 = walk/idle, Row 1 = attack/hit, Row 2 = jump/fall

const SPRITE_SHEET_COLS = 8;
const SPRITE_FRAME_W = 119;
const SPRITE_FRAME_H = 183;
const SPRITE_FRAME_RATE = 5; // game-frames per sprite-frame (~12 fps)

// Characters that use sprite sheets: maps characterId → image cache key
const SPRITE_SHEET_CHARS: Record<string, string> = {
  gunner: 'gunner-sheet',
  swordsman: 'swordsman-sheet',
  assassin: 'assassin-sheet',
  ronin: 'ronin-sheet',
  alchemist: 'alchemist-sheet',
};

function getSpriteRow(state: string): number {
  if (
    state === 'jump' || state === 'fall' ||
    state === 'doubleJump' || state === 'dodgeAir'
  ) return 2;
  if (
    state.startsWith('attack') || state === 'special' ||
    state === 'hurt' || state === 'hitstun' ||
    state === 'launched' || state === 'knockback'
  ) return 1;
  return 0;
}

function drawSpriteSheet(
  ctx: CanvasRenderingContext2D,
  cacheKey: string,
  x: number, y: number,
  w: number, h: number,
  direction: number,
  state: string,
  gameFrame: number
): boolean {
  const sheet = CHARACTER_IMAGES[cacheKey];
  if (!sheet || !sheet.complete || sheet.naturalWidth === 0) return false;

  const row = getSpriteRow(state);
  const col = Math.floor(gameFrame / SPRITE_FRAME_RATE) % SPRITE_SHEET_COLS;
  const sx = col * SPRITE_FRAME_W;
  const sy = row * SPRITE_FRAME_H;

  ctx.save();
  if (direction === -1) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }

  ctx.drawImage(
    sheet,
    sx, sy, SPRITE_FRAME_W, SPRITE_FRAME_H,
    x - w / 2, y - h / 2, w, h
  );

  ctx.restore();
  return true;
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
  loadStageImage('neo-arcadia', `${base}stages/stage-neo-arcadia.svg`);
}

// ─── Character Design Tokens ─────────────────────────────────────────

interface CharDesign { skin: string; body: string; accent: string; weapon: string; }
const CHAR_DESIGN: Record<string, CharDesign> = {
  assassin: { skin: '#c8856a', body: '#1a1a1a', accent: '#cc1a2e', weapon: '#ff3344' },
  swordsman: { skin: '#d4a574', body: '#0d3d3d', accent: '#00e5d4', weapon: '#00fff0' },
  ronin:     { skin: '#c8a882', body: '#1a2035', accent: '#4da6ff', weapon: '#88ccff' },
  alchemist: { skin: '#b5c77a', body: '#1a3a1a', accent: '#39ff14', weapon: '#88ff44' },
  gunner:    { skin: '#c8906a', body: '#3d2b1f', accent: '#ff8c00', weapon: '#ffcc44' },
  zero:      { skin: '#ffddc8', body: '#cc1122', accent: '#ff2244', weapon: '#00ffb0' },
};

// ─── Character Silhouette Drawing ────────────────────────────────────

function drawCharacterSilhouette(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  x: number, y: number,
  width: number, height: number,
  direction: number,
  state: string,
  gameFrame: number
): void {
  // Blaze uses the sprite sheet instead of canvas shapes
  const sheetKey = SPRITE_SHEET_CHARS[characterId];
  if (sheetKey) {
    const drawn = drawSpriteSheet(ctx, sheetKey, x, y, width, height, direction, state, gameFrame);
    if (drawn) return;
    // Sheet not loaded yet — fall through to canvas silhouette as placeholder
  }

  const d = CHAR_DESIGN[characterId] ?? { skin: '#c8a882', body: '#333', accent: '#aaa', weapon: '#fff' };

  // Animation params derived from state
  const isAir = state === 'jump' || state === 'fall' || state === 'doubleJump';
  const isAttack = state.startsWith('attack') || state === 'special';
  const isHit = state === 'hurt' || state === 'knockback';
  const legSwing = isAir ? 0.3 : isAttack ? 0.2 : 0;
  const armSwing = isAttack ? 0.5 : isHit ? -0.3 : 0.15;
  const bodyLean = isAttack ? 0.12 : isHit ? -0.1 : 0;

  // Body proportions — all relative to bounding box center (x, y)
  const top = y - height / 2;
  const headR = width * 0.19;
  const headCY = top + headR * 1.1;
  const neckY = headCY + headR * 0.85;
  const torsoH = height * 0.28;
  const torsoW = width * 0.32;
  const torsoX = x + bodyLean * width - torsoW / 2;
  const torsoY = neckY;
  const hipY = torsoY + torsoH;
  const legW = width * 0.12;
  const legH = height * 0.26;
  const bootH = height * 0.08;
  const armW = width * 0.1;
  const armH = height * 0.22;

  ctx.save();

  // ── Legs ─────────────────────────────────────────────────────────
  const lLegAngle = legSwing;
  const rLegAngle = -legSwing;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const angle = i === 0 ? lLegAngle : rLegAngle;
    const legX = x + side * (torsoW * 0.22);
    ctx.save();
    ctx.translate(legX, hipY);
    ctx.rotate(angle);
    ctx.fillStyle = d.body;
    ctx.fillRect(-legW / 2, 0, legW, legH - bootH);
    ctx.fillStyle = d.accent;
    ctx.fillRect(-legW / 2, legH - bootH, legW * 1.2, bootH);
    ctx.restore();
  }

  // ── Torso ─────────────────────────────────────────────────────────
  ctx.fillStyle = d.body;
  roundRect(ctx, torsoX, torsoY, torsoW, torsoH, width * 0.04);
  ctx.fill();
  // Chest stripe
  ctx.fillStyle = d.accent;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(torsoX + torsoW * 0.3, torsoY + torsoH * 0.1, torsoW * 0.12, torsoH * 0.7);
  ctx.globalAlpha = 1;

  // ── Arms ─────────────────────────────────────────────────────────
  const lArmAngle = -armSwing;
  const rArmAngle = armSwing;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const angle = i === 0 ? lArmAngle : rArmAngle;
    const armX = x + side * (torsoW * 0.5 + armW * 0.3);
    ctx.save();
    ctx.translate(armX, torsoY + armW);
    ctx.rotate(angle);
    ctx.fillStyle = d.body;
    ctx.fillRect(-armW / 2, 0, armW, armH - armW);
    // Glove
    ctx.fillStyle = d.accent;
    ctx.beginPath();
    ctx.arc(0, armH - armW, armW * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Head ─────────────────────────────────────────────────────────
  ctx.fillStyle = d.skin;
  ctx.beginPath();
  ctx.arc(x + bodyLean * width, headCY, headR, 0, Math.PI * 2);
  ctx.fill();

  // ── Character-specific head gear & weapon ────────────────────────
  const hx = x + bodyLean * width;
  const hy = headCY;
  const sc = height / 100; // scale factor

  ctx.save();
  switch (characterId) {
    case 'assassin': {
      // Ninja mask (lower half of head)
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(hx, hy, headR, 0.1, Math.PI - 0.1);
      ctx.fill();
      // Glowing red eyes
      ctx.shadowColor = d.weapon;
      ctx.shadowBlur = 8 * sc;
      ctx.fillStyle = d.weapon;
      ctx.beginPath(); ctx.arc(hx - headR * 0.38, hy - headR * 0.1, 2.5 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + headR * 0.38, hy - headR * 0.1, 2.5 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Twin claw blades (right arm extended)
      const clawBaseX = x + torsoW * 0.55;
      const clawBaseY = torsoY + armH * 0.7;
      ctx.strokeStyle = d.weapon;
      ctx.lineWidth = 2.5 * sc;
      ctx.shadowColor = d.weapon;
      ctx.shadowBlur = isAttack ? 12 * sc : 4 * sc;
      for (let c = -1; c <= 1; c++) {
        ctx.beginPath();
        ctx.moveTo(clawBaseX, clawBaseY + c * 5 * sc);
        ctx.lineTo(clawBaseX + (isAttack ? 28 : 18) * sc, clawBaseY + c * 5 * sc - 4 * sc);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case 'swordsman': {
      // Gold circlet
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3 * sc;
      ctx.beginPath();
      ctx.arc(hx, hy, headR + 2 * sc, Math.PI + 0.4, -0.4);
      ctx.stroke();
      // Gem on circlet
      ctx.fillStyle = d.accent;
      ctx.shadowColor = d.accent;
      ctx.shadowBlur = 8 * sc;
      ctx.beginPath(); ctx.arc(hx, hy - headR - 1 * sc, 4 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Glowing straight sword
      const swX = x + torsoW * 0.6;
      const swY0 = torsoY - 8 * sc;
      const swY1 = hipY + 10 * sc;
      ctx.shadowColor = d.weapon;
      ctx.shadowBlur = isAttack ? 20 * sc : 8 * sc;
      ctx.strokeStyle = d.weapon;
      ctx.lineWidth = 4 * sc;
      ctx.beginPath(); ctx.moveTo(swX, swY0); ctx.lineTo(swX, swY1); ctx.stroke();
      // Guard
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3 * sc;
      ctx.beginPath(); ctx.moveTo(swX - 8 * sc, torsoY + torsoH * 0.3); ctx.lineTo(swX + 8 * sc, torsoY + torsoH * 0.3); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'ronin': {
      // Blue-stripe headband
      ctx.fillStyle = d.body;
      ctx.fillRect(hx - headR, hy - headR * 0.2, headR * 2, headR * 0.35);
      ctx.fillStyle = d.accent;
      ctx.fillRect(hx - headR, hy - headR * 0.08, headR * 2, headR * 0.12);
      // Headband tails
      ctx.fillStyle = d.body;
      ctx.fillRect(hx + headR * 0.5, hy, headR * 0.25, headR * 0.9);
      // Curved katana held diagonally
      const kx0 = x + torsoW * 0.6;
      const ky0 = torsoY + 4 * sc;
      ctx.strokeStyle = d.weapon;
      ctx.lineWidth = 3.5 * sc;
      ctx.shadowColor = d.weapon;
      ctx.shadowBlur = isAttack ? 18 * sc : 6 * sc;
      ctx.beginPath();
      ctx.moveTo(kx0, ky0);
      ctx.quadraticCurveTo(kx0 + 20 * sc, ky0 + 10 * sc, kx0 + 30 * sc, ky0 + 38 * sc);
      ctx.stroke();
      // Tsuba (guard)
      ctx.strokeStyle = '#c8a060';
      ctx.lineWidth = 5 * sc;
      ctx.beginPath(); ctx.moveTo(kx0 - 5 * sc, ky0 + 6 * sc); ctx.lineTo(kx0 + 9 * sc, ky0 + 6 * sc); ctx.stroke();
      ctx.shadowBlur = 0;
      break;
    }
    case 'alchemist': {
      // Round goggles
      ctx.strokeStyle = d.accent;
      ctx.lineWidth = 2.5 * sc;
      ctx.fillStyle = `${d.accent}33`;
      for (const ox of [-headR * 0.35, headR * 0.35]) {
        ctx.beginPath(); ctx.arc(hx + ox, hy - headR * 0.05, headR * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Bridge
      ctx.strokeStyle = d.accent;
      ctx.lineWidth = 2 * sc;
      ctx.beginPath(); ctx.moveTo(hx - headR * 0.07, hy - headR * 0.05); ctx.lineTo(hx + headR * 0.07, hy - headR * 0.05); ctx.stroke();
      // Glowing staff
      const stX = x + torsoW * 0.6;
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 5 * sc;
      ctx.beginPath(); ctx.moveTo(stX, torsoY - 6 * sc); ctx.lineTo(stX, hipY + 20 * sc); ctx.stroke();
      // Orb at top
      ctx.shadowColor = d.weapon;
      ctx.shadowBlur = isAttack ? 22 * sc : 10 * sc;
      ctx.fillStyle = d.weapon;
      ctx.beginPath(); ctx.arc(stX, torsoY - 12 * sc, 7 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'gunner': {
      // Tactical visor (band across upper face)
      ctx.fillStyle = d.body;
      ctx.fillRect(hx - headR, hy - headR * 0.4, headR * 2, headR * 0.45);
      ctx.fillStyle = d.accent;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(hx - headR + 2 * sc, hy - headR * 0.35, headR * 1.96, headR * 0.3);
      ctx.globalAlpha = 1;
      // Dual pistols
      const muzzleFlash = isAttack;
      for (let g = 0; g < 2; g++) {
        const gx = x + (g === 0 ? -torsoW * 0.55 : torsoW * 0.55);
        const gy = torsoY + armH * 0.65;
        const dir = g === 0 ? -1 : 1;
        ctx.fillStyle = '#555';
        ctx.fillRect(gx - 6 * sc * dir, gy - 4 * sc, 12 * sc, 7 * sc);
        // Barrel
        ctx.fillStyle = '#333';
        ctx.fillRect(gx + (g === 0 ? -16 : 8) * sc, gy - 2 * sc, 10 * sc, 4 * sc);
        // Muzzle flash
        if (muzzleFlash) {
          ctx.fillStyle = d.weapon;
          ctx.shadowColor = d.weapon;
          ctx.shadowBlur = 15 * sc;
          ctx.beginPath();
          const mx = gx + (g === 0 ? -20 : 22) * sc;
          ctx.arc(mx, gy, 5 * sc, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      break;
    }
    case 'zero': {
      // Long blonde hair ponytail flowing behind
      ctx.fillStyle = '#F0D020';
      ctx.beginPath();
      ctx.ellipse(hx - headR * 0.3 * direction, hy + headR * 0.5, headR * 0.25, headR * 1.4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Red helmet with cyan forehead gem
      ctx.fillStyle = d.accent;
      ctx.beginPath();
      ctx.arc(hx, hy, headR, Math.PI * 0.1, Math.PI * 0.9, true);
      ctx.fill();
      // Helmet gem
      ctx.fillStyle = '#00CCFF';
      ctx.shadowColor = '#00CCFF';
      ctx.shadowBlur = 10 * sc;
      ctx.beginPath(); ctx.ellipse(hx, hy - headR * 0.5, 4 * sc, 3 * sc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Chest core gem
      ctx.fillStyle = '#00CCFF';
      ctx.shadowColor = '#00CCFF';
      ctx.shadowBlur = isAttack ? 16 * sc : 8 * sc;
      ctx.beginPath(); ctx.arc(x, torsoY + torsoH * 0.35, 5 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // Z-SABER energy blade (right side, vertical/angled based on attack)
      const zsX = x + torsoW * 0.6 * direction;
      const zsY0 = torsoY - 30 * sc;
      const zsY1 = hipY + 12 * sc;
      ctx.strokeStyle = d.weapon;
      ctx.lineWidth = isAttack ? 5 * sc : 3.5 * sc;
      ctx.shadowColor = d.weapon;
      ctx.shadowBlur = isAttack ? 24 * sc : 12 * sc;
      ctx.lineCap = 'round';
      if (isAttack) {
        // Diagonal slash effect
        ctx.beginPath();
        ctx.moveTo(zsX - 14 * sc, torsoY);
        ctx.lineTo(zsX + 14 * sc, hipY + 8 * sc);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(zsX, zsY0);
        ctx.lineTo(zsX, zsY1);
        ctx.stroke();
      }
      // Blade tip glow
      const tipY = isAttack ? torsoY - 4 * sc : zsY0;
      ctx.fillStyle = d.weapon;
      ctx.beginPath(); ctx.arc(zsX, tipY, 4 * sc, 0, Math.PI * 2); ctx.fill();
      // Z-Buster cannon (left arm nozzle)
      const zbX = x - torsoW * 0.55 * direction;
      const zbY = torsoY + armH * 0.75;
      ctx.shadowBlur = isAttack ? 18 * sc : 6 * sc;
      ctx.shadowColor = '#FF4466';
      ctx.fillStyle = '#880010';
      ctx.beginPath(); ctx.arc(zbX, zbY, 7 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FF2244';
      if (isAttack) {
        ctx.fillStyle = '#FF6688';
        ctx.beginPath(); ctx.arc(zbX - direction * 16 * sc, zbY, 5 * sc, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      break;
    }
  }
  ctx.restore();

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

  // ── Character Silhouette ───────────────────────────────────────────
  // Direction flipping is handled inside drawCharacterSilhouette / drawSpriteSheet
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
      fighter.state,
      fighter.frame
    );

    // Damage tint overlay
    if (fighter.damage > 50) {
      const tintAlpha = Math.min(0.3, (fighter.damage - 50) / 500);
      ctx.fillStyle = `rgba(232, 29, 45, ${tintAlpha})`;
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 6 * scale);
      ctx.fill();
    }
  }

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