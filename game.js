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

const fishSpeciesData = [
    {
        name: "River Perch",
        sizeRange: [0.1, 1.5], // kg
        preferredDepthRange: [1, 5], // meters (conceptual for now)
        baseFightStyle: "jerky", // Short, quick pulls
        activityPeriods: [ {startHour: 6, endHour: 9}, {startHour: 17, endHour: 20} ],
        baitPreferences: { "worm": 0.9, "small_lure": 0.5, "bread": 0.2 }
    },
    {
        name: "Northern Pike",
        sizeRange: [0.5, 15], // kg
        preferredDepthRange: [2, 8], // meters
        baseFightStyle: "strong_runs", // Long, powerful pulls
        activityPeriods: [ {startHour: 9, endHour: 17} ], // More active midday
        baitPreferences: { "worm": 0.3, "small_lure": 0.8, "large_lure": 0.9, "fish_bait": 0.7 }
    },
    {
        name: "Common Bream",
        sizeRange: [0.2, 3], // kg
        preferredDepthRange: [3, 6], // meters
        baseFightStyle: "steady_pull",
        activityPeriods: [ {startHour: 4, endHour: 8}, {startHour: 20, endHour: 23} ],
        baitPreferences: { "worm": 0.6, "bread": 0.9, "corn": 0.8, "small_lure": 0.1 }
    }
];

// For now, let's assume a global bait type. This would be part of player's tackle selection later.
let currentBaitType = "worm"; // Player starts with worms by default

import { PlayerInventory } from './PlayerInventory.js';

// --- Player State & Inventory ---
const playerInventory = new PlayerInventory(50); // Start player with 50 gold

// --- Fish AI & Population ---
let activeFishPopulation = [];
const maxFishInArea = 15; // Max number of conceptual fish in the current fishing spot
// let bitingFish = null; // Replaced by fishToHook, remove this line
let fishToHook = null; // Stores the fish object that is currently biting or hooked (already declared, just noting consolidation)

// --- Game Time Simulation ---
let gameTimeHours = 6; // Start at 6 AM
let gameTimeMinutes = 0;
const timeScale = 60; // 1 real minute = 1 game hour. So 1 real second = 1 game minute.
const clock = new THREE.Clock(); // Three.js clock for delta time
let timeDisplayElement;

document.addEventListener('DOMContentLoaded', () => {
    timeDisplayElement = document.getElementById('timeDisplay');
});

function updateGameTime() {
    const deltaTime = clock.getDelta(); // seconds
    gameTimeMinutes += deltaTime * timeScale; // game minutes passed

    while (gameTimeMinutes >= 60) {
        gameTimeMinutes -= 60;
        gameTimeHours++;
    }
    while (gameTimeHours >= 24) {
        gameTimeHours -= 24;
        // Potentially trigger daily reset events here if needed
        console.log("A new day has started in-game.");
    }

    if (timeDisplayElement) {
        const hoursStr = String(Math.floor(gameTimeHours)).padStart(2, '0');
        const minutesStr = String(Math.floor(gameTimeMinutes)).padStart(2, '0');
        timeDisplayElement.textContent = `Time: ${hoursStr}:${minutesStr}`;
    }
}

function spawnFishPopulation() {
    activeFishPopulation = [];
    console.log("Spawning new fish population...");
    for (let i = 0; i < maxFishInArea; i++) {
        const speciesIndex = Math.floor(Math.random() * fishSpeciesData.length);
        const species = fishSpeciesData[speciesIndex];

        const size = species.sizeRange[0] + Math.random() * (species.sizeRange[1] - species.sizeRange[0]);
        const depth = species.preferredDepthRange[0] + Math.random() * (species.preferredDepthRange[1] - species.preferredDepthRange[0]);

        activeFishPopulation.push({
            species: species, // Reference to the species data
            size: parseFloat(size.toFixed(2)), // kg, rounded to 2 decimal places
            depth: parseFloat(depth.toFixed(2)) // meters, rounded
        });
    }
    console.log("Active fish population:", activeFishPopulation.map(f => `${f.species.name} (${f.size}kg at ${f.depth}m)`));
}


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
let isCasting = false; // true when line is flying out
let isCast = false;    // true when bobber is in water, waiting or fish biting
let bobber, fishingLine;
const castDistance = 20; // How far the bobber will be cast
const castSpeed = 0.5; // Speed of the bobber during casting
let castStartTime;

