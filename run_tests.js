// run_tests.js
import * as GameTests from './game.test.js'; // Assuming game.test.js uses ES6 modules and exports its test runner

// Simple console logger to mimic window.testLogger used in test.html
const consoleTestLogger = {
    log: (msg) => console.log(msg),
    pass: (msg) => console.log(`\x1b[32m${msg}\x1b[0m`), // Green text for pass
    fail: (msg) => console.error(`\x1b[31m${msg}\x1b[0m`), // Red text for fail
    summarize: (passed, failed) => {
        const summaryMsg = `Test Summary: ${passed} passed, ${failed} failed.`;
        if (failed > 0) {
            console.error(`\x1b[31m${summaryMsg}\x1b[0m`);
        } else {
            console.log(`\x1b[32m${summaryMsg}\x1b[0m`);
        }
        // Exit with error code if any tests failed, for CI/automation purposes
        if (failed > 0) {
            process.exit(1);
        }
    }
};

// Make the logger globally available for game.test.js if it expects window.testLogger
// A more robust solution would be for game.test.js to accept a logger instance.
global.window = { testLogger: consoleTestLogger }; // Basic shim for window.testLogger

// game.test.js is expected to have a main function to run all its tests,
// e.g., runAllGameTests(), which then uses window.testLogger.
// If game.test.js runs its tests immediately upon import, this might be enough.
// Otherwise, we need to call its main test execution function.

if (GameTests.runAllGameTests && typeof GameTests.runAllGameTests === 'function') {
    console.log("Executing tests from game.test.js using runAllGameTests()...");
    GameTests.runAllGameTests(); // This function should use global.window.testLogger
} else {
    // If game.test.js automatically runs tests on import and uses window.testLogger,
    // the import itself might have triggered them. We just provide the summary setup.
    // This part is a bit dependent on how game.test.js was structured to be run.
    // For the current game.test.js, it calls runAllGameTests() at the end if window.testLogger is found.
    console.log("game.test.js imported. Tests should have run if it auto-executes via window.testLogger.");
    // If tests ran automatically, the summary would have been called by game.test.js.
    // If not, this script might need to explicitly call a summary function if game.test.js
    // only collects stats. However, the current game.test.js calls summarize itself.
}

// Note: This runner assumes gameLogic.js and its dependencies (like PlayerInventory.js)
// are pure ES6 JavaScript modules and do not contain direct browser-specific APIs
// that would cause errors in Node.js (e.g., `document`, `window` properties not shimmed,
// `fetch` without a polyfill, etc.). The refactoring aims to achieve this for gameLogic.js.
// Three.js specific imports within gameLogic.js would require further setup for Node.js
// (e.g., using a headless WebGL implementation or specific Node-compatible Three.js builds),
// but the goal was to make gameLogic.js free of these for unit testing its core logic.
// The current gameLogic.js does import PlayerInventory, which should be fine.
// It does NOT import 'three' directly, which is good for Node.js testing of pure logic.
// The `game.test.js` imports `gameLogic.js` which is what we are testing.
// The `game.js` (browser part) would not be directly run by this Node.js script.

console.log("Node.js test execution script finished.");
