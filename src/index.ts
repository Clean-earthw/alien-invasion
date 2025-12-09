// index.ts - Space Defense with Instant Robot Spawning and HTML UI
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
    Vector3,
    Group
} from "@iwsdk/core";

// Import systems
import { RobotSystem } from "./systems/robot-system.js";
import { GunSystem } from "./systems/gun-system.js";
import { ProjectileSystem } from "./systems/projectile-system.js";
import { HealthSystem } from "./systems/health-system.js";
import { WaveSystem } from "./systems/wave-system.js";
import { GunTargetingSystem } from "./systems/gun-targeting-system.js";
import { ScoreUISystem } from "./systems/score-ui-system.js";

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
        url: "./audio/ding.mp3",
        type: AssetType.Audio,
    },
};

export function startExperience() {
    console.log("🚀 Starting Space Defense Experience...");

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
        
        const { camera } = world;
        camera.position.set(0, 1.5, 0);
        
        // Store entity references
        let gameStateEntity: any;
        let playerEntity: any;
        let waveSpawnerEntity: any;
        let gunEntity: any;
        
        // Create game state entity
        gameStateEntity = world.createEntity().addComponent(GameState, {
            isPlaying: true,
            score: 0,
            wave: 1,
            robotsKilled: 0,
            robotsKilledInWave: 0,
            robotsPerWave: 3,
            waveCompleted: false,
            gameOver: false,
        });

        // Create player entity
        playerEntity = world.createEntity().addComponent(Player, {
            health: 100.0,
            maxHealth: 100.0,
            lastDamageTime: 0.0,
            isImmortal: false,
        });

        // Create wave spawner entity - SET TO SPAWN INSTANTLY
        waveSpawnerEntity = world.createEntity().addComponent(WaveSpawner, {
            waveNumber: 1,
            robotsToSpawn: 3,
            robotsSpawned: 0,
            robotsAlive: 0,
            spawnInterval: 0.1, // Very short interval for instant spawning
            lastSpawnTime: 0.0,
            isActive: true,
            isSpawning: true, // Start spawning immediately
        });

        // Create HTML-based game UI (top-right corner)
        createGameUI();
        
        // Load environment
        loadEnvironment(world);

        // Create gun
        gunEntity = createGun(world);
        
        // Create space backdrop
        createSpaceEnvironment(world);
        
        // Register all systems - WAVE SYSTEM FIRST!
        registerSystems(world);
        
        // Setup game state updates
        setupGameStateUpdates(gameStateEntity, playerEntity, waveSpawnerEntity, gunEntity);
        
        // Add event listeners for immediate robot spawning
        setTimeout(() => {
            setupEventListeners(world, gameStateEntity, waveSpawnerEntity, playerEntity);
            spawnInitialRobots(world, waveSpawnerEntity);
        }, 1000);
        
        // Hide loading screen
        hideLoadingScreen();
        
        console.log("✅ Game initialized! Robots spawning NOW!");
        
    }).catch((error) => {
        console.error("❌ Failed to initialize world:", error);
        hideLoadingScreenWithError(error.message);
    });
}

// NEW FUNCTION: Spawn initial robots immediately
function spawnInitialRobots(world: any, waveSpawnerEntity: any): void {
    const waveSystem = world.getSystem(WaveSystem);
    if (!waveSystem) {
        console.warn("WaveSystem not found!");
        return;
    }
    
    console.log("👽 SPAWNING INITIAL ROBOTS IMMEDIATELY!");
    
    // Spawn 3 robots instantly around the player
    const spawnPositions = [
        new Vector3(-5, 2, -10),
        new Vector3(0, 3, -12),
        new Vector3(5, 2, -10),
        new Vector3(-3, 1, -8),
        new Vector3(3, 1, -8)
    ];
    
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const position = spawnPositions[i % spawnPositions.length];
            console.log(`👾 Spawning robot ${i+1} at Z=${position.z}`);
            
            // Use the WaveSystem's createRobotByType method
            if ((waveSystem as any).createRobotByType) {
                (waveSystem as any).createRobotByType(position, i+1, 1, "scout");
                
                // Update spawner counts
                const robotsSpawned = waveSpawnerEntity.getValue(WaveSpawner, "robotsSpawned") || 0;
                const robotsAlive = waveSpawnerEntity.getValue(WaveSpawner, "robotsAlive") || 0;
                
                waveSpawnerEntity.setValue(WaveSpawner, "robotsSpawned", robotsSpawned + 1);
                waveSpawnerEntity.setValue(WaveSpawner, "robotsAlive", robotsAlive + 1);
            }
        }, i * 300); // Small delay between each spawn
    }
    
   
}


