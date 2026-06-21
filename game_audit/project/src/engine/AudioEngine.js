/**
 * AudioEngine.js — Procedural Audio System for Echoes of the Small
 *
 * A fully procedural adaptive music and SFX engine using the Web Audio API.
 * No external audio files — all sounds are synthesized in real-time.
 *
 * Music Architecture:
 *   4-layer adaptive system:
 *     1. Rhythm   — Percussive foundation (kick, snare, hi-hat patterns)
 *     2. Bass     — Low melodic foundation (triangle wave)
 *     3. Melody   — Main thematic content (sine/square waves)
 *     4. Atmosphere — Ambient pads, environmental drone
 *
 *   Intensity (0.0–1.0) controls which layers play:
 *     0.00–0.25: Only atmosphere
 *     0.25–0.50: + bass
 *     0.50–0.75: + rhythm
 *     0.75–1.00: + melody (full arrangement)
 *
 * Biome Themes (6 unique scales/chords):
 *   FOREST:   Natural minor, earthy drones
 *   DESERT:   Phrygian dominant, sparse rhythm
 *   MOUNTAIN: Dorian mode, resonant atmosphere
 *   SWAMP:    Diminished tones, murky pads
 *   ICE:      Lydian mode, crystalline harmonics
 *   VOLCANO:  Harmonic minor, aggressive percussion
 *
 * SFX Types (13 procedural sounds):
 *   sword_swing, hit_enemy, hit_player, parry, dodge,
 *   footstep, item_pickup, scale_change, enemy_alert,
 *   boss_roar, quest_complete, ui_select, ui_confirm
 */

/** Note frequencies for 4 octaves starting from C2. */
const NOTE_FREQUENCIES = {};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Build frequency lookup table: NOTE_OCTAVE → frequency
(function buildFreqTable() {
  const A4 = 440;
  const A4_INDEX = 57; // C0 = 0, A4 = 57
  for (let oct = 0; oct < 8; oct++) {
    for (let n = 0; n < 12; n++) {
      const noteIndex = oct * 12 + n;
      const halfSteps = noteIndex - A4_INDEX;
      const freq = A4 * Math.pow(2, halfSteps / 12);
      NOTE_FREQUENCIES[`${NOTE_NAMES[n]}${oct}`] = freq;
    }
  }
})();

