console.log("game.js loaded");

// Get the canvas element
const canvas = document.getElementById('gameCanvas');

// Create a scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Create a renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// Remove the test cube
// const geometry = new THREE.BoxGeometry();
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

// Add lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Create sky
const skyGeometry = new THREE.SphereGeometry(500, 32, 32); // Large sphere
const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x87ceeb, side: THREE.BackSide }); // Sky blue, render inside
const sky = new THREE.Mesh(skyGeometry, skyMaterial);
scene.add(sky);

import { Water } from './Water.js'; // Import the Water class

// --- Game Configuration & Data ---
// Moved fishSpeciesData, playerInventory, activeFishPopulation, game time vars,
// currentBaitType, fishing state flags, reeling mechanics vars, drag system vars
// to gameLogic.js

import * as GameLogic from './gameLogic.js';
import { PlayerInventory } from './PlayerInventory.js'; // Still needed by gameLogic.js, will be imported there.

// This instance will be managed by gameLogic.js now. game.js will call GameLogic.playerInventory
// const playerInventory = new PlayerInventory(50);


// --- Game Time Simulation ---
const clock = new THREE.Clock(); // Three.js clock for delta time
let timeDisplayElement; // DOM element for time

document.addEventListener('DOMContentLoaded', () => {
    timeDisplayElement = document.getElementById('timeDisplay');
    updateTimeDisplay(); // Initial display
});

function updateTimeDisplay() {
    if (timeDisplayElement) {
        const hoursStr = String(Math.floor(GameLogic.gameTimeHours)).padStart(2, '0');
        const minutesStr = String(Math.floor(GameLogic.gameTimeMinutes)).padStart(2, '0');
        timeDisplayElement.textContent = `Time: ${hoursStr}:${minutesStr}`;
    }
}

// gameLogic.js now holds most state variables. We access them via GameLogic.variableName
// e.g. GameLogic.isCasting, GameLogic.lineTension, etc.

// Three.js specific objects remain here
let bobber, fishingLine; // These are THREE.Mesh/Line objects

// Helper functions like isFishActive, getBaitPreferenceScore are in GameLogic
// spawnFishPopulation is GameLogic.spawnFishPopulation()
// updateGameTime logic is GameLogic.updateGameTimeData(), visual update is separate in updateTimeDisplay()
// resetFishingState logic is GameLogic.resetFishingStateLogic(), visual/timer resets are handled in reelIn() or here


// Create water surface using the Water class from Three.js examples
const waterGeometry = new THREE.PlaneGeometry(1000, 1000);
const water = new Water(
    waterGeometry,
    {
        textureWidth: 512,
        textureHeight: 512,
        waterNormals: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/waternormals.jpg', function (texture) {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        }),
        sunDirection: new THREE.Vector3(), // Will be updated by light
        sunColor: 0xffffff,
        waterColor: 0x001e0f, // Darker, more realistic water color
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    }
);
water.rotation.x = -Math.PI / 2; // Rotate to be horizontal
water.position.y = -0.5; // Position it slightly below origin
scene.add(water);

// Update sun direction for water shader based on directional light
if (directionalLight) {
    water.material.uniforms['sunDirection'].value.copy(directionalLight.position).normalize();
}


// Adjust camera position for a better view of the environment
// camera.position.set(0, 2, 10); // Camera will be at origin for FPS view
// camera.lookAt(0, 0, 0); // Will be controlled by mouse later

// Set camera to a typical first-person starting position (origin, looking forward)
camera.position.set(0, 1.6, 0); // Player height at 1.6 units, standing at origin for now

// Create the fishing rod (segmented)
const fishingRod = new THREE.Group();
const rodMaterial = new THREE.MeshPhongMaterial({ color: 0x654321 }); // Brown color

const rodBaseLength = 1.0;
const rodMidLength = 0.8;
const rodTipLength = 0.7;

const rodBaseGeometry = new THREE.CylinderGeometry(0.04, 0.05, rodBaseLength, 8);
const rodBase = new THREE.Mesh(rodBaseGeometry, rodMaterial);
rodBase.position.y = rodBaseLength / 2; // Position base at its center

const rodMidGeometry = new THREE.CylinderGeometry(0.03, 0.04, rodMidLength, 8);
const rodMid = new THREE.Mesh(rodMidGeometry, rodMaterial);
rodMid.position.y = rodMidLength / 2; // Position relative to its parent's top

