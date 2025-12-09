// systems/wave-system.ts
import { createSystem, Mesh, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Vector3, Entity, Group, BoxGeometry, ConeGeometry, TorusGeometry } from "@iwsdk/core";
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
    {}
) {
    private robotCounter = 0;
    private initialized = false;
    private waveCompleted = false;
    private waveStartDelay = 4000;
    
    // Define 6 waves with increasing difficulty
    private waveDefinitions = [
        {
            waveNumber: 1,
            name: "Scout Wave",
            description: "Small agile scout drones",
            robotCount: 3,
            spawnInterval: 2.5,
            robotTypes: ["scout"],
            bossChance: 0
        },
        {
            waveNumber: 2,
            name: "Assault Wave",
            description: "Armored assault units",
            robotCount: 5,
            spawnInterval: 2.0,
            robotTypes: ["scout", "assault"],
            bossChance: 0
        },
        {
            waveNumber: 3,
            name: "Siege Wave",
            description: "Heavy siege robots with shields",
            robotCount: 7,
            spawnInterval: 1.8,
            robotTypes: ["scout", "assault", "siege"],
            bossChance: 0.1
        },
        {
            waveNumber: 4,
            name: "Elite Wave",
            description: "Elite flying robots with energy weapons",
            robotCount: 8,
            spawnInterval: 1.6,
            robotTypes: ["assault", "siege", "flying"],
            bossChance: 0.2
        },
        {
            waveNumber: 5,
            name: "Annihilation Wave",
            description: "Heavy mechs with multiple weapons",
            robotCount: 10,
            spawnInterval: 1.4,
            robotTypes: ["siege", "flying", "mech"],
            bossChance: 0.3
        },
        {
            waveNumber: 6,
            name: "Apocalypse Wave",
            description: "BOSS WAVE - Giant war machines",
            robotCount: 12,
            spawnInterval: 1.2,
            robotTypes: ["assault", "flying", "mech", "boss"],
            bossChance: 0.5
        }
    ];

    init(): void {
        console.log("🌊 WaveSystem initialized - 6 WAVES OF DESTRUCTION!");
        this.initialized = true;
        
        // Start first wave after a delay
        setTimeout(() => {
            this.startWave(1);
        }, 3000);
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
                const robotId = robotsSpawned + 1;
                const waveDefinition = this.waveDefinitions[waveNumber - 1] || this.waveDefinitions[0];
                
                // Determine robot type for this spawn
                const robotType = this.getRobotTypeForSpawn(waveDefinition, robotId);
                this.spawnRobot(waveNumber, robotId, robotType);
                
                spawner.setValue(WaveSpawner, "robotsSpawned", robotId);
                spawner.setValue(WaveSpawner, "lastSpawnTime", time);
                
                console.log(`🤖 Spawning ${robotType} robot ${robotId}/${robotsToSpawn}`);
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
        if (waveNumber > 6) {
            console.log("🏆 ALL WAVES COMPLETED! VICTORY!");
            this.showVictoryMessage();
            return;
        }
        
        const waveDefinition = this.waveDefinitions[waveNumber - 1];
        console.log(`🚀 STARTING ${waveDefinition.name}`);
        console.log(`📋 ${waveDefinition.description}`);
        
        const spawnerEntities = Array.from(this.queries.waveSpawner.entities);
        const gameStateEntities = Array.from(this.queries.gameState.entities);
        
        if (spawnerEntities.length === 0 || gameStateEntities.length === 0) return;

        const spawner = spawnerEntities[0];
        const gameState = gameStateEntities[0];
        
        // Update spawner
        spawner.setValue(WaveSpawner, "waveNumber", waveNumber);
        spawner.setValue(WaveSpawner, "robotsToSpawn", waveDefinition.robotCount);
        spawner.setValue(WaveSpawner, "robotsSpawned", 0);
        spawner.setValue(WaveSpawner, "robotsAlive", 0);
        spawner.setValue(WaveSpawner, "isSpawning", true);
        spawner.setValue(WaveSpawner, "lastSpawnTime", performance.now() / 1000);
        spawner.setValue(WaveSpawner, "spawnInterval", waveDefinition.spawnInterval);
        
        // Update game state
        gameState.setValue(GameState, "wave", waveNumber);
        gameState.setValue(GameState, "robotsKilledInWave", 0);
        gameState.setValue(GameState, "robotsPerWave", waveDefinition.robotCount);
        gameState.setValue(GameState, "waveCompleted", false);
        
        this.waveCompleted = false;
        
        // Show wave start message
        this.showWaveStartMessage(waveDefinition, waveNumber);
    }

    private getRobotTypeForSpawn(waveDefinition: any, robotId: number): string {
        // Early robots are basic, later ones are stronger
        if (robotId === waveDefinition.robotCount && Math.random() < waveDefinition.bossChance) {
            return "boss";
        }
        
        // Weighted random selection based on wave
        const weights: Record<string, number> = {
            scout: 0,
            assault: 0,
            siege: 0,
            flying: 0,
            mech: 0
        };
        
        waveDefinition.robotTypes.forEach((type: string) => {
            weights[type] = 1;
        });
        
        // Favor stronger types for later spawns in the wave
        if (robotId > waveDefinition.robotCount * 0.7) {
            weights.scout *= 0.5;
            weights.assault *= 1.5;
            weights.siege *= 2;
            weights.flying *= 2;
            weights.mech *= 3;
        }
        
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        
        for (const [type, weight] of Object.entries(weights)) {
            random -= weight;
            if (random <= 0) {
                return type;
            }
        }
        
        return "scout";
    }

    private spawnRobot(waveNumber: number, robotId: number, robotType: string): void {
        const spawnerEntities = Array.from(this.queries.waveSpawner.entities);
        if (spawnerEntities.length === 0) return;
        
        const spawner = spawnerEntities[0];
        const robotsToSpawn = spawner.getValue(WaveSpawner, "robotsToSpawn") || 3;
        
        // Spawn positions - BEHIND player (negative Z)
        const angle = (robotId / robotsToSpawn) * Math.PI * 2;
        const distanceFromCenter = 8 + (waveNumber * 2) + (robotId * 0.5);
        const heightVariation = 2 + (waveNumber * 0.5);
        
        // Position BEHIND the player (negative Z) - different for flying types
        let x = Math.cos(angle) * distanceFromCenter;
        let z = -10 - (waveNumber * 3) - (robotId * 0.3); // NEGATIVE Z = behind
        let y = 1.5 + Math.random() * heightVariation;
        
        // Flying robots start higher
        if (robotType === "flying" || robotType === "boss") {
            y = 3 + Math.random() * 3;
        }
        
        const position = new Vector3(x, y, z);
        
        // Create the robot based on type
        this.createRobotByType(position, robotId, waveNumber, robotType);
        
        console.log(`👽 ${robotType.toUpperCase()} spawned at Z=${z.toFixed(1)}`);
    }

    private createRobotByType(position: Vector3, id: number, waveNumber: number, type: string): void {
        let robotGroup: Group;
        let baseScale = 1.0;
        let health = 50;
        let damage = 10;
        let speed = 0.3;
        let points = 100;
        let armor = 0.0;
        let color = 0x00aa00;
        
        // Robot type configurations
        switch(type) {
            case "scout":
                robotGroup = this.createScoutRobot();
                baseScale = 1.2;
                health = 40 + (waveNumber * 5);
                damage = 8 + (waveNumber * 1);
                speed = 0.4;
                points = 100 + (waveNumber * 20);
                color = 0x00aa00;
                break;
                
            case "assault":
                robotGroup = this.createAssaultRobot();
                baseScale = 1.8;
                health = 80 + (waveNumber * 10);
                damage = 15 + (waveNumber * 2);
                speed = 0.25;
                points = 200 + (waveNumber * 30);
                armor = 0.2;
                color = 0xaa5500;
                break;
                
            case "siege":
                robotGroup = this.createSiegeRobot();
                baseScale = 2.4;
                health = 150 + (waveNumber * 15);
                damage = 25 + (waveNumber * 3);
                speed = 0.15;
                points = 400 + (waveNumber * 50);
                armor = 0.4;
                color = 0xaa0000;
                break;
                
            case "flying":
                robotGroup = this.createFlyingRobot();
                baseScale = 1.5;
                health = 60 + (waveNumber * 8);
                damage = 12 + (waveNumber * 1.5);
                speed = 0.35;
                points = 250 + (waveNumber * 40);
                armor = 0.1;
                color = 0x0088ff;
                break;
                
            case "mech":
                robotGroup = this.createMechRobot();
                baseScale = 2.8;
                health = 200 + (waveNumber * 20);
                damage = 30 + (waveNumber * 4);
                speed = 0.12;
                points = 600 + (waveNumber * 80);
                armor = 0.5;
                color = 0x8800ff;
                break;
                
            case "boss":
                robotGroup = this.createBossRobot();
                baseScale = 3.5;
                health = 500 + (waveNumber * 50);
                damage = 40 + (waveNumber * 5);
                speed = 0.1;
                points = 1000 + (waveNumber * 100);
                armor = 0.7;
                color = 0xff0000;
                break;
                
            default:
                robotGroup = this.createScoutRobot();
        }
        
        // Scale the robot
        const waveScaleBonus = 1 + (waveNumber * 0.1);
        robotGroup.scale.setScalar(baseScale * waveScaleBonus);
        robotGroup.position.copy(position);
        
        // Add rotation data for animation
        (robotGroup as any).userData = {
            rotationSpeed: speed * 0.5,
            floatHeight: position.y,
            floatSpeed: 0.5 + Math.random() * 0.3,
            timeOffset: Math.random() * Math.PI * 2,
            bobAmount: 0.2 + Math.random() * 0.1,
            robotType: type,
            waveNumber: waveNumber
        };
        
        // Create entity
        this.world
            .createTransformEntity(robotGroup)
            .addComponent(Robot, {
                id: id,
                type: type,
                tier: type === "scout" ? 1 : 
                      type === "assault" || type === "flying" ? 2 : 
                      type === "siege" || type === "mech" ? 3 : 4,
                health: health,
                maxHealth: health,
                speed: speed,
                attackDamage: damage,
                attackRange: type === "flying" ? 30.0 : 25.0,
                attackCooldown: Math.max(0.8, 3.0 - (waveNumber * 0.2)),
                lastAttackTime: 0.0,
                isDead: false,
                points: points,
                scaleMultiplier: baseScale * waveScaleBonus,
                armor: armor,
                lockOnDifficulty: armor * 0.8,
                targetPriority: type === "boss" ? 5.0 : 
                               type === "mech" ? 4.0 : 
                               type === "siege" ? 3.0 : 
                               type === "flying" ? 2.5 : 
                               type === "assault" ? 2.0 : 1.0
            })
            .addComponent(GameSound, {
                soundType: "robot",
                shouldPlay: false,
                lastPlayTime: 0.0
            });
    }

    // ============================================
    // ROBOT CREATION METHODS
    // ============================================

    private createScoutRobot(): Group {
        const group = new Group();
        
        // Main body - sleek design
        const bodyGeo = new SphereGeometry(0.6, 16, 16);
        const bodyMat = new MeshStandardMaterial({ 
            color: 0x00ff00,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x004400,
            emissiveIntensity: 0.6
        });
        const body = new Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Large central eye
        const eyeGeo = new SphereGeometry(0.25, 12, 12);
        const eyeMat = new MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1.5
        });
        const eye = new Mesh(eyeGeo, eyeMat);
        eye.position.z = 0.5;
        group.add(eye);
        
        // Antenna
        const antennaGeo = new CylinderGeometry(0.05, 0.02, 0.8, 6);
        const antennaMat = new MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.8
        });
        const antenna = new Mesh(antennaGeo, antennaMat);
        antenna.position.set(0, 0.6, 0);
        group.add(antenna);
        
        // Small thrusters
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const thrusterGeo = new CylinderGeometry(0.08, 0.12, 0.3, 8);
            const thrusterMat = new MeshStandardMaterial({ 
                color: 0xff8800,
                emissive: 0xff4400,
                emissiveIntensity: 0.7
            });
            const thruster = new Mesh(thrusterGeo, thrusterMat);
            thruster.position.set(
                Math.cos(angle) * 0.5,
                Math.sin(angle) * 0.5,
                -0.4
            );
            thruster.rotation.x = Math.PI / 2;
            group.add(thruster);
        }
        
        return group;
    }

    private createAssaultRobot(): Group {
        const group = new Group();
        
        // Armored hexagonal body
        const bodyGeo = new CylinderGeometry(0.8, 0.8, 0.6, 6);
        const bodyMat = new MeshStandardMaterial({ 
            color: 0xff5500,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x552200,
            emissiveIntensity: 0.5
        });
        const body = new Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Heavy armor plates
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const armorGeo = new BoxGeometry(0.3, 0.4, 0.1);
            const armorMat = new MeshStandardMaterial({ 
                color: 0x884400,
                metalness: 0.8,
                roughness: 0.2
            });
            const armor = new Mesh(armorGeo, armorMat);
            armor.position.set(
                Math.cos(angle) * 0.7,
                Math.sin(angle) * 0.7,
                0
            );
            armor.rotation.z = angle;
            group.add(armor);
        }
        
        // Weapon turrets
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const turretGeo = new CylinderGeometry(0.15, 0.2, 0.5, 8);
            const turretMat = new MeshStandardMaterial({ 
                color: 0xff0000,
                emissive: 0x880000,
                emissiveIntensity: 0.9
            });
            const turret = new Mesh(turretGeo, turretMat);
            turret.position.set(
                Math.cos(angle) * 0.4,
                0.2,
                Math.sin(angle) * 0.4
            );
            group.add(turret);
        }
        
        return group;
    }

    private createSiegeRobot(): Group {
        const group = new Group();
        
        // Massive spherical body
        const bodyGeo = new SphereGeometry(1.0, 24, 24);
        const bodyMat = new MeshStandardMaterial({ 
            color: 0xcc0000,
            metalness: 0.9,
            roughness: 0.15,
            emissive: 0x440000,
            emissiveIntensity: 0.8
        });
        const body = new Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Shield plates orbiting around
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const shieldGeo = new TorusGeometry(1.4, 0.2, 8, 16);
            const shieldMat = new MeshStandardMaterial({ 
                color: 0x00ffff,
                emissive: 0x0088ff,
                emissiveIntensity: 1.2,
                transparent: true,
                opacity: 0.6
            });
            const shield = new Mesh(shieldGeo, shieldMat);
            shield.rotation.x = Math.PI / 2;
            shield.position.y = Math.sin(angle) * 0.3;
            group.add(shield);
            
            // Add orbital animation data
            (shield as any).userData = {
                orbitAngle: angle,
                orbitSpeed: 0.5 + Math.random() * 0.3,
                offset: Math.random() * Math.PI * 2
            };
        }
        
        // Heavy weapon barrels
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const barrelGeo = new CylinderGeometry(0.12, 0.18, 1.5, 10);
            const barrelMat = new MeshStandardMaterial({ 
                color: 0xffaa00,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x884400,
                emissiveIntensity: 0.7
            });
            const barrel = new Mesh(barrelGeo, barrelMat);
            barrel.position.set(
                Math.cos(angle) * 0.8,
                0,
                Math.sin(angle) * 0.8
            );
            barrel.rotation.y = angle;
            group.add(barrel);
        }
        
        return group;
    }

    private createFlyingRobot(): Group {
        const group = new Group();
        
        // Main saucer body
        const bodyGeo = new TorusGeometry(0.8, 0.3, 16, 32);
        const bodyMat = new MeshStandardMaterial({ 
            color: 0x0088ff,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x004488,
            emissiveIntensity: 1.0
        });
        const body = new Mesh(bodyGeo, bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        
        // Central energy core
        const coreGeo = new SphereGeometry(0.4, 16, 16);
        const coreMat = new MeshStandardMaterial({ 
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.8
        });
        const core = new Mesh(coreGeo, coreMat);
        group.add(core);
        
        // Rotating rings
        for (let i = 0; i < 3; i++) {
            const ringRadius = 0.9 + (i * 0.3);
            const ringGeo = new TorusGeometry(ringRadius, 0.05, 8, 32);
            const ringMat = new MeshStandardMaterial({ 
                color: 0x00ff00,
                emissive: 0x00ff00,
                emissiveIntensity: 1.2,
                transparent: true,
                opacity: 0.7
            });
            const ring = new Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = i * 0.1 - 0.1;
            group.add(ring);
            
            // Add rotation data
            (ring as any).userData = {
                rotationSpeed: 0.8 + (i * 0.3),
                direction: i % 2 === 0 ? 1 : -1
            };
        }
        
        // Energy beams/projectors
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const beamGeo = new ConeGeometry(0.1, 0.8, 8);
            const beamMat = new MeshStandardMaterial({ 
                color: 0xff00ff,
                emissive: 0xff00ff,
                emissiveIntensity: 1.5
            });
            const beam = new Mesh(beamGeo, beamMat);
            beam.position.set(
                Math.cos(angle) * 0.9,
                0.4,
                Math.sin(angle) * 0.9
            );
            beam.rotation.x = Math.PI;
            group.add(beam);
        }
        
        return group;
    }

    private createMechRobot(): Group {
        const group = new Group();
        
        // Torso
        const torsoGeo = new BoxGeometry(1.4, 2.0, 0.8);
        const torsoMat = new MeshStandardMaterial({ 
            color: 0x9900ff,
            metalness: 0.9,
            roughness: 0.15,
            emissive: 0x440088,
            emissiveIntensity: 0.7
        });
        const torso = new Mesh(torsoGeo, torsoMat);
        group.add(torso);
        
        // Head
        const headGeo = new SphereGeometry(0.6, 16, 16);
        const headMat = new MeshStandardMaterial({ 
            color: 0xff00ff,
            emissive: 0xff00ff,
            emissiveIntensity: 1.2
        });
        const head = new Mesh(headGeo, headMat);
        head.position.y = 1.4;
        group.add(head);
        
        // Legs
        for (let i = 0; i < 2; i++) {
            const legX = i === 0 ? -0.5 : 0.5;
            
            // Upper leg
            const upperLegGeo = new CylinderGeometry(0.3, 0.4, 1.2, 8);
            const upperLeg = new Mesh(upperLegGeo, torsoMat);
            upperLeg.position.set(legX, -0.8, 0);
            upperLeg.rotation.x = Math.PI / 6;
            group.add(upperLeg);
            
            // Lower leg
            const lowerLegGeo = new CylinderGeometry(0.2, 0.3, 1.4, 8);
            const lowerLeg = new Mesh(lowerLegGeo, torsoMat);
            lowerLeg.position.set(legX, -2.0, 0.3);
            group.add(lowerLeg);
            
            // Foot
            const footGeo = new BoxGeometry(0.6, 0.2, 0.8);
            const foot = new Mesh(footGeo, torsoMat);
            foot.position.set(legX, -2.7, 0.2);
            group.add(foot);
        }
        
        // Arms with weapons
        for (let i = 0; i < 2; i++) {
            const armX = i === 0 ? -1.0 : 1.0;
            
            // Shoulder
            const shoulderGeo = new SphereGeometry(0.4, 12, 12);
            const shoulder = new Mesh(shoulderGeo, torsoMat);
            shoulder.position.set(armX, 0.6, 0);
            group.add(shoulder);
            
            // Upper arm
            const upperArmGeo = new CylinderGeometry(0.2, 0.25, 1.2, 8);
            const upperArm = new Mesh(upperArmGeo, torsoMat);
            upperArm.position.set(armX, -0.2, 0);
            upperArm.rotation.z = Math.PI / 4 * (i === 0 ? -1 : 1);
            group.add(upperArm);
            
            // Forearm with weapon
            const forearmGeo = new CylinderGeometry(0.15, 0.2, 1.0, 8);
            const forearm = new Mesh(forearmGeo, torsoMat);
            forearm.position.set(armX * 1.5, -0.8, 0);
            group.add(forearm);
            
            // Weapon
            const weaponGeo = new BoxGeometry(0.5, 0.3, 0.8);
            const weaponMat = new MeshStandardMaterial({ 
                color: 0xff0000,
                emissive: 0x880000,
                emissiveIntensity: 1.0
            });
            const weapon = new Mesh(weaponGeo, weaponMat);
            weapon.position.set(armX * 1.8, -0.8, 0.4);
            group.add(weapon);
        }
        
        // Back thrusters
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const thrusterGeo = new CylinderGeometry(0.2, 0.3, 0.8, 8);
            const thrusterMat = new MeshStandardMaterial({ 
                color: 0xff8800,
                emissive: 0xff4400,
                emissiveIntensity: 1.5
            });
            const thruster = new Mesh(thrusterGeo, thrusterMat);
            thruster.position.set(
                Math.cos(angle) * 0.6,
                -0.5,
                Math.sin(angle) * 0.6 - 0.4
            );
            thruster.rotation.x = Math.PI / 2;
            group.add(thruster);
        }
        
        return group;
    }

    private createBossRobot(): Group {
        const group = new Group();
        
        // Massive pyramid-like body
        const bodyGeo = new ConeGeometry(2.0, 3.0, 8);
        const bodyMat = new MeshStandardMaterial({ 
            color: 0xff0000,
            metalness: 0.95,
            roughness: 0.05,
            emissive: 0x880000,
            emissiveIntensity: 1.2
        });
        const body = new Mesh(bodyGeo, bodyMat);
        group.add(body);
        
        // Floating armor plates
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const plateGeo = new BoxGeometry(0.8, 0.1, 0.4);
            const plateMat = new MeshStandardMaterial({ 
                color: 0xffff00,
                metalness: 0.9,
                roughness: 0.1,
                emissive: 0x884400,
                emissiveIntensity: 0.8
            });
            const plate = new Mesh(plateGeo, plateMat);
            plate.position.set(
                Math.cos(angle) * 2.5,
                Math.sin(angle) * 0.5,
                Math.sin(angle) * 2.5
            );
            plate.lookAt(new Vector3(0, 0, 0));
            group.add(plate);
            
            // Add orbit data
            (plate as any).userData = {
                orbitAngle: angle,
                orbitSpeed: 0.3 + Math.random() * 0.2,
                floatOffset: Math.random() * Math.PI * 2
            };
        }
        
        // Multiple weapon systems
        const weaponTypes = [
            { geo: new CylinderGeometry(0.3, 0.4, 2.0, 10), count: 4 },
            { geo: new SphereGeometry(0.6, 16, 16), count: 2 },
            { geo: new TorusGeometry(1.0, 0.2, 8, 16), count: 3 }
        ];
        
        weaponTypes.forEach((weaponType, typeIndex) => {
            const weaponMat = new MeshStandardMaterial({ 
                color: typeIndex === 0 ? 0xff00ff : typeIndex === 1 ? 0x00ffff : 0xffff00,
                emissive: typeIndex === 0 ? 0x880088 : typeIndex === 1 ? 0x008888 : 0x888800,
                emissiveIntensity: 1.5
            });
            
            for (let i = 0; i < weaponType.count; i++) {
                const angle = (i / weaponType.count) * Math.PI * 2 + (typeIndex * Math.PI / 3);
                const weapon = new Mesh(weaponType.geo, weaponMat);
                weapon.position.set(
                    Math.cos(angle) * 1.8,
                    -0.8 + (typeIndex * 0.6),
                    Math.sin(angle) * 1.8
                );
                weapon.rotation.y = angle;
                group.add(weapon);
            }
        });
        
        // Central energy core
        const coreGeo = new SphereGeometry(1.0, 24, 24);
        const coreMat = new MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.9
        });
        const core = new Mesh(coreGeo, coreMat);
        core.position.y = 1.0;
        group.add(core);
        
        // Energy tendrils
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const tendrilGeo = new CylinderGeometry(0.05, 0.1, 3.0, 8);
            const tendrilMat = new MeshStandardMaterial({ 
                color: 0x00ff00,
                emissive: 0x00ff00,
                emissiveIntensity: 2.0,
                transparent: true,
                opacity: 0.7
            });
            const tendril = new Mesh(tendrilGeo, tendrilMat);
            tendril.position.set(
                Math.cos(angle) * 1.5,
                0.5,
                Math.sin(angle) * 1.5
            );
            tendril.rotation.x = Math.PI / 4;
            tendril.rotation.z = angle;
            group.add(tendril);
        }
        
        return group;
    }

    private completeWave(gameState: Entity, spawner: Entity, waveNumber: number): void {
        console.log(`🎉 WAVE ${waveNumber} COMPLETED!`);
        
        const waveBonus = waveNumber * 500;
        const currentScore = gameState.getValue(GameState, "score") || 0;
        const newScore = currentScore + waveBonus;
        
        gameState.setValue(GameState, "score", newScore);
        gameState.setValue(GameState, "waveCompleted", true);
        
        this.showWaveCompleteMessage(waveNumber, waveBonus);
        
        setTimeout(() => {
            this.startWave(waveNumber + 1);
        }, this.waveStartDelay);
    }

    private showWaveStartMessage(waveDefinition: any, waveNumber: number): void {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(80,0,0,0.98));
            color: white;
            padding: 30px 50px;
            border-radius: 20px;
            font-family: 'Arial Black', sans-serif;
            text-align: center;
            z-index: 2000;
            border: 4px solid #ff0000;
            box-shadow: 0 0 50px rgba(255, 0, 0, 0.7);
            min-width: 400px;
            backdrop-filter: blur(10px);
        `;
        
        messageDiv.innerHTML = `
            <div style="color: #ff4444; font-size: 42px; font-weight: bold; margin-bottom: 15px; text-shadow: 0 0 20px #ff0000;">
                WAVE ${waveNumber}
            </div>
            <div style="font-size: 32px; margin-bottom: 10px; color: #ffaa00;">
                ${waveDefinition.name}
            </div>
            <div style="font-size: 22px; margin-bottom: 20px; color: #88ccff;">
                ${waveDefinition.description}
            </div>
            <div style="font-size: 18px; color: #aaa; margin-top: 15px;">
                👾 ${waveDefinition.robotCount} ROBOTS INCOMING!
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        // Add pulsing animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes waveStartPulse {
                0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        messageDiv.style.animation = 'waveStartPulse 0.8s ease-out';
        
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
        }, 3000);
    }

    private showWaveCompleteMessage(waveNumber: number, bonus: number): void {
        const nextWave = waveNumber + 1;
        const isFinalWave = waveNumber === 6;
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(0,${isFinalWave ? 0 : 100},0,0.98));
            color: white;
            padding: 40px 60px;
            border-radius: 25px;
            font-family: 'Arial Black', sans-serif;
            text-align: center;
            z-index: 2000;
            border: 5px solid #00ff00;
            box-shadow: 0 0 60px rgba(0, 255, 0, 0.7);
            min-width: 450px;
            backdrop-filter: blur(10px);
        `;
        
        messageDiv.innerHTML = `
            <div style="color: #00ff00; font-size: 48px; font-weight: bold; margin-bottom: 20px; text-shadow: 0 0 25px #00ff00;">
                ${isFinalWave ? '🎖️ VICTORY!' : '🎉 WAVE COMPLETE!'}
            </div>
            <div style="font-size: 36px; margin-bottom: 15px; color: #ffff00;">
                Wave ${waveNumber} Destroyed
            </div>
            <div style="font-size: 28px; margin-bottom: 20px; color: #00ffff;">
                +${bonus.toLocaleString()} BONUS
            </div>
            ${isFinalWave ? 
                '<div style="font-size: 24px; margin-bottom: 20px; color: #ffaa00;">ALL WAVES DEFEATED! YOU ARE THE CHAMPION!</div>' :
                `<div style="font-size: 24px; margin-bottom: 30px; color: #88ccff;">Wave ${nextWave} in 4 seconds...</div>`
            }
            <div style="font-size: 18px; color: #aaa;">
                ${isFinalWave ? '🏆 Mission Accomplished! 🏆' : 'Get ready for more destruction!'}
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        // Add celebration animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes victoryPulse {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
                40% { transform: translate(-50%, -50%) scale(0.95); }
                60% { transform: translate(-50%, -50%) scale(1.05); }
                80% { transform: translate(-50%, -50%) scale(0.98); }
                100% { transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
        messageDiv.style.animation = 'victoryPulse 1.2s ease-out';
        
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
        }, isFinalWave ? 5000 : 3800);
    }

    private showVictoryMessage(): void {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(0,0,0,0.98), rgba(100,0,100,0.98));
            color: white;
            padding: 50px 80px;
            border-radius: 30px;
            font-family: 'Arial Black', sans-serif;
            text-align: center;
            z-index: 2000;
            border: 6px solid #ff00ff;
            box-shadow: 0 0 100px rgba(255, 0, 255, 0.8);
            min-width: 500px;
            backdrop-filter: blur(15px);
        `;
        
        messageDiv.innerHTML = `
            <div style="color: #ffff00; font-size: 64px; font-weight: bold; margin-bottom: 30px; text-shadow: 0 0 30px #ffff00;">
                🏆 VICTORY! 🏆
            </div>
            <div style="font-size: 48px; margin-bottom: 20px; color: #00ffff;">
                ALL 6 WAVES DEFEATED!
            </div>
            <div style="font-size: 32px; margin-bottom: 30px; color: #ffaa00;">
                You are the ultimate space defender!
            </div>
            <div style="font-size: 24px; color: #88ff88; margin-bottom: 40px;">
                The alien invasion has been repelled!
            </div>
            <button onclick="location.reload()" style="
                padding: 20px 50px;
                font-size: 28px;
                background: linear-gradient(135deg, #ff00ff, #00ffff);
                color: white;
                border: none;
                border-radius: 15px;
                cursor: pointer;
                font-family: 'Arial Black', sans-serif;
                font-weight: bold;
                margin-top: 20px;
                box-shadow: 0 0 30px rgba(255, 0, 255, 0.7);
                transition: all 0.3s;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                🎮 PLAY AGAIN
            </button>
        `;
        
        document.body.appendChild(messageDiv);
        
        // Add victory animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes victoryCelebration {
                0% { transform: translate(-50%, -50%) scale(0.5) rotate(0deg); opacity: 0; }
                30% { transform: translate(-50%, -50%) scale(1.2) rotate(5deg); opacity: 1; }
                50% { transform: translate(-50%, -50%) scale(1.1) rotate(-5deg); }
                70% { transform: translate(-50%, -50%) scale(1.15) rotate(3deg); }
                100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
            }
        `;
        document.head.appendChild(style);
        messageDiv.style.animation = 'victoryCelebration 1.5s ease-out';
        
        // Add confetti effect
        this.createConfettiEffect();
    }

    private createConfettiEffect(): void {
        for (let i = 0; i < 200; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][Math.floor(Math.random() * 6)]};
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                z-index: 1999;
                pointer-events: none;
                animation: confettiFall ${2 + Math.random() * 3}s linear forwards;
                left: ${Math.random() * 100}%;
                top: -20px;
            `;
            
            const style = document.createElement('style');
            style.textContent = `
                @keyframes confettiFall {
                    0% {
                        transform: translate(0, 0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(${(Math.random() - 0.5) * 200}px, 100vh) rotate(${Math.random() * 360}deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(confetti);
            
            setTimeout(() => {
                confetti.remove();
                style.remove();
            }, 5000);
        }
    }
}