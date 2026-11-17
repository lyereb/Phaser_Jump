"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const modelPath = path.join(root, "src/game/rankChaseProgress.ts");
const resultsPath = path.join(__dirname, "validation/model-results.json");
const source = fs.readFileSync(modelPath, "utf8");
const output = ts.transpileModule(source, {
    fileName: modelPath,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, removeComments: true }
});
const loaded = new Module(modelPath, module);
loaded.filename = modelPath;
loaded.paths = Module._nodeModulePaths(path.dirname(modelPath));
loaded._compile(output.outputText, modelPath);
const { RankChaseProgress } = loaded.exports;

function entry(meters, id = `bot-${meters}`, rank = 1) {
    return { id, name: id, meters, avatar: rank, isSelf: false, rank };
}

function snapshot(best = 0, weekKey = "2026-11-09", entries) {
    const opponents = entries ?? [1000, 800, 600, 400, 200].map((meters, index) => entry(meters, `bot-${meters}`, index + 1));
    const ranked = opponents.map(value => ({ ...value }));
    const normalizedBest = Number.isFinite(best) && best >= 0 && Number.isSafeInteger(Math.floor(best)) ? Math.floor(best) : 0;
    if (normalizedBest > 0) ranked.push({ id: "self", name: "我", meters: normalizedBest, avatar: 5, isSelf: true, rank: 0 });
    ranked.sort((a, b) => b.meters - a.meters || Number(a.isSelf) - Number(b.isSelf) || a.avatar - b.avatar);
    ranked.forEach((value, index) => { value.rank = index + 1; });
    const self = ranked.find(value => value.isSelf);
    return {
        weekKey, start: 0, end: 1, dateLabel: weekKey,
        topFive: ranked.slice(0, 5), selfBest: best, selfRank: self?.rank ?? null,
        gapToTopFive: 0, gapToNext: 0
    };
}

function scores(update) { return update.overtaken.map(value => value.meters); }
function target(update) { return update.state.target?.meters ?? null; }
const tests = [];
function test(name, run) {
    try {
        run();
        tests.push({ name, passed: true });
        console.log(`PASS ${name}`);
    } catch (error) {
        tests.push({ name, passed: false, error: error.stack ?? String(error) });
        console.error(`FAIL ${name}\n${error.stack ?? error}`);
    }
}

test("initial target is 200 with 201 round meters remaining", () => {
    const board = snapshot();
    const model = new RankChaseProgress(board);
    const result = model.update(board, 0);
    assert.equal(target(result), 200);
    assert.deepEqual(result.state, { target: entry(200, "bot-200", 5), remaining: 201, leading: false, best: 0, meters: 0 });
    assert.deepEqual(scores(result), []);
});

test("0 to 200 is a tie, not an overtake", () => {
    const model = new RankChaseProgress(snapshot());
    const result = model.update(snapshot(200), 200, true);
    assert.equal(target(result), 200);
    assert.equal(result.state.remaining, 1);
    assert.deepEqual(scores(result), []);
});

test("201 beats 200 and selects 400", () => {
    const model = new RankChaseProgress(snapshot());
    model.update(snapshot(200), 200, true);
    const result = model.update(snapshot(201), 201, true);
    assert.deepEqual(scores(result), [200]);
    assert.equal(target(result), 400);
    assert.equal(result.state.remaining, 200);
    assert.equal(result.state.best, 201);
});

test("weekly best 210 with a new round at zero chases 400 with gap 401", () => {
    const model = new RankChaseProgress(snapshot(210));
    const result = model.update(snapshot(210), 0, true);
    assert.equal(target(result), 400);
    assert.equal(result.state.remaining, 401);
    assert.equal(result.state.best, 210);
    assert.equal(result.state.meters, 0);
    assert.deepEqual(scores(result), []);
});

test("weekly best 400 and round 400 still need one meter", () => {
    const model = new RankChaseProgress(snapshot(400));
    assert.equal(model.update(snapshot(400), 0).state.remaining, 401);
    const tied = model.update(snapshot(400), 400, true);
    assert.equal(target(tied), 400);
    assert.equal(tied.state.remaining, 1);
    assert.deepEqual(scores(tied), []);
    assert.deepEqual(scores(model.update(snapshot(401), 401, true)), [400]);
});

test("1001 is leading with no target or remaining gap", () => {
    const model = new RankChaseProgress(snapshot());
    const result = model.update(snapshot(1001), 1001, true);
    assert.equal(result.state.leading, true);
    assert.equal(result.state.target, null);
    assert.equal(result.state.remaining, 0);
    assert.equal(result.state.best, 1001);
});