/** Biome musical themes — scale degrees and chord progressions. */
const BIOME_THEMES = {
  FOREST: {
    name: 'Forest',
    root: 'D',
    scale: ['D3', 'E3', 'F3', 'G3', 'A3', 'A#3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], // D natural minor
    chords: [
      ['D3', 'F3', 'A3'],
      ['G3', 'A#3', 'D4'],
      ['A3', 'C4', 'E4'],
      ['F3', 'A3', 'C4']
    ],
    bassPattern: ['D2', 'D2', 'G2', 'A2'],
    rhythmComplexity: 0.4,
    atmosphereTone: 'warm',
    bpm: 90
  },
  DESERT: {
    name: 'Desert',
    root: 'E',
    scale: ['E3', 'F3', 'G#3', 'A3', 'B3', 'C4', 'D#4', 'E4', 'F4', 'G#4', 'A4', 'B4'], // E Phrygian dominant
    chords: [
      ['E3', 'G#3', 'B3'],
      ['F3', 'A3', 'C4'],
      ['B2', 'D#3', 'F#3'],
      ['A2', 'C3', 'E3']
    ],
    bassPattern: ['E2', 'F2', 'B2', 'A2'],
    rhythmComplexity: 0.6,
    atmosphereTone: 'dry',
    bpm: 100
  },
  MOUNTAIN: {
    name: 'Mountain',
    root: 'G',
    scale: ['G3', 'A3', 'A#3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'A#4', 'C5', 'D5'], // G Dorian
    chords: [
      ['G3', 'A#3', 'D4'],
      ['C4', 'E4', 'G4'],
      ['D4', 'F#4', 'A4'],
      ['A3', 'C4', 'E4']
    ],
    bassPattern: ['G2', 'G2', 'C3', 'D3'],
    rhythmComplexity: 0.5,
    atmosphereTone: 'resonant',
    bpm: 85
  },
  SWAMP: {
    name: 'Swamp',
    root: 'C',
    scale: ['C3', 'C#3', 'D#3', 'F3', 'F#3', 'G#3', 'A3', 'C4', 'C#4', 'D#4', 'F4', 'F#4'], // C diminished feel
    chords: [
      ['C3', 'D#3', 'F#3'],
      ['F#2', 'A2', 'C3'],
      ['G#2', 'C3', 'D#3'],
      ['C3', 'F3', 'G#3']
    ],
    bassPattern: ['C2', 'F#2', 'G#2', 'C2'],
    rhythmComplexity: 0.3,
    atmosphereTone: 'murky',
    bpm: 75
  },
  ICE: {
    name: 'Ice',
    root: 'A',
    scale: ['A3', 'B3', 'C#4', 'D#4', 'E4', 'F#4', 'G#4', 'A4', 'B4', 'C#5', 'D#5', 'E5'], // A Lydian
    chords: [
      ['A3', 'C#4', 'E4'],
      ['D#4', 'F#4', 'A4'],
      ['B3', 'D#4', 'F#4'],
      ['C#4', 'E4', 'G#4']
    ],
    bassPattern: ['A2', 'D#3', 'B2', 'C#3'],
    rhythmComplexity: 0.35,
    atmosphereTone: 'crystalline',
    bpm: 70
  },
  VOLCANO: {
    name: 'Volcano',
    root: 'F',
    scale: ['F3', 'G3', 'G#3', 'A3', 'B3', 'C4', 'D#4', 'F4', 'G4', 'G#4', 'A4', 'B4'], // F harmonic minor feel
    chords: [
      ['F3', 'A3', 'C4'],
      ['G#3', 'B3', 'D#4'],
      ['C3', 'D#3', 'G3'],
      ['A2', 'C3', 'E3']
    ],
    bassPattern: ['F2', 'G#2', 'C3', 'A2'],
    rhythmComplexity: 0.8,
    atmosphereTone: 'fiery',
    bpm: 120
  }
};

/**
 * AudioEngine — Procedural music and SFX system using Web Audio API.
 */
class AudioEngine {
  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------
  constructor() {
    // Web Audio API context
    this.ctx = null;
    this.masterGain = null;
    this.masterVolume = 0.7;

    // Music state
    this.currentIntensity = 0.0;
    this.targetIntensity = 0.0;
    this.intensityTransitionSpeed = 0.5; // Per-second lerp speed
    this.bpm = 100;
    this.baseBPM = 100;
    this.currentBiome = 'FOREST';
    this.isPlaying = false;
    this.musicStartTime = 0;
    this.beatTime = 0;      // Time of last beat
    this.beatDuration = 60 / this.bpm;
    this.beatCount = 0;     // Current beat in pattern
    this.barCount = 0;      // Current bar

    // 4-layer music system
    this.layers = {
      rhythm:   { active: false, volume: 0, targetVolume: 0, gainNode: null, pattern: [] },
      bass:     { active: false, volume: 0, targetVolume: 0, gainNode: null, pattern: [] },
      melody:   { active: false, volume: 0, targetVolume: 0, gainNode: null, pattern: [] },
      atmosphere: { active: true, volume: 0.3, targetVolume: 0.3, gainNode: null, nodes: [] }
    };

    // SFX
    this.sfxGain = null;
    this.sfxVolume = 0.6;

    // Scheduled nodes (for cleanup)
    this.scheduledNodes = [];
    this.maxScheduledNodes = 500;

    // Audio context state
    this._audioContextStarted = false;
    this._suspendedByAutoplay = true;

    // Footstep timer
    this.footstepTimer = 0;
    this.footstepInterval = 0.35;
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------
  /**
   * Initialize the audio engine.
   * Creates the AudioContext, master gain, and layer gain nodes.
   * Handles browser autoplay restrictions gracefully.
   */
  init() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // SFX gain (separate from music)
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Layer gain nodes
      for (const [name, layer] of Object.entries(this.layers)) {
        layer.gainNode = this.ctx.createGain();
        layer.gainNode.gain.value = 0;
        layer.gainNode.connect(this.masterGain);
      }

      // Set initial biome
      this.setBiome(this.currentBiome);

      console.log('[AudioEngine] Initialized. State:', this.ctx.state);

      // Listen for first user interaction to resume AudioContext
      if (this.ctx.state === 'suspended') {
        this._suspendedByAutoplay = true;
        const resumeHandler = () => {
          this.resume();
          document.removeEventListener('click', resumeHandler);
          document.removeEventListener('keydown', resumeHandler);
          document.removeEventListener('touchstart', resumeHandler);
        };
        document.addEventListener('click', resumeHandler);
        document.addEventListener('keydown', resumeHandler);
        document.addEventListener('touchstart', resumeHandler);
      }

    } catch (e) {
      console.error('[AudioEngine] Failed to initialize:', e);
    }
  }

  // --------------------------------------------------------------------------
  // AudioContext Lifecycle
  // --------------------------------------------------------------------------
  /**
   * Resume the AudioContext (required after browser autoplay suspension).
   * Call after user interaction (click, keypress, touch).
   */
  resume() {
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this._suspendedByAutoplay = false;
        console.log('[AudioEngine] AudioContext resumed.');
      }).catch((e) => {
        console.warn('[AudioEngine] Could not resume AudioContext:', e);
      });
    }
  }

  /**
   * Suspend the AudioContext (for pause/menu states).
   */
  suspend() {
    if (!this.ctx) return;
    this.ctx.suspend();
  }

  // --------------------------------------------------------------------------
  // Music Control
  // --------------------------------------------------------------------------
  /**
   * Start playing the adaptive music.
   * Initializes the atmosphere layer immediately, other layers follow based on intensity.
   */
  startMusic() {
    if (!this.ctx || this.isPlaying) return;

    this.resume();
    this.isPlaying = true;
    this.musicStartTime = this.ctx.currentTime;
    this.beatTime = this.musicStartTime;
    this.beatCount = 0;
    this.barCount = 0;

    console.log('[AudioEngine] Music started.');
  }

  /**
   * Stop all music playback and fade out.
   */
  stopMusic() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    // Fade out all layers
    const fadeTime = this.ctx ? this.ctx.currentTime + 0.5 : 0;
    for (const layer of Object.values(this.layers)) {
      if (layer.gainNode) {
        try {
          layer.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
          layer.gainNode.gain.linearRampToValueAtTime(0, fadeTime);
        } catch (e) {}
      }
    }

    // Stop atmosphere nodes
    this._stopAtmosphere();

    console.log('[AudioEngine] Music stopped.');
  }

  /**
   * Set the target intensity level (0.0–1.0).
   * Layers activate/deactivate based on intensity thresholds:
   *   0.00–0.25: atmosphere only
   *   0.25–0.50: + bass
   *   0.50–0.75: + rhythm
   *   0.75–1.00: + melody
   *
   * @param {number} val — Target intensity (clamped 0–1)
   */
  setIntensity(val) {
    this.targetIntensity = Math.max(0, Math.min(1, val));

    // Calculate target volumes for each layer
    const t = this.targetIntensity;

    // Atmosphere: always on, varies 0.1–0.4
    this.layers.atmosphere.targetVolume = 0.1 + t * 0.3;

    // Bass: active at t >= 0.2, volume 0–0.5
    this.layers.bass.targetVolume = t >= 0.2 ? Math.min(1, (t - 0.2) / 0.3) * 0.5 : 0;

    // Rhythm: active at t >= 0.45, volume 0–0.6
    this.layers.rhythm.targetVolume = t >= 0.45 ? Math.min(1, (t - 0.45) / 0.3) * 0.6 : 0;

    // Melody: active at t >= 0.7, volume 0–0.45
    this.layers.melody.targetVolume = t >= 0.7 ? Math.min(1, (t - 0.7) / 0.3) * 0.45 : 0;
  }

  /**
   * Set the current biome theme.
   * Changes the scale, chords, and atmosphere to match the biome.
   *
   * @param {string} biome — One of: 'FOREST', 'DESERT', 'MOUNTAIN', 'SWAMP', 'ICE', 'VOLCANO'
   */
  setBiome(biome) {
    const theme = BIOME_THEMES[biome];
    if (!theme) {
      console.warn(`[AudioEngine] Unknown biome: ${biome}`);
      return;
    }

    const wasPlaying = this.isPlaying;

    // Stop current atmosphere before switching
    if (this.currentBiome !== biome) {
      this._stopAtmosphere();
    }

    this.currentBiome = biome;
    this.baseBPM = theme.bpm;
    this.bpm = theme.bpm;
    this.beatDuration = 60 / this.bpm;

    // Restart atmosphere with new theme
    if (wasPlaying && this.isPlaying) {
      this._startAtmosphere();
    }

    console.log(`[AudioEngine] Biome set to ${theme.name} (${theme.root}), BPM: ${this.bpm}`);
  }

  // --------------------------------------------------------------------------
  // Update (called every frame)
  // --------------------------------------------------------------------------
  /**
   * Update the audio engine.
   * Handles intensity transitions, beat scheduling, and layer mixing.
   *
   * @param {number} dt — Delta time in seconds
   */
  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (!this.isPlaying) return;

    // Smooth intensity transition
    const diff = this.targetIntensity - this.currentIntensity;
    if (Math.abs(diff) > 0.001) {
      this.currentIntensity += diff * Math.min(1, this.intensityTransitionSpeed * dt);
    }

    // Update layer volumes
    this._updateLayerVolumes(dt);

    // Update beat timing
    this._updateBeat(dt);

    // Schedule notes for active layers
    this._scheduleLayerNotes();
  }

  /**
   * Smoothly transition layer gain nodes toward target volumes.
   * @private
   */
  _updateLayerVolumes(dt) {
    const lerpSpeed = 3.0 * dt;
    for (const [name, layer] of Object.entries(this.layers)) {
      const diff = layer.targetVolume - layer.volume;
      if (Math.abs(diff) > 0.001) {
        layer.volume += diff * Math.min(1, lerpSpeed);
        if (layer.gainNode) {
          try {
            layer.gainNode.gain.setValueAtTime(layer.volume, this.ctx.currentTime);
          } catch (e) {}
        }
      }
    }
  }

  /**
   * Update beat timing and advance the sequencer.
   * @private
   */
  _updateBeat(dt) {
    this.beatTime += dt;

    // Check if we've passed a beat boundary
    const beatLen = this.beatDuration;
    while (this.beatTime >= beatLen) {
      this.beatTime -= beatLen;
      this.beatCount++;

      // 4 beats per bar
      if (this.beatCount >= 4) {
        this.beatCount = 0;
        this.barCount++;
      }
    }
  }

  /**
   * Schedule notes for all active layers based on the current beat.
   * @private
   */
  _scheduleLayerNotes() {
    // Only schedule on beat boundaries
    if (this.beatTime > 0.05) return;

    const theme = BIOME_THEMES[this.currentBiome];
    if (!theme) return;

    const now = this.ctx.currentTime;
    const beatLen = this.beatDuration;

    // ---- Rhythm layer ----
    if (this.layers.rhythm.volume > 0.01) {
      this._scheduleRhythm(now, beatLen, theme);
    }

    // ---- Bass layer ----
    if (this.layers.bass.volume > 0.01) {
      this._scheduleBass(now, beatLen, theme);
    }

    // ---- Melody layer ----
    if (this.layers.melody.volume > 0.01) {
      this._scheduleMelody(now, beatLen, theme);
    }

    // ---- Atmosphere layer ----
    if (this.layers.atmosphere.volume > 0.01) {
      // Atmosphere is continuous drone, check if we need to restart
      if (this.layers.atmosphere.nodes.length === 0) {
        this._startAtmosphere();
      }
    }
  }

  // --------------------------------------------------------------------------
  // Rhythm Layer
  // --------------------------------------------------------------------------
  /**
   * Schedule a rhythm pattern note.
   * Kick on beats 0 and 2, snare on beats 1 and 3, hi-hat on every beat.
   * @private
   */
  _scheduleRhythm(now, beatLen, theme) {
    const beat = this.beatCount;
    const complexity = theme.rhythmComplexity;

    // Kick drum (beats 0 and 2)
    if (beat === 0 || beat === 2) {
      this._playKick(now, this.layers.rhythm.gainNode);
    }

    // Snare (beats 1 and 3)
    if (beat === 1 || beat === 3) {
      this._playSnare(now, this.layers.rhythm.gainNode);
    }

    // Hi-hat (every beat, with variations)
    if (complexity > 0.3) {
      this._playHiHat(now, this.layers.rhythm.gainNode, beat % 2 === 0 ? 0.3 : 0.15);
    }

    // Extra kick for high complexity (beat 2.5 / off-beat)
    if (complexity > 0.6 && beat === 2) {
      this._playKick(now + beatLen * 0.5, this.layers.rhythm.gainNode, 0.4);
    }

    // Extra hi-hats for high complexity
    if (complexity > 0.7) {
      this._playHiHat(now + beatLen * 0.5, this.layers.rhythm.gainNode, 0.1);
    }
  }

  /**
   * Synthesize a kick drum sound.
   * Uses a quickly descending oscillator for the "thud".
   * @private
   */
  _playKick(time, destination, volume = 0.8) {
    if (!this.ctx) return;
    const t = time || this.ctx.currentTime;
    const dest = destination || this.masterGain;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(dest);

    // Frequency envelope: high to low quickly
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);

    // Amplitude envelope
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.start(t);
    osc.stop(t + 0.25);

    this._trackNode(osc);
    this._trackNode(gain);
  }

  /**
   * Synthesize a snare drum sound.
   * Uses noise burst + tonal component.
   * @private
   */
  _playSnare(time, destination, volume = 0.5) {
    if (!this.ctx) return;
    const t = time || this.ctx.currentTime;
    const dest = destination || this.masterGain;

    // Noise component (snap)
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1000;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);

    noise.start(t);
    noise.stop(t + 0.15);

    // Tonal component (body)
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(volume * 0.3, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.frequency.value = 200;

    osc.start(t);
    osc.stop(t + 0.12);

    this._trackNode(noise);
    this._trackNode(osc);
  }

  /**
   * Synthesize a hi-hat sound.
   * Uses high-pass filtered noise.
   * @private
   */
  _playHiHat(time, destination, volume = 0.2) {
    if (!this.ctx) return;
    const t = time || this.ctx.currentTime;
    const dest = destination || this.masterGain;

    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 8000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(t);
    noise.stop(t + 0.05);

    this._trackNode(noise);
    this._trackNode(gain);
  }

  // --------------------------------------------------------------------------
  // Bass Layer
  // --------------------------------------------------------------------------
  /**
   * Schedule bass notes following the chord progression.
   * @private
   */
  _scheduleBass(now, beatLen, theme) {
    const beat = this.beatCount;
    const bar = this.barCount % 4; // 4-bar progression

    // Play root note on beat 0, fifth on beat 2
    if (beat === 0 || beat === 2) {
      const chordIdx = bar % theme.chords.length;
      const noteInChord = beat === 0 ? 0 : 2; // Root or fifth
      const note = theme.chords[chordIdx][noteInChord];
      const freq = this._getNoteFreq(note);

      if (freq) {
        const duration = beat === 0 ? beatLen * 1.5 : beatLen * 0.8;
        const vol = this.layers.bass.volume * 0.7;
        this._playBassNote(now, freq, duration, vol);
      }
    }

    // Walking bass line for higher complexity
    if ((theme.rhythmComplexity > 0.5 && beat === 1) || beat === 3) {
      const chordIdx = bar % theme.chords.length;
      const noteIdx = (beat === 1) ? 1 : 0;
      const note = theme.chords[chordIdx][noteIdx];
      const freq = this._getNoteFreq(note);
      if (freq) {
        this._playBassNote(now, freq, beatLen * 0.5, this.layers.bass.volume * 0.4);
      }
    }
  }

  /**
   * Play a bass note using a triangle wave with subtle overdrive.
   * @private
   */
  _playBassNote(time, frequency, duration, volume) {
    if (!this.ctx) return;
    const t = time || this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, t);

    // Slight pitch envelope for punch
    osc.frequency.setValueAtTime(frequency * 1.02, t);
    osc.frequency.exponentialRampToValueAtTime(frequency, t + 0.03);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.setTargetAtTime(0.01, t + duration * 0.5, duration * 0.3);

    osc.connect(gain);
    gain.connect(this.layers.bass.gainNode);

    osc.start(t);
    osc.stop(t + duration + 0.1);

    this._trackNode(osc);
    this._trackNode(gain);
  }

  // --------------------------------------------------------------------------
  // Melody Layer
  // --------------------------------------------------------------------------
  /**
   * Schedule melody notes from the biome scale.
   * Creates a simple arpeggiated pattern.
   * @private
   */
  _scheduleMelody(now, beatLen, theme) {
    const beat = this.beatCount;

    // Play melody notes on beats 0 and 2
    if (beat === 0 || beat === 2) {
      const scale = theme.scale;
      const noteIdx = (this.barCount * 2 + (beat === 0 ? 0 : 1)) % scale.length;
      const note = scale[noteIdx];
      const freq = this._getNoteFreq(note);

      if (freq) {
        const duration = beatLen * 0.8;
        const vol = this.layers.melody.volume * 0.5;
        this._playMelodyNote(now, freq, duration, vol);
      }
    }
  }

  /**
   * Play a melody note using a sine wave with harmonics.
   * @private
   */
  _playMelodyNote(time, frequency, duration, volume) {
    if (!this.ctx) return;
    const t = time || this.ctx.currentTime;

    // Main oscillator (sine for pure tone)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, t);

    // Harmonic oscillator (subtle overtone)
    const harmonic = this.ctx.createOscillator();
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(frequency * 2, t);

    const mainGain = this.ctx.createGain();
    mainGain.gain.setValueAtTime(volume * 0.7, t);
    mainGain.gain.setTargetAtTime(0.01, t + duration * 0.4, duration * 0.3);

    const harmGain = this.ctx.createGain();
    harmGain.gain.setValueAtTime(volume * 0.15, t);
    harmGain.gain.setTargetAtTime(0.01, t + duration * 0.3, duration * 0.2);

    osc.connect(mainGain);
    harmonic.connect(harmGain);
    mainGain.connect(this.layers.melody.gainNode);
    harmGain.connect(this.layers.melody.gainNode);

    osc.start(t);
    harmonic.start(t);
    osc.stop(t + duration + 0.05);
    harmonic.stop(t + duration + 0.05);

    this._trackNode(osc);
    this._trackNode(harmonic);
    this._trackNode(mainGain);
    this._trackNode(harmGain);
  }

  // --------------------------------------------------------------------------
  // Atmosphere Layer
  // --------------------------------------------------------------------------
  /**
   * Start the atmosphere drone for the current biome.
   * Creates a layered ambient pad using sustained oscillators.
   * @private
   */
  _startAtmosphere() {
    if (!this.ctx) return;
    this._stopAtmosphere();

    const theme = BIOME_THEMES[this.currentBiome];
    if (!theme) return;

    const now = this.ctx.currentTime;
    const rootNote = theme.chords[0][0]; // First chord root
    const rootFreq = this._getNoteFreq(rootNote);
    if (!rootFreq) return;

    // Create 3 detuned oscillators for rich drone texture
    const detunes = [0, 7, 12]; // cents offsets
    const volumes = [0.12, 0.08, 0.05];

    for (let i = 0; i < detunes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(rootFreq * (1 + detunes[i] / 1200), now);
      osc.detune.value = detunes[i];

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volumes[i], now + 2);

      // Low-pass filter for warmth
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.layers.atmosphere.gainNode);

      osc.start(now);

      this.layers.atmosphere.nodes.push({ osc, gain, filter });
      this._trackNode(osc);
      this._trackNode(gain);
    }

    // Add a subtle LFO for movement
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2; // Very slow
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 3; // 3 Hz detune range
    lfo.connect(lfoGain);
    // LFO modulates the detune of the first oscillator
    if (this.layers.atmosphere.nodes[0]) {
      lfoGain.connect(this.layers.atmosphere.nodes[0].osc.detune);
    }
    lfo.start(now);
    this.layers.atmosphere.nodes.push({ osc: lfo, gain: lfoGain });
  }

  /**
   * Stop all atmosphere nodes.
   * @private
   */
  _stopAtmosphere() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    for (const node of this.layers.atmosphere.nodes) {
      try {
        if (node.gain) {
          node.gain.gain.cancelScheduledValues(now);
          node.gain.gain.setValueAtTime(node.gain.gain.value, now);
          node.gain.gain.linearRampToValueAtTime(0, now + 1);
        }
        if (node.osc) {
          node.osc.stop(now + 1.1);
        }
      } catch (e) {}
    }

    this.layers.atmosphere.nodes = [];
  }

  // --------------------------------------------------------------------------
  // SFX System
  // --------------------------------------------------------------------------
  /**
   * Play a sound effect by type.
   * All SFX are procedurally synthesized.
   *
   * @param {string} type — SFX type name:
   *   'sword_swing'    — Noise burst + lowpass sweep
   *   'hit_enemy'      — Quick sawtooth descending pitch
   *   'hit_player'     — Low sine thud
   *   'parry'          — Bright metallic ping (high sine + harmonics)
   *   'dodge'          — Quick whoosh (filtered noise)
   *   'footstep'       — Very short noise burst
   *   'item_pickup'    — Ascending 3-note chime
   *   'scale_change'   — Pitch bend drone
   *   'enemy_alert'    — Short dissonant interval
   *   'boss_roar'      — Low frequency saw sweep
   *   'quest_complete' — Triumphant 5-note fanfare
   *   'ui_select'      — Short blip
   *   'ui_confirm'     — Pleasant chord
   * @param {object} [options={}] — Optional overrides: { volume, pitch, duration }
   */
  playSFX(type, options = {}) {
    if (!this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const vol = options.volume !== undefined ? options.volume : this.sfxVolume;

    switch (type) {
      case 'sword_swing':
        this._sfxSwordSwing(now, vol);
        break;
      case 'hit_enemy':
        this._sfxHitEnemy(now, vol, options.pitch);
        break;
      case 'hit_player':
        this._sfxHitPlayer(now, vol);
        break;
      case 'parry':
        this._sfxParry(now, vol);
        break;
      case 'dodge':
        this._sfxDodge(now, vol);
        break;
      case 'footstep':
        this._sfxFootstep(now, vol);
        break;
      case 'item_pickup':
        this._sfxItemPickup(now, vol);
        break;
      case 'scale_change':
        this._sfxScaleChange(now, vol, options.direction);
        break;
      case 'enemy_alert':
        this._sfxEnemyAlert(now, vol);
        break;
      case 'boss_roar':
        this._sfxBossRoar(now, vol);
        break;
      case 'quest_complete':
        this._sfxQuestComplete(now, vol);
        break;
      case 'ui_select':
        this._sfxUISelect(now, vol);
        break;
      case 'ui_confirm':
        this._sfxUIConfirm(now, vol);
        break;
      default:
        console.warn(`[AudioEngine] Unknown SFX type: ${type}`);
    }
  }

  /** Sword swing: noise burst + lowpass sweep @private */
  _sfxSwordSwing(time, volume) {
    const t = time;
    const duration = 0.15;

    // White noise buffer
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Lowpass filter sweep
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(300, t + duration);
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + duration);

    this._trackNode(noise);
    this._trackNode(gain);
  }

  /** Hit enemy: quick sawtooth descending pitch @private */
  _sfxHitEnemy(time, volume, pitch) {
    const t = time;
    const baseFreq = pitch || 440;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, t + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    // High-pass for sharp attack
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 200;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.13);

    this._trackNode(osc);
    this._trackNode(gain);
  }

  /** Hit player: low sine thud @private */
  _sfxHitPlayer(time, volume) {
    const t = time;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.26);

    this._trackNode(osc);
    this._trackNode(gain);
  }

  /** Parry: bright metallic ping (high sine + harmonics) @private */
  _sfxParry(time, volume) {
    const t = time;

    // Main ping
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, t);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, t);

    const osc3 = this.ctx.createOscillator();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(3600, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, t);
    gain.gain.setValueAtTime(volume * 0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc3.start(t);
    osc1.stop(t + 0.42);
    osc2.stop(t + 0.42);
    osc3.stop(t + 0.42);

    this._trackNode(osc1);
    this._trackNode(osc2);
    this._trackNode(osc3);
    this._trackNode(gain);
  }

  /** Dodge: quick whoosh (filtered noise) @private */
  _sfxDodge(time, volume) {
    const t = time;
    const duration = 0.2;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + duration * 0.3);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume * 0.4, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + duration);

    this._trackNode(noise);
    this._trackNode(gain);
  }

  /** Footstep: very short noise burst @private */
  _sfxFootstep(time, volume) {
    const t = time;
    const duration = 0.04;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + duration);

    this._trackNode(noise);
    this._trackNode(gain);
  }

  /** Item pickup: ascending 3-note chime @private */
  _sfxItemPickup(time, volume) {
    const t = time;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const delays = [0, 0.08, 0.16];

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + delays[i]);
      gain.gain.linearRampToValueAtTime(volume * 0.3, t + delays[i] + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delays[i] + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + delays[i]);
      osc.stop(t + delays[i] + 0.3);

      this._trackNode(osc);
      this._trackNode(gain);
    }
  }

  /** Scale change: pitch bend drone @private */
  _sfxScaleChange(time, volume, direction) {
    const t = time;
    const isShrinking = direction !== 'grow';
    const startFreq = isShrinking ? 600 : 300;
    const endFreq = isShrinking ? 200 : 800;
    const duration = 0.6;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    // Sub-oscillator for depth
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(startFreq * 0.5, t);
    subOsc.frequency.exponentialRampToValueAtTime(endFreq * 0.5, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume * 0.25, t + 0.1);
    gain.gain.setValueAtTime(volume * 0.25, t + duration * 0.7);
    gain.gain.linearRampToValueAtTime(0, t + duration);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + duration + 0.05);
    subOsc.stop(t + duration + 0.05);

    this._trackNode(osc);
    this._trackNode(subOsc);
    this._trackNode(gain);
  }

  /** Enemy alert: short dissonant interval @private */
  _sfxEnemyAlert(time, volume) {
    const t = time;

    // Dissonant interval: tritone
    const freq1 = 440;
    const freq2 = 622; // D#5 (tritone above A4)

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq1;

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = freq2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    // Low-pass for harshness control
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.32);
    osc2.stop(t + 0.32);

    this._trackNode(osc1);
    this._trackNode(osc2);
    this._trackNode(gain);
  }

  /** Boss roar: low frequency saw sweep @private */
  _sfxBossRoar(time, volume) {
    const t = time;
    const duration = 1.0;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + duration);

    // Sub-oscillator
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'square';
    subOsc.frequency.setValueAtTime(40, t);
    subOsc.frequency.exponentialRampToValueAtTime(15, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume * 0.6, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    // Low-pass filter opens over time
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.linearRampToValueAtTime(800, t + 0.2);
    filter.frequency.exponentialRampToValueAtTime(100, t + duration);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + duration + 0.05);
    subOsc.stop(t + duration + 0.05);

    this._trackNode(osc);
    this._trackNode(subOsc);
    this._trackNode(gain);
  }

  /** Quest complete: triumphant 5-note fanfare @private */
  _sfxQuestComplete(time, volume) {
    const t = time;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
    const delays = [0, 0.1, 0.2, 0.35, 0.5];
    const durations = [0.3, 0.3, 0.3, 0.4, 0.6];

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = notes[i];

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t + delays[i]);
      gain.gain.linearRampToValueAtTime(volume * 0.3, t + delays[i] + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, t + delays[i] + durations[i]);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t + delays[i]);
      osc.stop(t + delays[i] + durations[i] + 0.05);

      this._trackNode(osc);
      this._trackNode(gain);
    }
  }

  /** UI select: short blip @private */
  _sfxUISelect(time, volume) {
    const t = time;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.07);

    this._trackNode(osc);
    this._trackNode(gain);
  }

  /** UI confirm: pleasant chord @private */
  _sfxUIConfirm(time, volume) {
    const t = time;
    const notes = [523.25, 659.25, 783.99]; // C major chord

    for (const freq of notes) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume * 0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.22);

      this._trackNode(osc);
      this._trackNode(gain);
    }
  }

  // --------------------------------------------------------------------------
  // Play a Single Note (Utility)
  // --------------------------------------------------------------------------
  /**
   * Play a single synthesized note.
   *
   * @param {number} frequency — Note frequency in Hz
   * @param {number} duration — Note duration in seconds
   * @param {string} [type='sine'] — Oscillator type
   * @param {number} [volume=0.5] — Volume 0–1
   * @param {AudioNode} [destination] — Output destination (default: sfxGain)
   */
  playNote(frequency, duration, type = 'sine', volume = 0.5, destination) {
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const dest = destination || this.sfxGain;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + duration + 0.01);

    this._trackNode(osc);
    this._trackNode(gain);
  }

  // --------------------------------------------------------------------------
  // Volume Control
  // --------------------------------------------------------------------------
  /**
   * Set the master music volume.
   * @param {number} vol — Volume 0.0–1.0
   */
  setMasterVolume(vol) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  /**
   * Set the SFX volume.
   * @param {number} vol — Volume 0.0–1.0
   */
  setSFXVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  /**
   * Mute/unmute all audio.
   * @param {boolean} muted
   */
  setMuted(muted) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  // --------------------------------------------------------------------------
  // Footstep Trigger
  // --------------------------------------------------------------------------
  /**
   * Call this when the player takes a step.
   * Handles automatic footstep timing so it doesn't fire every frame.
   * @param {number} dt — Delta time
   * @param {boolean} isMoving — Whether player is currently moving
   */
  updateFootstep(dt, isMoving) {
    if (!isMoving) {
      this.footstepTimer = 0;
      return;
    }

    this.footstepTimer += dt;
    if (this.footstepTimer >= this.footstepInterval) {
      this.footstepTimer -= this.footstepInterval;
      this.playSFX('footstep', { volume: this.sfxVolume * 0.5 });
    }
  }

  // --------------------------------------------------------------------------
  // Utility
  // --------------------------------------------------------------------------
  /**
   * Get frequency for a note string (e.g., 'A4', 'C#3').
   * @private
   */
  _getNoteFreq(noteStr) {
    return NOTE_FREQUENCIES[noteStr] || null;
  }

  /**
   * Track a scheduled node for cleanup.
   * Prevents memory leaks from accumulated audio nodes.
   * @private
   */
  _trackNode(node) {
    this.scheduledNodes.push(node);

    // Prune old nodes
    if (this.scheduledNodes.length > this.maxScheduledNodes) {
      this.scheduledNodes = this.scheduledNodes.slice(-this.maxScheduledNodes / 2);
    }
  }

  /**
   * Get engine status info.
   * @returns {object} Status object
   */
  getStatus() {
    return {
      state: this.ctx ? this.ctx.state : 'unavailable',
      isPlaying: this.isPlaying,
      currentIntensity: this.currentIntensity,
      targetIntensity: this.targetIntensity,
      bpm: this.bpm,
      biome: this.currentBiome,
      suspendedByAutoplay: this._suspendedByAutoplay
    };
  }

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------
  /**
   * Clean up all audio resources.
   */
  destroy() {
    this.stopMusic();
    this._stopAtmosphere();

    // Close the audio context
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }

    console.log('[AudioEngine] Destroyed.');
  }
}

// Make AudioEngine class available globally
window.AudioEngine = AudioEngine;
