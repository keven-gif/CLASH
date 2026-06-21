/**
 * @file SaveSystem.js
 * @description Handles game persistence with 3 manual save slots plus an auto-save slot.
 * Uses localStorage for storage with save data validation, corruption handling,
 * import/export via base64 strings, and metadata tracking.
 */

/** @typedef {Object} SaveData
 * @property {number} version - Save data schema version
 * @property {number} slot - Save slot number (0-2 for manual, 99 for auto)
 * @property {number} timestamp - Unix timestamp of save
 * @property {Object} player - Player state
 * @property {Object} world - World state
 * @property {Object} quests - Quest state
 * @property {Object} fusion - Fusion state
 * @property {Object} stats - Play statistics
 */

/** @typedef {Object} SaveInfo
 * @property {boolean} exists - Whether a save exists in this slot
 * @property {number|null} timestamp - Save timestamp
 * @property {number|null} playTime - Play time in seconds
 * @property {number|null} completionPercent - Completion percentage
 * @property {string|null} currentBiome - Current biome
 * @property {number|null} playerHP - Player HP
 */

/**
 * Save data schema version for migration support.
 * @constant {number}
 */
const SAVE_VERSION = 1;

/**
 * LocalStorage key prefix.
 * @constant {string}
 */
const STORAGE_PREFIX = 'eots_save_';

/**
 * Auto-save slot number.
 * @constant {number}
 */
const AUTO_SAVE_SLOT = 99;

/**
 * Auto-save interval in milliseconds (2 minutes).
 * @constant {number}
 */
const AUTO_SAVE_INTERVAL = 120000;

/**
 * Maximum save data size in bytes (~1MB).
 * @constant {number}
 */
const MAX_SAVE_SIZE = 1048576;

/**
 * Default save data structure.
 * @returns {SaveData} Fresh save data object
 */
function createDefaultSaveData() {
  return {
    version: SAVE_VERSION,
    slot: 0,
    timestamp: Date.now(),
    player: {
      x: 0,
      y: 0,
      hp: 100,
      maxHP: 100,
      scale: 1.0,
      items: [],
      relics: [],
      equippedFusions: []
    },
    world: {
      seed: 0,
      discoveredChunks: [],
      currentBiome: 'FOREST',
      worldTime: 6000,
      clearedDungeons: [],
      unlockedDoors: [],
      defeatedBosses: [],
      visitedShrines: []
    },
    quests: {
      active: [],
      completed: [],
      failed: [],
      objectives: {}
    },
    fusion: {
      discovered: [],
      collectedRelics: [],
      equipped: []
    },
    stats: {
      playTime: 0,
      enemiesKilled: 0,
      deaths: 0,
      combosMax: 0,
      shrinksUsed: 0,
      itemsCollected: 0,
      relicsCollected: 0,
      fusionsDiscovered: 0,
      questsCompleted: 0,
      distanceTraveled: 0
    }
  };
}

/**
 * Manages game save/load functionality with localStorage persistence.
 * Supports 3 manual slots (0, 1, 2) and 1 auto-save slot (99).
 * @class SaveSystem
 */
class SaveSystem {
  /**
   * Creates a new SaveSystem.
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.game] - Game instance reference
   * @param {Object} [options.itemSystem] - ItemSystem instance
   * @param {Object} [options.questSystem] - QuestSystem instance
   * @param {Object} [options.fusionSystem] - RelicFusionSystem instance
   * @param {boolean} [options.enableAutoSave=true] - Whether to enable auto-save
   */
  constructor(options = {}) {
    /** @type {Object|null} Game instance */
    this.game = options.game || null;

    /** @type {Object|null} ItemSystem for serializing items */
    this.itemSystem = options.itemSystem || null;

    /** @type {Object|null} QuestSystem for serializing quests */
    this.questSystem = options.questSystem || null;

    /** @type {Object|null} RelicFusionSystem for serializing fusions */
    this.fusionSystem = options.fusionSystem || null;

    /** @type {boolean} Whether auto-save is enabled */
    this.enableAutoSave = options.enableAutoSave !== false;

    /** @type {number|null} Auto-save interval timer ID */
    this.autoSaveTimer = null;

    /** @type {number} Last auto-save timestamp */
    this.lastAutoSave = 0;

    /** @type {number} Current play time accumulator */
    this.playTimeAccumulator = 0;

    /** @type {number} Last time playTime was updated */
    this.lastPlayTimeUpdate = Date.now();

    /** @type {boolean} Whether a save operation is in progress */
    this.isSaving = false;

    /** @type {boolean} Whether localStorage is available */
    this.storageAvailable = this._checkStorageAvailability();

    /** @type {number} Current active slot */
    this.currentSlot = 0;

    /** @type {Array<Object>} Save operation history for debugging */
    this.operationLog = [];
  }

