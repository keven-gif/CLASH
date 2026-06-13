import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Button from '../components/Button';
import PlayerAvatar from '../components/PlayerAvatar';
import { useGame } from '../context/GameContext';
import { TabParamList } from '../navigation/types';
import { RootStackParamList } from '../navigation/types';
import { COLORS } from '../utils/gameLogic';

const AVATARS = ['⚔️', '🛡️', '🔥', '⚡', '💎', '👑', '🐉', '🦅'];

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Profile'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export default function ProfileScreen({ navigation }: Props) {
  const { currentPlayer, logout } = useGame();
  const [editingAvatar, setEditingAvatar] = useState(false);

  if (!currentPlayer) return null;

  const winRate =
    currentPlayer.wins + currentPlayer.losses > 0
      ? Math.round((currentPlayer.wins / (currentPlayer.wins + currentPlayer.losses)) * 100)
      : 0;

  const totalGames = currentPlayer.wins + currentPlayer.losses;
  const xpProgress = (currentPlayer.wins % 5) / 5;

  async function handleLogout() {
    Alert.alert(
      'Leave Arena?',
      'Your progress will be saved. Ready to exit?',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'LOGOUT',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Auth');
          },
        },
      ]
    );
  }

  const stats = [
    { label: 'TOTAL GAMES', value: totalGames, color: COLORS.text },
    { label: 'WINS', value: currentPlayer.wins, color: COLORS.success },
    { label: 'LOSSES', value: currentPlayer.losses, color: COLORS.danger },
    { label: 'WIN RATE', value: `${winRate}%`, color: COLORS.secondary },
    { label: 'LEVEL', value: currentPlayer.level, color: COLORS.warning },
    {
      label: 'NEXT LEVEL',
      value: `${5 - (currentPlayer.wins % 5)} wins`,
      color: COLORS.textMuted,
    },
  ];

  // Simple win/loss chart data — last 10 battles approximated
  const chartBars = Array.from({ length: 10 }, (_, i) => {
    const isWin = i < currentPlayer.wins % 10;
    return { isWin, key: i };
  });

  return (
    <LinearGradient colors={['#0a0a1a', '#0f0f22']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>👤 PROFILE</Text>
        </View>

        {/* Profile Card */}
        <LinearGradient
          colors={['#1a1a3e', '#1a1a2e']}
          style={styles.profileCard}
        >
          <View style={styles.profileTop}>
            <TouchableOpacity
              onPress={() => setEditingAvatar(!editingAvatar)}
              activeOpacity={0.8}
            >
              <PlayerAvatar
                avatar={currentPlayer.avatar}
                username={currentPlayer.username}
                level={currentPlayer.level}
                size="lg"
                showName={false}
              />
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>✏️</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{currentPlayer.username}</Text>
              <View style={styles.levelRow}>
                <LinearGradient
                  colors={[COLORS.warning, '#cc8200']}
                  style={styles.levelBadge}
                >
                  <Text style={styles.levelBadgeText}>LVL {currentPlayer.level}</Text>
                </LinearGradient>
              </View>
              <Text style={styles.profileId}>ID: {currentPlayer.id.slice(0, 8)}</Text>
            </View>
          </View>

          {/* Level progress */}
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <Text style={styles.xpLabel}>PROGRESS TO LEVEL {currentPlayer.level + 1}</Text>
              <Text style={styles.xpLabel}>{currentPlayer.wins % 5}/5 wins</Text>
            </View>
            <View style={styles.xpTrack}>
              <LinearGradient
                colors={[COLORS.warning, COLORS.primary]}
                style={[styles.xpFill, { width: `${xpProgress * 100}%` }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
          </View>

          {/* Avatar selector */}
          {editingAvatar && (
            <View style={styles.avatarSection}>
              <Text style={styles.avatarSectionLabel}>CHOOSE AVATAR</Text>
              <View style={styles.avatarGrid}>
                {AVATARS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.avatarOption,
                      currentPlayer.avatar === emoji && styles.avatarOptionSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      // Avatar change would need updatePlayer in context — for now just close
                      setEditingAvatar(false);
                    }}
                  >
                    <Text style={styles.avatarEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>BATTLE STATS</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Win/Loss Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>RECENT FORM</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartBars}>
              {chartBars.map((bar) => (
                <View
                  key={bar.key}
                  style={[
                    styles.chartBar,
                    {
                      backgroundColor: bar.isWin ? COLORS.success : COLORS.danger,
                      height: bar.isWin ? 40 : 24,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.legendText}>Win</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: COLORS.danger }]} />
                <Text style={styles.legendText}>Loss</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Logout */}
        <Button
          label="LEAVE ARENA"
          variant="danger"
          onPress={handleLogout}
          style={styles.logoutBtn}
          icon="🚪"
        />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a5a',
  },
  profileTop: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  editBadgeText: {
    fontSize: 12,
  },
  profileInfo: {
    flex: 1,
    gap: 6,
  },
  profileName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
  },
  levelRow: {
    flexDirection: 'row',
  },
  levelBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  profileId: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  xpSection: {
    gap: 6,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  xpTrack: {
    height: 8,
    backgroundColor: '#2a2a4a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 4,
  },
  avatarSection: {
    marginTop: 16,
  },
  avatarSectionLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0f0f22',
    borderWidth: 2,
    borderColor: '#2a2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}22`,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  statsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '30%',
    flex: 1,
    minWidth: 80,
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  chartSection: {
    marginBottom: 24,
  },
  chartCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 50,
    marginBottom: 10,
  },
  chartBar: {
    flex: 1,
    borderRadius: 4,
    minHeight: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    marginTop: 4,
  },
});
