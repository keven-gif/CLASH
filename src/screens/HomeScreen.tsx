import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import Button from '../components/Button';
import PlayerAvatar from '../components/PlayerAvatar';
import { useGame } from '../context/GameContext';
import { RootStackParamList } from '../navigation/types';
import { TabParamList } from '../navigation/types';
import { COLORS } from '../utils/gameLogic';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Home'>,
    NativeStackNavigationProp<RootStackParamList>
  >;
};

export default function HomeScreen({ navigation }: Props) {
  const { currentPlayer, startBattle, hotSeatOpponentName, setHotSeatOpponentName } = useGame();
  const [showHotSeatModal, setShowHotSeatModal] = useState(false);
  const [p2Name, setP2Name] = useState('Player 2');

  if (!currentPlayer) return null;

  function handleQuickBattle() {
    startBattle(false);
    navigation.navigate('Battle');
  }

  function handleHotSeat() {
    setShowHotSeatModal(true);
  }

  function startHotSeat() {
    setHotSeatOpponentName(p2Name.trim() || 'Player 2');
    setShowHotSeatModal(false);
    startBattle(true);
    navigation.navigate('Battle');
  }

  const winRate =
    currentPlayer.wins + currentPlayer.losses > 0
      ? Math.round((currentPlayer.wins / (currentPlayer.wins + currentPlayer.losses)) * 100)
      : 0;

  return (
    <LinearGradient colors={['#0a0a1a', '#0f0f22']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚡ CLASH</Text>
          <Text style={styles.headerSub}>Arena</Text>
        </View>

        {/* Player Card */}
        <LinearGradient
          colors={['#1a1a3e', '#1a1a2e']}
          style={styles.playerCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.playerCardRow}>
            <PlayerAvatar
              avatar={currentPlayer.avatar}
              username={currentPlayer.username}
              level={currentPlayer.level}
              size="lg"
            />
            <View style={styles.playerStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{currentPlayer.wins}</Text>
                <Text style={styles.statLabel}>WINS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.danger }]}>
                  {currentPlayer.losses}
                </Text>
                <Text style={styles.statLabel}>LOSSES</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.secondary }]}>{winRate}%</Text>
                <Text style={styles.statLabel}>WIN RATE</Text>
              </View>
            </View>
          </View>

          <View style={styles.levelBar}>
            <Text style={styles.levelText}>LEVEL {currentPlayer.level}</Text>
            <View style={styles.xpTrack}>
              <View
                style={[
                  styles.xpFill,
                  {
                    width: `${Math.min(100, ((currentPlayer.wins % 5) / 5) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.levelText}>LV {currentPlayer.level + 1}</Text>
          </View>
        </LinearGradient>

        {/* Battle Buttons */}
        <View style={styles.battleSection}>
          <Text style={styles.sectionTitle}>BATTLE MODES</Text>

          <TouchableOpacity style={styles.quickBattleCard} onPress={handleQuickBattle} activeOpacity={0.85}>
            <LinearGradient
              colors={[COLORS.primary, '#4a43cc']}
              style={styles.quickBattleGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.quickBattleIcon}>🤖</Text>
              <View style={styles.quickBattleInfo}>
                <Text style={styles.quickBattleTitle}>QUICK BATTLE</Text>
                <Text style={styles.quickBattleSub}>Fight against AI opponent</Text>
              </View>
              <Text style={styles.quickBattleArrow}>▶</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.hotSeatCard} onPress={handleHotSeat} activeOpacity={0.85}>
            <LinearGradient
              colors={['#1a1a3e', '#1a1a2e']}
              style={styles.hotSeatGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.hotSeatIcon}>🎮</Text>
              <View style={styles.quickBattleInfo}>
                <Text style={styles.hotSeatTitle}>VS FRIEND</Text>
                <Text style={styles.hotSeatSub}>Hot-seat local multiplayer</Text>
              </View>
              <Text style={[styles.quickBattleArrow, { color: COLORS.secondary }]}>▶</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* How to Play */}
        <View style={styles.howToSection}>
          <Text style={styles.sectionTitle}>HOW TO PLAY</Text>
          <View style={styles.howToCard}>
            <View style={styles.howToRow}>
              <Text style={styles.howToIcon}>⚔️</Text>
              <View style={styles.howToText}>
                <Text style={styles.howToTitle}>ATTACK beats SPECIAL</Text>
                <Text style={styles.howToDesc}>Deal 15 damage</Text>
              </View>
            </View>
            <View style={styles.howToRow}>
              <Text style={styles.howToIcon}>🛡️</Text>
              <View style={styles.howToText}>
                <Text style={styles.howToTitle}>DEFEND beats ATTACK</Text>
                <Text style={styles.howToDesc}>Counter for 5 damage</Text>
              </View>
            </View>
            <View style={styles.howToRow}>
              <Text style={styles.howToIcon}>⚡</Text>
              <View style={styles.howToText}>
                <Text style={styles.howToTitle}>SPECIAL beats DEFEND</Text>
                <Text style={styles.howToDesc}>Deal 20 damage</Text>
              </View>
            </View>
            <Text style={styles.howToFooter}>Best of 5 rounds — first to 3 wins!</Text>
          </View>
        </View>
      </ScrollView>

      {/* Hot Seat Modal */}
      <Modal
        visible={showHotSeatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHotSeatModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎮 VS FRIEND</Text>
            <Text style={styles.modalSub}>Enter Player 2's name</Text>
            <TextInput
              style={styles.modalInput}
              value={p2Name}
              onChangeText={setP2Name}
              placeholder="Player 2 name..."
              placeholderTextColor={COLORS.textMuted}
              maxLength={16}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <Button
                label="CANCEL"
                variant="ghost"
                onPress={() => setShowHotSeatModal(false)}
                style={styles.modalBtn}
              />
              <Button
                label="START"
                variant="primary"
                onPress={startHotSeat}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 20,
    marginTop: 10,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
  },
  headerSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
  },
  playerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2a5a',
  },
  playerCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  playerStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: {
    color: COLORS.success,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2a2a4a',
    alignSelf: 'stretch',
  },
  levelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    minWidth: 44,
  },
  xpTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#2a2a4a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: COLORS.warning,
    borderRadius: 3,
  },
  battleSection: { marginBottom: 24 },
  sectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  quickBattleCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  quickBattleGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  quickBattleIcon: { fontSize: 32 },
  quickBattleInfo: { flex: 1 },
  quickBattleTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  quickBattleSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  quickBattleArrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  hotSeatCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.secondary + '44',
  },
  hotSeatGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  hotSeatIcon: { fontSize: 32 },
  hotSeatTitle: {
    color: COLORS.secondary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  hotSeatSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  howToSection: { marginBottom: 20 },
  howToCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    gap: 12,
  },
  howToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  howToIcon: { fontSize: 24 },
  howToText: { flex: 1 },
  howToTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  howToDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  howToFooter: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#0f0f22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    color: COLORS.text,
    fontSize: 16,
    padding: 14,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
  },
});
