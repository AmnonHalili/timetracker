const dailyTarget = undefined;

console.log("Testing with dailyTarget = undefined");

if (dailyTarget !== null && (typeof dailyTarget !== 'number' || dailyTarget < 0)) {
    console.log("FAIL: Logic incorrectly flagged undefined as invalid");
} else {
    console.log("PASS: Logic correctly handled undefined");
}

const dailyTargetNull = null;
console.log("\nTesting with dailyTarget = null");
if (dailyTargetNull !== null && (typeof dailyTargetNull !== 'number' || dailyTargetNull < 0)) {
    console.log("FAIL: Logic incorrectly flagged null as invalid");
} else {
    console.log("PASS: Logic correctly handled null");
}

const dailyTargetValid = 8;
console.log("\nTesting with dailyTarget = 8");
if (dailyTargetValid !== null && (typeof dailyTargetValid !== 'number' || dailyTargetValid < 0)) {
    console.log("FAIL: Logic incorrectly flagged 8 as invalid");
} else {
    console.log("PASS: Logic correctly handled 8");
}
