// systems/gun-system.ts - FIXED VERSION
import { 
    createSystem, 
    Pressed,
    Vector3,
    Mesh,
    SphereGeometry,
    MeshStandardMaterial,
    Entity,
    Object3D
} from "@iwsdk/core";
import { Gun, Projectile } from "../components.js";

export class GunSystem extends createSystem(
    {
        guns: {
            required: [Gun]
        },
        gunsPressed: {
            required: [Gun, Pressed]
        }
    },
    {}
) {
    private reloadTimers = new Map<number, number>();
    private shootCooldown = 0;
    private gunEntity: Entity | null = null;

    init(): void {
        console.log("🔫 GunSystem initialized");
        
        this.queries.guns.subscribe("qualify", (entity: Entity) => {
            this.gunEntity = entity;
        });

        this.queries.gunsPressed.subscribe("qualify", (entity: Entity) => {
            this.handleShoot(entity);
        });

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                for (const entity of this.queries.guns.entities) {
                    this.handleShoot(entity);
                }
            } else if (e.code === 'KeyR') {
                for (const entity of this.queries.guns.entities) {
                    this.reloadGun(entity);
                }
            }
        });
        
        document.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 0) {
                for (const entity of this.queries.guns.entities) {
                    this.handleShoot(entity);
                }
            }
        });
        
        (window as any).triggerShoot = () => {
            for (const entity of this.queries.guns.entities) {
                this.handleShoot(entity);
            }
        };
        
        (window as any).triggerReload = () => {
            for (const entity of this.queries.guns.entities) {
                this.reloadGun(entity);
            }
        };
    }

    update(dt: number, time: number): void {        
        for (const entity of this.queries.guns.entities) {
            const isReloading = entity.getValue(Gun, "isReloading");
            
            if (isReloading && this.reloadTimers.has(entity.index)) {
                const finishTime = this.reloadTimers.get(entity.index)!;
                
                if (time >= finishTime) {
                    const maxAmmo = entity.getValue(Gun, "maxAmmo") || 30;
                    entity.setValue(Gun, "ammo", maxAmmo);
                    entity.setValue(Gun, "isReloading", false);
                    this.reloadTimers.delete(entity.index);
                    
                    console.log("🔄 Reload complete!");
                }
            }
        }
        
        if (this.shootCooldown > 0) {
            this.shootCooldown -= dt;
        }
    }

    private handleShoot(entity: Entity): void {
        if (this.shootCooldown > 0) return;
        
        const ammo = entity.getValue(Gun, "ammo") || 0;
        const isReloading = entity.getValue(Gun, "isReloading") || false;
        const fireRate = entity.getValue(Gun, "fireRate") || 0.2;
        const lastFireTime = entity.getValue(Gun, "lastFireTime") || 0.0;
        
        const currentTime = performance.now() / 1000;
        
        if (!isReloading && ammo > 0 && (currentTime - lastFireTime) >= fireRate) {
            this.fireProjectile(entity, currentTime);
            this.shootCooldown = fireRate;
        } else if (ammo === 0 && !isReloading) {
            console.log("⚠️ Out of ammo!");
            this.reloadGun(entity, currentTime);
        }
    }

    private fireProjectile(entity: Entity, time: number): void {
        const damage = entity.getValue(Gun, "damage") || 25.0;
        const ammo = entity.getValue(Gun, "ammo") || 0;
        
        entity.setValue(Gun, "ammo", ammo - 1);
        entity.setValue(Gun, "lastFireTime", time);
        
        this.createProjectile(entity, damage);
        
        console.log(`🔫 Fired! Ammo: ${ammo - 1}`);
    }

    private reloadGun(entity: Entity, time?: number): void {
        const reloadTime = entity.getValue(Gun, "reloadTime") || 1.5;
        const currentTime = time || performance.now() / 1000;
        const ammo = entity.getValue(Gun, "ammo") || 0;
        const maxAmmo = entity.getValue(Gun, "maxAmmo") || 30;
        
        if (ammo < maxAmmo && !entity.getValue(Gun, "isReloading")) {
            entity.setValue(Gun, "isReloading", true);
            this.reloadTimers.set(entity.index, currentTime + reloadTime);
            console.log("🔄 Reloading...");
        }
    }

    
// CRITICAL FIXES - Reverse gun and robot positions while keeping environment intact

// ============================================
// FIX 1: GUN SYSTEM - Shoot BACKWARD (negative Z)
// ============================================

// In systems/gun-system.ts - createProjectile method:
private createProjectile(gunEntity: Entity, damage: number): void {
    const gunObj = gunEntity.object3D;
    if (!gunObj) {
        console.log("❌ Gun object not found");
        return;
    }
    
    // Get gun position and BACKWARD direction
    const gunPos = new Vector3();
    gunObj.getWorldPosition(gunPos);
    
    // FIXED: Gun shoots BACKWARD (negative Z direction) where robots are
    const forward = new Vector3(0, 0, -1); // Shoot toward negative Z
    forward.applyQuaternion(gunObj.quaternion);
    forward.normalize();
    
    console.log(`🎯 Shooting direction: (${forward.x.toFixed(2)}, ${forward.y.toFixed(2)}, ${forward.z.toFixed(2)})`);
    
    // Create projectile visual
    const geometry = new SphereGeometry(0.05, 8, 8);
    const material = new MeshStandardMaterial({ 
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 1.0,
    });
    const projectileMesh = new Mesh(geometry, material);
    
    // Start projectile in front of gun barrel
    const barrelOffset = forward.clone().multiplyScalar(0.5);
    projectileMesh.position.copy(gunPos).add(barrelOffset);
    
    // Create projectile entity with BACKWARD direction
    this.world
        .createTransformEntity(projectileMesh)
        .addComponent(Projectile, {
            damage: damage,
            speed: 30.0,
            direction: [forward.x, forward.y, forward.z],
            lifetime: 4.0,
            age: 0.0,
            owner: 0,
        });
    
    console.log(`✨ Projectile created, shooting toward NEGATIVE Z`);
}
}