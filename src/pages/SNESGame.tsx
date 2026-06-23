import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

declare global {
  interface Window {
    EJS_player: string;
    EJS_gameUrl: string;
    EJS_core: string;
    EJS_pathtodata: string;
    EJS_startOnLoaded: boolean;
    EJS_color: string;
    EJS_backgroundColor: string;
    EJS_Buttons: Record<string, boolean>;
  }
}

export default function SNESGame() {
  const navigate = useNavigate();
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    window.EJS_player = '#ejs-player';
    window.EJS_gameUrl = `${base}game.sfc`;
    window.EJS_core = 'snes9x';
    window.EJS_pathtodata = `${base}emulatorjs/`;
    window.EJS_startOnLoaded = true;
    window.EJS_color = '#39FF14';
    window.EJS_backgroundColor = '#050507';

    const script = document.createElement('script');
    script.src = `${base}emulatorjs/loader.js`;
    document.body.appendChild(script);
    scriptRef.current = script;

    return () => {
      if (scriptRef.current && document.body.contains(scriptRef.current)) {
        document.body.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden" style={{ background: '#050507' }}>
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-3 left-3 z-50 flex items-center gap-1.5 px-3 h-9 rounded-full font-rajdhani font-semibold text-[13px] uppercase tracking-wide text-text-primary border border-border-subtle bg-bg-elevated/80 backdrop-blur-sm hover:border-border-active transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <ArrowLeft size={14} />
        MENU
      </button>

      {/* EmulatorJS container */}
      <div id="ejs-player" className="w-full h-full" />
    </div>
  );
}
