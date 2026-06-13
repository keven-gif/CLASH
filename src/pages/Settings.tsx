import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'
import {
  ChevronLeft,
  Volume2,
  Music,
  Gamepad2,
  Monitor,
  Database,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// ─── Types ───────────────────────────────────────────────────────────

interface SliderProps {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (val: number) => void
  icon?: React.ReactNode
  trackColor?: string
  suffix?: string
  delay?: number
}

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (val: boolean) => void
  delay?: number
}

// ─── Custom Slider Component ────────────────────────────────────────

function SettingSlider({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
  icon,
  trackColor = '#00E5D4',
  suffix = '%',
  delay = 0,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <motion.div
      className="flex flex-col gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-text-secondary">{icon}</span>}
          <span className="font-rajdhani font-medium text-base text-text-primary">
            {label}
          </span>
        </div>
        <span className="font-rajdhani font-semibold text-sm text-text-secondary tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <div className="relative w-full h-6 flex items-center">
        {/* Track background */}
        <div className="absolute w-full h-1 rounded-full bg-border-subtle" />
        {/* Track fill */}
        <div
          className="absolute h-1 rounded-full"
          style={{
            width: `${percentage}%`,
            background: trackColor,
          }}
        />
        {/* Native range input for touch support */}
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-6 opacity-0 cursor-pointer z-10"
          aria-label={label}
        />
        {/* Thumb */}
        <div
          className="absolute w-5 h-5 rounded-full bg-white shadow-md pointer-events-none"
          style={{
            left: `calc(${percentage}% - 10px)`,
            boxShadow: `0 0 10px ${trackColor}66`,
          }}
        />
      </div>
    </motion.div>
  )
}

// ─── Custom Toggle Component ────────────────────────────────────────

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  delay = 0,
}: ToggleProps) {
  return (
    <motion.div
      className="flex items-center justify-between"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="flex flex-col">
        <span className="font-rajdhani font-medium text-base text-text-primary">
          {label}
        </span>
        {description && (
          <span className="font-rajdhani font-normal text-xs text-text-muted">
            {description}
          </span>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="relative w-12 h-7 rounded-full transition-colors duration-200 ease-snap flex-shrink-0"
        style={{
          backgroundColor: checked ? '#00E5D4' : '#1E1E2A',
        }}
        aria-label={`Toggle ${label}`}
      >
        <div
          className="absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ease-snap"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(2px)',
          }}
        />
      </button>
    </motion.div>
  )
}

