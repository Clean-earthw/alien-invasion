//index.TS
import {
  AssetManifest,
  AssetType,
  SessionMode,
  World,
  AssetManager,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  AudioSource,
  DistanceGrabbable,
  MovementMode,
  Interactable,
  PanelUI,
  ScreenSpace,
  LocomotionEnvironment,
  EnvironmentType,
  DomeGradient
} from "@iwsdk/core";

// Import systems
import { RobotSystem } from "./systems/robot-system.js";
import { GunSystem } from "./systems/gun-system.js";
import { ProjectileSystem } from "./systems/projectile-system.js";
import { HealthSystem } from "./systems/health-system.js";
import { WaveSystem } from "./systems/wave-system.js";
import { UISystem } from "./systems/ui-system.js";

// Import components
import { 
  GameState, 
  Player, 
  Gun, 
  WaveSpawner,
  UIController
} from "./components.js";

// Asset manifest - Use environment GLB but keep primitive gun
const assets: AssetManifest = {
  // Environment GLB
  environmentDesk: {
    url: "./glb/spacestation.glb",
    type: AssetType.GLTF,
  },
  
  // Audio Files
  shootSound: {
    url: "./audio/shoot.mp3",
    type: AssetType.Audio,
  },
  reloadSound: {
    url: "./audio/reload.mp3",
    type: AssetType.Audio,
  },
  hitSound: {
    url: "./audio/hit.mp3",
    type: AssetType.Audio,
  },
  explosionSound: {
    url: "./audio/explosion.mp3",
    type: AssetType.Audio,
  },
};

// Create the world with assets
World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveAR,
    offer: "always",
    features: { handTracking: true, layers: true, hitTest: true },
  },
  features: {
    locomotion: { useWorker: false },
    grabbing: true,
    physics: false,
    sceneUnderstanding: true,
  },
}).then((world) => {
  console.log("✅ World created successfully");
  
  const { camera } = world;
  camera.position.set(0, 1.6, 0);

  // Create game state entity
  world.createEntity().addComponent(GameState, {
    isPlaying: true,
    score: 0,
    wave: 1,
    robotsKilled: 0,
    isGameOver: false,
  });

  // Create player entity
  world.createEntity().addComponent(Player, {
    health: 100.0,
    maxHealth: 100.0,
    lastDamageTime: 0.0,
  });

  // Create wave spawner entity
  world.createEntity().addComponent(WaveSpawner, {
    waveNumber: 1,
    robotsToSpawn: 3,
    robotsSpawned: 0,
    spawnInterval: 3.0,
    lastSpawnTime: 0.0,
    isActive: true,
  });

  // Load environment GLB if available
  loadEnvironment(world);

  // Create gun at higher position
  createGun(world);
  

  
  // Register all game systems
  registerSystems(world);
  
  // Hide loading screen
  hideLoadingScreen();
  
  console.log("✅ Game initialized successfully!");
  
}).catch((error) => {
  console.error("❌ Failed to initialize world:", error);
  hideLoadingScreenWithError(error.message);
});

// Load environment GLB
function loadEnvironment(world: any) {
  const envGLTF = AssetManager.getGLTF("environmentDesk");
  if (envGLTF && envGLTF.scene) {
    console.log("✅ Loading environment GLB...");
    const envMesh = envGLTF.scene;
    envMesh.position.set(0, -0.5, -2); // Position environment in front
    envMesh.scale.setScalar(0.8); // Scale down if needed
    envMesh.rotation.y = Math.PI; // Rotate to face player
    
    
    world
      .createTransformEntity(envMesh)
      .addComponent(DomeGradient, {
  sky: [0.53, 0.81, 0.92, 1.0], // Light blue sky
  equator: [0.91, 0.76, 0.65, 1.0], // Warm horizon
  ground: [0.32, 0.32, 0.32, 1.0], // Dark ground
  intensity: 1.0,
})
      .addComponent(LocomotionEnvironment, { 
        type: EnvironmentType.STATIC 
      });
    console.log("✅ Environment loaded successfully");
  } else {
    console.log("⚠️ Environment GLB not found, creating simple floor");
    createFallbackFloor(world);
  }
}



// Fallback floor if GLB fails
function createFallbackFloor(world: any) {
  const floorGeometry = new PlaneGeometry(20, 20);
  const floorMaterial = new MeshStandardMaterial({ 
    color: 0x222233,
    transparent: true,
    opacity: 0.5,
    roughness: 1.0,
    metalness: 0.3
  });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  
  world
    .createTransformEntity(floor)
    .addComponent(LocomotionEnvironment, { 
      type: EnvironmentType.STATIC 
    });
}

