'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(root, 'src', 'game', 'weeklyLeaderboard.ts');
const resultsPath = path.join(__dirname, 'validation', 'model-results.json');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true }
});
const tests = [];
const plain = value => JSON.parse(JSON.stringify(value));

function test(name, run)
{
    try
    {
        run();
        tests.push({ name, status: 'passed' });
    }
    catch (error)
    {
        tests.push({ name, status: 'failed', error: error.stack || String(error) });
    }
}

function load(options = {})
{
    const exports = {};
    const sandbox = { module: { exports }, exports };
    if (options.getLocalStorage)
    {
        Object.defineProperty(sandbox, 'localStorage', { get: options.getLocalStorage });
    }
    else if (Object.hasOwn(options, 'localStorage'))
    {
        sandbox.localStorage = options.localStorage;
    }
    vm.runInNewContext(compiled.outputText, sandbox, { filename: sourcePath });
    return sandbox.module.exports;
}

function store()
{
    const values = new Map();
    const writes = [];
    return {
        values,
        writes,
        getItem(key) { return values.get(key) ?? null; },
        setItem(key, value) { writes.push({ key, value }); values.set(key, value); }
    };
}

const exported = load();
const { WeeklyLeaderboard, WEEKLY_LEADERBOARD_KEY } = exported;
const key = WEEKLY_LEADERBOARD_KEY;
const fixedNow = () => new Date(2026, 10, 11, 12, 30);
function board(storage = store(), now = fixedNow, storageKey = key)
{
    return new WeeklyLeaderboard(storageKey, now, storage);
}

function timezoneTests()
{
    const zone = process.env.TZ;
    if (zone === 'Asia/Shanghai')
    {
        test('Asia/Shanghai: UTC Sunday is already local Monday', () => {
            const snapshot = board(store(), () => new Date('2026-11-08T16:30:00Z')).snapshot();
            assert.equal(new Date('2026-11-08T16:30:00Z').getTimezoneOffset(), -480);
            assert.equal(snapshot.weekKey, '2026-11-09');
            assert.equal(snapshot.start, new Date(2026, 10, 9).getTime());
        });
        test('Asia/Shanghai: local midnight, not UTC midnight, resets best', () => {
            let now = new Date('2026-11-08T15:59:59.999Z');
            const model = board(store(), () => now);
            model.record(1001);
            assert.equal(model.snapshot().weekKey, '2026-11-02');
            now = new Date('2026-11-08T16:00:00Z');
            assert.equal(model.snapshot().weekKey, '2026-11-09');
            assert.equal(model.snapshot().selfBest, 0);
        });
    }
    else if (zone === 'America/Los_Angeles')
    {
        test('America/Los_Angeles: UTC Monday is still local Sunday', () => {
            const snapshot = board(store(), () => new Date('2026-11-09T00:30:00Z')).snapshot();
            assert.equal(new Date('2026-11-09T00:30:00Z').getTimezoneOffset(), 480);
            assert.equal(snapshot.weekKey, '2026-11-02');
            assert.equal(snapshot.dateLabel, '11.02 — 11.08');
        });
        test('America/Los_Angeles: local Monday 00:00 changes week', () => {
            const snapshot = board(store(), () => new Date('2026-11-09T08:00:00Z')).snapshot();
            assert.equal(snapshot.weekKey, '2026-11-09');
            assert.equal(new Date(snapshot.start).getHours(), 0);
            assert.equal(new Date(snapshot.end).getHours(), 0);
        });
    }
    else if (zone === 'America/New_York')
    {
        test('America/New_York: DST spring week spans 167 actual hours', () => {
            const snapshot = board(store(), () => new Date(2026, 2, 4, 12)).snapshot();
            assert.equal(snapshot.weekKey, '2026-03-02');
            assert.equal(snapshot.dateLabel, '03.02 — 03.08');
            assert.equal(snapshot.end - snapshot.start, 167 * 60 * 60 * 1000);
            assert.equal(new Date(snapshot.start).getHours(), 0);
            assert.equal(new Date(snapshot.end).getHours(), 0);
        });
        test('America/New_York: DST fall week spans 169 actual hours', () => {
            const snapshot = board(store(), () => new Date(2026, 9, 28, 12)).snapshot();
            assert.equal(snapshot.weekKey, '2026-10-26');
            assert.equal(snapshot.dateLabel, '10.26 — 11.01');
            assert.equal(snapshot.end - snapshot.start, 169 * 60 * 60 * 1000);
            assert.equal(new Date(snapshot.end).getDay(), 1);
            assert.equal(new Date(snapshot.end).getHours(), 0);
        });
    }
    else if (zone === 'UTC')
    {
        test('UTC: Sunday final millisecond belongs to the old week', () => {
            const snapshot = board(store(), () => new Date('2026-11-08T23:59:59.999Z')).snapshot();
            assert.equal(new Date(snapshot.start).getTimezoneOffset(), 0);
            assert.equal(snapshot.weekKey, '2026-11-02');
        });
        test('UTC: Monday midnight belongs to the new week', () => {
            const snapshot = board(store(), () => new Date('2026-11-09T00:00:00Z')).snapshot();
            assert.equal(snapshot.weekKey, '2026-11-09');
            assert.equal(snapshot.dateLabel, '11.09 — 11.15');
        });
    }
    else
    {
        test('Known timezone worker', () => assert.fail(`Unsupported timezone ${zone}`));
    }
    process.stdout.write(JSON.stringify({ timezone: zone, tests }));
    process.exitCode = tests.some(item => item.status === 'failed') ? 1 : 0;
}

