import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    EJS_player: string;
    EJS_core: string;
    EJS_gameUrl: string;
    EJS_pathtodata: string;
    EJS_color: string;
    EJS_startOnLoaded: boolean;
    EJS_backgroundColor: string;
    EJS_volume: number;
    EJS_onGameStart?: () => void;
  }
}

export default function MegaManZero() {
  const [phase, setPhase] = useState<'splash' | 'loading' | 'ready'>('splash');
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    if (phase !== 'loading') return;

    // Configure EmulatorJS globals before injecting the loader
    window.EJS_player = '#ejs-game';
    window.EJS_core = 'gba';
    window.EJS_gameUrl = `${base}roms/4567fb4f-Mega_Man_Zero.zip`;
    const ejsPath = `${window.location.origin}${base}ejs/`;
    window.EJS_pathtodata = ejsPath;
    window.EJS_color = '#CC1122';
    window.EJS_backgroundColor = '#0d0010';
    window.EJS_startOnLoaded = true;
    window.EJS_volume = 0.8;
    window.EJS_onGameStart = () => setPhase('ready');

    const script = document.createElement('script');
    script.src = `${ejsPath}loader.js`;
    script.async = true;
    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current) {
        document.body.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, [phase, base]);

  return (
    <div
      className="relative w-screen h-screen flex flex-col overflow-hidden"
      style={{ background: '#0d0010' }}
    >
      {/* ── Splash / Press-Start Screen ── */}
      {phase === 'splash' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 select-none">
          {/* Background energy lines */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px opacity-20"
                style={{
                  left: `${10 + i * 16}%`,
                  background: 'linear-gradient(to bottom, transparent, #FF2244, transparent)',
                  animationName: 'pulse',
                  animationDuration: `${2 + i * 0.4}s`,
                  animationTimingFunction: 'ease-in-out',
                  animationIterationCount: 'infinite',
                }}
              />
            ))}
          </div>

          {/* Logo block */}
          <div className="relative flex flex-col items-center gap-6 px-8">
            {/* Red armor glow circle */}
            <div
              className="absolute rounded-full opacity-25 blur-3xl"
              style={{ width: 260, height: 260, background: '#FF2244' }}
            />

            {/* Zero silhouette SVG */}
            <img
              src={`${base}characters/zero.svg`}
              alt="Zero"
              className="relative z-10 drop-shadow-[0_0_32px_rgba(255,34,68,0.8)]"
              style={{ width: 110, height: 165 }}
            />

            {/* Title */}
            <div className="relative z-10 flex flex-col items-center gap-1 text-center">
              <p
                className="font-orbitron font-black tracking-widest text-[11px] uppercase"
                style={{ color: '#FF6680', letterSpacing: '0.3em' }}
              >
                MEGA MAN
              </p>
              <h1
                className="font-orbitron font-black text-[48px] leading-none"
                style={{
                  color: '#F0F0F5',
                  textShadow: '0 0 40px rgba(255,34,68,0.6), 0 0 80px rgba(255,34,68,0.3)',
                }}
              >
                ZERO
              </h1>
              <p
                className="font-orbitron font-semibold text-[12px] tracking-widest mt-1"
                style={{ color: '#00FFB0', textShadow: '0 0 16px rgba(0,255,176,0.7)' }}
              >
                GBA · EMULATED
              </p>
            </div>

            {/* Tap to play */}
            <button
              onClick={() => setPhase('loading')}
              className="relative z-10 mt-4 px-10 py-4 rounded-2xl font-orbitron font-bold text-[15px] uppercase tracking-widest text-white active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #CC1122 0%, #880010 100%)',
                boxShadow: '0 0 32px rgba(255,34,68,0.4), 0 6px 20px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,100,128,0.3)',
              }}
            >
              TAP TO PLAY
            </button>

            {/* Info tags */}
            <div className="relative z-10 flex gap-3 mt-2">
              {['SAVE STATES', 'TOUCH CONTROLS', 'FULLSCREEN'].map((tag) => (
                <span
                  key={tag}
                  className="font-rajdhani font-semibold text-[9px] uppercase tracking-wider px-2 py-1 rounded"
                  style={{
                    background: 'rgba(255,34,68,0.12)',
                    border: '1px solid rgba(255,34,68,0.25)',
                    color: '#FF8899',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Loading overlay (while EJS boots) ── */}
      {phase === 'loading' && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 pointer-events-none"
          style={{ background: '#0d0010' }}
        >
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#FF2244 transparent #FF2244 #FF2244' }}
          />
          <p
            className="font-orbitron text-[12px] uppercase tracking-widest animate-pulse"
            style={{ color: '#FF6680' }}
          >
            LOADING…
          </p>
        </div>
      )}

      {/* ── EmulatorJS mount point ── */}
      {phase !== 'splash' && (
        <div
          id="ejs-game"
          className="w-full h-full"
          style={{ display: phase === 'loading' ? 'none' : 'block' }}
        />
      )}
    </div>
  );
}
