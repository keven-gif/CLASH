/**
 * @file RelicFusionSystem.js
 * @description Manages 10 base relics and 60 fusion combinations (50 normal 2-relic
 * fusions + 10 secret 3-relic fusions). Each fusion has lore text, unique effects,
 * and can be equipped in up to 5 active slots. The system tracks discoveries and
 * applies passive effects to the player.
 */

/** @typedef {Object} BaseRelic
 * @property {string} id - Relic identifier
 * @property {string} name - Display name
 * @property {string} color - Display color
 * @property {string} description - Flavor description
 * @property {string} source - How the relic is obtained
 */

/** @typedef {Object} FusionDefinition
 * @property {string} id - Fusion identifier (e.g., "leaf+stone")
 * @property {string} name - Fusion display name
 * @property {string} effect - Effect identifier
 * @property {number} value - Effect magnitude
 * @property {string} lore - Lore/flavor text
 * @property {boolean} [secret] - True if secret fusion
 * @property {string[]} relics - Required relic IDs
 */

/** @typedef {Object} FusionEffect
 * @property {string} id - Effect identifier
 * @property {string} description - Human-readable description
 * @property {Function} apply - Apply to player
 * @property {Function} remove - Remove from player
 */

/**
 * The 10 base relics collected from quests, bosses, and exploration.
 * @constant {Object.<string, BaseRelic>}
 */
const BASE_RELICS = {
  leaf: {
    id: 'leaf',
    name: 'Verdant Leaf',
    color: '#4caf50',
    description: 'A leaf that never withers, pulsing with the life force of the ancient forest.',
    source: 'Forest dungeon boss'
  },
  sand: {
    id: 'sand',
    name: 'Dune Sand',
    color: '#ff9800',
    description: 'Crystallized sand from the heart of the desert, warm to the touch.',
    source: 'Desert dungeon boss'
  },
  stone: {
    id: 'stone',
    name: 'Mountain Stone',
    color: '#9e9e9e',
    description: 'A perfectly smooth stone taken from the mountain\'s peak.',
    source: 'Mountain dungeon boss'
  },
  muck: {
    id: 'muck',
    name: 'Swamp Muck',
    color: '#795548',
    description: 'Concentrated essence of the swamp, thick and ever-shifting.',
    source: 'Swamp dungeon boss'
  },
  ice: {
    id: 'ice',
    name: 'Glacier Ice',
    color: '#00bcd4',
    description: 'Ice that never melts, radiating an ancient, calming cold.',
    source: 'Ice dungeon boss'
  },
  ember: {
    id: 'ember',
    name: 'Volcanic Ember',
    color: '#f44336',
    description: 'A glowing ember from the volcano\'s core, still warm with primordial fire.',
    source: 'Volcano dungeon boss'
  },
  dew: {
    id: 'dew',
    name: 'Morning Dew',
    color: '#8bc34a',
    description: 'A droplet of the first morning dew, captured in crystal.',
    source: 'Forest side quest'
  },
  shadow: {
    id: 'shadow',
    name: 'Deep Shadow',
    color: '#424242',
    description: 'A fragment of living darkness, pulled from the world\'s shadowed places.',
    source: 'Desert side quest'
  },
  light: {
    id: 'light',
    name: 'Pure Light',
    color: '#ffeb3b',
    description: 'A mote of concentrated light, blindingly bright yet gentle to hold.',
    source: 'Mountain side quest'
  },
  void: {
    id: 'void',
    name: 'Void Essence',
    color: '#7c4dff',
    description: 'A piece of the void between stars, humming with unknown energy.',
    source: 'Volcano side quest'
  }
};

/**
 * All 60 fusion definitions: 50 normal 2-relic + 10 secret 3-relic.
 * Each fusion grants a unique passive effect when equipped.
 * @constant {Object.<string, FusionDefinition>}
 */
