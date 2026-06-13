import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'
import {
  Play,
  RotateCcw,
  Settings,
  LogOut,
  Volume2,
  VolumeX,
  ChevronLeft,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────

interface PauseMenuProps {
  isOpen: boolean
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
}

// ─── Setting Slider (local version) ─────────────────────────────────

function PauseSlider({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (val: number) => void
}) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div className="flex items-center gap-3 w-full">
      <span className="font-rajdhani font-medium text-[15px] text-text-primary w-20 flex-shrink-0">
        {label}
      </span>
      <div className="relative flex-1 h-8 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1 rounded-full bg-border-subtle" />
        {/* Track fill */}
        <div
          className="absolute h-1 rounded-full bg-text-primary"
          style={{ width: `${percentage}%` }}
        />
        {/* Native input for touch */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-8 opacity-0 cursor-pointer z-10"
          aria-label={label}
        />
        {/* Thumb */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white pointer-events-none"
          style={{
            left: `calc(${percentage}% - 10px)`,
            boxShadow: '0 0 8px rgba(255,255,255,0.3)',
          }}
        />
      </div>
    </div>
  )
}

// ─── Toggle Switch (local version) ──────────────────────────────────

function PauseToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (val: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <span className="font-rajdhani font-medium text-[15px] text-text-primary">
        {label}
      </span>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-12 h-7 rounded-full transition-colors duration-200 ease-snap flex-shrink-0"
        style={{ backgroundColor: checked ? '#00E5D4' : '#1E1E2A' }}
        aria-label={`Toggle ${label}`}
      >
        <div
          className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-snap"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  )
}

// ─── Main Pause Menu Component ──────────────────────────────────────

export default function PauseMenu({ isOpen, onResume, onRestart, onQuit }: PauseMenuProps) {
  const { settings, updateSettings, restartMatch } = useGameStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)

  // Local slider states
  const [sfxVol, setSfxVol] = useState(Math.round(settings.sfxVolume * 100))
  const [musicVol, setMusicVol] = useState(Math.round(settings.musicVolume * 100))
  const [controlsOpacity, setControlsOpacity] = useState(35)
  const [screenShake, setScreenShake] = useState(true)
  const [damageNumbers, setDamageNumbers] = useState(true)

  const easeSnap = [0.68, -0.55, 0.27, 1.55] as [number, number, number, number]
  const easeGame = [0.22, 1, 0.36, 1] as [number, number, number, number]

  const handleBackdropTap = useCallback(() => {
    if (showQuitConfirm) {
      setShowQuitConfirm(false)
      return
    }
    if (showSettings) {
      setShowSettings(false)
      return
    }
    onResume()
  }, [showQuitConfirm, showSettings, onResume])

  const handleResume = useCallback(() => {
    onResume()
  }, [onResume])

  const handleRestart = useCallback(() => {
    restartMatch()
    onRestart()
  }, [restartMatch, onRestart])

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true)
  }, [])

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false)
  }, [])

  const handleQuit = useCallback(() => {
    setShowQuitConfirm(true)
  }, [])

  const handleConfirmQuit = useCallback(() => {
    setShowQuitConfirm(false)
    onQuit()
  }, [onQuit])

  const handleCancelQuit = useCallback(() => {
    setShowQuitConfirm(false)
  }, [])

  const handleSfxChange = useCallback(
    (val: number) => {
      setSfxVol(val)
      updateSettings({ sfxVolume: val / 100 })
    },
    [updateSettings]
  )

  const handleMusicChange = useCallback(
    (val: number) => {
      setMusicVol(val)
      updateSettings({ musicVolume: val / 100 })
    },
    [updateSettings]
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(5, 5, 7, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: easeGame }}
        onClick={handleBackdropTap}
      />

      {/* Menu card */}
      <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
        <motion.div
          className="relative w-[320px] bg-[rgba(17,17,24,0.95)] border border-border-subtle rounded-3xl px-6 py-8 pointer-events-auto"
          style={{
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ duration: 0.35, ease: easeSnap }}
          onClick={(e) => e.stopPropagation()}
        >
          <AnimatePresence mode="wait">
            {/* ── Quit Confirmation Dialog ── */}
            {showQuitConfirm ? (
              <motion.div
                key="quit-confirm"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.25, ease: easeSnap }}
                className="flex flex-col items-center text-center"
              >
                {/* Additional backdrop overlay */}
                <div className="absolute inset-0 bg-black/30 rounded-3xl -m-6 p-6 z-0" />

                <h3
                  className="font-orbitron font-bold text-2xl text-text-primary mb-2 relative z-10"
                  style={{ textShadow: '0 0 20px rgba(240,240,245,0.1)' }}
                >
                  QUIT?
                </h3>
                <p className="font-rajdhani font-normal text-[15px] text-text-secondary mb-6 relative z-10">
                  Progress will be lost.
                </p>
                <div className="flex gap-3 w-full relative z-10">
                  <button
                    onClick={handleCancelQuit}
                    className="flex-1 h-12 rounded-xl font-rajdhani font-semibold text-base text-text-primary border-[1.5px] border-border-subtle bg-transparent active:border-border-active active:scale-95 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={handleConfirmQuit}
                    className="flex-1 h-12 rounded-xl font-rajdhani font-semibold text-base text-white active:scale-95 transition-transform"
                    style={{
                      background: '#E81D2D',
                      boxShadow: '0 4px 16px rgba(232,29,45,0.3)',
                    }}
                  >
                    QUIT
                  </button>
                </div>
              </motion.div>
            ) : /* ── Settings Sub-Panel ── */
            showSettings ? (
              <motion.div
                key="settings-panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Settings header */}
                <div className="flex items-center mb-5">
                  <button
                    onClick={handleCloseSettings}
                    className="flex items-center gap-1 text-text-secondary active:text-text-primary transition-colors"
                  >
                    <ChevronLeft size={18} strokeWidth={2} />
                    <span className="font-rajdhani font-semibold text-sm">BACK</span>
                  </button>
                </div>

                {/* Settings rows */}
                <div className="flex flex-col gap-4">
                  <PauseSlider
                    label="SFX"
                    value={sfxVol}
                    onChange={handleSfxChange}
                  />
                  <PauseSlider
                    label="MUSIC"
                    value={musicVol}
                    onChange={handleMusicChange}
                  />
                  <PauseSlider
                    label="CONTROLS"
                    value={controlsOpacity}
                    min={20}
                    max={60}
                    onChange={setControlsOpacity}
                  />
                  <PauseToggle
                    label="SCREEN SHAKE"
                    checked={screenShake}
                    onChange={setScreenShake}
                  />
                  <PauseToggle
                    label="DAMAGE NUMBERS"
                    checked={damageNumbers}
                    onChange={setDamageNumbers}
                  />
                </div>
              </motion.div>
            ) : (
              /* ── Main Pause Menu ── */
              <motion.div
                key="main-menu"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                {/* PAUSED title */}
                <motion.h2
                  className="font-orbitron font-bold text-[32px] text-text-primary tracking-[0.1em] mb-6"
                  style={{ textShadow: '0 0 20px rgba(240,240,245,0.1)' }}
                  initial={{ translateY: -20, opacity: 0 }}
                  animate={{ translateY: 0, opacity: 1 }}
                  transition={{ duration: 0.3, ease: easeGame, delay: 0.1 }}
                >
                  PAUSED
                </motion.h2>

                {/* Buttons */}
                <div className="flex flex-col gap-3 w-full">
                  {/* Resume — Primary */}
                  <motion.button
                    onClick={handleResume}
                    className="w-full h-[52px] rounded-xl font-rajdhani font-semibold text-lg uppercase tracking-button text-[#0A0A0F] flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{
                      background: '#F0F0F5',
                      boxShadow: '0 4px 16px rgba(240,240,245,0.15)',
                    }}
                    initial={{ translateY: 20, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ duration: 0.3, ease: easeGame, delay: 0.2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Play size={18} strokeWidth={2.5} className="fill-[#0A0A0F]" />
                    RESUME
                  </motion.button>

                  {/* Restart — Secondary */}
                  <motion.button
                    onClick={handleRestart}
                    className="w-full h-12 rounded-xl font-rajdhani font-semibold text-lg text-text-primary border-[1.5px] border-border-subtle bg-transparent flex items-center justify-center gap-2 active:border-border-active active:scale-95 transition-all"
                    initial={{ translateY: 20, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ duration: 0.3, ease: easeGame, delay: 0.26 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <RotateCcw size={18} strokeWidth={2} />
                    RESTART
                  </motion.button>

                  {/* Settings — Secondary */}
                  <motion.button
                    onClick={handleOpenSettings}
                    className="w-full h-12 rounded-xl font-rajdhani font-semibold text-lg text-text-primary border-[1.5px] border-border-subtle bg-transparent flex items-center justify-center gap-2 active:border-border-active active:scale-95 transition-all"
                    initial={{ translateY: 20, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ duration: 0.3, ease: easeGame, delay: 0.32 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Settings size={18} strokeWidth={2} />
                    SETTINGS
                  </motion.button>

                  {/* Quit — Danger */}
                  <motion.button
                    onClick={handleQuit}
                    className="w-full h-12 rounded-xl font-rajdhani font-semibold text-lg text-white flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{
                      background: '#E81D2D',
                      boxShadow: '0 4px 16px rgba(232,29,45,0.3)',
                    }}
                    initial={{ translateY: 20, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ duration: 0.3, ease: easeGame, delay: 0.38 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LogOut size={18} strokeWidth={2} />
                    QUIT TO MENU
                  </motion.button>
                </div>

                {/* Volume slider */}
                <motion.div
                  className="w-full mt-4 pt-4 border-t border-border-subtle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 }}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const newVol = musicVol > 0 ? 0 : 70
                        setMusicVol(newVol)
                        updateSettings({ musicVolume: newVol / 100 })
                      }}
                      className="text-text-secondary active:text-text-primary transition-colors"
                    >
                      {musicVol > 0 ? (
                        <Volume2 size={20} strokeWidth={2} />
                      ) : (
                        <VolumeX size={20} strokeWidth={2} />
                      )}
                    </button>
                    <div className="relative flex-1 h-6 flex items-center">
                      <div className="absolute w-full h-1 rounded-full bg-border-subtle" />
                      <div
                        className="absolute h-1 rounded-full bg-text-primary"
                        style={{ width: `${musicVol}%` }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={musicVol}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setMusicVol(val)
                          updateSettings({ musicVolume: val / 100 })
                        }}
                        className="absolute w-full h-6 opacity-0 cursor-pointer z-10"
                        aria-label="Volume"
                      />
                      <div
                        className="absolute w-5 h-5 rounded-full bg-white pointer-events-none"
                        style={{
                          left: `calc(${musicVol}% - 10px)`,
                          boxShadow: '0 0 8px rgba(255,255,255,0.3)',
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