const rodTipSegmentGeometry = new THREE.CylinderGeometry(0.02, 0.03, rodTipLength, 8);
const rodTipSegment = new THREE.Mesh(rodTipSegmentGeometry, rodMaterial);
rodTipSegment.position.y = rodTipLength / 2; // Position relative to its parent's top

// Assemble the rod
rodMid.add(rodTipSegment); // Tip is child of Mid
rodBase.add(rodMid);      // Mid is child of Base
fishingRod.add(rodBase);   // Base is child of the main Group

// Adjust local positions for segments to connect end-to-end
// Base is already centered in the fishingRod group.
// Mid segment's origin should be at the top of the base segment.
rodMid.position.y = rodBaseLength / 2 + rodMidLength / 2;
// Tip segment's origin should be at the top of the mid segment.
rodTipSegment.position.y = rodMidLength / 2 + rodTipLength / 2;


// Position the entire rod group relative to the camera
fishingRod.position.set(0.5, -0.4 - rodBaseLength/2, -1); // Adjusted Y to account for base centered at group origin
fishingRod.rotation.set(0, -0.2, Math.PI / 5); // Angled slightly

// Add rod to the camera so it moves with it
camera.add(fishingRod); // Make rod a child of the camera
scene.add(camera); // Ensure camera (now with rod) is part of the scene

// Store segments for easy access during animation
const rodSegments = {
    base: rodBase,
    mid: rodMid,
    tip: rodTipSegment
};

// --- Casting Mechanics ---
// State variables (isCasting, isCast, castStartTime etc.) are now in GameLogic
const castDistance = 20; // How far the bobber will be cast
const castSpeed = 0.5; // Speed of the bobber during casting


// --- Fishing States ---
// State variables (waitingForBite, fishBiting, fishHooked, fishToHook) are in GameLogic

// Browser-side timer IDs
let hookWindowTimeoutID = null;
let fishPullTimerID = null;
let escapeTimerID = null;

// --- Reeling Mechanics ---
// State variables (isReeling, lineTension, fishPulling, fishPullDuration, fishInitialDistance, fishCurrentDistance) are in GameLogic
// Constants (currentLineBreakingPoint, lineStretchFactor, tensionIncreaseRate, etc.) are in GameLogic


// Bobber
const bobberGeometry = new THREE.SphereGeometry(0.1, 8, 8);
const bobberMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 }); // Red bobber

// Fishing Line
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, linewidth: 2 }); // Attempt to set linewidth > 1
const linePoints = [new THREE.Vector3(), new THREE.Vector3()];
const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);

// Note: WebGL line width limitations often mean linewidth > 1 has no effect.
// For thicker lines, THREE.MeshLine or a thin TubeGeometry would be needed.

function getRodTipPosition() {
    // The tip of the rod is the top of the rodTipSegment
    // rodTipSegment's position is relative to rodMid
    // rodMid's position is relative to rodBase
    // fishingRod (group) is relative to camera
    const rodTipLocal = new THREE.Vector3(0, rodTipLength / 2, 0); // Local top of the tip segment
    return rodTipSegment.localToWorld(rodTipLocal.clone()); // Convert local tip segment top to world space
}

function castLine() {
    if (GameLogic.isCasting || GameLogic.isCast) return;

    GameLogic.setCastingState(true, clock.elapsedTime); // Use game clock time
    // Visuals:
    if (!bobber) { // Create bobber if it doesn't exist
        bobber = new THREE.Mesh(bobberGeometry, bobberMaterial);
    }
    bobber.position.copy(getRodTipPosition());
    scene.add(bobber);

    // Create fishing line if it doesn't exist
    if (!fishingLine) {
        fishingLine = new THREE.Line(lineGeometry, lineMaterial);
    }
    scene.add(fishingLine);

    // Initial line update
    updateFishingLine(); // This will now call the comprehensive version
}

// Removed the old simple updateFishingLine function.
// The function formerly known as updateFishingLineVisuals is now the main updateFishingLine.

