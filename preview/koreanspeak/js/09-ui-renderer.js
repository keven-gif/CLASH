import { store } from './01-state.js';
import { getLevelProgress, getHeartsRecoveryTime } from './01-state.js';
import { router } from './02-router.js';
import { audioEngine } from './03-audio-engine.js';
import { speechRecognizer } from './04-speech-recognition.js';
import { CURRICULUM } from './05-curriculum-data.js';
import { srs } from './06-srs-algorithm.js';
import { gamification } from './07-gamification.js';
import { haptic } from './11-haptic-feedback.js';
import { aiConversation } from './12-ai-conversation.js';
import { CONFIG } from './00-config.js';

// XSS-safe HTML escaper for user-supplied text
const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

class UIRenderer {
  constructor() {
    this.toastContainer = null;
    this.currentScreenElement = null;
    this.confettiCleanup = null;
    this.isLessonActive = false;
    this.lessonPhrases = [];
    this.currentPhraseIdx = 0;
    this.sessionStats = { correct: 0, total: 0, xp: 0, combo: 0, startTime: null };
    this.waveformRAF = null;
    // H7: track first attempt per phrase to avoid double SRS updates on retry
    this.phraseAttempted = new Set();
  }

  init() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.className = 'toast-container';
    document.body.appendChild(this.toastContainer);

    gamification.recoverHearts();
    CURRICULUM.init();

    router.register('splash', () => this.renderSplash());
    router.register('onboarding', () => this.renderOnboarding());
    router.register('home', () => this.renderHome());
    router.register('learn', () => this.renderLearn());
    router.register('lesson', () => this.renderLesson());
    router.register('review', () => this.renderReview());
    router.register('conversation', () => this.renderConversation());
    router.register('profile', () => this.renderProfile());
    router.register('leaderboard', () => this.renderLeaderboard());

    this.renderBottomNav();

