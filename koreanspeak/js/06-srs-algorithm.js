import { CONFIG } from './00-config.js';

class SRSAlgorithm {
  constructor() {
    this.defaultEaseFactor = CONFIG.SRS_DEFAULT_EASE;
    this.minEaseFactor = CONFIG.SRS_MIN_EASE;
    this.graduatingInterval = 1;
    this.easyInterval = 4;
  }

  createCard(phraseId) {
    return {
      phraseId,
      interval: 0,
      repetitions: 0,
      easeFactor: this.defaultEaseFactor,
      dueDate: new Date(Date.now() + 60000),
      lastReviewed: null,
      status: 'learning',
      lapses: 0
    };
  }

  reviewCard(card, quality) {
    const newCard = { ...card };

    newCard.easeFactor = Math.max(
      this.minEaseFactor,
      card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );

    if (quality < 3) {
      newCard.repetitions = 0;
      newCard.interval = 1;
      newCard.lapses++;
      newCard.status = 'relearning';
    } else {
      newCard.repetitions++;

      if (newCard.repetitions === 1) {
        newCard.interval = 1;
      } else if (newCard.repetitions === 2) {
        newCard.interval = 6;
      } else {
        newCard.interval = Math.round(card.interval * newCard.easeFactor);
        if (newCard.interval > 365) newCard.interval = 365;
      }

      newCard.status = 'review';
    }

    const now = new Date();
    if (newCard.interval < 1) {
      newCard.dueDate = new Date(now.getTime() + newCard.interval * 60000);
    } else {
      newCard.dueDate = new Date(now.getTime() + newCard.interval * 24 * 60 * 60 * 1000);
    }

    newCard.lastReviewed = now;
    return newCard;
  }

  getDueCards(cards) {
    const now = new Date();
    return cards.filter(card => {
      const due = new Date(card.dueDate);
      return due <= now;
    });
  }

  getNewCards(cards, limit = CONFIG.SRS_NEW_CARD_LIMIT) {
    return cards
      .filter(card => card.status === 'new' || card.status === 'learning')
      .slice(0, limit);
  }

  getLearningCards(cards) {
    return cards.filter(card =>
      card.status === 'learning' ||
      card.status === 'relearning'
    );
  }

  getReviewCards(cards) {
    return cards.filter(card =>
      card.status === 'review' &&
      new Date(card.dueDate) <= new Date()
    );
  }

  getDailyStats(cards) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayReviews = cards.filter(c => {
      if (!c.lastReviewed) return false;
      const reviewed = new Date(c.lastReviewed);
      reviewed.setHours(0, 0, 0, 0);
      return reviewed.getTime() === today.getTime();
    });

    return {
      totalDue: this.getDueCards(cards).length,
      newAvailable: cards.filter(c => c.status === 'new').length,
      learning: this.getLearningCards(cards).length,
      reviewedToday: todayReviews.length,
      averageEase: cards.length > 0
        ? cards.reduce((sum, c) => sum + c.easeFactor, 0) / cards.length
        : 0,
      retentionRate: this.calculateRetention(cards)
    };
  }

  calculateRetention(cards) {
    const reviewed = cards.filter(c => c.lastReviewed);
    if (reviewed.length === 0) return 0;

    const successful = reviewed.filter(c =>
      c.repetitions > 0 && c.lapses === 0
    );
    const lapses = reviewed.filter(c => c.lapses > 0);

    if (successful.length + lapses.length === 0) return 0;
    return Math.round(
      (successful.length / (successful.length + lapses.length)) * 100
    );
  }

  interleaveCards(cards) {
    const byCategory = {};
    cards.forEach(card => {
      const cat = card.category || 'general';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(card);
    });

    const result = [];
    const categories = Object.keys(byCategory);
    let idx = 0;

    while (result.length < cards.length) {
      const cat = categories[idx % categories.length];
      if (byCategory[cat].length > 0) {
        result.push(byCategory[cat].shift());
      }
      idx++;
      if (idx > cards.length * 2) break;
    }

    return result;
  }

  loadCards() {
    try {
      const saved = localStorage.getItem('koreanspeak_srs_cards');
      if (!saved) return [];
      return JSON.parse(saved, (key, value) => {
        if (key === 'dueDate' || key === 'lastReviewed') {
          return value ? new Date(value) : null;
        }
        return value;
      });
    } catch (e) {
      console.warn('Failed to load SRS cards:', e);
      return [];
    }
  }

  saveCards(cards) {
    try {
      localStorage.setItem('koreanspeak_srs_cards', JSON.stringify(cards));
    } catch (e) {
      console.warn('Failed to save SRS cards:', e);
    }
  }

  addPhraseToSRS(phraseId, cards) {
    const exists = cards.find(c => c.phraseId === phraseId);
    if (exists) return cards;

    const newCard = this.createCard(phraseId);
    cards.push(newCard);
    return cards;
  }

  getNextDueCard(cards) {
    const due = this.getDueCards(cards);
    if (due.length === 0) return null;
    return due[0];
  }

  getEstimatedStudyTime(cards) {
    const dueCount = this.getDueCards(cards).length;
    const secondsPerCard = 15;
    return Math.ceil((dueCount * secondsPerCard) / 60);
  }
}

const srs = new SRSAlgorithm();

export { srs };