const FUSIONS = {
  // ============ 2-RELIC NORMAL FUSIONS (50) ============

  // --- Leaf combinations (9) ---
  'leaf+sand': {
    id: 'leaf+sand',
    name: 'Oasis Bloom',
    effect: 'heal_on_sand',
    value: 1,
    lore: 'Life finds a way even in the harshest desert. Small wounds mend when walking on sandy terrain.',
    secret: false,
    relics: ['leaf', 'sand']
  },
  'leaf+stone': {
    id: 'leaf+stone',
    name: 'Living Armor',
    effect: 'regen_hp',
    value: 2,
    lore: 'Stone becomes moss-covered and alive. Your body slowly regenerates health over time, as nature reclaims even the hardest surface.',
    secret: false,
    relics: ['leaf', 'stone']
  },
  'leaf+muck': {
    id: 'leaf+muck',
    name: 'Toxic Bloom',
    effect: 'poison_aura',
    value: 2,
    lore: 'Beautiful flowers that drip with poison. Enemies near you take continuous poison damage.',
    secret: false,
    relics: ['leaf', 'muck']
  },
  'leaf+ice': {
    id: 'leaf+ice',
    name: 'Frost Blossom',
    effect: 'freeze_on_hit',
    value: 1,
    lore: 'Flowers of ice that bloom with each strike. Attacks have a chance to freeze enemies briefly.',
    secret: false,
    relics: ['leaf', 'ice']
  },
  'leaf+ember': {
    id: 'leaf+ember',
    name: 'Phoenix Fern',
    effect: 'fire_regen',
    value: 3,
    lore: 'A fern that burns but never turns to ash. When health is low, fire erupts around you and heals.',
    secret: false,
    relics: ['leaf', 'ember']
  },
  'leaf+dew': {
    id: 'leaf+dew',
    name: 'Morning Renewal',
    effect: 'morning_heal',
    value: 10,
    lore: 'The freshness of dawn captured. Healing effects are 25% more potent.',
    secret: false,
    relics: ['leaf', 'dew']
  },
  'leaf+shadow': {
    id: 'leaf+shadow',
    name: 'Dark Grove',
    effect: 'stealth_grass',
    value: 1,
    lore: 'A shadowed thicket where hunters lurk. Enemies detect you 30% slower in grassy areas.',
    secret: false,
    relics: ['leaf', 'shadow']
  },
  'leaf+light': {
    id: 'leaf+light',
    name: 'Sunlit Canopy',
    effect: 'light_damage',
    value: 1.15,
    lore: 'Sunlight filtering through leaves focuses into beams. Damage increased by 15% during daytime.',
    secret: false,
    relics: ['leaf', 'light']
  },
  'leaf+void': {
    id: 'leaf+void',
    name: 'Abyssal Growth',
    effect: 'life_drain',
    value: 1,
    lore: 'Vines that stretch into the void and drain life from beyond. Defeating enemies restores a small amount of health.',
    secret: false,
    relics: ['leaf', 'void']
  },

  // --- Sand combinations (8 new) ---
  'sand+stone': {
    id: 'sand+stone',
    name: 'Sandstone Fortress',
    effect: 'damage_reduction',
    value: 0.9,
    lore: 'Compressed sand forms an unyielding barrier. All damage taken is reduced by 10%.',
    secret: false,
    relics: ['sand', 'stone']
  },
  'sand+muck': {
    id: 'sand+muck',
    name: 'Quicksand Trap',
    effect: 'slow_enemies',
    value: 0.8,
    lore: 'Enemies who strike you become mired in magical quicksand, slowing their movement by 20%.',
    secret: false,
    relics: ['sand', 'muck']
  },
  'sand+ice': {
    id: 'sand+ice',
    name: 'Glass Dunes',
    effect: 'reflect_projectiles',
    value: 0.15,
    lore: 'Desert sand fused into reflective glass. Projectiles have a 15% chance to be reflected back at attackers.',
    secret: false,
    relics: ['sand', 'ice']
  },
  'sand+ember': {
    id: 'sand+ember',
    name: 'Glass Forge',
    effect: 'fire_damage_up',
    value: 1.2,
    lore: 'Sand becomes glass in volcanic heat. Fire-based attacks deal 20% more damage.',
    secret: false,
    relics: ['sand', 'ember']
  },
  'sand+dew': {
    id: 'sand+dew',
    name: 'Desert Spring',
    effect: 'water_heal',
    value: 5,
    lore: 'A miraculous spring in the desert. Finding water sources fully restores health.',
    secret: false,
    relics: ['sand', 'dew']
  },
  'sand+shadow': {
    id: 'sand+shadow',
    name: 'Desert Phantom',
    effect: 'invisible_dodge',
    value: 1,
    lore: 'A phantom that drifts between dunes. Dodging grants brief invisibility, causing enemies to lose target.',
    secret: false,
    relics: ['sand', 'shadow']
  },
  'sand+light': {
    id: 'sand+light',
    name: 'Mirage Blade',
    effect: 'mirage_damage',
    value: 1.25,
    lore: 'A blade of focused light and heat. Attacks in bright environments deal 25% more damage.',
    secret: false,
    relics: ['sand', 'light']
  },
  'sand+void': {
    id: 'sand+void',
    name: 'Hourglass Sands',
    effect: 'slow_time_near_death',
    value: 0.5,
    lore: 'Sands from a cosmic hourglass. When health is critical, time slows around you for a moment.',
    secret: false,
    relics: ['sand', 'void']
  },

  // --- Stone combinations (7 new) ---
  'stone+muck': {
    id: 'stone+muck',
    name: 'Petrified Bog',
    effect: 'petrify_chance',
    value: 0.1,
    lore: 'Stone and swamp merge to create petrifying mud. Attacks have a 10% chance to briefly petrify enemies.',
    secret: false,
    relics: ['stone', 'muck']
  },
  'stone+ice': {
    id: 'stone+ice',
    name: 'Permafrost',
    effect: 'armor_up',
    value: 15,
    lore: 'Stone sealed in eternal ice. Gain a permanent ice armor that absorbs 15 damage per hit.',
    secret: false,
    relics: ['stone', 'ice']
  },
  'stone+ember': {
    id: 'stone+ember',
    name: 'Magma Core',
    effect: 'burning_aura',
    value: 3,
    lore: 'The heart of a mountain volcano. A burning aura surrounds you, damaging nearby enemies over time.',
    secret: false,
    relics: ['stone', 'ember']
  },
  'stone+dew': {
    id: 'stone+dew',
    name: 'Erosion',
    effect: 'armor_pierce',
    value: 1.2,
    lore: 'Water wears down even the hardest stone. Your attacks ignore 20% of enemy armor.',
    secret: false,
    relics: ['stone', 'dew']
  },
  'stone+shadow': {
    id: 'stone+shadow',
    name: 'Gargoyle\'s Curse',
    effect: 'stone_skin',
    value: 0.7,
    lore: 'Your skin takes on the hardness of stone. Knockback effects are reduced by 30%.',
    secret: false,
    relics: ['stone', 'shadow']
  },
  'stone+light': {
    id: 'stone+light',
    name: 'Crystal Spire',
    effect: 'crystal_damage',
    value: 1.3,
    lore: 'Light refracts through crystallized stone. Charged attacks deal 30% more damage.',
    secret: false,
    relics: ['stone', 'light']
  },
  'stone+void': {
    id: 'stone+void',
    name: 'Meteorite',
    effect: 'falling_damage',
    value: 20,
    lore: 'A fragment of a fallen star. Ground-pound attacks create a shockwave dealing 20 AOE damage.',
    secret: false,
    relics: ['stone', 'void']
  },

  // --- Muck combinations (6 new) ---
  'muck+ice': {
    id: 'muck+ice',
    name: 'Frozen Sludge',
    effect: 'slow_on_hit',
    value: 0.25,
    lore: 'Toxic sludge that flash-freezes on contact. Enemies hit by your attacks are slowed by 25%.',
    secret: false,
    relics: ['muck', 'ice']
  },
  'muck+ember': {
    id: 'muck+ember',
    name: 'Toxic Furnace',
    effect: 'poison_fire',
    value: 5,
    lore: 'Burning poison creates noxious fumes. Enemies take additional poison damage when hit by fire.',
    secret: false,
    relics: ['muck', 'ember']
  },
  'muck+dew': {
    id: 'muck+dew',
    name: 'Purifying Rain',
    effect: 'debuff_immunity',
    value: 1,
    lore: 'Clean rain washes away corruption. Immune to the first poison or slow effect every 10 seconds.',
    secret: false,
    relics: ['muck', 'dew']
  },
  'muck+shadow': {
    id: 'muck+shadow',
    name: 'Nightmare Mire',
    effect: 'fear_aura',
    value: 0.15,
    lore: 'A dark swamp that breeds nightmares. Weak enemies have a 15% chance to flee when they see you.',
    secret: false,
    relics: ['muck', 'shadow']
  },
  'muck+light': {
    id: 'muck+light',
    name: 'Swamp Lantern',
    effect: 'glow_reveal',
    value: 1,
    lore: 'A lantern that reveals hidden things. Secrets and hidden passages become visible within its light.',
    secret: false,
    relics: ['muck', 'light']
  },
  'muck+void': {
    id: 'muck+void',
    name: 'Primordial Soup',
    effect: 'random_buff',
    value: 1,
    lore: 'The essence of creation itself. Every 30 seconds, gain a random buff: speed, damage, or healing.',
    secret: false,
    relics: ['muck', 'void']
  },

  // --- Ice combinations (5 new) ---
  'ice+ember': {
    id: 'ice+ember',
    name: 'Thermal Equilibrium',
    effect: 'elemental_immune',
    value: 1,
    lore: 'Fire and ice in perfect balance. Immune to fire and frost damage. Resist extreme temperatures.',
    secret: false,
    relics: ['ice', 'ember']
  },
  'ice+dew': {
    id: 'ice+dew',
    name: 'Frozen Tear',
    effect: 'ice_heal',
    value: 8,
    lore: 'A frozen tear that heals the wounded. Successful parries restore 8 health.',
    secret: false,
    relics: ['ice', 'dew']
  },
  'ice+shadow': {
    id: 'ice+shadow',
    name: 'Winter Night',
    effect: 'cold_damage_aura',
    value: 4,
    lore: 'The deathly chill of a moonless winter night. Nearby enemies take frost damage over time.',
    secret: false,
    relics: ['ice', 'shadow']
  },
  'ice+light': {
    id: 'ice+light',
    name: 'Prism Freeze',
    effect: 'prism_parry',
    value: 1,
    lore: 'Light refracts through ice crystals. Successful parries create a freezing prism that damages nearby enemies.',
    secret: false,
    relics: ['ice', 'light']
  },
  'ice+void': {
    id: 'ice+void',
    name: 'Absolute Zero',
    effect: 'deep_freeze',
    value: 1,
    lore: 'Cold beyond the void of space. Frozen enemies stay frozen 50% longer and take 25% more damage while frozen.',
    secret: false,
    relics: ['ice', 'void']
  },

  // --- Ember combinations (4 new) ---
  'ember+dew': {
    id: 'ember+dew',
    name: 'Steam Cloud',
    effect: 'steam_dodge',
    value: 1,
    lore: 'A cloud of scalding steam erupts on dodge. Dodging creates a steam cloud that damages and obscures enemies.',
    secret: false,
    relics: ['ember', 'dew']
  },
  'ember+shadow': {
    id: 'ember+shadow',
    name: 'Smoke Bomb',
    effect: 'smoke_dodge',
    value: 1,
    lore: 'A burst of dark smoke. Dodging leaves behind a smoke screen that makes you harder to hit for 2 seconds.',
    secret: false,
    relics: ['ember', 'shadow']
  },
  'ember+light': {
    id: 'ember+light',
    name: 'Solar Flare',
    effect: 'solar_damage',
    value: 1.35,
    lore: 'The fury of the sun in your hands. Attacks at full health deal 35% more damage.',
    secret: false,
    relics: ['ember', 'light']
  },
  'ember+void': {
    id: 'ember+void',
    name: 'Supernova',
    effect: 'explode_on_kill',
    value: 15,
    lore: 'A dying star\'s final breath. Defeated enemies explode, dealing 15 AOE damage to nearby foes.',
    secret: false,
    relics: ['ember', 'void']
  },

  // --- Dew combinations (3 new) ---
  'dew+shadow': {
    id: 'dew+shadow',
    name: 'Night Dew',
    effect: 'night_regen',
    value: 3,
    lore: 'Dew that only forms in darkness. Health regenerates 3 HP/sec during nighttime.',
    secret: false,
    relics: ['dew', 'shadow']
  },
  'dew+light': {
    id: 'dew+light',
    name: 'Rainbow Prism',
    effect: 'elemental_damage_up',
    value: 1.2,
    lore: 'Light through water creates a rainbow. Elemental attacks (fire, ice, poison) deal 20% more damage.',
    secret: false,
    relics: ['dew', 'light']
  },
  'dew+void': {
    id: 'dew+void',
    name: 'Cosmic Rain',
    effect: 'star_heal',
    value: 2,
    lore: 'Rain from beyond the stars. Standing still gradually heals 2 HP/sec; the effect doubles under open sky.',
    secret: false,
    relics: ['dew', 'void']
  },

  // --- Shadow combinations (2 new) ---
  'shadow+light': {
    id: 'shadow+light',
    name: 'Twilight Balance',
    effect: 'twilight_power',
    value: 1.2,
    lore: 'The power of dawn and dusk. During dawn and dusk, all stats are increased by 20%.',
    secret: false,
    relics: ['shadow', 'light']
  },
  'shadow+void': {
    id: 'shadow+void',
    name: 'Abyssal Shadow',
    effect: 'shadow_damage',
    value: 1.3,
    lore: 'Darkness from the depths of the void. Attacks from behind deal 30% more damage.',
    secret: false,
    relics: ['shadow', 'void']
  },

  // --- Light + Void (1 new) ---
  'light+void': {
    id: 'light+void',
    name: 'Cosmic Balance',
    effect: 'damage_reflect',
    value: 0.3,
    lore: 'The balance of all cosmic forces. Reflect 30% of damage taken back to attackers.',
    secret: false,
    relics: ['light', 'void']
  },

  // ============ SECRET 3-RELIC FUSIONS (10) ============
  'leaf+dew+light': {
    id: 'leaf+dew+light',
    name: 'Photosynthesis',
    effect: 'sun_heal',
    value: 5,
    lore: 'The ultimate secret of life itself. While in sunlight, regenerate 5 HP per second and gain infinite stamina.',
    secret: true,
    relics: ['leaf', 'dew', 'light']
  },
  'ember+void+shadow': {
    id: 'ember+void+shadow',
    name: 'Dark Flame',
    effect: 'life_steal',
    value: 0.2,
    lore: 'A flame that burns darkness itself. Deal 20% of damage dealt as lifesteal, and all attacks ignore shadow-based defenses.',
    secret: true,
    relics: ['ember', 'void', 'shadow']
  },
  'stone+ice+sand': {
    id: 'stone+ice+sand',
    name: 'Eternal Foundation',
    effect: 'cannot_be_moved',
    value: 1,
    lore: 'The bedrock of the world, frozen and weathered through eons. Immune to all knockback, stun, and movement-impairing effects.',
    secret: true,
    relics: ['stone', 'ice', 'sand']
  },
  'leaf+ember+muck': {
    id: 'leaf+ember+muck',
    name: 'Vermillion Bloom',
    effect: 'bloom_explosion',
    value: 25,
    lore: 'A flower of impossible beauty that blooms only in chaos. Every 5th attack creates a massive AOE explosion dealing 25 damage.',
    secret: true,
    relics: ['leaf', 'ember', 'muck']
  },
  'ice+dew+void': {
    id: 'ice+dew+void',
    name: 'Comet Frost',
    effect: 'comet_strike',
    value: 40,
    lore: 'The frozen heart of a comet. Every 10 seconds, a comet falls at your target location dealing 40 AOE damage.',
    secret: true,
    relics: ['ice', 'dew', 'void']
  },
  'sand+light+stone': {
    id: 'sand+light+stone',
    name: 'Monolith of Dawn',
    effect: 'sanctuary',
    value: 1,
    lore: 'An ancient monument to the first sunrise. While standing still, create a sanctuary that blocks all projectiles and heals 3 HP/sec.',
    secret: true,
    relics: ['sand', 'light', 'stone']
  },
  'muck+shadow+ember': {
    id: 'muck+shadow+ember',
    name: 'Hellswamp',
    effect: 'toxic_fire',
    value: 8,
    lore: 'A burning swamp from the deepest pit. Leave a trail of toxic fire that deals 8 damage/sec to enemies who walk through it.',
    secret: true,
    relics: ['muck', 'shadow', 'ember']
  },
  'shadow+ice+dew': {
    id: 'shadow+ice+dew',
    name: 'Black Ice',
    effect: 'shadow_frost',
    value: 10,
    lore: 'Invisible ice that forms in shadow. Create patches of black ice that freeze enemies for 3 seconds when stepped on.',
    secret: true,
    relics: ['shadow', 'ice', 'dew']
  },
  'light+ember+sand': {
    id: 'light+ember+sand',
    name: 'Solar Forge',
    effect: 'solar_armor',
    value: 1,
    lore: 'Armor forged in a stellar furnace. Gain a shield that absorbs 25 damage, regenerating every 15 seconds in sunlight.',
    secret: true,
    relics: ['light', 'ember', 'sand']
  },
  'void+stone+muck': {
    id: 'void+stone+muck',
    name: 'World Root',
    effect: 'world_anchor',
    value: 1,
    lore: 'A root that anchors you to the world\'s core. Cannot be knocked back, and all nearby allies take 15% less damage.',
    secret: true,
    relics: ['void', 'stone', 'muck']
  }
};

