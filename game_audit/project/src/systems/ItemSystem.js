/**
 * @file ItemSystem.js
 * @description Manages the 6 dungeon items, their effects, passive abilities,
 * and inventory rendering. Each item is earned by defeating a dungeon boss
 * and grants a unique active effect and/or passive ability.
 */

/** @typedef {Object} DungeonItem
 * @property {string} id - Unique item identifier
 * @property {string} name - Display name
 * @property {string} dungeon - Biome dungeon source
 * @property {string} description - Flavor and effect description
 * @property {string|null} effect - Active effect identifier
 * @property {string|null} passive - Passive effect identifier
 */

/** @typedef {Object} ItemEffect
 * @property {string} id - Effect identifier
 * @property {string} description - Human-readable effect description
 * @property {Function} apply - Function to apply the effect to a player
 * @property {Function} remove - Function to remove the effect from a player
 */

/**
 * The 6 dungeon items and their definitions.
 * Each is obtained from a dungeon boss and grants unique powers.
 * @constant {Object.<string, DungeonItem>}
 */
const DUNGEON_ITEMS = {
  WHISPERING_SEED: {
    id: 'whispering_seed',
    name: 'Whispering Seed',
    dungeon: 'FOREST',
    description: 'A seed that hums with ancient energy. It pulses gently in your hand, resonating with the world around you. Allows shrinking anywhere, no longer bound to sacred zones.',
    effect: 'shrink_anywhere',
    passive: null
  },
  MIRAGE_CLOAK: {
    id: 'mirage_cloak',
    name: 'Mirage Cloak',
    dungeon: 'DESERT',
    description: 'A shimmering cloak woven from desert heat mirages. Grants a devastating dash-attack that leaves a mirage to confuse enemies.',
    effect: 'dash_attack',
    passive: 'mirage'
  },
  STONE_HEART: {
    id: 'stone_heart',
    name: 'Stone Heart',
    dungeon: 'MOUNTAIN',
    description: 'A solid core taken from the heart of the mountain. Halves knockback from all sources and grants super-armor during charged attacks.',
    effect: 'super_armor',
    passive: 'knockback_resist'
  },
  MURKY_AMULET: {
    id: 'murky_amulet',
    name: 'Murky Amulet',
    dungeon: 'SWAMP',
    description: 'A dark amulet dripping with swamp essence. All attacks apply poison, causing damage over time and slowing afflicted enemies.',
    effect: 'poison_touch',
    passive: null
  },
  GLACIAL_CORE: {
    id: 'glacial_core',
    name: 'Glacial Core',
    dungeon: 'ICE',
    description: 'A frozen crystal pulsing with cold energy. Parrying freezes enemies solid. Also grants the ability to walk on ice without slipping.',
    effect: 'freeze_parry',
    passive: 'ice_walking'
  },
  EMBER_CROWN: {
    id: 'ember_crown',
    name: 'Ember Crown',
    dungeon: 'VOLCANO',
    description: 'A crown forged in volcanic fire. Charged attacks unleash a flame wave, and the final hit of a full combo triggers an explosive fire burst.',
    effect: 'flame_charge',
    passive: 'combo_explosion'
  }
};

/**
 * Detailed effect definitions with apply/remove callbacks.
 * Each effect modifies player behavior when active.
 * @constant {Object.<string, ItemEffect>}
 */