// Helper function to create gun entity at higher position
function createGun(world: any) {
  console.log("Creating gun at higher position...");
  
  // Create primitive gun (better looking)
  const gunMesh = new Mesh();
  
  // Main gun body (sci-fi style)
  const bodyGeometry = new BoxGeometry(0.2, 0.08, 0.5);
  const bodyMaterial = new MeshStandardMaterial({ 
    color: 0x1a1a1a,
    metalness: 0.9,
    roughness: 0.1,
    emissive: 0x111111,
    emissiveIntensity: 0.2
  });
  const body = new Mesh(bodyGeometry, bodyMaterial);
  body.position.set(0, 0, -0.25);
  gunMesh.add(body);
  
  // Gun barrel
  const barrelGeometry = new BoxGeometry(0.06, 0.06, 0.6);
  const barrelMaterial = new MeshStandardMaterial({ 
    color: 0x444444,
    metalness: 0.95,
    roughness: 0.05
  });
  const barrel = new Mesh(barrelGeometry, barrelMaterial);
  barrel.position.set(0, 0, -0.55);
  gunMesh.add(barrel);
  
  // Gun handle
  const handleGeometry = new BoxGeometry(0.12, 0.18, 0.12);
  const handleMaterial = new MeshStandardMaterial({ 
    color: 0x222222,
    roughness: 0.7,
    metalness: 0.3
  });
  const handle = new Mesh(handleGeometry, handleMaterial);
  handle.position.set(0, -0.13, -0.1);
  gunMesh.add(handle);
  
  // Gun scope/sight
  const scopeGeometry = new BoxGeometry(0.08, 0.04, 0.1);
  const scopeMaterial = new MeshStandardMaterial({ 
    color: 0x0055ff,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x0033aa,
    emissiveIntensity: 0.3
  });
  const scope = new Mesh(scopeGeometry, scopeMaterial);
  scope.position.set(0, 0.08, -0.1);
  gunMesh.add(scope);
  
  // Energy core/glow
  const coreGeometry = new SphereGeometry(0.03, 8, 8);
  const coreMaterial = new MeshStandardMaterial({ 
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.9
  });
  const core = new Mesh(coreGeometry, coreMaterial);
  core.position.set(0.08, 0, -0.15);
  gunMesh.add(core);
  
  // **RAISED GUN POSITION** - Higher and more comfortable
  gunMesh.position.set(0.25, 0.20, -0.40); // Y raised from -0.10 to 0.20
  
  // Rotation for comfortable right-hand holding
  gunMesh.rotation.set(-0.15, 0.4, 0.05); // Adjusted angles
  
  // Scale
  gunMesh.scale.setScalar(0.9);
  
  // Create gun entity
  const gunEntity = world
    .createTransformEntity(gunMesh)
    .addComponent(Gun, {
      ammo: 30,
      maxAmmo: 30,
      damage: 35.0, // Increased damage
      fireRate: 0.18,
      isReloading: false,
      reloadTime: 1.8,
      lastFireTime: 0.0,
      bombCount: 2,
    })
    .addComponent(Interactable)
    .addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveFromTarget,
      minDistance: 0.2,
      maxDistance: 0.9,
    })
    .addComponent(AudioSource, {
      src: "./audio/shoot.mp3",
      maxInstances: 8,
      volume: 0.8,
    });
  
  console.log("✅ Gun created successfully at position (0.25, 0.20, -0.40)");
  return gunEntity;
}

// // Helper function to create UI
// function createUI(world: any) {
//   try {
//     // HUD Panel
//     world
//       .createTransformEntity()
//       .addComponent(PanelUI, {
//         config: "./ui/hud.json",
//         maxHeight: 0.25,
//         maxWidth: 0.5,
//       })
//       .addComponent(UIController, { type: "hud" })
//       .addComponent(ScreenSpace, {
//         top: "10px",
//         left: "10px",
//         width: "320px",
//         height: "160px",
//       });

//     // Gun Controls Panel
//     world
//       .createTransformEntity()
//       .addComponent(PanelUI, {
//         config: "./ui/gun-controls.json",
//         maxHeight: 0.2,
//         maxWidth: 0.6,
//       })
//       .addComponent(UIController, { type: "gun" })
//       .addComponent(ScreenSpace, {
//         bottom: "25px",
//         left: "50%",
//         width: "360px",
//         height: "130px",
//       });

//     console.log("✅ UI created successfully");
//   } catch (error) {
//     console.warn("⚠️ UI creation failed, creating fallback UI:", error);
//     createFallbackUI();
//   }
// }

