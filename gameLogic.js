// gameLogic.js
import { PlayerInventory } from './PlayerInventory.js'; // Assuming PlayerInventory.js is in the same directory

// --- Game Configuration & Data ---
export const fishSpeciesData = [
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

// --- Player State & Inventory ---
export const playerInventory = new PlayerInventory(50); // Start player with 50 gold

// --- Fish AI & Population ---
export let activeFishPopulation = [];
export const maxFishInArea = 15; // Max number of conceptual fish in the current fishing spot
export let fishToHook = null;

// --- Game Time Simulation ---
export let gameTimeHours = 6; // Start at 6 AM
export let gameTimeMinutes = 0;
export const timeScale = 60; // 1 real minute = 1 game hour. So 1 real second = 1 game minute.
// Note: THREE.Clock() is browser/Three.js specific, so deltaTime will need to be passed into time updates

// --- Fishing States ---
export let currentBaitType = "worm"; // Player starts with worms by default
export let isCasting = false;
export let isCast = false;
export let waitingForBite = false; // This flag helps manage the interval between bite checks
export let fishBiting = false;
export let fishHooked = false;

export let castStartTime = 0; // Will be set by Date.now() or similar (or clock.elapsedTime from game.js)
export const hookWindowDuration = 1500;
// export let hookWindowTimeout = null; // Managed by game.js
export const fishCheckInterval = 2000; // ms, how often to check for bites
export let lastFishCheckTime = 0; // Will be based on a game loop clock


// --- Reeling Mechanics ---
export let isReeling = false;
export let lineTension = 0;
export const currentLineBreakingPoint = 100;
export const lineStretchFactor = 0.95;
export const tensionIncreaseRate = 1; // Base rate per second (when scaled by deltaTime)
export const tensionDecreaseRate = 0.5; // Base rate per second (when scaled by deltaTime)

export let fishPulling = false;
// export let fishPullTimer = null; // Managed by game.js
export let fishPullDuration = 0; // Calculated in gameLogic, used by game.js for setTimeout
export let fishInitialDistance = 0;
export let fishCurrentDistance = 0;
export const reelInSpeed = 0.1; // Base units per second (when scaled by deltaTime)
export const fishEscapeTime = 30000; // ms
// export let escapeTimer = null; // Managed by game.js

// Placeholder for functions to be moved and refactored
export function setFishToHook(fish) { // Example setter, might need more sophisticated state management
    fishToHook = fish;
}

export function setCastingState(casting, startTime) {
    isCasting = casting;
    if (casting) castStartTime = startTime;
}

export function setCastState(cast) {
    isCast = cast;
}

export function setFishBitingState(biting, fish = null) {
    fishBiting = biting;
    if (biting && fish) fishToHook = fish;
    // if (!biting) fishToHook = null; // Be careful here, might clear too early if hooking
}

export function setFishHookedState(hooked, fish = null) {
    fishHooked = hooked;
    if (hooked && fish) { // Ensure fishToHook is the one actually hooked
        fishToHook = fish;
    }
    // if (!hooked) fishToHook = null; // resetFishingStateLogic will handle this
}

export function setIsReelingState(reeling) {
    isReeling = reeling;
}

export function setLineTension(tension) {
    lineTension = Math.max(0, tension);
}

export function setFishCurrentDistance(distance) {
    fishCurrentDistance = distance;
}

export function spawnFishPopulation() {
    activeFishPopulation = []; // Clears the array
    console.log("Spawning new fish population (gameLogic)...");
    for (let i = 0; i < maxFishInArea; i++) {
        const speciesIndex = Math.floor(Math.random() * fishSpeciesData.length);
        const species = fishSpeciesData[speciesIndex];

        const size = species.sizeRange[0] + Math.random() * (species.sizeRange[1] - species.sizeRange[0]);
        const depth = species.preferredDepthRange[0] + Math.random() * (species.preferredDepthRange[1] - species.preferredDepthRange[0]);

        activeFishPopulation.push({
            species: species, // Reference to the species data
            size: parseFloat(size.toFixed(2)),
            depth: parseFloat(depth.toFixed(2))
        });
    }
    // Console logging of population can be done in game.js if needed, or keep it here for logic debug
    // console.log("Active fish population (gameLogic):", activeFishPopulation.map(f => `${f.species.name} (${f.size}kg at ${f.depth}m)`));
}

export function isFishActive(fishSpecies, currentHour) {
    if (!fishSpecies.activityPeriods) return true;
    for (const period of fishSpecies.activityPeriods) {
        if (period.startHour > period.endHour) { // Overnight period
            if (currentHour >= period.startHour || currentHour < period.endHour) {
                return true;
            }
        } else { // Same-day period
            if (currentHour >= period.startHour && currentHour < period.endHour) {
                return true;
            }
        }
    }
    return false;
}

export function getBaitPreferenceScore(fishSpecies, baitType) {
    if (fishSpecies.baitPreferences && fishSpecies.baitPreferences[baitType] !== undefined) {
        return fishSpecies.baitPreferences[baitType];
    }
    return 0.1; // Low score if bait not in preferences or preferences not defined
}

export function updateGameTimeData(deltaTime) { // deltaTime is passed in
    gameTimeMinutes += deltaTime * timeScale;

    let dayRollover = false;
    while (gameTimeMinutes >= 60) {
        gameTimeMinutes -= 60;
        gameTimeHours++;
    }
    while (gameTimeHours >= 24) {
        gameTimeHours -= 24;
        dayRollover = true;
    }
    return { hours: gameTimeHours, minutes: gameTimeMinutes, newDay: dayRollover };
}


export function resetFishingStateLogic() {
    // Resets only the logical state variables
    isCast = false;
    waitingForBite = false;
    fishBiting = false;
    fishHooked = false;
    isReeling = false;

    // fishToHook is critical to reset
    fishToHook = null;

    lineTension = 0;
    fishPulling = false;
    fishPullDuration = 0;
    fishInitialDistance = 0;
    fishCurrentDistance = 0;

    // Note: Clearing timeouts (hookWindowTimeout, fishPullTimer, escapeTimer)
    // must be handled by the browser-side (game.js) as it owns the timer IDs.
    // gameLogic.js can signal that these should be cleared, or game.js can infer it.
    console.log("Fishing state logic reset (gameLogic).");
    return true; // Indicate successful reset
}


export function checkForFishBiteLogic(currentGameTimeHours, currentBait) {
    // This function determines IF a fish might bite and WHICH fish.
    // It does not handle the setTimeout for the bite window itself.
    if (!isCast || fishBiting || fishHooked ) return null; // Only check if line is cast and no current action

    let potentialBiters = [];
    for (const fish of activeFishPopulation) {
        let biteScore = 0;
        if (isFishActive(fish.species, currentGameTimeHours)) {
            biteScore += 50;
        } else {
            biteScore += 5;
        }
        biteScore += getBaitPreferenceScore(fish.species, currentBait) * 50;
        biteScore += Math.random() * 20; // Random factor

        if (biteScore > 0) {
            potentialBiters.push({ fish, score: biteScore });
        }
    }

    if (potentialBiters.length > 0) {
        potentialBiters.sort((a, b) => b.score - a.score);

        const overallBiteThreshold = 60;
        if (potentialBiters[0].score >= overallBiteThreshold) {
            const chanceToBite = potentialBiters[0].score / 120;
            if (Math.random() < chanceToBite) {
                // fishToHook = potentialBiters[0].fish; // This state will be set by triggerBiteLogic
                console.log(`Logic: Potential bite from: ${potentialBiters[0].fish.species.name} (Score: ${potentialBiters[0].score.toFixed(2)}, Chance: ${chanceToBite.toFixed(2)})`);
                return potentialBiters[0].fish; // Return the fish that intends to bite
            }
        }
    }
    return null; // No fish decided to bite this check
}


export function triggerBiteLogic(fishThatWillBite) {
    if (!fishThatWillBite) return false;

    fishToHook = fishThatWillBite; // Set the specific fish
    fishBiting = true;
    waitingForBite = false; // No longer waiting, bite is happening
    // The visual cue (bobber dip) and hookWindowTimeout are handled by game.js
    console.log(`Logic: ${fishToHook.species.name} is now biting. Size: ${fishToHook.size}kg`);
    return true; // Indicate bite sequence initiated
}

export function fishGotAwayLogic() {
    // Called by game.js when hookWindowTimeout expires
    if (fishBiting) { // Check if a fish was actually biting
        console.log(`Logic: ${fishToHook ? fishToHook.species.name : 'A fish'} got away!`);
        fishBiting = false;
        fishToHook = null;
        waitingForBite = false; // Allow new checks
        // lastFishCheckTime should be updated by game.js after this
        return true;
    }
    return false;
}

export function attemptHookFishLogic() {
    if (fishBiting && fishToHook) {
        // fishBiting = false; // This is done by setFishHookedState
        // fishHooked = true; // This is done by setFishHookedState
        setFishBitingState(false);
        setFishHookedState(true, fishToHook); // Pass fishToHook to ensure it's the one being hooked

        console.log(`Logic: ${fishToHook.species.name} hooked! Size: ${fishToHook.size}kg`);

        // Initialize reeling parameters (these are logical, bobber distance is visual)
        // fishInitialDistance will be set by game.js based on bobber's world position
        // fishCurrentDistance = fishInitialDistance;
        lineTension = 0;

        // Starting fish pull cycle and escape timer will be signaled to game.js
        return { success: true, fish: fishToHook };
    }
    console.log("Logic: Attempted hook but no fish was biting or fishToHook not set.");
    return { success: false };
}


export function getFishPullCycleTiming() {
    // This function now returns the timings for game.js to manage with setTimeout
    if (!fishHooked || !fishToHook) return null;

    let basePullInterval = 3000;
    let basePullDuration = 1000;

    switch (fishToHook.species.baseFightStyle) {
        case "jerky":
            basePullInterval = 2000; basePullDuration = 700; break;
        case "strong_runs":
            basePullInterval = 4000; basePullDuration = 1500; break;
        case "steady_pull":
            basePullInterval = 3000; basePullDuration = 1200; break;
    }

    const sizeFactor = Math.min(1 + (fishToHook.size / fishToHook.species.sizeRange[1]) * 0.5, 1.5);
    const timeToNextPull = (Math.random() * basePullInterval + basePullInterval / 2) / sizeFactor;
    const currentPullDuration = (Math.random() * basePullDuration + basePullDuration / 2) * sizeFactor;

    fishPullDuration = currentPullDuration; // Store for calculateReelingPhysics if needed, though direct use might be better

    return { timeToNextPull, pullDuration: currentPullDuration };
}

export function calculateReelingPhysics(deltaTime, isPlayerReeling, currentBobberDistance) {
    // This function calculates changes to lineTension and fishCurrentDistance
    // It does NOT move the bobber visually or handle line snapping/catching directly.
    // It returns an object with { newLineTension, newFishDistance, lineTakenAmount }

    if (!fishHooked || !fishToHook) {
        return { newLineTension: lineTension, newFishDistance: fishCurrentDistance, lineTakenAmount: 0, fishSnapped: false, fishCaught: false };
    }

    fishCurrentDistance = currentBobberDistance; // Sync with visual state passed from game.js

    const currentDragResistance = maxReelDragForce * reelDragSetting;
    const sizeRatio = fishToHook.size / fishToHook.species.sizeRange[1];
    const fishStrengthFactor = 1 + sizeRatio * 1.5;

    const actualTensionIncreaseRate = tensionIncreaseRate * fishStrengthFactor;
    const actualReelInSpeedPerSec = (reelInSpeed / fishStrengthFactor) * 60;

    let fishPullForceMagnitudeThisFrame = 0;
    let lineTakenThisFrame = 0;

    if (fishPulling) { // fishPulling state is set by game.js via its timer
        fishPullForceMagnitudeThisFrame = (tensionIncreaseRate * 2.0 * fishStrengthFactor); // Per second conceptual force
    }

    let newTension = lineTension;
    let newDistance = fishCurrentDistance;

    if (isPlayerReeling) {
        if (fishPulling) {
            newTension += (actualTensionIncreaseRate + fishPullForceMagnitudeThisFrame * 0.5) * lineStretchFactor * deltaTime;
            if (fishPullForceMagnitudeThisFrame * deltaTime > (currentDragResistance * deltaTime) + (actualTensionIncreaseRate * lineStretchFactor * deltaTime)) {
                 const effectiveFishPull = fishPullForceMagnitudeThisFrame - (actualTensionIncreaseRate * lineStretchFactor);
                 const lineTakenFactor = Math.max(0, effectiveFishPull - currentDragResistance) / (currentDragResistance + 1);
                 lineTakenThisFrame = lineSlipSpeed * lineTakenFactor * deltaTime * 60; // per second rate
                 newDistance += lineTakenThisFrame;
            }
        } else {
            const distanceToReel = actualReelInSpeedPerSec * deltaTime;
            newDistance -= distanceToReel;
            newTension -= tensionDecreaseRate * 0.5 * deltaTime * 60;
        }
    } else { // Player NOT Reeling
        if (fishPulling && fishPullForceMagnitudeThisFrame * deltaTime > currentDragResistance * deltaTime) {
            const lineTakenFactor = (fishPullForceMagnitudeThisFrame - currentDragResistance) / (currentDragResistance + 1);
            lineTakenThisFrame = lineSlipSpeed * lineTakenFactor * deltaTime * 60;
            newDistance += lineTakenThisFrame;

            let tensionTarget = currentDragResistance + (fishPullForceMagnitudeThisFrame - currentDragResistance) * 0.1;
            newTension += (tensionTarget - newTension) * 0.2; // Approach target smoothly
            newTension = Math.min(newTension, currentDragResistance + fishPullForceMagnitudeThisFrame * 0.05 * deltaTime * 60);
        } else {
            newTension -= tensionDecreaseRate * deltaTime * 60;
        }
    }

    newTension = Math.max(0, newTension);
    newDistance = Math.max(0.1, newDistance); // Fish can't be reeled into the rod

    // Update global state for next frame (or for other logic to read)
    lineTension = newTension;
    fishCurrentDistance = newDistance; // This might be redundant if game.js passes currentBobberDistance each time

    let fishSnapped = newTension >= currentLineBreakingPoint;
    let fishIsCaught = newDistance <= 1.0;

    if (fishSnapped) console.log("Logic: Line snapped!");
    if (fishIsCaught) console.log(`Logic: Fish caught! ${fishToHook.species.name}`);

    return {
        newLineTension: newTension,
        newFishDistance: newDistance,
        lineTakenAmount: lineTakenThisFrame,
        fishSnapped: fishSnapped,
        fishCaught: fishIsCaught
    };
}
