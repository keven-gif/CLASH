export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center justify-center pb-4 text-center pointer-events-none" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
      <p className="font-rajdhani font-normal text-caption text-text-muted tracking-wide">
        CLASH v1.0 &middot; Platform Fighter
      </p>
    </footer>
  );
}
