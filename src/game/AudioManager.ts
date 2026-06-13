type SFXName = 'hit' | 'ko' | 'jump' | 'land' | 'shield' | 'countdown' | 'ui_select' | 'ui_back';
type MusicName = 'menu' | 'battle' | 'results';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private sfxVolume = 1.0;
  private musicVolume = 0.6;
  private lastPlayTime = new Map<SFXName, number>();
  private readonly minInterval = 50;

  static getInstance(): AudioManager {
    if (!AudioManager.instance) AudioManager.instance = new AudioManager();
    return AudioManager.instance;
  }

  private constructor() {
    this.sfxVolume = parseFloat(localStorage.getItem('sfxVolume') ?? '1.0');
    this.musicVolume = parseFloat(localStorage.getItem('musicVolume') ?? '0.6');
    const unlock = () => {
      if (this.unlocked) return;
      try { this.ctx = new AudioContext(); this.unlocked = true; } catch {}
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('mousedown', unlock);
    };
    document.addEventListener('touchstart', unlock, { passive: true });
    document.addEventListener('mousedown', unlock, { passive: true });
  }

  setVolume(type: 'sfx' | 'music', vol: number): void {
    if (type === 'sfx') { this.sfxVolume = Math.max(0, Math.min(1, vol)); localStorage.setItem('sfxVolume', String(this.sfxVolume)); }
    else { this.musicVolume = Math.max(0, Math.min(1, vol)); localStorage.setItem('musicVolume', String(this.musicVolume)); }
  }

  getVolume(type: 'sfx' | 'music'): number {
    return type === 'sfx' ? this.sfxVolume : this.musicVolume;
  }

  playSFX(name: SFXName): void {
    if (!this.unlocked || !this.ctx) return;
    const now = Date.now();
    if ((now - (this.lastPlayTime.get(name) ?? 0)) < this.minInterval) return;
    this.lastPlayTime.set(name, now);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    const t = this.ctx.currentTime;
    const vol = this.sfxVolume * 0.25;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const freqs: Record<SFXName, number> = { hit: 220, ko: 110, jump: 440, land: 180, shield: 660, countdown: 880, ui_select: 500, ui_back: 350 };
    osc.frequency.value = freqs[name] ?? 440;
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playMusic(_name: MusicName): void { /* stub */ }
  stopMusic(): void { /* stub */ }
  pauseMusic(): void { this.ctx?.suspend(); }
  resumeMusic(): void { this.ctx?.resume(); }
}

export const audioManager = AudioManager.getInstance();
