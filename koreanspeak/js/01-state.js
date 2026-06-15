import { CONFIG } from './00-config.js';

const createStore = (initialState) => {
  const state = { ...initialState };
  const listeners = new Set();
  const specificListeners = new Map();

  const proxy = new Proxy(state, {
    set(target, prop, value) {
      const oldValue = target[prop];
      target[prop] = value;
      if (oldValue !== value) {
        listeners.forEach(cb => cb(prop, value, oldValue));
        const specific = specificListeners.get(prop);
        if (specific) {
          specific.forEach(cb => cb(value, oldValue));
        }
      }
      return true;
    }
  });

  return {
    getState: () => ({ ...state }),
    setState: (updates) => {
      Object.entries(updates).forEach(([key, value]) => {
        proxy[key] = value;
      });
    },
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    subscribeTo: (prop, callback) => {
      if (!specificListeners.has(prop)) {
        specificListeners.set(prop, new Set());
      }
      specificListeners.get(prop).add(callback);
      return () => specificListeners.get(prop).delete(callback);
    },
    reset: () => {
      Object.keys(state).forEach(key => {
        if (key in initialState) {
          proxy[key] = initialState[key];
        }
      });
    }
  };
};

function loadSavedState() {
  try {
    const saved = localStorage.getItem('koreanspeak_state');
    if (saved) {
      return JSON.parse(saved, (key, value) => {
        if (key === 'dueDate' || key === 'lastReviewed' || key === 'lastStudyDate') {
          return value ? new Date(value) : null;
        }
        return value;
      });
    }
  } catch (e) {
    console.warn('Failed to load saved state:', e);
  }
  return null;
}

const saved = loadSavedState();

const initialState = {
  user: saved?.user || null,
  isGuest: saved?.isGuest ?? true,
  currentDay: saved?.currentDay || 1,
  currentWeek: saved?.currentWeek || 1,
  totalXP: saved?.totalXP || 0,
  level: saved?.level || 1,
  hearts: saved?.hearts ?? CONFIG.MAX_HEARTS,
  maxHearts: CONFIG.MAX_HEARTS,
  streak: saved?.streak || 0,
  streakFreeze: saved?.streakFreeze || 0,
  lastStudyDate: saved?.lastStudyDate || null,
  league: saved?.league || 'bronze',
  leaguePosition: saved?.leaguePosition || 45,
  currentScreen: 'splash',
  previousScreen: null,
  currentLesson: null,
  currentPhraseIndex: 0,
  sessionXP: 0,
  sessionCorrect: 0,
  sessionTotal: 0,
  sessionStartTime: null,
  comboCount: 0,
  isRecording: false,
  isPlaying: false,
  audioSpeed: CONFIG.DEFAULT_AUDIO_SPEED,
  dueCards: saved?.dueCards || [],
  newCardsToday: 0,
  reviewsToday: 0,
  conversationHistory: saved?.conversationHistory || [],
  isAIResponding: false,
  dailyGoal: saved?.dailyGoal || CONFIG.DEFAULT_DAILY_GOAL,
  voiceGender: saved?.voiceGender || 'female',
  reminderTime: saved?.reminderTime || '20:00',
  hapticsEnabled: saved?.hapticsEnabled ?? true,
  soundEnabled: saved?.soundEnabled ?? true,
  offlineMode: !navigator.onLine,
  masteredPhrases: saved?.masteredPhrases || 0,
  minutesSpoken: saved?.minutesSpoken || 0,
  accuracy: saved?.accuracy || 0,
  flawlessLessons: saved?.flawlessLessons || 0,
  aiConversations: saved?.aiConversations || 0,
  weekendStudies: saved?.weekendStudies || 0,
  fastestLesson: saved?.fastestLesson || Infinity,
  legendaryLessons: saved?.legendaryLessons || 0,
  comebackMade: saved?.comebackMade || false,
  achievements: saved?.achievements || [],
  dailyQuests: saved?.dailyQuests || [],
  questProgress: saved?.questProgress || {},
  weekProgress: saved?.weekProgress || [0, 0, 0, 0, 0, 0, 0],
  settings: saved?.settings || {}
};

const store = createStore(initialState);

let saveDebounce;
store.subscribe(() => {
  clearTimeout(saveDebounce);
  saveDebounce = setTimeout(() => {
    try {
      const state = store.getState();
      const toSave = {
        user: state.user,
        isGuest: state.isGuest,
        currentDay: state.currentDay,
        currentWeek: state.currentWeek,
        totalXP: state.totalXP,
        level: state.level,
        hearts: state.hearts,
        streak: state.streak,
        streakFreeze: state.streakFreeze,
        lastStudyDate: state.lastStudyDate,
        league: state.league,
        leaguePosition: state.leaguePosition,
        dailyGoal: state.dailyGoal,
        voiceGender: state.voiceGender,
        reminderTime: state.reminderTime,
        hapticsEnabled: state.hapticsEnabled,
        soundEnabled: state.soundEnabled,
        masteredPhrases: state.masteredPhrases,
        minutesSpoken: state.minutesSpoken,
        accuracy: state.accuracy,
        flawlessLessons: state.flawlessLessons,
        aiConversations: state.aiConversations,
        weekendStudies: state.weekendStudies,
        fastestLesson: state.fastestLesson,
        legendaryLessons: state.legendaryLessons,
        comebackMade: state.comebackMade,
        achievements: state.achievements,
        dailyQuests: state.dailyQuests,
        questProgress: state.questProgress,
        weekProgress: state.weekProgress,
        dueCards: state.dueCards,
        conversationHistory: state.conversationHistory,
        settings: state.settings
      };
      localStorage.setItem('koreanspeak_state', JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, 500);
});

function getLevelProgress() {
  const state = store.getState();
  const thresholds = CONFIG.LEVEL_THRESHOLDS;
  const currentThreshold = thresholds[state.level - 1] || 0;
  const nextThreshold = thresholds[state.level] || 100000;
  if (nextThreshold === currentThreshold) return 100;
  const progress = ((state.totalXP - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

function getHeartsRecoveryTime() {
  const state = store.getState();
  if (state.hearts >= state.maxHearts) return null;
  const lastLost = localStorage.getItem('lastHeartLost');
  if (!lastLost) return CONFIG.HEART_REGEN_MINUTES * 60 * 1000;
  const elapsed = Date.now() - parseInt(lastLost);
  const recoveryTime = CONFIG.HEART_REGEN_MINUTES * 60 * 1000;
  const remaining = recoveryTime - (elapsed % recoveryTime);
  return Math.max(0, remaining);
}

function getHeartsRecoveryCount() {
  const state = store.getState();
  if (state.hearts >= state.maxHearts) return 0;
  const lastLost = localStorage.getItem('lastHeartLost');
  if (!lastLost) return 0;
  const elapsed = Date.now() - parseInt(lastLost);
  const recoveryTime = CONFIG.HEART_REGEN_MINUTES * 60 * 1000;
  return Math.min(Math.floor(elapsed / recoveryTime), state.maxHearts - state.hearts);
}

export { store, getLevelProgress, getHeartsRecoveryTime, getHeartsRecoveryCount };