/**
 * Effect definitions with apply/remove callbacks for each fusion effect.
 * @constant {Object.<string, FusionEffect>}
 */
const FUSION_EFFECTS = {
  regen_hp: {
    id: 'regen_hp',
    description: 'Regenerate 2 HP per second.',
    apply: (p) => { if (p) p.hpRegen = (p.hpRegen || 0) + 2; },
    remove: (p) => { if (p) p.hpRegen = Math.max(0, (p.hpRegen || 0) - 2); }
  },
  heal_on_sand: {
    id: 'heal_on_sand',
    description: 'Regenerate 1 HP/sec when on sandy terrain.',
    apply: (p) => { if (p) p.healOnSand = true; },
    remove: (p) => { if (p) p.healOnSand = false; }
  },
  poison_aura: {
    id: 'poison_aura',
    description: 'Enemies within 80px take 2 poison damage per second.',
    apply: (p) => { if (p) p.poisonAura = 2; },
    remove: (p) => { if (p) p.poisonAura = 0; }
  },
  freeze_on_hit: {
    id: 'freeze_on_hit',
    description: 'Attacks have a 10% chance to freeze enemies for 1 second.',
    apply: (p) => { if (p) p.freezeChance = (p.freezeChance || 0) + 0.1; },
    remove: (p) => { if (p) p.freezeChance = Math.max(0, (p.freezeChance || 0) - 0.1); }
  },
  fire_regen: {
    id: 'fire_regen',
    description: 'When HP drops below 25%, a fire burst heals 15 HP (60s cooldown).',
    apply: (p) => { if (p) p.fireRegen = true; },
    remove: (p) => { if (p) p.fireRegen = false; }
  },
  morning_heal: {
    id: 'morning_heal',
    description: 'Healing effects are 25% stronger.',
    apply: (p) => { if (p) p.healMultiplier = (p.healMultiplier || 1) * 1.25; },
    remove: (p) => { if (p) p.healMultiplier = (p.healMultiplier || 1) / 1.25; }
  },
  stealth_grass: {
    id: 'stealth_grass',
    description: 'Enemies detect you 30% slower in grassy/forest areas.',
    apply: (p) => { if (p) p.stealthGrass = true; },
    remove: (p) => { if (p) p.stealthGrass = false; }
  },
  light_damage: {
    id: 'light_damage',
    description: 'Damage increased by 15% during daytime.',
    apply: (p) => { if (p) p.dayDamageBonus = (p.dayDamageBonus || 0) + 0.15; },
    remove: (p) => { if (p) p.dayDamageBonus = Math.max(0, (p.dayDamageBonus || 0) - 0.15); }
  },
  life_drain: {
    id: 'life_drain',
    description: 'Defeating enemies restores a small amount of HP.',
    apply: (p) => { if (p) p.lifeDrain = (p.lifeDrain || 0) + 0.05; },
    remove: (p) => { if (p) p.lifeDrain = Math.max(0, (p.lifeDrain || 0) - 0.05); }
  },
  damage_reduction: {
    id: 'damage_reduction',
    description: 'All damage taken reduced by 10%.',
    apply: (p) => { if (p) p.damageReduction = (p.damageReduction || 0) + 0.1; },
    remove: (p) => { if (p) p.damageReduction = Math.max(0, (p.damageReduction || 0) - 0.1); }
  },
  slow_enemies: {
    id: 'slow_enemies',
    description: 'Enemies that hit you are slowed by 20%.',
    apply: (p) => { if (p) p.slowOnHit = true; },
    remove: (p) => { if (p) p.slowOnHit = false; }
  },
  reflect_projectiles: {
    id: 'reflect_projectiles',
    description: '15% chance to reflect projectiles back at attackers.',
    apply: (p) => { if (p) p.projectileReflect = (p.projectileReflect || 0) + 0.15; },
    remove: (p) => { if (p) p.projectileReflect = Math.max(0, (p.projectileReflect || 0) - 0.15); }
  },
  fire_damage_up: {
    id: 'fire_damage_up',
    description: 'Fire attacks deal 20% more damage.',
    apply: (p) => { if (p) p.fireDamageMult = (p.fireDamageMult || 1) * 1.2; },
    remove: (p) => { if (p) p.fireDamageMult = (p.fireDamageMult || 1) / 1.2; }
  },
  water_heal: {
    id: 'water_heal',
    description: 'Finding water sources fully restores HP.',
    apply: (p) => { if (p) p.waterFullHeal = true; },
    remove: (p) => { if (p) p.waterFullHeal = false; }
  },
  invisible_dodge: {
    id: 'invisible_dodge',
    description: 'Dodging grants 1.5 seconds of invisibility.',
    apply: (p) => { if (p) p.invisibleDodge = true; },
    remove: (p) => { if (p) p.invisibleDodge = false; }
  },
  mirage_damage: {
    id: 'mirage_damage',
    description: 'Attacks in bright areas deal 25% more damage.',
    apply: (p) => { if (p) p.brightDamageBonus = (p.brightDamageBonus || 0) + 0.25; },
    remove: (p) => { if (p) p.brightDamageBonus = Math.max(0, (p.brightDamageBonus || 0) - 0.25); }
  },
  slow_time_near_death: {
    id: 'slow_time_near_death',
    description: 'When HP < 15%, time slows for 3 seconds (60s cooldown).',
    apply: (p) => { if (p) p.timeSlowAtLowHP = true; },
    remove: (p) => { if (p) p.timeSlowAtLowHP = false; }
  },
  petrify_chance: {
    id: 'petrify_chance',
    description: '10% chance to petrify enemies on hit for 2 seconds.',
    apply: (p) => { if (p) p.petrifyChance = (p.petrifyChance || 0) + 0.1; },
    remove: (p) => { if (p) p.petrifyChance = Math.max(0, (p.petrifyChance || 0) - 0.1); }
  },
  armor_up: {
    id: 'armor_up',
    description: 'Gain ice armor that absorbs 15 damage per hit.',
    apply: (p) => { if (p) p.iceArmor = (p.iceArmor || 0) + 15; },
    remove: (p) => { if (p) p.iceArmor = Math.max(0, (p.iceArmor || 0) - 15); }
  },
  burning_aura: {
    id: 'burning_aura',
    description: 'Burning aura deals 3 damage/sec to nearby enemies.',
    apply: (p) => { if (p) p.burningAura = (p.burningAura || 0) + 3; },
    remove: (p) => { if (p) p.burningAura = Math.max(0, (p.burningAura || 0) - 3); }
  },
  armor_pierce: {
    id: 'armor_pierce',
    description: 'Attacks ignore 20% of enemy armor.',
    apply: (p) => { if (p) p.armorPierce = (p.armorPierce || 0) + 0.2; },
    remove: (p) => { if (p) p.armorPierce = Math.max(0, (p.armorPierce || 0) - 0.2); }
  },
  stone_skin: {
    id: 'stone_skin',
    description: 'Knockback effects reduced by 30%.',
    apply: (p) => { if (p) p.knockbackResist = (p.knockbackResist || 0) + 0.3; },
    remove: (p) => { if (p) p.knockbackResist = Math.max(0, (p.knockbackResist || 0) - 0.3); }
  },
  crystal_damage: {
    id: 'crystal_damage',
    description: 'Charged attacks deal 30% more damage.',
    apply: (p) => { if (p) p.chargedDamageMult = (p.chargedDamageMult || 1) * 1.3; },
    remove: (p) => { if (p) p.chargedDamageMult = (p.chargedDamageMult || 1) / 1.3; }
  },
  falling_damage: {
    id: 'falling_damage',
    description: 'Ground-pound attacks create a shockwave dealing 20 AOE damage.',
    apply: (p) => { if (p) p.groundPoundDamage = (p.groundPoundDamage || 0) + 20; },
    remove: (p) => { if (p) p.groundPoundDamage = Math.max(0, (p.groundPoundDamage || 0) - 20); }
  },
  slow_on_hit: {
    id: 'slow_on_hit',
    description: 'Attacks slow enemies by 25% for 3 seconds.',
    apply: (p) => { if (p) p.slowOnAttack = true; },
    remove: (p) => { if (p) p.slowOnAttack = false; }
  },
  poison_fire: {
    id: 'poison_fire',
    description: 'Fire attacks apply poison for 5 additional damage.',
    apply: (p) => { if (p) p.firePoison = (p.firePoison || 0) + 5; },
    remove: (p) => { if (p) p.firePoison = Math.max(0, (p.firePoison || 0) - 5); }
  },
  debuff_immunity: {
    id: 'debuff_immunity',
    description: 'Immune to first poison/slow every 10 seconds.',
    apply: (p) => { if (p) p.debuffImmunity = true; },
    remove: (p) => { if (p) p.debuffImmunity = false; }
  },
  fear_aura: {
    id: 'fear_aura',
    description: 'Weak enemies have 15% chance to flee on sight.',
    apply: (p) => { if (p) p.fearAura = true; },
    remove: (p) => { if (p) p.fearAura = false; }
  },
  glow_reveal: {
    id: 'glow_reveal',
    description: 'Hidden passages and secrets become visible.',
    apply: (p) => { if (p) p.revealSecrets = true; },
    remove: (p) => { if (p) p.revealSecrets = false; }
  },
  random_buff: {
    id: 'random_buff',
    description: 'Gain a random buff every 30 seconds.',
    apply: (p) => { if (p) p.randomBuff = true; },
    remove: (p) => { if (p) p.randomBuff = false; }
  },
  elemental_immune: {
    id: 'elemental_immune',
    description: 'Immune to fire and frost damage.',
    apply: (p) => { if (p) p.elementalImmune = true; },
    remove: (p) => { if (p) p.elementalImmune = false; }
  },
  ice_heal: {
    id: 'ice_heal',
    description: 'Successful parries restore 8 HP.',
    apply: (p) => { if (p) p.parryHeal = (p.parryHeal || 0) + 8; },
    remove: (p) => { if (p) p.parryHeal = Math.max(0, (p.parryHeal || 0) - 8); }
  },
  cold_damage_aura: {
    id: 'cold_damage_aura',
    description: 'Nearby enemies take 4 frost damage per second.',
    apply: (p) => { if (p) p.frostAura = (p.frostAura || 0) + 4; },
    remove: (p) => { if (p) p.frostAura = Math.max(0, (p.frostAura || 0) - 4); }
  },
  prism_parry: {
    id: 'prism_parry',
    description: 'Parries create a freezing prism damaging nearby enemies.',
    apply: (p) => { if (p) p.prismParry = true; },
    remove: (p) => { if (p) p.prismParry = false; }
  },
  deep_freeze: {
    id: 'deep_freeze',
    description: 'Frozen enemies stay frozen 50% longer and take 25% more damage.',
    apply: (p) => { if (p) p.deepFreeze = true; },
    remove: (p) => { if (p) p.deepFreeze = false; }
  },
  steam_dodge: {
    id: 'steam_dodge',
    description: 'Dodging creates a damaging steam cloud.',
    apply: (p) => { if (p) p.steamDodge = true; },
    remove: (p) => { if (p) p.steamDodge = false; }
  },
  smoke_dodge: {
    id: 'smoke_dodge',
    description: 'Dodging leaves a smoke screen, +20% dodge for 2s.',
    apply: (p) => { if (p) p.smokeDodge = true; },
    remove: (p) => { if (p) p.smokeDodge = false; }
  },
  solar_damage: {
    id: 'solar_damage',
    description: 'Full HP attacks deal 35% more damage.',
    apply: (p) => { if (p) p.solarDamage = true; },
    remove: (p) => { if (p) p.solarDamage = false; }
  },
  explode_on_kill: {
    id: 'explode_on_kill',
    description: 'Defeated enemies explode for 15 AOE damage.',
    apply: (p) => { if (p) p.explodeOnKill = (p.explodeOnKill || 0) + 15; },
    remove: (p) => { if (p) p.explodeOnKill = Math.max(0, (p.explodeOnKill || 0) - 15); }
  },
  night_regen: {
    id: 'night_regen',
    description: 'Regenerate 3 HP/sec during nighttime.',
    apply: (p) => { if (p) p.nightRegen = (p.nightRegen || 0) + 3; },
    remove: (p) => { if (p) p.nightRegen = Math.max(0, (p.nightRegen || 0) - 3); }
  },
  elemental_damage_up: {
    id: 'elemental_damage_up',
    description: 'Elemental attacks deal 20% more damage.',
    apply: (p) => { if (p) p.elementalDamageMult = (p.elementalDamageMult || 1) * 1.2; },
    remove: (p) => { if (p) p.elementalDamageMult = (p.elementalDamageMult || 1) / 1.2; }
  },
  star_heal: {
    id: 'star_heal',
    description: 'Standing still heals 2 HP/sec (4/sec under open sky).',
    apply: (p) => { if (p) p.starHeal = true; },
    remove: (p) => { if (p) p.starHeal = false; }
  },
  twilight_power: {
    id: 'twilight_power',
    description: 'All stats +20% during dawn and dusk.',
    apply: (p) => { if (p) p.twilightPower = true; },
    remove: (p) => { if (p) p.twilightPower = false; }
  },
  shadow_damage: {
    id: 'shadow_damage',
    description: 'Attacks from behind deal 30% more damage.',
    apply: (p) => { if (p) p.backstabDamageMult = (p.backstabDamageMult || 1) * 1.3; },
    remove: (p) => { if (p) p.backstabDamageMult = (p.backstabDamageMult || 1) / 1.3; }
  },
  damage_reflect: {
    id: 'damage_reflect',
    description: 'Reflect 30% of damage taken to attackers.',
    apply: (p) => { if (p) p.damageReflect = (p.damageReflect || 0) + 0.3; },
    remove: (p) => { if (p) p.damageReflect = Math.max(0, (p.damageReflect || 0) - 0.3); }
  },

  // --- Secret fusion effects ---
  sun_heal: {
    id: 'sun_heal',
    description: 'Regenerate 5 HP/sec in sunlight. Infinite stamina in sunlight.',
    apply: (p) => { if (p) { p.sunHeal = (p.sunHeal || 0) + 5; p.infiniteStaminaInSun = true; } },
    remove: (p) => { if (p) { p.sunHeal = Math.max(0, (p.sunHeal || 0) - 5); p.infiniteStaminaInSun = false; } }
  },
  life_steal: {
    id: 'life_steal',
    description: '20% lifesteal on all attacks.',
    apply: (p) => { if (p) p.lifestealPercent = (p.lifestealPercent || 0) + 0.2; },
    remove: (p) => { if (p) p.lifestealPercent = Math.max(0, (p.lifestealPercent || 0) - 0.2); }
  },
  cannot_be_moved: {
    id: 'cannot_be_moved',
    description: 'Immune to all knockback, stun, and movement-impairing effects.',
    apply: (p) => { if (p) p.cannotBeMoved = true; },
    remove: (p) => { if (p) p.cannotBeMoved = false; }
  },
  bloom_explosion: {
    id: 'bloom_explosion',
    description: 'Every 5th attack creates a massive 25-damage AOE explosion.',
    apply: (p) => { if (p) { p.bloomCounter = 0; p.bloomExplosion = 25; } },
    remove: (p) => { if (p) p.bloomExplosion = 0; }
  },
  comet_strike: {
    id: 'comet_strike',
    description: 'Every 10 seconds, a comet falls at target for 40 AOE damage.',
    apply: (p) => { if (p) { p.cometCooldown = 0; p.cometDamage = 40; } },
    remove: (p) => { if (p) p.cometDamage = 0; }
  },
  sanctuary: {
    id: 'sanctuary',
    description: 'Standing still creates a sanctuary blocking projectiles and healing 3 HP/sec.',
    apply: (p) => { if (p) p.sanctuary = true; },
    remove: (p) => { if (p) p.sanctuary = false; }
  },
  toxic_fire: {
    id: 'toxic_fire',
    description: 'Leave a trail of toxic fire dealing 8 damage/sec.',
    apply: (p) => { if (p) p.toxicFireTrail = 8; },
    remove: (p) => { if (p) p.toxicFireTrail = 0; }
  },
  shadow_frost: {
    id: 'shadow_frost',
    description: 'Create black ice patches that freeze enemies for 3 seconds.',
    apply: (p) => { if (p) p.blackIce = true; },
    remove: (p) => { if (p) p.blackIce = false; }
  },
  solar_armor: {
    id: 'solar_armor',
    description: 'Absorb 25-damage shield regenerating every 15s in sunlight.',
    apply: (p) => { if (p) { p.solarShield = 25; p.solarShieldMax = 25; } },
    remove: (p) => { if (p) { p.solarShield = 0; p.solarShieldMax = 0; } }
  },
  world_anchor: {
    id: 'world_anchor',
    description: 'Immune to knockback. Nearby allies take 15% less damage.',
    apply: (p) => { if (p) { p.cannotBeMoved = true; p.allyProtection = 0.15; } },
    remove: (p) => { if (p) { p.cannotBeMoved = false; p.allyProtection = 0; } }
  }
};

