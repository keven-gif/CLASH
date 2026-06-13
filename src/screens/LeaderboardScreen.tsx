import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../context/GameContext';
import { LeaderboardEntry } from '../types';
import { COLORS } from '../utils/gameLogic';

const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];
const RANK_ICONS = ['👑', '🥈', '🥉'];

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  return (
    <LinearGradient
      colors={isCurrentUser ? [COLORS.primary + '33', COLORS.cardBg] : [COLORS.cardBg, COLORS.cardBg]}
      style={[styles.row, isCurrentUser && styles.rowHighlighted]}
    >
      <View style={styles.rankContainer}>
        {entry.rank <= 3 ? (
          <Text style={styles.rankIcon}>{RANK_ICONS[entry.rank - 1]}</Text>
        ) : (
          <Text style={[styles.rankNum, entry.rank <= 3 && { color: RANK_COLORS[entry.rank - 1] }]}>
            #{entry.rank}
          </Text>
        )}
      </View>

      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>{entry.avatar}</Text>
      </View>

      <View style={styles.playerInfo}>
        <Text style={[styles.username, isCurrentUser && { color: COLORS.primary }]}>
          {entry.username}
          {isCurrentUser ? ' (You)' : ''}
        </Text>
        <Text style={styles.levelText}>Level {entry.level}</Text>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statCol}>
          <Text style={styles.statVal}>{entry.wins}</Text>
          <Text style={styles.statLbl}>WINS</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={[styles.statVal, { color: COLORS.secondary }]}>{entry.winRate}%</Text>
          <Text style={styles.statLbl}>WIN%</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

export default function LeaderboardScreen() {
  const { leaderboard, currentPlayer } = useGame();

  const playerInBoard = leaderboard.some(
    (e) => e.username === currentPlayer?.username
  );

  const displayBoard = playerInBoard
    ? leaderboard
    : [
        ...leaderboard,
        {
          rank: leaderboard.length + 1,
          username: currentPlayer?.username ?? '',
          avatar: currentPlayer?.avatar ?? '⚔️',
          wins: currentPlayer?.wins ?? 0,
          level: currentPlayer?.level ?? 1,
          winRate:
            (currentPlayer?.wins ?? 0) + (currentPlayer?.losses ?? 0) > 0
              ? Math.round(
                  ((currentPlayer?.wins ?? 0) /
                    ((currentPlayer?.wins ?? 0) + (currentPlayer?.losses ?? 0))) *
                    100
                )
              : 0,
        },
      ];

  return (
    <LinearGradient colors={['#0a0a1a', '#0f0f22']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏆 LEADERBOARD</Text>
        <Text style={styles.headerSub}>Top Warriors</Text>
      </View>

      <FlatList
        data={displayBoard}
        keyExtractor={(item) => item.username}
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            isCurrentUser={item.username === currentPlayer?.username}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  rowHighlighted: {
    borderColor: COLORS.primary + '88',
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
  },
  rankIcon: {
    fontSize: 20,
  },
  rankNum: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
  },
  playerInfo: {
    flex: 1,
  },
  username: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  levelText: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
    fontWeight: '600',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 14,
  },
  statCol: {
    alignItems: 'center',
  },
  statVal: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: '900',
  },
  statLbl: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  separator: {
    height: 6,
  },
});
