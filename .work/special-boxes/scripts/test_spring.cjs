const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('../../../node_modules/typescript');
const source=fs.readFileSync(path.resolve(__dirname,'../../../src/game/springFlight.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}};new Function('exports','module',js)(mod.exports,mod);
const {springTrajectory,springDeliveryProgress}=mod.exports;const results=[];
function test(name,fn){fn();results.push({name,passed:true})}
test('弹簧起始脚底位置与向上速度正确',()=>{const t=springTrajectory(0,1000,257.6,88.32);assert.equal(t.feetY,1000);assert.ok(t.vy<0);assert.equal(t.landed,false)});
test('0.95秒顶点达到883.2px且不会过早落地',()=>{const t=springTrajectory(.95,1000,257.6,88.32);assert.ok(Math.abs(1000-t.feetY-883.2)<1e-8);assert.ok(Math.abs(t.vy)<1e-8);assert.equal(t.landed,false)});
test('最后平台抬升742.40px，下降约1.32931秒准确落地',()=>{const t=springTrajectory(2,1000,257.6,88.32);assert.equal(t.feetY,257.6);assert.equal(t.vy,0);assert.ok(Math.abs(t.landingTime-1.3293109695147278)<1e-7);assert.equal(t.landed,true)});
test('0.8秒十个盒子都已到位，前进进度不回退',()=>{for(let i=0;i<10;i++){assert.equal(springDeliveryProgress(.8,i),1);let last=-1;for(let t=0;t<.85;t+=.008){const p=springDeliveryProgress(t,i);assert.ok(p>=last&&p<=1);last=p}}});
test('第一盒与第十盒有正确的错峰启动',()=>{assert.equal(springDeliveryProgress(.09,0),0);assert.equal(springDeliveryProgress(.52,9),0);assert.ok(springDeliveryProgress(.56,9)>0)});
test('不同固定步采样都吸附同一落点且仅单一结束时间',()=>{for(const step of [.008,.016,.033]){let elapsed=0;let state;do{elapsed+=step;state=springTrajectory(elapsed,1000,257.6,88.32)}while(!state.landed);assert.equal(state.feetY,257.6);assert.equal(state.vy,0);assert.ok(elapsed>=state.landingTime&&elapsed-state.landingTime<step)}});
console.log(JSON.stringify({passed:results.length,results},null,2));
fs.writeFileSync(path.resolve(__dirname,'../validation/spring-results.json'),JSON.stringify({passed:results.length,results},null,2));
