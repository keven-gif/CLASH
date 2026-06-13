import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap, Sword, Shield, Sparkles, Loader, AlertCircle } from 'lucide-react';
import { useGameStore, CHARACTERS, STAGES } from '@/store/gameStore';
import type { Character } from '@/store/gameStore';
import { audioManager } from '@/audio/AudioManager';
import { supabase } from '@/supabase/client';

// ─── Stat Bar ────────────────────────────────────────────────────────

function StatBar({ label, value, maxValue, color, icon }: {
  label: string; value: number; maxValue: number; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-secondary w-4 flex-shrink-0">{icon}</span>
      <span className="font-rajdhani font-semibold text-[11px] text-text-secondary w-7 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${(value / maxValue) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <span className="font-rajdhani font-bold text-[11px] text-text-primary w-4 text-right">{value}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function CharacterSelect() {
  const navigate = useNavigate();

  // Use individual selectors so unrelated store updates don't restart the poll effect
  const player1Character = useGameStore(s => s.player1Character);
  const player2Character = useGameStore(s => s.player2Character);
  const selectCharacter  = useGameStore(s => s.selectCharacter);
  const onlineMode       = useGameStore(s => s.onlineMode);
  const isHost           = useGameStore(s => s.isHost);
  const matchOpponent    = useGameStore(s => s.matchOpponent);

  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Online-mode state
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [opponentCharId, setOpponentCharId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [writeError, setWriteError] = useState('');
  const [pendingChar, setPendingChar] = useState<Character | null>(null);

  useEffect(() => {
    audioManager.playMusic('music-title');
  }, []);

  const navigatedRef = useRef(false);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Online: DB poll — reads opponent's row every 1.5s ──────────────
  useEffect(() => {
    if (!onlineMode || !matchOpponent) return;

    // 45-second timeout — if opponent vanishes, return to lobby
    timeoutRef.current = setTimeout(() => {
      if (!navigatedRef.current) {
        clearInterval(pollRef.current!);
        setStatusMsg('Opponent disconnected. Returning to lobby...');
        setTimeout(() => navigate('/lobby'), 2500);
      }
    }, 45_000);

    pollRef.current = setInterval(async () => {
      if (navigatedRef.current) return;
      const opponentId = useGameStore.getState().matchOpponent?.id;
      if (!opponentId) return;

      const { data, error } = await supabase
        .from('match_queue')
        .select('webrtc_offer')
        .eq('player_id', opponentId)
        .maybeSingle();   // maybeSingle returns null instead of error when no row

      if (error) {
        console.warn('[CharSelect] poll error:', error.code, error.message);
        return;
      }
      if (!data?.webrtc_offer) return;

      let payload: any;
      try { payload = JSON.parse(data.webrtc_offer); }
      catch { return; }

      if (payload?.charId) {
        setOpponentCharId(payload.charId);
        setOpponentReady(true);
      }

      if (payload?.start && !navigatedRef.current) {
        navigatedRef.current = true;
        clearInterval(pollRef.current!);
        clearTimeout(timeoutRef.current!);

        // CLIENT: host wrote p1=host char, p2=client char.
        // Swap so local player is always P1 — GameLoop maps local-input→P1, remote-input→P2.
        const myChar  = CHARACTERS.find(c => c.id === payload.p2CharId); // our char
        const oppChar = CHARACTERS.find(c => c.id === payload.p1CharId); // host's char
        if (myChar)  selectCharacter(1, myChar);
        if (oppChar) selectCharacter(2, oppChar);
        const stage = STAGES.find(s => s.id === payload.stageId) ?? STAGES[0];
        useGameStore.getState().selectStage(stage);
        navigate('/play');
      }
    }, 1500);

    return () => {
      clearInterval(pollRef.current!);
      clearTimeout(timeoutRef.current!);
    };
  // matchOpponent.id is stable (set once in LobbyScreen) — safe to use as primitive dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineMode, matchOpponent?.id]);

  // ── Write character to DB, set ready only on success ───────────────
  const writeCharacter = useCallback(async (char: Character) => {
    const myId = useGameStore.getState().user?.id;
    if (!myId) { setWriteError('Not logged in — refresh and try again'); return; }

    setWriteError('');
    setPendingChar(char);

    const { error } = await supabase
      .from('match_queue')
      .update({ webrtc_offer: JSON.stringify({ charId: char.id }) })
      .eq('player_id', myId);

    if (error) {
      console.error('[CharSelect] char write failed:', error.message);
      setWriteError('Could not save selection — tap to retry');
      setPendingChar(null);
      return;
    }

    setPendingChar(null);
    selectCharacter(1, char);
    setMyReady(true);
    setStatusMsg('Waiting for opponent...');
  }, [selectCharacter]);

  // ─── Offline: pick CPU ────────────────────────────────────────────
  const handleSelect = useCallback((char: Character) => {
    if (myReady) return;
    if (onlineMode) {
      writeCharacter(char);
    } else {
      selectCharacter(1, char);
      const others = CHARACTERS.filter(c => c.id !== char.id);
      selectCharacter(2, others[Math.floor(Math.random() * others.length)]);
    }
  }, [onlineMode, myReady, writeCharacter, selectCharacter]);

  // ─── Host starts the match ────────────────────────────────────────
  const handleHostStart = useCallback(async () => {
    if (!isHost || !player1Character || !opponentCharId) return;
    if (navigatedRef.current) return;

    const stageId = 'battlefield';
    const myId = useGameStore.getState().user?.id;
    if (!myId) return;

    setStatusMsg('Starting match...');

    const { error } = await supabase.from('match_queue')
      .update({ webrtc_offer: JSON.stringify({
        charId: player1Character.id,
        start: true,
        p1CharId: player1Character.id,
        p2CharId: opponentCharId,
        stageId,
      })})
      .eq('player_id', myId);

    if (error) {
      setStatusMsg('Failed to start — tap START again');
      console.error('[CharSelect] start write failed:', error.message);
      return;
    }

    navigatedRef.current = true;
    clearInterval(pollRef.current!);
    clearTimeout(timeoutRef.current!);

    // Host: P1 = own char, P2 = client char (opponent)
    const p2 = CHARACTERS.find(c => c.id === opponentCharId);
    if (p2) selectCharacter(2, p2);
    const stage = STAGES.find(s => s.id === stageId) ?? STAGES[0];
    useGameStore.getState().selectStage(stage);
    navigate('/play');
  }, [isHost, player1Character, opponentCharId, selectCharacter, navigate]);

  // ─── Offline fight ────────────────────────────────────────────────
  const handleFight = useCallback(() => {
    if (player1Character) navigate('/stage');
  }, [navigate, player1Character]);

  const prev = () => setActiveIndex(i => (i - 1 + CHARACTERS.length) % CHARACTERS.length);
  const next = () => setActiveIndex(i => (i + 1) % CHARACTERS.length);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  const char = CHARACTERS[activeIndex];
  const isSaving    = pendingChar !== null;
  const isLocalReady = onlineMode ? myReady : player1Character !== null;
  const bothReady   = onlineMode
    ? (myReady && opponentReady)
    : (player1Character !== null && player2Character !== null);
  const opponentChar = opponentCharId ? CHARACTERS.find(c => c.id === opponentCharId) : null;

  return (
    <div className="relative w-screen h-screen bg-void overflow-hidden select-none flex flex-col">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="h-14 flex-shrink-0 flex items-center px-4 relative z-50">
        {!onlineMode && (
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-full text-text-secondary active:text-text-primary"
          >
            <ChevronLeft size={26} />
          </button>
        )}
        <h1 className="absolute left-1/2 -translate-x-1/2 font-orbitron font-bold text-[18px] tracking-widest text-text-primary">
          {onlineMode ? 'PICK YOUR FIGHTER' : 'CHOOSE YOUR FIGHTER'}
        </h1>
        {onlineMode && (
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${opponentReady ? 'bg-accent-cyan' : 'bg-text-muted animate-pulse'}`} />
            <span className="font-rajdhani text-[11px] text-text-muted">
              {matchOpponent?.username ?? 'Opponent'}: {opponentReady ? 'ready' : 'picking...'}
            </span>
          </div>
        )}
      </div>

      {/* ─── Carousel ────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 relative flex flex-col overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Character card — fixed height so buttons are always visible */}
        <div className="relative mx-4 rounded-2xl overflow-hidden border-2 transition-all duration-300"
          style={{
            height: 'min(52vh, 340px)',
            borderColor: char.accentColor + '99',
            boxShadow: `0 0 32px ${char.accentColor}30`,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={char.id}
              className="absolute inset-0"
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.2 }}
            >
              <img src={char.image} alt={char.name} className="w-full h-full object-cover object-top" draggable={false} />
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(to bottom, transparent 30%, rgba(5,5,7,0.6) 58%, rgba(5,5,7,0.96) 100%)',
              }} />

              <div className="absolute bottom-0 left-0 right-0 px-3 pt-2 pb-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-orbitron font-black text-[22px] text-text-primary leading-none">
                    {char.name.toUpperCase()}
                  </h2>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full font-rajdhani font-semibold text-[10px] tracking-widest"
                    style={{ backgroundColor: char.accentColor + '25', color: char.accentColor, border: `1px solid ${char.accentColor}50` }}
                  >
                    {char.archetype.toUpperCase()}
                  </span>
                  {isLocalReady && player1Character?.id === char.id && (
                    <span className="font-rajdhani font-bold text-[10px] tracking-widest ml-auto" style={{ color: char.accentColor }}>
                      ✓ SELECTED
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <StatBar label="SPD" value={char.stats.speed}   maxValue={5} color={char.accentColor} icon={<Zap size={11}/>} />
                  <StatBar label="PWR" value={char.stats.power}   maxValue={5} color={char.accentColor} icon={<Sword size={11}/>} />
                  <StatBar label="DEF" value={char.stats.defense} maxValue={5} color={char.accentColor} icon={<Shield size={11}/>} />
                  <StatBar label="SPC" value={char.stats.special} maxValue={5} color={char.accentColor} icon={<Sparkles size={11}/>} />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-20"
            style={{ backgroundColor: 'rgba(10,10,15,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ChevronLeft size={18} className="text-white" />
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-20"
            style={{ backgroundColor: 'rgba(10,10,15,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>

        {/* Thumbnails */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2">
          {CHARACTERS.map((c, i) => (
            <button
              key={c.id}
              onClick={() => !myReady && setActiveIndex(i)}
              className="relative rounded-lg overflow-hidden transition-all duration-200 flex-shrink-0"
              style={{
                width: i === activeIndex ? 42 : 32,
                height: i === activeIndex ? 42 : 32,
                border: `2px solid ${i === activeIndex ? c.accentColor : '#2A2A3A'}`,
                boxShadow: i === activeIndex ? `0 0 10px ${c.accentColor}60` : 'none',
                opacity: myReady && player1Character?.id !== c.id && opponentCharId !== c.id ? 0.4 : 1,
              }}
            >
              <img src={c.image} alt={c.name} className="w-full h-full object-cover object-top" draggable={false} />
              {player1Character?.id === c.id && myReady && (
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-accent-cyan border border-void" />
              )}
              {opponentCharId === c.id && (
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#E81D2D] border border-void" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Action Bar ──────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pb-3 pt-1 space-y-1.5 z-40">

        {/* DB write error — tapping retries */}
        {writeError && (
          <button
            onClick={() => pendingChar === null && player1Character && writeCharacter(player1Character)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#E81D2D]/15 border border-[#E81D2D]/40"
          >
            <AlertCircle size={14} className="text-[#E81D2D] flex-shrink-0" />
            <span className="font-rajdhani text-[12px] text-[#E81D2D]">{writeError}</span>
          </button>
        )}

        {/* VS row */}
        <AnimatePresence>
          {bothReady && (
            <motion.div
              className="flex items-center justify-center gap-3"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            >
              {player1Character && (
                <img src={player1Character.image} alt="" className="w-8 h-8 rounded-lg object-cover object-top border-2" style={{ borderColor: player1Character.accentColor }} />
              )}
              <span className="font-rajdhani font-bold text-[11px]" style={{ color: player1Character?.accentColor }}>
                {onlineMode ? 'YOU' : player1Character?.name}
              </span>
              <span className="font-orbitron font-black text-[14px] text-text-secondary">VS</span>
              <span className="font-rajdhani font-bold text-[11px]" style={{ color: onlineMode ? '#E81D2D' : player2Character?.accentColor }}>
                {onlineMode ? (matchOpponent?.username ?? 'Opponent') : player2Character?.name}
              </span>
              {onlineMode && opponentChar ? (
                <img src={opponentChar.image} alt="" className="w-8 h-8 rounded-lg object-cover object-top border-2 border-[#E81D2D]" />
              ) : player2Character ? (
                <img src={player2Character.image} alt="" className="w-8 h-8 rounded-lg object-cover object-top border-2" style={{ borderColor: player2Character.accentColor }} />
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons */}
        <div className="flex gap-3">
          {/* Select button */}
          <motion.button
            onClick={() => !myReady && !isSaving && handleSelect(char)}
            disabled={myReady || isSaving}
            className="flex-1 h-12 rounded-xl font-rajdhani font-bold text-[16px] uppercase tracking-wider border transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              backgroundColor: isLocalReady && player1Character?.id === char.id ? char.accentColor + '20' : 'transparent',
              borderColor: char.accentColor + '60',
              color: char.accentColor,
            }}
            whileTap={{ scale: (myReady || isSaving) ? 1 : 0.96 }}
          >
            {isSaving ? (
              <><Loader size={14} className="animate-spin" /> SAVING...</>
            ) : isLocalReady && player1Character?.id === char.id ? (
              '✓ SELECTED'
            ) : (
              `SELECT ${char.name.toUpperCase()}`
            )}
          </motion.button>

          {/* Online status chips */}
          {onlineMode && myReady && !opponentReady && (
            <div className="h-12 px-4 rounded-xl flex items-center gap-2 bg-bg-elevated border border-border-subtle">
              <Loader size={14} className="text-text-muted animate-spin" />
              <span className="font-rajdhani text-[13px] text-text-muted">Waiting...</span>
            </div>
          )}

          {onlineMode && bothReady && isHost && (
            <motion.button
              onClick={handleHostStart}
              className="h-12 px-6 rounded-xl font-rajdhani font-bold text-[18px] uppercase tracking-wider"
              style={{ backgroundColor: '#00E5D4', color: '#0A0A0F', boxShadow: '0 4px 20px rgba(0,229,212,0.35)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              START →
            </motion.button>
          )}

          {onlineMode && bothReady && !isHost && (
            <div className="h-12 px-4 rounded-xl flex items-center gap-2 bg-accent-cyan/10 border border-accent-cyan/30">
              <Loader size={14} className="text-accent-cyan animate-spin" />
              <span className="font-rajdhani text-[13px] text-accent-cyan">Host starting...</span>
            </div>
          )}

          {/* Offline fight button */}
          {!onlineMode && player1Character && player2Character && (
            <motion.button
              onClick={handleFight}
              className="h-12 px-6 rounded-xl font-rajdhani font-bold text-[18px] uppercase tracking-wider"
              style={{ backgroundColor: '#00E5D4', color: '#0A0A0F', boxShadow: '0 4px 20px rgba(0,229,212,0.35)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              FIGHT →
            </motion.button>
          )}
        </div>

        {statusMsg && (
          <p className="text-center font-rajdhani text-[12px] text-text-muted">{statusMsg}</p>
        )}
      </div>
    </div>
  );
}
