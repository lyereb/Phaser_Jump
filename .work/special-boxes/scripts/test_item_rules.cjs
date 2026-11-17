'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const projectRoot = path.resolve(__dirname, '../../..');
const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
const ts = projectRequire('typescript');
const sourcePath = path.join(projectRoot, 'src/game/itemRules.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
    fileName: sourcePath,
    reportDiagnostics: true,
    compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true
    }
});

const errors = (compiled.diagnostics || []).filter((diagnostic) =>
    diagnostic.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => '\n'
}));

const loaded = { exports: {} };
const wrapper = vm.runInThisContext(
    '(function (exports, require, module, __filename, __dirname) {\n' +
    compiled.outputText + '\n})',
    { filename: sourcePath }
);
wrapper(loaded.exports, (name) => {
    throw new Error('Rule module must not depend on other modules: ' + name);
}, loaded, sourcePath, path.dirname(sourcePath));

const {
    SPECIAL_PROBABILITY,
    SPRING_STACK_COUNT,
    rollItemKind,
    rollCoinReward,
    ShieldCharge
} = loaded.exports;

let passed = 0;

function test (name, run)
{
    run();
    passed += 1;
    console.log('PASS ' + name);
}

function sequence (...values)
{
    let index = 0;
    const random = () => {
        assert.ok(index < values.length, 'Unexpected extra random draw');
        return values[index++];
    };
    random.calls = () => index;
    return random;
}

function withDefaultRandom (random, run)
{
    const original = Math.random;
    Math.random = random;

    try
    {
        run();
    }
    finally
    {
        Math.random = original;
    }
}

test('exact exported ItemKind string union and runtime API', () => {
    const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.ES2020, true);
    const alias = ast.statements.find((node) =>
        ts.isTypeAliasDeclaration(node) && node.name.text === 'ItemKind');
    assert.ok(alias, 'ItemKind type alias must exist');
    assert.ok(alias.modifiers && alias.modifiers.some((modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword));
    assert.ok(ts.isUnionTypeNode(alias.type));
    const kinds = alias.type.types.map((node) => {
        assert.ok(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal));
        return node.literal.text;
    });
    assert.deepEqual(kinds, ['normal', 'coin', 'shield', 'spring', 'speed']);
    assert.deepEqual(Object.keys(loaded.exports).sort(), [
        'SPECIAL_PROBABILITY', 'SPRING_STACK_COUNT', 'ShieldCharge',
        'SPEED_BOX_COUNT', 'SPEED_MULTIPLIER', 'SpeedBoost',
        'rollCoinReward', 'rollItemKind'
    ].sort());
});

test('constants are exactly 0.1 and 10', () => {
    assert.equal(SPECIAL_PROBABILITY, 0.1);
    assert.equal(SPRING_STACK_COUNT, 10);
});

test('10% selection boundary and random draw counts', () => {
    for (const gate of [0, 0.1 - Number.EPSILON])
    {
        const random = sequence(gate, 0);
        assert.equal(rollItemKind(random), 'coin');
        assert.equal(random.calls(), 2);
    }

    for (const gate of [0.1, 0.1 + Number.EPSILON, 0.5, 1 - Number.EPSILON])
    {
        const random = sequence(gate);
        assert.equal(rollItemKind(random), 'normal');
        assert.equal(random.calls(), 1);
    }
});

test('special quarters include exact thresholds and both extreme samples', () => {
    const cases = [
        [0, 'coin'],
        [1 / 4 - Number.EPSILON, 'coin'],
        [1 / 4, 'shield'],
        [2 / 4 - Number.EPSILON, 'shield'],
        [2 / 4, 'spring'],
        [3 / 4 - Number.EPSILON, 'spring'],
        [3 / 4, 'speed'],
        [1 - Number.EPSILON, 'speed']
    ];

    for (const [sample, expected] of cases)
    {
        assert.equal(rollItemKind(sequence(0, sample)), expected);
    }
});

