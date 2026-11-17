'use strict';
// Real Game/GameOver methods and real press-bounce helper, with deterministic Phaser API doubles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'node_modules/typescript'));
const {scene,next,land}=require('../speed-box/test_speed.cjs');
let activeClock;
class Clock{
 constructor(){this.now=0;this.timers=[];this.frames=[];}
 delayedCall(ms,fn){const t={at:this.now+ms,ms,fn,removed:false,remove(){this.removed=true;}};this.timers.push(t);return t;}
 advance(ms){this.now+=ms;const frames=this.frames.splice(0);for(const fn of frames)fn(this.now);for(;;){const due=this.timers.filter(t=>!t.removed&&t.at<=this.now).sort((a,b)=>a.at-b.at)[0];if(!due)break;due.removed=true;due.fn();}}
}
class Emitter extends EventEmitter{
 on(event,fn,owner){const cb=owner?fn.bind(owner):fn;this.bindings??=new Map();this.bindings.set(fn,cb);return super.on(event,cb);}
}
class Rect{
 constructor(x=0,y=0,width=0,height=0){this.setTo(x,y,width,height);}
 setTo(x,y,width,height){Object.assign(this,{x,y,width,height});return this;}
 static Contains(){return true;}get right(){return this.x+this.width;}get bottom(){return this.y+this.height;}
}
class Node extends Emitter{
 constructor(owner,x=0,y=0,w=0,h=0){super();Object.assign(this,{scene:owner,x,y,width:w,height:h,scaleX:1,scaleY:1,visible:true,children:[],data:{}});}
 setOrigin(){return this;}setDepth(){return this;}setSize(w,h){this.width=w;this.height=h;return this;}setPosition(x,y){this.x=x;this.y=y;return this;}
 setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;}setVisible(v){this.visible=v;return this;}setData(k,v){this.data[k]=v;return this;}getData(k){return this.data[k];}
 setInteractive(area){this.input={enabled:true,hitArea:area??new Rect(0,0,this.width,this.height)};return this;}
 add(nodes){for(const n of Array.isArray(nodes)?nodes:[nodes]){this.children.push(n);n.parent=this;}return this;}
 getWorldTransformMatrix(){return {transformPoint:(x,y)=>{let n=this;while(n){x=n.x+x*n.scaleX;y=n.y+y*n.scaleY;n=n.parent;}return {x,y};}};}
}
class Graphics extends Node{}
for(const method of ['fillStyle','fillRoundedRect','lineStyle','strokeRoundedRect','fillCircle','strokeCircle'])Graphics.prototype[method]=function(){return this;};
const context=vm.createContext({console,performance:{now:()=>activeClock.now},requestAnimationFrame:fn=>activeClock.frames.push(fn)});
function load(relative,deps={}){
 const filename=path.join(root,relative),source=fs.readFileSync(filename,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,useDefineForClassFields:true}}).outputText;
 const module={exports:{}};vm.runInContext('(function(exports,require,module){'+output+'})',context,{filename})(module.exports,n=>deps[n]||{},module);return module.exports;
}
const math={Easing:{Quadratic:{In:t=>t*t},Back:{Out:t=>1+2.70158*(t-1)**3+1.70158*(t-1)**2}}};
const phaser={Scene:class{},Geom:{Rectangle:Rect},Math:math};
const bounce=load('src/game/pressBounce.ts',{phaser});
const {GameOver}=load('src/game/scenes/GameOver.ts',{phaser,'../pressBounce':bounce,'../audio':{playSfx(){}},'../layout':{bindResize(){},coverImage(){}}});
const results=[];function test(name,fn){fn();results.push(name);console.log('PASS '+name);}
const primary={id:7,button:0};function press(node){const e={stopPropagation(){}};node.emit('pointerdown',primary,0,0,e);node.emit('pointerup',primary,0,0,e);activeClock.advance(360);}
function gameSetup(boxes=3){
 const g=scene();for(let i=0;i<boxes;i++){if(i>0)next(g);land(g);}
 activeClock=new Clock();g.time=activeClock;
 const ops=[];let active=true;g.scene={isActive:()=>active,isPaused:()=>!active,launch:(key,data)=>ops.push({op:'launch',key,data}),pause:()=>{active=false;ops.push({op:'pause'});},start:(key,data)=>ops.push({op:'start',key,data})};
 g.cameras.main.roundPixels=true;
 const tweens=[];g.tweens={add:config=>{tweens.push(config);},getTweensOf:()=>[],killTweensOf(){}};
 g.children={list:[g.background,g.player.node,g.player.sprite,g.hint,g.speedText,...g.stack.map(b=>b.node),g.mover.node]};
 return {g,ops,tweens,clock:activeClock,setActive:v=>active=v};
}
function drop(g){g.fly(0);g.player.node.y=g.cameras.main.scrollY+g.scale.height+g.player.node.displayHeight+60;g.simulate(0);}
function resultSetup(backdrop=true,summary={meters:43,coinsEarned:80,totalCoins:700,boxes:9,perfectBoxes:4}){
 activeClock=new Clock();const r=new GameOver(),ops=[];r.time=activeClock;r.scale={width:414,height:896};r.events=new Emitter();r.cameras={main:{setBackgroundColor:v=>r.cameraColor=v}};
 r.add={image:(x,y)=>new Node(r,x,y,800,1000),rectangle:(x,y,w,h)=>new Node(r,x,y,w,h),container:(x=0,y=0)=>new Node(r,x,y),graphics:()=>new Graphics(r),text:(x,y,t)=>Object.assign(new Node(r,x,y,t.length*20,40),{text:t})};
 r.scene={stop:key=>ops.push({op:'stop',key}),start:key=>ops.push({op:'start',key})};r.init({...summary,towerBackdrop:backdrop});r.create();return {r,ops,clock:activeClock};
}
function reveal(r,button=0){let stopped=0;r.revealArea.emit('pointerdown',{id:7,button},0,0,{stopPropagation(){stopped++;}});assert.equal(stopped,1);}
function within(b,w,h){assert.ok(b.x>=0&&b.y>=0&&b.right<=w&&b.bottom<=h,JSON.stringify(b));}

