'use strict';
// Run the actual TypeScript rule and scene methods with a lightweight Phaser API test double.
// This is not a visual/browser playtest; rendering, audio and tween timing are intentionally mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
function load(relative, dependencies = {}) {
    const filename = path.join(root, relative);
    const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env.DEV', 'true');
    const output = ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS,
        useDefineForClassFields: true
    }}).outputText;
    const module = { exports: {} };
    vm.runInThisContext('(function(exports,require,module){\n' + output + '\n})', { filename })(
        module.exports, name => dependencies[name] || {}, module);
    return module.exports;
}
const rules = load('src/game/itemRules.ts');
const flightRules = load('src/game/springFlight.ts');
let passed = 0;
const results = [];
function test(name, fn) { fn(); passed++; results.push(name); console.log('PASS ' + name); }
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }
class Node {
    constructor(x = 0, y = 0, width = 256, height = 192) {
        Object.assign(this, {x, y, width, height, displayWidth: width, displayHeight: height,
            scaleX: 1, scaleY: 1, frame: {width, height}, scene: {}, visible: true, depth: 1});
    }
    setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setOrigin() { return this; }
    setDepth(value) { this.depth = value; return this; }
    setVisible(value) { this.visible = value; return this; }
    setScrollFactor() { return this; }
    setAngle(value) { this.angle = value; return this; }
    setTint() { return this; }
    setTintMode() { return this; }
    clearTint() { return this; }
    setText(value) { this.text = value; this.width = value.length * 24; return this; }
    play() { return this; }
    destroy() { this.scene = null; this.destroyed = true; }
}
class FakeCheckpoints { prepare() {} observePlayer() { return false; } prepareLeap() {} preview() {} layout() {} }
class FakeDebug { constructor() { this.rows = []; this.steppers = []; }
    addButton(label, onClick) { this.rows.push({label, onClick}); }
    addStepper(format, onStep) { this.steppers.push({format, onStep}); }
    close() {} layout() {}
}
class FakeEffects { constructor() { this.messages = []; }
    toast(...args) { this.messages.push(args); } update() {} popScore() {} spring() {} shieldGranted() {} shieldBroken() {} coins() {}
    moverSpeed(mover, dt = 0) {
        this.speedMover = mover;
        this.speedTime = mover ? (this.speedTime || 0) + dt : 0;
    }
}
class FakeCoinHud { setValue() {} pulse() {} iconCenter() { return {x: 0, y: 0}; } }
class FakeWallet { constructor() { this.total = 100; } add(n) { return this.total += n; } }
class FakeHud { constructor() { this.coinHud = new FakeCoinHud(); } }
const dependencies = {
    phaser: {Scene: class {}, Math: {Vector2: class {}}, TintModes: {FILL: 1}},
    '../itemRules': rules, '../springFlight': flightRules,
    '../player': {PLAYER_ART_FEET: 480, PLAYER_ART_TOP: 0, PLAYER_ART_HEIGHT: 512},
    '../audio': {startBgm() {}, playSfx() {}},
    '../layout': {bindResize() {}, coverImage() {}},
    '../checkpoints': {Checkpoints: FakeCheckpoints},
    '../debugPanel': {DebugPanel: FakeDebug},
    '../coinHud': {CoinHud: FakeCoinHud, CoinWallet: FakeWallet},
    '../gameHud': {GameHud: FakeHud},
    '../itemEffects': {ItemEffects: FakeEffects},
    '../rankChaseHud': {RankChaseHud: class {}},
    '../leaderboardContext': {getWeeklyLeaderboard: () => ({record() {}})},
    '../letters': {MeterDigits: class {punch() {}}},
    '../stars': {StarBurst: class {burst() {}}}
};
const {Game} = load('src/game/scenes/Game.ts', dependencies);
function scene() {
    const g = new Game();
    g.add = {
        image: (x, y, key) => Object.assign(new Node(x, y), {textureKey: key}),
        text: (x, y, text) => new Node(x, y).setText(text),
        rectangle: (x, y, w, h) => new Node(x, y, w, h),
        sprite: (x, y) => new Node(x, y)
    };
    g.cameras = {main: {scrollX: 0, scrollY: 0, setBackgroundColor() {}, shake() {}}};
    g.scale = {width: 800, height: 1000};
    g.registry = {get() {}};
    g.input = {on() {}, off() {}};
    g.events = {once() {}};
    g.time = {delayedCall() {}};
    g.tweens = {add() {}, killTweensOf() {}};
    // Keep UI layout/animation out of scene-method tests, but exercise the actual create/reset path.
    g.layout = () => {};
    g.followCamera = () => {};
    g.updateHeight = () => {};
    g.squash = () => {};
    g.celebrate = () => {};
    g.flashPerfect = () => {};
    g.create();
    return g;
}
function next(g, kind = 'normal') {
    g.mover?.node.destroy();
    g.mover = null;
    g.releasePallet();
    g.forcedItem = kind;
    g.spawnMover();
    return g.mover;
}
function land(g) {
    const b = g.mover;
    g.placeBlock(b, g.anchorX, g.stackBottom(g.support));
    const surface = g.top(g.body(b));
    g.grounded = false;
    g.player.vy = 100;
    g.player.node.x = g.body(b).x;
    g.prevBottom = surface - 3;
    g.player.node.y = surface - g.player.node.displayHeight / 2;
    assert.equal(g.tryLand(b), true);
    return b;
}
function redPickup(g) { g.forceItem('speed'); return land(g); }

