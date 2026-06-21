/**
 * @file QuestSystem.js
 * @description Manages 18 side quests across 6 biomes. Each biome has 3 quests
 * of various types (find, collect, escort, explore, rescue, race, kill). Quests
 * have world-state consequences on completion — NPCs move, new areas open,
 * enemy behaviors change, and environmental shifts occur.
 */

/** @typedef {Object} QuestDefinition
 * @property {string} id - Unique quest identifier
 * @property {string} name - Display name of the quest
 * @property {string} biome - Biome where quest takes place
 * @property {string} type - Quest type: find, collect, escort, explore, rescue, race, kill
 * @property {string} target - Target entity/objective identifier
 * @property {number} [count] - Required count for collect/kill quests
 * @property {number} [timeLimit] - Time limit in seconds for race quests
 * @property {string} reward - Reward identifier
 * @property {string} giver - Name of the NPC who gives the quest
 * @property {string} description - Detailed quest description
 * @property {string[]} prerequisites - IDs of quests that must be completed first
 * @property {boolean} hidden - Whether quest is hidden until prerequisites met
 */

/** @typedef {Object} QuestState
 * @property {string} status - Current status: inactive, active, completed, failed
 * @property {number} progress - Current progress toward objective
 * @property {number} progressMax - Maximum progress needed
 * @property {number} startedAt - Timestamp when quest became active
 * @property {number} completedAt - Timestamp when quest was completed
 * @property {Object} metadata - Additional quest-specific data
 */

/** @typedef {Object} WorldConsequence
 * @property {string} type - Consequence type: npc_move, area_unlock, enemy_change, weather_change, item_spawn, bridge_build
 * @property {Object} data - Consequence-specific data
 * @property {string} description - Human-readable description of the change
 */

/**
 * The 18 side quests — 3 per biome across 6 biomes.
 * @constant {QuestDefinition[]}
 */