/**
 * Manages relic collection, fusion discovery, and fusion effects.
 * @class RelicFusionSystem
 */
class RelicFusionSystem {
  /**
   * Creates a new RelicFusionSystem.
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxFusionSlots=5] - Maximum active fusion slots
   * @param {Object} [options.player] - Player object to apply effects to
   */
  constructor(options = {}) {
    /** @type {Set<string>} Collected base relic IDs */
    this.collectedRelics = new Set();

    /** @type {Set<string>} Discovered fusion IDs */
    this.discoveredFusions = new Set();

    /** @type {Array<string>} Currently equipped fusion IDs */
    this.equippedFusions = [];

    /** @type {number} Maximum number of fusion slots */
    this.maxFusionSlots = options.maxFusionSlots || 5;

    /** @type {Object|null} Player reference for effect application */
    this.player = options.player || null;

    /** @type {number} Animation timer */
    this.uiAnimationTimer = 0;

    /** @type {number} Total fusions discovered */
    this.totalDiscovered = 0;

    /** @type {number} Secret fusions discovered */
    this.secretsDiscovered = 0;

    /** @type {Function|null} Callback on fusion discover */
    this.onFusionDiscover = options.onFusionDiscover || null;

    this._bindEvents();
  }

  /**
   * Binds to global event bus.
   * @private
   */
  _bindEvents() {
    if (typeof window !== 'undefined' && window.GameEvents) {
      window.GameEvents.on('quest:reward', (data) => {
        if (data.reward && data.reward.type === 'relic') {
          this.collectRelic(data.reward.id);
        }
      });
    }
  }

