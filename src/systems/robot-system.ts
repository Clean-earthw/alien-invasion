import { 
    createSystem, 
    Vector3, 
    Entity,
    AudioUtils,
    Mesh,
    MeshStandardMaterial,
    SphereGeometry,
    AudioSource,
    Quaternion,
    BoxGeometry,
    CylinderGeometry
} from "@iwsdk/core";
import * as THREE from 'three';
import { 
    Robot, 
    Player, 
    DamageEffect,
    GameState,
    GameSound,
    ToRemove
} from "../components.js";

// Robot type definitions - ADDED 'type' PROPERTY
const ROBOT_TYPES = {
    easy: {
        type: "easy", // ADDED THIS
        health: 60.0,
        maxHealth: 60.0,
        speed: 0.4,
        attackDamage: 8.0,
        attackCooldown: 3.0,
        attackRange: 25.0, // ADDED THIS
        points: 100,
        scale: 1.2,
        armor: 0.0,
        lockOnDifficulty: 0.1,
        targetPriority: 1.0,
        color: 0x00aa00,
        materialProps: {
            metalness: 0.3,
            roughness: 0.7,
            emissive: 0x002200,
            emissiveIntensity: 0.5
        }
    },
    medium: {
        type: "medium", // ADDED THIS
        health: 120.0,
        maxHealth: 120.0,
        speed: 0.25,
        attackDamage: 15.0,
        attackCooldown: 2.5,
        attackRange: 25.0, // ADDED THIS
        points: 200,
        scale: 1.8,
        armor: 0.2,
        lockOnDifficulty: 0.4,
        targetPriority: 1.5,
        color: 0xaa8800,
        materialProps: {
            metalness: 0.6,
            roughness: 0.4,
            emissive: 0x442200,
            emissiveIntensity: 0.7
        }
    },
    boss: {
        type: "boss", // ADDED THIS
        health: 300.0,
        maxHealth: 300.0,
        speed: 0.15,
        attackDamage: 25.0,
        attackCooldown: 2.0,
        attackRange: 30.0, // ADDED THIS (boss has longer range)
        points: 500,
        scale: 2.5,
        armor: 0.5,
        lockOnDifficulty: 0.8,
        targetPriority: 3.0,
        color: 0xaa0000,
        materialProps: {
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x550000,
            emissiveIntensity: 1.0
        }
    }
};

