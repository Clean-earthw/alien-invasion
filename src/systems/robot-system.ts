import { createSystem, Vector3, Entity } from "@iwsdk/core";
import { Robot, Player, DamageEffect } from "../components.js";

export class RobotSystem extends createSystem(
    {
        activeRobots: {
            required: [Robot],
        },
        player: {
            required: [Player]
        }
    },
    {
        // Optional config parameters
    }
) {
    private tempVec3 = new Vector3();
    private playerPos = new Vector3();

    init(): void {
        console.log("🤖 RobotSystem initialized");
    }

    update(dt: number, time: number): void {        
    const playerPos = new Vector3(0, 1.5, 0);
    if (this.world.camera) {
        this.world.camera.getWorldPosition(playerPos);
    }

    for (const robotEntity of this.queries.activeRobots.entities) {
        const isDead = robotEntity.getValue(Robot, "isDead");
        const robotObj = robotEntity.object3D;
        
        if (isDead || !robotObj) continue;

        const floatData = (robotObj as any).userData;
        
        if (floatData) {
            const { floatHeight, floatSpeed, timeOffset, bobAmount } = floatData;
            robotObj.position.y = floatHeight + Math.sin((time + timeOffset) * floatSpeed) * bobAmount;
            robotObj.rotation.y += 0.001;
        }
        
        const alienPos = new Vector3();
        robotObj.getWorldPosition(alienPos);
        
        const distanceToPlayer = alienPos.distanceTo(playerPos);
        
        // ROBOT FACES PLAYER (robots at negative Z, player at 0)
        const lookAtPos = new Vector3(playerPos.x, playerPos.y * 0.8, playerPos.z);
        robotObj.lookAt(lookAtPos);
        
        // Pulsing glow
        const pulseIntensity = 0.6 + Math.sin(time * 2.0) * 0.3;
        robotObj.traverse((child: any) => {
            if (child.isMesh && child.material && child.material.emissive) {
                child.material.emissiveIntensity = pulseIntensity;
            }
        });
        
        // Attack logic
        const attackRange = robotEntity.getValue(Robot, "attackRange") || 25.0;
        const attackCooldown = robotEntity.getValue(Robot, "attackCooldown") || 2.5;
        const lastAttackTime = robotEntity.getValue(Robot, "lastAttackTime") || 0.0;
        
        // Robots can see player (they're behind at negative Z)
        const canSeePlayer = alienPos.z < -5 && Math.abs(alienPos.x) < 15;
        
        if (canSeePlayer && distanceToPlayer <= attackRange) {
            if (time - lastAttackTime >= attackCooldown) {
                robotEntity.setValue(Robot, "lastAttackTime", time);
                
                const playerEntities = Array.from(this.queries.player.entities);
                if (playerEntities.length > 0) {
                    const playerEntity = playerEntities[0];
                    const attackDamage = robotEntity.getValue(Robot, "attackDamage") || 15.0;
                    const currentHealth = playerEntity.getValue(Player, "health") || 100.0;
                    const newHealth = Math.max(0, currentHealth - attackDamage);
                    
                    playerEntity.setValue(Player, "health", newHealth);
                    playerEntity.setValue(Player, "lastDamageTime", time);
                    
                    if (!playerEntity.hasComponent(DamageEffect)) {
                        playerEntity.addComponent(DamageEffect, {
                            time: 0.0,
                            duration: 0.3,
                        });
                    }
                    
                    // Flash red on attack
                    robotObj.traverse((child: any) => {
                        if (child.isMesh && child.material && child.material.emissive) {
                            const originalColor = child.material.emissive.getHex();
                            child.material.emissive.setHex(0xff0000);
                            child.material.emissiveIntensity = 2.5;
                            setTimeout(() => {
                                child.material.emissive.setHex(originalColor);
                            }, 200);
                        }
                    });
                    
                    console.log(`👽 Alien fired from BEHIND!`);
                }
            }
        }
        
        // Move toward player from behind
        const speed = robotEntity.getValue(Robot, "speed") || 0.3;
        if (alienPos.z < -8 && distanceToPlayer > 15) {
            const moveAmount = speed * dt;
            alienPos.z += moveAmount * 0.7; // Move toward positive Z (player)
            alienPos.x += (Math.random() - 0.5) * moveAmount * 0.3;
            robotObj.position.copy(alienPos);
        }
    }
}

}