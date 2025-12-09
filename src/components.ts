// components.ts (no changes needed - it's correct)
import { createComponent, Types } from "@iwsdk/core";

// Game state management
export const GameState = createComponent('GameState', {
    isPlaying: { type: Types.Boolean, default: true },
    score: { type: Types.Int16, default: 0 },
    wave: { type: Types.Int16, default: 1 },
    robotsKilled: { type: Types.Int16, default: 0 },
    robotsKilledInWave: { type: Types.Int16, default: 0 },
    robotsPerWave: { type: Types.Int16, default: 3 },
    waveCompleted: { type: Types.Boolean, default: false },
    gameOver: { type: Types.Boolean, default: false },
    difficultyMultiplier: { type: Types.Float32, default: 1.0 },
});

// Player entity
export const Player = createComponent('Player', {
    health: { type: Types.Float32, default: 100.0 },
    maxHealth: { type: Types.Float32, default: 100.0 },
    lastDamageTime: { type: Types.Float32, default: 0.0 },
    isImmortal: { type: Types.Boolean, default: false },
    shieldActive: { type: Types.Boolean, default: false },
    shieldTime: { type: Types.Float32, default: 0.0 },
});

// Gun component
export const Gun = createComponent('Gun', {
    ammo: { type: Types.Int16, default: 40 },
    maxAmmo: { type: Types.Int16, default: 40 },
    damage: { type: Types.Float32, default: 40.0 },
    fireRate: { type: Types.Float32, default: 0.15 },
    isReloading: { type: Types.Boolean, default: false },
    reloadTime: { type: Types.Float32, default: 1.5 },
    lastFireTime: { type: Types.Float32, default: 0.0 },
    bombCount: { type: Types.Int16, default: 3 },
    heat: { type: Types.Float32, default: 0.0 },
    maxHeat: { type: Types.Float32, default: 100.0 },
    precision: { type: Types.Float32, default: 0.95 }, // Targeting accuracy
    lockOnSpeed: { type: Types.Float32, default: 1.0 }, // How fast it locks onto targets
});

// Robot enemy component with classification
export const Robot = createComponent('Robot', {
    id: { type: Types.Int16, default: 0 },
    speed: { type: Types.Float32, default: 0.3 },
    health: { type: Types.Float32, default: 100.0 },
    maxHealth: { type: Types.Float32, default: 100.0 },
    attackDamage: { type: Types.Float32, default: 15.0 },
    attackRange: { type: Types.Float32, default: 25.0 },
    attackCooldown: { type: Types.Float32, default: 2.5 },
    lastAttackTime: { type: Types.Float32, default: 0.0 },
    isDead: { type: Types.Boolean, default: false },
    points: { type: Types.Int16, default: 100 },
    type: { type: Types.String, default: "easy" }, // easy, medium, boss
    tier: { type: Types.Int16, default: 1 }, // 1 = easy, 2 = medium, 3 = boss
    lastHitTime: { type: Types.Float32, default: 0.0 },
    scaleMultiplier: { type: Types.Float32, default: 1.0 },
    armor: { type: Types.Float32, default: 0.0 }, // Damage reduction percentage (0-1)
    lockOnDifficulty: { type: Types.Float32, default: 0.5 }, // How easy to lock onto (0=easy, 1=hard)
    targetPriority: { type: Types.Float32, default: 1.0 }, // AI targeting priority
});

// Projectile component
export const Projectile = createComponent('Projectile', {
    damage: { type: Types.Float32, default: 40.0 },
    speed: { type: Types.Float32, default: 30.0 },
    direction: { type: Types.Vec3, default: [0, 0, -1] },
    lifetime: { type: Types.Float32, default: 4.0 },
    age: { type: Types.Float32, default: 0.0 },
    owner: { type: Types.Int16, default: 0 },
    type: { type: Types.String, default: "laser" },
    isGuided: { type: Types.Boolean, default: false },
    targetId: { type: Types.Int16, default: -1 },
});

// Bomb component
export const Bomb = createComponent('Bomb', {
    damage: { type: Types.Float32, default: 100.0 },
    radius: { type: Types.Float32, default: 8.0 },
    fuseTime: { type: Types.Float32, default: 2.0 },
    age: { type: Types.Float32, default: 0.0 },
    hasExploded: { type: Types.Boolean, default: false },
});

// Damage effect component
export const DamageEffect = createComponent('DamageEffect', {
    time: { type: Types.Float32, default: 0.0 },
    duration: { type: Types.Float32, default: 0.3 },
    intensity: { type: Types.Float32, default: 1.0 },
});

// Wave spawner component with robot type distribution
export const WaveSpawner = createComponent('WaveSpawner', {
    waveNumber: { type: Types.Int16, default: 1 },
    robotsToSpawn: { type: Types.Int16, default: 3 },
    robotsSpawned: { type: Types.Int16, default: 0 },
    robotsAlive: { type: Types.Int16, default: 0 },
    spawnInterval: { type: Types.Float32, default: 2.0 },
    lastSpawnTime: { type: Types.Float32, default: 0.0 },
    isActive: { type: Types.Boolean, default: true },
    isSpawning: { type: Types.Boolean, default: false },
    waveStartTime: { type: Types.Float32, default: 0.0 },
    easyCount: { type: Types.Int16, default: 0 },
    mediumCount: { type: Types.Int16, default: 0 },
    bossCount: { type: Types.Int16, default: 0 },
    spawnPattern: { type: Types.String, default: "balanced" }, // balanced, swarm, boss_wave
});

// Component to mark entities for removal
export const ToRemove = createComponent('ToRemove', {
    time: { type: Types.Float32, default: 0.0 },
});

// UI controller component
export const UIController = createComponent('UIController', {
    type: { type: Types.String, default: "hud" },
    lastUpdateTime: { type: Types.Float32, default: 0.0 },
    health: { type: Types.Float32, default: 100.0 },
    score: { type: Types.Int16, default: 0 },
    wave: { type: Types.Int16, default: 1 },
    ammo: { type: Types.Int16, default: 40 },
});

// Custom Sound Component (for tracking our game-specific audio)
export const GameSound = createComponent('GameSound', {
    soundType: { type: Types.String, default: "" }, // shoot, hit, explosion, etc.
    shouldPlay: { type: Types.Boolean, default: false },
    lastPlayTime: { type: Types.Float32, default: 0.0 },
});

// Targeting component for smart gun aiming
export const Targeting = createComponent('Targeting', {
    targetEntityId: { type: Types.Int16, default: -1 },
    targetPosition: { type: Types.Vec3, default: [0, 0, 0] },
    lockOnTime: { type: Types.Float32, default: 0.0 },
    lockOnDuration: { type: Types.Float32, default: 0.5 },
    isLockedOn: { type: Types.Boolean, default: false },
    lockDistance: { type: Types.Float32, default: 40.0 },
    aimAssist: { type: Types.Boolean, default: true },
    aimAssistStrength: { type: Types.Float32, default: 0.8 },
    lockOnProgress: { type: Types.Float32, default: 0.0 }, // 0-1, how close to lock
    preferredTargetType: { type: Types.String, default: "any" }, // any, easy, medium, boss
    targetSwitchingDelay: { type: Types.Float32, default: 0.3 }, // Delay before switching targets
});