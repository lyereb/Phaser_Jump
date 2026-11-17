from pathlib import Path
p=Path(r'D:\Repo\Phaser_Jump\.work\checkpoint\validation.html')
s=p.read_text(encoding='utf-8')
s=s.replace('function jump(g) {\n  g.grounded=false;', '''function jump(g) {
  g.qaDeliver=Math.abs(g.body(g.mover).x-g.anchorX)<10;
  if(g.qaDeliver) g.placeBlock(g.mover,g.anchorX+1000,g.stackBottom(g.support));
  g.grounded=false;''')
s=s.replace('    g.simulate(0.008);', '''    if(g.qaDeliver && g.bottom(g.player.node)<g.top(g.body(g.mover))-2) {
      g.placeBlock(g.mover,g.anchorX,g.stackBottom(g.support));g.qaDeliver=false;
    }
    g.simulate(0.008);''')
s=s.replace("check(g.meters()===54,'计分应为54');", "check(g.meters()===54,'计分应为54，实际'+g.meters()+'，阶段'+g.phase);")
p.write_text(s,encoding='utf-8')