// --- Fishing States ---
let waitingForBite = false;
let fishBiting = false;
let fishHooked = false;
let fishToHook = null; // Will store the fish object that is about to be hooked

// let biteTimer = null; // Replaced by checkForFishBite logic
// let biteDuration = 2000; // ms, how long the fish bites / bobber is down (not directly used anymore)
let hookWindowTimeout = null; // Timer for the player to react
const hookWindowDuration = 1500; // ms, time player has to click after bite starts
const fishCheckInterval = 2000; // ms, how often to check for bites
let lastFishCheckTime = 0;


// --- Reeling Mechanics ---
let isReeling = false; // Player is actively trying to reel in a hooked fish
let lineTension = 0;
const currentLineBreakingPoint = 100; // Formerly maxLineTension. Represents the line's strength.
const lineStretchFactor = 0.95; // Higher value = less stretchy. 1.0 = no stretch effect.
const tensionIncreaseRate = 1; // Base rate per frame while reeling against fish pull (if line not slipping)
const tensionDecreaseRate = 0.5; // Per frame naturally, or faster if not reeling

// Drag System
let reelDragSetting = 0.3; // Player adjustable (0.0 to 1.0), fraction of maxReelDragForce
const maxReelDragForce = currentLineBreakingPoint * 0.8; // Max force drag can apply (e.g., 80)
const lineSlipSpeed = 0.2; // Units per frame fish takes line when drag slips

let fishPulling = false;
let fishPullTimer = null;
let fishPullDuration = 0;
let fishInitialDistance = 0; // Distance when fish was hooked
let fishCurrentDistance = 0;
const reelInSpeed = 0.1; // Units per frame fish gets closer
const fishEscapeTime = 30000; // 30 seconds to reel in, or it escapes
let escapeTimer = null;

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
    if (isCasting || isCast) return; // Prevent casting if already casting or cast

    isCasting = true;
    castStartTime = Date.now();

    // Create bobber if it doesn't exist
    if (!bobber) {
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
    updateFishingLine();
}

function updateFishingLine() {
    if (!fishingLine) return;

    const rodTipWorldPosition = getRodTipPosition();
    const positions = fishingLine.geometry.attributes.position.array;

    positions[0] = rodTipWorldPosition.x;
    positions[1] = rodTipWorldPosition.y;
    positions[2] = rodTipWorldPosition.z;

    if (bobber) {
        positions[3] = bobber.position.x;
        positions[4] = bobber.position.y;
        positions[5] = bobber.position.z;
    } else { // If no bobber (e.g., line just created), end point is same as start
        positions[3] = rodTipWorldPosition.x;
        positions[4] = rodTipWorldPosition.y;
        positions[5] = rodTipWorldPosition.z;
    }
    fishingLine.geometry.attributes.position.needsUpdate = true;
    fishingLine.geometry.computeBoundingSphere(); // Important for visibility
}

function updateFishingLine() {
    if (!fishingLine) return;

    const rodTipPosition = getRodTipPosition();
    const bobberPosition = bobber.position;

    const maxSag = 0.75; // Max sag in world units
    // Sag is inversely proportional to tension. Full sag at 0 tension, no sag at 25% of breaking point.
    const tensionRatio = Math.min(lineTension / (currentLineBreakingPoint * 0.25), 1.0);
    const currentSag = maxSag * (1 - tensionRatio);

    let points;
    if (currentSag > 0.01 && isCast) { // Apply sag only if significant and line is cast (not reeling hard or mid-cast)
        const midPoint = new THREE.Vector3().addVectors(rodTipPosition, bobberPosition).multiplyScalar(0.5);
        midPoint.y -= currentSag; // Apply sag downwards

        const curve = new THREE.QuadraticBezierCurve3(rodTipPosition, midPoint, bobberPosition);
        points = curve.getPoints(10); // Get 10 segments for the curve
    } else {
        // Straight line if tension is high or no sag
        points = [rodTipPosition, bobberPosition];
    }

    fishingLine.geometry.setFromPoints(points);
    fishingLine.geometry.attributes.position.needsUpdate = true;
    fishingLine.geometry.computeBoundingSphere();
}


