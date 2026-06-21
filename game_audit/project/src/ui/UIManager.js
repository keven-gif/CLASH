/**
 * @file UIManager.js
 * @description Manages all game UI including diegetic HUD elements (health aura, combo
 * display, notifications, minimap, scale indicator), floating damage numbers, dialog
 * with typewriter effect, and screen overlays (loading, title, pause, inventory,
 * quest log, fusion codex, game over, settings).
 */

/** @typedef {Object} ScreenDefinition
 * @property {string} name - Screen identifier
 * @property {HTMLElement} element - DOM element for the screen
 * @property {boolean} isVisible - Current visibility
 */

/** @typedef {Object} Notification
 * @property {string} message - Notification text
 * @property {string} type - Notification type: info, warning, success, error
 * @property {number} createdAt - Creation timestamp
 * @property {number} duration - Display duration in ms
 * @property {number} opacity - Current opacity (0-1)
 */

/** @typedef {Object} DamageNumber
 * @property {number} x - Screen X position
 * @property {number} y - Screen Y position
 * @property {number} amount - Damage value
 * @property {boolean} isCritical - Whether it was a critical hit
 * @property {string} color - Text color
 * @property {number} createdAt - Creation timestamp
 * @property {number} vy - Vertical velocity
 * @property {number} opacity - Current opacity
 * @property {number} scale - Current scale
 */

/** @typedef {Object} DialogEntry
 * @property {string} speaker - Speaker name
 * @property {string} text - Full dialog text
 * @property {string} displayText - Currently displayed text (for typewriter)
 * @property {number} charIndex - Current character index
 * @property {number} speed - Characters per second
 * @property {boolean} complete - Whether typing is complete
 */

/**
 * UI color palette for consistent theming.
 * @constant {Object}
 */
const UI_COLORS = {
  healthFull: '#4caf50',
  healthMid: '#ff9800',
  healthLow: '#f44336',
  healthCritical: '#b71c1c',
  mana: '#2196f3',
  stamina: '#ffeb3b',
  xp: '#9c27b0',
  combo: '#ffeb3b',
  crit: '#ff5722',
  heal: '#00e676',
  poison: '#76ff03',
  ice: '#00e5ff',
  fire: '#ff3d00',
  bgDark: 'rgba(10, 10, 20, 0.92)',
  bgPanel: 'rgba(20, 20, 35, 0.9)',
  border: 'rgba(255, 255, 255, 0.2)',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  accent: '#d4a574',
  gold: '#ffd700'
};

/**
 * Maps damage element types to colors.
 * @constant {Object.<string, string>}
 */
const ELEMENT_COLORS = {
  normal: '#ffffff',
  fire: '#ff5722',
  ice: '#00e5ff',
  poison: '#76ff03',
  lightning: '#ffeb3b',
  void: '#7c4dff',
  heal: '#00e676',
  critical: '#ff9100'
};

/**
 * Minimap configuration.
 * @constant {Object}
 */
const MINIMAP_CONFIG = {
  size: 140,
  scale: 0.08,
  playerDotSize: 4,
  enemyDotSize: 2,
  poiDotSize: 3,
  updateInterval: 500
};

/**
 * Manages all game user interface elements.
 * @class UIManager
 */
class UIManager {
  /**
   * Creates a new UIManager.
   * @param {Object} [options={}] - Configuration options
   * @param {HTMLCanvasElement} [options.canvas] - Game canvas element
   * @param {HTMLElement} [options.container] - Container for DOM overlays
   */
  constructor(options = {}) {
    /** @type {HTMLCanvasElement|null} Game canvas */
    this.canvas = options.canvas || null;

    /** @type {HTMLElement|null} UI container element */
    this.container = options.container || null;

    /** @type {Map<string, ScreenDefinition>} Screen definitions */
    this.screens = new Map();

    /** @type {Array<Notification>} Active notifications */
    this.notifications = [];

    /** @type {Array<DamageNumber>} Active damage numbers */
    this.damageNumbers = [];

    /** @type {Array<Object>} Active combo displays */
    this.comboDisplays = [];

    /** @type {DialogEntry|null} Current dialog */
    this.currentDialog = null;

    /** @type {Array<DialogEntry>} Dialog queue */
    this.dialogQueue = [];

    /** @type {boolean} Whether dialog is waiting for input to advance */
    this.dialogWaiting = false;

    /** @type {number} Dialog start time */
    this.dialogStartTime = 0;

    /** @type {number} Last minimap update time */
    this.lastMinimapUpdate = 0;

    /** @type {HTMLCanvasElement|null} Minimap offscreen canvas */
    this.minimapCanvas = null;

    /** @type {CanvasRenderingContext2D|null} Minimap context */
    this.minimapCtx = null;

    /** @type {boolean} Whether minimap needs redraw */
    this.minimapDirty = true;

    /** @type {number} HUD animation timer */
    this.hudTimer = 0;

    /** @type {number} Health aura phase */
    this.auraPhase = 0;

    /** @type {Object} Cached screen dimensions */
    this.screenSize = { width: 0, height: 0 };

    /** @type {boolean} Whether UI has been initialized */
    this.initialized = false;

    /** @type {string|null} Currently visible screen name */
    this.currentScreen = null;

    /** @type {Object} HUD visibility toggles */
    this.hudVisibility = {
      health: true,
      combo: true,
      notifications: true,
      minimap: true,
      scaleIndicator: true,
      questTracker: true
    };

    /** @type {number} Typewriter base speed (chars/sec) */
    this.typewriterSpeed = 40;

    /** @type {Function|null} Callback when dialog completes */
    this.onDialogComplete = null;

    /** @type {Function|null} Callback when screen changes */
    this.onScreenChange = null;
  }

  // ===================== INITIALIZATION =====================

