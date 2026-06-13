import { useEffect, useRef } from 'react';

// Electric streak with random character accent color
interface Streak {
  x: number;
  y: number;
  length: number;
  speed: number;
  color: string;
  opacity: number;
  width: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  opacity: number;
  phase: number;
  phaseSpeed: number;
  amplitude: number;
}

const ACCENT_COLORS = ['#E81D2D', '#00E5D4', '#4DA6FF', '#39FF14'];

export default function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const streaksRef = useRef<Streak[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const lastStreakTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    // Initialize particles
    const initParticles = () => {
      const count = 50;
      particlesRef.current = [];
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          size: 2 + Math.random() * 2,
          speedY: -(5 + Math.random() * 10),
          opacity: 0.1 + Math.random() * 0.2,
          phase: Math.random() * Math.PI * 2,
          phaseSpeed: 0.5 + Math.random() * 1.5,
          amplitude: 10 + Math.random() * 10,
        });
      }
    };
    initParticles();

    // Spawn a new streak
    const spawnStreak = () => {
      const color = ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)];
      streaksRef.current.push({
        x: window.innerWidth + 50,
        y: Math.random() * window.innerHeight,
        length: 80 + Math.random() * 120,
        speed: 40 + Math.random() * 80,
        color,
        opacity: 0.1 + Math.random() * 0.05,
        width: 1 + Math.random(),
      });
    };

    // Animation loop
    const animate = (time: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      // Spawn streaks
      if (time - lastStreakTimeRef.current > (300 + Math.random() * 500)) {
        spawnStreak();
        lastStreakTimeRef.current = time;
      }

      // Update and draw streaks
      streaksRef.current = streaksRef.current.filter((streak) => {
        streak.x -= streak.speed * (1 / 60);

        if (streak.x + streak.length < 0) return false;

        // Draw streak with glow
        ctx.save();
        ctx.globalAlpha = streak.opacity;
        ctx.strokeStyle = streak.color;
        ctx.lineWidth = streak.width;
        ctx.shadowColor = streak.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(streak.x, streak.y);
        ctx.lineTo(streak.x + streak.length, streak.y);
        ctx.stroke();
        ctx.restore();

        return true;
      });

      // Update and draw particles
      const dt = 1 / 60;
      particlesRef.current.forEach((p) => {
        p.y += p.speedY * dt;
        p.phase += p.phaseSpeed * dt;
        p.x += Math.sin(p.phase) * p.amplitude * 0.02;

        // Wrap around
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = '#555570';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
      }}
    />
  );
}
