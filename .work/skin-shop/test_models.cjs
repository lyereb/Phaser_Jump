'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'node_modules/typescript'));
class MemoryStorage {
    constructor() { this.values = new Map(); this.blockReads = false; this.blockWrites = false; }
    getItem(key) { if (this.blockReads) throw Error('read blocked'); return this.values.get(key) ?? null; }
    setItem(key, value) { if (this.blockWrites) throw Error('quota'); this.values.set(key, String(value)); }
}
const storage = new MemoryStorage();
const context = vm.createContext({ console, localStorage: storage });
function load(relative, deps = {}) {
    const filename = path.join(root, relative), source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,useDefineForClassFields:true}}).outputText;
    const module = {exports:{}};
    vm.runInContext('(function(exports,require,module){\n' + output + '\n})', context, {filename})(module.exports, name => deps[name] || {}, module);
    return module.exports;
}
const skins = load('src/game/boxSkins.ts');
const {CoinWallet} = load('src/game/coinHud.ts');
const rules = load('src/game/itemRules.ts');
const {BoxSkinCollection, BOX_SKINS} = skins;
let sequence = 0;
const results = [];
function fresh(coins = 1000) {
    const suffix = 'qa-skin-' + (++sequence), wallet = new CoinWallet(suffix + '-coins');
    wallet.add(coins); return {wallet, collection: new BoxSkinCollection(suffix + '-skins', storage), suffix};
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
function test(name, fn) { fn(); results.push(name); console.log('PASS ' + name); }

test('six skins have unique ids files and texture keys, price 500', () => {
    assert.equal(BOX_SKINS.length,6); assert.equal(skins.SKIN_PRICE,500);
    for (const field of ['id','file','texture']) assert.equal(new Set(BOX_SKINS.map(s=>s[field])).size,6);
});
test('fresh collection includes default yellow only', () => {
    const {collection:c}=fresh(); assert.deepEqual(plain(c.pool()),['block-mover']);
    assert.deepEqual(plain(c.snapshot().unlocked),[]); assert.deepEqual(plain(c.snapshot().selected),[]);
});
test('successful unlock deducts exactly 500 and selects immediately', () => {
    const {wallet:w,collection:c}=fresh(1250); assert.equal(c.unlock('sunny',w),'unlocked');
    assert.equal(w.total,750); assert.equal(c.isUnlocked('sunny'),true); assert.equal(c.isSelected('sunny'),true);
    assert.deepEqual(plain(c.pool()),['block-mover','skin-sunny']);
});
test('exactly 500 coins can buy once and balance becomes zero', () => {
    const {wallet:w,collection:c}=fresh(500); assert.equal(c.unlock('sunny',w),'unlocked'); assert.equal(w.total,0);
});
test('coffee cake and royal cost 1000 2000 and 5000', () => {
    assert.equal(BOX_SKINS.find(s=>s.id==='coffee').price,1000);
    assert.equal(BOX_SKINS.find(s=>s.id==='cake').price,2000);
    assert.equal(BOX_SKINS.find(s=>s.id==='royal').price,5000);
    const coffee=fresh(1000); assert.equal(coffee.collection.unlock('coffee',coffee.wallet),'unlocked'); assert.equal(coffee.wallet.total,0);
    const short=fresh(1999); assert.equal(short.collection.unlock('cake',short.wallet),'insufficient-coins'); assert.equal(short.wallet.total,1999);
    const royal=fresh(5000); assert.equal(royal.collection.unlock('royal',royal.wallet),'unlocked'); assert.equal(royal.wallet.total,0);
});
test('insufficient coins change neither ownership selection nor wallet', () => {
    const {wallet:w,collection:c}=fresh(499); assert.equal(c.unlock('sunny',w),'insufficient-coins');
    assert.equal(w.total,499); assert.equal(c.isUnlocked('sunny'),false); assert.equal(c.pool().length,1);
});
test('repeated unlock calls never charge again or alter a manual deselection', () => {
    const {wallet:w,collection:c}=fresh(); c.unlock('sunny',w); c.toggle('sunny');
    for(let i=0;i<10;i++) assert.equal(c.unlock('sunny',w),'already-unlocked');
    assert.equal(w.total,500); assert.equal(c.isSelected('sunny'),false);
});
test('unlocked selection toggles without another charge and ownership is retained', () => {
    const {wallet:w,collection:c}=fresh(); c.unlock('sunny',w); assert.equal(c.toggle('sunny'),true);
    assert.equal(c.isSelected('sunny'),false); assert.equal(c.isUnlocked('sunny'),true); assert.equal(w.total,500);
    c.toggle('sunny'); assert.equal(c.isSelected('sunny'),true); assert.equal(w.total,500);
});
test('multiple unlocked skins can be selected together', () => {
    const {wallet:w,collection:c}=fresh(9500); for(const s of BOX_SKINS)c.unlock(s.id,w);
    assert.equal(w.total,0); assert.equal(c.pool().length,7); assert.equal(c.snapshot().selected.length,6);
});
test('deselecting all keeps the default yellow in the pool', () => {
    const {wallet:w,collection:c}=fresh(9500); for(const s of BOX_SKINS){c.unlock(s.id,w);c.toggle(s.id);}
    assert.deepEqual(plain(c.pool()),['block-mover']); assert.equal(c.snapshot().unlocked.length,6);
});
test('locked and unknown skins cannot enter the random pool', () => {
    const {wallet:w,collection:c}=fresh(); assert.equal(c.toggle('sunny'),false); assert.equal(c.toggle('unknown'),false);
    assert.equal(c.unlock('unknown',w),'unknown-skin'); assert.equal(w.total,1000); assert.equal(c.pool().length,1);
});
test('ownership selection and coins survive new instances', () => {
    const {wallet:w,collection:c,suffix}=fresh(2500); c.unlock('ocean',w); c.unlock('cake',w); c.toggle('cake');
    const reopened=new BoxSkinCollection(suffix+'-skins',storage), wallet=new CoinWallet(suffix+'-coins');
    assert.equal(wallet.total,0); assert.deepEqual(plain(reopened.snapshot().unlocked),['ocean','cake']);
    assert.deepEqual(plain(reopened.snapshot().selected),['ocean']);
});
test('fresh VM simulates browser refresh and restores persisted purchases', () => {
    const {wallet:w,collection:c,suffix}=fresh(); c.unlock('coffee',w);
    const newContext=vm.createContext({localStorage:storage});
    const filename=path.join(root,'src/game/boxSkins.ts');
    const output=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    const module={exports:{}}; vm.runInContext('(function(exports,module){'+output+'})',newContext)(module.exports,module);
    const restored=new module.exports.BoxSkinCollection(suffix+'-skins',storage);
    assert.equal(restored.isUnlocked('coffee'),true); assert.equal(restored.isSelected('coffee'),true);
});
test('wallet instances share live game/shop balance', () => {
    const {wallet:game,suffix}=fresh(900), shop=new CoinWallet(suffix+'-coins');
    assert.equal(shop.spend(500),true); assert.equal(game.total,400); game.add(50); assert.equal(shop.total,450);
});
test('wallet rejects overdrafts fractions negatives and nonfinite values', () => {
    const {wallet:w}=fresh(500); for(const bad of [-1,0,1.5,501,NaN,Infinity])assert.equal(w.spend(bad),false);
    assert.equal(w.total,500); for(const bad of [-1,NaN,Infinity])w.add(bad); assert.equal(w.total,500);
});
test('wallet saturates rather than overflows and invalid saved data becomes zero', () => {
    const {wallet:w}=fresh(); w.add(Number.MAX_VALUE); assert.equal(w.total,Number.MAX_SAFE_INTEGER);
    for(const value of ['-20','NaN','Infinity','1.5']){const key='invalid-'+(++sequence);storage.setItem(key,value);assert.equal(new CoinWallet(key).total,0);}
});
test('stored unknown duplicate and locked selected ids are sanitized', () => {
    const key='sanitize-'+(++sequence); storage.setItem(key,JSON.stringify({version:1,unlocked:['sunny','sunny','unknown'],selected:['sunny','cake','unknown']}));
    const c=new BoxSkinCollection(key,storage);assert.deepEqual(plain(c.snapshot().unlocked),['sunny']);assert.deepEqual(plain(c.snapshot().selected),['sunny']);
});
test('malformed or unsupported storage cannot crash or unlock skins', () => {
    for(const raw of ['not json','null','42','{}','{"version":2,"unlocked":["sunny"],"selected":["sunny"]}']){
        const key='bad-'+(++sequence); storage.setItem(key,raw); const c=new BoxSkinCollection(key,storage);assert.equal(c.pool().length,1);
    }
});
test('blocked storage retains wallet and owned skins across reopening within session', () => {
    const {wallet:w,collection:c,suffix}=fresh(1000); c.unlock('sunny',w);
    storage.blockWrites=true; try{
        c.unlock('ocean',w);assert.equal(w.total,0);
        const reopened=new BoxSkinCollection(suffix+'-skins',storage), otherWallet=new CoinWallet(suffix+'-coins');
        assert.equal(reopened.isSelected('ocean'),true);assert.equal(otherWallet.total,0);
    }finally{storage.blockWrites=false;}
});
test('selected entries and pool snapshots cannot be mutated from outside', () => {
    const {wallet:w,collection:c}=fresh();c.unlock('sunny',w);c.pool().push('skin-cake');c.snapshot().selected.push('cake');
    assert.deepEqual(plain(c.pool()),['block-mover','skin-sunny']);
});
test('normal pool uses exact equal shares including default yellow', () => {
    const {wallet:w,collection:c}=fresh(9500);for(const s of BOX_SKINS)c.unlock(s.id,w);
    const counts={};for(let i=0;i<700;i++){const key=c.rollTexture(()=> (i+0.5)/700);counts[key]=(counts[key]||0)+1;}
    assert.equal(Object.keys(counts).length,7);for(const count of Object.values(counts))assert.equal(count,100);
});
test('random boundaries select default first and last selected skin last', () => {
    const {wallet:w,collection:c}=fresh(5000);c.unlock('royal',w);assert.equal(c.rollTexture(()=>0),'block-mover');
    assert.equal(c.rollTexture(()=>0.5),'skin-royal');assert.equal(c.rollTexture(()=>1-Number.EPSILON),'skin-royal');
});
test('combined two-stage probability keeps special 10 percent and ordinary skins equal', () => {
    const {wallet:w,collection:c}=fresh(9500);for(const s of BOX_SKINS)c.unlock(s.id,w);
    const counts={};for(let gate=0;gate<1000;gate++)for(const special of [0.125,0.375,0.625,0.875])for(let i=0;i<7;i++){
        const seq=[gate/1000,special],kind=rules.rollItemKind(()=>seq.shift());
        const key=kind==='normal'?c.rollTexture(()=> (i+0.5)/7):kind;counts[key]=(counts[key]||0)+1;
    }
    for(const kind of ['coin','shield','spring','speed'])assert.equal(counts[kind],700);
    for(const key of c.pool())assert.equal(counts[key],3600);
    assert.equal(['coin','shield','spring','speed'].reduce((n,k)=>n+counts[k],0)/28000,0.1);
});
test('unequipping one skin removes only its probability slot', () => {
    const {wallet:w,collection:c}=fresh(1500);c.unlock('sunny',w);c.unlock('ocean',w);c.toggle('sunny');
    assert.deepEqual(plain(c.pool()),['block-mover','skin-ocean']);
});
fs.writeFileSync(path.join(__dirname,'validation/model-results.json'),JSON.stringify({passed:results.length,tests:results},null,2));
console.log(`\n${results.length} model checks passed.`);