  /**
   * Collects a base relic.
   * @param {string} relicId - The relic ID to collect
   * @returns {boolean} True if the relic was newly collected
   */
  collectRelic(relicId) {
    if (!BASE_RELICS[relicId]) {
      console.warn(`[RelicFusionSystem] Unknown relic: ${relicId}`);
      return false;
    }

    if (this.collectedRelics.has(relicId)) {
      return false;
    }

    this.collectedRelics.add(relicId);
    this._emitNotification(`Relic Acquired: ${BASE_RELICS[relicId].name}`, 'success');

    // Check if any new fusions are now possible
    const newFusions = this._checkNewFusions();
    for (const fusionId of newFusions) {
      this.discoverFusion(fusionId);
    }

    this._emitEvent('relic:collected', { relicId, name: BASE_RELICS[relicId].name });
    return true;
  }

  /**
   * Checks if a relic has been collected.
   * @param {string} relicId - The relic ID
   * @returns {boolean} True if collected
   */
  hasRelic(relicId) {
    return this.collectedRelics.has(relicId);
  }

  /**
   * Gets all collected relics.
   * @returns {BaseRelic[]} Array of collected relic definitions
   */
  getCollectedRelics() {
    return Array.from(this.collectedRelics).map(id => BASE_RELICS[id]).filter(Boolean);
  }

