import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BattleState, LeaderboardEntry, Move, Player } from '../types';
import { generateLeaderboard, getAIMove, resolveMoves } from '../utils/gameLogic';

const AVATARS = ['⚔️', '🛡️', '🔥', '⚡', '💎', '👑', '🐉', '🦅'];
const AI_NAMES = ['ShadowAI', 'VoidBot', 'NeonRival', 'StormAI', 'IronBot'];
const AI_AVATARS = ['💀', '🔮', '🤖', '👾', '🦂'];

function makeDefaultPlayer(overrides?: Partial<Player>): Player {
  return {
    id: 'player1',
    username: 'Warrior',
    avatar: '⚔️',
    hp: 100,
    maxHp: 100,
    wins: 0,
    losses: 0,
    level: 1,
    ...overrides,
  };
}

function makeAIOpponent(): Player {
  const idx = Math.floor(Math.random() * AI_NAMES.length);
  return {
    id: 'ai',
    username: AI_NAMES[idx],
    avatar: AI_AVATARS[idx],
    hp: 100,
    maxHp: 100,
    wins: Math.floor(Math.random() * 50) + 10,
    losses: Math.floor(Math.random() * 20) + 5,
    level: Math.floor(Math.random() * 10) + 1,
  };
}

interface GameContextType {
  currentPlayer: Player | null;
  battleState: BattleState | null;
  leaderboard: LeaderboardEntry[];
  isLoggedIn: boolean;
  login: (username: string, avatar: string) => Promise<void>;
  logout: () => Promise<void>;
  startBattle: (vsHotSeat?: boolean) => void;
  makeMove: (move: Move) => void;
  resetBattle: () => void;
  updatePlayerStats: (won: boolean) => Promise<void>;
  hotSeatMode: boolean;
  hotSeatTurn: 'player' | 'opponent';
  hotSeatOpponentName: string;
  setHotSeatOpponentName: (name: string) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hotSeatMode, setHotSeatMode] = useState(false);
  const [hotSeatTurn, setHotSeatTurn] = useState<'player' | 'opponent'>('player');
  const [hotSeatPlayerMove, setHotSeatPlayerMove] = useState<Move | null>(null);
  const [hotSeatOpponentName, setHotSeatOpponentName] = useState('Player 2');

  useEffect(() => {
    loadPlayer();
    setLeaderboard(generateLeaderboard());
  }, []);

  async function loadPlayer() {
    try {
      const data = await AsyncStorage.getItem('clashPlayer');
      if (data) {
        setCurrentPlayer(JSON.parse(data));
        setIsLoggedIn(true);
      }
    } catch (e) {
      // ignore
    }
  }

  async function login(username: string, avatar: string) {
    const player = makeDefaultPlayer({ username, avatar });
    setCurrentPlayer(player);
    setIsLoggedIn(true);
    await AsyncStorage.setItem('clashPlayer', JSON.stringify(player));
  }

  async function logout() {
    await AsyncStorage.removeItem('clashPlayer');
    setCurrentPlayer(null);
    setIsLoggedIn(false);
  }

  function startBattle(vsHotSeat = false) {
    if (!currentPlayer) return;
    setHotSeatMode(vsHotSeat);
    setHotSeatTurn('player');
    setHotSeatPlayerMove(null);

    const opponent = vsHotSeat
      ? makeDefaultPlayer({
          id: 'player2',
          username: hotSeatOpponentName,
          avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
        })
      : makeAIOpponent();

    setBattleState({
      player: { ...currentPlayer, hp: 100, maxHp: 100 },
      opponent: { ...opponent, hp: 100, maxHp: 100 },
      rounds: [],
      currentRound: 1,
      playerScore: 0,
      opponentScore: 0,
      status: 'selecting',
    });
  }

  function makeMove(move: Move) {
    if (!battleState) return;
    if (battleState.status !== 'selecting') return;

    if (hotSeatMode) {
      if (hotSeatTurn === 'player') {
        // Store player's move, now opponent picks
        setHotSeatPlayerMove(move);
        setHotSeatTurn('opponent');
        return;
      } else {
        // Opponent has chosen — resolve with stored player move
        const pMove = hotSeatPlayerMove!;
        setHotSeatPlayerMove(null);
        setHotSeatTurn('player');
        resolveRound(pMove, move);
        return;
      }
    }

    // AI mode
    const aiMove = getAIMove(battleState.opponent.hp, battleState.player.hp);
    resolveRound(move, aiMove);
  }

  function resolveRound(playerMove: Move, opponentMove: Move) {
    setBattleState((prev) => {
      if (!prev) return prev;
      const { damageDealt, damageTaken, result } = resolveMoves(playerMove, opponentMove);

      const newPlayerHp = Math.max(0, prev.player.hp - damageTaken);
      const newOpponentHp = Math.max(0, prev.opponent.hp - damageDealt);

      const round = {
        roundNumber: prev.currentRound,
        playerMove,
        opponentMove,
        result,
        damageDealt,
        damageTaken,
      };

      const newPlayerScore = prev.playerScore + (result === 'win' ? 1 : 0);
      const newOpponentScore = prev.opponentScore + (result === 'lose' ? 1 : 0);

      // Check for game over: 3 wins or HP = 0
      const playerWon = newPlayerScore >= 3 || newOpponentHp === 0;
      const opponentWon = newOpponentScore >= 3 || newPlayerHp === 0;

      let status: BattleState['status'] = 'roundEnd';
      let winner: BattleState['winner'];

      if (playerWon && opponentWon) {
        status = 'gameOver';
        winner = 'draw';
      } else if (playerWon) {
        status = 'gameOver';
        winner = 'player';
      } else if (opponentWon) {
        status = 'gameOver';
        winner = 'opponent';
      }

      return {
        ...prev,
        player: { ...prev.player, hp: newPlayerHp },
        opponent: { ...prev.opponent, hp: newOpponentHp },
        rounds: [...prev.rounds, round],
        currentRound: prev.currentRound + 1,
        playerScore: newPlayerScore,
        opponentScore: newOpponentScore,
        status,
        winner,
      };
    });
  }

  const updatePlayerStats = useCallback(
    async (won: boolean) => {
      if (!currentPlayer) return;
      const updated: Player = {
        ...currentPlayer,
        wins: currentPlayer.wins + (won ? 1 : 0),
        losses: currentPlayer.losses + (won ? 0 : 1),
        level: Math.max(1, Math.floor((currentPlayer.wins + (won ? 1 : 0)) / 5) + 1),
      };
      setCurrentPlayer(updated);
      await AsyncStorage.setItem('clashPlayer', JSON.stringify(updated));
    },
    [currentPlayer]
  );

  function resetBattle() {
    setBattleState(null);
    setHotSeatTurn('player');
    setHotSeatPlayerMove(null);
  }

  // Advance from roundEnd → selecting after a delay (handled in BattleScreen)
  function advanceRound() {
    setBattleState((prev) => {
      if (!prev || prev.status !== 'roundEnd') return prev;
      return { ...prev, status: 'selecting' };
    });
  }

  return (
    <GameContext.Provider
      value={{
        currentPlayer,
        battleState,
        leaderboard,
        isLoggedIn,
        login,
        logout,
        startBattle,
        makeMove,
        resetBattle,
        updatePlayerStats,
        hotSeatMode,
        hotSeatTurn,
        hotSeatOpponentName,
        setHotSeatOpponentName,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
