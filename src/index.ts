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
    barrel.position.set(0, 0.1, 1.5);
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
    
    for (let i = 0; i < 3; i++) {
        const coil = new Mesh(coilGeometry, coilMaterial);
        coil.position.set(0, 0.1, 0.3 + i * 0.4);
        gunGroup.add(coil);
    }
    
    // Holographic sight
    const sightGeometry = new BoxGeometry(0.18, 0.1, 0.02);
    const sightMaterial = new MeshStandardMaterial({ 
        color: 0x00ffff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.8
    });
    const sight = new Mesh(sightGeometry, sightMaterial);
    sight.position.set(0, 0.3, 0.7);
    gunGroup.add(sight);
    
    // Handle/grip
    const handleGeometry = new BoxGeometry(0.15, 0.25, 0.08);
    const handleMaterial = new MeshStandardMaterial({ 
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.3
    });
    const handle = new Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, -0.2, 0.3);
    gunGroup.add(handle);
    
    // TRIGGER
    const triggerGeometry = new BoxGeometry(0.05, 0.08, 0.04);
    const triggerMaterial = new MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.3
    });
    const trigger = new Mesh(triggerGeometry, triggerMaterial);
    trigger.position.set(0, -0.15, 0.45);
    gunGroup.add(trigger);
    
    // POSITION GUN IN FRONT OF PLAYER, POINTING BACKWARD
    gunGroup.position.set(0.3, 1.0, 2.5); // IN FRONT at positive Z
    gunGroup.rotation.set(0, Math.PI, 0); // Rotate 180° to point BACKWARD (toward negative Z)
    gunGroup.scale.setScalar(1.0);
    
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
            maxDistance: 1.0
        })
        .addComponent(AudioSource, {
            src: "./audio/shoot.mp3",
            maxInstances: 12,
            volume: 0.7,
        });
    
    console.log("✅ Gun positioned IN FRONT at Z+2.5, pointing BACKWARD toward robots");
    
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