    const hasOnboarded = localStorage.getItem('koreanspeak_onboarded');
    if (hasOnboarded) {
      router.navigate('home', {}, { replace: true });
    } else {
      router.navigate('splash', {}, { replace: true });
    }
  }

  createScreen(id) {
    const screen = document.createElement('div');
    screen.className = 'screen';
    screen.id = id;
    return screen;
  }

  renderBottomNav() {
    if (document.querySelector('.bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.innerHTML = `
      <button class="nav-item active" data-screen="home" aria-label="Home">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span class="nav-label">Home</span>
      </button>
      <button class="nav-item" data-screen="learn" aria-label="Learn">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span class="nav-label">Learn</span>
      </button>
      <button class="nav-item" data-screen="review" aria-label="Review">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
        </svg>
        <span class="nav-label">Review</span>
        <span class="nav-badge" id="review-nav-badge" style="display:none">0</span>
      </button>
      <button class="nav-item" data-screen="profile" aria-label="Profile">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        <span class="nav-label">Profile</span>
      </button>
    `;

    nav.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const screen = item.dataset.screen;
        haptic.tap();
        router.navigate(screen);
      });
    });

    document.body.appendChild(nav);
    this.updateReviewBadge();
  }

  updateReviewBadge() {
    const cards = srs.loadCards();
    const dueCount = srs.getDueCards(cards).length;
    const badge = document.getElementById('review-nav-badge');
    if (badge) {
      badge.textContent = dueCount;
      badge.style.display = dueCount > 0 ? 'flex' : 'none';
    }
  }

  // ==================== SPLASH SCREEN ====================
  renderSplash() {
    const screen = this.createScreen('screen-splash');
    screen.style.cssText = 'z-index: 600;';
    screen.innerHTML = `
      <div class="center-flex" style="height:100%;flex-direction:column;gap:32px;padding:24px;">
        <div style="position:relative;width:120px;height:120px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(135deg,#58cc02,#ce82ff);animation:pulse-ring 2s infinite;"></div>
          <svg style="position:absolute;inset:20px;width:80px;height:80px;color:white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
          </svg>
        </div>
        <div style="text-align:center;">
          <h1 style="font-size:32px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#58cc02,#ffc800);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">KoreanSpeak</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:15px;">Master Korean speaking in 90 days</p>
        </div>
        <div style="width:200px;height:4px;background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden;">
          <div id="splash-progress" style="height:100%;width:0%;background:linear-gradient(90deg,#58cc02,#7ee017);border-radius:999px;transition:width 1.5s ease;"></div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      setTimeout(() => {
        const bar = screen.querySelector('#splash-progress');
        if (bar) bar.style.width = '100%';
      }, 100);
    });

    setTimeout(() => {
      const hasOnboarded = localStorage.getItem('koreanspeak_onboarded');
      if (hasOnboarded) {
        router.navigate('home', {}, { replace: true });
      } else {
        router.navigate('onboarding', {}, { replace: true });
      }
    }, 2200);

    return screen;
  }

  // ==================== ONBOARDING ====================
  renderOnboarding() {
    const screen = this.createScreen('screen-onboarding');
    const slides = [
      { icon: '👂', title: 'Learn by Listening', desc: 'No reading. No writing. Just pure audio immersion. Your brain learns Korean the natural way.' },
      { icon: '🗣️', title: 'Speak from Day 1', desc: 'Start speaking immediately. Our AI listens and gives instant feedback on your pronunciation.' },
      { icon: '⚡', title: '90-Day Mastery', desc: 'A proven curriculum takes you from zero to conversational fluency in just 12 weeks.' }
    ];

    screen.innerHTML = `
      <div style="height:100%;display:flex;flex-direction:column;">
        <div style="flex:1;position:relative;overflow:hidden;" id="slides-wrapper">
          ${slides.map((slide, i) => `
            <div class="slide" data-index="${i}" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;padding:32px 24px;opacity:${i === 0 ? 1 : 0};transform:translateX(${i === 0 ? 0 : '100%'});transition:all 0.3s ease;">
              <div style="font-size:80px;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.3));animation:float 4s ease-in-out infinite;">${slide.icon}</div>
              <h2 style="font-size:24px;font-weight:700;text-align:center;">${slide.title}</h2>
              <p style="color:rgba(255,255,255,0.5);text-align:center;font-size:16px;line-height:1.7;max-width:300px;">${slide.desc}</p>
            </div>
          `).join('')}
        </div>
        <div style="padding:24px;display:flex;flex-direction:column;gap:12px;background:linear-gradient(to top,var(--color-bg-primary) 80%,transparent);">
          <div style="display:flex;justify-content:center;gap:8px;margin-bottom:8px;" id="onboarding-dots">
            ${slides.map((_, i) => `<div style="width:${i === 0 ? 24 : 8}px;height:8px;border-radius:999px;background:${i === 0 ? 'var(--color-accent-success)' : 'rgba(255,255,255,0.2)'};transition:all 0.15s ease;" data-index="${i}"></div>`).join('')}
          </div>
          <button class="btn btn-primary" id="onboarding-next" style="width:100%;">Continue</button>
          <button class="btn btn-secondary" id="onboarding-skip" style="width:100%;">Skip</button>
        </div>
      </div>
    `;

    let currentSlide = 0;

    const goToSlide = (index) => {
      if (index >= slides.length) {
        this.showGoalSelector();
        return;
      }
      currentSlide = index;
      screen.querySelectorAll('.slide').forEach((slide, i) => {
        slide.style.opacity = i === index ? 1 : 0;
        slide.style.transform = `translateX(${(i - index) * 100}%)`;
      });
      screen.querySelectorAll('#onboarding-dots > div').forEach((dot, i) => {
        dot.style.width = i === index ? '24px' : '8px';
        dot.style.background = i === index ? 'var(--color-accent-success)' : 'rgba(255,255,255,0.2)';
      });
      screen.querySelector('#onboarding-next').textContent = index < slides.length - 1 ? 'Continue' : 'Get Started';
      screen.querySelector('#onboarding-skip').style.display = index < slides.length - 1 ? 'flex' : 'none';
    };

    screen.querySelector('#onboarding-next').addEventListener('click', () => {
      haptic.buttonPress();
      goToSlide(currentSlide + 1);
    });
    screen.querySelector('#onboarding-skip').addEventListener('click', () => {
      haptic.buttonPress();
      this.showGoalSelector();
    });

    let startX = 0;
    screen.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    screen.addEventListener('touchend', (e) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (diff > 60 && currentSlide < slides.length - 1) goToSlide(currentSlide + 1);
      if (diff < -60 && currentSlide > 0) goToSlide(currentSlide - 1);
    }, { passive: true });

    return screen;
  }

  showGoalSelector() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:500;display:flex;align-items:flex-end;justify-content:center;animation:fade-in 0.2s ease;';
    overlay.innerHTML = `
      <div style="background:var(--color-bg-secondary);border-radius:24px 24px 0 0;width:100%;max-height:90vh;overflow-y:auto;padding:24px;animation:slide-up 0.35s cubic-bezier(0.16,1,0.3,1);">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="font-size:22px;font-weight:700;margin-bottom:6px;">Set Your Daily Goal</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;">How many minutes can you commit each day?</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;" id="goal-options">
          ${[5, 10, 15, 20].map(min => `
            <div class="goal-option" data-minutes="${min}" style="padding:16px 20px;border-radius:12px;background:rgba(255,255,255,0.03);border:2px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:all 0.15s ease;">
              <div>
                <div style="font-weight:600;font-size:16px;">${min} minutes</div>
                <div style="color:rgba(255,255,255,0.4);font-size:13px;">${min === 5 ? 'Casual' : min === 10 ? 'Regular' : min === 15 ? 'Serious' : 'Intense'}</div>
              </div>
              <div class="goal-check" style="opacity:0;color:var(--color-accent-success);font-size:20px;font-weight:700;">&#10003;</div>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-primary" id="goal-confirm" style="width:100%;" disabled>Continue</button>
      </div>
    `;

    let selectedMinutes = null;

    overlay.querySelectorAll('.goal-option').forEach(opt => {
      opt.addEventListener('click', () => {
        haptic.buttonPress();
        overlay.querySelectorAll('.goal-option').forEach(o => {
          o.style.borderColor = 'rgba(255,255,255,0.06)';
          o.style.background = 'rgba(255,255,255,0.03)';
          o.querySelector('.goal-check').style.opacity = '0';
        });
        opt.style.borderColor = 'var(--color-accent-success)';
        opt.style.background = 'rgba(88,204,2,0.05)';
        opt.querySelector('.goal-check').style.opacity = '1';
        selectedMinutes = parseInt(opt.dataset.minutes);
        overlay.querySelector('#goal-confirm').disabled = false;
      });
    });

    overlay.querySelector('#goal-confirm').addEventListener('click', () => {
      haptic.buttonPress();
      if (selectedMinutes) {
        store.setState({ dailyGoal: selectedMinutes });
        localStorage.setItem('koreanspeak_onboarded', 'true');
        overlay.remove();
        router.navigate('home', {}, { replace: true });
      }
    });

    document.body.appendChild(overlay);
  }

  // ==================== HOME SCREEN ====================
  renderHome() {
    const screen = this.createScreen('screen-home');
    const state = store.getState();
    const lesson = CURRICULUM.getLesson(state.currentDay) || CURRICULUM.getLesson(1);
    const cards = srs.loadCards();
    const dueCount = srs.getDueCards(cards).length;
    const levelProg = getLevelProgress();
    const quests = gamification.generateDailyQuests();

    screen.innerHTML = `
      <div class="screen-header">
        <div class="streak-flame ${state.streak === 0 ? 'broken' : ''}" id="home-streak">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 23c6.075 0 11-4.925 11-11 0-4.1-2.25-7.675-5.575-9.575C16.875 4.225 17.5 6.5 17.5 8c0 2.5-1.5 4.5-3.5 5.5V8c0-3-2.5-5.5-5.5-6 0 0 2 2.5 2 5.5 0 1-.5 2-1 2.5C8 12 6 14.5 6 17c0 1.5.5 3 2 4-.5-1-1-2.5-1-3.5 0-1.5 1-3 2.5-4C10.5 15 12 16.5 12 19c0 1.5-.5 3-1.5 4 2-.5 4-2 4.5-4C15.5 16.5 14 14 12 13c0 0 2-1.5 2-3.5 0-1.5-1-3-1-3s2 2 2 4.5c0 2.5-2 4.5-4.5 5.5 1.5-1.5 2-3.5 1.5-5.5C12 8 10 6 10 4c0 0-2 2-2 5 0 2 1.5 4 3.5 4.5C10 12.5 9 11 9 9c0-2 1.5-3.5 1.5-3.5S9.5 7.5 9.5 9c0 1.5 1 2.5 1 2.5S9 13 8 15c-1 2-.5 4.5 1 6-2-1-3.5-3-3.5-5.5 0-3 2-5.5 3-7C7.5 10 6.5 11.5 6.5 13c0 1.5.5 2.5 1 3.5C6 15.5 4 13 4 10c0-4 3.5-8 8-10C7 2.5 3 6 2.5 10.5 2 15.5 6.5 22 12 23z"/></svg>
          <span>${state.streak}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="progress-ring">
            <svg width="52" height="52" viewBox="0 0 60 60">
              <circle class="background" cx="30" cy="30" r="25"/>
              <circle class="progress" cx="30" cy="30" r="25" style="stroke-dashoffset:${157 - (157 * levelProg / 100)}"/>
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;">${state.level}</div>
          </div>
        </div>
      </div>
      <div class="screen-content" style="display:flex;flex-direction:column;gap:16px;">
        ${this.renderDailyMissionCard(state, lesson)}
        ${dueCount > 0 ? this.renderReviewCard(dueCount) : ''}
        ${this.renderStatsGrid(state)}
        ${this.renderQuestsCard(quests)}
        ${this.renderWeekProgress(state)}
      </div>
    `;

    const startBtn = screen.querySelector('#start-lesson-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        haptic.buttonPress();
        this.startLesson(lesson);
      });
    }

    const reviewBtn = screen.querySelector('#start-review-btn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        haptic.buttonPress();
        router.navigate('review');
      });
    }

    return screen;
  }

  renderDailyMissionCard(state, lesson) {
    return `
      <div class="card card-gradient" style="position:relative;overflow:hidden;">
        <div style="position:absolute;top:-50%;right:-50%;width:100%;height:100%;background:radial-gradient(circle,rgba(88,204,2,0.06) 0%,transparent 70%);pointer-events:none;"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div>
            <div style="font-size:12px;color:var(--color-accent-success);text-transform:uppercase;font-weight:600;letter-spacing:0.5px;margin-bottom:4px;">Day ${state.currentDay}</div>
            <h3 style="font-size:20px;font-weight:700;">${lesson.title}</h3>
          </div>
          <div style="background:var(--color-accent-success);color:var(--color-text-inverse);padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;flex-shrink:0;">${lesson.duration} min</div>
        </div>
        <div style="background:rgba(255,255,255,0.05);border-radius:8px;height:8px;overflow:hidden;margin-bottom:12px;">
          <div style="background:var(--color-accent-success);height:100%;width:${Math.min(state.currentDay * 1.2, 100)}%;border-radius:8px;transition:width 0.5s ease;"></div>
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-bottom:16px;">${lesson.phrases?.length || 0} phrases &bull; ${lesson.exercises?.length || 0} exercises</p>
        <button class="btn btn-primary" id="start-lesson-btn" style="width:100%;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start Lesson
        </button>
      </div>
    `;
  }

  renderReviewCard(dueCount) {
    return `
      <div class="card" style="cursor:pointer;" id="review-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:44px;height:44px;border-radius:10px;background:rgba(255,107,157,0.1);display:flex;align-items:center;justify-content:center;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-heart)" stroke-width="2">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
              </svg>
            </div>
            <div>
              <div style="font-weight:600;">Review Due</div>
              <div style="color:rgba(255,255,255,0.4);font-size:13px;">${dueCount} phrase${dueCount !== 1 ? 's' : ''} waiting</div>
            </div>
          </div>
          <button class="btn btn-secondary" id="start-review-btn" style="padding:8px 16px;min-height:auto;font-size:13px;">Review</button>
        </div>
      </div>
    `;
  }

  renderStatsGrid(state) {
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--color-accent-xp);">${state.totalXP}</div>
          <div class="stat-label">Total XP</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value" style="color:var(--color-accent-league);">${state.masteredPhrases || 0}</div>
          <div class="stat-label">Phrases</div>
        </div>
      </div>
    `;
  }

  renderQuestsCard(quests) {
    return `
      <div class="card">
        <div style="font-weight:600;margin-bottom:12px;font-size:16px;">Daily Quests</div>
        ${quests.map(q => `
          <div class="quest-item">
            <div class="quest-icon">${CONFIG.CATEGORY_ICONS[q.type] || '🎯'}</div>
            <div class="quest-info">
              <div class="quest-title">${q.description}</div>
              <div class="quest-progress">${Math.min(q.progress, q.target)} / ${q.target}</div>
            </div>
            <div class="quest-reward">+${q.reward} XP</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderWeekProgress(state) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    return `
      <div class="card">
        <div style="font-weight:600;margin-bottom:16px;">This Week</div>
        <div class="week-chart">
          ${days.map((day, i) => `
            <div class="week-chart-bar">
              <div class="week-chart-fill ${i <= todayIdx ? 'active' : ''}" style="height:${state.weekProgress?.[i] || (i < todayIdx ? 60 + (i * 7 % 40) : i === todayIdx ? 40 : 4)}%;"></div>
              <span class="week-chart-label">${day}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ==================== LEARN SCREEN ====================
  renderLearn() {
    const screen = this.createScreen('screen-learn');
    const state = store.getState();
    const weeks = CURRICULUM.getAllWeeks();

    screen.innerHTML = `
      <div class="screen-header">
        <div style="font-size:20px;font-weight:700;">Curriculum</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.4);">${state.currentDay} / ${CONFIG.CURRICULUM_DAYS} days</div>
      </div>
      <div class="screen-content" style="padding-top:4px;">
        ${weeks.map((week, wi) => `
          <div class="week-section">
            <div class="week-header">
              <div class="week-number">${week.id}</div>
              <div class="week-info">
                <div class="week-title">${week.title}</div>
                <div class="week-theme">${week.theme}</div>
              </div>
              <div class="week-progress">${Math.min(Math.max(0, state.currentDay - (wi * 7)), 7)}/7</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;padding-left:48px;">
              ${week.days.map((day, di) => {
                const dayNum = (wi * 7) + di + 1;
                const isCompleted = dayNum < state.currentDay;
                const isCurrent = dayNum === state.currentDay;
                const isLocked = dayNum > state.currentDay;
                return `
                  <div class="lesson-node ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isLocked ? 'locked' : ''}" data-day="${dayNum}" data-lesson="${day.id}">
                    <div class="lesson-node-icon" style="background:${isCompleted ? 'rgba(88,204,2,0.15)' : isCurrent ? 'rgba(88,204,2,0.1)' : 'rgba(255,255,255,0.04)'};">
                      ${isCompleted ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#58cc02" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : isCurrent ? '<span style="font-size:18px;">🎯</span>' : '<span style="font-size:18px;opacity:0.4;">🔒</span>'}
                    </div>
                    <div class="lesson-node-info">
                      <div class="lesson-node-title" style="${isCurrent ? 'color:var(--color-accent-success);' : ''}">${day.title}</div>
                      <div class="lesson-node-meta">${day.phrases?.length || 0} phrases &bull; ${day.duration} min</div>
                    </div>
                    <div class="lesson-node-status" style="background:${isCompleted ? 'var(--color-accent-success)' : 'transparent'};">
                      ${isCompleted ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    screen.querySelectorAll('.lesson-node:not(.locked)').forEach(node => {
      node.addEventListener('click', () => {
        haptic.tap();
        const dayNum = parseInt(node.dataset.day);
        const lesson = CURRICULUM.getLesson(dayNum);
        if (lesson) this.startLesson(lesson);
      });
    });

    return screen;
  }

  // ==================== LESSON SCREEN ====================
  startLesson(lesson) {
    this.isLessonActive = true;
    this.lessonPhrases = lesson.phrases || [];
    this.currentPhraseIdx = 0;
    this.sessionStats = { correct: 0, total: 0, xp: 0, combo: 0, startTime: Date.now() };
    // H7: reset per-lesson phrase-attempt tracking
    this.phraseAttempted = new Set();
    store.setState({
      sessionXP: 0,
      sessionCorrect: 0,
      sessionTotal: 0,
      comboCount: 0,
      currentPhraseIndex: 0
    });
    router.navigate('lesson');
  }

  renderLesson(params = {}) {
    if (!this.isLessonActive) {
      router.navigate('home', {}, { replace: true });
      return null;
    }

    const screen = this.createScreen('screen-lesson');
    const state = store.getState();

    if (this.currentPhraseIdx >= this.lessonPhrases.length) {
      this.renderLessonComplete(screen);
      return screen;
    }

    const phrase = this.lessonPhrases[this.currentPhraseIdx];
    const progress = ((this.currentPhraseIdx) / this.lessonPhrases.length) * 100;

    screen.innerHTML = `
      <div class="xp-bar"><div class="fill" style="width:${progress}%"></div></div>
      <div class="lesson-header">
        <button class="lesson-close-btn" id="lesson-close" aria-label="Close lesson">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="hearts-container" id="lesson-hearts">
          ${Array.from({ length: state.maxHearts }, (_, i) => `
            <svg class="heart ${i < state.hearts ? '' : 'lost'}" viewBox="0 0 24 24" fill="${i < state.hearts ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" style="transition:all 0.3s ease;">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          `).join('')}
        </div>
        <div class="lesson-progress-text">${this.currentPhraseIdx + 1}/${this.lessonPhrases.length}</div>
      </div>
      <div class="lesson-content" style="gap:32px;">
        <div class="phase-indicator">
          <div class="phase-dot active">Listen</div>
          <div class="phase-dot">Repeat</div>
          <div class="phase-dot">Use</div>
        </div>
        <button class="audio-player" id="lesson-play-btn" aria-label="Play Korean phrase">
          <canvas id="audio-viz" width="180" height="180" style="position:absolute;inset:-20px;pointer-events:none;opacity:0.6;"></canvas>
          <svg class="player-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <div class="lesson-hint-section">
          <div class="english-hint selectable" id="english-hint">
            ${escapeHtml(phrase.english)}
            <div lang="ko" class="selectable" style="font-size:14px;color:rgba(255,255,255,0.3);margin-top:6px;font-style:italic;">${escapeHtml(phrase.romanization)}</div>
          </div>
          <button class="hint-btn" id="show-hint-btn">Tap to show meaning</button>
        </div>
        <div class="speed-control" style="margin-top:-8px;">
          ${CONFIG.AUDIO_SPEEDS.map(s => `<button class="speed-btn ${s === state.audioSpeed ? 'active' : ''}" data-speed="${s}">${s}x</button>`).join('')}
        </div>
        <div class="mic-section" id="mic-section" style="display:none;">
          <button class="mic-button" id="mic-btn" aria-label="Hold to speak">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
            </svg>
            <div class="recording-ring"></div>
          </button>
          <div class="mic-label">Hold to speak</div>
        </div>
        <div id="feedback-area" aria-live="polite" aria-atomic="true" style="display:none;width:100%;max-width:340px;"></div>
      </div>
    `;

    const playBtn = screen.querySelector('#lesson-play-btn');
    const vizCanvas = screen.querySelector('#audio-viz');
    let hasPlayed = false;

    const autoPlay = async () => {
      playBtn.classList.add('playing');
      audioEngine.setOnVisualization((data) => {
        if (vizCanvas) audioEngine.drawWaveform(vizCanvas, data);
      });
      try {
        await audioEngine.speakKorean(phrase.korean, state.audioSpeed);
      } catch (e) {
        console.warn('TTS error:', e);
      }
      playBtn.classList.remove('playing');
      hasPlayed = true;

      const micSection = screen.querySelector('#mic-section');
      if (micSection) {
        micSection.style.display = 'flex';
        micSection.style.animation = 'fade-in 0.3s ease, slide-up 0.3s ease';
      }
    };

    // M5: cancel any in-progress speech before scheduling autoPlay
    audioEngine.cancelSpeech();
    setTimeout(autoPlay, 400);

    playBtn.addEventListener('click', async () => {
      haptic.tap();
      if (store.getState().isPlaying) {
        audioEngine.cancelSpeech();
        playBtn.classList.remove('playing');
        return;
      }
      playBtn.classList.add('playing');
      try {
        await audioEngine.speakKorean(phrase.korean, state.audioSpeed);
      } catch (e) {}
      playBtn.classList.remove('playing');
      if (!hasPlayed) {
        hasPlayed = true;
        const micSection = screen.querySelector('#mic-section');
        if (micSection) {
          micSection.style.display = 'flex';
          micSection.style.animation = 'fade-in 0.3s ease, slide-up 0.3s ease';
        }
      }
    });

    screen.querySelector('#show-hint-btn')?.addEventListener('click', () => {
      haptic.tap();
      screen.querySelector('#english-hint').classList.add('visible');
      screen.querySelector('#show-hint-btn').style.display = 'none';
    });

    screen.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        haptic.tap();
        const speed = parseFloat(btn.dataset.speed);
        store.setState({ audioSpeed: speed });
        screen.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    const micBtn = screen.querySelector('#mic-btn');
    if (micBtn) {
      let speechPromise = null;

      const onPress = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        if (speechPromise) return;
        micBtn.classList.add('recording');
        haptic.heavy();
        audioEngine.startRecording();
        speechPromise = speechRecognizer.listen(phrase.korean, CONFIG.SPEECH_TIMEOUT);
      };

      const onRelease = async () => {
        if (!speechPromise) return;
        micBtn.classList.remove('recording');
        audioEngine.stopRecording();
        speechRecognizer.stop();
        const pending = speechPromise;
        speechPromise = null;
        await this.processSpeechAttempt(screen, phrase, pending);
      };

      micBtn.addEventListener('touchstart', onPress, { passive: false });
      micBtn.addEventListener('touchend', onRelease);
      micBtn.addEventListener('mousedown', onPress);
      micBtn.addEventListener('mouseup', onRelease);
    }

    screen.querySelector('#lesson-close').addEventListener('click', () => {
      haptic.buttonPress();
      this.showExitConfirm();
    });

    return screen;
  }

  async processSpeechAttempt(screen, phrase, pendingResult = null) {
    const feedbackArea = screen.querySelector('#feedback-area');
    const micSection = screen.querySelector('#mic-section');

    feedbackArea.style.display = 'block';
    feedbackArea.innerHTML = '<div style="text-align:center;padding:20px;"><div class="typing-indicator" style="display:inline-flex;"><span></span><span></span><span></span></div><div style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:12px;">Analyzing your pronunciation...</div></div>';
    micSection.style.display = 'none';

    // C2: cancel any active speech synthesis before awaiting the result
    audioEngine.cancelSpeech();

    try {
      const result = await (pendingResult ?? speechRecognizer.listen(phrase.korean, CONFIG.SPEECH_TIMEOUT));
      // C2: if the lesson screen was navigated away from, discard the result
      if (!document.contains(screen)) return;
      this.showFeedback(screen, result, phrase);
    } catch (error) {
      // C2: guard stale screen here too
      if (!document.contains(screen)) return;
      // C1: removed duplicate gamification.loseHeart() and haptic.error() —
      //     showFeedback handles heart loss when score === 0
      this.showFeedback(screen, {
        score: 0,
        feedback: { level: 'error', message: error.message || 'Could not hear you. Try again!', color: '#ff4b4b', emoji: '❌' },
        transcript: ''
      }, phrase);
    }
  }

  showFeedback(screen, result, phrase) {
    const feedbackArea = screen.querySelector('#feedback-area');
    const isSuccess = result.score >= 60;
    const isPerfect = result.score >= 90;

    this.sessionStats.total++;
    if (isSuccess) {
      this.sessionStats.correct++;
      this.sessionStats.combo++;
    } else {
      this.sessionStats.combo = 0;
    }

    const xpEarned = gamification.calculateXP(
      isSuccess ? CONFIG.LESSON_XP_BASE : 1,
      {
        combo: this.sessionStats.combo,
        perfect: isPerfect,
        streak: store.getState().streak
      }
    );
    this.sessionStats.xp += xpEarned;

    store.setState({
      sessionXP: this.sessionStats.xp,
      sessionCorrect: this.sessionStats.correct,
      sessionTotal: this.sessionStats.total,
      comboCount: this.sessionStats.combo
    });

    if (!isSuccess) {
      gamification.loseHeart();
      haptic.error();
    } else if (isPerfect) {
      haptic.celebration();
      this.showConfetti();
    } else {
      haptic.success();
    }

    // H7: only update SRS on the first attempt, not on retries
    if (!this.phraseAttempted.has(phrase.id)) {
      this.phraseAttempted.add(phrase.id);
      const cards = srs.loadCards();
      const existingIdx = cards.findIndex(c => c.phraseId === phrase.id);
      const quality = result.score >= 90 ? 5 : result.score >= 70 ? 4 : result.score >= 50 ? 3 : result.score >= 30 ? 2 : 1;
      if (existingIdx >= 0) {
        cards[existingIdx] = srs.reviewCard(cards[existingIdx], quality);
      } else {
        cards.push(srs.createCard(phrase.id));
      }
      srs.saveCards(cards);
    }

    // M4: build feedback HTML safely to prevent transcript XSS
    const panel = document.createElement('div');
    panel.className = `feedback-panel ${isSuccess ? 'success' : result.score >= 40 ? 'warning' : 'error'}`;
    panel.style.margin = '0 auto';
    panel.innerHTML = `
      <div class="feedback-score" style="color:${result.feedback.color};">${isSuccess ? result.feedback.emoji : ''} ${result.score}%</div>
      <div class="feedback-message">${result.feedback.message}</div>
      ${result.transcript ? `<div class="feedback-transcript" style="font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px;"></div>` : ''}
      <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
        <span style="color:var(--color-accent-xp);font-weight:700;font-size:18px;">+${xpEarned} XP</span>
        ${this.sessionStats.combo >= 3 ? `<span style="background:rgba(255,200,0,0.15);color:var(--color-accent-xp);padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;">${this.sessionStats.combo}x combo</span>` : ''}
      </div>
      <button class="btn ${isSuccess ? 'btn-primary' : 'btn-secondary'}" id="next-phrase-btn" style="width:100%;margin-top:8px;">
        ${isSuccess ? 'Continue' : 'Try Again'}
      </button>
    `;
    // Set transcript via textContent to prevent XSS
    if (result.transcript) {
      const transcriptEl = panel.querySelector('.feedback-transcript');
      if (transcriptEl) transcriptEl.textContent = `You said: "${result.transcript}"`;
    }
    feedbackArea.innerHTML = '';
    feedbackArea.appendChild(panel);

    feedbackArea.querySelector('#next-phrase-btn').addEventListener('click', () => {
      haptic.buttonPress();
      if (isSuccess) {
        this.currentPhraseIdx++;
      }
      router.navigate('lesson', {}, { replace: true });
    });
  }

  renderLessonComplete(screen) {
    const state = store.getState();
    const duration = Math.floor((Date.now() - this.sessionStats.startTime) / 1000);
    const accuracy = gamification.calculateAccuracy(this.sessionStats.correct, this.sessionStats.total);
    const streakResult = gamification.checkStreak();

    screen.innerHTML = `
      <div class="column-flex" style="height:100%;padding:24px;justify-content:center;gap:24px;">
        <div class="lesson-complete">
          <div class="celebration-emoji">🎉</div>
          <div class="lesson-complete-title">Lesson Complete!</div>
          <div class="lesson-complete-subtitle">Day ${state.currentDay} finished</div>
        </div>
        <div class="results-grid">
          <div class="result-item">
            <div class="result-value xp">+${this.sessionStats.xp}</div>
            <div class="result-label">XP Earned</div>
          </div>
          <div class="result-item">
            <div class="result-value accuracy">${accuracy}%</div>
            <div class="result-label">Accuracy</div>
          </div>
          <div class="result-item">
            <div class="result-value streak">${state.streak}d</div>
            <div class="result-label">Streak</div>
          </div>
        </div>
        <div class="card" style="width:100%;text-align:center;">
          <div style="font-size:18px;font-weight:600;margin-bottom:4px;">
            ${streakResult?.status === 'continued' ? `🔥 ${streakResult.streak}-day streak!` : 'Keep it up!'}
          </div>
          <div style="color:rgba(255,255,255,0.4);font-size:14px;">
            ${this.sessionStats.correct}/${this.sessionStats.total} correct &bull; ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}
          </div>
        </div>
        <button class="btn btn-primary" id="finish-lesson-btn" style="width:100%;margin-top:auto;">Continue</button>
      </div>
    `;

    haptic.lessonComplete();
    this.showConfetti();

    const newAchievements = gamification.checkAchievements();
    if (newAchievements.length > 0) {
      newAchievements.forEach(ach => {
        setTimeout(() => this.showToast(`🏆 ${ach.name} unlocked!`), 1000);
      });
    }

    screen.querySelector('#finish-lesson-btn').addEventListener('click', () => {
      haptic.buttonPress();
      const newLevel = gamification.calculateLevel(state.totalXP + this.sessionStats.xp);
      const newLeague = gamification.calculateLeague(state.totalXP + this.sessionStats.xp);
      store.setState({
        currentDay: state.currentDay + 1,
        totalXP: state.totalXP + this.sessionStats.xp,
        level: newLevel,
        league: newLeague,
        masteredPhrases: (state.masteredPhrases || 0) + this.sessionStats.correct,
        sessionXP: 0,
        sessionCorrect: 0,
        sessionTotal: 0,
        comboCount: 0
      });
      this.isLessonActive = false;
      this.currentPhraseIdx = 0;
      router.navigate('home', {}, { replace: true });
    });
  }

  showExitConfirm() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:400;display:flex;align-items:center;justify-content:center;padding:24px;animation:fade-in 0.2s ease;';
    overlay.innerHTML = `
      <div style="background:var(--color-bg-elevated);border-radius:20px;padding:28px;width:100%;max-width:320px;text-align:center;animation:scale-in 0.3s cubic-bezier(0.34,1.56,0.64,1);">
        <div style="font-size:40px;margin-bottom:12px;">😿</div>
        <h3 style="font-size:20px;font-weight:700;margin-bottom:8px;">Quit Lesson?</h3>
        <p style="color:rgba(255,255,255,0.5);font-size:14px;margin-bottom:20px;">Your progress will be saved, but you will lose a heart.</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-danger" id="confirm-exit" style="width:100%;">Quit & Lose Heart</button>
          <button class="btn btn-secondary" id="cancel-exit" style="width:100%;">Keep Learning</button>
        </div>
      </div>
    `;

    overlay.querySelector('#confirm-exit').addEventListener('click', () => {
      haptic.buttonPress();
      // H3: commit any session XP earned before exiting
      if (this.sessionStats.xp > 0) {
        const state = store.getState();
        gamification.addXP
          ? gamification.addXP(this.sessionStats.xp)
          : store.setState({ totalXP: state.totalXP + this.sessionStats.xp });
        this.sessionStats = { correct: 0, total: 0, xp: 0, combo: 0, startTime: null };
      }
      gamification.loseHeart();
      this.isLessonActive = false;
      this.currentPhraseIdx = 0;
      overlay.remove();
      router.navigate('home', {}, { replace: true });
    });

    overlay.querySelector('#cancel-exit').addEventListener('click', () => {
      haptic.buttonPress();
      overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  // ==================== REVIEW SCREEN ====================
  renderReview() {
    const screen = this.createScreen('screen-review');
    const cards = srs.loadCards();
    const dueCards = srs.getDueCards(cards);

    if (dueCards.length === 0) {
      screen.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎊</div>
          <div class="empty-state-title">All Caught Up!</div>
          <div class="empty-state-message">No phrases due for review. Start a new lesson or come back later.</div>
          <button class="btn btn-primary" id="back-home-btn" style="margin-top:16px;">Back to Home</button>
        </div>
      `;
      screen.querySelector('#back-home-btn').addEventListener('click', () => router.navigate('home'));
      return screen;
    }

    const currentCard = dueCards[0];
    const phrase = CURRICULUM.getPhrase(currentCard.phraseId);

    if (!phrase) {
      const idx = cards.findIndex(c => c.phraseId === currentCard.phraseId);
      if (idx >= 0) {
        cards[idx] = srs.reviewCard(cards[idx], 3);
        srs.saveCards(cards);
      }
      router.navigate('review', {}, { replace: true });
      return screen;
    }

    screen.innerHTML = `
      <div class="screen-header">
        <div style="font-size:18px;font-weight:600;">Review</div>
        <div style="color:rgba(255,255,255,0.4);font-size:14px;">${dueCards.length} remaining</div>
      </div>
      <div class="screen-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:24px;">
        <div class="review-category">${phrase.category?.toUpperCase() || 'GENERAL'}</div>
        <button class="audio-player" id="review-play-btn" style="width:160px;height:160px;">
          <svg class="player-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
        <button class="btn btn-secondary" id="review-show-answer" style="min-height:44px;padding:10px 24px;">Show Answer</button>
        <div class="review-answer" id="review-answer">
          <div class="review-english">${phrase.english}</div>
          <div class="review-romanization">${phrase.romanization}</div>
        </div>
        <div class="review-buttons" id="review-buttons">
          <button class="review-btn review-btn-again" data-quality="1">Again<br><span style="font-size:11px;opacity:0.7;">&lt;1m</span></button>
          <button class="review-btn review-btn-hard" data-quality="2">Hard<br><span style="font-size:11px;opacity:0.7;">2d</span></button>
          <button class="review-btn review-btn-good" data-quality="4">Good<br><span style="font-size:11px;opacity:0.7;">4d</span></button>
          <button class="review-btn review-btn-easy" data-quality="5">Easy<br><span style="font-size:11px;opacity:0.7;">7d</span></button>
        </div>
      </div>
    `;

    setTimeout(() => audioEngine.speakKorean(phrase.korean), 300);

    screen.querySelector('#review-play-btn').addEventListener('click', () => {
      haptic.tap();
      audioEngine.speakKorean(phrase.korean);
    });

    screen.querySelector('#review-show-answer').addEventListener('click', () => {
      haptic.buttonPress();
      screen.querySelector('#review-answer').classList.add('visible');
      screen.querySelector('#review-show-answer').style.display = 'none';
      screen.querySelector('#review-buttons').classList.add('visible');
    });

    screen.querySelectorAll('.review-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        haptic.buttonPress();
        const quality = parseInt(btn.dataset.quality);
        const idx = cards.findIndex(c => c.phraseId === currentCard.phraseId);
        if (idx >= 0) {
          cards[idx] = srs.reviewCard(cards[idx], quality);
          srs.saveCards(cards);
        }

        const earnedXP = quality >= 4 ? CONFIG.REVIEW_XP_BASE : quality >= 3 ? 2 : 1;
        const state = store.getState();
        // H8: track reviewsToday so review_master achievement can unlock
        store.setState({
          totalXP: state.totalXP + earnedXP,
          masteredPhrases: (state.masteredPhrases || 0) + (quality >= 3 ? 1 : 0),
          reviewsToday: (state.reviewsToday || 0) + 1
        });

        screen.style.animation = 'slide-left 0.25s ease forwards';
        setTimeout(() => {
          router.navigate('review', {}, { replace: true });
        }, 250);
      });
    });

    return screen;
  }

  // ==================== CONVERSATION SCREEN ====================
  renderConversation() {
    const screen = this.createScreen('screen-conversation');
    const scenarios = aiConversation.getScenarios();

    screen.innerHTML = `
      <div class="screen-header">
        <div style="font-size:20px;font-weight:700;">AI Tutor</div>
      </div>
      <div class="screen-content" style="padding-top:8px;">
        <div style="margin-bottom:16px;">
          <h2 style="font-size:18px;font-weight:600;margin-bottom:6px;">Choose a Scenario</h2>
          <p style="color:rgba(255,255,255,0.4);font-size:14px;">Practice real conversations with AI</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${scenarios.map(s => `
            <div class="card scenario-card" data-scenario="${s.id}" style="cursor:pointer;padding:20px;">
              <div style="display:flex;align-items:center;gap:14px;">
                <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,rgba(88,204,2,0.15),rgba(206,130,255,0.15));display:flex;align-items:center;justify-content:center;font-size:24px;">🤖</div>
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;margin-bottom:3px;">${s.title}</div>
                  <div style="font-size:13px;color:rgba(255,255,255,0.4);">${s.description}</div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    screen.querySelectorAll('.scenario-card').forEach(card => {
      card.addEventListener('click', async () => {
        haptic.buttonPress();
        const scenarioId = card.dataset.scenario;
        await this.renderConversationChat(screen, scenarioId);
      });
    });

    return screen;
  }

  async renderConversationChat(screen, scenarioId) {
    const scenario = aiConversation.getScenarios().find(s => s.id === scenarioId);
    if (!scenario) return;

    const messages = [];

    const renderMessages = () => {
      const list = screen.querySelector('#chat-messages');
      if (!list) return;
      list.innerHTML = messages.map(m => `
        <div class="chat-message ${m.role}" style="
          display:flex;
          flex-direction:column;
          align-items:${m.role === 'user' ? 'flex-end' : 'flex-start'};
          margin-bottom:12px;
        ">
          <div style="
            max-width:80%;
            padding:10px 14px;
            border-radius:${m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
            background:${m.role === 'user' ? 'var(--color-accent-success)' : 'rgba(255,255,255,0.08)'};
            color:${m.role === 'user' ? '#000' : '#fff'};
            font-size:15px;
            line-height:1.5;
          " lang="${m.role === 'assistant' ? 'ko' : undefined}">${escapeHtml(m.text)}</div>
        </div>
      `).join('');
      list.scrollTop = list.scrollHeight;
    };

    screen.innerHTML = `
      <div class="screen-header">
        <button id="chat-back-btn" style="background:none;border:none;color:rgba(255,255,255,0.6);padding:4px;display:flex;align-items:center;gap:6px;font-size:15px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Scenarios
        </button>
        <div style="font-weight:600;font-size:16px;">${escapeHtml(scenario.title)}</div>
        <div style="width:80px;"></div>
      </div>
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;"></div>
      <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:12px;">
        <button id="chat-mic-btn" class="mic-button" style="width:56px;height:56px;flex-shrink:0;" aria-label="Hold to speak">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/>
          </svg>
          <div class="recording-ring"></div>
        </button>
        <div id="chat-status" style="color:rgba(255,255,255,0.4);font-size:13px;">Hold mic to speak in Korean</div>
      </div>
    `;

    screen.querySelector('#chat-back-btn').addEventListener('click', () => {
      haptic.buttonPress();
      aiConversation.reset();
      router.navigate('conversation', {}, { replace: true });
    });

    const micBtn = screen.querySelector('#chat-mic-btn');
    const statusEl = screen.querySelector('#chat-status');
    let speechPromise = null;

    const onPress = (e) => {
      if (e.type === 'touchstart') e.preventDefault();
      if (speechPromise || store.getState().isAIResponding) return;
      micBtn.classList.add('recording');
      haptic.heavy();
      audioEngine.startRecording();
      speechPromise = speechRecognizer.listen('', CONFIG.SPEECH_TIMEOUT);
      statusEl.textContent = 'Listening…';
    };

    const onRelease = async () => {
      if (!speechPromise) return;
      micBtn.classList.remove('recording');
      audioEngine.stopRecording();
      speechRecognizer.stop();
      const pending = speechPromise;
      speechPromise = null;
      statusEl.textContent = 'Processing…';
      try {
        const result = await pending;
        if (result?.transcript) {
          messages.push({ role: 'user', text: result.transcript });
          renderMessages();
          statusEl.textContent = 'AI is responding…';
          const aiResult = await aiConversation.processUserSpeech(result.transcript);
          if (aiResult?.message) {
            messages.push({ role: 'assistant', text: aiResult.message });
            renderMessages();
          }
        }
      } catch (err) {
        console.warn('Chat speech error:', err);
      }
      statusEl.textContent = 'Hold mic to speak in Korean';
    };

    micBtn.addEventListener('touchstart', onPress, { passive: false });
    micBtn.addEventListener('touchend', onRelease);
    micBtn.addEventListener('mousedown', onPress);
    micBtn.addEventListener('mouseup', onRelease);

    // Start the conversation
    statusEl.textContent = 'Starting conversation…';
    try {
      const opening = await aiConversation.startConversation(scenarioId);
      if (opening?.message) {
        messages.push({ role: 'assistant', text: opening.message });
        renderMessages();
      }
    } catch (err) {
      console.warn('Failed to start conversation:', err);
    }
    statusEl.textContent = 'Hold mic to speak in Korean';
  }

  // ==================== PROFILE SCREEN ====================
  renderProfile() {
    const screen = this.createScreen('screen-profile');
    const state = store.getState();
    const levelProg = getLevelProgress();

    screen.innerHTML = `
      <div class="screen-header">
        <div style="font-size:20px;font-weight:700;">Profile</div>
        <button style="background:none;border:none;color:rgba(255,255,255,0.4);padding:4px;" id="settings-btn" aria-label="Settings">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
      <div class="screen-content" style="display:flex;flex-direction:column;gap:16px;">
        <div class="profile-header">
          <div class="level-badge">${state.level}</div>
          <div class="level-title">Level ${state.level}</div>
          <div class="level-subtitle">${levelProg.toFixed(0)}% to Level ${state.level + 1}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="card stat-card">
            <div class="stat-value" style="color:var(--color-accent-xp);">${state.totalXP}</div>
            <div class="stat-label">Total XP</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value" style="color:var(--color-accent-league);">${state.masteredPhrases || 0}</div>
            <div class="stat-label">Phrases</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value" style="color:var(--color-accent-streak);">${state.streak}d</div>
            <div class="stat-label">Streak</div>
          </div>
          <div class="card stat-card">
            <div class="stat-value" style="color:var(--color-accent-success);">${state.accuracy || 0}%</div>
            <div class="stat-label">Accuracy</div>
          </div>
        </div>
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="font-weight:600;">League</div>
            <div style="color:${CONFIG.LEAGUE_COLORS[state.league] || '#fff'};font-size:13px;font-weight:600;text-transform:capitalize;">${CONFIG.LEAGUE_ICONS[state.league] || '🏆'} ${state.league}</div>
          </div>
          <button class="btn btn-secondary" id="view-leaderboard-btn" style="width:100%;min-height:44px;font-size:15px;">View Leaderboard</button>
        </div>
        <div class="card">
          <div style="font-weight:600;margin-bottom:16px;">Achievements</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
            ${gamification.achievements.slice(0, 12).map(ach => {
              const unlocked = (state.achievements || []).includes(ach.id);
              return `
                <div class="achievement-item ${unlocked ? 'unlocked' : 'locked'}">
                  <div class="achievement-icon">${ach.icon}</div>
                  <div class="achievement-name">${ach.name}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    screen.querySelector('#settings-btn').addEventListener('click', () => {
      haptic.tap();
      this.showSettingsModal();
    });

    screen.querySelector('#view-leaderboard-btn').addEventListener('click', () => {
      haptic.buttonPress();
      router.navigate('leaderboard');
    });

    return screen;
  }

  // ==================== LEADERBOARD ====================
  renderLeaderboard() {
    const screen = this.createScreen('screen-leaderboard');
    const leaderboard = gamification.getLeaderboard();

    screen.innerHTML = `
      <div class="screen-header">
        <button class="lesson-close-btn" id="lb-back" aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style="font-size:20px;font-weight:700;">Leaderboard</div>
        <div style="width:40px;"></div>
      </div>
      <div class="screen-content" style="padding-top:4px;">
        <div class="card" style="margin-bottom:16px;text-align:center;padding:20px;">
          <div style="font-size:48px;margin-bottom:8px;">${CONFIG.LEAGUE_ICONS[store.getState().league] || '🏆'}</div>
          <div style="font-size:18px;font-weight:700;text-transform:capitalize;">${store.getState().league} League</div>
          <div style="color:rgba(255,255,255,0.4);font-size:13px;">Top 50% to promote</div>
        </div>
        ${leaderboard.map((entry, i) => `
          <div class="leaderboard-item ${entry.isUser ? 'is-user' : ''}" style="margin-bottom:4px;">
            <div class="leaderboard-rank ${i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : ''}">${entry.rank}</div>
            <div class="leaderboard-avatar">${entry.avatar}</div>
            <div class="leaderboard-name">${entry.isUser ? '<strong>You</strong>' : entry.name}</div>
            <div class="leaderboard-xp">${entry.xp.toLocaleString()} XP</div>
          </div>
        `).join('')}
      </div>
    `;

    screen.querySelector('#lb-back').addEventListener('click', () => {
      haptic.tap();
      router.back();
    });

    return screen;
  }

  // ==================== SETTINGS ====================
  showSettingsModal() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:300;display:flex;align-items:flex-end;animation:fade-in 0.2s ease;';
    const state = store.getState();

    overlay.innerHTML = `
      <div style="background:var(--color-bg-secondary);border-radius:24px 24px 0 0;width:100%;max-height:90vh;overflow-y:auto;padding:24px;animation:slide-up 0.35s cubic-bezier(0.16,1,0.3,1);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h2 style="font-size:22px;font-weight:700;">Settings</h2>
          <button id="close-settings" style="background:none;border:none;color:rgba(255,255,255,0.4);padding:4px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Preferences</div>
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-title">Daily Goal</div>
              <div class="setting-description">${state.dailyGoal} minutes per day</div>
            </div>
            <select id="goal-select" style="background:var(--color-bg-elevated);border:1px solid rgba(255,255,255,0.1);color:white;padding:6px 12px;border-radius:8px;font-size:14px;">
              ${[5, 10, 15, 20].map(m => `<option value="${m}" ${m === state.dailyGoal ? 'selected' : ''}>${m} min</option>`).join('')}
            </select>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-title">Audio Speed</div>
              <div class="setting-description">TTS playback speed</div>
            </div>
            <select id="speed-select" style="background:var(--color-bg-elevated);border:1px solid rgba(255,255,255,0.1);color:white;padding:6px 12px;border-radius:8px;font-size:14px;">
              ${CONFIG.AUDIO_SPEEDS.map(s => `<option value="${s}" ${s === state.audioSpeed ? 'selected' : ''}>${s}x</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Feedback</div>
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-title">Haptic Feedback</div>
              <div class="setting-description">Vibration on actions</div>
            </div>
            <label class="toggle">
              <input type="checkbox" id="haptics-toggle" ${state.hapticsEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Data</div>
          <button class="btn btn-danger" id="reset-progress-btn" style="width:100%;min-height:44px;font-size:15px;margin-top:8px;">Reset All Progress</button>
        </div>
      </div>
    `;

    overlay.querySelector('#close-settings').addEventListener('click', () => {
      haptic.tap();
      overlay.remove();
    });

    overlay.querySelector('#goal-select').addEventListener('change', (e) => {
      store.setState({ dailyGoal: parseInt(e.target.value) });
      this.showToast('Daily goal updated');
    });

    overlay.querySelector('#speed-select').addEventListener('change', (e) => {
      store.setState({ audioSpeed: parseFloat(e.target.value) });
    });

    overlay.querySelector('#haptics-toggle').addEventListener('change', (e) => {
      store.setState({ hapticsEnabled: e.target.checked });
      haptic.enabled = e.target.checked;
    });

    overlay.querySelector('#reset-progress-btn').addEventListener('click', () => {
      haptic.heavy();
      if (confirm('Are you sure? This will delete ALL your progress permanently.')) {
        ['koreanspeak_state', 'koreanspeak_srs_cards', 'koreanspeak_onboarded', 'lastHeartLost']
          .forEach(k => localStorage.removeItem(k));
        store.reset();
        location.reload();
      }
    });

    document.body.appendChild(overlay);
  }

  // ==================== TOAST ====================
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fade-out 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ==================== CONFETTI ====================
  showConfetti() {
    if (this.confettiCleanup) this.confettiCleanup();

    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#58cc02', '#ffc800', '#ce82ff', '#ff6b9d', '#1cb0f6', '#ff4b4b'];
    const pieces = [];

    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const left = Math.random() * 100;
      const animDuration = 2 + Math.random() * 3;
      const delay = Math.random() * 1.5;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = 6 + Math.random() * 8;

      piece.style.cssText = `
        left: ${left}%;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        animation-duration: ${animDuration}s;
        animation-delay: ${delay}s;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        transform: rotate(${Math.random() * 360}deg);
      `;

      container.appendChild(piece);
      pieces.push(piece);
    }

    this.confettiCleanup = () => {
      container.remove();
      this.confettiCleanup = null;
    };

    setTimeout(() => {
      if (this.confettiCleanup) this.confettiCleanup();
    }, 6000);
  }
}

const ui = new UIRenderer();

export { ui };
