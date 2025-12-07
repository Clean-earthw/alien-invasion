import { createSystem, Vector3, Mesh, SphereGeometry, MeshStandardMaterial, Entity } from "@iwsdk/core";
import { Projectile, Robot, DamageEffect, GameState, ToRemove } from "../components.js";
import * as THREE from 'three';

export class ProjectileSystem extends createSystem({
    activeProjectiles: {
        required: [Projectile],
    },
    activeRobots: {
        required: [Robot],
    },
    gameState: {
        required: [GameState]
    },
    entitiesToRemove: {
        required: [ToRemove],
    }
}) {
    private tempVec3 = new Vector3();
    private robotPos = new Vector3();
    private robotSystem: any = null;
    private trailEffects: Array<{mesh: Mesh, life: number}> = [];
    private hitEffects: Array<{mesh: Mesh, life: number}> = [];

    init(): void {
        console.log("✨ ProjectileSystem initialized with guided missiles");
    }

    update(dt: number, time: number): void {
        if (!this.robotSystem) {
            this.findRobotSystem();
        }
        
        this.updateProjectiles(dt, time);
        this.updateTrailEffects(dt);
        this.updateHitEffects(dt);
        this.cleanupEntities();
    }

    private findRobotSystem(): void {
        const systems = (this.world as any).systems;
        if (systems) {
            for (const system of systems) {
                if (system.constructor.name === "RobotSystem") {
                    this.robotSystem = system;
                    break;
                }
            }
        }
    }

    private updateProjectiles(dt: number, time: number): void {
        for (const projectile of this.queries.activeProjectiles.entities) {
            const projectileObj = projectile.object3D;
            if (!projectileObj) continue;

            const age = projectile.getValue(Projectile, "age") || 0.0;
            const lifetime = projectile.getValue(Projectile, "lifetime") || 4.0;
            const newAge = age + dt;
            
            projectile.setValue(Projectile, "age", newAge);

            if (newAge >= lifetime) {
                projectile.addComponent(ToRemove, { time: time });
                continue;
            }

            const speed = projectile.getValue(Projectile, "speed") || 40.0;
            const dir = projectile.getVectorView(Projectile, "direction");
            const isGuided = projectile.getValue(Projectile, "isGuided") || false;
            const targetId = projectile.getValue(Projectile, "targetId") || -1;
            
            let finalDir = new Vector3(dir[0], dir[1], dir[2]);
            
            // Guided projectile logic
            if (isGuided && targetId !== -1 && this.robotSystem) {
                // Find target robot
                let targetRobot: Entity | null = null;
                for (const robot of this.queries.activeRobots.entities) {
                    if (robot.index === targetId && !robot.getValue(Robot, "isDead")) {
                        targetRobot = robot;
                        break;
                    }
                }
                
                if (targetRobot) {
                    const targetPos = this.robotSystem.getRobotPosition(targetRobot);
                    if (targetPos) {
                        const projPos = new Vector3();
                        projectileObj.getWorldPosition(projPos);
                        
                        // Calculate direction to target
                        const toTarget = new Vector3().subVectors(targetPos, projPos).normalize();
                        
                        // Smoothly adjust direction (homing effect)
                        const homingStrength = 0.1; // How strong the homing is
                        finalDir.lerp(toTarget, homingStrength * dt * 10);
                        finalDir.normalize();
                        
                        // Update direction in component
                        projectile.setValue(Projectile, "direction", [finalDir.x, finalDir.y, finalDir.z]);
                    }
                }
            }
            
            // Update position
            projectileObj.position.x += finalDir.x * speed * dt;
            projectileObj.position.y += finalDir.y * speed * dt;
            projectileObj.position.z += finalDir.z * speed * dt;

            // Create trail effect
            if (time % 0.05 < dt) { // Every 50ms
                this.createTrailEffect(projectileObj.position, isGuided);
            }

            // Check collisions
            this.checkCollisions(projectile, projectileObj, time);
        }
    }

    private checkCollisions(projectile: Entity, projectileObj: THREE.Object3D, time: number): void {
        projectileObj.getWorldPosition(this.tempVec3);
        const isGuided = projectile.getValue(Projectile, "isGuided") || false;
        
        for (const robot of this.queries.activeRobots.entities) {
            const isDead = robot.getValue(Robot, "isDead");
            if (isDead) continue;
            
            const robotObj = robot.object3D;
            if (!robotObj) continue;

            robotObj.getWorldPosition(this.robotPos);
            
            // Different hit detection for guided vs regular projectiles
            const hitRadius = isGuided ? 0.8 : 0.5; // Guided missiles have larger hit radius
            const distance = this.tempVec3.distanceTo(this.robotPos);

            if (distance < hitRadius) {
                const damage = projectile.getValue(Projectile, "damage") || 40.0;
                
                // Apply damage via robot system
                if (this.robotSystem) {
                    this.robotSystem.onRobotHit(robot, damage, this.tempVec3);
                }
                
                // Create hit effect
                this.createHitEffect(this.tempVec3, isGuided);
                
                // Mark projectile for removal
                projectile.addComponent(ToRemove, { time: time });
                break;
            }
        }
    }

    private createTrailEffect(position: Vector3, isGuided: boolean): void {
        const trailGeometry = new SphereGeometry(isGuided ? 0.03 : 0.02, 4, 4);
        const trailMaterial = new MeshStandardMaterial({ 
            color: isGuided ? 0xffff00 : 0x00ffff, // Yellow for guided, cyan for regular
            emissive: isGuided ? 0xffff00 : 0x00ffff,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.7
        });
        
        const trailMesh = new Mesh(trailGeometry, trailMaterial);
        trailMesh.position.copy(position);
        
        if (this.world.scene) {
            this.world.scene.add(trailMesh);
        }
        
        this.trailEffects.push({
            mesh: trailMesh,
            life: isGuided ? 0.3 : 0.2 // Guided trails last longer
        });
    }

    private createHitEffect(position: Vector3, isGuided: boolean): void {
        const hitGeometry = new SphereGeometry(isGuided ? 0.4 : 0.3, 8, 8);
        const hitMaterial = new MeshStandardMaterial({ 
            color: isGuided ? 0xffff00 : 0xff5500,
            emissive: isGuided ? 0xffff00 : 0xff5500,
            emissiveIntensity: 1.0,
            transparent: true,
            opacity: 0.9
        });
        
        const hitMesh = new Mesh(hitGeometry, hitMaterial);
        hitMesh.position.copy(position);
        
        if (this.world.scene) {
            this.world.scene.add(hitMesh);
        }
        
        this.hitEffects.push({
            mesh: hitMesh,
            life: isGuided ? 0.4 : 0.3
        });
    }

    private updateTrailEffects(dt: number): void {
        for (let i = this.trailEffects.length - 1; i >= 0; i--) {
            const effect = this.trailEffects[i];
            effect.life -= dt;
            
            if (effect.life <= 0) {
                if (effect.mesh.parent) {
                    effect.mesh.parent.remove(effect.mesh);
                }
                this.trailEffects.splice(i, 1);
                continue;
            }
            
            if (effect.mesh.material) {
                (effect.mesh.material as MeshStandardMaterial).opacity = effect.life * 3.5;
            }
        }
    }

    private updateHitEffects(dt: number): void {
        for (let i = this.hitEffects.length - 1; i >= 0; i--) {
            const effect = this.hitEffects[i];
            effect.life -= dt;
            
            if (effect.life <= 0) {
                if (effect.mesh.parent) {
                    effect.mesh.parent.remove(effect.mesh);
                }
                this.hitEffects.splice(i, 1);
                continue;
            }
            
            const progress = 1 - (effect.life / 0.3);
            effect.mesh.scale.setScalar(1 + progress * 0.5);
            
            if (effect.mesh.material) {
                (effect.mesh.material as MeshStandardMaterial).opacity = effect.life * 3.33;
            }
        }
    }

    private cleanupEntities(): void {
        for (const entity of this.queries.entitiesToRemove.entities) {
            if (entity.object3D && entity.object3D.parent) {
                entity.object3D.parent.remove(entity.object3D);
            }
        }
    }
    
    // ============================================
    // PUBLIC METHODS
    // ============================================
    
    public createGuidedProjectile(startPos: Vector3, targetEntity: Entity, damage: number = 60.0): void {
        const geometry = new SphereGeometry(0.1, 16, 16);
        const material = new MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 2.5,
        });
        
        const projectileMesh = new Mesh(geometry, material);
        projectileMesh.position.copy(startPos);
        
        // Calculate initial direction to target
        let direction: Vector3;
        if (this.robotSystem) {
            const targetPos = this.robotSystem.getRobotPosition(targetEntity);
            if (targetPos) {
                direction = new Vector3().subVectors(targetPos, startPos).normalize();
            } else {
                direction = new Vector3(0, 0, -1);
            }
        } else {
            direction = new Vector3(0, 0, -1);
        }
        
        const projectileEntity = this.world
            .createTransformEntity(projectileMesh)
            .addComponent(Projectile, {
                damage: damage,
                speed: 25.0, // Slower but guided
                direction: [direction.x, direction.y, direction.z],
                lifetime: 6.0,
                age: 0.0,
                owner: 0,
                type: "guided_missile",
                isGuided: true,
                targetId: targetEntity.index
            });
        
        console.log(`🚀 Created guided missile targeting robot ${targetEntity.index}`);
    }
}