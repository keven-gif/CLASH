import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { Sword, Settings, HelpCircle, Globe, User, Trophy } from 'lucide-react';
import { audioManager } from '@/audio/AudioManager';
import { useAuth } from '@/hooks/useAuth';

const ParticleField = lazy(() => import('@/components/ParticleField'));

// ─── Animation Variants ──────────────────────────────────────────────

const easeSnap = [0.68, -0.55, 0.27, 1.55] as [number, number, number, number];
const easeGame = [0.22, 1, 0.36, 1] as [number, number, number, number];
const easeSmooth = [0.4, 0, 0.2, 1] as [number, number, number, number];

const letterVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.5 + i * 0.08,
      duration: 0.6,
      ease: easeSnap,
    },
  }),
};

const subtitleVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 1.9, duration: 0.5, ease: easeSmooth },
  },
};

const tapToStartVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: 2.4, duration: 0.4, ease: easeSmooth },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const buttonContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const buttonVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeGame },
  },
};

// ─── Shimmer Component ───────────────────────────────────────────────

function ShimmerSweep() {
  return (
    <motion.div
      initial={{ x: '-100%' }}
      animate={{ x: '200%' }}
      transition={{ delay: 1.0, duration: 0.8, ease: easeSmooth }}
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
        width: '50%',
      }}
    />
  );
}

// ─── Logo Letter Component ───────────────────────────────────────────

const LogoLetter = ({ letter, index }: { letter: string; index: number }) => (
  <motion.span
    custom={index}
    variants={letterVariants}
    initial="hidden"
    animate="visible"
    className="inline-block font-orbitron font-black text-[72px] leading-none tracking-logo"
    style={{
      color: '#F0F0F5',
      textShadow: '0 0 40px rgba(0,229,212,0.25), 0 0 80px rgba(0,229,212,0.12)',
    }}
  >
    {letter}
  </motion.span>
);

// ─── Title Screen ────────────────────────────────────────────────────

