import { createSystem, Entity } from "@iwsdk/core";
import { Player, DamageEffect } from "../components.js";

export class HealthSystem extends createSystem(
    {
        player: {
            required: [Player]
        },
        damageEffects: {
            required: [DamageEffect]
        }
    },
    {
        // Optional config parameters
    }
) {
    update(dt: number, time: number): void {
        // Update player health (IMMORTAL)
        for (const playerEntity of this.queries.player.entities) {
            const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
            const maxHealth = playerEntity.getValue(Player, "maxHealth") || 100.0;
            const lastDamageTime = playerEntity.getValue(Player, "lastDamageTime") || 0.0;
            const isImmortal = playerEntity.getValue(Player, "isImmortal") || true;
            
            // IMMORTALITY: Never die, reset to 1 health if would die
            if (currentHealth <= 0 && isImmortal) {
                playerEntity.setValue(Player, "health", 1.0);
                console.log("✨ Player is immortal! Health reset to 1.");
                
                this.createImmortalityEffect();
            }
            
            // Fast regeneration when not recently damaged
            if (currentHealth < maxHealth && (time - lastDamageTime) > 1.5) {
                const regenRate = currentHealth < 30 ? 25.0 : 15.0;
                const newHealth = Math.min(maxHealth, currentHealth + regenRate * dt);
                playerEntity.setValue(Player, "health", newHealth);
            }
        }
        
        // Update damage effects
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

    private createImmortalityEffect(): void {
        const camera = this.world.camera;
        if (!camera) return;
        
        const flashDiv = document.createElement('div');
        flashDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
            z-index: 9999;
            pointer-events: none;
            animation: fadeOut 0.5s forwards;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(flashDiv);
        
        setTimeout(() => {
            if (flashDiv.parentNode) {
                flashDiv.parentNode.removeChild(flashDiv);
            }
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        }, 500);
    }
}