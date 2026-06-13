import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BattleRound } from '../types';
import { COLORS, MOVE_INFO } from '../utils/gameLogic';

interface RoundResultProps {
  round: BattleRound;
  visible: boolean;
}

export default function RoundResult({ round, visible }: RoundResultProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSequence(
        withSpring(1.1, { damping: 6 }),
        withSpring(1, { damping: 12 })
      );
      translateY.value = withSpring(0, { damping: 12 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.5, { duration: 150 });
      translateY.value = withTiming(20, { duration: 150 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const resultConfig = {
    win: { label: 'YOU WIN!', color: COLORS.success, bg: '#1a3a28', icon: '🏆' },
    lose: { label: 'YOU LOSE', color: COLORS.danger, bg: '#3a1a1a', icon: '💀' },
    draw: { label: 'DRAW!', color: COLORS.warning, bg: '#3a2a1a', icon: '🤝' },
  }[round.result];

  const playerMoveInfo = MOVE_INFO[round.playerMove];
  const opponentMoveInfo = MOVE_INFO[round.opponentMove];

  return (
    <Animated.View style={[styles.container, { backgroundColor: resultConfig.bg }, animStyle]}>
      <Text style={styles.roundLabel}>ROUND {round.roundNumber}</Text>
      <Text style={[styles.resultText, { color: resultConfig.color }]}>
        {resultConfig.icon} {resultConfig.label}
      </Text>
      <View style={styles.movesRow}>
        <View style={styles.moveDisplay}>
          <Text style={styles.moveIcon}>{playerMoveInfo.icon}</Text>
          <Text style={[styles.moveName, { color: playerMoveInfo.color }]}>
            {playerMoveInfo.label}
          </Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={styles.moveDisplay}>
          <Text style={styles.moveIcon}>{opponentMoveInfo.icon}</Text>
          <Text style={[styles.moveName, { color: opponentMoveInfo.color }]}>
            {opponentMoveInfo.label}
          </Text>
        </View>
      </View>
      {round.damageDealt > 0 && (
        <Text style={[styles.dmgText, { color: COLORS.success }]}>
          -{round.damageDealt} HP dealt
        </Text>
      )}
      {round.damageTaken > 0 && (
        <Text style={[styles.dmgText, { color: COLORS.danger }]}>
          -{round.damageTaken} HP taken
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333355',
  },
  roundLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  resultText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  movesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  moveDisplay: {
    alignItems: 'center',
    gap: 2,
  },
  moveIcon: {
    fontSize: 20,
  },
  moveName: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vs: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  dmgText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
});
