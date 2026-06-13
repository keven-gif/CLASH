import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Move } from '../types';
import { COLORS, MOVE_INFO } from '../utils/gameLogic';

interface MoveCardProps {
  move: Move;
  onPress: (move: Move) => void;
  disabled?: boolean;
  selected?: boolean;
  revealed?: boolean;
}

export default function MoveCard({ move, onPress, disabled, selected, revealed }: MoveCardProps) {
  const info = MOVE_INFO[move];
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled && !selected ? 0.5 : 1,
  }));

  function handlePress() {
    if (disabled) return;
    scale.value = withSequence(
      withSpring(0.9, { damping: 6 }),
      withSpring(1.08, { damping: 8 }),
      withSpring(1, { damping: 12 })
    );
    onPress(move);
  }

  const borderColor = selected ? info.color : revealed ? info.color : COLORS.border;

  return (
    <Animated.View style={[animatedStyle, styles.wrapper]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85} disabled={disabled}>
        <LinearGradient
          colors={selected || revealed ? [`${info.color}33`, COLORS.cardBg] : [COLORS.cardBg, '#111128']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, { borderColor }]}
        >
          <Text style={styles.icon}>{info.icon}</Text>
          <Text style={[styles.label, { color: info.color }]}>{info.label}</Text>
          <Text style={styles.description}>{info.description}</Text>
          {selected && (
            <View style={[styles.selectedBadge, { backgroundColor: info.color }]}>
              <Text style={styles.selectedText}>CHOSEN</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 12,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 28,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  description: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  selectedText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
});
