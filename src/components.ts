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
});

// Player entity
export const Player = createComponent('Player', {
    health: { type: Types.Float32, default: 100.0 },
    maxHealth: { type: Types.Float32, default: 100.0 },
    lastDamageTime: { type: Types.Float32, default: 0.0 },
    isImmortal: { type: Types.Boolean, default: true },
});

// Gun component
export const Gun = createComponent('Gun', {
    ammo: { type: Types.Int16, default: 30 },
    maxAmmo: { type: Types.Int16, default: 30 },
    damage: { type: Types.Float32, default: 35.0 },
    fireRate: { type: Types.Float32, default: 0.18 },
    isReloading: { type: Types.Boolean, default: false },
    reloadTime: { type: Types.Float32, default: 1.8 },
    lastFireTime: { type: Types.Float32, default: 0.0 },
    bombCount: { type: Types.Int16, default: 2 },
});

// Robot enemy component
export const Robot = createComponent('Robot', {
    id: { type: Types.Int16, default: 0 },
    speed: { type: Types.Float32, default: 0.8 },
    health: { type: Types.Float32, default: 50.0 },
    maxHealth: { type: Types.Float32, default: 50.0 },
    attackDamage: { type: Types.Float32, default: 15.0 },
    attackRange: { type: Types.Float32, default: 2.0 },
    attackCooldown: { type: Types.Float32, default: 2.0 },
    lastAttackTime: { type: Types.Float32, default: 0.0 },
    isDead: { type: Types.Boolean, default: false },
});

// Projectile component
export const Projectile = createComponent('Projectile', {
    damage: { type: Types.Float32, default: 25.0 },
    speed: { type: Types.Float32, default: 25.0 },
    direction: { type: Types.Vec3, default: [0, 0, -1] },
    lifetime: { type: Types.Float32, default: 3.0 },
    age: { type: Types.Float32, default: 0.0 },
    owner: { type: Types.Int16, default: 0 },
});

// Bomb component
export const Bomb = createComponent('Bomb', {
    damage: { type: Types.Float32, default: 100.0 },
    radius: { type: Types.Float32, default: 5.0 },
    fuseTime: { type: Types.Float32, default: 2.0 },
    age: { type: Types.Float32, default: 0.0 },
    hasExploded: { type: Types.Boolean, default: false },
});

// UI controller component
export const UIController = createComponent('UIController', {
    type: { type: Types.String, default: "hud" },
});

// Damage effect component
export const DamageEffect = createComponent('DamageEffect', {
    time: { type: Types.Float32, default: 0.0 },
    duration: { type: Types.Float32, default: 0.5 },
});

// Wave spawner component
export const WaveSpawner = createComponent('WaveSpawner', {
    waveNumber: { type: Types.Int16, default: 1 },
    robotsToSpawn: { type: Types.Int16, default: 3 },
    robotsSpawned: { type: Types.Int16, default: 0 },
    robotsAlive: { type: Types.Int16, default: 0 },
    spawnInterval: { type: Types.Float32, default: 2.0 },
    lastSpawnTime: { type: Types.Float32, default: 0.0 },
    isActive: { type: Types.Boolean, default: true },
    isSpawning: { type: Types.Boolean, default: false },
});

// Component to mark entities for removal
export const ToRemove = createComponent('ToRemove', {
    time: { type: Types.Float32, default: 0.0 },
});