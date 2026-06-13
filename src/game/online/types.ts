// Shared types for online PVP

export interface PlayerInput {
  playerId: string;
  joystick: { x: number; y: number };
  attack: boolean;
  special: boolean;
  jump: boolean;
  shield: boolean;
  grab: boolean;
  timestamp: number;
  sequence: number;
}

export interface PlayerState {
  playerId: string;
  character: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  lives: number;
  damage: number;
  action: string;
  facing: 'left' | 'right';
}

export interface GameEvent {
  type: 'hit' | 'ko' | 'spawn' | 'shield_break';
  playerId?: string;
  targetId?: string;
  damage?: number;
  tick: number;
}

export interface GameState {
  tick: number;
  timestamp: number;
  players: PlayerState[];
  events: GameEvent[];
  stage: string;
  timeRemaining: number;
}

export type GameMode = '1v1' | 'ffa' | 'teams' | 'koth';
export type LobbyType = 'quick' | 'ranked' | 'casual';
