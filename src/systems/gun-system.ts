import { 
    createSystem, 
    Pressed,
    Vector3,
    Mesh,
    SphereGeometry,
    MeshStandardMaterial,
    Entity,
    AudioUtils,
    Quaternion,
    AudioSource
} from "@iwsdk/core";
import { Gun, Projectile, GameSound, Targeting } from "../components.js";

export class GunSystem extends createSystem(
    {
        guns: {
            required: [Gun]
        },
        gunsPressed: {
            required: [Gun, Pressed]
        },
        gunsWithTargeting: {
            required: [Gun, Targeting]
        }
    },
    {}
) {
    private reloadTimers = new Map<number, number>();
    private shootCooldown = 0;
    private targetingSystem: any = null;
    
    // Audio configuration
    private readonly SHOOT_SOUND = "./audio/shoot.mp3";
    private readonly RELOAD_SOUND = "./audio/reload.mp3";
    private readonly EMPTY_SOUND = "./audio/hit.mp3";
    private readonly LOCK_ON_SOUND = "./audio/lock_on.mp3";
    
    private shootAudioPool: HTMLAudioElement[] = [];
    private reloadAudio: HTMLAudioElement | null = null;
    private lockOnAudio: HTMLAudioElement | null = null;

    init(): void {
        console.log("🔫 GunSystem initialized with targeting");
        
        // Initialize audio pool
        this.initAudioPool();
        
        // Subscribe to gun events
        this.queries.guns.subscribe("qualify", (entity: Entity) => {
            this.setupGunAudio(entity);
        });

        this.queries.gunsPressed.subscribe("qualify", (entity: Entity) => {
            this.handleShoot(entity);
        });

        // Keyboard controls
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
        
        // Mouse controls
        document.addEventListener('mousedown', (e: MouseEvent) => {
            if (e.button === 0) {
                for (const entity of this.queries.guns.entities) {
                    this.handleShoot(entity);
                }
            }
        });
        
        // Find targeting system
        setTimeout(() => this.findTargetingSystem(), 1000);
    }

    private initAudioPool(): void {
        // Create pool of shoot sounds for rapid firing
        for (let i = 0; i < 10; i++) {
            const audio = new Audio(this.SHOOT_SOUND);
            audio.preload = "auto";
            this.shootAudioPool.push(audio);
        }
        
        // Create reload sound
        this.reloadAudio = new Audio(this.RELOAD_SOUND);
        this.reloadAudio.preload = "auto";
        
        // Create lock-on sound
        this.lockOnAudio = new Audio(this.LOCK_ON_SOUND);
        this.lockOnAudio.preload = "auto";
        
        console.log("🔊 Gun audio pool initialized");
    }

    private findTargetingSystem(): void {
        const systems = (this.world as any).systems;
        if (systems) {
            for (const system of systems) {
                if (system.constructor.name === "GunTargetingSystem") {
                    this.targetingSystem = system;
                    console.log("✅ Found GunTargetingSystem");
                    break;
                }
            }
        }
    }

    private setupGunAudio(gunEntity: Entity): void {
        // Add built-in AudioSource component if needed
        if (!gunEntity.hasComponent(AudioSource)) {
            gunEntity.addComponent(AudioSource, {
                src: this.SHOOT_SOUND,
                volume: 0.7,
                maxDistance: 25.0
            });
        }
        
        // Add our custom GameSound component for tracking
        if (!gunEntity.hasComponent(GameSound)) {
            gunEntity.addComponent(GameSound, {
                soundType: "gun",
                shouldPlay: false,
                lastPlayTime: 0.0
            });
        }
        
        // Add Targeting component if needed
        if (!gunEntity.hasComponent(Targeting)) {
            gunEntity.addComponent(Targeting, {
                lockDistance: 40.0,
                aimAssist: true,
                aimAssistStrength: 0.7
            });
        }
    }

    update(dt: number, time: number): void {        
        // Handle reload timers
        for (const entity of this.queries.guns.entities) {
            const isReloading = entity.getValue(Gun, "isReloading");
            
            if (isReloading && this.reloadTimers.has(entity.index)) {
                const finishTime = this.reloadTimers.get(entity.index)!;
                
                if (time >= finishTime) {
                    const maxAmmo = entity.getValue(Gun, "maxAmmo") || 40;
                    entity.setValue(Gun, "ammo", maxAmmo);
                    entity.setValue(Gun, "isReloading", false);
                    this.reloadTimers.delete(entity.index);
                    
                    // Play reload complete sound
                    this.playReloadCompleteSound();
                    
                    console.log("🔄 Reload complete!");
                }
            }
        }
        
        // Update shoot cooldown
        if (this.shootCooldown > 0) {
            this.shootCooldown -= dt;
        }
        
        // Update gun heat (cool down)
        for (const entity of this.queries.guns.entities) {
            const heat = entity.getValue(Gun, "heat") || 0;
            if (heat > 0) {
                const newHeat = Math.max(0, heat - dt * 20); // Cool down rate
                entity.setValue(Gun, "heat", newHeat);
                
                // Update gun visual based on heat
                this.updateGunHeatVisual(entity, newHeat);
            }
            
            // Check for lock-on sound
            if (entity.hasComponent(Targeting)) {
                const isLockedOn = entity.getValue(Targeting, "isLockedOn");
                const lastLockOnTime = entity.getValue(Targeting, "lockOnTime") || 0;
                
                if (isLockedOn && time - lastLockOnTime > 2.0) {
                    // Play lock-on sound every 2 seconds while locked
                    this.playLockOnSound();
                    entity.setValue(Targeting, "lockOnTime", time);
                }
            }
        }
    }

    private handleShoot(entity: Entity): void {
        if (this.shootCooldown > 0) return;
        
        const ammo = entity.getValue(Gun, "ammo") || 0;
        const isReloading = entity.getValue(Gun, "isReloading") || false;
        const fireRate = entity.getValue(Gun, "fireRate") || 0.15;
        const lastFireTime = entity.getValue(Gun, "lastFireTime") || 0.0;
        
        const currentTime = performance.now() / 1000;
        
        if (!isReloading && ammo > 0 && (currentTime - lastFireTime) >= fireRate) {
            this.fireProjectile(entity, currentTime);
            this.shootCooldown = fireRate;
        } else if (ammo === 0 && !isReloading) {
            console.log("⚠️ Out of ammo!");
            this.playEmptySound();
            this.reloadGun(entity, currentTime);
        }
    }

    private fireProjectile(entity: Entity, time: number): void {
        const damage = entity.getValue(Gun, "damage") || 45.0; // Increased damage
        const ammo = entity.getValue(Gun, "ammo") || 0;
        const heat = entity.getValue(Gun, "heat") || 0;
        const maxHeat = entity.getValue(Gun, "maxHeat") || 100.0;
        
        // Update ammo and heat
        entity.setValue(Gun, "ammo", ammo - 1);
        entity.setValue(Gun, "lastFireTime", time);
        entity.setValue(Gun, "heat", Math.min(maxHeat, heat + 15));
        
        // Play shooting sound
        this.playShootSound(entity);
        
        // Create muzzle flash
        this.createMuzzleFlash(entity);
        
        // Create projectile with targeting
        this.createTargetedProjectile(entity, damage);
        
        console.log(`🔫 Fired with targeting! Ammo: ${ammo - 1}, Heat: ${Math.min(maxHeat, heat + 15)}`);
    }

    private createTargetedProjectile(gunEntity: Entity, damage: number): void {
        const gunObj = gunEntity.object3D;
        if (!gunObj) {
            console.log("❌ Gun object not found");
            return;
        }
        
        // Get gun position and direction
        const gunPos = new Vector3();
        const gunQuat = new Quaternion();
        gunObj.getWorldPosition(gunPos);
        gunObj.getWorldQuaternion(gunQuat);
        
        // Use targeting system if available
        let shootDirection: Vector3;
        
        if (this.targetingSystem && gunEntity.hasComponent(Targeting)) {
            const targetPos = this.targetingSystem.getTargetPosition(gunEntity);
            const isLockedOn = gunEntity.getValue(Targeting, "isLockedOn");
            
            if (targetPos && isLockedOn) {
                // Shoot directly at target
                shootDirection = new Vector3().subVectors(targetPos, gunPos).normalize();
                console.log("🎯 Shooting at locked target!");
            } else {
                // Use gun forward direction with slight randomness
                shootDirection = new Vector3(0, 0, -1);
                shootDirection.applyQuaternion(gunQuat).normalize();
                
                // Add some spread if not locked on
                const spread = 0.05;
                shootDirection.x += (Math.random() - 0.5) * spread;
                shootDirection.y += (Math.random() - 0.5) * spread;
                shootDirection.normalize();
            }
        } else {
            // Fallback: shoot backward with randomness
            shootDirection = new Vector3(0, 0, -1);
            shootDirection.applyQuaternion(gunQuat).normalize();
            
            const spread = 0.08;
            shootDirection.x += (Math.random() - 0.5) * spread;
            shootDirection.y += (Math.random() - 0.5) * spread;
            shootDirection.normalize();
        }
        
        // Barrel offset
        const barrelOffset = new Vector3(0, 0.1, -0.3);
        barrelOffset.applyQuaternion(gunQuat);
        gunPos.add(barrelOffset);
        
        // Create projectile visual (larger for better visibility)
        const geometry = new SphereGeometry(0.08, 12, 12);
        const material = new MeshStandardMaterial({ 
            color: 0xff5500, // Orange for heat
            emissive: 0xff0000,
            emissiveIntensity: 2.5,
        });
        const projectileMesh = new Mesh(geometry, material);
        
        projectileMesh.position.copy(gunPos);
        
        // Create projectile entity with built-in AudioSource
        const projectileEntity = this.world
            .createTransformEntity(projectileMesh)
            .addComponent(Projectile, {
                damage: damage,
                speed: 35.0, // Faster projectile
                direction: [shootDirection.x, shootDirection.y, shootDirection.z],
                lifetime: 4.0,
                age: 0.0,
                owner: 0,
                type: "targeted_laser"
            });
        
        // Add built-in AudioSource component
        if (!projectileEntity.hasComponent(AudioSource)) {
            projectileEntity.addComponent(AudioSource, {
                src: "./audio/shoot.mp3",
                volume: 0.4,
                maxDistance: 35.0
            });
        }
        
        console.log(`✨ Targeted projectile created`);
    }

    private reloadGun(entity: Entity, time?: number): void {
        const reloadTime = entity.getValue(Gun, "reloadTime") || 1.5;
        const currentTime = time || performance.now() / 1000;
        const ammo = entity.getValue(Gun, "ammo") || 0;
        const maxAmmo = entity.getValue(Gun, "maxAmmo") || 40;
        
        if (ammo < maxAmmo && !entity.getValue(Gun, "isReloading")) {
            entity.setValue(Gun, "isReloading", true);
            this.reloadTimers.set(entity.index, currentTime + reloadTime);
            
            // Play reload sound
            this.playReloadSound();
            
            console.log("🔄 Reloading...");
        }
    }

    // ============================================
    // AUDIO METHODS
    // ============================================

    private playShootSound(gunEntity: Entity): void {
        try {
            // Use built-in AudioSource component
            if (gunEntity.hasComponent(AudioSource)) {
                // Update source and play
                gunEntity.setValue(AudioSource, "src", this.SHOOT_SOUND);
                gunEntity.setValue(AudioSource, "volume", 0.8); // Louder
                AudioUtils.play(gunEntity);
            } else {
                // Add AudioSource component first
                gunEntity.addComponent(AudioSource, {
                    src: this.SHOOT_SOUND,
                    volume: 0.8,
                });
                AudioUtils.play(gunEntity);
            }
        } catch (error) {
            console.warn("AudioUtils shoot sound failed:", error);
            
            // Fallback: Use audio pool
            const audio = this.getAvailableShootSound();
            if (audio) {
                audio.currentTime = 0;
                audio.volume = 0.8;
                audio.play().catch(e => console.warn("Shoot sound play failed:", e));
            }
        }
    }

    private playReloadSound(): void {
        if (this.reloadAudio) {
            this.reloadAudio.currentTime = 0;
            this.reloadAudio.volume = 0.6;
            this.reloadAudio.play().catch(e => console.warn("Reload sound failed:", e));
        }
    }

    private playLockOnSound(): void {
        if (this.lockOnAudio) {
            this.lockOnAudio.currentTime = 0;
            this.lockOnAudio.volume = 0.4;
            this.lockOnAudio.play().catch(e => console.warn("Lock-on sound failed:", e));
        }
    }

    private playReloadCompleteSound(): void {
        // Simple beep sound for reload complete
        const audio = new Audio();
        audio.src = "./audio/hit.mp3";
        audio.volume = 0.4;
        audio.play().catch(e => console.warn("Reload complete sound failed:", e));
    }

    private playEmptySound(): void {
        const audio = new Audio(this.EMPTY_SOUND);
        audio.volume = 0.5;
        audio.play().catch(e => console.warn("Empty sound failed:", e));
    }

    private getAvailableShootSound(): HTMLAudioElement | null {
        for (const audio of this.shootAudioPool) {
            if (audio.paused || audio.ended) {
                return audio;
            }
        }
        
        // If all are playing, create a new one
        const newAudio = new Audio(this.SHOOT_SOUND);
        this.shootAudioPool.push(newAudio);
        return newAudio;
    }

    // ============================================
    // VISUAL EFFECTS
    // ============================================

    private createMuzzleFlash(gunEntity: Entity): void {
        const gunObj = gunEntity.object3D;
        if (!gunObj) return;
        
        // Find barrel end
        const barrel = gunObj.getObjectByName("barrel") || gunObj;
        const flashPos = new Vector3(0, 0, -0.5);
        flashPos.applyQuaternion(barrel.quaternion);
        
        const worldPos = new Vector3();
        barrel.getWorldPosition(worldPos);
        worldPos.add(flashPos);
        
        // Create larger flash geometry
        const geometry = new SphereGeometry(0.12, 8, 8);
        const material = new MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0xffaa00,
            emissiveIntensity: 4.0, // Brighter
            transparent: true,
            opacity: 0.95
        });
        
        const flash = new Mesh(geometry, material);
        flash.position.copy(worldPos);
        
        // Add directly to scene
        if (this.world.scene) {
            this.world.scene.add(flash);
        }
        
        // Animate and remove flash
        let scale = 1.0;
        const animate = () => {
            if (!flash) return;
            
            scale += 0.8; // Faster expansion
            flash.scale.setScalar(scale);
            flash.material.opacity -= 0.25; // Faster fade
            
            if (flash.material.opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                if (flash.parent) {
                    flash.parent.remove(flash);
                }
            }
        };
        
        animate();
    }

    private updateGunHeatVisual(gunEntity: Entity, heat: number): void {
        const gunObj = gunEntity.object3D;
        if (!gunObj) return;
        
        const maxHeat = gunEntity.getValue(Gun, "maxHeat") || 100.0;
        const heatRatio = heat / maxHeat;
        
        // Update gun material based on heat
        gunObj.traverse((child: any) => {
            if (child.isMesh && child.material && child.material.emissive) {
                // Make gun glow based on heat
                if (heatRatio > 0.7) {
                    const redIntensity = (heatRatio - 0.7) * 3.33;
                    child.material.emissive.setHex(0xff0000);
                    child.material.emissiveIntensity = redIntensity * 1.5;
                } else if (heatRatio > 0.3) {
                    const orangeIntensity = (heatRatio - 0.3) * 2.5;
                    child.material.emissive.setHex(0xff5500);
                    child.material.emissiveIntensity = orangeIntensity * 1.3;
                } else {
                    // Cool state - subtle blue glow
                    child.material.emissive.setHex(0x0044ff);
                    child.material.emissiveIntensity = 0.3;
                }
            }
        });
    }
}