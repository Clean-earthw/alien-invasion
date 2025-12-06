/// Kode for improvement 


//Index.ts

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
    CylinderGeometry,
    MeshStandardMaterial,
    AudioSource,
    DistanceGrabbable,
    MovementMode,
    Interactable,
    LocomotionEnvironment,
    EnvironmentType,
    DomeGradient,
    GridHelper,
    Vector3,
    Group,
    Quaternion
} from "@iwsdk/core";

// Import systems
import { RobotSystem } from "./systems/robot-system.js";
import { GunSystem } from "./systems/gun-system.js";
import { ProjectileSystem } from "./systems/projectile-system.js";
import { HealthSystem } from "./systems/health-system.js";
import { WaveSystem } from "./systems/wave-system.js";
import { UISystem } from "./systems/ui-system.js";
import { VROptimizationSystem } from "./systems/vr-optimizations.js";

// Import components
import { 
    GameState, 
    Player, 
    Gun, 
    WaveSpawner
} from "./components.js";

// Asset manifest
const assets: AssetManifest = {
    environmentDesk: {
        url: "./glb/spacestation.glb",
        type: AssetType.GLTF,
    },
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

// Create the world
World.create(document.getElementById("scene-container") as HTMLDivElement, {
    assets,
    xr: {
        sessionMode: SessionMode.ImmersiveVR,
        offer: "always",
        features: { 
            handTracking: true, 
            layers: true, 
            hitTest: true
        }
    },
    features: {
        locomotion: { 
            useWorker: false
        },
        grabbing: true,
        physics: false,
        sceneUnderstanding: true,
    },
    renderer: {
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false
    },
    worldScale: 1.5,
}).then((world) => {
    console.log("✅ World created successfully - DEFEND THE SPACESHIP!");
    
    // Position camera INSIDE the spaceship, facing forward
    const { camera } = world;
    camera.position.set(0, 1.5, 0); // Standard VR height inside ship
    
    // Create game state entity
    world.createEntity().addComponent(GameState, {
        isPlaying: true,
        score: 0,
        wave: 1,
        robotsKilled: 0,
        robotsKilledInWave: 0,
        robotsPerWave: 3,
        waveCompleted: false,
    });

    // Create player entity
    world.createEntity().addComponent(Player, {
        health: 100.0,
        maxHealth: 100.0,
        lastDamageTime: 0.0,
        isImmortal: true,
    });

    // Create wave spawner entity
    world.createEntity().addComponent(WaveSpawner, {
        waveNumber: 1,
        robotsToSpawn: 3,
        robotsSpawned: 0,
        robotsAlive: 0,
        spawnInterval: 2.0,
        lastSpawnTime: 0.0,
        isActive: true,
        isSpawning: false,
    });

    // Load environment
    loadEnvironment(world);

    // Create gun INSIDE the spaceship - positioned for easy interaction
    createGun(world);
    
    // Create space backdrop
    createSpaceEnvironment(world);
    
    // Register all systems
    registerSystems(world);
    
    // Hide loading screen
    hideLoadingScreen();
    
    console.log("✅ Game initialized successfully!");
    
}).catch((error) => {
    console.error("❌ Failed to initialize world:", error);
    hideLoadingScreenWithError(error.message);
});

// Load environment - Spaceship interior
function loadEnvironment(world: any): void {
    const envGLTF = AssetManager.getGLTF("environmentDesk");
    if (envGLTF && envGLTF.scene) {
        console.log("✅ Loading spaceship interior...");
        const envMesh = envGLTF.scene;
        
        // POSITION: Center the spaceship and rotate to face FORWARD (positive Z)
        // Most GLB models are oriented so their front faces positive Z
        envMesh.position.set(0, -1.5, 0); // Center, lowered for VR
        envMesh.scale.setScalar(1.8); // Good size for VR
        
        // NO ROTATION - let the model face its natural forward direction (usually +Z)
        // If the model faces wrong way, try: envMesh.rotation.y = 0;
        console.log("✅ Spaceship loaded at natural orientation");
        
        // Add interior lighting
        world
            .createTransformEntity(envMesh)
            .addComponent(DomeGradient, {
                sky: [0.0, 0.0, 0.05, 1.0], // Very dark space
                equator: [0.1, 0.1, 0.2, 1.0], // Dark horizon
                ground: [0.02, 0.02, 0.04, 1.0], // Very dark ground
                intensity: 0.3,
            })
            .addComponent(LocomotionEnvironment, { 
                type: EnvironmentType.STATIC 
            });
        
        console.log("✅ Spaceship interior loaded - You are INSIDE the ship!");
        
        // Create a large space window where aliens will attack from
        createSpaceWindow(world);
        
        // Add some interior details for context
        createInteriorDetails(world);
    } else {
        console.log("⚠️ Environment GLB not found, creating spaceship cockpit");
        createSpaceshipCockpit(world);
    }
}

// Create space window/portal where aliens attack from
function createSpaceWindow(world: any): void {
    // Create a large window on the "front" of the ship (positive Z direction)
    const windowGeometry = new PlaneGeometry(8, 5);
    const windowMaterial = new MeshStandardMaterial({ 
        color: 0x000022,
        transparent: true,
        opacity: 0.7,
        emissive: 0x002255,
        emissiveIntensity: 0.4,
        side: 2 // Double sided
    });
    
    const spaceWindow = new Mesh(windowGeometry, windowMaterial);
    // Position window in front of player (positive Z)
    spaceWindow.position.set(0, 1.5, 5);
    // Face the window toward the player (negative Z)
    spaceWindow.rotation.y = Math.PI;
    
    world.createTransformEntity(spaceWindow);
    
    // Add stars BEHIND the window (in space)
    const starsGroup = new Group();
    for (let i = 0; i < 150; i++) {
        const starGeometry = new SphereGeometry(0.02 + Math.random() * 0.03, 4, 4);
        const starMaterial = new MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.8 + Math.random() * 0.4
        });
        const star = new Mesh(starGeometry, starMaterial);
        
        // Position stars BEHIND the window (positive Z)
        star.position.set(
            (Math.random() - 0.5) * 25, // X spread
            (Math.random() - 0.5) * 15, // Y spread
            6 + Math.random() * 20 // Z: behind window into space
        );
        
        starsGroup.add(star);
    }
    
    world.createTransformEntity(starsGroup);
    
    console.log("✅ Space window created at Z+ direction - Aliens attack from here!");
}

