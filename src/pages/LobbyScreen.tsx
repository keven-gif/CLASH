import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Globe, Users, Zap, Trophy, Crown,
  User, Wifi, WifiOff, Swords
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MatchmakingManager } from '@/game/online';
import type { MatchFound, MatchmakingState } from '@/game/online';
import { CHARACTERS, useGameStore } from '@/store/gameStore';
import { RealtimeChannel } from '@/game/online/RealtimeChannel';

type Screen = 'menu' | 'searching' | 'room' | 'playing' | 'results';
type Tab = 'play' | 'rooms' | 'leaderboard' | 'settings';


export default function LobbyScreen() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { setOnlineMode, setIsHost, setMatchOpponent, setMatchChannel, setUser, user: storeUser } = useGameStore();

  // MatchmakingManager & WebSocket
  const mmRef = useRef<MatchmakingManager | null>(null);
  const matchFoundRef = useRef(false);
  const opponentReadyRef = useRef(false);
  const [mmState, setMmState] = useState<MatchmakingState>('idle');

  // UI State
  const [screen, setScreen] = useState<Screen>('menu');
  const [activeTab, setActiveTab] = useState<Tab>('play');
  const [opponent, setOpponent] = useState<MatchFound | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('assassin');
  useEffect(() => { selectedCharacterRef.current = selectedCharacter; }, [selectedCharacter]);
  const [isReady, setIsReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false); // tracked separately to avoid effect overwrite
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedCharacterRef = useRef(selectedCharacter);

  // ── Actions ──────────────────────────────────────────────────────
  const handleQuickMatch = useCallback(async () => {
    if (!user) { navigate('/auth?redirect=/lobby'); return; }

    setError('');
    setElapsed(0);
    setIsReady(false);
    setOpponent(null);
    setScreen('searching');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    // Destroy any existing matchmaking connection before creating a new one
    mmRef.current?.destroy();

    const mm = new MatchmakingManager();
    mmRef.current = mm;

    mm.onStateChange((s: MatchmakingState) => {
      setMmState(s);
      if (s === 'found') setScreen('room');
      if (s === 'ready') setScreen('room');
    });

    mm.onMatchFound((match: MatchFound) => {
      setOpponent(match);
      if (timerRef.current) clearInterval(timerRef.current);
      // Save auth user to game store so CharacterSelect can access it
      if (user) setUser(user);

      // Create the shared realtime channel NOW so both players can use it to sync ready state
      const myId = storeUser?.id ?? user!.id;
      const matchId = [myId, match.opponent.id].sort().join('_');
      const ch = new RealtimeChannel(matchId, myId);
      setMatchChannel(ch);

      // Listen for opponent's ready signal
      ch.onEvent('player_ready', () => {
        setOpponentReady(true);
        opponentReadyRef.current = true;

        // If we're already ready AND we're host, send go signal now
        if (match.isHost) {
          setIsReady(alreadyReady => {
            if (alreadyReady && !matchFoundRef.current) {
              setTimeout(() => {
                ch.sendEvent('lobby_go', {});
                if (!matchFoundRef.current) {
                  matchFoundRef.current = true;
                  setOnlineMode(true);
                  setIsHost(true);
                  setMatchOpponent(match.opponent);
                  navigate('/select');
                }
              }, 300);
            }
            return alreadyReady;
          });
        }
      });

      // Listen for host's "go to character select" signal
      ch.onEvent('lobby_go', () => {
        if (matchFoundRef.current) return;
        matchFoundRef.current = true;
        setOnlineMode(true);
        setIsHost(match.isHost);
        setMatchOpponent(match.opponent);
        navigate('/select');
      });
    });

    try { await mm.startSearch(user); }
    catch (e: any) { setError(e.message || 'Matchmaking failed'); setScreen('menu'); }
  }, [user, navigate]);

  const handleCancel = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cdTimerRef.current) clearInterval(cdTimerRef.current);
    if (!matchFoundRef.current) await mmRef.current?.cancel();
    setOpponent(null);
    setIsReady(false);
    setOpponentReady(false);
    opponentReadyRef.current = false;
    setScreen('menu');
  }, []);

  const handleCreateRoom = useCallback(() => {
    // For now, custom rooms via Supabase are not implemented — redirect to quick match
    setError('Custom rooms coming soon. Try Quick Match!');
    setTimeout(() => setError(''), 4000);
  }, []);

  const handleJoinRoom = useCallback(() => {
    setError('Room codes not yet available. Try Quick Match!');
    setTimeout(() => setError(''), 4000);
  }, []);

  const handleReady = useCallback(() => {
    const ch = useGameStore.getState().matchChannel;
    if (!ch || !opponent) return;

    const nowReady = !isReady;
    setIsReady(nowReady);

    if (nowReady) {
      // Broadcast our ready state to opponent
      ch.sendEvent('player_ready', {});

      // If opponent is already ready too, host fires the go signal
      if (opponentReadyRef.current && opponent.isHost) {
        // Small delay to let the channel settle
        setTimeout(() => {
          ch.sendEvent('lobby_go', {});
          if (!matchFoundRef.current) {
            matchFoundRef.current = true;
            setOnlineMode(true);
            setIsHost(true);
            setMatchOpponent(opponent.opponent);
            navigate('/select');
          }
        }, 300);
      }
    }
  }, [isReady, opponent, navigate, setOnlineMode, setIsHost, setMatchOpponent]);

  const handleLeave = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cdTimerRef.current) clearInterval(cdTimerRef.current);
    if (!matchFoundRef.current) await mmRef.current?.cancel();
    setScreen('menu');
    setIsReady(false);
    setOpponentReady(false);
    opponentReadyRef.current = false;
    setOpponent(null);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Connection status indicator derived from mm state ────────────
  const getStatusDot = () => {
    switch (mmState) {
      case 'idle': return 'bg-text-muted';
      case 'searching': return 'bg-[#FFB800] animate-pulse';
      case 'found':
      case 'connecting': return 'bg-[#4DA6FF] animate-pulse';
      case 'ready': return 'bg-accent-cyan';
      case 'failed': return 'bg-[#E81D2D]';
      default: return 'bg-text-muted';
    }
  };

  const getStatusIcon = () => {
    switch (mmState) {
      case 'idle': return <WifiOff size={18} className="text-text-muted" />;
      case 'searching': return <Wifi size={18} className="text-[#FFB800] animate-pulse" />;
      case 'found':
      case 'connecting': return <Wifi size={18} className="text-[#4DA6FF]" />;
      case 'ready': return <Wifi size={18} className="text-accent-cyan" />;
      case 'failed': return <WifiOff size={18} className="text-[#E81D2D]" />;
      default: return <WifiOff size={18} className="text-text-muted" />;
    }
  };

  const getStatusLabel = () => {
    switch (mmState) {
      case 'idle': return 'idle';
      case 'searching': return 'searching';
      case 'found': return 'found';
      case 'connecting': return 'connecting';
      case 'ready': return 'ready';
      case 'failed': return 'failed';
      default: return mmState;
    }
  };

  // ── Redirect unauthenticated ─────────────────────────────────────
  useEffect(() => {
    // Only redirect after auth state has finished loading
    if (!authLoading && !user) navigate('/auth?redirect=/lobby');
  }, [user, authLoading, navigate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (cdTimerRef.current) clearInterval(cdTimerRef.current);
      // Don't delete match_queue rows if a match was found — CharacterSelect
      // needs those rows to sync character selections between players
      if (!matchFoundRef.current) mmRef.current?.destroy();
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────
  if (!user) return null;

  return (
    <div className="w-screen bg-void overflow-hidden select-none flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="h-14 flex-shrink-0 flex items-center px-4 border-b border-border-subtle relative z-10">
        <button onClick={() => { handleLeave(); navigate('/'); }} className="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
          <ArrowLeft size={22} />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          {getStatusIcon()}
          <h1 className="font-orbitron font-bold text-[18px] tracking-wide text-text-primary">ONLINE</h1>
          {mmState === 'searching' && (
            <span className="font-rajdhani text-[11px] text-text-muted ml-1">{formatTime(elapsed)}</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusDot()}`} />
          <span className="font-rajdhani text-[12px] text-text-muted capitalize">{getStatusLabel()}</span>
        </div>
      </header>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="bg-[#E81D2D20] border-b border-[#E81D2D40] px-4 py-2 text-center"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <span className="font-rajdhani text-[13px] text-[#FF6B6B]">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* ── MENU SCREEN ── */}
          {screen === 'menu' && (
            <motion.div
              key="menu"
              className="h-full flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              {/* Tabs */}
              <div className="flex border-b border-border-subtle">
                {(['play', 'rooms', 'leaderboard', 'settings'] as Tab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 font-rajdhani font-semibold text-[14px] uppercase tracking-wider transition-colors ${
                      activeTab === tab ? 'text-accent-cyan border-b-2 border-accent-cyan' : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'play' && (
                  <div className="space-y-3 max-w-[480px] mx-auto">
                    {/* Quick Match */}
                    <motion.button
                      onClick={handleQuickMatch}
                      className="w-full bg-gradient-to-r from-accent-cyan/20 to-accent-cyan/5 border border-accent-cyan/30 rounded-2xl p-5 text-left hover:border-accent-cyan/60 transition-colors"
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent-cyan/20 flex items-center justify-center">
                          <Zap size={24} className="text-accent-cyan" />
                        </div>
                        <div>
                          <h3 className="font-orbitron font-bold text-[16px] text-text-primary">QUICK MATCH</h3>
                          <p className="font-rajdhani text-[13px] text-text-muted">Jump into a match instantly</p>
                        </div>
                      </div>
                    </motion.button>

                    {/* Create Room */}
                    <motion.button
                      onClick={handleCreateRoom}
                      className="w-full bg-bg-elevated border border-border-subtle rounded-2xl p-5 text-left hover:border-border-hover transition-colors"
                      whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-bg-dark flex items-center justify-center">
                          <Crown size={24} className="text-[#FFB800]" />
                        </div>
                        <div>
                          <h3 className="font-orbitron font-bold text-[16px] text-text-primary">CREATE ROOM</h3>
                          <p className="font-rajdhani text-[13px] text-text-muted">Host a custom match</p>
                        </div>
                      </div>
                    </motion.button>

                    {/* Join Room */}
                    <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-5">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-bg-dark flex items-center justify-center">
                          <Users size={24} className="text-[#4DA6FF]" />
                        </div>
                        <div>
                          <h3 className="font-orbitron font-bold text-[16px] text-text-primary">JOIN ROOM</h3>
                          <p className="font-rajdhani text-[13px] text-text-muted">Enter a room code</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={joinCode}
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                          placeholder="ABCD"
                          maxLength={6}
                          className="flex-1 h-11 px-4 rounded-xl bg-bg-dark border border-border-subtle text-text-primary font-orbitron text-[14px] tracking-widest uppercase placeholder:text-text-muted placeholder:tracking-normal focus:border-accent-cyan focus:outline-none transition-colors"
                        />
                        <button
                          onClick={handleJoinRoom}
                          className="h-11 px-5 rounded-xl bg-accent-cyan text-bg-dark font-rajdhani font-bold tracking-wider"
                        >
                          JOIN
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'rooms' && (
                  <div className="max-w-[480px] mx-auto text-center py-12">
                    <Globe size={40} className="text-text-muted mx-auto mb-3" />
                    <p className="font-orbitron text-[14px] text-text-secondary">Public Rooms</p>
                    <p className="font-rajdhani text-[13px] text-text-muted mt-1">Feature coming soon</p>
                  </div>
                )}

                {activeTab === 'leaderboard' && (
                  <div className="max-w-[480px] mx-auto text-center py-12">
                    <Trophy size={40} className="text-[#FFB800] mx-auto mb-3" />
                    <p className="font-orbitron text-[14px] text-text-secondary">Global Leaderboard</p>
                    <p className="font-rajdhani text-[13px] text-text-muted mt-1">Season 1 starts soon</p>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="max-w-[480px] mx-auto space-y-3">
                    <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-4">
                      <h3 className="font-orbitron font-bold text-[14px] text-text-secondary mb-3">CONNECTION</h3>
                      <div className="flex justify-between items-center">
                        <span className="font-rajdhani text-[13px] text-text-muted">Backend</span>
                        <span className="font-rajdhani text-[13px] text-accent-cyan">Supabase</span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-rajdhani text-[13px] text-text-muted">Matchmaking</span>
                        <span className={`font-rajdhani text-[13px] capitalize ${mmState === 'searching' ? 'text-[#FFB800]' : 'text-accent-cyan'}`}>{getStatusLabel()}</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => { await signOut(); navigate('/'); }}
                      className="w-full h-11 rounded-xl border border-[#E81D2D40] text-[#FF6B6B] font-rajdhani font-bold tracking-wider hover:bg-[#E81D2D10] transition-colors"
                    >
                      SIGN OUT
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── SEARCHING / ROOM SCREEN ── */}
          {(screen === 'searching' || screen === 'room') && (
            <motion.div
              key="room"
              className="h-full flex flex-col"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            >
              {/* Status bar */}
              <div className="flex-shrink-0 px-4 pt-3 pb-2 flex items-center justify-between">
                <div>
                  <p className="font-rajdhani text-[10px] text-text-muted uppercase tracking-widest">Matchmaking</p>
                  <p className="font-orbitron font-bold text-[16px] text-accent-cyan tracking-wider">
                    {mmState === 'searching' ? 'SEARCHING...' : 'MATCH FOUND'}
                  </p>
                </div>
                <p className="font-orbitron font-bold text-[22px] text-text-primary">
                  {mmState === 'searching' ? '1' : '2'}<span className="text-text-muted text-[14px]">/2</span>
                </p>
              </div>

              {/* ── SEARCHING: radar ── */}
              {mmState === 'searching' && !opponent && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <div className="relative w-28 h-28">
                    <motion.div className="absolute inset-0 rounded-full border-2 border-accent-cyan/20"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }} />
                    <motion.div className="absolute inset-4 rounded-full border-2 border-accent-cyan/30"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Globe size={36} className="text-accent-cyan" />
                    </div>
                  </div>
                  <p className="font-rajdhani text-[13px] text-text-muted">Finding an opponent...</p>
                  <p className="font-orbitron text-[13px] text-accent-cyan tabular-nums">{formatTime(elapsed)}</p>
                </div>
              )}

              {/* ── MATCH FOUND: compact mobile layout ── */}
              {opponent && (
                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 flex flex-col">

                  {/* VS row */}
                  <motion.div
                    className="flex items-center justify-center gap-4 py-3"
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="text-center flex-1">
                      <div className="w-12 h-12 rounded-full bg-accent-cyan/20 border-2 border-accent-cyan flex items-center justify-center mx-auto mb-1">
                        <User size={20} className="text-accent-cyan" />
                      </div>
                      <p className="font-rajdhani font-semibold text-[11px] text-text-primary truncate max-w-[90px] mx-auto">{user?.username}</p>
                    </div>
                    <span className="font-orbitron font-black text-[20px] text-text-muted flex-shrink-0">VS</span>
                    <div className="text-center flex-1">
                      <div className="w-12 h-12 rounded-full bg-[#E81D2D]/20 border-2 border-[#E81D2D] flex items-center justify-center mx-auto mb-1">
                        <User size={20} className="text-[#E81D2D]" />
                      </div>
                      <p className="font-rajdhani font-semibold text-[11px] text-text-primary truncate max-w-[90px] mx-auto">{opponent.opponent.username}</p>
                    </div>
                  </motion.div>

                  {/* Player ready cards — 2 side by side, NO empty slots */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Me */}
                    <motion.div
                      className={`rounded-2xl p-3 text-center border-2 transition-colors ${isReady ? 'border-accent-cyan bg-accent-cyan/10' : 'border-border-subtle bg-bg-elevated'}`}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    >
                      {(() => { const char = CHARACTERS.find(c => c.id === selectedCharacter); return (
                        <div className="w-14 h-14 rounded-full mx-auto mb-2 overflow-hidden border-2" style={{ borderColor: char?.accentColor || '#00E5D4' }}>
                          {char && <img src={char.image} alt="" className="w-full h-full object-cover object-top" />}
                        </div>
                      ); })()}
                      <p className="font-rajdhani font-semibold text-[12px] text-text-primary truncate">{user?.username}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {opponent.isHost && <Crown size={9} className="text-[#FFB800]" />}
                        <span className={`font-rajdhani text-[10px] uppercase tracking-wider font-bold ${isReady ? 'text-accent-cyan' : 'text-text-muted'}`}>
                          {isReady ? '✓ READY' : 'NOT READY'}
                        </span>
                      </div>
                    </motion.div>

                    {/* Opponent */}
                    <motion.div
                      className={`rounded-2xl p-3 text-center border-2 transition-colors ${opponentReady ? 'border-accent-cyan bg-accent-cyan/10' : 'border-border-subtle bg-bg-elevated'}`}
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
                    >
                      <div className="w-14 h-14 rounded-full mx-auto mb-2 bg-[#E81D2D]/20 border-2 border-[#E81D2D] flex items-center justify-center">
                        <User size={22} className="text-[#E81D2D]" />
                      </div>
                      <p className="font-rajdhani font-semibold text-[12px] text-text-primary truncate">{opponent.opponent.username}</p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        {!opponent.isHost && <Crown size={9} className="text-[#FFB800]" />}
                        <span className={`font-rajdhani text-[10px] uppercase tracking-wider font-bold ${opponentReady ? 'text-accent-cyan' : 'text-text-muted'}`}>
                          {opponentReady ? '✓ READY' : 'NOT READY'}
                        </span>
                      </div>
                    </motion.div>
                  </div>

                  {/* Character picker */}
                  <div className="mb-3">
                    <p className="font-rajdhani text-[10px] text-text-muted uppercase tracking-widest mb-2">Select Character</p>
                    <div className="flex gap-2 justify-center">
                      {CHARACTERS.map(char => (
                        <button
                          key={char.id}
                          onClick={() => setSelectedCharacter(char.id)}
                          className="rounded-xl overflow-hidden border-2 transition-all active:scale-90"
                          style={{
                            width: selectedCharacter === char.id ? 52 : 42,
                            height: selectedCharacter === char.id ? 52 : 42,
                            borderColor: selectedCharacter === char.id ? char.accentColor : 'transparent',
                            opacity: selectedCharacter === char.id ? 1 : 0.55,
                          }}
                        >
                          <img src={char.image} alt={char.name} className="w-full h-full object-cover object-top" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status hint */}
                  {isReady && !opponentReady && (
                    <p className="text-center font-rajdhani text-[12px] text-text-muted animate-pulse">
                      Waiting for opponent to ready up...
                    </p>
                  )}
                  {isReady && opponentReady && (
                    <p className="text-center font-rajdhani text-[12px] text-accent-cyan font-semibold">
                      Both ready! Starting...
                    </p>
                  )}
                </div>
              )}

              {/* Action Bar — always visible at bottom */}
              <div className="flex-shrink-0 px-4 pb-safe-bottom" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                {opponent ? (
                  <div className="flex gap-3">
                    <motion.button
                      onClick={handleCancel}
                      className="h-14 px-5 rounded-2xl border border-border-subtle text-text-secondary font-rajdhani font-semibold text-[15px] tracking-wider active:border-[#E81D2D] active:text-[#FF6B6B] transition-colors"
                      whileTap={{ scale: 0.95 }}
                    >
                      LEAVE
                    </motion.button>
                    <motion.button
                      onClick={handleReady}
                      disabled={isReady}
                      className={`flex-1 h-14 rounded-2xl font-rajdhani font-bold text-[18px] uppercase tracking-wider transition-all ${
                        isReady
                          ? 'bg-accent-cyan/20 border-2 border-accent-cyan text-accent-cyan'
                          : 'bg-accent-cyan text-bg-dark'
                      }`}
                      style={{ boxShadow: isReady ? 'none' : '0 4px 20px rgba(0,229,212,0.35)' }}
                      whileTap={{ scale: isReady ? 1 : 0.97 }}
                    >
                      {isReady ? '✓ READY!' : 'READY UP'}
                    </motion.button>
                  </div>
                ) : (
                  <motion.button
                    onClick={handleCancel}
                    className="w-full h-14 rounded-2xl border border-border-subtle text-text-secondary font-rajdhani font-semibold text-[15px] tracking-wider"
                    whileTap={{ scale: 0.95 }}
                  >
                    CANCEL
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {/* ── PLAYING SCREEN ── */}
          {screen === 'playing' && (
            <motion.div
              key="playing"
              className="h-full flex flex-col items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <Swords size={48} className="text-accent-cyan mb-4" />
              <h2 className="font-orbitron font-bold text-[24px] text-text-primary">MATCH IN PROGRESS</h2>
              <p className="font-rajdhani text-[14px] text-text-muted mt-2">Online gameplay rendering here</p>
              <p className="font-rajdhani text-[12px] text-text-muted mt-1">Synced via WebRTC DataChannel</p>
              <button
                onClick={handleLeave}
                className="mt-6 h-10 px-6 rounded-xl border border-[#E81D2D40] text-[#FF6B6B] font-rajdhani font-semibold"
              >
                LEAVE MATCH
              </button>
            </motion.div>
          )}

          {/* ── RESULTS SCREEN ── */}
          {screen === 'results' && (
            <motion.div
              key="results"
              className="h-full flex flex-col items-center justify-center p-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <Trophy size={48} className="text-[#FFB800] mb-4" />
              <h2 className="font-orbitron font-bold text-[24px] text-text-primary mb-6">MATCH RESULTS</h2>

              <p className="font-rajdhani text-[13px] text-text-muted">Match complete</p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setScreen('menu'); setIsReady(false); }}
                  className="h-11 px-6 rounded-xl bg-accent-cyan text-bg-dark font-rajdhani font-bold tracking-wider"
                >
                  PLAY AGAIN
                </button>
                <button
                  onClick={() => { handleLeave(); navigate('/'); }}
                  className="h-11 px-6 rounded-xl border border-border-subtle text-text-secondary font-rajdhani font-semibold"
                >
                  MENU
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
