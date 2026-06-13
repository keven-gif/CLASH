import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { useGameStore, CHARACTERS } from '@/store/gameStore'
import { RotateCcw, Swords, Home } from 'lucide-react'
import { audioManager } from '@/audio/AudioManager'

// ─── Types ───────────────────────────────────────────────────────────

interface ConfettiParticle {
  id: number
  x: number
  y: number
  w: number
  h: number
  color: string
  rotation: number
  rotationSpeed: number
  fallSpeed: number
  drift: number
  opacity: number
}

interface AnimatedCounterProps {
  value: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
  delay?: number
}

// ─── Animated Counter Component ──────────────────────────────────────

function AnimatedCounter({
  value,
  duration = 800,
  suffix = '',
  prefix = '',
  className = '',
  delay = 0,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const rafId = useRef<number>(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime.current) startTime.current = timestamp
        const elapsed = timestamp - startTime.current
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplay(Math.floor(eased * value))
        if (progress < 1) {
          rafId.current = requestAnimationFrame(animate)
        } else {
          setDisplay(value)
        }
      }
      rafId.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(rafId.current)
    }
  }, [value, duration, delay])

  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}

// ─── Confetti Component ──────────────────────────────────────────────

function Confetti({ winnerAccent }: { winnerAccent: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particles = useRef<ConfettiParticle[]>([])
  const animationRef = useRef<number>(0)
  const startTime = useRef<number>(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Create particles
    const colors = [winnerAccent, '#FFD700', '#FFFFFF', '#00E5D4', '#FFB800']
    const particleCount = 50
    particles.current = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.5,
      w: 4 + Math.random() * 6,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 6,
      fallSpeed: 30 + Math.random() * 50,
      drift: (Math.random() - 0.5) * 30,
      opacity: 0.6 + Math.random() * 0.4,
    }))

    const animate = () => {
      const elapsed = (Date.now() - startTime.current) / 1000
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.current.forEach((p) => {
        p.y += p.fallSpeed * 0.016
        p.x += p.drift * 0.016
        p.rotation += p.rotationSpeed

        // Fade out after 5 seconds
        let alpha = p.opacity
        if (elapsed > 5) {
          alpha = p.opacity * Math.max(0, 1 - (elapsed - 5) / 2)
        }

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = alpha
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()

        // Reset particle if it falls below screen
        if (p.y > canvas.height + 20) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
      })

      if (elapsed < 7) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [winnerAccent])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
      }}
    />
  )
}

// ─── Main Game Over Component ────────────────────────────────────────

