import { store } from './01-state.js';
import { CONFIG } from './00-config.js';

class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.isPlaying = false;
    this.currentSource = null;
    this.visualizationCallback = null;
    this.animationId = null;
    this.koreanVoice = null;
    this._voiceInitPromise = null;
  }

  async init() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }

    this._initVoices();
  }

  _initVoices() {
    if (this._voiceInitPromise) return this._voiceInitPromise;

    this._voiceInitPromise = new Promise((resolve) => {
      const findKoreanVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        this.koreanVoice = voices.find(v =>
          v.lang.includes('ko') || v.lang.includes('Korean')
        ) || voices.find(v => v.lang.includes('ko'));
        resolve(this.koreanVoice);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        findKoreanVoice();
      } else {
        window.speechSynthesis.onvoiceschanged = findKoreanVoice;
        setTimeout(findKoreanVoice, 2000);
      }
    });

    return this._voiceInitPromise;
  }

  async speakKorean(text, speed = null) {
    await this.init();
    await this._voiceInitPromise;

    return new Promise((resolve, reject) => {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = speed || store.getState().audioSpeed || CONFIG.DEFAULT_AUDIO_SPEED;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (this.koreanVoice) {
        utterance.voice = this.koreanVoice;
      }

      utterance.onstart = () => {
        this.isPlaying = true;
        store.setState({ isPlaying: true });
        this._startVisualization();
      };

      utterance.onend = () => {
        this.isPlaying = false;
        store.setState({ isPlaying: false });
        this._stopVisualization();
        resolve();
      };

      utterance.onerror = (error) => {
        this.isPlaying = false;
        store.setState({ isPlaying: false });
        this._stopVisualization();
        if (error.error === 'canceled') {
          resolve();
        } else {
          reject(error);
        }
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  speakEnglish(text) {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.volume = 0.8;
      utterance.onend = resolve;
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }

  async startRecording() {
    await this.init();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        store.setState({ recordedBlob: blob });
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      store.setState({ isRecording: true });

      if (this.audioContext && this.analyser) {
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
      }

      this._startVisualization();
      return true;
    } catch (error) {
      console.error('Recording failed:', error);
      return false;
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch (e) {
        console.warn('Error stopping recorder:', e);
      }
      this.isRecording = false;
      store.setState({ isRecording: false });
      this._stopVisualization();
      return true;
    }
    return false;
  }

  playRecording(blob) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.play().catch(() => resolve());
    });
  }

  _startVisualization() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const visualize = () => {
      if (!this.isPlaying && !this.isRecording) return;

      this.analyser.getByteFrequencyData(dataArray);

      if (this.visualizationCallback) {
        this.visualizationCallback(dataArray);
      }

      this.animationId = requestAnimationFrame(visualize);
    };

    visualize();
  }

  _stopVisualization() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  drawWaveform(canvas, dataArray, options = {}) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const barCount = options.barCount || 32;
    const barWidth = (width / barCount) * 0.7;
    const gap = (width / barCount) * 0.3;

    ctx.clearRect(0, 0, width, height);

    const step = Math.floor(dataArray.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step] || 0;
      const barHeight = (value / 255) * height * 0.85;
      const x = i * (barWidth + gap) + gap / 2;
      const y = (height - barHeight) / 2;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      const intensity = value / 255;

      if (options.color === 'error') {
        gradient.addColorStop(0, `rgba(255, 75, 75, ${0.3 + intensity * 0.7})`);
        gradient.addColorStop(1, `rgba(255, 75, 75, ${0.1 + intensity * 0.4})`);
      } else {
        gradient.addColorStop(0, `rgba(88, 204, 2, ${0.4 + intensity * 0.6})`);
        gradient.addColorStop(1, `rgba(88, 204, 2, ${0.1 + intensity * 0.3})`);
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
    }
  }

  setOnVisualization(callback) {
    this.visualizationCallback = callback;
  }

  cancelSpeech() {
    window.speechSynthesis.cancel();
    this.isPlaying = false;
    store.setState({ isPlaying: false });
    this._stopVisualization();
  }

  destroy() {
    this._stopVisualization();
    this.cancelSpeech();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

const audioEngine = new AudioEngine();

export { audioEngine };
