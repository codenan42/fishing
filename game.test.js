// game.test.js

// Access functions and variables from game.js (assuming it's loaded globally before this script)
// This is not ideal for unit testing but a consequence of game.js's current structure.
// For a more robust setup, game.js would need to export its functions.

let testsPassed = 0;
let testsFailed = 0;

// Simple assertion helper
function assertEquals(actual, expected, message) {
    if (actual === expected) {
        window.testLogger.pass(`PASS: ${message}`);
        testsPassed++;
    } else {
        window.testLogger.fail(`FAIL: ${message} (Expected: ${expected}, Got: ${actual})`);
        testsFailed++;
    }
}

function assertApproximatelyEquals(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) <= tolerance) {
        window.testLogger.pass(`PASS: ${message}`);
        testsPassed++;
    } else {
        window.testLogger.fail(`FAIL: ${message} (Expected: approx ${expected}, Got: ${actual})`);
        testsFailed++;
    }
}

function assertTrue(condition, message) {
    if (condition) {
        window.testLogger.pass(`PASS: ${message}`);
        testsPassed++;
    } else {
        window.testLogger.fail(`FAIL: ${message} (Expected true, got false)`);
        testsFailed++;
    }
}

function assertFalse(condition, message) {
    if (!condition) {
        window.testLogger.pass(`PASS: ${message}`);
        testsPassed++;
    } else {
        window.testLogger.fail(`FAIL: ${message} (Expected false, got true)`);
        testsFailed++;
    }
}

// --- Test Suites ---

function testFishAIHelpers() {
    window.testLogger.log("--- Testing Fish AI Helpers ---");

    const perchSpecies = {
        name: "Test Perch",
        activityPeriods: [{ startHour: 6, endHour: 9 }, { startHour: 18, endHour: 21 }],
        baitPreferences: { "worm": 0.9, "lure": 0.5 }
    };
    const pikeSpecies = {
        name: "Test Pike",
        activityPeriods: [{ startHour: 22, endHour: 2 }], // Overnight
        baitPreferences: { "lure": 0.8 }
    };
    const speciesNoActivity = { name: "Always Active Fish" };
    const speciesEmptyActivity = { name: "Never Active Fish", activityPeriods: [] };
    const speciesNoPrefs = { name: "No Prefs Fish" };


    // isFishActive tests
    assertTrue(isFishActive(perchSpecies, 7), "Perch active at 7 AM");
    assertFalse(isFishActive(perchSpecies, 5), "Perch inactive at 5 AM");
    assertFalse(isFishActive(perchSpecies, 9), "Perch inactive at 9 AM (exclusive endHour)");
    assertTrue(isFishActive(pikeSpecies, 23), "Pike active at 23 PM (overnight)");
    assertTrue(isFishActive(pikeSpecies, 1), "Pike active at 1 AM (overnight)");
    assertFalse(isFishActive(pikeSpecies, 3), "Pike inactive at 3 AM (overnight)");
    assertTrue(isFishActive(speciesNoActivity, 12), "Fish with no activity period is active");
    assertFalse(isFishActive(speciesEmptyActivity, 12), "Fish with empty activity period is inactive");

    // getBaitPreferenceScore tests
    assertEquals(getBaitPreferenceScore(perchSpecies, "worm"), 0.9, "Perch worm preference");
    assertEquals(getBaitPreferenceScore(perchSpecies, "lure"), 0.5, "Perch lure preference");
    assertEquals(getBaitPreferenceScore(perchSpecies, "bread"), 0.1, "Perch non-listed bait preference");
    assertEquals(getBaitPreferenceScore(speciesNoPrefs, "worm"), 0.1, "Fish with no bait prefs");
    assertEquals(getBaitPreferenceScore({ name: "Empty Prefs", baitPreferences: {} }, "worm"), 0.1, "Fish with empty bait prefs");
}

