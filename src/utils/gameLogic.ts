import { GameResult, LeaderboardEntry, Move } from '../types';

export function resolveMoves(
  playerMove: Move,
  opponentMove: Move
): { result: GameResult; damageDealt: number; damageTaken: number } {
  if (playerMove === opponentMove) {
    return { result: 'draw', damageDealt: 5, damageTaken: 5 };
  }

  // Attack beats Special
  if (playerMove === 'attack' && opponentMove === 'special') {
    return { result: 'win', damageDealt: 15, damageTaken: 0 };
  }
  // Defend beats Attack
  if (playerMove === 'defend' && opponentMove === 'attack') {
    return { result: 'win', damageDealt: 5, damageTaken: 0 };
  }
  // Special beats Defend
  if (playerMove === 'special' && opponentMove === 'defend') {
    return { result: 'win', damageDealt: 20, damageTaken: 0 };
  }

  // Opponent wins — reverse damage
  if (opponentMove === 'attack' && playerMove === 'special') {
    return { result: 'lose', damageDealt: 0, damageTaken: 15 };
  }
  if (opponentMove === 'defend' && playerMove === 'attack') {
    return { result: 'lose', damageDealt: 0, damageTaken: 5 };
  }
  if (opponentMove === 'special' && playerMove === 'defend') {
    return { result: 'lose', damageDealt: 0, damageTaken: 20 };
  }

  return { result: 'draw', damageDealt: 5, damageTaken: 5 };
}

export function getAIMove(opponentHp: number, playerHp: number): Move {
  const moves: Move[] = ['attack', 'defend', 'special'];

  // Desperate — low HP, go aggressive
  if (opponentHp < 30) {
    const weights = [0.2, 0.1, 0.7];
    return weightedRandom(moves, weights);
  }

  // Dominant — high HP advantage, mix it up
  if (opponentHp > playerHp + 20) {
    const weights = [0.4, 0.3, 0.3];
    return weightedRandom(moves, weights);
  }

  // Cautious — protect when low relative HP
  if (opponentHp < playerHp) {
    const weights = [0.3, 0.5, 0.2];
    return weightedRandom(moves, weights);
  }

  // Balanced default
  const weights = [0.35, 0.3, 0.35];
  return weightedRandom(moves, weights);
}

function weightedRandom(items: Move[], weights: number[]): Move {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function generateLeaderboard(): LeaderboardEntry[] {
  const names = [
    'ShadowBlade', 'IronFist', 'StormCaller', 'VoidWalker',
    'DragonSlayer', 'NightHawk', 'ThunderBolt', 'FrostByte',
    'CrimsonFury', 'SilverWing',
  ];
  const avatars = ['⚔️', '🛡️', '🔥', '⚡', '💎', '👑', '🐉', '🦅', '🔮', '💀'];

  return names.map((name, i) => {
    const wins = Math.floor(Math.random() * 150) + 50 - i * 8;
    const losses = Math.floor(Math.random() * 40) + 5 + i * 3;
    const total = wins + losses;
    return {
      rank: i + 1,
      username: name,
      avatar: avatars[i],
      wins,
      level: Math.max(1, Math.floor(wins / 10)),
      winRate: Math.round((wins / total) * 100),
    };
  });
}

export const COLORS = {
  background: '#0a0a1a',
  primary: '#6c63ff',
  secondary: '#00d4ff',
  danger: '#ff4757',
  success: '#2ed573',
  warning: '#ffa502',
  cardBg: '#1a1a2e',
  text: '#ffffff',
  textMuted: '#8888aa',
  border: '#2a2a4a',
};

export const MOVE_INFO: Record<Move, { label: string; icon: string; color: string; description: string }> = {
  attack: {
    label: 'ATTACK',
    icon: '⚔️',
    color: '#ff4757',
    description: 'Beats Special\n15 damage',
  },
  defend: {
    label: 'DEFEND',
    icon: '🛡️',
    color: '#00d4ff',
    description: 'Beats Attack\n5 counter dmg',
  },
  special: {
    label: 'SPECIAL',
    icon: '⚡',
    color: '#ffa502',
    description: 'Beats Defend\n20 damage',
  },
};