const EFFECT_DEFINITIONS = {
  shrink_anywhere: {
    id: 'shrink_anywhere',
    description: 'Can shrink to 1/4 size anywhere, not just in shrink zones.',
    apply: (player) => {
      if (player) {
        player.canShrinkAnywhere = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.canShrinkAnywhere = false;
      }
    }
  },
  dash_attack: {
    id: 'dash_attack',
    description: 'Press attack during a dodge to perform a powerful dash-attack that deals 2x damage and pierces through enemies.',
    apply: (player) => {
      if (player) {
        player.canDashAttack = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.canDashAttack = false;
      }
    }
  },
  mirage: {
    id: 'mirage',
    description: 'Dodging leaves behind a brief afterimage that distracts enemies, causing them to lose target for 1.5 seconds.',
    apply: (player) => {
      if (player) {
        player.hasMiragePassive = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.hasMiragePassive = false;
      }
    }
  },
  super_armor: {
    id: 'super_armor',
    description: 'No flinching during charged attacks. You cannot be interrupted while charging.',
    apply: (player) => {
      if (player) {
        player.hasSuperArmor = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.hasSuperArmor = false;
      }
    }
  },
  knockback_resist: {
    id: 'knockback_resist',
    description: 'Knockback taken from all sources is reduced by 50%.',
    apply: (player) => {
      if (player) {
        player.knockbackMultiplier = (player.knockbackMultiplier || 1.0) * 0.5;
      }
    },
    remove: (player) => {
      if (player) {
        player.knockbackMultiplier = (player.knockbackMultiplier || 0.5) / 0.5;
      }
    }
  },
  poison_touch: {
    id: 'poison_touch',
    description: 'All attacks apply Poison: 3 damage per second for 5 seconds. Poisoned enemies move 20% slower.',
    apply: (player) => {
      if (player) {
        player.hasPoisonTouch = true;
        player.poisonDamage = 3;
        player.poisonDuration = 5;
      }
    },
    remove: (player) => {
      if (player) {
        player.hasPoisonTouch = false;
        player.poisonDamage = 0;
        player.poisonDuration = 0;
      }
    }
  },
  freeze_parry: {
    id: 'freeze_parry',
    description: 'Successful parries freeze the attacker for 3 seconds. Frozen enemies take 2x damage from the next hit and shatter when killed.',
    apply: (player) => {
      if (player) {
        player.hasFreezeParry = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.hasFreezeParry = false;
      }
    }
  },
  ice_walking: {
    id: 'ice_walking',
    description: 'Walk and run on icy surfaces without slipping or losing traction.',
    apply: (player) => {
      if (player) {
        player.hasIceWalking = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.hasIceWalking = false;
      }
    }
  },
  flame_charge: {
    id: 'flame_charge',
    description: 'Fully charged attacks fire a flame wave projectile that travels in a line, dealing 15 fire damage to all enemies hit.',
    apply: (player) => {
      if (player) {
        player.hasFlameCharge = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.hasFlameCharge = false;
      }
    }
  },
  combo_explosion: {
    id: 'combo_explosion',
    description: 'The third hit of a combo finisher creates a fiery explosion (radius 60px) dealing 20 AOE fire damage.',
    apply: (player) => {
      if (player) {
        player.hasComboExplosion = true;
      }
    },
    remove: (player) => {
      if (player) {
        player.hasComboExplosion = false;
      }
    }
  }
};

/**
 * Maps each dungeon to the item found within it.
 * @constant {Object.<string, string>}
 */
const DUNGEON_TO_ITEM = {
  FOREST: 'whispering_seed',
  DESERT: 'mirage_cloak',
  MOUNTAIN: 'stone_heart',
  SWAMP: 'murky_amulet',
  ICE: 'glacial_core',
  VOLCANO: 'ember_crown'
};

/**
 * Maps each item ID to its dungeon source.
 * @constant {Object.<string, string>}
 */
const ITEM_TO_DUNGEON = {};
for (const [dungeon, itemId] of Object.entries(DUNGEON_TO_ITEM)) {
  ITEM_TO_DUNGEON[itemId] = dungeon;
}

/**
 * Color coding for each dungeon/biome, used in inventory rendering.
 * @constant {Object.<string, string>}
 */
const DUNGEON_COLORS = {
  FOREST: '#4caf50',
  DESERT: '#ff9800',
  MOUNTAIN: '#9e9e9e',
  SWAMP: '#795548',
  ICE: '#00bcd4',
  VOLCANO: '#f44336'
};

/**
 * Manages item collection, effects, passive abilities, and inventory display.
 * @class ItemSystem
 */
class ItemSystem {
  /**
   * Creates a new ItemSystem instance.
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxInventorySize=12] - Maximum inventory capacity
   */
  constructor(options = {}) {
    /** @type {number} Maximum number of items that can be held */
    this.maxInventorySize = options.maxInventorySize || 12;

    /** @type {Map<string, DungeonItem>} Currently held items by ID */
    this.inventory = new Map();

    /** @type {Set<string>} Active effect IDs */
    this.activeEffects = new Set();

    /** @type {Set<string>} Active passive IDs */
    this.activePassives = new Set();

    /** @type {Array<Object>} Recently acquired items for notifications */
    this.recentPickups = [];

    /** @type {number} Animation timer for inventory UI */
    this.uiAnimationTimer = 0;

    this._bindEvents();
  }

