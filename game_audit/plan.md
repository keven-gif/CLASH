# Echoes of the Small — Build Plan

## Overview
A 2D action-adventure game where the protagonist Asha can shrink and grow, exploring 6 biomes, fighting enemies with a combo/parry/dodge combat system, collecting items, completing quests, and fusing relics. Features procedural adaptive music, dynamic lighting, particle effects, and a diegetic HUD.

## Architecture
- **Frontend**: HTML5 Canvas 2D game with vanilla JavaScript (no external engines — custom built)
- **Entry Points**: `index.html` (full game with loading/start screens), `preview.html` (standalone instant-play demo)
- **Renderer**: Custom Canvas 2D with lighting system, particle engine, post-processing, color palettes
- **Audio**: Web Audio API procedural adaptive music (4-layer) + SFX
- **World**: 6 biomes with seamless transitions, dungeon generation, weather system

## Stage 1: Architecture & Foundation
- Create project structure matching the user's directory layout
- Build the core game engine: Game.js (game loop, camera, hitstop, screen shake)
- Build Renderer.js (lighting, particles, color palettes, post-processing)
- Build InputManager.js (keyboard, gamepad, touch)
- Build AudioEngine.js (procedural adaptive music 4-layer, SFX)

## Stage 2: World & Entities
- Build WorldManager.js (6 biomes, seamless world, dungeons, weather)
- Build Player.js (Asha: combo, dodge roll, parry, charged attack, scale transformation)
- Build Enemy.js (6 enemy types with 3-phase AI: IDLE→ALERT→AGGRESSIVE)
- Build Boss.js (6 dungeon bosses with 3-phase fights)

## Stage 3: Game Systems
- Build CombatSystem.js (combo tracking, damage calc, hit feel)
- Build ScaleSystem.js (0.8s cinematic scale transition, shrink points)
- Build ItemSystem.js (6 dungeon items with unique mechanics)
- Build QuestSystem.js (18 side quests with world consequences)
- Build RelicFusionSystem.js (60 fusions, 10 secret, lore unlocks)
- Build SaveSystem.js (3-slot + auto-save)
- Build UIManager.js (diegetic HUD, health aura, notifications)

## Stage 4: Integration & Polish
- Build index.html with loading screen, start screen, settings
- Build preview.html standalone demo
- Wire all systems together
- Add visual polish, particle effects, screen transitions
- Balance combat, test all mechanics

## Stage 5: Assets & Content
- Generate game sprites (character, enemies, bosses, items, environments)
- Ensure all 6 biomes have distinct visual identities
- Create sound effects via procedural generation

## Skill Usage
- **vibecoding-general-swarm**: For the overall game architecture and code generation
- Build in stages, validate each, then integrate.
