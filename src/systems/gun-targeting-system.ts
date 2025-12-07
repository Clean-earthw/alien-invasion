import { 
    createSystem, 
    Vector3,
    Entity,
    Quaternion,
    Mesh,
    CylinderGeometry,
    MeshStandardMaterial,
    SphereGeometry
} from "@iwsdk/core";
import * as THREE from 'three';
import { 
    Gun, 
    Targeting,
    Robot
} from "../components.js";

export class GunTargetingSystem extends createSystem(
    {
        guns: {
            required: [Gun]
        },
        gunsWithTargeting: {
            required: [Gun, Targeting]
        },
        activeRobots: {
            required: [Robot]
        }
    },
    {}
) {
    private tempVec3 = new Vector3();
    private tempVec3_2 = new Vector3();
    private robotSystem: any = null;
    private laserSight: Mesh | null = null;
    private targetLockIndicator: Mesh | null = null;
    private currentTargets = new Map<number, Entity>();
    private lastTargetUpdate = 0;
    private targetUpdateInterval = 0.1;
    private lockOnSounds = new Map<number, number>();

    init(): void {
        console.log("🎯 Enhanced GunTargetingSystem initialized with robot classification");
        this.createLaserSight();
        this.createTargetLockIndicator();
    }

    private createLaserSight(): void {
        const laserGeometry = new CylinderGeometry(0.003, 0.003, 100, 8);
        const laserMaterial = new MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.6
        });
        
        this.laserSight = new Mesh(laserGeometry, laserMaterial);
        this.laserSight.visible = false;
        
        if (this.world.scene) {
            this.world.scene.add(this.laserSight);
        }
    }

    private createTargetLockIndicator(): void {
        const geometry = new (THREE as any).RingGeometry(0.3, 0.4, 16);
        const material = new MeshStandardMaterial({ 
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 2.0,
            transparent: true,
            opacity: 0.8,
            side: (THREE as any).DoubleSide
        });
        
        this.targetLockIndicator = new Mesh(geometry, material);
        this.targetLockIndicator.visible = false;
        
        if (this.world.scene) {
            this.world.scene.add(this.targetLockIndicator);
        }
    }

    update(dt: number, time: number): void {
        if (!this.robotSystem) {
            this.findRobotSystem();
            return;
        }
        
        // Update each gun's targeting
        for (const gunEntity of this.queries.gunsWithTargeting.entities) {
            const gunObj = gunEntity.object3D;
            if (!gunObj) continue;
            
            // Get gun position and direction
            const gunPos = new Vector3();
            const gunQuat = new Quaternion();
            gunObj.getWorldPosition(gunPos);
            gunObj.getWorldQuaternion(gunQuat);
            
            const gunForward = new Vector3(0, 0, -1);
            gunForward.applyQuaternion(gunQuat).normalize();
            
            // Update target selection
            if (time - this.lastTargetUpdate > this.targetUpdateInterval) {
                this.updateCurrentTarget(gunEntity, gunPos, gunForward, time);
                this.lastTargetUpdate = time;
            }
            
            // Apply targeting and visuals
            const currentTarget = this.currentTargets.get(gunEntity.index);
            if (currentTarget && this.robotSystem) {
                this.aimAtTarget(gunEntity, currentTarget, dt, time);
                this.updateTargetingVisuals(gunEntity, gunPos, gunForward, currentTarget);
            } else {
                this.hideTargetingVisuals();
            }
        }
    }

    private findRobotSystem(): void {
        const systems = (this.world as any).systems;
        if (systems) {
            for (const system of systems) {
                if (system.constructor.name === "RobotSystem") {
                    this.robotSystem = system;
                    console.log("✅ Found RobotSystem for targeting");
                    break;
                }
            }
        }
    }

    private updateCurrentTarget(gunEntity: Entity, gunPos: Vector3, gunForward: Vector3, time: number): void {
        // const lastUpdateTime = gunEntity.getValue(Targeting, "lastUpdateTime") || time;
        // const dt = time - lastUpdateTime;
        // gunEntity.setValue(Targeting, "lastUpdateTime", time);
        const targetableRobots = this.robotSystem.getTargetableRobots();
        let bestTarget: Entity | null = null;
        let bestScore = -Infinity;
        
        const preferredTargetType = gunEntity.getValue(Targeting, "preferredTargetType") || "any";
        const lockDistance = gunEntity.getValue(Targeting, "lockDistance") || 40.0;
        const currentTarget = this.currentTargets.get(gunEntity.index);
        
        // If we have a current target, check if it's still valid
        if (currentTarget) {
            const robotPos = this.robotSystem.getRobotPosition(currentTarget);
            if (robotPos) {
                const distance = gunPos.distanceTo(robotPos);
                const isDead = currentTarget.getValue(Robot, "isDead");
                
                if (distance <= lockDistance * 1.2 && !isDead) {
                    // Keep current target for a while
                    bestTarget = currentTarget;
                    bestScore = 1000;
                }
            }
        }
        
        // If no valid current target, find the best new target
        if (!bestTarget) {
            for (const robot of targetableRobots) {
                const robotPos = this.robotSystem.getRobotPosition(robot);
                if (!robotPos) continue;
                
                // Calculate direction to robot
                const toRobot = new Vector3().subVectors(robotPos, gunPos).normalize();
                const dot = gunForward.dot(toRobot);
                
                // Calculate distance
                const distance = gunPos.distanceTo(robotPos);
                if (distance > lockDistance) continue;
                
                // Get robot stats
                const robotType = this.robotSystem.getRobotType(robot);
                const targetPriority = this.robotSystem.getRobotTargetPriority(robot);
                const lockOnDifficulty = this.robotSystem.getRobotLockOnDifficulty(robot);
                
                // Check if this robot type matches preference
                let typeMatchBonus = 1.0;
                if (preferredTargetType !== "any") {
                    typeMatchBonus = robotType === preferredTargetType ? 1.5 : 0.5;
                }
                
                // Calculate target score
                const score = this.calculateTargetScore(robot, dot, distance, lockDistance, 
                                                       targetPriority, lockOnDifficulty, typeMatchBonus);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = robot;
                }
            }
        }
        
        // Update targeting state
        if (bestTarget) {
            const previousTarget = this.currentTargets.get(gunEntity.index);
            if (previousTarget !== bestTarget) {
                // Target changed - reset lock
                this.currentTargets.set(gunEntity.index, bestTarget);
                gunEntity.setValue(Targeting, "lockOnProgress", 0.0);
                gunEntity.setValue(Targeting, "isLockedOn", false);
                console.log(`🎯 New target acquired: ${this.robotSystem.getRobotType(bestTarget)}`);
            }
            
            // Update lock progress
            const robotPos = this.robotSystem.getRobotPosition(bestTarget);
            if (robotPos) {
                gunEntity.setValue(Targeting, "targetEntityId", bestTarget.index);
                gunEntity.setValue(Targeting, "targetPosition", [robotPos.x, robotPos.y, robotPos.z]);
                
                // Update lock-on progress
                const lockOnSpeed = gunEntity.getValue(Gun, "lockOnSpeed") || 1.0;
                const robotDifficulty = this.robotSystem.getRobotLockOnDifficulty(bestTarget);
                const lockRate = lockOnSpeed * (1.0 - robotDifficulty * 0.7);
                const dt = time;
                let lockProgress = gunEntity.getValue(Targeting, "lockOnProgress") || 0.0;
                lockProgress = Math.min(1.0, lockProgress + dt * lockRate * 2.0);
                gunEntity.setValue(Targeting, "lockOnProgress", lockProgress);
                
                // Check if locked on
                if (lockProgress >= 1.0 && !gunEntity.getValue(Targeting, "isLockedOn")) {
                    gunEntity.setValue(Targeting, "isLockedOn", true);
                    gunEntity.setValue(Targeting, "lockOnTime", time);
                    this.playLockOnSound(bestTarget, time);
                }
            }
        } else {
            // No target
            this.currentTargets.delete(gunEntity.index);
            gunEntity.setValue(Targeting, "targetEntityId", -1);
            gunEntity.setValue(Targeting, "isLockedOn", false);
            gunEntity.setValue(Targeting, "lockOnProgress", 0.0);
        }
    }

    private calculateTargetScore(
        robot: Entity, 
        dot: number, 
        distance: number, 
        maxDistance: number,
        targetPriority: number,
        lockOnDifficulty: number,
        typeMatchBonus: number
    ): number {
        const directionScore = (dot + 1) * 15;
        const distanceScore = (1 - distance / maxDistance) * 20;
        const priorityScore = targetPriority * 10;
        const difficultyPenalty = lockOnDifficulty * 5;
        
        const health = robot.getValue(Robot, "health") || 0;
        const maxHealth = robot.getValue(Robot, "maxHealth") || 1;
        const healthRatio = health / maxHealth;
        const healthScore = (1 - healthRatio) * 8;
        
        return (directionScore + distanceScore + priorityScore - difficultyPenalty + healthScore) * typeMatchBonus;
    }

    private aimAtTarget(gunEntity: Entity, target: Entity, dt: number, time: number): void {
        const gunObj = gunEntity.object3D;
        if (!gunObj || !this.robotSystem) return;
        
        const targetPos = this.robotSystem.getRobotPosition(target);
        if (!targetPos) return;
        
        const gunPos = new Vector3();
        gunObj.getWorldPosition(gunPos);
        
        // Calculate direction to target
        const directionToTarget = new Vector3().subVectors(targetPos, gunPos).normalize();
        
        // Get current gun forward direction
        const gunQuat = new Quaternion();
        gunObj.getWorldQuaternion(gunQuat);
        const currentForward = new Vector3(0, 0, -1);
        currentForward.applyQuaternion(gunQuat).normalize();
        
        // Calculate rotation needed
        const targetQuat = new Quaternion();
        targetQuat.setFromUnitVectors(currentForward, directionToTarget);
        
        // Apply aim assist based on lock progress
        const aimAssist = gunEntity.getValue(Targeting, "aimAssist") || true;
        const aimAssistStrength = gunEntity.getValue(Targeting, "aimAssistStrength") || 0.8;
        const lockProgress = gunEntity.getValue(Targeting, "lockOnProgress") || 0.0;
        const isLockedOn = gunEntity.getValue(Targeting, "isLockedOn") || false;
        
        if (aimAssist) {
            // Enhanced aim assist when locked on
            const assistMultiplier = isLockedOn ? 1.5 : lockProgress;
            const slerpAmount = Math.min(1, dt * 5 * aimAssistStrength * assistMultiplier);
            
            // Smoothly interpolate towards target
            const slerpedQuat = new Quaternion();
            slerpedQuat.slerpQuaternions(gunQuat, targetQuat.multiply(gunQuat), slerpAmount);
            
            // Apply rotation to gun
            gunObj.quaternion.copy(slerpedQuat);
            
            // Update targeting precision based on lock
            const precision = gunEntity.getValue(Gun, "precision") || 0.95;
            const enhancedPrecision = precision * (0.8 + lockProgress * 0.2);
            gunEntity.setValue(Gun, "precision", enhancedPrecision);
        }
        
        // Update targeting component
        gunEntity.setValue(Targeting, "targetPosition", [targetPos.x, targetPos.y, targetPos.z]);
    }

    private updateTargetingVisuals(gunEntity: Entity, gunPos: Vector3, gunForward: Vector3, target: Entity): void {
        if (!this.laserSight || !this.targetLockIndicator) return;
        
        const targetPos = this.robotSystem.getRobotPosition(target);
        if (!targetPos) return;
        
        const lockProgress = gunEntity.getValue(Targeting, "lockOnProgress") || 0.0;
        const isLockedOn = gunEntity.getValue(Targeting, "isLockedOn") || false;
        
        // Update laser sight with lock progress
        this.updateLaserSight(gunPos, gunForward, targetPos, lockProgress, isLockedOn);
        
        // Update target lock indicator
        this.updateTargetLockIndicator(targetPos, lockProgress, isLockedOn, target);
    }

    private updateLaserSight(gunPos: Vector3, gunForward: Vector3, targetPos: Vector3, 
                           lockProgress: number, isLockedOn: boolean): void {
        if (!this.laserSight) return;
        
        // Calculate laser end point
        const laserLength = gunPos.distanceTo(targetPos);
        const laserEnd = gunPos.clone().add(gunForward.clone().multiplyScalar(laserLength));
        
        // Position laser
        this.laserSight.scale.y = laserLength / 100;
        this.laserSight.position.copy(gunPos);
        this.laserSight.position.add(gunForward.clone().multiplyScalar(laserLength / 2));
        
        // Rotate laser to point at target
        this.laserSight.lookAt(laserEnd);
        this.laserSight.rotateX(Math.PI / 2);
        
        // Visual feedback based on lock progress
        const material = this.laserSight.material as MeshStandardMaterial;
        
        if (isLockedOn) {
            // Solid green when locked
            material.color.setHex(0x00ff00);
            material.emissive.setHex(0x00ff00);
            material.opacity = 0.8;
        } else {
            // Red to yellow gradient based on lock progress
            const red = 1.0;
            const green = lockProgress;
            material.color.setRGB(red, green, 0);
            material.emissive.setRGB(red, green, 0);
            material.opacity = 0.5 + lockProgress * 0.3;
        }
        
        // Pulse effect when locked
        const pulse = isLockedOn ? (Math.sin(performance.now() * 0.01) * 0.2 + 0.8) : 1.0;
        material.opacity *= pulse;
        
        this.laserSight.visible = true;
    }

    private updateTargetLockIndicator(targetPos: Vector3, lockProgress: number, 
                                    isLockedOn: boolean, target: Entity): void {
        if (!this.targetLockIndicator) return;
        
        // Position indicator around target
        this.targetLockIndicator.position.copy(targetPos);
        this.targetLockIndicator.position.y += 1.5;
        
        // Make it face the camera
        if (this.world.camera) {
            this.targetLockIndicator.lookAt(this.world.camera.position);
        }
        
        // Visual feedback based on lock state
        const material = this.targetLockIndicator.material as MeshStandardMaterial;
        
        if (isLockedOn) {
            // Solid green and pulsing when locked
            material.color.setHex(0x00ff00);
            material.emissive.setHex(0x00ff00);
            
            const pulse = Math.sin(performance.now() * 0.01) * 0.3 + 0.7;
            material.opacity = 0.9 * pulse;
            material.emissiveIntensity = 2.5 * pulse;
        } else {
            // Orange gradient based on lock progress
            const orange = 0xff8800;
            material.color.setHex(orange);
            material.emissive.setHex(orange);
            material.opacity = 0.5 + lockProgress * 0.4;
            material.emissiveIntensity = 1.5 + lockProgress * 1.0;
        }
        
        // Scale based on robot type
        const robotType = this.robotSystem.getRobotType(target);
        const scale = robotType === "boss" ? 2.0 : robotType === "medium" ? 1.5 : 1.0;
        this.targetLockIndicator.scale.setScalar(scale);
        
        this.targetLockIndicator.visible = lockProgress > 0.1;
    }

    private hideTargetingVisuals(): void {
        if (this.laserSight) {
            this.laserSight.visible = false;
        }
        if (this.targetLockIndicator) {
            this.targetLockIndicator.visible = false;
        }
    }

    private playLockOnSound(target: Entity, time: number): void {
        const lastSoundTime = this.lockOnSounds.get(target.index) || 0;
        
        // Only play lock sound every 2 seconds per target
        if (time - lastSoundTime > 2.0) {
            // Create audio element
            const audio = new Audio("./audio/lock_on.mp3");
            audio.volume = 0.6;
            audio.play().catch(e => console.warn("Lock-on sound failed:", e));
            
            this.lockOnSounds.set(target.index, time);
        }
    }

    // ============================================
    // PUBLIC METHODS
    // ============================================
    
    public getCurrentTarget(gunEntity: Entity): Entity | null {
        return this.currentTargets.get(gunEntity.index) || null;
    }
    
    public isTargetLocked(gunEntity: Entity): boolean {
        return gunEntity.getValue(Targeting, "isLockedOn") || false;
    }
    
    public getTargetPosition(gunEntity: Entity): Vector3 | null {
        const posArray = gunEntity.getValue(Targeting, "targetPosition") || [0, 0, 0];
        return new Vector3(posArray[0], posArray[1], posArray[2]);
    }
    
    public getLockProgress(gunEntity: Entity): number {
        return gunEntity.getValue(Targeting, "lockOnProgress") || 0.0;
    }
    
    public setPreferredTargetType(gunEntity: Entity, targetType: string): void {
        gunEntity.setValue(Targeting, "preferredTargetType", targetType);
    }
    
    public getTargetType(gunEntity: Entity): string {
        const target = this.getCurrentTarget(gunEntity);
        if (!target || !this.robotSystem) return "none";
        
        return this.robotSystem.getRobotType(target);
    }
}