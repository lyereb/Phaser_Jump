const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../../../node_modules/typescript');
const path = require('node:path');
const file = path.resolve(__dirname, '../../../src/game/checkpointProgress.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('exports', 'module', compiled)(mod.exports, mod);
const { CheckpointProgress, checkpointDistance } = mod.exports;
const results = [];
function test(name, fn) { fn(); results.push({ name, passed: true }); }
test('初始里程碑是50米，距离随剩余米数连续缩小', () => {
  assert.equal(new CheckpointProgress().nextMeters, 50);
  let previous=Infinity;
  for(let remaining=50;remaining>=0;remaining-=0.125){
    const d=checkpointDistance(remaining,132.48,88.32);
    assert.ok(d<previous);previous=d;
  }
});
test('5米分段处无位置突变', () => {
  const middle=checkpointDistance(5,132.48,88.32);
  assert.ok(Math.abs(checkpointDistance(5.00001,132.48,88.32)-middle)<0.001);
  assert.ok(Math.abs(checkpointDistance(4.99999,132.48,88.32)-middle)<0.001);
});
test('最后1到5米的红绳距离都能被一次完整跳跃越过', () => {
  for(const jumpHeight of [88.32,132.48,264.96]){
    for(let remaining=1;remaining<=5;remaining++){
      assert.ok(checkpointDistance(remaining,jumpHeight,88.32)<jumpHeight);
    }
  }
});
test('未跳过不能仅靠计分触发', () => {
  const p = new CheckpointProgress(); p.beginJump();
  assert.equal(p.land(50), null); assert.equal(p.nextMeters, 50);
});
test('未到米数不触发；下一跳重置越线记录', () => {
  const p = new CheckpointProgress(); p.beginJump(); p.cross();
  assert.equal(p.land(49), null); p.beginJump();
  assert.equal(p.land(50), null);
});
test('49 跳到 53 也只触发标记为 50 的 checkpoint', () => {
  const p = new CheckpointProgress(); p.beginJump(); p.cross();
  assert.equal(p.land(53), 50); assert.equal(p.nextMeters, 100);
  assert.equal(p.land(53), null); p.beginJump(); p.cross();
  assert.equal(p.land(55), null);
});
test('每 50 米依次触发，直至 1000 米且不重复', () => {
  const p = new CheckpointProgress();
  for (let milestone = 50; milestone <= 1000; milestone += 50) {
    p.beginJump(); p.cross(); assert.equal(p.land(milestone + 3), milestone);
    assert.equal(p.land(milestone + 3), null);
    assert.equal(p.nextMeters, milestone + 50);
  }
});
test('重新创建场景进度重置到 50 米', () => {
  const p = new CheckpointProgress(); p.beginJump(); p.cross(); p.land(50);
  assert.equal(new CheckpointProgress().nextMeters, 50);
});
console.log(JSON.stringify({ passed: results.length, results }, null, 2));
fs.writeFileSync(path.resolve(__dirname, '../validation/progress.json'), JSON.stringify({ passed: results.length, results }, null, 2));
