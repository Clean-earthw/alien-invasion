import { createSystem, Types } from "@iwsdk/core";

interface VROptimizationSystemQueries {
    all: {
        required: [];
    };
}

interface VROptimizationSystemConfig {
    vrScaleFactor: number;
    performanceMode: boolean;
}

export class VROptimizationSystem extends createSystem<VROptimizationSystemQueries, VROptimizationSystemConfig>({
    all: { required: [] }
}, {
    vrScaleFactor: { type: Types.Float32, default: 1.5 },
    performanceMode: { type: Types.Boolean, default: false }
}) {
    private lastPerformanceCheck = 0;
    private frameTimes: number[] = [];
    
    init(): void {
        console.log("🎮 VR Optimization System initialized");
        
        this.detectVREnvironment();
        this.setupPerformanceMonitoring();
        this.createVRComfortGuide();
    }
    
    update(dt: number, time: number): void {
        // Performance check every 5 seconds
        if (time - this.lastPerformanceCheck > 5.0) {
            this.checkPerformance();
            this.lastPerformanceCheck = time;
        }
        
        this.adaptiveRendering();
    }
    
    private detectVREnvironment(): void {
        const isVR = navigator.xr && navigator.xr.isSessionSupported('immersive-vr');
        
        if (isVR) {
            console.log("🎯 VR Headset detected - Applying optimizations");
            this.config.vrScaleFactor.set(1.8);
        } else {
            console.log("🖥️ Desktop mode detected");
            this.config.vrScaleFactor.set(1.0);
        }
    }
    
    private createVRComfortGuide(): void {
        if (!navigator.xr) return;
        
        const guide = document.createElement('div');
        guide.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            font-family: Arial, sans-serif;
            text-align: center;
            z-index: 9999;
            border: 2px solid #00ffff;
            max-width: 500px;
        `;
        
        guide.innerHTML = `
            <h2 style="color: #00ffff; margin-bottom: 20px;">🎮 VR COMFORT GUIDE</h2>
            <div style="text-align: left; margin-bottom: 20px;">
                <p>🔹 <strong>Teleportation:</strong> Use the controller to move around</p>
                <p>🔹 <strong>Comfort Mode:</strong> Enable snap turning if needed</p>
                <p>🔹 <strong>Play Area:</strong> Ensure you have 2m x 2m clear space</p>
                <p>🔹 <strong>Take Breaks:</strong> Rest every 30 minutes</p>
            </div>
            <button id="vr-guide-ok" style="
                background: #00ffff;
                color: black;
                border: none;
                padding: 12px 30px;
                border-radius: 8px;
                font-weight: bold;
                cursor: pointer;
                font-size: 16px;
            ">START GAME</button>
        `;
        
        document.body.appendChild(guide);
        
        document.getElementById('vr-guide-ok')?.addEventListener('click', () => {
            guide.style.opacity = '0';
            guide.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (guide.parentNode) {
                    guide.parentNode.removeChild(guide);
                }
            }, 500);
        });
    }
    
    private setupPerformanceMonitoring(): void {
        this.frameTimes = [];
    }
    
    private checkPerformance(): void {
        if (this.frameTimes.length < 10) return;
        
        const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        const fps = 1000 / avgFrameTime;
        
        console.log(`📊 Performance: ${fps.toFixed(1)} FPS`);
        
        if (fps < 72 && !this.config.performanceMode.peek()) {
            console.log("⚠️ Enabling performance mode");
            this.config.performanceMode.set(true);
        } else if (fps > 90 && this.config.performanceMode.peek()) {
            console.log("✅ Disabling performance mode");
            this.config.performanceMode.set(false);
        }
        
        if (this.frameTimes.length > 60) {
            this.frameTimes = this.frameTimes.slice(-60);
        }
    }
    
    private adaptiveRendering(): void {
        this.frameTimes.push(performance.now());
    }
}