function reelIn() {
    if (isCast || fishBiting || fishHooked) { // Can reel in if cast, biting or hooked
        scene.remove(bobber);
        scene.remove(fishingLine);
        isCast = false;
        waitingForBite = false;
        fishBiting = false;
        fishHooked = false;
        clearTimeout(biteTimer);
        clearTimeout(hookWindowTimeout);
        bobber.position.y = water.position.y + 0.05; // Reset bobber visual state just in case
        console.log("Line reeled in.");
    }
}

function isFishActive(fishSpecies, currentTimeHours) {
    if (!fishSpecies.activityPeriods) return true; // Default to active if not specified
    for (const period of fishSpecies.activityPeriods) {
        if (currentTimeHours >= period.startHour && currentTimeHours < period.endHour) {
            return true;
        }
    }
    return false;
}

function getBaitPreferenceScore(fishSpecies, baitType) {
    if (fishSpecies.baitPreferences && fishSpecies.baitPreferences[baitType] !== undefined) {
        return fishSpecies.baitPreferences[baitType];
    }
    return 0.1; // Low score if bait not in preferences or preferences not defined
}

function checkForFishBite() {
    if (!isCast || fishBiting || fishHooked || waitingForBite) return;

    waitingForBite = true; // Set this to prevent immediate re-checks until interval passes
    lastFishCheckTime = clock.elapsedTime;

    let potentialBiters = [];

    for (const fish of activeFishPopulation) {
        let biteScore = 0;

        // 1. Time of Day Activity
        if (isFishActive(fish.species, gameTimeHours)) {
            biteScore += 50; // Base score for being active
        } else {
            biteScore += 5; // Much lower base score if not in preferred activity period
        }

        // 2. Bait Preference
        const baitScore = getBaitPreferenceScore(fish.species, currentBaitType) * 50; // Max 50 points from bait
        biteScore += baitScore;

        // 3. Random Factor (0-20)
        biteScore += Math.random() * 20;

        // 4. Size factor (slightly bigger fish might be bolder, or smaller more numerous - complex, keep simple for now)
        // For now, no direct size influence on bite probability itself, more on fight.

        // Conceptual depth check (will be more relevant with actual depth data for bobber)
        // For now, we assume bobber can reach any fish's preferred depth conceptually.

        if (biteScore > 0) { // Only consider fish with some level of interest
            potentialBiters.push({ fish, score: biteScore });
        }
    }

    if (potentialBiters.length > 0) {
        // Sort by score, highest first
        potentialBiters.sort((a, b) => b.score - a.score);

        // Introduce a general "luck" or "fish mood" threshold
        const overallBiteThreshold = 60; // Example:
                                        // Fish needs a score of X to even consider biting

        if (potentialBiters[0].score >= overallBiteThreshold) {
            const chanceToBite = potentialBiters[0].score / 120; // Max score approx 50+50+20=120. So this is a probability.

            if (Math.random() < chanceToBite) {
                fishToHook = potentialBiters[0].fish; // Store the actual fish object
                console.log(`Potential bite from: ${fishToHook.species.name} (Score: ${potentialBiters[0].score.toFixed(2)}, Chance: ${chanceToBite.toFixed(2)})`);
                triggerBite(fishToHook);
                return; // A fish is biting, stop checking
            }
        }
    }
    // If no fish bit this check cycle
    waitingForBite = false; // Allow next check
}


function triggerBite(fishThatBit) { // fishThatBit is the actual fish object from population
    console.log(`${fishThatBit.species.name} is biting! Size: ${fishThatBit.size}kg`);
    // waitingForBite = false; // This is handled by checkForFishBite now
    fishBiting = true;
    // Visual cue: Bobber dips
    bobber.position.y = water.position.y - 0.1; // Dip bobber

    // Player has a window to hook the fish
    clearTimeout(hookWindowTimeout);
    hookWindowTimeout = setTimeout(() => {
        if (fishBiting) { // If player didn't react in time
            console.log(`${fishToHook.species.name} got away!`);
            fishBiting = false;
            fishToHook = null;
            bobber.position.y = water.position.y + 0.05; // Bobber returns to normal
            waitingForBite = false; // Allow checks to resume
        }
    }, hookWindowDuration);
}

