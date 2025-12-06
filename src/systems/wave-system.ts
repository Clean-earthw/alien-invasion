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

    // In the spawnRobot method, update to spawn aliens in FRONT (positive Z
    private spawnRobot(waveNumber: number, robotId: number): void {
    const spawnerEntities = Array.from(this.queries.waveSpawner.entities);
    if (spawnerEntities.length === 0) return;
    
    const spawner = spawnerEntities[0];
    const robotsToSpawn = spawner.getValue(WaveSpawner, "robotsToSpawn") || 3;
    
    // SPAWN ROBOTS BEHIND PLAYER (NEGATIVE Z)
    let position: Vector3;
    
    const angle = (robotId / robotsToSpawn) * Math.PI * 2;
    const radius = 5 + Math.random() * 3 + (waveNumber * 0.5);
    
    // Position BEHIND the player (negative Z)
    const x = Math.cos(angle) * radius;
    const z = -8 - Math.random() * 4 - (waveNumber * 2); // NEGATIVE Z = behind
    const y = 1 + Math.random() * 3;
    
    position = new Vector3(x, y, z);
    
    this.createAlienDrone(position, robotId, this.waveDifficulty, waveNumber);
    
    console.log(`👽 Alien spawned BEHIND at Z=${z.toFixed(1)}`);
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