test('deterministic grid: 90% normal and equal 1/4 shares of special boxes', () => {
    const counts = { normal: 0, coin: 0, shield: 0, spring: 0, speed: 0 };

    for (let gate = 0; gate < 1000; gate += 1)
    {
        for (const special of [1 / 8, 3 / 8, 5 / 8, 7 / 8])
        {
            counts[rollItemKind(sequence(gate / 1000, special))] += 1;
        }
    }

    assert.deepEqual(counts, { normal: 3600, coin: 100, shield: 100, spring: 100, speed: 100 });
});

test('default random sources work for both roll functions', () => {
    withDefaultRandom(sequence(0, 0.375), () => {
        assert.equal(rollItemKind(), 'shield');
    });
    withDefaultRandom(sequence(0.1), () => {
        assert.equal(rollItemKind(), 'normal');
    });
    withDefaultRandom(sequence(0), () => {
        assert.equal(rollCoinReward(false), 20);
    });
    withDefaultRandom(sequence(1 - Number.EPSILON), () => {
        assert.equal(rollCoinReward(true), 100);
    });
});

test('coin inclusive endpoints 20/50 and perfect endpoints 40/100', () => {
    assert.equal(rollCoinReward(false, sequence(0)), 20);
    assert.equal(rollCoinReward(false, sequence(1 - Number.EPSILON)), 50);
    assert.equal(rollCoinReward(true, sequence(0)), 40);
    assert.equal(rollCoinReward(true, sequence(1 - Number.EPSILON)), 100);
    assert.equal(rollCoinReward(false, sequence(1 / 31 - Number.EPSILON)), 20);
    assert.equal(rollCoinReward(false, sequence(1 / 31)), 21);
    assert.equal(rollCoinReward(false, sequence(30 / 31)), 50);
});

test('all 31 coin integers are equally sampled and perfect doubles the same draw', () => {
    const counts = new Map();

    for (let bucket = 0; bucket < 31; bucket += 1)
    {
        for (let offset = 0; offset < 10; offset += 1)
        {
            const sample = (bucket + (offset + 0.5) / 10) / 31;
            const normalRandom = sequence(sample);
            const perfectRandom = sequence(sample);
            const normal = rollCoinReward(false, normalRandom);
            const perfect = rollCoinReward(true, perfectRandom);
            assert.equal(normal, 20 + bucket);
            assert.ok(Number.isInteger(normal));
            assert.equal(perfect, normal * 2);
            assert.equal(normalRandom.calls(), 1);
            assert.equal(perfectRandom.calls(), 1);
            counts.set(normal, (counts.get(normal) || 0) + 1);
        }
    }

    assert.equal(counts.size, 31);
    for (const count of counts.values())
    {
        assert.equal(count, 10);
    }
});

test('shield starts empty and consume returns false without a charge', () => {
    const shield = new ShieldCharge();
    assert.equal(shield.active, false);
    assert.equal(shield.consume(), false);
    assert.equal(shield.consume(), false);
    assert.equal(shield.active, false);
});

test('shield grants do not stack and only one consume succeeds', () => {
    const shield = new ShieldCharge();
    assert.equal(shield.grant(), undefined);
    assert.equal(shield.active, true);
    shield.grant();
    shield.grant();
    assert.equal(shield.consume(), true);
    assert.equal(shield.active, false);
    assert.equal(shield.consume(), false);
    shield.grant();
    assert.equal(shield.consume(), true);
    assert.equal(shield.consume(), false);
});

test('shield reset clears charges and is idempotent', () => {
    const shield = new ShieldCharge();
    assert.equal(shield.reset(), undefined);
    shield.grant();
    assert.equal(shield.active, true);
    shield.reset();
    assert.equal(shield.active, false);
    assert.equal(shield.consume(), false);
    shield.reset();
    assert.equal(shield.active, false);
    shield.grant();
    assert.equal(shield.consume(), true);
});

test('shield instances have independent charges', () => {
    const first = new ShieldCharge();
    const second = new ShieldCharge();
    first.grant();
    assert.equal(second.active, false);
    second.grant();
    first.reset();
    assert.equal(first.active, false);
    assert.equal(second.consume(), true);
    assert.equal(second.consume(), false);
});

console.log('\n' + passed + ' tests passed.');
console.log('Module: ' + sourcePath);
console.log('TypeScript: ' + ts.version);
