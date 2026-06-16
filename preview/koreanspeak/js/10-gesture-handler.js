class GestureHandler {
  constructor(element) {
    this.element = element;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this.isDragging = false;
    this.minSwipeDistance = 50;
    this.maxTapDuration = 200;
    this.startTime = 0;
    this.longPressTimer = null;
    this.longPressDelay = 500;
    this.doubleTapTimer = null;
    this.lastTapTime = 0;
    this.doubleTapDelay = 300;

    this.handlers = {
      tap: [],
      doubleTap: [],
      longPress: [],
      swipeLeft: [],
      swipeRight: [],
      swipeUp: [],
      swipeDown: [],
      pan: [],
      panStart: [],
      panEnd: []
    };

    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onTouchCancel = this._onTouchCancel.bind(this);

    this.attach();
  }

  attach() {
    if (!this.element) return;
    this.element.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this.element.addEventListener('touchmove', this._onTouchMove, { passive: true });
    this.element.addEventListener('touchend', this._onTouchEnd, { passive: true });
    this.element.addEventListener('touchcancel', this._onTouchCancel, { passive: true });
  }

  detach() {
    if (!this.element) return;
    this.element.removeEventListener('touchstart', this._onTouchStart);
    this.element.removeEventListener('touchmove', this._onTouchMove);
    this.element.removeEventListener('touchend', this._onTouchEnd);
    this.element.removeEventListener('touchcancel', this._onTouchCancel);
    this.clearLongPress();
  }

  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
    return this;
  }

  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
    return this;
  }

  emit(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => handler(data));
    }
  }

  _onTouchStart(e) {
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.currentX = touch.clientX;
    this.currentY = touch.clientY;
    this.isDragging = false;
    this.startTime = Date.now();

    this.clearLongPress();
    this.longPressTimer = setTimeout(() => {
      if (!this.isDragging) {
        this.emit('longPress', {
          x: this.startX,
          y: this.startY,
          originalEvent: e
        });
      }
    }, this.longPressDelay);
  }

  _onTouchMove(e) {
    const touch = e.touches[0];
    this.currentX = touch.clientX;
    this.currentY = touch.clientY;

    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;

    if (!this.isDragging && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      this.isDragging = true;
      this.clearLongPress();
      this.emit('panStart', {
        x: this.startX,
        y: this.startY,
        deltaX: 0,
        deltaY: 0,
        originalEvent: e
      });
    }

    if (this.isDragging) {
      this.emit('pan', {
        x: this.currentX,
        y: this.currentY,
        deltaX,
        deltaY,
        originalEvent: e
      });
    }
  }

  _onTouchEnd(e) {
    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;
    const duration = Date.now() - this.startTime;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    this.clearLongPress();

    if (this.isDragging) {
      this.emit('panEnd', {
        x: this.currentX,
        y: this.currentY,
        deltaX,
        deltaY,
        duration,
        originalEvent: e
      });

      if (absX > this.minSwipeDistance && absX > absY) {
        if (deltaX > 0) {
          this.emit('swipeRight', { deltaX, deltaY, duration, originalEvent: e });
        } else {
          this.emit('swipeLeft', { deltaX, deltaY, duration, originalEvent: e });
        }
      } else if (absY > this.minSwipeDistance && absY > absX) {
        if (deltaY > 0) {
          this.emit('swipeDown', { deltaX, deltaY, duration, originalEvent: e });
        } else {
          this.emit('swipeUp', { deltaX, deltaY, duration, originalEvent: e });
        }
      }
    } else if (duration < this.maxTapDuration) {
      const now = Date.now();
      if (now - this.lastTapTime < this.doubleTapDelay) {
        this.clearDoubleTap();
        this.emit('doubleTap', {
          x: this.startX,
          y: this.startY,
          originalEvent: e
        });
      } else {
        this.lastTapTime = now;
        this.doubleTapTimer = setTimeout(() => {
          this.emit('tap', {
            x: this.startX,
            y: this.startY,
            originalEvent: e
          });
          this.lastTapTime = 0;
        }, this.doubleTapDelay);
      }
    }

    this.isDragging = false;
  }

  _onTouchCancel() {
    this.isDragging = false;
    this.clearLongPress();
    this.clearDoubleTap();
  }

  clearLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  clearDoubleTap() {
    if (this.doubleTapTimer) {
      clearTimeout(this.doubleTapTimer);
      this.doubleTapTimer = null;
    }
  }

  destroy() {
    this.detach();
    Object.keys(this.handlers).forEach(key => {
      this.handlers[key] = [];
    });
  }
}

function addSwipeListener(element, { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50 } = {}) {
  let startX = 0;
  let startY = 0;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - startX;
    const deltaY = e.changedTouches[0].clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (Math.max(absX, absY) < threshold) return;

    if (absX > absY) {
      if (deltaX > 0) onSwipeRight?.();
      else onSwipeLeft?.();
    } else {
      if (deltaY > 0) onSwipeDown?.();
      else onSwipeUp?.();
    }
  }, { passive: true });
}

export { GestureHandler, addSwipeListener };