  /**
   * Gets all uncollected relics.
   * @returns {BaseRelic[]} Array of uncollected relic definitions
   */
  getUncollectedRelics() {
    return Object.values(BASE_RELICS).filter(r => !this.collectedRelics.has(r.id));
  }

  /**
   * Discovers a fusion by its ID or by relic combination.
   * @param {string|string[]} input - Fusion ID or array of relic IDs
   * @returns {FusionDefinition|null} The discovered fusion, or null
   */
  discoverFusion(input) {
    let fusionId;

    if (Array.isArray(input)) {
      // Sort relics alphabetically to form consistent fusion ID
      const sorted = [...input].sort();
      fusionId = sorted.join('+');
    } else {
      fusionId = input;
    }

    const fusion = FUSIONS[fusionId];
    if (!fusion) {
      return null;
    }

    // Check if prerequisites are met
    for (const relicId of fusion.relics) {
      if (!this.collectedRelics.has(relicId)) {
        return null;
      }
    }

    // Already discovered?
    if (this.discoveredFusions.has(fusionId)) {
      return fusion;
    }

    // Discover it
    this.discoveredFusions.add(fusionId);
    this.totalDiscovered++;
    if (fusion.secret) this.secretsDiscovered++;

    this._emitNotification(
      `${fusion.secret ? 'Secret' : 'New'} Fusion: ${fusion.name}!`,
      'success'
    );

    if (this.onFusionDiscover) {
      this.onFusionDiscover(fusion);
    }

    this._emitEvent('fusion:discovered', { fusionId, fusion });

    console.log(`[RelicFusionSystem] Discovered fusion: ${fusion.name} (${fusionId})`);
    return fusion;
  }