test("an existing weekly first place remains leading in a zero-meter new round", () => {
    const model = new RankChaseProgress(snapshot(1001));
    const result = model.update(snapshot(1001), 0, true);
    assert.equal(result.state.leading, true);
    assert.equal(result.state.remaining, 0);
    assert.equal(result.state.best, 1001);
    assert.equal(result.state.meters, 0);
    assert.deepEqual(scores(result), []);
});

test("each of five rivals is celebrated once in ascending progression", () => {
    const model = new RankChaseProgress(snapshot());
    const all = [];
    for (const meters of [201, 401, 601, 801, 1001]) {
        const result = model.update(snapshot(meters), meters, true);
        assert.deepEqual(scores(result), [meters - 1]);
        all.push(...scores(result));
        assert.deepEqual(scores(model.update(snapshot(meters), meters, true)), []);
    }
    assert.deepEqual(all, [200, 400, 600, 800, 1000]);
});

test("a single 0 to 1001 jump includes evicted 200 and returns all five sorted", () => {
    const model = new RankChaseProgress(snapshot());
    const board = snapshot(1001);
    assert.equal(board.topFive.some(value => value.meters === 200), false);
    const result = model.update(board, 1001, true);
    assert.deepEqual(scores(result), [200, 400, 600, 800, 1000]);
    assert.equal(new Set(result.overtaken.map(value => value.id)).size, 5);
});

test("low-score restarts do not replay previously overtaken rivals", () => {
    const model = new RankChaseProgress(snapshot());
    assert.deepEqual(scores(model.update(snapshot(601), 601, true)), [200, 400, 600]);
    assert.deepEqual(scores(model.update(snapshot(601), 0, true)), []);
    for (const meters of [201, 401, 601]) {
        assert.deepEqual(scores(model.update(snapshot(601), meters, true)), []);
    }
    const result = model.update(snapshot(801), 801, true);
    assert.deepEqual(scores(result), [800]);
});

test("default celebrate false consumes crossings without replay", () => {
    const model = new RankChaseProgress(snapshot());
    assert.deepEqual(scores(model.update(snapshot(401), 401)), []);
    assert.deepEqual(scores(model.update(snapshot(402), 402, true)), []);
    assert.deepEqual(scores(model.update(snapshot(601), 601, true)), [600]);
});

test("explicit celebrate false never announces an external score update", () => {
    const model = new RankChaseProgress(snapshot());
    const result = model.update(snapshot(801), 0, false);
    assert.deepEqual(scores(result), []);
    assert.equal(target(result), 1000);
    assert.equal(result.state.remaining, 1001);
    assert.deepEqual(scores(model.update(snapshot(801), 801, true)), []);
    assert.deepEqual(scores(model.update(snapshot(1001), 1001, true)), [1000]);
});

test("external leaderboard movement without new round progress is silent", () => {
    const model = new RankChaseProgress(snapshot(210));
    model.update(snapshot(210), 210, true);
    const changed = snapshot(210, undefined, [entry(150, "bot-400"), entry(600)]);
    const result = model.update(changed, 210, true);
    assert.deepEqual(scores(result), []);
    assert.equal(target(result), 600);
});

test("constructor with existing current-round progress silently establishes baseline", () => {
    const model = new RankChaseProgress(snapshot(), 601);
    const result = model.update(snapshot(601), 601, true);
    assert.deepEqual(scores(result), []);
    assert.equal(target(result), 800);
    assert.deepEqual(scores(model.update(snapshot(801), 801, true)), [800]);
});

test("constructor with an existing leading score does not replay any rival", () => {
    const model = new RankChaseProgress(snapshot(), 1001);
    const result = model.update(snapshot(1002), 1002, true);
    assert.equal(result.state.leading, true);
    assert.deepEqual(scores(result), []);
});

test("changing week resets identity tracking without replaying the old week", () => {
    const model = new RankChaseProgress(snapshot());
    assert.deepEqual(scores(model.update(snapshot(201), 201, true)), [200]);
    const reset = model.update(snapshot(0, "2026-11-16"), 0, true);
    assert.equal(target(reset), 200);
    assert.deepEqual(scores(reset), []);
    assert.deepEqual(scores(model.update(snapshot(201, "2026-11-16"), 201, true)), [200]);
});

test("a changed week with an existing weekly best is silent", () => {
    const model = new RankChaseProgress(snapshot());
    const reset = model.update(snapshot(801, "2026-11-16"), 0, true);
    assert.deepEqual(scores(reset), []);
    assert.equal(target(reset), 1000);
    assert.equal(reset.state.remaining, 1001);
    assert.deepEqual(scores(model.update(snapshot(801, "2026-11-16"), 801, true)), []);
});

test("a changed week with current-round progress is also silent", () => {
    const model = new RankChaseProgress(snapshot());
    const reset = model.update(snapshot(0, "2026-11-16"), 1001, true);
    assert.deepEqual(scores(reset), []);
    assert.equal(reset.state.leading, true);
    assert.deepEqual(scores(model.update(snapshot(1002, "2026-11-16"), 1002, true)), []);
});

