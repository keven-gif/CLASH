import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import HpBar from '../components/HpBar';
import MoveCard from '../components/MoveCard';
import PlayerAvatar from '../components/PlayerAvatar';
import RoundResult from '../components/RoundResult';
import Button from '../components/Button';
import { useGame } from '../context/GameContext';
import { RootStackParamList } from '../navigation/types';
import { Move } from '../types';
import { COLORS } from '../utils/gameLogic';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Battle'>;
};

export default function BattleScreen({ navigation }: Props) {
  const {
    battleState,
    makeMove,
    resetBattle,
    updatePlayerStats,
    hotSeatMode,
    hotSeatTurn,
  } = useGame();

  const [showRoundResult, setShowRoundResult] = useState(false);
  const [selectedMove, setSelectedMove] = useState<Move | null>(null);
  const [statsUpdated, setStatsUpdated] = useState(false);

  const shakeX = useSharedValue(0);
  const playerShake = useSharedValue(0);
  const opponentShake = useSharedValue(0);
  const gameOverOpacity = useSharedValue(0);
  const gameOverScale = useSharedValue(0.7);

  const prevRoundCount = useRef(0);

  useEffect(() => {
    if (!battleState) return;

    const rounds = battleState.rounds;

    if (rounds.length > prevRoundCount.current) {
      prevRoundCount.current = rounds.length;
      const lastRound = rounds[rounds.length - 1];

      setShowRoundResult(true);
      setSelectedMove(null);

      // Shake animations
      if (lastRound.damageTaken > 0) {
        playerShake.value = withSequence(
          withTiming(-10, { duration: 60 }),
          withTiming(10, { duration: 60 }),
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(0, { duration: 60 })
        );
      }
      if (lastRound.damageDealt > 0) {
        opponentShake.value = withSequence(
          withTiming(-10, { duration: 60 }),
          withTiming(10, { duration: 60 }),
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(0, { duration: 60 })
        );
      }

      if (battleState.status !== 'gameOver') {
        const timer = setTimeout(() => {
          setShowRoundResult(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }

    if (battleState.status === 'gameOver') {
      setShowRoundResult(true);
      gameOverOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
      gameOverScale.value = withDelay(600, withSpring(1, { damping: 8 }));

      if (!statsUpdated && battleState.winner !== undefined) {
        setStatsUpdated(true);
        updatePlayerStats(battleState.winner === 'player');
      }
    }
  }, [battleState?.rounds.length, battleState?.status]);

  const playerShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: playerShake.value }],
  }));

  const opponentShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: opponentShake.value }],
  }));

  const gameOverStyle = useAnimatedStyle(() => ({
    opacity: gameOverOpacity.value,
    transform: [{ scale: gameOverScale.value }],
  }));

  function handleMove(move: Move) {
    if (!battleState || battleState.status === 'gameOver') return;
    setSelectedMove(move);
    setTimeout(() => {
      makeMove(move);
    }, 300);
  }

  function handlePlayAgain() {
    resetBattle();
    navigation.goBack();
  }

  function handleHome() {
    resetBattle();
    navigation.navigate('Main');
  }

  if (!battleState) return null;

  const { player, opponent, currentRound, playerScore, opponentScore, status, winner, rounds } =
    battleState;
  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const isSelecting = status === 'selecting' || status === 'roundEnd';
  const isGameOver = status === 'gameOver';
  const isHotSeatOpponentTurn = hotSeatMode && hotSeatTurn === 'opponent';

  const turnLabel = hotSeatMode
    ? hotSeatTurn === 'player'
      ? `${player.username}'s turn`
      : `${opponent.username}'s turn`
    : 'Choose your move';

  const currentActor = hotSeatMode && hotSeatTurn === 'opponent' ? opponent : player;

  return (
    <LinearGradient colors={['#0a0a1a', '#0f0f22']} style={styles.container}>
      {/* Top: Opponent */}
      <View style={styles.topSection}>
        <Animated.View style={[styles.combatantRow, opponentShakeStyle]}>
          <PlayerAvatar
            avatar={opponent.avatar}
            username={opponent.username}
            level={opponent.level}
            size="md"
            flipped
          />
          <View style={styles.hpContainer}>
            <HpBar hp={opponent.hp} maxHp={opponent.maxHp} label={opponent.username} flipped />
          </View>
        </Animated.View>
      </View>

      {/* Score / Round */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreNumber}>{playerScore}</Text>
          <Text style={styles.scoreLabel}>{player.username.toUpperCase()}</Text>
        </View>
        <View style={styles.roundBox}>
          <Text style={styles.roundLabel}>ROUND</Text>
          <Text style={styles.roundNumber}>{Math.min(currentRound, 5)}</Text>
          <Text style={styles.roundLabel}>OF 5</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreNumber, { color: COLORS.danger }]}>{opponentScore}</Text>
          <Text style={styles.scoreLabel}>{opponent.username.toUpperCase()}</Text>
        </View>
      </View>

      {/* Round Result */}
      {lastRound && showRoundResult && !isGameOver && (
        <View style={styles.resultContainer}>
          <RoundResult round={lastRound} visible={showRoundResult} />
        </View>
      )}

      {/* Waiting message in hot seat mode */}
      {!showRoundResult && hotSeatMode && isSelecting && (
        <View style={styles.turnBanner}>
          <LinearGradient
            colors={isHotSeatOpponentTurn ? [COLORS.danger + '33', '#1a1a2e'] : [COLORS.primary + '33', '#1a1a2e']}
            style={styles.turnBannerGrad}
          >
            <Text style={styles.turnBannerIcon}>
              {isHotSeatOpponentTurn ? opponent.avatar : player.avatar}
            </Text>
            <Text style={styles.turnBannerText}>{turnLabel}</Text>
          </LinearGradient>
        </View>
      )}

      {/* Bottom: Player */}
      <View style={styles.bottomSection}>
        <Animated.View style={[styles.combatantRow, playerShakeStyle]}>
          <PlayerAvatar
            avatar={player.avatar}
            username={player.username}
            level={player.level}
            size="md"
          />
          <View style={styles.hpContainer}>
            <HpBar hp={player.hp} maxHp={player.maxHp} label="YOUR HP" />
          </View>
        </Animated.View>

        {!isGameOver && (
          <>
            <Text style={styles.movePrompt}>
              {!showRoundResult ? turnLabel.toUpperCase() : 'ROUND COMPLETE...'}
            </Text>
            <View style={styles.moveCards}>
              {(['attack', 'defend', 'special'] as Move[]).map((move) => (
                <MoveCard
                  key={move}
                  move={move}
                  onPress={handleMove}
                  disabled={showRoundResult || !isSelecting}
                  selected={selectedMove === move}
                />
              ))}
            </View>
          </>
        )}
      </View>

      {/* Game Over Overlay */}
      {isGameOver && (
        <Animated.View style={[styles.gameOverOverlay, gameOverStyle]}>
          <LinearGradient
            colors={
              winner === 'player'
                ? ['#1a3a28', '#0a1a14']
                : winner === 'opponent'
                ? ['#3a1a1a', '#1a0a0a']
                : ['#2a2a1a', '#1a1a0a']
            }
            style={styles.gameOverCard}
          >
            <Text style={styles.gameOverEmoji}>
              {winner === 'player' ? '🏆' : winner === 'opponent' ? '💀' : '🤝'}
            </Text>
            <Text
              style={[
                styles.gameOverTitle,
                {
                  color:
                    winner === 'player'
                      ? COLORS.success
                      : winner === 'opponent'
                      ? COLORS.danger
                      : COLORS.warning,
                },
              ]}
            >
              {winner === 'player' ? 'VICTORY!' : winner === 'opponent' ? 'DEFEATED!' : 'DRAW!'}
            </Text>
            <Text style={styles.gameOverSub}>
              {winner === 'player'
                ? `${player.username} wins ${playerScore}-${opponentScore}`
                : winner === 'opponent'
                ? `${opponent.username} wins ${opponentScore}-${playerScore}`
                : 'An honorable draw'}
            </Text>

            <View style={styles.finalScoreRow}>
              <View style={styles.finalScoreBox}>
                <Text style={styles.finalScoreNum}>{playerScore}</Text>
                <Text style={styles.finalScoreLabel}>{player.username}</Text>
              </View>
              <Text style={styles.finalVs}>VS</Text>
              <View style={styles.finalScoreBox}>
                <Text style={[styles.finalScoreNum, { color: COLORS.danger }]}>{opponentScore}</Text>
                <Text style={styles.finalScoreLabel}>{opponent.username}</Text>
              </View>
            </View>

            <View style={styles.gameOverButtons}>
              <Button
                label="PLAY AGAIN"
                variant="primary"
                onPress={handlePlayAgain}
                size="lg"
                icon="⚔️"
                style={styles.gameOverBtn}
              />
              <Button
                label="HOME"
                variant="ghost"
                onPress={handleHome}
                size="md"
                style={styles.gameOverBtn}
              />
            </View>
          </LinearGradient>
        </Animated.View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  topSection: {
    marginBottom: 8,
  },
  combatantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hpContainer: {
    flex: 1,
  },
  scoreSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  scoreBox: {
    alignItems: 'center',
    flex: 1,
  },
  scoreNumber: {
    color: COLORS.success,
    fontSize: 32,
    fontWeight: '900',
  },
  scoreLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  roundBox: {
    alignItems: 'center',
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#2a2a4a',
  },
  roundLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  roundNumber: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
  },
  resultContainer: {
    marginVertical: 8,
  },
  turnBanner: {
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  turnBannerGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  turnBannerIcon: {
    fontSize: 20,
  },
  turnBannerText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 10,
  },
  movePrompt: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 4,
  },
  moveCards: {
    flexDirection: 'row',
    gap: 8,
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  gameOverCard: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  gameOverEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  gameOverTitle: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 6,
  },
  gameOverSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 20,
    fontWeight: '600',
  },
  finalScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  finalScoreBox: {
    alignItems: 'center',
  },
  finalScoreNum: {
    color: COLORS.success,
    fontSize: 40,
    fontWeight: '900',
  },
  finalScoreLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  finalVs: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  gameOverButtons: {
    width: '100%',
    gap: 10,
  },
  gameOverBtn: {
    width: '100%',
  },
});
