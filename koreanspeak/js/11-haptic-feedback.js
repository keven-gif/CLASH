import { store } from './01-state.js';

class HapticFeedback {
  constructor() {
    this.enabled = true;
    this.updateFromState();
    this.unsubscribe = store.subscribeTo('hapticsEnabled', (value) => {
      this.enabled = value;
    });
  }

  updateFromState() {
    this.enabled = store.getState().hapticsEnabled;
  }

  canVibrate() {
    return this.enabled && typeof navigator !== 'undefined' && navigator.vibrate;
  }

  light() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate(10);
    } catch (e) {}
  }

  medium() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate(20);
    } catch (e) {}
  }

  heavy() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate([30, 10, 30]);
    } catch (e) {}
  }

  success() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate([10, 50, 20]);
    } catch (e) {}
  }

  error() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate([50, 30, 50, 30, 50]);
    } catch (e) {}
  }

  warning() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate([20, 30, 20]);
    } catch (e) {}
  }

  celebration() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate([10, 30, 20, 30, 10, 30, 40]);
    } catch (e) {}
  }

  heartBreak() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate([80, 50, 30]);
    } catch (e) {}
  }

  tap() {
    this.light();
  }

  buttonPress() {
    this.medium();
  }

  slide() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate(5);
    } catch (e) {}
  }

  lessonComplete() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate([20, 40, 30, 40, 50, 40, 80]);
    } catch (e) {}
  }

  combo(comboCount) {
    if (!this.canVibrate()) return;
    try {
      const pattern = [];
      for (let i = 0; i < Math.min(comboCount, 5); i++) {
        pattern.push(15);
        if (i < Math.min(comboCount, 5) - 1) pattern.push(20);
      }
      navigator.vibrate(pattern);
    } catch (e) {}
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }
}

const haptic = new HapticFeedback();

export { haptic };