test("a newly added lower opponent immediately becomes the current target", () => {
    const model = new RankChaseProgress(snapshot(210));
    const result = model.update(snapshot(210, undefined, [entry(250), entry(400)]), 0, true);
    assert.equal(target(result), 250);
    assert.equal(result.state.remaining, 251);
    assert.deepEqual(scores(result), []);
});

test("a removed target is not retained as a future target or delayed celebration", () => {
    const model = new RankChaseProgress(snapshot(0, undefined, [entry(200), entry(400)]));
    const removed = snapshot(0, undefined, [entry(400)]);
    const result = model.update(removed, 0, true);
    assert.equal(target(result), 400);
    assert.deepEqual(scores(result), []);
    assert.deepEqual(scores(model.update(snapshot(201, undefined, [entry(400)]), 201, true)), []);
    assert.equal(target(model.update(removed, 0)), 400);
});

test("same-week opponent score and name refresh replace stale target data", () => {
    const model = new RankChaseProgress(snapshot(210, undefined, [entry(400, "rival")]));
    const updated = { ...entry(500, "rival"), name: "updated rival" };
    const result = model.update(snapshot(210, undefined, [updated]), 0, true);
    assert.equal(target(result), 500);
    assert.equal(result.state.target.name, "updated rival");
    assert.equal(result.state.remaining, 501);
    assert.deepEqual(scores(result), []);
});

test("removing all opponents clears the target immediately", () => {
    const model = new RankChaseProgress(snapshot());
    const result = model.update(snapshot(0, undefined, []), 0, true);
    assert.equal(result.state.leading, true);
    assert.equal(result.state.target, null);
    assert.equal(result.state.remaining, 0);
    assert.deepEqual(scores(result), []);
});

test("a removed old target is captured only during its immediate crossing", () => {
    const model = new RankChaseProgress(snapshot(0, undefined, [entry(200), entry(400), entry(600)]));
    const result = model.update(snapshot(601, undefined, []), 601, true);
    assert.deepEqual(scores(result), [200]);
    assert.equal(result.state.leading, true);
    assert.deepEqual(scores(model.update(snapshot(602, undefined, []), 602, true)), []);
});

test("same identity is deduplicated and never celebrated again after score refresh", () => {
    const board = snapshot(0, undefined, [entry(200, "same"), entry(200, "same"), entry(400, "other")]);
    const model = new RankChaseProgress(board);
    const first = model.update(snapshot(401, undefined, board.topFive), 401, true);
    assert.deepEqual(scores(first), [200, 400]);
    assert.equal(new Set(first.overtaken.map(value => value.id)).size, 2);
    const changed = snapshot(601, undefined, [entry(600, "same"), entry(400, "other")]);
    assert.deepEqual(scores(model.update(changed, 601, true)), []);
});

test("duplicate identity with conflicting scores uses the highest valid score", () => {
    const board = snapshot(0, undefined, [entry(200, "same"), entry(400, "same")]);
    const model = new RankChaseProgress(board);
    assert.equal(target(model.update(board, 0)), 400);
    assert.deepEqual(scores(model.update(snapshot(401, undefined, board.topFive), 401, true)), [400]);
});

test("equal-score opponents are both overtaken only after the extra meter", () => {
    const entries = [entry(200, "a", 1), entry(200, "b", 2), entry(400, "c", 3)];
    const model = new RankChaseProgress(snapshot(0, undefined, entries));
    assert.deepEqual(scores(model.update(snapshot(200, undefined, entries), 200, true)), []);
    const result = model.update(snapshot(201, undefined, entries), 201, true);
    assert.deepEqual(scores(result), [200, 200]);
    assert.deepEqual(result.overtaken.map(value => value.id), ["a", "b"]);
    assert.equal(target(result), 400);
});