const QUESTS = [
  // ============ FOREST QUESTS (3) ============
  {
    id: 'lost_kitten',
    name: 'Lost in the Canopy',
    biome: 'FOREST',
    type: 'find',
    target: 'kitten',
    reward: 'relic_leaf',
    giver: 'Elder Mira',
    description: 'A child\'s beloved kitten has wandered into the deep forest. Find the kitten and return it safely to Elder Mira in the village.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'kitten', from: 'deep_forest', to: 'village' }, description: 'The kitten returns to the village with its owner.' },
      { type: 'item_spawn', data: { item: 'relic_leaf', location: 'village_mira' }, description: 'Elder Mira rewards you with a Leaf Relic.' }
    ]
  },
  {
    id: 'herb_gather',
    name: 'Healer\'s Request',
    biome: 'FOREST',
    type: 'collect',
    target: 'rare_herb',
    count: 5,
    reward: 'hp_upgrade',
    giver: 'Healer Toma',
    description: 'The village healer needs rare herbs from the forest undergrowth to treat a spreading illness. Gather 5 Moonpetal herbs.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'enemy_change', data: { biome: 'FOREST', change: 'reduce_hostility' }, description: 'Forest creatures become less aggressive near the village.' },
      { type: 'item_spawn', data: { item: 'hp_upgrade', location: 'healer_hut' }, description: 'Healer Toma grants you a vitality blessing, increasing max HP.' }
    ]
  },
  {
    id: 'ancient_ruin',
    name: 'Whispers of the Past',
    biome: 'FOREST',
    type: 'explore',
    target: 'hidden_ruin',
    reward: 'lore_fragment_1',
    giver: 'Scholar Aldric',
    description: 'Ancient ruins are said to lie hidden beneath the forest\'s oldest tree. Explore the hidden ruin and uncover its secrets.',
    prerequisites: ['lost_kitten'],
    hidden: true,
    consequences: [
      { type: 'area_unlock', data: { area: 'ruin_depths', requirement: 'none' }, description: 'The hidden ruin is now accessible, revealing its ancient chambers.' },
      { type: 'item_spawn', data: { item: 'lore_fragment_1', location: 'ruin_altar' }, description: 'You find an ancient lore fragment on the ruin altar.' }
    ]
  },

  // ============ DESERT QUESTS (3) ============
  {
    id: 'water_ration',
    name: 'Dying of Thirst',
    biome: 'DESERT',
    type: 'collect',
    target: 'water_crystal',
    count: 3,
    reward: 'relic_sand',
    giver: 'Caravan Leader Kade',
    description: 'A stranded desert caravan is running out of water. Collect 3 Water Crystals from the oasis pools to save them.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'caravan', from: 'desert_stuck', to: 'oasis_camp' }, description: 'The caravan reaches the oasis and sets up a permanent camp.' },
      { type: 'item_spawn', data: { item: 'relic_sand', location: 'oasis_camp' }, description: 'Caravan Leader Kade gives you a Sand Relic as thanks.' }
    ]
  },
  {
    id: 'merchant_escort',
    name: 'Caravan Guard',
    biome: 'DESERT',
    type: 'escort',
    target: 'merchant',
    reward: 'gold_pouch',
    giver: 'Merchant Zafir',
    description: 'Escort the merchant Zafir safely through the treacherous desert pass to the trade outpost. Protect him from bandits and sand beasts.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'zafir', from: 'desert_pass', to: 'trade_outpost' }, description: 'Merchant Zafir opens a permanent shop at the trade outpost.' },
      { type: 'area_unlock', data: { area: 'trade_outpost_shop', requirement: 'none' }, description: 'The trade outpost shop is now open for business.' }
    ]
  },
  {
    id: 'sunken_city',
    name: 'City Beneath Sands',
    biome: 'DESERT',
    type: 'explore',
    target: 'sunken_city',
    reward: 'lore_fragment_2',
    giver: 'Archaeologist Nessa',
    description: 'Legends speak of a grand city buried beneath the desert dunes. Find the entrance and explore the sunken city.',
    prerequisites: ['water_ration'],
    hidden: true,
    consequences: [
      { type: 'area_unlock', data: { area: 'sunken_city_districts', requirement: 'none' }, description: 'The sunken city districts are now fully explorable.' },
      { type: 'weather_change', data: { biome: 'DESERT', weather: 'clear_sky' }, description: 'Clear skies settle over the desert, making travel easier.' }
    ]
  },

  // ============ MOUNTAIN QUESTS (3) ============
  {
    id: 'climber_rescue',
    name: 'Alpine Rescue',
    biome: 'MOUNTAIN',
    type: 'rescue',
    target: 'climber',
    reward: 'relic_stone',
    giver: 'Sherpa Torin',
    description: 'A fellow climber is trapped in an avalanche zone high on the mountain. Navigate the treacherous terrain and rescue them.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'rescued_climber', from: 'avalanche_zone', to: 'base_camp' }, description: 'The rescued climber recovers at base camp.' },
      { type: 'bridge_build', data: { from: 'lower_pass', to: 'mid_peak' }, description: 'Grateful climbers have built a rope bridge to the mid peak.' },
      { type: 'item_spawn', data: { item: 'relic_stone', location: 'base_camp' }, description: 'Sherpa Torin gives you a Stone Relic as a token of gratitude.' }
    ]
  },
  {
    id: 'goat_roundup',
    name: 'Mountain Goats',
    biome: 'MOUNTAIN',
    type: 'collect',
    target: 'goat',
    count: 4,
    reward: 'jump_upgrade',
    giver: 'Herder Ylva',
    description: 'Mountain goats have scattered across the peaks after a storm. Find and guide 4 goats back to Herder Ylva\'s pen.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'enemy_change', data: { biome: 'MOUNTAIN', change: 'goat_companion' }, description: 'The goats now graze peacefully, no longer blocking paths.' },
      { type: 'item_spawn', data: { item: 'jump_upgrade', location: 'herder_pen' }, description: 'Herder Ylva teaches you goat-climbing techniques, improving your jump.' }
    ]
  },
  {
    id: 'eagle_nest',
    name: 'Nest of the Sky King',
    biome: 'MOUNTAIN',
    type: 'explore',
    target: 'eagle_nest',
    reward: 'lore_fragment_3',
    giver: 'Ornithologist Perrin',
    description: 'The legendary Sky King eagle\'s nest is said to be on the highest inaccessible peak. Find a way to reach it.',
    prerequisites: ['climber_rescue'],
    hidden: true,
    consequences: [
      { type: 'area_unlock', data: { area: 'sky_king_peak', requirement: 'shrink' }, description: 'A hidden path to the Sky King peak is revealed.' },
      { type: 'npc_move', data: { npc: 'perrin', from: 'base_camp', to: 'sky_king_peak' }, description: 'Ornithologist Perrin moves to study the eagle nest up close.' }
    ]
  },

  // ============ SWAMP QUESTS (3) ============
  {
    id: 'fog_guide',
    name: 'Through the Mist',
    biome: 'SWAMP',
    type: 'escort',
    target: 'lost_traveler',
    reward: 'relic_muck',
    giver: 'Ferryman Grist',
    description: 'A lost traveler is wandering in the poisonous fog. Guide them safely through the swamp to Ferryman Grist\'s dock.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'lost_traveler', from: 'fog_depths', to: 'grist_dock' }, description: 'The traveler boards the ferry and escapes the swamp.' },
      { type: 'enemy_change', data: { biome: 'SWAMP', change: 'fog_creatures_calm' }, description: 'The fog creatures become less aggressive near the dock.' },
      { type: 'item_spawn', data: { item: 'relic_muck', location: 'grist_dock' }, description: 'Ferryman Grist rewards you with a Muck Relic.' }
    ]
  },
  {
    id: 'lily_pad_race',
    name: 'Swamp Sprint',
    biome: 'SWAMP',
    type: 'race',
    target: 'race_endpoint',
    timeLimit: 60,
    reward: 'speed_upgrade',
    giver: 'Champion Boggs',
    description: 'Race across the treacherous lily pad path through the swamp. Reach the end within 60 seconds without falling into the murk!',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'area_unlock', data: { area: 'lily_pad_shortcut', requirement: 'none' }, description: 'A shortcut through the swamp is now available.' },
      { type: 'item_spawn', data: { item: 'speed_upgrade', location: 'race_finish' }, description: 'Champion Boggs shares his sprinting technique, boosting your speed.' }
    ]
  },
  {
    id: 'witch_herbs',
    name: 'The Hag\'s Bargain',
    biome: 'SWAMP',
    type: 'collect',
    target: 'witch_herb',
    count: 7,
    reward: 'lore_fragment_4',
    giver: 'Swamp Witch Morwen',
    description: 'The Swamp Witch needs 7 rare herbs for a powerful ritual. Gather them from the most dangerous parts of the swamp.',
    prerequisites: ['fog_guide'],
    hidden: true,
    consequences: [
      { type: 'npc_move', data: { npc: 'morwen', from: 'swamp_edge', to: 'swamp_center' }, description: 'Swamp Witch Morwen moves to the swamp center to perform her ritual.' },
      { type: 'weather_change', data: { biome: 'SWAMP', weather: 'clearing' }, description: 'The swamp fog clears slightly, making navigation easier.' },
      { type: 'item_spawn', data: { item: 'lore_fragment_4', location: 'morwen_hut' }, description: 'The witch reveals a lore fragment as part of your reward.' }
    ]
  },

  // ============ ICE QUESTS (3) ============
  {
    id: 'frozen_explorer',
    name: 'Icebound',
    biome: 'ICE',
    type: 'rescue',
    target: 'frozen_explorer',
    reward: 'relic_ice',
    giver: 'Expedition Chief Ivar',
    description: 'An explorer is trapped in a frozen cavern after an ice collapse. Melt the ice and rescue them before it\'s too late.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'frozen_explorer', from: 'ice_cavern', to: 'expedition_camp' }, description: 'The rescued explorer returns to the expedition camp.' },
      { type: 'area_unlock', data: { area: 'ice_cavern_depths', requirement: 'ember_crown' }, description: 'The ice cavern depths are now accessible.' },
      { type: 'item_spawn', data: { item: 'relic_ice', location: 'expedition_camp' }, description: 'Expedition Chief Ivar awards you an Ice Relic.' }
    ]
  },
  {
    id: 'ice_sculpture',
    name: 'Frozen Art',
    biome: 'ICE',
    type: 'collect',
    target: 'ice_crystal',
    count: 6,
    reward: 'parry_upgrade',
    giver: 'Ice Sculptor Glacis',
    description: 'The Ice Sculptor needs pristine ice crystals to complete a masterpiece. Collect 6 perfect ice crystals from the glacier.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'glacis', from: 'ice_village', to: 'glacier_base' }, description: 'Glacis begins sculpting at the glacier base.' },
      { type: 'area_unlock', data: { area: 'sculptor_gallery', requirement: 'none' }, description: 'Glacis opens a gallery showcasing her ice sculptures.' },
      { type: 'item_spawn', data: { item: 'parry_upgrade', location: 'sculptor_gallery' }, description: 'Glacis teaches you the art of ice-parrying.' }
    ]
  },
  {
    id: 'aurora_watcher',
    name: 'Chasing Lights',
    biome: 'ICE',
    type: 'explore',
    target: 'aurora_peak',
    reward: 'lore_fragment_5',
    giver: 'Aurora Seeker Lys',
    description: 'The aurora borealis holds ancient secrets. Reach Aurora Peak at the right time to witness and record the phenomenon.',
    prerequisites: ['frozen_explorer'],
    hidden: true,
    consequences: [
      { type: 'area_unlock', data: { area: 'aurora_peak_summit', requirement: 'none' }, description: 'Aurora Peak summit becomes a fast-travel point.' },
      { type: 'weather_change', data: { biome: 'ICE', weather: 'aurora' }, description: 'The aurora becomes a permanent feature of the ice biome sky.' },
      { type: 'item_spawn', data: { item: 'lore_fragment_5', location: 'aurora_peak' }, description: 'You record the aurora\'s secrets in a lore fragment.' }
    ]
  },

  // ============ VOLCANO QUESTS (3) ============
  {
    id: 'lava_fishing',
    name: 'What Lurks Below',
    biome: 'VOLCANO',
    type: 'collect',
    target: 'fire_fish',
    count: 3,
    reward: 'relic_ember',
    giver: 'Lava Fisher Brant',
    description: 'Fire-resistant fish swim in the lava pools. Catch 3 of these rare creatures for Lava Fisher Brant\'s research.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'npc_move', data: { npc: 'brant', from: 'lava_pool_edge', to: 'volcano_village' }, description: 'Brant returns to the village with his specimens.' },
      { type: 'enemy_change', data: { biome: 'VOLCANO', change: 'lava_beasts_tame' }, description: 'Lava beasts in the area become less hostile.' },
      { type: 'item_spawn', data: { item: 'relic_ember', location: 'volcano_village' }, description: 'Brant gives you an Ember Relic for your efforts.' }
    ]
  },
  {
    id: 'demon_hunter',
    name: 'Cleansing Fire',
    biome: 'VOLCANO',
    type: 'kill',
    target: 'demon',
    count: 10,
    reward: 'damage_upgrade',
    giver: 'Paladin Seraph',
    description: 'Demons are infesting the volcano slopes. Slay 10 demons to cleanse the area and protect the nearby settlement.',
    prerequisites: [],
    hidden: false,
    consequences: [
      { type: 'enemy_change', data: { biome: 'VOLCANO', change: 'demon_spawn_reduce' }, description: 'Demon presence in the area is greatly reduced.' },
      { type: 'area_unlock', data: { area: 'volcano_shrine', requirement: 'none' }, description: 'The volcano shrine becomes a safe zone.' },
      { type: 'item_spawn', data: { item: 'damage_upgrade', location: 'volcano_shrine' }, description: 'Paladin Seraph blesses your weapon, increasing damage.' }
    ]
  },
  {
    id: 'volcano_summit',
    name: 'Heart of the Mountain',
    biome: 'VOLCANO',
    type: 'explore',
    target: 'volcano_heart',
    reward: 'lore_fragment_6',
    giver: 'Fire Sage Ignis',
    description: 'The very heart of the volcano holds the final piece of the puzzle. Reach the inner chamber to discover the truth.',
    prerequisites: ['lava_fishing', 'demon_hunter'],
    hidden: true,
    consequences: [
      { type: 'area_unlock', data: { area: 'volcano_core_chamber', requirement: 'none' }, description: 'The volcano core chamber opens, revealing ancient secrets.' },
      { type: 'weather_change', data: { biome: 'VOLCANO', weather: 'calm' }, description: 'The volcano\'s eruptions calm, making the area safer.' },
      { type: 'item_spawn', data: { item: 'lore_fragment_6', location: 'volcano_heart' }, description: 'At the volcano\'s heart, you find the final lore fragment.' }
    ]
  }
];