function updateFishingLine() { // Renamed from updateFishingLineVisuals
    if (!fishingLine) return;

    const rodTipPosition = getRodTipPosition();
    const bobberPosition = bobber.position; // Bobber position is managed by game.js

    // Access state from GameLogic
    const currentLineTension = GameLogic.lineTension;
    const lineBreakingPoint = GameLogic.currentLineBreakingPoint;
    const lineIsCastState = GameLogic.isCast;

    const maxSag = 0.75;
    const tensionRatio = Math.min(currentLineTension / (lineBreakingPoint * 0.25), 1.0);
    const currentSag = maxSag * (1 - tensionRatio);

    let points;
    if (currentSag > 0.01 && lineIsCastState) { // Use lineIsCastState from GameLogic
        const midPoint = new THREE.Vector3().addVectors(rodTipPosition, bobberPosition).multiplyScalar(0.5);
        midPoint.y -= currentSag;

        const curve = new THREE.QuadraticBezierCurve3(rodTipPosition, midPoint, bobberPosition);
        points = curve.getPoints(10);
    } else {
        points = [rodTipPosition, bobberPosition];
    }

    fishingLine.geometry.setFromPoints(points);
    fishingLine.geometry.attributes.position.needsUpdate = true;
    fishingLine.geometry.computeBoundingSphere();
}


function reelIn() { // This function now primarily handles visual cleanup and calls logic reset
    if (GameLogic.isCast || GameLogic.fishBiting || GameLogic.fishHooked) {
        scene.remove(bobber); // Visual
        scene.remove(fishingLine); // Visual

        // Clear browser-specific timers
        clearTimeout(hookWindowTimeoutID);
        hookWindowTimeoutID = null;
        clearTimeout(fishPullTimerID);
        fishPullTimerID = null;
        clearTimeout(escapeTimerID);
        escapeTimerID = null;

        GameLogic.resetFishingStateLogic(); // Reset all logical states

        if (bobber) bobber.position.y = water.position.y + 0.05;
        console.log("Line reeled in (visuals cleared, logic reset).");
    }
}

// isFishActive, getBaitPreferenceScore, checkForFishBite, triggerBite, attemptHookFish,
// startFishPullCycle, resetFishingState have been moved to gameLogic.js and will be adapted.

// This will become the visual part of triggerBite
function triggerBiteVisuals(fishThatBit) {
    console.log(`Visuals: ${fishThatBit.species.name} is biting! Size: ${fishThatBit.size}kg`);
    bobber.position.y = water.position.y - 0.1; // Dip bobber

    // Player has a window to hook the fish - timer managed by game.js
    clearTimeout(hookWindowTimeoutID); // Clear previous if any
    hookWindowTimeoutID = setTimeout(() => {
        if (GameLogic.fishBiting) { // Check logical state
            console.log(`${GameLogic.fishToHook.species.name} got away (visual timeout)!`);
            GameLogic.fishGotAwayLogic(); // Call the consolidated logic function
            bobber.position.y = water.position.y + 0.05; // Bobber returns to normal
            GameLogic.lastFishCheckTime = clock.elapsedTime; // Update check time for next bite check cycle
        }
    }, GameLogic.hookWindowDuration);
}

// This will become the visual/timer part of attemptHookFish
function attemptHookFishActions() { // Called after GameLogic.attemptHookFishLogic succeeds
    clearTimeout(hookWindowTimeoutID);
    hookWindowTimeoutID = null;

    // fishInitialDistance and fishCurrentDistance are now set inside GameLogic.attemptHookFishLogic
    // lineTension is reset there too.

    startFishPullCycleTimers(); // Manages timers for fish pulling behavior
    startEscapeTimerVisual();   // Manages the escape timer
}

function startEscapeTimerVisual() {
    clearTimeout(escapeTimerID);
    escapeTimerID = setTimeout(() => {
        if (GameLogic.fishHooked) {
            console.log("Fish escaped (visual timeout - took too long)!");
            reelIn(); // Resets everything
        }
    }, GameLogic.fishEscapeTime);
}