  /**
   * Checks which fusions become available with current relics.
   * @returns {string[]} Array of newly discoverable fusion IDs
   * @private
   */
  _checkNewFusions() {
    const newFusions = [];
    for (const [fusionId, fusion] of Object.entries(FUSIONS)) {
      if (this.discoveredFusions.has(fusionId)) continue;
      const hasAllRelics = fusion.relics.every(r => this.collectedRelics.has(r));
      if (hasAllRelics) {
        newFusions.push(fusionId);
      }
    }
    return newFusions;
  }

  /**
   * Gets all fusions that could be made with collected relics.
   * @returns {FusionDefinition[]} Array of available fusion definitions
   */
  getAvailableFusions() {
    const available = [];
    for (const [fusionId, fusion] of Object.entries(FUSIONS)) {
      if (this.discoveredFusions.has(fusionId)) continue;
      const hasAllRelics = fusion.relics.every(r => this.collectedRelics.has(r));
      if (hasAllRelics) {
        available.push(fusion);
      }
    }
    return available;
  }

  /**
   * Gets all discovered fusions.
   * @returns {FusionDefinition[]} Array of discovered fusion definitions
   */
  getDiscoveredFusions() {
    return Array.from(this.discoveredFusions)
      .map(id => FUSIONS[id])
      .filter(Boolean);
  }

  /**
   * Gets all secret discovered fusions.
   * @returns {FusionDefinition[]} Array of secret fusion definitions
   */
  getSecretFusions() {
    return this.getDiscoveredFusions().filter(f => f.secret);
  }

  /**
   * Gets lore text for a specific fusion.
   * @param {string} fusionId - The fusion ID
   * @returns {string} Lore text, or empty string if not found
   */
  getLoreForFusion(fusionId) {
    const fusion = FUSIONS[fusionId];
    return fusion ? fusion.lore : '';
  }

  /**
   * Gets the lore text for a fusion by relic names.
   * @param {string[]} relicIds - Array of relic IDs
   * @returns {string} Lore text
   */
  getLoreForRelics(relicIds) {
    const sorted = [...relicIds].sort();
    const fusionId = sorted.join('+');
    return this.getLoreForFusion(fusionId);
  }

  /**
   * Equips a fusion, applying its effects to the player.
   * @param {string} fusionId - The fusion ID to equip
   * @param {Object} [player] - Player object (uses this.player if not provided)
   * @returns {boolean} True if the fusion was equipped
   */
  equipFusion(fusionId, player) {
    const target = player || this.player;

    if (!this.discoveredFusions.has(fusionId)) {
      console.warn(`[RelicFusionSystem] Fusion not discovered: ${fusionId}`);
      return false;
    }

    if (this.equippedFusions.includes(fusionId)) {
      return false;
    }

    if (this.equippedFusions.length >= this.maxFusionSlots) {
      this._emitNotification('Fusion slots full! Unequip a fusion first.', 'warning');
      return false;
    }

    const fusion = FUSIONS[fusionId];
    if (!fusion) return false;

    // Apply the effect
    this.applyFusionEffects(target, fusionId);

    this.equippedFusions.push(fusionId);
    this._emitNotification(`Equipped: ${fusion.name}`, 'info');

    return true;
  }

  /**
   * Unequips a fusion, removing its effects.
   * @param {string} fusionId - The fusion ID to unequip
   * @param {Object} [player] - Player object
   * @returns {boolean} True if the fusion was unequipped
   */
  unequipFusion(fusionId, player) {
    const target = player || this.player;
    const index = this.equippedFusions.indexOf(fusionId);
    if (index === -1) return false;

    const fusion = FUSIONS[fusionId];
    if (fusion) {
      this.removeFusionEffects(target, fusionId);
    }

    this.equippedFusions.splice(index, 1);
    if (fusion) {
      this._emitNotification(`Unequipped: ${fusion.name}`, 'info');
    }

    return true;
  }

  /**
   * Applies a fusion's effects to the player.
   * @param {Object} player - The player object
   * @param {string} fusionId - The fusion ID
   */
  applyFusionEffects(player, fusionId) {
    if (!player) return;

    const fusion = FUSIONS[fusionId];
    if (!fusion) return;

    const effectDef = FUSION_EFFECTS[fusion.effect];
    if (effectDef) {
      effectDef.apply(player);
    }
  }

  /**
   * Removes a fusion's effects from the player.
   * @param {Object} player - The player object
   * @param {string} fusionId - The fusion ID
   */
  removeFusionEffects(player, fusionId) {
    if (!player) return;

    const fusion = FUSIONS[fusionId];
    if (!fusion) return;

    const effectDef = FUSION_EFFECTS[fusion.effect];
    if (effectDef) {
      effectDef.remove(player);
    }
  }

  /**
   * Gets all currently equipped fusions.
   * @returns {FusionDefinition[]} Array of equipped fusion definitions
   */
  getEquippedFusions() {
    return this.equippedFusions
      .map(id => FUSIONS[id])
      .filter(Boolean);
  }

  /**
   * Gets the number of equipped fusions.
   * @returns {number} Count of equipped fusions
   */
  getEquippedCount() {
    return this.equippedFusions.length;
  }

  /**
   * Gets the number of available fusion slots.
   * @returns {number} Available slots
   */
  getAvailableSlots() {
    return this.maxFusionSlots - this.equippedFusions.length;
  }

  /**
   * Checks if a fusion is currently equipped.
   * @param {string} fusionId - The fusion ID
   * @returns {boolean} True if equipped
   */
  isFusionEquipped(fusionId) {
    return this.equippedFusions.includes(fusionId);
  }

  /**
   * Auto-equips newly discovered fusions if slots available.
   * @param {Object} [player] - Player object
   * @returns {number} Number of fusions auto-equipped
   */
  autoEquipNewFusions(player) {
    const target = player || this.player;
    let equipped = 0;

    for (const fusionId of this.discoveredFusions) {
      if (this.equippedFusions.includes(fusionId)) continue;
      if (this.equippedFusions.length >= this.maxFusionSlots) break;

      if (this.equipFusion(fusionId, target)) {
        equipped++;
      }
    }

    return equipped;
  }

  /**
   * Gets discovery statistics.
   * @returns {Object} Discovery stats
   */
  getDiscoveryStats() {
    const totalFusions = Object.keys(FUSIONS).length;
    const totalNormal = Object.values(FUSIONS).filter(f => !f.secret).length;
    const totalSecret = Object.values(FUSIONS).filter(f => f.secret).length;

    return {
      totalFusions,
      totalNormal,
      totalSecret,
      discovered: this.discoveredFusions.size,
      discoveredNormal: this.getDiscoveredFusions().filter(f => !f.secret).length,
      discoveredSecret: this.secretsDiscovered,
      equipped: this.equippedFusions.length,
      maxSlots: this.maxFusionSlots,
      percentComplete: totalFusions > 0 ? (this.discoveredFusions.size / totalFusions) * 100 : 0
    };
  }

  /**
   * Renders the fusion codex UI.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   * @param {number} options.x - Panel X position
   * @param {number} options.y - Panel Y position
   * @param {number} options.width - Panel width
   * @param {number} options.height - Panel height
   * @param {string} [options.hoveredFusionId] - Currently hovered fusion ID
   * @param {string} [options.filter] - Filter: 'all', 'discovered', 'secret', 'equipped'
   */
  renderFusionCodex(ctx, options) {
    const {
      x, y, width, height,
      hoveredFusionId = null,
      filter = 'all'
    } = options;

    this.uiAnimationTimer += 0.016;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(10, 10, 22, 0.95)';
    ctx.strokeStyle = 'rgba(100, 80, 60, 0.5)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, width, height, 10);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 20px serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fusion Codex', x + width / 2, y + 28);

