export type Move = 'attack' | 'defend' | 'special';
export type GameResult = 'win' | 'lose' | 'draw';
export type Screen = 'Splash' | 'Auth' | 'Home' | 'Battle' | 'Leaderboard' | 'Profile';

export interface Player {
  id: string;
  username: string;
  avatar: string; // emoji
  hp: number;
  maxHp: number;
  wins: number;
  losses: number;
  level: number;
}

export interface BattleRound {
  roundNumber: number;
  playerMove: Move;
  opponentMove: Move;
  result: GameResult;
  damageDealt: number;
  damageTaken: number;
}

export interface BattleState {
  player: Player;
  opponent: Player;
  rounds: BattleRound[];
  currentRound: number;
  playerScore: number;
  opponentScore: number;
  status: 'selecting' | 'resolving' | 'roundEnd' | 'gameOver';
  winner?: 'player' | 'opponent' | 'draw';
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  avatar: string;
  wins: number;
  level: number;
  winRate: number;
}
