'use strict';
// Actual scene methods; lightweight Phaser API doubles (not a browser rendering acceptance test).
const assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const root=path.resolve(__dirname,'../..'),ts=require(path.join(root,'node_modules/typescript'));
const saved=new Map();const context=vm.createContext({console,localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,String(v))}});
function load(relative,deps={}){
 const filename=path.join(root,relative),source=fs.readFileSync(filename,'utf8').replaceAll('import.meta.env.DEV','true');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,useDefineForClassFields:true}}).outputText;
 const module={exports:{}};vm.runInContext('(function(exports,require,module){'+output+'})',context,{filename})(module.exports,n=>deps[n]||{},module);return module.exports;
}
class Rect{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}setTo(x,y,width,height){Object.assign(this,{x,y,width,height});return this;}static Contains(){return true;}}
class Node extends EventEmitter{
 constructor(x=0,y=0,w=0,h=0){super();Object.assign(this,{x,y,width:w,height:h,scaleX:1,scaleY:1,children:[],data:{},scene:{}});}
 setSize(w,h){this.width=w;this.height=h;return this;}setDisplaySize(w,h){return this.setSize(w,h);}setPosition(x,y){this.x=x;this.y=y;return this;}
 setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;}setOrigin(){return this;}setDepth(){return this;}setVisible(){return this;}setStrokeStyle(){return this;}
 setData(k,v){this.data[k]=v;return this;}getData(k){return this.data[k];}setInteractive(area){this.input={hitArea:area||new Rect(0,0,this.width,this.height)};return this;}
 add(child){for(const n of Array.isArray(child)?child:[child]){this.children.push(n);n.parent=this;}return this;}
 removeAll(destroy){if(destroy)this.children.forEach(n=>n.destroy());this.children=[];return this;}
 destroy(){this.destroyed=true;this.children.forEach(n=>n.destroy());this.scene=null;this.removeAllListeners();}
 setText(value){this.text=value;this.width=value.length*20;return this;}setTexture(value){this.texture=value;return this;}
 getBounds(){let x=this.x,y=this.y,sx=this.scaleX,sy=this.scaleY,p=this.parent;while(p){x=p.x+x*p.scaleX;y=p.y+y*p.scaleY;sx*=p.scaleX;sy*=p.scaleY;p=p.parent;}return new Rect(x-this.width*sx/2,y-this.height*sy/2,this.width*sx,this.height*sy);}
}
class Graphics extends Node{clear(){return this;}}
for(const name of ['fillStyle','fillRoundedRect','lineStyle','strokeRoundedRect','fillRect','fillCircle','strokeCircle','lineBetween','fillEllipse','beginPath','arc','strokePath'])Graphics.prototype[name]=function(){return this;};
class Keyboard extends EventEmitter{
 on(event,callback,owner){const fn=owner?callback.bind(owner):callback;this.bindings??=new Map();this.bindings.set(callback,fn);return super.on(event,fn);}
 off(event,callback){return super.off(event,this.bindings?.get(callback)||callback);}
}
const phaser={Scene:class{},Geom:{Rectangle:Rect},GameObjects:{}};
const skins=load('src/game/boxSkins.ts'),coins=load('src/game/coinHud.ts');
const {SkinShop}=load('src/game/scenes/SkinShop.ts',{phaser,'../boxSkins':skins,'../coinHud':coins,'../audio':{playSfx(){}},'../layout':{bindResize(){}},'../player':{PLAYER_ART_FEET:480,PLAYER_ART_HEIGHT:512,PLAYER_ART_TOP:0}});
const {MainMenu}=load('src/game/scenes/MainMenu.ts',{phaser,'../audio':{playSfx(){}},'../layout':{bindResize(){},coverImage(){}},'./SkinShop':{SKIN_SHOP_SCENE:'SkinShop'},'./WeeklyRanking':{WEEKLY_RANK_SCENE:'WeeklyRanking'},'../leaderboardContext':{getWeeklyLeaderboard:()=>({})}});
let sequence=0;const results=[];function test(name,fn){fn();results.push(name);console.log('PASS '+name);}
function setup(balance=1000,width=414,height=896){
 const suffix='scene-qa-'+(++sequence),wallet=new coins.CoinWallet(suffix+'-coins');wallet.add(balance);
 const g=new SkinShop();g.registry={get:k=>k==='coinStorageKey'?suffix+'-coins':k==='skinStorageKey'?suffix+'-skins':undefined};
 g.scale={width,height};g.events=new EventEmitter();g.input={keyboard:new Keyboard()};
 g.add={container:(x=0,y=0)=>new Node(x,y),rectangle:(x,y,w,h)=>new Node(x,y,w,h),graphics:()=>new Graphics(),image:(x,y,k)=>new Node(x,y,256,192).setTexture(k),sprite:(x,y)=>new Node(x,y,200,512),text:(x,y,t)=>new Node(x,y).setText(t),star:(x,y)=>new Node(x,y,40,40)};
 let closes=0,stops=0;g.scene={stop(){stops++;},isActive(){return true;}};g.init({onClose(){closes++;}});g.create();
 return {g,wallet,suffix,closes:()=>closes,stops:()=>stops};
}
const pointer={id:1,button:0};function click(node){let stopped=0;const e={stopPropagation(){stopped++;}};node.emit('pointerdown',pointer,0,0,e);node.emit('pointerup',pointer,0,0,e);assert.equal(stopped,2);}
function within(bounds,w,h){assert.ok(bounds.x>=-0.1&&bounds.y>=-0.1&&bounds.x+bounds.width<=w+0.1&&bounds.y+bounds.height<=h+0.1,JSON.stringify(bounds));}

