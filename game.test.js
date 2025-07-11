// game.test.js
import * as GameLogic from './gameLogic.js';
// PlayerInventory is used by gameLogic, so we might need to import it if we are testing inventory interactions via gameLogic
// However, for now, playerInventory is instantiated within gameLogic.js and exported.

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
    assertTrue(GameLogic.isFishActive(perchSpecies, 7), "Perch active at 7 AM");
    assertFalse(GameLogic.isFishActive(perchSpecies, 5), "Perch inactive at 5 AM");
    assertFalse(GameLogic.isFishActive(perchSpecies, 9), "Perch inactive at 9 AM (exclusive endHour)");
    assertTrue(GameLogic.isFishActive(pikeSpecies, 23), "Pike active at 23 PM (overnight)");
    assertTrue(GameLogic.isFishActive(pikeSpecies, 1), "Pike active at 1 AM (overnight)");
    assertFalse(GameLogic.isFishActive(pikeSpecies, 3), "Pike inactive at 3 AM (overnight)");
    assertTrue(GameLogic.isFishActive(speciesNoActivity, 12), "Fish with no activity period is active");
    assertFalse(GameLogic.isFishActive(speciesEmptyActivity, 12), "Fish with empty activity period is inactive");

    // getBaitPreferenceScore tests
    assertEquals(GameLogic.getBaitPreferenceScore(perchSpecies, "worm"), 0.9, "Perch worm preference");
    assertEquals(GameLogic.getBaitPreferenceScore(perchSpecies, "lure"), 0.5, "Perch lure preference");
    assertEquals(GameLogic.getBaitPreferenceScore(perchSpecies, "bread"), 0.1, "Perch non-listed bait preference");
    assertEquals(GameLogic.getBaitPreferenceScore(speciesNoPrefs, "worm"), 0.1, "Fish with no bait prefs");
    assertEquals(GameLogic.getBaitPreferenceScore({ name: "Empty Prefs", baitPreferences: {} }, "worm"), 0.1, "Fish with empty bait prefs");
}

function testGameTime() {
    window.testLogger.log("--- Testing Game Time Logic ---");

    let originalHours = GameLogic.gameTimeHours;
    let originalMinutes = GameLogic.gameTimeMinutes;

    // Test 1: Basic increment
    GameLogic.gameTimeHours = 6;
    GameLogic.gameTimeMinutes = 0;
    let timeData = GameLogic.updateGameTimeData(30 / GameLogic.timeScale); // Simulate 30 game minutes
    assertEquals(GameLogic.gameTimeHours, 6, "Game time hour after 30 min");
    assertEquals(Math.floor(GameLogic.gameTimeMinutes), 30, "Game time minute after 30 min");

    // Test 2: Hour rollover
    GameLogic.gameTimeHours = 6;
    GameLogic.gameTimeMinutes = 58;
    timeData = GameLogic.updateGameTimeData(3 / GameLogic.timeScale); // Simulate 3 game minutes
    assertEquals(GameLogic.gameTimeHours, 7, "Game time hour rollover (6:58 + 3min -> 7:01)");
    assertEquals(Math.floor(GameLogic.gameTimeMinutes), 1, "Game time minute rollover (6:58 + 3min -> 7:01)");
    assertFalse(timeData.newDay, "newDay should be false after simple hour rollover");

    // Test 3: Day rollover
    GameLogic.gameTimeHours = 23;
    GameLogic.gameTimeMinutes = 58;
    timeData = GameLogic.updateGameTimeData(3 / GameLogic.timeScale); // Simulate 3 game minutes
    assertEquals(GameLogic.gameTimeHours, 0, "Game time day rollover (23:58 + 3min -> 00:01)");
    assertEquals(Math.floor(GameLogic.gameTimeMinutes), 1, "Game time minute rollover for day (23:58 + 3min -> 00:01)");
    assertTrue(timeData.newDay, "newDay should be true after day rollover");

    // Restore original time
    GameLogic.gameTimeHours = originalHours;
    GameLogic.gameTimeMinutes = originalMinutes;
}

