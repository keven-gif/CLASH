import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, WifiOff, User, Loader, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MatchmakingManager } from '@/game/online';
import type { MatchFound, MatchmakingState } from '@/game/online';
import type { Profile } from '@/supabase/client';

export default function QueueScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [state, setState] = useState<MatchmakingState>('idle');
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const mmRef = useRef<MatchmakingManager | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    startSearch();
    return () => { mmRef.current?.destroy(); if (timerRef.current) clearInterval(timerRef.current); };
  }, [user]);

  const startSearch = useCallback(async () => {
    if (!user) return;
    setState('searching');
    setElapsed(0);
    setError('');

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    const mm = new MatchmakingManager();
    mmRef.current = mm;

    mm.onStateChange((s: MatchmakingState) => setState(s));
    mm.onMatchFound((match: MatchFound) => {
      setOpponent(match.opponent);
      // Start countdown before navigating to game
      let c = 3;
      setCountdown(c);
      const cdTimer = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(cdTimer);
          navigate('/select', { state: { onlineMode: true, isHost: match.isHost, opponent: match.opponent } });
        }
      }, 1000);
    });

    try { await mm.startSearch(user); }
    catch (e: any) { setError(e.message || 'Matchmaking failed'); setState('failed'); }
  }, [user, navigate]);

  const handleCancel = useCallback(async () => {
    await mmRef.current?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    navigate('/');
  }, [navigate]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="w-screen h-screen bg-void overflow-hidden select-none flex flex-col items-center justify-center relative">
      {/* Back */}
      <button onClick={handleCancel} className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors z-10">
        <ArrowLeft size={24} />
      </button>

      <AnimatePresence mode="wait">
        {/* SEARCHING */}
        {(state === 'idle' || state === 'searching') && (
          <motion.div key="searching" className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <div className="relative w-32 h-32 mb-6">
              <motion.div className="absolute inset-0 rounded-full border-2 border-accent-cyan/20"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
              <motion.div className="absolute inset-4 rounded-full border-2 border-accent-cyan/30"
                animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe size={40} className="text-accent-cyan" />
              </div>
            </div>
            <h2 className="font-orbitron font-bold text-[20px] text-text-primary mb-2">SEARCHING</h2>
            <p className="font-rajdhani text-[14px] text-text-muted mb-1">Finding an opponent...</p>
            <p className="font-orbitron text-[14px] text-accent-cyan tabular-nums">{formatTime(elapsed)}</p>
            <motion.button onClick={handleCancel}
              className="mt-6 h-10 px-6 rounded-xl border border-border-subtle text-text-secondary font-rajdhani font-semibold tracking-wider hover:border-[#E81D2D] hover:text-[#FF6B6B] transition-colors"
              whileTap={{ scale: 0.95 }}>
              CANCEL
            </motion.button>
          </motion.div>
        )}

        {/* FOUND */}
        {state === 'found' && opponent && (
          <motion.div key="found" className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
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
                <p className="font-rajdhani font-semibold text-[13px] text-text-primary">{opponent.username}</p>
              </div>
            </div>
            <div className="font-orbitron font-black text-[64px] text-accent-cyan">{countdown > 0 ? countdown : 'GO!'}</div>
          </motion.div>
        )}

        {/* CONNECTING */}
        {state === 'connecting' && (
          <motion.div key="connecting" className="flex flex-col items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Loader size={36} className="text-accent-cyan animate-spin mb-4" />
            <h2 className="font-orbitron font-bold text-[16px] text-text-primary">CONNECTING</h2>
            <p className="font-rajdhani text-[13px] text-text-muted mt-1">Establishing P2P connection...</p>
          </motion.div>
        )}

        {/* FAILED */}
        {state === 'failed' && (
          <motion.div key="failed" className="flex flex-col items-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WifiOff size={40} className="text-[#E81D2D] mb-4" />
            <h2 className="font-orbitron font-bold text-[16px] text-[#FF6B6B] mb-2">CONNECTION FAILED</h2>
            <p className="font-rajdhani text-[13px] text-text-muted mb-6 max-w-[280px] text-center">{error || 'Could not connect to opponent'}</p>
            <div className="flex gap-3">
              <button onClick={startSearch} className="h-10 px-6 rounded-xl bg-accent-cyan text-bg-dark font-rajdhani font-bold tracking-wider">RETRY</button>
              <button onClick={handleCancel} className="h-10 px-6 rounded-xl border border-border-subtle text-text-secondary font-rajdhani font-semibold tracking-wider">MENU</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
