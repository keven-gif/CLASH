import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { RealtimeChannel } from '@/game/online/RealtimeChannel';
import type { RemoteInput } from '@/game/online/RealtimeChannel';
import { useGameStore, CHARACTERS } from '@/store/gameStore';
import type { Character } from '@/store/gameStore';
import { GameLoop } from '@/game/GameLoop';
import { InputHandler } from '@/game/InputHandler';
import { AIController } from '@/game/AIController';
import { createFighter } from '@/game/Fighter';
import { getStageData, getPlatforms, getSpawnPoints } from '@/game/Stage';
import { getDamageColor } from '@/game/Fighter';
import type { FighterState, Platform } from '@/game/types';
import { Pause, Swords, Shield, Hand, ChevronUp } from 'lucide-react';

export default function Gameplay() {
  const navigate = useNavigate();

  const realtimeRef = useRef<RealtimeChannel | null>(null);
  const latestRemoteInput = useRef<RemoteInput | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joystickZoneRef = useRef<HTMLDivElement>(null);

  // ── Store state ────────────────────────────────────────────────────
  const p1Char = useGameStore((s) => s.player1Character);
  const p2Char = useGameStore((s) => s.player2Character);
  const stage = useGameStore((s) => s.selectedStage);
  const timeLimit = useGameStore((s) => s.timeLimit);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);
  const onlineMode = useGameStore((s) => s.onlineMode);

  const matchOpponent = useGameStore((s) => s.matchOpponent);
  const storeUser = useGameStore((s) => s.user);

  const endMatch = useGameStore((s) => s.endMatch);
  const loseStock = useGameStore((s) => s.loseStock);
  const stockCount = useGameStore((s) => s.stockCount);

  // ── Local state ────────────────────────────────────────────────────
  const [p1Damage, setP1Damage] = useState(0);
  const [p2Damage, setP2Damage] = useState(0);
  const [p1Stocks, setP1Stocks] = useState(stockCount);
  const [p2Stocks, setP2Stocks] = useState(stockCount);

  // Refs to avoid stale closure in onStockUpdate callback (H8)
  const p1StocksRef = useRef(stockCount);
  const p2StocksRef = useRef(stockCount);
  const [timer, setTimer] = useState(timeLimit);
  const [countdown, setCountdown] = useState(3);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [activeButtons, setActiveButtons] = useState<Record<string, boolean>>({});
  const [joystickActive, setJoystickActive] = useState(false);

  // Keep stock refs in sync with state (H8 fix)
  useEffect(() => { p1StocksRef.current = p1Stocks; }, [p1Stocks]);
  useEffect(() => { p2StocksRef.current = p2Stocks; }, [p2Stocks]);

  // ── Refs ───────────────────────────────────────────────────────────
  const gameLoopRef = useRef<GameLoop | null>(null);
  const inputHandlerRef = useRef<InputHandler | null>(null);
  const aiRef = useRef<AIController | null>(null);
  const fightersRef = useRef<{ p1: FighterState; p2: FighterState } | null>(null);
  const platformsRef = useRef<Platform[]>([]);
  const matchEndedRef = useRef(false);

  // Resolve characters (fallback)
  const p1Character: Character = p1Char ?? CHARACTERS[0];
  const p2Character: Character = p2Char ?? CHARACTERS[1];
  const stageId = stage?.id ?? 'battlefield';

  // ── Canvas sizing ──────────────────────────────────────────────────
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    // Set backing store to DPR size for sharp rendering on retina displays
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    // Scale ctx so all draw calls use logical (CSS) pixel coordinates.
    // Without this, on Retina/high-DPI devices content renders in the
    // top-left 1/dpr² of the screen instead of filling it.
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  }, []);

  // ── Register joystick zone with InputHandler ────────────────────────
  const registerJoystickZone = useCallback(() => {
    const ih = inputHandlerRef.current;
    const joyEl = joystickZoneRef.current;
    if (ih && joyEl) {
      ih.setJoystickZone(joyEl.getBoundingClientRect());
    }
  }, []);

  // Re-register joystick zone whenever controls become visible
  // (the joystick div is conditionally rendered, so we must wait
  // for React to commit it to the DOM before measuring its rect)
  useEffect(() => {
    if (showControls) {
      requestAnimationFrame(() => {
        registerJoystickZone();
      });
    }
  }, [showControls, registerJoystickZone]);

  // ── Initialize game ────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      resizeCanvas();
      registerJoystickZone();
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Stage data
    const stageData = getStageData(stageId);
    const platforms = getPlatforms(stageId);
    const spawnPoints = getSpawnPoints(stageId);
    platformsRef.current = platforms;

    // Create fighters
    const p1Spawn = spawnPoints[0] ?? { x: -60, y: 50 };
    const p2Spawn = spawnPoints[1] ?? { x: 60, y: 50 };
    const p1 = createFighter(p1Character.id, p1Spawn);
    const p2 = createFighter(p2Character.id, p2Spawn);
    p1.direction = 1;
    p2.direction = -1;
    p1.stocks = stockCount;
    p2.stocks = stockCount;
    fightersRef.current = { p1, p2 };

    // Input
    const inputHandler = new InputHandler();
    inputHandlerRef.current = inputHandler;

    // AI (used as fallback when no remote input arrives yet)
    const ai = new AIController('medium');
    aiRef.current = ai;

    // Online mode: use Supabase Realtime broadcast to sync opponent input
    if (onlineMode && storeUser && matchOpponent) {
      const matchId = [storeUser.id, matchOpponent.id].sort().join('_');
      const rc = new RealtimeChannel(matchId, storeUser.id);
      realtimeRef.current = rc;
      rc.onRemoteInput((inp) => { latestRemoteInput.current = inp; });
    }

    // Game loop
    const gameLoop = new GameLoop({
      canvas,
      ctx,
      stage: stageData,
      platforms,
      player1: p1,
      player2: p2,
      inputHandler,
      aiController: ai,
      getP2Input: onlineMode
        ? () => latestRemoteInput.current
        : undefined,
      onLocalInput: onlineMode
        ? (input) => { realtimeRef.current?.sendInput(input); }
        : undefined,
      matchTime: timeLimit,
      onDamageUpdate: (player, damage) => {
        if (player === 1) setP1Damage(damage);
        else setP2Damage(damage);
      },
      onStockUpdate: (player, stocks) => {
        if (player === 1) {
          if (stocks < p1StocksRef.current) loseStock(player);
          setP1Stocks(stocks);
        } else {
          if (stocks < p2StocksRef.current) loseStock(player);
          setP2Stocks(stocks);
        }
      },
      onTimerUpdate: (t) => setTimer(t),
      onMatchEnd: (winner) => {
        if (matchEndedRef.current) return;
        matchEndedRef.current = true;
        setMatchEnded(true);
        endMatch(winner);
        setTimeout(() => navigate('/result'), 2000);
      },
      onCountdownUpdate: (c) => setCountdown(c),
      onPhaseUpdate: (phase) => {
        if (phase === 'active') setShowControls(true);
      },
    });

    gameLoopRef.current = gameLoop;
    matchEndedRef.current = false;

    // Start
    gameLoop.start();

    // Keyboard support
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'p') {
        togglePause();
      }
      inputHandler.handleKeyDown(e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      inputHandler.handleKeyUp(e.key);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gameLoop.destroy();
      realtimeRef.current?.disconnect();
      // Clean up match_queue row so future matchmaking isn't blocked
      if (onlineMode && storeUser) {
        import('@/supabase/api').then(({ api }) => api.leaveQueue(storeUser.id));
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pause / Resume ─────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    if (matchEnded) return;
    const gl = gameLoopRef.current;
    if (!gl) return;

    if (isPaused) {
      gl.resume();
      resumeGame();
      setIsPaused(false);
    } else {
      gl.pause();
      pauseGame();
      setIsPaused(true);
    }
  }, [isPaused, matchEnded, pauseGame, resumeGame]);

  const handleResume = useCallback(() => {
    gameLoopRef.current?.resume();
    resumeGame();
    setIsPaused(false);
  }, [resumeGame]);

  const handleRestart = useCallback(() => {
    gameLoopRef.current?.destroy();
    window.location.reload();
  }, []);

  const handleQuit = useCallback(() => {
    gameLoopRef.current?.destroy();
    useGameStore.getState().setGameState('title');
    navigate('/');
  }, [navigate]);

  // ── Touch handling ─────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    inputHandlerRef.current?.handleTouchStart(e.nativeEvent);
    updateJoystickVisual();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    inputHandlerRef.current?.handleTouchMove(e.nativeEvent);
    updateJoystickVisual();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    inputHandlerRef.current?.handleTouchEnd(e.nativeEvent);
    updateJoystickVisual();
  }, []);

  const updateJoystickVisual = () => {
    const ih = inputHandlerRef.current;
    if (!ih) return;
    const raw = ih.getJoystickRawPosition();
    setJoystickPos(raw ?? { x: 0, y: 0 });
    setJoystickActive(ih.isJoystickActive());
  };

  // ── Button press helpers ───────────────────────────────────────────
  const pressButton = useCallback((btn: 'attack' | 'special' | 'jump' | 'shield' | 'grab') => {
    const ih = inputHandlerRef.current;
    if (!ih) return;
    // @ts-expect-error accessing private for direct control
    ih.buttons[btn] = true;
    // @ts-expect-error accessing private for direct control
    ih.buttonsPressed[btn] = true;
    setActiveButtons((prev) => ({ ...prev, [btn]: true }));
  }, []);

  const releaseButton = useCallback((btn: 'attack' | 'special' | 'jump' | 'shield' | 'grab') => {
    const ih = inputHandlerRef.current;
    if (!ih) return;
    // @ts-expect-error accessing private for direct control
    ih.buttons[btn] = false;
    setActiveButtons((prev) => ({ ...prev, [btn]: false }));
  }, []);

  // ── Timer format ───────────────────────────────────────────────────
  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timerColor = timer <= 10 ? '#E81D2D' : timer <= 30 ? '#FFB800' : '#F0F0F5';
  const timerPulse = timer <= 10 ? 'animate-pulse' : timer <= 30 ? 'animate-pulse' : '';

  // ── Stock rendering ────────────────────────────────────────────────
  const renderStocks = (count: number, isRightSide: boolean) => {
    const icons = [];
    for (let i = 0; i < 3; i++) {
      const active = i < count;
      icons.push(
        <div
          key={i}
          className={`w-3 h-3 rounded-full border transition-all duration-300 ${
            active
              ? 'bg-[#F0F0F5] border-[#F0F0F5] shadow-[0_0_4px_#F0F0F580]'
              : 'bg-transparent border-[#2A2A3A]'
          }`}
          style={{ transform: isRightSide ? 'none' : 'none' }}
        />
      );
    }
    return isRightSide ? icons.reverse() : icons;
  };

  // ── Joystick position CSS ──────────────────────────────────────────
  const joystickStyle = joystickActive
    ? {
        transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
        backgroundColor: 'rgba(255,255,255,0.4)',
      }
    : {
        transform: 'translate(0px, 0px)',
        backgroundColor: 'rgba(255,255,255,0.25)',
      };

  return (
    <div
      className="relative w-full min-h-[100dvh] overflow-hidden select-none"
      style={{ backgroundColor: '#050507', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Canvas ─────────────────────────────────────────────────── */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
      />

      {/* ── HUD Overlay ────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 top-0 z-10 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top, 12px)' }}>
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 top-0 h-[100px]" style={{ background: 'linear-gradient(to bottom, rgba(5,5,7,0.7) 0%, transparent 100%)' }} />

        <div className="relative flex items-start justify-between px-3 pt-3">
          {/* P1 HUD (left) */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-md overflow-hidden border-2"
                  style={{ borderColor: p1Character.accentColor }}
                >
                  <img
                    src={p1Character.image}
                    alt={p1Character.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="flex gap-1.5">{renderStocks(p1Stocks, false)}</div>
              </div>
              <div
                className="text-[48px] font-black tabular-nums leading-none mt-1 font-orbitron"
                style={{ color: getDamageColor(p1Damage) }}
              >
                {p1Damage}%
              </div>
            </div>
          </div>

          {/* Timer (center) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <div className="px-3 py-1 rounded-lg" style={{ backgroundColor: 'rgba(10,10,15,0.6)' }}>
              <div
                className={`text-[28px] font-bold tabular-nums font-orbitron ${timerPulse}`}
                style={{ color: timerColor }}
              >
                {formatTimer(timer)}
              </div>
            </div>
          </div>

          {/* P2 HUD (right) */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 flex-row-reverse">
                <div
                  className="w-9 h-9 rounded-md overflow-hidden border-2"
                  style={{ borderColor: p2Character.accentColor }}
                >
                  <img
                    src={p2Character.image}
                    alt={p2Character.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                </div>
                <div className="flex gap-1.5">{renderStocks(p2Stocks, true)}</div>
              </div>
              <div
                className="text-[48px] font-black tabular-nums leading-none mt-1 font-orbitron"
                style={{ color: getDamageColor(p2Damage) }}
              >
                {p2Damage}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Pause Button ───────────────────────────────────────────── */}
      <button
        onClick={togglePause}
        className="absolute z-10 top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center pointer-events-auto active:scale-90 transition-transform"
        style={{ backgroundColor: 'rgba(10,10,15,0.5)' }}
        aria-label="Pause"
      >
        <Pause size={18} strokeWidth={2.5} className="text-text-secondary" />
      </button>

      {/* ── Mobile Controls ────────────────────────────────────────── */}
      {showControls && (
        <div
          className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
          style={{
            height: '220px',
            paddingBottom: 'env(safe-area-inset-bottom, 24px)',
            opacity: isPaused ? 0.3 : 0.9,
            transition: 'opacity 300ms',
          }}
        >
          {/* Virtual Joystick (bottom-left) */}
          <div
            ref={joystickZoneRef}
            className="absolute pointer-events-auto"
            style={{ bottom: '24px', left: '24px', width: '120px', height: '120px' }}
          >
            {/* Base */}
            <div className="absolute inset-0 rounded-full border-[1.5px]" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' }}>
              {/* Direction marks */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute top-1 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent" style={{ borderBottomColor: 'rgba(255,255,255,0.1)' }} />
                <div className="absolute bottom-1 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent" style={{ borderTopColor: 'rgba(255,255,255,0.1)' }} />
                <div className="absolute left-1 w-0 h-0 border-t-[4px] border-b-[4px] border-r-[6px] border-t-transparent border-b-transparent" style={{ borderRightColor: 'rgba(255,255,255,0.1)' }} />
                <div className="absolute right-1 w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent" style={{ borderLeftColor: 'rgba(255,255,255,0.1)' }} />
              </div>
            </div>
            {/* Stick */}
            <div
              className="absolute top-1/2 left-1/2 w-[50px] h-[50px] -ml-[25px] -mt-[25px] rounded-full border transition-transform duration-100"
              style={{
                ...joystickStyle,
                borderColor: 'rgba(255,255,255,0.3)',
              }}
            />
          </div>

          {/* Action Buttons (bottom-right) */}
          <div className="absolute pointer-events-auto" style={{ bottom: '24px', right: '24px' }}>
            {/* Row 1: B (special) and A (attack) */}
            <div className="flex gap-3 justify-end mb-2">
              {/* Special (B) */}
              <button
                aria-label="Special attack"
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center font-orbitron font-bold text-xl pointer-events-auto active:scale-[0.88] transition-transform"
                style={{
                  backgroundColor: activeButtons.special ? 'rgba(0,229,212,0.35)' : 'rgba(0,229,212,0.15)',
                  borderColor: 'rgba(0,229,212,0.35)',
                  color: '#00E5D4',
                }}
                onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); pressButton('special'); }}
                onTouchEnd={(e) => { e.stopPropagation(); releaseButton('special'); }}
              >
                B
              </button>

              {/* Attack (A) */}
              <button
                aria-label="Attack"
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center font-orbitron font-bold text-xl pointer-events-auto active:scale-[0.88] transition-transform"
                style={{
                  backgroundColor: activeButtons.attack ? 'rgba(240,240,245,0.35)' : 'rgba(240,240,245,0.15)',
                  borderColor: 'rgba(240,240,245,0.35)',
                  color: '#F0F0F5',
                }}
                onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); pressButton('attack'); }}
                onTouchEnd={(e) => { e.stopPropagation(); releaseButton('attack'); }}
              >
                <Swords size={22} strokeWidth={2.5} />
              </button>
            </div>

            {/* Row 2: Jump, Shield, Grab */}
            <div className="flex gap-3 justify-end items-end">
              {/* Jump */}
              <button
                aria-label="Jump"
                className="w-14 h-14 rounded-full border-[1.5px] flex items-center justify-center pointer-events-auto active:scale-[0.88] transition-transform"
                style={{
                  backgroundColor: activeButtons.jump ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
                onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); pressButton('jump'); }}
                onTouchEnd={(e) => { e.stopPropagation(); releaseButton('jump'); }}
              >
                <ChevronUp size={22} strokeWidth={2.5} className="text-text-secondary" />
              </button>

              {/* Grab */}
              <button
                aria-label="Grab"
                className="w-14 h-14 rounded-full border-[1.5px] flex items-center justify-center pointer-events-auto active:scale-[0.88] transition-transform"
                style={{
                  backgroundColor: activeButtons.grab ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(255,255,255,0.15)',
                }}
                onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); pressButton('grab'); }}
                onTouchEnd={(e) => { e.stopPropagation(); releaseButton('grab'); }}
              >
                <Hand size={18} strokeWidth={2} className="text-text-secondary" />
              </button>

              {/* Shield */}
              <button
                aria-label="Shield"
                className="w-14 h-14 rounded-full border-[1.5px] flex items-center justify-center pointer-events-auto active:scale-[0.88] transition-transform"
                style={{
                  backgroundColor: activeButtons.shield ? 'rgba(77,166,255,0.3)' : 'rgba(77,166,255,0.12)',
                  borderColor: 'rgba(77,166,255,0.3)',
                }}
                onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); pressButton('shield'); }}
                onTouchEnd={(e) => { e.stopPropagation(); releaseButton('shield'); }}
              >
                <Shield size={18} strokeWidth={2} className="text-[#4DA6FF]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Countdown Overlay ──────────────────────────────────────── */}
      {countdown > 0 && !isPaused && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div
            className="font-orbitron font-black text-[120px] tabular-nums animate-pulse"
            style={{
              color: '#F0F0F5',
              textShadow: '0 0 30px #00E5D480',
            }}
          >
            {countdown}
          </div>
        </div>
      )}

      {/* ── Pause Menu Overlay ─────────────────────────────────────── */}
      {isPaused && (
        <PauseMenu
          onResume={handleResume}
          onRestart={handleRestart}
          onQuit={handleQuit}
        />
      )}
    </div>
  );
}