// NEW FUNCTION: Setup event listeners for immediate response
function setupEventListeners(world: any, gameStateEntity: any, waveSpawnerEntity: any, playerEntity: any): void {
    // Listen for robot killed events
    window.addEventListener('robot-killed', (event: any) => {
        const { points, robotId } = event.detail || {};
        
        // Update score
        const currentScore = gameStateEntity.getValue(GameState, "score") || 0;
        const currentKills = gameStateEntity.getValue(GameState, "robotsKilled") || 0;
        const currentKillsInWave = gameStateEntity.getValue(GameState, "robotsKilledInWave") || 0;
        
        gameStateEntity.setValue(GameState, "score", currentScore + (points || 100));
        gameStateEntity.setValue(GameState, "robotsKilled", currentKills + 1);
        gameStateEntity.setValue(GameState, "robotsKilledInWave", currentKillsInWave + 1);
        
        // Update robots alive count
        const currentAlive = waveSpawnerEntity.getValue(WaveSpawner, "robotsAlive") || 0;
        if (currentAlive > 0) {
            waveSpawnerEntity.setValue(WaveSpawner, "robotsAlive", currentAlive - 1);
        }
        
        console.log(`🎯 Robot #${robotId} destroyed! Score: ${currentScore + (points || 100)}`);
    });
    
    // Listen for player hit events
    window.addEventListener('player-hit', (event: any) => {
        const { damage } = event.detail || {};
        
        const currentHealth = playerEntity.getValue(Player, "health") || 100;
        const newHealth = Math.max(0, currentHealth - (damage || 15));
        
        playerEntity.setValue(Player, "health", newHealth);
        playerEntity.setValue(Player, "lastDamageTime", performance.now() / 1000);
        
        console.log(`💥 Spaceship hit! Health: ${newHealth}/100`);
        
        // Show damage effect
        showDamageEffect();
        
        // Check for game over
        if (newHealth <= 0) {
            gameOver();
        }
    });
}

function showDamageEffect(): void {
    const damageEffect = document.createElement('div');
    damageEffect.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle, rgba(255,0,0,0.4) 0%, rgba(255,0,0,0) 70%);
        z-index: 9997;
        pointer-events: none;
        animation: damageFlash 0.5s;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes damageFlash {
            0% { opacity: 0; }
            50% { opacity: 1; }
            100% { opacity: 0; }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(damageEffect);
    
    setTimeout(() => {
        if (damageEffect.parentNode) damageEffect.parentNode.removeChild(damageEffect);
        if (style.parentNode) style.parentNode.removeChild(style);
    }, 500);
}