test('boost constants are five boxes and 1.3x', () => {
    assert.equal(rules.SPEED_BOX_COUNT, 5); assert.equal(rules.SPEED_MULTIPLIER, 1.3);
});
test('empty boost stays normal', () => {
    const b = new rules.SpeedBoost(); assert.equal(b.remaining, 0);
    for (let i = 0; i < 10; i++) assert.equal(b.consumeMover(), 1);
    assert.equal(b.remaining, 0);
});
test('exactly five assignments then normal indefinitely', () => {
    const b = new rules.SpeedBoost(); b.grant();
    for (let i = 0; i < 5; i++) { assert.equal(b.consumeMover(), 1.3); assert.equal(b.remaining, 4 - i); }
    for (let i = 0; i < 10; i++) assert.equal(b.consumeMover(), 1);
});
test('repeat grant refreshes five without stacking', () => {
    const b = new rules.SpeedBoost(); b.grant(); b.consumeMover(); b.consumeMover(); b.grant();
    assert.equal(b.remaining, 5); for (let i = 0; i < 5; i++) assert.equal(b.consumeMover(), 1.3);
    assert.equal(b.consumeMover(), 1);
});
test('reset removes boost and instances are independent', () => {
    const a = new rules.SpeedBoost(), b = new rules.SpeedBoost(); a.grant();
    assert.equal(b.remaining, 0); a.reset(); a.reset(); assert.equal(a.consumeMover(), 1);
});
test('red is randomly reachable with unchanged 10 percent special gate', () => {
    let seq = [0.099, 0.75]; assert.equal(rules.rollItemKind(() => seq.shift()), 'speed');
    seq = [0.1]; assert.equal(rules.rollItemKind(() => seq.shift()), 'normal');
});
test('initial mover and speed are normal', () => {
    const g = scene(); assert.equal(g.speedBoost.remaining, 0);
    assert.equal(g.mover.speedMultiplier, 1); close(Math.abs(g.mover.vx), 398);
    assert.equal(g.speedText.visible, false);
});
test('debug red texture has normal geometry and does not grant until landed', () => {
    const g = scene(); const old = g.body(g.mover); g.forceItem('speed');
    assert.equal(g.mover.node.textureKey, 'block-speed');
    assert.equal(g.mover.item, 'speed'); assert.equal(g.mover.itemConsumed, false);
    assert.equal(g.speedBoost.remaining, 0); close(Math.abs(g.mover.vx), 398);
    close(g.body(g.mover).displayWidth, old.displayWidth); close(g.body(g.mover).displayHeight, old.displayHeight);
});
test('failed land does not consume red pickup or grant boost', () => {
    const g = scene(); g.forceItem('speed'); const b = g.mover;
    g.grounded = false; g.player.vy = -100;
    assert.equal(g.tryLand(b), false); assert.equal(b.itemConsumed, false); assert.equal(g.speedBoost.remaining, 0);
});
test('actual successful red landing boosts the next mover, not the source', () => {
    const g = scene(); const source = redPickup(g);
    assert.equal(source.speedMultiplier, 1); assert.equal(source.itemConsumed, true);
    assert.equal(source.moving, false); assert.equal(source.vx, 0);
    assert.equal(g.mover.speedMultiplier, 1.3); close(Math.abs(g.mover.vx), 517.4);
    assert.equal(g.speedBoost.remaining, 4); assert.match(g.speedText.text, /剩余 5 盒/);
    assert.equal(g.heightMeters, 2); assert.equal(g.wallet.total, 100); assert.equal(g.springFlight, null);
});
test('actual five spawned movers stay fast and sixth restores baseline', () => {
    const g = scene(); redPickup(g);
    for (let i = 0; i < 5; i++) {
        assert.equal(g.mover.speedMultiplier, 1.3); close(Math.abs(g.mover.vx), 517.4);
        assert.equal(g.speedBoost.remaining, 4 - i);
        if (i < 4) next(g);
    }
    const sixth = next(g); assert.equal(sixth.speedMultiplier, 1); close(Math.abs(sixth.vx), 398);
    assert.equal(g.boardPx, 398); assert.equal(g.speedText.visible, false);
});
test('fifth boosted mover stays boosted on debug speed refresh with zero charges', () => {
    const g = scene(); redPickup(g); for (let i = 0; i < 4; i++) next(g);
    assert.equal(g.speedBoost.remaining, 0); g.applyBoardSpeed(); close(Math.abs(g.mover.vx), 517.4);
    assert.match(g.speedText.text, /剩余 1 盒/); assert.equal(g.speedText.visible, true);
});
test('baseline tuning does not compound multiplier and restores tuned normal speed', () => {
    const g = scene(); redPickup(g); const step = g.debugPanel.steppers[3];
    step.onStep(1); assert.equal(g.boardPx, 438); close(Math.abs(g.mover.vx), 569.4);
    step.onStep(-1); assert.equal(g.boardPx, 398); close(Math.abs(g.mover.vx), 517.4);
    g.boardPx = 600; g.applyBoardSpeed(); close(Math.abs(g.mover.vx), 780);
    for (let i = 0; i < 5; i++) next(g); close(Math.abs(g.mover.vx), 600);
});
test('left and right movers use the same multiplier and keep direction', () => {
    const g = scene(); redPickup(g); const saved = Math.random;
    try { for (const [roll, sign] of [[0.1, 1], [0.9, -1]]) {
        Math.random = () => roll; const b = next(g); close(b.vx, sign * 517.4);
        g.boardPx = 500; g.applyBoardSpeed(); close(b.vx, sign * 650); g.boardPx = 398;
    }} finally { Math.random = saved; }
});
test('spawn guards consume no extra charges', () => {
    const g = scene(); redPickup(g); g.spawnMover(); assert.equal(g.speedBoost.remaining, 4);
    g.mover = null; g.phase = 'dead'; g.spawnMover(); assert.equal(g.speedBoost.remaining, 4);
    g.phase = 'play'; g.springFlight = {}; g.spawnMover(); assert.equal(g.speedBoost.remaining, 4);
});
test('debug texture replacement keeps current boost charge including fifth mover', () => {
    const g = scene(); redPickup(g);
    for (const kind of ['coin', 'shield', 'spring', 'speed']) {
        g.forceItem(kind); assert.equal(g.speedBoost.remaining, 4); assert.equal(g.mover.speedMultiplier, 1.3);
    }
    for (let i = 0; i < 4; i++) next(g);
    g.forceItem('shield'); assert.equal(g.speedBoost.remaining, 0); close(Math.abs(g.mover.vx), 517.4);
});
test('repeat activation of the same red source cannot renew charges', () => {
    const g = scene(); const source = redPickup(g); next(g);
    const remaining = g.speedBoost.remaining; g.activateItem(source, true);
    assert.equal(g.speedBoost.remaining, remaining);
});
test('second genuine red landing refreshes next five without compounding', () => {
    const g = scene(); redPickup(g); next(g); g.forceItem('speed'); const source = land(g);
    assert.equal(source.speedMultiplier, 1.3); assert.equal(g.speedBoost.remaining, 4);
    close(Math.abs(g.mover.vx), 517.4); assert.match(g.speedText.text, /剩余 5 盒/);
});
test('old support landing grants neither boost nor another mover', () => {
    const g = scene(); redPickup(g); const b = g.mover, remaining = g.speedBoost.remaining;
    const surface = g.top(g.body(g.support)); g.grounded = false; g.player.vy = 100;
    g.prevBottom = surface - 3; g.player.node.y = surface - g.player.node.displayHeight / 2;
    g.tryLandOnSupport(); assert.equal(g.mover, b); assert.equal(g.speedBoost.remaining, remaining);
});
test('special incoming coin shield spring and speed each consume one mover charge', () => {
    const g = scene(); redPickup(g);
    for (const [index, kind] of ['coin', 'shield', 'spring', 'speed'].entries()) {
        const b = next(g, kind); assert.equal(b.speedMultiplier, 1.3); assert.equal(g.speedBoost.remaining, 3 - index);
    }
});
test('spring ten automatic deliveries consume no charges and leave trajectory unchanged', () => {
    const g = scene(); redPickup(g); g.forceItem('spring'); land(g);
    const flight = g.springFlight; assert.ok(flight); assert.equal(flight.deliveries.length, 10);
    assert.equal(g.speedBoost.remaining, 4); assert.equal(g.mover, null);
    assert.ok(flight.deliveries.every(d => d.block.speedMultiplier === 1 && d.block.item === 'normal'));
    g.simulateSpring(0.1); assert.equal(g.speedBoost.remaining, 4);
    g.simulateSpring(5); assert.equal(g.springFlight, null);
    assert.equal(g.speedBoost.remaining, 3); close(Math.abs(g.mover.vx), 517.4);
    assert.equal(g.heightMeters, 12);
});
test('shield deflection consumes no pickup but next generated mover consumes a charge', () => {
    const g = scene(); redPickup(g); g.forceItem('speed'); const blocked = g.mover;
    const remaining = g.speedBoost.remaining; g.deflectWithShield(blocked);
    assert.equal(blocked.itemConsumed, false); assert.equal(g.speedBoost.remaining, remaining - 1);
    assert.equal(g.mover.speedMultiplier, 1.3);
});
test('new round resets boost and current multiplier but keeps wallet', () => {
    const g = scene(); redPickup(g); const wallet = g.wallet; wallet.add(7);
    g.create(); assert.equal(g.speedBoost.remaining, 0); assert.equal(g.mover.speedMultiplier, 1);
    close(Math.abs(g.mover.vx), 398); assert.equal(g.wallet, wallet); assert.equal(g.wallet.total, 107);
});
test('return-confirmation update guard freezes count and position', () => {
    const g = scene(); redPickup(g); const b = g.mover, x = b.node.x;
    g.returnConfirmationOpen = true; g.update(0, 1000); g.simulate(2);
    assert.equal(b.node.x, x); assert.equal(g.speedBoost.remaining, 4);
});
test('simulation uses boosted velocity and stopping does not reassign charges', () => {
    const g = scene(); redPickup(g); const b = g.mover, x = b.node.x;
    g.resolve = () => {}; g.observeCheckpoint = () => {};
    g.simulate(0.008); close(Math.abs(b.node.x - x), 517.4 * 0.008);
    assert.equal(g.speedBoost.remaining, 4);
    g.placeBlock(b, g.anchorX + (b.vx > 0 ? -1 : 1), g.stackBottom(g.support));
    g.simulate(0.008); assert.equal(b.vx, 0); g.applyBoardSpeed(); assert.equal(b.vx, 0);
    assert.equal(g.speedBoost.remaining, 4);
});
test('normal boxes do not activate another item effect', () => {
    const g = scene(); const b = next(g); g.activateItem(b, true);
    assert.equal(g.speedBoost.remaining, 0); assert.equal(g.springFlight, null); assert.equal(g.wallet.total, 100);
});
test('existing coin and shield pickups retain their effects', () => {
    const g = scene(); g.forceItem('coin'); land(g); assert.ok(g.wallet.total >= 140 && g.wallet.total <= 200);
    g.forceItem('shield'); land(g); assert.equal(g.shieldCharge.active, true); assert.equal(g.speedBoost.remaining, 0);
});
test('normal mover has no speed graphics descriptor', () => {
    const g = scene(); assert.equal(g.itemEffects.speedMover, null);
});
test('pickup immediately attaches speed visuals to the next box geometry', () => {
    const g = scene(); redPickup(g); const visual = g.itemEffects.speedMover, body = g.body(g.mover);
    assert.ok(visual); assert.equal(visual.x, body.x); assert.equal(visual.y, body.y);
    assert.equal(visual.width, body.displayWidth); assert.equal(visual.height, body.displayHeight);
    assert.equal(visual.vx, g.mover.vx); assert.equal(visual.depth, g.mover.node.depth);
});
test('boost visuals cover all item textures, not only red boxes', () => {
    const g = scene(); redPickup(g);
    for (const kind of ['normal', 'coin', 'shield', 'spring', 'speed']) {
        g.forceItem(kind); assert.ok(g.itemEffects.speedMover); assert.equal(g.speedBoost.remaining, 4);
    }
});
test('fifth box has speed visuals despite zero remaining charges, sixth has none', () => {
    const g = scene(); redPickup(g); for (let i = 0; i < 4; i++) next(g);
    assert.equal(g.speedBoost.remaining, 0); assert.ok(g.itemEffects.speedMover);
    next(g); assert.equal(g.itemEffects.speedMover, null);
});
test('box stopping on the center removes visuals without consuming a charge', () => {
    const g = scene(); redPickup(g); g.mover.vx = 0; g.syncMoverSpeed(0.008);
    assert.equal(g.itemEffects.speedMover, null); assert.equal(g.speedBoost.remaining, 4);
});
test('landing the last boosted box removes its visuals and restores a normal mover', () => {
    const g = scene(); redPickup(g); for (let i = 0; i < 4; i++) next(g);
    const random = Math.random;
    try { Math.random = () => 0.9; land(g); } finally { Math.random = random; }
    assert.equal(g.itemEffects.speedMover, null); assert.equal(g.mover.speedMultiplier, 1);
});
test('pause freezes speed visuals and resume advances simulation time normally', () => {
    const g = scene(); redPickup(g); g.update(0, 8); const time = g.itemEffects.speedTime;
    const frame = JSON.stringify(g.itemEffects.speedMover); g.returnConfirmationOpen = true;
    g.update(1000, 48); assert.equal(g.itemEffects.speedTime, time);
    assert.equal(JSON.stringify(g.itemEffects.speedMover), frame);
    g.returnConfirmationOpen = false; g.update(1008, 8); close(g.itemEffects.speedTime, time + 0.008);
});
test('spring clears mover visuals and restores them for the next real boosted box', () => {
    const g = scene(); redPickup(g); g.forceItem('spring'); land(g);
    assert.equal(g.itemEffects.speedMover, null); g.simulateSpring(5);
    assert.ok(g.itemEffects.speedMover); assert.equal(g.speedBoost.remaining, 3);
});
test('failure immediately clears mover visuals without modifying boost charges', () => {
    const g = scene(); redPickup(g); g.fly(g.mover.vx);
    assert.equal(g.itemEffects.speedMover, null); assert.equal(g.speedBoost.remaining, 4);
});
test('new round has no residual speed visual descriptor', () => {
    const g = scene(); redPickup(g); g.create(); assert.equal(g.itemEffects.speedMover, null);
});
fs.mkdirSync(path.join(__dirname, 'validation'), {recursive: true});
fs.writeFileSync(path.join(__dirname, 'validation/results.json'), JSON.stringify({
    suite: 'speed rule + actual Game methods with Phaser test doubles', passed, tests: results,
    visualBrowserPlaytest: false
}, null, 2));
console.log(`\n${passed} tests passed.`);