// ─── PauseMenu Component ─────────────────────────────────────────────

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

function PauseMenu({ onResume, onRestart, onQuit }: PauseMenuProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Menu Card */}
      <div
        className="relative flex flex-col items-center gap-4 p-8 rounded-2xl w-[300px] animate-in fade-in zoom-in-95 duration-300"
        style={{
          backgroundColor: 'var(--bg-panel, #111118)',
          border: '1.5px solid var(--border-subtle, #2A2A3A)',
        }}
      >
        <h2
          className="font-orbitron font-bold text-2xl tracking-[0.08em] mb-2"
          style={{ color: 'var(--text-primary, #F0F0F5)' }}
        >
          PAUSED
        </h2>

        <button
          onClick={onResume}
          className="w-full h-[52px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-[0.04em] active:scale-95 transition-all duration-instant"
          style={{
            backgroundColor: 'var(--text-primary, #F0F0F5)',
            color: 'var(--bg-dark, #0A0A0F)',
          }}
        >
          Resume
        </button>

        <button
          onClick={onRestart}
          className="w-full h-[48px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-[0.04em] border-[1.5px] active:scale-95 transition-all duration-instant"
          style={{
            backgroundColor: 'transparent',
            borderColor: 'var(--border-subtle, #2A2A3A)',
            color: 'var(--text-primary, #F0F0F5)',
          }}
        >
          Restart
        </button>

        <button
          onClick={onQuit}
          className="w-full h-[48px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-[0.04em] active:scale-95 transition-all duration-instant"
          style={{
            backgroundColor: '#E81D2D',
            color: '#FFFFFF',
            boxShadow: '0 4px 16px rgba(232,29,45,0.3)',
          }}
        >
          Quit to Menu
        </button>
      </div>

      {/* ── Portrait Mode Overlay ────────────────────────────────────
           Shown when the device is held in portrait orientation.
           The CSS @media (orientation: portrait) rotation handles the
           actual transform; this overlay acts as a friendly prompt
           before the rotation kicks in, or as a fallback if the CSS
           rotation is delayed.
           ───────────────────────────────────────────────────────────── */}
      {typeof window !== 'undefined' && window.innerHeight > window.innerWidth && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white text-center px-6">
          <div className="text-5xl mb-4">🔄</div>
          <p className="text-xl font-bold font-orbitron">Rotate your device</p>
          <p className="text-sm text-gray-400 mt-2">CLASH is best played in landscape</p>
        </div>
      )}
    </div>
  );
}
