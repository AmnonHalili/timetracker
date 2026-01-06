const dailyTarget = undefined;

console.log("Testing with dailyTarget = undefined (Fixed Logic)");

if (dailyTarget !== undefined && dailyTarget !== null && (typeof dailyTarget !== 'number' || dailyTarget < 0)) {
    console.log("FAIL: Logic still flags undefined as invalid");
} else {
    console.log("PASS: Logic correctly ignores undefined");
}

const dailyTargetNull = null;
console.log("\nTesting with dailyTarget = null (Fixed Logic)");
if (dailyTargetNull !== undefined && dailyTargetNull !== null && (typeof dailyTargetNull !== 'number' || dailyTargetNull < 0)) {
    console.log("FAIL: Logic incorrectly flagged null as invalid");
} else {
    console.log("PASS: Logic correctly ignores null");
}

const dailyTargetValid = 8;
console.log("\nTesting with dailyTarget = 8 (Fixed Logic)");
if (dailyTargetValid !== undefined && dailyTargetValid !== null && (typeof dailyTargetValid !== 'number' || dailyTargetValid < 0)) {
    console.log("FAIL: Logic incorrectly flagged 8 as invalid");
} else {
    console.log("PASS: Logic correctly validates 8");
}

const dailyTargetInvalid = -5;
console.log("\nTesting with dailyTarget = -5 (Fixed Logic)");
if (dailyTargetInvalid !== undefined && dailyTargetInvalid !== null && (typeof dailyTargetInvalid !== 'number' || dailyTargetInvalid < 0)) {
    console.log("PASS: Logic correctly flagged -5 as invalid");
} else {
    console.log("FAIL: Logic failed to flag -5 as invalid");
}