test('actual shop builds all six cards with current coin balance',()=>{const {g}=setup();assert.equal(g.cardNodes.size,6);assert.equal(g.balanceLabel.text,'1000');assert.equal(g.focused,'sunny');assert.equal(g.actionLabel.text,'500 金币解锁');});
test('locked card click previews without charging coins',()=>{const {g,wallet}=setup();click(g.cardNodes.get('cake'));assert.equal(g.focused,'cake');assert.equal(wallet.total,1000);assert.equal(g.previewImage.texture,'skin-cake');assert.equal(g.collection.isUnlocked('cake'),false);});
test('purchase button unlocks and equips, updates balance and state immediately',()=>{const {g,wallet}=setup();click(g.action);assert.equal(wallet.total,500);assert.equal(g.collection.isSelected('sunny'),true);assert.equal(g.balanceLabel.text,'500');assert.equal(g.actionLabel.text,'移出随机池');assert.equal(g.previewState.text,'已加入随机池');});
test('insufficient purchase displays missing coins and never grants skin',()=>{const {g,wallet}=setup(200);click(g.action);assert.equal(wallet.total,200);assert.equal(g.collection.isUnlocked('sunny'),false);assert.ok(g.message.text.includes('还差 300'));});
test('owned bottom action toggles without charging again',()=>{const {g,wallet}=setup();click(g.action);click(g.action);assert.equal(wallet.total,500);assert.equal(g.collection.isSelected('sunny'),false);assert.equal(g.collection.isUnlocked('sunny'),true);click(g.action);assert.equal(wallet.total,500);assert.equal(g.collection.isSelected('sunny'),true);});
test('card checkbox toggles in place without losing other selections',()=>{const {g,wallet}=setup(1500);click(g.action);click(g.cardNodes.get('ocean'));click(g.action);const card=g.cardNodes.get('sunny');const checkbox=card.children.find(n=>n.width===48&&n.height===48);click(checkbox);assert.equal(wallet.total,500);assert.equal(g.collection.isSelected('sunny'),false);assert.equal(g.collection.isSelected('ocean'),true);});
test('pointer out cancels purchase and right-click does not purchase',()=>{const {g,wallet}=setup(),e={stopPropagation(){}};g.action.emit('pointerdown',pointer,0,0,e);g.action.emit('pointerout');g.action.emit('pointerup',pointer,0,0,e);assert.equal(wallet.total,1000);g.action.emit('pointerdown',{id:1,button:2},0,0,e);g.action.emit('pointerup',{id:1,button:2},0,0,e);assert.equal(wallet.total,1000);});
test('close button returns once and ignores subsequent actions',()=>{const s=setup();click(s.g.closeNode);s.g.close();s.g.applyFocused();assert.equal(s.closes(),1);assert.equal(s.stops(),1);assert.equal(s.wallet.total,1000);});
test('Escape closes and keyboard handlers are cleaned up on shutdown',()=>{const s=setup();s.g.input.keyboard.emit('keydown-ESC');assert.equal(s.closes(),1);s.g.events.emit('shutdown');assert.equal(s.g.input.keyboard.listenerCount('keydown-ESC'),0);});
test('six cards and action/close buttons fit portrait and landscape viewports',()=>{for(const [w,h]of [[320,568],[414,896],[554,515],[1280,720]]){const {g}=setup(1000,w,h);for(const n of g.cardNodes.values())within(n.getBounds(),w,h);within(g.action.getBounds(),w,h);within(g.closeNode.getBounds(),w,h);}});
test('resizing keeps focus and selected skins',()=>{const {g}=setup();click(g.action);g.scale={width:1280,height:720};g.layout();assert.equal(g.focused,'sunny');assert.equal(g.collection.isSelected('sunny'),true);within(g.action.getBounds(),1280,720);});
test('menu skin entry launches shop once and pauses the menu',()=>{const m=new MainMenu(),callbacks=[];let launches=0,pauses=0,resumes=0,options;m.pop=()=>{};m.time={delayedCall:(_d,cb)=>callbacks.push(cb)};m.scene={isActive:()=>true,launch:(key,data)=>{assert.equal(key,'SkinShop');launches++;options=data;},pause:()=>pauses++,resume:()=>resumes++};m.onButton('skin',{});m.onButton('skin',{});m.onButton('start',{});assert.equal(callbacks.length,1);callbacks[0]();assert.equal(launches,1);assert.equal(pauses,1);options.onClose();assert.equal(m.shopOpen,false);assert.equal(resumes,1);});
fs.writeFileSync(path.join(__dirname,'validation/scene-results.json'),JSON.stringify({passed:results.length,tests:results,visualBrowserPlaytest:false},null,2));console.log(`\n${results.length} scene checks passed.`);
