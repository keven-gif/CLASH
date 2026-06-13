import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Zap, Sword, Shield, Sparkles } from 'lucide-react';
import { useGameStore, CHARACTERS } from '@/store/gameStore';
import type { Character } from '@/store/gameStore';
import { audioManager } from '@/audio/AudioManager';

// ─── Stat Bar Component ──────────────────────────────────────────────

interface StatBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  icon: React.ReactNode;
  delay: number;
  animate: boolean;
}

function StatBar({ label, value, maxValue, color, icon, delay, animate }: StatBarProps) {
  const pct = Math.round((value / maxValue) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-5 h-5 text-text-secondary">
        {icon}
      </div>
      <span className="font-rajdhani font-semibold text-[12px] text-text-secondary uppercase tracking-wider w-14">
        {label}
      </span>
      <div className="flex-1 h-2 bg-border-subtle rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: animate ? `${pct}%` : 0 }}
          transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        />
      </div>
      <span className="font-rajdhani font-semibold text-[12px] text-text-muted w-6 text-right">
        {value}
      </span>
    </div>
  );
}

// ─── Character Card ──────────────────────────────────────────────────

interface CharacterCardProps {
  character: Character;
  index: number;
  isSelected: boolean;
  isP1: boolean;
  isCPU: boolean;
  onSelect: (char: Character) => void;
}