test("NaN, negative, infinite, and unsafe round scores normalize to zero", () => {
    for (const meters of [NaN, -1, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        const model = new RankChaseProgress(snapshot(), meters);
        const result = model.update(snapshot(), meters, true);
        assert.equal(result.state.meters, 0);
        assert.equal(result.state.best, 0);
        assert.equal(result.state.remaining, 201);
        assert.deepEqual(scores(result), []);
    }
});

test("fractional meters and best are floored and ties still require one meter", () => {
    const model = new RankChaseProgress(snapshot());
    const tie = model.update(snapshot(200.9), 200.9, true);
    assert.equal(tie.state.meters, 200);
    assert.equal(tie.state.best, 200);
    assert.equal(tie.state.remaining, 1);
    assert.deepEqual(scores(tie), []);
    assert.deepEqual(scores(model.update(snapshot(201.9), 201.9, true)), [200]);
    const newRound = new RankChaseProgress(snapshot(210.9));
    assert.equal(newRound.update(snapshot(210.9), 0).state.best, 210);
});

test("invalid opponent scores are ignored and fractional opponent scores are floored", () => {
    const board = snapshot(NaN, undefined, []);
    board.topFive = [entry(NaN), entry(-200), entry(Infinity), entry(Number.MAX_SAFE_INTEGER + 1), entry(200.9, "valid")];
    const model = new RankChaseProgress(board);
    const result = model.update(board, 0, true);
    assert.equal(target(result), 200);
    assert.equal(result.state.remaining, 201);
    assert.equal(result.state.best, 0);
    assert.deepEqual(scores(model.update(board, 201, true)), [200]);
});

test("negative and non-finite weekly best normalize to zero", () => {
    for (const best of [NaN, -1, Infinity]) {
        const board = snapshot(best);
        const model = new RankChaseProgress(board);
        const result = model.update(board, 0, true);
        assert.equal(result.state.best, 0);
        assert.equal(target(result), 200);
        assert.deepEqual(scores(result), []);
    }
});

test("isSelf entries can never become opponents or overtake events", () => {
    const board = snapshot(0, undefined, [entry(200), { ...entry(50, "custom-player"), isSelf: true }]);
    const model = new RankChaseProgress(board);
    assert.equal(target(model.update(board, 0)), 200);
    assert.deepEqual(scores(model.update(snapshot(201, undefined, board.topFive), 201, true)), [200]);
});

test("mutating returned state and target cannot corrupt a later evicted-target crossing", () => {
    const model = new RankChaseProgress(snapshot());
    const result = model.update(snapshot(), 0);
    result.state.target.id = "corrupted";
    result.state.target.meters = 9999;
    result.state.best = 9999;
    result.state.meters = 9999;
    result.state.remaining = -1;
    result.state.leading = true;
    result.overtaken.push(entry(1, "injected"));
    const next = model.update(snapshot(1001), 1001, true);
    assert.deepEqual(scores(next), [200, 400, 600, 800, 1000]);
    assert.equal(next.state.best, 1001);
    assert.equal(next.state.remaining, 0);
});

test("mutating input snapshots cannot alter retained opponents", () => {
    const original = snapshot();
    const model = new RankChaseProgress(original);
    original.topFive.find(value => value.meters === 200).meters = 9999;
    original.topFive.length = 0;
    original.selfBest = 9999;
    const result = model.update(snapshot(201), 201, true);
    assert.deepEqual(scores(result), [200]);
    assert.equal(target(result), 400);
});

test("returned overtaken entries and later targets are independent copies", () => {
    const model = new RankChaseProgress(snapshot());
    const first = model.update(snapshot(201), 201, true);
    first.overtaken[0].id = "corrupted";
    first.overtaken[0].meters = 9999;
    first.state.target.meters = 9999;
    const next = model.update(snapshot(201), 0, true);
    assert.equal(target(next), 400);
    assert.equal(next.state.remaining, 401);
    assert.deepEqual(scores(model.update(snapshot(402), 402, true)), [400]);
    assert.equal(next.state.target.meters, 400);
    assert.deepEqual(scores(model.update(snapshot(402), 201, true)), []);
});

test("transpiled model has no runtime imports or Phaser dependency", () => {
    assert.match(source, /^import type \{ RankedEntry, WeeklySnapshot \} from "\.\/weeklyLeaderboard";/);
    assert.doesNotMatch(output.outputText, /require\s*\(/);
    assert.doesNotMatch(output.outputText, /\bphaser\b/i);
});

const compilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2020.d.ts", "lib.dom.d.ts"],
    strict: true,
    strictPropertyInitialization: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedSideEffectImports: true,
    isolatedModules: true,
    skipLibCheck: true,
    noEmit: true
};
const program = ts.createProgram([modelPath], compilerOptions);
const diagnostics = ts.getPreEmitDiagnostics(program).map(diagnostic => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (!diagnostic.file || diagnostic.start === undefined) return message;
    const location = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file.fileName}:${location.line + 1}:${location.character + 1}: ${message}`;
});
test("strict noEmit type check with noUnusedLocals and noUnusedParameters", () => {
    assert.deepEqual(diagnostics, []);
});

const passed = tests.filter(value => value.passed).length;
const failed = tests.length - passed;
const results = {
    passed,
    failed,
    total: tests.length,
    typeCheck: { passed: diagnostics.length === 0, compilerOptions, diagnostics },
    tests,
    files: { model: modelPath, test: __filename, results: resultsPath }
};
fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2) + "\n", "utf8");
console.log(`\n${passed}/${tests.length} tests passed; ${failed} failed.`);
console.log(`Results: ${resultsPath}`);
if (failed > 0) process.exitCode = 1;