function startFishPullCycleTimers() { // Manages the browser timer part
    if (!GameLogic.fishHooked || !GameLogic.fishToHook) return;

    const pullCycleData = GameLogic.getFishPullCycleTiming();
    if (!pullCycleData) return; // fishToHook might have become null

    clearTimeout(fishPullTimerID); // Clear previous timer before setting a new one
    fishPullTimerID = setTimeout(() => {
        if (!GameLogic.fishHooked || !GameLogic.fishToHook) return;

        GameLogic.fishPulling = true;
        // GameLogic.fishPullDuration is set within getFishPullCycleTiming

        console.log(`${GameLogic.fishToHook.species.name} is pulling! (Visual timer start, duration: ${GameLogic.fishPullDuration.toFixed(0)}ms)`);

        // Inner timeout for pull duration
        // This inner timeout doesn't need its own ID to be stored if it's not meant to be cleared independently.
        setTimeout(() => {
            if (!GameLogic.fishHooked) return; // Check if still hooked before resetting pull state
            GameLogic.fishPulling = false;
            console.log(`${GameLogic.fishToHook.species.name} stopped pulling (Visual timer end).`);
            if (GameLogic.fishHooked) { // Only schedule next pull if still fighting
                startFishPullCycleTimers();
            }
        }, GameLogic.fishPullDuration); // Use the duration calculated in gameLogic

    }, pullCycleData.timeToNextPull);
}


// reelInAction is browser-side, calls reelIn (which calls GameLogic.resetFishingStateLogic via reelIn)
function reelInAction() {
    console.log("ReelInAction called");
    reelIn(); // reelIn now handles both logic and visual reset
}


// Event listener for mouse actions
window.addEventListener('mousedown', () => {
    if (GameLogic.fishHooked) { // Check logical state
        GameLogic.setIsReelingState(true); // Set logical state
        console.log("Mouse down - Reeling started");
    }
});

window.addEventListener('mouseup', () => {
    if (GameLogic.isReeling) { // Check logical state
        GameLogic.setIsReelingState(false); // Set logical state
        console.log("Mouse up - Reeling stopped");
    }
});

window.addEventListener('click', () => {
    if (GameLogic.fishBiting) {
        const hookResult = GameLogic.attemptHookFishLogic();
        if (hookResult.success) {
            // Update visual elements based on hooking, e.g., initial bobber distance
            GameLogic.fishInitialDistance = bobber.position.distanceTo(getRodTipPosition());
            GameLogic.setFishCurrentDistance(GameLogic.fishInitialDistance); // Sync logic with visual start
            attemptHookFishActions(); // This handles browser-side timers
        }
    } else if (!GameLogic.isCast && !GameLogic.isCasting && !GameLogic.fishHooked && !GameLogic.isReeling) {
        castLine();
    } else if ((GameLogic.isCast && !GameLogic.fishBiting && !GameLogic.fishHooked) || (GameLogic.fishHooked && !GameLogic.isReeling)) {
        reelInAction();
    }
});