function gameOver(): void {
    console.log("💀 GAME OVER - Spaceship destroyed!");
    
    const gameOverScreen = document.createElement('div');
    gameOverScreen.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        color: white;
        font-family: 'Orbitron', sans-serif;
        text-align: center;
    `;
    
    gameOverScreen.innerHTML = `
        <div style="font-size: 48px; color: #ff0000; margin-bottom: 20px; text-shadow: 0 0 20px #ff0000;">
            💀 GAME OVER
        </div>
        <div style="font-size: 24px; color: #ff8888; margin-bottom: 40px;">
            The spaceship has been destroyed!
        </div>
        <div style="font-size: 20px; color: #88ccff; margin-bottom: 30px;">
            Final Score: <span id="final-score">0</span>
        </div>
        <button onclick="location.reload()" style="
            padding: 15px 40px;
            font-size: 20px;
            background: #ff0000;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-family: 'Orbitron', sans-serif;
            font-weight: bold;
            margin-top: 20px;
        ">
            🔄 RESTART MISSION
        </button>
    `;
    
    // Update final score
    setTimeout(() => {
        const finalScore = document.getElementById('final-score');
        if (finalScore) {
            finalScore.textContent = document.getElementById('score-value')?.textContent || '0';
        }
    }, 100);
    
    document.body.appendChild(gameOverScreen);
}

function createGameUI() {
    // Create HTML overlay for game UI
    const gameUI = document.createElement('div');
    gameUI.id = 'game-ui';
    gameUI.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        pointer-events: none;
    `;
    
    // Score panel
    const scorePanel = document.createElement('div');
    scorePanel.style.cssText = `
        width: 320px;
        height: 380px;
        background: linear-gradient(135deg, rgba(0, 10, 30, 0.95), rgba(0, 20, 40, 0.95));
        border-radius: 20px;
        padding: 25px;
        border: 2px solid #0088ff;
        box-shadow: 0 0 30px rgba(0, 136, 255, 0.3);
        backdrop-filter: blur(10px);
        color: white;
        font-family: 'Orbitron', sans-serif;
    `;
    
    scorePanel.innerHTML = `
        <div style="width: 100%; border-bottom: 2px solid rgba(0, 136, 255, 0.5); padding-bottom: 15px; margin-bottom: 20px;">
            <div style="font-size: 22px; font-weight: bold; color: #ffffff; text-align: center; letter-spacing: 1px; text-transform: uppercase;">
                🚀 SPACE DEFENSE
            </div>
        </div>
        
        <div style="width: 100%; display: flex; flex-direction: column; gap: 15px; margin-bottom: 25px;">
            <div style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; align-items: center; 
                 padding: 12px 15px; background: rgba(0, 40, 80, 0.4); border-radius: 10px; border-left: 4px solid #ff0000;">
                <span style="font-size: 16px; color: #88ccff; font-weight: bold;">SCORE</span>
                <span id="score-value" style="font-size: 24px; font-weight: bold; font-family: monospace; color: #ff0000; text-shadow: 0 0 10px #ff0000;">0</span>
            </div>
            
            <div style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; align-items: center; 
                 padding: 12px 15px; background: rgba(0, 40, 80, 0.4); border-radius: 10px; border-left: 4px solid #00ff00;">
                <span style="font-size: 16px; color: #88ccff; font-weight: bold;">ELIMINATED</span>
                <span id="kills-value" style="font-size: 24px; font-weight: bold; font-family: monospace; color: #00ff00; text-shadow: 0 0 10px #00ff00;">0</span>
            </div>
            
            <div style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; align-items: center; 
                 padding: 12px 15px; background: rgba(0, 40, 80, 0.4); border-radius: 10px; border-left: 4px solid #0088ff;">
                <span style="font-size: 16px; color: #88ccff; font-weight: bold;">SHIELD</span>
                <span id="health-value" style="font-size: 24px; font-weight: bold; font-family: monospace; color: #0088ff; text-shadow: 0 0 10px #0088ff;">100%</span>
            </div>
        </div>
        
        <div style="width: 100%; margin-top: 10px;">
            <div style="font-size: 14px; color: #88ccff; margin-bottom: 8px; text-align: center;">SHIELD INTEGRITY</div>
            <div style="width: 100%; height: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; overflow: hidden; border: 1px solid rgba(0, 136, 255, 0.3);">
                <div id="health-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, #00ff00, #0088ff); border-radius: 6px; transition: width 0.3s ease;"></div>
            </div>
        </div>
        
        <div style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.2);">
            <span style="font-size: 14px; color: #88aaff; font-weight: bold;">WAVE: <span id="wave-value">1</span></span>
            <span style="font-size: 14px; color: #88aaff; font-weight: bold;">ALIENS: <span id="aliens-value">0/3</span></span>
        </div>
        
        <div style="width: 100%; display: flex; flex-direction: row; justify-content: space-between; margin-top: 10px;">
            <span style="font-size: 12px; color: #88aaff;">LASER AMMO: <span id="ammo-value">40/40</span></span>
            <span style="font-size: 12px; color: #88aaff;">BOMBS: <span id="bombs-value">3</span></span>
        </div>
    `;
    
    gameUI.appendChild(scorePanel);
    document.body.appendChild(gameUI);
}

// Function to update UI elements
function updateUI(score: number, kills: number, health: number, wave: number, aliensAlive: number, aliensTotal: number, ammo: number, bombs: number) {
    const scoreElement = document.getElementById('score-value');
    const killsElement = document.getElementById('kills-value');
    const healthElement = document.getElementById('health-value');
    const healthBar = document.getElementById('health-bar');
    const waveElement = document.getElementById('wave-value');
    const aliensElement = document.getElementById('aliens-value');
    const ammoElement = document.getElementById('ammo-value');
    const bombsElement = document.getElementById('bombs-value');
    
    if (scoreElement) scoreElement.textContent = score.toString();
    if (killsElement) killsElement.textContent = kills.toString();
    
    const healthPercent = Math.max(0, Math.min(100, health));
    if (healthElement) healthElement.textContent = `${Math.round(healthPercent)}%`;
    
    if (healthBar) {
        // Update color based on health
        let color = 'linear-gradient(90deg, #00ff00, #0088ff)';
        if (healthPercent < 30) color = 'linear-gradient(90deg, #ff0000, #ff4444)';
        else if (healthPercent < 60) color = 'linear-gradient(90deg, #ff9900, #ffaa00)';
        
        healthBar.style.width = `${healthPercent}%`;
        healthBar.style.background = color;
    }
    
    if (waveElement) waveElement.textContent = wave.toString();
    if (aliensElement) aliensElement.textContent = `${aliensAlive}/${aliensTotal}`;
    if (ammoElement) ammoElement.textContent = `${ammo}/40`;
    if (bombsElement) bombsElement.textContent = bombs.toString();
}