/**
 * Maps quest type to display name.
 * @constant {Object.<string, string>}
 */
const QUEST_TYPE_NAMES = {
  find: 'Find',
  collect: 'Collect',
  escort: 'Escort',
  explore: 'Explore',
  rescue: 'Rescue',
  race: 'Race',
  kill: 'Defeat'
};

/**
 * Maps biome to display color.
 * @constant {Object.<string, string>}
 */
const BIOME_COLORS = {
  FOREST: '#4caf50',
  DESERT: '#ff9800',
  MOUNTAIN: '#9e9e9e',
  SWAMP: '#795548',
  ICE: '#00bcd4',
  VOLCANO: '#f44336'
};

/**
 * Manages quest lifecycle, tracking, completion, and world consequences.
 * @class QuestSystem
 */
class QuestSystem {
  /**
   * Creates a new QuestSystem.
   * @param {Object} [options={}] - Configuration options
   */
  constructor(options = {}) {
    /** @type {Map<string, QuestState>} Map of quest ID to quest state */
    this.questStates = new Map();

    /** @type {Set<string>} Set of completed quest IDs */
    this.completedQuests = new Set();

    /** @type {Set<string>} Set of failed quest IDs */
    this.failedQuests = new Set();

    /** @type {Array<Object>} Active world consequences */
    this.activeConsequences = [];

    /** @type {Array<Object>} Pending notifications */
    this.pendingNotifications = [];

    /** @type {number} Timer for update logic */
    this.updateTimer = 0;

    /** @type {number} Total quests completed count */
    this.totalCompleted = 0;

    /** @type {number} Total quests failed count */
    this.totalFailed = 0;

    /** @type {Function|null} Callback when quest state changes */
    this.onQuestChange = options.onQuestChange || null;

    /** @type {Function|null} Callback when world consequence triggers */
    this.onConsequence = options.onConsequence || null;

    // Initialize all quest states as inactive
    this._initializeQuestStates();
    this._bindEvents();
  }