export default function GameOver() {
  const navigate = useNavigate()
  const {
    winner,
    player1Character,
    player2Character,
    matchStats,
    restartMatch,
    onlineMode,
    resetMatch,
  } = useGameStore()

  // Ensure we have data — fallback if navigated directly
  const effectiveWinner = winner ?? 1
  const winnerCharacter =
    effectiveWinner === 1
      ? (player1Character ?? CHARACTERS[0])
      : (player2Character ?? CHARACTERS[2])
  const loserCharacter =
    effectiveWinner === 1
      ? (player2Character ?? CHARACTERS[2])
      : (player1Character ?? CHARACTERS[0])

  // Play results music on mount, stop on unmount
  useEffect(() => {
    audioManager.playMusic('results')
    return () => { audioManager.stopMusic() }
  }, [])

  const winnerAccent = winnerCharacter.accentColor
  const stats = matchStats ?? {
    winner: 1 as const,
    player1Stats: {
      totalDamageDealt: 847,
      totalDamageTaken: 623,
      stocksLost: 1,
      stocksTaken: 3,
      matchDuration: 154,
    },
    player2Stats: {
      totalDamageDealt: 623,
      totalDamageTaken: 847,
      stocksLost: 3,
      stocksTaken: 1,
      matchDuration: 154,
    },
  }

  const winnerStats =
    effectiveWinner === 1 ? stats.player1Stats : stats.player2Stats
  const loserStats =
    effectiveWinner === 1 ? stats.player2Stats : stats.player1Stats

  const handleRematch = useCallback(() => {
    if (onlineMode) {
      // Online match infrastructure is torn down after a match — go back to lobby to rematch
      resetMatch()
      navigate('/lobby')
    } else {
      restartMatch()
      navigate('/play')
    }
  }, [onlineMode, restartMatch, resetMatch, navigate])

  const handleChangeCharacters = useCallback(() => {
    if (onlineMode) {
      resetMatch()
      navigate('/lobby')
    } else {
      navigate('/select')
    }
  }, [onlineMode, resetMatch, navigate])

  const handleQuit = useCallback(() => {
    navigate('/')
  }, [navigate])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Animation variants
  const easeSnap = [0.68, -0.55, 0.27, 1.55] as [number, number, number, number]
  const easeGame = [0.22, 1, 0.36, 1] as [number, number, number, number]

  return (
    <div className="relative w-screen h-screen bg-void overflow-hidden">
      {/* Background winner glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${winnerAccent}25 0%, transparent 60%)`,
          zIndex: 0,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, #050507 85%)',
          zIndex: 1,
        }}
      />

      {/* Confetti */}
      <Confetti winnerAccent={winnerAccent} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start h-full px-6 pt-4 pb-4 overflow-y-auto">
        {/* WINNER Header */}
        <motion.div
          className="flex items-center gap-2 mt-4 mb-6"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: easeSnap, delay: 0.3 }}
        >
          <motion.span
            className="text-[#FFD700] text-xl"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            ★
          </motion.span>
          <motion.h2
            className="font-orbitron font-bold text-xl tracking-[0.3em] text-[#FFD700]"
            style={{ textShadow: '0 0 20px rgba(255, 215, 0, 0.4)' }}
            animate={{ y: [0, -3, 0] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
            }}
          >
            WINNER
          </motion.h2>
          <motion.span
            className="text-[#FFD700] text-xl"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            ★
          </motion.span>
        </motion.div>

        {/* Winner Portrait + Loser Side-by-Side */}
        <div className="flex items-center justify-center gap-4 mb-8 w-full max-w-[360px]">
          {/* Loser portrait (smaller, dimmed) */}
          <motion.div
            className="relative flex-shrink-0 opacity-50"
            initial={{ scale: 0.6, opacity: 0, x: 30 }}
            animate={{ scale: 0.75, opacity: 0.5, x: 0 }}
            transition={{ duration: 0.6, ease: easeSnap, delay: 0.5 }}
          >
            <div
              className="w-[90px] h-[110px] rounded-2xl overflow-hidden border border-border-subtle bg-bg-panel"
              style={{
                filter: 'grayscale(0.4) brightness(0.6)',
              }}
            >
              <img
                src={loserCharacter.image}
                alt={loserCharacter.name}
                className="w-full h-full object-cover object-top"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-dark/80 to-transparent" />
            </div>
            <p className="text-center font-rajdhani font-semibold text-sm text-text-secondary mt-1">
              {loserCharacter.name}
            </p>
          </motion.div>

          {/* VS divider */}
          <motion.span
            className="font-orbitron font-bold text-sm text-text-muted tracking-widest flex-shrink-0"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.3 }}
          >
            VS
          </motion.span>

          {/* Winner portrait (large) */}
          <motion.div
            className="relative flex-shrink-0"
            initial={{ scale: 0.6, opacity: 0, x: -30 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: easeSnap, delay: 0.6 }}
          >
            <motion.div
              className="relative w-[180px] h-[220px] rounded-[20px] overflow-hidden bg-bg-panel border"
              style={{
                borderColor: winnerAccent,
                boxShadow: `inset 0 0 40px ${winnerAccent}33, 0 0 30px ${winnerAccent}40`,
              }}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
                delay: 1.5,
              }}
            >
              {/* Flash overlay on entrance */}
              <motion.div
                className="absolute inset-0 bg-white pointer-events-none z-20"
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.4, delay: 1.1 }}
              />
              <img
                src={winnerCharacter.image}
                alt={winnerCharacter.name}
                className="w-full h-full object-cover object-top relative z-10"
                draggable={false}
              />
              {/* Gradient overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-bg-dark to-transparent z-10" />
              {/* Name + WINS! */}
              <div className="absolute bottom-4 left-0 right-0 text-center z-20">
                <h3
                  className="font-orbitron font-black text-[28px] text-text-primary leading-none"
                  style={{
                    textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                  }}
                >
                  {winnerCharacter.name}
                </h3>
                <p className="font-rajdhani font-bold text-lg text-[#FFD700] uppercase mt-1">
                  WINS!
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Match Stats Section */}
        <motion.div
          className="w-full max-w-[342px] mb-6"
          initial={{ translateY: 30, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: easeGame, delay: 0.9 }}
        >
          {/* Section header */}
          <motion.div
            className="flex items-center justify-center gap-3 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.3 }}
          >
            <div className="w-[60px] h-px bg-border-subtle" />
            <span className="font-orbitron font-semibold text-sm text-text-muted tracking-[0.2em]">
              MATCH STATS
            </span>
            <div className="w-[60px] h-px bg-border-subtle" />
          </motion.div>

          {/* Stats grid */}
          <motion.div
            className="bg-bg-panel border border-border-subtle rounded-2xl p-5"
            initial={{ translateY: 30, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: easeGame, delay: 1.2 }}
          >
            {/* Column headers */}
            <div className="flex justify-between items-center mb-4">
              <span
                className="font-rajdhani font-bold text-base"
                style={{ color: winnerAccent }}
              >
                {winnerCharacter.name}
              </span>
              <span className="font-orbitron font-bold text-sm text-text-muted">
                VS
              </span>
              <span
                className="font-rajdhani font-bold text-base"
                style={{ color: loserCharacter.accentColor }}
              >
                {loserCharacter.name}
              </span>
            </div>

            {/* Stat rows */}
            {[
              { label: 'KOs', winnerVal: winnerStats.stocksTaken, loserVal: loserStats.stocksTaken },
              { label: 'Falls', winnerVal: winnerStats.stocksLost, loserVal: loserStats.stocksLost },
              { label: 'Damage Dealt', winnerVal: winnerStats.totalDamageDealt, loserVal: loserStats.totalDamageTaken, suffix: '%' },
              { label: 'Damage Taken', winnerVal: winnerStats.totalDamageTaken, loserVal: loserStats.totalDamageDealt, suffix: '%' },
              { label: 'Max %', winnerVal: Math.max(winnerStats.totalDamageDealt, 187), loserVal: Math.max(loserStats.totalDamageTaken, 234), suffix: '%' },
            ].map((row, i) => (
              <motion.div
                key={row.label}
                className="flex justify-between items-center py-2.5 border-b border-border-subtle last:border-b-0"
                initial={{ opacity: 0, translateX: -10 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ delay: 1.3 + i * 0.06, duration: 0.3 }}
              >
                <span className="font-rajdhani font-semibold text-xl" style={{ color: winnerAccent }}>
                  <AnimatedCounter
                    value={row.winnerVal}
                    delay={1300 + i * 60}
                    suffix={row.suffix ?? ''}
                  />
                </span>
                <span className="font-rajdhani font-medium text-sm text-text-muted">
                  {row.label}
                </span>
                <span className="font-rajdhani font-semibold text-xl text-text-secondary">
                  <AnimatedCounter
                    value={row.loserVal}
                    delay={1300 + i * 60}
                    suffix={row.suffix ?? ''}
                  />
                </span>
              </motion.div>
            ))}

            {/* Match duration */}
            <motion.div
              className="flex justify-center items-center pt-3 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7, duration: 0.3 }}
            >
              <span className="font-rajdhani font-medium text-sm text-text-muted">
                Duration: {formatTime(
                  typeof winnerStats.matchDuration === 'number' && winnerStats.matchDuration > 1000000000
                    ? 154
                    : (winnerStats.matchDuration ?? 154)
                )}
              </span>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Action Buttons */}
        <div className="w-full max-w-[342px] flex flex-col gap-3">
          {/* Rematch — Primary */}
          <motion.button
            onClick={handleRematch}
            className="w-full h-[52px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-button text-[#0A0A0F] flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{
              background: '#00E5D4',
              boxShadow: '0 4px 16px rgba(0,229,212,0.3)',
            }}
            initial={{ translateY: 30, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: easeGame, delay: 1.6 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw size={18} strokeWidth={2.5} />
            REMATCH
          </motion.button>

          {/* Change Characters — Secondary */}
          <motion.button
            onClick={handleChangeCharacters}
            className="w-full h-[48px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-button text-text-primary border-[1.5px] border-border-subtle bg-transparent flex items-center justify-center gap-2 active:border-border-active active:scale-95 transition-all"
            initial={{ translateY: 30, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: easeGame, delay: 1.68 }}
            whileTap={{ scale: 0.95 }}
          >
            <Swords size={18} strokeWidth={2} />
            CHANGE CHARACTERS
          </motion.button>

          {/* Quit to Menu — Secondary */}
          <motion.button
            onClick={handleQuit}
            className="w-full h-[48px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-button text-text-primary border-[1.5px] border-border-subtle bg-transparent flex items-center justify-center gap-2 active:border-border-active active:scale-95 transition-all"
            initial={{ translateY: 30, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: easeGame, delay: 1.76 }}
            whileTap={{ scale: 0.95 }}
          >
            <Home size={18} strokeWidth={2} />
            QUIT TO MENU
          </motion.button>
        </div>
      </div>
    </div>
  )
}
