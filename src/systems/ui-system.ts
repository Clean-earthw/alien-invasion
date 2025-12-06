import { createSystem, Entity } from "@iwsdk/core";
import { UIController, Gun, Player, GameState } from "../components.js";

export class UISystem extends createSystem(
    {
        hudUI: {
            required: [UIController]
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
    },
    {
        // Optional config parameters
    }
) {
    private gunEntity: Entity | null = null;

    init(): void {
        console.log("UISystem initialized");
        
        // Store gun reference
        this.queries.guns.subscribe("qualify", (entity: Entity) => {
            this.gunEntity = entity;
        });

        this.setupDOMListeners();
    }

    private setupDOMListeners(): void {
        document.addEventListener('click', (e: MouseEvent) => {
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

        // Connect to global functions
        (window as any).triggerReload = () => {
            if (this.gunEntity) {
                this.triggerReload();
            }
        };
        
        (window as any).triggerBomb = () => {
            if (this.gunEntity) {
                this.triggerBomb();
            }
        };
    }

    private triggerReload(): void {
        if (this.gunEntity) {
            const isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
            const ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
            const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
            
            if (!isReloading && ammo < maxAmmo) {
                this.gunEntity.setValue(Gun, "isReloading", true);
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

    private triggerBomb(): void {
        if (this.gunEntity) {
            const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 0;
            if (bombCount > 0) {
                this.gunEntity.setValue(Gun, "bombCount", bombCount - 1);
                console.log(`Bomb thrown! ${bombCount - 1} remaining`);
            }
        }
    }

    update(): void {
        this.updateHUD();
    }

    private updateHUD(): void {
        // Update Game State
        const gameStateEntities = Array.from(this.queries.gameState.entities);
        if (gameStateEntities.length === 0) return;

        const gameState = gameStateEntities[0];
        const score = gameState.getValue(GameState, "score") || 0;
        const wave = gameState.getValue(GameState, "wave") || 1;
        const killed = gameState.getValue(GameState, "robotsKilled") || 0;
        const killedInWave = gameState.getValue(GameState, "robotsKilledInWave") || 0;
        const robotsPerWave = gameState.getValue(GameState, "robotsPerWave") || 3;
        const waveCompleted = gameState.getValue(GameState, "waveCompleted") || false;
        
        // Update Player Health
        const playerEntities = Array.from(this.queries.player.entities);
        let health = 100;
        if (playerEntities.length > 0) {
            const player = playerEntities[0];
            health = Math.max(1, player.getValue(Player, "health") || 100);
        }
        
        // Update Gun Info
        let ammo = 0;
        let maxAmmo = 30;
        let bombCount = 0;
        let isReloading = false;
        
        if (this.gunEntity) {
            ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
            maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 30;
            bombCount = this.gunEntity.getValue(Gun, "bombCount") || 0;
            isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
        }
        
        // Calculate wave progress
        const progress = robotsPerWave > 0 ? 
            Math.min(100, Math.floor((killedInWave / robotsPerWave) * 100)) : 0;
        
        // Update DOM elements
        this.updateElement('score-value', score.toString());
        this.updateElement('wave-value', `Wave ${wave}`);
        this.updateElement('kills-value', killed.toString());
        this.updateElement('health-value', `${Math.round(health)}/100`);
        this.updateElement('ammo-value', isReloading ? 'RELOADING...' : `${ammo}/${maxAmmo}`);
        this.updateElement('bomb-value', bombCount.toString());
        this.updateElement('wave-progress', `${killedInWave}/${robotsPerWave}`);
        
        // Update progress bar
        const progressBar = document.getElementById('wave-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.style.backgroundColor = progress === 100 ? '#22c55e' : '#3b82f6';
        }
        
        // Show/hide wave complete indicator
        const waveComplete = document.getElementById('wave-complete');
        if (waveComplete) {
            waveComplete.style.display = waveCompleted ? 'block' : 'none';
        }
    }

    private updateElement(id: string, value: string): void {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}