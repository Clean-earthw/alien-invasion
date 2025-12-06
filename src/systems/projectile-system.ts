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