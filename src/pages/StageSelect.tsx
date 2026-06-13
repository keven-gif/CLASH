import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, AlertTriangle } from 'lucide-react';
import { useGameStore, STAGES } from '@/store/gameStore';
import type { Stage } from '@/store/gameStore';
import { audioManager } from '@/audio/AudioManager';

// ─── Stage Card Component ────────────────────────────────────────────

interface StageCardProps {
  stage: Stage;
  isSelected: boolean;
  onSelect: (stage: Stage) => void;
}

function StageCard({ stage, isSelected, onSelect }: StageCardProps) {
  return (
    <motion.div
      className="relative w-full aspect-[16/10] rounded-[20px] overflow-hidden cursor-pointer border-[1.5px] shrink-0"
      style={{
        borderColor: isSelected ? '#00E5D4' : 'transparent',
        boxShadow: isSelected ? '0 0 16px rgba(0,229,212,0.25)' : 'none',
      }}
      onClick={() => onSelect(stage)}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Stage thumbnail */}
      <img
        src={stage.image}
        alt={stage.name}
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(5,5,7,0.1) 0%, rgba(5,5,7,0.3) 50%, rgba(5,5,7,0.85) 100%)',
        }}
      />

      {/* Selection glow ring */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-[20px] pointer-events-none"
            style={{
              boxShadow: 'inset 0 0 0 2px rgba(0,229,212,0.6), 0 0 24px rgba(0,229,212,0.2)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Stage name + description */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3
          className="font-orbitron font-bold text-[24px] tracking-wide text-text-primary"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
        >
          {stage.name.toUpperCase()}
        </h3>
        <p
          className="mt-1 font-rajdhani font-normal text-[14px] text-text-secondary leading-snug max-w-[85%]"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
        >
          {stage.description}
        </p>
      </div>

      {/* Hazard badge (if applicable) */}
      {stage.hasHazards && (
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-hp-high/90">
          <AlertTriangle size={14} className="text-white" />
          <span className="font-rajdhani font-semibold text-[11px] text-white tracking-wide">
            HAZARDS
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Hazard Toggle Component ─────────────────────────────────────────

interface HazardToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

function HazardToggle({ enabled, onToggle }: HazardToggleProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-bg-panel rounded-xl border border-border-subtle">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-hp-high" />
        <span className="font-rajdhani font-semibold text-[14px] text-text-primary tracking-wide">
          STAGE HAZARDS
        </span>
      </div>

      {/* Toggle switch */}
      <button
        onClick={onToggle}
        className="relative w-12 h-7 rounded-full transition-colors duration-200"
        style={{ backgroundColor: enabled ? '#00E5D4' : '#1E1E2A' }}
        aria-label="Toggle hazards"
      >
        <motion.div
          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md"
          animate={{ x: enabled ? 20 : 0 }}
          transition={{ duration: 0.2, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
        />
      </button>
    </div>
  );
}

// ─── VS Display Component ────────────────────────────────────────────

function VsDisplay() {
  const { player1Character, player2Character } = useGameStore();

  if (!player1Character || !player2Character) return null;

  return (
    <motion.div
      className="flex items-center justify-center gap-3 px-5 py-3 bg-bg-panel rounded-xl border border-border-subtle"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      {/* P1 */}
      <div className="flex items-center gap-2 flex-1">
        <img
          src={player1Character.image}
          alt={player1Character.name}
          className="w-9 h-9 rounded-lg object-cover border-2"
          style={{ borderColor: player1Character.accentColor }}
        />
        <div className="flex flex-col">
          <span className="font-rajdhani font-bold text-[10px] text-hp-full tracking-wider">P1</span>
          <span className="font-rajdhani font-semibold text-[13px] text-text-primary leading-tight">
            {player1Character.name}
          </span>
        </div>
      </div>

      {/* VS */}
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-border-subtle">
        <span className="font-orbitron font-black text-[10px] text-text-secondary">VS</span>
      </div>

      {/* CPU */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <div className="flex flex-col items-end">
          <span className="font-rajdhani font-bold text-[10px] text-hp-high tracking-wider">CPU</span>
          <span className="font-rajdhani font-semibold text-[13px] text-text-primary leading-tight">
            {player2Character.name}
          </span>
        </div>
        <img
          src={player2Character.image}
          alt={player2Character.name}
          className="w-9 h-9 rounded-lg object-cover border-2"
          style={{ borderColor: player2Character.accentColor }}
        />
      </div>
    </motion.div>
  );
}

// ─── Stage Info Panel ────────────────────────────────────────────────

interface StageInfoPanelProps {
  stage: Stage | null;
}

function StageInfoPanel({ stage }: StageInfoPanelProps) {
  if (!stage) return null;

  const layoutVisuals: Record<string, React.ReactNode> = {
    battlefield: (
      <div className="flex flex-col items-center gap-1">
        <div className="w-24 h-3 rounded-sm bg-hp-full/70" />
        <div className="flex gap-3">
          <div className="w-8 h-2.5 rounded-sm bg-hp-full/50" />
          <div className="w-8 h-2.5 rounded-sm bg-hp-full/50" />
        </div>
      </div>
    ),
    final: (
      <div className="flex items-center justify-center">
        <div className="w-32 h-3 rounded-sm bg-hp-full/70" />
      </div>
    ),
    hazard: (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <div className="w-16 h-3 rounded-sm bg-hp-mid/70" />
          <span className="text-[10px]">&#x2699;</span>
        </div>
        <div className="w-20 h-2.5 rounded-sm bg-hp-mid/50" />
      </div>
    ),
  };

  const sizeLabels: Record<string, string> = {
    battlefield: 'Medium',
    final: 'Large',
    hazard: 'Medium',
  };

  const blastZoneLabels: Record<string, string> = {
    battlefield: 'Standard',
    final: 'Standard',
    hazard: 'Tight',
  };

  return (
    <motion.div
      className="px-5 py-4 bg-bg-panel rounded-xl border border-border-subtle space-y-3"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      key={stage.id}
    >
      {/* Layout */}
      <div className="space-y-1.5">
        <span className="font-rajdhani font-semibold text-[12px] text-text-muted tracking-wider uppercase">
          Layout
        </span>
        {layoutVisuals[stage.id] || null}
      </div>

      {/* Size */}
      <div className="flex items-center justify-between">
        <span className="font-rajdhani font-semibold text-[12px] text-text-muted tracking-wider uppercase">
          SIZE
        </span>
        <span className="font-rajdhani font-medium text-[14px] text-text-primary">
          {sizeLabels[stage.id] || 'Medium'}
        </span>
      </div>

      {/* Blast Zones */}
      <div className="flex items-center justify-between">
        <span className="font-rajdhani font-semibold text-[12px] text-text-muted tracking-wider uppercase">
          BLAST ZONES
        </span>
        <span className="font-rajdhani font-medium text-[14px] text-text-primary">
          {blastZoneLabels[stage.id] || 'Standard'}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function StageSelect() {
  const navigate = useNavigate();
  const { selectedStage, selectStage, startMatch, hazardsEnabled } = useGameStore();
  const [hazardsOn, setHazardsOn] = useState(hazardsEnabled);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Play menu music on mount
  useEffect(() => {
    audioManager.playMusic('music-title');
  }, []);

  // Auto-select first stage if none selected
  const currentStage = selectedStage || STAGES[0];

  const handleSelect = useCallback(
    (stage: Stage) => {
      selectStage(stage);
      const idx = STAGES.findIndex((s) => s.id === stage.id);
      setActiveIndex(idx);
    },
    [selectStage],
  );

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.offsetWidth * 0.85;
    const newIndex = Math.round(scrollLeft / cardWidth);
    if (newIndex >= 0 && newIndex < STAGES.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      selectStage(STAGES[newIndex]);
    }
  }, [activeIndex, selectStage]);

  const handleHazardToggle = useCallback(() => {
    setHazardsOn((prev) => !prev);
  }, []);

  const handleStartBattle = useCallback(() => {
    if (currentStage) {
      startMatch();
      navigate('/play');
    }
  }, [currentStage, startMatch, navigate]);

  const handleBack = useCallback(() => {
    navigate('/select');
  }, [navigate]);

  const isReady = currentStage !== null;

  // Show hazard toggle only for Factory Floor
  const showHazardToggle = currentStage?.id === 'hazard';

  return (
    <div className="relative w-screen h-screen bg-void overflow-hidden select-none flex flex-col">
      {/* ─── Header ────────────────────────────────────────────── */}
      <motion.nav
        className="relative z-50 flex items-start px-6 pt-4 pb-2"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        {/* Back button */}
        <motion.button
          onClick={handleBack}
          className="flex items-center justify-center w-11 h-11 rounded-full text-text-secondary active:text-text-primary transition-colors duration-fast mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Go back"
        >
          <ChevronLeft size={28} strokeWidth={2} />
        </motion.button>

        {/* Title */}
        <div className="absolute left-1/2 -translate-x-1/2 pt-1 text-center">
          <h1 className="font-orbitron font-bold text-[28px] tracking-screen-title leading-tight text-text-primary">
            CHOOSE YOUR
          </h1>
          <h1 className="font-orbitron font-bold text-[28px] tracking-screen-title leading-tight text-text-primary">
            STAGE
          </h1>
          <div className="mx-auto mt-1 w-[60px] h-[2px] rounded-full bg-hp-full" />
        </div>
      </motion.nav>

      {/* ─── Stage Carousel ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-6 gap-3 overflow-hidden min-h-0">
        {/* Scrollable carousel */}
        <motion.div
          ref={scrollRef}
          className="relative overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={handleScroll}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        >
          <div className="flex gap-4 py-2">
            {STAGES.map((stage, i) => (
              <div
                key={stage.id}
                className="w-[85%] shrink-0 snap-center"
                style={{ scrollSnapAlign: 'center' }}
              >
                <StageCard
                  stage={stage}
                  isSelected={activeIndex === i}
                  onSelect={() => handleSelect(stage)}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Pagination Dots */}
        <motion.div
          className="flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.2 }}
        >
          {STAGES.map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ backgroundColor: activeIndex === i ? '#F0F0F5' : '#2A2A3A' }}
              animate={{
                width: activeIndex === i ? 10 : 8,
                height: activeIndex === i ? 10 : 8,
              }}
              transition={{ duration: 0.2, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
            />
          ))}
        </motion.div>

        {/* ─── Stage Info Panel ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          <StageInfoPanel stage={currentStage} />

          {/* Hazard Toggle (Factory Floor only) */}
          <AnimatePresence>
            {showHazardToggle && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
              >
                <HazardToggle enabled={hazardsOn} onToggle={handleHazardToggle} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* VS Display */}
          <VsDisplay />
        </div>
      </div>

      {/* ─── READY TO FIGHT! Button ────────────────────────────── */}
      <div className="px-6 pb-4 flex-shrink-0">
        <motion.button
          onClick={handleStartBattle}
          className="w-full h-14 rounded-[14px] font-rajdhani font-bold text-[20px] uppercase tracking-wider transition-all duration-normal"
          style={{
            backgroundColor: isReady ? '#00E5D4' : '#2A2A3A',
            color: isReady ? '#0A0A0F' : '#555570',
            boxShadow: isReady ? '0 6px 24px rgba(0,229,212,0.3)' : 'none',
          }}
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          whileTap={isReady ? { scale: 0.95 } : {}}
          disabled={!isReady}
        >
          {isReady ? '\u2694 READY TO FIGHT!' : 'SWIPE TO SELECT'}
        </motion.button>
      </div>
    </div>
  );
}
