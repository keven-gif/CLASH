import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../utils/gameLogic';

interface PlayerAvatarProps {
  avatar: string;
  username: string;
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  flipped?: boolean;
}

const SIZE_MAP = {
  sm: { container: 44, font: 22, badge: 16, badgeFont: 9 },
  md: { container: 60, font: 30, badge: 20, badgeFont: 10 },
  lg: { container: 80, font: 40, badge: 24, badgeFont: 12 },
};

export default function PlayerAvatar({
  avatar,
  username,
  level,
  size = 'md',
  showName = true,
  flipped = false,
}: PlayerAvatarProps) {
  const s = SIZE_MAP[size];

  return (
    <View style={[styles.wrapper, flipped && styles.wrapperFlipped]}>
      <View style={[styles.avatarContainer, { width: s.container, height: s.container }]}>
        <LinearGradient
          colors={[COLORS.primary, '#4a43cc']}
          style={[styles.avatarBg, { borderRadius: s.container / 2 }]}
        >
          <Text style={{ fontSize: s.font }}>{avatar}</Text>
        </LinearGradient>
        <LinearGradient
          colors={[COLORS.warning, '#cc8200']}
          style={[styles.levelBadge, { width: s.badge, height: s.badge, borderRadius: s.badge / 2 }]}
        >
          <Text style={[styles.levelText, { fontSize: s.badgeFont }]}>{level}</Text>
        </LinearGradient>
      </View>
      {showName && (
        <Text style={[styles.name, size === 'sm' && styles.nameSmall]} numberOfLines={1}>
          {username}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  wrapperFlipped: {
    flexDirection: 'row-reverse',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  levelText: {
    color: '#fff',
    fontWeight: '900',
  },
  name: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 100,
  },
  nameSmall: {
    fontSize: 11,
  },
});