export default function TitleScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'boot' | 'animating' | 'ready'>('boot');

  // Phase 1: Boot (0ms) — black screen
  // Phase 2: Background fades in at 200ms
  // Phase 3: Logo at 500ms — handled by letterVariants delays
  // Phase 4: Subtitle at 1900ms
  // Phase 5: Tap to Start at 2400ms
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('animating'), 200);
    const t2 = setTimeout(() => setPhase('ready'), 2500);

    // Start title music
    audioManager.playMusic('music-title');

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleFirstTap = useCallback(() => {
    if (!started) {
      setStarted(true);
      audioManager.playSFX('menu-select');
    }
  }, [started]);

  const handleNavigate = useCallback(
    (path: string) => {
      audioManager.playSFX('menu-select');
      audioManager.stopMusic(500);
      navigate(path);
    },
    [navigate],
  );

  const logoLetters = ['C', 'L', 'A', 'S', 'H'];

  return (
    <div
      className="relative w-screen h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#050507' }}
      onClick={handleFirstTap}
    >
      {/* Particle Field Background */}
      {phase !== 'boot' && (
        <Suspense fallback={null}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: easeSmooth }}
            className="absolute inset-0"
          >
            <ParticleField />
          </motion.div>
        </Suspense>
      )}

      {/* Vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          background: 'radial-gradient(ellipse at center, transparent 40%, #050507 100%)',
        }}
      />

      {/* User Corner Display */}
      <motion.div
        className="absolute top-4 right-4 z-30 flex items-center gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.4 }}
      >
        {user ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/leaderboard'); }}
              className="w-9 h-9 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted hover:text-[#FFB800] hover:border-[#FFB800]/40 transition-colors"
            >
              <Trophy size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/profile'); }}
              className="flex items-center gap-2 px-3 h-9 rounded-full bg-bg-elevated border border-border-subtle hover:border-accent-cyan/40 transition-colors"
            >
              <User size={14} className="text-accent-cyan" />
              <span className="font-rajdhani font-semibold text-[13px] text-text-primary max-w-[100px] truncate">
                {user.username}
              </span>
            </button>
          </>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/auth'); }}
            className="flex items-center gap-2 px-4 h-9 rounded-full bg-bg-elevated border border-border-subtle hover:border-accent-cyan/40 transition-colors"
          >
            <User size={14} className="text-text-muted" />
            <span className="font-rajdhani font-semibold text-[13px] text-text-secondary">SIGN IN</span>
          </button>
        )}
      </motion.div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center w-full px-6">
        {/* Logo */}
        <div className="flex items-center justify-center" style={{ marginTop: '-10vh' }}>
          <motion.div
            className="flex"
            animate={{
              textShadow: [
                '0 0 40px rgba(0,229,212,0.4), 0 0 80px rgba(0,229,212,0.2)',
                '0 0 40px rgba(0,229,212,0.7), 0 0 80px rgba(0,229,212,0.35)',
                '0 0 40px rgba(0,229,212,0.4), 0 0 80px rgba(0,229,212,0.2)',
              ],
            }}
            transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
          >
            {logoLetters.map((letter, i) => (
              <LogoLetter key={i} letter={letter} index={i} />
            ))}
          </motion.div>
        </div>

        {/* Subtitle */}
        <motion.p
          variants={subtitleVariants}
          initial="hidden"
          animate="visible"
          className="font-rajdhani font-semibold text-[16px] uppercase tracking-subtitle text-text-muted mt-3"
        >
          PLATFORM FIGHTER
        </motion.p>

        {/* Spacer */}
        <div className="h-20" />

        {/* Tap to Start (shown before first tap) */}
        {!started && (
          <AnimatePresence>
            <motion.p
              variants={tapToStartVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="font-rajdhani font-semibold text-[14px] uppercase tracking-tap text-text-secondary"
              style={{
                animation: 'pulse-glow 2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
              }}
            >
              TAP TO START
            </motion.p>
          </AnimatePresence>
        )}

        {/* Menu Buttons (shown after first tap) */}
        <AnimatePresence>
          {started && (
            <motion.div
              variants={buttonContainerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center w-full gap-3 mt-4"
              onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            >
              {/* ONLINE — Primary (purple) */}
              <motion.button
                variants={buttonVariants}
                whileHover={{ scale: 0.98 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigate(user ? '/lobby' : '/auth')}
                className="relative w-full max-w-[342px] h-14 rounded-[14px] font-rajdhani font-semibold text-[18px] uppercase tracking-button text-white overflow-hidden active:opacity-80 transition-colors duration-instant"
                style={{ backgroundColor: '#8B5CF6', boxShadow: '0 6px 24px rgba(139,92,246,0.25)' }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[14px] bg-white/30" />
                <ShimmerSweep />
                <span className="flex items-center justify-center gap-2">
                  <Globe size={18} /> ONLINE MATCH
                </span>
              </motion.button>

              {/* PLAY — Secondary */}
              <motion.button
                variants={buttonVariants}
                whileHover={{ scale: 0.98 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigate('/select')}
                className="relative w-full max-w-[342px] h-14 rounded-[14px] font-rajdhani font-semibold text-[18px] uppercase tracking-button text-bg-dark bg-text-primary overflow-hidden active:bg-hp-full transition-colors duration-instant"
                style={{ boxShadow: '0 6px 24px rgba(240,240,245,0.12)' }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[14px]"
                  style={{ background: '#00E5D4' }}
                />
                <ShimmerSweep />
                PLAY
              </motion.button>

              {/* CHARACTERS — Secondary */}
              <motion.button
                variants={buttonVariants}
                whileHover={{ scale: 0.98 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigate('/select')}
                className="relative flex items-center justify-center gap-2 w-full max-w-[342px] h-12 rounded-xl font-rajdhani font-semibold text-[18px] uppercase tracking-button text-text-primary border-[1.5px] border-border-subtle bg-transparent active:border-border-active transition-colors duration-instant"
              >
                <Sword size={20} strokeWidth={2} className="text-text-secondary" />
                CHARACTERS
              </motion.button>

              {/* SETTINGS — Secondary */}
              <motion.button
                variants={buttonVariants}
                whileHover={{ scale: 0.98 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigate('/settings')}
                className="relative flex items-center justify-center gap-2 w-full max-w-[342px] h-12 rounded-xl font-rajdhani font-semibold text-[18px] uppercase tracking-button text-text-primary border-[1.5px] border-border-subtle bg-transparent active:border-border-active transition-colors duration-instant"
              >
                <Settings size={20} strokeWidth={2} className="text-text-secondary" />
                SETTINGS
              </motion.button>

              {/* HOW TO PLAY — Secondary */}
              <motion.button
                variants={buttonVariants}
                whileHover={{ scale: 0.98 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleNavigate('/tutorial')}
                className="relative flex items-center justify-center gap-2 w-full max-w-[342px] h-12 rounded-xl font-rajdhani font-semibold text-[18px] uppercase tracking-button text-text-primary border-[1.5px] border-border-subtle bg-transparent active:border-border-active transition-colors duration-instant"
              >
                <HelpCircle size={20} strokeWidth={2} className="text-text-secondary" />
                HOW TO PLAY
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
