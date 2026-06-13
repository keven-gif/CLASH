import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../utils/gameLogic';

interface HpBarProps {
  hp: number;
  maxHp: number;
  label?: string;
  flipped?: boolean;
}

function getBarColor(ratio: number): [string, string] {
  if (ratio > 0.6) return [COLORS.success, '#1ab552'];
  if (ratio > 0.3) return [COLORS.warning, '#cc8200'];
  return [COLORS.danger, '#cc2233'];
}

export default function HpBar({ hp, maxHp, label, flipped }: HpBarProps) {
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const width = useSharedValue(ratio);

  useEffect(() => {
    width.value = withTiming(ratio, { duration: 500 });
  }, [ratio]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  const [colorStart, colorEnd] = getBarColor(ratio);

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.hpText}>
            {hp} / {maxHp}
          </Text>
        </View>
      )}
      <View style={[styles.track, flipped && styles.trackFlipped]}>
        <Animated.View
          style={[
            styles.bar,
            animatedStyle,
            { backgroundColor: colorStart },
            flipped && styles.barFlipped,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hpText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  track: {
    height: 10,
    backgroundColor: '#2a2a4a',
    borderRadius: 6,
    overflow: 'hidden',
  },
  trackFlipped: {
    transform: [{ scaleX: -1 }],
  },
  bar: {
    height: '100%',
    borderRadius: 6,
  },
  barFlipped: {},
});
