'use strict';
// Test the actual ItemEffects renderer with a recording Graphics API, not a browser screenshot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const filename = path.join(root, 'src/game/itemEffects.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, useDefineForClassFields: true}
}).outputText;
class ObjectNode extends EventEmitter {
    constructor() { super(); this.scene = {}; this.visible = true; this.destroyed = false; }
    setDepth(depth) { this.depth = depth; return this; }
    setVisible(visible) { this.visible = visible; return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; }
    setAlpha(alpha) { this.alpha = alpha; return this; }
    setStrokeStyle() { return this; }
    add(child) { this.children ||= []; this.children.push(...(Array.isArray(child) ? child : [child])); return this; }
    destroy() { this.destroyed = true; this.scene = null; this.emit('destroy'); this.children?.forEach(n => n.destroy()); }
}
class Graphics extends ObjectNode {
    constructor() { super(); this.commands = []; }
    clear() { this.commands = []; return this; }
}
for (const method of ['fillStyle', 'lineStyle', 'fillEllipse', 'fillCircle', 'strokeEllipse',
    'beginPath', 'arc', 'strokePath', 'lineBetween', 'strokeRoundedRect']) {
    Graphics.prototype[method] = function(...args) { this.commands.push({method, args}); return this; };
}
function setup() {
    const objects = [], graphics = [], killed = [], tweens = [];
    const create = (kind) => { const n = kind === 'graphics' ? new Graphics() : new ObjectNode();
        objects.push(n); if (kind === 'graphics') graphics.push(n); return n; };
    const scene = {add: {}, events: new EventEmitter(), tweens: {
        add(config) { tweens.push(config); }, killTweensOf(obj) { killed.push(obj); }
    }};
    for (const kind of ['graphics', 'container', 'circle', 'ellipse']) scene.add[kind] = () => create(kind);
    const effects = new ItemEffects(scene, 1006, 50, 120);
    return {effects, scene, objects, graphics, tweens, killed};
}
const moduleLoaded = {exports: {}};
vm.runInThisContext('(function(exports,require,module){\n' + compiled + '\n})', {filename})(
    moduleLoaded.exports, () => ({Math: {Between: (a) => a, FloatBetween: (a) => a}}), moduleLoaded);
const {ItemEffects} = moduleLoaded.exports;
const box = {x: 400, y: 500, width: 154, height: 86, vx: 517.4, depth: 12};
const results = [];
function test(name, fn) { fn(); results.push(name); console.log('PASS ' + name); }
function firstLine(graphics) { return graphics.commands.find(c => c.method === 'lineBetween').args; }

