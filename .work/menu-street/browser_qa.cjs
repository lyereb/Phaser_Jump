'use strict';
const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '../..'), out = path.join(__dirname, 'validation');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function main() {
 const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--remote-debugging-port=9225','--user-data-dir='+path.join(__dirname,'chrome-profile'),'--no-first-run','--no-default-browser-check','--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'], {stdio:'ignore'});
 let ws;
 try {
  let tabs; for(let i=0;i<50;i++){try{tabs=await (await fetch('http://127.0.0.1:9225/json/list')).json();if(tabs.length)break;}catch{}await sleep(100);}
  if(!tabs) throw Error('QA Chrome did not start');
  ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let id=0; const pending=new Map(), errors=[];
  ws.onmessage=msg=>{const p=JSON.parse(msg.data);if(p.id){const t=pending.get(p.id);pending.delete(p.id);if(p.error)t.reject(Error(JSON.stringify(p.error)));else t.resolve(p.result);}else if(p.method==='Runtime.exceptionThrown')errors.push(p.params.exceptionDetails);};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const run=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await run('Boolean('+expression+')'))return;await sleep(100);}await shot('loading-failure');const state=await run("({url:location.href,body:document.body.innerText,scenes:window.__game?.scene.scenes.map(s=>[s.sys.settings.key,s.sys.settings.status]),ready:document.readyState})");throw Error('Timeout: '+expression+' '+JSON.stringify({state,errors}));};
  const shot=async name=>{const s=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(s.data,'base64'));};
  const menu="window.__game.scene.getScene('MainMenu')";
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:414,height:736,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:'http://localhost:8080/.work/menu-street/validation.html'});
  await until("window.__game?.scene.isActive('MainMenu') && "+menu+".buttons.length===5");
  await sleep(700);
  const baseline=await run(`(()=>{const m=${menu};return {width:m.scale.width,height:m.scale.height,logo:[m.logo.x,m.logo.y,m.logo.scaleX,m.logo.scaleY],box:[m.box.x,m.box.y,m.box.scaleX,m.box.scaleY],rider:[m.rider.x,m.rider.y,m.rider.scaleX,m.rider.scaleY],buttons:m.buttons.map(b=>[b.id,b.image.x,b.image.y,b.image.scaleX,b.image.scaleY])};})()`);
  if(process.argv.includes('--baseline')) { await shot('before');fs.writeFileSync(path.join(out,'baseline.json'),JSON.stringify(baseline,null,2));console.log('Captured baseline',baseline);return; }
  if(!await run(menu+'.background.nodes?.length===48')) throw Error('Street pool not created');
  const expected=JSON.parse(fs.readFileSync(path.join(out,'baseline.json'),'utf8'));
  if(JSON.stringify(baseline)!==JSON.stringify(expected)) throw Error('UI/rider layout changed: '+JSON.stringify(baseline));
  const checks=['UI/logo/box/rider layout unchanged'];
  await shot('after-portrait');
  const t0=await run(menu+'.background.travel'); await sleep(1500);const t1=await run(menu+'.background.travel');if(t1<=t0)throw Error('Background not advancing');checks.push('real scene background advances while rider idle');
  await run(`${menu}.background.travel=30;${menu}.background.resize(${menu}.scale.width,${menu}.scale.height)`); await sleep(100);await shot('after-travel');
  // Open each original overlay through original menu callbacks; check real Scene pause freezes travel.
  for(const [id,key]of [['settings','Settings'],['rank','WeeklyRanking'],['skin','SkinShop']]){
   await run(`(()=>{const m=${menu};m.onButton('${id}',m.buttons.find(b=>b.id==='${id}').image);})()`);
   await until(`window.__game.scene.isActive('${key}') && window.__game.scene.isPaused('MainMenu')`);
   const frozen=await run(menu+'.background.travel');await sleep(300);if(await run(menu+'.background.travel')!==frozen)throw Error(key+' failed to freeze');
   await run(`void window.__game.scene.getScene('${key}').input.keyboard.emit('keydown-ESC')`);
   await until("window.__game.scene.isActive('MainMenu')");await sleep(100);if(await run(menu+'.background.travel')<=frozen)throw Error(key+' failed to resume');checks.push(key+' pauses/resumes background');
  }
  // A simulated full house-pool wrap cannot grow the display list or leak a texture.
  const counts=await run(`(()=>{const m=${menu};return [m.children.length,m.game.textures.getTextureKeys().length]})()`);
  await run(`(()=>{const m=${menu};for(let i=0;i<20000;i++)m.background.update(50);})()`);
  const endCounts=await run(`(()=>{const m=${menu};return [m.children.length,m.game.textures.getTextureKeys().length]})()`);
  if(JSON.stringify(counts)!==JSON.stringify(endCounts))throw Error('Object leak');checks.push('long-running cycles keep fixed object/texture counts');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1024,height:600,deviceScaleFactor:1,mobile:false});await sleep(500);await shot('after-landscape');
  const view=await run(menu+'.background.view');if(Math.abs(view.cx-view.width/2)>0.01||Math.abs(view.horizon-view.height*.59)>0.01)throw Error('Resize projection mismatch');checks.push('landscape projection remains centered');
  const clipped=await run(`(()=>{const b=${menu}.background;b.travel=4;b.resize(b.view.width,b.view.height);return b.nodes.every(n=>!n.facade.visible||n.facade.vertices.every(Number.isFinite)) && b.nodes.filter(n=>n.house.slot===0&&n.house.side===-1).every(n=>!n.end.visible);})()`);
  if(!clipped)throw Error('Wide-screen near clipping failed');checks.push('wide-screen near-plane clips passed house fronts without invalid vertices');
  await cdp('Emulation.setDeviceMetricsOverride',{width:414,height:736,deviceScaleFactor:1,mobile:false});await sleep(500);
  await run(`(()=>{const m=${menu};m.hop();})()`);await sleep(200);if(!await run(menu+'.airborne'))throw Error('Menu hop broken');await sleep(1800);if(await run(menu+'.airborne'))throw Error('Menu hop never landed');checks.push('original menu jump/landing still works');
  await run(`(()=>{const m=${menu};m.onButton('start',m.buttons.find(b=>b.id==='start').image);})()`);await until("window.__game.scene.isActive('Game')");
  if(!await run(menu+'.background.destroyed'))throw Error('Background not cleaned on shutdown');checks.push('start launches original game and cleans background');
  await run("void window.__game.scene.getScene('Game').scene.start('MainMenu')");await until("window.__game.scene.isActive('MainMenu')");await sleep(500);
  if(!await run(menu+'.background.nodes.length===48 && !'+menu+'.background.destroyed'))throw Error('Menu restart broken');checks.push('returning to menu recreates one clean pool');
  await cdp('Page.navigate',{url:'http://localhost:8080/.work/menu-street/canvas.html'});
  await until("window.__game?.scene.isActive('Demo') && window.__game.scene.getScene('Demo').background?.canvasTexture");
  await sleep(400);await shot('canvas-portrait');
  const demo="window.__game.scene.getScene('Demo')";
  if(!await run('window.__game.renderer.type===1 && '+demo+'.background.nodes.every(n=>n.facade===null)'))throw Error('Canvas renderer not selected');
  checks.push('real Canvas renderer uses projected textured fallback');
  await run("void window.__game.scene.pause('Demo')");await sleep(100);const frozenCanvas=await run(demo+'.background.travel');await sleep(200);
  if(await run(demo+'.background.travel')!==frozenCanvas)throw Error('Canvas did not pause');
  await run("void window.__game.scene.resume('Demo')");await sleep(200);if(await run(demo+'.background.travel')<=frozenCanvas)throw Error('Canvas did not resume');checks.push('Canvas pause and resume preserve travel');
  const textureCount=await run('window.__game.textures.getTextureKeys().length');
  await run(`(()=>{const s=${demo};s.background.destroy();s.background.destroy();s.scene.restart();})()`);await sleep(700);
  if(!await run(demo+'.background.nodes.length===48 && window.__game.textures.getTextureKeys().length==='+textureCount))throw Error('Canvas texture leak/restart failure');checks.push('Canvas cleanup is idempotent and restart does not leak texture');
  if(errors.length)throw Error('Browser exceptions: '+JSON.stringify(errors));
  const report={passed:checks.length,checks,errors,renderers:['WebGL (2)','Canvas (1)'],counts};
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 } finally {if(ws&&ws.readyState===1){try{ws.send(JSON.stringify({id:999999,method:'Browser.close'}));}catch{}ws.close();}else chrome.kill();}
}
main().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
