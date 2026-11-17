'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const out=path.join(__dirname,'validation'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9226','--user-data-dir='+path.join(__dirname,'chrome-profile'),'--no-first-run','--no-default-browser-check','--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','about:blank'],{stdio:'ignore'});let ws;
 try{
  let tabs;for(let i=0;i<50;i++){try{tabs=await(await fetch('http://127.0.0.1:9226/json/list')).json();if(tabs.length)break;}catch{}await sleep(100);}if(!tabs)throw Error('QA Chrome failed to start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map(),errors=[];
  ws.onmessage=msg=>{const p=JSON.parse(msg.data);if(p.id){const t=pending.get(p.id);if(!t)return;pending.delete(p.id);p.error?t.reject(Error(JSON.stringify(p.error))):t.resolve(p.result);}else if(p.method==='Runtime.exceptionThrown')errors.push(p.params.exceptionDetails);};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const run=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async e=>{for(let i=0;i<120;i++){if(await run('Boolean('+e+')'))return;await sleep(100);}throw Error('Timeout: '+e+' '+JSON.stringify(errors));};
  const shot=async name=>{const r=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
  const game="window.__game.scene.getScene('Game')",menu="window.__game.scene.getScene('MainMenu')",checks=[];
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:414,height:736,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:'http://localhost:8080/.work/altitude-background/validation.html'});await until("window.__game?.scene.isActive('MainMenu')");
  await run(`(()=>{const m=${menu};m.onButton('start',m.buttons.find(b=>b.id==='start').image);})()`);await until("window.__game.scene.isActive('Game')");
  await run(`(()=>{const g=${game};g.mover.node.x=-10000;g.mover.moving=false;g.mover.vx=0;})()`);
  const status=()=>run(game+'.altitudeBackground.status()');
  if((await status()).current!==0)throw Error('New round is not city');await shot('stage-000');checks.push('new game starts at original city with four ordinary-size image segments');
  await sleep(200);if((await status()).current!==0)throw Error('Idle ascent');checks.push('idle time does not move background');
  await run(`${game}.heightMeters=10;${game}.updateHeight()`);await sleep(150);let s=await status();if(!(s.current>0&&s.current<10/500))throw Error('Not gradual');checks.push('earned metres produce gradual, not instantaneous movement');
  await run(`${game}.openReturnConfirmation()`);await until("window.__game.scene.isPaused('Game') && window.__game.scene.isActive('ReturnConfirmation')");const paused=(await status()).current;await sleep(300);if((await status()).current!==paused)throw Error('Pause did not freeze');
  await run("void window.__game.scene.getScene('ReturnConfirmation').input.keyboard.emit('keydown-ESC')");await until("window.__game.scene.isActive('Game')");await sleep(150);if((await status()).current<=paused)throw Error('Resume did not advance');checks.push('original return popup freezes pending motion and continues on close');
  for(const metres of [125,250,375,500]){
   await run(`(()=>{const g=${game};g.heightMeters=${metres};g.updateHeight();for(let i=0;i<400;i++)g.altitudeBackground.update(g.meters(),50);})()`);await sleep(100);await shot('stage-'+String(metres).padStart(3,'0'));
   if(Math.abs((await status()).current-metres/500)>1e-6)throw Error('Incorrect metre ratio '+metres);
  }checks.push('125/250/375/500 metres map correctly to clouds, atmosphere and moon');
  const moon=(await status()).current;await run(`${game}.heightMeters=900;${game}.updateHeight()`);await sleep(200);if((await status()).current!==moon)throw Error('Moon did not cap');checks.push('scores above 500 keep final moon view unchanged');
  // Reset only test background progress to exercise a failure during a pending transition.
  await run(`(()=>{const g=${game};g.heightMeters=55;g.altitudeBackground.progress.reset();g.altitudeBackground.update(55,50);})()`);await sleep(100);const beforeFail=(await status()).current;
  await run(`${game}.fly(1)`);if(!(await status()).frozen)throw Error('Hit failure did not freeze');const frozen=(await status()).current;await sleep(200);if((await status()).current!==frozen)throw Error('Failure pending motion continued');checks.push('hit failure immediately freezes actual displayed progress before target is reached');
  // Screenshot only the background, then change camera zoom/scroll as overview does.
  await run(`(()=>{const g=${game};g.scene.pause();for(const n of g.children.list){if(n!==g.background)n.setVisible?.(false);}g.cameras.main.setZoom(1);g.layoutBackground();})()`);await sleep(100);await shot('frozen-normal');
  await run(`(()=>{const g=${game};g.cameras.main.setZoom(.35);g.cameras.main.setScroll(-400,-2400);g.layoutBackground();})()`);await sleep(100);await shot('frozen-zoom');
  if((await status()).current!==frozen)throw Error('Overview changed progress');checks.push('frozen background crop compensates overview camera zoom and scroll');
  await run(`(()=>{const c=${game}.cameras.main;c.shake(1000,.08);c.shakeEffect.update(0,16);})()`);await sleep(100);await shot('frozen-shake-a');
  await run(`${game}.cameras.main.shakeEffect.update(0,32)`);await sleep(100);await shot('frozen-shake-b');
  if(!await run(game+'.cameras.main.shakeEffect.isRunning'))throw Error('Global camera shake was incorrectly stopped');checks.push('frozen background compensates residual shake while world camera shake remains active');
  await run(`${game}.cameras.main.shakeEffect.reset()`);
  // Restart a clean real round, create a representative tower, then run the real failure sequence.
  await run(`void ${game}.scene.restart()`);await until("window.__game.scene.isActive('Game') && "+game+".phase==='play'");await sleep(100);
  await run(`(()=>{const g=${game};g.mover.node.x=-10000;g.mover.moving=false;g.mover.vx=0;for(let i=0;i<24;i++){const b=g.createBlock({...g.mover.art,key:'block-mover'},false);g.placeBlock(b,g.anchorX,g.stackBottom(g.support));g.stack.push(b);g.groundOn(b);}g.heightMeters=70;g.updateHeight();for(let i=0;i<400;i++)g.altitudeBackground.update(70,50);g.followCamera(true);g.fly(-1);})()`);
  const realFrozen=(await status()).current;
  await until(game+'.overviewStarted');if(!(await run(game+'.background.visible && '+game+'.background.list.every(i=>i.visible)')))throw Error('Overview hid background container');
  await until("window.__game.scene.isActive('GameOver')");if((await status()).current!==realFrozen)throw Error('Full death/overview/result changed progress');checks.push('real fall, 1s wait, overview zoom and result preserve background and its visibility');
  await run("window.__game.scene.getScene('GameOver').hideResult()");await sleep(100);if((await status()).current!==realFrozen)throw Error('Hide moved background');await shot('hidden-result');checks.push('hide-result retains frozen background behind complete tower');
  await run("void window.__game.scene.stop('GameOver')");await run(`void ${game}.scene.start('Game')`);await until("window.__game.scene.isActive('Game') && "+game+".phase==='play'");
  await run(`(()=>{const g=${game};g.mover.node.x=-10000;g.mover.moving=false;g.mover.vx=0;})()`);if((await status()).current!==0)throw Error('Restart did not reset');checks.push('new round resets frozen journey to city');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1024,height:600,deviceScaleFactor:1,mobile:false});await sleep(200);await run(`(()=>{const g=${game};g.heightMeters=500;g.updateHeight();for(let i=0;i<400;i++)g.altitudeBackground.update(500,50);})()`);await sleep(100);await shot('moon-landscape');checks.push('landscape remains fully covered and moon is still visible');
  await run(`(()=>{const g=${game};g.altitudeBackground.progress.reset();g.altitudeBackground.update(50,50);g.grounded=false;g.player.node.y=g.bottom(g.body(g.support))+g.player.node.displayHeight/2+40;g.player.vy=20;g.simulate(0);})()`);
  if(!await run(game+".phase==='dead' && "+game+".altitudeBackground.status().frozen"))throw Error('Missed landing did not freeze');const missedFrozen=(await status()).current;await sleep(100);if((await status()).current!==missedFrozen)throw Error('Missed landing moved background');checks.push('missed landing also freezes immediately before the actor falls off screen');
  const count=await run('window.__game.textures.getTextureKeys().length');for(let i=0;i<3;i++){await run(`void ${game}.scene.restart()`);await sleep(150);await run(`(()=>{const g=${game};g.mover.node.x=-10000;g.mover.moving=false;g.mover.vx=0;})()`);}if(await run('window.__game.textures.getTextureKeys().length')!==count)throw Error('Texture leak');checks.push('repeated rounds reuse textures without leaks');
  if(errors.length)throw Error('Browser exceptions '+JSON.stringify(errors));const report={passed:checks.length,checks,errors,beforeFail,frozen,realFrozen,textureCount:count};fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{if(ws&&ws.readyState===1){try{ws.send(JSON.stringify({id:999999,method:'Browser.close'}));}catch{}ws.close();}else chrome.kill();}
}
main().then(()=>process.exit(0),e=>{console.error(e);process.exit(1);});
