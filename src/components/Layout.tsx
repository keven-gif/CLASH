import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

// Landscape lock message
function LandscapeLock() {
  return (
    <div className="fixed inset-0 z-[100] bg-void flex flex-col items-center justify-center p-8">
      <div className="w-16 h-28 border-2 border-text-secondary rounded-lg animate-pulse-glow flex items-center justify-center mb-6">
        <div className="w-10 h-6 border border-text-secondary rounded-sm" />
      </div>
      <p className="font-orbitron font-bold text-lg text-text-primary text-center tracking-wide">
        Please Rotate Your Device
      </p>
      <p className="font-rajdhani font-medium text-body text-text-secondary text-center mt-2">
        Portrait mode required for gameplay
      </p>
    </div>
  );
}

// Screen transition wrapper
export default function Layout({ children, className = '' }: LayoutProps) {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const angle = window.screen.orientation?.angle ?? 0;
      const isLandscapeMode = Math.abs(angle) === 90 || window.innerWidth > window.innerHeight;
      setIsLandscape(isLandscapeMode && window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.screen.orientation?.addEventListener?.('change', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.screen.orientation?.removeEventListener?.('change', checkOrientation);
    };
  }, []);

  return (
    <>
      <AnimatePresence>
        {isLandscape && <LandscapeLock key="landscape-lock" />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className={`relative w-full h-[100dvh] overflow-hidden bg-void ${className}`}
        style={{
          paddingLeft: 'max(env(safe-area-inset-left), 24px)',
          paddingRight: 'max(env(safe-area-inset-right), 24px)',
          paddingTop: 'max(env(safe-area-inset-top), 48px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 34px)',
        }}
      >
        {children}
      </motion.div>
    </>
  );
}
