'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scene,next,land,redPickup,load}=require('../speed-box/test_speed.cjs');
const {BoxSkinCollection}=load('src/game/boxSkins.ts');
let serial=0;const results=[];
function test(name,fn){fn();results.push(name);console.log('PASS '+name);}
function collection(){const storage={getItem:()=>null,setItem(){}};const c=new BoxSkinCollection('game-qa-'+(++serial),storage);const wallet={total:3000,spend(n){this.total-=n;return true;}};c.unlock('ocean',wallet);return c;}
function random(value,fn){const original=Math.random;Math.random=()=>value;try{return fn();}finally{Math.random=original;}}

test('actual spawnMover emits selected cosmetic as a normal box with original geometry',()=>{
 const g=scene(),old=g.body(g.mover);g.skins=collection();const b=random(0.75,()=>next(g));
 assert.equal(b.node.textureKey,'skin-ocean');assert.equal(b.item,'normal');assert.equal(b.itemConsumed,false);
 const body=g.body(b);assert.ok(Math.abs(body.displayWidth-old.displayWidth)<1e-8);assert.ok(Math.abs(body.displayHeight-old.displayHeight)<1e-8);
});
test('actual special mover generation never draws a cosmetic texture',()=>{
 const g=scene(),c=collection();g.skins=c;let calls=0;const roll=c.rollTexture.bind(c);c.rollTexture=(...args)=>{calls++;return roll(...args);};
 for(const kind of ['coin','shield','spring','speed']){const b=next(g,kind);assert.equal(b.node.textureKey,'block-'+kind);assert.equal(b.item,kind);}
 assert.equal(calls,0);
});
test('unlocked but unchecked skin cannot spawn in the actual scene',()=>{
 const g=scene(),c=collection();g.skins=c;c.toggle('ocean');for(const value of [0,0.5,0.999]){
  const b=random(value,()=>next(g));assert.equal(b.node.textureKey,'block-mover');
 }
});
test('cosmetic normal landing preserves scoring and never grants a special pickup',()=>{
 const g=scene();g.skins=collection();random(0.75,()=>next(g));const b=land(g);
 assert.equal(b.item,'normal');assert.equal(g.heightMeters,2);assert.equal(g.wallet.total,100);assert.equal(g.shieldCharge.active,false);assert.equal(g.springFlight,null);
});
test('accelerated cosmetic box uses the existing 1.3x snapshot and speed visuals',()=>{
 const g=scene();redPickup(g);g.skins=collection();const b=random(0.75,()=>next(g));
 assert.equal(b.node.textureKey,'skin-ocean');assert.equal(b.speedMultiplier,1.3);assert.ok(Math.abs(Math.abs(b.vx)-517.4)<1e-8);assert.ok(g.itemEffects.speedMover);
});
test('spring ten automatic boxes may share cosmetic pool but stay ordinary and consume no boost charges',()=>{
 const g=scene();redPickup(g);g.skins=collection();g.forceItem('spring');random(0.75,()=>land(g));
 assert.ok(g.springFlight);assert.equal(g.springFlight.deliveries.length,10);assert.equal(g.speedBoost.remaining,4);
 for(const d of g.springFlight.deliveries){assert.equal(d.block.node.textureKey,'skin-ocean');assert.equal(d.block.item,'normal');assert.equal(d.block.speedMultiplier,1);}
 random(0.75,()=>g.simulateSpring(5));assert.equal(g.heightMeters,12);assert.equal(g.speedBoost.remaining,3);
});
test('default yellow remains reachable while a skin is selected',()=>{
 const g=scene();g.skins=collection();const b=random(0,()=>next(g));assert.equal(b.node.textureKey,'block-mover');
});
fs.writeFileSync(path.join(__dirname,'validation/game-results.json'),JSON.stringify({passed:results.length,tests:results,visualBrowserPlaytest:false},null,2));console.log(`\n${results.length} game pool checks passed.`);