function attemptHookFish() {
    if (fishBiting && fishToHook) {
        clearTimeout(hookWindowTimeout); // Player reacted in time
        fishBiting = false;
        fishHooked = true; // bitingFish is already set by triggerBite
        console.log(`${fishToHook.species.name} hooked! Size: ${fishToHook.size}kg`);

        fishInitialDistance = bobber.position.distanceTo(getRodTipPosition());
        fishCurrentDistance = fishInitialDistance;
        lineTension = 0;
        startFishPullCycle();
        startEscapeTimer();
    } else {
        console.log("Attempted hook but no fish was biting or fishToHook not set.");
    }
}
function startEscapeTimer() {
    clearTimeout(escapeTimer);
    escapeTimer = setTimeout(() => {
        if (fishHooked) {
            console.log("Fish escaped (took too long)!");
            resetFishingState();
        }
    }, fishEscapeTime);
}

function startFishPullCycle() {
    if (!fishHooked || !fishToHook) return;

    let basePullInterval = 3000;
    let basePullDuration = 1000;

    // Modify pull behavior based on fish style and size
    switch (fishToHook.species.baseFightStyle) {
        case "jerky":
            basePullInterval = 2000; // More frequent
            basePullDuration = 700;  // Shorter pulls
            break;
        case "strong_runs":
            basePullInterval = 4000; // Less frequent but potentially longer
            basePullDuration = 1500; // Longer pulls
            break;
        case "steady_pull":
            basePullInterval = 3000;
            basePullDuration = 1200;
            break;
    }

    // Size influence: larger fish might have slightly more varied timing or longer pulls
    const sizeFactor = Math.min(1 + (fishToHook.size / fishToHook.species.sizeRange[1]) * 0.5, 1.5); // Max 50% increase based on relative size

    const timeToNextPull = (Math.random() * basePullInterval + basePullInterval / 2) / sizeFactor; // Larger fish, potentially shorter interval
    fishPullTimer = setTimeout(() => {
        if (!fishHooked || !fishToHook) return;
        fishPulling = true;
        fishPullDuration = (Math.random() * basePullDuration + basePullDuration / 2) * sizeFactor; // Larger fish, longer pull
        console.log(`${fishToHook.species.name} is pulling! (Duration: ${(fishPullDuration / 1000).toFixed(1)}s)`);
        setTimeout(() => {
            if (!fishHooked) return;
            fishPulling = false;
            console.log(`${fishToHook.species.name} stopped pulling.`);
            startFishPullCycle(); // Schedule next pull
        }, fishPullDuration);
    }, timeToNextPull);
}

function resetFishingState() {
    scene.remove(bobber);
    scene.remove(fishingLine);
    isCast = false;
    waitingForBite = false;
    fishBiting = false;
    fishHooked = false;
    isReeling = false; // Make sure this is reset
    // clearTimeout(biteTimer); // No longer used
    clearTimeout(hookWindowTimeout);
    clearTimeout(fishPullTimer);
    clearTimeout(escapeTimer);
    if (bobber) bobber.position.y = water.position.y + 0.05; // Reset bobber visual state
    lineTension = 0;
    fishToHook = null; // Clear the specific fish
    console.log("Fishing state reset.");
}


function reelInAction() { // This is the general "stop fishing" action
    console.log("ReelInAction called");
    resetFishingState();
}


// Event listener for mouse actions
window.addEventListener('mousedown', () => {
    if (fishHooked) {
        isReeling = true;
        console.log("Mouse down - Reeling started");
    }
});

window.addEventListener('mouseup', () => {
    if (isReeling) {
        isReeling = false;
        console.log("Mouse up - Reeling stopped");
    }
});