function testGameTime() {
    window.testLogger.log("--- Testing Game Time Logic ---");

    // Note: This test directly manipulates global game time variables.
    // It also doesn't directly test updateGameTime with deltaTime, but its core logic.
    let originalHours = gameTimeHours;
    let originalMinutes = gameTimeMinutes;

    gameTimeHours = 6;
    gameTimeMinutes = 58;
    // Simulate gameTimeMinutes += deltaTime * timeScale resulting in 3 more minutes
    gameTimeMinutes += 3;
    while (gameTimeMinutes >= 60) { gameTimeMinutes -= 60; gameTimeHours++; }
    while (gameTimeHours >= 24) { gameTimeHours -= 24;}
    assertEquals(gameTimeHours, 7, "Game time hour rollover (6:58 + 3min -> 7:01)");
    assertEquals(gameTimeMinutes, 1, "Game time minute rollover (6:58 + 3min -> 7:01)");

    gameTimeHours = 23;
    gameTimeMinutes = 58;
    gameTimeMinutes += 3;
    while (gameTimeMinutes >= 60) { gameTimeMinutes -= 60; gameTimeHours++; }
    while (gameTimeHours >= 24) { gameTimeHours -= 24; }
    assertEquals(gameTimeHours, 0, "Game time day rollover (23:58 + 3min -> 00:01)");
    assertEquals(gameTimeMinutes, 1, "Game time minute rollover for day (23:58 + 3min -> 00:01)");

    gameTimeHours = 10;
    gameTimeMinutes = 15;
    gameTimeMinutes += 30; // Add 30 minutes
    while (gameTimeMinutes >= 60) { gameTimeMinutes -= 60; gameTimeHours++; }
    while (gameTimeHours >= 24) { gameTimeHours -= 24; }
    assertEquals(gameTimeHours, 10, "Game time simple minute add (10:15 + 30min -> 10:45)");
    assertEquals(gameTimeMinutes, 45, "Game time simple minute add value (10:15 + 30min -> 10:45)");

    // Restore original time (important if other tests depend on it, though ideally they shouldn't)
    gameTimeHours = originalHours;
    gameTimeMinutes = originalMinutes;
}

function testFishSpawning() {
    window.testLogger.log("--- Testing Fish Spawning ---");
    let originalPopulation = [...activeFishPopulation]; // Shallow copy

    spawnFishPopulation(); // This function has console logs we can't easily capture here

    assertEquals(activeFishPopulation.length, maxFishInArea, `Population should be ${maxFishInArea}`);
    if (activeFishPopulation.length > 0) {
        const firstFish = activeFishPopulation[0];
        assertTrue(typeof firstFish.species.name === 'string', "Spawned fish has species name");
        assertTrue(typeof firstFish.size === 'number' && firstFish.size >= firstFish.species.sizeRange[0] && firstFish.size <= firstFish.species.sizeRange[1], "Spawned fish size is within species range");
        assertTrue(typeof firstFish.depth === 'number' && firstFish.depth >= firstFish.species.preferredDepthRange[0] && firstFish.depth <= firstFish.species.preferredDepthRange[1], "Spawned fish depth is within species range");
    }
    // Restore (or re-spawn if other tests depend on a specific initial state)
    activeFishPopulation = originalPopulation;
    // If other tests depend on a fresh spawn, they should call spawnFishPopulation themselves.
}


