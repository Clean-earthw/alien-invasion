import { 
  createSystem, 
  Pressed,
  Vector3,
  Mesh,
  SphereGeometry,
  MeshStandardMaterial,
} from "@iwsdk/core";
import { Gun, Projectile, Bomb } from "../components.js";

export class GunSystem extends createSystem({
  guns: {
    required: [Gun]
  },
  gunsPressed: {
    required: [Gun, Pressed]
  }
}) {
  private reloadTimers = new Map<number, number>();
  private shootCooldown = 0;
  private initialized = false;

  init() {
    console.log("🔫 GunSystem initialized");
    this.initialized = true;
    
    // Handle trigger press
    this.queries.gunsPressed.subscribe("qualify", (entity: any) => {
      this.handleShoot(entity);
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        console.log("Space pressed - shooting");
        for (const entity of this.queries.guns.entities) {
          this.handleShoot(entity);
        }
      } else if (e.code === 'KeyR') {
        console.log("R pressed - reloading");
        for (const entity of this.queries.guns.entities) {
          this.reloadGun(entity);
        }
      }
    });
    
    // Mouse controls for desktop testing
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        console.log("Mouse clicked - shooting");
        for (const entity of this.queries.guns.entities) {
          this.handleShoot(entity);
        }
      }
    });
    
    // Touch controls for mobile
    document.addEventListener('touchstart', (e) => {
      console.log("Touch - shooting");
      for (const entity of this.queries.guns.entities) {
        this.handleShoot(entity);
      }
    });
  }

  update(dt: number, time: number) {
    if (!this.initialized) return;
    
    // Update reload timers
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
    
    // Update shoot cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }
  }

  private handleShoot(entity: any) {
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

  private fireProjectile(entity: any, time: number) {
    const damage = entity.getValue(Gun, "damage") || 25.0;
    const ammo = entity.getValue(Gun, "ammo") || 0;
    
    entity.setValue(Gun, "ammo", ammo - 1);
    entity.setValue(Gun, "lastFireTime", time);
    
    this.createProjectile(entity, damage);
    
    console.log(`🔫 Fired! Ammo: ${ammo - 1}`);
  }

  private reloadGun(entity: any, time?: number) {
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

  private createProjectile(gunEntity: any, damage: number) {
    const gunObj = gunEntity.object3D;
    if (!gunObj) {
      console.log("❌ Gun object not found");
      return;
    }
    
    // Get gun position and forward direction
    const gunPos = new Vector3();
    gunObj.getWorldPosition(gunPos);
    
    // Get forward direction from gun rotation
    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(gunObj.quaternion);
    forward.normalize();
    
    // Create projectile visual
    const geometry = new SphereGeometry(0.05, 8, 8);
    const material = new MeshStandardMaterial({ 
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0,
    });
    const projectileMesh = new Mesh(geometry, material);
    
    // Position projectile at gun barrel tip
    const barrelOffset = forward.clone().multiplyScalar(0.3);
    projectileMesh.position.copy(gunPos).add(barrelOffset);
    
    // Create projectile entity
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
    
    console.log("✨ Projectile created");
  }
}