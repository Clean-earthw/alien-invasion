import { createSystem, Mesh, BoxGeometry, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Vector3 } from "@iwsdk/core";
import { WaveSpawner, Robot, GameState } from "../components.js";

export class WaveSystem extends createSystem({
  waveSpawner: {
    required: [WaveSpawner]
  },
  activeRobots: {
    required: [Robot],
  },
  gameState: {
    required: [GameState]
  }
}) {
  private robotCounter = 0;
  private initialized = false;

  init() {
    console.log("🌊 WaveSystem initialized - Robots outside spacestation");
    this.initialized = true;
    
    // Immediately spawn 3 static robots OUTSIDE the spacestation
    setTimeout(() => {
      this.spawnOutsideRobots();
    }, 1000);
  }

  update(dt: number, time: number) {
    if (!this.initialized) return;
    
    const spawnerEntities = this.queries.waveSpawner.entities;
    if (spawnerEntities.size === 0) return;

    const spawner = Array.from(spawnerEntities)[0];
    const waveNumber = spawner.getValue(WaveSpawner, "waveNumber") || 1;
    const robotsToSpawn = spawner.getValue(WaveSpawner, "robotsToSpawn") || 3;
    const robotsSpawned = spawner.getValue(WaveSpawner, "robotsSpawned") || 0;

    // Check if wave is complete (all robots dead)
    let activeRobotCount = 0;
    for (const robot of this.queries.activeRobots.entities) {
      const isDead = robot.getValue(Robot, "isDead");
      if (!isDead) activeRobotCount++;
    }
    
    if (robotsSpawned >= robotsToSpawn && activeRobotCount === 0 && waveNumber === 1) {
      console.log("🎉 All robots eliminated! Spacestation is safe!");
      spawner.setValue(WaveSpawner, "isActive", false);
      
      // Update game state
      const gameStateEntities = this.queries.gameState.entities;
      if (gameStateEntities.size > 0) {
        const gameState = Array.from(gameStateEntities)[0];
        gameState.setValue(GameState, "isGameOver", true);
        console.log("🏆 MISSION ACCOMPLISHED!");
      }
    }
  }

  private spawnOutsideRobots() {
    console.log("🤖 Spawning 3 static robots OUTSIDE the spacestation...");
    
    // Robot positions OUTSIDE the spacestation (in front of it)
    // Spacestation is at z = -8, facing forward
    const outsidePositions = [
      new Vector3(-3.0, 0.5, -5),   // Left side outside
      new Vector3(0, 0.5, -4),      // Center outside (closest)
      new Vector3(3.0, 0.5, -5),    // Right side outside
    ];
    
    for (let i = 0; i < 3; i++) {
      this.createOutsideRobot(outsidePositions[i], i + 1);
    }
    
    // Update spawner state
    const spawnerEntities = this.queries.waveSpawner.entities;
    if (spawnerEntities.size > 0) {
      const spawner = Array.from(spawnerEntities)[0];
      spawner.setValue(WaveSpawner, "robotsSpawned", 3);
      spawner.setValue(WaveSpawner, "isActive", true);
    }
  }

  private createOutsideRobot(position: Vector3, id: number) {
    // Create space drone robot (floating outside spacestation)
    const robotGroup = new Mesh();
    
    // Main body (spherical drone)
    const bodyGeometry = new SphereGeometry(0.6, 16, 16);
    const bodyMaterial = new MeshStandardMaterial({ 
      color: 0xaa3333,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0x440000,
      emissiveIntensity: 0.4
    });
    const body = new Mesh(bodyGeometry, bodyMaterial);
    robotGroup.add(body);
    
    // Central sensor eye
    const eyeGeometry = new SphereGeometry(0.2, 12, 12);
    const eyeMaterial = new MeshStandardMaterial({ 
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.95
    });
    const eye = new Mesh(eyeGeometry, eyeMaterial);
    eye.position.z = 0.5;
    robotGroup.add(eye);
    
    // Thruster pods (4 around the sphere)
    const thrusterGeometry = new CylinderGeometry(0.1, 0.15, 0.3, 8);
    const thrusterMaterial = new MeshStandardMaterial({ 
      color: 0x444444,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x333333,
      emissiveIntensity: 0.2
    });
    
    // Top thruster
    const topThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    topThruster.rotation.x = Math.PI / 2;
    topThruster.position.y = 0.8;
    robotGroup.add(topThruster);
    
    // Bottom thruster
    const bottomThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    bottomThruster.rotation.x = Math.PI / 2;
    bottomThruster.position.y = -0.8;
    robotGroup.add(bottomThruster);
    
    // Left thruster
    const leftThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    leftThruster.rotation.z = Math.PI / 2;
    leftThruster.position.x = -0.8;
    robotGroup.add(leftThruster);
    
    // Right thruster
    const rightThruster = new Mesh(thrusterGeometry, thrusterMaterial);
    rightThruster.rotation.z = Math.PI / 2;
    rightThruster.position.x = 0.8;
    robotGroup.add(rightThruster);
    
    // Antenna/sensor array
    const antennaGeometry = new CylinderGeometry(0.03, 0.03, 0.6, 6);
    const antennaMaterial = new MeshStandardMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 0.7
    });
    
    const antenna = new Mesh(antennaGeometry, antennaMaterial);
    antenna.position.y = 1.0;
    robotGroup.add(antenna);
    
    // Glowing tip
    const tipGeometry = new SphereGeometry(0.08, 6, 6);
    const tipMaterial = new MeshStandardMaterial({ 
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8
    });
    const tip = new Mesh(tipGeometry, tipMaterial);
    tip.position.y = 1.3;
    robotGroup.add(tip);
    
    // Position robot OUTSIDE spacestation
    robotGroup.position.copy(position);
    
    // Slight floating animation setup
    robotGroup.userData = {
      floatHeight: position.y,
      floatSpeed: 0.5 + Math.random() * 0.3,
      rotationSpeed: 0.002 + Math.random() * 0.001,
      timeOffset: Math.random() * Math.PI * 2
    };
    
    // Scale
    robotGroup.scale.setScalar(0.9);
    
    this.robotCounter++;
    
    // Create robot entity with ZERO SPEED (static/floating)
    this.world
      .createTransformEntity(robotGroup)
      .addComponent(Robot, {
        id: id,
        speed: 0.0, // ZERO SPEED = floating in space
        health: 75.0, // More health for space drones
        maxHealth: 75.0,
        attackDamage: 18.0, // Stronger attacks
        attackRange: 15.0, // Can attack from space distance
        attackCooldown: 3.5, // Moderate attack speed
        lastAttackTime: 0.0,
        isDead: false,
      });
    
    console.log(`🚀 Space Drone #${id} spawned OUTSIDE spacestation at position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)})`);
  }
}