import { createSystem, Vector3 } from "@iwsdk/core";
import { Robot, Player, DamageEffect, GameState } from "../components.js";

export class RobotSystem extends createSystem({
  activeRobots: {
    required: [Robot],
  },
  player: {
    required: [Player]
  },
  gameState: {
    required: [GameState]
  }
}) {
  private tempVec3 = new Vector3();
  private playerPos = new Vector3();
  private initialized = false;

  init() {
    console.log("🤖 RobotSystem initialized - Floating space drones");
    this.initialized = true;
  }

  update(dt: number, time: number) {
    if (!this.initialized) return;
    
    // Get player position
    if (this.world.camera) {
      this.world.camera.getWorldPosition(this.playerPos);
    }

    // Update all robots
    for (const robotEntity of this.queries.activeRobots.entities) {
      const isDead = robotEntity.getValue(Robot, "isDead");
      const robotObj = robotEntity.object3D;
      
      if (isDead || !robotObj) continue;

      const speed = robotEntity.getValue(Robot, "speed") || 0.0; // Static floating
      const attackRange = robotEntity.getValue(Robot, "attackRange") || 15.0;
      const attackDamage = robotEntity.getValue(Robot, "attackDamage") || 18.0;
      const attackCooldown = robotEntity.getValue(Robot, "attackCooldown") || 3.5;
      const lastAttackTime = robotEntity.getValue(Robot, "lastAttackTime") || 0.0;

      // FLOATING ANIMATION for space drones
      if (robotObj.userData) {
        const { floatHeight, floatSpeed, rotationSpeed, timeOffset } = robotObj.userData;
        
        // Gentle floating up/down
        robotObj.position.y = floatHeight + Math.sin((time + timeOffset) * floatSpeed) * 0.2;
        
        // Slow rotation (like floating in space)
        robotObj.rotation.y += rotationSpeed;
        robotObj.rotation.x = Math.sin(time * 0.3) * 0.05;
      }
      
      // Get robot position
      robotObj.getWorldPosition(this.tempVec3);
      
      // Calculate distance to player
      const distanceToPlayer = this.tempVec3.distanceTo(this.playerPos);

      // Make drone face player (but keep floating animation)
      if (distanceToPlayer <= 20.0) {
        const lookAtPos = new Vector3(this.playerPos.x, robotObj.position.y, this.playerPos.z);
        const currentRotation = robotObj.rotation.y;
        robotObj.lookAt(lookAtPos);
        
        // Blend rotation to maintain floating feel
        robotObj.rotation.y = currentRotation * 0.7 + robotObj.rotation.y * 0.3;
      }
      
      // Pulsing glow effect for space drones
      const pulseIntensity = 0.4 + Math.sin(time * 1.5) * 0.3;
      robotObj.traverse((child: any) => {
        if (child.isMesh && child.material) {
          if (child.material.emissive) {
            // Pulse emissive colors
            const currentColor = child.material.emissive.getHex();
            if (currentColor === 0xff0000 || currentColor === 0x00ffff || currentColor === 0xffff00) {
              child.material.emissiveIntensity = pulseIntensity;
            }
          }
        }
      });

      // Thruster glow effect
      const thrusterPulse = 0.3 + Math.sin(time * 3) * 0.2;
      robotObj.traverse((child: any) => {
        if (child.isMesh && child.material && child.material.emissive) {
          if (child.material.emissive.getHex() === 0x333333) {
            child.material.emissiveIntensity = thrusterPulse;
            // Thruster color cycle
            const hue = (time * 0.5) % 1;
            child.material.emissive.setHSL(hue, 0.8, 0.3);
          }
        }
      });

      // Attack logic if player is in range
      if (distanceToPlayer <= attackRange) {
        if (time - lastAttackTime >= attackCooldown) {
          robotEntity.setValue(Robot, "lastAttackTime", time);
          
          // Damage player
          const playerEntities = this.queries.player.entities;
          if (playerEntities.size > 0) {
            const playerEntity = Array.from(playerEntities)[0];
            const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
            const newHealth = Math.max(0, currentHealth - attackDamage);
            
            playerEntity.setValue(Player, "health", newHealth);
            playerEntity.setValue(Player, "lastDamageTime", time);
            
            // Add damage effect
            if (!playerEntity.hasComponent(DamageEffect)) {
              playerEntity.addComponent(DamageEffect, {
                time: 0.0,
                duration: 0.4,
              });
            }
            
            console.log(`🚀 Space Drone fired! Health: ${newHealth}`);
            
            // Visual feedback - drone flashes brightly when attacking
            robotObj.traverse((child: any) => {
              if (child.isMesh && child.material && child.material.emissive) {
                const originalColor = child.material.emissive.getHex();
                child.material.emissive.setHex(0xffffff);
                child.material.emissiveIntensity = 1.5;
                setTimeout(() => {
                  child.material.emissive.setHex(originalColor);
                  child.material.emissiveIntensity = pulseIntensity;
                }, 200);
              }
            });
          }
        }
      }
      
      // Drone health indicator
      const health = robotEntity.getValue(Robot, "health") || 75.0;
      const maxHealth = robotEntity.getValue(Robot, "maxHealth") || 75.0;
      const healthPercentage = health / maxHealth;
      
      if (healthPercentage < 0.5) {
        // Damaged drones pulse erratically
        const damagePulse = 0.6 + Math.sin(time * 6) * 0.4;
        robotObj.traverse((child: any) => {
          if (child.isMesh && child.material && child.material.emissive) {
            const currentColor = child.material.emissive.getHex();
            if (currentColor === 0x440000 || currentColor === 0xff0000) {
              child.material.emissiveIntensity = damagePulse;
              // Flicker effect for critical damage
              if (healthPercentage < 0.2 && Math.random() > 0.7) {
                child.material.emissiveIntensity = 0;
                setTimeout(() => {
                  child.material.emissiveIntensity = damagePulse;
                }, 50);
              }
            }
          }
        });
      }
    }
  }
}