function loadEnvironment(world: any): void {
    const envGLTF = AssetManager.getGLTF("environmentDesk");
    if (envGLTF && envGLTF.scene) {
        console.log("✅ Loading spaceship interior...");
        const envMesh = envGLTF.scene;
        
        envMesh.position.set(0, -1.5, 0);
        envMesh.scale.setScalar(1.8);
        
        world
            .createTransformEntity(envMesh)
            .addComponent(DomeGradient, {
                sky: [0.0, 0.0, 0.05, 1.0],
                equator: [0.1, 0.1, 0.2, 1.0],
                ground: [0.02, 0.02, 0.04, 1.0],
                intensity: 0.3,
            })
            .addComponent(LocomotionEnvironment, { 
                type: EnvironmentType.STATIC 
            });
        
        createSpaceWindow(world);
        createInteriorDetails(world);
    } else {
        console.log("⚠️ Environment GLB not found, creating spaceship cockpit");
        createSpaceshipCockpit(world);
    }
}

function createSpaceWindow(world: any): void {
    const windowGeometry = new PlaneGeometry(8, 5);
    const windowMaterial = new MeshStandardMaterial({ 
        color: 0x000022,
        transparent: true,
        opacity: 0.7,
        emissive: 0x002255,
        emissiveIntensity: 0.4,
        side: 2
    });
    
    const spaceWindow = new Mesh(windowGeometry, windowMaterial);
    spaceWindow.position.set(0, 1.5, 5);
    spaceWindow.rotation.y = Math.PI;
    
    world.createTransformEntity(spaceWindow);
    
    const starsGroup = new Group();
    for (let i = 0; i < 150; i++) {
        const starGeometry = new SphereGeometry(0.02 + Math.random() * 0.03, 4, 4);
        const starMaterial = new MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.8 + Math.random() * 0.4
        });
        const star = new Mesh(starGeometry, starMaterial);
        
        star.position.set(
            (Math.random() - 0.5) * 25,
            (Math.random() - 0.5) * 15,
            6 + Math.random() * 20
        );
        
        starsGroup.add(star);
    }
    
    world.createTransformEntity(starsGroup);
}

function createInteriorDetails(world: any): void {
    const interiorGroup = new Group();
    
    const consoleGeometry = new BoxGeometry(3, 0.8, 1);
    const consoleMaterial = new MeshStandardMaterial({ 
        color: 0x111133,
        metalness: 0.7,
        roughness: 0.3,
        emissive: 0x001133,
        emissiveIntensity: 0.2
    });
    const controlConsole = new Mesh(consoleGeometry, consoleMaterial);
    controlConsole.position.set(0, 0.4, 2);
    interiorGroup.add(controlConsole);
    
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

function createSpaceshipCockpit(world: any): void {
    const cockpitGroup = new Group();
    
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
    
    const wallGeometry = new BoxGeometry(10, 4, 0.2);
    const wallMaterial = new MeshStandardMaterial({ 
        color: 0x333344,
        metalness: 0.4,
        roughness: 0.7
    });
    
    const frontWall = new Mesh(wallGeometry, wallMaterial);
    frontWall.position.set(0, 0, 5);
    cockpitGroup.add(frontWall);
    
    const windowGeometry = new PlaneGeometry(6, 3);
    const windowMaterial = new MeshStandardMaterial({ 
        color: 0x001133,
        transparent: true,
        opacity: 0.8,
        emissive: 0x002255,
        emissiveIntensity: 0.4
    });
    const cockpitWindow = new Mesh(windowGeometry, windowMaterial);
    cockpitWindow.position.set(0, 0.5, 4.9);
    frontWall.add(cockpitWindow);
    
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
}

function createSpaceEnvironment(world: any): void {
    const starsGroup = new Group();
    
    for (let i = 0; i < 300; i++) {
        const starGeometry = new SphereGeometry(0.01 + Math.random() * 0.02, 4, 4);
        const starMaterial = new MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.5 + Math.random() * 0.5
        });
        const star = new Mesh(starGeometry, starMaterial);
        
        const radius = 40 + Math.random() * 80;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        let z = radius * Math.cos(phi);
        if (z < 20) z = 20 + Math.random() * 60;
        
        star.position.set(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            z
        );
        
        starsGroup.add(star);
    }
    
    world.createTransformEntity(starsGroup);
    
    const planetGeometry = new SphereGeometry(8, 32, 32);
    const planetMaterial = new MeshStandardMaterial({ 
        color: 0x884400,
        emissive: 0x442200,
        emissiveIntensity: 0.2,
        roughness: 0.9,
        metalness: 0.1
    });
    const planet = new Mesh(planetGeometry, planetMaterial);
    planet.position.set(-30, 5, 80);
    
    world.createTransformEntity(planet);
}

