from pathlib import Path
root=Path(r'D:\Repo\Phaser_Jump')
p=root/'.work/checkpoint/scripts/test_progress.cjs'
s=p.read_text(encoding='utf-8').replace('const { CheckpointProgress } = mod.exports;', 'const { CheckpointProgress, checkpointDistance } = mod.exports;')
a=s.index("test('初始 checkpoint")
b=s.index("test('未跳过",a)
s=s[:a]+'''test('初始里程碑是50米，距离随剩余米数连续缩小', () => {
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
'''+s[b:]
p.write_text(s,encoding='utf-8')
p=root/'.work/checkpoint/validation.html'
s=p.read_text(encoding='utf-8')
s=s.replace('<button id="gate">显示 50 米 checkpoint</button>', '<button id="start">查看开局预置</button><button id="step">正常前进一跳</button><button id="gate">显示 50 米 checkpoint</button>')
s=s.replace('  g.heightMeters=meters; g.perfectStreak=streak; g.updateHeight(); g.prepareCheckpoint();', '''  g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));g.mover.vx=0;
  g.heightMeters=meters; g.perfectStreak=streak; g.updateHeight(); g.prepareCheckpoint();
  await delay(320);''')
s=s.replace("document.getElementById('gate').onclick = async () => {", '''document.getElementById('start').onclick = async () => {
  const g=await reset(0,0);g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));
  report({meters:g.meters(),checkpoint:g.checkpoints.status()});
};
document.getElementById('step').onclick = async () => {
  let g=game.scene.getScene('Game');if(!g.scene.isActive() || g.phase!=='play')g=await reset(0,0);
  g.placeBlock(g.mover,g.anchorX,g.stackBottom(g.support));g.mover.vx=0;
  jump(g);simulateJump(g);
  g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));g.mover.vx=0;
  await delay(350);report({meters:g.meters(),checkpoint:g.checkpoints.status()});
};
document.getElementById('gate').onclick = async () => {''')
s=s.replace("    await test('成功跳过", '''    await test('开局已经预置50米目标，位于屏幕上方而不是等待临近才创建',async()=>{
      const g=await reset(0,0);const state=g.checkpoints.status();
      check(state.label===50 && state.visible,'开局应已有50米福袋');
      check(state.screenY+96<0,'开局福袋应在屏幕上方');
    });
    await test('从0米正常连续跳到50：同一目标始终存在，距离逐步缩小且不跳位',async()=>{
      const g=await reset(0,0);const gate=g.checkpoints.gate;let previousDistance=Infinity;
      while(g.meters()<50){
        check(g.checkpoints.gate===gate && gate.root.visible,'到达前应始终是同一个可见对象');
        const distance=g.top(g.player.node)-gate.root.y;
        check(distance<previousDistance,'角色与目标的距离应越来越近');previousDistance=distance;
        g.placeBlock(g.mover,g.anchorX,g.stackBottom(g.support));g.mover.vx=0;
        jump(g);simulateJump(g);
        g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));g.mover.vx=0;
        if(g.meters()<50){
          const before=gate.root.y;check(Math.abs(before-gate.targetY)>0.01,'更新时应保留当前位置并平滑移动');
          await delay(320);check(Math.abs(gate.root.y-gate.targetY)<0.1,'平滑更新应到达目标位置');
        }
      }
      check(g.checkpoints.status().bursts===1,'50米应成功爆袋');
      check(g.checkpoints.status().label===100,'50米通过后100米目标应立即预置');
    });
    await test('45→50一次增加5米，真实起跳也能越过红绳',async()=>{
      const g=await reset(45);jump(g);simulateJump(g);
      check(g.meters()===50 && g.checkpoints.status().bursts===1,'45→50必须正常触发');
    });
    await test('成功跳过''',1)
s=s.replace("activeEffects===0,'爆袋对象应清理'", "activeEffects===1,'爆袋对象应清理，仅保留下一个预置目标'")
s=s.replace("g.heightMeters=m-1;g.perfectStreak=3;g.updateHeight();g.prepareCheckpoint();", "g.heightMeters=m-1;g.perfectStreak=3;g.updateHeight();g.prepareCheckpoint();\n        g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));g.mover.vx=0;await delay(320);")
p.write_text(s,encoding='utf-8')