  /**
   * Initializes the UI system, creating DOM elements for all screens.
   * @param {Object} [options={}] - Initialization options
   */
  init(options = {}) {
    if (this.initialized) return;

    // Find container
    if (!this.container) {
      this.container = document.getElementById('uiOverlay') || document.body;
    }

    if (!this.canvas) {
      this.canvas = document.getElementById('gameCanvas');
    }

    if (this.canvas) {
      this.screenSize.width = this.canvas.width;
      this.screenSize.height = this.canvas.height;
    }

    // Create minimap offscreen canvas
    this.minimapCanvas = document.createElement('canvas');
    this.minimapCanvas.width = MINIMAP_CONFIG.size;
    this.minimapCanvas.height = MINIMAP_CONFIG.size;
    this.minimapCtx = this.minimapCanvas.getContext('2d');

    // Create all screen overlays
    this._createAllScreens();

    // Inject base styles
    this._injectStyles();

    this.initialized = true;
    console.log('[UIManager] Initialized');
  }

  /**
   * Creates all screen overlay DOM elements.
   * @private
   */
  _createAllScreens() {
    this._createLoadingScreen();
    this._createTitleScreen();
    this._createPauseScreen();
    this._createInventoryScreen();
    this._createQuestLogScreen();
    this._createFusionCodexScreen();
    this._createGameOverScreen();
    this._createSettingsScreen();
  }

