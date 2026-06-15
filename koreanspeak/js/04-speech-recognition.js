import { store } from './01-state.js';
import { CONFIG } from './00-config.js';

class SpeechRecognizer {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.transcript = '';
    this.confidence = 0;
    this.interimTranscript = '';
  }

  isSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'ko-KR';
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3;
    this.recognition.continuous = false;
  }

  async listen(targetPhrase, timeout = CONFIG.SPEECH_TIMEOUT) {
    // Always create a fresh instance to avoid stale state after errors or aborts
    if (this.recognition && this.isListening) {
      try { this.recognition.abort(); } catch (e) {}
    }
    this.init();

    return new Promise((resolve, reject) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let confidence = 0;
      let timeoutId;
      let hasResult = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        store.setState({ isRecording: true });

        timeoutId = setTimeout(() => {
          if (!hasResult) {
            this.stop();
            reject(new Error('Listening timeout - no speech detected'));
          }
        }, timeout);
      };

      this.recognition.onresult = (event) => {
        hasResult = true;
        interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
            confidence = result[0].confidence;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        store.setState({ interimTranscript });
      };

      this.recognition.onerror = (event) => {
        clearTimeout(timeoutId);
        this.isListening = false;
        store.setState({ isRecording: false });

        const errorMap = {
          'no-speech': 'No speech detected. Please try again.',
          'audio-capture': 'Microphone not available.',
          'not-allowed': 'Microphone permission denied.',
          'network': 'Network error. Please check your connection.',
          'aborted': 'Speech recognition aborted.',
          'language-not-supported': 'Korean speech recognition not available.'
        };

        reject(new Error(errorMap[event.error] || `Speech recognition error: ${event.error}`));
      };

      this.recognition.onend = () => {
        clearTimeout(timeoutId);
        this.isListening = false;
        store.setState({ isRecording: false, interimTranscript: '' });

        const text = finalTranscript || interimTranscript;
        if (text) {
          const score = this.calculateScore(targetPhrase, text, confidence);
          resolve({
            transcript: text,
            confidence,
            score,
            feedback: this.getFeedback(score)
          });
        } else {
          reject(new Error('No speech captured. Please try speaking louder.'));
        }
      };

      try {
        this.recognition.start();
      } catch (error) {
        reject(new Error('Failed to start speech recognition: ' + error.message));
      }
    });
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
    }
  }

  abort() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.warn('Error aborting recognition:', e);
      }
    }
    this.isListening = false;
    store.setState({ isRecording: false, interimTranscript: '' });
  }

  calculateScore(target, spoken, confidence) {
    if (!target || !spoken) return 0;

    const normalize = (str) => {
      return str.toLowerCase()
        .replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\w\s]/g, '')
        .trim();
    };

    const targetNorm = normalize(target);
    const spokenNorm = normalize(spoken);

    if (!targetNorm || !spokenNorm) {
      return Math.round(confidence * 30);
    }

    if (targetNorm === spokenNorm) return 100;

    const distance = this.levenshteinDistance(targetNorm, spokenNorm);
    const maxLen = Math.max(targetNorm.length, spokenNorm.length);
    const similarity = maxLen > 0 ? 1 - (distance / maxLen) : 0;

    const similarityWeight = 0.7;
    const confidenceWeight = 0.3;
    const score = Math.round((similarity * 100 * similarityWeight) + (confidence * 100 * confidenceWeight));

    return Math.min(Math.max(score, 0), 100);
  }

  levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = a[j - 1] === b[i - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    return matrix[b.length][a.length];
  }

  getFeedback(score) {
    if (score >= 95) {
      return { level: 'perfect', message: 'Perfect! Native-level pronunciation!', color: '#58cc02', emoji: '🌟' };
    }
    if (score >= 80) {
      return { level: 'great', message: 'Great job! Almost perfect!', color: '#7ee017', emoji: '✨' };
    }
    if (score >= 60) {
      return { level: 'good', message: 'Good try! Keep practicing.', color: '#ffc800', emoji: '👍' };
    }
    if (score >= 40) {
      return { level: 'fair', message: 'Getting there! Listen and try again.', color: '#ff8c42', emoji: '💪' };
    }
    return { level: 'needs-work', message: 'Listen carefully and try once more.', color: '#ff4b4b', emoji: '🔄' };
  }

}

const speechRecognizer = new SpeechRecognizer();

export { speechRecognizer };