function CharacterCard({ character, index, isSelected, isP1, isCPU, onSelect }: CharacterCardProps) {
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (isSelected) {
      const t = setTimeout(() => setShowStats(true), 150);
      return () => clearTimeout(t);
    }
    setShowStats(false);
  }, [isSelected]);

  const statMax = 5;

  return (
    <motion.div
      className="relative cursor-pointer flex-1 h-full min-w-0"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: 0.3 + index * 0.1,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      }}
      onClick={() => onSelect(character)}
    >
      {/* Card container — fills full height/width of its slot */}
      <motion.div
        className="relative overflow-hidden h-full border-[1.5px]"
        style={{
          backgroundColor: '#111118',
          borderColor: isSelected ? `${character.accentColor}99` : '#2A2A3A',
          boxShadow: isSelected ? `0 0 24px ${character.accentColor}40, inset 0 0 24px ${character.accentColor}15` : 'none',
        }}
        animate={{
          scale: isSelected ? 1.02 : 1,
        }}
        transition={{ duration: 0.2, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
        whileTap={{ scale: 0.97 }}
      >
        {/* Character image — fills entire card */}
        <div className="relative w-full h-full overflow-hidden">
          <img
            src={character.image}
            alt={character.name}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
          {/* Gradient overlay — stronger at bottom for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, transparent 30%, rgba(10,10,15,0.6) 55%, rgba(10,10,15,0.92) 80%, rgba(10,10,15,0.98) 100%)',
            }}
          />

          {/* P1 Badge */}
          <AnimatePresence>
            {isP1 && (
              <motion.div
                className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full font-rajdhani font-bold text-[13px] text-white z-20"
                style={{ backgroundColor: '#00E5D4' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
              >
                P1
              </motion.div>
            )}
          </AnimatePresence>

          {/* CPU Badge */}
          <AnimatePresence>
            {isCPU && (
              <motion.div
                className="absolute top-3 left-3 flex items-center justify-center w-8 h-8 rounded-full font-rajdhani font-bold text-[13px] text-white z-20"
                style={{ backgroundColor: '#E81D2D' }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
              >
                CPU
              </motion.div>
            )}
          </AnimatePresence>

          {/* Character name + archetype at bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-10">
            <h3 className="font-orbitron font-bold text-[clamp(9px,2.8vw,18px)] tracking-wide text-text-primary leading-tight">
              {character.name.toUpperCase()}
            </h3>
            {/* Archetype tag */}
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full font-rajdhani font-semibold text-[10px] tracking-wide"
              style={{
                backgroundColor: `${character.accentColor}20`,
                color: character.accentColor,
                border: `1px solid ${character.accentColor}40`,
              }}
            >
              {character.archetype.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Stats panel — slides up from bottom as overlay when selected */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 px-3 py-3 space-y-2 border-t border-border-subtle z-30"
              style={{ backgroundColor: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(4px)' }}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            >
              <StatBar
                label="SPD"
                value={character.stats.speed}
                maxValue={statMax}
                color={character.accentColor}
                icon={<Zap size={14} />}
                delay={0}
                animate={showStats}
              />
              <StatBar
                label="PWR"
                value={character.stats.power}
                maxValue={statMax}
                color={character.accentColor}
                icon={<Sword size={14} />}
                delay={0.1}
                animate={showStats}
              />
              <StatBar
                label="DEF"
                value={character.stats.defense}
                maxValue={statMax}
                color={character.accentColor}
                icon={<Shield size={14} />}
                delay={0.2}
                animate={showStats}
              />
              <StatBar
                label="SPC"
                value={character.stats.special}
                maxValue={statMax}
                color={character.accentColor}
                icon={<Sparkles size={14} />}
                delay={0.3}
                animate={showStats}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function CharacterSelect() {
  const navigate = useNavigate();
  const { player1Character, player2Character, selectCharacter } = useGameStore();
  const [cpuAssigned, setCpuAssigned] = useState(false);

  // Play menu music on mount
  useEffect(() => {
    audioManager.playMusic('music-title');
  }, []);

  // Auto-assign CPU a random different character after P1 selects
  const handleSelect = useCallback(
    (char: Character) => {
      selectCharacter(1, char);

      // Pick a different character for CPU
      const otherChars = CHARACTERS.filter((c) => c.id !== char.id);
      const cpuChar = otherChars[Math.floor(Math.random() * otherChars.length)];
      selectCharacter(2, cpuChar);
      setCpuAssigned(true);
    },
    [selectCharacter],
  );

  const handleFight = useCallback(() => {
    if (player1Character) {
      navigate('/stage');
    }
  }, [navigate, player1Character]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const isReady = player1Character !== null;

  return (
    <div className="relative w-screen h-screen bg-void overflow-hidden select-none flex flex-col">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <motion.nav
        className="h-14 flex-shrink-0 relative z-50 flex items-center px-4"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      >
        {/* Back button */}
        <motion.button
          onClick={handleBack}
          className="flex items-center justify-center w-11 h-11 rounded-full text-text-secondary active:text-text-primary transition-colors duration-fast"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Go back"
        >
          <ChevronLeft size={28} strokeWidth={2} />
        </motion.button>

        {/* Title — centered */}
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <h1 className="font-orbitron font-bold text-[clamp(18px,2.5vw,28px)] tracking-screen-title leading-tight text-text-primary">
            CHOOSE YOUR FIGHTER
          </h1>
          {/* Underline */}
          <div className="mx-auto mt-1 w-[60px] h-[2px] rounded-full bg-hp-full" />
        </div>
      </motion.nav>

      {/* ─── Character Cards Row ─────────────────────────────────── */}
      {/* Cap height so portraits aren't cropped on tall narrow mobile screens */}
      <div className="flex-1 min-h-0 max-h-[72vw] sm:max-h-none flex flex-row items-stretch">
        {CHARACTERS.map((char, i) => (
          <CharacterCard
            key={char.id}
            character={char}
            index={i}
            isSelected={player1Character?.id === char.id}
            isP1={player1Character?.id === char.id}
            isCPU={player2Character?.id === char.id && cpuAssigned}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* ─── VS + Action Bar ─────────────────────────────────────── */}
      <div className="flex-1 flex-shrink-0 relative z-40 flex items-center justify-center px-6 gap-4">
        {/* P1 Character (left side) */}
        <div className="flex-1 flex justify-end items-center">
          <AnimatePresence>
            {isReady && player1Character && (
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
              >
                <div className="flex flex-col items-end">
                  <span className="font-rajdhani font-bold text-[10px] tracking-wider" style={{ color: player1Character.accentColor }}>
                    P1
                  </span>
                  <span className="font-rajdhani font-bold text-[14px] text-text-primary leading-tight">
                    {player1Character.name}
                  </span>
                </div>
                <img
                  src={player1Character.image}
                  alt={player1Character.name}
                  className="w-10 h-10 rounded-lg object-cover border-2"
                  style={{ borderColor: player1Character.accentColor }}
                  draggable={false}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Center: VS circle + FIGHT button */}
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {isReady && player1Character && player2Character && (
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
              >
                {/* VS */}
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-full font-orbitron font-black text-[14px] text-bg-dark"
                  style={{ backgroundColor: '#F0F0F5' }}
                >
                  VS
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* FIGHT! button */}
          <motion.button
            onClick={handleFight}
            className="h-11 px-8 rounded-xl font-rajdhani font-bold text-[18px] uppercase tracking-wider transition-all duration-normal"
            style={{
              backgroundColor: isReady ? '#00E5D4' : '#2A2A3A',
              color: isReady ? '#0A0A0F' : '#555570',
              boxShadow: isReady ? '0 4px 20px rgba(0,229,212,0.3)' : 'none',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
            whileTap={isReady ? { scale: 0.95 } : {}}
            disabled={!isReady}
          >
            {isReady ? 'FIGHT! \u2192' : 'SELECT'}
          </motion.button>
        </div>

        {/* CPU Character (right side) */}
        <div className="flex-1 flex justify-start items-center">
          <AnimatePresence>
            {isReady && player2Character && (
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.3, ease: [0.68, -0.55, 0.27, 1.55] as [number, number, number, number] }}
              >
                <img
                  src={player2Character.image}
                  alt={player2Character.name}
                  className="w-10 h-10 rounded-lg object-cover border-2"
                  style={{ borderColor: player2Character.accentColor }}
                  draggable={false}
                />
                <div className="flex flex-col items-start">
                  <span className="font-rajdhani font-bold text-[10px] tracking-wider" style={{ color: player2Character.accentColor }}>
                    CPU
                  </span>
                  <span className="font-rajdhani font-bold text-[14px] text-text-primary leading-tight">
                    {player2Character.name}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
