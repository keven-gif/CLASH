import type { StageData, Platform } from './types';

// ─── Stage Definitions ───────────────────────────────────────────────

const BATTLEFIELD_PLATFORMS: Platform[] = [
  // Main platform (center, wide)
  { x: 0, y: 320, width: 880, height: 80, isPassThrough: false },
  // Left upper platform
  { x: -360, y: 80, width: 320, height: 56, isPassThrough: true },
  // Right upper platform
  { x: 360, y: 80, width: 320, height: 56, isPassThrough: true },
  // Top center platform
  { x: 0, y: -160, width: 240, height: 56, isPassThrough: true },
];

const FINAL_DESTINATION_PLATFORMS: Platform[] = [
  // Single main platform
  { x: 0, y: 320, width: 960, height: 80, isPassThrough: false },
];

const FACTORY_FLOOR_PLATFORMS: Platform[] = [
  // Main platform
  { x: 0, y: 320, width: 720, height: 80, isPassThrough: false },
  // Moving platform (left side, moves up/down)
  {
    x: -400,
    y: 40,
    width: 360,
    height: 56,
    isPassThrough: true,
    velocity: { x: 0, y: 3.2 },
    minX: -400,
    maxX: -400,
  },
  // Moving platform (right side, moves horizontally)
  {
    x: 400,
    y: 120,
    width: 360,
    height: 56,
    isPassThrough: true,
    velocity: { x: 2.4, y: 0 },
    minX: 240,
    maxX: 560,
  },
  // Small platform center-high
  { x: 0, y: -80, width: 280, height: 56, isPassThrough: true },
];

const NEO_ARCADIA_PLATFORMS: Platform[] = [
  // Main lower platform (narrower — punishes edge play)
  { x: 0, y: 320, width: 640, height: 80, isPassThrough: false },
  // Left energy pillar top
  { x: -380, y: 60, width: 200, height: 56, isPassThrough: true },
  // Right energy pillar top
  { x: 380, y: 60, width: 200, height: 56, isPassThrough: true },
  // Center rising platform (moves up/down like energy lifts in Neo Arcadia)
  {
    x: 0,
    y: 140,
    width: 280,
    height: 56,
    isPassThrough: true,
    velocity: { x: 0, y: 2.8 },
    minX: 0,
    maxX: 0,
  },
  // High center apex platform
  { x: 0, y: -200, width: 200, height: 56, isPassThrough: true },
];

// ─── Spawn Points ────────────────────────────────────────────────────

const BATTLEFIELD_SPAWNS = [
  { x: -240, y: 200 },
  { x: 240, y: 200 },
];

const FINAL_DESTINATION_SPAWNS = [
  { x: -280, y: 200 },
  { x: 280, y: 200 },
];

const FACTORY_FLOOR_SPAWNS = [
  { x: -200, y: 200 },
  { x: 200, y: 200 },
];

const NEO_ARCADIA_SPAWNS = [
  { x: -200, y: 200 },
  { x: 200, y: 200 },
];

// ─── Blast Zones ─────────────────────────────────────────────────────
// Relative to center (0, 0)
// These are in game units, not pixels

const DEFAULT_BLAST_ZONES = {
  top: -1000,
  bottom: 1000,
  left: -1280,
  right: 1280,
};

const SUDDEN_DEATH_BLAST_ZONES = {
  top: -700,
  bottom: 700,
  left: -896,
  right: 896,
};

// ─── Stage Registry ──────────────────────────────────────────────────

const STAGES: Record<string, StageData> = {
  battlefield: {
    id: 'battlefield',
    platforms: BATTLEFIELD_PLATFORMS,
    blastZones: { ...DEFAULT_BLAST_ZONES },
    spawnPoints: BATTLEFIELD_SPAWNS,
  },
  final: {
    id: 'final',
    platforms: FINAL_DESTINATION_PLATFORMS,
    blastZones: { ...DEFAULT_BLAST_ZONES },
    spawnPoints: FINAL_DESTINATION_SPAWNS,
  },
  hazard: {
    id: 'hazard',
    platforms: FACTORY_FLOOR_PLATFORMS,
    blastZones: { ...DEFAULT_BLAST_ZONES },
    spawnPoints: FACTORY_FLOOR_SPAWNS,
  },
  'neo-arcadia': {
    id: 'neo-arcadia',
    platforms: NEO_ARCADIA_PLATFORMS,
    blastZones: { ...DEFAULT_BLAST_ZONES },
    spawnPoints: NEO_ARCADIA_SPAWNS,
  },
};

// ─── API ─────────────────────────────────────────────────────────────

export function getStageData(stageId: string): StageData {
  return STAGES[stageId] ?? STAGES['battlefield'];
}

export function getPlatforms(stageId: string): Platform[] {
  const stage = getStageData(stageId);
  // Deep copy so we can mutate positions for moving platforms
  return stage.platforms.map((p) => ({ ...p, velocity: p.velocity ? { ...p.velocity } : undefined }));
}

export function getSpawnPoints(stageId: string): Array<{ x: number; y: number }> {
  return getStageData(stageId).spawnPoints;
}

export function getBlastZones(stageId: string) {
  return { ...getStageData(stageId).blastZones };
}

// ─── Update Moving Platforms ─────────────────────────────────────────

export function updateMovingPlatforms(platforms: Platform[]): void {
  for (const plat of platforms) {
    if (!plat.velocity) continue;

    plat.x += plat.velocity.x;
    plat.y += plat.velocity.y;

    // Horizontal bounce
    if (plat.minX !== undefined && plat.maxX !== undefined) {
      if (plat.x <= plat.minX || plat.x >= plat.maxX) {
        plat.velocity.x *= -1;
        plat.x = Math.max(plat.minX, Math.min(plat.maxX, plat.x));
      }
    }
  }
}

// ─── Get Stage Background Color ──────────────────────────────────────

export function getStageBackgroundColor(stageId: string): string {
  switch (stageId) {
    case 'battlefield':
      return '#1a1a2e';
    case 'final':
      return '#0a0a15';
    case 'hazard':
      return '#1e1010';
    case 'neo-arcadia':
      return '#0d0010';
    default:
      return '#0a0a0f';
  }
}

// ─── Sudden Death ────────────────────────────────────────────────────

export function shrinkBlastZonesForSuddenDeath(stage: StageData): void {
  stage.blastZones = { ...SUDDEN_DEATH_BLAST_ZONES };
}
