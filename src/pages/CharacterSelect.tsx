import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap, Sword, Shield, Sparkles, Loader } from 'lucide-react';
import { useGameStore, CHARACTERS, STAGES } from '@/store/gameStore';
import type { Character } from '@/store/gameStore';
import { audioManager } from '@/audio/AudioManager';

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

export default function CharacterSelect() {
  const navigate = useNavigate();

  const player1Character = useGameStore(s => s.player1Character);
  const player2Character = useGameStore(s => s.player2Character);
  const selectCharacter  = useGameStore(s => s.selectCharacter);
  const onlineMode       = useGameStore(s => s.onlineMode);
  const isHost           = useGameStore(s => s.isHost);
  const matchOpponent    = useGameStore(s => s.matchOpponent);
  const matchChannel     = useGameStore(s => s.matchChannel);
  const myPlayerIndex    = useGameStore(s => s.myPlayerIndex);
  const roomPlayers      = useGameStore(s => s.roomPlayers);

  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const navigatedRef = useRef(false);

  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [pickedChars, setPickedChars] = useState<Record<number, string>>({});
  const [opponentCharId, setOpponentCharId] = useState<string | null>(null);
  const [waitingForChannel, setWaitingForChannel] = useState(false);
  const numPlayers = roomPlayers.length >= 2 ? roomPlayers.length : 2;

  useEffect(() => { audioManager.playMusic('music-title'); }, []);

  // Cleanup: disconnect channel if user navigates away before match starts
  useEffect(() => {
    return () => {
      if (!navigatedRef.current && onlineMode) {
        matchChannel?.disconnect();
        useGameStore.getState().setMatchChannel(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!onlineMode || !matchChannel) return;

    matchChannel.onEvent('char_select', (data: { charId: string; playerIndex?: number }) => {
      if (!data?.charId) return;
      const idx = data.playerIndex ?? 1;
      setPickedChars(prev => ({ ...prev, [idx]: data.charId }));
      if (idx !== myPlayerIndex) {
        setOpponentCharId(data.charId);
        setOpponentReady(true);
      }
    });

    matchChannel.onEvent('match_start', (data: { fighters?: { playerIndex: number; charId: string }[]; p1CharId?: string; p2CharId?: string; stageId: string }) => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      if (data.fighters) {
        // Multi-player format
        const myEntry = data.fighters.find(f => f.playerIndex === myPlayerIndex);
        const oppEntry = data.fighters.find(f => f.playerIndex !== myPlayerIndex);
        const myChar  = CHARACTERS.find(c => c.id === myEntry?.charId);
        const oppChar = CHARACTERS.find(c => c.id === oppEntry?.charId);
        if (myChar)  selectCharacter(1, myChar);
        if (oppChar) selectCharacter(2, oppChar);
      } else {
        // Legacy 2-player format
        const myChar  = CHARACTERS.find(c => c.id === data.p2CharId);
        const oppChar = CHARACTERS.find(c => c.id === data.p1CharId);
        if (myChar)  selectCharacter(1, myChar);
        if (oppChar) selectCharacter(2, oppChar);
      }
      const stage = STAGES.find(s => s.id === data.stageId) ?? STAGES[0];
      useGameStore.getState().selectStage(stage);
      navigate('/play');
    });

    if (player1Character) {
      matchChannel.sendEvent('char_select', { charId: player1Character.id, playerIndex: myPlayerIndex });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlineMode, matchChannel]);

  const handleSelect = useCallback((char: Character) => {
    if (myReady) return;
    if (onlineMode) {
      if (!matchChannel) {
        setWaitingForChannel(true);
        const wait = setInterval(() => {
          const ch = useGameStore.getState().matchChannel;
          if (ch) {
            clearInterval(wait);
            setWaitingForChannel(false);
            selectCharacter(1, char);
            setMyReady(true);
            ch.sendEvent('char_select', { charId: char.id, playerIndex: myPlayerIndex });
          }
        }, 200);
        return;
      }
      selectCharacter(1, char);
      setMyReady(true);
      matchChannel.sendEvent('char_select', { charId: char.id, playerIndex: myPlayerIndex });
    } else {
      selectCharacter(1, char);
      const others = CHARACTERS.filter(c => c.id !== char.id);
      selectCharacter(2, others[Math.floor(Math.random() * others.length)]);
    }
  }, [onlineMode, myReady, myPlayerIndex, matchChannel, selectCharacter]);

  const handleHostStart = useCallback(() => {
    if (!isHost || !player1Character || navigatedRef.current || !matchChannel) return;
    const allPicked = numPlayers <= 2
      ? !!opponentCharId
      : Object.keys(pickedChars).length >= numPlayers - 1;
    if (!allPicked) return;
    navigatedRef.current = true;
    const stageId = 'battlefield';
    const fighters = [{ playerIndex: 0, charId: player1Character.id }];
    for (let i = 1; i < numPlayers; i++) {
      fighters.push({ playerIndex: i, charId: pickedChars[i] ?? opponentCharId ?? '' });
    }
    matchChannel.sendEvent('match_start', { fighters, stageId });
    const oppChar = CHARACTERS.find(c => c.id === (pickedChars[1] ?? opponentCharId));
    if (oppChar) selectCharacter(2, oppChar);
    useGameStore.getState().selectStage(STAGES.find(s => s.id === stageId) ?? STAGES[0]);
    navigate('/play');
  }, [isHost, player1Character, opponentCharId, pickedChars, numPlayers, matchChannel, selectCharacter, navigate]);

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
  const isSelected   = !onlineMode ? player1Character !== null : myReady;
  const allOpponentsReady = numPlayers <= 2 ? opponentReady : Object.keys(pickedChars).length >= numPlayers - 1;
  const bothReady    = !onlineMode
    ? (player1Character !== null && player2Character !== null)
    : (myReady && allOpponentsReady);
  const opponentChar = opponentCharId ? CHARACTERS.find(c => c.id === opponentCharId) : null;

  // ── Derive the single primary button label/action ─────────────────
  const getButtonState = () => {
    if (waitingForChannel) return 'connecting';
    if (onlineMode) {
      if (!myReady) return 'select';
      if (!opponentReady) return 'waiting';
      if (isHost) return 'start';
      return 'host-starting';
    }
    if (!player1Character) return 'select';
    if (!player2Character) return 'select'; // shouldn't happen offline
    return 'fight';
  };
  const btnState = getButtonState();

  return (
    <div
      className="relative w-screen bg-void overflow-hidden select-none flex flex-col"
      style={{ height: '100dvh' }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
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

      {/* ── Carousel (fills all space between header and action bar) ── */}
      <div
        className="flex-1 min-h-0 flex flex-col px-4 gap-2 pt-1 pb-2"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Card — flex-1 so it fills remaining height, never overflows */}
        <div
          className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border-2 transition-all duration-300"
          style={{ borderColor: char.accentColor + '99', boxShadow: `0 0 32px ${char.accentColor}30` }}
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
                background: 'linear-gradient(to bottom, transparent 30%, rgba(5,5,7,0.6) 55%, rgba(5,5,7,0.96) 100%)',
              }} />

              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 space-y-1.5">
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
                  {isSelected && player1Character?.id === char.id && (
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

          <button onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-20"
            style={{ backgroundColor: 'rgba(10,10,15,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ChevronLeft size={18} className="text-white" />
          </button>
          <button onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center z-20"
            style={{ backgroundColor: 'rgba(10,10,15,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>

        {/* Thumbnails */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2">
          {CHARACTERS.map((c, i) => (
            <button
              key={c.id}
              onClick={() => !myReady && setActiveIndex(i)}
              className="relative rounded-lg overflow-hidden transition-all duration-200 flex-shrink-0"
              style={{
                width: i === activeIndex ? 40 : 30,
                height: i === activeIndex ? 40 : 30,
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

        {/* VS preview strip — fixed h-8 so it never shifts the layout */}
        <div className="flex-shrink-0 h-8 flex items-center justify-center gap-2">
          {bothReady && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            >
              {player1Character && (
                <img src={player1Character.image} alt="" className="w-6 h-6 rounded object-cover object-top border" style={{ borderColor: player1Character.accentColor }} />
              )}
              <span className="font-rajdhani font-bold text-[11px]" style={{ color: player1Character?.accentColor }}>
                {onlineMode ? 'YOU' : player1Character?.name}
              </span>
              <span className="font-orbitron font-black text-[12px] text-text-secondary">VS</span>
              <span className="font-rajdhani font-bold text-[11px]" style={{ color: onlineMode ? '#E81D2D' : player2Character?.accentColor }}>
                {onlineMode ? (matchOpponent?.username ?? 'Opponent') : player2Character?.name}
              </span>
              {onlineMode && opponentChar ? (
                <img src={opponentChar.image} alt="" className="w-6 h-6 rounded object-cover object-top border border-[#E81D2D]" />
              ) : player2Character ? (
                <img src={player2Character.image} alt="" className="w-6 h-6 rounded object-cover object-top border" style={{ borderColor: player2Character.accentColor }} />
              ) : null}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Action Bar — single button row, always at bottom ────────── */}
      <div
        className="flex-shrink-0 px-4 pt-2 z-40"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {btnState === 'select' && (
          <motion.button
            onClick={() => handleSelect(char)}
            className="w-full h-14 rounded-2xl font-rajdhani font-bold text-[18px] uppercase tracking-wider border-2 flex items-center justify-center"
            style={{ borderColor: char.accentColor, color: char.accentColor }}
            whileTap={{ scale: 0.97 }}
          >
            SELECT {char.name.toUpperCase()}
          </motion.button>
        )}

        {btnState === 'connecting' && (
          <div className="w-full h-14 rounded-2xl border-2 border-border-subtle flex items-center justify-center gap-2 opacity-60">
            <Loader size={16} className="animate-spin text-text-muted" />
            <span className="font-rajdhani font-bold text-[16px] text-text-muted">CONNECTING...</span>
          </div>
        )}

        {btnState === 'waiting' && (
          <div className="w-full h-14 rounded-2xl border-2 border-accent-cyan/30 bg-accent-cyan/10 flex items-center justify-center gap-2">
            <Loader size={16} className="animate-spin text-accent-cyan" />
            <span className="font-rajdhani font-bold text-[16px] text-accent-cyan">WAITING FOR OPPONENT...</span>
          </div>
        )}

        {btnState === 'start' && (
          <motion.button
            onClick={handleHostStart}
            className="w-full h-14 rounded-2xl font-rajdhani font-bold text-[18px] uppercase tracking-wider"
            style={{ backgroundColor: '#00E5D4', color: '#0A0A0F', boxShadow: '0 4px 20px rgba(0,229,212,0.35)' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.97 }}
          >
            START MATCH →
          </motion.button>
        )}

        {btnState === 'host-starting' && (
          <div className="w-full h-14 rounded-2xl border-2 border-accent-cyan/30 bg-accent-cyan/10 flex items-center justify-center gap-2">
            <Loader size={16} className="animate-spin text-accent-cyan" />
            <span className="font-rajdhani font-bold text-[16px] text-accent-cyan">HOST IS STARTING...</span>
          </div>
        )}

        {btnState === 'fight' && (
          <motion.button
            onClick={handleFight}
            className="w-full h-14 rounded-2xl font-rajdhani font-bold text-[18px] uppercase tracking-wider"
            style={{ backgroundColor: '#00E5D4', color: '#0A0A0F', boxShadow: '0 4px 20px rgba(0,229,212,0.35)' }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.97 }}
          >
            FIGHT →
          </motion.button>
        )}
      </div>
    </div>
  );
}
