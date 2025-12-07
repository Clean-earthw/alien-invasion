import { createSystem, Mesh, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Vector3, Entity } from "@iwsdk/core";
import { WaveSpawner, Robot, GameState ,GameSound} from "../components.js";

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

    private spawnRobot(waveNumber: number, robotId: number): void {
    const spawnerEntities = Array.from(this.queries.waveSpawner.entities);
    if (spawnerEntities.length === 0) return;
    
    const spawner = spawnerEntities[0];
    const robotsToSpawn = spawner.getValue(WaveSpawner, "robotsToSpawn") || 3;
    
    // SPAWN ROBOTS BEHIND PLAYER (NEGATIVE Z)
    const angle = (robotId / robotsToSpawn) * Math.PI * 2;
    const radius = 5 + Math.random() * 3 + (waveNumber * 0.5);
    
    // Position BEHIND the player (negative Z)
    const x = Math.cos(angle) * radius;
    const z = -8 - Math.random() * 4 - (waveNumber * 2); // NEGATIVE Z = behind
    const y = 1 + Math.random() * 3;
    
    const position = new Vector3(x, y, z);
    
    // Determine robot type
    const robotType = this.getRobotTypeFromWave(waveNumber);
    
    // Create alien drone with type
    this.createAlienDrone(position, robotId, this.waveDifficulty, waveNumber, robotType);
    
    console.log(`👽 ${robotType.toUpperCase()} Alien spawned BEHIND at Z=${z.toFixed(1)}`);
}

private getRobotSystem(): any {
    const systems = (this.world as any).systems;
    if (systems) {
        for (const system of systems) {
            if (system.constructor.name === "RobotSystem") {
                return system;
            }
        }
    }
    return null;
}

