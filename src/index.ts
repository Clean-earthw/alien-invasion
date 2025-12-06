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