// Audio Manager for CLASH — Web Audio API-based sound system
// Handles SFX playback, music loops, and volume control

export type SFXName =
  | 'menu-hover'
  | 'menu-select'
  | 'menu-back'
  | 'countdown'
  | 'go'
  | 'hit-light'
  | 'hit-heavy'
  | 'hit-special'
  | 'shield-up'
  | 'shield-break'
  | 'ko'
  | 'star-ko'
  | 'game-over';

export type MusicName =
  | 'music-title'
  | 'music-gameplay'
  | 'music-results'
  | 'menu'
  | 'battle'
  | 'results';

class AudioManager {
  private static instance: AudioManager;
  private sfxVolume = 0.8;
  private musicVolume = 0.5;
  private currentMusic: HTMLAudioElement | null = null;
  private currentMusicName: MusicName | null = null;
  private musicFadeInterval: number | null = null;
  private unlocked = false;
  private pendingMusic: MusicName | null = null;

  private constructor() {
    // Unlock audio on first user interaction
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      // Play and immediately pause a silent buffer to unlock audio context
      const silent = new Audio();
      silent.play().catch(() => {});
      // If music was queued before unlock, play it now
      if (this.pendingMusic) {
        const name = this.pendingMusic;
        this.pendingMusic = null;
        this.playMusic(name);
      }
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('mousedown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('mousedown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ─── Volume Control ────────────────────────────────────────────────

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.currentMusic) {
      this.currentMusic.volume = this.musicVolume;
    }
  }

  getSFXVolume(): number {
    return this.sfxVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  // ─── SFX Playback ──────────────────────────────────────────────────

  playSFX(name: SFXName): void {
    if (this.sfxVolume <= 0) return;

    const path = `/audio/sfx-${name}.mp3`;

    try {
      const audio = new Audio(path);
      audio.volume = this.sfxVolume;
      audio.play().catch(() => {
        // Audio playback failed (common on mobile before user interaction)
      });
    } catch {
      // Audio not available
    }
  }

  // ─── Music Playback ────────────────────────────────────────────────

  playMusic(name: MusicName): void {
    if (this.musicVolume <= 0) return;

    // Queue until user has interacted (browser autoplay policy)
    if (!this.unlocked) {
      this.pendingMusic = name;
      return;
    }

    // Resolve short aliases to full names
    const aliasMap: Record<string, MusicName> = {
      menu: 'music-title',
      battle: 'music-gameplay',
      results: 'music-results',
    };
    const resolvedName: MusicName = (aliasMap[name] as MusicName) ?? name;

    // Don't restart if already playing
    if (this.currentMusicName === resolvedName && this.currentMusic && !this.currentMusic.paused) {
      return;
    }

    // Stop any current music
    this.stopMusic();

    const path = `/audio/${resolvedName}.mp3`;

    try {
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = this.musicVolume;
      this.currentMusic = audio;
      this.currentMusicName = resolvedName;
      audio.play().catch(() => {
        // Autoplay blocked, will need user interaction first
      });
    } catch {
      // Audio not available
    }
  }

  stopMusic(fadeDuration = 0): void {
    if (!this.currentMusic) return;

    if (fadeDuration > 0) {
      // Fade out
      const startVolume = this.currentMusic.volume;
      const steps = 20;
      const stepDuration = fadeDuration / steps;
      let step = 0;

      if (this.musicFadeInterval) {
        clearInterval(this.musicFadeInterval);
      }

      this.musicFadeInterval = window.setInterval(() => {
        step++;
        if (this.currentMusic) {
          this.currentMusic.volume = startVolume * (1 - step / steps);
          if (step >= steps) {
            this.currentMusic?.pause();
            this.currentMusic = null;
            this.currentMusicName = null;
            if (this.musicFadeInterval) {
              clearInterval(this.musicFadeInterval);
              this.musicFadeInterval = null;
            }
          }
        }
      }, stepDuration);
    } else {
      this.currentMusic.pause();
      this.currentMusic = null;
      this.currentMusicName = null;
    }
  }

  // ─── Utility ───────────────────────────────────────────────────────

  pauseAll(): void {
    this.currentMusic?.pause();
  }

  resumeMusic(): void {
    this.currentMusic?.play().catch(() => {});
  }

  isMusicPlaying(): boolean {
    return this.currentMusic !== null && !this.currentMusic.paused;
  }
}

export const audioManager = AudioManager.getInstance();
export default audioManager;