    // Stats
    const stats = this.getDiscoveryStats();
    ctx.fillStyle = 'rgba(212, 165, 116, 0.7)';
    ctx.font = '12px sans-serif';
    ctx.fillText(
      `${stats.discovered}/${stats.totalFusions} Discovered | ${stats.equipped}/${stats.maxSlots} Equipped`,
      x + width / 2, y + 48
    );

    // Fusion list
    let fusionsToShow = [];
    if (filter === 'discovered') {
      fusionsToShow = this.getDiscoveredFusions();
    } else if (filter === 'secret') {
      fusionsToShow = this.getSecretFusions();
    } else if (filter === 'equipped') {
      fusionsToShow = this.getEquippedFusions();
    } else {
      // Show discovered + available (undiscovered but possible)
      const discovered = this.getDiscoveredFusions();
      const available = this.getAvailableFusions();
      fusionsToShow = [
        ...discovered,
        ...available.map(f => ({ ...f, _undiscovered: true }))
      ];
    }

    const listStartY = y + 62;
    const itemHeight = 42;
    const maxVisible = Math.floor((height - 70) / itemHeight);

    for (let i = 0; i < Math.min(fusionsToShow.length, maxVisible); i++) {
      const fusion = fusionsToShow[i];
      const itemY = listStartY + i * itemHeight;
      const isHovered = hoveredFusionId === fusion.id;
      const isEquipped = this.equippedFusions.includes(fusion.id);
      const isUndiscovered = fusion._undiscovered === true;

      // Background
      if (isHovered) {
        ctx.fillStyle = 'rgba(212, 165, 116, 0.15)';
        this._roundRect(ctx, x + 10, itemY, width - 20, itemHeight - 4, 6);
        ctx.fill();
      }

      // Secret indicator
      if (fusion.secret && !isUndiscovered) {
        ctx.fillStyle = '#7c4dff';
        ctx.fillRect(x + 14, itemY + 8, 3, 22);
      }

      // Equipped indicator
      if (isEquipped) {
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.arc(x + 26, itemY + 19, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fusion name
      if (isUndiscovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'italic 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('??? Unknown Fusion ???', x + 36, itemY + 18);
      } else {
        ctx.fillStyle = fusion.secret ? '#b39ddb' : '#e2c9a8';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(fusion.name, x + 36, itemY + 18);
      }

      // Relic components
      const relicNames = fusion.relics.map(r => {
        const relic = BASE_RELICS[r];
        return relic ? relic.name : r;
      });
      ctx.fillStyle = isUndiscovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(212, 165, 116, 0.6)';
      ctx.font = '11px sans-serif';
      ctx.fillText(relicNames.join(' + '), x + 36, itemY + 34);

      // Effect hint
      if (!isUndiscovered) {
        const effectDef = FUSION_EFFECTS[fusion.effect];
        if (effectDef) {
          ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'right';
          const shortDesc = effectDef.description.length > 35
            ? effectDef.description.substring(0, 32) + '...'
            : effectDef.description;
          ctx.fillText(shortDesc, x + width - 16, itemY + 26);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Renders equipped fusion slots for the HUD.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  renderEquippedSlots(ctx, x, y) {
    const slotSize = 32;
    const gap = 4;
    const totalWidth = this.maxFusionSlots * (slotSize + gap) + gap;

    ctx.save();

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this._roundRect(ctx, x, y, totalWidth, slotSize + gap * 2, 4);
    ctx.fill();

    for (let i = 0; i < this.maxFusionSlots; i++) {
      const slotX = x + gap + i * (slotSize + gap);
      const slotY = y + gap;
      const fusionId = this.equippedFusions[i];

      // Empty slot
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      this._roundRect(ctx, slotX, slotY, slotSize, slotSize, 4);
      ctx.fill();
      ctx.stroke();

      if (fusionId) {
        const fusion = FUSIONS[fusionId];
        if (fusion) {
          // Get primary relic color
          const primaryRelic = BASE_RELICS[fusion.relics[0]];
          const color = primaryRelic ? primaryRelic.color : '#ffffff';

          // Filled slot
          const gradient = ctx.createRadialGradient(
            slotX + slotSize / 2 - 4, slotY + slotSize / 2 - 4, 2,
            slotX + slotSize / 2, slotY + slotSize / 2, slotSize / 2 - 2
          );
          gradient.addColorStop(0, this._lightenColor(color, 30));
          gradient.addColorStop(1, color);

          ctx.fillStyle = gradient;
          this._roundRect(ctx, slotX + 1, slotY + 1, slotSize - 2, slotSize - 2, 3);
          ctx.fill();

          // Fusion initial
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.floor(slotSize / 2)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(fusion.name.charAt(0), slotX + slotSize / 2, slotY + slotSize / 2 + 1);
        }
      }
    }

    ctx.restore();
  }

  /**
   * Updates the fusion system (cooldowns, timers).
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    this.uiAnimationTimer += dt;
  }

  /**
   * Serializes fusion state for saving.
   * @returns {Object} Serialized fusion data
   */
  serialize() {
    return {
      collectedRelics: Array.from(this.collectedRelics),
      discoveredFusions: Array.from(this.discoveredFusions),
      equippedFusions: [...this.equippedFusions],
      totalDiscovered: this.totalDiscovered,
      secretsDiscovered: this.secretsDiscovered
    };
  }

  /**
   * Deserializes fusion state from save data.
   * @param {Object} data - Serialized fusion data
   * @param {Object} [player] - Player to re-apply effects to
   */
  deserialize(data, player) {
    if (!data) return;

    this.collectedRelics = new Set(data.collectedRelics || []);
    this.discoveredFusions = new Set(data.discoveredFusions || []);
    this.totalDiscovered = data.totalDiscovered || this.discoveredFusions.size;
    this.secretsDiscovered = data.secretsDiscovered || 0;

    // Re-equip fusions
    this.equippedFusions = [];
    const target = player || this.player;
    if (data.equippedFusions) {
      for (const fusionId of data.equippedFusions) {
        if (this.discoveredFusions.has(fusionId) && FUSIONS[fusionId]) {
          this.applyFusionEffects(target, fusionId);
          this.equippedFusions.push(fusionId);
        }
      }
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
   * Emits an event on the global event bus.
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
   * Lightens a hex color.
   * @param {string} hex - Hex color
   * @param {number} percent - Percent to lighten
   * @returns {string} Lightened color
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
   * Resets the fusion system to initial state.
   * @param {Object} [player] - Player object to remove effects from
   */
  reset(player) {
    const target = player || this.player;

    // Remove all equipped effects
    for (const fusionId of this.equippedFusions) {
      this.removeFusionEffects(target, fusionId);
    }

    this.collectedRelics.clear();
    this.discoveredFusions.clear();
    this.equippedFusions = [];
    this.totalDiscovered = 0;
    this.secretsDiscovered = 0;
  }

  /**
   * Destroys the fusion system.
   */
  destroy() {
    this.reset();
    this.player = null;
    this.onFusionDiscover = null;
  }
};

window.RelicFusionSystem = RelicFusionSystem;