// Create interior details for context
function createInteriorDetails(world: any): void {
    const interiorGroup = new Group();
    
    // Control console in front of player
    const consoleGeometry = new BoxGeometry(3, 0.8, 1);
    const consoleMaterial = new MeshStandardMaterial({ 
        color: 0x111133,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x001133,
        emissiveIntensity: 0.2
    });
    const controlConsole = new Mesh(consoleGeometry, consoleMaterial);
    controlConsole.position.set(0, 0.4, 2); // In front of player
    interiorGroup.add(controlConsole);
    
    // Add some buttons/lights to the console
    for (let i = 0; i < 6; i++) {
        const buttonGeometry = new SphereGeometry(0.08, 8, 8);
        const buttonMaterial = new MeshStandardMaterial({ 
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.6
        });
        const button = new Mesh(buttonGeometry, buttonMaterial);
        button.position.set(-1 + i * 0.4, 0.9, 2.45);
        interiorGroup.add(button);
    }
    
    world.createTransformEntity(interiorGroup);
}

// Create spaceship cockpit fallback
function createSpaceshipCockpit(world: any): void {
    const cockpitGroup = new Group();
    
    // Cockpit floor
    const floorGeometry = new PlaneGeometry(10, 10);
    const floorMaterial = new MeshStandardMaterial({ 
        color: 0x222233,
        metalness: 0.3,
        roughness: 0.8
    });
    const floor = new Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    cockpitGroup.add(floor);
    
    // Front wall with window (facing positive Z)
    const wallGeometry = new BoxGeometry(10, 4, 0.2);
    const wallMaterial = new MeshStandardMaterial({ 
        color: 0x333344,
        metalness: 0.4,
        roughness: 0.7
    });
    
    const frontWall = new Mesh(wallGeometry, wallMaterial);
    frontWall.position.set(0, 0, 5); // Front wall at Z+5
    cockpitGroup.add(frontWall);
    
    // Window in front wall
    const windowGeometry = new PlaneGeometry(6, 3);
    const windowMaterial = new MeshStandardMaterial({ 
        color: 0x001133,
        transparent: true,
        opacity: 0.8,
        emissive: 0x002255,
        emissiveIntensity: 0.4
    });
    const cockpitWindow = new Mesh(windowGeometry, windowMaterial);
    cockpitWindow.position.set(0, 0.5, 4.9); // Slightly in front of wall
    frontWall.add(cockpitWindow);
    
    // Side walls
    const leftWall = new Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-5, 0, 0);
    leftWall.rotation.y = Math.PI / 2;
    cockpitGroup.add(leftWall);
    
    const rightWall = new Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(5, 0, 0);
    rightWall.rotation.y = Math.PI / 2;
    cockpitGroup.add(rightWall);
    
    // Back wall (behind player)
    const backWall = new Mesh(wallGeometry, wallMaterial);
    backWall.position.set(0, 0, -5); // Back wall at Z-5
    cockpitGroup.add(backWall);
    
    // Control panel in front of player
    const panelGeometry = new BoxGeometry(3, 0.5, 0.3);
    const panelMaterial = new MeshStandardMaterial({ 
        color: 0x111122,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x002244,
        emissiveIntensity: 0.3
    });
    
    const controlPanel = new Mesh(panelGeometry, panelMaterial);
    controlPanel.position.set(0, 0.5, 3); // In front of player
    cockpitGroup.add(controlPanel);
    
    world
        .createTransformEntity(cockpitGroup)
        .addComponent(DomeGradient, {
            sky: [0.0, 0.0, 0.05, 1.0],
            equator: [0.1, 0.1, 0.2, 1.0],
            ground: [0.02, 0.02, 0.04, 1.0],
            intensity: 0.3,
        })
        .addComponent(LocomotionEnvironment, { 
            type: EnvironmentType.STATIC 
        });
        
    console.log("✅ Spaceship cockpit created - Window faces positive Z");
}

// Create space environment
function createSpaceEnvironment(world: any): void {
    // Create distant stars
    const starsGroup = new Group();
    
    for (let i = 0; i < 300; i++) {
        const starGeometry = new SphereGeometry(0.01 + Math.random() * 0.02, 4, 4);
        const starMaterial = new MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.5 + Math.random() * 0.5
        });
        const star = new Mesh(starGeometry, starMaterial);
        
        // Position stars mostly in front of the ship (positive Z)
        const radius = 40 + Math.random() * 80;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        // Bias toward positive Z (in front)
        let z = radius * Math.cos(phi);
        if (z < 20) z = 20 + Math.random() * 60; // Ensure stars are in front
        
        star.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            z
        );
        
        starsGroup.add(star);
    }
    
    world.createTransformEntity(starsGroup);
    
    // Create a distant planet/moon
    const planetGeometry = new SphereGeometry(8, 32, 32);
    const planetMaterial = new MeshStandardMaterial({ 
        color: 0x884400,
        emissive: 0x442200,
        emissiveIntensity: 0.2,
        roughness: 0.9,
        metalness: 0.1
    });
    const planet = new Mesh(planetGeometry, planetMaterial);
    planet.position.set(-30, 5, 80); // Far in front/right
    
    world.createTransformEntity(planet);
    
    console.log("✅ Space environment created - Aliens come from positive Z direction");
}