window.addEventListener('click', () => {
    if (fishBiting) { // Priority 1: Trying to hook a fish
        attemptHookFish();
    } else if (!isCast && !isCasting && !fishHooked && !isReeling) { // Can only cast if not already doing something
        castLine();
    } else if ((isCast && !fishBiting && !fishHooked) || (fishHooked && !isReeling)) {
        // If line is just cast (waiting for bite), or if fish is hooked but player is not actively reeling (mouse up)
        // then a click should reel everything in.
        // This condition is a bit complex, might need refinement.
        // The idea is if you are not in an active state (casting, reeling via mousedown, fishbiting) a click means "bring it all in"
        // However, if fishHooked is true, mousedown/mouseup handles isReeling. A click when fishHooked might be redundant or an explicit "give up".
        // For now, let's make click when fishHooked also reel in/reset.
        reelInAction();
    }
});


// Animation loop
function animate() {
    requestAnimationFrame(animate);

    updateGameTime(); // Update game time each frame

    if (isCasting) {
        const elapsedTime = (Date.now() - castStartTime) / 1000; // seconds
        const progress = Math.min(elapsedTime * castSpeed * (20/castDistance) , 1); // Normalized progress

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
            isCasting = false;
            isCast = true; // Bobber is now in the water
            bobber.position.y = water.position.y + 0.05; // Ensure it lands on water surface
            console.log("Cast complete. Bobber at water level.");
            waitingForBite = false; // Reset waiting flag to allow immediate check
            lastFishCheckTime = clock.elapsedTime; // Initialize for first check
            // startWaitForBite(); // Replaced by checkForFishBite logic in animate loop
        }
    }

    if (isCast && !isCasting && !fishBiting && !fishHooked) {
        if (clock.elapsedTime - lastFishCheckTime > fishCheckInterval / 1000.0) {
            checkForFishBite();
        }
    }


    if (isCast || isCasting || fishBiting || fishHooked) { // Line should be visible in all these states
        updateFishingLine();
    }

    if (fishHooked && fishToHook) {
        const deltaTime = clock.getDelta();
        const currentDragResistance = maxReelDragForce * reelDragSetting;

        const sizeRatio = fishToHook.size / fishToHook.species.sizeRange[1];
        const fishStrengthFactor = 1 + sizeRatio * 1.5;

        const actualTensionIncreaseRate = tensionIncreaseRate * fishStrengthFactor; // How much tension player adds by reeling against fish
        const actualReelInSpeed = (reelInSpeed / fishStrengthFactor) * deltaTime * 60; // Convert to per-second rate

        let fishPullForceMagnitudeThisFrame = 0;

        if (fishPulling) {
            // Fish's pull strength can be conceptualized as a rate of tension increase if line was static
            fishPullForceMagnitudeThisFrame = (tensionIncreaseRate * 2.0 * fishStrengthFactor) * deltaTime * 60; // Stronger than player's reel

            let dipAmount = 0.15 + Math.random() * 0.1;
            if(fishToHook.species.baseFightStyle === "jerky") dipAmount += Math.random() * 0.1;
            if(fishToHook.species.baseFightStyle === "strong_runs") dipAmount += 0.05;
            bobber.position.y = water.position.y - dipAmount;
        } else if (!fishBiting) {
            bobber.position.y = water.position.y - 0.05;
        }

        if (isReeling) { // Player is holding mouse button
            if (fishPulling) {
                // Player reeling + Fish pulling
                // Tension increases due to both player and fish, moderated by stretch
                lineTension += (actualTensionIncreaseRate + fishPullForceMagnitudeThisFrame * 0.5) * lineStretchFactor * deltaTime * 60;
                console.log(`Tension: ${lineTension.toFixed(1)} (${fishToHook.species.name} pulling HARD against reel)`);

                // Can fish still take line if its pull overcomes player + drag?
                if (fishPullForceMagnitudeThisFrame > currentDragResistance + (actualTensionIncreaseRate * deltaTime * 60)) {
                     const lineTakenFactor = (fishPullForceMagnitudeThisFrame - (currentDragResistance + actualTensionIncreaseRate * deltaTime * 60)) / (currentDragResistance +1);
                     const lineTaken = lineSlipSpeed * lineTakenFactor * deltaTime * 60;
                     fishCurrentDistance += lineTaken;
                     const directionAwayFromRod = new THREE.Vector3().subVectors(bobber.position, getRodTipPosition()).normalize();
                     bobber.position.add(directionAwayFromRod.multiplyScalar(lineTaken));
                     console.log(`${fishToHook.species.name} takes line (${lineTaken.toFixed(2)}m) against reel! Dist: ${fishCurrentDistance.toFixed(1)}m`);
                }
            } else { // Player reeling, fish not actively pulling
                fishCurrentDistance -= actualReelInSpeed;
                lineTension -= tensionDecreaseRate * 0.5 * deltaTime * 60;
                const rodTipPos = getRodTipPosition();
                const directionToRod = new THREE.Vector3().subVectors(rodTipPos, bobber.position).normalize();
                // Ensure bobber doesn't pass rod tip
                const distanceToMove = Math.min(actualReelInSpeed, fishCurrentDistance - 0.1); // -0.1 to prevent overshooting
                if (distanceToMove > 0) {
                    bobber.position.add(directionToRod.multiplyScalar(distanceToMove));
                }
                console.log(`Reeling ${fishToHook.species.name}. Dist: ${fishCurrentDistance.toFixed(1)}m. Tension: ${lineTension.toFixed(1)}`);
            }
        } else { // Player NOT reeling
            if (fishPulling && fishPullForceMagnitudeThisFrame > currentDragResistance) {
                // Fish pulling against drag ONLY
                const lineTakenFactor = (fishPullForceMagnitudeThisFrame - currentDragResistance) / (currentDragResistance + 1);
                const lineTaken = lineSlipSpeed * lineTakenFactor * deltaTime * 60;
                fishCurrentDistance += lineTaken;
                // Tension should build up to drag setting, then line slips
                lineTension += (fishPullForceMagnitudeThisFrame - lineTension) * 0.1; // Approach drag resistance
                lineTension = Math.min(lineTension, currentDragResistance + fishPullForceMagnitudeThisFrame *0.05); // Allow slight overshoot if fish is strong

                const directionAwayFromRod = new THREE.Vector3().subVectors(bobber.position, getRodTipPosition()).normalize();
                bobber.position.add(directionAwayFromRod.multiplyScalar(lineTaken));
                console.log(`${fishToHook.species.name} takes line on drag! (${lineTaken.toFixed(2)}m). Dist: ${fishCurrentDistance.toFixed(1)}m. Tension: ${lineTension.toFixed(1)}`);
            } else {
                // Fish not pulling significantly against drag, player not reeling: tension decreases
                lineTension -= tensionDecreaseRate * deltaTime * 60;
            }
        }

        lineTension = Math.max(0, lineTension); // Clamp tension at 0 (don't allow it to go way over break for long)

        // Check for win/loss conditions
        if (lineTension >= currentLineBreakingPoint) {
            console.log("Line snapped! Tension too high.");
            resetFishingState();
        } else if (fishCurrentDistance <= 1.0) {
            console.log(`Fish caught! ${fishToHook.species.name} - ${fishToHook.size}kg`);

            const caughtFish = {
                speciesName: fishToHook.species.name,
                size: fishToHook.size,
                // baseValue could be determined by a shopkeeper or species data later
                // For now, PlayerInventory.addFish will assign a simple default if not provided
            };
            playerInventory.addFish(caughtFish);
            console.log(`Current inventory: ${playerInventory.getFishStock().length} fish, Gold: ${playerInventory.getGoldBalance()}`);

            resetFishingState();
        }

        // Rod Bending
        const bendFactor = Math.min(lineTension / (currentLineBreakingPoint * 0.8), 1); // Normalize tension for bending, cap at 80% of breaking for full bend
        const maxBendBase = 0.05; // Radians
        const maxBendMid = Math.PI / 16;
        const maxBendTip = Math.PI / 8;

        rodSegments.base.rotation.x = -maxBendBase * bendFactor;
        rodSegments.mid.rotation.x = -maxBendMid * bendFactor;   // Relative to base
        rodSegments.tip.rotation.x = -maxBendTip * bendFactor;   // Relative to mid
    } else {
        // No tension, straighten the rod
        rodSegments.base.rotation.x = 0;
        rodSegments.mid.rotation.x = 0;
        rodSegments.tip.rotation.x = 0;
    }


    // Optional: Animate water for a simple ripple effect (more advanced later)
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

spawnFishPopulation(); // Create initial fish population

// Start the animation loop
animate();


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
