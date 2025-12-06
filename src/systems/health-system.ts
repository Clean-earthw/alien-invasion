import { createSystem, eq } from "@iwsdk/core";
import { Player, DamageEffect, GameState } from "../components.js";

export class HealthSystem extends createSystem({
  player: {
    required: [Player]
  },
  damageEffects: {
    required: [DamageEffect]
  },
  gameState: {
    required: [GameState]
  }
}) {
  update(dt: number, time: number) {
    // Update player health regeneration
    for (const playerEntity of this.queries.player.entities) {
      const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
      const maxHealth = playerEntity.getValue(Player, "maxHealth") || 100.0;
      const lastDamageTime = playerEntity.getValue(Player, "lastDamageTime") || 0.0;
      
      // Regenerate health if not damaged recently (3 seconds)
      if (currentHealth < maxHealth && (time - lastDamageTime) > 3.0) {
        const newHealth = Math.min(maxHealth, currentHealth + 10.0 * dt);
        playerEntity.setValue(Player, "health", newHealth);
      }
      
      // Check for player death
      if (currentHealth <= 0) {
        const gameStateEntities = this.queries.gameState.entities;
        if (gameStateEntities.size > 0) {
          const gameState = Array.from(gameStateEntities)[0];
          gameState.setValue(GameState, "isGameOver", true);
          gameState.setValue(GameState, "isPlaying", false);
          
          console.log("GAME OVER - Player died!");
        }
      }
    }
    
    // Update damage effects (flash red on hit)
    for (const effectEntity of this.queries.damageEffects.entities) {
      const effectTime = effectEntity.getValue(DamageEffect, "time") || 0.0;
      const duration = effectEntity.getValue(DamageEffect, "duration") || 0.5;
      const newTime = effectTime + dt;
      
      effectEntity.setValue(DamageEffect, "time", newTime);
      
      // Visual feedback
      if (effectEntity.object3D) {
        const intensity = Math.max(0, 1.0 - (newTime / duration));
        effectEntity.object3D.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => {
                if (mat.emissive) {
                  mat.emissive.setHex(0xff0000).multiplyScalar(intensity);
                }
              });
            } else if (child.material.emissive) {
              child.material.emissive.setHex(0xff0000).multiplyScalar(intensity);
            }
          }
        });
      }
      
      // Remove effect when duration ends
      if (newTime >= duration) {
        // Reset emissive color
        if (effectEntity.object3D) {
          effectEntity.object3D.traverse((child: any) => {
            if (child.isMesh && child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: any) => {
                  if (mat.emissive) {
                    mat.emissive.setHex(0x000000);
                  }
                });
              } else if (child.material.emissive) {
                child.material.emissive.setHex(0x000000);
              }
            }
          });
        }
        effectEntity.removeComponent(DamageEffect);
      }
    }
  }
}