// Fallback DOM UI
function createFallbackUI() {
  const hud = document.createElement('div');
  hud.style.cssText = `
    position: fixed;
    top: 15px;
    left: 15px;
    background: linear-gradient(135deg, rgba(0,0,0,0.85), rgba(20,0,40,0.9));
    color: white;
    padding: 20px;
    border-radius: 12px;
    font-family: 'Arial', sans-serif;
    z-index: 1000;
    border: 2px solid #22c55e;
    min-width: 280px;
    backdrop-filter: blur(10px);
  `;
  
  hud.innerHTML = `
    <div style="font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #22c55e; text-align: center;">
      AR ROBOT DEFENSE
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between;">
        <span>SCORE:</span>
        <span id="fallback-score" style="color: #ff4444; font-weight: bold;">0</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>WAVE:</span>
        <span id="fallback-wave" style="color: #44ff44; font-weight: bold;">1</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>HEALTH:</span>
        <span id="fallback-health" style="color: #4488ff; font-weight: bold;">100</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 5px;">
        <span>AMMO:</span>
        <span id="fallback-ammo" style="color: #ffff44; font-weight: bold;">30/30</span>
      </div>
    </div>
    <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); font-size: 12px; color: #aaa;">
      <div>🔫 Grab gun to aim</div>
      <div>🎯 Pull trigger to shoot</div>
      <div>🔄 Press R to reload</div>
    </div>
  `;
  
  document.body.appendChild(hud);
  
  // Controls panel
  const controls = document.createElement('div');
  controls.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    padding: 15px;
    border-radius: 10px;
    z-index: 1000;
    display: flex;
    gap: 10px;
  `;
  
  controls.innerHTML = `
    <button onclick="window.shoot()" style="
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      min-width: 120px;
    ">🔫 SHOOT</button>
    
    <button onclick="window.reload()" style="
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      min-width: 120px;
    ">🔄 RELOAD</button>
  `;
  
  document.body.appendChild(controls);
}

// Helper function to register all systems
function registerSystems(world: any) {
  try {
    world
      .registerSystem(RobotSystem)
      .registerSystem(GunSystem)
      .registerSystem(ProjectileSystem)
      .registerSystem(HealthSystem)
      .registerSystem(WaveSystem)
      .registerSystem(UISystem);
      
    console.log("✅ All game systems registered");
  } catch (error) {
    console.error("❌ Failed to register systems:", error);
  }
}

// Helper function to hide loading screen
function hideLoadingScreen() {
  console.log("Hiding loading screen...");
  const loading = document.getElementById("loading");
  if (loading) {
    loading.style.opacity = "0";
    loading.style.transition = "opacity 0.3s ease-out";
    setTimeout(() => {
      loading.style.display = "none";
      console.log("✅ Loading screen hidden");
    }, 300);
  }
}

function hideLoadingScreenWithError(message: string) {
  const loading = document.getElementById("loading");
  if (loading) {
    loading.innerHTML = `
      <div style="color: #ef4444; text-align: center;">
        <div style="font-size: 24px; margin-bottom: 10px;">⚠️ Error</div>
        <div style="margin-bottom: 20px; font-size: 14px;">${message}</div>
        <button onclick="location.reload()" style="
          background: #ef4444;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
          font-weight: bold;
        ">🔄 Reload Page</button>
      </div>
    `;
  }
}

// COMPONENTS.TS
import { createComponent, Types } from "@iwsdk/core";

// Game state management
export const GameState = createComponent('GameState', {
  isPlaying: { type: Types.Boolean, default: true },
  score: { type: Types.Int16, default: 0 },
  wave: { type: Types.Int16, default: 1 },
  robotsKilled: { type: Types.Int16, default: 0 },
  isGameOver: { type: Types.Boolean, default: false },
});

// Player entity
export const Player = createComponent('Player', {
  health: { type: Types.Float32, default: 100.0 },
  maxHealth: { type: Types.Float32, default: 100.0 },
  lastDamageTime: { type: Types.Float32, default: 0.0 },
});

// Gun component
export const Gun = createComponent('Gun', {
  ammo: { type: Types.Int16, default: 30 },
  maxAmmo: { type: Types.Int16, default: 30 },
  damage: { type: Types.Float32, default: 25.0 },
  fireRate: { type: Types.Float32, default: 0.15 },
  isReloading: { type: Types.Boolean, default: false },
  reloadTime: { type: Types.Float32, default: 2.0 },
  lastFireTime: { type: Types.Float32, default: 0.0 },
  bombCount: { type: Types.Int16, default: 3 },
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

// Bomb/explosion component
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
  robotsToSpawn: { type: Types.Int16, default: 5 },
  robotsSpawned: { type: Types.Int16, default: 0 },
  spawnInterval: { type: Types.Float32, default: 1.0 },
  lastSpawnTime: { type: Types.Float32, default: 0.0 },
  isActive: { type: Types.Boolean, default: true },
});

// Component to mark entities for removal
export const ToRemove = createComponent('ToRemove', {
  time: { type: Types.Float32, default: 0.0 },
});

// AudioSource is built into IWSDK, no need to define here

//SYSTEMS/gun-sstem.ts
import { 
  createSystem, 
  Pressed,
  Vector3,
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
} from "@iwsdk/core";
import { Gun, Projectile, Bomb } from "../components.js";

export class GunSystem extends createSystem({
  guns: {
    required: [Gun]
  },
  gunsPressed: {
    required: [Gun, Pressed]
  }
}) {
  private reloadTimers = new Map<number, number>();
  private shootCooldown = 0;
  private initialized = false;

  init() {
    console.log("🔫 GunSystem initialized");
    this.initialized = true;
    
    // Handle trigger press
    this.queries.gunsPressed.subscribe("qualify", (entity: any) => {
      this.handleShoot(entity);
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        console.log("Space pressed - shooting");
        for (const entity of this.queries.guns.entities) {
          this.handleShoot(entity);
        }
      } else if (e.code === 'KeyR') {
        console.log("R pressed - reloading");
        for (const entity of this.queries.guns.entities) {
          this.reloadGun(entity);
        }
      }
    });
    
    // Mouse controls for desktop testing
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        console.log("Mouse clicked - shooting");
        for (const entity of this.queries.guns.entities) {
          this.handleShoot(entity);
        }
      }
    });
    
    // Touch controls for mobile
    document.addEventListener('touchstart', (e) => {
      console.log("Touch - shooting");
      for (const entity of this.queries.guns.entities) {
        this.handleShoot(entity);
      }
    });
  }

  update(dt: number, time: number) {
    if (!this.initialized) return;
    
    // Update reload timers
    for (const entity of this.queries.guns.entities) {
      const isReloading = entity.getValue(Gun, "isReloading");
      
      if (isReloading && this.reloadTimers.has(entity.index)) {
        const finishTime = this.reloadTimers.get(entity.index)!;
        
        if (time >= finishTime) {
          const maxAmmo = entity.getValue(Gun, "maxAmmo") || 30;
          entity.setValue(Gun, "ammo", maxAmmo);
          entity.setValue(Gun, "isReloading", false);
          this.reloadTimers.delete(entity.index);
          
          console.log("🔄 Reload complete!");
        }
      }
    }
    
    // Update shoot cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }
  }

  private handleShoot(entity: any) {
    if (this.shootCooldown > 0) return;
    
    const ammo = entity.getValue(Gun, "ammo") || 0;
    const isReloading = entity.getValue(Gun, "isReloading") || false;
    const fireRate = entity.getValue(Gun, "fireRate") || 0.2;
    const lastFireTime = entity.getValue(Gun, "lastFireTime") || 0.0;
    
    const currentTime = performance.now() / 1000;
    
    if (!isReloading && ammo > 0 && (currentTime - lastFireTime) >= fireRate) {
      this.fireProjectile(entity, currentTime);
      this.shootCooldown = fireRate;
    } else if (ammo === 0 && !isReloading) {
      console.log("⚠️ Out of ammo!");
      this.reloadGun(entity, currentTime);
    }
  }

  private fireProjectile(entity: any, time: number) {
    const damage = entity.getValue(Gun, "damage") || 25.0;
    const ammo = entity.getValue(Gun, "ammo") || 0;
    
    entity.setValue(Gun, "ammo", ammo - 1);
    entity.setValue(Gun, "lastFireTime", time);
    
    this.createProjectile(entity, damage);
    
    console.log(`🔫 Fired! Ammo: ${ammo - 1}`);
  }

  private reloadGun(entity: any, time?: number) {
    const reloadTime = entity.getValue(Gun, "reloadTime") || 1.5;
    const currentTime = time || performance.now() / 1000;
    const ammo = entity.getValue(Gun, "ammo") || 0;
    const maxAmmo = entity.getValue(Gun, "maxAmmo") || 30;
    
    if (ammo < maxAmmo && !entity.getValue(Gun, "isReloading")) {
      entity.setValue(Gun, "isReloading", true);
      this.reloadTimers.set(entity.index, currentTime + reloadTime);
      console.log("🔄 Reloading...");
    }
  }

  private createProjectile(gunEntity: any, damage: number) {
    const gunObj = gunEntity.object3D;
    if (!gunObj) {
      console.log("❌ Gun object not found");
      return;
    }
    
    // Get gun position and forward direction
    const gunPos = new Vector3();
    gunObj.getWorldPosition(gunPos);
    
    // Get forward direction from gun rotation
    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(gunObj.quaternion);
    forward.normalize();
    
    // Create projectile visual
    const geometry = new SphereGeometry(0.05, 8, 8);
    const material = new MeshStandardMaterial({ 
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0,
    });
    const projectileMesh = new Mesh(geometry, material);
    
    // Position projectile at gun barrel tip
    const barrelOffset = forward.clone().multiplyScalar(0.3);
    projectileMesh.position.copy(gunPos).add(barrelOffset);
    
    // Create projectile entity
    this.world
      .createTransformEntity(projectileMesh)
      .addComponent(Projectile, {
        damage: damage,
        speed: 30.0,
        direction: [forward.x, forward.y, forward.z],
        lifetime: 4.0,
        age: 0.0,
        owner: 0,
      });
    
    console.log("✨ Projectile created");
  }
}

// systems/health-system.ts
import { createSystem, eq } from "@iwsdk/core";
import { Player, DamageEffect, GameState } from "../components.js";

export class HealthSystem extends createSystem({
  player: {
    required: [Player]
  },
  damageEffects: {
    required: [DamageEffect]
  },
  gameState: {
    required: [GameState]
  }
}) {
  update(dt: number, time: number) {
    // Update player health regeneration
    for (const playerEntity of this.queries.player.entities) {
      const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
      const maxHealth = playerEntity.getValue(Player, "maxHealth") || 100.0;
      const lastDamageTime = playerEntity.getValue(Player, "lastDamageTime") || 0.0;
      
      // Regenerate health if not damaged recently (3 seconds)
      if (currentHealth < maxHealth && (time - lastDamageTime) > 3.0) {
        const newHealth = Math.min(maxHealth, currentHealth + 10.0 * dt);
        playerEntity.setValue(Player, "health", newHealth);
      }
      
      // Check for player death
      if (currentHealth <= 0) {
        const gameStateEntities = this.queries.gameState.entities;
        if (gameStateEntities.size > 0) {
          const gameState = Array.from(gameStateEntities)[0];
          gameState.setValue(GameState, "isGameOver", true);
          gameState.setValue(GameState, "isPlaying", false);
          
          console.log("GAME OVER - Player died!");
        }
      }
    }
    
    // Update damage effects (flash red on hit)
    for (const effectEntity of this.queries.damageEffects.entities) {
      const effectTime = effectEntity.getValue(DamageEffect, "time") || 0.0;
      const duration = effectEntity.getValue(DamageEffect, "duration") || 0.5;
      const newTime = effectTime + dt;
      
      effectEntity.setValue(DamageEffect, "time", newTime);
      
      // Visual feedback
      if (effectEntity.object3D) {
        const intensity = Math.max(0, 1.0 - (newTime / duration));
        effectEntity.object3D.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => {
                if (mat.emissive) {
                  mat.emissive.setHex(0xff0000).multiplyScalar(intensity);
                }
              });
            } else if (child.material.emissive) {
              child.material.emissive.setHex(0xff0000).multiplyScalar(intensity);
            }
          }
        });
      }
      
      // Remove effect when duration ends
      if (newTime >= duration) {
        // Reset emissive color
        if (effectEntity.object3D) {
          effectEntity.object3D.traverse((child: any) => {
            if (child.isMesh && child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (mat.emissive) {
                    mat.emissive.setHex(0x000000);
                  }
                });
              } else if (child.material.emissive) {
                child.material.emissive.setHex(0x000000);
              }
            }
          });
        }
        effectEntity.removeComponent(DamageEffect);
      }
    }
  }
}

// systems/projectile-system.ts
import { createSystem, Vector3, Mesh, SphereGeometry, MeshStandardMaterial } from "@iwsdk/core";
import { Projectile, Robot, Bomb, DamageEffect, ToRemove, GameState } from "../components.js";

export class ProjectileSystem extends createSystem({
  activeProjectiles: {
    required: [Projectile],
  },
  activeRobots: {
    required: [Robot],
  },
  activeBombs: {
    required: [Bomb],
  },
  entitiesToRemove: {
    required: [ToRemove],
  },
  gameState: {
    required: [GameState]
  }
}) {
  private tempVec3 = new Vector3();
  private robotPos = new Vector3();
  private explosionEffects: any[] = [];

  update(dt: number, time: number) {
    this.updateProjectiles(dt, time);
    this.updateBombs(dt, time);
    this.updateExplosionEffects(dt);
    this.cleanupEntities();
  }

  private updateProjectiles(dt: number, time: number) {
    for (const projectile of this.queries.activeProjectiles.entities) {
      const projectileObj = projectile.object3D;
      if (!projectileObj) continue;

      const age = projectile.getValue(Projectile, "age") || 0.0;
      const lifetime = projectile.getValue(Projectile, "lifetime") || 5.0;
      const newAge = age + dt;
      
      projectile.setValue(Projectile, "age", newAge);

      if (newAge >= lifetime) {
        // FIXED: Pass the current time parameter correctly
        projectile.addComponent(ToRemove, { time: time });
        continue;
      }

      const speed = projectile.getValue(Projectile, "speed") || 40.0;
      const dir = projectile.getVectorView(Projectile, "direction");
      
      projectileObj.position.x += dir[0] * speed * dt;
      projectileObj.position.y += dir[1] * speed * dt;
      projectileObj.position.z += dir[2] * speed * dt;

      // Create trail effect
      if (Math.random() < 0.3) {
        this.createTrailEffect(projectileObj.position);
      }

      projectileObj.getWorldPosition(this.tempVec3);
      
      for (const robot of this.queries.activeRobots.entities) {
        const isDead = robot.getValue(Robot, "isDead");
        if (isDead) continue;
        
        const robotObj = robot.object3D;
        if (!robotObj) continue;

        robotObj.getWorldPosition(this.robotPos);
        const distance = this.tempVec3.distanceTo(this.robotPos);

        if (distance < 0.5) {
          const damage = projectile.getValue(Projectile, "damage") || 25.0;
          const currentHealth = robot.getValue(Robot, "health") || 50.0;
          const newHealth = Math.max(0, currentHealth - damage);
          
          robot.setValue(Robot, "health", newHealth);
          
          // Create hit effect
          this.createHitEffect(this.tempVec3);
          
          if (!robot.hasComponent(DamageEffect)) {
            robot.addComponent(DamageEffect, {
              time: 0.0,
              duration: 0.2,
            });
          }
          
          if (newHealth <= 0) {
            robot.setValue(Robot, "isDead", true);
            if (robotObj) {
              robotObj.visible = false;
            }
            
            // Create death explosion
            this.createDeathExplosion(this.robotPos);
            
            // Update game state (score) - FIXED: Use query instead of world.entities
            const gameStateEntities = this.queries.gameState.entities;
            if (gameStateEntities.size > 0) {
              const gameState = Array.from(gameStateEntities)[0];
              const currentScore = gameState.getValue(GameState, "score") || 0;
              const killed = gameState.getValue(GameState, "robotsKilled") || 0;
              
              gameState.setValue(GameState, "score", currentScore + 100);
              gameState.setValue(GameState, "robotsKilled", killed + 1);
            }
          }
          
          console.log(`Robot hit! Health: ${newHealth}`);
          
          projectile.addComponent(ToRemove, { time: time });
          break;
        }
      }
    }
  }

  private createTrailEffect(position: Vector3) {
    const trailGeometry = new SphereGeometry(0.015, 4, 4);
    const trailMaterial = new MeshStandardMaterial({ 
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.7
    });
    const trailMesh = new Mesh(trailGeometry, trailMaterial);
    trailMesh.position.copy(position);
    
    const trailEntity = this.world.createTransformEntity(trailMesh);
    
    setTimeout(() => {
      if (trailEntity.object3D && trailEntity.object3D.parent) {
        trailEntity.object3D.parent.remove(trailEntity.object3D);
      }
    }, 200);
  }

  private createHitEffect(position: Vector3) {
    const hitGeometry = new SphereGeometry(0.2, 8, 8);
    const hitMaterial = new MeshStandardMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.9
    });
    const hitMesh = new Mesh(hitGeometry, hitMaterial);
    hitMesh.position.copy(position);
    
    const hitEntity = this.world.createTransformEntity(hitMesh);
    
    setTimeout(() => {
      if (hitEntity.object3D) {
        hitEntity.object3D.scale.setScalar(1.5);
      }
    }, 50);
    
    setTimeout(() => {
      if (hitEntity.object3D && hitEntity.object3D.parent) {
        hitEntity.object3D.parent.remove(hitEntity.object3D);
      }
    }, 300);
  }

  private createDeathExplosion(position: Vector3) {
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
    
    for (let i = 0; i < 8; i++) {
      const particleGeometry = new SphereGeometry(0.1, 4, 4);
      const colorIndex = Math.floor(Math.random() * colors.length);
      const particleMaterial = new MeshStandardMaterial({ 
        color: colors[colorIndex],
        emissive: colors[colorIndex],
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9
      });
      const particleMesh = new Mesh(particleGeometry, particleMaterial);
      particleMesh.position.copy(position);
      
      const dir = new Vector3(
        Math.random() - 0.5,
        Math.random() * 0.5,
        Math.random() - 0.5
      ).normalize();
      
      particleMesh.userData = {
        velocity: dir.multiplyScalar(5 + Math.random() * 5),
        life: 1.0
      };
      
      this.explosionEffects.push({
        mesh: particleMesh,
        velocity: particleMesh.userData.velocity,
        life: 1.0
      });
      
      this.world.createTransformEntity(particleMesh);
    }
  }

  private updateExplosionEffects(dt: number) {
    for (let i = this.explosionEffects.length - 1; i >= 0; i--) {
      const effect = this.explosionEffects[i];
      effect.life -= dt;
      
      if (effect.life <= 0) {
        if (effect.mesh.parent) {
          effect.mesh.parent.remove(effect.mesh);
        }
        this.explosionEffects.splice(i, 1);
        continue;
      }
      
      effect.mesh.position.add(effect.velocity.clone().multiplyScalar(dt));
      effect.velocity.y -= 9.8 * dt * 0.5;
      
      if (effect.mesh.material) {
        effect.mesh.material.opacity = effect.life * 0.8;
        effect.mesh.scale.setScalar(0.8 + effect.life * 0.5);
      }
    }
  }

  private updateBombs(dt: number, time: number) {
    for (const bomb of this.queries.activeBombs.entities) {
      const bombObj = bomb.object3D;
      if (!bombObj) continue;

      const age = bomb.getValue(Bomb, "age") || 0.0;
      const fuseTime = bomb.getValue(Bomb, "fuseTime") || 2.5;
      const newAge = age + dt;
      
      bomb.setValue(Bomb, "age", newAge);

      if (bombObj.userData?.velocity) {
        bombObj.position.add(bombObj.userData.velocity.clone().multiplyScalar(dt));
        bombObj.userData.velocity.y -= 9.8 * dt;
      }

      const pulseScale = 1.0 + Math.sin(newAge * 12) * 0.15;
      bombObj.scale.setScalar(pulseScale);
      
      const hue = (time * 2) % 1;
      bombObj.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.color.setHSL(hue, 1, 0.5);
          child.material.emissive.setHSL(hue, 1, 0.3);
        }
      });

      if (newAge >= fuseTime) {
        this.explodeBomb(bomb, time);
      }
    }
  }

  private explodeBomb(bomb: any, time: number) {
    const bombObj = bomb.object3D;
    if (!bombObj) return;

    bomb.setValue(Bomb, "hasExploded", true);

    bombObj.getWorldPosition(this.tempVec3);
    
    const damage = bomb.getValue(Bomb, "damage") || 100.0;
    const radius = bomb.getValue(Bomb, "radius") || 8.0;

    const explosionGeometry = new SphereGeometry(radius * 0.3, 32, 32);
    const explosionMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.8
    });
    const explosionMesh = new Mesh(explosionGeometry, explosionMaterial);
    explosionMesh.position.copy(this.tempVec3);
    
    explosionMesh.userData = {
      time: 0,
      colors: [0xff0000, 0x00ff00, 0x0000ff]
    };
    
    const explosionEntity = this.world.createTransformEntity(explosionMesh);

    let robotsHit = 0;
    for (const robot of this.queries.activeRobots.entities) {
      const isDead = robot.getValue(Robot, "isDead");
      if (isDead) continue;
      
      const robotObj = robot.object3D;
      if (!robotObj) continue;

      robotObj.getWorldPosition(this.robotPos);
      const distance = this.tempVec3.distanceTo(this.robotPos);

      if (distance <= radius) {
        const falloff = 1.0 - (distance / radius);
        const actualDamage = damage * falloff;
        
        const currentHealth = robot.getValue(Robot, "health") || 50.0;
        const newHealth = Math.max(0, currentHealth - actualDamage);
        
        robot.setValue(Robot, "health", newHealth);
        
        if (!robot.hasComponent(DamageEffect)) {
          robot.addComponent(DamageEffect, {
            time: 0.0,
            duration: 0.5,
          });
        }
        
        if (newHealth <= 0) {
          robot.setValue(Robot, "isDead", true);
          if (robotObj) {
            robotObj.visible = false;
          }
          this.createDeathExplosion(this.robotPos);
          
          // Update score
          const gameStateEntities = this.queries.gameState.entities;
          if (gameStateEntities.size > 0) {
            const gameState = Array.from(gameStateEntities)[0];
            const currentScore = gameState.getValue(GameState, "score") || 0;
            const killed = gameState.getValue(GameState, "robotsKilled") || 0;
            
            gameState.setValue(GameState, "score", currentScore + 100);
            gameState.setValue(GameState, "robotsKilled", killed + 1);
          }
        }
        
        robotsHit++;
      }
    }

    console.log(`Bomb exploded! Hit ${robotsHit} robots`);
    
    let scale = 0.1;
    const animateExplosion = () => {
      scale += 0.3;
      explosionMesh.scale.setScalar(scale);
      
      const colorIndex = Math.floor((Date.now() / 100) % 3);
      explosionMesh.material.color.setHex(explosionMesh.userData.colors[colorIndex]);
      explosionMesh.material.emissive.setHex(explosionMesh.userData.colors[colorIndex]);
      explosionMesh.material.opacity = 0.8 - (scale / 10);
      
      if (scale < 3) {
        requestAnimationFrame(animateExplosion);
      } else {
        if (explosionMesh.parent) {
          explosionMesh.parent.remove(explosionMesh);
        }
      }
    };
    animateExplosion();
    
    bomb.addComponent(ToRemove, { time: time });
  }

  private cleanupEntities() {
    for (const entity of this.queries.entitiesToRemove.entities) {
      if (entity.object3D && entity.object3D.parent) {
        entity.object3D.parent.remove(entity.object3D);
      }
    }
  }
}

// systems/robot-system.ts
import { createSystem, Vector3 } from "@iwsdk/core";
import { Robot, Player, DamageEffect, GameState } from "../components.js";

export class RobotSystem extends createSystem({
  activeRobots: {
    required: [Robot],
  },
  player: {
    required: [Player]
  },
  gameState: {
    required: [GameState]
  }
}) {
  private tempVec3 = new Vector3();
  private playerPos = new Vector3();
  private initialized = false;

  init() {
    console.log("🤖 RobotSystem initialized - Floating space drones");
    this.initialized = true;
  }

  update(dt: number, time: number) {
    if (!this.initialized) return;
    
    // Get player position
    if (this.world.camera) {
      this.world.camera.getWorldPosition(this.playerPos);
    }

    // Update all robots
    for (const robotEntity of this.queries.activeRobots.entities) {
      const isDead = robotEntity.getValue(Robot, "isDead");
      const robotObj = robotEntity.object3D;
      
      if (isDead || !robotObj) continue;

      const speed = robotEntity.getValue(Robot, "speed") || 0.0; // Static floating
      const attackRange = robotEntity.getValue(Robot, "attackRange") || 15.0;
      const attackDamage = robotEntity.getValue(Robot, "attackDamage") || 18.0;
      const attackCooldown = robotEntity.getValue(Robot, "attackCooldown") || 3.5;
      const lastAttackTime = robotEntity.getValue(Robot, "lastAttackTime") || 0.0;

      // FLOATING ANIMATION for space drones
      if (robotObj.userData) {
        const { floatHeight, floatSpeed, rotationSpeed, timeOffset } = robotObj.userData;
        
        // Gentle floating up/down
        robotObj.position.y = floatHeight + Math.sin((time + timeOffset) * floatSpeed) * 0.2;
        
        // Slow rotation (like floating in space)
        robotObj.rotation.y += rotationSpeed;
        robotObj.rotation.x = Math.sin(time * 0.3) * 0.05;
      }
      
      // Get robot position
      robotObj.getWorldPosition(this.tempVec3);
      
      // Calculate distance to player
      const distanceToPlayer = this.tempVec3.distanceTo(this.playerPos);

      // Make drone face player (but keep floating animation)
      if (distanceToPlayer <= 20.0) {
        const lookAtPos = new Vector3(this.playerPos.x, robotObj.position.y, this.playerPos.z);
        const currentRotation = robotObj.rotation.y;
        robotObj.lookAt(lookAtPos);
        
        // Blend rotation to maintain floating feel
        robotObj.rotation.y = currentRotation * 0.7 + robotObj.rotation.y * 0.3;
      }
      
      // Pulsing glow effect for space drones
      const pulseIntensity = 0.4 + Math.sin(time * 1.5) * 0.3;
      robotObj.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (child.material.emissive) {
            // Pulse emissive colors
            const currentColor = child.material.emissive.getHex();
            if (currentColor === 0xff0000 || currentColor === 0x00ffff || currentColor === 0xffff00) {
              child.material.emissiveIntensity = pulseIntensity;
            }
          }
        }
      });

      // Thruster glow effect
      const thrusterPulse = 0.3 + Math.sin(time * 3) * 0.2;
      robotObj.traverse((child: any) => {
        if (child.isMesh && child.material && child.material.emissive) {
          if (child.material.emissive.getHex() === 0x333333) {
            child.material.emissiveIntensity = thrusterPulse;
            // Thruster color cycle
            const hue = (time * 0.5) % 1;
            child.material.emissive.setHSL(hue, 0.8, 0.3);
          }
        }
      });

      // Attack logic if player is in range
      if (distanceToPlayer <= attackRange) {
        if (time - lastAttackTime >= attackCooldown) {
          robotEntity.setValue(Robot, "lastAttackTime", time);
          
          // Damage player
          const playerEntities = this.queries.player.entities;
          if (playerEntities.size > 0) {
            const playerEntity = Array.from(playerEntities)[0];
            const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
            const newHealth = Math.max(0, currentHealth - attackDamage);
            
            playerEntity.setValue(Player, "health", newHealth);
            playerEntity.setValue(Player, "lastDamageTime", time);
            
            // Add damage effect
            if (!playerEntity.hasComponent(DamageEffect)) {
              playerEntity.addComponent(DamageEffect, {
                time: 0.0,
                duration: 0.4,
              });
            }
            
            console.log(`🚀 Space Drone fired! Health: ${newHealth}`);
            
            // Visual feedback - drone flashes brightly when attacking
            robotObj.traverse((child: any) => {
              if (child.isMesh && child.material && child.material.emissive) {
                const originalColor = child.material.emissive.getHex();
                child.material.emissive.setHex(0xffffff);
                child.material.emissiveIntensity = 1.5;
                setTimeout(() => {
                  child.material.emissive.setHex(originalColor);
                  child.material.emissiveIntensity = pulseIntensity;
                }, 200);
              }
            });
          }
        }
      }
      
      // Drone health indicator
      const health = robotEntity.getValue(Robot, "health") || 75.0;
      const maxHealth = robotEntity.getValue(Robot, "maxHealth") || 75.0;
      const healthPercentage = health / maxHealth;
      
      if (healthPercentage < 0.5) {
        // Damaged drones pulse erratically
        const damagePulse = 0.6 + Math.sin(time * 6) * 0.4;
        robotObj.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.emissive) {
            const currentColor = child.material.emissive.getHex();
            if (currentColor === 0x440000 || currentColor === 0xff0000) {
              child.material.emissiveIntensity = damagePulse;
              // Flicker effect for critical damage
              if (healthPercentage < 0.2 && Math.random() > 0.7) {
                child.material.emissiveIntensity = 0;
                setTimeout(() => {
                  child.material.emissiveIntensity = damagePulse;
                }, 50);
              }
            }
          }
        });
      }
    }
  }
}

// systems/ui-system.ts
import { createSystem, PanelUI, PanelDocument } from "@iwsdk/core";
import { UIController, Gun, Player, GameState } from "../components.js";

export class UISystem extends createSystem({
  hudUI: {
    required: [PanelUI, PanelDocument, UIController],
  },
  gunUI: {
    required: [PanelUI, PanelDocument, UIController],
  },
  healthUI: {
    required: [PanelUI, PanelDocument, UIController],
  },
  guns: {
    required: [Gun]
  },
  player: {
    required: [Player]
  },
  gameState: {
    required: [GameState]
  }
}) {
  private gunEntity: any = null;

  init() {
    console.log("UISystem initialized");
    
    // Store gun reference
    this.queries.guns.subscribe("qualify", (entity: any) => {
      this.gunEntity = entity;
    });

    // Setup DOM listeners as fallback
    this.setupDOMListeners();
  }

  private setupDOMListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.id === 'reload-btn' || target.closest('#reload-btn')) {
        if (this.gunEntity) {
          this.triggerReload();
        }
      }
      
      if (target.id === 'bomb-btn' || target.closest('#bomb-btn')) {
        if (this.gunEntity) {
          this.triggerBomb();
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.gunEntity) {
        this.triggerReload();
      }
      if (e.code === 'KeyB' && this.gunEntity) {
        this.triggerBomb();
      }
    });
  }

  private triggerReload() {
    if (this.gunEntity) {
      const isReloading = this.gunEntity.getValue(Gun, "isReloading");
      const ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
      const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
      
      if (!isReloading && ammo < maxAmmo) {
        this.gunEntity.setValue(Gun, "isReloading", true);
        const currentTime = performance.now() / 1000;
        const reloadTime = this.gunEntity.getValue(Gun, "reloadTime") || 2.0;
        
        setTimeout(() => {
          if (this.gunEntity) {
            this.gunEntity.setValue(Gun, "ammo", maxAmmo);
            this.gunEntity.setValue(Gun, "isReloading", false);
            console.log("Reload complete!");
          }
        }, reloadTime * 1000);
      }
    }
  }

  private triggerBomb() {
    if (this.gunEntity) {
      const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 0;
      if (bombCount > 0) {
        this.gunEntity.setValue(Gun, "bombCount", bombCount - 1);
        console.log(`Bomb thrown! ${bombCount - 1} remaining`);
      }
    }
  }

  update() {
    this.updateHUD();
    this.updateGunUI();
    this.updateHealthUI();
  }

  private updateHUD() {
    const gameStateEntities = this.queries.gameState.entities;
    if (gameStateEntities.size === 0) return;

    const gameState = Array.from(gameStateEntities)[0];
    const score = gameState.getValue(GameState, "score") || 0;
    const wave = gameState.getValue(GameState, "wave") || 1;
    const killed = gameState.getValue(GameState, "robotsKilled") || 0;

    // Update DOM elements
    this.updateElement('score-value', score.toString());
    this.updateElement('wave-value', wave.toString());
    this.updateElement('kills-value', killed.toString());
  }

  private updateGunUI() {
    if (!this.gunEntity) return;

    const ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
    const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
    const isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
    const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 3;

    this.updateElement('ammo-value', isReloading ? 'RELOADING...' : `${ammo}/${maxAmmo}`);
    this.updateElement('bomb-count', `x${bombCount}`);
  }

  private updateHealthUI() {
    const playerEntities = this.queries.player.entities;
    if (playerEntities.size === 0) return;

    const player = Array.from(playerEntities)[0];
    const health = player.getValue(Player, "health") || 100;
    const maxHealth = player.getValue(Player, "maxHealth") || 100;

    this.updateElement('health-value', `${Math.round(health)}/${maxHealth}`);
  }

  private updateElement(id: string, value: string) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
    
    // Also update DOM fallback
    const domId = 'dom-' + id;
    const domElement = document.getElementById(domId);
    if (domElement) {
      domElement.textContent = value;
    }
  }
}

// systems/wave-syste,.ts
import { createSystem, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Vector3 } from "@iwsdk/core";
import { WaveSpawner, Robot, GameState } from "../components.js";

export class WaveSystem extends createSystem({
  waveSpawner: {
    required: [WaveSpawner]
  },
  activeRobots: {
    required: [Robot],
  },
  gameState: {
    required: [GameState]
  }
}) {
  private robotCounter = 0;
  private initialized = false;

  init() {
    console.log("🌊 WaveSystem initialized - Robots outside spacestation");
    this.initialized = true;
    
    // Immediately spawn 3 static robots OUTSIDE the spacestation
    setTimeout(() => {
      this.spawnOutsideRobots();
    }, 1000);
  }

  update(dt: number, time: number) {
    if (!this.initialized) return;
    
    const spawnerEntities = this.queries.waveSpawner.entities;
    if (spawnerEntities.size === 0) return;

    const spawner = Array.from(spawnerEntities)[0];
    const waveNumber = spawner.getValue(WaveSpawner, "waveNumber") || 1;
    const robotsToSpawn = spawner.getValue(WaveSpawner, "robotsToSpawn") || 3;
    const robotsSpawned = spawner.getValue(WaveSpawner, "robotsSpawned") || 0;

    // Check if wave is complete (all robots dead)
    let activeRobotCount = 0;
    for (const robot of this.queries.activeRobots.entities) {
      const isDead = robot.getValue(Robot, "isDead");
      if (!isDead) activeRobotCount++;
    }
    
    if (robotsSpawned >= robotsToSpawn && activeRobotCount === 0 && waveNumber === 1) {
      console.log("🎉 All robots eliminated! Spacestation is safe!");
      spawner.setValue(WaveSpawner, "isActive", false);
      
      // Update game state
      const gameStateEntities = this.queries.gameState.entities;
      if (gameStateEntities.size > 0) {
        const gameState = Array.from(gameStateEntities)[0];
        gameState.setValue(GameState, "isGameOver", true);
        console.log("🏆 MISSION ACCOMPLISHED!");
      }
    }
  }

  private spawnOutsideRobots() {
    console.log("🤖 Spawning 3 static robots OUTSIDE the spacestation...");
    
    // Robot positions OUTSIDE the spacestation (in front of it)
    // Spacestation is at z = -8, facing forward
    const outsidePositions = [
      new Vector3(-3.0, 0.5, -5),   // Left side outside
      new Vector3(0, 0.5, -4),      // Center outside (closest)
      new Vector3(3.0, 0.5, -5),    // Right side outside
    ];
    
    for (let i = 0; i < 3; i++) {
      this.createOutsideRobot(outsidePositions[i], i + 1);
    }
    
    // Update spawner state
    const spawnerEntities = this.queries.waveSpawner.entities;
    if (spawnerEntities.size > 0) {
      const spawner = Array.from(spawnerEntities)[0];
      spawner.setValue(WaveSpawner, "robotsSpawned", 3);
      spawner.setValue(WaveSpawner, "isActive", true);
    }
  }

  private createOutsideRobot(position: Vector3, id: number) {
    // Create space drone robot (floating outside spacestation)
    const robotGroup = new Mesh();
    
    // Main body (spherical drone)
    const bodyGeometry = new SphereGeometry(0.6, 16, 16);
    const bodyMaterial = new MeshStandardMaterial({ 
      color: 0xaa3333,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0x440000,
      emissiveIntensity: 0.4
    });
    const body = new Mesh(bodyGeometry, bodyMaterial);
    robotGroup.add(body);
    
    // Central sensor eye
    const eyeGeometry = new SphereGeometry(0.2, 12, 12);
    const eyeMaterial = new MeshStandardMaterial({ 
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.95
    });
    const eye = new Mesh(eyeGeometry, eyeMaterial);
    eye.position.z = 0.5;
    robotGroup.add(eye);
    
    // Thruster pods (4 around the sphere)
    const thrusterGeometry = new CylinderGeometry(0.1, 0.15, 0.3, 8);
    const thrusterMaterial = new MeshStandardMaterial({ 
      color: 0x444444,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x333333,
      emissiveIntensity: 0.2
    });
    
    // Top thruster
    const topThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    topThruster.rotation.x = Math.PI / 2;
    topThruster.position.y = 0.8;
    robotGroup.add(topThruster);
    
    // Bottom thruster
    const bottomThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    bottomThruster.rotation.x = Math.PI / 2;
    bottomThruster.position.y = -0.8;
    robotGroup.add(bottomThruster);
    
    // Left thruster
    const leftThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    leftThruster.rotation.z = Math.PI / 2;
    leftThruster.position.x = -0.8;
    robotGroup.add(leftThruster);
    
    // Right thruster
    const rightThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    rightThruster.rotation.z = Math.PI / 2;
    rightThruster.position.x = 0.8;
    robotGroup.add(rightThruster);
    
    // Antenna/sensor array
    const antennaGeometry = new CylinderGeometry(0.03, 0.03, 0.6, 6);
    const antennaMaterial = new MeshStandardMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.7
    });
    
    const antenna = new Mesh(antennaGeometry, antennaMaterial);
    antenna.position.y = 1.0;
    robotGroup.add(antenna);
    
    // Glowing tip
    const tipGeometry = new SphereGeometry(0.08, 6, 6);
    const tipMaterial = new MeshStandardMaterial({ 
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8
    });
    const tip = new Mesh(tipGeometry, tipMaterial);
    tip.position.y = 1.3;
    robotGroup.add(tip);
    
    // Position robot OUTSIDE spacestation
    robotGroup.position.copy(position);
    
    // Slight floating animation setup
    robotGroup.userData = {
      floatHeight: position.y,
      floatSpeed: 0.5 + Math.random() * 0.3,
      rotationSpeed: 0.002 + Math.random() * 0.001,
      timeOffset: Math.random() * Math.PI * 2
    };
    
    // Scale
    robotGroup.scale.setScalar(0.9);
    
    this.robotCounter++;
    
    // Create robot entity with ZERO SPEED (static/floating)
    this.world
      .createTransformEntity(robotGroup)
      .addComponent(Robot, {
        id: id,
        speed: 0.0, // ZERO SPEED = floating in space
        health: 75.0, // More health for space drones
        maxHealth: 75.0,
        attackDamage: 18.0, // Stronger attacks
        attackRange: 15.0, // Can attack from space distance
        attackCooldown: 3.5, // Moderate attack speed
        lastAttackTime: 0.0,
        isDead: false,
      });
    
    console.log(`🚀 Space Drone #${id} spawned OUTSIDE spacestation at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  }
}