  /**
   * Checks if localStorage is available and working.
   * @returns {boolean} True if storage is available
   * @private
   */
  _checkStorageAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('[SaveSystem] localStorage not available:', e.message);
      return false;
    }
  }

  /**
   * Initializes the save system and starts auto-save if enabled.
   */
  init() {
    if (this.enableAutoSave && this.storageAvailable) {
      this._startAutoSave();
    }
    this.lastPlayTimeUpdate = Date.now();
    console.log('[SaveSystem] Initialized. Storage available:', this.storageAvailable);
  }

  /**
   * Starts the auto-save timer.
   * @private
   */
  _startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    this.autoSaveTimer = setInterval(() => {
      this.autoSave();
    }, AUTO_SAVE_INTERVAL);
    console.log(`[SaveSystem] Auto-save started (${AUTO_SAVE_INTERVAL / 1000}s interval)`);
  }

  /**
   * Stops the auto-save timer.
   * @private
   */
  _stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Gets the localStorage key for a slot.
   * @param {number} slot - Slot number
   * @returns {string} Storage key
   * @private
   */
  _getKey(slot) {
    return `${STORAGE_PREFIX}${slot}`;
  }

  /**
   * Validates save data structure and integrity.
   * @param {Object} data - Save data to validate
   * @returns {{valid: boolean, errors: string[], data: SaveData|null}} Validation result
   * @private
   */
  _validateSaveData(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Save data is not an object'], data: null };
    }

    // Check version
    if (typeof data.version !== 'number') {
      errors.push('Missing or invalid version field');
    } else if (data.version > SAVE_VERSION) {
      errors.push(`Save version ${data.version} is newer than supported ${SAVE_VERSION}`);
    }

    // Check required top-level fields
    const requiredFields = ['slot', 'timestamp', 'player', 'world', 'quests', 'fusion', 'stats'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate player data
    if (data.player) {
      if (typeof data.player.x !== 'number') errors.push('Invalid player.x');
      if (typeof data.player.y !== 'number') errors.push('Invalid player.y');
      if (typeof data.player.hp !== 'number') errors.push('Invalid player.hp');
      if (!Array.isArray(data.player.items)) errors.push('Invalid player.items');
    }

    // Validate world data
    if (data.world) {
      if (typeof data.world.seed !== 'number') errors.push('Invalid world.seed');
      if (typeof data.world.currentBiome !== 'string') errors.push('Invalid world.currentBiome');
    }

    // Validate stats
    if (data.stats) {
      if (typeof data.stats.playTime !== 'number') errors.push('Invalid stats.playTime');
    }

    // Attempt recovery for minor issues
    let recoveredData = null;
    if (errors.length > 0) {
      recoveredData = this._attemptRecovery(data, errors);
    }

    const isValid = errors.length === 0 || recoveredData !== null;

    return {
      valid: isValid,
      errors,
      data: recoveredData || (errors.length === 0 ? data : null)
    };
  }

  /**
   * Attempts to recover corrupted save data by filling in defaults.
   * @param {Object} data - Corrupted data
   * @param {string[]} errors - List of validation errors
   * @returns {SaveData|null} Recovered data or null if unrecoverable
   * @private
   */
  _attemptRecovery(data, errors) {
    try {
      const defaults = createDefaultSaveData();
      const recovered = { ...defaults };

      // Merge whatever valid data we can
      if (data.version) recovered.version = Math.min(data.version, SAVE_VERSION);
      if (typeof data.slot === 'number') recovered.slot = data.slot;
      if (data.timestamp) recovered.timestamp = data.timestamp;

      if (data.player && typeof data.player === 'object') {
        recovered.player = { ...defaults.player, ...data.player };
        // Ensure arrays
        if (!Array.isArray(recovered.player.items)) recovered.player.items = [];
        if (!Array.isArray(recovered.player.relics)) recovered.player.relics = [];
      }

      if (data.world && typeof data.world === 'object') {
        recovered.world = { ...defaults.world, ...data.world };
        if (!Array.isArray(recovered.world.discoveredChunks)) recovered.world.discoveredChunks = [];
        if (!Array.isArray(recovered.world.clearedDungeons)) recovered.world.clearedDungeons = [];
      }

      if (data.quests && typeof data.quests === 'object') {
        recovered.quests = { ...defaults.quests, ...data.quests };
      }

      if (data.fusion && typeof data.fusion === 'object') {
        recovered.fusion = { ...defaults.fusion, ...data.fusion };
        if (!Array.isArray(recovered.fusion.discovered)) recovered.fusion.discovered = [];
        if (!Array.isArray(recovered.fusion.collectedRelics)) recovered.fusion.collectedRelics = [];
      }

      if (data.stats && typeof data.stats === 'object') {
        recovered.stats = { ...defaults.stats, ...data.stats };
      }

      console.log('[SaveSystem] Recovered corrupted save data. Issues:', errors);
      return recovered;
    } catch (e) {
      console.error('[SaveSystem] Failed to recover save data:', e);
      return null;
    }
  }

  /**
   * Gathers current game state for saving.
   * @param {number} slot - Target slot number
   * @returns {SaveData} Complete save data object
   * @private
   */
  _gatherSaveData(slot) {
    const data = createDefaultSaveData();
    data.slot = slot;
    data.timestamp = Date.now();

    // Update play time
    const now = Date.now();
    const delta = (now - this.lastPlayTimeUpdate) / 1000;
    this.playTimeAccumulator += delta;
    this.lastPlayTimeUpdate = now;

    // Gather player data
    if (this.game && this.game.player) {
      const player = this.game.player;
      data.player.x = player.x || 0;
      data.player.y = player.y || 0;
      data.player.hp = player.hp || 100;
      data.player.maxHP = player.maxHP || 100;
      data.player.scale = player.scale || 1.0;
      data.player.items = player.items ? [...player.items] : [];
      data.player.relics = player.relics ? [...player.relics] : [];
      data.player.equippedFusions = player.equippedFusions ? [...player.equippedFusions] : [];
    }

    // Gather item system data
    if (this.itemSystem) {
      const itemData = this.itemSystem.serialize ? this.itemSystem.serialize() : null;
      if (itemData && itemData.items) {
        data.player.items = [...itemData.items];
      }
    }

    // Gather world data
    if (this.game) {
      if (this.game.worldSeed !== undefined) {
        data.world.seed = this.game.worldSeed;
      }
      if (this.game.worldManager) {
        const wm = this.game.worldManager;
        data.world.currentBiome = wm.currentBiome || 'FOREST';
        data.world.worldTime = wm.worldTime || 6000;
        if (wm.discoveredChunks) {
          data.world.discoveredChunks = Array.from(wm.discoveredChunks);
        }
        if (wm.clearedDungeons) {
          data.world.clearedDungeons = [...wm.clearedDungeons];
        }
        if (wm.defeatedBosses) {
          data.world.defeatedBosses = [...wm.defeatedBosses];
        }
      }
    }

    // Gather quest data
    if (this.questSystem) {
      const questData = this.questSystem.serialize ? this.questSystem.serialize() : null;
      if (questData) {
        data.quests = {
          active: questData.active || [],
          completed: Array.isArray(questData.completedQuests) ? questData.completedQuests : [],
          failed: Array.isArray(questData.failedQuests) ? questData.failedQuests : [],
          states: questData.states || {}
        };
      }
    }

    // Gather fusion data
    if (this.fusionSystem) {
      const fusionData = this.fusionSystem.serialize ? this.fusionSystem.serialize() : null;
      if (fusionData) {
        data.fusion = {
          discovered: fusionData.discoveredFusions || [],
          collectedRelics: fusionData.collectedRelics || [],
          equipped: fusionData.equippedFusions || []
        };
      }
    }

    // Gather stats
    data.stats.playTime = this.playTimeAccumulator;
    if (this.game && this.game.stats) {
      const gs = this.game.stats;
      data.stats.enemiesKilled = gs.enemiesKilled || 0;
      data.stats.deaths = gs.deaths || 0;
      data.stats.combosMax = gs.combosMax || 0;
      data.stats.shrinksUsed = gs.shrinksUsed || 0;
      data.stats.itemsCollected = gs.itemsCollected || 0;
      data.stats.relicsCollected = gs.relicsCollected || 0;
      data.stats.fusionsDiscovered = gs.fusionsDiscovered || 0;
      data.stats.questsCompleted = gs.questsCompleted || 0;
      data.stats.distanceTraveled = gs.distanceTraveled || 0;
    }

    return data;
  }

  /**
   * Saves game data to the specified slot.
   * @param {number} [slot=0] - Save slot (0, 1, or 2)
   * @returns {boolean} True if save was successful
   */
  save(slot = 0) {
    if (!this.storageAvailable) {
      console.warn('[SaveSystem] Cannot save: localStorage not available');
      return false;
    }

    if (this.isSaving) {
      console.warn('[SaveSystem] Save already in progress');
      return false;
    }

    if (slot !== AUTO_SAVE_SLOT && (slot < 0 || slot > 2)) {
      console.warn(`[SaveSystem] Invalid slot: ${slot}. Use 0, 1, 2, or ${AUTO_SAVE_SLOT}`);
      return false;
    }

    this.isSaving = true;

    try {
      const data = this._gatherSaveData(slot);
      const json = JSON.stringify(data);

      // Check size
      if (json.length > MAX_SAVE_SIZE) {
        console.error(`[SaveSystem] Save data too large: ${json.length} bytes (max ${MAX_SAVE_SIZE})`);
        this.isSaving = false;
        return false;
      }

      const key = this._getKey(slot);
      localStorage.setItem(key, json);

      this.currentSlot = slot;
      this._logOperation('save', slot, true);

      const slotLabel = slot === AUTO_SAVE_SLOT ? 'auto' : `slot ${slot}`;
      console.log(`[SaveSystem] Game saved to ${slotLabel} (${json.length} bytes)`);

      if (typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('system:save', { slot, timestamp: data.timestamp });
      }

      this.isSaving = false;
      return true;
    } catch (e) {
      console.error('[SaveSystem] Save failed:', e);
      this._logOperation('save', slot, false, e.message);
      this.isSaving = false;
      return false;
    }
  }

  /**
   * Loads game data from the specified slot.
   * @param {number} [slot=0] - Save slot (0, 1, 2, or 99 for auto)
   * @returns {SaveData|null} Loaded save data, or null if not found/invalid
   */
  load(slot = 0) {
    if (!this.storageAvailable) {
      console.warn('[SaveSystem] Cannot load: localStorage not available');
      return null;
    }

    try {
      const key = this._getKey(slot);
      const json = localStorage.getItem(key);

      if (!json) {
        console.log(`[SaveSystem] No save data in slot ${slot}`);
        return null;
      }

      let data;
      try {
        data = JSON.parse(json);
      } catch (parseErr) {
        console.error(`[SaveSystem] Corrupted save in slot ${slot}:`, parseErr);
        this._logOperation('load', slot, false, 'Parse error: ' + parseErr.message);
        return this._handleCorruptedSave(slot);
      }

      // Validate
      const validation = this._validateSaveData(data);
      if (!validation.valid) {
        console.error(`[SaveSystem] Invalid save in slot ${slot}:`, validation.errors);
        if (validation.data) {
          console.log('[SaveSystem] Using recovered data');
          this._logOperation('load', slot, true, 'Recovered from corruption');
          this.currentSlot = slot;
          return validation.data;
        }
        return this._handleCorruptedSave(slot);
      }

      this.currentSlot = slot;
      this.playTimeAccumulator = validation.data.stats?.playTime || 0;
      this.lastPlayTimeUpdate = Date.now();

      this._logOperation('load', slot, true);
      console.log(`[SaveSystem] Loaded save from slot ${slot}`);

      if (typeof window !== 'undefined' && window.GameEvents) {
        window.GameEvents.emit('system:load', { slot, timestamp: validation.data.timestamp });
      }

      return validation.data;
    } catch (e) {
      console.error(`[SaveSystem] Load failed for slot ${slot}:`, e);
      this._logOperation('load', slot, false, e.message);
      return null;
    }
  }

  /**
   * Handles a corrupted save by attempting recovery or removing it.
   * @param {number} slot - The corrupted slot
   * @returns {SaveData|null} Recovered data or null
   * @private
   */
  _handleCorruptedSave(slot) {
    try {
      const key = this._getKey(slot);
      const json = localStorage.getItem(key);

      if (!json) return null;

      // Try to extract whatever data we can
      let data;
      try {
        data = JSON.parse(json);
      } catch {
        // Try to repair common JSON issues
        const repaired = json
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/\n/g, '')
          .replace(/\r/g, '');
        try {
          data = JSON.parse(repaired);
          console.log('[SaveSystem] Repaired corrupted JSON');
        } catch {
          console.error('[SaveSystem] Save unrecoverable, deleting');
          localStorage.removeItem(key);
          return null;
        }
      }

      const defaults = createDefaultSaveData();
      const recovered = { ...defaults, ...data };
      recovered.slot = slot;
      recovered.timestamp = Date.now();
      recovered._recovered = true;

      this._logOperation('load', slot, true, 'Recovered from corruption');
      return recovered;
    } catch (e) {
      console.error('[SaveSystem] Recovery failed:', e);
      return null;
    }
  }

  /**
   * Deletes a save from the specified slot.
   * @param {number} slot - Save slot to delete
   */
  deleteSave(slot) {
    if (!this.storageAvailable) return;

    try {
      const key = this._getKey(slot);
      localStorage.removeItem(key);
      this._logOperation('delete', slot, true);
      console.log(`[SaveSystem] Deleted save from slot ${slot}`);
    } catch (e) {
      console.error(`[SaveSystem] Failed to delete slot ${slot}:`, e);
    }
  }

  /**
   * Checks if a save exists in the specified slot.
   * @param {number} slot - Save slot to check
   * @returns {boolean} True if a save exists
   */
  hasSave(slot) {
    if (!this.storageAvailable) return false;

    try {
      const key = this._getKey(slot);
      const data = localStorage.getItem(key);
      return data !== null && data.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Gets information about a save without loading full data.
   * @param {number} slot - Save slot
   * @returns {SaveInfo} Save metadata
   */
  getSaveInfo(slot) {
    if (!this.storageAvailable || !this.hasSave(slot)) {
      return {
        exists: false,
        timestamp: null,
        playTime: null,
        completionPercent: null,
        currentBiome: null,
        playerHP: null
      };
    }

    try {
      const key = this._getKey(slot);
      const json = localStorage.getItem(key);
      if (!json) return { exists: false, timestamp: null, playTime: null, completionPercent: null, currentBiome: null, playerHP: null };

      const data = JSON.parse(json);

      // Calculate completion
      let completionPercent = 0;
      const factors = [];

      if (data.world && data.world.defeatedBosses) {
        factors.push((data.world.defeatedBosses.length / 6) * 30);
      }
      if (data.quests && data.quests.completed) {
        factors.push((data.quests.completed.length / 18) * 30);
      }
      if (data.fusion && data.fusion.discovered) {
        factors.push((data.fusion.discovered.length / 60) * 20);
      }
      if (data.world && data.world.clearedDungeons) {
        factors.push((data.world.clearedDungeons.length / 6) * 20);
      }

      completionPercent = Math.min(100, factors.reduce((a, b) => a + b, 0));

      return {
        exists: true,
        timestamp: data.timestamp || null,
        playTime: data.stats?.playTime || 0,
        completionPercent: Math.round(completionPercent),
        currentBiome: data.world?.currentBiome || 'FOREST',
        playerHP: data.player?.hp || null
      };
    } catch {
      return {
        exists: true,
        timestamp: null,
        playTime: null,
        completionPercent: null,
        currentBiome: null,
        playerHP: null
      };
    }
  }

  /**
   * Performs an auto-save to slot 99.
   * @returns {boolean} True if auto-save succeeded
   */
  autoSave() {
    if (!this.enableAutoSave) return false;

    const result = this.save(AUTO_SAVE_SLOT);
    if (result) {
      this.lastAutoSave = Date.now();
      console.log('[SaveSystem] Auto-saved successfully');
    }
    return result;
  }

  /**
   * Gets the timestamp of the last auto-save.
   * @returns {number} Timestamp or 0
   */
  getLastAutoSaveTime() {
    return this.lastAutoSave;
  }

  /**
   * Exports save data from a slot to a base64-encoded string.
   * @param {number} [slot=0] - Save slot to export
   * @returns {string|null} Base64 encoded save string, or null
   */
  exportToString(slot = 0) {
    const data = this.load(slot);
    if (!data) return null;

    try {
      const json = JSON.stringify(data);
      // Use a simple base64 encoding that works in all environments
      let encoded;
      if (typeof btoa === 'function') {
        encoded = btoa(json);
      } else {
        // Node.js fallback
        encoded = Buffer.from(json).toString('base64');
      }
      // Add a version header for future compatibility
      const exportStr = `EOTSv${SAVE_VERSION}:${encoded}`;
      console.log(`[SaveSystem] Exported slot ${slot} (${exportStr.length} chars)`);
      return exportStr;
    } catch (e) {
      console.error('[SaveSystem] Export failed:', e);
      return null;
    }
  }

  /**
   * Imports save data from a base64-encoded string.
   * @param {string} str - The encoded save string
   * @param {number} [targetSlot=0] - Slot to save into
   * @returns {boolean} True if import was successful
   */
  importFromString(str, targetSlot = 0) {
    if (!str || typeof str !== 'string') {
      console.error('[SaveSystem] Invalid import string');
      return false;
    }

    try {
      let encoded = str;

      // Check for version header
      if (str.startsWith('EOTSv')) {
        const colonIndex = str.indexOf(':');
        if (colonIndex === -1) {
          console.error('[SaveSystem] Invalid export format');
          return false;
        }
        const versionStr = str.substring(4, colonIndex);
        const version = parseInt(versionStr, 10);
        if (version > SAVE_VERSION) {
          console.error(`[SaveSystem] Save version ${version} newer than supported ${SAVE_VERSION}`);
          return false;
        }
        encoded = str.substring(colonIndex + 1);
      }

      // Decode
      let json;
      if (typeof atob === 'function') {
        json = atob(encoded);
      } else {
        json = Buffer.from(encoded, 'base64').toString('utf8');
      }

      const data = JSON.parse(json);

      // Validate
      const validation = this._validateSaveData(data);
      if (!validation.valid || !validation.data) {
        console.error('[SaveSystem] Imported save validation failed:', validation.errors);
        return false;
      }

      // Write to target slot
      const key = this._getKey(targetSlot);
      localStorage.setItem(key, JSON.stringify(validation.data));

      this._logOperation('import', targetSlot, true);
      console.log(`[SaveSystem] Imported save into slot ${targetSlot}`);

      return true;
    } catch (e) {
      console.error('[SaveSystem] Import failed:', e);
      return false;
    }
  }

  /**
   * Gets info for all 3 manual save slots.
   * @returns {SaveInfo[]} Array of save info for slots 0, 1, 2
   */
  getAllSaveInfo() {
    return [0, 1, 2].map(slot => this.getSaveInfo(slot));
  }

  /**
   * Deletes all saves including auto-save.
   */
  deleteAllSaves() {
    if (!this.storageAvailable) return;

    try {
      for (let slot = 0; slot <= 2; slot++) {
        localStorage.removeItem(this._getKey(slot));
      }
      localStorage.removeItem(this._getKey(AUTO_SAVE_SLOT));
      this._logOperation('deleteAll', -1, true);
      console.log('[SaveSystem] All saves deleted');
    } catch (e) {
      console.error('[SaveSystem] Failed to delete all saves:', e);
    }
  }

  /**
   * Updates play time tracking. Call regularly during gameplay.
   */
  updatePlayTime() {
    const now = Date.now();
    const delta = (now - this.lastPlayTimeUpdate) / 1000;
    this.playTimeAccumulator += delta;
    this.lastPlayTimeUpdate = now;
  }

  /**
   * Gets current accumulated play time.
   * @returns {number} Play time in seconds
   */
  getPlayTime() {
    return this.playTimeAccumulator;
  }

  /**
   * Formats play time as a human-readable string.
   * @param {number} [seconds] - Seconds to format (uses accumulated if omitted)
   * @returns {string} Formatted time string (e.g., "2:34:56")
   */
  formatPlayTime(seconds) {
    const totalSeconds = seconds !== undefined ? seconds : this.playTimeAccumulator;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Logs a save operation for debugging.
   * @param {string} operation - Operation name
   * @param {number} slot - Affected slot
   * @param {boolean} success - Whether operation succeeded
   * @param {string} [detail] - Additional detail
   * @private
   */
  _logOperation(operation, slot, success, detail = '') {
    this.operationLog.push({
      operation,
      slot,
      success,
      detail,
      timestamp: Date.now()
    });

    // Keep log size manageable
    if (this.operationLog.length > 100) {
      this.operationLog = this.operationLog.slice(-50);
    }
  }

  /**
   * Gets the operation log for debugging.
   * @returns {Array<Object>} Operation log entries
   */
  getOperationLog() {
    return [...this.operationLog];
  }

  /**
   * Emits a system notification.
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   * @private
   */
  _emitNotification(message, type = 'info') {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:notification', { message, type });
    }
  }

  /**
   * Destroys the save system and cleans up timers.
   */
  destroy() {
    this._stopAutoSave();
    this.game = null;
    this.itemSystem = null;
    this.questSystem = null;
    this.fusionSystem = null;
  }
}

window.SaveSystem = SaveSystem;