export class RobotSystem extends createSystem(
    {
        activeRobots: {
            required: [Robot],
        },
        player: {
            required: [Player]
        },
        gameState: {
            required: [GameState]
        },
        robotsWithSound: {
            required: [Robot, GameSound]
        },
        robotsToRemove: {
            required: [ToRemove]
        }
    },
    {}
) {
    private tempVec3 = new Vector3();
    private playerPos = new Vector3();
    
    // Audio configuration
    private readonly HIT_SOUND = "./audio/hit.mp3";
    private readonly DEATH_SOUND = "./audio/explosion.mp3";
    private readonly ATTACK_SOUND = "./audio/robot_attack.mp3";
    private readonly SPAWN_SOUND = "./audio/wave_start.mp3";
    private readonly CELEBRATION_SOUND = "./audio/ding.mp3"; // Added celebration sound
    private readonly SCORE_SOUND = "./audio/ding.mp3"; // Added score sound
    
    private audioElements = new Map<string, HTMLAudioElement>();
    private deadRobots = new Map<number, number>();
    private robotMeshes = new Map<number, Mesh>();
    private celebrationEffects: Array<{element: HTMLElement, life: number}> = []; // Added for celebration effects

    init(): void {
        console.log("🤖 RobotSystem initialized with classification system");
        this.preloadAudio();
    }

    private preloadAudio(): void {
        const audioFiles = [
            this.HIT_SOUND,
            this.DEATH_SOUND,
            this.ATTACK_SOUND,
            this.SPAWN_SOUND,
            this.CELEBRATION_SOUND, // Added
            this.SCORE_SOUND // Added
        ];
        
        audioFiles.forEach(src => {
            const audio = new Audio();
            audio.src = src;
            audio.preload = "auto";
            this.audioElements.set(src, audio);
        });
    }

    update(dt: number, time: number): void {        
        // Update celebration effects
        this.updateCelebrationEffects(dt);
        
        // Get player position
        this.playerPos.set(0, 1.5, 0);
        if (this.world.camera) {
            this.world.camera.getWorldPosition(this.playerPos);
        }

        // Check for game over
        let gameOver = false;
        for (const stateEntity of this.queries.gameState.entities) {
            gameOver = stateEntity.getValue(GameState, "gameOver") || false;
            if (gameOver) break;
        }

        if (gameOver) return;

        // Process active robots
        for (const robotEntity of this.queries.activeRobots.entities) {
            const robotIndex = robotEntity.index;
            const isDead = robotEntity.getValue(Robot, "isDead");
            
            if (isDead) {
                if (!this.deadRobots.has(robotIndex)) {
                    this.deadRobots.set(robotIndex, time + 2.0);
                }
                continue;
            }
            
            const robotObj = robotEntity.object3D;
            if (!robotObj) continue;
            
            const robotType = robotEntity.getValue(Robot, "type") || "easy";
            const typeConfig = ROBOT_TYPES[robotType as keyof typeof ROBOT_TYPES] || ROBOT_TYPES.easy;
            
            // Apply type-specific behavior
            this.updateRobotBehavior(robotEntity, robotObj, typeConfig, robotType, dt, time);
        }
        
        // Remove dead robots
        this.cleanupDeadRobots(time);
    }

    // ADDED robotType parameter to fix the error
    private updateRobotBehavior(robotEntity: Entity, robotObj: THREE.Object3D, 
                                typeConfig: any, robotType: string, dt: number, time: number): void {
        // Floating animation based on type
        const floatData = (robotObj as any).userData;
        if (floatData) {
            const { floatHeight, floatSpeed, timeOffset, bobAmount } = floatData;
            robotObj.position.y = floatHeight + Math.sin((time + timeOffset) * floatSpeed) * bobAmount;
            
            const rotationSpeed = typeConfig.speed * 0.01;
            robotObj.rotation.y += rotationSpeed;
        }
        
        // Get position
        const robotPos = new Vector3();
        robotObj.getWorldPosition(robotPos);
        
        const distanceToPlayer = robotPos.distanceTo(this.playerPos);
        
        // Face player with type-specific smoothness
        const lookAtPos = new Vector3(this.playerPos.x, this.playerPos.y * 0.8, this.playerPos.z);
        const lookAtQuat = new Quaternion();
        
        // Create rotation matrix using THREE.js
        const matrix = new THREE.Matrix4();
        matrix.lookAt(robotPos, lookAtPos, new Vector3(0, 1, 0));
        lookAtQuat.setFromRotationMatrix(matrix);
        
        // Smooth rotation
        const rotationSpeedFactor = 1.0 - (typeConfig.lockOnDifficulty * 0.5);
        const slerpAmount = Math.min(1, dt * rotationSpeedFactor * 5);
        
        // Create interpolated quaternion
        const currentQuat = new Quaternion();
        robotObj.getWorldQuaternion(currentQuat);
        
        const slerpedQuat = new Quaternion();
        slerpedQuat.slerpQuaternions(currentQuat, lookAtQuat, slerpAmount);
        robotObj.quaternion.copy(slerpedQuat);
        
        // Pulsing glow effect
        const pulseSpeed = typeConfig.speed * 2.0;
        const pulseIntensity = 0.8 + Math.sin(time * pulseSpeed) * 0.4;
        robotObj.traverse((child: any) => {
            if (child.isMesh && child.material && child.material.emissive) {
                child.material.emissiveIntensity = pulseIntensity;
            }
        });
        
        // Attack logic - FIXED: use robotType parameter instead of typeConfig.type
        const attackRange = typeConfig.attackRange || 25.0;
        const lastAttackTime = robotEntity.getValue(Robot, "lastAttackTime") || 0.0;
        
        // Check line of sight - FIXED: use robotType parameter
        // In space, robots behind the ship can see the player through the window
        const canSeePlayer = robotPos.z < -5 && (robotType === "boss" || Math.abs(robotPos.x) < 20);
        
        if (canSeePlayer && distanceToPlayer <= attackRange) {
            const attackCooldown = typeConfig.attackCooldown;
            
            if (time - lastAttackTime >= attackCooldown) {
                // Pass robotType to performAttack
                this.performAttack(robotEntity, typeConfig, robotType, robotPos, time);
            }
        }
        
        // Movement - FIXED: use robotType parameter
        this.updateRobotMovement(robotEntity, robotObj, robotType, robotPos, dt);
    }

    // ADDED robotType parameter
    private performAttack(robotEntity: Entity, typeConfig: any, robotType: string, 
                         robotPos: Vector3, time: number): void {
        robotEntity.setValue(Robot, "lastAttackTime", time);
        
        // Play attack sound
        const volume = 0.5 + (typeConfig.scale * 0.1);
        this.playRobotSound(robotEntity, this.ATTACK_SOUND, volume);
        
        // Damage player
        for (const playerEntity of this.queries.player.entities) {
            const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
            const damage = typeConfig.attackDamage;
            const newHealth = Math.max(0, currentHealth - damage);
            
            playerEntity.setValue(Player, "health", newHealth);
            playerEntity.setValue(Player, "lastDamageTime", time);
            
            if (!playerEntity.hasComponent(DamageEffect)) {
                playerEntity.addComponent(DamageEffect, {
                    time: 0.0,
                    duration: 0.4,
                    intensity: 1.0 + (typeConfig.scale * 0.2)
                });
            }
            
            // Flash effect
            this.flashRobot(robotEntity, 0xff3300, 0.3);
            
            // Create laser beam
            this.createLaserBeam(robotPos, this.playerPos, typeConfig.color);
            
            console.log(`👽 ${robotType.toUpperCase()} attacked! Damage: ${damage}`);
            break;
        }
    }

    // CHANGED: use robotType parameter instead of typeConfig
    private updateRobotMovement(robotEntity: Entity, robotObj: THREE.Object3D, 
                               robotType: string, robotPos: Vector3, dt: number): void {
        // Get speed from robot component
        const speed = robotEntity.getValue(Robot, "speed") || 0.3;
        const distanceToPlayer = robotPos.distanceTo(this.playerPos);
        
        // Move toward player if far enough away
        if (robotPos.z < -8 && distanceToPlayer > 15) {
            const moveAmount = speed * dt;
            
            // Different movement patterns per type
            switch (robotType) {
                case "easy":
                    // Straightforward movement with some randomness
                    robotPos.z += moveAmount * 0.8; // Move forward (positive Z)
                    robotPos.x += (Math.random() - 0.5) * moveAmount * 0.3; // Slight horizontal drift
                    break;
                    
                case "medium":
                    // Zigzag movement
                    const zigzag = Math.sin(performance.now() * 0.001) * 0.5;
                    robotPos.z += moveAmount * 0.7;
                    robotPos.x += zigzag * moveAmount * 0.4;
                    break;
                    
                case "boss":
                    // Slow but steady movement, tries to stay centered
                    robotPos.z += moveAmount * 0.5;
                    robotPos.x *= 0.99; // Slowly drift toward center
                    break;
                    
                default:
                    // Default movement for unknown types
                    robotPos.z += moveAmount * 0.8;
                    robotPos.x += (Math.random() - 0.5) * moveAmount * 0.2;
            }
            
            // Update robot position
            robotObj.position.copy(robotPos);
        }
    }

    // ============================================
    // PUBLIC METHOD: Create a robot with specific type
    // ============================================
    public createRobot(position: Vector3, type: string = "easy"): Entity {
        const typeConfig = ROBOT_TYPES[type as keyof typeof ROBOT_TYPES] || ROBOT_TYPES.easy;
        
        // Create robot mesh based on type
        const robotMesh = this.createRobotMesh(type, typeConfig);
        robotMesh.position.copy(position);
        
        // Create entity
        const robotEntity = this.world.createTransformEntity(robotMesh)
            .addComponent(Robot, {
                type: type,
                tier: type === "easy" ? 1 : type === "medium" ? 2 : 3,
                health: typeConfig.health,
                maxHealth: typeConfig.maxHealth,
                speed: typeConfig.speed,
                attackDamage: typeConfig.attackDamage,
                attackCooldown: typeConfig.attackCooldown,
                points: typeConfig.points,
                scaleMultiplier: typeConfig.scale,
                armor: typeConfig.armor,
                lockOnDifficulty: typeConfig.lockOnDifficulty,
                targetPriority: typeConfig.targetPriority
            })
            .addComponent(GameSound, {
                soundType: "robot",
                shouldPlay: false,
                lastPlayTime: 0.0
            });
        
        // Add floating animation data
        (robotMesh as any).userData = {
            floatHeight: position.y,
            floatSpeed: 1.0 + Math.random() * 0.5,
            timeOffset: Math.random() * Math.PI * 2,
            bobAmount: 0.1 + Math.random() * 0.05
        };
        
        // Cache the mesh
        this.robotMeshes.set(robotEntity.index, robotMesh);
        
        // Play spawn sound for boss
        if (type === "boss") {
            this.playGlobalSound(this.SPAWN_SOUND, 1.0);
        }
        
        console.log(`🤖 Created ${type.toUpperCase()} robot at ${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}`);
        return robotEntity;
    }

        private createCentralExplosion(position: Vector3, scaleMultiplier: number): void {
        // Large central explosion
        const geometry = new SphereGeometry(0.8 * scaleMultiplier, 16, 16);
        const material = new MeshStandardMaterial({
            color: 0xff8800,
            emissive: 0xff0000,
            emissiveIntensity: 4.0,
            transparent: true,
            opacity: 1.0
        });
        
        const explosion = new Mesh(geometry, material);
        explosion.position.copy(position);
        
        if (this.world.scene) {
            this.world.scene.add(explosion);
        }
        
        // Create shockwave ring
        const ringGeometry = new (THREE as any).RingGeometry(1 * scaleMultiplier, 1.2 * scaleMultiplier, 32);
        const ringMaterial = new MeshStandardMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const shockwave = new Mesh(ringGeometry, ringMaterial);
        shockwave.position.copy(position);
        shockwave.position.y += 0.5;
        shockwave.rotation.x = Math.PI / 2;
        
        if (this.world.scene) {
            this.world.scene.add(shockwave);
        }
        
        // Animate explosion
        let scale = 1.0;
        let opacity = 1.0;
        const animate = () => {
            if (!explosion || !shockwave) return;
            
            scale += 0.1;
            opacity -= 0.02;
            
            explosion.scale.setScalar(scale);
            explosion.material.opacity = opacity;
            
            shockwave.scale.setScalar(scale * 1.5);
            shockwave.material.opacity = opacity * 0.8;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                if (explosion.parent) explosion.parent.remove(explosion);
                if (shockwave.parent) shockwave.parent.remove(shockwave);
            }
        };
        
        animate();
    }


        private createSingleNodeExplosion(position: Vector3, color: any, scaleMultiplier: number): void {
        // Create small sphere explosion
        const geometry = new SphereGeometry(0.2 * scaleMultiplier, 8, 8);
        const material = new MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.9
        });
        
        const explosion = new Mesh(geometry, material);
        explosion.position.copy(position);
        
        if (this.world.scene) {
            this.world.scene.add(explosion);
        }
        
        // Random explosion direction
        const velocity = new Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        
        let life = 1.0;
        const animate = () => {
            if (!explosion) return;
            
            life -= 0.03;
            explosion.position.add(velocity.clone().multiplyScalar(0.016));
            velocity.y -= 0.5; // Gravity
            
            explosion.scale.multiplyScalar(1.05);
            explosion.material.opacity = life;
            
            if (life > 0) {
                requestAnimationFrame(animate);
            } else {
                if (explosion.parent) {
                    explosion.parent.remove(explosion);
                }
            }
        };
        
        animate();
    }



    private createRobotMesh(type: string, config: any): Mesh {
        let mesh: Mesh;
        
        switch (type) {
            case "easy":
                const sphereGeo = new SphereGeometry(0.4, 12, 12);
                const sphereMat = new MeshStandardMaterial({
                    color: config.color,
                    metalness: config.materialProps.metalness,
                    roughness: config.materialProps.roughness,
                    emissive: config.materialProps.emissive,
                    emissiveIntensity: config.materialProps.emissiveIntensity
                });
                mesh = new Mesh(sphereGeo, sphereMat);
                break;
                
            case "medium":
                const bodyGeo = new BoxGeometry(0.7, 0.9, 0.7);
                const bodyMat = new MeshStandardMaterial({
                    color: config.color,
                    metalness: config.materialProps.metalness,
                    roughness: config.materialProps.roughness,
                    emissive: config.materialProps.emissive,
                    emissiveIntensity: config.materialProps.emissiveIntensity
                });
                mesh = new Mesh(bodyGeo, bodyMat);
                
                // Add arms
                const armGeo = new CylinderGeometry(0.1, 0.1, 0.8, 8);
                const armMat = new MeshStandardMaterial({
                    color: config.color,
                    metalness: config.materialProps.metalness,
                    roughness: config.materialProps.roughness,
                    emissive: config.materialProps.emissive,
                    emissiveIntensity: config.materialProps.emissiveIntensity
                });
                
                const leftArm = new Mesh(armGeo, armMat);
                leftArm.position.set(-0.5, 0, 0);
                leftArm.rotation.z = Math.PI / 6;
                mesh.add(leftArm);
                
                const rightArm = new Mesh(armGeo, armMat);
                rightArm.position.set(0.5, 0, 0);
                rightArm.rotation.z = -Math.PI / 6;
                mesh.add(rightArm);
                break;
                
            case "boss":
                const bossBodyGeo = new BoxGeometry(1.2, 1.4, 1.2);
                const bossBodyMat = new MeshStandardMaterial({
                    color: config.color,
                    metalness: config.materialProps.metalness,
                    roughness: config.materialProps.roughness,
                    emissive: config.materialProps.emissive,
                    emissiveIntensity: config.materialProps.emissiveIntensity
                });
                mesh = new Mesh(bossBodyGeo, bossBodyMat);
                
                // Add spikes/cannons
                const spikeGeo = new CylinderGeometry(0.05, 0.15, 0.6, 6);
                const spikeMat = new MeshStandardMaterial({
                    color: 0xffff00,
                    emissive: 0xffff00,
                    emissiveIntensity: 0.8
                });
                
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const spike = new Mesh(spikeGeo, spikeMat);
                    spike.position.set(
                        Math.cos(angle) * 0.8,
                        0.7,
                        Math.sin(angle) * 0.8
                    );
                    spike.lookAt(new Vector3(0, 0, 0));
                    mesh.add(spike);
                }
                break;
                
            default:
                const defaultGeo = new SphereGeometry(0.4, 12, 12);
                const defaultMat = new MeshStandardMaterial({
                    color: config.color,
                    metalness: config.materialProps.metalness,
                    roughness: config.materialProps.roughness,
                    emissive: config.materialProps.emissive,
                    emissiveIntensity: config.materialProps.emissiveIntensity
                });
                mesh = new Mesh(defaultGeo, defaultMat);
        }
        
        mesh.scale.setScalar(config.scale);
        return mesh;
    }

    // ============================================
    // PUBLIC METHOD: Called when robot is hit
    // ============================================
    public onRobotHit(robotEntity: Entity, damage: number, hitPosition: Vector3): void {
        if (robotEntity.getValue(Robot, "isDead")) return;
        
        const robotObj = robotEntity.object3D;
        if (!robotObj) return;
        
        const armor = robotEntity.getValue(Robot, "armor") || 0.0;
        const damageReduction = 1.0 - Math.min(armor, 0.8);
        const actualDamage = damage * damageReduction;
        
        const currentHealth = robotEntity.getValue(Robot, "health") || 0.0;
        const newHealth = Math.max(0, currentHealth - actualDamage);
        robotEntity.setValue(Robot, "health", newHealth);
        robotEntity.setValue(Robot, "lastHitTime", performance.now() / 1000);
        
        // Play hit sound
        this.playRobotSound(robotEntity, this.HIT_SOUND, 0.8);
        
        // Visual hit effect
        this.flashRobot(robotEntity, 0x00ffff, 0.2);
        this.createHitEffect(hitPosition, robotEntity.getValue(Robot, "scaleMultiplier") || 1.0);
        
        // Check for death
        if (newHealth <= 0) {
            this.onRobotDeath(robotEntity);
        } else {
            const robotType = robotEntity.getValue(Robot, "type") || "easy";
            console.log(`💥 ${robotType.toUpperCase()} hit! Health: ${newHealth.toFixed(1)} (Reduced ${(armor*100).toFixed(0)}% damage)`);
        }
    }

    private onRobotDeath(robotEntity: Entity): void {
        const robotIndex = robotEntity.index;
        robotEntity.setValue(Robot, "isDead", true);
        this.deadRobots.set(robotIndex, performance.now() / 1000 + 2.0);
        
        const robotObj = robotEntity.object3D;
        const points = robotEntity.getValue(Robot, "points") || 100;
        const robotType = robotEntity.getValue(Robot, "type") || "easy";
        
        // Play death sound
        this.playRobotSound(robotEntity, this.DEATH_SOUND, 1.0);
        
        // Play celebration sound 🎉🥳
        this.playCelebrationSound(points, robotType);
        
        // Create explosion effect
        if (robotObj) {
            const scale = robotEntity.getValue(Robot, "scaleMultiplier") || 1.0;
            this.createExplosionEffect(robotObj.position, scale);
            
            // Show celebration effect 🎉
            this.showCelebrationEffect(robotObj.position, points, robotType);
            
            // Hide robot
            robotObj.traverse((child: any) => {
                if (child.isMesh) {
                    child.visible = false;
                }
            });
        }
        
        // Update game state
        for (const stateEntity of this.queries.gameState.entities) {
            const currentScore = stateEntity.getValue(GameState, "score") || 0;
            const robotsKilled = stateEntity.getValue(GameState, "robotsKilled") || 0;
            const robotsKilledInWave = stateEntity.getValue(GameState, "robotsKilledInWave") || 0;
            
            stateEntity.setValue(GameState, "score", currentScore + points);
            stateEntity.setValue(GameState, "robotsKilled", robotsKilled + 1);
            stateEntity.setValue(GameState, "robotsKilledInWave", robotsKilledInWave + 1);
        }
        
        console.log(`💀 ${robotType.toUpperCase()} destroyed! 🎉 +${points} points 🥳`);
    }

    // ============================================
    // NEW: Celebration Effects 🎉🥳
    // ============================================
    
    private playCelebrationSound(score: number, robotType: string): void {
        try {
            // Play "waooh" celebration sound
            const audio = new Audio(this.CELEBRATION_SOUND);
            audio.volume = 0.7;
            
            // Play score sound after a short delay
            setTimeout(() => {
                const scoreAudio = new Audio(this.SCORE_SOUND);
                scoreAudio.volume = 0.6;
                scoreAudio.play().catch(e => console.warn("Score sound failed:", e));
            }, 300);
            
            audio.play().catch(e => console.warn("Celebration sound failed:", e));
        } catch (e) {
            console.warn("Celebration audio failed:", e);
        }
    }
    
    private showCelebrationEffect(position: Vector3, score: number, robotType: string): void {
        // Create celebration div
        const celebrationDiv = document.createElement('div');
        
        // Different styles based on robot type
        let emoji = "🎉";
        let bgColor = "rgba(0, 255, 0, 0.3)";
        let borderColor = "#00ff00";
        let fontSize = "48px";
        
        if (robotType === "medium") {
            emoji = "🥳";
            bgColor = "rgba(255, 165, 0, 0.3)";
            borderColor = "#ffa500";
            fontSize = "56px";
        } else if (robotType === "boss") {
            emoji = "🎊";
            bgColor = "rgba(255, 0, 0, 0.3)";
            borderColor = "#ff0000";
            fontSize = "64px";
        }
        
        celebrationDiv.style.cssText = `
            position: fixed;
            color: white;
            font-size: ${fontSize};
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            text-shadow: 0 0 10px ${borderColor},
                         0 0 20px ${borderColor},
                         0 0 30px ${borderColor};
            animation: celebrate 1.5s ease-out forwards;
            background: ${bgColor};
            border: 3px solid ${borderColor};
            border-radius: 50%;
            width: 80px;
            height: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 30px ${borderColor};
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes celebrate {
                0% {
                    transform: translate(-50%, -50%) scale(0.3) rotate(0deg);
                    opacity: 0;
                }
                20% {
                    transform: translate(-50%, -50%) scale(1.5) rotate(20deg);
                    opacity: 1;
                }
                40% {
                    transform: translate(-50%, -50%) scale(1.3) rotate(-20deg);
                }
                60% {
                    transform: translate(-50%, -50%) scale(1.4) rotate(10deg);
                }
                80% {
                    transform: translate(-50%, -50%) scale(1.2) rotate(-10deg);
                }
                100% {
                    transform: translate(-50%, -50%) scale(1) rotate(0deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        celebrationDiv.textContent = emoji;
        document.body.appendChild(celebrationDiv);
        
        // Position based on robot position (convert 3D to screen)
        const screenX = 50 + (position.x * 3);
        const screenY = 50 + (position.y * -5);
        
        celebrationDiv.style.left = `${screenX}%`;
        celebrationDiv.style.top = `${screenY}%`;
        
        // Remove after animation
        setTimeout(() => {
            celebrationDiv.remove();
            style.remove();
        }, 1500);
        
        // Also show score celebration
        this.showScoreCelebration(position, score, robotType);
    }
    
    private showScoreCelebration(position: Vector3, score: number, robotType: string): void {
        const scoreDiv = document.createElement('div');
        
        // Different styles based on robot type
        let color = "#00ff00";
        let bgColor = "rgba(0, 255, 0, 0.2)";
        let fontSize = "36px";
        
        if (robotType === "medium") {
            color = "#ffa500";
            bgColor = "rgba(255, 165, 0, 0.2)";
            fontSize = "42px";
        } else if (robotType === "boss") {
            color = "#ff0000";
            bgColor = "rgba(255, 0, 0, 0.2)";
            fontSize = "48px";
        }
        
        scoreDiv.style.cssText = `
            position: fixed;
            color: ${color};
            font-family: 'Arial Black', sans-serif;
            font-size: ${fontSize};
            font-weight: bold;
            z-index: 1001;
            pointer-events: none;
            text-shadow: 0 0 10px rgba(0,0,0,0.8),
                         0 0 20px currentColor;
            background: ${bgColor};
            padding: 10px 20px;
            border-radius: 10px;
            border: 2px solid ${color};
            animation: scoreFloat 2s ease-out forwards;
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes scoreFloat {
                0% {
                    transform: translate(-50%, -50%) translateY(0) scale(0.5);
                    opacity: 0;
                }
                20% {
                    transform: translate(-50%, -50%) translateY(0) scale(1.2);
                    opacity: 1;
                }
                100% {
                    transform: translate(-50%, -50%) translateY(-100px) scale(1);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        
        scoreDiv.textContent = `➕${score} 🎉`;
        document.body.appendChild(scoreDiv);
        
        // Position based on robot position
        const screenX = 50 + (position.x * 3);
        const screenY = 50 + (position.y * -5) - 30;
        
        scoreDiv.style.left = `${screenX}%`;
        scoreDiv.style.top = `${screenY}%`;
        
        // Remove after animation
        setTimeout(() => {
            scoreDiv.remove();
            style.remove();
        }, 2000);
        
        // Store for cleanup in update
        this.celebrationEffects.push({
            element: scoreDiv,
            life: 2.0
        });
    }
    
    private updateCelebrationEffects(dt: number): void {
        for (let i = this.celebrationEffects.length - 1; i >= 0; i--) {
            const effect = this.celebrationEffects[i];
            effect.life -= dt;
            
            if (effect.life <= 0) {
                if (effect.element.parentNode) {
                    effect.element.parentNode.removeChild(effect.element);
                }
                this.celebrationEffects.splice(i, 1);
            }
        }
    }

    // ============================================
    // PUBLIC METHODS for Targeting System
    // ============================================
    public getTargetableRobots(): Entity[] {
        const targetable: Entity[] = [];
        
        for (const robotEntity of this.queries.activeRobots.entities) {
            if (robotEntity.getValue(Robot, "isDead")) continue;
            
            const robotObj = robotEntity.object3D;
            if (!robotObj) continue;
            
            targetable.push(robotEntity);
        }
        
        return targetable;
    }
    
    public getRobotPosition(robotEntity: Entity): Vector3 | null {
        const robotObj = robotEntity.object3D;
        if (!robotObj) return null;
        
        const position = new Vector3();
        robotObj.getWorldPosition(position);
        return position;
    }
    
    public getRobotType(robotEntity: Entity): string {
        return robotEntity.getValue(Robot, "type") || "easy";
    }
    
    public getRobotTargetPriority(robotEntity: Entity): number {
        return robotEntity.getValue(Robot, "targetPriority") || 1.0;
    }
    
    public getRobotLockOnDifficulty(robotEntity: Entity): number {
        return robotEntity.getValue(Robot, "lockOnDifficulty") || 0.5;
    }

    private cleanupDeadRobots(currentTime: number): void {
        for (const [robotIndex, removalTime] of this.deadRobots.entries()) {
            if (currentTime >= removalTime) {
                // Find and remove the entity
                for (const robotEntity of this.queries.robotsToRemove.entities) {
                    if (robotEntity.index === robotIndex) {
                        try {
                            // In IWSDK, use world.removeEntity or world.destroy
                            if ((this.world as any).removeEntity) {
                                (this.world as any).removeEntity(robotEntity);
                            } else if ((this.world as any).destroy) {
                                (this.world as any).destroy(robotEntity);
                            }
                            
                            // Clean up mesh cache
                            this.robotMeshes.delete(robotIndex);
                        } catch (e) {
                            console.log("Robot already removed:", e);
                        }
                        break;
                    }
                }
                this.deadRobots.delete(robotIndex);
            }
        }
    }

    private playRobotSound(robotEntity: Entity, soundSrc: string, volume: number = 1.0): void {
        try {
            if (robotEntity.hasComponent(AudioSource)) {
                robotEntity.setValue(AudioSource, "src", soundSrc);
                robotEntity.setValue(AudioSource, "volume", volume);
                AudioUtils.play(robotEntity);
            } else {
                robotEntity.addComponent(AudioSource, {
                    src: soundSrc,
                    volume: volume,
                    maxDistance: 60.0
                });
                AudioUtils.play(robotEntity);
            }
        } catch (error) {
            this.playGlobalSound(soundSrc, volume);
        }
    }

    private playGlobalSound(src: string, volume: number): void {
        const audio = new Audio(src);
        audio.volume = volume;
        audio.play().catch(e => console.warn("Audio play failed:", e));
    }

    private flashRobot(robotEntity: Entity, colorHex: number, duration: number): void {
        const robotObj = robotEntity.object3D;
        if (!robotObj) return;
        
        const originalColors = new Map<any, number>();
        
        robotObj.traverse((child: any) => {
            if (child.isMesh && child.material && child.material.emissive) {
                originalColors.set(child, child.material.emissive.getHex());
                child.material.emissive.setHex(colorHex);
                child.material.emissiveIntensity = 2.5;
            }
        });
        
        setTimeout(() => {
            if (!robotObj) return;
            
            robotObj.traverse((child: any) => {
                if (child.isMesh && child.material && child.material.emissive && originalColors.has(child)) {
                    child.material.emissive.setHex(originalColors.get(child)!);
                    child.material.emissiveIntensity = 0.8;
                }
            });
        }, duration * 1000);
    }

    private createHitEffect(position: Vector3, scaleMultiplier: number = 1.0): void {
        const geometry = new SphereGeometry(0.2 * scaleMultiplier, 12, 12);
        const material = new MeshStandardMaterial({ 
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.9
        });
        
        const hitEffect = new Mesh(geometry, material);
        hitEffect.position.copy(position);
        
        if (this.world.scene) {
            this.world.scene.add(hitEffect);
        }
        
        let scale = 1.0;
        const animate = () => {
            if (!hitEffect) return;
            
            scale += 0.2;
            hitEffect.scale.setScalar(scale);
            hitEffect.material.opacity -= 0.08;
            
            if (hitEffect.material.opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                if (hitEffect.parent) {
                    hitEffect.parent.remove(hitEffect);
                }
            }
        };
        
        animate();
    }

    private createExplosionEffect(position: Vector3, scaleMultiplier: number = 1.0): void {
        const geometry = new SphereGeometry(0.4 * scaleMultiplier, 20, 20);
        const material = new MeshStandardMaterial({ 
            color: 0xff5500,
            emissive: 0xff0000,
            emissiveIntensity: 3.0,
            transparent: true,
            opacity: 0.95
        });
        
        const explosion = new Mesh(geometry, material);
        explosion.position.copy(position);
        
        if (this.world.scene) {
            this.world.scene.add(explosion);
        }
        
        let scale = 1.0;
        const animate = () => {
            if (!explosion) return;
            
            scale += 0.5;
            explosion.scale.setScalar(scale);
            explosion.material.opacity -= 0.12;
            
            if (explosion.material.opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                if (explosion.parent) {
                    explosion.parent.remove(explosion);
                }
            }
        };
        
        animate();
    }

    private createLaserBeam(start: Vector3, end: Vector3, color: number): void {
        const direction = new Vector3().subVectors(end, start);
        const length = direction.length();
        
        // Create cylinder geometry for laser beam
        const geometry = new CylinderGeometry(0.05, 0.05, length, 8);
        const material = new MeshStandardMaterial({ 
            color: color,
            emissive: color,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.8
        });
        
        const laser = new Mesh(geometry, material);
        
        // Position laser
        laser.position.copy(start);
        laser.position.add(direction.clone().multiplyScalar(0.5));
        
        // Rotate laser to point at end
        laser.lookAt(end);
        laser.rotateX(Math.PI / 2);
        
        if (this.world.scene) {
            this.world.scene.add(laser);
        }
        
        let opacity = 0.8;
        const animate = () => {
            if (!laser) return;
            
            opacity -= 0.1;
            laser.material.opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                if (laser.parent) {
                    laser.parent.remove(laser);
                }
            }
        };
        
        animate();
    }
}