private createAlienDrone(position: Vector3, id: number, difficulty: any, waveNumber: number, robotType?: string): void {
    const robotGroup = new Mesh();
    
    // Determine robot type if not provided
    const type = robotType || this.getRobotTypeFromWave(waveNumber);
    
    // Alien drone colors based on type
    let baseColor: number;
    let eyeColor: number;
    let spikeColor: number;
    let scale: number;
    
    // Set properties based on robot type
    switch(type) {
        case "easy":
            baseColor = 0x8b008b; // Dark purple
            eyeColor = 0x00ff00;  // Green
            spikeColor = 0x4b0082; // Indigo
            scale = 0.9 + (waveNumber * 0.05);
            break;
            
        case "medium":
            baseColor = 0xdc143c; // Crimson
            eyeColor = 0xff0000;  // Red
            spikeColor = 0x800000; // Maroon
            scale = 1.2 + (waveNumber * 0.06);
            break;
            
        case "boss":
            baseColor = 0xff4500; // Orange-red
            eyeColor = 0xffff00;  // Yellow
            spikeColor = 0xff8c00; // Dark orange
            scale = 1.8 + (waveNumber * 0.08);
            break;
            
        default:
            baseColor = 0x8b008b;
            eyeColor = 0x00ff00;
            spikeColor = 0x4b0082;
            scale = 0.9 + (waveNumber * 0.05);
    }
    
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
    
    // Alien eye
    const eyeGeometry = new SphereGeometry(0.2 * scale, 12, 12);
    const eyeMaterial = new MeshStandardMaterial({ 
        color: eyeColor,
        emissive: eyeColor,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.95
    });
    const eye = new Mesh(eyeGeometry, eyeMaterial);
    eye.position.z = 0.5 * scale;
    robotGroup.add(eye);
    
    // Alien tendrils/spikes - more spikes for higher tier robots
    const spikeGeometry = new CylinderGeometry(0.05 * scale, 0.1 * scale, 0.8 * scale, 6);
    const spikeMaterial = new MeshStandardMaterial({ 
        color: spikeColor,
        metalness: 0.9,
        roughness: 0.1,
        emissive: spikeColor,
        emissiveIntensity: 0.4
    });
    
    // Different spike patterns for different robot types
    let spikes: Array<{x: number, y: number, z: number, rx: number, ry: number, rz: number}>;
    
    if (type === "easy") {
        spikes = [
            { x: 0.9 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: -0.9 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: 0, y: 0.9 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0, y: -0.9 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
        ];
    } else if (type === "medium") {
        spikes = [
            { x: 0.9 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: -0.9 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: 0, y: 0.9 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0, y: -0.9 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0.6 * scale, y: 0.6 * scale, z: 0, rx: 0, ry: 0, rz: Math.PI/4 },
            { x: -0.6 * scale, y: 0.6 * scale, z: 0, rx: 0, ry: 0, rz: -Math.PI/4 },
            { x: 0.6 * scale, y: -0.6 * scale, z: 0, rx: 0, ry: 0, rz: -Math.PI/4 },
            { x: -0.6 * scale, y: -0.6 * scale, z: 0, rx: 0, ry: 0, rz: Math.PI/4 },
        ];
    } else { // boss
        spikes = [
            { x: 1.1 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: -1.1 * scale, y: 0, z: 0, rx: 0, ry: 0, rz: Math.PI/2 },
            { x: 0, y: 1.1 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0, y: -1.1 * scale, z: 0, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0.8 * scale, y: 0.8 * scale, z: 0, rx: 0, ry: 0, rz: Math.PI/4 },
            { x: -0.8 * scale, y: 0.8 * scale, z: 0, rx: 0, ry: 0, rz: -Math.PI/4 },
            { x: 0.8 * scale, y: -0.8 * scale, z: 0, rx: 0, ry: 0, rz: -Math.PI/4 },
            { x: -0.8 * scale, y: -0.8 * scale, z: 0, rx: 0, ry: 0, rz: Math.PI/4 },
            // Additional front spikes
            { x: 0, y: 0, z: 0.9 * scale, rx: Math.PI/2, ry: 0, rz: 0 },
            { x: 0.4 * scale, y: 0, z: 0.9 * scale, rx: Math.PI/2, ry: 0.4, rz: 0 },
            { x: -0.4 * scale, y: 0, z: 0.9 * scale, rx: Math.PI/2, ry: -0.4, rz: 0 },
        ];
    }
    
    spikes.forEach((spike) => {
        const spikeMesh = new Mesh(spikeGeometry, spikeMaterial);
        spikeMesh.rotation.set(spike.rx, spike.ry, spike.rz);
        spikeMesh.position.set(spike.x, spike.y, spike.z);
        robotGroup.add(spikeMesh);
    });
    
    // For boss robots, add extra details
    if (type === "boss") {
        // Add glowing energy core
        const coreGeometry = new SphereGeometry(0.3 * scale, 16, 16);
        const coreMaterial = new MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.8
        });
        const energyCore = new Mesh(coreGeometry, coreMaterial);
        energyCore.position.set(0, 0, 0.2 * scale);
        robotGroup.add(energyCore);
    }
    
    // Position and scale
    robotGroup.position.copy(position);
    robotGroup.scale.setScalar(scale);
    
    // Different floating behavior based on type
    const floatSpeed = type === "boss" ? 0.5 : type === "medium" ? 0.7 : 0.8;
    const rotationSpeed = type === "boss" ? 0.001 : type === "medium" ? 0.002 : 0.003;
    const bobAmount = type === "boss" ? 0.2 : type === "medium" ? 0.3 : 0.4;
    
    (robotGroup as any).userData = {
        floatHeight: position.y,
        floatSpeed: floatSpeed + Math.random() * 0.3,
        rotationSpeed: rotationSpeed + Math.random() * 0.002,
        timeOffset: Math.random() * Math.PI * 2,
        isInside: false,
        bobSpeed: 1.2 + Math.random() * 0.3,
        bobAmount: bobAmount + Math.random() * 0.2,
        waveNumber: waveNumber,
        robotType: type
    };
    
    // Adjust difficulty based on robot type
    let healthMultiplier = 1.0;
    let damageMultiplier = 1.0;
    let speedMultiplier = 1.0;
    let pointsMultiplier = 1.0;
    
    switch(type) {
        case "medium":
            healthMultiplier = 1.8;
            damageMultiplier = 1.5;
            speedMultiplier = 0.8;
            pointsMultiplier = 2.0;
            break;
        case "boss":
            healthMultiplier = 3.0;
            damageMultiplier = 2.0;
            speedMultiplier = 0.6;
            pointsMultiplier = 5.0;
            break;
    }
    
    // Create alien drone entity with robot type
    this.world
        .createTransformEntity(robotGroup)
        .addComponent(Robot, {
            id: id,
            type: type,
            tier: type === "easy" ? 1 : type === "medium" ? 2 : 3,
            speed: difficulty.robotSpeed * speedMultiplier * (1 + waveNumber * 0.05),
            health: difficulty.robotHealth * healthMultiplier,
            maxHealth: difficulty.robotHealth * healthMultiplier,
            attackDamage: difficulty.robotDamage * damageMultiplier * 1.3,
            attackRange: type === "boss" ? 25.0 : 20.0, // Boss has longer range
            attackCooldown: type === "boss" ? Math.max(0.5, 2.0 - (waveNumber * 0.1)) : 
                          type === "medium" ? Math.max(0.6, 2.0 - (waveNumber * 0.12)) : 
                          Math.max(0.8, 2.5 - (waveNumber * 0.15)),
            lastAttackTime: 0.0,
            isDead: false,
            points: Math.floor(100 * pointsMultiplier * (1 + waveNumber * 0.1)),
            scaleMultiplier: scale,
            armor: type === "boss" ? 0.4 : type === "medium" ? 0.2 : 0.0,
            lockOnDifficulty: type === "boss" ? 0.7 : type === "medium" ? 0.4 : 0.1,
            targetPriority: type === "boss" ? 3.0 : type === "medium" ? 2.0 : 1.0
        })
        .addComponent(GameSound, {
            soundType: "robot",
            shouldPlay: false,
            lastPlayTime: 0.0
        });
        
    console.log(`👽 ${type.toUpperCase()} Alien Drone #${id} spawned (Wave ${waveNumber})`);
}

// Helper method to determine robot type from wave number
private getRobotTypeFromWave(waveNumber: number): string {
    if (waveNumber <= 3) {
        return "easy";
    } else if (waveNumber <= 6) {
        return Math.random() < 0.7 ? "easy" : "medium";
    } else if (waveNumber <= 10) {
        const rand = Math.random();
        if (rand < 0.5) return "easy";
        if (rand < 0.85) return "medium";
        return "boss";
    } else {
        const rand = Math.random();
        if (rand < 0.3) return "easy";
        if (rand < 0.7) return "medium";
        return "boss";
    }
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