// Animation loop
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta(); // Get deltaTime once per frame

    // Update Game Time Logic & Display
    const timeResult = GameLogic.updateGameTimeData(deltaTime); // Call logic
    // GameLogic.gameTimeHours and GameLogic.gameTimeMinutes are updated internally by updateGameTimeData
    updateTimeDisplay(); // Update DOM with new values from GameLogic
    if (timeResult.newDay) {
        console.log("A new day has started in-game (visuals).");
        GameLogic.spawnFishPopulation(); // Respawn fish
    }

    // Casting Animation (Visuals driven by GameLogic state)
    if (GameLogic.isCasting) {
        const elapsedTime = clock.elapsedTime - GameLogic.castStartTime;
        const progress = Math.min(elapsedTime * castSpeed * (20 / castDistance), 1);

        // Target position calculation (simplified: straight forward from camera)
        const castDirection = new THREE.Vector3();
        camera.getWorldDirection(castDirection); // Get direction camera is facing
        castDirection.y = 0; // Keep it level for now, or slightly arcing
        castDirection.normalize();

        const startPosition = getRodTipPosition();
        const targetBobberPosition = new THREE.Vector3()
            .copy(startPosition)
            .add(castDirection.multiplyScalar(castDistance));

        // Simple arc: Add some height based on progress (parabolic)
        const arcHeight = 4 * 2 * progress * (1 - progress); // Max height of 2 units at mid-cast
        targetBobberPosition.y = water.position.y + 0.05; // Aim for water surface + bobber radius

        // Lerp bobber position
        bobber.position.lerpVectors(startPosition, targetBobberPosition, progress);
        bobber.position.y += arcHeight;


        if (progress >= 1) {
            GameLogic.setCastingState(false); // isCasting = false
            GameLogic.setCastState(true);     // isCast = true
            bobber.position.y = water.position.y + 0.05; // Ensure it lands on water surface
            console.log("Cast complete. Bobber at water level.");
            GameLogic.waitingForBite = false;
            GameLogic.lastFishCheckTime = clock.elapsedTime;
        }
    }

    // Fish Bite Check (uses logic from GameLogic)
    if (GameLogic.isCast && !GameLogic.isCasting && !GameLogic.fishBiting && !GameLogic.fishHooked) {
        if (clock.elapsedTime - GameLogic.lastFishCheckTime > GameLogic.fishCheckInterval / 1000.0) {
            GameLogic.waitingForBite = false; // Allow check in gameLogic
            const potentialBiter = GameLogic.checkForFishBiteLogic(GameLogic.gameTimeHours, GameLogic.currentBaitType);
            if (potentialBiter) {
                if (GameLogic.triggerBiteLogic(potentialBiter)) {
                    triggerBiteVisuals(potentialBiter); // Handle visuals and browser timer
                }
            }
            GameLogic.lastFishCheckTime = clock.elapsedTime; // Update check time regardless of bite
        }
    }

    // Line visuals update
    if (GameLogic.isCast || GameLogic.isCasting || GameLogic.fishBiting || GameLogic.fishHooked) {
        updateFishingLine(); // Renamed from updateFishingLineVisuals
    }

    // Reeling Mechanics & Fish Fighting (visuals driven by GameLogic state and physics results)
    if (GameLogic.fishHooked && GameLogic.fishToHook) {
        const currentBobberDist = getRodTipPosition().distanceTo(bobber.position); // Pass current visual distance
        const physicsResult = GameLogic.calculateReelingPhysics(
            deltaTime,
            GameLogic.isReeling,
            currentBobberDist, // Pass current visual distance
            GameLogic.fishPulling // Pass current pulling state
        );

        // Update bobber position based on line taken or reeled in
        if (physicsResult.lineTakenAmount > 0) {
            const directionAwayFromRod = new THREE.Vector3().subVectors(bobber.position, getRodTipPosition()).normalize();
            bobber.position.add(directionAwayFromRod.multiplyScalar(physicsResult.lineTakenAmount));
        } else if (physicsResult.newFishDistance < currentBobberDist) { // Fish was reeled in
             const rodTipPos = getRodTipPosition();
             const directionToRod = new THREE.Vector3().subVectors(rodTipPos, bobber.position).normalize();
             const distanceToMove = Math.min(currentBobberDist - physicsResult.newFishDistance, currentBobberDist - 0.1);
             if (distanceToMove > 0) {
                 bobber.position.add(directionToRod.multiplyScalar(distanceToMove));
             }
        }
        // Update GameLogic's distance if it didn't get it from calculateReelingPhysics directly
        // GameLogic.fishCurrentDistance = physicsResult.newFishDistance; // Already updated inside calculateReelingPhysics

        // Visuals for fish pulling (bobber dipping)
        if (GameLogic.fishPulling) {
            let dipAmount = 0.15 + Math.random() * 0.1;
            if(GameLogic.fishToHook.species.baseFightStyle === "jerky") dipAmount += Math.random() * 0.1;
            if(GameLogic.fishToHook.species.baseFightStyle === "strong_runs") dipAmount += 0.05;
            bobber.position.y = water.position.y - dipAmount;
        } else if (!GameLogic.fishBiting) { // if not the initial bite phase
            bobber.position.y = water.position.y - 0.05;
        }

        if (physicsResult.fishSnapped) {
            console.log("Line snapped! (Visuals)");
            reelIn(); // Handles visual reset and calls logic reset
        } else if (physicsResult.fishCaught) {
            console.log(`Fish caught! ${GameLogic.fishToHook.species.name} - ${GameLogic.fishToHook.size}kg (Visuals)`);
            const caughtFish = {
                speciesName: GameLogic.fishToHook.species.name,
                size: GameLogic.fishToHook.size,
            };
            GameLogic.playerInventory.addFish(caughtFish); // Logic add
            console.log(`Current inventory: ${GameLogic.playerInventory.getFishStock().length} fish, Gold: ${GameLogic.playerInventory.getGoldBalance()}`);
            reelIn(); // Handles visual reset and calls logic reset
        }

        // Rod Bending Visuals
        const bendFactor = Math.min(GameLogic.lineTension / (GameLogic.currentLineBreakingPoint * 0.8), 1);
        const maxBendBase = 0.05;
        const maxBendMid = Math.PI / 16;
        const maxBendTip = Math.PI / 8;

        rodSegments.base.rotation.x = -maxBendBase * bendFactor;
        rodSegments.mid.rotation.x = -maxBendMid * bendFactor;
        rodSegments.tip.rotation.x = -maxBendTip * bendFactor;
    } else {
        // No tension, straighten the rod (visual)
        rodSegments.base.rotation.x = 0;
        rodSegments.mid.rotation.x = 0;
        rodSegments.tip.rotation.x = 0;
    }

    // Animate water
    // water.material.userData.time += 0.01; // Example for shader if we add one
    // water.geometry.vertices.forEach(v => { ... }); // Very basic vertex manipulation (performance heavy)

    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

    // Animate water
    if (water && water.material.uniforms['time']) {
        water.material.uniforms['time'].value += 1.0 / 60.0;
    }

    renderer.render(scene, camera);
}

