import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Swords,
  Zap,
  Shield,
  Trophy,
} from 'lucide-react'

// ─── Page Data ───────────────────────────────────────────────────────

interface TutorialPage {
  headline: string
  description: string
  buttonText: string
  Diagram: React.FC
}

// ─── Diagram Components ─────────────────────────────────────────────

function WelcomeDiagram() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Watermark logo */}
      <div className="absolute font-orbitron font-black text-[80px] text-text-primary/[0.04] tracking-logo select-none">
        CLASH
      </div>
      {/* VS burst */}
      <div className="relative flex items-center justify-center gap-8">
        {/* Character 1 silhouette (Swordsman style) */}
        <motion.div
          className="w-20 h-28 rounded-xl bg-gradient-to-t from-accent-cyan/30 to-accent-cyan/10 border border-accent-cyan/40 flex items-center justify-center"
          animate={{ x: [-5, 5, -5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Swords size={32} className="text-accent-cyan/60" />
        </motion.div>

        {/* VS badge */}
        <motion.div
          className="w-16 h-16 rounded-full bg-bg-elevated border-2 border-hp-mid flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="font-orbitron font-black text-xl text-hp-mid">VS</span>
        </motion.div>

        {/* Character 2 silhouette (Ronin style) */}
        <motion.div
          className="w-20 h-28 rounded-xl bg-gradient-to-t from-accent-ice/30 to-accent-ice/10 border border-accent-ice/40 flex items-center justify-center"
          animate={{ x: [5, -5, 5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Zap size={32} className="text-accent-ice/60" />
        </motion.div>
      </div>
    </div>
  )
}

function MovementDiagram() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Joystick base */}
      <div className="relative w-[120px] h-[120px] rounded-full bg-bg-elevated border-2 border-border-active flex items-center justify-center">
        {/* Directional arrows */}
        <div className="absolute -top-3 text-text-muted">
          <ChevronLeft size={16} className="rotate-90" />
        </div>
        <div className="absolute -bottom-3 text-text-muted">
          <ChevronLeft size={16} className="-rotate-90" />
        </div>
        <div className="absolute -left-3 text-text-muted">
          <ChevronLeft size={16} />
        </div>
        <div className="absolute -right-3 text-text-muted">
          <ChevronRight size={16} />
        </div>

        {/* Animated stick */}
        <motion.div
          className="w-[50px] h-[50px] rounded-full bg-white/20 border-2 border-white/50"
          animate={{
            x: [-20, 20, -15, 15, 0],
            y: [0, 0, -10, -10, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Character movement indicator */}
      <motion.div
        className="absolute bottom-4 text-hp-full font-rajdhani font-semibold text-sm"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        ← DRAG TO MOVE →
      </motion.div>
    </div>
  )
}

function AttackDiagram() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* A Button */}
      <div className="relative">
        <motion.div
          className="w-20 h-20 rounded-full bg-accent-cyan/20 border-2 border-accent-cyan flex items-center justify-center"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="font-orbitron font-black text-2xl text-accent-cyan">A</span>
        </motion.div>

        {/* Slash effect */}
        <motion.div
          className="absolute top-1/2 left-full ml-2 w-16 h-1 bg-gradient-to-r from-accent-cyan to-transparent rounded-full origin-left"
          style={{ marginTop: '-2px' }}
          animate={{
            scaleX: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
        />

        {/* Charge ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-hp-mid"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.8, 0, 0.8],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 flex gap-6">
        <span className="font-rajdhani font-medium text-sm text-accent-cyan">TAP = QUICK</span>
        <span className="font-rajdhani font-medium text-sm text-hp-mid">HOLD = SMASH</span>
      </div>
    </div>
  )
}

function SpecialDiagram() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Center B button */}
      <div className="relative">
        <motion.div
          className="w-16 h-16 rounded-full bg-accent-green/20 border-2 border-accent-green flex items-center justify-center"
          animate={{ boxShadow: ['0 0 0px transparent', '0 0 20px rgba(57,255,20,0.3)', '0 0 0px transparent'] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="font-orbitron font-black text-xl text-accent-green">B</span>
        </motion.div>

        {/* Directional arrows with effects */}
        {[
          { dir: 'up', label: '↑', x: 0, y: -50, color: '#4DA6FF' },
          { dir: 'down', label: '↓', x: 0, y: 50, color: '#E81D2D' },
          { dir: 'left', label: '←', x: -50, y: 0, color: '#00E5D4' },
          { dir: 'right', label: '→', x: 50, y: 0, color: '#FFB800' },
        ].map((d) => (
          <motion.div
            key={d.dir}
            className="absolute w-8 h-8 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center text-xs font-bold"
            style={{
              left: `calc(50% + ${d.x}px - 16px)`,
              top: `calc(50% + ${d.y}px - 16px)`,
              color: d.color,
              borderColor: d.color + '66',
            }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: Math.random() * 0.5 }}
          >
            {d.label}
          </motion.div>
        ))}
      </div>

      {/* Energy beam effect */}
      <motion.div
        className="absolute right-8 top-1/2 -translate-y-1/2 w-20 h-2 bg-gradient-to-r from-accent-ice to-transparent rounded-full"
        animate={{
          opacity: [0, 0.8, 0],
          scaleX: [0.5, 1.2, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

function ShieldDiagram() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Shield bubble */}
      <div className="relative">
        <motion.div
          className="w-24 h-24 rounded-full bg-shield-blue/10 border-2 border-shield-blue/60 flex items-center justify-center"
          animate={{
            scale: [1, 1.03, 1],
            borderColor: ['rgba(77,166,255,0.6)', 'rgba(77,166,255,0.8)', 'rgba(77,166,255,0.6)'],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Shield size={36} className="text-shield-blue" />
        </motion.div>

        {/* Spark effect on shield */}
        <motion.div
          className="absolute top-0 right-0 w-3 h-3 rounded-full bg-white"
          animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
        />

        {/* Shield shrinking indicator */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-shield-break/0"
          animate={{
            scale: [1, 0.7, 1],
            borderColor: ['rgba(232,29,45,0)', 'rgba(232,29,45,0.3)', 'rgba(232,29,45,0)'],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Labels */}
      <div className="absolute bottom-4 flex flex-col items-center gap-1">
        <span className="font-rajdhani font-semibold text-sm text-shield-blue">HOLD TO BLOCK</span>
        <span className="font-rajdhani font-normal text-xs text-shield-break">Breaks if held too long!</span>
      </div>
    </div>
  )
}

function DamageDiagram() {
  const [damage, setDamage] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDamage((prev) => {
        if (prev >= 150) return 0
        return prev + 15
      })
    }, 800)
    return () => clearInterval(interval)
  }, [])

  const getDamageColor = (d: number) => {
    if (d < 30) return '#00E5D4'
    if (d < 80) return '#FFB800'
    return '#E81D2D'
  }

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* Damage percentage display */}
      <motion.div
        className="font-orbitron font-black text-5xl tabular-nums"
        style={{ color: getDamageColor(damage) }}
        animate={{ scale: damage >= 120 ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 0.3 }}
      >
        {damage}%
      </motion.div>

      {/* Damage bar */}
      <div className="w-32 h-2 bg-bg-elevated rounded-full mt-4 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: getDamageColor(damage) }}
          animate={{ width: `${Math.min(damage, 150)}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Knockback arrows */}
      <motion.div
        className="flex gap-1 mt-4"
        animate={{ opacity: damage > 60 ? [0.3, 1, 0.3] : 0.3 }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <span className="text-shield-break text-lg">←</span>
        <span className="text-shield-break text-lg">→</span>
        <span className="font-rajdhani font-medium text-xs text-text-muted ml-1">KNOCKBACK</span>
      </motion.div>
    </div>
  )
}

function WinningDiagram() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-4">
      {/* Stock icons */}
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-10 h-10 rounded-full border-2 flex items-center justify-center"
            style={{
              borderColor: i < 1 ? '#F0F0F5' : '#2A2A3A',
              backgroundColor: i < 1 ? '#F0F0F5' : 'transparent',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 300 }}
          >
            {i < 1 ? (
              <Trophy size={18} className="text-bg-dark" />
            ) : (
              <span className="text-border-subtle text-lg">×</span>
            )}
          </motion.div>
        ))}
      </div>

      {/* GAME! text */}
      <motion.div
        className="font-orbitron font-black text-3xl text-hp-mid"
        style={{ textShadow: '0 0 20px rgba(255,184,0,0.4)' }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        GAME!
      </motion.div>

      {/* Blast zone arrows */}
      <div className="flex gap-8 text-text-muted text-xs font-rajdhani">
        <motion.span
          animate={{ x: [-2, 2, -2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          ← BLAST ZONE
        </motion.span>
        <motion.span
          animate={{ x: [2, -2, 2] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          BLAST ZONE →
        </motion.span>
      </div>
    </div>
  )
}

// ─── Page Definitions ───────────────────────────────────────────────

const PAGES: TutorialPage[] = [
  {
    headline: 'WELCOME TO CLASH',
    description:
      'The ultimate mobile platform fighter. Knock your opponent off the stage to win!',
    buttonText: "LET'S FIGHT!",
    Diagram: WelcomeDiagram,
  },
  {
    headline: 'MOVE WITH THE JOYSTICK',
    description:
      'Drag the left stick to run and dash. Tap up to jump, down to crouch.',
    buttonText: 'NEXT TIP',
    Diagram: MovementDiagram,
  },
  {
    headline: 'ATTACK WITH THE A BUTTON',
    description:
      'Tap for quick attacks. Hold to charge a powerful smash. Flick the stick + tap for tilt attacks.',
    buttonText: 'NEXT TIP',
    Diagram: AttackDiagram,
  },
  {
    headline: 'SPECIAL MOVES WITH B',
    description:
      'Tap B for your neutral special. Hold a direction + B for directional specials. Each character has unique moves!',
    buttonText: 'NEXT TIP',
    Diagram: SpecialDiagram,
  },
  {
    headline: 'BLOCK AND DODGE',
    description:
      'Hold shield to block attacks. Your shield weakens over time. Tap shield while holding a direction to roll dodge.',
    buttonText: 'NEXT TIP',
    Diagram: ShieldDiagram,
  },
  {
    headline: 'DAMAGE = KNOCKBACK',
    description:
      'The higher your damage percentage, the farther you fly when hit. Reach 999% and any tap could be your last!',
    buttonText: 'NEXT TIP',
    Diagram: DamageDiagram,
  },
  {
    headline: "KNOCK 'EM OUT",
    description:
      'Launch your opponent past the blast zones to score a KO. Deplete all 3 of their stocks to win the match!',
    buttonText: 'START FIGHTING!',
    Diagram: WinningDiagram,
  },
]

// ─── Main How To Play Component ────────────────────────────────────

export default function HowToPlay() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const [direction, setDirection] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<number>(0)

  const easeGame = [0.22, 1, 0.36, 1] as [number, number, number, number]

  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage < 0) {
        navigate('/')
        return
      }
      if (newPage >= PAGES.length) {
        // Stay on last page
        return
      }
      setDirection(newPage > page ? 1 : -1)
      setPage(newPage)
    },
    [page, navigate]
  )

  const handleNext = useCallback(() => {
    if (page === PAGES.length - 1) {
      navigate('/select')
    } else {
      goToPage(page + 1)
    }
  }, [page, goToPage, navigate])

  const handleSkip = useCallback(() => {
    navigate('/')
  }, [navigate])

  // Touch/swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = touchStart.current - e.changedTouches[0].clientX
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          // Swipe left — next
          if (page < PAGES.length - 1) {
            goToPage(page + 1)
          }
        } else {
          // Swipe right — back
          goToPage(page - 1)
        }
      }
    },
    [page, goToPage]
  )

  // Mouse drag support
  const mouseStart = useRef<number>(0)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseStart.current = e.clientX
  }, [])

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const diff = mouseStart.current - e.clientX
      if (Math.abs(diff) > 50) {
        if (diff > 0 && page < PAGES.length - 1) {
          goToPage(page + 1)
        } else if (diff < 0) {
          goToPage(page - 1)
        }
      }
    },
    [page, goToPage]
  )

  const currentPage = PAGES[page]
  const Diagram = currentPage.Diagram

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
  }

  const easeSnap = [0.68, -0.55, 0.27, 1.55] as [number, number, number, number]

  return (
    <div
      className="relative w-screen h-screen bg-void overflow-hidden flex flex-col select-none"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Header */}
      <motion.header
        className="flex items-center justify-between px-4 pt-3 pb-2 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <button
          onClick={() => goToPage(page - 1)}
          className={`flex items-center justify-center w-11 h-11 rounded-full transition-all duration-instant ${
            page === 0
              ? 'text-text-muted opacity-40'
              : 'text-text-secondary active:text-text-primary active:scale-90'
          }`}
          aria-label="Go back"
          disabled={page === 0}
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>

        <button
          onClick={handleSkip}
          className="font-rajdhani font-semibold text-sm text-text-secondary active:text-text-primary px-3 py-1"
        >
          SKIP
        </button>
      </motion.header>

      {/* Page counter */}
      <motion.div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <span className="font-orbitron font-semibold text-sm text-text-muted tracking-widest">
          {page + 1} / {PAGES.length}
        </span>
      </motion.div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={page}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: easeGame }}
            className="w-full flex flex-col items-center"
          >
            {/* Visual diagram area */}
            <motion.div
              className="w-full max-w-[320px] h-[240px] bg-bg-panel border border-border-subtle rounded-2xl mb-6 overflow-hidden relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: easeGame, delay: 0.1 }}
            >
              <Diagram />
            </motion.div>

            {/* Headline */}
            <motion.h2
              className="font-orbitron font-bold text-[22px] text-text-primary text-center mb-3 leading-tight"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {currentPage.headline}
            </motion.h2>

            {/* Description */}
            <motion.p
              className="font-rajdhani font-normal text-base text-text-secondary text-center max-w-[300px] leading-relaxed"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              {currentPage.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination dots + button area */}
      <div className="px-6 pb-8 flex flex-col items-center gap-5 z-20">
        {/* Pagination dots */}
        <motion.div
          className="flex items-center gap-2.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {PAGES.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => goToPage(i)}
              className="rounded-full transition-colors duration-fast"
              style={{
                width: i === page ? 10 : 8,
                height: i === page ? 10 : 8,
                backgroundColor: i === page ? '#00E5D4' : '#2A2A3A',
              }}
              animate={{
                scale: i === page ? 1.2 : 1,
              }}
              transition={{ duration: 0.2, ease: easeSnap }}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </motion.div>

        {/* Action button */}
        <motion.button
          onClick={handleNext}
          className="w-full max-w-[342px] h-[52px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-button text-[#0A0A0F] flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{
            background: '#00E5D4',
            boxShadow: '0 4px 16px rgba(0,229,212,0.3)',
          }}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3, ease: easeGame }}
          whileTap={{ scale: 0.95 }}
        >
          {currentPage.buttonText}
          <ChevronRight size={18} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Swipe hint */}
      <motion.div
        className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.5, 0] }}
        transition={{ duration: 2, delay: 1, repeat: Infinity }}
      >
        <span className="font-rajdhani font-normal text-xs text-text-muted">
          ← swipe to navigate →
        </span>
      </motion.div>
    </div>
  )
}
