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

// Create the fishing rod
const rodGeometry = new THREE.CylinderGeometry(0.05, 0.02, 2.5, 8); // radiusTop, radiusBottom, height, radialSegments
const rodMaterial = new THREE.MeshPhongMaterial({ color: 0x654321 }); // Brown color
const fishingRod = new THREE.Mesh(rodGeometry, rodMaterial);

// Position the rod relative to the camera
// This will make it appear in the player's "hand"
fishingRod.position.set(0.5, -0.4, -1); // Right side, slightly down, in front
fishingRod.rotation.set(0, -0.2, Math.PI / 5); // Angled slightly

// Add rod to the camera so it moves with it
camera.add(fishingRod); // Make rod a child of the camera
scene.add(camera); // Ensure camera (now with rod) is part of the scene

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
const maxLineTension = 100;
const tensionIncreaseRate = 1; // Per frame while reeling against fish pull
const tensionDecreaseRate = 0.5; // Per frame naturally, or faster if not reeling
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
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc });
const linePoints = [new THREE.Vector3(), new THREE.Vector3()];
const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);

function getRodTipPosition() {
    const rodTipLocal = new THREE.Vector3(0, 1.25, 0); // Tip is at the top of the cylinder (y-axis of rod)
    return fishingRod.localToWorld(rodTipLocal.clone()); // Convert local rod tip to world space
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

    if (fishHooked && fishToHook) { // Ensure fishToHook is set before accessing its properties
        let currentTensionIncreaseRate = tensionIncreaseRate;
        let currentReelInSpeed = reelInSpeed;

        // Adjust rates based on fish size
        const sizeRatio = fishToHook.size / fishToHook.species.sizeRange[1]; // 0 to 1 for relative size
        currentTensionIncreaseRate += sizeRatio * 0.5; // Larger fish increase tension a bit faster
        currentReelInSpeed *= Math.max(0.5, 1 - sizeRatio * 0.75); // Larger fish are harder to reel (min 50% speed)


        if (isReeling) { // Player is holding mouse button
            if (fishPulling) {
                lineTension += currentTensionIncreaseRate;
                console.log(`Tension: ${lineTension.toFixed(1)} (${fishToHook.species.name} pulling)`);
            } else {
                // Reel in the fish
                fishCurrentDistance -= currentReelInSpeed;
                lineTension -= tensionDecreaseRate * 0.5; // Tension slightly decreases when reeling normally
                // Move bobber closer to player
                const rodTipPos = getRodTipPosition();
                const directionToRod = new THREE.Vector3().subVectors(rodTipPos, bobber.position).normalize();
                bobber.position.add(directionToRod.multiplyScalar(reelInSpeed)); // This is an approximation

                console.log(`Reeling. Fish at: ${fishCurrentDistance.toFixed(1)}m. Tension: ${lineTension.toFixed(1)}`);
            }
        } else { // Player released mouse button
            lineTension -= tensionDecreaseRate; // Tension decreases if not reeling
        }
        lineTension = Math.max(0, lineTension); // Clamp tension at 0

        // Check for win/loss conditions
        if (lineTension >= maxLineTension) {
            console.log("Line snapped! Tension too high.");
            resetFishingState();
        } else if (fishCurrentDistance <= 1.0) { // Fish is close enough to be "caught" (e.g., 1 meter from rod tip)
            console.log("Fish caught!");
            // For now, just reset. Later, show fish, add to inventory, etc.
            resetFishingState();
        }

        // Bobber visual update based on fish pull (even if not reeling)
        if (fishPulling) {
            let dipAmount = 0.15 + Math.random() * 0.1;
            if(fishToHook.species.baseFightStyle === "jerky") dipAmount += Math.random() * 0.1; // More erratic for jerky
            if(fishToHook.species.baseFightStyle === "strong_runs") dipAmount += 0.05; // Deeper for strong runs
            bobber.position.y = water.position.y - dipAmount;
        } else if (!fishBiting) { // if not the initial bite phase (i.e., fish is hooked and player is fighting)
            bobber.position.y = water.position.y - 0.05; // Slightly submerged while fighting
        }
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