// Create gun - mounted on ship's turret, facing FORWARD (positive Z)
function createGun(world: any): void {
    console.log("Creating ship's defense turret...");
    
    const gunGroup = new Group();
    
    // Turret base
    const baseGeometry = new CylinderGeometry(0.35, 0.45, 0.25, 8);
    const baseMaterial = new MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    });
    const turretBase = new Mesh(baseGeometry, baseMaterial);
    turretBase.position.y = 0;
    gunGroup.add(turretBase);
    
    // Gun body (horizontal)
    const bodyGeometry = new CylinderGeometry(0.18, 0.22, 1.4, 8);
    const bodyMaterial = new MeshStandardMaterial({ 
        color: 0x1a1a1a,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.2
    });
    const gunBody = new Mesh(bodyGeometry, bodyMaterial);
    gunBody.rotation.x = Math.PI / 2; // Horizontal
    gunBody.position.set(0, 0.1, 0.7); // Extending forward
    gunGroup.add(gunBody);
    
    // Gun barrel (thinner and longer)
    const barrelGeometry = new CylinderGeometry(0.09, 0.09, 1.2, 8);
    const barrelMaterial = new MeshStandardMaterial({ 
        color: 0x555555,
        metalness: 0.95,
        roughness: 0.05,
        emissive: 0x222222,
        emissiveIntensity: 0.1
    });
    const barrel = new Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.1, 1.5); // At the end of gun body
    gunGroup.add(barrel);
    
    // Energy coils (glowing)
    const coilGeometry = new SphereGeometry(0.14, 12, 12);
    const coilMaterial = new MeshStandardMaterial({ 
        color: 0x0088ff,
        emissive: 0x0088ff,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.95
    });
    
    // Add 3 energy coils along the gun
    for (let i = 0; i < 3; i++) {
        const coil = new Mesh(coilGeometry, coilMaterial);
        coil.position.set(0, 0.1, 0.3 + i * 0.4); // Along the gun body
        gunGroup.add(coil);
    }
    
    // Holographic sight (floating)
    const sightGeometry = new BoxGeometry(0.18, 0.1, 0.02);
    const sightMaterial = new MeshStandardMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.8
    });
    const sight = new Mesh(sightGeometry, sightMaterial);
    sight.position.set(0, 0.3, 0.7); // Above the gun
    gunGroup.add(sight);
    
    // Handle/grip for grabbing
    const handleGeometry = new BoxGeometry(0.15, 0.25, 0.08);
    const handleMaterial = new MeshStandardMaterial({ 
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.3
    });
    const handle = new Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, -0.2, 0.3); // Below the gun
    gunGroup.add(handle);
    
    // TRIGGER for visual feedback
    const triggerGeometry = new BoxGeometry(0.05, 0.08, 0.04);
    const triggerMaterial = new MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.3
    });
    const trigger = new Mesh(triggerGeometry, triggerMaterial);
    trigger.position.set(0, -0.15, 0.45); // On the handle
    gunGroup.add(trigger);
    
    // POSITION GUN FOR COMFORTABLE VR INTERACTION
    // Right in front of player, at comfortable height, facing FORWARD (positive Z)
    gunGroup.position.set(0.3, 1.0, -0.5); // Right side, waist height, close
    gunGroup.rotation.set(0, 0, 0); // Facing FORWARD (positive Z)
    gunGroup.scale.setScalar(1.0);
    
    // Create gun entity
    const gunEntity = world
        .createTransformEntity(gunGroup)
        .addComponent(Gun, {
            ammo: 40,
            maxAmmo: 40,
            damage: 40.0,
            fireRate: 0.15,
            isReloading: false,
            reloadTime: 1.5,
            lastFireTime: 0.0,
            bombCount: 3,
        })
        .addComponent(Interactable)
        .addComponent(DistanceGrabbable, {
            movementMode: MovementMode.MoveFromTarget,
            minDistance: 0.1,
            maxDistance: 1.0 // Shorter for precise aiming
        })
        .addComponent(AudioSource, {
            src: "./audio/shoot.mp3",
            maxInstances: 12,
            volume: 0.7,
        });
    
    console.log("✅ Ship's defense turret created!");
    console.log("   Position: Right side, waist height");
    console.log("   Orientation: Facing FORWARD (positive Z)");
    console.log("   Aliens attack from positive Z direction");
    
    return gunEntity;
}

// Register systems
function registerSystems(world: any): void {
    try {
        world
            .registerSystem(RobotSystem)
            .registerSystem(GunSystem)
            .registerSystem(ProjectileSystem)
            .registerSystem(HealthSystem)
            .registerSystem(WaveSystem)
            .registerSystem(UISystem)
            .registerSystem(VROptimizationSystem);
            
        console.log("✅ All game systems registered");
    } catch (error) {
        console.error("❌ Failed to register systems:", error);
    }
}

