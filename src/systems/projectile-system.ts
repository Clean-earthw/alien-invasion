import { createSystem, Vector3, Mesh, SphereGeometry, MeshStandardMaterial } from "@iwsdk/core";
import { Projectile, Robot, Bomb, DamageEffect, ToRemove, GameState } from "../components.js";

export class ProjectileSystem extends createSystem({
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
}) {
  private tempVec3 = new Vector3();
  private robotPos = new Vector3();
  private explosionEffects: any[] = [];

  update(dt: number, time: number) {
    this.updateProjectiles(dt, time);
    this.updateBombs(dt, time);
    this.updateExplosionEffects(dt);
    this.cleanupEntities();
  }

  private updateProjectiles(dt: number, time: number) {
    for (const projectile of this.queries.activeProjectiles.entities) {
      const projectileObj = projectile.object3D;
      if (!projectileObj) continue;

      const age = projectile.getValue(Projectile, "age") || 0.0;
      const lifetime = projectile.getValue(Projectile, "lifetime") || 5.0;
      const newAge = age + dt;
      
      projectile.setValue(Projectile, "age", newAge);

      if (newAge >= lifetime) {
        // FIXED: Pass the current time parameter correctly
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
              robotObj.visible = false;
            }
            
            // Create death explosion
            this.createDeathExplosion(this.robotPos);
            
            // Update game state (score) - FIXED: Use query instead of world.entities
            const gameStateEntities = this.queries.gameState.entities;
            if (gameStateEntities.size > 0) {
              const gameState = Array.from(gameStateEntities)[0];
              const currentScore = gameState.getValue(GameState, "score") || 0;
              const killed = gameState.getValue(GameState, "robotsKilled") || 0;
              
              gameState.setValue(GameState, "score", currentScore + 100);
              gameState.setValue(GameState, "robotsKilled", killed + 1);
            }
          }
          
          console.log(`Robot hit! Health: ${newHealth}`);
          
          projectile.addComponent(ToRemove, { time: time });
          break;
        }
      }
    }
  }

  private createTrailEffect(position: Vector3) {
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

  private createHitEffect(position: Vector3) {
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

  private createDeathExplosion(position: Vector3) {
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

  private updateExplosionEffects(dt: number) {
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
        effect.mesh.material.opacity = effect.life * 0.8;
        effect.mesh.scale.setScalar(0.8 + effect.life * 0.5);
      }
    }
  }

  private updateBombs(dt: number, time: number) {
    for (const bomb of this.queries.activeBombs.entities) {
      const bombObj = bomb.object3D;
      if (!bombObj) continue;

      const age = bomb.getValue(Bomb, "age") || 0.0;
      const fuseTime = bomb.getValue(Bomb, "fuseTime") || 2.5;
      const newAge = age + dt;
      
      bomb.setValue(Bomb, "age", newAge);

      if (bombObj.userData?.velocity) {
        bombObj.position.add(bombObj.userData.velocity.clone().multiplyScalar(dt));
        bombObj.userData.velocity.y -= 9.8 * dt;
      }

      const pulseScale = 1.0 + Math.sin(newAge * 12) * 0.15;
      bombObj.scale.setScalar(pulseScale);
      
      const hue = (time * 2) % 1;
      bombObj.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.color.setHSL(hue, 1, 0.5);
          child.material.emissive.setHSL(hue, 1, 0.3);
        }
      });

      if (newAge >= fuseTime) {
        this.explodeBomb(bomb, time);
      }
    }
  }

  private explodeBomb(bomb: any, time: number) {
    const bombObj = bomb.object3D;
    if (!bombObj) return;

    bomb.setValue(Bomb, "hasExploded", true);

    bombObj.getWorldPosition(this.tempVec3);
    
    const damage = bomb.getValue(Bomb, "damage") || 100.0;
    const radius = bomb.getValue(Bomb, "radius") || 8.0;

    const explosionGeometry = new SphereGeometry(radius * 0.3, 32, 32);
    const explosionMaterial = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.8
    });
    const explosionMesh = new Mesh(explosionGeometry, explosionMaterial);
    explosionMesh.position.copy(this.tempVec3);
    
    explosionMesh.userData = {
      time: 0,
      colors: [0xff0000, 0x00ff00, 0x0000ff]
    };
    
    const explosionEntity = this.world.createTransformEntity(explosionMesh);

    let robotsHit = 0;
    for (const robot of this.queries.activeRobots.entities) {
      const isDead = robot.getValue(Robot, "isDead");
      if (isDead) continue;
      
      const robotObj = robot.object3D;
      if (!robotObj) continue;

      robotObj.getWorldPosition(this.robotPos);
      const distance = this.tempVec3.distanceTo(this.robotPos);

      if (distance <= radius) {
        const falloff = 1.0 - (distance / radius);
        const actualDamage = damage * falloff;
        
        const currentHealth = robot.getValue(Robot, "health") || 50.0;
        const newHealth = Math.max(0, currentHealth - actualDamage);
        
        robot.setValue(Robot, "health", newHealth);
        
        if (!robot.hasComponent(DamageEffect)) {
          robot.addComponent(DamageEffect, {
            time: 0.0,
            duration: 0.5,
          });
        }
        
        if (newHealth <= 0) {
          robot.setValue(Robot, "isDead", true);
          if (robotObj) {
            robotObj.visible = false;
          }
          this.createDeathExplosion(this.robotPos);
          
          // Update score
          const gameStateEntities = this.queries.gameState.entities;
          if (gameStateEntities.size > 0) {
            const gameState = Array.from(gameStateEntities)[0];
            const currentScore = gameState.getValue(GameState, "score") || 0;
            const killed = gameState.getValue(GameState, "robotsKilled") || 0;
            
            gameState.setValue(GameState, "score", currentScore + 100);
            gameState.setValue(GameState, "robotsKilled", killed + 1);
          }
        }
        
        robotsHit++;
      }
    }

    console.log(`Bomb exploded! Hit ${robotsHit} robots`);
    
    let scale = 0.1;
    const animateExplosion = () => {
      scale += 0.3;
      explosionMesh.scale.setScalar(scale);
      
      const colorIndex = Math.floor((Date.now() / 100) % 3);
      explosionMesh.material.color.setHex(explosionMesh.userData.colors[colorIndex]);
      explosionMesh.material.emissive.setHex(explosionMesh.userData.colors[colorIndex]);
      explosionMesh.material.opacity = 0.8 - (scale / 10);
      
      if (scale < 3) {
        requestAnimationFrame(animateExplosion);
      } else {
        if (explosionMesh.parent) {
          explosionMesh.parent.remove(explosionMesh);
        }
      }
    };
    animateExplosion();
    
    bomb.addComponent(ToRemove, { time: time });
  }

  private cleanupEntities() {
    for (const entity of this.queries.entitiesToRemove.entities) {
      if (entity.object3D && entity.object3D.parent) {
        entity.object3D.parent.remove(entity.object3D);
      }
    }
  }
}