// systems/score-ui-system.ts
import {
    createSystem,
    PanelUI,
    PanelDocument,
    Interactable,
    UIKitDocument,
    UIKit,
    Vector3,
    ScreenSpace
} from "@iwsdk/core";

export class ScoreUISystem extends createSystem({}) {
    private scorePanel: any = null;
    private wavePanel: any = null;
    private currentScore = 0;
    private currentWave = 1;
    private currentKills = 0;
    private currentHealth = 100;

    init() {
        console.log("✨ Score UI System Initialized");
        //this.spawnGameUI();
    }

    spawnGameUI() {
        // Create main game UI panel (top-right corner)
        const entity = this.world.createTransformEntity();
        
        // Use ScreenSpace to position in top-right corner
        entity.addComponent(PanelUI, {
            config: "./ui/score-panel.json",
            maxWidth: 0.35,
            maxHeight: 0.45,
        });
        
        entity.addComponent(Interactable);
        entity.addComponent(ScreenSpace, {
            top: "20px",
            right: "20px",
            width: "320px",
            height: "380px"
        });

        this.scorePanel = entity;
        this.pollForDocument(entity, 0);
    }

    updateScore(score: number, kills: number, health: number) {
        this.currentScore = score;
        this.currentKills = kills;
        this.currentHealth = health;
        this.updateDisplay();
    }

    updateWave(wave: number, robotsAlive: number, robotsTotal: number) {
        this.currentWave = wave;
        this.updateWaveInfo(robotsAlive, robotsTotal);
    }

    updateDisplay() {
        if (!this.scorePanel) return;
        
        const doc = PanelDocument.data.document[this.scorePanel.index] as UIKitDocument;
        if (!doc) return;
        
        const scoreEl = doc.getElementById('score-value') as UIKit.Text;
        const killsEl = doc.getElementById('kills-value') as UIKit.Text;
        const healthEl = doc.getElementById('health-value') as UIKit.Text;
        const healthBar = doc.getElementById('health-bar') as UIKit.Component;
        
        if (scoreEl) scoreEl.setProperties({ text: this.currentScore.toString() });
        if (killsEl) killsEl.setProperties({ text: this.currentKills.toString() });
        
        const healthPercent = Math.max(0, Math.min(100, this.currentHealth));
        if (healthEl) healthEl.setProperties({ text: `${Math.round(healthPercent)}%` });
        
        if (healthBar) {
            // Update color based on health
            let color = '#00ff00';
            if (healthPercent < 30) color = '#ff0000';
            else if (healthPercent < 60) color = '#ff9900';
            
            healthBar.setProperties({ 
                width: healthPercent,
                backgroundColor: color
            });
        }
    }

    updateWaveInfo(robotsAlive: number, robotsTotal: number) {
        if (!this.scorePanel) return;
        
        const doc = PanelDocument.data.document[this.scorePanel.index] as UIKitDocument;
        if (!doc) return;
        
        // You can add wave info to your UI panel
        // For example, update a subtitle or add wave info
        const waveEl = doc.getElementById('wave-info') as UIKit.Text;
        if (waveEl) {
            const progress = Math.round(((robotsTotal - robotsAlive) / robotsTotal) * 100);
            waveEl.setProperties({ 
                text: `WAVE ${this.currentWave} - ${progress}% COMPLETE`
            });
        }
    }

    pollForDocument(entity: any, attempts: number) {
        if (attempts > 100) return;
        const doc = PanelDocument.data.document[entity.index] as UIKitDocument;
        if (doc && doc.getElementById('score-value')) {
            this.updateDisplay();
        } else {
            setTimeout(() => this.pollForDocument(entity, attempts + 1), 50);
        }
    }

    update(delta: number) {
        // No need to follow camera - ScreenSpace handles positioning
    }
}