// Hide loading screen
function hideLoadingScreen(): void {
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

function hideLoadingScreenWithError(message: string): void {
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

// components.ts
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

// systems/gun-system.ts
import { 
    createSystem, 
    Pressed,
    Vector3,
    Mesh,
    SphereGeometry,
    MeshStandardMaterial,
    Entity,
    Object3D
} from "@iwsdk/core";
import { Gun, Projectile } from "../components.js";

// Fixed: Added second type argument for config
export class GunSystem extends createSystem(
    {
        guns: {
            required: [Gun]
        },
        gunsPressed: {
            required: [Gun, Pressed]
        }
    },
    {
        // Optional config parameters
    }
) {
    private reloadTimers = new Map<number, number>();
    private shootCooldown = 0;
    private gunEntity: Entity | null = null;

    init(): void {
        console.log("🔫 GunSystem initialized");
        
        // Store gun reference
        this.queries.guns.subscribe("qualify", (entity: Entity) => {
            this.gunEntity = entity;
        });

        // Handle trigger press
        this.queries.gunsPressed.subscribe("qualify", (entity: Entity) => {
            this.handleShoot(entity);
        });

        // Keyboard controls
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                for (const entity of this.queries.guns.entities) {
                    this.handleShoot(entity);
                }
            } else if (e.code === 'KeyR') {
                for (const entity of this.queries.guns.entities) {
                    this.reloadGun(entity);
                }
            } else if (e.code === 'KeyB') {
                this.spawnBomb();
            }
        });
        
        // Mouse controls
        document.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 0) {
                for (const entity of this.queries.guns.entities) {
                    this.handleShoot(entity);
                }
            }
        });
        
        // Connect to VR buttons
        (window as any).triggerShoot = () => {
            for (const entity of this.queries.guns.entities) {
                this.handleShoot(entity);
            }
        };
        
        (window as any).triggerReload = () => {
            for (const entity of this.queries.guns.entities) {
                this.reloadGun(entity);
            }
        };
    }

    update(dt: number, time: number): void {        
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

    private handleShoot(entity: Entity): void {
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

    private fireProjectile(entity: Entity, time: number): void {
        const damage = entity.getValue(Gun, "damage") || 25.0;
        const ammo = entity.getValue(Gun, "ammo") || 0;
        
        entity.setValue(Gun, "ammo", ammo - 1);
        entity.setValue(Gun, "lastFireTime", time);
        
        this.createProjectile(entity, damage);
        
        console.log(`🔫 Fired! Ammo: ${ammo - 1}`);
    }

    private reloadGun(entity: Entity, time?: number): void {
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

    private createProjectile(gunEntity: Entity, damage: number): void {
        const gunObj = gunEntity.object3D;
        if (!gunObj) {
            console.log("❌ Gun object not found");
            return;
        }
        
        // Get gun position and forward direction
        const gunPos = new Vector3();
        gunObj.getWorldPosition(gunPos);
        
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

    private spawnBomb(): void {
        console.log("💣 Bomb spawned (feature to be implemented)");
        // Bomb implementation would go here
    }
}

// systems.health-system.ts
import { createSystem, Entity } from "@iwsdk/core";
import { Player, DamageEffect } from "../components.js";

export class HealthSystem extends createSystem(
    {
        player: {
            required: [Player]
        },
        damageEffects: {
            required: [DamageEffect]
        }
    },
    {
        // Optional config parameters
    }
) {
    update(dt: number, time: number): void {
        // Update player health (IMMORTAL)
        for (const playerEntity of this.queries.player.entities) {
            const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
            const maxHealth = playerEntity.getValue(Player, "maxHealth") || 100.0;
            const lastDamageTime = playerEntity.getValue(Player, "lastDamageTime") || 0.0;
            const isImmortal = playerEntity.getValue(Player, "isImmortal") || true;
            
            // IMMORTALITY: Never die, reset to 1 health if would die
            if (currentHealth <= 0 && isImmortal) {
                playerEntity.setValue(Player, "health", 1.0);
                console.log("✨ Player is immortal! Health reset to 1.");
                
                this.createImmortalityEffect();
            }
            
            // Fast regeneration when not recently damaged
            if (currentHealth < maxHealth && (time - lastDamageTime) > 1.5) {
                const regenRate = currentHealth < 30 ? 25.0 : 15.0;
                const newHealth = Math.min(maxHealth, currentHealth + regenRate * dt);
                playerEntity.setValue(Player, "health", newHealth);
            }
        }
        
        // Update damage effects
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

    private createImmortalityEffect(): void {
        const camera = this.world.camera;
        if (!camera) return;
        
        const flashDiv = document.createElement('div');
        flashDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
            z-index: 9999;
            pointer-events: none;
            animation: fadeOut 0.5s forwards;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(flashDiv);
        
        setTimeout(() => {
            if (flashDiv.parentNode) {
                flashDiv.parentNode.removeChild(flashDiv);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 500);
    }
}

// systems/projectile-system.ts
import { createSystem, Vector3, Mesh, SphereGeometry, MeshStandardMaterial, Entity } from "@iwsdk/core";
import { Projectile, Robot, Bomb, DamageEffect, ToRemove, GameState } from "../components.js";

export class ProjectileSystem extends createSystem(
    {
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
    },
    {
        // Optional config parameters
    }
) {
    private tempVec3 = new Vector3();
    private robotPos = new Vector3();
    private explosionEffects: Array<{mesh: Mesh, velocity: Vector3, life: number}> = [];

    update(dt: number, time: number): void {
        this.updateProjectiles(dt, time);
        this.updateBombs(dt, time);
        this.updateExplosionEffects(dt);
        this.cleanupEntities();
    }

    private updateProjectiles(dt: number, time: number): void {
        for (const projectile of this.queries.activeProjectiles.entities) {
            const projectileObj = projectile.object3D;
            if (!projectileObj) continue;

            const age = projectile.getValue(Projectile, "age") || 0.0;
            const lifetime = projectile.getValue(Projectile, "lifetime") || 5.0;
            const newAge = age + dt;
            
            projectile.setValue(Projectile, "age", newAge);

            if (newAge >= lifetime) {
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
                            (robotObj as any).visible = false;
                        }
                        
                        // Create death explosion
                        this.createDeathExplosion(this.robotPos);
                        
                        // Update game state
                        const gameStateEntities = Array.from(this.queries.gameState.entities);
                        if (gameStateEntities.length > 0) {
                            const gameState = gameStateEntities[0];
                            const currentScore = gameState.getValue(GameState, "score") || 0;
                            const killed = gameState.getValue(GameState, "robotsKilled") || 0;
                            const killedInWave = gameState.getValue(GameState, "robotsKilledInWave") || 0;
                            const waveNumber = gameState.getValue(GameState, "wave") || 1;
                            
                            const baseScore = 100;
                            const waveMultiplier = 1 + (waveNumber * 0.25);
                            const scoreEarned = Math.floor(baseScore * waveMultiplier);
                            
                            gameState.setValue(GameState, "score", currentScore + scoreEarned);
                            gameState.setValue(GameState, "robotsKilled", killed + 1);
                            gameState.setValue(GameState, "robotsKilledInWave", killedInWave + 1);
                            
                            console.log(`🎯 Robot destroyed! +${scoreEarned} points`);
                            this.showFloatingScore(this.robotPos, scoreEarned);
                        }
                    }
                    
                    console.log(`Robot hit! Health: ${newHealth}`);
                    
                    projectile.addComponent(ToRemove, { time: time });
                    break;
                }
            }
        }
    }

    private createTrailEffect(position: Vector3): void {
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

    private createHitEffect(position: Vector3): void {
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

    private createDeathExplosion(position: Vector3): void {
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

    private updateExplosionEffects(dt: number): void {
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
                (effect.mesh.material as MeshStandardMaterial).opacity = effect.life * 0.8;
                effect.mesh.scale.setScalar(0.8 + effect.life * 0.5);
            }
        }
    }

    private updateBombs(dt: number, time: number): void {
        // Bomb implementation would go here
    }

    private cleanupEntities(): void {
        for (const entity of this.queries.entitiesToRemove.entities) {
            if (entity.object3D && entity.object3D.parent) {
                entity.object3D.parent.remove(entity.object3D);
            }
        }
    }

    private showFloatingScore(position: Vector3, score: number): void {
        const scoreDiv = document.createElement('div');
        scoreDiv.style.cssText = `
            position: fixed;
            color: #ffff00;
            font-family: 'Arial', sans-serif;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            z-index: 1000;
            pointer-events: none;
            transition: transform 1s, opacity 1s;
        `;
        
        scoreDiv.textContent = `+${score}`;
        document.body.appendChild(scoreDiv);
        
        const screenX = 50 + Math.random() * 20;
        const screenY = 50 + Math.random() * 20;
        
        scoreDiv.style.left = `${screenX}%`;
        scoreDiv.style.top = `${screenY}%`;
        
        setTimeout(() => {
            scoreDiv.style.transform = `translateY(-50px)`;
            scoreDiv.style.opacity = '0';
            setTimeout(() => {
                if (scoreDiv.parentNode) {
                    scoreDiv.parentNode.removeChild(scoreDiv);
                }
            }, 1000);
        }, 10);
    }
}

// systems/robot-system.ts
import { createSystem, Vector3, Entity } from "@iwsdk/core";
import { Robot, Player, DamageEffect } from "../components.js";

export class RobotSystem extends createSystem(
    {
        activeRobots: {
            required: [Robot],
        },
        player: {
            required: [Player]
        }
    },
    {
        // Optional config parameters
    }
) {
    private tempVec3 = new Vector3();
    private playerPos = new Vector3();

    init(): void {
        console.log("🤖 RobotSystem initialized");
    }

  update(dt: number, time: number): void {        
    // Get player/camera position (approx 0,1.5,0)
    const playerPos = new Vector3(0, 1.5, 0);
    if (this.world.camera) {
        this.world.camera.getWorldPosition(playerPos);
    }

    // Update all alien drones
    for (const robotEntity of this.queries.activeRobots.entities) {
        const isDead = robotEntity.getValue(Robot, "isDead");
        const robotObj = robotEntity.object3D;
        
        if (isDead || !robotObj) continue;

        // Get alien floating animation data
        const floatData = (robotObj as any).userData;
        
        if (floatData) {
            const { floatHeight, floatSpeed, timeOffset, bobAmount } = floatData;
            
            // Alien floating behavior - gentle up/down
            robotObj.position.y = floatHeight + Math.sin((time + timeOffset) * floatSpeed) * bobAmount;
            
            // Slow rotation
            robotObj.rotation.y += 0.001;
        }
        
        // Get alien position
        const alienPos = new Vector3();
        robotObj.getWorldPosition(alienPos);
        
        // Calculate distance to player
        const distanceToPlayer = alienPos.distanceTo(playerPos);
        
        // IMPORTANT: Make alien face the player at all times
        // Player is at lower Z, aliens at higher Z
        // So aliens should look toward NEGATIVE Z
        const lookAtPos = new Vector3(playerPos.x, playerPos.y * 0.8, playerPos.z);
        robotObj.lookAt(lookAtPos);
        
        // Pulsing glow effect
        const pulseIntensity = 0.6 + Math.sin(time * 2.0) * 0.3;
        
        robotObj.traverse((child: any) => {
            if (child.isMesh && child.material) {
                if (child.material.emissive) {
                    (child.material as any).emissiveIntensity = pulseIntensity;
                }
            }
        });
        
        // Attack logic
        const attackRange = robotEntity.getValue(Robot, "attackRange") || 25.0;
        const attackCooldown = robotEntity.getValue(Robot, "attackCooldown") || 2.5;
        const lastAttackTime = robotEntity.getValue(Robot, "lastAttackTime") || 0.0;
        
        // Check if alien can see player (roughly)
        // Player is around (0,1.5,0), aliens are at positive Z
        const canSeePlayer = alienPos.z > 5 && Math.abs(alienPos.x) < 15;
        
        if (canSeePlayer && distanceToPlayer <= attackRange) {
            if (time - lastAttackTime >= attackCooldown) {
                robotEntity.setValue(Robot, "lastAttackTime", time);
                
                // Damage player
                const playerEntities = Array.from(this.queries.player.entities);
                if (playerEntities.length > 0) {
                    const playerEntity = playerEntities[0];
                    const attackDamage = robotEntity.getValue(Robot, "attackDamage") || 15.0;
                    const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
                    const newHealth = Math.max(0, currentHealth - attackDamage);
                    
                    playerEntity.setValue(Player, "health", newHealth);
                    playerEntity.setValue(Player, "lastDamageTime", time);
                    
                    // Add damage effect
                    if (!playerEntity.hasComponent(DamageEffect)) {
                        playerEntity.addComponent(DamageEffect, {
                            time: 0.0,
                            duration: 0.3,
                        });
                    }
                    
                    // Visual feedback: alien flashes red
                    robotObj.traverse((child: any) => {
                        if (child.isMesh && child.material && child.material.emissive) {
                            const originalColor = (child.material as any).emissive.getHex();
                            (child.material as any).emissive.setHex(0xff0000);
                            (child.material as any).emissiveIntensity = 2.5;
                            setTimeout(() => {
                                (child.material as any).emissive.setHex(originalColor);
                            }, 200);
                        }
                    });
                    
                    console.log(`👽 Alien #${robotEntity.getValue(Robot, "id")} fired!`);
                }
            }
        }
        
        // Alien movement: slowly approach if far away
        const speed = robotEntity.getValue(Robot, "speed") || 0.3;
        if (alienPos.z > 8 && distanceToPlayer > 15) {
            // Move toward player but stay in front
            const moveAmount = speed * dt;
            alienPos.z -= moveAmount * 0.7; // Move toward negative Z
            alienPos.x += (Math.random() - 0.5) * moveAmount * 0.3; // Slight lateral movement
            robotObj.position.copy(alienPos);
        }
    }
}
}

// systems/ui-system.ts
import { createSystem, Entity } from "@iwsdk/core";
import { UIController, Gun, Player, GameState } from "../components.js";

export class UISystem extends createSystem(
    {
        hudUI: {
            required: [UIController]
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
    },
    {
        // Optional config parameters
    }
) {
    private gunEntity: Entity | null = null;

    init(): void {
        console.log("UISystem initialized");
        
        // Store gun reference
        this.queries.guns.subscribe("qualify", (entity: Entity) => {
            this.gunEntity = entity;
        });

        this.setupDOMListeners();
    }

    private setupDOMListeners(): void {
        document.addEventListener('click', (e: MouseEvent) => {
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

        // Connect to global functions
        (window as any).triggerReload = () => {
            if (this.gunEntity) {
                this.triggerReload();
            }
        };
        
        (window as any).triggerBomb = () => {
            if (this.gunEntity) {
                this.triggerBomb();
            }
        };
    }

    private triggerReload(): void {
        if (this.gunEntity) {
            const isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
            const ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
            const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
            
            if (!isReloading && ammo < maxAmmo) {
                this.gunEntity.setValue(Gun, "isReloading", true);
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

    private triggerBomb(): void {
        if (this.gunEntity) {
            const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 0;
            if (bombCount > 0) {
                this.gunEntity.setValue(Gun, "bombCount", bombCount - 1);
                console.log(`Bomb thrown! ${bombCount - 1} remaining`);
            }
        }
    }

    update(): void {
        this.updateHUD();
    }

    private updateHUD(): void {
        // Update Game State
        const gameStateEntities = Array.from(this.queries.gameState.entities);
        if (gameStateEntities.length === 0) return;

        const gameState = gameStateEntities[0];
        const score = gameState.getValue(GameState, "score") || 0;
        const wave = gameState.getValue(GameState, "wave") || 1;
        const killed = gameState.getValue(GameState, "robotsKilled") || 0;
        const killedInWave = gameState.getValue(GameState, "robotsKilledInWave") || 0;
        const robotsPerWave = gameState.getValue(GameState, "robotsPerWave") || 3;
        const waveCompleted = gameState.getValue(GameState, "waveCompleted") || false;
        
        // Update Player Health
        const playerEntities = Array.from(this.queries.player.entities);
        let health = 100;
        if (playerEntities.length > 0) {
            const player = playerEntities[0];
            health = Math.max(1, player.getValue(Player, "health") || 100);
        }
        
        // Update Gun Info
        let ammo = 0;
        let maxAmmo = 30;
        let bombCount = 0;
        let isReloading = false;
        
        if (this.gunEntity) {
            ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
            maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
            bombCount = this.gunEntity.getValue(Gun, "bombCount") || 0;
            isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
        }
        
        // Calculate wave progress
        const progress = robotsPerWave > 0 ? 
            Math.min(100, Math.floor((killedInWave / robotsPerWave) * 100)) : 0;
        
        // Update DOM elements
        this.updateElement('score-value', score.toString());
        this.updateElement('wave-value', `Wave ${wave}`);
        this.updateElement('kills-value', killed.toString());
        this.updateElement('health-value', `${Math.round(health)}/100`);
        this.updateElement('ammo-value', isReloading ? 'RELOADING...' : `${ammo}/${maxAmmo}`);
        this.updateElement('bomb-value', bombCount.toString());
        this.updateElement('wave-progress', `${killedInWave}/${robotsPerWave}`);
        
        // Update progress bar
        const progressBar = document.getElementById('wave-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.style.backgroundColor = progress === 100 ? '#22c55e' : '#3b82f6';
        }
        
        // Show/hide wave complete indicator
        const waveComplete = document.getElementById('wave-complete');
        if (waveComplete) {
            waveComplete.style.display = waveCompleted ? 'block' : 'none';
        }
    }

    private updateElement(id: string, value: string): void {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

// systems/wave-system.ts
import { createSystem, Mesh, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Vector3, Entity } from "@iwsdk/core";
import { WaveSpawner, Robot, GameState } from "../components.js";

export class WaveSystem extends createSystem(
    {
        waveSpawner: {
            required: [WaveSpawner]
        },
        activeRobots: {
            required: [Robot],
        },
        gameState: {
            required: [GameState]
        }
    },
    {
        // Optional config parameters
    }
) {
    private robotCounter = 0;
    private initialized = false;
    private waveCompleted = false;
    private waveStartDelay = 3000;
    private waveDifficulty = {
        robotHealth: 50,
        robotDamage: 15,
        robotSpeed: 0.5,
        waveNumber: 1
    };

    init(): void {
        console.log("🌊 WaveSystem initialized - ENDLESS WAVES!");
        this.initialized = true;
        
        setTimeout(() => {
            this.startWave(1);
        }, 2000);
    }

    update(dt: number, time: number): void {
        if (!this.initialized) return;
        
        const spawnerEntities = Array.from(this.queries.waveSpawner.entities);
        const gameStateEntities = Array.from(this.queries.gameState.entities);
        
        if (spawnerEntities.length === 0 || gameStateEntities.length === 0) return;

        const spawner = spawnerEntities[0];
        const gameState = gameStateEntities[0];
        
        const waveNumber = spawner.getValue(WaveSpawner, "waveNumber") || 1;
        const robotsToSpawn = spawner.getValue(WaveSpawner, "robotsToSpawn") || 3;
        const robotsSpawned = spawner.getValue(WaveSpawner, "robotsSpawned") || 0;
        const isSpawning = spawner.getValue(WaveSpawner, "isSpawning") || false;
        const lastSpawnTime = spawner.getValue(WaveSpawner, "lastSpawnTime") || 0.0;
        const spawnInterval = spawner.getValue(WaveSpawner, "spawnInterval") || 2.0;

        // Count alive robots
        let aliveRobots = 0;
        for (const robot of this.queries.activeRobots.entities) {
            const isDead = robot.getValue(Robot, "isDead");
            if (!isDead) aliveRobots++;
        }
        
        // Update robotsAlive count
        spawner.setValue(WaveSpawner, "robotsAlive", aliveRobots);

        // Spawn robots for current wave
        if (isSpawning && robotsSpawned < robotsToSpawn) {
            if (time - lastSpawnTime >= spawnInterval) {
                this.spawnRobot(waveNumber, robotsSpawned + 1);
                spawner.setValue(WaveSpawner, "robotsSpawned", robotsSpawned + 1);
                spawner.setValue(WaveSpawner, "lastSpawnTime", time);
                
                console.log(`🤖 Spawning robot ${robotsSpawned + 1}/${robotsToSpawn}`);
            }
        }

        // Check if all robots spawned
        if (isSpawning && robotsSpawned >= robotsToSpawn) {
            spawner.setValue(WaveSpawner, "isSpawning", false);
            console.log(`✅ All ${robotsToSpawn} robots spawned for wave ${waveNumber}`);
        }

        // Check if wave is complete
        if (!isSpawning && aliveRobots === 0 && robotsSpawned >= robotsToSpawn) {
            if (!this.waveCompleted) {
                this.waveCompleted = true;
                this.completeWave(gameState, spawner, waveNumber);
            }
        }
    }

    private startWave(waveNumber: number): void {
        console.log(`🚀 STARTING WAVE ${waveNumber}`);
        
        const spawnerEntities = Array.from(this.queries.waveSpawner.entities);
        const gameStateEntities = Array.from(this.queries.gameState.entities);
        
        if (spawnerEntities.length === 0 || gameStateEntities.length === 0) return;

        const spawner = spawnerEntities[0];
        const gameState = gameStateEntities[0];
        
        // Calculate wave difficulty
        const baseRobots = 3;
        const waveIncrease = Math.floor(waveNumber / 2);
        const robotsToSpawn = baseRobots + waveIncrease + Math.floor(Math.random() * 3);
        
        this.waveDifficulty = {
            robotHealth: 50 + (waveNumber * 8),
            robotDamage: 15 + (waveNumber * 1.5),
            robotSpeed: 0.5 + (waveNumber * 0.05),
            waveNumber: waveNumber
        };
        
        // Update spawner
        spawner.setValue(WaveSpawner, "waveNumber", waveNumber);
        spawner.setValue(WaveSpawner, "robotsToSpawn", robotsToSpawn);
        spawner.setValue(WaveSpawner, "robotsSpawned", 0);
        spawner.setValue(WaveSpawner, "robotsAlive", 0);
        spawner.setValue(WaveSpawner, "isSpawning", true);
        spawner.setValue(WaveSpawner, "lastSpawnTime", performance.now() / 1000);
        
        const spawnInterval = Math.max(0.5, 2.0 - (waveNumber * 0.1));
        spawner.setValue(WaveSpawner, "spawnInterval", spawnInterval);
        
        // Update game state
        gameState.setValue(GameState, "wave", waveNumber);
        gameState.setValue(GameState, "robotsKilledInWave", 0);
        gameState.setValue(GameState, "robotsPerWave", robotsToSpawn);
        gameState.setValue(GameState, "waveCompleted", false);
        
        this.waveCompleted = false;
        
        console.log(`🌊 Wave ${waveNumber}: ${robotsToSpawn} robots`);
        console.log(`   Health: ${this.waveDifficulty.robotHealth} | Damage: ${this.waveDifficulty.robotDamage}`);
        
        // Show wave start message
        this.showWaveMessage(`WAVE ${waveNumber}`, `Kill ${robotsToSpawn} alien drones!`, 2000);
    }

    // In the spawnRobot method, update to spawn aliens in FRONT (positive Z):
private spawnRobot(waveNumber: number, robotId: number): void {
    const spawnerEntities = Array.from(this.queries.waveSpawner.entities);
    if (spawnerEntities.length === 0) return;
    
    const spawner = spawnerEntities[0];
    const robotsToSpawn = spawner.getValue(WaveSpawner, "robotsToSpawn") || 3;
    
    // ALIEN DRONES ATTACKING FROM THE FRONT (POSITIVE Z)
    let position: Vector3;
    
    // Generate positions in FRONT of the spaceship (positive Z direction)
    const angle = (robotId / robotsToSpawn) * Math.PI * 2;
    const radius = 5 + Math.random() * 3 + (waveNumber * 0.5); // Increase with waves
    
    // Position in FRONT of the ship (positive Z)
    const x = Math.cos(angle) * radius; // Horizontal spread
    const z = 8 + Math.random() * 4 + (waveNumber * 2); // Distance increases with waves
    const y = 1 + Math.random() * 3; // Height variation
    
    position = new Vector3(x, y, z);
    
    this.createAlienDrone(position, robotId, this.waveDifficulty, waveNumber);
    
    console.log(`👽 Alien Drone #${robotId} spawned at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
}

    private createAlienDrone(position: Vector3, id: number, difficulty: any, waveNumber: number): void {
        const robotGroup = new Mesh();
        
        // Alien drone colors - menacing purple/red for aliens
        let baseColor: number;
        if (waveNumber <= 3) {
            baseColor = 0x8b008b; // Dark purple
        } else if (waveNumber <= 6) {
            baseColor = 0xdc143c; // Crimson
        } else {
            baseColor = 0xff4500; // Orange-red
        }
        
        const scale = 0.9 + (waveNumber * 0.05); // Grow with waves
        
        // Main body - alien design
        const bodyGeometry = new SphereGeometry(0.6 * scale, 16, 16);
        const bodyMaterial = new MeshStandardMaterial({ 
            color: baseColor,
            metalness: 0.8,
            roughness: 0.2,
            emissive: baseColor,
            emissiveIntensity: 0.6,
        });
        const body = new Mesh(bodyGeometry, bodyMaterial);
        robotGroup.add(body);
        
        // Alien eye - menacing green
        const eyeGeometry = new SphereGeometry(0.2 * scale, 12, 12);
        const eyeMaterial = new MeshStandardMaterial({ 
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.95
        });
        const eye = new Mesh(eyeGeometry, eyeMaterial);
        eye.position.z = 0.5 * scale;
        robotGroup.add(eye);
        
        // Alien tendrils/spikes
        const spikeGeometry = new CylinderGeometry(0.05 * scale, 0.1 * scale, 0.8 * scale, 6);
        const spikeMaterial = new MeshStandardMaterial({ 
            color: 0x4b0082,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x4b0082,
            emissiveIntensity: 0.4
        });
        
        // Add spikes around the alien drone
        const spikes = [
            { x: 0.9 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: -0.9 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: 0, y: 0.9 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0, y: -0.9 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0.6 * scale, y: 0.6 * scale, z: 0, rx: 0, ry: 0, rz: Math.PI/4 },
            { x: -0.6 * scale, y: 0.6 * scale, z: 0, rx: 0, ry: 0, rz: -Math.PI/4 },
        ];
        
        spikes.forEach((spike) => {
            const spikeMesh = new Mesh(spikeGeometry, spikeMaterial);
            spikeMesh.rotation.set(spike.rx, spike.ry, spike.rz);
            spikeMesh.position.set(spike.x, spike.y, spike.z);
            robotGroup.add(spikeMesh);
        });
        
        // Position and scale
        robotGroup.position.copy(position);
        robotGroup.scale.setScalar(scale);
        
        // Alien floating behavior - more erratic
        (robotGroup as any).userData = {
            floatHeight: position.y,
            floatSpeed: 0.8 + Math.random() * 0.4,
            rotationSpeed: 0.003 + Math.random() * 0.002,
            timeOffset: Math.random() * Math.PI * 2,
            isInside: false,
            bobSpeed: 1.5 + Math.random() * 0.5,
            bobAmount: 0.4 + Math.random() * 0.3,
            waveNumber: waveNumber
        };
        
        // Create alien drone entity
        this.world
            .createTransformEntity(robotGroup)
            .addComponent(Robot, {
                id: id,
                speed: difficulty.robotSpeed * (1 + waveNumber * 0.05), // Faster in higher waves
                health: difficulty.robotHealth,
                maxHealth: difficulty.robotHealth,
                attackDamage: difficulty.robotDamage * 1.3, // More damage from aliens
                attackRange: 20.0, // Long range for space combat
                attackCooldown: Math.max(0.8, 2.5 - (waveNumber * 0.15)), // Faster attacks
                lastAttackTime: 0.0,
                isDead: false,
            });
            
        console.log(`👽 Alien Drone #${id} spawned (Wave ${waveNumber})`);
    }

    private completeWave(gameState: Entity, spawner: Entity, waveNumber: number): void {
        console.log(`🎉 WAVE ${waveNumber} COMPLETED!`);
        
        const waveBonus = waveNumber * 300;
        const currentScore = gameState.getValue(GameState, "score") || 0;
        const newScore = currentScore + waveBonus;
        
        gameState.setValue(GameState, "score", newScore);
        gameState.setValue(GameState, "waveCompleted", true);
        
        this.showWaveCompleteMessage(waveNumber, waveBonus);
        
        setTimeout(() => {
            this.startWave(waveNumber + 1);
        }, this.waveStartDelay);
    }

    private showWaveMessage(title: string, subtitle: string, duration: number = 1500): void {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(0,0,0,0.9), rgba(80,0,0,0.95));
            color: white;
            padding: 25px 40px;
            border-radius: 15px;
            font-family: 'Arial', sans-serif;
            text-align: center;
            z-index: 2000;
            border: 3px solid #ff0000;
            box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
            min-width: 300px;
        `;
        
        messageDiv.innerHTML = `
            <div style="color: #ff4444; font-size: 36px; font-weight: bold; margin-bottom: 10px;">${title}</div>
            <div style="font-size: 20px; margin-bottom: 5px;">${subtitle}</div>
            <div style="font-size: 14px; color: #aaa; margin-top: 10px;">👽 ALIEN ATTACK!</div>
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 500);
        }, duration);
    }

    private showWaveCompleteMessage(waveNumber: number, bonus: number): void {
        const nextWave = waveNumber + 1;
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(0,100,0,0.98));
            color: white;
            padding: 30px 50px;
            border-radius: 20px;
            font-family: 'Arial', sans-serif;
            text-align: center;
            z-index: 2000;
            border: 3px solid #00ff00;
            box-shadow: 0 0 40px rgba(0, 255, 0, 0.5);
            animation: pulse 2s infinite;
        `;
        
        messageDiv.innerHTML = `
            <div style="color: #00ff00; font-size: 42px; font-weight: bold; margin-bottom: 10px;">ALIENS REPELLED!</div>
            <div style="font-size: 28px; margin-bottom: 15px; color: #ffff00;">Wave ${waveNumber} Complete</div>
            <div style="font-size: 24px; margin-bottom: 10px; color: #00ffff;">+${bonus} BONUS</div>
            <div style="font-size: 20px; margin-bottom: 20px;">Wave ${nextWave} in 3 seconds...</div>
            <div style="font-size: 16px; color: #aaa;">More aliens incoming! Get ready!</div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.5); }
                50% { box-shadow: 0 0 40px rgba(0, 255, 0, 0.8); }
                100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.5); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
                if (style.parentNode) {
                    style.parentNode.removeChild(style);
                }
            }, 500);
        }, 2800);
    }
}

// ui/ hud.uikitml
<style>
  .hud-container {
    display: flex;
    flex-direction: column;
    padding: 15px;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(20, 0, 40, 0.9));
    border-radius: 12px;
    border: 2px solid;
    border-image: linear-gradient(45deg, #ff0000, #00ff00, #0000ff) 1;
    gap: 10px;
    backdrop-filter: blur(10px);
  }

  .game-title {
    font-size: 22px;
    font-weight: bold;
    background: linear-gradient(90deg, #ff0000, #00ff00, #0000ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    text-align: center;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    border-left: 3px solid;
  }

  .score-row {
    border-left-color: #ff0000;
  }

  .wave-row {
    border-left-color: #00ff00;
  }

  .kills-row {
    border-left-color: #0000ff;
  }

  .stat-label {
    font-size: 16px;
    color: #ffffff;
    font-weight: 500;
  }

  .stat-value {
    font-size: 20px;
    font-weight: bold;
    font-family: 'Courier New', monospace;
    text-shadow: 0 0 10px currentColor;
  }

  .score-value {
    color: #ff0000;
  }

  .wave-value {
    color: #00ff00;
  }

  .kills-value {
    color: #0000ff;
  }
</style>

<div class="hud-container">
  <div class="game-title">AR ROBOT DEFENSE</div>
  
  <div class="stat-row score-row">
    <span class="stat-label">SCORE</span>
    <span id="score-value" class="stat-value score-value">0</span>
  </div>
  
  <div class="stat-row wave-row">
    <span class="stat-label">WAVE</span>
    <span id="wave-value" class="stat-value wave-value">1</span>
  </div>
  
  <div class="stat-row kills-row">
    <span class="stat-label">ELIMINATED</span>
    <span id="kills-value" class="stat-value kills-value">0</span>
  </div>
</div>


// ui/welcome.uikitml
<style>
  .panel-container {
    align-items: flex-start;
    padding: 2;
    width: 50;
    display: flex;
    flex-direction: column;
    background-color: #09090b;
    border-color: #27272a;
    border-width: 0.15;
    border-radius: 3;
  }

  .heading {
    font-size: 4;
    font-weight: medium;
    color: #fafafa;
    text-align: left;
  }

  .sub-heading {
    font-size: 2;
    color: #a1a1aa;
    text-align: left;
    margin-top: 0.3;
  }
  
  .game-stats {
    margin-top: 2;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5;
  }
  
  .stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 2;
    color: #fafafa;
  }
  
  #xr-button {
    width: 100%;
    padding: 1.5;
    margin-top: 2;
    background-color: #fafafa;
    color: #09090b;
    border-radius: 1.5;
    border-width: 0.1;
    border-color: #e4e4e7;
    font-size: 2.5;
    font-weight: medium;
    text-align: center;
    cursor: pointer;
  }
  
  #start-game {
    width: 100%;
    padding: 1.5;
    margin-top: 1;
    background-color: #3b82f6;
    color: #ffffff;
    border-radius: 1.5;
    border-width: 0;
    font-size: 2.5;
    font-weight: medium;
    text-align: center;
    cursor: pointer;
  }
</style>
<div class="panel-container">
  <span class="heading"> Robot Shooter Game </span>
  <span class="sub-heading"> Grab the gun with your right hand, pull trigger to shoot. Destroy all robots!</span>
  
  <div class="game-stats">
    <div class="stat-row">
      <span>Robots Destroyed:</span>
      <span id="score">0</span>
    </div>
    <div class="stat-row">
      <span>Remaining:</span>
      <span id="remaining">4</span>
    </div>
    <div class="stat-row">
      <span>Ammo:</span>
      <span id="ammo">∞</span>
    </div>
  </div>
  
  <button id="xr-button">Enter XR</button>
  <button id="start-game">Start Game</button>
</div>

// index.html