function testFishSpawning() {
    window.testLogger.log("--- Testing Fish Spawning ---");
    // GameLogic.activeFishPopulation is exported as let, so we can clear it for a predictable test
    GameLogic.activeFishPopulation = [];

    GameLogic.spawnFishPopulation();

    assertEquals(GameLogic.activeFishPopulation.length, GameLogic.maxFishInArea, `Population should be ${GameLogic.maxFishInArea}`);
    if (GameLogic.activeFishPopulation.length > 0) {
        const firstFish = GameLogic.activeFishPopulation[0];
        assertTrue(typeof firstFish.species.name === 'string', "Spawned fish has species name");
        assertTrue(typeof firstFish.size === 'number' && firstFish.size >= firstFish.species.sizeRange[0] && firstFish.size <= firstFish.species.sizeRange[1], "Spawned fish size is within species range");
        assertTrue(typeof firstFish.depth === 'number' && firstFish.depth >= firstFish.species.preferredDepthRange[0] && firstFish.depth <= firstFish.species.preferredDepthRange[1], "Spawned fish depth is within species range");
    }
    // It's good practice for tests to clean up their own specific setups if they modify shared state.
    // For this test, subsequent tests might rely on a normally spawned population.
}


function testBiteAndHookLogic() {
    window.testLogger.log("--- Testing Bite and Hook Logic (Simplified) ---");

    // Save original states from GameLogic
    const originalFishPopulation = [...GameLogic.activeFishPopulation];
    const originalGameTimeHours = GameLogic.gameTimeHours;
    const originalCurrentBaitType = GameLogic.currentBaitType;
    let originalFishToHook = GameLogic.fishToHook; // This is 'let' in gameLogic
    let originalIsCast = GameLogic.isCast;
    let originalFishBiting = GameLogic.fishBiting;
    let originalFishHooked = GameLogic.fishHooked;
    let originalWaitingForBite = GameLogic.waitingForBite;

    // Setup for a likely bite
    GameLogic.gameTimeHours = 7;
    GameLogic.currentBaitType = "worm";
    const testPerchSpecies = GameLogic.fishSpeciesData.find(s => s.name === "River Perch");
    GameLogic.activeFishPopulation = [{ species: testPerchSpecies, size: 1.0, depth: 3.0 }];

    GameLogic.isCast = true;
    GameLogic.fishBiting = false;
    GameLogic.fishHooked = false;
    GameLogic.waitingForBite = false;
    GameLogic.fishToHook = null;

    let randomCallCount = 0;
    const mockMathRandomVals = [0.9, 0.1]; // High random factor for score, then success for bite chance
    const originalMathRandom = Math.random;
    Math.random = () => {
        const val = mockMathRandomVals[randomCallCount];
        randomCallCount++;
        return val !== undefined ? val : originalMathRandom(); // Fallback if more calls than mocked
    };

    const potentialBiter = GameLogic.checkForFishBiteLogic(GameLogic.gameTimeHours, GameLogic.currentBaitType);
    assertTrue(potentialBiter !== null && potentialBiter.species.name === "River Perch", "Perch should be a potential biter with favorable conditions");

    if (potentialBiter) {
        GameLogic.triggerBiteLogic(potentialBiter);
        assertTrue(GameLogic.fishBiting, "State fishBiting should be true after triggerBiteLogic");
        assertEquals(GameLogic.fishToHook.species.name, "River Perch", "fishToHook should be set by triggerBiteLogic");
    } else {
         window.testLogger.fail("FAIL: Prerequisite for triggerBiteLogic not met (no potential biter)");
         testsFailed++;
    }

    randomCallCount = 0; // Reset for next call

    // Test attemptHookFishLogic
    if (GameLogic.fishBiting && GameLogic.fishToHook) {
        const hookResult = GameLogic.attemptHookFishLogic();
        assertTrue(hookResult.success, "attemptHookFishLogic should succeed");
        assertEquals(hookResult.fish.species.name, "River Perch", "Hooked fish should be Perch");
        assertTrue(GameLogic.fishHooked, "fishHooked should be true after successful attemptHookFishLogic");
        assertFalse(GameLogic.fishBiting, "fishBiting should be false after successful attemptHookFishLogic");
        assertEquals(GameLogic.lineTension, 0, "Line tension should be reset on hook");

    } else {
        window.testLogger.fail("FAIL: Prerequisite for attemptHookFishLogic not met (fish not biting or fishToHook not set)");
        testsFailed++;
    }

    // Restore original Math.random and other globals
    Math.random = originalMathRandom;
    GameLogic.activeFishPopulation = originalFishPopulation; // Restore
    GameLogic.gameTimeHours = originalGameTimeHours;
    GameLogic.currentBaitType = originalCurrentBaitType;
    GameLogic.fishToHook = originalFishToHook; // Critical to restore
    GameLogic.isCast = originalIsCast;
    GameLogic.fishBiting = originalFishBiting;
    GameLogic.fishHooked = originalFishHooked;
    GameLogic.waitingForBite = originalWaitingForBite;
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