function createGun(world: any): any {
    const gunGroup = new Group();
    
    const baseGeometry = new CylinderGeometry(0.35, 0.45, 0.25, 8);
    const baseMaterial = new MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.1
    });
    const turretBase = new Mesh(baseGeometry, baseMaterial);
    gunGroup.add(turretBase);
    
    const bodyGeometry = new CylinderGeometry(0.18, 0.22, 1.4, 8);
    const bodyMaterial = new MeshStandardMaterial({ 
        color: 0x1a1a1a,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0x111111,
        emissiveIntensity: 0.2
    });
    const gunBody = new Mesh(bodyGeometry, bodyMaterial);
    gunBody.rotation.x = Math.PI / 2;
    gunBody.position.set(0, 0.1, 0.7);
    gunGroup.add(gunBody);
    
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
    
    const handleGeometry = new BoxGeometry(0.15, 0.25, 0.08);
    const handleMaterial = new MeshStandardMaterial({ 
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.3
    });
    const handle = new Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, -0.2, 0.3);
    gunGroup.add(handle);
    
    const triggerGeometry = new BoxGeometry(0.05, 0.08, 0.04);
    const triggerMaterial = new MeshStandardMaterial({ 
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 0.3
    });
    const trigger = new Mesh(triggerGeometry, triggerMaterial);
    trigger.position.set(0, -0.15, 0.45);
    gunGroup.add(trigger);
    
    gunGroup.position.set(0.3, 1.0, 2.5);
    gunGroup.rotation.set(0, Math.PI, 0);
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
    
    return gunEntity;
}

// UPDATED: Register WaveSystem FIRST for immediate robot spawning
function registerSystems(world: any): void {
    try {
        // Register WaveSystem FIRST so it can create robots immediately
        world.registerSystem(WaveSystem);
        
        // Then other systems
        world.registerSystem(RobotSystem);
        world.registerSystem(GunSystem);
        world.registerSystem(ProjectileSystem);
        world.registerSystem(HealthSystem);
        world.registerSystem(GunTargetingSystem);
        world.registerSystem(ScoreUISystem);
            
        console.log("✅ All game systems registered - READY FOR INSTANT ACTION!");
    } catch (error) {
        console.error("❌ Failed to register systems:", error);
    }
}

function setupGameStateUpdates(gameStateEntity: any, playerEntity: any, waveSpawnerEntity: any, gunEntity: any) {
    // Update UI every 100ms
    const updateInterval = setInterval(() => {
        if (!gameStateEntity || !playerEntity || !waveSpawnerEntity || !gunEntity) return;
        
        try {
            // Get values from entities
            const score = gameStateEntity.getValue(GameState, "score") || 0;
            const robotsKilled = gameStateEntity.getValue(GameState, "robotsKilled") || 0;
            const wave = gameStateEntity.getValue(GameState, "wave") || 1;
            const health = playerEntity.getValue(Player, "health") || 100;
            const robotsAlive = waveSpawnerEntity.getValue(WaveSpawner, "robotsAlive") || 0;
            const robotsToSpawn = waveSpawnerEntity.getValue(WaveSpawner, "robotsToSpawn") || 3;
            const ammo = gunEntity.getValue(Gun, "ammo") || 40;
            const bombs = gunEntity.getValue(Gun, "bombCount") || 3;
            
            // Update the HTML UI
            updateUI(score, robotsKilled, health, wave, robotsAlive, robotsToSpawn, ammo, bombs);
        } catch (error) {
            console.warn("Error updating UI:", error);
        }
    }, 100);
}

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