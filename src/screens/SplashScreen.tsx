import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useGame } from '../context/GameContext';
import { COLORS } from '../utils/gameLogic';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

export default function SplashScreen({ navigation }: Props) {
  const { isLoggedIn } = useGame();

  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const boltScale = useSharedValue(1);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withSpring(1, { damping: 8, stiffness: 80 });

    subtitleOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
    glowOpacity.value = withDelay(400, withTiming(0.6, { duration: 800 }));

    boltScale.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(1.3, { duration: 400 }),
          withTiming(1, { duration: 400 })
        ),
        -1,
        true
      )
    );

    const timer = setTimeout(() => {
      navigation.replace(isLoggedIn ? 'Main' : 'Auth');
    }, 2500);

    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const subtitleAnimStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const boltAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: boltScale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <LinearGradient colors={['#1a0a2e', '#0a0a1a', '#0a1a2e']} style={styles.container}>
      <Animated.View style={[styles.glowCircle, glowAnimStyle]} />

      <Animated.View style={[styles.logoContainer, logoAnimStyle]}>
        <Animated.Text style={[styles.bolt, boltAnimStyle]}>⚡</Animated.Text>
        <Text style={styles.title}>CLASH</Text>
        <Animated.Text style={[styles.bolt, boltAnimStyle]}>⚡</Animated.Text>
      </Animated.View>

      <Animated.View style={subtitleAnimStyle}>
        <Text style={styles.subtitle}>BATTLE. CONQUER. DOMINATE.</Text>
        <View style={styles.divider} />
      </Animated.View>

      <Animated.View style={subtitleAnimStyle}>
        <Text style={styles.loading}>Entering the Arena...</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  glowCircle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 80,
    elevation: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bolt: {
    fontSize: 48,
  },
  title: {
    fontSize: 72,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 12,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.secondary,
    letterSpacing: 4,
    fontWeight: '700',
    textAlign: 'center',
  },
  divider: {
    height: 2,
    backgroundColor: COLORS.primary,
    marginVertical: 12,
    borderRadius: 1,
    opacity: 0.6,
  },
  loading: {
    color: COLORS.textMuted,
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '500',
  },
});