function testBiteAndHookLogic() {
    window.testLogger.log("--- Testing Bite and Hook Logic (Simplified) ---");

    // Mocking necessary global states and functions
    const originalFishPopulation = [...activeFishPopulation];
    const originalGameTimeHours = gameTimeHours;
    const originalCurrentBaitType = currentBaitType;
    let originalFishToHook = fishToHook;
    let originalIsCast = isCast;
    let originalFishBiting = fishBiting;
    let originalFishHooked = fishHooked;
    let originalWaitingForBite = waitingForBite;

    let triggerBiteCalledWith = null;
    const mockTriggerBite = (fish) => { triggerBiteCalledWith = fish; fishBiting = true; fishToHook = fish; /* Simplified side effects */ };
    const realTriggerBite = window.triggerBite; // Assuming triggerBite is global
    window.triggerBite = mockTriggerBite;

    // Setup for a likely bite
    gameTimeHours = 7; // Perch active
    currentBaitType = "worm"; // Perch likes worms
    const testPerchSpecies = fishSpeciesData.find(s => s.name === "River Perch");
    activeFishPopulation = [{ species: testPerchSpecies, size: 1.0, depth: 3.0 }];
    isCast = true; fishBiting = false; fishHooked = false; waitingForBite = false; fishToHook = null;

    // Mock Math.random for checkForFishBite's random factor and bite chance
    let randomCallCount = 0;
    const mockMathRandomVals = [0.9, 0.1]; // High random factor, then low for bite chance success
    const originalMathRandom = Math.random;
    Math.random = () => mockMathRandomVals[randomCallCount++] || 0;

    checkForFishBite();
    assertTrue(triggerBiteCalledWith !== null && triggerBiteCalledWith.species.name === "River Perch", "Perch should attempt to bite with favorable conditions");
    assertTrue(fishBiting, "State fishBiting should be true after triggerBite (mocked)");
    assertEquals(fishToHook, triggerBiteCalledWith, "fishToHook should be set by triggerBite (mocked)");

    randomCallCount = 0; // Reset for next call
    triggerBiteCalledWith = null; // Reset mock state

    // Test attemptHookFish
    if (fishBiting && fishToHook) { // Condition must be true from previous test
        // Mock functions called by attemptHookFish if they have complex side effects
        const realStartFishPullCycle = window.startFishPullCycle;
        const realStartEscapeTimer = window.startEscapeTimer;
        let pullCycleStarted = false; let escapeTimerStarted = false;
        window.startFishPullCycle = () => { pullCycleStarted = true; };
        window.startEscapeTimer = () => { escapeTimerStarted = true; };

        attemptHookFish();
        assertTrue(fishHooked, "fishHooked should be true after successful attemptHookFish");
        assertFalse(fishBiting, "fishBiting should be false after successful attemptHookFish");
        assertTrue(pullCycleStarted, "startFishPullCycle should have been called");
        assertTrue(escapeTimerStarted, "startEscapeTimer should have been called");

        window.startFishPullCycle = realStartFishPullCycle;
        window.startEscapeTimer = realStartEscapeTimer;
    } else {
        window.testLogger.fail("FAIL: Prerequisite for attemptHookFish not met (fish not biting or fishToHook not set)");
        testsFailed++; // Manually increment as assertEquals won't be hit
    }

    // Restore original Math.random and other globals
    Math.random = originalMathRandom;
    window.triggerBite = realTriggerBite;
    activeFishPopulation = originalFishPopulation;
    gameTimeHours = originalGameTimeHours;
    currentBaitType = originalCurrentBaitType;
    fishToHook = originalFishToHook;
    isCast = originalIsCast;
    fishBiting = originalFishBiting;
    fishHooked = originalFishHooked;
    waitingForBite = originalWaitingForBite;
}


// --- Main Test Runner ---
function runAllGameTests() {
    window.testLogger.log("Starting All Game Tests...");
    testsPassed = 0;
    testsFailed = 0;

    try {
        testFishAIHelpers();
    } catch (e) {
        window.testLogger.fail(`ERROR in testFishAIHelpers: ${e.message}\n${e.stack}`);
        testsFailed++;
    }
    try {
        testGameTime();
    } catch (e) {
        window.testLogger.fail(`ERROR in testGameTime: ${e.message}\n${e.stack}`);
        testsFailed++;
    }
    try {
        testFishSpawning();
    } catch (e) {
        window.testLogger.fail(`ERROR in testFishSpawning: ${e.message}\n${e.stack}`);
        testsFailed++;
    }
    try {
        testBiteAndHookLogic();
    } catch (e) {
        window.testLogger.fail(`ERROR in testBiteAndHookLogic: ${e.message}\n${e.stack}`);
        testsFailed++;
    }
    // Add more test suite calls here

    window.testLogger.summarize(testsPassed, testsFailed);
}

// Run tests when the script is loaded (assuming test.html context)
if (window.testLogger) {
    runAllGameTests();
} else {
    // Fallback if not run in test.html, though not ideal
    console.warn("window.testLogger not found. Run tests through test.html.");
    // You could still run tests and log directly to console here if needed for other environments.
}