GameLogic.spawnFishPopulation(); // Create initial fish population using GameLogic

// Start the animation loop
animate();

// --- Shop Interaction ---
window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 's' && !GameLogic.isCasting && !GameLogic.fishBiting && !GameLogic.fishHooked && !GameLogic.isReeling) {
        openShopSellInterface();
    }
});

function openShopSellInterface() {
    console.log("--- Welcome to the Fish Market! ---");
    const sellableFish = GameLogic.playerInventory.getFishStock();

    if (sellableFish.length === 0) {
        console.log("Your inventory is empty. Go catch some fish!");
        alert("Your inventory is empty. Go catch some fish!");
        return;
    }

    let message = "Fish you can sell:\n";
    const fishWithPrices = sellableFish.map((fish, index) => {
        const price = GameLogic.getFishSellPrice(fish);
        return { ...fish, price: price, displayIndex: index + 1 };
    });

    fishWithPrices.forEach(fish => {
        message += `${fish.displayIndex}: ${fish.speciesName} (${fish.size}kg) - ${fish.price} gold\n`;
    });
    message += "\nEnter the number of the fish to sell, 'all' to sell everything, or 'cancel'.";

    console.log(message); // Log to console for easier viewing if prompt is small
    const playerChoice = window.prompt(message, "");

    // Selling logic will be handled in the next step based on playerChoice
    if (playerChoice) {
        processSellInput(playerChoice, fishWithPrices);
    } else {
        console.log("Shop interaction cancelled.");
    }
}

// Placeholder for now, will be implemented in the next step
function processSellInput(input, fishListWithPrices) {
    console.log(`Player chose to sell: ${input}. Detailed processing to be implemented.`);
    // This function will handle selling individual fish, all fish, or cancelling.
}


// --- Mouse Look Controls ---
let isPointerLocked = false;

canvas.addEventListener('click', async () => {
    if (!document.pointerLockElement) {
        try {
            await canvas.requestPointerLock({
                unadjustedMovement: true, // Use raw mouse movement if available
            });
        } catch (err) {
            console.error("Pointer lock request failed:", err);
        }
    }
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === canvas) {
        console.log('Pointer locked');
        isPointerLocked = true;
        document.addEventListener("mousemove", handleMouseMove, false);
    } else {
        console.log('Pointer unlocked');
        isPointerLocked = false;
        document.removeEventListener("mousemove", handleMouseMove, false);
    }
});

document.addEventListener('pointerlockerror', (err) => {
    console.error('Pointer lock error:', err);
});

const _euler = new THREE.Euler(0, 0, 0, 'YXZ'); // YXZ order is important for FPS controls
const _PI_2 = Math.PI / 2;

function handleMouseMove(event) {
    if (!isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    _euler.setFromQuaternion(camera.quaternion);

    _euler.y -= movementX * 0.002; // Yaw
    _euler.x -= movementY * 0.002; // Pitch

    _euler.x = Math.max(-_PI_2, Math.min(_PI_2, _euler.x)); // Clamp pitch

    camera.quaternion.setFromEuler(_euler);
}
