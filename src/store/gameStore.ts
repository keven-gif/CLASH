import { create } from 'zustand';
import type { Profile } from '@/supabase/client';
import type { RealtimeChannel } from '@/game/online/RealtimeChannel';

// ─── Types ───────────────────────────────────────────────────────────

export type GameScreen =
  | 'boot'
  | 'title'
  | 'characterSelect'
  | 'stageSelect'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'gameOver';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface Character {
  id: string;
  name: string;
  accentColor: string;
  archetype: string;
  stats: {
    power: number;
    speed: number;
    defense: number;
    special: number;
    weight: 'Light' | 'Medium' | 'Heavy';
  };
  image: string;
  description: string;
}

export interface Stage {
  id: string;
  name: string;
  image: string;
  description: string;
  hasHazards: boolean;
}

export interface GameSettings {
  sfxVolume: number;
  musicVolume: number;
  controls: 'standard' | 'custom';
  graphicsQuality: GraphicsQuality;
}

export interface MatchStats {
  totalDamageDealt: number;
  totalDamageTaken: number;
  stocksLost: number;
  stocksTaken: number;
  matchDuration: number;
}

export interface MatchResult {
  winner: 1 | 2;
  player1Stats: MatchStats;
  player2Stats: MatchStats;
}

// ─── Hardcoded Data ──────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL;

export const CHARACTERS: Character[] = [
  {
    id: 'assassin',
    name: 'Shadow',
    accentColor: '#E81D2D',
    archetype: 'Rushdown',
    stats: { power: 4, speed: 5, defense: 2, special: 4, weight: 'Light' },
    image: `${BASE}characters/assassin.png?v=2`,
    description: 'A swift assassin wielding a crimson energy blade.',
  },
  {
    id: 'swordsman',
    name: 'Ace',
    accentColor: '#00E5D4',
    archetype: 'All-Rounder',
    stats: { power: 3, speed: 4, defense: 4, special: 3, weight: 'Medium' },
    image: `${BASE}characters/swordsman.png?v=2`,
    description: 'A balanced adventurer with a cyan energy sword.',
  },
  {
    id: 'ronin',
    name: 'Kaze',
    accentColor: '#4DA6FF',
    archetype: 'Rushdown',
    stats: { power: 4, speed: 5, defense: 2, special: 3, weight: 'Light' },
    image: `${BASE}characters/ronin.jpg?v=2`,
    description: 'A lightning-fast ronin with an ice-blue blade.',
  },
  {
    id: 'alchemist',
    name: 'Mix',
    accentColor: '#39FF14',
    archetype: 'Zoner',
    stats: { power: 3, speed: 3, defense: 3, special: 5, weight: 'Medium' },
    image: `${BASE}characters/alchemist.png?v=2`,
    description: 'A tricky alchemist who bombards foes with potions.',
  },
  {
    id: 'gunner',
    name: 'Blaze',
    accentColor: '#FF8C00',
    archetype: 'Gunner',
    stats: { power: 4, speed: 3, defense: 3, special: 4, weight: 'Medium' },
    image: `${BASE}characters/gunner.png?v=2`,
    description: 'A sharpshooting dual-pistol marksman who dominates from mid-range.',
  },
  {
    id: 'zero',
    name: 'Zero',
    accentColor: '#FF2244',
    archetype: 'Rushdown',
    stats: { power: 5, speed: 5, defense: 2, special: 5, weight: 'Light' },
    image: `${BASE}characters/zero.svg`,
    description: 'The legendary reploid warrior wielding the Z-Saber and Z-Buster with unmatched precision.',
  },
];

export const STAGES: Stage[] = [
  {
    id: 'battlefield',
    name: 'Battlefield',
    image: `${BASE}stages/stage-battlefield.jpg?v=2`,
    description: 'A balanced stage with three platforms. Perfect for competitive play.',
    hasHazards: false,
  },
  {
    id: 'final',
    name: 'Final Destination',
    image: `${BASE}stages/stage-final-destination.jpg?v=2`,
    description: 'A single flat platform in the void. No platforms, pure skill.',
    hasHazards: false,
  },
  {
    id: 'hazard',
    name: 'Factory Floor',
    image: `${BASE}stages/stage-hazard.jpg?v=2`,
    description: 'An industrial stage with moving hazards. Watch your step!',
    hasHazards: true,
  },
  {
    id: 'neo-arcadia',
    name: 'Neo Arcadia',
    image: `${BASE}stages/stage-neo-arcadia.svg`,
    description: 'The towering fortress of Neo Arcadia. Vertical pillars and rising energy platforms test your aerial mastery.',
    hasHazards: true,
  },
];

// ─── Store State ─────────────────────────────────────────────────────

interface GameState {
  // Core state
  gameState: GameScreen;
  setGameState: (state: GameScreen) => void;

  // Player data
  player1Character: Character | null;
  player2Character: Character | null;
  player1Stocks: number;
  player2Stocks: number;
  player1Damage: number;
  player2Damage: number;

  // Stage
  selectedStage: Stage | null;

  // Settings
  settings: GameSettings;

  // Match config
  timeLimit: number;
  stockCount: number;
  hazardsEnabled: boolean;
  matchStartTime: number;

  // Match results
  winner: 1 | 2 | null;
  matchStats: MatchResult | null;
  matchAlreadyEnded: boolean;

