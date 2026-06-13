import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Button from '../components/Button';
import { useGame } from '../context/GameContext';
import { COLORS } from '../utils/gameLogic';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Auth'>;
};

const AVATARS = ['⚔️', '🛡️', '🔥', '⚡', '💎', '👑', '🐉', '🦅'];

export default function AuthScreen({ navigation }: Props) {
  const { login } = useGame();
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('⚔️');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleEnter() {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }
    if (trimmed.length > 16) {
      setError('Username must be 16 characters or less');
      return;
    }
    setError('');
    setLoading(true);
    await login(trimmed, selectedAvatar);
    setLoading(false);
    navigation.replace('Main');
  }

  return (
    <LinearGradient colors={['#1a0a2e', '#0a0a1a']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.bolt}>⚡</Text>
            <Text style={styles.title}>CLASH</Text>
            <Text style={styles.subtitle}>Choose your identity</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>YOUR NAME</Text>
            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              placeholder="Enter username..."
              placeholderTextColor={COLORS.textMuted}
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                setError('');
              }}
              maxLength={16}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>YOUR AVATAR</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.avatarOption,
                    selectedAvatar === emoji && styles.avatarOptionSelected,
                  ]}
                  onPress={() => setSelectedAvatar(emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.avatarEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.previewRow}>
              <LinearGradient
                colors={[COLORS.primary, '#4a43cc']}
                style={styles.previewAvatar}
              >
                <Text style={styles.previewEmoji}>{selectedAvatar}</Text>
              </LinearGradient>
              <View style={styles.previewInfo}>
                <Text style={styles.previewName}>{username || 'Your Name'}</Text>
                <Text style={styles.previewLevel}>⚔️ Level 1 Warrior</Text>
              </View>
            </View>

            <Button
              label="ENTER THE ARENA"
              onPress={handleEnter}
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!username.trim()}
              style={styles.enterBtn}
              icon="⚡"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  bolt: {
    fontSize: 40,
    marginBottom: 4,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 8,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#0f0f22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    color: COLORS.text,
    fontSize: 16,
    padding: 14,
    fontWeight: '600',
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  avatarOption: {
    width: 56,
    height: 56,
    borderRadius: 14,
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
    fontSize: 28,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#0f0f22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  previewAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmoji: {
    fontSize: 26,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  previewLevel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  enterBtn: {
    marginTop: 4,
  },
});
