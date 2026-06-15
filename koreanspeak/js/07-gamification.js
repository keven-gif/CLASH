import { store } from './01-state.js';
import { CONFIG } from './00-config.js';

class GamificationSystem {
  constructor() {
    this.achievements = [
      { id: 'first_word', name: 'First Word', description: 'Complete your first phrase', icon: '🎯', condition: (s) => s.totalXP >= 10 },
      { id: 'streak_3', name: 'On Fire', description: '3-day streak', icon: '🔥', condition: (s) => s.streak >= 3 },
      { id: 'streak_7', name: 'Week Warrior', description: '7-day streak', icon: '⚡', condition: (s) => s.streak >= 7 },
      { id: 'streak_14', name: 'Two-Week Titan', description: '14-day streak', icon: '💪', condition: (s) => s.streak >= 14 },
      { id: 'streak_30', name: 'Monthly Master', description: '30-day streak', icon: '📅', condition: (s) => s.streak >= 30 },
      { id: 'streak_60', name: 'Double Trouble', description: '60-day streak', icon: '🏆', condition: (s) => s.streak >= 60 },
      { id: 'streak_90', name: 'Unstoppable', description: '90-day streak', icon: '👑', condition: (s) => s.streak >= 90 },
      { id: 'perfect_10', name: 'Perfectionist', description: '10 perfect scores in a row', icon: '💎', condition: (s) => s.sessionCorrect >= 10 },
      { id: 'night_owl', name: 'Night Owl', description: 'Study after midnight', icon: '🦉', condition: () => { const h = new Date().getHours(); return h >= 0 && h < 5; } },
      { id: 'early_bird', name: 'Early Bird', description: 'Study before 6 AM', icon: '🌅', condition: () => { const h = new Date().getHours(); return h >= 5 && h < 8; } },
      { id: 'hundred_phrases', name: 'Century', description: 'Master 100 phrases', icon: '💯', condition: (s) => s.masteredPhrases >= 100 },
      { id: 'speed_demon', name: 'Speed Demon', description: 'Complete a lesson in under 5 minutes', icon: '⏱️', condition: (s) => s.fastestLesson <= 300 },
      { id: 'no_hearts_lost', name: 'Flawless', description: 'Complete lesson without losing hearts', icon: '🛡️', condition: (s) => s.flawlessLessons >= 1 },
      { id: 'ai_conversation', name: 'AI Friend', description: 'Have first AI conversation', icon: '🤖', condition: (s) => s.aiConversations >= 1 },
      { id: 'all_hearts', name: 'Full Power', description: 'Complete lesson with 5/5 hearts', icon: '❤️', condition: (s) => s.flawlessLessons >= 1 },
      { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Study on Saturday and Sunday', icon: '🏖️', condition: (s) => s.weekendStudies >= 2 },
      { id: 'comeback', name: 'Comeback', description: 'Resume after 7-day break', icon: '🔄', condition: (s) => s.comebackMade },
      { id: 'legendary', name: 'Legendary', description: 'Complete a lesson without visual hints', icon: '🌟', condition: (s) => s.legendaryLessons >= 1 },
      { id: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: '⭐', condition: (s) => s.level >= 5 },
      { id: 'level_10', name: 'Expert', description: 'Reach level 10', icon: '🎖️', condition: (s) => s.level >= 10 },
      { id: 'bronze_league', name: 'Bronze Beginner', description: 'Reach Bronze league', icon: '🥉', condition: (s) => CONFIG.LEAGUES.indexOf(s.league) >= 0 },
      { id: 'gold_league', name: 'Golden Tongue', description: 'Reach Gold league', icon: '🥇', condition: (s) => CONFIG.LEAGUES.indexOf(s.league) >= 2 },
      { id: 'diamond_league', name: 'Diamond Speaker', description: 'Reach Diamond league', icon: '💎', condition: (s) => CONFIG.LEAGUES.indexOf(s.league) >= 6 },
      { id: 'review_master', name: 'Memory Master', description: 'Review 100 cards', icon: '🧠', condition: (s) => s.reviewsToday >= 100 }
    ];
  }

  calculateXP(baseScore, bonuses = {}) {
    let xp = baseScore;

    if (bonuses.combo >= 3) xp += CONFIG.COMBO_BONUSES[3] || 0;
    if (bonuses.combo >= 5) xp += CONFIG.COMBO_BONUSES[5] || 0;
    if (bonuses.combo >= 10) xp += CONFIG.COMBO_BONUSES[10] || 0;

    if (bonuses.time && bonuses.time < 60) xp += 5;
    if (bonuses.time && bonuses.time < 30) xp += 10;

    if (bonuses.perfect) xp += CONFIG.PERFECT_BONUS_XP;
    if (bonuses.firstOfDay) xp += CONFIG.FIRST_OF_DAY_BONUS;

    if (bonuses.streak >= 30) xp = Math.round(xp * 2);
    else if (bonuses.streak >= 7) xp = Math.round(xp * 1.5);

    return Math.round(xp);
  }

  loseHeart() {
    const state = store.getState();
    if (state.hearts > 0) {
      const newHearts = state.hearts - 1;
      store.setState({ hearts: newHearts });
      localStorage.setItem('lastHeartLost', Date.now().toString());
      return true;
    }
    return false;
  }

  recoverHearts() {
    const state = store.getState();
    if (state.hearts >= state.maxHearts) return 0;

    const lastLost = localStorage.getItem('lastHeartLost');
    if (!lastLost) return 0;

    const elapsed = Date.now() - parseInt(lastLost);
    const recoveryTime = CONFIG.HEART_REGEN_MINUTES * 60 * 1000;
    const heartsToRecover = Math.floor(elapsed / recoveryTime);

    if (heartsToRecover > 0) {
      const newHearts = Math.min(state.hearts + heartsToRecover, state.maxHearts);
      store.setState({ hearts: newHearts });
      if (newHearts >= state.maxHearts) {
        localStorage.removeItem('lastHeartLost');
      }
      return heartsToRecover;
    }
    return 0;
  }

  checkStreak() {
    const state = store.getState();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const lastStudy = state.lastStudyDate ? new Date(state.lastStudyDate) : null;

    if (!lastStudy) {
      store.setState({
        streak: 1,
        lastStudyDate: todayStr
      });
      return { status: 'new', streak: 1 };
    }

    lastStudy.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - lastStudy) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return { status: 'same-day', streak: state.streak };
    } else if (diffDays === 1) {
      const newStreak = state.streak + 1;
      store.setState({
        streak: newStreak,
        lastStudyDate: todayStr
      });
      return { status: 'continued', streak: newStreak };
    } else if (diffDays > 1) {
      if (state.streakFreeze > 0) {
        store.setState({
          streakFreeze: state.streakFreeze - 1,
          lastStudyDate: todayStr
        });
        return { status: 'frozen', streak: state.streak };
      } else {
        const wasLongBreak = diffDays >= 7;
        store.setState({
          streak: 1,
          lastStudyDate: todayStr,
          comebackMade: wasLongBreak ? true : state.comebackMade
        });
        return {
          status: wasLongBreak ? 'comeback' : 'reset',
          streak: 1,
          previousStreak: state.streak
        };
      }
    }
  }

  calculateLevel(xp) {
    const thresholds = CONFIG.LEVEL_THRESHOLDS;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]) return i + 1;
    }
    return 1;
  }

  calculateLeague(xp) {
    const thresholds = [0, 500, 1500, 3000, 5500, 9000, 14000, 22000];
    const leagues = CONFIG.LEAGUES;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]) return leagues[Math.min(i, leagues.length - 1)];
    }
    return leagues[0];
  }

  generateDailyQuests() {
    const state = store.getState();
    const allQuests = [
      { id: 'speak_10', description: 'Speak 10 phrases', target: 10, reward: 20, type: 'speak', progress: state.sessionCorrect || 0 },
      { id: 'perfect_5', description: 'Get 5 perfect scores', target: 5, reward: 30, type: 'perfect', progress: 0 },
      { id: 'review_20', description: 'Review 20 cards', target: 20, reward: 25, type: 'review', progress: 0 },
      { id: 'lesson_complete', description: "Complete today's lesson", target: 1, reward: 40, type: 'lesson', progress: 0 },
      { id: 'no_mistakes', description: 'Complete lesson without mistakes', target: 1, reward: 50, type: 'flawless', progress: 0 },
      { id: 'speed_run', description: 'Complete lesson in under 10 minutes', target: 1, reward: 35, type: 'speed', progress: 0 },
      { id: 'streak_keep', description: 'Maintain your streak', target: 1, reward: 15, type: 'streak', progress: state.streak > 0 ? 1 : 0 }
    ];

    const shuffled = this._shuffleArray([...allQuests]);
    return shuffled.slice(0, 3);
  }

  checkAchievements() {
    const state = store.getState();
    const unlocked = new Set(state.achievements || []);
    const newlyUnlocked = [];

    this.achievements.forEach(achievement => {
      if (!unlocked.has(achievement.id) && achievement.condition(state)) {
        unlocked.add(achievement.id);
        newlyUnlocked.push(achievement);
      }
    });

    if (newlyUnlocked.length > 0) {
      store.setState({
        achievements: Array.from(unlocked)
      });
    }

    return newlyUnlocked;
  }

  getLeaderboard() {
    const state = store.getState();
    const mockUsers = [
      { name: 'Minji', xp: state.totalXP + 520, league: 'gold', avatar: '👩' },
      { name: 'Jae', xp: state.totalXP + 340, league: 'silver', avatar: '👨' },
      { name: 'Soohyun', xp: state.totalXP + 180, league: 'silver', avatar: '👩‍🦱' },
      { name: 'You', xp: state.totalXP, league: state.league, avatar: '😎', isUser: true },
      { name: 'Soo', xp: Math.max(0, state.totalXP - 120), league: 'silver', avatar: '👩‍💻' },
      { name: 'Tae', xp: Math.max(0, state.totalXP - 280), league: 'bronze', avatar: '👨‍🦰' },
      { name: 'Yuna', xp: Math.max(0, state.totalXP - 450), league: 'bronze', avatar: '👱‍♀️' },
      { name: 'Hoon', xp: Math.max(0, state.totalXP - 600), league: 'bronze', avatar: '🧑‍💼' }
    ];

    return mockUsers.sort((a, b) => b.xp - a.xp).map((user, idx) => ({
      ...user,
      rank: idx + 1
    }));
  }

  getUserRank() {
    const leaderboard = this.getLeaderboard();
    const userEntry = leaderboard.find(u => u.isUser);
    return userEntry ? userEntry.rank : leaderboard.length;
  }

  _shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  calculateAccuracy(correct, total) {
    if (total === 0) return 0;
    return Math.round((correct / total) * 100);
  }
}

const gamification = new GamificationSystem();

export { gamification };
