import { ChevronLeft } from 'lucide-react';

interface NavbarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export default function Navbar({ title, showBack = true, onBack }: NavbarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-lg" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {showBack && (
        <button
          onClick={onBack}
          className="flex items-center justify-center w-11 h-11 rounded-full text-text-secondary active:text-text-primary active:scale-90 transition-all duration-instant ease-snap"
          aria-label="Go back"
        >
          <ChevronLeft size={24} strokeWidth={2} />
        </button>
      )}
      <h1
        className="absolute left-1/2 -translate-x-1/2 font-orbitron font-bold text-[32px] tracking-screen-title leading-none text-text-primary pointer-events-none"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {title}
      </h1>
    </nav>
  );
}
