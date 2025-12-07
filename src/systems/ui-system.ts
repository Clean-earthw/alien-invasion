// systems/ui-system.ts
import { 
    createSystem, 
    Entity,
    PanelUI,
    PanelDocument,
    UIKitDocument,
    UIKit,
    VisibilityState
} from "@iwsdk/core";
import { 
    Gun, 
    Player, 
    GameState,
    WaveSpawner
} from "../components.js";

export class UISystem extends createSystem(
    {
        panelUI: {
            required: [PanelUI, PanelDocument]
        },
        guns: {
            required: [Gun]
        },
        player: {
            required: [Player]
        },
        gameState: {
            required: [GameState]
        },
        waveSpawner: {
            required: [WaveSpawner]
        }
    },
    {}
) {
    private gunEntity: Entity | null = null;
    private panelDocument: UIKitDocument | null = null;
    private gameRunning: boolean = false;
    private showInstructions: boolean = false;
    private inVR: boolean = false;
    private lastUpdateTime: number = 0;

    init(): void {
        console.log("🎮 UISystem initialized with UIKit");
        
        // Store gun reference
        this.queries.guns.subscribe("qualify", (entity: Entity) => {
            this.gunEntity = entity;
        });

        // Setup panel UI
        this.queries.panelUI.subscribe("qualify", (entity: Entity) => {
            this.setupPanelUI(entity);
        });

        // Listen for VR state changes
        this.world.visibilityState.subscribe((visibilityState) => {
            this.inVR = visibilityState !== VisibilityState.NonImmersive;
            this.updateVRButton();
        });

        // Setup keyboard shortcuts
        this.setupKeyboardControls();
    }

    private setupPanelUI(entity: Entity): void {
        this.panelDocument = PanelDocument.data.document[
            entity.index
        ] as UIKitDocument;
        
        if (!this.panelDocument) {
            console.error("Panel document not found");
            return;
        }

        this.setupEventListeners();
        this.updateUI();
    }

    private setupEventListeners(): void {
        if (!this.panelDocument) return;
        
        // Get UI elements
        const vrButton = this.panelDocument.getElementById("xr-button");
        const startButton = this.panelDocument.getElementById("start-game");
        
        // VR Button - Toggle VR mode
        if (vrButton) {
            vrButton.addEventListener("click", () => {
                this.playClickSound();
                if (this.world.visibilityState.value === VisibilityState.NonImmersive) {
                    this.world.launchXR();
                } else {
                    this.world.exitXR();
                }
            });
        }
        
        // Start Game Button
        if (startButton) {
            startButton.addEventListener("click", () => {
                this.playClickSound();
                this.toggleGame();
            });
        }
        
        // Instructions button
        const instructionsButton = this.panelDocument.getElementById("instructions-button");
        if (instructionsButton) {
            instructionsButton.addEventListener("click", () => {
                this.playClickSound();
                this.toggleInstructions();
            });
        }
        
        // Exit button
        const exitButton = this.panelDocument.getElementById("exit-button");
        if (exitButton) {
            exitButton.addEventListener("click", () => {
                this.playClickSound();
                this.exitToMenu();
            });
        }
        
        // Restart button
        const restartButton = this.panelDocument.getElementById("restart-button");
        if (restartButton) {
            restartButton.addEventListener("click", () => {
                this.playClickSound();
                this.restartGame();
            });
        }
    }

    private setupKeyboardControls(): void {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            // Space to toggle game
            if (e.code === 'Space' && !e.target || (e.target as HTMLElement).tagName !== 'INPUT') {
                e.preventDefault();
                this.toggleGame();
            }
            
            // I to toggle instructions
            if (e.code === 'KeyI') {
                e.preventDefault();
                this.toggleInstructions();
            }
            
            // Escape to exit to menu
            if (e.code === 'Escape') {
                e.preventDefault();
                this.exitToMenu();
            }
            
            // R to reload
            if (e.code === 'KeyR') {
                e.preventDefault();
                this.triggerReload();
            }
            
            // B for bomb
            if (e.code === 'KeyB') {
                e.preventDefault();
                this.triggerBomb();
            }
        });
    }

    update(): void {
        const currentTime = Date.now();
        
        // Update UI every 100ms when game is running
        if (this.gameRunning && currentTime - this.lastUpdateTime >= 100) {
            this.updateGameStats();
            this.lastUpdateTime = currentTime;
        }
    }

    private updateUI(): void {
        this.updateVRButton();
        this.updateGameStats();
        this.updatePanelVisibility();
    }

    private updateVRButton(): void {
        if (!this.panelDocument) return;
        
        const vrButton = this.panelDocument.getElementById("xr-button");
        if (vrButton) {
            const text = this.inVR ? "Exit XR" : "Enter XR";
            vrButton.setProperties({ text });
        }
    }

    private updateGameStats(): void {
        if (!this.panelDocument) return;
        
        // Update game state
        for (const stateEntity of this.queries.gameState.entities) {
            const score = stateEntity.getValue(GameState, "score") || 0;
            const wave = stateEntity.getValue(GameState, "wave") || 1;
            const robotsKilled = stateEntity.getValue(GameState, "robotsKilled") || 0;
            const robotsKilledInWave = stateEntity.getValue(GameState, "robotsKilledInWave") || 0;
            const robotsPerWave = stateEntity.getValue(GameState, "robotsPerWave") || 3;
            const gameOver = stateEntity.getValue(GameState, "gameOver") || false;
            const isPlaying = stateEntity.getValue(GameState, "isPlaying") || false;
            
            // Update score
            const scoreElement = this.panelDocument.getElementById("score");
            if (scoreElement) {
                scoreElement.setProperties({ text: score.toString() });
            }
            
            // Update remaining robots
            const remainingElement = this.panelDocument.getElementById("remaining");
            if (remainingElement) {
                const remaining = Math.max(0, robotsPerWave - robotsKilledInWave);
                remainingElement.setProperties({ text: remaining.toString() });
            }
            
            // Update wave indicator
            const waveElement = this.panelDocument.getElementById("wave-indicator");
            if (waveElement) {
                waveElement.setProperties({ text: `Wave ${wave}` });
            }
            
            // Update robots killed
            const robotsKilledElement = this.panelDocument.getElementById("robots-killed");
            if (robotsKilledElement) {
                robotsKilledElement.setProperties({ text: robotsKilled.toString() });
            }
            
            // Update final wave (for game over panel)
            const finalWaveElement = this.panelDocument.getElementById("final-wave");
            if (finalWaveElement) {
                finalWaveElement.setProperties({ text: wave.toString() });
            }
            
            // Update final score
            const finalScoreElement = this.panelDocument.getElementById("final-score");
            if (finalScoreElement) {
                finalScoreElement.setProperties({ text: score.toString() });
            }
            
            // Update final robots
            const finalRobotsElement = this.panelDocument.getElementById("final-robots");
            if (finalRobotsElement) {
                finalRobotsElement.setProperties({ text: robotsKilled.toString() });
            }
            
            // Show/hide game over panel
            const gameOverPanel = this.panelDocument.getElementById("game-over-panel");
            if (gameOverPanel) {
                const isVisible = !!(gameOver && this.gameRunning);
                gameOverPanel.setProperties({ visible: isVisible });
                
                if (isVisible) {
                    this.gameRunning = false;
                }
            }
            
            // Update start button text based on game state
            const startButton = this.panelDocument.getElementById("start-game");
            if (startButton) {
                if (this.gameRunning) {
                    startButton.setProperties({ 
                        text: isPlaying ? "⏸️ PAUSE" : "▶️ RESUME"
                    });
                } else {
                    startButton.setProperties({ 
                        text: gameOver ? "🔄 RESTART" : "🎮 START GAME"
                    });
                }
            }
        }
        
        // Update player health
        for (const playerEntity of this.queries.player.entities) {
            const health = playerEntity.getValue(Player, "health") || 100;
            const maxHealth = playerEntity.getValue(Player, "maxHealth") || 100;
            const healthPercent = Math.round((health / maxHealth) * 100);
            
            const healthElement = this.panelDocument.getElementById("health");
            if (healthElement) {
                // Calculate health color
                const healthColor = this.getHealthColor(healthPercent);
                healthElement.setProperties({ 
                    text: `${healthPercent}%`,
                    color: healthColor
                });
            }
        }
        
        // Update gun stats
        if (this.gunEntity) {
            const ammo = this.gunEntity.getValue(Gun, "ammo") || 40;
            const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 40;
            const isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
            const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 3;
            
            // Calculate ammo percentage
            const ammoPercent = (ammo / maxAmmo) * 100;
            
            // Update ammo display
            const ammoElement = this.panelDocument.getElementById("ammo");
            if (ammoElement) {
                if (isReloading) {
                    ammoElement.setProperties({ text: "RELOADING..." });
                } else {
                    ammoElement.setProperties({ text: `${ammo}/${maxAmmo}` });
                }
                
                // Set color based on ammo level
                const ammoColor = this.getAmmoColor(ammoPercent);
                ammoElement.setProperties({ 
                    color: ammoColor 
                });
            }
            
            // Update bomb count if element exists
            const bombElement = this.panelDocument.getElementById("bomb-count");
            if (bombElement) {
                bombElement.setProperties({ text: bombCount.toString() });
            }
        }
    }

    private updatePanelVisibility(): void {
        if (!this.panelDocument) return;
        
        // Show/hide instructions panel
        const instructionsPanel = this.panelDocument.getElementById("instructions-panel");
        if (instructionsPanel) {
            instructionsPanel.setProperties({ 
                visible: this.showInstructions 
            });
        }
        
        // Show/hide game stats panel
        const gameStats = this.panelDocument.getElementById("game-stats-panel");
        if (gameStats) {
            gameStats.setProperties({ 
                visible: this.gameRunning 
            });
        }
        
        // Show/hide exit button
        const exitButton = this.panelDocument.getElementById("exit-button");
        if (exitButton) {
            exitButton.setProperties({ 
                visible: this.gameRunning 
            });
        }
    }

    private toggleGame(): void {
        console.log(this.gameRunning ? "⏸️ Pausing game..." : "▶️ Starting game...");
        
        for (const stateEntity of this.queries.gameState.entities) {
            const gameOver = stateEntity.getValue(GameState, "gameOver") || false;
            
            if (gameOver) {
                // Restart the game if it was over
                this.restartGame();
            } else {
                // Toggle play/pause
                const isPlaying = stateEntity.getValue(GameState, "isPlaying") || false;
                stateEntity.setValue(GameState, "isPlaying", !isPlaying);
                
                if (!isPlaying && !this.gameRunning) {
                    this.gameRunning = true;
                    
                    // Activate wave spawner
                    for (const spawnerEntity of this.queries.waveSpawner.entities) {
                        spawnerEntity.setValue(WaveSpawner, "isActive", true);
                    }
                } else if (isPlaying && this.gameRunning) {
                    this.gameRunning = false;
                    
                    // Deactivate wave spawner
                    for (const spawnerEntity of this.queries.waveSpawner.entities) {
                        spawnerEntity.setValue(WaveSpawner, "isActive", false);
                    }
                }
            }
        }
        
        this.updatePanelVisibility();
        this.playStartSound();
    }

    private exitToMenu(): void {
        console.log("🚪 Returning to menu...");
        
        // Pause the game and reset
        for (const stateEntity of this.queries.gameState.entities) {
            stateEntity.setValue(GameState, "isPlaying", false);
        }
        
        // Deactivate wave spawner
        for (const spawnerEntity of this.queries.waveSpawner.entities) {
            spawnerEntity.setValue(WaveSpawner, "isActive", false);
        }
        
        this.gameRunning = false;
        this.updatePanelVisibility();
        this.playClickSound();
    }

    private restartGame(): void {
        console.log("🔄 Restarting game...");
        
        // Reset game state
        for (const stateEntity of this.queries.gameState.entities) {
            stateEntity.setValue(GameState, "isPlaying", true);
            stateEntity.setValue(GameState, "gameOver", false);
            stateEntity.setValue(GameState, "score", 0);
            stateEntity.setValue(GameState, "wave", 1);
            stateEntity.setValue(GameState, "robotsKilled", 0);
            stateEntity.setValue(GameState, "robotsKilledInWave", 0);
        }
        
        // Reset player
        for (const playerEntity of this.queries.player.entities) {
            playerEntity.setValue(Player, "health", 100);
            playerEntity.setValue(Player, "isImmortal", false);
        }
        
        // Reset guns
        if (this.gunEntity) {
            const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 40;
            this.gunEntity.setValue(Gun, "ammo", maxAmmo);
            this.gunEntity.setValue(Gun, "isReloading", false);
            this.gunEntity.setValue(Gun, "heat", 0);
            this.gunEntity.setValue(Gun, "bombCount", 3);
        }
        
        // Reset wave spawner
        for (const spawnerEntity of this.queries.waveSpawner.entities) {
            spawnerEntity.setValue(WaveSpawner, "isActive", true);
            spawnerEntity.setValue(WaveSpawner, "waveNumber", 1);
            spawnerEntity.setValue(WaveSpawner, "robotsSpawned", 0);
            spawnerEntity.setValue(WaveSpawner, "robotsAlive", 0);
        }
        
        this.gameRunning = true;
        this.updatePanelVisibility();
        this.playStartSound();
    }

    private toggleInstructions(): void {
        this.showInstructions = !this.showInstructions;
        this.updatePanelVisibility();
        this.playClickSound();
    }

    private triggerReload(): void {
        if (this.gunEntity) {
            const isReloading = this.gunEntity.getValue(Gun, "isReloading") || false;
            const ammo = this.gunEntity.getValue(Gun, "ammo") || 0;
            const maxAmmo = this.gunEntity.getValue(Gun, "maxAmmo") || 40;
            
            if (!isReloading && ammo < maxAmmo) {
                this.gunEntity.setValue(Gun, "isReloading", true);
                const reloadTime = this.gunEntity.getValue(Gun, "reloadTime") || 1.5;
                
                setTimeout(() => {
                    if (this.gunEntity) {
                        this.gunEntity.setValue(Gun, "ammo", maxAmmo);
                        this.gunEntity.setValue(Gun, "isReloading", false);
                        console.log("Reload complete!");
                        
                        // Play reload sound
                        this.playReloadSound();
                    }
                }, reloadTime * 1000);
                
                console.log("🔄 Reloading...");
            }
        }
    }

    private triggerBomb(): void {
        if (this.gunEntity) {
            const bombCount = this.gunEntity.getValue(Gun, "bombCount") || 0;
            if (bombCount > 0) {
                this.gunEntity.setValue(Gun, "bombCount", bombCount - 1);
                console.log(`💣 Bomb thrown! ${bombCount - 1} remaining`);
                
                // Play bomb sound
                this.playBombSound();
            }
        }
    }

    private getHealthColor(percent: number): string {
        if (percent > 70) return "#10b981"; // Green
        if (percent > 40) return "#f59e0b"; // Yellow
        if (percent > 20) return "#f97316"; // Orange
        return "#ef4444"; // Red
    }

    private getAmmoColor(percent: number): string {
        if (percent > 70) return "#10b981"; // Green
        if (percent > 30) return "#f59e0b"; // Yellow
        return "#ef4444"; // Red
    }

    private playClickSound(): void {
        try {
            // Create a simple click sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.log("Could not play click sound:", error);
        }
    }

    private playStartSound(): void {
        try {
            // Create a game start sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log("Could not play start sound:", error);
        }
    }

    private playReloadSound(): void {
        try {
            // Create a reload sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.2);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log("Could not play reload sound:", error);
        }
    }

    private playBombSound(): void {
        try {
            // Create a bomb sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.log("Could not play bomb sound:", error);
        }
    }
}