// ─── Segmented Control ──────────────────────────────────────────────

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-bg-dark border border-border-subtle">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className="flex-1 h-9 rounded-lg font-rajdhani font-semibold text-sm uppercase tracking-wider transition-all duration-fast"
          style={{
            backgroundColor: value === opt ? '#1E1E2A' : 'transparent',
            border: value === opt ? '1px solid #00E5D4' : '1px solid transparent',
            color: value === opt ? '#F0F0F5' : '#555570',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─── Settings Card ─────────────────────────────────────────────────

function SettingsCard({
  icon,
  title,
  children,
  delay = 0,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      className="w-full bg-bg-panel border border-border-subtle rounded-2xl p-5 mb-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-hp-full">{icon}</span>
        <h3 className="font-orbitron font-semibold text-sm text-text-muted tracking-[0.1em]">
          {title}
        </h3>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </motion.div>
  )
}

// ─── Main Settings Component ────────────────────────────────────────

export default function Settings() {
  const navigate = useNavigate()
  const { settings, updateSettings, resetProgress } = useGameStore()

  // Local state for settings (synced with store)
  const [sfxVolume, setSfxVolume] = useState(Math.round(settings.sfxVolume * 100))
  const [musicVolume, setMusicVolume] = useState(Math.round(settings.musicVolume * 100))
  const [controlsOpacity, setControlsOpacity] = useState(35)
  const [joystickSize, setJoystickSize] = useState(120)
  const [buttonSize, setButtonSize] = useState(64)
  const [hapticFeedback, setHapticFeedback] = useState(true)
  const [leftHanded, setLeftHanded] = useState(false)
  const [graphicsQuality, setGraphicsQuality] = useState(settings.graphicsQuality)
  const [screenShake, setScreenShake] = useState(true)
  const [damageNumbers, setDamageNumbers] = useState(true)
  const [particleEffects, setParticleEffects] = useState<'Minimal' | 'Reduced' | 'Full'>('Full')
  const [showFPS, setShowFPS] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)

  const easeGame = [0.22, 1, 0.36, 1] as [number, number, number, number]

  const handleBack = useCallback(() => {
    navigate(-1)
  }, [navigate])

  const handleUpdateSfx = useCallback(
    (val: number) => {
      setSfxVolume(val)
      updateSettings({ sfxVolume: val / 100 })
    },
    [updateSettings]
  )

  const handleUpdateMusic = useCallback(
    (val: number) => {
      setMusicVolume(val)
      updateSettings({ musicVolume: val / 100 })
    },
    [updateSettings]
  )

  const handleUpdateGraphicsQuality = useCallback(
    (val: string) => {
      const quality = val.toLowerCase() as 'low' | 'medium' | 'high'
      setGraphicsQuality(quality)
      updateSettings({ graphicsQuality: quality })
    },
    [updateSettings]
  )

  const handleResetProgress = useCallback(() => {
    resetProgress()
    setSfxVolume(80)
    setMusicVolume(60)
    setControlsOpacity(35)
    setJoystickSize(120)
    setButtonSize(64)
    setHapticFeedback(true)
    setLeftHanded(false)
    setGraphicsQuality('high')
    setScreenShake(true)
    setDamageNumbers(true)
    setParticleEffects('Full')
    setShowFPS(false)
    setResetDialogOpen(false)
  }, [resetProgress])

  const handleResetSettingsOnly = useCallback(() => {
    setSfxVolume(80)
    setMusicVolume(60)
    setControlsOpacity(35)
    setJoystickSize(120)
    setButtonSize(64)
    setHapticFeedback(true)
    setLeftHanded(false)
    setGraphicsQuality('high')
    setScreenShake(true)
    setDamageNumbers(true)
    setParticleEffects('Full')
    setShowFPS(false)
    updateSettings({ sfxVolume: 0.8, musicVolume: 0.5, graphicsQuality: 'high' })
  }, [updateSettings])

  const qualityLabel =
    graphicsQuality === 'high' ? 'High' : graphicsQuality === 'medium' ? 'Medium' : 'Low'

  return (
    <div className="relative w-screen h-screen bg-void overflow-hidden flex flex-col">
      {/* Header */}
      <motion.header
        className="flex items-center justify-between px-4 pt-3 pb-2 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeGame, delay: 0.1 }}
      >
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-11 h-11 rounded-full text-text-secondary active:text-text-primary active:scale-90 transition-all duration-instant"
          aria-label="Go back"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <h1 className="font-orbitron font-bold text-[28px] tracking-screen-title text-text-primary">
            SETTINGS
          </h1>
          <div className="w-[60px] h-[3px] rounded-full bg-hp-full mt-1" />
        </div>

        <div className="w-11" />
      </motion.header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-8">
        {/* ── Audio Section ── */}
        <SettingsCard
          icon={<Volume2 size={20} strokeWidth={2} />}
          title="AUDIO"
          delay={0.2}
        >
          <SettingSlider
            label="SOUND EFFECTS"
            value={sfxVolume}
            min={0}
            max={100}
            onChange={handleUpdateSfx}
            icon={<Volume2 size={18} strokeWidth={2} />}
            trackColor="#00E5D4"
            suffix="%"
            delay={0.25}
          />
          <SettingSlider
            label="MUSIC"
            value={musicVolume}
            min={0}
            max={100}
            onChange={handleUpdateMusic}
            icon={<Music size={18} strokeWidth={2} />}
            trackColor="#4DA6FF"
            suffix="%"
            delay={0.3}
          />
        </SettingsCard>

        {/* ── Controls Section ── */}
        <SettingsCard
          icon={<Gamepad2 size={20} strokeWidth={2} />}
          title="CONTROLS"
          delay={0.3}
        >
          <SettingSlider
            label="HUD OPACITY"
            value={controlsOpacity}
            min={20}
            max={100}
            onChange={setControlsOpacity}
            trackColor="#00E5D4"
            suffix="%"
            delay={0.35}
          />
          <SettingSlider
            label="JOYSTICK SIZE"
            value={joystickSize}
            min={80}
            max={150}
            onChange={setJoystickSize}
            trackColor="#00E5D4"
            suffix="px"
            delay={0.4}
          />
          <SettingSlider
            label="BUTTON SIZE"
            value={buttonSize}
            min={48}
            max={80}
            onChange={setButtonSize}
            trackColor="#00E5D4"
            suffix="px"
            delay={0.45}
          />
          <SettingToggle
            label="HAPTIC FEEDBACK"
            description="Vibrate on hits and KOs"
            checked={hapticFeedback}
            onChange={setHapticFeedback}
            delay={0.5}
          />
          <SettingToggle
            label="LEFT-HANDED MODE"
            description="Swaps joystick and buttons sides"
            checked={leftHanded}
            onChange={setLeftHanded}
            delay={0.55}
          />
        </SettingsCard>

        {/* ── Graphics Section ── */}
        <SettingsCard
          icon={<Monitor size={20} strokeWidth={2} />}
          title="GRAPHICS"
          delay={0.4}
        >
          <div className="flex flex-col gap-2">
            <span className="font-rajdhani font-medium text-base text-text-primary">
              QUALITY
            </span>
            <SegmentedControl
              options={['Low', 'Medium', 'High']}
              value={qualityLabel}
              onChange={handleUpdateGraphicsQuality}
            />
          </div>

          <SettingToggle
            label="SCREEN SHAKE"
            description="Camera shake on heavy hits"
            checked={screenShake}
            onChange={setScreenShake}
            delay={0.5}
          />

          <SettingToggle
            label="DAMAGE NUMBERS"
            description="Show floating damage text"
            checked={damageNumbers}
            onChange={setDamageNumbers}
            delay={0.55}
          />

          <SettingToggle
            label="SHOW FPS"
            description="Display frame rate counter"
            checked={showFPS}
            onChange={setShowFPS}
            delay={0.6}
          />

          <div className="flex flex-col gap-2">
            <span className="font-rajdhani font-medium text-base text-text-primary">
              PARTICLE EFFECTS
            </span>
            <div className="flex gap-1 p-1 rounded-xl bg-bg-dark border border-border-subtle">
              {(['Minimal', 'Reduced', 'Full'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setParticleEffects(opt)}
                  className="flex-1 h-9 rounded-lg font-rajdhani font-semibold text-sm uppercase tracking-wider transition-all duration-fast"
                  style={{
                    backgroundColor:
                      particleEffects === opt ? '#1E1E2A' : 'transparent',
                    border:
                      particleEffects === opt
                        ? '1px solid #00E5D4'
                        : '1px solid transparent',
                    color: particleEffects === opt ? '#F0F0F5' : '#555570',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </SettingsCard>

        {/* ── Data Section ── */}
        <SettingsCard
          icon={<Database size={20} strokeWidth={2} />}
          title="DATA"
          delay={0.5}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-rajdhani font-medium text-base text-text-primary">
                RESET ALL PROGRESS
              </span>
              <span className="font-rajdhani font-normal text-xs text-text-muted">
                Clears unlocks and stats
              </span>
            </div>
            <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <AlertDialogTrigger asChild>
                <button
                  className="px-4 h-9 rounded-lg font-rajdhani font-semibold text-sm text-white flex-shrink-0 active:scale-95 transition-transform"
                  style={{
                    background: 'rgba(232, 29, 45, 0.6)',
                  }}
                >
                  RESET
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-bg-elevated border-border-active rounded-[20px] p-6 max-w-[320px]">
                <AlertDialogHeader className="text-center">
                  <AlertDialogTitle className="font-orbitron font-bold text-2xl text-text-primary text-center">
                    RESET PROGRESS?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-rajdhani font-normal text-[15px] text-text-secondary text-center mt-2">
                    All stats and settings will be reset. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2 mt-4">
                  <AlertDialogAction
                    onClick={handleResetProgress}
                    className="w-full h-12 rounded-xl font-rajdhani font-semibold text-lg text-white bg-hp-high hover:bg-hp-high/90"
                  >
                    RESET
                  </AlertDialogAction>
                  <AlertDialogCancel
                    className="w-full h-12 rounded-xl font-rajdhani font-semibold text-lg text-text-primary bg-transparent border-[1.5px] border-border-subtle hover:bg-bg-panel"
                  >
                    CANCEL
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
            <div className="flex flex-col">
              <span className="font-rajdhani font-medium text-base text-text-primary">
                RESET SETTINGS
              </span>
              <span className="font-rajdhani font-normal text-xs text-text-muted">
                Restore default settings
              </span>
            </div>
            <button
              onClick={handleResetSettingsOnly}
              className="px-4 h-9 rounded-lg font-rajdhani font-semibold text-sm text-text-primary border-[1.5px] border-border-subtle bg-transparent flex-shrink-0 active:scale-95 transition-transform"
            >
              DEFAULT
            </button>
          </div>
        </SettingsCard>

        {/* Version label */}
        <motion.p
          className="text-center font-rajdhani font-normal text-xs text-text-muted mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          CLASH v1.0.0
        </motion.p>
      </div>
    </div>
  )
}