function mainTests()
{
    test('Existing TypeScript transpileModule succeeds and public runtime exports match', () => {
        assert.equal((compiled.diagnostics ?? []).length, 0);
        assert.deepEqual(Object.keys(exported).sort(), ['WEEKLY_LEADERBOARD_KEY', 'WeeklyLeaderboard']);
        assert.equal(key, 'phaser-jump-weekly-leaderboard');
    });
    test('Model passes the project strict/noUnused TypeScript options without emitting files', () => {
        const configPath = path.join(root, 'tsconfig.json');
        const config = ts.readConfigFile(configPath, ts.sys.readFile);
        assert.equal(config.error, undefined);
        const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
        assert.equal(parsed.errors.length, 0);
        const program = ts.createProgram([sourcePath], { ...parsed.options, noEmit: true, incremental: false });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCanonicalFileName: fileName => fileName,
            getCurrentDirectory: () => root,
            getNewLine: () => '\n'
        }));
    });
    test('Initial five bots have fixed names, scores, avatars and ranks', () => {
        const snapshot = board().snapshot();
        assert.deepEqual(plain(snapshot.topFive).map(entry => [entry.name, entry.meters, entry.avatar, entry.isSelf, entry.rank]), [
            ['小明', 1000, 0, false, 1], ['小红', 800, 1, false, 2], ['小刚', 600, 2, false, 3],
            ['小李', 400, 3, false, 4], ['小夏', 200, 4, false, 5]
        ]);
        assert.equal(new Set(snapshot.topFive.map(entry => entry.id)).size, 5);
    });
    test('Initial self metrics and local Monday/end-exclusive date label', () => {
        const snapshot = board().snapshot();
        assert.equal(snapshot.selfBest, 0);
        assert.equal(snapshot.selfRank, null);
        assert.equal(snapshot.gapToTopFive, 201);
        assert.equal(snapshot.gapToNext, 201);
        assert.equal(snapshot.weekKey, '2026-11-09');
        assert.equal(snapshot.dateLabel, '11.09 — 11.15');
        assert.equal(snapshot.start, new Date(2026, 10, 9).getTime());
        assert.equal(snapshot.end, new Date(2026, 10, 16).getTime());
    });
    for (const [meters, rank, nextGap] of [[210, 5, 191], [410, 4, 191], [1001, 1, 0]])
    {
        test(`${meters} meters gives self rank ${rank} and the correct gap`, () => {
            const model = board();
            assert.equal(model.record(meters), true);
            const snapshot = model.snapshot();
            assert.equal(snapshot.selfBest, meters);
            assert.equal(snapshot.selfRank, rank);
            assert.equal(snapshot.gapToTopFive, 0);
            assert.equal(snapshot.gapToNext, nextGap);
            assert.deepEqual(plain(snapshot.topFive[rank - 1]), { id: 'self', name: '我', meters, avatar: 5, isSelf: true, rank });
            assert.equal(snapshot.topFive.length, 5);
            assert.equal(snapshot.topFive.some(entry => entry.name === '小夏'), false);
        });
    }
    for (const [meters, rank, nextGap] of [[200, 6, 1], [400, 5, 1], [600, 4, 1], [800, 3, 1], [1000, 2, 1]])
    {
        test(`Tie at ${meters}: matching bot precedes self deterministically`, () => {
            const model = board();
            model.record(meters);
            const first = model.snapshot();
            assert.equal(first.selfRank, rank);
            assert.equal(first.gapToNext, nextGap);
            assert.equal(first.topFive[rank - 2].meters, meters);
            assert.equal(first.topFive[rank - 2].isSelf, false);
            assert.equal(first.gapToTopFive, rank === 6 ? 1 : 0);
            assert.deepEqual(plain(model.snapshot()), plain(first));
        });
    }
    test('Positive low score is rank six outside top five with exact exceed gaps', () => {
        const model = board();
        model.record(1);
        const snapshot = model.snapshot();
        assert.equal(snapshot.selfRank, 6);
        assert.equal(snapshot.gapToTopFive, 200);
        assert.equal(snapshot.gapToNext, 200);
        assert.equal(snapshot.topFive.some(entry => entry.isSelf), false);
    });
    test('Zero score does not enter the leaderboard or write storage', () => {
        const storage = store();
        const model = board(storage);
        assert.equal(model.record(0), false);
        assert.equal(model.record(-0), false);
        assert.equal(model.snapshot().selfRank, null);
        assert.equal(storage.writes.length, 0);
    });
    test('Lower and equal scores do not overwrite the persisted maximum', () => {
        const storage = store();
        const model = board(storage);
        assert.equal(model.record(410), true);
        const saved = storage.values.get(key);
        assert.equal(model.record(210), false);
        assert.equal(model.record(410), false);
        assert.equal(model.snapshot().selfBest, 410);
        assert.equal(storage.values.get(key), saved);
        assert.equal(storage.writes.length, 1);
    });
    test('Fractional scores are floored to whole meters, including sub-one values', () => {
        const model = board();
        assert.equal(model.record(0.9), false);
        assert.equal(model.record(210.9), true);
        assert.equal(model.snapshot().selfBest, 210);
        assert.equal(model.record(210.99), false);
        assert.equal(model.record(211.1), true);
        assert.equal(model.snapshot().selfBest, 211);
    });
    test('NaN, infinities, negatives, unsafe and runtime non-number inputs are harmless', () => {
        const model = board();
        model.record(410);
        for (const invalid of [NaN, Infinity, -Infinity, -1, -0.1, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER + 1, undefined, null, '900', {}, 210n])
        {
            assert.equal(model.record(invalid), false, `Input ${String(invalid)}`);
        }
        assert.equal(model.snapshot().selfBest, 410);
    });
    test('Largest safe integer is accepted without nonfinite gaps', () => {
        const model = board();
        assert.equal(model.record(Number.MAX_SAFE_INTEGER), true);
        assert.equal(model.snapshot().selfRank, 1);
        assert.equal(model.snapshot().gapToNext, 0);
        assert.equal(model.snapshot().gapToTopFive, 0);
    });
    test('Fresh module/instance reload reads the stored weekly maximum', () => {
        const storage = store();
        board(storage).record(410);
        const refreshed = new (load().WeeklyLeaderboard)(key, fixedNow, storage);
        assert.equal(refreshed.snapshot().selfBest, 410);
        assert.equal(refreshed.snapshot().selfRank, 4);
    });
    test('Same-key instances immediately see each other through snapshot', () => {
        const storage = store();
        const first = board(storage);
        const second = board(storage);
        first.record(210);
        assert.equal(second.snapshot().selfBest, 210);
        second.record(1001);
        assert.equal(first.snapshot().selfBest, 1001);
    });
    test('Same-key stale low-score instance cannot overwrite a saved high score', () => {
        const storage = store();
        const first = board(storage);
        const second = board(storage);
        second.snapshot();
        first.record(1001);
        assert.equal(second.record(410), false);
        assert.equal(JSON.parse(storage.values.get(key)).best, 1001);
        assert.equal(storage.writes.length, 1);
    });
    test('Different adapters sharing persistent data still synchronize by key', () => {
        const storage = store();
        const wrap = () => ({ getItem: name => storage.getItem(name), setItem: (name, value) => storage.setItem(name, value) });
        const first = board(wrap());
        const second = board(wrap());
        first.record(1001);
        assert.equal(second.snapshot().selfBest, 1001);
        assert.equal(second.record(210), false);
        assert.equal(JSON.parse(storage.values.get(key)).best, 1001);
    });
    test('Different storage keys are isolated', () => {
        const storage = store();
        board(storage, fixedNow, 'custom-a').record(1001);
        assert.equal(board(storage, fixedNow, 'custom-b').snapshot().selfBest, 0);
        assert.equal(board(storage, fixedNow, 'custom-a').snapshot().selfBest, 1001);
    });
    test('Independent stores with the same key do not leak in-memory scores', () => {
        board(store()).record(1001);
        assert.equal(board(store()).snapshot().selfBest, 0);
    });
    test('Broken JSON starts clean and the next valid score repairs persistence', () => {
        const storage = store();
        storage.values.set(key, '{broken');
        const model = board(storage);
        assert.equal(model.snapshot().selfBest, 0);
        assert.equal(model.record(210), true);
        assert.deepEqual(JSON.parse(storage.values.get(key)), { weekKey: '2026-11-09', best: 210 });
    });
    test('Malformed JSON shapes and invalid persisted scores are ignored safely', () => {
        const invalidValues = [null, [], {}, 'invalid', 5, { weekKey: '2026-11-09', best: '800' },
            { weekKey: '2026-11-09', best: -1 }, { weekKey: '2026-11-09', best: 210.9 },
            { weekKey: '2026-11-09', best: Number.MAX_SAFE_INTEGER + 1 },
            { weekKey: 'not-a-week', best: 1001 }, { weekKey: '2026-11-09', best: null }];
        for (const value of invalidValues)
        {
            const storage = store();
            storage.values.set(key, JSON.stringify(value));
            assert.equal(board(storage).snapshot().selfBest, 0);
        }
    });
    test('Old-week and future-week stored maxima are ignored', () => {
        for (const weekKey of ['2026-11-02', '2026-11-16'])
        {
            const storage = store();
            storage.values.set(key, JSON.stringify({ weekKey, best: 1001 }));
            const model = board(storage);
            assert.equal(model.snapshot().selfBest, 0);
            assert.equal(model.record(210), true);
            assert.equal(JSON.parse(storage.values.get(key)).weekKey, '2026-11-09');
        }
    });
    test('Read exceptions do not crash and retain shared in-memory highs', () => {
        const storage = { getItem() { throw new Error('SecurityError'); }, setItem() {} };
        const first = board(storage);
        assert.equal(first.record(410), true);
        assert.equal(first.snapshot().selfBest, 410);
        assert.equal(board(storage).snapshot().selfBest, 410);
    });
    test('Unwritable storage retains session maximum and shares it with same-key instances', () => {
        const storage = { getItem() { return null; }, setItem() { throw new Error('QuotaExceededError'); } };
        const first = board(storage);
        assert.equal(first.record(210), true);
        const second = board(storage);
        assert.equal(second.snapshot().selfBest, 210);
        assert.equal(second.record(410), true);
        assert.equal(first.snapshot().selfBest, 410);
        assert.equal(first.record(100), false);
    });
    test('Storage throwing on both operations remains functional and resets across weeks', () => {
        let now = new Date(2026, 10, 15, 23, 59);
        const storage = { getItem() { throw new Error('read'); }, setItem() { throw new Error('write'); } };
        const first = board(storage, () => now);
        first.record(1001);
        assert.equal(board(storage, () => now).snapshot().selfBest, 1001);
        now = new Date(2026, 10, 16);
        assert.equal(first.snapshot().selfBest, 0);
        assert.equal(first.record(210), true);
        assert.equal(first.snapshot().selfRank, 5);
    });
    test('Absent default localStorage uses shared memory and custom-key isolation', () => {
        const { WeeklyLeaderboard: Model } = load();
        const first = new Model(key, fixedNow);
        const second = new Model(key, fixedNow);
        first.record(410);
        assert.equal(second.snapshot().selfBest, 410);
        assert.equal(second.record(210), false);
        assert.equal(new Model('different', fixedNow).snapshot().selfBest, 0);
    });
    test('Throwing default localStorage getter is caught before memory fallback', () => {
        const { WeeklyLeaderboard: Model } = load({ getLocalStorage() { throw new Error('Access denied'); } });
        const first = new Model(key, fixedNow);
        assert.equal(first.record(210), true);
        assert.equal(new Model(key, fixedNow).snapshot().selfBest, 210);
    });
    test('Default localStorage persists through a genuinely fresh module reload', () => {
        const storage = store();
        const first = new (load({ localStorage: storage }).WeeklyLeaderboard)(key, fixedNow);
        first.record(1001);
        const second = new (load({ localStorage: storage }).WeeklyLeaderboard)(key, fixedNow);
        assert.equal(second.snapshot().selfBest, 1001);
        assert.equal(second.snapshot().selfRank, 1);
    });
    test('Default localStorage with failing methods still uses its shared fallback', () => {
        const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
        const { WeeklyLeaderboard: Model } = load({ localStorage: storage });
        new Model(key, fixedNow).record(410);
        assert.equal(new Model(key, fixedNow).snapshot().selfBest, 410);
    });
    test('Corruption or a lower external saved score cannot erase a current in-memory maximum', () => {
        const storage = store();
        const model = board(storage);
        model.record(1001);
        storage.values.set(key, '{broken');
        assert.equal(model.snapshot().selfBest, 1001);
        storage.values.set(key, JSON.stringify({ weekKey: '2026-11-09', best: 210 }));
        assert.equal(model.snapshot().selfBest, 1001);
        assert.equal(model.record(410), false);
    });
    test('A higher external stored maximum is read on the next snapshot/record', () => {
        const storage = store();
        const model = board(storage);
        model.record(210);
        storage.values.set(key, JSON.stringify({ weekKey: '2026-11-09', best: 1001 }));
        assert.equal(model.snapshot().selfBest, 1001);
        assert.equal(model.record(410), false);
        assert.equal(JSON.parse(storage.values.get(key)).best, 1001);
    });
    test('Sunday final millisecond keeps the old score; Monday midnight resets only self', () => {
        let now = new Date(2026, 10, 15, 23, 59, 59, 999);
        const storage = store();
        const model = board(storage, () => now);
        model.record(1001);
        assert.equal(model.snapshot().weekKey, '2026-11-09');
        assert.equal(model.snapshot().selfBest, 1001);
        now = new Date(2026, 10, 16, 0, 0, 0, 0);
        const next = model.snapshot();
        assert.equal(next.weekKey, '2026-11-16');
        assert.equal(next.selfBest, 0);
        assert.equal(next.selfRank, null);
        assert.deepEqual(plain(next.topFive).map(entry => entry.meters), [1000, 800, 600, 400, 200]);
        assert.equal(next.gapToNext, 201);
        assert.equal(model.record(210), true);
        assert.deepEqual(JSON.parse(storage.values.get(key)), { weekKey: '2026-11-16', best: 210 });
        assert.equal(new (load().WeeklyLeaderboard)(key, () => now, storage).snapshot().selfBest, 210);
    });
    test('record detects a new week even without an intervening snapshot', () => {
        let now = new Date(2026, 10, 15, 23, 59);
        const model = board(store(), () => now);
        model.record(1001);
        now = new Date(2026, 10, 16);
        assert.equal(model.record(210), true);
        assert.equal(model.snapshot().selfBest, 210);
    });
    test('Cross-year week has the previous-year Monday key and correct inclusive label', () => {
        const snapshot = board(store(), () => new Date(2026, 11, 31, 12)).snapshot();
        assert.equal(snapshot.weekKey, '2026-12-28');
        assert.equal(snapshot.dateLabel, '12.28 — 01.03');
        assert.equal(snapshot.start, new Date(2026, 11, 28).getTime());
        assert.equal(snapshot.end, new Date(2027, 0, 4).getTime());
    });
    test('New Year is not itself a week boundary; next Monday is', () => {
        let now = new Date(2026, 11, 31, 23, 59);
        const model = board(store(), () => now);
        model.record(1001);
        now = new Date(2027, 0, 1, 0, 0);
        assert.equal(model.snapshot().weekKey, '2026-12-28');
        assert.equal(model.snapshot().selfBest, 1001);
        now = new Date(2027, 0, 4);
        assert.equal(model.snapshot().weekKey, '2027-01-04');
        assert.equal(model.snapshot().selfBest, 0);
    });
    test('Leap-day week and single-digit months use the expected calendar label', () => {
        const snapshot = board(store(), () => new Date(2024, 1, 29, 12)).snapshot();
        assert.equal(snapshot.weekKey, '2024-02-26');
        assert.equal(snapshot.dateLabel, '02.26 — 03.03');
        assert.equal(snapshot.end, new Date(2024, 2, 4).getTime());
    });
    test('Injected Date is not mutated and each operation samples the clock once', () => {
        const date = fixedNow();
        const original = date.getTime();
        let calls = 0;
        const model = board(store(), () => { calls += 1; return date; });
        model.snapshot();
        assert.equal(calls, 1);
        model.record(210);
        assert.equal(calls, 2);
        assert.equal(date.getTime(), original);
    });
    test('Mutating returned snapshots cannot alter future bot or player data', () => {
        const model = board();
        model.record(410);
        const first = model.snapshot();
        first.topFive[0].name = 'mutated';
        first.topFive[0].meters = 0;
        first.topFive.find(entry => entry.isSelf).meters = 0;
        first.topFive.pop();
        const second = model.snapshot();
        assert.equal(second.topFive.length, 5);
        assert.equal(second.topFive[0].name, '小明');
        assert.equal(second.topFive[0].meters, 1000);
        assert.equal(second.selfBest, 410);
        assert.equal(second.topFive.find(entry => entry.isSelf).meters, 410);
    });
    test('Transient write failure can recover and persist a later new maximum', () => {
        const backing = store();
        let writable = false;
        const storage = {
            getItem: name => backing.getItem(name),
            setItem(name, value) { if (!writable) throw new Error('blocked'); backing.setItem(name, value); }
        };
        const model = board(storage);
        model.record(410);
        writable = true;
        assert.equal(model.record(210), false);
        assert.equal(model.record(1001), true);
        assert.equal(new (load().WeeklyLeaderboard)(key, fixedNow, storage).snapshot().selfBest, 1001);
    });

    for (const zone of ['Asia/Shanghai', 'America/Los_Angeles', 'America/New_York', 'UTC'])
    {
        const worker = spawnSync(process.execPath, [__filename, '--timezone-worker'], {
            cwd: root,
            env: { ...process.env, TZ: zone },
            encoding: 'utf8',
            timeout: 30000,
            windowsHide: true
        });
        if (worker.error)
        {
            tests.push({ name: `${zone}: timezone worker`, status: 'failed', error: String(worker.error) });
            continue;
        }
        try
        {
            const result = JSON.parse(worker.stdout);
            tests.push(...result.tests);
            if (worker.status !== 0 && !result.tests.some(item => item.status === 'failed'))
            {
                tests.push({ name: `${zone}: worker exit`, status: 'failed', error: worker.stderr || `Exit ${worker.status}` });
            }
        }
        catch (error)
        {
            tests.push({ name: `${zone}: worker output`, status: 'failed', error: `${error}\n${worker.stdout}\n${worker.stderr}` });
        }
    }
    const passed = tests.filter(item => item.status === 'passed').length;
    const failed = tests.length - passed;
    const result = {
        generatedAt: new Date().toISOString(),
        status: failed === 0 ? 'passed' : 'failed',
        total: tests.length,
        passed,
        failed,
        runtime: { node: process.version, typescript: ts.version, hostTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        files: { model: sourcePath, test: __filename, results: resultsPath },
        policies: {
            week: 'Device-local Monday 00:00 to next Monday 00:00; end exclusive; calendar arithmetic handles DST.',
            fractions: 'Floor to whole meters; invalid, negative and unsafe numbers are ignored.',
            ties: 'Bots precede self, then avatar order provides deterministic ranking.',
            storage: 'Persist {weekKey,best}; merge current-week maximum on every snapshot/record; storage failures retain shared in-memory scores.',
            dateLabel: 'MM.DD — MM.DD'
        },
        scope: 'Only the model file is type-checked; concurrent parent-owned UI files are intentionally excluded.',
        tests
    };
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
    for (const item of tests.filter(item => item.status === 'failed')) console.error(`FAIL ${item.name}\n${item.error}`);
    console.log(`${passed}/${tests.length} tests passed; ${failed} failed. Results: ${resultsPath}`);
    process.exitCode = failed === 0 ? 0 : 1;
}

if (process.argv.includes('--timezone-worker')) timezoneTests();
else mainTests();
