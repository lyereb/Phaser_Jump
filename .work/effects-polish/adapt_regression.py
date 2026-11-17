from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=(ROOT/'.work/speed-box/test_speed.cjs').read_text(encoding='utf-8')
key='const dependencies = {'
assert key in s
stub="\n    '../altitudeBackground': {AltitudeBackground: class {constructor(g) {this.root=g.add.image(0,0,'background');} layout() {} update() {} freeze() {} destroy() {this.root.destroy();}}},\n    '../difficulty': load('src/game/difficulty.ts'),"
s=s.replace(key,key+stub,1)
s=s.replace('    setVisible(value)', '    setAlpha(value) {this.alpha=value;return this;}\n    setVisible(value)',1)
s=s.replace('class FakeEffects { constructor()',"class FakeEffects { springTrail() {} speedGranted(x,y) {this.toast(x,y,'后续 5 盒加速 +30%','#ffc0b8');} constructor()",1)
s=s.replace('    g.create();\n    return g;', '    g.create();\n    g.awaitingStart=false;\n    if(!g.mover)g.spawnMover();\n    return g;',1)
s=s.replace('g.create();', 'g.create(); g.awaitingStart=false; if(!g.mover)g.spawnMover();')
(ROOT/'.work/effects-polish/test_speed_compat.cjs').write_text(s,encoding='utf-8')