  /**
   * Creates the loading screen overlay.
   * @private
   */
  _createLoadingScreen() {
    const el = document.createElement('div');
    el.id = 'screen-loading';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="loading-title">Echoes of the Small</div>
        <div class="loading-bar-container">
          <div class="loading-bar" id="loadingBar"></div>
        </div>
        <div class="loading-text" id="loadingText">Loading assets...</div>
        <div class="loading-tip" id="loadingTip">Tip: Press Q to shrink and fit through small spaces.</div>
      </div>
    `;
    this.screens.set('loading', { name: 'loading', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Creates the title screen overlay.
   * @private
   */
  _createTitleScreen() {
    const el = document.createElement('div');
    el.id = 'screen-title';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="title-main">Echoes of the Small</div>
        <div class="title-subtitle">A shrinking adventure</div>
        <div class="title-menu">
          <button class="menu-btn" id="btnNewGame">New Game</button>
          <button class="menu-btn" id="btnContinue">Continue</button>
          <button class="menu-btn" id="btnLoadGame">Load Game</button>
          <button class="menu-btn" id="btnSettings">Settings</button>
        </div>
        <div class="title-version">v1.0</div>
      </div>
    `;
    this.screens.set('title', { name: 'title', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Creates the pause screen overlay.
   * @private
   */
  _createPauseScreen() {
    const el = document.createElement('div');
    el.id = 'screen-pause';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="pause-title">Paused</div>
        <div class="pause-menu">
          <button class="menu-btn" id="btnResume">Resume</button>
          <button class="menu-btn" id="btnSaveGame">Save Game</button>
          <button class="menu-btn" id="btnLoadPause">Load Game</button>
          <button class="menu-btn" id="btnSettingsPause">Settings</button>
          <button class="menu-btn menu-btn-danger" id="btnQuit">Quit to Title</button>
        </div>
      </div>
    `;
    this.screens.set('pause', { name: 'pause', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Creates the inventory screen overlay.
   * @private
   */
  _createInventoryScreen() {
    const el = document.createElement('div');
    el.id = 'screen-inventory';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="screen-header">
          <div class="screen-title">Inventory</div>
          <button class="close-btn" id="btnCloseInventory">&times;</button>
        </div>
        <div class="inventory-layout">
          <div class="inventory-grid" id="inventoryGrid"></div>
          <div class="inventory-detail" id="inventoryDetail">
            <div class="detail-empty">Select an item to view details</div>
          </div>
        </div>
        <div class="inventory-hint">Press Tab or ESC to close</div>
      </div>
    `;
    this.screens.set('inventory', { name: 'inventory', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Creates the quest log screen overlay.
   * @private
   */
  _createQuestLogScreen() {
    const el = document.createElement('div');
    el.id = 'screen-quests';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="screen-header">
          <div class="screen-title">Quest Log</div>
          <button class="close-btn" id="btnCloseQuests">&times;</button>
        </div>
        <div class="quest-tabs">
          <button class="quest-tab active" data-tab="active">Active</button>
          <button class="quest-tab" data-tab="completed">Completed</button>
          <button class="quest-tab" data-tab="all">All</button>
        </div>
        <div class="quest-list" id="questList"></div>
        <div class="quest-detail" id="questDetail"></div>
      </div>
    `;
    this.screens.set('quests', { name: 'quests', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Creates the fusion codex screen overlay.
   * @private
   */
  _createFusionCodexScreen() {
    const el = document.createElement('div');
    el.id = 'screen-fusion';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="screen-header">
          <div class="screen-title">Fusion Codex</div>
          <button class="close-btn" id="btnCloseFusion">&times;</button>
        </div>
        <div class="fusion-tabs">
          <button class="fusion-tab active" data-tab="discovered">Discovered</button>
          <button class="fusion-tab" data-tab="secrets">Secrets</button>
          <button class="fusion-tab" data-tab="equipped">Equipped</button>
        </div>
        <div class="fusion-list" id="fusionList"></div>
        <div class="fusion-lore" id="fusionLore"></div>
        <div class="fusion-slots" id="fusionSlots"></div>
      </div>
    `;
    this.screens.set('fusion', { name: 'fusion', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Creates the game over screen overlay.
   * @private
   */
  _createGameOverScreen() {
    const el = document.createElement('div');
    el.id = 'screen-gameover';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="gameover-title">You Have Fallen</div>
        <div class="gameover-stats" id="gameoverStats"></div>
        <div class="gameover-menu">
          <button class="menu-btn" id="btnRetry">Try Again</button>
          <button class="menu-btn" id="btnLoadGameOver">Load Game</button>
          <button class="menu-btn menu-btn-danger" id="btnQuitGameOver">Quit to Title</button>
        </div>
      </div>
    `;
    this.screens.set('gameover', { name: 'gameover', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Creates the settings screen overlay.
   * @private
   */
  _createSettingsScreen() {
    const el = document.createElement('div');
    el.id = 'screen-settings';
    el.className = 'game-screen';
    el.innerHTML = `
      <div class="screen-content">
        <div class="screen-header">
          <div class="screen-title">Settings</div>
          <button class="close-btn" id="btnCloseSettings">&times;</button>
        </div>
        <div class="settings-section">
          <div class="settings-label">Sound Volume</div>
          <input type="range" class="settings-slider" id="soundVolume" min="0" max="100" value="70">
        </div>
        <div class="settings-section">
          <div class="settings-label">Music Volume</div>
          <input type="range" class="settings-slider" id="musicVolume" min="0" max="100" value="60">
        </div>
        <div class="settings-section">
          <div class="settings-label">Display</div>
          <label class="settings-checkbox">
            <input type="checkbox" id="fullscreenToggle"> Fullscreen
          </label>
          <label class="settings-checkbox">
            <input type="checkbox" id="vSyncToggle" checked> V-Sync
          </label>
        </div>
        <div class="settings-section">
          <div class="settings-label">HUD</div>
          <label class="settings-checkbox">
            <input type="checkbox" id="showMinimap" checked> Show Minimap
          </label>
          <label class="settings-checkbox">
            <input type="checkbox" id="showDamageNumbers" checked> Damage Numbers
          </label>
        </div>
        <div class="settings-actions">
          <button class="menu-btn" id="btnExportSave">Export Save</button>
          <button class="menu-btn" id="btnImportSave">Import Save</button>
          <button class="menu-btn menu-btn-danger" id="btnDeleteAllSaves">Delete All Saves</button>
        </div>
      </div>
    `;
    this.screens.set('settings', { name: 'settings', element: el, isVisible: false });
    this.container.appendChild(el);
  }

  /**
   * Injects base CSS styles for all UI screens.
   * @private
   */
  _injectStyles() {
    if (document.getElementById('eots-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'eots-ui-styles';
    style.textContent = `
      .game-screen {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        display: none; justify-content: center; align-items: center;
        background: rgba(5, 5, 12, 0.92); z-index: 100;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        animation: fadeIn 0.3s ease;
      }
      .game-screen.active { display: flex; }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      
      .screen-content {
        text-align: center; color: #e2e8f0; max-width: 600px; width: 90%;
        animation: slideUp 0.4s ease;
      }
      .screen-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 10px;
      }
      .screen-title { font-size: 24px; font-weight: bold; color: #d4a574; }
      .close-btn {
        background: none; border: 1px solid rgba(255,255,255,0.3); color: #e2e8f0;
        font-size: 20px; width: 36px; height: 36px; border-radius: 4px; cursor: pointer;
        transition: all 0.2s;
      }
      .close-btn:hover { background: rgba(255,255,255,0.1); border-color: #fff; }
      
      .title-main { font-size: 48px; font-weight: bold; color: #d4a574; margin-bottom: 8px; text-shadow: 0 0 20px rgba(212,165,116,0.4); }
      .title-subtitle { font-size: 16px; color: #94a3b8; margin-bottom: 40px; letter-spacing: 3px; text-transform: uppercase; }
      .title-version { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 40px; }
      
      .menu-btn {
        display: block; width: 220px; margin: 10px auto; padding: 12px 20px;
        background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2);
        color: #e2e8f0; font-size: 16px; cursor: pointer; border-radius: 6px;
        transition: all 0.2s;
      }
      .menu-btn:hover { background: rgba(212,165,116,0.2); border-color: #d4a574; transform: translateX(4px); }
      .menu-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .menu-btn-danger:hover { background: rgba(244,67,54,0.2); border-color: #f44336; }
      
      .loading-title { font-size: 32px; color: #d4a574; margin-bottom: 30px; }
      .loading-bar-container { width: 300px; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin: 0 auto 15px; overflow: hidden; }
      .loading-bar { height: 100%; width: 0%; background: linear-gradient(90deg, #d4a574, #e2c9a8); border-radius: 4px; transition: width 0.3s; }
      .loading-text { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }
      .loading-tip { font-size: 12px; color: rgba(255,255,255,0.4); font-style: italic; }
      
      .pause-title { font-size: 36px; color: #d4a574; margin-bottom: 30px; }
      .gameover-title { font-size: 36px; color: #f44336; margin-bottom: 20px; text-shadow: 0 0 20px rgba(244,67,54,0.4); }
      .gameover-stats { color: #94a3b8; margin-bottom: 30px; font-size: 14px; line-height: 2; }
      
      .inventory-layout, .quest-layout, .fusion-layout { display: flex; gap: 15px; text-align: left; }
      .inventory-grid, .quest-list, .fusion-list { flex: 1; min-height: 300px; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 10px; }
      .inventory-detail, .quest-detail, .fusion-lore { width: 250px; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 12px; }
      .inventory-hint { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 10px; }
      
      .quest-tabs, .fusion-tabs { display: flex; gap: 5px; margin-bottom: 10px; }
      .quest-tab, .fusion-tab { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; padding: 6px 14px; cursor: pointer; border-radius: 4px; font-size: 13px; }
      .quest-tab.active, .fusion-tab.active { background: rgba(212,165,116,0.2); border-color: #d4a574; color: #e2c8f0; }
      
      .settings-section { margin-bottom: 15px; text-align: left; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; }
      .settings-label { font-size: 14px; color: #d4a574; margin-bottom: 8px; }
      .settings-slider { width: 100%; accent-color: #d4a574; }
      .settings-checkbox { display: block; color: #94a3b8; font-size: 13px; margin: 5px 0; cursor: pointer; }
      .settings-checkbox input { margin-right: 8px; accent-color: #d4a574; }
      .settings-actions { margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; }
      
      /* Dialog box */
      .dialog-box {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        width: 700px; max-width: 90%; background: rgba(10, 10, 20, 0.95);
        border: 1px solid rgba(212, 165, 116, 0.4); border-radius: 8px;
        padding: 20px; z-index: 90; animation: slideUp 0.3s ease;
      }
      .dialog-speaker { color: #d4a574; font-weight: bold; font-size: 16px; margin-bottom: 8px; }
      .dialog-text { color: #e2e8f0; font-size: 15px; line-height: 1.6; min-height: 60px; }
      .dialog-hint { color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 10px; text-align: right; }
      .dialog-cursor { animation: blink 0.8s infinite; }
      @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      
      /* Notification */
      .ui-notification {
        position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
        padding: 10px 24px; border-radius: 6px; font-size: 14px; z-index: 95;
        animation: notifSlide 0.4s ease;
      }
      @keyframes notifSlide { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
      .notif-info { background: rgba(33, 150, 243, 0.85); color: #fff; }
      .notif-success { background: rgba(76, 175, 80, 0.85); color: #fff; }
      .notif-warning { background: rgba(255, 152, 0, 0.85); color: #fff; }
      .notif-error { background: rgba(244, 67, 54, 0.85); color: #fff; }
    `;
    document.head.appendChild(style);
  }

  // ===================== SCREEN MANAGEMENT =====================

  /**
   * Shows a screen overlay.
   * @param {string} name - Screen name (loading, title, pause, inventory, quests, fusion, gameover, settings)
   */
  showScreen(name) {
    const screen = this.screens.get(name);
    if (!screen) {
      console.warn(`[UIManager] Unknown screen: ${name}`);
      return;
    }

    // Hide current screen
    if (this.currentScreen) {
      this.hideScreen(this.currentScreen);
    }

    screen.element.classList.add('active');
    screen.isVisible = true;
    this.currentScreen = name;

    if (this.onScreenChange) {
      this.onScreenChange(name, true);
    }

    console.log(`[UIManager] Showing screen: ${name}`);
  }

  /**
   * Hides a screen overlay.
   * @param {string} name - Screen name to hide
   */
  hideScreen(name) {
    const screen = this.screens.get(name);
    if (!screen) return;

    screen.element.classList.remove('active');
    screen.isVisible = false;

    if (this.currentScreen === name) {
      this.currentScreen = null;
    }

    if (this.onScreenChange) {
      this.onScreenChange(name, false);
    }
  }

  /**
   * Hides all screens.
   */
  hideAllScreens() {
    for (const [name, screen] of this.screens) {
      if (screen.isVisible) {
        this.hideScreen(name);
      }
    }
  }

  /**
   * Checks if a screen is visible.
   * @param {string} name - Screen name
   * @returns {boolean} True if visible
   */
  isScreenVisible(name) {
    const screen = this.screens.get(name);
    return screen ? screen.isVisible : false;
  }

  /**
   * Updates loading screen progress.
   * @param {number} percent - Loading percentage (0-100)
   * @param {string} [text] - Loading status text
   * @param {string} [tip] - Loading tip text
   */
  updateLoadingProgress(percent, text, tip) {
    const bar = document.getElementById('loadingBar');
    const textEl = document.getElementById('loadingText');
    const tipEl = document.getElementById('loadingTip');

    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (textEl && text) textEl.textContent = text;
    if (tipEl && tip) tipEl.textContent = tip;
  }

  /**
   * Updates the game over screen with stats.
   * @param {Object} stats - Game statistics
   */
  updateGameOverStats(stats) {
    const el = document.getElementById('gameoverStats');
    if (!el || !stats) return;

    const playTime = this._formatTime(stats.playTime || 0);
    el.innerHTML = `
      <div>Time Survived: ${playTime}</div>
      <div>Enemies Defeated: ${stats.enemiesKilled || 0}</div>
      <div>Max Combo: ${stats.combosMax || 0}x</div>
      <div>Shrinks Used: ${stats.shrinksUsed || 0}</div>
      <div>Quests Completed: ${stats.questsCompleted || 0}/18</div>
    `;
  }

  // ===================== HUD RENDERING =====================

  /**
   * Updates HUD elements based on current game state.
   * @param {number} dt - Delta time in seconds
   * @param {Object} player - Player object
   */
  updateHUD(dt, player) {
    this.hudTimer += dt;
    this.auraPhase += dt * 2;

    // Update damage numbers
    this._updateDamageNumbers(dt);

    // Update combo displays
    this._updateComboDisplays(dt);

    // Update notifications
    this._updateNotifications(dt);

    // Update dialog typewriter
    if (this.currentDialog && !this.currentDialog.complete) {
      this._updateTypewriter(dt);
    }

    // Mark minimap dirty periodically
    if (Date.now() - this.lastMinimapUpdate > MINIMAP_CONFIG.updateInterval) {
      this.minimapDirty = true;
    }
  }

  /**
   * Renders all in-game HUD elements to the canvas.
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} [player] - Player object for HUD data
   * @param {Object} [world] - World object for minimap
   */
  renderHUD(ctx, player, world) {
    if (!ctx) return;

    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    ctx.save();

    // Health aura (diegetic - around player position)
    if (this.hudVisibility.health && player) {
      this._renderHealthAura(ctx, player, W, H);
    }

    // Health bar (top-left)
    if (this.hudVisibility.health && player) {
      this._renderHealthBar(ctx, player, 20, 20, 200, 18);
    }

    // Combo display
    if (this.hudVisibility.combo) {
      this._renderComboDisplays(ctx);
    }

    // Scale indicator (bottom-left)
    if (this.hudVisibility.scaleIndicator && player) {
      this._renderScaleIndicator(ctx, player.scale || 1.0, 20, H - 50);
    }

    // Minimap (top-right)
    if (this.hudVisibility.minimap && world) {
      this._renderMinimap(ctx, world, player, W - MINIMAP_CONFIG.size - 16, 16);
    }

    // Quest tracker
    if (this.hudVisibility.questTracker) {
      this._renderQuestTrackerHUD(ctx, W - 240, MINIMAP_CONFIG.size + 40);
    }

    // Damage numbers
    this._renderDamageNumbers(ctx);

    // Notifications (rendered via DOM, but we track them here)
    // Dialog box is also rendered via DOM

    ctx.restore();
  }

  /**
   * Renders the diegetic health aura around the player.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} player - Player object
   * @param {number} screenW - Screen width
   * @param {number} screenH - Screen height
   * @private
   */
  _renderHealthAura(ctx, player, screenW, screenH) {
    const hpPercent = (player.hp || 0) / (player.maxHP || 100);
    const screenX = screenW / 2;
    const screenY = screenH / 2;

    // Determine aura color based on health
    let auraColor;
    if (hpPercent > 0.6) {
      auraColor = UI_COLORS.healthFull;
    } else if (hpPercent > 0.3) {
      auraColor = UI_COLORS.healthMid;
    } else if (hpPercent > 0.15) {
      auraColor = UI_COLORS.healthLow;
    } else {
      auraColor = UI_COLORS.healthCritical;
    }

    // Pulsing glow radius based on health
    const baseRadius = 30;
    const pulseAmount = Math.sin(this.auraPhase) * 5;
    const healthScale = 0.5 + hpPercent * 0.5;
    const glowRadius = (baseRadius + pulseAmount) * healthScale;
    const alpha = 0.15 + (1 - hpPercent) * 0.15;

    // Draw radial glow
    const gradient = ctx.createRadialGradient(
      screenX, screenY, glowRadius * 0.3,
      screenX, screenY, glowRadius
    );
    gradient.addColorStop(0, this._hexToRgba(auraColor, 0));
    gradient.addColorStop(0.4, this._hexToRgba(auraColor, alpha * 0.5));
    gradient.addColorStop(1, this._hexToRgba(auraColor, 0));

    ctx.fillStyle = gradient;
    ctx.fillRect(screenX - glowRadius, screenY - glowRadius, glowRadius * 2, glowRadius * 2);

    // Critical health pulsing ring
    if (hpPercent <= 0.15) {
      const ringRadius = 40 + Math.sin(this.auraPhase * 3) * 8;
      ctx.strokeStyle = this._hexToRgba(UI_COLORS.healthCritical, 0.4 + Math.sin(this.auraPhase * 3) * 0.2);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /**
   * Renders the health bar.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} player - Player object
   * @param {number} x - Bar X position
   * @param {number} y - Bar Y position
   * @param {number} width - Bar width
   * @param {number} height - Bar height
   * @private
   */
  _renderHealthBar(ctx, player, x, y, width, height) {
    const hpPercent = Math.max(0, Math.min(1, (player.hp || 0) / (player.maxHP || 100)));

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this._roundRect(ctx, x, y, width, height, height / 2);
    ctx.fill();

    // Health fill
    let fillColor;
    if (hpPercent > 0.6) fillColor = UI_COLORS.healthFull;
    else if (hpPercent > 0.3) fillColor = UI_COLORS.healthMid;
    else fillColor = UI_COLORS.healthLow;

    if (hpPercent > 0) {
      ctx.fillStyle = fillColor;
      this._roundRect(ctx, x, y, width * hpPercent, height, height / 2);
      ctx.fill();

      // Shimmer effect on health bar
      const shimmerX = x + (width * hpPercent) * ((this.hudTimer % 3) / 3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(shimmerX - 10, y, 20, height);
    }

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, width, height, height / 2);
    ctx.stroke();

    // HP text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, height - 4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${Math.ceil(player.hp || 0)} / ${player.maxHP || 100}`,
      x + width / 2, y + height / 2
    );
  }

  /**
   * Renders the scale indicator.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} scale - Current player scale
   * @param {number} x - Position X
   * @param {number} y - Position Y
   * @private
   */
  _renderScaleIndicator(ctx, scale, x, y) {
    const size = 32;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this._roundRect(ctx, x, y, size + 4, size + 4, 4);
    ctx.fill();

    // Draw scale icon
    const centerX = x + (size + 4) / 2;
    const centerY = y + (size + 4) / 2;

    if (scale < 0.5) {
      // Shrunk - small icon
      ctx.fillStyle = '#00bcd4';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 188, 212, 0.3)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal - larger icon
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scale text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${(scale * 100).toFixed(0)}%`, x + size + 10, y + size / 2 + 3);
  }

  /**
   * Renders the minimap.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} world - World manager
   * @param {Object} player - Player object
   * @param {number} x - Minimap X position
   * @param {number} y - Minimap Y position
   * @private
   */
  _renderMinimap(ctx, world, player, x, y) {
    const size = MINIMAP_CONFIG.size;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Update minimap content if dirty
    if (this.minimapDirty && this.minimapCtx) {
      this._updateMinimapCanvas(world, player);
      this.minimapDirty = false;
      this.lastMinimapUpdate = Date.now();
    }

    // Draw minimap circle clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.clip();

    // Draw the minimap canvas
    if (this.minimapCanvas) {
      ctx.drawImage(this.minimapCanvas, x, y);
    }

    ctx.restore();

    // Player dot on top
    if (player) {
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Direction indicator
      ctx.fillStyle = '#4caf50';
      if (player.facingRight !== undefined) {
        const dir = player.facingRight ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x + size / 2 + dir * 5, y + size / 2);
        ctx.lineTo(x + size / 2 + dir * 12, y + size / 2 - 3);
        ctx.lineTo(x + size / 2 + dir * 12, y + size / 2 + 3);
        ctx.fill();
      }
    }

    // Border circle (drawn after clip to show full border)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  /**
   * Updates the minimap offscreen canvas.
   * @param {Object} world - World manager
   * @param {Object} player - Player object
   * @private
   */
  _updateMinimapCanvas(world, player) {
    if (!this.minimapCtx) return;

    const ctx = this.minimapCtx;
    const size = MINIMAP_CONFIG.size;
    const center = size / 2;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw terrain (simplified)
    if (world && world.chunks) {
      const scale = MINIMAP_CONFIG.scale;
      for (const [key, chunk] of world.chunks) {
        const [cx, cy] = key.split(',').map(Number);
        const px = center + (cx * world.chunkSize * world.tileSize - (player?.x || 0)) * scale;
        const py = center + (cy * world.chunkSize * world.tileSize - (player?.y || 0)) * scale;

        // Color based on biome
        const biomeColors = {
          FOREST: '#2d5016', DESERT: '#c2a060', MOUNTAIN: '#64748b',
          SWAMP: '#3a4a2a', ICE: '#cbd5e1', VOLCANO: '#7f1d1d'
        };
        ctx.fillStyle = biomeColors[chunk.biome] || '#444';
        ctx.fillRect(px, py, world.chunkSize * world.tileSize * scale, world.chunkSize * world.tileSize * scale);
      }
    } else {
      // Fallback: draw explored area placeholder
      ctx.fillStyle = '#2d5016';
      ctx.fillRect(center - 20, center - 20, 40, 40);
    }

    // Draw POIs (dungeon entrances, shrines)
    if (world && world.dungeons) {
      ctx.fillStyle = '#f44336';
      for (const dungeon of world.dungeons) {
        const dx = center + ((dungeon.x || 0) - (player?.x || 0)) * MINIMAP_CONFIG.scale;
        const dy = center + ((dungeon.y || 0) - (player?.y || 0)) * MINIMAP_CONFIG.scale;
        if (dx > 0 && dx < size && dy > 0 && dy < size) {
          ctx.beginPath();
          ctx.rect(dx - 3, dy - 3, 6, 6);
          ctx.fill();
        }
      }
    }
  }

  /**
   * Renders quest tracker on HUD.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position
   * @param {number} y - Y position
   * @private
   */
  _renderQuestTrackerHUD(ctx, x, y) {
    // Placeholder - actual quest data comes from QuestSystem
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this._roundRect(ctx, x, y, 220, 60, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Quest Tracker', x + 8, y + 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText('No active quests', x + 8, y + 38);
    ctx.restore();
  }

  // ===================== DAMAGE NUMBERS =====================

  /**
   * Shows a floating damage number.
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} amount - Damage amount
   * @param {boolean} [isCritical=false] - Whether critical hit
   * @param {string} [element='normal'] - Element type for color
   */
  showDamageNumber(x, y, amount, isCritical = false, element = 'normal') {
    const now = Date.now();
    const color = ELEMENT_COLORS[element] || ELEMENT_COLORS.normal;

    this.damageNumbers.push({
      x,
      y,
      amount,
      isCritical,
      color,
      createdAt: now,
      vy: -80 - Math.random() * 40,
      opacity: 1,
      scale: isCritical ? 1.4 : 1.0
    });
  }

  /**
   * Shows a healing number.
   * @param {number} x - World X position
   * @param {number} y - World Y position
   * @param {number} amount - Heal amount
   */
  showHealNumber(x, y, amount) {
    this.showDamageNumber(x, y, amount, false, 'heal');
  }

  /**
   * Updates all damage numbers.
   * @param {number} dt - Delta time in seconds
   * @private
   */
  _updateDamageNumbers(dt) {
    const now = Date.now();
    const lifetime = 1200; // ms

    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const num = this.damageNumbers[i];
      const age = now - num.createdAt;

      if (age >= lifetime) {
        this.damageNumbers.splice(i, 1);
        continue;
      }

      // Float upward
      num.y += num.vy * dt;
      // Slow down vertical velocity
      num.vy *= 0.98;

      // Fade out in last 400ms
      const fadeStart = lifetime - 400;
      if (age > fadeStart) {
        num.opacity = 1 - (age - fadeStart) / 400;
      }

      // Scale down slightly
      if (num.scale > 1) {
        num.scale = Math.max(1, num.scale - dt * 0.5);
      }
    }
  }

  /**
   * Renders all floating damage numbers.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @private
   */
  _renderDamageNumbers(ctx) {
    ctx.save();

    for (const num of this.damageNumbers) {
      ctx.globalAlpha = num.opacity;
      ctx.fillStyle = num.color;

      const fontSize = num.isCritical ? 24 : 16;
      ctx.font = `bold ${Math.round(fontSize * num.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // For critical hits, add "!" and outline
      const text = num.isCritical ? `${num.amount}!` : `${num.amount}`;

      if (num.isCritical) {
        // Glow effect
        ctx.shadowColor = num.color;
        ctx.shadowBlur = 8;
      }

      ctx.fillText(text, num.x, num.y);
      ctx.shadowBlur = 0;

      // Outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeText(text, num.x, num.y);
    }

    ctx.restore();
  }

  // ===================== COMBO DISPLAY =====================

  /**
   * Shows a combo hit display.
   * @param {number} x - Screen X position
   * @param {number} y - Screen Y position
   * @param {number} comboCount - Current combo count
   * @param {number} multiplier - Damage multiplier
   */
  showCombo(x, y, comboCount, multiplier) {
    const now = Date.now();

    this.comboDisplays.push({
      x: x + (Math.random() - 0.5) * 20,
      y,
      comboCount,
      multiplier,
      createdAt: now,
      vy: -100,
      opacity: 1,
      scale: 0.5 + comboCount * 0.1
    });
  }

  /**
   * Updates combo displays.
   * @param {number} dt - Delta time
   * @private
   */
  _updateComboDisplays(dt) {
    const now = Date.now();
    const lifetime = 800;

    for (let i = this.comboDisplays.length - 1; i >= 0; i--) {
      const combo = this.comboDisplays[i];
      const age = now - combo.createdAt;

      if (age >= lifetime) {
        this.comboDisplays.splice(i, 1);
        continue;
      }

      combo.y += combo.vy * dt;
      combo.vy *= 0.95;

      const fadeStart = lifetime - 300;
      if (age > fadeStart) {
        combo.opacity = 1 - (age - fadeStart) / 300;
      }

      combo.scale = Math.min(2, combo.scale + dt * 2);
    }
  }

  /**
   * Renders combo displays.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @private
   */
  _renderComboDisplays(ctx) {
    ctx.save();

    for (const combo of this.comboDisplays) {
      ctx.globalAlpha = combo.opacity;

      // Combo count
      ctx.fillStyle = UI_COLORS.combo;
      ctx.font = `bold ${Math.round(20 * combo.scale)}px sans-serif`;
      ctx.textAlign = 'center';

      ctx.shadowColor = UI_COLORS.combo;
      ctx.shadowBlur = 6;
      ctx.fillText(`${combo.comboCount}x`, combo.x, combo.y);
      ctx.shadowBlur = 0;

      // Multiplier
      if (combo.multiplier > 1) {
        ctx.fillStyle = UI_COLORS.gold;
        ctx.font = `bold ${Math.round(12 * combo.scale)}px sans-serif`;
        ctx.fillText(`x${combo.multiplier.toFixed(1)}`, combo.x, combo.y + 20);
      }
    }

    ctx.restore();
  }

  // ===================== NOTIFICATIONS =====================

  /**
   * Shows a notification message.
   * @param {string} message - Notification text
   * @param {string} [type='info'] - Notification type: info, warning, success, error
   * @param {number} [duration=3000] - Display duration in ms
   */
  showNotification(message, type = 'info', duration = 3000) {
    this.notifications.push({
      message,
      type,
      createdAt: Date.now(),
      duration,
      opacity: 1
    });

    // Also emit as DOM notification
    this._showDOMNotification(message, type, duration);
  }

  /**
   * Shows a DOM-based notification.
   * @param {string} message - Notification text
   * @param {string} type - Notification type
   * @param {number} duration - Display duration
   * @private
   */
  _showDOMNotification(message, type, duration) {
    const notif = document.createElement('div');
    notif.className = `ui-notification notif-${type}`;
    notif.textContent = message;
    document.body.appendChild(notif);

    setTimeout(() => {
      notif.style.transition = 'opacity 0.5s';
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 500);
    }, duration);
  }

  /**
   * Updates notifications.
   * @param {number} dt - Delta time
   * @private
   */
  _updateNotifications(dt) {
    const now = Date.now();

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      const notif = this.notifications[i];
      const age = now - notif.createdAt;

      if (age >= notif.duration) {
        this.notifications.splice(i, 1);
      }
    }
  }

  // ===================== DIALOG SYSTEM =====================

  /**
   * Shows a dialog box with typewriter text effect.
   * @param {string} speaker - Speaker name
   * @param {string} text - Dialog text
   * @param {Object} [options={}] - Dialog options
   * @param {number} [options.speed] - Typewriter speed (chars/sec)
   * @param {Function} [options.onComplete] - Callback when dialog finishes
   */
  showDialog(speaker, text, options = {}) {
    const entry = {
      speaker,
      text,
      displayText: '',
      charIndex: 0,
      speed: options.speed || this.typewriterSpeed,
      complete: false
    };

    if (this.currentDialog && !this.currentDialog.complete) {
      // Queue it
      this.dialogQueue.push({ speaker, text, options });
      return;
    }

    this.currentDialog = entry;
    this.dialogWaiting = false;
    this.dialogStartTime = Date.now();

    if (options.onComplete) {
      this.onDialogComplete = options.onComplete;
    }

    this._showDialogDOM(speaker, '');
  }

  /**
   * Shows multiple dialog lines in sequence.
   * @param {Array<{speaker: string, text: string}>} lines - Dialog lines
   * @param {Object} [options={}] - Options
   */
  showDialogSequence(lines, options = {}) {
    if (!lines || lines.length === 0) return;

    // Show first line
    this.showDialog(lines[0].speaker, lines[0].text, {
      ...options,
      onComplete: () => {
        if (lines.length > 1) {
          this.showDialogSequence(lines.slice(1), options);
        }
      }
    });
  }

  /**
   * Advances the current dialog (called when player presses interact).
   * @returns {boolean} True if dialog was advanced/closed
   */
  advanceDialog() {
    if (!this.currentDialog) return false;

    if (!this.currentDialog.complete) {
      // Skip to end of current text
      this.currentDialog.displayText = this.currentDialog.text;
      this.currentDialog.charIndex = this.currentDialog.text.length;
      this.currentDialog.complete = true;
      this.dialogWaiting = true;
      this._updateDialogDOM();
      return true;
    }

    // Dialog is complete, check queue
    if (this.dialogQueue.length > 0) {
      const next = this.dialogQueue.shift();
      this.showDialog(next.speaker, next.text, next.options);
      return true;
    }

    // Close dialog
    this._hideDialogDOM();
    this.currentDialog = null;
    this.dialogWaiting = false;

    if (this.onDialogComplete) {
      const cb = this.onDialogComplete;
      this.onDialogComplete = null;
      cb();
    }

    return true;
  }

  /**
   * Updates the typewriter effect.
   * @param {number} dt - Delta time
   * @private
   */
  _updateTypewriter(dt) {
    if (!this.currentDialog || this.currentDialog.complete) return;

    const dialog = this.currentDialog;
    const charsToAdd = dialog.speed * dt;

    dialog.charIndex = Math.min(dialog.text.length, dialog.charIndex + charsToAdd);
    dialog.displayText = dialog.text.substring(0, Math.floor(dialog.charIndex));

    if (dialog.charIndex >= dialog.text.length) {
      dialog.complete = true;
      this.dialogWaiting = true;
    }

    this._updateDialogDOM();
  }

  /**
   * Creates/updates the dialog DOM element.
   * @param {string} speaker - Speaker name
   * @param {string} text - Current text
   * @private
   */
  _showDialogDOM(speaker, text) {
    let el = document.getElementById('dialogBox');
    if (!el) {
      el = document.createElement('div');
      el.id = 'dialogBox';
      el.className = 'dialog-box';
      document.body.appendChild(el);
    }

    const cursorHtml = this.currentDialog && !this.currentDialog.complete
      ? '<span class="dialog-cursor">|</span>' : '';

    el.innerHTML = `
      <div class="dialog-speaker">${speaker}</div>
      <div class="dialog-text">${text}${cursorHtml}</div>
      <div class="dialog-hint">Press E / Space to ${this.currentDialog?.complete ? 'continue' : 'skip'}</div>
    `;
    el.style.display = 'block';
  }

  /**
   * Updates the dialog DOM with current text.
   * @private
   */
  _updateDialogDOM() {
    if (!this.currentDialog) return;

    const textEl = document.querySelector('.dialog-text');
    const hintEl = document.querySelector('.dialog-hint');

    if (textEl) {
      const cursorHtml = !this.currentDialog.complete
        ? '<span class="dialog-cursor">|</span>' : '';
      textEl.innerHTML = this.currentDialog.displayText + cursorHtml;
    }

    if (hintEl) {
      hintEl.textContent = this.currentDialog.complete
        ? 'Press E / Space to continue'
        : 'Press E / Space to skip';
    }
  }

  /**
   * Hides the dialog DOM element.
   * @private
   */
  _hideDialogDOM() {
    const el = document.getElementById('dialogBox');
    if (el) {
      el.style.display = 'none';
    }
  }

  /**
   * Checks if a dialog is currently active.
   * @returns {boolean} True if dialog is showing
   */
  isDialogActive() {
    return this.currentDialog !== null;
  }

  // ===================== NOTIFICATION SHORTCUTS =====================

  /**
   * Shows a success notification.
   * @param {string} message - Notification text
   */
  notifySuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Shows a warning notification.
   * @param {string} message - Notification text
   */
  notifyWarning(message) {
    this.showNotification(message, 'warning');
  }

  /**
   * Shows an error notification.
   * @param {string} message - Notification text
   */
  notifyError(message) {
    this.showNotification(message, 'error');
  }

  // ===================== UTILITY =====================

  /**
   * Renders the complete UI frame.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} [gameState] - Current game state
   */
  render(ctx, gameState) {
    if (!ctx) return;

    const player = gameState?.player;
    const world = gameState?.world;

    this.renderHUD(ctx, player, world);
  }

  /**
   * Updates the minimap with current world data.
   * @param {Object} world - World manager
   * @param {Object} player - Player object
   */
  updateMinimap(world, player) {
    this.minimapDirty = true;
  }

  /**
   * Toggles a HUD element visibility.
   * @param {string} element - HUD element name
   * @param {boolean} [visible] - Force visibility state
   * @returns {boolean} New visibility state
   */
  toggleHUD(element, visible) {
    if (element in this.hudVisibility) {
      this.hudVisibility[element] = visible !== undefined ? visible : !this.hudVisibility[element];
      return this.hudVisibility[element];
    }
    return false;
  }

  /**
   * Shows a screen shake effect on the canvas.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} intensity - Shake intensity in pixels
   */
  applyScreenShake(ctx, intensity) {
    const dx = (Math.random() - 0.5) * intensity * 2;
    const dy = (Math.random() - 0.5) * intensity * 2;
    ctx.translate(dx, dy);
  }

  /**
   * Draws a vignette effect (darkened edges).
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} [intensity=0.5] - Vignette intensity
   */
  drawVignette(ctx, intensity = 0.5) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const maxDim = Math.max(W, H);

    const gradient = ctx.createRadialGradient(
      W / 2, H / 2, maxDim * 0.3,
      W / 2, H / 2, maxDim * 0.7
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * Draws a red damage vignette when player is hurt.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} [flashAmount=0.3] - Flash intensity (0-1)
   */
  drawDamageVignette(ctx, flashAmount = 0.3) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    const gradient = ctx.createRadialGradient(
      W / 2, H / 2, W * 0.2,
      W / 2, H / 2, W * 0.6
    );
    gradient.addColorStop(0, 'rgba(244, 67, 54, 0)');
    gradient.addColorStop(1, `rgba(244, 67, 54, ${flashAmount})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * Resizes the UI to match new canvas dimensions.
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.screenSize.width = width;
    this.screenSize.height = height;
  }

  // ===================== PRIVATE HELPERS =====================

  /**
   * Draws a rounded rectangle path.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Top-left X
   * @param {number} y - Top-left Y
   * @param {number} w - Width
   * @param {number} h - Height
   * @param {number} r - Corner radius
   * @private
   */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /**
   * Converts hex color to rgba string.
   * @param {string} hex - Hex color
   * @param {number} alpha - Alpha value (0-1)
   * @returns {string} rgba string
   * @private
   */
  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Formats seconds into a human-readable time string.
   * @param {number} seconds - Time in seconds
   * @returns {string} Formatted time
   * @private
   */
  _formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Destroys the UI manager and cleans up DOM elements.
   */
  destroy() {
    // Remove all screen elements
    for (const [, screen] of this.screens) {
      if (screen.element && screen.element.parentNode) {
        screen.element.parentNode.removeChild(screen.element);
      }
    }
    this.screens.clear();

    // Remove dialog box
    const dialogBox = document.getElementById('dialogBox');
    if (dialogBox && dialogBox.parentNode) {
      dialogBox.parentNode.removeChild(dialogBox);
    }

    // Remove styles
    const styles = document.getElementById('eots-ui-styles');
    if (styles && styles.parentNode) {
      styles.parentNode.removeChild(styles);
    }

    // Remove any lingering notifications
    document.querySelectorAll('.ui-notification').forEach(el => el.remove());

    this.initialized = false;
    this.currentScreen = null;
    this.onDialogComplete = null;
    this.onScreenChange = null;
  }
}

window.UIManager = UIManager;