  /**
   * Binds to global event bus for item-related events.
   * @private
   */
  _bindEvents() {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.on('player:itemPickup', (data) => {
        this.giveItem(null, data.itemId);
      });

      window.GameEvents.on('world:enterDungeon', (data) => {
        // Track which dungeon the player is in
        this.currentDungeon = data.dungeonId;
      });
    }
  }

  /**
   * Grants an item to the player by its constant key (e.g., 'WHISPERING_SEED').
   * @param {string} itemKey - The constant key from DUNGEON_ITEMS
   * @param {Object} [player] - Optional player object to apply effects to
   * @returns {DungeonItem|null} The granted item, or null if invalid/not found
   */
  giveItemByKey(itemKey, player = null) {
    const itemDef = DUNGEON_ITEMS[itemKey];
    if (!itemDef) {
      console.warn(`[ItemSystem] Unknown item key: ${itemKey}`);
      return null;
    }
    return this.giveItem(player, itemDef.id);
  }

  /**
   * Grants an item to the player by its ID.
   * Applies all effects and passives immediately.
   * @param {Object|null} player - The player object to apply effects to
   * @param {string} itemId - The item ID (e.g., 'whispering_seed')
   * @returns {DungeonItem|null} The granted item, or null if invalid
   */
  giveItem(player, itemId) {
    // Find the item definition
    const itemDef = Object.values(DUNGEON_ITEMS).find(item => item.id === itemId);
    if (!itemDef) {
      console.warn(`[ItemSystem] Unknown item ID: ${itemId}`);
      return null;
    }

    // Check capacity
    if (this.inventory.size >= this.maxInventorySize && !this.inventory.has(itemId)) {
      console.warn(`[ItemSystem] Inventory full, cannot give item: ${itemId}`);
      this._emitNotification('Inventory full!', 'warning');
      return null;
    }

    // Already has this item
    if (this.inventory.has(itemId)) {
      console.log(`[ItemSystem] Player already has item: ${itemId}`);
      return itemDef;
    }

    // Add to inventory
    this.inventory.set(itemId, { ...itemDef, acquiredAt: Date.now() });

    // Apply active effect
    if (itemDef.effect) {
      const effectDef = EFFECT_DEFINITIONS[itemDef.effect];
      if (effectDef) {
        effectDef.apply(player);
        this.activeEffects.add(itemDef.effect);
      }
    }

    // Apply passive effect
    if (itemDef.passive) {
      const passiveDef = EFFECT_DEFINITIONS[itemDef.passive];
      if (passiveDef) {
        passiveDef.apply(player);
        this.activePassives.add(itemDef.passive);
      }
    }

    // Track recent pickup
    this.recentPickups.push({
      item: itemDef,
      time: Date.now()
    });

    // Emit events
    this._emitItemAcquired(itemDef);
    this._emitNotification(`Acquired: ${itemDef.name}`, 'success');

    console.log(`[ItemSystem] Gave item: ${itemDef.name} (${itemId})`);
    return itemDef;
  }

  /**
   * Grants all dungeon items at once (useful for testing/debug).
   * @param {Object|null} player - The player object
   * @returns {DungeonItem[]} Array of granted items
   */
  giveAllItems(player = null) {
    const granted = [];
    for (const [key, itemDef] of Object.entries(DUNGEON_ITEMS)) {
      const result = this.giveItem(player, itemDef.id);
      if (result) granted.push(result);
    }
    return granted;
  }

  /**
   * Checks if the player has a specific item.
   * @param {Object|null} player - Unused, checks internal inventory
   * @param {string} itemId - The item ID to check
   * @returns {boolean} True if the player has the item
   */
  hasItem(player, itemId) {
    return this.inventory.has(itemId);
  }

  /**
   * Checks if the player has an item by its constant key.
   * @param {string} itemKey - The constant key (e.g., 'WHISPERING_SEED')
   * @returns {boolean} True if the player has the item
   */
  hasItemByKey(itemKey) {
    const itemDef = DUNGEON_ITEMS[itemKey];
    if (!itemDef) return false;
    return this.inventory.has(itemDef.id);
  }

  /**
   * Gets the number of items currently held.
   * @returns {number} Item count
   */
  getItemCount() {
    return this.inventory.size;
  }

  /**
   * Returns all currently active effects and passives.
   * @param {Object|null} [player] - Optional player object
   * @returns {Object} Object with 'effects' and 'passives' arrays
   */
  getItemEffects(player) {
    const effects = [];
    const passives = [];

    for (const effectId of this.activeEffects) {
      const def = EFFECT_DEFINITIONS[effectId];
      if (def) {
        effects.push({
          id: effectId,
          description: def.description,
          type: 'active'
        });
      }
    }

    for (const passiveId of this.activePassives) {
      const def = EFFECT_DEFINITIONS[passiveId];
      if (def) {
        passives.push({
          id: passiveId,
          description: def.description,
          type: 'passive'
        });
      }
    }

    return { effects, passives };
  }

  /**
   * Returns detailed descriptions of all active effects.
   * @returns {string[]} Array of human-readable effect descriptions
   */
  getActiveEffectDescriptions() {
    const descriptions = [];
    for (const effectId of this.activeEffects) {
      const def = EFFECT_DEFINITIONS[effectId];
      if (def) descriptions.push(def.description);
    }
    for (const passiveId of this.activePassives) {
      const def = EFFECT_DEFINITIONS[passiveId];
      if (def) descriptions.push(def.description);
    }
    return descriptions;
  }

  /**
   * Removes an item from the inventory and disables its effects.
   * @param {Object|null} player - The player object
   * @param {string} itemId - The item ID to remove
   * @returns {boolean} True if the item was removed
   */
  removeItem(player, itemId) {
    if (!this.inventory.has(itemId)) {
      return false;
    }

    const itemData = this.inventory.get(itemId);

    // Remove active effect
    if (itemData.effect) {
      const effectDef = EFFECT_DEFINITIONS[itemData.effect];
      if (effectDef) {
        effectDef.remove(player);
        this.activeEffects.delete(itemData.effect);
      }
    }

    // Remove passive effect
    if (itemData.passive) {
      const passiveDef = EFFECT_DEFINITIONS[itemData.passive];
      if (passiveDef) {
        passiveDef.remove(player);
        this.activePassives.delete(itemData.passive);
      }
    }

    this.inventory.delete(itemId);

    this._emitNotification(`Lost: ${itemData.name}`, 'warning');
    console.log(`[ItemSystem] Removed item: ${itemData.name} (${itemId})`);

    return true;
  }

  /**
   * Removes all items from inventory.
   * @param {Object|null} player - The player object
   */
  removeAllItems(player = null) {
    const itemIds = Array.from(this.inventory.keys());
    for (const itemId of itemIds) {
      this.removeItem(player, itemId);
    }
  }

  /**
   * Gets the item definition for a given item ID.
   * @param {string} itemId - The item ID
   * @returns {DungeonItem|undefined} The item definition
   */
  getItemDefinition(itemId) {
    return Object.values(DUNGEON_ITEMS).find(item => item.id === itemId);
  }

  /**
   * Gets the item found in a specific dungeon.
   * @param {string} dungeonId - The dungeon/biome ID
   * @returns {DungeonItem|null} The dungeon's item
   */
  getItemForDungeon(dungeonId) {
    const itemId = DUNGEON_TO_ITEM[dungeonId];
    if (!itemId) return null;
    return this.getItemDefinition(itemId);
  }

  /**
   * Checks if the player has the item from a specific dungeon.
   * @param {string} dungeonId - The dungeon/biome ID
   * @returns {boolean} True if the player has that dungeon's item
   */
  hasDungeonItem(dungeonId) {
    const itemId = DUNGEON_TO_ITEM[dungeonId];
    if (!itemId) return false;
    return this.inventory.has(itemId);
  }

  /**
   * Returns all currently held items.
   * @returns {DungeonItem[]} Array of held item definitions
   */
  getInventory() {
    return Array.from(this.inventory.values());
  }

  /**
   * Returns all item IDs currently in inventory.
   * @returns {string[]} Array of item IDs
   */
  getInventoryIds() {
    return Array.from(this.inventory.keys());
  }

  /**
   * Checks if inventory is full.
   * @returns {boolean} True if inventory is at capacity
   */
  isFull() {
    return this.inventory.size >= this.maxInventorySize;
  }

  /**
   * Checks if inventory is empty.
   * @returns {boolean} True if no items held
   */
  isEmpty() {
    return this.inventory.size === 0;
  }

  /**
   * Returns the item that should drop from a defeated dungeon boss.
   * @param {string} dungeonId - The dungeon ID
   * @returns {DungeonItem|null} The item to drop
   */
  getBossDropForDungeon(dungeonId) {
    return this.getItemForDungeon(dungeonId);
  }

  /**
   * Renders the inventory UI grid.
   * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
   * @param {Object} options - Rendering options
   * @param {number} options.x - Grid top-left X position
   * @param {number} options.y - Grid top-left Y position
   * @param {number} [options.cellSize=56] - Size of each inventory cell
   * @param {number} [options.columns=4] - Number of columns
   * @param {number} [options.gap=8] - Gap between cells
   * @param {string} [options.hoveredId] - Currently hovered item ID for tooltip
   */
  renderInventory(ctx, options) {
    const {
      x,
      y,
      cellSize = 56,
      columns = 4,
      gap = 8,
      hoveredId = null
    } = options;

    this.uiAnimationTimer += 0.016;

    const items = this.getInventory();
    const rows = Math.ceil(this.maxInventorySize / columns);

    // Draw background panel
    const panelWidth = columns * (cellSize + gap) + gap;
    const panelHeight = rows * (cellSize + gap) + gap;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, panelWidth, panelHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Draw each cell
    for (let i = 0; i < this.maxInventorySize; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const cellX = x + gap + col * (cellSize + gap);
      const cellY = y + gap + row * (cellSize + gap);
      const item = items[i];

      // Cell background
      ctx.fillStyle = item ? 'rgba(40, 40, 50, 0.9)' : 'rgba(20, 20, 30, 0.6)';
      ctx.strokeStyle = item ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)';
      this._roundRect(ctx, cellX, cellY, cellSize, cellSize, 6);
      ctx.fill();
      ctx.stroke();

      if (item) {
        // Get dungeon color for glow
        const dungeonColor = DUNGEON_COLORS[item.dungeon] || '#ffffff';

        // Draw item glow if recently acquired
        const timeSinceAcquired = Date.now() - (item.acquiredAt || 0);
        if (timeSinceAcquired < 3000) {
          const glowIntensity = 1 - (timeSinceAcquired / 3000);
          ctx.shadowColor = dungeonColor;
          ctx.shadowBlur = 10 * glowIntensity;
        }

        // Draw item icon (procedural colored orb)
        const centerX = cellX + cellSize / 2;
        const centerY = cellY + cellSize / 2;
        const radius = cellSize / 3;

        // Orb gradient
        const gradient = ctx.createRadialGradient(
          centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.1,
          centerX, centerY, radius
        );
        gradient.addColorStop(0, this._lightenColor(dungeonColor, 40));
        gradient.addColorStop(0.5, dungeonColor);
        gradient.addColorStop(1, this._darkenColor(dungeonColor, 40));

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(centerX - radius * 0.25, centerY - radius * 0.25, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Draw item initial letter
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.floor(cellSize / 3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.name.charAt(0), centerX, centerY + 1);

        // Hover effect - highlight cell
        if (hoveredId === item.id) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          this._roundRect(ctx, cellX, cellY, cellSize, cellSize, 6);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
      } else {
        // Empty cell marker
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        const centerX = cellX + cellSize / 2;
        const centerY = cellY + cellSize / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw tooltip for hovered item
    if (hoveredId) {
      const hoveredItem = this.inventory.get(hoveredId);
      if (hoveredItem) {
        this._drawTooltip(ctx, hoveredItem, x + panelWidth + 10, y);
      }
    }

    ctx.restore();
  }

  /**
   * Renders a detailed item description tooltip.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {DungeonItem} item - The item to describe
   * @param {number} x - Tooltip X position
   * @param {number} y - Tooltip Y position
   * @private
   */
  _drawTooltip(ctx, item, x, y) {
    const maxWidth = 240;
    const lineHeight = 18;
    const padding = 12;

    // Build tooltip text lines
    const lines = [];
    lines.push({ text: item.name, style: 'name' });
    lines.push({ text: `From: ${item.dungeon}`, style: 'dungeon' });
    lines.push({ text: '', style: 'spacer' });

    // Wrap description
    const descWords = item.description.split(' ');
    let currentLine = '';
    ctx.font = '13px sans-serif';
    for (const word of descWords) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth - padding * 2) {
        if (currentLine) lines.push({ text: currentLine, style: 'desc' });
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push({ text: currentLine, style: 'desc' });

    // Add effect info
    if (item.effect) {
      const effectDef = EFFECT_DEFINITIONS[item.effect];
      if (effectDef) {
        lines.push({ text: '', style: 'spacer' });
        lines.push({ text: `Effect: ${effectDef.description}`, style: 'effect' });
      }
    }
    if (item.passive) {
      const passiveDef = EFFECT_DEFINITIONS[item.passive];
      if (passiveDef) {
        lines.push({ text: `Passive: ${passiveDef.description}`, style: 'passive' });
      }
    }

    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // Draw tooltip background
    ctx.fillStyle = 'rgba(20, 20, 35, 0.95)';
    ctx.strokeStyle = DUNGEON_COLORS[item.dungeon] || 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, x, y, maxWidth, tooltipHeight, 6);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 1;

    // Draw text
    let currentY = y + padding + lineHeight / 2;
    for (const line of lines) {
      switch (line.style) {
        case 'name':
          ctx.fillStyle = DUNGEON_COLORS[item.dungeon] || '#ffffff';
          ctx.font = 'bold 15px sans-serif';
          break;
        case 'dungeon':
          ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
          ctx.font = 'italic 12px sans-serif';
          break;
        case 'desc':
          ctx.fillStyle = 'rgba(230, 230, 230, 0.9)';
          ctx.font = '13px sans-serif';
          break;
        case 'effect':
          ctx.fillStyle = '#7cb342';
          ctx.font = '12px sans-serif';
          break;
        case 'passive':
          ctx.fillStyle = '#64b5f6';
          ctx.font = '12px sans-serif';
          break;
        default:
          currentY += lineHeight / 2;
          continue;
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(line.text, x + padding, currentY);
      currentY += lineHeight;
    }
  }

  /**
   * Renders a compact inventory bar for the HUD.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - Top-left X position
   * @param {number} y - Top-left Y position
   */
  renderInventoryBar(ctx, x, y) {
    const items = this.getInventory();
    if (items.length === 0) return;

    const iconSize = 28;
    const gap = 4;
    const barWidth = items.length * (iconSize + gap) + gap;
    const barHeight = iconSize + gap * 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this._roundRect(ctx, x, y, barWidth, barHeight, 4);
    ctx.fill();

    items.forEach((item, i) => {
      const iconX = x + gap + i * (iconSize + gap);
      const iconY = y + gap;
      const dungeonColor = DUNGEON_COLORS[item.dungeon] || '#ffffff';

      // Draw small orb
      const centerX = iconX + iconSize / 2;
      const centerY = iconY + iconSize / 2;
      const gradient = ctx.createRadialGradient(
        centerX - 3, centerY - 3, 2,
        centerX, centerY, iconSize / 2 - 2
      );
      gradient.addColorStop(0, this._lightenColor(dungeonColor, 30));
      gradient.addColorStop(1, dungeonColor);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, iconSize / 2 - 2, 0, Math.PI * 2);
      ctx.fill();

      // Letter
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(iconSize / 2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.name.charAt(0), centerX, centerY);
    });

    ctx.restore();
  }

  /**
   * Serializes the current inventory state for saving.
   * @returns {Object} Serialized inventory data
   */
  serialize() {
    return {
      items: Array.from(this.inventory.keys()),
      activeEffects: Array.from(this.activeEffects),
      activePassives: Array.from(this.activePassives)
    };
  }

  /**
   * Restores inventory from serialized save data.
   * @param {Object} data - Serialized inventory data
   * @param {Object|null} player - Player object to re-apply effects
   */
  deserialize(data, player = null) {
    this.inventory.clear();
    this.activeEffects.clear();
    this.activePassives.clear();

    if (data && data.items) {
      for (const itemId of data.items) {
        this.giveItem(player, itemId);
      }
    }
  }

  /**
   * Emits an item acquired event.
   * @param {DungeonItem} itemDef - The acquired item
   * @private
   */
  _emitItemAcquired(itemDef) {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.emit('player:itemPickup', {
        itemId: itemDef.id,
        itemName: itemDef.name,
        dungeon: itemDef.dungeon
      });
    }
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
   * Lightens a hex color by a percentage.
   * @param {string} hex - Hex color string
   * @param {number} percent - Percentage to lighten
   * @returns {string} Lightened hex color
   * @private
   */
  _lightenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  /**
   * Darkens a hex color by a percentage.
   * @param {string} hex - Hex color string
   * @param {number} percent - Percentage to darken
   * @returns {string} Darkened hex color
   * @private
   */
  _darkenColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  /**
   * Updates internal animation timers.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.uiAnimationTimer += dt;

    // Clean up old recent pickups (older than 5 seconds)
    const now = Date.now();
    this.recentPickups = this.recentPickups.filter(
      p => now - p.time < 5000
    );
  }

  /**
   * Destroys the system and cleans up event listeners.
   */
  destroy() {
    this.inventory.clear();
    this.activeEffects.clear();
    this.activePassives.clear();
    this.recentPickups = [];
  }
}

window.ItemSystem = ItemSystem;