  // Online multiplayer
  user: Profile | null;
  setUser: (user: Profile | null) => void;
  onlineMode: boolean;
  setOnlineMode: (mode: boolean) => void;
  isHost: boolean;
  setIsHost: (isHost: boolean) => void;
  matchOpponent: Profile | null;
  setMatchOpponent: (opponent: Profile | null) => void;
  matchChannel: RealtimeChannel | null;
  setMatchChannel: (ch: RealtimeChannel | null) => void;
  // Multi-player room
  roomPlayers: Profile[];
  setRoomPlayers: (players: Profile[]) => void;
  myPlayerIndex: number;
  setMyPlayerIndex: (index: number) => void;

  // Actions
  selectCharacter: (player: 1 | 2, character: Character) => void;
  selectStage: (stage: Stage) => void;
  startMatch: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  restartMatch: () => void;
  endMatch: (winner: 1 | 2) => void;
  updateDamage: (player: 1 | 2, damage: number) => void;
  loseStock: (player: 1 | 2) => void;
  resetMatch: () => void;
  updateSettings: (settings: Partial<GameSettings>) => void;
  resetProgress: () => void;
}

// ─── Default Settings ────────────────────────────────────────────────

const DEFAULT_SETTINGS: GameSettings = {
  sfxVolume: 0.8,
  musicVolume: 0.5,
  controls: 'standard',
  graphicsQuality: 'high',
};

// ─── Store ───────────────────────────────────────────────────────────

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  gameState: 'title',
  player1Character: null,
  player2Character: null,
  player1Stocks: 4,
  player2Stocks: 4,
  player1Damage: 0,
  player2Damage: 0,
  selectedStage: null,
  settings: { ...DEFAULT_SETTINGS },
  timeLimit: 180,
  stockCount: 4,
  hazardsEnabled: true,
  matchStartTime: 0,
  winner: null,
  matchStats: null,
  matchAlreadyEnded: false,

  // Online multiplayer
  user: null,
  setUser: (user) => set({ user }),
  onlineMode: false,
  setOnlineMode: (mode) => set({ onlineMode: mode }),
  isHost: false,
  setIsHost: (isHost) => set({ isHost }),
  matchOpponent: null,
  setMatchOpponent: (opponent) => set({ matchOpponent: opponent }),
  matchChannel: null,
  setMatchChannel: (ch) => set({ matchChannel: ch }),
  roomPlayers: [],
  setRoomPlayers: (players) => set({ roomPlayers: players }),
  myPlayerIndex: 0,
  setMyPlayerIndex: (index) => set({ myPlayerIndex: index }),

  // Actions
  setGameState: (state) => set({ gameState: state }),

  selectCharacter: (player, character) => {
    if (player === 1) {
      set({ player1Character: character });
    } else {
      set({ player2Character: character });
    }
  },

  selectStage: (stage) => set({ selectedStage: stage }),

  startMatch: () => {
    const { stockCount } = get();
    set({
      gameState: 'countdown',
      player1Stocks: stockCount,
      player2Stocks: stockCount,
      player1Damage: 0,
      player2Damage: 0,
      winner: null,
      matchStats: null,
      matchStartTime: Date.now(),
      matchAlreadyEnded: false,
    });
  },

  pauseGame: () => set({ gameState: 'paused' }),

  resumeGame: () => set({ gameState: 'playing' }),

  restartMatch: () => {
    const { stockCount } = get();
    set({
      gameState: 'countdown',
      player1Stocks: stockCount,
      player2Stocks: stockCount,
      player1Damage: 0,
      player2Damage: 0,
      winner: null,
      matchStats: null,
      matchStartTime: Date.now(),
      matchAlreadyEnded: false,
    });
  },

  endMatch: (winner) => {
    const state = get();
    // Guard against double-fire from GameLoop + loseStock
    if (state.matchAlreadyEnded) return;
    const elapsed = state.matchStartTime > 0
      ? Date.now() - state.matchStartTime
      : 0;
    const matchStats: MatchResult = {
      winner,
      player1Stats: {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        stocksLost: state.stockCount - state.player1Stocks,
        stocksTaken: state.stockCount - state.player2Stocks,
        matchDuration: elapsed,
      },
      player2Stats: {
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        stocksLost: state.stockCount - state.player2Stocks,
        stocksTaken: state.stockCount - state.player1Stocks,
        matchDuration: elapsed,
      },
    };
    set({
      gameState: 'gameOver',
      winner,
      matchStats,
      matchAlreadyEnded: true,
    });
  },

  updateDamage: (player, damage) => {
    if (player === 1) {
      set({ player1Damage: Math.max(0, damage) });
    } else {
      set({ player2Damage: Math.max(0, damage) });
    }
  },

  loseStock: (player) => {
    const state = get();
    if (player === 1) {
      set({ player1Stocks: Math.max(0, state.player1Stocks - 1) });
    } else {
      set({ player2Stocks: Math.max(0, state.player2Stocks - 1) });
    }
    // GameLoop's checkBlastZones() is the sole authority on match end
    // Do NOT call endMatch() from here — prevents double-fire race condition
  },

  resetMatch: () => {
    const { stockCount } = get();
    set({
      gameState: 'characterSelect',
      player1Character: null,
      player2Character: null,
      player1Stocks: stockCount,
      player2Stocks: stockCount,
      player1Damage: 0,
      player2Damage: 0,
      selectedStage: null,
      winner: null,
      matchStats: null,
      // Clear online state so next game starts fresh
      onlineMode: false,
      isHost: false,
      matchOpponent: null,
      matchChannel: null,
      roomPlayers: [],
      myPlayerIndex: 0,
    });
  },

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  resetProgress: () =>
    set({
      settings: { ...DEFAULT_SETTINGS },
      player1Character: null,
      player2Character: null,
      selectedStage: null,
      winner: null,
      matchStats: null,
    }),
}));
