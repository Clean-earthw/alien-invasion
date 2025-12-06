import { createSystem, PanelUI, PanelDocument } from "@iwsdk/core";
import { UIController, Gun, Player, GameState } from "../components.js";

export class UISystem extends createSystem({
  hudUI: {
    required: [PanelUI, PanelDocument, UIController],
  },
  gunUI: {
    required: [PanelUI, PanelDocument, UIController],
  },
  healthUI: {
    required: [PanelUI, PanelDocument, UIController],
  },
  guns: {
    required: [Gun]
  },
  player: {
    required: [Player]
  },
  gameState: {
    required: [GameState]
  }
}) {
  private gunEntity: any = null;

  init() {
    console.log("UISystem initialized");
    
    // Store gun reference
    this.queries.guns.subscribe("qualify", (entity: any) => {
      this.gunEntity = entity;
    });

    // Setup DOM listeners as fallback
    this.setupDOMListeners();
  }

  private setupDOMListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.id === 'reload-btn' || target.closest('#reload-btn')) {
        if (this.gunEntity) {
          this.triggerReload();
        }
      }
      
      if (target.id === 'bomb-btn' || target.closest('#bomb-btn')) {
        if (this.gunEntity) {
          this.triggerBomb();
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && this.gunEntity) {
        this.triggerReload();
      }
      if (e.code === 'KeyB' && this.gunEntity) {
        this.triggerBomb();
      }
    });
  }

  private triggerReload() {
    if (this.gunEntity) {
      const isReloading = this.gunEntity.getValue(Gun, "isReloading");
      const ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
      const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
      
      if (!isReloading && ammo < maxAmmo) {
        this.gunEntity.setValue(Gun, "isReloading", true);
        const currentTime = performance.now() / 1000;
        const reloadTime = this.gunEntity.getValue(Gun, "reloadTime") || 2.0;
        
        setTimeout(() => {
          if (this.gunEntity) {
            this.gunEntity.setValue(Gun, "ammo", maxAmmo);
            this.gunEntity.setValue(Gun, "isReloading", false);
            console.log("Reload complete!");
          }
        }, reloadTime * 1000);
      }
    }
  }

  private triggerBomb() {
    if (this.gunEntity) {
      const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 0;
      if (bombCount > 0) {
        this.gunEntity.setValue(Gun, "bombCount", bombCount - 1);
        console.log(`Bomb thrown! ${bombCount - 1} remaining`);
      }
    }
  }

  update() {
    this.updateHUD();
    this.updateGunUI();
    this.updateHealthUI();
  }

  private updateHUD() {
    const gameStateEntities = this.queries.gameState.entities;
    if (gameStateEntities.size === 0) return;

    const gameState = Array.from(gameStateEntities)[0];
    const score = gameState.getValue(GameState, "score") || 0;
    const wave = gameState.getValue(GameState, "wave") || 1;
    const killed = gameState.getValue(GameState, "robotsKilled") || 0;

    // Update DOM elements
    this.updateElement('score-value', score.toString());
    this.updateElement('wave-value', wave.toString());
    this.updateElement('kills-value', killed.toString());
  }

  private updateGunUI() {
    if (!this.gunEntity) return;

    const ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
    const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
    const isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
    const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 3;

    this.updateElement('ammo-value', isReloading ? 'RELOADING...' : `${ammo}/${maxAmmo}`);
    this.updateElement('bomb-count', `x${bombCount}`);
  }

  private updateHealthUI() {
    const playerEntities = this.queries.player.entities;
    if (playerEntities.size === 0) return;

    const player = Array.from(playerEntities)[0];
    const health = player.getValue(Player, "health") || 100;
    const maxHealth = player.getValue(Player, "maxHealth") || 100;

    this.updateElement('health-value', `${Math.round(health)}/${maxHealth}`);
  }

  private updateElement(id: string, value: string) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
    
    // Also update DOM fallback
    const domId = 'dom-' + id;
    const domElement = document.getElementById(domId);
    if (domElement) {
      domElement.textContent = value;
    }
  }
}