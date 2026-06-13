import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Globe, Users, Zap, Trophy, Crown,
  Send, User, Wifi, WifiOff, Loader, Shield, Swords
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MatchmakingManager } from '@/game/online';
import type { MatchFound, MatchmakingState } from '@/game/online';
import { CHARACTERS, useGameStore } from '@/store/gameStore';

type Screen = 'menu' | 'searching' | 'room' | 'playing' | 'results';
type Tab = 'play' | 'rooms' | 'leaderboard' | 'settings';

interface LobbyPlayer {
  playerId: string;
  username: string;
  character: string;
  ready: boolean;
  isHost: boolean;
}

export default function LobbyScreen() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const { selectCharacter, setOnlineMode } = useGameStore();

  // MatchmakingManager & WebSocket
  const mmRef = useRef<MatchmakingManager | null>(null);
  const [mmState, setMmState] = useState<MatchmakingState>('idle');

  // UI State
  const [screen, setScreen] = useState<Screen>('menu');
  const [activeTab, setActiveTab] = useState<Tab>('play');
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [opponent, setOpponent] = useState<MatchFound | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('assassin');
  useEffect(() => { selectedCharacterRef.current = selectedCharacter; }, [selectedCharacter]);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [chatMessages, setChatMessages] = useState<{ playerId: string; username: string; message: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const matchResults: any[] = [];
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedCharacterRef = useRef(selectedCharacter);

  // ── Build lobby players from match state ─────────────────────────
  useEffect(() => {
    if (!user) return;

    const me: LobbyPlayer = {
      playerId: user.id,
      username: user.username,
      character: selectedCharacter,
      ready: isReady,
      isHost: opponent?.isHost ?? true,
    };

    if (opponent && (mmState === 'found' || mmState === 'connecting' || mmState === 'ready')) {
      const opp: LobbyPlayer = {
        playerId: opponent.opponent.id,
        username: opponent.opponent.username,
        character: 'swordsman',
        ready: true,
        isHost: !opponent.isHost,
      };
      setLobbyPlayers([me, opp]);
    } else if (mmState === 'searching') {
      setLobbyPlayers([me]);
    } else {
      setLobbyPlayers([]);
    }
  }, [user, opponent, mmState, selectedCharacter, isReady]);

  // ── Actions ──────────────────────────────────────────────────────
  const handleQuickMatch = useCallback(async () => {
    if (!user) { navigate('/auth?redirect=/lobby'); return; }

    setError('');
    setElapsed(0);
    setIsReady(false);
    setOpponent(null);
    setChatMessages([]);
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

      // Countdown 3-2-1 before navigating to game
      let c = 3;
      setCountdown(c);
      cdTimerRef.current = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0) {
          if (cdTimerRef.current) clearInterval(cdTimerRef.current);
          const chosenChar = CHARACTERS.find(ch => ch.id === selectedCharacterRef.current) ?? CHARACTERS[0];
          selectCharacter(1, chosenChar);
          setOnlineMode(true);
          navigate('/select', { state: { onlineMode: true, isHost: match.isHost, opponent: match.opponent } });
        }
      }, 1000);
    });

    try { await mm.startSearch(user); }
    catch (e: any) { setError(e.message || 'Matchmaking failed'); setScreen('menu'); }
  }, [user, navigate]);

  const handleCancel = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cdTimerRef.current) clearInterval(cdTimerRef.current);
    await mmRef.current?.cancel();
    setCountdown(0);
    setOpponent(null);
    setIsReady(false);
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
    setIsReady(r => !r);
  }, []);

  const handleSendChat = useCallback(() => {
    if (chatInput.trim() && user) {
      setChatMessages(prev => [...prev, { playerId: user.id, username: user.username, message: chatInput.trim() }]);
      setChatInput('');
    }
  }, [chatInput, user]);

  const handleLeave = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (cdTimerRef.current) clearInterval(cdTimerRef.current);
    await mmRef.current?.cancel();
    setScreen('menu');
    setIsReady(false);
    setLobbyPlayers([]);
    setCountdown(0);
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
      mmRef.current?.destroy();
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────
  if (!user) return null;

  return (
    <div className="w-screen h-screen bg-void overflow-hidden select-none flex flex-col">
      {/* Header */}
      <header className="h-[10vh] flex-shrink-0 flex items-center px-4 border-b border-border-subtle relative z-10">
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
              {/* Room Info */}
              <div className="flex-shrink-0 p-4 border-b border-border-subtle">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-rajdhani text-[11px] text-text-muted uppercase tracking-wider">Matchmaking</p>
                    <div className="flex items-center gap-2">
                      {mmState === 'searching' ? (
                        <span className="font-orbitron font-bold text-[18px] text-[#FFB800] tracking-wider">SEARCHING</span>
                      ) : opponent ? (
                        <span className="font-orbitron font-bold text-[18px] text-accent-cyan tracking-wider">MATCH FOUND</span>
                      ) : (
                        <span className="font-orbitron font-bold text-[24px] text-accent-cyan tracking-widest">----</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-rajdhani text-[11px] text-text-muted uppercase tracking-wider">Players</p>
                    <p className="font-orbitron font-bold text-[18px] text-text-primary">{lobbyPlayers.length}/2</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {/* Searching State - Radar Animation */}
                {mmState === 'searching' && !opponent && (
                  <motion.div
                    className="flex flex-col items-center justify-center py-12 mb-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <div className="relative w-32 h-32 mb-6">
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-accent-cyan/20"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <motion.div
                        className="absolute inset-4 rounded-full border-2 border-accent-cyan/30"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Globe size={40} className="text-accent-cyan" />
                      </div>
                    </div>
                    <h2 className="font-orbitron font-bold text-[20px] text-text-primary mb-2">SEARCHING</h2>
                    <p className="font-rajdhani text-[14px] text-text-muted mb-1">Finding an opponent...</p>
                    <p className="font-orbitron text-[14px] text-accent-cyan tabular-nums">{formatTime(elapsed)}</p>
                  </motion.div>
                )}

                {/* Found State - VS Display */}
                {opponent && (mmState === 'found' || mmState === 'connecting' || mmState === 'ready') && (
                  <motion.div
                    className="flex flex-col items-center justify-center py-8 mb-4"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <h2 className="font-orbitron font-bold text-[16px] text-accent-cyan mb-6">OPPONENT FOUND</h2>
                    <div className="flex items-center gap-6 mb-6">
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-accent-cyan/20 border-2 border-accent-cyan flex items-center justify-center mx-auto mb-2">
                          <User size={24} className="text-accent-cyan" />
                        </div>
                        <p className="font-rajdhani font-semibold text-[13px] text-text-primary">{user?.username || 'You'}</p>
                      </div>
                      <div className="font-orbitron font-black text-[24px] text-text-secondary">VS</div>
                      <div className="text-center">
                        <div className="w-14 h-14 rounded-full bg-[#E81D2D]/20 border-2 border-[#E81D2D] flex items-center justify-center mx-auto mb-2">
                          <User size={24} className="text-[#E81D2D]" />
                        </div>
                        <p className="font-rajdhani font-semibold text-[13px] text-text-primary">{opponent.opponent.username}</p>
                      </div>
                    </div>
                    {mmState === 'connecting' && (
                      <div className="flex items-center gap-2 text-[#4DA6FF]">
                        <Loader size={16} className="animate-spin" />
                        <span className="font-rajdhani text-[13px]">Establishing P2P connection...</span>
                      </div>
                    )}
                    {mmState === 'ready' && (
                      <div className="flex items-center gap-2 text-accent-cyan">
                        <Shield size={16} />
                        <span className="font-rajdhani text-[13px]">Connection ready!</span>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Player List */}
                <div className="grid grid-cols-2 gap-3 max-w-[480px] mx-auto">
                  {lobbyPlayers.map((player, i) => {
                    const char = CHARACTERS.find(c => c.id === player.character);
                    return (
                      <motion.div
                        key={player.playerId}
                        className={`bg-bg-elevated border rounded-2xl p-4 text-center ${
                          player.ready ? 'border-accent-cyan/50' : 'border-border-subtle'
                        }`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <div className="w-14 h-14 rounded-full mx-auto mb-2 overflow-hidden border-2" style={{ borderColor: char?.accentColor || '#00E5D4' }}>
                          {char && <img src={char.image} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <p className="font-rajdhani font-semibold text-[13px] text-text-primary truncate">{player.username}</p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {player.isHost && <Crown size={10} className="text-[#FFB800]" />}
                          <span className={`font-rajdhani text-[10px] uppercase tracking-wider ${player.ready ? 'text-accent-cyan' : 'text-text-muted'}`}>
                            {player.ready ? 'Ready' : 'Not Ready'}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Empty slots */}
                  {Array.from({ length: Math.max(0, 4 - lobbyPlayers.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-bg-elevated/50 border border-dashed border-border-subtle rounded-2xl p-4 text-center">
                      <div className="w-14 h-14 rounded-full mx-auto mb-2 bg-bg-dark/50 flex items-center justify-center">
                        <Users size={20} className="text-text-muted/30" />
                      </div>
                      <p className="font-rajdhani text-[13px] text-text-muted/50">Waiting...</p>
                    </div>
                  ))}
                </div>

                {/* Character Select */}
                <div className="mt-4 max-w-[480px] mx-auto">
                  <p className="font-rajdhani text-[11px] text-text-muted uppercase tracking-wider mb-2">Select Character</p>
                  <div className="flex gap-2">
                    {CHARACTERS.map(char => (
                      <button
                        key={char.id}
                        onClick={() => setSelectedCharacter(char.id)}
                        className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all ${
                          selectedCharacter === char.id ? 'border-accent-cyan scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat */}
                <div className="mt-4 bg-bg-elevated border border-border-subtle rounded-2xl p-3 max-w-[480px] mx-auto">
                  <div className="h-24 overflow-y-auto mb-2 space-y-1">
                    {chatMessages.length === 0 && (
                      <p className="font-rajdhani text-[12px] text-text-muted text-center py-4">No messages yet</p>
                    )}
                    {chatMessages.map((msg, i) => (
                      <p key={i} className="font-rajdhani text-[12px]">
                        <span className="text-accent-cyan font-semibold">{msg.username}:</span>
                        <span className="text-text-secondary ml-1">{msg.message}</span>
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      placeholder="Type a message..."
                      className="flex-1 h-9 px-3 rounded-lg bg-bg-dark border border-border-subtle text-text-primary font-rajdhani text-[13px] placeholder:text-text-muted focus:border-accent-cyan focus:outline-none"
                    />
                    <button onClick={handleSendChat} className="h-9 w-9 rounded-lg bg-accent-cyan flex items-center justify-center text-bg-dark">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex-shrink-0 p-4 border-t border-border-subtle">
                <div className="flex gap-3 max-w-[480px] mx-auto">
                  <motion.button
                    onClick={handleCancel}
                    className="h-12 px-5 rounded-xl border border-border-subtle text-text-secondary font-rajdhani font-semibold tracking-wider hover:border-[#E81D2D] hover:text-[#FF6B6B] transition-colors"
                    whileTap={{ scale: 0.95 }}
                  >
                    {mmState === 'searching' ? 'CANCEL' : 'LEAVE'}
                  </motion.button>
                  {opponent && (
                    <motion.button
                      onClick={handleReady}
                      className={`flex-1 h-12 rounded-xl font-rajdhani font-bold tracking-wider transition-colors ${
                        isReady
                          ? 'bg-accent-cyan text-bg-dark'
                          : 'bg-bg-elevated border border-border-subtle text-text-primary hover:border-accent-cyan'
                      }`}
                      whileTap={{ scale: 0.97 }}
                    >
                      {isReady ? 'READY!' : 'READY UP'}
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── COUNTDOWN OVERLAY ── */}
          {countdown > 0 && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                key={countdown}
                className="font-orbitron font-black text-[120px] text-accent-cyan"
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                {countdown}
              </motion.div>
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

              <div className="w-full max-w-[400px] space-y-2">
                {matchResults.map((result, i) => (
                  <motion.div
                    key={result.playerId}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      result.isWinner ? 'bg-[#FFB800]/10 border-[#FFB800]/30' : 'bg-bg-elevated border-border-subtle'
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span className="font-orbitron font-bold text-[18px] text-text-muted w-6">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-rajdhani font-semibold text-[14px] text-text-primary">{result.username}</p>
                      <p className="font-rajdhani text-[12px] text-text-muted">{result.lives} lives | {result.damage}%</p>
                    </div>
                    {result.isWinner && <Crown size={18} className="text-[#FFB800]" />}
                  </motion.div>
                ))}
              </div>

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