  /**
   * Initialize quest state entries for all defined quests.
   * @private
   */
  _initializeQuestStates() {
    for (const quest of QUESTS) {
      this.questStates.set(quest.id, {
        status: 'inactive',
        progress: 0,
        progressMax: quest.count || 1,
        startedAt: 0,
        completedAt: 0,
        metadata: {}
      });
    }
  }

  /**
   * Bind to global event bus.
   * @private
   */
  _bindEvents() {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.on('quest:start', (data) => {
        this.startQuest(data.questId);
      });

      window.GameEvents.on('quest:update', (data) => {
        this.updateQuest(data.questId, data.objective, data.progress);
      });

      window.GameEvents.on('quest:complete', (data) => {
        this.completeQuest(data.questId);
      });
    }
  }

  /**
   * Starts a quest, changing its state from inactive to active.
   * @param {string} questId - The quest ID to start
   * @returns {boolean} True if the quest was started
   */
  startQuest(questId) {
    const questDef = QUESTS.find(q => q.id === questId);
    if (!questDef) {
      console.warn(`[QuestSystem] Unknown quest ID: ${questId}`);
      return false;
    }

    const state = this.questStates.get(questId);
    if (!state || state.status !== 'inactive') {
      console.warn(`[QuestSystem] Quest ${questId} cannot be started (status: ${state?.status})`);
      return false;
    }

    // Check prerequisites
    for (const prereqId of questDef.prerequisites) {
      if (!this.completedQuests.has(prereqId)) {
        console.warn(`[QuestSystem] Quest ${questId} prerequisite not met: ${prereqId}`);
        return false;
      }
    }

    // Activate the quest
    state.status = 'active';
    state.progress = 0;
    state.progressMax = questDef.count || 1;
    state.startedAt = Date.now();
    state.metadata = {};

    // Special setup based on quest type
    if (questDef.type === 'race') {
      state.metadata.elapsedTime = 0;
      state.metadata.timeLimit = questDef.timeLimit || 60;
    }
    if (questDef.type === 'escort') {
      state.metadata.escortHealth = 100;
      state.metadata.escortDistance = 0;
    }

    this._emitNotification(`Quest Started: ${questDef.name}`, 'info');
    this._emitEvent('quest:started', { questId, quest: questDef });
    this._triggerChangeCallback();

    console.log(`[QuestSystem] Started quest: ${questDef.name}`);
    return true;
  }

  /**
   * Updates quest progress toward its objective.
   * @param {string} questId - The quest ID
   * @param {string} objective - The objective being progressed
   * @param {number} [amount=1] - Amount of progress to add
   * @returns {boolean} True if progress was updated
   */
  updateQuest(questId, objective, amount = 1) {
    const questDef = QUESTS.find(q => q.id === questId);
    if (!questDef) {
      console.warn(`[QuestSystem] Unknown quest ID: ${questId}`);
      return false;
    }

    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') {
      return false;
    }

    // Validate objective matches quest target
    if (objective && objective !== questDef.target) {
      return false;
    }

    // Update progress
    state.progress = Math.min(state.progress + amount, state.progressMax);

    // Emit progress event
    this._emitEvent('quest:progress', {
      questId,
      quest: questDef,
      progress: state.progress,
      progressMax: state.progressMax,
      percent: (state.progress / state.progressMax) * 100
    });

    // Check for completion
    if (state.progress >= state.progressMax) {
      this.completeQuest(questId);
    }

    this._triggerChangeCallback();
    return true;
  }

  /**
   * Advances a quest by incrementing progress by 1.
   * @param {string} questId - The quest ID
   * @returns {boolean} True if progress was incremented
   */
  incrementQuest(questId) {
    return this.updateQuest(questId, null, 1);
  }

  /**
   * Updates time-based quest data (for race quests).
   * @param {string} questId - The quest ID
   * @param {number} dt - Delta time in seconds
   * @returns {boolean} True if the quest is still active
   */
  updateQuestTimer(questId, dt) {
    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') return false;

    const questDef = QUESTS.find(q => q.id === questId);
    if (!questDef) return false;

    if (questDef.type === 'race' && state.metadata) {
      state.metadata.elapsedTime = (state.metadata.elapsedTime || 0) + dt;

      // Check time limit
      if (state.metadata.elapsedTime >= (questDef.timeLimit || 60)) {
        this.failQuest(questId);
        return false;
      }
    }

    return true;
  }

  /**
   * Completes a quest, granting rewards and triggering world consequences.
   * @param {string} questId - The quest ID to complete
   * @returns {boolean} True if the quest was completed
   */
  completeQuest(questId) {
    const questDef = QUESTS.find(q => q.id === questId);
    if (!questDef) {
      console.warn(`[QuestSystem] Unknown quest ID: ${questId}`);
      return false;
    }

    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') {
      return false;
    }

    // Mark as completed
    state.status = 'completed';
    state.completedAt = Date.now();
    state.progress = state.progressMax;

    this.completedQuests.add(questId);
    this.totalCompleted++;

    // Grant reward
    const reward = this._grantReward(questDef.reward);

    // Apply world consequences
    const consequences = this._applyConsequences(questDef);

    // Emit events
    this._emitNotification(`Quest Complete: ${questDef.name}!`, 'success');
    this._emitEvent('quest:completed', {
      questId,
      quest: questDef,
      reward,
      consequences
    });

    this._triggerChangeCallback();

    console.log(`[QuestSystem] Completed quest: ${questDef.name} - Reward: ${questDef.reward}`);
    return true;
  }

  /**
   * Fails a quest (e.g., time limit exceeded, escort died).
   * @param {string} questId - The quest ID to fail
   * @returns {boolean} True if the quest was failed
   */
  failQuest(questId) {
    const questDef = QUESTS.find(q => q.id === questId);
    if (!questDef) return false;

    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') return false;

    state.status = 'failed';
    this.failedQuests.add(questId);
    this.totalFailed++;

    this._emitNotification(`Quest Failed: ${questDef.name}`, 'warning');
    this._emitEvent('quest:failed', { questId, quest: questDef });
    this._triggerChangeCallback();

    console.log(`[QuestSystem] Failed quest: ${questDef.name}`);
    return true;
  }

  /**
   * Abandons an active quest, returning it to inactive state.
   * @param {string} questId - The quest ID to abandon
   * @returns {boolean} True if the quest was abandoned
   */
  abandonQuest(questId) {
    const questDef = QUESTS.find(q => q.id === questId);
    if (!questDef) return false;

    const state = this.questStates.get(questId);
    if (!state || state.status !== 'active') return false;

    state.status = 'inactive';
    state.progress = 0;
    state.metadata = {};

    this._emitNotification(`Quest Abandoned: ${questDef.name}`, 'info');
    this._triggerChangeCallback();

    return true;
  }

  /**
   * Resets a quest to its initial inactive state.
   * @param {string} questId - The quest ID to reset
   * @returns {boolean} True if the quest was reset
   */
  resetQuest(questId) {
    const questDef = QUESTS.find(q => q.id === questId);
    if (!questDef) return false;

    this.questStates.set(questId, {
      status: 'inactive',
      progress: 0,
      progressMax: questDef.count || 1,
      startedAt: 0,
      completedAt: 0,
      metadata: {}
    });

    this.completedQuests.delete(questId);
    this.failedQuests.delete(questId);

    this._triggerChangeCallback();
    return true;
  }

  /**
   * Gets all quests available in a specific biome.
   * Only returns non-hidden quests or those whose prerequisites are met.
   * @param {string} biome - The biome to filter by
   * @returns {QuestDefinition[]} Array of available quest definitions
   */
  getAvailableQuests(biome) {
    return QUESTS.filter(quest => {
      // Must match biome
      if (quest.biome !== biome) return false;

      // Must not be already active or completed
      const state = this.questStates.get(quest.id);
      if (!state || state.status === 'active' || state.status === 'completed') return false;

      // Check if hidden quest prerequisites are met
      if (quest.hidden) {
        for (const prereq of quest.prerequisites) {
          if (!this.completedQuests.has(prereq)) return false;
        }
      }

      return true;
    });
  }

  /**
   * Gets all currently active quests.
   * @returns {Array<{quest: QuestDefinition, state: QuestState}>} Active quests with state
   */
  getActiveQuests() {
    const active = [];
    for (const quest of QUESTS) {
      const state = this.questStates.get(quest.id);
      if (state && state.status === 'active') {
        active.push({ quest, state });
      }
    }
    return active;
  }

  /**
   * Gets all completed quests.
   * @returns {Array<{quest: QuestDefinition, state: QuestState}>} Completed quests
   */
  getCompletedQuests() {
    const completed = [];
    for (const questId of this.completedQuests) {
      const quest = QUESTS.find(q => q.id === questId);
      const state = this.questStates.get(questId);
      if (quest && state) {
        completed.push({ quest, state });
      }
    }
    return completed;
  }

  /**
   * Gets a specific quest's current state.
   * @param {string} questId - The quest ID
   * @returns {{quest: QuestDefinition, state: QuestState}|null} Quest info or null
   */
  getQuestState(questId) {
    const quest = QUESTS.find(q => q.id === questId);
    const state = this.questStates.get(questId);
    if (!quest || !state) return null;
    return { quest, state };
  }

  /**
   * Checks if a quest is currently active.
   * @param {string} questId - The quest ID
   * @returns {boolean} True if quest is active
   */
  isQuestActive(questId) {
    const state = this.questStates.get(questId);
    return state ? state.status === 'active' : false;
  }

  /**
   * Checks if a quest is completed.
   * @param {string} questId - The quest ID
   * @returns {boolean} True if quest is completed
   */
  isQuestCompleted(questId) {
    return this.completedQuests.has(questId);
  }

  /**
   * Gets all quests organized by biome.
   * @returns {Object.<string, QuestDefinition[]>} Biome-name to quests mapping
   */
  getQuestsByBiome() {
    const byBiome = {};
    for (const quest of QUESTS) {
      if (!byBiome[quest.biome]) byBiome[quest.biome] = [];
      byBiome[quest.biome].push(quest);
    }
    return byBiome;
  }

  /**
   * Gets progress statistics across all quests.
   * @returns {Object} Progress statistics
   */
  getProgressStats() {
    const total = QUESTS.length;
    const completed = this.completedQuests.size;
    const active = this.getActiveQuests().length;
    const failed = this.failedQuests.size;
    const inactive = total - completed - active - failed;

    return {
      total,
      completed,
      active,
      failed,
      inactive,
      percentComplete: total > 0 ? (completed / total) * 100 : 0,
      percentActive: total > 0 ? (active / total) * 100 : 0
    };
  }

  /**
   * Checks if all quests are completed.
   * @returns {boolean} True if all quests are done
   */
  areAllQuestsComplete() {
    return this.completedQuests.size === QUESTS.length;
  }

  /**
   * Grants a quest reward.
   * @param {string} rewardId - The reward identifier
   * @returns {Object} Reward details
   * @private
   */
  _grantReward(rewardId) {
    const rewardMap = {
      relic_leaf: { type: 'relic', id: 'leaf', name: 'Leaf Relic' },
      relic_sand: { type: 'relic', id: 'sand', name: 'Sand Relic' },
      relic_stone: { type: 'relic', id: 'stone', name: 'Stone Relic' },
      relic_muck: { type: 'relic', id: 'muck', name: 'Muck Relic' },
      relic_ice: { type: 'relic', id: 'ice', name: 'Ice Relic' },
      relic_ember: { type: 'relic', id: 'ember', name: 'Ember Relic' },
      hp_upgrade: { type: 'upgrade', stat: 'maxHP', value: 20, name: 'Vitality Blessing' },
      jump_upgrade: { type: 'upgrade', stat: 'jumpForce', value: 30, name: 'Mountain Climbing' },
      speed_upgrade: { type: 'upgrade', stat: 'speed', value: 20, name: 'Sprint Technique' },
      parry_upgrade: { type: 'upgrade', stat: 'parryWindow', value: 0.1, name: 'Ice Parry' },
      damage_upgrade: { type: 'upgrade', stat: 'baseDamage', value: 5, name: 'Weapon Blessing' },
      gold_pouch: { type: 'gold', amount: 100, name: 'Gold Pouch' },
      lore_fragment_1: { type: 'lore', id: 'fragment_1', name: 'Lore Fragment I' },
      lore_fragment_2: { type: 'lore', id: 'fragment_2', name: 'Lore Fragment II' },
      lore_fragment_3: { type: 'lore', id: 'fragment_3', name: 'Lore Fragment III' },
      lore_fragment_4: { type: 'lore', id: 'fragment_4', name: 'Lore Fragment IV' },
      lore_fragment_5: { type: 'lore', id: 'fragment_5', name: 'Lore Fragment V' },
      lore_fragment_6: { type: 'lore', id: 'fragment_6', name: 'Lore Fragment VI' }
    };

    const reward = rewardMap[rewardId] || { type: 'unknown', id: rewardId };

    // Emit reward event
    this._emitEvent('quest:reward', { rewardId, reward });

    return reward;
  }

  /**
   * Applies world consequences when a quest is completed.
   * @param {QuestDefinition} questDef - The completed quest
   * @returns {WorldConsequence[]} Applied consequences
   * @private
   */
  _applyConsequences(questDef) {
    const applied = [];

    if (!questDef.consequences) return applied;

    for (const consequence of questDef.consequences) {
      // Store as active consequence
      this.activeConsequences.push({
        ...consequence,
        triggeredBy: questDef.id,
        triggeredAt: Date.now()
      });

      applied.push(consequence);

      // Emit consequence event
      if (this.onConsequence) {
        this.onConsequence(consequence, questDef);
      }

      this._emitEvent('world:consequence', {
        questId: questDef.id,
        consequence
      });
    }

    return applied;
  }

  /**
   * Gets all active world consequences.
   * @returns {WorldConsequence[]} Array of active consequences
   */
  getActiveConsequences() {
    return [...this.activeConsequences];
  }

  /**
   * Checks if a specific consequence type is active.
   * @param {string} type - Consequence type to check
   * @returns {boolean} True if any consequence of that type is active
   */
  hasConsequenceType(type) {
    return this.activeConsequences.some(c => c.type === type);
  }

  /**
   * Removes a consequence from the active list.
   * @param {number} index - Index in activeConsequences
   */
  removeConsequence(index) {
    if (index >= 0 && index < this.activeConsequences.length) {
      this.activeConsequences.splice(index, 1);
    }
  }

  /**
   * Gets a human-readable progress description for a quest.
   * @param {string} questId - The quest ID
   * @returns {string} Progress description
   */
  getProgressText(questId) {
    const info = this.getQuestState(questId);
    if (!info) return '';

    const { quest, state } = info;

    switch (state.status) {
      case 'inactive':
        return 'Not started';
      case 'active':
        if (quest.type === 'collect' || quest.type === 'kill') {
          return `${state.progress} / ${state.progressMax} ${quest.target.replace(/_/g, ' ')}`;
        }
        if (quest.type === 'race') {
          const elapsed = state.metadata?.elapsedTime || 0;
          const remaining = Math.max(0, (quest.timeLimit || 60) - elapsed);
          return `Time remaining: ${Math.ceil(remaining)}s`;
        }
        if (quest.type === 'escort') {
          const health = state.metadata?.escortHealth || 0;
          return `Escort health: ${health}%`;
        }
        return 'In progress...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Renders a quest log UI to the given canvas context.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   * @param {number} options.x - Panel X position
   * @param {number} options.y - Panel Y position
   * @param {number} options.width - Panel width
   * @param {number} options.height - Panel height
   * @param {string} [options.filter] - Filter by status: 'all', 'active', 'completed'
   * @param {string} [options.hoveredQuestId] - Currently hovered quest
   */
  renderQuestLog(ctx, options) {
    const {
      x, y, width, height,
      filter = 'all',
      hoveredQuestId = null
    } = options;

    ctx.save();

    // Panel background
    ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, width, height, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Quest Log', x + 16, y + 30);

    // Stats bar
    const stats = this.getProgressStats();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${stats.completed}/${stats.total} Complete | ${stats.active} Active`, x + 16, y + 52);

    // Progress bar
    const barWidth = width - 32;
    const barHeight = 6;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this._roundRect(ctx, x + 16, y + 60, barWidth, barHeight, 3);
    ctx.fill();
    if (stats.percentComplete > 0) {
      ctx.fillStyle = '#4caf50';
      this._roundRect(ctx, x + 16, y + 60, barWidth * (stats.percentComplete / 100), barHeight, 3);
      ctx.fill();
    }

    // Quest list
    let filteredQuests = QUESTS;
    if (filter === 'active') {
      filteredQuests = QUESTS.filter(q => this.isQuestActive(q.id));
    } else if (filter === 'completed') {
      filteredQuests = QUESTS.filter(q => this.isQuestCompleted(q.id));
    }

    const listStartY = y + 82;
    const itemHeight = 56;
    const maxVisible = Math.floor((height - 90) / itemHeight);

    for (let i = 0; i < Math.min(filteredQuests.length, maxVisible); i++) {
      const quest = filteredQuests[i];
      const state = this.questStates.get(quest.id);
      const itemY = listStartY + i * itemHeight;
      const isHovered = hoveredQuestId === quest.id;

      // Item background
      if (isHovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this._roundRect(ctx, x + 8, itemY, width - 16, itemHeight - 4, 4);
        ctx.fill();
      }

      // Biome color indicator
      const biomeColor = BIOME_COLORS[quest.biome] || '#ffffff';
      ctx.fillStyle = biomeColor;
      ctx.fillRect(x + 12, itemY + 6, 4, itemHeight - 16);

      // Quest name
      ctx.fillStyle = state.status === 'completed' ? '#7cb342' :
                      state.status === 'active' ? '#e2e8f0' :
                      state.status === 'failed' ? '#ef5350' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = state.status === 'active' ? 'bold 14px sans-serif' : '14px sans-serif';
      ctx.fillText(quest.name, x + 24, itemY + 20);

      // Quest type and giver
      ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
      ctx.font = '11px sans-serif';
      const typeName = QUEST_TYPE_NAMES[quest.type] || quest.type;
      ctx.fillText(`${typeName} - ${quest.giver}`, x + 24, itemY + 36);

      // Progress
      const progressText = this.getProgressText(quest.id);
      ctx.fillStyle = state.status === 'active' ? '#64b5f6' : 'rgba(200, 200, 200, 0.5)';
      ctx.fillText(progressText, x + 24, itemY + 50);

      // Status icon
      if (state.status === 'completed') {
        ctx.fillStyle = '#7cb342';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('✓', x + width - 30, itemY + 20);
      }
    }

    ctx.restore();
  }

  /**
   * Renders a compact quest tracker for the HUD.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  renderQuestTracker(ctx, x, y) {
    const activeQuests = this.getActiveQuests();
    if (activeQuests.length === 0) return;

    ctx.save();

    activeQuests.slice(0, 3).forEach(({ quest, state }, i) => {
      const trackerY = y + i * 44;
      const biomeColor = BIOME_COLORS[quest.biome] || '#ffffff';

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this._roundRect(ctx, x, trackerY, 220, 38, 4);
      ctx.fill();

      // Biome indicator
      ctx.fillStyle = biomeColor;
      ctx.fillRect(x + 4, trackerY + 6, 3, 26);

      // Quest name (shortened)
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      const shortName = quest.name.length > 22 ? quest.name.substring(0, 20) + '...' : quest.name;
      ctx.fillText(shortName, x + 14, trackerY + 16);

      // Progress bar
      const barWidth = 180;
      const barHeight = 5;
      const progress = state.progressMax > 0 ? state.progress / state.progressMax : 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      this._roundRect(ctx, x + 14, trackerY + 24, barWidth, barHeight, 2);
      ctx.fill();
      ctx.fillStyle = biomeColor;
      this._roundRect(ctx, x + 14, trackerY + 24, barWidth * progress, barHeight, 2);
      ctx.fill();

      // Progress text
      ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${state.progress}/${state.progressMax}`, x + 14 + barWidth + 4, trackerY + 30);
    });

    ctx.restore();
  }

  /**
   * Updates the quest system (timers, race quests, etc.).
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.updateTimer += dt;

    // Update time-based quests
    for (const { quest } of this.getActiveQuests()) {
      if (quest.type === 'race') {
        this.updateQuestTimer(quest.id, dt);
      }
    }
  }

  /**
   * Serializes all quest state for saving.
   * @returns {Object} Serialized quest data
   */
  serialize() {
    const states = {};
    for (const [questId, state] of this.questStates) {
      states[questId] = {
        status: state.status,
        progress: state.progress,
        progressMax: state.progressMax,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        metadata: state.metadata
      };
    }

    return {
      states,
      completedQuests: Array.from(this.completedQuests),
      failedQuests: Array.from(this.failedQuests),
      activeConsequences: this.activeConsequences,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed
    };
  }

  /**
   * Loads quest state from serialized data.
   * @param {Object} data - Serialized quest data
   */
  loadQuestState(data) {
    if (!data) return;

    // Restore quest states
    if (data.states) {
      for (const [questId, stateData] of Object.entries(data.states)) {
        const questDef = QUESTS.find(q => q.id === questId);
        if (questDef) {
          this.questStates.set(questId, {
            status: stateData.status || 'inactive',
            progress: stateData.progress || 0,
            progressMax: stateData.progressMax || (questDef.count || 1),
            startedAt: stateData.startedAt || 0,
            completedAt: stateData.completedAt || 0,
            metadata: stateData.metadata || {}
          });
        }
      }
    }

    // Restore completed/failed sets
    if (data.completedQuests) {
      this.completedQuests = new Set(data.completedQuests);
    }
    if (data.failedQuests) {
      this.failedQuests = new Set(data.failedQuests);
    }

    // Restore consequences
    if (data.activeConsequences) {
      this.activeConsequences = [...data.activeConsequences];
    }

    this.totalCompleted = data.totalCompleted || this.completedQuests.size;
    this.totalFailed = data.totalFailed || this.failedQuests.size;
  }

  /**
   * Alias for loadQuestState — used by SaveSystem.
   * @param {Object} data - Serialized quest data
   */
  deserialize(data) {
    this.loadQuestState(data);
  }

  /**
   * Emits a system notification.
   * @param {string} message - Notification text
   * @param {string} type - Notification type
   * @private
   */
  _emitNotification(message, type = 'info') {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('system:notification', { message, type });
    }
  }

  /**
   * Emits a custom event on the global event bus.
   * @param {string} eventName - Event name
   * @param {Object} data - Event data
   * @private
   */
  _emitEvent(eventName, data) {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit(eventName, data);
    }
  }

  /**
   * Triggers the change callback if set.
   * @private
   */
  _triggerChangeCallback() {
    if (this.onQuestChange) {
      this.onQuestChange(this.getProgressStats());
    }
  }

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
   * Resets the entire quest system to initial state.
   */
  reset() {
    this.questStates.clear();
    this.completedQuests.clear();
    this.failedQuests.clear();
    this.activeConsequences = [];
    this.pendingNotifications = [];
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this._initializeQuestStates();
  }

  /**
   * Destroys the quest system.
   */
  destroy() {
    this.reset();
    this.onQuestChange = null;
    this.onConsequence = null;
  }
}

window.QuestSystem = QuestSystem;