test('visible failed actor falls with the original camera and no zoom timer',()=>{
 const {g,tweens,clock}=gameSetup();const before=g.cameras.main.scrollY;g.fly(0);g.simulate(.008);
 assert.equal(g.overviewStarted,false);assert.equal(clock.timers.length,0);assert.equal(tweens.length,0);assert.equal(g.cameras.main.zoom,1);assert.equal(g.cameras.main.scrollY,before);
});
test('whole actor must cross below viewport before the one-second countdown',()=>{
 const {g,clock}=gameSetup();g.fly(0);g.player.node.y=g.cameras.main.scrollY+g.scale.height+g.player.node.displayHeight/2+24;g.simulate(0);
 assert.equal(g.failureDropComplete,false);assert.equal(clock.timers.length,0);g.player.node.y+=1;g.simulate(0);assert.equal(g.failureDropComplete,true);assert.equal(clock.timers[0].ms,1000);
});
test('zoom is still absent after 999ms and begins exactly at the next millisecond',()=>{
 const {g,clock,tweens}=gameSetup();drop(g);clock.advance(999);assert.equal(g.overviewStarted,false);assert.equal(g.cameras.main.zoom,1);
 clock.advance(1);assert.equal(g.overviewStarted,true);assert.equal(tweens.length,1);assert.equal(tweens[0].duration,900);assert.equal(g.cameras.main.roundPixels,false);
});
test('drop is scheduled once and the fallen actor cannot return during overview',()=>{
 const {g,clock}=gameSetup();drop(g);const y=g.player.node.y;for(let i=0;i<100;i++)g.simulate(.008);
 assert.equal(clock.timers.length,1);assert.equal(g.player.sprite.visible,false);assert.equal(g.player.node.y,y);assert.equal(g.player.vx,0);assert.equal(g.player.vy,0);
});
test('leaving the scene before countdown completion does not begin overview',()=>{
 const s=gameSetup();drop(s.g);s.setActive(false);s.clock.advance(1000);assert.equal(s.g.overviewStarted,false);assert.equal(s.tweens.length,0);
});
test('new round cancels old delay and restores initial camera and fall state',()=>{
 const {g,clock}=gameSetup();drop(g);const old=clock.timers[0];g.create();assert.equal(old.removed,true);assert.equal(g.failureDropComplete,false);assert.equal(g.overviewStarted,false);assert.equal(g.cameras.main.zoom,1);assert.equal(g.player.sprite.visible,true);
});
test('overview preserves tower nodes even above HUD depth and hides all decorations',()=>{
 const {g,clock}=gameSetup();g.stack[1].node.depth=3000;drop(g);clock.advance(1000);
 for(const b of g.stack){assert.equal(b.node.visible,true);assert.ok(b.node.scene);}
 assert.equal(g.background.visible,true);assert.equal(g.hint.visible,false);assert.equal(g.speedText.visible,false);assert.equal(g.mover.node.visible,false);
});
test('full tower and ground margins fit the final overview frame',()=>{
 const {g,clock,tweens}=gameSetup(20);drop(g);clock.advance(1000);const c=tweens[0],span=g.towerSpan();
 assert.ok(c.zoom<1);assert.ok((span.bottom-span.top)*c.zoom<=g.scale.height*.84+1e-7);
 Object.assign(g.overviewFrame,{zoom:c.zoom,scrollX:c.scrollX,scrollY:c.scrollY});c.onUpdate();assert.equal(g.cameras.main.zoom,c.zoom);
});
test('zoom completion retains 1-second hold then launches settlement and pauses old game',()=>{
 const {g,clock,tweens,ops}=gameSetup();drop(g);clock.advance(1000);tweens[0].onComplete();clock.advance(999);assert.equal(ops.length,0);
 clock.advance(1);assert.deepEqual(ops.map(o=>o.op),['launch','pause']);assert.equal(ops[0].key,'GameOver');assert.equal(ops[0].data.towerBackdrop,true);assert.equal(g.settlementShown,true);assert.equal(g.phase,'over');
 assert.equal(ops[0].data.boxes,3);assert.equal(ops[0].data.meters,9);assert.equal(ops[0].data.perfectBoxes,3);
});
test('settlement launch is idempotent and frozen simulation awards nothing',()=>{
 const {g,ops}=gameSetup();g.showOver();g.showOver();const values=[g.player.node.x,g.player.node.y,g.wallet.total,g.heightMeters,g.stack.length];g.simulate(.25);g.update(1000,48);
 assert.equal(ops.filter(o=>o.op==='launch').length,1);assert.deepEqual([g.player.node.x,g.player.node.y,g.wallet.total,g.heightMeters,g.stack.length],values);
});
test('resize snaps final tower framing without scheduling a second hold or removing skin nodes',()=>{
 const {g,clock}=gameSetup();drop(g);clock.advance(1000);g.overviewHoldScheduled=true;g.scale={width:1280,height:720};g.frameTower(true);assert.equal(clock.timers.length,1);for(const b of g.stack)assert.equal(b.node.visible,true);
});
test('result overlay has transparent camera and no replacement city background',()=>{
 const {r}=resultSetup();assert.equal(r.cameraColor,'rgba(0,0,0,0)');assert.equal(r.background.visible,false);assert.equal(r.hideButton.visible,true);assert.equal(r.resultHidden,false);
});
test('top-left hide button hides card and shade without changing scene',()=>{
 const {r,ops}=resultSetup();press(r.hideButton);assert.equal(r.resultHidden,true);assert.equal(r.root.visible,false);assert.equal(r.shade.visible,false);assert.equal(r.revealArea.visible,true);assert.equal(ops.length,0);
 assert.equal(r.retryButton.input.enabled,false);assert.equal(r.menuButton.input.enabled,false);
});
test('screen press restores the same result without retrying or changing summary',()=>{
 const {r,ops}=resultSetup();const old=JSON.stringify(r.summary);press(r.hideButton);reveal(r);
 assert.equal(r.resultHidden,false);assert.equal(r.root.visible,true);assert.equal(r.shade.visible,true);assert.equal(r.revealArea.visible,false);assert.equal(JSON.stringify(r.summary),old);assert.equal(ops.length,0);assert.equal(r.retryButton.input.enabled,true);
});
test('release from reveal gesture cannot activate the retry button',()=>{
 const {r,ops,clock}=resultSetup();press(r.hideButton);reveal(r);r.retryButton.emit('pointerup',primary,0,0,{stopPropagation(){}});clock.advance(400);assert.equal(ops.length,0);assert.equal(r.chosen,false);
});
test('repeated hide and show never resumes game or adds navigation',()=>{
 const {r,ops}=resultSetup();for(let i=0;i<12;i++){press(r.hideButton);assert.equal(r.resultHidden,true);reveal(r);assert.equal(r.resultHidden,false);}assert.equal(ops.length,0);
});
test('hidden result cannot retry or return even via delayed or direct button actions',()=>{
 const {r,ops}=resultSetup();press(r.hideButton);press(r.retryButton);press(r.menuButton);r.choose('Game');r.choose('MainMenu');assert.equal(ops.length,0);assert.equal(r.chosen,false);
});
test('right-click does not reveal or navigate, primary input still works',()=>{
 const {r,ops}=resultSetup();press(r.hideButton);reveal(r,2);assert.equal(r.resultHidden,true);assert.equal(ops.length,0);reveal(r);assert.equal(r.resultHidden,false);
});
test('retry stops old paused Game before starting fresh Game and shutdown never stops fresh game',()=>{
 const {r,ops}=resultSetup();press(r.retryButton);r.events.emit('shutdown');assert.deepEqual(ops,[{op:'stop',key:'Game'},{op:'start',key:'Game'}]);r.choose('Game');assert.equal(ops.length,2);
});
test('menu choice cleans old paused Game and leaves no second navigation',()=>{
 const {r,ops}=resultSetup();press(r.menuButton);r.events.emit('shutdown');r.choose('Game');assert.deepEqual(ops,[{op:'stop',key:'Game'},{op:'start',key:'MainMenu'}]);
});
test('external settlement shutdown also cleans orphaned paused Game',()=>{
 const {r,ops}=resultSetup();r.events.emit('shutdown');assert.deepEqual(ops,[{op:'stop',key:'Game'}]);
});
test('old button-down released over blank area is cancelled before hide and cannot pair with reveal-up',()=>{
 for(const key of ['retryButton','menuButton']){
  const {r,ops,clock}=resultSetup(),e={stopPropagation(){}};
  r[key].emit('pointerdown',primary,0,0,e);r.shade.emit('pointerup',primary,0,0,e);clock.advance(400);
  press(r.hideButton);reveal(r);r[key].emit('pointerup',primary,0,0,e);clock.advance(400);
  assert.equal(ops.length,0);assert.equal(r.chosen,false);
 }
});
test('hiding cancels a queued bounce action even if result is restored before its timer fires',()=>{
 const {r,ops,clock}=resultSetup(),e={stopPropagation(){}};
 r.retryButton.emit('pointerdown',primary,0,0,e);r.retryButton.emit('pointerup',primary,0,0,e);
 r.hideResult();reveal(r);clock.advance(400);assert.equal(ops.length,0);assert.equal(r.chosen,false);
});
test('resize during failed fall and countdown never snaps the camera back to the fallen actor',()=>{
 const {g,clock}=gameSetup();g.fly(0);let follows=0;g.followCamera=()=>follows++;
 const scroll=g.cameras.main.scrollY;g.resizeForTest();assert.equal(follows,0);assert.equal(g.cameras.main.scrollY,scroll);
 drop(g);g.scale={width:800,height:720};g.resizeForTest();assert.equal(follows,0);clock.advance(999);assert.equal(g.overviewStarted,false);clock.advance(1);assert.equal(g.overviewStarted,true);
});
test('standalone zero-result page retains background and normal two-button navigation',()=>{
 const {r,ops}=resultSetup(false,{meters:0,totalCoins:0,coinsEarned:0,boxes:0,perfectBoxes:0});assert.equal(r.background.visible,true);assert.equal(r.hideButton.visible,false);r.hideResult();assert.equal(r.resultHidden,false);press(r.retryButton);assert.deepEqual(ops,[{op:'start',key:'Game'}]);
});
test('result statistics sanitize impossible numbers and hidden mode never alters them',()=>{
 const {r}=resultSetup(true,{meters:NaN,totalCoins:500,coinsEarned:800,boxes:3,perfectBoxes:999});assert.equal(r.summary.meters,0);assert.equal(r.summary.coinsEarned,500);assert.equal(r.summary.perfectBoxes,3);press(r.hideButton);reveal(r);assert.equal(r.summary.coinsEarned,500);
});
test('hide, retry, menu and reveal hit areas fit portrait and landscape and persist hidden on resize',()=>{
 const {r}=resultSetup();for(const [w,h]of [[320,568],[554,515],[1280,720]]){r.scale={width:w,height:h};r.layout();const s=r.status();within(s.hideBounds,w,h);within(s.retryBounds,w,h);within(s.menuBounds,w,h);assert.equal(r.revealArea.input.hitArea.width,w);assert.equal(r.revealArea.input.hitArea.height,h);}
 press(r.hideButton);r.scale={width:414,height:896};r.layout();assert.equal(r.resultHidden,true);assert.equal(r.root.visible,false);assert.equal(r.shade.visible,false);
});
fs.writeFileSync(path.join(__dirname,'validation/results.json'),JSON.stringify({passed:results.length,tests:results,browserVisualAcceptance:false},null,2));console.log(`\n${results.length} settlement delay/toggle checks passed.`);