test('normal or absent movers allocate no speed objects', () => {
    const s = setup(), count = s.objects.length;
    s.effects.moverSpeed(null, 1); s.effects.moverSpeed({...box, vx: 0}, 1);
    assert.equal(s.objects.length, count); assert.equal(s.effects.speedTrail, null);
});
test('active mover creates visible pooled rear and front graphics', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.008);
    assert.equal(s.effects.speedTrail.visible, true); assert.equal(s.effects.speedShine.visible, true);
    assert.equal(s.effects.speedTrail.depth, box.depth - 0.2);
    assert.equal(s.effects.speedShine.depth, box.depth + 0.05);
    assert.equal(s.effects.speedTime, 0.008);
    assert.ok(s.effects.speedTrail.commands.some(c => c.method === 'fillCircle'));
    assert.ok(s.effects.speedShine.commands.some(c => c.method === 'strokeRoundedRect'));
});
test('rightward mover exhaust points left behind its rear edge', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.1);
    const [start, , end] = firstLine(s.effects.speedTrail);
    assert.ok(start < box.x - box.width / 2); assert.ok(end < start);
});
test('leftward mover exhaust points right behind its rear edge', () => {
    const s = setup(); s.effects.moverSpeed({...box, vx: -517.4}, 0.1);
    const [start, , end] = firstLine(s.effects.speedTrail);
    assert.ok(start > box.x + box.width / 2); assert.ok(end > start);
});
test('world position and layer follow the current box', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.1);
    const original = firstLine(s.effects.speedTrail);
    s.effects.moverSpeed({...box, x: box.x + 250, y: box.y - 100, depth: 21}, 0);
    const moved = firstLine(s.effects.speedTrail);
    assert.equal(moved[0] - original[0], 250); assert.equal(moved[1] - original[1], -100);
    assert.equal(s.effects.speedTrail.depth, 20.8); assert.equal(s.effects.speedShine.depth, 21.05);
});
test('zero delta produces an identical visual frame', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.3);
    const trail = JSON.stringify(s.effects.speedTrail.commands), shine = JSON.stringify(s.effects.speedShine.commands);
    s.effects.moverSpeed(box, 0); assert.equal(s.effects.speedTime, 0.3);
    assert.equal(JSON.stringify(s.effects.speedTrail.commands), trail);
    assert.equal(JSON.stringify(s.effects.speedShine.commands), shine);
});
test('simulation delta advances streaks and glints without tweens', () => {
    const s = setup(), tweenCount = s.tweens.length; s.effects.moverSpeed(box, 0.008);
    const frame = JSON.stringify(s.effects.speedTrail.commands); s.effects.moverSpeed(box, 0.008);
    assert.notEqual(JSON.stringify(s.effects.speedTrail.commands), frame);
    assert.equal(s.tweens.length, tweenCount); assert.equal(s.effects.speedTime, 0.016);
});
test('stopping clears both layers and resets local visual time', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.1); s.effects.moverSpeed({...box, vx: 0});
    assert.equal(s.effects.speedTrail.visible, false); assert.equal(s.effects.speedShine.visible, false);
    assert.equal(s.effects.speedTrail.commands.length, 0); assert.equal(s.effects.speedShine.commands.length, 0);
    assert.equal(s.effects.speedTime, 0);
});
test('landing or removal clears both layers via a null mover', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.1); s.effects.moverSpeed(null);
    assert.equal(s.effects.speedTrail.visible, false); assert.equal(s.effects.speedShine.visible, false);
});
test('next boosted box reuses the two graphics instead of leaking per-frame particles', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.008);
    const trail = s.effects.speedTrail, shine = s.effects.speedShine, count = s.objects.length;
    for (let i = 0; i < 600; i++) s.effects.moverSpeed({...box, x: 400 + i}, 0.008);
    s.effects.moverSpeed(null); s.effects.moverSpeed({...box, vx: -517.4}, 0.008);
    assert.equal(s.objects.length, count); assert.equal(s.effects.speedTrail, trail); assert.equal(s.effects.speedShine, shine);
});
test('shutdown destroys tracked speed layers and removes references', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.1);
    const trail = s.effects.speedTrail, shine = s.effects.speedShine;
    s.scene.events.emit('shutdown'); assert.equal(trail.destroyed, true); assert.equal(shine.destroyed, true);
    assert.equal(s.effects.speedTrail, null); assert.equal(s.effects.speedShine, null);
    assert.equal(s.effects.effects.size, 0); assert.ok(s.killed.includes(trail)); assert.ok(s.killed.includes(shine));
});
test('renderer does not mutate box coordinates velocity or dimensions', () => {
    const s = setup(), descriptor = {...box}, original = JSON.stringify(descriptor);
    s.effects.moverSpeed(descriptor, 0.008); assert.equal(JSON.stringify(descriptor), original);
});
test('negative delta never rewinds visual time', () => {
    const s = setup(); s.effects.moverSpeed(box, 0.1); s.effects.moverSpeed(box, -0.5);
    assert.equal(s.effects.speedTime, 0.1);
});
fs.writeFileSync(path.join(__dirname, 'validation/effects-results.json'), JSON.stringify({
    passed: results.length, tests: results, visualBrowserPlaytest: false
}, null, 2));
console.log(`\n${results.length} effect tests passed.`);
